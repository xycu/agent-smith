// The 8-rung ladder with opus/medium at index 4 (ADR-010): rung order, the model and effort of every step pin, and the
// routes the inserted rung and the effort-rung floor move. Black-box through the CLI in scratch projects: every route is
// read from the router's output and log, not computed from the policy.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  cleanupAll, makeProject, planText, writeReview, init, next, writeResult, writeLog, entry, readLogEntries,
} from "./helpers.mjs";

after(cleanupAll);

const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const policy = JSON.parse(fs.readFileSync(path.join(SKILL_DIR, "policy.json"), "utf8"));

const GOAL = Array.from({ length: 30 }, (_, i) => `word${i}`).join(" ");
const HARD_GOAL = "refactor the session store";
const ONE_WARNING = { verdict: "SOUND", findings: "0 critical, 1 warnings" };
const failed = { ok: false, verified: false, result: { status: "failed", note: "fixture" } };

// Model and effort of every step at its base, min and max tier, as they were on the 7-rung ladder.
const PINS = {
  plan: { base: ["opus", "high"], min: ["sonnet", "medium"], max: ["opus", "max"] },
  "plan-review": { base: ["sonnet", "medium"], min: ["sonnet", "low"], max: ["opus", "xhigh"] },
  implement: { base: ["sonnet", "high"], min: ["sonnet", "medium"], max: ["opus", "max"] },
  "impl-review": { base: ["sonnet", "high"], min: ["sonnet", "medium"], max: ["opus", "xhigh"] },
  fix: { base: ["sonnet", "high"], min: ["sonnet", "medium"], max: ["opus", "max"] },
  archive: { base: ["sonnet", "high"], min: ["sonnet", "high"], max: ["sonnet", "high"] },
  research: { base: ["sonnet", "high"], min: ["sonnet", "medium"], max: ["opus", "xhigh"] },
  "domain-brief": { base: ["sonnet", "high"], min: ["sonnet", "high"], max: ["opus", "xhigh"] },
  frame: { base: ["opus", "high"], min: ["opus", "high"], max: ["opus", "high"] },
  "manual-verify": { base: ["sonnet", "high"], min: ["sonnet", "medium"], max: ["opus", "xhigh"] },
  score: { base: ["haiku", "low"], min: ["haiku", "low"], max: ["sonnet", "low"] },
};

// The rungs of the 7-rung ladder, for the check that an effort-ordered ladder adds no skip note.
const OLD_LADDER = [
  { model: "haiku", effort: "low" },
  { model: "sonnet", effort: "low" },
  { model: "sonnet", effort: "medium" },
  { model: "sonnet", effort: "high" },
  { model: "opus", effort: "high" },
  { model: "opus", effort: "xhigh" },
  { model: "opus", effort: "max" },
];

const rank = (effort) => policy.rigor.effortOrder.indexOf(effort);
const interactive = (e) => policy.steps[e.step]?.interactive === true || ["implement-tdd", "implement-e2e"].includes(e.template);

// Entries the router wrote (fixtures carry tierWhy "fixture").
function routed(project) {
  return readLogEntries(project).filter((e) => !e.skipped && e.tierWhy !== "fixture");
}

// No interactive step runs on a rung whose own effort is below the floor of its level.
function checkFloor(project) {
  for (const e of routed(project)) {
    if (!interactive(e)) continue;
    const floor = policy.rigor.minEffort[e.rigor];
    assert.ok(rank(e.effort) >= rank(floor), `${e.step} at ${e.rigor} runs ${e.model}/${e.effort}, below ${floor}: ${e.tierWhy}`);
  }
}

// Starts the run with `init` and returns the router output and the entry it logged.
function start(project, goal, rigor) {
  const res = init(project, goal, ["--rigor", rigor]);
  assert.equal(res.status, 0, res.stdout + res.stderr);
  assert.equal(res.json.action, "run", res.stdout);
  const e = readLogEntries(project).pop();
  assert.deepEqual([res.json.model, res.json.effort], [e.model, e.effort]);
  checkFloor(project);
  return { json: res.json, e };
}

