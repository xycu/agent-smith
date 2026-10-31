// Loop rules of the pre-plan-steps change. Black-box through the CLI.
// The characterization of today's behaviour lives in loops-existing.test.mjs and is never edited.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  cleanupAll, makeProject, planText, writeReview, init, next, run, writeLog, entry, writeResult, readLogEntries, readMetaFile,
} from "./helpers.mjs";

after(cleanupAll);

const GOAL = Array.from({ length: 30 }, (_, i) => `word${i}`).join(" ");

test("verdict on the entry: plan-revise and fix keep the review verdict, plan keeps none", () => {
  // A plan-revise step caused by a RETHINK review.
  const rethink = makeProject({ plan: planText() });
  writeReview(rethink, "plan-review", { verdict: "RETHINK", findings: "2 critical, 0 warnings" });
  writeLog(rethink, [entry(1, "plan"), entry(2, "plan-review")]);
  const a = init(rethink, GOAL, ["--rigor", "standard"]);
  assert.equal(a.json.step, "plan");
  const reviseEntry = readLogEntries(rethink).pop();
  assert.equal(reviseEntry.template, "plan-revise");
  assert.equal(reviseEntry.verdict, "RETHINK");

  // A fix step caused by a REJECTED implementation review.
  const rejected = makeProject({ plan: planText({ done: 1 }) });
  writeReview(rejected, "plan-review", { verdict: "SOUND" });
  writeReview(rejected, "impl-review", { verdict: "REJECTED", findings: "1 critical, 0 warnings" });
  writeLog(rejected, [entry(1, "plan"), entry(2, "plan-review"), entry(3, "implement"), entry(4, "impl-review")]);
  const b = init(rejected, GOAL, ["--rigor", "standard"]);
  assert.equal(b.json.step, "fix");
  assert.equal(readLogEntries(rejected).pop().verdict, "REJECTED");

  // The first plan has no verdict and no key.
  const fresh = makeProject();
  const c = init(fresh, GOAL, ["--rigor", "standard"]);
  assert.equal(c.json.step, "plan");
  assert.equal("verdict" in readLogEntries(fresh).pop(), false);
});

// ---- Phase 4: the backward loops ----------------------------------------------------

const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const policy = JSON.parse(fs.readFileSync(path.join(SKILL_DIR, "policy.json"), "utf8"));

const RESEARCH = "---\nstatus: complete\n---\n# Research\n";
const BRIEF = "---\ntype: refactor-plan\n---\n# Brief\n";
const FRAME = "# Frame Brief: demo\n\n## Reframed (or Confirmed) Problem Statement\n\nThe task.\n\n## Confidence\n\n- HIGH\n- MEDIUM\n- LOW\n\nStated: MEDIUM\n";
const FAILED = { ok: false, verified: false, result: { status: "failed", note: "fixture" } };
const CRITICAL = "1 critical, 0 warnings";

const future = () => new Date(Date.now() + 60_000);
const touch = (abs, when) => fs.utimesSync(abs, when, when);

// A file in the change folder with a fresh mtime (or the given one), so ordering with startedAt never depends on the clock.
function put(project, file, text, when = future()) {
  const abs = path.join(project.changeDir, file);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, text);
  touch(abs, when);
}

function review(project, name, verdict, findings) {
  writeReview(project, name, { verdict, findings });
  touch(path.join(project.changeDir, "reviews", `${name}.md`), future());
}

const replan = (n, verdict, over = {}) => entry(n, "plan", { template: "plan-revise", verdict, ...over });
const frameRound = (n, over = {}) => entry(n, "frame", { template: "frame-rethink", verdict: "RETHINK", tier: 4, model: "opus", effort: "high", ...over });
const researchRound = (n, over = {}) => entry(n, "research", { template: "research-revise", verdict: "REVISE", ...over });

// A project whose plan review just said `verdict`, with the given log in front of it.
function reviewed(verdict, findings, log, { plan = planText(), policy: override = null } = {}) {
  const project = makeProject({ plan, policy: override });
  review(project, "plan-review", verdict, findings);
  writeLog(project, log);
  return project;
}

