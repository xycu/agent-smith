// A router error after attachResult must not lose the step result: run.jsonl holds it before last-result.json goes.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  cleanupAll, makeProject, run, git, gitAvailable, gitEnv, gitInit, init, next, writeResult, writeOverride,
  readLogEntries, planText
} from "./helpers.mjs";
import { writePlan } from "./ahead.mjs";

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
