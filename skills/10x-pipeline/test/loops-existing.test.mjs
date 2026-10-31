// Characterization of the RETHINK/REVISE loop the router has today.
// Black-box through the CLI. Every project starts at an explicit `--rigor standard` (one case at `lean`).
// This file is committed before any router change and is never edited afterwards.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import {
  cleanupAll, makeProject, planText, writeReview, init, writeLog, entry, readLogEntries,
} from "./helpers.mjs";

after(cleanupAll);

const GOAL = Array.from({ length: 30 }, (_, i) => `word${i}`).join(" ");

// A plan with no checked Automated row, a plan-review entry after the plan, and the review file.
function reviewed(verdict, findings, { log = null, plan = planText() } = {}) {
  const project = makeProject({ plan });
  writeReview(project, "plan-review", { verdict, findings });
  writeLog(project, log ?? [entry(1, "plan"), entry(2, "plan-review")]);
  return project;
}

// A plan-revise entry, as the router writes it.
function revise(n, over = {}) {
  return entry(n, "plan", { template: "plan-revise", ...over });
}

const failed = { ok: false, verified: false, result: { status: "failed", note: "fixture" } };

const REVISE_STEPS = ["research", "domain-brief", "frame"];

function stepsOf(project) {
  return readLogEntries(project).map((e) => e.step);
}

test("existing loop: RETHINK with no checked Automated row re-plans at +2 from results", () => {
  const project = reviewed("RETHINK", "2 critical, 0 warnings");
  const res = init(project, GOAL, ["--rigor", "standard"]);
  assert.equal(res.status, 0);
  assert.equal(res.json.action, "run");
  assert.equal(res.json.step, "plan");
  assert.match(res.json.reason, /plan review RETHINK \(2 critical, 0 warnings\)/);
  assert.match(res.json.reason, /\+2 from results/);
  assert.match(res.json.prompt, /verdict: RETHINK/);
  const last = readLogEntries(project).pop();
  assert.equal(last.template, "plan-revise");
  assert.equal(last.tier, 6);
  assert.match(last.tierWhy, /\+2 from results/);
});

test("existing loop: RETHINK at lean with a short goal re-plans the same way", () => {
  const project = reviewed("RETHINK", "1 critical, 0 warnings");
  const res = init(project, "fix typo", ["--rigor", "lean"]);
  assert.equal(res.json.step, "plan");
  assert.match(res.json.prompt, /verdict: RETHINK/);
  const last = readLogEntries(project).pop();
  assert.equal(last.template, "plan-revise");
  assert.match(last.tierWhy, /\+2 from results/);
});

test("existing loop: REVISE with one critical re-plans at +1 from results", () => {
  const project = reviewed("REVISE", "1 critical, 0 warnings");
  const res = init(project, GOAL, ["--rigor", "standard"]);
  assert.equal(res.json.action, "run");
  assert.equal(res.json.step, "plan");
  assert.match(res.json.reason, /plan review REVISE \(1 critical, 0 warnings\)/);
  assert.match(res.json.prompt, /verdict: REVISE/);
  const last = readLogEntries(project).pop();
  assert.equal(last.template, "plan-revise");
  assert.equal(last.tier, 5);
  assert.match(last.tierWhy, /\+1 from results/);
});

test("existing loop: REVISE with warnings equal to reviseToleranceWarnings goes on to implement", () => {
  // policy.review.reviseToleranceWarnings is 1.
  const project = reviewed("REVISE", "0 critical, 1 warnings");
  const res = init(project, GOAL, ["--rigor", "standard"]);
  assert.equal(res.json.action, "run");
  assert.equal(res.json.step, "implement");
  assert.equal(readLogEntries(project).some((e) => e.template === "plan-revise"), false);
});

