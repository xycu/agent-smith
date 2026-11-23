// Shared pre-init Git fixtures. Each importing test file owns cleanupAll through its after hook.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { makeProject, run, git, gitEnv, gitInit } from "./helpers.mjs";

export const PREPARE_RUN = fileURLToPath(new URL("../scripts/prepare-run.mjs", import.meta.url));
export const REAL_GIT = spawnSync("which", ["git"], { encoding: "utf8" }).stdout.trim();
export const relChange = (chain) => `${chain === "openspec" ? "openspec" : "context"}/changes/demo`;
export const PROJECT_POLICY = "context/foundation/agent-smith-policy.json";

export function commitProjectFiles(p, files) {
  for (const [relative, contents] of Object.entries(files)) {
    const file = path.join(p.root, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, typeof contents === "string" ? contents : JSON.stringify(contents));
  }
  git(p, ["-C", p.root, "add", "--", ...Object.keys(files)]);
  git(p, ["-C", p.root, "commit", "-qm", "fixture setup inputs"]);
}

export function projectTools(p, tools) {
  const bin = path.join(p.base, ".git", "fixture-setup-bin");
  const log = path.join(bin, "commands.jsonl");
  fs.mkdirSync(bin, { recursive: true });
  const gitPath = "'" + REAL_GIT.replaceAll("'", "'\\''") + "'";
  fs.writeFileSync(path.join(bin, "git"), `#!/bin/sh\nexec ${gitPath} "$@"\n`, { mode: 0o755 });
  const writeTool = (name, code) => fs.writeFileSync(path.join(bin, name), `#!${process.execPath}
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
const args = process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(log)}, JSON.stringify({
  name: ${JSON.stringify(name)}, args, cwd: process.cwd(), stdin: fs.readFileSync(0, "utf8"),
}) + "\\n");
${code}
`, { mode: 0o755 });
  for (const [name, body] of Object.entries(tools)) writeTool(name, body);
  return {
    env: { PATH: bin },
    writeTool,
    calls: () => fs.existsSync(log) ? fs.readFileSync(log, "utf8").trim().split("\n").map(JSON.parse) : [],
  };
}

export function launchSetup(p, env) {
  const child = spawn(process.execPath, [PREPARE_RUN, "demo", "--chain", p.chain], {
    cwd: p.root, env: { ...gitEnv(p), ...env }, stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (part) => { stdout += part; });
  child.stderr.on("data", (part) => { stderr += part; });
  const done = new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) return reject(new Error(stderr));
      try { resolve(JSON.parse(stdout)); } catch (error) { reject(error); }
    });
  });
  return { child, done };
}

export function fixture(chain = "10x", nest = null, committed = false) {
  const p = makeProject({ policy: { isolation: { require: true } }, nest, change: false });
  p.chain = chain;
  if (chain === "openspec") fs.rmdirSync(p.changeDir);
  p.changeDir = path.join(p.root, relChange(chain));
  fs.mkdirSync(p.changeDir, { recursive: true });
  fs.writeFileSync(path.join(p.changeDir, "change.md"), "---\nchange_id: demo\nstatus: planned\n---\n");
  fs.writeFileSync(path.join(p.root, "tracked.txt"), "original\n");
  if (chain === "openspec") fs.writeFileSync(path.join(p.root, "openspec/config.yaml"), "schema: spec-driven\n");
  gitInit(p);
  git(p, ["add", "--", path.relative(p.base, path.join(p.root, "context/foundation")),
    path.relative(p.base, path.join(p.root, "tracked.txt"))]);
  if (chain === "openspec") git(p, ["add", "--", path.relative(p.base, path.join(p.root, "openspec/config.yaml"))]);
  if (committed) git(p, ["add", "--", path.relative(p.base, p.changeDir)]);
  git(p, ["commit", "-qm", "fixture"]);
  return p;
}

