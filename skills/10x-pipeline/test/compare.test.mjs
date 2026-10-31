// Tests for the baseline arm (baseline-policy.json), the compare policy key and usage intake.
// Black-box through the CLI in scratch projects. Test names start with the plan row number.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  cleanupAll, makeProject, planText, writePlan, run, init, next, writeResult, readLogEntries, readMetaFile,
  gitAvailable, gitEnv, gitInit, commitFiles,
} from "./helpers.mjs";

after(cleanupAll);

const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (name) => JSON.parse(fs.readFileSync(path.join(SKILL_DIR, name), "utf8"));
const BASELINE = readJson("baseline-policy.json");
const DEFAULT = readJson("policy.json");

// ---- 1.1 baseline file guard -----------------------------------------------------

test("1.1 baseline file has exactly ladder and rigor, all sonnet/high, standard rigor, no plan-review skip", () => {
  assert.deepEqual(Object.keys(BASELINE).sort(), ["ladder", "rigor"]);
  for (const tier of BASELINE.ladder) assert.deepEqual(tier, { model: "sonnet", effort: "high" });
  const highestMax = Math.max(...Object.values(DEFAULT.steps).map((s) => s.maxTier));
  assert.ok(BASELINE.ladder.length >= highestMax + 1, "ladder covers every step maxTier");
  assert.ok(BASELINE.ladder.length >= DEFAULT.ladder.length, "ladder is as long as the default ladder");
  assert.deepEqual(Object.keys(BASELINE.rigor).sort(), ["fromGoal", "skipPlanReviewAt"]);
  assert.deepEqual(BASELINE.rigor.fromGoal, { short: "standard", plain: "standard", hard: "standard" });
  assert.deepEqual(BASELINE.rigor.skipPlanReviewAt, []);
});

// ---- 1.2 the file pins the first step, the default policy does not ----------------

function firstStep(goal, policy) {
  const project = makeProject({ policy });
  const res = init(project, goal);
  assert.equal(res.status, 0, res.stderr);
  return { res: res.json, rigor: readMetaFile(project).rigor.level };
}

test("1.2 baseline file starts a hard-keyword goal and a short goal at sonnet/high and standard", () => {
  const hardDefault = firstStep("refactor the auth module", null);
  assert.equal(hardDefault.res.step, "plan");
  assert.equal(hardDefault.res.model, "opus");
  assert.equal(hardDefault.res.effort, "high");
  const hardBase = firstStep("refactor the auth module", BASELINE);
  assert.equal(hardBase.res.step, "plan");
  assert.equal(hardBase.res.model, "sonnet");
  assert.equal(hardBase.res.effort, "high");
  assert.equal(hardBase.rigor, "standard");

  const shortDefault = firstStep("fix typo", null);
  assert.equal(shortDefault.res.model, "sonnet");
  assert.equal(shortDefault.res.effort, "medium");
  assert.equal(shortDefault.rigor, "lean");
  const shortBase = firstStep("fix typo", BASELINE);
  assert.equal(shortBase.res.model, "sonnet");
  assert.equal(shortBase.res.effort, "high");
  assert.equal(shortBase.rigor, "standard");
});

// ---- 1.3 plan review is skipped by default and not under the baseline file -------

const noGit = !gitAvailable() && "git is not installed";

function gitProject(policy) {
  const project = makeProject({ policy });
  gitInit(project);
  for (let i = 1; i <= 10; i++) commitFiles(project, [`s${i}.js`], { message: `c${i}` });
  return project;
}

const withGit = (project, args) => run(project, args, { env: gitEnv(project) });

// Plan step done: plan.md written after the step started, result "done".
function finishPlan(project, text) {
  writePlan(project, text);
  const later = new Date(Date.now() + 5000);
  fs.utimesSync(project.planFile, later, later);
  writeResult(project, { status: "done", note: "planned" });
}

function afterPlan(policy) {
  const project = gitProject(policy);
  const first = withGit(project, ["init", project.id, "--goal", "fix typo"]);
  assert.equal(first.json.step, "plan");
  finishPlan(project, planText({ files: ["**File**: `x.js`"] }));
  const second = withGit(project, ["next", project.id]);
  return { project, second };
}

test("1.3 plan review is skipped under the default policy and runs at sonnet/high under the baseline file", { skip: noGit }, () => {
  const control = afterPlan(null);
  assert.equal(control.second.json.step, "implement");
  const skips = readLogEntries(control.project).filter((e) => e.skipped);
  assert.equal(skips.length, 1);
  assert.equal(skips[0].step, "plan-review");

  const baseline = afterPlan(BASELINE);
  assert.equal(baseline.second.json.step, "plan-review");
  assert.equal(baseline.second.json.model, "sonnet");
  assert.equal(baseline.second.json.effort, "high");
  assert.equal(readLogEntries(baseline.project).filter((e) => e.skipped).length, 0);
});

// ---- 1.4 usage intake --------------------------------------------------------------

function planStepWithResult(extra) {
  const project = makeProject();
  assert.equal(init(project, "fix typo").status, 0);
  writePlan(project, planText());
  const later = new Date(Date.now() + 5000);
  fs.utimesSync(project.planFile, later, later);
  writeResult(project, { status: "done", note: "planned", ...extra });
  const res = next(project);
  assert.equal(res.status, 0, res.stderr);
  return readLogEntries(project).find((e) => e.step === "plan");
}

test("1.4 usage intake keeps valid figures, drops invalid ones, leaves no key when absent", () => {
  const good = planStepWithResult({ usage: { totalTokens: 1000, toolUses: 3, durationMs: 500 } });
  assert.deepEqual(good.usage, { totalTokens: 1000, toolUses: 3, durationMs: 500 });

  const mixed = planStepWithResult({ usage: { totalTokens: -5, toolUses: 1.5, durationMs: "x" } });
  assert.equal(mixed.usage, undefined);

  const partial = planStepWithResult({ usage: { totalTokens: 42, toolUses: -1, durationMs: 2.5 } });
  assert.deepEqual(partial.usage, { totalTokens: 42 });

  const none = planStepWithResult({});
  assert.equal("usage" in none, false);
});

// ---- 1.5 shipped policy ------------------------------------------------------------

test("1.5 policy.json ships compare.targetDropPercent as null", () => {
  assert.deepEqual(DEFAULT.compare, { targetDropPercent: null });
});
