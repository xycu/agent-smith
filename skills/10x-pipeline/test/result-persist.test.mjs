// A router error after attachResult must not lose the step result: run.jsonl holds it before last-result.json goes.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  cleanupAll, makeProject, run, git, gitAvailable, gitEnv, gitInit, init, next, writeResult, writeOverride,
  readLogEntries, planText, ROUTE, entry, skipEntry, writeLog
} from "./helpers.mjs";
import { writePlan } from "./ahead.mjs";
import { makeOpenspecProject, writeArtifacts } from "../../openspec-pipeline/test/openspec-helpers.mjs";
import { attachResult } from "../scripts/flow.mjs";

after(cleanupAll);

const GOAL = "Add a retry counter to the status output so the report shows how often each step ran again";
const BROKEN = { rigor: { levels: null } };
const skip = !gitAvailable() && "git is not available";

test("a router error after the result is read keeps the result in run.jsonl, and the next call routes on", () => {
  const project = makeProject();
  assert.equal(init(project, GOAL).status, 0);
  writePlan(project, planText({ phases: 1, rowsPerPhase: 1 }));
  writeResult(project, { status: "done", note: "wrote plan", usage: { totalTokens: 1234 } });
  writeOverride(project, BROKEN);

  const broken = next(project);
  assert.notEqual(broken.status, 0);
  assert.match(broken.stdout, /Router error/);
  assert.equal(fs.existsSync(path.join(project.agentDir, "last-result.json")), false);
  const [first] = readLogEntries(project);
  assert.equal(first.result.status, "done");
  assert.equal(first.usage.totalTokens, 1234);
  assert.equal(first.ok, true);

  writeOverride(project, {});
  const again = next(project);
  assert.equal(again.status, 0, again.stdout);
  assert.equal(again.json.action, "run");
  assert.doesNotMatch(again.stdout, /has no result/);
  const entries = readLogEntries(project);
  assert.equal(entries.length, 2);
  assert.deepEqual(entries[0].result, first.result);
  assert.equal(entries[1].result, undefined);
});

test("the same in an isolated run with a failed advisory score entry", { skip }, () => {
  const main = makeProject({ policy: { isolation: { require: true }, score: { minRigor: "standard" } } });
  gitInit(main);
  git(main, ["add", "-A"]);
  git(main, ["commit", "-q", "-m", "chore: project"]);
  const top = path.join(main.base, ".claude/worktrees", `agent-smith-${main.id}`);
  git(main, ["worktree", "add", "-q", "-b", `agent-smith/${main.id}`, top]);
  const changeDir = path.join(top, "context/changes", main.id);
  const wt = {
    id: main.id, base: main.base, top, root: top, changeDir,
    agentDir: path.join(changeDir, "agent-smith"), planFile: path.join(changeDir, "plan.md"),
  };
  const env = gitEnv(wt);
  const nextIn = () => run(wt, ["next", wt.id], { env });
  const policy = { isolation: { require: true }, score: { minRigor: "standard" } };

  const started = run(wt, ["init", wt.id, "--goal", GOAL, "--rigor", "standard"], { env });
  assert.equal(started.status, 0, started.stdout + started.stderr);
  assert.equal(readLogEntries(wt)[0].step, "score");
  writeResult(wt, { status: "done", note: "scored", usage: { totalTokens: 55 } });
  writeOverride(wt, { ...policy, ...BROKEN });

  const broken = nextIn();
  assert.notEqual(broken.status, 0);
  assert.match(broken.stdout, /Router error/);
  assert.equal(fs.existsSync(path.join(wt.agentDir, "last-result.json")), false);
  const [first] = readLogEntries(wt);
  assert.equal(first.result.status, "done");
  assert.equal(first.usage.totalTokens, 55);
  assert.equal(first.ok, false);
  const tracked = git(wt, ["-C", top, "ls-files"]);
  assert.doesNotMatch(tracked, /last-result\.json/);

  writeOverride(wt, policy);
  const again = nextIn();
  assert.equal(again.status, 0, again.stdout);
  assert.doesNotMatch(again.stdout, /has no result/);
  assert.equal(again.json.action, "run");
  assert.deepEqual(readLogEntries(wt)[0].result, first.result);
});

const resultPath = p => path.join(p.agentDir, "last-result.json");
const executedEntries = p => readLogEntries(p).filter(e => !e.skipped);

function projectFor(chain, policy = {}) {
  return chain === "10x" ? makeProject({ policy }) : makeOpenspecProject({ policy });
}

function start(p, chain) {
  const res = run(p, ["init", p.id, "--goal", GOAL, "--chain", chain], { env: gitEnv(p) });
  assert.equal(res.status, 0, res.stdout + res.stderr);
  assert.equal(res.json.action, "run");
  return res.json;
}

function output(p, chain) {
  if (chain === "10x") writePlan(p, planText());
  else writeArtifacts(p, { proposal: true, specs: 1, tasks: { open: 1 } });
}

// Patch the child process only, after the real atomic publication has succeeded.
function fault(p, source) {
  const hook = path.join(p.base, "result-fault.mjs");
  fs.writeFileSync(hook, 'import fs from "node:fs";\n' + source);
  return run(p, ["next", p.id], { env: { ...gitEnv(p), NODE_OPTIONS: "--import=" + hook } });
}