export function fixtureRemote(p, name = "origin", branch = "release") {
  const dir = path.join(p.base, ".git/fixture-remote.git");
  git(p, ["clone", "--quiet", "--bare", "--no-hardlinks", p.base, dir]);
  const remoteGit = (args) => git(p, ["--git-dir", dir, ...args]);
  remoteGit(["branch", branch, "HEAD"]);
  remoteGit(["symbolic-ref", "HEAD", `refs/heads/${branch}`]);
  git(p, ["remote", "add", name, dir]);
  return { dir, git: remoteGit, advance(message, target = branch) {
    const ref = `refs/heads/${target}`;
    const parent = remoteGit(["rev-parse", ref]);
    const next = remoteGit(["commit-tree", `${parent}^{tree}`, "-p", parent, "-m", message]);
    remoteGit(["update-ref", ref, next, parent]);
    return next;
  } };
}

export function setup(p, { env = {}, args = ["demo", "--chain", p.chain], script = PREPARE_RUN, timeout } = {}) {
  const res = run(p, args, { script, env: { ...gitEnv(p), ...env }, ...(timeout ? { timeout } : {}) });
  assert.equal(res.status, 0, res.stderr);
  assert.ok(res.json, res.stdout);
  assert.equal(res.stdout.trim().split("\n").length, 1);
  assert.equal(res.json.root, p.root);
  assert.deepEqual(res.json.left, []);
  if (res.json.reason !== null) assert.equal(res.json.runRoot, null);
  return res.json;
}

// A Node wrapper delegates only the permitted commands to real Git, records argv, and can fail or pause a call.
export function wrapper(p, mode = "", match = "", mutation = null) {
  const bin = path.join(p.base, "wrapper");
  fs.mkdirSync(bin, { recursive: true });
  const log = path.join(bin, "commands.jsonl");
  const signal = path.join(bin, "ready");
  const release = path.join(bin, "release");
  const script = `#!${process.execPath}
import fs from "node:fs";
import { spawnSync } from "node:child_process";
const args = process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(log)}, JSON.stringify(args) + "\\n");
const command = args[0] === "-C" ? args[2] : args[0];
const allowed = ["rev-parse", "symbolic-ref", "show-ref", "status", "check-ignore", "worktree", "ls-files", "ls-tree", "merge-base", "hash-object", "check-ref-format", "show", "remote", "ls-remote", "fetch", "rev-list"];
if (!allowed.includes(command) || (command === "worktree" && !["add", "list"].includes(args[1]))) process.exit(99);
const matched = args.join(" ").includes(${JSON.stringify(match)});
if (${JSON.stringify(mode)} === "fail" && matched) { process.stderr.write("injected Git failure"); process.exit(70); }
if (${JSON.stringify(mode)} === "timeout" && matched) {
  process.on("SIGTERM", () => { fs.writeFileSync(${JSON.stringify(signal)}, "terminated"); process.exit(0); });
  setTimeout(() => process.exit(71), 130000);
} else {
  const mutation = ${JSON.stringify(mutation)};
  if (${JSON.stringify(mode)} === "edit" && matched) {
    const calls = fs.readFileSync(${JSON.stringify(log)}, "utf8").trim().split("\\n").map(JSON.parse);
    if (calls.filter((call) => call.join(" ").includes(${JSON.stringify(match)})).length === mutation.after) {
      fs.writeFileSync(mutation.file, mutation.text);
    }
  }
  const res = spawnSync(${JSON.stringify(REAL_GIT)}, args, { env: process.env, encoding: "utf8",
    input: command === "hash-object" ? fs.readFileSync(0) : undefined });
  if (${JSON.stringify(mode)} === "pause" && command === "worktree" && args[1] === "add" && res.status === 0) {
    fs.writeFileSync(${JSON.stringify(signal)}, "registered");
    const deadline = Date.now() + 90000;
    while (!fs.existsSync(${JSON.stringify(release)})) {
      if (Date.now() > deadline) process.exit(72);
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);
    }
  }
  process.stdout.write(${JSON.stringify(mode)} === "reverse" && command === "worktree" && args[1] === "list" ? res.stdout.split("\\0\\0").filter(Boolean).reverse().join("\\0\\0") + "\\0\\0" : res.stdout || "");
  process.stderr.write(res.stderr || "");
  process.exit(res.status ?? 73);
}
`;
  fs.writeFileSync(path.join(bin, "git"), script, { mode: 0o755 });
  return { env: { PATH: `${bin}${path.delimiter}${process.env.PATH}` }, log, signal, release };
}

