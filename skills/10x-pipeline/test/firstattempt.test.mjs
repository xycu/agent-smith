// Cheaper first implement attempt (worktree-step-commits, Phase 5): escalation.firstAttempt drops the first attempt of
// a listed implement template one tier in an isolated run. A failed cheap attempt is neutral for rigor and the step
// budget; the retry pays the failure bump on the base tier. Fixture runs carry meta.isolated in a project without git
// (no step commit, no rollback); the score case walks a real linked worktree.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  cleanupAll, makeProject, run, next, git, gitAvailable, gitEnv, gitInit, commitFiles, writeResult, writeLog,
  writeMetaFile, readMetaFile, writePlan, writeReview, readLogEntries, entry, planText,
} from "./helpers.mjs";
import { buildPlan, pendingEntry } from "./phase-helpers.mjs";

after(cleanupAll);

const GOAL = "Add a retry counter to the status output so the report shows how often each step ran again";
const ONE_WARNING = { findings: "0 critical, 1 warnings" };
const TWO_PHASES = planText({ phases: 2 });
const lastRan = (project) => readLogEntries(project).filter((e) => !e.skipped).at(-1);

// A run at `rigor` whose plan review waits for its result; `isolated` sets meta.isolated. The entries carry a `commit`
// key, so no step commit runs; without git no entry gets a startSha, so no rollback runs either.
function fixture({ rigor = "standard", isolated = true, plan = TWO_PHASES, review = ONE_WARNING, policy = null, log = null } = {}) {
  const project = makeProject({ plan, policy });
  writeReview(project, "plan-review", review);
  const meta = { id: project.id, goal: GOAL, rigor: { level: rigor, requested: rigor } };
  if (isolated) Object.assign(meta, { isolated: true, branch: `agent-smith/${project.id}`, startCommit: null });
  writeMetaFile(project, meta);
  writeLog(project, log ?? [entry(1, "plan", { commit: null }), pendingEntry(2, "plan-review", { commit: null })]);
  writeResult(project, { status: "done", note: "reviewed" });
  return project;
}

function firstImplement(opts) {
  const project = fixture(opts);
  const res = next(project);
  assert.equal(res.json.action, "run", res.stdout);
  assert.equal(res.json.step, "implement");
  return { project, res: res.json, e: lastRan(project) };
}

test("5.1 the first implement attempt of an isolated run runs one tier lower and is marked cheap", () => {
  const control = firstImplement({ isolated: false }).e;
  assert.equal(control.tier, 3, control.tierWhy);
  assert.equal(Object.hasOwn(control, "cheap"), false);
  assert.doesNotMatch(control.tierWhy, /first attempt/);

  const { res, e } = firstImplement();
  assert.equal(e.template, "implement");
  assert.equal(e.tier, 2, e.tierWhy);
  assert.equal(e.cheap, true);
  assert.match(e.tierWhy, /^base 3, -1 first attempt/);
  assert.match(res.reason, /-1 first attempt/);
});

test("5.1 no drop on top of the simple-change discount", () => {
  const { e } = firstImplement({ plan: planText({ phases: 1 }) });
  assert.equal(e.tier, 2, e.tierWhy);
  assert.equal(e.simple, true);
  assert.equal(Object.hasOwn(e, "cheap"), false);
  assert.doesNotMatch(e.tierWhy, /first attempt/);
});

test("5.1 the retry of a failed cheap attempt runs two tiers above it", () => {
  const { project, e: first } = firstImplement();
  writeResult(project, { status: "failed", note: "tests red" });
  const res = next(project);
  assert.equal(res.json.step, "implement", res.stdout);
  const retry = lastRan(project);
  assert.equal(retry.tier, first.tier + 2, retry.tierWhy);
  assert.match(retry.tierWhy, /\+1 for 1 failed attempt\(s\)/);
  assert.doesNotMatch(retry.tierWhy, /first attempt/);
  assert.equal(Object.hasOwn(retry, "cheap"), false);
  assert.equal(readLogEntries(project)[2].cheap, true);
  assert.equal(readLogEntries(project)[2].ok, false);
});