function finish(project, result) {
  writeResult(project, result);
  const res = next(project);
  assert.equal(res.status, 0, res.stdout + res.stderr);
  assert.equal(res.json.action, "run", res.stdout);
  const e = readLogEntries(project).pop();
  assert.deepEqual([res.json.model, res.json.effort], [e.model, e.effort]);
  checkFloor(project);
  return { json: res.json, e };
}

// A project with a plan, a plan review with one warning (no clean-review drop) and a fixture log.
function staged({ phases, done = 0, log, implReview = null, policy: over = null }) {
  const project = makeProject({ plan: planText({ phases, done }), policy: over });
  writeReview(project, "plan-review", ONE_WARNING);
  if (implReview) writeReview(project, "impl-review", implReview);
  writeLog(project, log);
  return project;
}

const route = (e) => [e.model, e.effort];

// ---- data ---------------------------------------------------------------------------

test("ladder: 8 rungs with opus/medium between sonnet/high and opus/high", () => {
  assert.deepEqual(policy.ladder, [
    { model: "haiku", effort: "low" },
    { model: "sonnet", effort: "low" },
    { model: "sonnet", effort: "medium" },
    { model: "sonnet", effort: "high" },
    { model: "opus", effort: "medium" },
    { model: "opus", effort: "high" },
    { model: "opus", effort: "xhigh" },
    { model: "opus", effort: "max" },
  ]);
  assert.deepEqual(policy.complexity.firstPlan.bump, { plain: -2, hard: 0 });
});

test("ladder: every step keeps its model and effort at its base, min and max tier", () => {
  assert.deepEqual(Object.keys(policy.steps).sort(), Object.keys(PINS).sort());
  for (const [step, pin] of Object.entries(PINS)) {
    const s = policy.steps[step];
    const at = (i) => [policy.ladder[i].model, policy.ladder[i].effort];
    assert.deepEqual(at(s.baseTier), pin.base, `${step} base`);
    assert.deepEqual(at(s.minTier), pin.min, `${step} min`);
    assert.deepEqual(at(s.maxTier), pin.max, `${step} max`);
  }
});

// ---- first plan -----------------------------------------------------------------------

test("ladder: the first plan of a plain goal runs sonnet/high", () => {
  const { json, e } = start(makeProject(), GOAL, "standard");
  assert.equal(json.step, "plan");
  assert.deepEqual(route(e), ["sonnet", "high"]);
  assert.equal(e.tier, 3, e.tierWhy);
});

test("ladder: the first plan of a short goal at lean runs sonnet/medium", () => {
  const { json, e } = start(makeProject(), "fix typo", "lean");
  assert.equal(json.step, "plan");
  assert.equal(e.rigor, "lean");
  assert.deepEqual(route(e), ["sonnet", "medium"]);
  assert.equal(e.tier, 2, e.tierWhy);
  assert.equal(e.simple, true);
});

test("ladder: the first plan of a hard goal runs opus/high", () => {
  const { json, e } = start(makeProject(), HARD_GOAL, "standard");
  assert.equal(json.step, "plan");
  assert.deepEqual(route(e), ["opus", "high"]);
  assert.equal(e.tier, 5, e.tierWhy);
});

test("ladder: a plain-goal first plan after one failed attempt skips opus/medium to opus/high", () => {
  const project = makeProject();
  start(project, GOAL, "standard");
  const { json, e } = finish(project, { status: "failed", note: "no plan" });
  assert.equal(json.step, "plan");
  assert.deepEqual(route(e), ["opus", "high"]);
  assert.equal(e.tier, 5, e.tierWhy);
  assert.match(e.tierWhy, /\+1 for 1 failed attempt\(s\), floor high \(tier 3\), skips medium rung \(tier 5\)$/);
});

// ---- phase-count bumps ----------------------------------------------------------------

