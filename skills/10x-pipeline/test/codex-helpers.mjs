// External-command fixture shared by runner and process-contention tests. It never calls a model.
import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { setTimeout } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { makeProject, run, gitEnv, writeOverride } from "./helpers.mjs";
import { makeOpenspecProject } from "../../openspec-pipeline/test/openspec-helpers.mjs";

export const RUNNER = fileURLToPath(new URL("../scripts/run-codex.mjs", import.meta.url));
const PRESET = JSON.parse(fs.readFileSync(new URL("../codex-policy.json", import.meta.url), "utf8"));

const FAKE = `#!${process.execPath}
const fs = require("node:fs");
const path = require("node:path");
const args = process.argv.slice(2);
const fixture = process.env.CODEX_FIXTURE;
const mode = JSON.parse(fs.readFileSync(path.join(fixture, "mode.json"), "utf8"));
if (args[0] === "app-server") {
  const readline = require("node:readline");
  readline.createInterface({ input: process.stdin }).on("line", line => {
    const request = JSON.parse(line);
    fs.appendFileSync(path.join(fixture, "metadata-calls.jsonl"), JSON.stringify(request) + "\\n");
    if (request.id === undefined) return;
    if (mode.metadataFailure) {
      process.stdout.write(JSON.stringify({ id: request.id, error: { message: "fixture failure" } }) + "\\n");
      return;
    }
    let result = {};
    if (request.method === "thread/list") {
      const pages = mode.pages?.[String(request.params.archived)];
      result = pages?.[request.params.cursor ?? "first"] ?? { data: [], nextCursor: null };
    }
    if (request.method === "thread/turns/list") {
      result = mode.turns?.[request.params.threadId] ?? { data: [{ status: "completed", startedAt: 10, completedAt: 20 }], nextCursor: null };
    }
    process.stdout.write(JSON.stringify({ id: mode.mismatchedResponse ? request.id + 1 : request.id, result }) + "\\n");
  });
  return;
}
if (args[0] === "--fixture-descendant") {
  const terminate = () => fs.writeFileSync(path.join(fixture, "descendant-terminating"), "yes");
  process.on("SIGTERM", terminate);
  process.on("SIGINT", terminate);
  fs.writeFileSync(path.join(fixture, "descendant-ready"), String(process.pid));
  setInterval(() => {
    if (fs.existsSync(path.join(fixture, "descendant-release"))) {
      if (mode.outOfGroup) fs.writeFileSync(path.join(fixture, "late-write"), "child work");
      fs.writeFileSync(path.join(fixture, "descendant-exited"), String(process.pid));
      process.exit(0);
    }
  }, 10);
  return;
}
let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", chunk => input += chunk);
process.stdin.on("end", async () => {
  fs.appendFileSync(path.join(fixture, "calls.jsonl"), JSON.stringify({ args, input, cwd: process.cwd(), pid: process.pid }) + "\\n");
  if (args[0] === "sandbox") {
    if (mode.preflightFailure || args.includes("missing-profile")) { process.exitCode = 1; return; }
    if (mode.removeExecutableAfterPreflight) fs.unlinkSync(process.argv[1]);
    process.stdout.write(JSON.stringify({ gitDir: "/fixture/git", commonDir: "/fixture/common", commit: "a".repeat(40) }) + "\\n");
    return;
  }
  if (mode.moveFrom) fs.renameSync(mode.moveFrom, mode.moveTo);
  if (!mode.noThread) process.stdout.write(JSON.stringify({ type: "thread.started", thread_id: mode.threadId ?? "root-fixture" }) + "\\n");
  if (mode.commitPaths) {
    const { execFileSync } = require("node:child_process");
    execFileSync("git", ["add", "--", ...mode.commitPaths], { cwd: process.cwd() });
    execFileSync("git", ["commit", "-m", mode.commitMessage, "-m", "Co-Authored-By: Codex <noreply@openai.com>"], { cwd: process.cwd(), stdio: ["ignore", "ignore", "pipe"] });
  }
  let descendantClosed;
  if (mode.descendant) {
    const { spawn } = require("node:child_process");
    const descendant = spawn(process.execPath, [__filename, "--fixture-descendant"], {
      detached: mode.outOfGroup === true, stdio: mode.outOfGroup ? "ignore" : ["ignore", "inherit", "inherit"],
    });
    descendantClosed = new Promise((resolve, reject) => {
      descendant.on("error", reject);
      descendant.on("close", (code, signal) => {
        fs.writeFileSync(path.join(fixture, "descendant-collected"), JSON.stringify({ code, signal }));
        if (code === 0) resolve();
        else reject(new Error("Fixture descendant exited unsuccessfully"));
      });
    });
  }
  if (mode.hold) {
    await new Promise(resolve => {
      const terminate = () => {
        fs.writeFileSync(path.join(fixture, "terminating"), "yes");
        if (!mode.holdUntilRelease) setTimeout(resolve, mode.closeDelay ?? 200);
      };
      process.on("SIGTERM", terminate);
      process.on("SIGINT", terminate);
      fs.writeFileSync(path.join(fixture, "ready"), String(process.pid));
      const timer = setInterval(() => {
        if (fs.existsSync(path.join(fixture, "release"))) { clearInterval(timer); resolve(); }
      }, 10);
      timer.unref();
      // A separate handle keeps the fake child alive while it is holding the lock.
      global.keepAlive = setInterval(() => {}, 1000);
    });
    clearInterval(global.keepAlive);
  }
  if (descendantClosed) {
    fs.writeFileSync(path.join(fixture, "descendant-waiting"), "yes");
    await descendantClosed;
  }
  const reply = mode.reply ?? 'RESULT: {"status":"done","note":"zażółć","signals":{"rigor":"thorough"},"custom":true}';
  fs.writeFileSync(args[args.indexOf("-o") + 1], mode.fileReply ?? reply);
  const events = mode.events ?? [
    { type: "turn.started" },
    { type: "item.completed", item: { type: "command_execution", exit_code: 0 } },
    { type: "item.completed", item: { type: "agent_message", text: reply } },
    { type: "turn.completed", usage: { input_tokens: 100, cached_input_tokens: 40, cache_write_input_tokens: 60, output_tokens: 10, reasoning_output_tokens: 5 } }
  ];
  const bytes = Buffer.from(events.map(e => JSON.stringify(e)).join("\\n") + "\\n");
  const fragment = mode.fragmentSize ?? 7;
  for (let i = 0; i < bytes.length; i += fragment) {
    process.stdout.write(bytes.subarray(i, i + fragment));
    await new Promise(resolve => setImmediate(resolve));
  }
  process.exitCode = mode.code ?? 0;
});
`;