const BASE = [entry(1, "plan"), entry(2, "plan-review")];
const start = (project, rigor, goal = GOAL) => init(project, goal, ["--rigor", rigor]);
const finish = (project, result = { status: "done", note: "ok" }) => {
  writeResult(project, result);
  return next(project);
};
const ranOf = (project) => readLogEntries(project).filter((e) => !e.skipped);
const lastRan = (project) => ranOf(project)[ranOf(project).length - 1];
const stepsOf = (project) => ranOf(project).map((e) => e.step);
const statusOf = (project) => run(project, ["status", project.id]).json;

test("RETHINK runs frame-rethink once, then plan-revise", () => {
  const project = reviewed("RETHINK", "2 critical, 0 warnings", BASE);
  put(project, "frame.md", FRAME, new Date(1000));
  const res = start(project, "thorough");
  assert.equal(res.status, 0, res.stdout + res.stderr);
  assert.equal(res.json.action, "run");
  assert.equal(res.json.step, "frame");
  assert.equal(res.json.model, "opus");
  assert.equal(res.json.effort, "high");
  assert.match(res.json.prompt, /returned RETHINK/);
  const frame = lastRan(project);
  assert.equal(frame.template, "frame-rethink");
  assert.equal(frame.verdict, "RETHINK");
  assert.equal(frame.tier, 4);
  assert.doesNotMatch(frame.tierWhy, /from results/, "the frame step takes no bump");
  assert.equal(ranOf(project).filter((e) => e.template === "plan-revise").length, 0, "the frame step consumes no revision");

  put(project, "frame.md", FRAME);
  const second = finish(project);
  assert.equal(second.json.action, "run");
  assert.equal(second.json.step, "plan");
  assert.match(second.json.reason, /\+2 from results/);
  assert.match(second.json.prompt, /frame\.md/);
  assert.equal(lastRan(project).template, "plan-revise");
  assert.equal(lastRan(project).verdict, "RETHINK");
  assert.deepEqual(stepsOf(project), ["plan", "plan-review", "frame", "plan"], "plan review does not run between the frame round and the re-plan");
  const frames = statusOf(project).steps.filter((s) => s.step === "frame");
  assert.equal(frames.length, 1);
  assert.deepEqual([frames[0].model, frames[0].effort], ["opus", "high"]);
});

test("second RETHINK after frame and re-plan halts", () => {
  const log = [...BASE, frameRound(3), replan(4, "RETHINK"), entry(5, "plan-review")];
  const project = reviewed("RETHINK", "2 critical, 0 warnings", log);
  const res = start(project, "thorough");
  assert.equal(res.json.action, "halt");
  assert.equal(res.json.reason, "Plan review said RETHINK again after frame and re-plan. Needs a human.");
  assert.equal(ranOf(project).length, log.length);
});

test("RETHINK below minRigor behaves as on main", () => {
  for (const [rigor, goal] of [["standard", GOAL], ["lean", "fix typo"]]) {
    const project = reviewed("RETHINK", "2 critical, 0 warnings", BASE);
    const res = start(project, rigor, goal);
    assert.equal(res.json.action, "run", rigor);
    assert.equal(res.json.step, "plan", rigor);
    assert.match(res.json.reason, /plan review RETHINK \(2 critical, 0 warnings\)/, rigor);
    assert.match(res.json.reason, /\+2 from results/, rigor);
    assert.match(res.json.prompt, /verdict: RETHINK/, rigor);
    assert.equal(lastRan(project).template, "plan-revise", rigor);
    assert.equal(ranOf(project).some((e) => e.template === "frame-rethink"), false, rigor);
    if (rigor === "standard") assert.equal(lastRan(project).tier, 6);
  }
  const open = reviewed("RETHINK", "2 critical, 0 warnings", BASE);
  assert.equal(start(open, "thorough").json.step, "frame");
});

