// The per-run lock of init, next and usage (run-state-lock). Black-box through the CLI; TMPDIR points the lock into a
// scratch directory the test controls.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { setTimeout } from "node:timers/promises";
import { cleanupAll, makeProject, run, writeLog, writeMetaFile, entry, git, gitInit, commitFiles, writeResult } from "./helpers.mjs";
import { makeOpenspecProject } from "../../openspec-pipeline/test/openspec-helpers.mjs";
import { runLockPath } from "../scripts/state.mjs";
import { liveRunDirectory } from "../scripts/run-lock.mjs";
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
const leftovers = (tmp) => fs.readdirSync(tmp).filter((f) => f.endsWith(".lock") || f.endsWith(".tmp") || f.endsWith(".takeover"));

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
    assert.ok(res.json.reason.includes(`ps -p ${process.pid} -o command=`));
    assert.match(res.json.reason, /removes the lock file and retries\. Nothing was written\./);
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

test("1.1g a stale lock with a guard held by a live pid halts after the wait and keeps the lock", () => {
  const project = makeProject();
  const { env, lock, tmp } = setup(project);
  fs.writeFileSync(lock, String(deadPid()));
  fs.writeFileSync(`${lock}.takeover`, String(process.pid));
  const before = fs.readFileSync(lock, "utf8");
  const res = usage(project, env);
  assert.equal(res.status, 1);
  assert.equal(res.json.action, "halt");
  assert.ok(res.json.reason.includes(`${lock}.takeover`));
  assert.match(res.json.reason, /removes the guard file and retries\. Nothing was written\./);
  assert.equal(fs.readFileSync(lock, "utf8"), before);
  assert.deepEqual(leftovers(tmp).sort(), [path.basename(lock), `${path.basename(lock)}.takeover`].sort());
});

test("1.1h a stale lock with a guard of a dead pid halts with removal advice and leaves both files", () => {
  const project = makeProject();
  const { env, lock, tmp } = setup(project);
  fs.writeFileSync(lock, String(deadPid()));
  fs.writeFileSync(`${lock}.takeover`, String(deadPid()));
  const res = usage(project, env);
  assert.equal(res.status, 1);
  assert.match(res.json.reason, /Remove that file when no router runs/);
  assert.ok(res.json.reason.includes(`${lock}.takeover`));
  assert.equal(leftovers(tmp).length, 2);
});

