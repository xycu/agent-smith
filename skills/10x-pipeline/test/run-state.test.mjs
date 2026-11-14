// Atomic state publication, locked temp cleanup and log integrity through both chains.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import {
  cleanupAll, makeProject, run, git, gitEnv, gitInit, entry, writeLog, writeMetaFile,
  writeResult, readLogEntries, readMetaFile, writeOverride, planText,
} from "./helpers.mjs";
import { writePlan } from "./ahead.mjs";
import { makeOpenspecProject } from "../../openspec-pipeline/test/openspec-helpers.mjs";
import { writeFileAtomic, stateTempFiles, cleanupStateTemps, runLockPath } from "../scripts/state.mjs";

const STATE_URL = new URL("../scripts/state.mjs", import.meta.url).href;
const TARGETS = ["run.jsonl", "meta.json", "report.md"];
const GOAL = "Add a retry counter to the status output so each step records its retries";
after(cleanupAll);

function projectFor(chain, options = {}) {
  return chain === "openspec" ? makeOpenspecProject(options) : makeProject(options);
}

function runIn(project, args, options = {}) {
  return run(project, args, { env: gitEnv(project), ...options });
}

function seed(project, chain, meta = {}) {
  writeLog(project, [entry(1, chain === "openspec" ? "os-propose" : "plan")]);
  writeMetaFile(project, { id: project.id, goal: GOAL, ...(chain === "openspec" ? { chain } : {}), ...meta });
  return project;
}

function addTemps(project) {
  return TARGETS.map((name, i) => {
    const file = path.join(project.agentDir, `${name}.${800001 + i}.tmp`);
    fs.writeFileSync(file, `abandoned ${name}\n`);
    return file;
  });
}

// Preserve physical bytes and entry types without following symlinks.
function snapshot(dir) {
  const entries = {};
  if (!fs.existsSync(dir)) return entries;
  for (const name of fs.readdirSync(dir).sort()) {
    const file = path.join(dir, name);
    const stat = fs.lstatSync(file);
    entries[name] = stat.isSymbolicLink() ? { link: fs.readlinkSync(file) }
      : stat.isDirectory() ? { entries: snapshot(file) } : fs.readFileSync(file);
  }
  return entries;
}

function commitAll(project) {
  git(project, ["add", "-A"]);
  git(project, ["commit", "-q", "-m", "test: fixture state"]);
}

function gitSnapshot(project) {
  const index = git(project, ["rev-parse", "--git-path", "index"]);
  return {
    files: snapshot(project.changeDir),
    index: fs.readFileSync(path.resolve(project.base, index)),
    refs: git(project, ["show-ref"]),
    head: git(project, ["rev-parse", "HEAD"]),
  };
}

function archivedState(chain, policy = {}) {
  const p = seed(projectFor(chain, { policy }), chain, { archive: true, outcome: { action: "done", reason: "fixture", manualPending: [] } });
  fs.writeFileSync(path.join(p.agentDir, "report.md"), "original report\n");
  gitInit(p);
  commitAll(p);
  return p;
}

function isolatedProject(chain) {
  const main = projectFor(chain, { policy: { isolation: { require: true } } });
  gitInit(main);
  commitAll(main);
  const root = path.join(main.base, "linked");
  git(main, ["worktree", "add", "-q", "-b", "agent-smith/demo", root]);
  const changeDir = path.join(root, path.relative(main.root, main.changeDir));
  return { ...main, root, changeDir, agentDir: path.join(changeDir, "agent-smith"),
    planFile: chain === "openspec" ? null : path.join(changeDir, "plan.md") };
}

for (const name of TARGETS) {
  test(`atomic ${name}: strings, Buffers, absence and existing permissions`, () => {
    const p = makeProject();
    const file = path.join(p.changeDir, name);
    const mask = process.umask(0o022);
    try {
      writeFileAtomic(file, "fresh π\n");
      assert.deepEqual(fs.readFileSync(file), Buffer.from("fresh π\n"));
      if (process.platform !== "win32") assert.equal(fs.statSync(file).mode & 0o777, 0o644);
      fs.chmodSync(file, 0o600);
      for (const value of ["replacement\n", Buffer.from([0, 255, 13, 10, 128])]) {
        writeFileAtomic(file, value);
        assert.deepEqual(fs.readFileSync(file), Buffer.from(value));
        if (process.platform !== "win32") assert.equal(fs.statSync(file).mode & 0o777, 0o600);
      }
      assert.equal(fs.existsSync(`${file}.${process.pid}.tmp`), false);
    } finally { process.umask(mask); }
  });
}