test("1-phase standard plan RETHINK takes today path (below minRigor)", () => {
  const project = reviewed("RETHINK", "2 critical, 0 warnings", BASE);
  const res = init(project, GOAL);
  assert.equal(res.json.action, "run");
  assert.equal(res.json.step, "plan");
  assert.equal(lastRan(project).template, "plan-revise");
  assert.equal(readMetaFile(project).rigor.level, "standard");
  assert.equal(ranOf(project).some((e) => e.template === "frame-rethink"), false);
});

test("standard run that rises to thorough mid-run opens the loops", () => {
  // No --rigor thorough: the 6-phase plan raises the level before decide() reads it.
  const project = reviewed("RETHINK", "2 critical, 0 warnings", BASE, { plan: planText({ phases: 6 }) });
  const res = init(project, GOAL);
  assert.equal(res.json.action, "run");
  assert.equal(res.json.step, "frame");
  assert.equal(lastRan(project).template, "frame-rethink");
  const rigor = readMetaFile(project).rigor;
  assert.equal(rigor.level, "thorough");
  assert.equal(rigor.requested, undefined, "thorough was never requested");
  assert.match(rigor.by, /phases 6/);
});

test("REVISE below minRigor never adds research", () => {
  const log = [...BASE, replan(3, "REVISE"), entry(4, "plan-review")];
  for (const [rigor, goal] of [["standard", GOAL], ["lean", "fix typo"]]) {
    const project = reviewed("REVISE", CRITICAL, log);
    const res = start(project, rigor, goal);
    assert.equal(res.json.step, "plan", rigor);
    assert.equal(lastRan(project).template, "plan-revise", rigor);
    assert.equal(ranOf(project).some((e) => e.step === "research"), false, rigor);
  }
});

test("project override opens the loops at standard", () => {
  const override = { preplan: { loops: { minRigor: "standard" } } };
  const project = reviewed("RETHINK", "2 critical, 0 warnings", BASE, { policy: override });
  const res = start(project, "standard");
  assert.equal(res.json.step, "frame");
  assert.equal(lastRan(project).template, "frame-rethink");
  const lean = reviewed("RETHINK", "2 critical, 0 warnings", BASE, { policy: override });
  assert.equal(start(lean, "lean", "fix typo").json.step, "plan", "lean stays below the lowered gate");
});

test("RETHINK with the loop disabled behaves as before", () => {
  for (const value of [0, -1, 1.5, "1", null]) {
    const project = reviewed("RETHINK", "2 critical, 0 warnings", BASE, { policy: { preplan: { loops: { rethinkToFrame: value } } } });
    const res = start(project, "thorough");
    assert.equal(res.json.step, "plan", String(value));
    assert.equal(lastRan(project).template, "plan-revise", String(value));
    assert.match(res.json.reason, /\+2 from results/, String(value));
  }
});

test("failed frame-rethink is retried and halts after three", () => {
  const project = reviewed("RETHINK", "2 critical, 0 warnings", BASE);
  assert.equal(start(project, "thorough").json.step, "frame");
  for (const note of ["one", "two"]) {
    const res = finish(project, { status: "failed", note });
    assert.equal(res.json.step, "frame", note);
    assert.equal(res.json.model, "opus", note);
    assert.equal(res.json.effort, "high", note);
    assert.equal(lastRan(project).template, "frame-rethink", note);
  }
  assert.match(lastRan(project).tierWhy, /\+2 for 2 failed attempt\(s\)/);
  const halted = finish(project, { status: "failed", note: "three" });
  assert.equal(halted.json.action, "halt");
  assert.match(halted.json.reason, /frame failed 3 times in a row/);
  assert.equal(ranOf(project).filter((e) => e.template === "frame-rethink").length, 3);
});

