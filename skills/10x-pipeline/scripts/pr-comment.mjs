#!/usr/bin/env node
// Posts the final run report of a change as one comment on the open pull request of the current branch.
// Opt-in: the orchestrator runs it only for a run started with --pr-comment. The router never calls it.
// Prints exactly one JSON object and exits 0 for every runtime outcome; exit 2 is for usage errors only.
// Plain node: built-ins only. Node 18 safe.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const USAGE = "usage: node pr-comment.mjs <change-id> [--report <path>] [--timeout-ms <n>]";
const ID_RE = /^[a-z0-9][a-z0-9-]{0,99}$/;
const DEFAULT_TIMEOUT_MS = 20000;
const GH_HOST = "github.com";
const PR_URL_RE = /^https:\/\/([^/]+)\/([^/]+)\/([^/]+)\/pull\/(\d+)/;
const BODY_CAP = 60000;
const MENTION_RE = /(^|[^A-Za-z0-9_])@(?=[A-Za-z0-9])/g;

// Projects and bounds the comment list; every decision is made in JS, so a fake gh can test it.
export const COMMENT_JQ = ".[] | {id: .id, login: .user.login, head: ((.body // \"\") | .[0:200])}";

class UsageError extends Error {}

function parseArgs(argv) {
  const opts = { id: null, report: null, timeoutMs: DEFAULT_TIMEOUT_MS };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--report" || a === "--timeout-ms") {
      const value = argv[++i];
      if (value === undefined) throw new UsageError(`${a} needs a value`);
      if (a === "--report") opts.report = value;
      else if (/^\d+$/.test(value) && Number(value) > 0) opts.timeoutMs = Number(value);
      else throw new UsageError("--timeout-ms must be a positive integer");
    } else if (a.startsWith("-")) {
      throw new UsageError(`unknown flag ${a}`);
    } else if (opts.id === null) {
      opts.id = a;
    } else {
      throw new UsageError(`unexpected argument ${a}`);
    }
  }
  if (opts.id === null) throw new UsageError("missing <change-id>");
  if (!ID_RE.test(opts.id)) throw new UsageError("<change-id> must match ^[a-z0-9][a-z0-9-]{0,99}$");
  if (opts.report !== null) {
    const resolved = path.resolve(opts.report);
    if (path.basename(resolved) !== "report.md" || path.basename(path.dirname(resolved)) !== "agent-smith") {
      throw new UsageError("--report must name a file report.md inside a directory agent-smith");
    }
  }
  return opts;
}

function result(action, fields = {}) {
  return {
    posted: action === "created" || action === "updated",
    action,
    reason: null,
    url: null,
    pr: null,
    match: null,
    ...fields,
  };
}

function skip(reason, pr = null) {
  return result("skipped", { reason, pr });
}

function firstLine(text, max = 200) {
  return String(text ?? "").split(/\r?\n/).find((l) => l.trim() !== "")?.trim().slice(0, max) ?? "";
}