test("5.1 a later implement step of a run with one implement failure gets no drop", () => {
  const log = [
    entry(1, "plan", { commit: null }),
    entry(2, "plan-review", { commit: null }),
    entry(3, "implement", { commit: null, ok: false, verified: false, result: { status: "failed", note: "red" } }),
    pendingEntry(4, "implement", { commit: null }),
  ];
  const project = fixture({ log, plan: planText({ phases: 2, done: 1 }) });
  writeResult(project, { status: "done", note: "phase 1" });
  const res = next(project);
  assert.equal(res.json.step, "implement", res.stdout);
  const e = lastRan(project);
  assert.equal(e.n, 5);
  assert.doesNotMatch(e.tierWhy, /first attempt/);
  assert.equal(Object.hasOwn(e, "cheap"), false);
});

test("5.1 a lean run whose cheap attempt fails stays lean and keeps its budget of 10", () => {
  // Eight steps logged and the ninth waiting: the cheap attempt is step 10, the last one the budget of 10 holds.
  const log = [entry(1, "plan", { commit: null }), entry(2, "plan-review", { commit: null })];
  for (let n = 3; n <= 8; n++) log.push(entry(n, "implement", { commit: null }));
  log.push(pendingEntry(9, "implement", { commit: null }));
  const project = fixture({ rigor: "lean", log, plan: planText({ phases: 2, rowsPerPhase: 2, done: 1 }) });
  writeResult(project, { status: "done", note: "one row" });
  const cheapRes = next(project);
  assert.equal(cheapRes.json.step, "implement", cheapRes.stdout);
  const cheap = lastRan(project);
  assert.equal(cheap.n, 10);
  assert.equal(cheap.cheap, true, cheap.tierWhy);

  writeResult(project, { status: "failed", note: "tests red" });
  const res = next(project);
  assert.equal(res.json.action, "run", res.stdout);
  assert.equal(res.json.step, "implement");
  assert.equal(lastRan(project).n, 11);
  assert.equal(readMetaFile(project).rigor.level, "lean");
});

test("5.1 a cheap fallback is no failure: it uses step budget", () => {
  // Nine steps logged, one of them a cheap tdd step that ended blocked (a fallback), and the tenth waiting: at lean the
  // budget of 10 is spent once the tenth has its result, because only a cheap failure uses no budget.
  const log = [entry(1, "plan", { commit: null }), entry(2, "plan-review", { commit: null })];
  log.push(entry(3, "implement", { commit: null, template: "implement-tdd", cheap: true, ok: false, fallback: true, result: { status: "blocked", note: "no runner" } }));
  for (let n = 4; n <= 9; n++) log.push(entry(n, "implement", { commit: null }));
  log.push(pendingEntry(10, "implement", { commit: null }));
  const project = fixture({ rigor: "lean", log, plan: planText({ phases: 2, rowsPerPhase: 2, done: 1 }) });
  writeResult(project, { status: "done", note: "one row" });
  const res = next(project);
  assert.equal(res.json.action, "halt", res.stdout);
  assert.match(res.json.reason, /Step budget 10 spent/);
});

test("5.1 a drop that the clamp absorbed sets no cheap flag and its failure counts for rigor", () => {
  // A clean plan review already moves implement to its minTier of 2.
  const { project, e } = firstImplement({ rigor: "lean", review: { findings: "0 critical, 0 warnings" } });
  assert.equal(e.tier, 2, e.tierWhy);
  assert.match(e.tierWhy, /-1 first attempt not applied \(clamp or floor\)/);
  assert.equal(Object.hasOwn(e, "cheap"), false);
  writeResult(project, { status: "failed", note: "tests red" });
  assert.equal(next(project).json.step, "implement");
  assert.equal(readMetaFile(project).rigor.level, "standard");
});

test("5.1 the effort floor holds for a tdd step at thorough: no cheap flag", () => {
  const row = "Parser keeps blank lines: `node --test test/parser.test.mjs`";
  // Two phases, so no simple-change discount applies.
  const plan = buildPlan([
    { name: "Parser", files: ["`src/parser.mjs`"], auto: [row, `${row} again`] },
    { name: "Printer", files: ["`src/printer.mjs`"], auto: [row, `${row} twice`] },
  ]);
  const { e } = firstImplement({ rigor: "thorough", plan });
  assert.equal(e.template, "implement-tdd");
  assert.equal(e.tier, 3, e.tierWhy);
  assert.match(e.tierWhy, /-1 first attempt not applied \(clamp or floor\)/);
  assert.match(e.tierWhy, /floor high/);
  assert.equal(Object.hasOwn(e, "cheap"), false);
});