test("ladder: implement and fix with 3 phases run opus/medium", () => {
  const impl = start(staged({ phases: 3, log: [entry(1, "plan"), entry(2, "plan-review")] }), GOAL, "standard");
  assert.equal(impl.json.step, "implement");
  assert.equal(impl.e.template, "implement");
  assert.deepEqual(route(impl.e), ["opus", "medium"]);
  assert.equal(impl.e.tier, 4, impl.e.tierWhy);

  const fix = start(staged({
    phases: 3, done: 3,
    log: [entry(1, "plan"), entry(2, "plan-review"), entry(3, "implement"), entry(4, "impl-review")],
    implReview: { verdict: "NEEDS ATTENTION", findings: "1 critical, 0 warnings" },
  }), GOAL, "standard");
  assert.equal(fix.json.step, "fix");
  assert.deepEqual(route(fix.e), ["opus", "medium"]);
  assert.equal(fix.e.tier, 4, fix.e.tierWhy);
  assert.doesNotMatch(fix.e.tierWhy, /skips/);
});

test("ladder: impl-review with 3 phases at standard and thorough skips opus/medium to opus/high", () => {
  for (const rigor of ["standard", "thorough"]) {
    const { json, e } = start(staged({
      phases: 3, done: 3, log: [entry(1, "plan"), entry(2, "plan-review"), entry(3, "implement")],
    }), GOAL, rigor);
    assert.equal(json.step, "impl-review", rigor);
    assert.equal(e.rigor, rigor);
    assert.deepEqual(route(e), ["opus", "high"], rigor);
    assert.equal(e.tier, 5, e.tierWhy);
    assert.match(e.tierWhy, /skips medium rung \(tier 5\)/, rigor);
  }
});

test("ladder: implement, impl-review and fix with 6 phases run opus/high", () => {
  const impl = start(staged({ phases: 6, log: [entry(1, "plan"), entry(2, "plan-review")] }), GOAL, "standard");
  assert.equal(impl.json.step, "implement");
  assert.equal(impl.e.template, "implement");
  assert.deepEqual(route(impl.e), ["opus", "high"]);
  assert.equal(impl.e.tier, 5, impl.e.tierWhy);

  const review = start(staged({
    phases: 6, done: 6, log: [entry(1, "plan"), entry(2, "plan-review"), entry(3, "implement")],
  }), GOAL, "standard");
  assert.equal(review.json.step, "impl-review");
  assert.deepEqual(route(review.e), ["opus", "high"]);
  assert.equal(review.e.tier, 5, review.e.tierWhy);

  const fix = start(staged({
    phases: 6, done: 6,
    log: [entry(1, "plan"), entry(2, "plan-review"), entry(3, "implement"), entry(4, "impl-review")],
    implReview: { verdict: "NEEDS ATTENTION", findings: "1 critical, 0 warnings" },
  }), GOAL, "standard");
  assert.equal(fix.json.step, "fix");
  assert.deepEqual(route(fix.e), ["opus", "high"]);
  assert.equal(fix.e.tier, 5, fix.e.tierWhy);
});

test("ladder: plan-review with 6 phases skips opus/medium to opus/high", () => {
  const project = makeProject({ plan: planText({ phases: 6 }) });
  writeLog(project, [entry(1, "plan")]);
  const { json, e } = start(project, GOAL, "standard");
  assert.equal(json.step, "plan-review");
  assert.deepEqual(route(e), ["opus", "high"]);
  assert.equal(e.tier, 5, e.tierWhy);
  assert.match(e.tierWhy, /skips medium rung \(tier 5\)/);
});

// ---- one failure on a base-3 step -------------------------------------------------------

test("ladder: a non-interactive base-3 step after one failure runs opus/medium", () => {
  const { json, e } = start(staged({
    phases: 2, log: [entry(1, "plan"), entry(2, "plan-review"), entry(3, "implement", failed)],
  }), GOAL, "standard");
  assert.equal(json.step, "implement");
  assert.equal(e.template, "implement");
  assert.deepEqual(route(e), ["opus", "medium"]);
  assert.equal(e.tier, 4, e.tierWhy);
  assert.match(e.tierWhy, /\+1 for 1 failed attempt\(s\)/);
});

test("ladder: an interactive base-3 step after one failure at standard and thorough runs opus/high", () => {
  for (const rigor of ["standard", "thorough"]) {
    const { json, e } = start(staged({
      phases: 2, done: 2,
      log: [entry(1, "plan"), entry(2, "plan-review"), entry(3, "implement"), entry(4, "impl-review", failed)],
    }), GOAL, rigor);
    assert.equal(json.step, "impl-review", rigor);
    assert.equal(e.rigor, rigor);
    assert.deepEqual(route(e), ["opus", "high"], rigor);
    assert.equal(e.tier, 5, e.tierWhy);
    assert.match(e.tierWhy, /\+1 for 1 failed attempt\(s\), floor high \(tier 3\), skips medium rung \(tier 5\)$/, rigor);
  }
});

