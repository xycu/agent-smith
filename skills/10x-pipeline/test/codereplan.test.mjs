// phase-executors, phase 4: the code re-plan after repeated implement failures or a first REJECTED review.
// Black-box through the CLI in scratch projects. Test titles are string literals: the gate rows of the plan check them.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  cleanupAll, makeProject, writePlan, writeReview, init, next, writeResult, readLogEntries, writeMetaFile, entry, writeLog,
} from "./helpers.mjs";
import { buildPlan, pendingEntry } from "./phase-helpers.mjs";

after(cleanupAll);

const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const POLICY = JSON.parse(fs.readFileSync(path.join(SKILL_DIR, "policy.json"), "utf8"));
const GOAL = "Parse blank lines";

// Rows 1.1 (ticked) and 1.2 (pending) in one phase.
const OPEN_PLAN = () => buildPlan([{ auto: [{ text: "row one", done: true }, "row two"] }]);
// Rows 1.1 and 1.2, both ticked.
const DONE_PLAN = () => buildPlan([{ auto: [{ text: "row one", done: true }, { text: "row two", done: true }] }]);

const failed = (n, note = "boom", over = {}) => entry(n, "implement", { ok: false, verified: false, result: { status: "failed", note }, ...over });
const REPLAN = (n, over = {}) => entry(n, "plan", { template: "plan-replan", ...over });
const REJECTED_REPLAN = (n, over = {}) => entry(n, "plan", { template: "plan-rejected", verdict: "REJECTED", ...over });

// A project with a fresh SOUND plan review and `log`. `plan` defaults to one ticked and one pending row.
function project({ plan = OPEN_PLAN(), log, policy = null, review = null }) {
  const p = makeProject({ plan, policy });
  writeReview(p, "plan-review", { verdict: "SOUND" });
  if (review) writeReview(p, "impl-review", review);
  writeLog(p, log);
  return p;
}

const base = [entry(1, "plan"), entry(2, "plan-review")];
const lastEntry = (p) => readLogEntries(p).at(-1);
const start = (p, rigor = "standard") => init(p, GOAL, ["--rigor", rigor]);
const REJECTED = { verdict: "REJECTED", findings: "1 critical, 0 warnings" };
// implement ok, then a REJECTED review of it; the plan has no pending row.
const reviewed = [...base, entry(3, "implement"), entry(4, "impl-review")];

// A pending code re-plan entry that recorded the ticked rows `done`, plus the plan the subagent saved.
function pendingReplan(template, { done, saved, log = null }) {
  const p = makeProject({ plan: saved });
  writeReview(p, "plan-review", { verdict: "SOUND" });
  writeMetaFile(p, { id: p.id, goal: GOAL });
  const pend = pendingEntry(5, "plan", { template, before: { autoDone: done.length, head: null, done } });
  writeLog(p, log ?? [...base, failed(3), failed(4), pend]);
  return p;
}

function finish(p, result = { status: "done", note: "x" }) {
  writeResult(p, result);
  const res = next(p);
  return { res, e: readLogEntries(p)[4] };
}

test("two failures replan", () => {
  const p = project({ log: [...base, failed(3, "first broke"), failed(4, "second broke")] });
  const res = start(p).json;
  assert.equal(res.step, "plan");
  assert.equal(lastEntry(p).template, "plan-replan");
  assert.equal(lastEntry(p).tier, POLICY.steps.plan.baseTier + POLICY.codeReplan.failureBump);
  // The prompt carries the note of the last failed attempt, not the earlier one.
  assert.match(res.prompt, /^Run \/10x-plan demo\n/);
  assert.match(res.prompt, /Last failure note: second broke/);
  assert.doesNotMatch(res.prompt, /first broke/);
  // One failure is not enough, three trailing failures halt as before.
  const one = project({ log: [...base, failed(3)] });
  assert.equal(start(one).json.step, "implement");
  const three = project({ log: [...base, failed(3), failed(4), failed(5)] });
  const halted = start(three).json;
  assert.equal(halted.action, "halt");
  assert.match(halted.reason, /implement failed 3 times in a row/);
  // The rigor gate: a policy that asks for thorough keeps standard on the plain path.
  const gated = project({ log: [...base, failed(3), failed(4)], policy: { codeReplan: { minRigor: "thorough" } } });
  assert.equal(start(gated).json.step, "implement");
});