test("failed plan-revise after frame-rethink is retried at the next tier", () => {
  const log = [...BASE, frameRound(3), replan(4, "RETHINK", FAILED)];
  const project = reviewed("RETHINK", "2 critical, 0 warnings", log);
  const res = start(project, "thorough");
  assert.equal(res.json.action, "run", "a failed re-plan is not a halt");
  assert.equal(res.json.step, "plan");
  assert.match(res.json.reason, /\+1 for 1 failed attempt\(s\)/);
  assert.equal(lastRan(project).template, "plan-revise");
  assert.equal(ranOf(project).filter((e) => e.template === "frame-rethink").length, 1, "no second frame round");

  // The retry succeeds, plan review runs, and a RETHINK again halts: a good re-plan followed the frame round.
  put(project, "plan.md", planText());
  assert.equal(finish(project).json.step, "plan-review");
  review(project, "plan-review", "RETHINK", "2 critical, 0 warnings");
  const halted = finish(project);
  assert.equal(halted.json.action, "halt");
  assert.match(halted.json.reason, /RETHINK again after frame and re-plan/);
});

test("second failed plan-revise after frame-rethink halts at maxPlanRevisions", () => {
  const log = [...BASE, frameRound(3), replan(4, "RETHINK", FAILED), replan(5, "RETHINK", FAILED)];
  const project = reviewed("RETHINK", "2 critical, 0 warnings", log);
  const res = start(project, "thorough");
  assert.equal(res.json.action, "halt");
  assert.match(res.json.reason, /Plan still RETHINK after 2 revisions/);
  assert.equal(ranOf(project).length, log.length);
});

test("frame-rethink needsHuman halts", () => {
  const project = reviewed("RETHINK", "2 critical, 0 warnings", BASE);
  assert.equal(start(project, "thorough").json.step, "frame");
  const res = finish(project, { status: "blocked", note: "nothing to frame", signals: { needsHuman: "the review gives no observation to test" } });
  assert.equal(res.json.action, "halt");
  assert.match(res.json.reason, /needs a human: the review gives no observation to test/);
  assert.equal(stepsOf(project).pop(), "frame");
  assert.equal(ranOf(project).some((e) => e.template === "plan-revise"), false);
});

test("first REVISE re-plans without research", () => {
  const project = reviewed("REVISE", CRITICAL, BASE);
  const res = start(project, "thorough");
  assert.equal(res.json.step, "plan");
  assert.match(res.json.reason, /\+1 from results/);
  assert.equal(lastRan(project).template, "plan-revise");
  assert.equal(lastRan(project).verdict, "REVISE");
  assert.equal(ranOf(project).some((e) => e.step === "research"), false);
});

test("second REVISE adds research-revise before the second plan-revise", () => {
  const log = [...BASE, replan(3, "REVISE"), entry(4, "plan-review")];
  const project = reviewed("REVISE", CRITICAL, log);
  const res = start(project, "thorough");
  assert.equal(res.json.action, "run");
  assert.equal(res.json.step, "research");
  assert.match(res.json.prompt, /follow-up/);
  assert.equal(lastRan(project).template, "research-revise");
  assert.equal(lastRan(project).verdict, "REVISE");
  assert.equal(lastRan(project).tier, 3);
  assert.doesNotMatch(lastRan(project).tierWhy, /from results/);

  put(project, "research.md", RESEARCH);
  const second = finish(project);
  assert.equal(second.json.step, "plan");
  assert.match(second.json.reason, /\+1 from results/);
  assert.equal(lastRan(project).template, "plan-revise");
  assert.deepEqual(stepsOf(project), ["plan", "plan-review", "plan", "plan-review", "research", "plan"], "plan review does not run between the research round and the re-plan");
});

test("an old log without verdict on its plan-revise entries never gets a research-revise", () => {
  // Migration: entries written before the verdict key existed read as no earlier REVISE round.
  const old = replan(3, "REVISE");
  delete old.verdict;
  assert.equal("verdict" in old, false);
  const log = [...BASE, old, entry(4, "plan-review")];
  const project = reviewed("REVISE", CRITICAL, log);
  const res = start(project, "thorough");
  assert.equal(res.json.action, "run");
  assert.equal(res.json.step, "plan");
  assert.equal(lastRan(project).template, "plan-revise");
  assert.equal(lastRan(project).verdict, "REVISE", "the new entry stores the verdict");
  assert.equal(ranOf(project).some((e) => e.step === "research"), false);
});