function crash(p) {
  const res = fault(p, `
const rename = fs.renameSync;
fs.renameSync = (from, to) => {
  const value = rename(from, to);
  if (String(to) === ${JSON.stringify(path.join(p.agentDir, "run.jsonl"))}) process.exit(86);
  return value;
};`);
  assert.equal(res.status, 86, res.stdout + res.stderr);
  assert.equal(executedEntries(p).length, 1);
  assert.ok(executedEntries(p)[0].result);
  assert.equal(fs.existsSync(resultPath(p)), true);
  return executedEntries(p)[0];
}

function denyUnlink(p) {
  return fault(p, `
const unlink = fs.unlinkSync;
fs.unlinkSync = file => {
  if (String(file) === ${JSON.stringify(resultPath(p))}) {
    const error = new Error("injected result unlink denied");
    error.code = "EACCES";
    throw error;
  }
  return unlink(file);
};`);
}

for (const chain of ["10x", "openspec"]) {
  for (const byFile of [false, true]) {
    test(`${chain}: post-publication crash recovers ${byFile ? "file" : "inline"} result ownership`, () => {
      const p = projectFor(chain, { prompts: { byFile } });
      start(p, chain);
      output(p, chain);
      writeResult(p, { status: "done", note: "only step one", signals: { rigor: "standard", ignored: true },
        usage: { totalTokens: 42 } });
      const completed = crash(p);
      // Recovery must use persisted verification even after artifacts and leftover bytes change.
      if (chain === "10x") fs.writeFileSync(p.planFile, planText());
      fs.writeFileSync(resultPath(p), "{malformed leftover");
      const recovered = next(p);
      assert.equal(recovered.json.action, "run", recovered.stdout);
      assert.equal(recovered.json.n, 2);
      assert.equal(fs.existsSync(resultPath(p)), false);
      const first = executedEntries(p)[0];
      const expected = { ...completed };
      delete expected.pendingHandoff;
      assert.deepEqual(first, expected);
      assert.equal(first.result.note, "only step one");
      assert.deepEqual(first.signals, { rigor: "standard" });
      assert.equal(first.usage.totalTokens, 42);
      const missing = next(p);
      assert.equal(missing.status, 1, missing.stdout);
      assert.match(missing.json.reason, /Step 2 .* has no result/);
      assert.equal(executedEntries(p)[1].result, undefined);
      writeResult(p, { status: "failed", note: "only step two", usage: { totalTokens: 7 } });
      next(p);
      assert.equal(executedEntries(p)[1].result.note, "only step two");
      assert.equal(executedEntries(p)[1].usage.totalTokens, 7);
      assert.deepEqual(executedEntries(p)[0], first);
    });
  }

  for (const recovery of [false, true]) {
    test(`${chain}: unlink denial stops ${recovery ? "recovery" : "fresh intake"} before dispatch`, () => {
      const p = projectFor(chain);
      start(p, chain);
      output(p, chain);
      writeResult(p, { status: "done", note: "durable" });
      const completed = recovery ? crash(p) : null;
      const refused = denyUnlink(p);
      assert.equal(refused.json.action, "halt", refused.stdout);
      assert.match(refused.json.reason, /injected result unlink denied/);
      assert.equal(executedEntries(p).length, 1);
      const first = executedEntries(p)[0];
      assert.equal(first.result.note, "durable");
      if (completed) assert.deepEqual(first, completed);
      assert.equal(fs.existsSync(resultPath(p)), true);
      assert.equal(next(p).json.n, 2);
      assert.equal(fs.existsSync(resultPath(p)), false);
      assert.deepEqual(executedEntries(p)[0], first);
    });
  }

  test(`${chain}: absent leftover recovers idempotently and terminal routing cleans leftovers`, () => {
    const p = projectFor(chain);
    start(p, chain);
    output(p, chain);
    writeResult(p, { status: "done", signals: { needsHuman: "inspect output" } });
    const first = crash(p);
    fs.unlinkSync(resultPath(p));
    const stopped = next(p);
    assert.equal(stopped.json.action, "halt", stopped.stdout);
    assert.equal(executedEntries(p)[0].finishedAt, first.finishedAt);
    writeResult(p, { status: "orchestrator-error", note: "stale" });
    // A repeated human halt is terminal without dispatch when its acknowledgement is reset in a fixture.
    writeLog(p, [first]);
    assert.equal(next(p).json.action, "halt");
    assert.equal(fs.existsSync(resultPath(p)), false);
    assert.equal(executedEntries(p).length, 1);
  });
}

test("result owner boundaries ignore skip rows and preserve unowned and pending input", () => {
  const p = makeProject();
  const paths = { result: resultPath(p), log: path.join(p.agentDir, "run.jsonl") };
  writeResult(p, { status: "done", note: "untouched" });
  const bytes = fs.readFileSync(paths.result);
  for (const log of [[], [skipEntry("score", 0)]]) {
    attachResult(paths, log, {});
    assert.deepEqual(fs.readFileSync(paths.result), bytes);
  }
  const completed = entry(1, "plan");
  const log = [completed, skipEntry("research", 1)];
  attachResult(paths, log, {});
  assert.equal(fs.existsSync(paths.result), false);
  attachResult(paths, log, {});
  assert.deepEqual(log[0], entry(1, "plan"));
  const pending = entry(2, "fix", { result: undefined });
  writeResult(p, { status: "done", note: "pending owner" });
  attachResult({ ...paths, plan: path.join(p.changeDir, "plan.md") }, [completed, pending], {});
  assert.equal(pending.result.note, "pending owner");
  assert.deepEqual(completed, entry(1, "plan"));
});
