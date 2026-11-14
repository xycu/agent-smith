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
  run, writeOverride, writeMetaFile, readReportFile,
} from "./helpers.mjs";
import { pluginPolicy, policyProblems, providerOf, dispatchTarget, estimateCost } from "../scripts/state.mjs";
import { tierFor } from "../scripts/steps.mjs";

after(cleanupAll);

const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const policy = pluginPolicy();

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
  "manual-verify": { base: ["sonnet", "medium"], min: ["sonnet", "medium"], max: ["opus", "xhigh"] },
  score: { base: ["haiku", "low"], min: ["haiku", "low"], max: ["sonnet", "low"] },
  // The OpenSpec steps (ADR-013 D9) run on the pins of the 10x step each one mirrors.
  "os-propose": { base: ["opus", "high"], min: ["sonnet", "medium"], max: ["opus", "max"] },
  "os-apply": { base: ["sonnet", "high"], min: ["sonnet", "medium"], max: ["opus", "max"] },
  "os-verify": { base: ["sonnet", "high"], min: ["sonnet", "medium"], max: ["opus", "xhigh"] },
  "os-archive": { base: ["sonnet", "high"], min: ["sonnet", "high"], max: ["sonnet", "high"] },
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

// ---- escalation keeps climbing (F1): a failure counts only rungs that clear the floor -----

test("ladder: an interactive base-3 step after two failures at standard and thorough reaches opus/xhigh", () => {
  for (const rigor of ["standard", "thorough"]) {
    const { json, e } = start(staged({
      phases: 2, done: 2,
      log: [entry(1, "plan"), entry(2, "plan-review"), entry(3, "implement"),
        entry(4, "impl-review", failed), entry(5, "impl-review", failed)],
    }), GOAL, rigor);
    assert.equal(json.step, "impl-review", rigor);
    assert.deepEqual(route(e), ["opus", "xhigh"], rigor);
    assert.equal(e.tier, 6, e.tierWhy);
    assert.match(e.tierWhy, /\+2 for 2 failed attempt\(s\)/, rigor);
  }
});

test("ladder: a plain-goal first plan climbs sonnet/high, opus/high, opus/xhigh over three attempts", () => {
  const project = makeProject();
  const tiers = [start(project, GOAL, "standard").e];
  tiers.push(finish(project, { status: "failed", note: "no plan" }).e);
  tiers.push(finish(project, { status: "failed", note: "no plan again" }).e);
  assert.deepEqual(tiers.map(route), [["sonnet", "high"], ["opus", "high"], ["opus", "xhigh"]]);
  assert.deepEqual(tiers.map((e) => e.tier), [3, 5, 6]);
  assert.match(tiers[2].tierWhy, /\+2 for 2 failed attempt\(s\)/);
});

test("ladder: impl-review with 3 phases after one failure reaches opus/xhigh, its maxTier", () => {
  for (const fails of [1, 2]) {
    const log = [entry(1, "plan"), entry(2, "plan-review"), entry(3, "implement")];
    for (let i = 0; i < fails; i++) log.push(entry(4 + i, "impl-review", failed));
    const { json, e } = start(staged({ phases: 3, done: 3, log }), GOAL, "standard");
    assert.equal(json.step, "impl-review");
    assert.deepEqual(route(e), ["opus", "xhigh"], `${fails} failures: ${e.tierWhy}`);
    assert.equal(e.tier, 6, e.tierWhy);
  }
});

