// Structural check of the keys that cap the spend of a run (policyProblems): limits, escalation, rigor.budgetDelta,
// ladder and step tiers. init, next and usage halt on the first problem before anything is written; status reports it.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { cleanupAll, makeProject, init, next, run, writeResult } from "./helpers.mjs";
import { policyProblems } from "../scripts/state.mjs";

after(cleanupAll);

const SHIPPED = JSON.parse(fs.readFileSync(new URL("../policy.json", import.meta.url), "utf8"));
const BASELINE = JSON.parse(fs.readFileSync(new URL("../baseline-policy.json", import.meta.url), "utf8"));
const FILE = "agent-smith-policy.json";
const GOAL = "fix typo";
const ZERO_DELTA = { rigor: { budgetDelta: { lean: 0, standard: 0, thorough: 0 } } };

// Every file under dir as { relative path: content }, for the byte-identical assertions.
function snapshot(dir) {
  const files = {};
  const walk = (d) => {
    for (const name of fs.readdirSync(d).sort()) {
      const abs = path.join(d, name);
      if (fs.statSync(abs).isDirectory()) walk(abs);
      else files[path.relative(dir, abs)] = fs.readFileSync(abs, "utf8");
    }
  };
  if (fs.existsSync(dir)) walk(dir);
  return files;
}

function assertHalt(res, key) {
  assert.equal(res.status, 1, res.stdout);
  assert.equal(res.json.action, "halt");
  assert.ok(res.json.reason.includes(`policy.${key} must be`), res.json.reason);
  assert.ok(res.json.reason.includes(FILE), res.json.reason);
  assert.ok(res.json.reason.endsWith("Nothing was written."), res.json.reason);
}

// Each case: [policy override, key named in the halt].
const CASES = {
  "limits is not an object": [{ limits: "x" }, "limits"],
  "escalation is null": [{ escalation: null }, "escalation"],
  "rigor.budgetDelta is an array": [{ rigor: { budgetDelta: [] } }, "rigor.budgetDelta"],
  "steps is a string": [{ steps: "x" }, "steps"],
  "maxTotalSteps is a string": [{ limits: { maxTotalSteps: "14" } }, "limits.maxTotalSteps"],
  "maxTotalSteps is 0": [{ limits: { maxTotalSteps: 0 } }, "limits.maxTotalSteps"],
  "maxTotalSteps is a float": [{ limits: { maxTotalSteps: 1.5 } }, "limits.maxTotalSteps"],
  "maxTotalSteps is null": [{ limits: { maxTotalSteps: null } }, "limits.maxTotalSteps"],
  "maxPlanRevisions is negative": [{ limits: { maxPlanRevisions: -1 } }, "limits.maxPlanRevisions"],
  "maxPlanRevisions is a string": [{ limits: { maxPlanRevisions: "2" } }, "limits.maxPlanRevisions"],
  "maxFixLoops is a float": [{ limits: { maxFixLoops: 0.5 } }, "limits.maxFixLoops"],
  "maxFixLoops is null": [{ limits: { maxFixLoops: null } }, "limits.maxFixLoops"],
  "maxNeutralRetries is a string": [{ limits: { maxNeutralRetries: "3" } }, "limits.maxNeutralRetries"],
  "maxAttemptsPerStep is null": [{ escalation: { maxAttemptsPerStep: null } }, "escalation.maxAttemptsPerStep"],
  "maxAttemptsPerStep is 0": [{ escalation: { maxAttemptsPerStep: 0 } }, "escalation.maxAttemptsPerStep"],
  "maxAttemptsPerStep is a string": [{ escalation: { maxAttemptsPerStep: "3" } }, "escalation.maxAttemptsPerStep"],
  "budgetDelta level is a string": [{ rigor: { budgetDelta: { standard: "5" } } }, "rigor.budgetDelta.standard"],
  "budgetDelta level is a float": [{ rigor: { budgetDelta: { lean: -1.5 } } }, "rigor.budgetDelta.lean"],
  "ladder is empty": [{ ladder: [] }, "ladder"],
  "ladder is a string": [{ ladder: "x" }, "ladder"],
  "ladder entry has no effort": [{ ladder: [...SHIPPED.ladder.slice(0, 7), { model: "opus" }] }, "ladder[7].effort"],
  "ladder entry model is blank": [{ ladder: [{ model: " ", effort: "low" }, ...SHIPPED.ladder.slice(1)] }, "ladder[0].model"],
  "ladder entry is null": [{ ladder: [null, ...SHIPPED.ladder.slice(1)] }, "ladder[0].model"],
  "a one-entry ladder leaves tiers out of range": [{ ladder: [SHIPPED.ladder[0]] }, "steps.plan.baseTier"],
  "baseTier is 9": [{ steps: { plan: { baseTier: 9 } } }, "steps.plan.baseTier"],
  "baseTier is a string": [{ steps: { plan: { baseTier: "2" } } }, "steps.plan.baseTier"],
  "minTier is negative": [{ steps: { plan: { minTier: -1 } } }, "steps.plan.minTier"],
  "maxTier is a float": [{ steps: { fix: { maxTier: 2.5 } } }, "steps.fix.maxTier"],
  "minTier is above maxTier": [{ steps: { "plan-review": { minTier: 5, maxTier: 3 } } }, "steps.plan-review.minTier"],
  "a step entry is not an object": [{ steps: { plan: 3 } }, "steps.plan"],
};