for (const existing of [false, true]) {
  for (const failure of ["inspect", "create", "permission", "write", "close", "rename"]) {
    test(`atomic failure ${failure}, existing=${existing}: target survives and owned temp is removed`, (t) => {
      const p = makeProject();
      const file = path.join(p.changeDir, "run.jsonl");
      const old = Buffer.from("old complete bytes\n");
      if (existing) fs.writeFileSync(file, old);
      const originalWrite = fs.writeFileSync;
      const originalClose = fs.closeSync;
      const fail = () => { throw new Error(`injected ${failure}`); };
      if (failure === "inspect") t.mock.method(fs, "lstatSync", fail);
      if (failure === "create") t.mock.method(fs, "openSync", fail);
      if (failure === "permission") {
        // Permission setup only runs when an existing regular target supplies its mode.
        if (!existing) return;
        t.mock.method(fs, "fchmodSync", fail);
      }
      if (failure === "write") t.mock.method(fs, "writeFileSync", (fd) => { originalWrite(fd, "partial"); fail(); });
      if (failure === "close") {
        let called = false;
        t.mock.method(fs, "closeSync", (fd) => { if (!called) { called = true; fail(); } originalClose(fd); });
      }
      if (failure === "rename") t.mock.method(fs, "renameSync", fail);
      assert.throws(() => writeFileAtomic(file, Buffer.from("new complete bytes\n")), new RegExp(`injected ${failure}`));
      t.mock.restoreAll();
      assert.equal(fs.existsSync(file), existing);
      if (existing) assert.deepEqual(fs.readFileSync(file), old);
      assert.equal(fs.existsSync(`${file}.${process.pid}.tmp`), false);
    });
  }
}

test("atomic collisions preserve existing regular files, symlinks and their targets", () => {
  const p = makeProject();
  const file = path.join(p.changeDir, "meta.json");
  const temp = `${file}.${process.pid}.tmp`;
  const other = path.join(p.changeDir, "other");
  fs.writeFileSync(file, "old");
  fs.writeFileSync(other, "other");
  for (const symlink of [false, true]) {
    if (symlink) fs.symlinkSync(other, temp);
    else fs.writeFileSync(temp, "foreign temp");
    const before = snapshot(p.changeDir);
    assert.throws(() => writeFileAtomic(file, "new"), { code: "EEXIST" });
    assert.deepEqual(snapshot(p.changeDir), before);
    fs.unlinkSync(temp);
  }
});

test("atomic cleanup failure exposes original failure and the cleanup error", (t) => {
  const p = makeProject();
  const file = path.join(p.changeDir, "report.md");
  fs.writeFileSync(file, "old");
  t.mock.method(fs, "renameSync", () => { throw new Error("publication failed"); });
  t.mock.method(fs, "unlinkSync", () => { throw new Error("unlink failed"); });
  assert.throws(() => writeFileAtomic(file, "new"), (e) => {
    assert.ok(e instanceof AggregateError);
    assert.match(e.message, /publication failed.*cleanup.*unlink failed/);
    assert.equal(e.cause.message, "publication failed");
    return true;
  });
  t.mock.restoreAll();
  assert.equal(fs.readFileSync(file, "utf8"), "old");
  assert.equal(fs.readFileSync(`${file}.${process.pid}.tmp`, "utf8"), "new");
});