test("existing loop: REVISE with one warning more than reviseToleranceWarnings re-plans", () => {
  const project = reviewed("REVISE", "0 critical, 2 warnings");
  const res = init(project, GOAL, ["--rigor", "standard"]);
  assert.equal(res.json.step, "plan");
  assert.match(res.json.reason, /plan review REVISE \(0 critical, 2 warnings\)/);
  assert.equal(readLogEntries(project).pop().template, "plan-revise");
});

test("existing loop: two earlier plan-revise entries then RETHINK halt", () => {
  const log = [entry(1, "plan"), entry(2, "plan-review"), revise(3), entry(4, "plan-review"), revise(5), entry(6, "plan-review")];
  const project = reviewed("RETHINK", "2 critical, 0 warnings", { log });
  const res = init(project, GOAL, ["--rigor", "standard"]);
  assert.equal(res.json.action, "halt");
  assert.match(res.json.reason, /Plan still RETHINK after 2 revisions/);
  assert.equal(readLogEntries(project).length, log.length);
});

test("existing loop: two earlier plan-revise entries then a REVISE needing a re-plan halt", () => {
  const log = [entry(1, "plan"), entry(2, "plan-review"), revise(3), entry(4, "plan-review"), revise(5), entry(6, "plan-review")];
  const project = reviewed("REVISE", "1 critical, 0 warnings", { log });
  const res = init(project, GOAL, ["--rigor", "standard"]);
  assert.equal(res.json.action, "halt");
  assert.match(res.json.reason, /Plan still REVISE after 2 revisions/);
});

test("existing loop: a failed plan-revise entry counts as a revision", () => {
  const log = [
    entry(1, "plan"), entry(2, "plan-review"),
    revise(3, failed),
    revise(4),
    entry(5, "plan-review"),
  ];
  const project = reviewed("REVISE", "1 critical, 0 warnings", { log });
  const res = init(project, GOAL, ["--rigor", "standard"]);
  assert.equal(res.json.action, "halt");
  assert.match(res.json.reason, /Plan still REVISE after 2 revisions/);
});

test("existing loop: RETHINK with a checked Automated row does not re-plan", () => {
  const plan = planText({ rowsPerPhase: 2, done: 1 });
  const project = reviewed("RETHINK", "2 critical, 0 warnings", { plan });
  const res = init(project, GOAL, ["--rigor", "standard"]);
  assert.equal(res.json.action, "run");
  assert.equal(res.json.step, "implement");
  assert.equal(readLogEntries(project).some((e) => e.template === "plan-revise"), false);
});

test("existing loop: a second REVISE after a good re-plan returns plan-revise with no research step", () => {
  const log = [entry(1, "plan"), entry(2, "plan-review"), revise(3), entry(4, "plan-review")];
  const project = reviewed("REVISE", "1 critical, 0 warnings", { log });
  const res = init(project, GOAL, ["--rigor", "standard"]);
  assert.equal(res.json.action, "run");
  assert.equal(res.json.step, "plan");
  const entries = readLogEntries(project);
  assert.equal(entries[entries.length - 1].template, "plan-revise");
  assert.equal(entries.filter((e) => e.template === "plan-revise").length, 2);
  assert.deepEqual(stepsOf(project).filter((s) => REVISE_STEPS.includes(s)), []);
});

test("existing loop: RETHINK after a good re-plan returns plan-revise with no frame step", () => {
  const log = [entry(1, "plan"), entry(2, "plan-review"), revise(3), entry(4, "plan-review")];
  const project = reviewed("RETHINK", "2 critical, 0 warnings", { log });
  const res = init(project, GOAL, ["--rigor", "standard"]);
  assert.equal(res.json.action, "run");
  assert.equal(res.json.step, "plan");
  assert.match(res.json.prompt, /verdict: RETHINK/);
  const entries = readLogEntries(project);
  assert.equal(entries[entries.length - 1].template, "plan-revise");
  assert.equal(entries.filter((e) => e.template === "plan-revise").length, 2);
  assert.deepEqual(stepsOf(project).filter((s) => REVISE_STEPS.includes(s)), []);
});