test("a RETHINK re-plan does not count as the first REVISE", () => {
  const log = [...BASE, frameRound(3), replan(4, "RETHINK"), entry(5, "plan-review")];
  const project = reviewed("REVISE", CRITICAL, log);
  const res = start(project, "thorough");
  assert.equal(res.json.step, "plan");
  assert.equal(lastRan(project).template, "plan-revise");
  assert.equal(ranOf(project).some((e) => e.step === "research"), false);
});

test("third REVISE round halts at maxPlanRevisions", () => {
  const log = [...BASE, replan(3, "REVISE"), entry(4, "plan-review"), researchRound(5), replan(6, "REVISE"), entry(7, "plan-review")];
  const project = reviewed("REVISE", CRITICAL, log);
  const res = start(project, "thorough");
  assert.equal(res.json.action, "halt");
  assert.match(res.json.reason, /Plan still REVISE after 2 revisions/);
  assert.equal(ranOf(project).length, log.length);
});

test("REVISE loop disabled by override", () => {
  const log = [...BASE, replan(3, "REVISE"), entry(4, "plan-review")];
  const keys = [["reviseResearchAfter", 0], ["reviseResearchAfter", "1"], ["reviseResearchMax", 0], ["reviseResearchMax", null]];
  for (const [key, value] of keys) {
    const project = reviewed("REVISE", CRITICAL, log, { policy: { preplan: { loops: { [key]: value } } } });
    const res = start(project, "thorough");
    assert.equal(res.json.step, "plan", `${key}=${value}`);
    assert.equal(lastRan(project).template, "plan-revise", `${key}=${value}`);
    assert.equal(ranOf(project).some((e) => e.step === "research"), false, `${key}=${value}`);
  }
});

test("research-revise verification: a stale research.md fails the step and the round is retried", () => {
  const log = [...BASE, replan(3, "REVISE"), entry(4, "plan-review")];
  const project = reviewed("REVISE", CRITICAL, log);
  put(project, "research.md", RESEARCH, new Date(1000));
  assert.equal(start(project, "thorough").json.step, "research");

  const stale = finish(project);
  const failed = ranOf(project).find((e) => e.template === "research-revise");
  assert.equal(failed.ok, false);
  assert.equal(failed.verified, false);
  assert.equal(stale.json.step, "research", "a failed round is retried, not skipped");
  assert.match(stale.json.reason, /\+1 for 1 failed attempt\(s\)/);

  put(project, "research.md", RESEARCH);
  const fresh = finish(project);
  assert.equal(ranOf(project).filter((e) => e.template === "research-revise").map((e) => e.ok).join(), "false,true");
  assert.equal(fresh.json.step, "plan");
  assert.equal(lastRan(project).template, "plan-revise");
});

test("research-revise verification: a fresh research.md that lost its status frontmatter fails the step", () => {
  // A real follow-up appends to research.md. If it rewrites the file and drops the frontmatter, the round is not verified.
  const log = [...BASE, replan(3, "REVISE"), entry(4, "plan-review")];
  const project = reviewed("REVISE", CRITICAL, log);
  put(project, "research.md", RESEARCH, new Date(1000));
  assert.equal(start(project, "thorough").json.step, "research");

  put(project, "research.md", "# Research\n\nNew findings, no frontmatter.\n");
  const dropped = finish(project);
  const failed = ranOf(project).find((e) => e.template === "research-revise");
  assert.equal(failed.ok, false);
  assert.equal(failed.verified, false);
  assert.equal(dropped.json.step, "research", "a failed round is retried");

  // Appended findings with the status kept, and a later last_updated, pass.
  put(project, "research.md", "---\nstatus: partial\nlast_updated: 2026-10-31\n---\n# Research\n\nFirst.\n\n## Follow-up\n\nSecond.\n");
  const kept = finish(project);
  assert.equal(ranOf(project).filter((e) => e.template === "research-revise").map((e) => e.ok).join(), "false,true");
  assert.equal(kept.json.step, "plan");
});

