// The per-run lock of init, next and usage (run-state-lock). Black-box through the CLI; TMPDIR points the lock into a
// scratch directory the test controls.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { cleanupAll, makeProject, run, writeLog, writeMetaFile, entry } from "./helpers.mjs";
import { makeOpenspecProject } from "./openspec-helpers.mjs";
import { runLockPath } from "../scripts/state.mjs";

after(cleanupAll);

const FLAGS = ["--tokens", "1200"];

function setup(project, extra = []) {
  writeLog(project, [entry(1, "plan")]);
  writeMetaFile(project, { id: "demo", goal: "fix typo", rigor: { level: "standard" } });
  const tmp = fs.realpathSync(fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "lock-")));
  const lock = path.join(tmp, path.basename(runLockPath(project.agentDir)));
  // runLockPath uses this process's os.tmpdir(); only the file name is reused.
  return { env: { TMPDIR: tmp }, tmp, lock, logFile: path.join(project.agentDir, "run.jsonl"), extra };
}

const usage = (project, env, chain = []) => run(project, ["usage", project.id, "1", ...FLAGS, ...chain], { env });
const leftovers = (tmp) => fs.readdirSync(tmp).filter((f) => f.endsWith(".lock") || f.endsWith(".tmp"));

// A live pid that is not the router's own: the test process.
const holdLive = (lock) => fs.writeFileSync(lock, String(process.pid));

function deadPid() {
  const r = spawnSync(process.execPath, ["-e", "0"]);
  return r.pid;
}

test("1.1a live lock halts next and usage, run.jsonl unchanged", () => {
  const project = makeProject();
  const { env, lock, logFile, tmp } = setup(project);
  holdLive(lock);
  const before = fs.readFileSync(logFile, "utf8");
  for (const res of [usage(project, env), run(project, ["next", project.id], { env })]) {
    assert.equal(res.status, 1);
    assert.equal(res.json.action, "halt");
    assert.match(res.json.reason, /Another init, next or usage of change demo is running/);
    assert.ok(res.json.reason.includes(lock));
  }
  assert.equal(fs.readFileSync(logFile, "utf8"), before);
  assert.equal(fs.readFileSync(lock, "utf8"), String(process.pid), "a held lock is not touched");
  assert.deepEqual(leftovers(tmp), [path.basename(lock)]);
});

test("1.1b a lock of a dead pid is replaced and the command runs", () => {
  const project = makeProject();
  const { env, lock, tmp } = setup(project);
  fs.writeFileSync(lock, String(deadPid()));
  const res = usage(project, env);
  assert.equal(res.status, 0, res.stdout);
  assert.equal(res.json.attached, true);
  assert.deepEqual(leftovers(tmp), []);
});

test("1.1b an unparsable lock is stale", () => {
  const project = makeProject();
  const { env, lock } = setup(project);
  fs.writeFileSync(lock, "junk");
  assert.equal(usage(project, env).status, 0);
});

test("1.1c no lock file remains after a normal run or a halting run", () => {
  const project = makeProject();
  const { env, tmp } = setup(project);
  assert.equal(usage(project, env).status, 0);
  assert.deepEqual(leftovers(tmp), []);
  const second = usage(project, env, ["--tool-uses", "x"]);
  assert.equal(second.status, 1);
  assert.deepEqual(leftovers(tmp), []);
  run(project, ["next", project.id], { env });
  assert.deepEqual(leftovers(tmp), []);
});

test("1.1d status ignores a held lock", () => {
  const project = makeProject();
  const { env, lock } = setup(project);
  holdLive(lock);
  const res = run(project, ["status", project.id], { env });
  assert.equal(res.status, 0);
  assert.ok(res.json);
});

test("1.1e OpenSpec chain next halts on a held lock", () => {
  const project = makeOpenspecProject({ proposal: true, specs: 1, tasks: { done: 1 } });
  const { env, lock, logFile, tmp } = setup(project);
  holdLive(lock);
  const before = fs.readFileSync(logFile, "utf8");
  const res = run(project, ["next", project.id, "--chain", "openspec"], { env });
  assert.equal(res.status, 1);
  assert.match(res.json.reason, /Another init, next or usage/);
  assert.equal(fs.readFileSync(logFile, "utf8"), before);
  const u = usage(project, env, ["--chain", "openspec"]);
  assert.match(u.json.reason, /Another init, next or usage/);
  fs.unlinkSync(lock);
  assert.deepEqual(leftovers(tmp), []);
});

test("1.1f a lock made by temp-and-link carries its pid at once", () => {
  const project = makeProject();
  const { env, lock, tmp } = setup(project);
  const pidFile = path.join(tmp, "pid.tmp");
  fs.writeFileSync(pidFile, String(process.pid));
  fs.linkSync(pidFile, lock);
  fs.unlinkSync(pidFile);
  assert.equal(fs.readFileSync(lock, "utf8"), String(process.pid));
  assert.equal(usage(project, env).status, 1);
});