test("cap used keeps third attempt", () => {
  // A used re-plan (either kind) takes the cap: two more failures run another attempt and the third halts, as today.
  for (const used of [REPLAN(5), REJECTED_REPLAN(5)]) {
    const p = project({ log: [...base, failed(3), failed(4), used, entry(6, "plan-review"), failed(7), failed(8)] });
    const res = start(p).json;
    assert.equal(res.step, "implement", used.template);
    assert.equal(lastEntry(p).template, "implement", used.template);
    const q = project({ log: [...base, failed(3), failed(4), used, entry(6, "plan-review"), failed(7), failed(8), failed(9)] });
    const halted = start(q).json;
    assert.equal(halted.action, "halt", used.template);
    assert.match(halted.reason, /implement failed 3 times in a row/);
  }
});

test("replan verification", () => {
  const verdict = (saved) => {
    const p = pendingReplan("plan-replan", { done: ["1.1"], saved });
    return finish(p).e;
  };
  // A ticked row unticked.
  const unticked = verdict(buildPlan([{ auto: ["row one", "row two"] }]));
  assert.equal(unticked.verified, false);
  assert.equal(unticked.ok, false);
  // A ticked row dropped: the first row is gone and a new pending row takes its index.
  const dropped = verdict(buildPlan([{ auto: [{ text: "other", done: false }, "row two"] }]));
  assert.equal(dropped.ok, false);
  // No pending Automated row left.
  const nothing = verdict(DONE_PLAN());
  assert.equal(nothing.verified, false);
  // A pending row added, every ticked row kept.
  const fine = verdict(buildPlan([{ auto: [{ text: "row one", done: true }, "row two", "row three"] }]));
  assert.equal(fine.verified, true);
  assert.equal(fine.ok, true);
  assert.deepEqual(fine.before.done, ["1.1"]);
});

test("failed replan halts", () => {
  // The re-plan did not produce a valid plan: no pending row left. The run stops for a human.
  const p = pendingReplan("plan-replan", { done: ["1.1"], saved: DONE_PLAN() });
  const { res, e } = finish(p);
  assert.equal(e.ok, false);
  assert.equal(res.json.action, "halt");
  assert.match(res.json.reason, /re-plan after 2 failed implement attempts/);
  assert.match(res.json.reason, /Needs a human/);
  // The subagent itself reports failed: same halt.
  const q = pendingReplan("plan-replan", { done: ["1.1"], saved: OPEN_PLAN() });
  const again = finish(q, { status: "failed", note: "could not" });
  assert.equal(again.res.json.action, "halt");
  assert.match(again.res.json.reason, /Needs a human/);
});

test("replan then review then implement", () => {
  const saved = buildPlan([{ auto: [{ text: "row one", done: true }, "row two", "row three"] }]);
  const p = pendingReplan("plan-replan", { done: ["1.1"], saved });
  const { res, e } = finish(p);
  assert.equal(e.ok, true);
  // The plan changed, so plan review runs again.
  assert.equal(res.json.step, "plan-review");
  writeReview(p, "plan-review", { verdict: "SOUND" });
  writeResult(p, { status: "done", note: "reviewed" });
  const after = next(p).json;
  assert.equal(after.step, "implement");
  const attempt = lastEntry(p);
  assert.equal(attempt.template, "implement");
  // The streak of failed attempts is gone: no failure escalation in the tier.
  assert.doesNotMatch(attempt.tierWhy, /failed attempt/);
});