test("frame-rethink without a frame.md writes a new brief and is verified like any frame", () => {
  // The frame step was skipped before the plan, so no frame.md exists when the RETHINK comes.
  const project = reviewed("RETHINK", "2 critical, 0 warnings", BASE);
  assert.equal(fs.existsSync(path.join(project.changeDir, "frame.md")), false);
  const res = start(project, "thorough");
  assert.equal(res.json.step, "frame");
  assert.equal(lastRan(project).template, "frame-rethink");
  assert.match(res.json.prompt, /When that file does not exist, write it there as a new brief\./);
  assert.doesNotMatch(res.json.prompt, /frame\.md is listed under the upstream artifacts/, "the authority line belongs to the re-plan prompt");

  // The subagent reports done but wrote nothing: not verified, retried at the same tier.
  const none = finish(project);
  assert.equal(ranOf(project).find((e) => e.template === "frame-rethink").verified, false);
  assert.equal(ranOf(project).find((e) => e.template === "frame-rethink").ok, false);
  assert.equal(none.json.step, "frame");
  assert.equal(lastRan(project).tier, 4);

  // A brief without the Reframed heading fails too.
  put(project, "frame.md", "# Frame Brief: demo\n\nNo reframed heading.\n");
  assert.equal(finish(project).json.step, "frame");

  // A real brief passes, and the re-plan prompt now lists it and carries the authority line.
  put(project, "frame.md", FRAME);
  const replanned = finish(project);
  assert.equal(replanned.json.step, "plan");
  assert.equal(lastRan(project).template, "plan-revise");
  assert.match(replanned.json.prompt, /Upstream artifacts \(read each fully before planning\): context\/changes\/demo\/frame\.md/);
  assert.match(replanned.json.prompt, /treat its reframed problem statement as authoritative/);
  assert.deepEqual(ranOf(project).filter((e) => e.template === "frame-rethink").map((e) => e.ok), [false, false, true]);
});

// ---- reference paths: the budget -------------------------------------------------------

const ROWS = 2;
const reviewScript = (...pairs) => pairs.map(([verdict, findings]) => ({ verdict, findings }));

// Answers one run action with the files the real skill would leave, then reports done through the router.
function answer(project, json, script) {
  const template = lastRan(project).template;
  switch (json.step) {
    case "research": put(project, "research.md", RESEARCH); break;
    case "domain-brief": put(project, template === "domain-aggregate" ? "refactor-invariant-aggregate.md" : "refactor-anti-corruption-layer.md", BRIEF); break;
    case "frame": put(project, "frame.md", FRAME); break;
    case "plan": put(project, "plan.md", planText({ rowsPerPhase: ROWS })); break;
    case "plan-review": { const r = script.planReviews.shift(); review(project, "plan-review", r.verdict, r.findings); break; }
    case "implement": put(project, "plan.md", planText({ rowsPerPhase: ROWS, done: ROWS })); break;
    case "impl-review": { const r = script.implReviews.shift(); review(project, "impl-review", r.verdict, r.findings); break; }
    case "fix": break; // trusted on status; the next impl-review checks the code
    default: assert.fail(`unexpected step ${json.step}`);
  }
  return finish(project);
}

// A failure-free walk of the whole run. Returns the last answer; the log holds the path.
function walk(project, first, script) {
  let res = first;
  for (let i = 0; res.json.action === "run"; i++) {
    assert.ok(i < 40, "the walk ends");
    res = answer(project, res.json, script);
  }
  return res;
}

const sequence = (project) => ranOf(project).map((e) => (e.template === e.step ? e.step : e.template));
const budgetOf = (level) => policy.limits.maxTotalSteps + policy.rigor.budgetDelta[level];

const IMPL = reviewScript(["NEEDS ATTENTION", "0 critical, 1 warnings"], ["REJECTED", CRITICAL], ["APPROVED", "0 critical, 0 warnings"]);
const SOUND = ["SOUND", "0 critical, 0 warnings"];
const THOROUGH_GOAL = "Replace the vendor SDK wrapper because the checkout leaks";

