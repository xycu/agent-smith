// Helpers shared by open-pr.mjs and pr-comment.mjs (issue #95). Neither the router nor any router module imports it.
// Standalone Node.js helpers.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { liveRunDirectory, lockRunDirectory } from "./run-lock.mjs";
import { removeTree } from "./remove-tree.mjs";

export const ID_RE = /^[a-z0-9][a-z0-9-]{0,99}$/;
export const DEFAULT_TIMEOUT_MS = 20000;
export const GH_HOST = "github.com";
const BODY_CAP = 60000;
const MENTION_RE = /(^|[^A-Za-z0-9_])@(?=[A-Za-z0-9])/g;

export function firstLine(text, max = 200) {
  return String(text ?? "").split(/\r?\n/).find((l) => l.trim() !== "")?.trim().slice(0, max) ?? "";
}

// Runs a command without a shell. Never throws. timedOut and missing are set instead.
export function spawn(cmd, args, timeoutMs, env, input, encoding = "utf8") {
  const res = spawnSync(cmd, args, {
    encoding,
    timeout: timeoutMs,
    input,
    stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
    maxBuffer: 64 * 1024 * 1024,
    env,
  });
  if (res.error) {
    const code = res.error.code;
    return {
      status: code === "ENOENT" ? 127 : code === "ETIMEDOUT" ? 124 : 1,
      stdout: "",
      stderr: String(res.error.message ?? ""),
      missing: code === "ENOENT",
      timedOut: code === "ETIMEDOUT",
    };
  }
  return { status: res.status ?? 1, stdout: res.stdout ?? "", stderr: res.stderr ?? "", missing: false, timedOut: false };
}

export function runGh(args, timeoutMs) {
  return spawn("gh", args, timeoutMs, { ...process.env, GH_PROMPT_DISABLED: "1" });
}

export function ghFailure(res, what) {
  if (res.missing) return "gh is not installed";
  if (res.timedOut) return "gh timed out";
  if (res.status === 4 || /gh auth login/.test(res.stderr)) return "gh is not authenticated";
  return `${what} failed: ${firstLine(res.stderr) || `gh exited ${res.status}`}`;
}

// Throws a plain Error; the caller wraps it into its own usage error.
export function checkReportArg(report) {
  const resolved = path.resolve(report);
  if (path.basename(resolved) !== "report.md" || path.basename(path.dirname(resolved)) !== "agent-smith") {
    throw new Error("--report must name a file report.md inside a directory agent-smith");
  }
}

// Mentions neutralized with a zero-width space (the escape, never the invisible character), then the cap.
// The cap counts UTF-16 code units and never splits a surrogate pair.
export function capBody(text) {
  text = text.replace(MENTION_RE, "$1@\u200b");
  if (text.length <= BODY_CAP) return text;
  let end = BODY_CAP;
  const last = text.charCodeAt(end - 1);
  if (last >= 0xd800 && last <= 0xdbff) end -= 1;
  const kept = text.slice(0, end);
  return `${kept}\n\nReport truncated: ${text.length - kept.length} characters omitted.`;
}

// A mkdtemp error propagates; a cleanup error never changes the result.
export function withTempDir(prefix, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  try {
    return fn(dir);
  } finally {
    try {
      removeTree(dir);
    } catch {
      // A cleanup error never changes the printed result.
    }
  }
}

export function isEntryPoint(metaUrl) {
  try {
    return fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(metaUrl));
  } catch {
    return false;
  }
}

// Publication works on a branch and may receive any valid archived report path. Protect both
// live chain identities in a stable order, including when an archive has moved the report.
export class PublicationSuspended extends Error {}

export function withPublicationLock(id, publish) {
  const held = [];
  const suspend = (reason) => {
    throw new PublicationSuspended(reason.startsWith("Execution suspended:") ? reason : `Execution suspended: ${reason}`);
  };
  try {
    for (const chain of ["10x", "openspec"]) {
      held.push(lockRunDirectory(id, liveRunDirectory(process.cwd(), id, chain), suspend));
    }
    return publish();
  } finally {
    for (const lock of held.reverse()) lock.release();
  }
}