test("rejected replan once", () => {
  const p = project({ plan: DONE_PLAN(), log: reviewed, review: REJECTED });
  const res = start(p).json;
  assert.equal(res.step, "plan");
  const first = lastEntry(p);
  assert.equal(first.template, "plan-rejected");
  assert.equal(first.verdict, "REJECTED");
  assert.equal(first.tier, POLICY.steps.plan.baseTier + POLICY.codeReplan.rejectedBump);
  assert.match(res.prompt, /^Run \/10x-plan demo\nThe implementation review returned REJECTED/);
  // The second REJECTED, after the re-plan ran, goes to fix.
  const log = [...reviewed, REJECTED_REPLAN(5), entry(6, "plan-review"), entry(7, "implement"), entry(8, "impl-review")];
  const second = project({ plan: DONE_PLAN(), log, review: REJECTED });
  assert.equal(start(second).json.step, "fix");
  assert.equal(lastEntry(second).template, "fix");
  // The cap is shared: a failure re-plan that ran takes the REJECTED trigger, and the other way round.
  const failureFirst = [...base, failed(3), failed(4), REPLAN(5), entry(6, "plan-review"), entry(7, "implement"), entry(8, "impl-review")];
  const afterFailure = project({ plan: DONE_PLAN(), log: failureFirst, review: REJECTED });
  assert.equal(start(afterFailure).json.step, "fix");
  const rejectedFirst = [...reviewed, REJECTED_REPLAN(5), entry(6, "plan-review"), failed(7), failed(8)];
  const afterRejected = project({ log: rejectedFirst });
  assert.equal(start(afterRejected).json.step, "implement");
});

test("replan disabled by policy", () => {
  const failures = [...base, failed(3), failed(4)];
  // max 0 turns off both triggers.
  const off = { codeReplan: { max: 0 } };
  assert.equal(start(project({ log: failures, policy: off })).json.step, "implement");
  const rejectedOff = project({ plan: DONE_PLAN(), log: reviewed, review: REJECTED, policy: off });
  assert.equal(start(rejectedOff).json.step, "fix");
  // afterFailures 0 turns off the failure trigger only.
  const noFailure = { codeReplan: { afterFailures: 0 } };
  assert.equal(start(project({ log: failures, policy: noFailure })).json.step, "implement");
  const rejectedOn = project({ plan: DONE_PLAN(), log: reviewed, review: REJECTED, policy: noFailure });
  assert.equal(start(rejectedOn).json.step, "plan");
  assert.equal(lastEntry(rejectedOn).template, "plan-rejected");
  // onRejected false turns off the REJECTED trigger only.
  const noRejected = { codeReplan: { onRejected: false } };
  assert.equal(start(project({ plan: DONE_PLAN(), log: reviewed, review: REJECTED, policy: noRejected })).json.step, "fix");
  assert.equal(start(project({ log: failures, policy: noRejected })).json.step, "plan");
});

test("fallback not counted for replan", () => {
  const fallback = (n) => entry(n, "implement", { template: "implement-retry", ok: false, verified: false, fallback: true, result: { status: "done", note: "no commit" } });
  // One failure plus a neutral fallback is one failure: no re-plan.
  const one = project({ log: [...base, failed(3), fallback(4)] });
  assert.notEqual(start(one).json.step, "plan");
  // The fallback neither counts nor breaks the streak: a second real failure after it makes two.
  const two = project({ log: [...base, failed(3), fallback(4), failed(5)] });
  assert.equal(start(two).json.step, "plan");
  assert.equal(lastEntry(two).template, "plan-replan");
  // Two real failures with a fallback in between do not make three: the run is not halted.
  assert.notEqual(start(project({ log: [...base, failed(3), fallback(4), failed(5)], policy: { codeReplan: { max: 0 } } })).json.action, "halt");
});