export function codexFixture(chain = "10x", { profile = null, mode = {}, project: existingProject = null, host = "codex", policy: selectedPolicy = null } = {}) {
  const policy = selectedPolicy ?? { ...PRESET, codex: { profile } };
  const project = existingProject ?? (chain === "openspec" ? makeOpenspecProject({ policy }) : makeProject({ policy }));
  if (existingProject && selectedPolicy) writeOverride(project, policy);
  const fixture = path.join(project.base, "fake-codex");
  const bin = path.join(fixture, "bin");
  const tmp = path.join(makeProject({ id: "runner-temp" }).base, "tmp");
  fs.mkdirSync(bin, { recursive: true });
  fs.mkdirSync(tmp);
  fs.writeFileSync(path.join(bin, "codex"), FAKE, { mode: 0o755 });
  fs.writeFileSync(path.join(fixture, "mode.json"), JSON.stringify(mode));
  const env = { ...gitEnv(project), TMPDIR: tmp, PATH: `${bin}${path.delimiter}${process.env.PATH}`, CODEX_FIXTURE: fixture };
  const first = run(project, ["init", project.id, "--goal", "fix typo", "--host", host, "--chain", chain], { env });
  if (first.json?.action !== "run") throw new Error(first.stdout + first.stderr);
  return { project, action: first.json, env, fixture, tmp, chain };
}

export function calls(fixture) {
  const file = path.join(fixture, "calls.jsonl");
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse) : [];
}

// Git/toolchain helpers can leave their own files in TMPDIR. Keep cleanup assertions scoped to our runner.
export function runnerLeftovers(w) {
  return fs.readdirSync(w.tmp).filter(name => name.startsWith("agent-smith-"));
}

export function setMode(w, mode) {
  fs.writeFileSync(path.join(w.fixture, "mode.json"), JSON.stringify(mode));
}

export function execute(w, action = w.action) {
  const result = spawnSync(process.execPath, [RUNNER, w.project.id, "--chain", w.chain], {
    cwd: w.project.root, env: w.env, input: JSON.stringify(action), encoding: "utf8",
  });
  return { ...result, json: JSON.parse(result.stdout) };
}

export function startRunner(w) {
  const child = spawn(process.execPath, [RUNNER, w.project.id, "--chain", w.chain], {
    cwd: w.project.root, env: w.env, stdio: ["pipe", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", chunk => stdout += chunk);
  child.stderr.on("data", chunk => stderr += chunk);
  child.stdin.end(JSON.stringify(w.action));
  const closed = new Promise(resolve => child.on("close", (code, signal) => resolve({ code, signal, json: stdout.trim() ? JSON.parse(stdout) : null, stdout, stderr })));
  return { child, closed };
}

export async function waitForFile(file) {
  const deadline = Date.now() + 10000;
  while (!fs.existsSync(file)) {
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${file}`);
    await setTimeout(10);
  }
}