test("1.1i a native lock with a dead owner is retained and creates no guard", () => {
  const project = makeProject();
  const { env, lock, tmp } = setup(project);
  const body = JSON.stringify({ pid: deadPid(), childPid: null, processGroup: true, native: { threadId: "t1" } });
  fs.writeFileSync(lock, body);
  const res = usage(project, env);
  assert.equal(res.status, 1);
  assert.match(res.json.reason, /native ownership unresolved/);
  assert.equal(fs.readFileSync(lock, "utf8"), body);
  assert.deepEqual(leftovers(tmp), [path.basename(lock)]);
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
    { pid: deadPid(), childPid: null, processGroup: true, native: { threadId: null } },
    { pid: deadPid(), childPid: deadPid(), processGroup: true, native: { threadId: "saved-flat-prompt" } },
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
  test(`${chain}: native runner crash retains exclusion after its child process group exits`, { skip: process.platform === "win32" }, async (t) => {
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
    // SIGKILL can interrupt the owner's atomic lock update before rename; refused callers must clean their own temps.
    const crashTemp = path.basename(runLockPath(p.agentDir)) + "." + running.child.pid + ".tmp";
    assert.deepEqual(fs.readdirSync(w.tmp).filter(name => name.endsWith(".tmp") && name !== crashTemp), []);
    await stopChild();
    assert.equal(run(p, [...statusArgs, "--report"], { env: w.env }).status, 1);
    assert.equal(execute(w).json.completed, false, "group exit alone cannot reconcile native children");
  });

  for (const descendant of [false, true]) {
    test(`${chain}: lock stays held through ${descendant ? "descendant collection" : "close"}`, { skip: descendant && process.platform === "win32" }, async (t) => {
      const w = codexFixture(chain, { mode: { hold: true, holdUntilRelease: true, descendant } });
      const p = w.project;
      const statusArgs = ["status", p.id, "--chain", chain];
      const reportFile = path.join(p.agentDir, "report.md");
      assert.equal(run(p, [...statusArgs, "--report"], { env: w.env }).status, 0);
      const before = fs.readFileSync(reportFile);
      const running = startRunner(w);
      const release = path.join(w.fixture, "release");
      t.after(async () => {
        fs.writeFileSync(release, "yes");
        if (descendant) fs.writeFileSync(path.join(w.fixture, "descendant-release"), "yes");
        running.child.kill("SIGTERM");
        const closed = await running.closed;
        assert.notEqual(closed.json?.signal, "SIGKILL", closed.stdout);
      });
      await waitForFile(path.join(w.fixture, "ready"));
      if (descendant) await waitForFile(path.join(w.fixture, "descendant-ready"));
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
      if (descendant) await waitForFile(path.join(w.fixture, "descendant-terminating"));
      const blocked = run(p, [...statusArgs, "--report"], { env: w.env });
      assert.equal(blocked.status, 1, "lock is retained while the child is terminating");
      assert.deepEqual(fs.readFileSync(reportFile), before);
      fs.writeFileSync(release, "yes");
      if (descendant) {
        await waitForFile(path.join(w.fixture, "descendant-waiting"));
        const pid = Number(fs.readFileSync(path.join(w.fixture, "descendant-ready"), "utf8"));
        process.kill(pid, 0);
        assert.equal(fs.existsSync(path.join(w.fixture, "descendant-collected")), false);
        verifyHeld();
        const args = calls(w.fixture).at(-1).args;
        const finalFile = args[args.indexOf("-o") + 1];
        assert.ok(fs.existsSync(path.dirname(finalFile)), "raw files survive while the descendant is held");
        fs.writeFileSync(path.join(w.fixture, "descendant-release"), "yes");
      }
      const closed = await running.closed;
      assert.equal(closed.json.launched, true, closed.stdout);
      assert.equal(closed.json.completed, false, closed.stdout);
      assert.match(closed.json.reason, /cancelled/, closed.stdout);
      assert.equal(closed.json.exitCode, 0, closed.stdout);
      assert.equal(closed.json.signal, null, closed.stdout);
      if (descendant) {
        const pid = Number(fs.readFileSync(path.join(w.fixture, "descendant-ready"), "utf8"));
        assert.throws(() => process.kill(pid, 0), { code: "ESRCH" });
        assert.deepEqual(JSON.parse(fs.readFileSync(path.join(w.fixture, "descendant-collected"), "utf8")), { code: 0, signal: null });
      }
      assert.equal(runnerLeftovers(w).filter(name => name.endsWith(".lock")).length, 1);
      assert.match(closed.json.reason, /Execution suspended:/);
      assert.equal(run(p, [...statusArgs, "--report"], { env: w.env }).status, 1);
    });
  }
}

for (const chain of ["10x", "openspec"]) {
  test(`${chain}: legacy flat records recover only after their process group is gone`, { skip: process.platform === "win32" }, () => {
    const project = chain === "10x" ? makeProject() : makeOpenspecProject();
    const { env, lock } = setup(project);
    fs.writeFileSync(lock, JSON.stringify({ pid: deadPid(), childPid: process.pid, processGroup: false }));
    assert.equal(usage(project, env, ["--chain", chain]).status, 1);
    fs.writeFileSync(lock, JSON.stringify({ pid: deadPid(), childPid: deadPid(), processGroup: true }));
    assert.equal(usage(project, env, ["--chain", chain]).status, 0);
    assert.equal(fs.existsSync(lock), false);
  });

  for (const crash of ["parent", "runner"]) {
    test(`${chain}: ${crash} death with an out-of-group child retains every mutation boundary`,
      { skip: process.platform === "win32" }, async (t) => {
      const w = codexFixture(chain, { mode: { hold: true, descendant: true, outOfGroup: true } });
      const p = w.project;
      const status = ["status", p.id, "--chain", chain];
      assert.equal(run(p, [...status, "--report"], { env: w.env }).status, 0);
      gitInit(p);
      commitFiles(p, ["versions.txt"]);
      fs.writeFileSync(path.join(p.root, "versions.txt"), "staged-only version");
      git(p, ["add", "--", "versions.txt"]);
      fs.writeFileSync(path.join(p.root, "versions.txt"), "working child version");
      fs.writeFileSync(path.join(p.root, "unrelated.txt"), "unrelated version");
      const head = git(p, ["rev-parse", "HEAD"]);
      const index = git(p, ["write-tree"]);
      let lateResult;
      const files = ["run.jsonl", "meta.json", "report.md"];
      const before = files.map(file => fs.readFileSync(path.join(p.agentDir, file)));
      const running = startRunner(w);
      let parentPid;
      let descendantPid;
      const kill = pid => {
        if (!pid) return;
        try { process.kill(pid, "SIGKILL"); } catch (e) { if (e.code !== "ESRCH") throw e; }
      };
      const gone = async pid => {
        const deadline = Date.now() + 10000;
        for (;;) {
          try { process.kill(pid, 0); } catch (e) { if (e.code === "ESRCH") return; throw e; }
          assert.ok(Date.now() < deadline, "fixture process must stop");
          await setTimeout(10);
        }
      };
      t.after(async () => {
        kill(parentPid);
        kill(descendantPid);
        running.child.kill("SIGKILL");
        await running.closed;
        if (descendantPid) await gone(descendantPid);
        if (parentPid) await gone(parentPid);
      });
      await waitForFile(path.join(w.fixture, "ready"));
      await waitForFile(path.join(w.fixture, "descendant-ready"));
      parentPid = Number(fs.readFileSync(path.join(w.fixture, "ready"), "utf8"));
      descendantPid = Number(fs.readFileSync(path.join(w.fixture, "descendant-ready"), "utf8"));
      const lockFile = path.join(w.tmp, fs.readdirSync(w.tmp).find(name => name.endsWith(".lock")));
      const owner = JSON.parse(fs.readFileSync(lockFile, "utf8"));
      assert.equal(owner.native.threadId, "root-fixture");
      assert.equal(owner.childPid, parentPid);
      if (crash === "runner") {
        running.child.kill("SIGKILL");
        await running.closed;
      }
      kill(parentPid);
      await running.closed;
      await gone(parentPid);
      assert.throws(() => process.kill(-parentPid, 0), { code: "ESRCH" });
      process.kill(descendantPid, 0);
      const verifyHeld = () => {
        assert.equal(execute(w).json.launched, false);
        for (const args of [[...status, "--report"], ["next", p.id, "--chain", chain],
          ["init", p.id, "--chain", chain], ["usage", p.id, "1", "--tokens", "1", "--chain", chain]]) {
          const result = run(p, args, { env: w.env });
          assert.equal(result.status, 1, result.stdout);
          assert.match(result.json.reason, /Execution suspended:.*native ownership unresolved/);
        }
        assert.equal(run(p, status, { env: w.env }).status, 0);
        files.forEach((file, i) => assert.deepEqual(fs.readFileSync(path.join(p.agentDir, file)), before[i]));
        assert.deepEqual(JSON.parse(fs.readFileSync(lockFile, "utf8")), owner);
        assert.equal(git(p, ["rev-parse", "HEAD"]), head);
        assert.equal(git(p, ["write-tree"]), index);
        assert.equal(git(p, ["show", ":versions.txt"]), "staged-only version");
        assert.equal(fs.readFileSync(path.join(p.root, "versions.txt"), "utf8"), "working child version");
        assert.equal(fs.readFileSync(path.join(p.root, "unrelated.txt"), "utf8"), "unrelated version");
        if (lateResult) assert.deepEqual(fs.readFileSync(path.join(p.agentDir, "last-result.json")), lateResult);
      };
      verifyHeld();
      writeResult(p, { status: "done", note: "late foreign child report" });
      lateResult = fs.readFileSync(path.join(p.agentDir, "last-result.json"));
      verifyHeld();
      fs.writeFileSync(path.join(w.fixture, "descendant-release"), "yes");
      await waitForFile(path.join(w.fixture, "late-write"));
      await gone(descendantPid);
      assert.equal(fs.readFileSync(path.join(w.fixture, "late-write"), "utf8"), "child work");
      verifyHeld();
    });
  }
}

for (const chain of ["10x", "openspec"]) {
  test(`${chain}: accounting failure after proven closure releases every mutation boundary`, () => {
    const w = codexFixture(chain, { mode: { usageMetadataFailure: true,
      reply: 'RESULT: {"status":"failed","note":"collected failure","usage":{"totalTokens":999},"usageEvidence":{"status":"verified","path":"/private-source"}}' } });
    const result = execute(w);
    assert.equal(result.json.completed, true, result.stdout);
    assert.equal(result.json.result.status, "failed");
    assert.equal(result.json.usage.totalTokens, undefined);
    assert.equal(result.json.usageEvidence.status, "unavailable");
    assert.ok(result.json.usage.durationMs >= 0);
    assert.doesNotMatch(JSON.stringify(result.json.usageEvidence), /private-source/);
    assert.deepEqual(runnerLeftovers(w), []);
    writeResult(w.project, result.json.result);
    const next = run(w.project, ["next", w.project.id, "--chain", chain], { env: w.env });
    assert.doesNotMatch(next.json.reason ?? "", /Execution suspended:|lock file/);
    assert.equal(fs.existsSync(path.join(w.project.agentDir, "last-result.json")), false);
    assert.equal(calls(w.fixture).filter(call => call.args[0] === "exec").length, 1);
  });
}

const WORKER = path.join(import.meta.dirname, "run-lock-worker.mjs");
const worker = (args, env) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [WORKER, ...args], { env: { ...process.env, ...env } });
  let out = "";
  let err = "";
  child.stdout.on("data", (d) => { out += d; });
  child.stderr.on("data", (d) => { err += d; });
  child.on("close", (code) => (code === 0 ? resolve(JSON.parse(out)) : reject(new Error(`worker exit ${code}: ${err}`))));
});