// Runs gh without a shell. Never throws. timedOut and missing are set instead.
function runGh(args, timeoutMs) {
  const res = spawnSync("gh", args, {
    encoding: "utf8",
    timeout: timeoutMs,
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, GH_PROMPT_DISABLED: "1" },
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

function readReport(opts) {
  const defaultPath = path.join("context", "changes", opts.id, "agent-smith", "report.md");
  const file = opts.report ?? defaultPath;
  let text = null;
  try {
    if (fs.statSync(file).isFile()) text = fs.readFileSync(file, "utf8");
  } catch { /* text stays null */ }
  if (text === null) {
    const hint = opts.report === null
      ? ` (after an archive pass --report context/archive/<date>-${opts.id}/agent-smith/report.md)`
      : "";
    return { skip: `report not found: ${file}${hint}` };
  }
  if (text.trim() === "") return { skip: "report is empty" };
  if (text.split(/\r?\n/)[0] !== `# Run report: ${opts.id}`) return { skip: `report is not a run report for ${opts.id}` };
  return { text };
}

function findPullRequest(opts) {
  const view = runGh(["pr", "view", "--json", "number,url,state,isDraft"], opts.timeoutMs);
  if (view.missing) return { skip: "gh is not installed" };
  if (view.timedOut) return { skip: "gh timed out" };
  if (view.status !== 0) {
    const err = view.stderr;
    if (view.status === 4 || /gh auth login/.test(err)) return { skip: "gh is not authenticated" };
    if (/no pull requests found/i.test(err)) return { skip: "no pull request for this branch" };
    if (/not a git repository/i.test(err)) return { skip: "not a git work tree" };
    return { skip: `gh pr view failed: ${firstLine(err)}` };
  }
  let pr = null;
  try { pr = JSON.parse(view.stdout); } catch { /* pr stays null */ }
  if (!pr || typeof pr !== "object" || typeof pr.state !== "string" || typeof pr.url !== "string") {
    return { skip: "unexpected gh output" };
  }
  if (pr.state !== "OPEN") return { skip: `pull request is ${pr.state}`, pr: pr.url };
  const m = PR_URL_RE.exec(pr.url);
  if (!m) return { skip: "unexpected gh output" };
  if (m[1] !== GH_HOST) return { skip: `unsupported host ${m[1]}`, pr: pr.url };
  return { pr: { url: pr.url, owner: m[2], repo: m[3], number: Number(m[4]) } };
}

function markerFor(id) {
  return `<!-- agent-smith:pr-report change=${id} -->`;
}

// Marker line, blank line, report with mentions neutralized. The cap counts UTF-16 code units and never splits a pair.
function buildBody(id, reportText) {
  const text = `${markerFor(id)}\n\n${reportText.replace(MENTION_RE, "$1@\u200b")}`;
  if (text.length <= BODY_CAP) return text;
  let end = BODY_CAP;
  const last = text.charCodeAt(end - 1);
  if (last >= 0xd800 && last <= 0xdbff) end -= 1;
  const kept = text.slice(0, end);
  return `${kept}\n\nReport truncated: ${text.length - kept.length} characters omitted.`;
}

// Returns { login } or { skip }. Fails closed: without the viewer's login the script cannot tell its own comment from a stranger's.
function viewerLogin(opts) {
  const res = runGh(["api", "user", "--jq", ".login"], opts.timeoutMs);
  if (res.timedOut) return { skip: "viewer lookup failed: gh timed out" };
  if (res.status !== 0) return { skip: `viewer lookup failed: ${firstLine(res.stderr) || `gh exited ${res.status}`}` };
  const login = res.stdout.trim();
  if (login === "") return { skip: "viewer lookup failed: empty login" };
  return { login };
}

// Returns { comments } or { skip }.
function listComments(opts, pr) {
  const res = runGh(["api", "--paginate", `repos/${pr.owner}/${pr.repo}/issues/${pr.number}/comments`, "--jq", COMMENT_JQ], opts.timeoutMs);
  if (res.timedOut) return { skip: "comment lookup failed: gh timed out" };
  if (res.status !== 0) return { skip: `comment lookup failed: ${firstLine(res.stderr) || `gh exited ${res.status}`}` };
  const comments = [];
  let lines = 0;
  for (const line of res.stdout.split("\n")) {
    if (line.trim() === "") continue;
    lines += 1;
    let c = null;
    try { c = JSON.parse(line); } catch { continue; }
    if (c && typeof c === "object" && typeof c.id === "number" && typeof c.head === "string") comments.push(c);
  }
  // Output with no valid entry is not an empty list (pretty-printed or changed shape): reading it as empty would POST a duplicate.
  if (lines > 0 && comments.length === 0) return { skip: "comment lookup failed: unexpected gh output" };
  return { comments };
}

// The author comparison below is the one line the mutation test breaks.
function pickTarget(comments, marker, viewer) {
  const candidates = comments.filter((c) => c.head.startsWith(marker)).sort((a, b) => a.id - b.id);
  const mine = candidates.find((c) => c.login === viewer);
  return mine ? { comment: mine, match: "author" } : null;
}

function post(opts, found, body) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "as-prc-"));
  try {
    const file = path.join(dir, "body.md");
    fs.writeFileSync(file, body);
    const viewer = viewerLogin(opts);
    if (viewer.skip) return skip(viewer.skip, found.url);
    const listed = listComments(opts, found);
    if (listed.skip) return skip(listed.skip, found.url);
    const target = pickTarget(listed.comments, markerFor(opts.id), viewer.login);
    const base = `repos/${found.owner}/${found.repo}`;
    const args = target
      ? ["api", "--method", "PATCH", `${base}/issues/comments/${target.comment.id}`, "-F", `body=@${file}`, "--jq", ".html_url"]
      : ["api", "--method", "POST", `${base}/issues/${found.number}/comments`, "-F", `body=@${file}`, "--jq", ".html_url"];
    const res = runGh(args, opts.timeoutMs);
    const url = res.status === 0 ? res.stdout.trim() : "";
    if (url === "") {
      const why = res.timedOut ? "gh timed out" : firstLine(res.stderr) || (res.status === 0 ? "empty response" : `gh exited ${res.status}`);
      return skip(`comment request failed: ${why}`, found.url);
    }
    return result(target ? "updated" : "created", { url, pr: found.url, match: target ? target.match : null });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function run(opts) {
  const report = readReport(opts);
  if (report.skip) return skip(report.skip);
  const found = findPullRequest(opts);
  if (found.skip) return skip(found.skip, found.pr ?? null);
  return post(opts, found.pr, buildBody(opts.id, report.text));
}

function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (e) {
    if (!(e instanceof UsageError)) throw e;
    process.stderr.write(`${e.message}\n${USAGE}\n`);
    process.exitCode = 2;
    return;
  }
  let out;
  try {
    out = run(opts);
  } catch (e) {
    out = skip(`internal error: ${firstLine(e?.message) || "unknown"}`);
  }
  process.stdout.write(`${JSON.stringify(out)}\n`);
}

function isEntryPoint() {
  try {
    return fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isEntryPoint()) main();