test("5.1 drop 0 turns it off", () => {
  const { e } = firstImplement({ policy: { escalation: { firstAttempt: { drop: 0 } } } });
  assert.equal(e.tier, 3, e.tierWhy);
  assert.doesNotMatch(e.tierWhy, /first attempt/);
  assert.equal(Object.hasOwn(e, "cheap"), false);
});

// ---- no stacked down shift (a real worktree: the score down shift needs measured churn risk) ----------------------

const gitSkip = gitAvailable() ? false : "git is not available";
const future = () => new Date(Date.now() + 60_000);

// A repository whose history makes g1.js cold, then a linked worktree on the run branch.
function scoredWorktree(policy) {
  const main = makeProject({ policy: { isolation: { require: true }, score: { minRigor: "standard" }, ...policy } });
  gitInit(main);
  for (let i = 1; i <= 9; i++) commitFiles(main, i <= 4 ? ["f9.js", "f4.js", `g${i}.js`] : ["f9.js"], { message: `c${i}` });
  git(main, ["add", "-A"]);
  git(main, ["commit", "-q", "-m", "chore: project"]);
  const top = path.join(main.base, ".claude/worktrees", `agent-smith-${main.id}`);
  git(main, ["worktree", "add", "-q", "-b", `agent-smith/${main.id}`, top]);
  const changeDir = path.join(top, "context/changes", main.id);
  return {
    id: main.id, base: main.base, top, root: top, changeDir,
    agentDir: path.join(changeDir, "agent-smith"), planFile: path.join(changeDir, "plan.md"),
  };
}

function put(wt, file, text) {
  const abs = path.join(wt.changeDir, file);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, text);
  fs.utimesSync(abs, future(), future());
}

// Score with a low execution sum, plan naming the cold g1.js, a plan review with one warning: the first implement.
function scoredImplement(policy = {}) {
  const wt = scoredWorktree(policy);
  const step = (result = { status: "done", note: "ok" }) => {
    writeResult(wt, result);
    return run(wt, ["next", wt.id], { env: gitEnv(wt) });
  };
  let res = run(wt, ["init", wt.id, "--goal", `${GOAL} and also lists the note of every attempt that failed before it`, "--rigor", "standard"], { env: gitEnv(wt) });
  assert.equal(res.json?.step, "score", res.stdout + res.stderr);
  const factors = {};
  for (const [name, score] of Object.entries({ ambiguity: 1, novelty: 1, coupling: 1, discovery: 0, volume: 0, verification: 1 })) {
    factors[name] = { score, evidence: `goal phrase for ${name}` };
  }
  put(wt, "complexity.json", JSON.stringify({ schemaVersion: 1, factors, unknowns: [], confidence: "medium" }));
  res = step();
  assert.equal(res.json.step, "plan", res.stdout);
  put(wt, "plan.md", planText({ phases: 2, files: ["**File**: `g1.js`"] }));
  res = step();
  assert.equal(res.json.step, "plan-review", res.stdout);
  writeReview(wt, "plan-review", ONE_WARNING);
  fs.utimesSync(path.join(wt.changeDir, "reviews/plan-review.md"), future(), future());
  res = step();
  assert.equal(res.json.step, "implement", res.stdout);
  return lastRan(wt);
}

test("5.1 the score down shift does not stack on the first-attempt drop", { skip: gitSkip }, () => {
  // drop 0: the down shift moves the isolated run's implement from 3 to 2.
  const control = scoredImplement({ escalation: { firstAttempt: { drop: 0 } } });
  assert.equal(control.tier, 2, control.tierWhy);
  assert.equal(control.scoreShift?.shift, -1, control.tierWhy);

  // The drop takes the place of the down shift: tier 2, not 1.
  const e = scoredImplement();
  assert.equal(e.tier, 2, e.tierWhy);
  assert.equal(e.cheap, true);
  assert.equal(e.scoreShift, undefined);
  assert.match(e.tierWhy, /-1 first attempt/);
  assert.doesNotMatch(e.tierWhy, /score/);
});