for (const existing of [false, true]) {
  for (const boundary of ["before", "after"]) {
    test(`termination ${boundary} rename, existing=${existing}: complete old-or-new bytes`, async (t) => {
      const p = makeProject();
      const file = path.join(p.changeDir, "report.md");
      if (existing) fs.writeFileSync(file, "old complete bytes");
      const child = spawn(process.execPath, ["--input-type=module", "-e", `
        import fs from "node:fs";
        import { writeFileAtomic } from ${JSON.stringify(STATE_URL)};
        const rename = fs.renameSync;
        fs.renameSync = (...args) => {
          if (${JSON.stringify(boundary)} === "after") rename(...args);
          fs.writeSync(1, "barrier\\n");
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);
        };
        writeFileAtomic(process.argv[1], Buffer.from("new complete bytes"));
      `, file], { cwd: p.root, stdio: ["ignore", "pipe", "pipe"] });
      t.after(() => child.kill("SIGKILL"));
      const closed = once(child, "close");
      let output = "";
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("rename barrier timed out")), 10000);
        child.once("error", reject);
        child.once("exit", () => { clearTimeout(timer); reject(new Error(`child exited before barrier: ${output}`)); });
        child.stdout.on("data", (chunk) => { output += chunk; if (output.includes("barrier")) { clearTimeout(timer); resolve(); } });
      });
      child.kill("SIGKILL");
      assert.equal((await closed)[1], "SIGKILL");
      assert.equal(fs.existsSync(file), boundary === "after" || existing);
      if (fs.existsSync(file)) assert.equal(fs.readFileSync(file, "utf8"), boundary === "after" ? "new complete bytes" : "old complete bytes");
      const temp = `${file}.${child.pid}.tmp`;
      assert.equal(fs.existsSync(temp), boundary === "before");
      if (boundary === "before") assert.equal(fs.readFileSync(temp, "utf8"), "new complete bytes");
    });
  }
}

test("temp inspection and deletion failures are observable before publication", (t) => {
  const p = seed(makeProject(), "10x");
  const temps = addTemps(p);
  const before = snapshot(p.agentDir);
  t.mock.method(fs, "lstatSync", () => { throw new Error("inspection denied"); });
  assert.throws(() => stateTempFiles(p.agentDir), /inspection denied/);
  t.mock.restoreAll();
  t.mock.method(fs, "unlinkSync", () => { throw new Error("deletion denied"); });
  assert.throws(() => cleanupStateTemps(p.agentDir), /deletion denied/);
  t.mock.restoreAll();
  assert.deepEqual(snapshot(p.agentDir), before);
  assert.deepEqual(stateTempFiles(path.join(p.agentDir, "missing")), []);
  assert.deepEqual(stateTempFiles(p.agentDir).sort(), temps.sort());
});