// ---- the effort-rung floor ------------------------------------------------------------

test("ladder: no interactive step lands on a rung whose effort is below the floor of its level", () => {
  // plan-review and impl-review over plan sizes and failure counts that cross the opus/medium rung.
  for (const rigor of ["standard", "thorough"]) {
    for (const phases of [1, 2, 3, 6]) {
      const pr = makeProject({ plan: planText({ phases }) });
      writeLog(pr, [entry(1, "plan")]);
      assert.equal(start(pr, GOAL, rigor).json.step, "plan-review");
      for (const fails of [0, 1, 2]) {
        const log = [entry(1, "plan"), entry(2, "plan-review"), entry(3, "implement")];
        for (let i = 0; i < fails; i++) log.push(entry(4 + i, "impl-review", failed));
        const ir = start(staged({ phases, done: phases, log }), GOAL, rigor);
        assert.equal(ir.json.step, "impl-review");
        assert.notDeepEqual(route(ir.e), ["opus", "medium"], `${rigor}, ${phases} phases, ${fails} failures: ${ir.e.tierWhy}`);
      }
    }
  }
});

test("ladder: a lean interactive step may run on opus/medium", () => {
  // plan-review pinned at tier 4 by an override: the lean floor is medium, so the rung stays.
  const over = { steps: { "plan-review": { baseTier: 4 } } };
  const lean = makeProject({ plan: planText({ phases: 2 }), policy: over });
  writeLog(lean, [entry(1, "plan")]);
  const l = start(lean, "fix typo", "lean");
  assert.equal(l.json.step, "plan-review");
  assert.equal(l.e.rigor, "lean");
  assert.deepEqual(route(l.e), ["opus", "medium"]);
  assert.equal(l.e.tier, 4, l.e.tierWhy);
  assert.match(l.e.tierWhy, /floor medium \(tier 2\)$/);

  const standard = makeProject({ plan: planText({ phases: 2 }), policy: over });
  writeLog(standard, [entry(1, "plan")]);
  const s = start(standard, GOAL, "standard");
  assert.equal(s.json.step, "plan-review");
  assert.deepEqual(route(s.e), ["opus", "high"]);
  assert.match(s.e.tierWhy, /floor high \(tier 3\), skips medium rung \(tier 5\)$/);
});

test("ladder: a ladder ordered by effort gives the old tiers and notes", () => {
  const over = {
    ladder: OLD_LADDER,
    steps: { plan: { baseTier: 4, maxTier: 6 } },
    complexity: { firstPlan: { bump: { plain: -1, hard: 0 } } },
  };
  const project = makeProject({ policy: over });
  const first = start(project, GOAL, "standard");
  assert.equal(first.e.tier, 3, first.e.tierWhy);
  const { e } = finish(project, { status: "failed", note: "no plan" });
  assert.deepEqual(route(e), ["opus", "high"]);
  assert.equal(e.tier, 4, e.tierWhy);
  assert.equal(e.tierWhy, "base 4, -1 from goal class plain, +1 for 1 failed attempt(s), floor high (tier 3)");
});

// ---- characterized re-plans (loops-existing.test.mjs) -----------------------------------

test("ladder: the characterized RETHINK and REVISE re-plans run opus/max and opus/xhigh", () => {
  for (const [verdict, findings, want] of [
    ["RETHINK", "2 critical, 0 warnings", ["opus", "max"]],
    ["REVISE", "1 critical, 0 warnings", ["opus", "xhigh"]],
  ]) {
    const project = makeProject({ plan: planText() });
    writeReview(project, "plan-review", { verdict, findings });
    writeLog(project, [entry(1, "plan"), entry(2, "plan-review")]);
    const { json, e } = start(project, GOAL, "standard");
    assert.equal(json.step, "plan", verdict);
    assert.equal(e.template, "plan-revise", verdict);
    assert.deepEqual(route(e), want, verdict);
  }
});