test("ladder: a non-interactive base-3 step still climbs one rung per failure", () => {
  const { e } = start(staged({
    phases: 2, log: [entry(1, "plan"), entry(2, "plan-review"), entry(3, "implement", failed), entry(4, "implement", failed)],
    policy: { codeReplan: { afterFailures: 0 } },
  }), GOAL, "standard");
  assert.equal(e.template, "implement");
  assert.deepEqual(route(e), ["opus", "high"]);
  assert.equal(e.tier, 5, e.tierWhy);
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
    // The 7-rung ladder has no tier 7, which the policy check rejects, so every step capped at 7 is capped at 6.
    steps: {
      plan: { baseTier: 4, maxTier: 6 }, implement: { maxTier: 6 }, fix: { maxTier: 6 },
      "os-propose": { maxTier: 6 }, "os-apply": { maxTier: 6 },
    },
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

// ---- published opt-in fable ladder -----------------------------------------------------

const reference = fs.readFileSync(path.join(SKILL_DIR, "../../docs/REFERENCE.md"), "utf8");
const example = reference.split("### Opt-in fable ladder\n")[1]?.match(/```json\n([\s\S]*?)\n```/);
assert.ok(example, "the canonical fable JSON fence exists");
const FABLE = JSON.parse(example[1]);
const fablePolicy = {
  ...policy,
  ladder: FABLE.ladder,
  steps: Object.fromEntries(Object.entries(policy.steps).map(([step, config]) => [step, { ...config, ...FABLE.steps[step] }])),
};
const TWO_PHASES = { hasProgress: true, phases: 2, rows: 2 };

test("fable: the published override preserves default pins and selectively merges ceilings", () => {
  assert.deepEqual(Object.keys(FABLE).sort(), ["ladder", "steps"]);
  assert.deepEqual(FABLE.ladder, [
    ...policy.ladder,
    { model: "fable", effort: "high" },
    { model: "fable", effort: "xhigh" },
  ]);
  assert.equal(FABLE.ladder.length, 10);
  assert.equal(policy.ladder.length, 8);
  assert.deepEqual(FABLE.steps, {
    plan: { maxTier: 9 }, "plan-review": { maxTier: 9 }, "impl-review": { maxTier: 9 }, fix: { maxTier: 9 },
  });
  assert.equal(policyProblems(fablePolicy), null);
  for (const tier of [8, 9]) {
    assert.equal(Object.hasOwn(FABLE.ladder[tier], "provider"), false);
    assert.equal(providerOf(FABLE.ladder[tier]), "claude");
    assert.deepEqual(dispatchTarget(fablePolicy, tier), {
      provider: "claude", model: "fable", effort: tier === 8 ? "high" : "xhigh",
    });
  }
  const project = makeProject({ policy: FABLE });
  const probe = path.join(project.root, "policy-probe.mjs");
  const stateUrl = new URL("../scripts/state.mjs", import.meta.url).href;
  fs.writeFileSync(probe, `import { loadPolicy } from ${JSON.stringify(stateUrl)}; console.log(JSON.stringify(loadPolicy()));\n`);
  const merged = run(project, [], { script: probe });
  assert.equal(merged.status, 0, merged.stderr);
  assert.deepEqual(merged.json.ladder, FABLE.ladder);
  assert.deepEqual(merged.json.steps, fablePolicy.steps);
  for (const [step, config] of Object.entries(policy.steps)) {
    assert.equal(merged.json.steps[step].baseTier, config.baseTier, step);
    assert.equal(merged.json.steps[step].minTier, config.minTier, step);
    if (!Object.hasOwn(FABLE.steps, step)) assert.deepEqual(merged.json.steps[step], config, step);
  }
  for (const key of ["limits", "escalation", "rigor", "complexity"]) {
    assert.deepEqual(merged.json[key], policy[key], key);
  }
  const baseline = JSON.parse(fs.readFileSync(path.join(SKILL_DIR, "baseline-policy.json"), "utf8"));
  assert.deepEqual(baseline.ladder, Array.from({ length: 8 }, () => ({ model: "sonnet", effort: "high" })));
  assert.equal(Object.hasOwn(baseline, "steps"), false);
});

test("fable: a Codex host refuses the published Claude ladder before creating run state", () => {
  const project = makeProject({ policy: FABLE });
  assert.equal(fs.existsSync(project.agentDir), false);
  const res = init(project, GOAL, ["--host", "codex"]);
  assert.equal(res.status, 1, res.stdout);
  assert.equal(res.json.action, "halt");
  assert.match(res.json.reason, /OpenAI-only ladder/);
  assert.equal(fs.existsSync(project.agentDir), false);
});

test("fable: real RETHINK revisions dispatch opus/max then fable/high and retain the revision cap", () => {
  for (const failures of [0, 1, 2]) {
    const project = makeProject({ plan: planText({ phases: 2 }), policy: FABLE });
    writeReview(project, "plan-review", { verdict: "RETHINK", findings: "2 critical, 0 warnings" });
    const log = [entry(1, "plan"), entry(2, "plan-review")];
    for (let i = 0; i < failures; i++) {
      log.push(entry(3 + i, "plan", { ...failed, template: "plan-revise" }));
    }
    writeLog(project, log);
    const res = init(project, GOAL, ["--rigor", "standard"]);
    if (failures === 2) {
      assert.equal(res.status, 0, res.stdout);
      assert.equal(res.json.action, "halt");
      assert.match(res.json.reason, /revision/i);
      assert.equal(readLogEntries(project).length, log.length);
      continue;
    }
    assert.equal(res.status, 0, res.stdout);
    assert.equal(res.json.action, "run");
    assert.equal(res.json.step, "plan");
    const logged = readLogEntries(project).at(-1);
    assert.equal(logged.template, "plan-revise");
    const expected = failures === 0 ? [7, "claude", "opus", "max"] : [8, "claude", "fable", "high"];
    assert.deepEqual([logged.tier, logged.provider, logged.model, logged.effort], expected);
    assert.deepEqual([res.json.provider, res.json.model, res.json.effort], expected.slice(1));
  }
});

test("fable: pure routing reaches and clamps at tier 9 only for selected steps under shipped floors", () => {
  const maxima = {
    plan: 9, "plan-review": 9, implement: 7, "impl-review": 9, fix: 9, archive: 3,
    research: 6, "domain-brief": 6, frame: 5, "manual-verify": 6, score: 1,
    "os-propose": 7, "os-apply": 7, "os-verify": 6, "os-archive": 3,
  };
  for (const level of ["lean", "standard", "thorough"]) {
    for (const [step, tier] of Object.entries(maxima)) {
      const actual = tierFor({ step, bump: 100 }, [], fablePolicy, TWO_PHASES, { goal: GOAL }, level);
      assert.equal(actual.tier, tier, `${step}/${level}: ${actual.tierWhy}`);
      if (Object.hasOwn(FABLE.steps, step)) {
        assert.deepEqual(dispatchTarget(fablePolicy, actual.tier), { provider: "claude", model: "fable", effort: "xhigh" });
      }
    }
  }
});

test("fable: shipped floors accept both rungs and custom floors retain post-clamp behavior", () => {
  for (const level of ["lean", "standard", "thorough"]) {
    for (const tier of [8, 9]) {
      const actual = tierFor({ step: "plan", bump: tier - 5 }, [], fablePolicy, TWO_PHASES, { goal: GOAL }, level);
      assert.equal(actual.tier, tier, actual.tierWhy);
      assert.deepEqual(dispatchTarget(fablePolicy, tier), {
        provider: "claude", model: "fable", effort: tier === 8 ? "high" : "xhigh",
      });
      assert.ok(rank(fablePolicy.ladder[tier].effort) >= rank(policy.rigor.minEffort[level]));
    }
  }
  for (const maxTier of [8, 9]) {
    const custom = {
      ...fablePolicy,
      steps: { ...fablePolicy.steps, plan: { ...fablePolicy.steps.plan, maxTier } },
      rigor: { ...fablePolicy.rigor, minEffort: { ...fablePolicy.rigor.minEffort, standard: "xhigh" } },
    };
    const actual = tierFor({ step: "plan", bump: 3 }, [], custom, TWO_PHASES, { goal: GOAL }, "standard");
    assert.equal(actual.tier, 9, actual.tierWhy);
    assert.match(actual.tierWhy, /skips high rung/);
  }
  const customMax = {
    ...fablePolicy,
    rigor: { ...fablePolicy.rigor, minEffort: { ...fablePolicy.rigor.minEffort, standard: "max" } },
  };
  const exhausted = tierFor({ step: "plan", bump: 3 }, [], customMax, TWO_PHASES, { goal: GOAL }, "standard");
  assert.equal(exhausted.tier, 9);
  assert.equal(customMax.ladder[exhausted.tier].effort, "xhigh");
  assert.ok(rank("xhigh") < rank("max"), "the documented exhausted ladder cannot satisfy this custom floor");
});

test("fable: missing prices remain unknown in estimates, status, reports and neutral token comparisons", () => {
  const baseline = makeProject();
  writeLog(baseline, [entry(1, "plan", { usage: { totalTokens: 4_000_000 } })]);
  writeMetaFile(baseline, { id: baseline.id, goal: GOAL, outcome: { action: "done" } });
  for (const mixed of [false, true]) {
    const project = makeProject({ policy: FABLE });
    const entries = [
      ...(mixed ? [entry(1, "implement", { usage: { totalTokens: 1_000_000 } })] : []),
      entry(mixed ? 2 : 1, "plan", { tier: 8, model: "fable", effort: "high", usage: { totalTokens: 1_000_000 } }),
    ];
    writeLog(project, entries);
    writeMetaFile(project, { id: project.id, goal: GOAL, outcome: { action: "done" } });
    const args = ["compare", project.id, "--baseline", baseline.root];
    const plain = run(project, args);
    assert.equal(plain.status, 0, plain.stdout);
    assert.equal(plain.json.comparable, true);
    assert.equal(plain.json.pinned, true);
    assert.equal(plain.json.baseline.cost, null);
    assert.equal(plain.json.routed.cost, null);
    const off = run(project, ["status", project.id, "--report"]);
    assert.equal(off.status, 0, off.stdout);
    assert.equal(Object.hasOwn(off.json, "cost"), false);
    assert.ok(off.json.steps.every((e) => !Object.hasOwn(e, "cost")));
    assert.doesNotMatch(readReportFile(project), /Cost \(est/);
    const table = { usdPerMillionTokens: { sonnet: 6 } };
    assert.deepEqual(estimateCost(entries, table), {
      usd: mixed ? 6 : 0, priced: mixed ? 1 : 0, withFigures: mixed ? 2 : 1,
      unpriced: ["fable"], perEntry: mixed ? { 1: 6, 2: null } : { 1: null },
    });
    writeOverride(project, { ...FABLE, prices: table });
    const status = run(project, ["status", project.id, "--report"]);
    assert.equal(status.status, 0, status.stdout);
    assert.deepEqual(status.json.cost, {
      usd: mixed ? 6 : null, currency: "USD", rate: "blended", priced: mixed ? 1 : 0,
      withFigures: mixed ? 2 : 1, unpriced: ["fable"],
    });
    assert.deepEqual(status.json.steps.map((e) => e.cost), mixed ? [6, null] : [null]);
    const report = readReportFile(project);
    assert.match(report, /\| fable \| high \| 8 \| no \| ok \| 1000000 \| - \|/);
    assert.match(report, /no price for: fable/);
    assert.match(report, mixed ? /priced 1 of 2 steps/ : /no step with a token figure has a price/);
    const priced = run(project, args);
    assert.equal(priced.status, 0, priced.stdout);
    for (const key of ["comparable", "reasons", "verdict", "dropPercent", "pinned"]) {
      assert.deepEqual(priced.json[key], plain.json[key], key);
    }
    assert.ok(priced.json.warnings.includes("cost-incomplete:routed"));
    assert.equal(priced.json.routed.cost.usd, mixed ? 6 : null);
    assert.deepEqual(priced.json.routed.cost.unpriced, ["fable"]);
    writeOverride(project, { ...FABLE, prices: { usdPerMillionTokens: { sonnet: 6, fable: 12 } } });
    const complete = run(project, ["status", project.id, "--report"]);
    assert.equal(complete.status, 0, complete.stdout);
    assert.equal(complete.json.steps.at(-1).cost, 12);
    assert.equal(complete.json.cost.usd, mixed ? 18 : 12);
    assert.deepEqual(complete.json.cost.unpriced, []);
    assert.match(readReportFile(project), /\| fable \| high \| 8 \| no \| ok \| 1000000 \| \$12\.0000 \|/);
  }
});