for (const chain of ["10x", "openspec"]) {
  test(`${chain}: eligible writer cleans exact immediate regular temps and preserves other entries`, () => {
    const p = seed(projectFor(chain), chain);
    const temps = addTemps(p);
    const keep = ["run.jsonl.0.tmp", "run.jsonl.01.tmp", "run.jsonl.x.tmp", "last-result.json.22.tmp", "extra.tmp", "meta.json.22.tmp.bak"];
    for (const name of keep) fs.writeFileSync(path.join(p.agentDir, name), "keep");
    const nested = path.join(p.agentDir, "nested");
    fs.mkdirSync(nested);
    fs.writeFileSync(path.join(nested, "run.jsonl.2.tmp"), "nested");
    fs.mkdirSync(path.join(p.agentDir, "run.jsonl.22.tmp"));
    fs.symlinkSync(path.join(p.agentDir, keep[0]), path.join(p.agentDir, "meta.json.22.tmp"));
    const before = snapshot(p.agentDir);
    const res = runIn(p, ["usage", p.id, "1", "--tokens", "4", "--chain", chain]);
    assert.equal(res.status, 0, res.stdout);
    for (const file of temps) assert.equal(fs.existsSync(file), false);
    const after = snapshot(p.agentDir);
    for (const name of [...keep, "nested", "run.jsonl.22.tmp", "meta.json.22.tmp"]) assert.deepEqual(after[name], before[name], name);
  });

  test(`${chain}: held lock preserves candidate temps for every writer`, () => {
    const p = seed(projectFor(chain), chain);
    addTemps(p);
    const lock = runLockPath(p.agentDir);
    fs.writeFileSync(lock, String(process.pid));
    try {
      const before = snapshot(p.changeDir);
      for (const args of [["init", p.id], ["next", p.id], ["usage", p.id, "1", "--tokens", "4"], ["status", p.id, "--report"]]) {
        const res = runIn(p, [...args, "--chain", chain]);
        assert.equal(res.status, 1, res.stdout);
        assert.match(res.json.reason, /lock/);
        assert.deepEqual(snapshot(p.changeDir), before);
      }
    } finally { fs.unlinkSync(lock); }
  });

  test(`${chain}: unknown, pending, conflicting and identical usage preserve temps and git state`, () => {
    const p = seed(projectFor(chain), chain);
    writeLog(p, [entry(1, "plan", { usage: { totalTokens: 4 } }), entry(2, "plan", { result: undefined })]);
    gitInit(p);
    commitAll(p);
    addTemps(p);
    const before = gitSnapshot(p);
    for (const [n, tokens, status] of [[3, "4", 1], [2, "4", 1], [1, "5", 1], [1, "4", 0]]) {
      const res = runIn(p, ["usage", p.id, String(n), "--tokens", tokens, "--chain", chain]);
      assert.equal(res.status, status, res.stdout);
      if (status === 0) assert.equal(res.json.unchanged, true);
      assert.deepEqual(gitSnapshot(p), before);
    }
  });

  for (const guard of ["staged", "message", "branch", "dirty", "tracked-temp"]) {
    test(`${chain}: archive usage ${guard} refusal retains temps, files, index and refs`, () => {
      const p = archivedState(chain, guard === "message" ? { archive: { usageMessage: "" } } : {});
      const temps = addTemps(p);
      if (guard === "staged") {
        fs.writeFileSync(path.join(p.root, "staged"), "staged");
        git(p, ["add", "staged"]);
      }
      if (guard === "branch") {
        writeMetaFile(p, { ...readMetaFile(p), isolated: true, branch: "agent-smith/other" });
        commitAll(p);
        addTemps(p);
      }
      if (guard === "dirty") fs.writeFileSync(path.join(p.changeDir, "unrelated"), "unrelated");
      if (guard === "tracked-temp") {
        commitAll(p);
        fs.appendFileSync(temps[0], "dirty tracked temp");
      }
      const before = gitSnapshot(p);
      const res = runIn(p, ["usage", p.id, "1", "--tokens", "4", "--chain", chain]);
      assert.equal(res.status, 1, res.stdout);
      assert.equal(res.json.attached, false);
      assert.deepEqual(gitSnapshot(p), before);
    });
  }

  test(`${chain}: archive usage accepts only untracked regular state temps, cleans and commits`, () => {
    const p = archivedState(chain);
    const temps = addTemps(p);
    const res = runIn(p, ["usage", p.id, "1", "--tokens", "4", "--chain", chain]);
    assert.equal(res.status, 0, res.stdout);
    assert.equal(typeof res.json.commit, "string");
    for (const file of temps) assert.equal(fs.existsSync(file), false);
    assert.doesNotMatch(git(p, ["ls-tree", "-r", "--name-only", "HEAD"]), /\.tmp$/m);
    assert.equal(git(p, ["status", "--porcelain", "--", path.relative(p.root, p.changeDir)]), "");
  });
}

test("isolated step commit excludes abandoned state temps", () => {
  const p = isolatedProject("10x");
  const start = runIn(p, ["init", p.id, "--goal", GOAL]);
  assert.equal(start.json.action, "run", start.stdout);
  writePlan(p, planText());
  writeResult(p, { status: "done", note: "planned" });
  const temps = addTemps(p);
  const res = runIn(p, ["next", p.id]);
  assert.equal(res.json.action, "run", res.stdout);
  assert.ok(readLogEntries(p)[0].commit);
  for (const file of temps) assert.equal(fs.existsSync(file), false);
  assert.doesNotMatch(git(p, ["-C", p.root, "ls-tree", "-r", "--name-only", "HEAD"]), /\.tmp$/m);
});