test("init halts on each malformed key, names it and writes nothing", () => {
  for (const [name, [policy, key]] of Object.entries(CASES)) {
    const project = makeProject({ policy });
    const before = snapshot(project.changeDir);
    const res = init(project, GOAL);
    assertHalt(res, key);
    assert.deepEqual(snapshot(project.changeDir), before, name);
    assert.equal(fs.existsSync(path.join(project.agentDir, "meta.json")), false, name);
  }
});

test("init halts the same way with --chain openspec, before the chain is resolved", () => {
  const project = makeProject({ policy: { limits: { maxFixLoops: "2" } } });
  assertHalt(init(project, GOAL, ["--chain", "openspec"]), "limits.maxFixLoops");
});

test("reproduction: maxTotalSteps 1 still halts on the spent budget", () => {
  const project = makeProject({ policy: { limits: { maxTotalSteps: 1 }, ...ZERO_DELTA } });
  assert.equal(init(project, GOAL).json.action, "run");
  writeResult(project, { status: "failed", note: "x" });
  const res = next(project);
  assert.equal(res.json.action, "halt");
  assert.match(res.json.reason, /Step budget 1 spent\./);
});

test("reproduction: maxTotalSteps \"1\" halts at init with the key", () => {
  assertHalt(init(makeProject({ policy: { limits: { maxTotalSteps: "1" }, ...ZERO_DELTA } }), GOAL), "limits.maxTotalSteps");
});

test("reproduction: maxAttemptsPerStep null halts at init with the key", () => {
  assertHalt(init(makeProject({ policy: { escalation: { maxAttemptsPerStep: null } } }), GOAL), "escalation.maxAttemptsPerStep");
});

test("reproduction: baseTier 9 and a one-entry ladder halt with the tier key", () => {
  assertHalt(init(makeProject({ policy: { steps: { plan: { baseTier: 9 } } } }), GOAL), "steps.plan.baseTier");
  assertHalt(init(makeProject({ policy: { ladder: [SHIPPED.ladder[0]] } }), GOAL), "steps.plan.baseTier");
});

// Breaks the override of a project that already ran init.
function breakPolicy(project, over) {
  const file = path.join(project.root, `context/foundation/${FILE}`);
  fs.writeFileSync(file, JSON.stringify({ ...JSON.parse(fs.readFileSync(file, "utf8")), ...over }));
}

test("next halts on a policy broken after init and writes nothing", () => {
  const project = makeProject();
  assert.equal(init(project, GOAL).json.action, "run");
  writeResult(project, { status: "done", note: "ok" });
  breakPolicy(project, { limits: { maxTotalSteps: "14" } });
  const before = snapshot(project.changeDir);
  assertHalt(next(project), "limits.maxTotalSteps");
  assert.deepEqual(snapshot(project.changeDir), before);
});

test("usage halts on a policy broken after init and writes nothing", () => {
  const project = makeProject();
  assert.equal(init(project, GOAL).json.action, "run");
  breakPolicy(project, { escalation: { maxAttemptsPerStep: 0 } });
  const before = snapshot(project.changeDir);
  assertHalt(run(project, ["usage", project.id, "1", "--tokens", "100"]), "escalation.maxAttemptsPerStep");
  assert.deepEqual(snapshot(project.changeDir), before);
});

test("status stays usable on a broken policy and reports policyProblem", () => {
  const project = makeProject({ policy: { limits: { maxTotalSteps: "14" } } });
  const res = run(project, ["status", project.id]);
  assert.equal(res.status, 0, res.stderr);
  assert.ok(res.json.policyProblem.includes("policy.limits.maxTotalSteps must be"), res.stdout);
  assert.ok(res.json.policyProblem.includes(FILE));
  const ok = run(makeProject(), ["status", "demo"]);
  assert.equal(Object.hasOwn(ok.json, "policyProblem"), false);
});

test("policyProblems returns the first problem in a fixed order and never throws", () => {
  assert.equal(policyProblems(SHIPPED), null);
  const both = { ...SHIPPED, limits: { ...SHIPPED.limits, maxFixLoops: -1 }, ladder: [] };
  assert.match(policyProblems(both), /^policy\.limits\.maxFixLoops must be/);
  assert.match(policyProblems(null), /^policy\.limits must be an object \(got undefined\)/);
  assert.match(policyProblems({}), /^policy\.limits must be/);
});

test("the shipped policy.json passes and baseline-policy.json inits without a policy halt", () => {
  assert.equal(policyProblems(SHIPPED), null);
  const project = makeProject({ policy: BASELINE });
  const res = init(project, GOAL);
  assert.equal(res.json.action, "run", res.stdout);
});
