// The per-run lock of init, next and usage (run-state-lock). Black-box through the CLI; TMPDIR points the lock into a
// scratch directory the test controls.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { setTimeout } from "node:timers/promises";
import { cleanupAll, makeProject, run, writeLog, writeMetaFile, entry } from "./helpers.mjs";
import { makeOpenspecProject } from "../../openspec-pipeline/test/openspec-helpers.mjs";
import { runLockPath } from "../scripts/state.mjs";
import { removeTree } from "../scripts/remove-tree.mjs";
import { codexFixture, execute, startRunner, waitForFile, runnerLeftovers, calls, setMode } from "./codex-helpers.mjs";

const lockDirs = [];
after(() => {
  cleanupAll();
  for (const dir of lockDirs.splice(0)) removeTree(dir);
});

const FLAGS = ["--tokens", "1200"];

function setup(project, extra = []) {
  writeLog(project, [entry(1, "plan")]);
  writeMetaFile(project, { id: "demo", goal: "fix typo", rigor: { level: "standard" } });
  const tmp = fs.realpathSync(fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "lock-")));
  lockDirs.push(tmp);
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

test("a dead execution owner with uncertain child termination retains its lock", () => {
  const project = makeProject();
  const { env, lock, tmp } = setup(project);
  for (const owner of [
    { pid: deadPid(), childPid: null, processGroup: true },
    { pid: deadPid(), childPid: deadPid(), processGroup: false },
  ]) {
    const contents = JSON.stringify(owner);
    fs.writeFileSync(lock, contents);
    const result = usage(project, env);
    assert.equal(result.status, 1, result.stdout);
    assert.match(result.json.reason, /execution.*lock|lock.*execution/i);
    assert.equal(fs.readFileSync(lock, "utf8"), contents);
    assert.deepEqual(leftovers(tmp), [path.basename(lock)]);
  }
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


for (const chain of ["10x", "openspec"]) {
  test(`${chain}: runner crash retains exclusion until its child process group exits`, { skip: process.platform === "win32" }, async (t) => {
    const w = codexFixture(chain, { mode: { hold: true } });
    const p = w.project;
    const statusArgs = ["status", p.id, "--chain", chain];
    assert.equal(run(p, [...statusArgs, "--report"], { env: w.env }).status, 0);
    const before = fs.readFileSync(path.join(p.agentDir, "report.md"));
    const running = startRunner(w);
    let childPid;
    const stopChild = async () => {
      if (!childPid) return;
      try { process.kill(-childPid, "SIGKILL"); } catch (error) { if (error.code !== "ESRCH") throw error; }
      const deadline = Date.now() + 10000;
      for (;;) {
        try { process.kill(-childPid, 0); } catch (error) { if (error.code === "ESRCH") break; throw error; }
        assert.ok(Date.now() < deadline, "orphaned process group must terminate");
        await setTimeout(10);
      }
      childPid = null;
    };
    t.after(async () => { running.child.kill("SIGKILL"); await stopChild(); });
    await waitForFile(path.join(w.fixture, "ready"));
    childPid = Number(fs.readFileSync(path.join(w.fixture, "ready"), "utf8"));
    running.child.kill("SIGKILL");
    assert.equal((await running.closed).signal, "SIGKILL");
    process.kill(childPid, 0);
    setMode(w, {});
    const duplicate = execute(w);
    assert.equal(duplicate.json.launched, false, duplicate.stdout);
    assert.match(duplicate.json.reason, /lock/);
    assert.equal(calls(w.fixture).filter(call => call.args[0] === "exec").length, 1);
    for (const args of [[...statusArgs, "--report"], ["next", p.id, "--chain", chain],
      ["init", p.id, "--chain", chain], ["usage", p.id, "1", "--tokens", "10", "--chain", chain]]) {
      const result = run(p, args, { env: w.env });
      assert.equal(result.status, 1, result.stdout);
      assert.match(result.json.reason, /lock/);
    }
    assert.equal(run(p, statusArgs, { env: w.env }).status, 0);
    assert.deepEqual(fs.readFileSync(path.join(p.agentDir, "report.md")), before);
    assert.deepEqual(fs.readdirSync(w.tmp).filter(name => name.endsWith(".tmp")), []);
    await stopChild();
    assert.equal(run(p, [...statusArgs, "--report"], { env: w.env }).status, 0);
    assert.equal(execute(w).json.completed, true, "execution can resume after the orphaned group exits");
  });

  test(`${chain}: a runner holds the shared lock through close, plain status reads and report status refuses`, async (t) => {
    const w = codexFixture(chain, { mode: { hold: true, holdUntilRelease: true } });
    const p = w.project;
    const statusArgs = ["status", p.id, "--chain", chain];
    const reportFile = path.join(p.agentDir, "report.md");
    assert.equal(run(p, [...statusArgs, "--report"], { env: w.env }).status, 0);
    const before = fs.readFileSync(reportFile);
    const running = startRunner(w);
    const release = path.join(w.fixture, "release");
    t.after(async () => {
      fs.writeFileSync(release, "yes");
      running.child.kill("SIGTERM");
      const closed = await running.closed;
      assert.notEqual(closed.json?.signal, "SIGKILL", closed.stdout);
    });
    await waitForFile(path.join(w.fixture, "ready"));
    const verifyHeld = () => {
      const duplicate = execute(w);
      assert.equal(duplicate.json.launched, false);
      assert.match(duplicate.json.reason, /lock/);
      for (const args of [[...statusArgs, "--report"], ["next", p.id, "--chain", chain],
        ["init", p.id, "--chain", chain], ["usage", p.id, "1", "--tokens", "10", "--chain", chain]]) {
        const result = run(p, args, { env: w.env });
        assert.equal(result.status, 1, result.stdout);
        assert.match(result.json.reason, /lock/);
      }
      assert.equal(run(p, statusArgs, { env: w.env }).status, 0);
      assert.deepEqual(fs.readFileSync(reportFile), before);
    };
    verifyHeld();
    running.child.kill("SIGTERM");
    await waitForFile(path.join(w.fixture, "terminating"));
    const blocked = run(p, [...statusArgs, "--report"], { env: w.env });
    assert.equal(blocked.status, 1, "lock is retained while the child is terminating");
    assert.deepEqual(fs.readFileSync(reportFile), before);
    fs.writeFileSync(release, "yes");
    const closed = await running.closed;
    assert.equal(closed.json.launched, true, closed.stdout);
    assert.equal(closed.json.completed, false, closed.stdout);
    assert.match(closed.json.reason, /cancelled/, closed.stdout);
    assert.equal(closed.json.exitCode, 0, closed.stdout);
    assert.equal(closed.json.signal, null, closed.stdout);
    assert.deepEqual(runnerLeftovers(w), []);
    assert.equal(run(p, [...statusArgs, "--report"], { env: w.env }).status, 0);
  });
}