function assertFits(project, level, steps) {
  const ran = ranOf(project);
  assert.equal(ran.length, steps);
  assert.ok(ran.length <= budgetOf(level) - 2, `${ran.length} steps fit a budget of ${budgetOf(level)} with one step to spare`);
  assert.equal(statusOf(project).rigor, level);
  assert.equal(ran.every((e) => e.ok), true, "every step was ok");
}

test("reference path at standard", () => {
  const project = makeProject();
  const script = { planReviews: reviewScript(["REVISE", CRITICAL], ["REVISE", CRITICAL], SOUND), implReviews: [...IMPL] };
  const res = walk(project, start(project, "standard"), script);
  assert.equal(res.json.action, "done", res.stdout);
  assert.deepEqual(sequence(project), [
    "plan", "plan-review", "plan-revise", "plan-review", "plan-revise", "plan-review",
    "implement", "impl-review", "fix", "impl-review", "fix", "impl-review",
  ]);
  assertFits(project, "standard", 12);
  assert.equal(readLogEntries(project).some((e) => e.skipped), false, "no skip entry");
  assert.equal(stepsOf(project).some((s) => s === "frame" || s === "research"), false);
});

test("reference path at thorough with RETHINK", () => {
  const project = makeProject();
  const script = { planReviews: reviewScript(["RETHINK", "2 critical, 0 warnings"], ["REVISE", CRITICAL], SOUND), implReviews: [...IMPL] };
  const res = walk(project, start(project, "thorough", THOROUGH_GOAL), script);
  assert.equal(res.json.action, "done", res.stdout);
  assert.deepEqual(sequence(project), [
    "research", "domain-acl", "frame", "plan", "plan-review", "frame-rethink", "plan-revise", "plan-review", "plan-revise", "plan-review",
    "implement", "impl-review", "fix", "impl-review", "fix", "impl-review",
  ]);
  assertFits(project, "thorough", 16);
  const frames = statusOf(project).steps.filter((s) => s.step === "frame");
  assert.equal(frames.length, 2, "frame and frame-rethink");
  for (const s of frames) assert.deepEqual([s.model, s.effort], ["opus", "high"]);
});

test("reference path at thorough with research-revise", () => {
  const project = makeProject();
  const script = { planReviews: reviewScript(["REVISE", CRITICAL], ["REVISE", CRITICAL], SOUND), implReviews: [...IMPL] };
  const res = walk(project, start(project, "thorough", THOROUGH_GOAL), script);
  assert.equal(res.json.action, "done", res.stdout);
  assert.deepEqual(sequence(project), [
    "research", "domain-acl", "frame", "plan", "plan-review", "plan-revise", "plan-review", "research-revise", "plan-revise", "plan-review",
    "implement", "impl-review", "fix", "impl-review", "fix", "impl-review",
  ]);
  assertFits(project, "thorough", 16);
  const frames = statusOf(project).steps.filter((s) => s.step === "frame");
  assert.equal(frames.length, 1);
  assert.deepEqual([frames[0].model, frames[0].effort], ["opus", "high"]);
});

test("lean runs no pre-plan step and opens no loop", () => {
  const levels = policy.rigor.levels;
  const lean = levels.indexOf("lean");
  assert.equal(lean, 0);
  for (const [step, gate] of Object.entries(policy.preplan.gates)) {
    assert.ok(levels.indexOf(gate.minRigor) > lean, `${step} gate is above lean`);
  }
  assert.ok(levels.indexOf(policy.preplan.loops.minRigor) > lean, "loops gate is above lean");

  const project = makeProject();
  const res = start(project, "lean", "fix typo");
  assert.equal(res.json.step, "plan");
  assert.equal(readLogEntries(project).some((e) => e.skipped), false, "a closed gate writes no skip entry");
  assert.equal(stepsOf(project).some((s) => s === "frame" || s === "research" || s === "domain-brief"), false);
});