// LOCK_MODULE (absolute path) runs the same harness against another run-lock.mjs, e.g. the pre-fix source.
test("1.2a many processes over stale locks never hold one lock at the same time", { timeout: 120000 }, async () => {
  const ROUNDS = 120;
  const PROCS = 6;
  const SLOT = 40;
  const HOLD = 10;
  const base = fs.realpathSync(fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "lock-multi-")));
  lockDirs.push(base);
  const root = path.join(base, "root");
  const tmp = path.join(base, "tmp");
  fs.mkdirSync(root);
  fs.mkdirSync(tmp);
  const dead = deadPid();
  for (let r = 0; r < ROUNDS; r++) {
    const name = path.basename(runLockPath(liveRunDirectory(root, `r${r}`, "10x")));
    fs.writeFileSync(path.join(tmp, name), String(dead));
  }
  const startAt = performance.timeOrigin + performance.now() + 1500;
  const env = { TMPDIR: tmp, ...(process.env.LOCK_MODULE ? { LOCK_MODULE: process.env.LOCK_MODULE } : {}) };
  const results = await Promise.all(Array.from({ length: PROCS }, () => worker([root, "r", ROUNDS, startAt, SLOT, HOLD], env)));
  for (let r = 0; r < ROUNDS; r++) {
    const held = results.flat().filter((i) => i.round === r).sort((a, b) => a.start - b.start);
    assert.ok(held.length >= 1, `round ${r}: no process held the lock`);
    for (let i = 1; i < held.length; i++) {
      // Under 2 ms is clock noise between processes; an unfixed overlap is about the hold time.
      assert.ok(held[i].start >= held[i - 1].end - 2,
        `round ${r}: held intervals overlap: [${held[i - 1].start}, ${held[i - 1].end}] and [${held[i].start}, ${held[i].end}]`);
    }
  }
  assert.deepEqual(leftovers(tmp), []);
});