test("rejected replan gates", () => {
  const asPlan = (p) => ({ step: start(p).json.step, template: lastEntry(p).template });
  // A REJECTED after a fix keeps fix.
  const afterFix = project({ plan: DONE_PLAN(), log: [...reviewed, entry(5, "fix"), entry(6, "impl-review")], review: REJECTED });
  assert.deepEqual(asPlan(afterFix), { step: "fix", template: "fix" });
  // A re-plan leaves one fix loop: with the re-plan and one fix used, the next REJECTED halts.
  const spent = project({
    plan: DONE_PLAN(),
    log: [...reviewed, REJECTED_REPLAN(5), entry(6, "plan-review"), entry(7, "implement"), entry(8, "impl-review"), entry(9, "fix"), entry(10, "impl-review")],
    review: REJECTED,
  });
  const halted = start(spent).json;
  assert.equal(halted.action, "halt");
  assert.match(halted.reason, /after 2 fix loops/);
  // Lean has no re-plan.
  const lean = project({ plan: DONE_PLAN(), log: reviewed, review: REJECTED });
  assert.equal(start(lean, "lean").json.step, "fix");
  // The pool is spent: two segments use the allowance of standard, so there is no room for the cost of 2.
  const segments = [entry(3, "implement", { template: "implement-segment" }), entry(4, "implement", { template: "implement-segment" })];
  const drained = project({ plan: DONE_PLAN(), log: [...base, ...segments, entry(5, "impl-review")], review: REJECTED });
  assert.equal(start(drained).json.step, "fix");
  // The same pool with one segment used still has room for one: cost 2 does not fit either.
  const half = project({ plan: DONE_PLAN(), log: [...base, segments[0], entry(4, "impl-review")], review: REJECTED });
  assert.equal(start(half).json.step, "fix");
  // The pool is full at thorough: room for the cost.
  const roomy = project({ plan: DONE_PLAN(), log: [...base, segments[0], entry(4, "impl-review")], review: REJECTED });
  assert.equal(start(roomy, "thorough").json.step, "plan");
  // A NEEDS ATTENTION review never re-plans.
  const attention = project({ plan: DONE_PLAN(), log: reviewed, review: { verdict: "NEEDS ATTENTION", findings: "1 critical, 0 warnings" } });
  assert.equal(start(attention).json.step, "fix");
});

test("failure note capped", () => {
  const note = `first line\n\n  second   line ${"x".repeat(900)}`;
  const p = project({ log: [...base, failed(3, "older"), failed(4, note)] });
  const res = start(p).json;
  assert.equal(lastEntry(p).template, "plan-replan");
  const line = res.prompt.split("\n").find((l) => l.includes("Last failure note: "));
  assert.ok(line, res.prompt);
  const text = line.slice(line.indexOf("Last failure note: ") + "Last failure note: ".length);
  assert.ok(text.length <= POLICY.codeReplan.failureNoteMax, `${text.length}`);
  assert.ok(text.length > 100);
  assert.ok(text.startsWith("first line second line xxx"), text.slice(0, 40));
  // A note with no text gets a stand-in, a smaller cap in the policy wins.
  const blank = project({ log: [...base, failed(3, "a"), failed(4, "  \n ")] });
  assert.match(start(blank).json.prompt, /Last failure note: no note/);
  const small = project({ log: [...base, failed(3, "a"), failed(4, "y".repeat(80))], policy: { codeReplan: { failureNoteMax: 20 } } });
  assert.match(start(small).json.prompt, new RegExp(`Last failure note: y{20}(\\n|$)`));
});

test("rejected replan verification", () => {
  const verdict = (saved) => {
    const p = pendingReplan("plan-rejected", { done: ["1.1", "1.2"], saved, log: [...reviewed, pendingEntry(5, "plan", { template: "plan-rejected", verdict: "REJECTED", before: { autoDone: 2, head: null, done: ["1.1", "1.2"] } })] });
    writeReview(p, "impl-review", REJECTED);
    return finish(p).e;
  };
  // The entry records the ticked rows it started with.
  const kept = verdict(buildPlan([{ auto: [{ text: "row one", done: true }, { text: "row two", done: true }, "row three"] }]));
  assert.equal(kept.verified, true);
  assert.equal(kept.ok, true);
  assert.deepEqual(kept.before.done, ["1.1", "1.2"]);
  // A ticked row unticked to make pending work: not verified.
  const unticked = verdict(buildPlan([{ auto: [{ text: "row one", done: true }, "row two"] }]));
  assert.equal(unticked.verified, false);
  assert.equal(unticked.ok, false);
  // A ticked row dropped and a new pending row added: not verified.
  const dropped = verdict(buildPlan([{ auto: [{ text: "row one", done: true }, { text: "row three", done: false }] }]));
  assert.equal(dropped.ok, false);
  // No pending Automated row at all: not verified.
  assert.equal(verdict(DONE_PLAN()).ok, false);
  // The router writes the record itself: a fresh plan-rejected entry carries before.done.
  const fresh = project({ plan: DONE_PLAN(), log: reviewed, review: REJECTED });
  start(fresh);
  assert.deepEqual(lastEntry(fresh).before.done, ["1.1", "1.2"]);
});
