// phase-executors, phase 6: the step budget from the longest legal path of each level.
// The real router walks saturating fixtures; the test derives the longest path from the policy at hand.
// Test titles are string literals: the gate rows of the plan check them.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { cleanupAll } from "./helpers.mjs";
import {
  policy, noGit, CRITICAL, CLEAN, SOUND, TABLE, FIXTURES, pairs, budgetOf, ranOf, statusOf, longScript, walkFixture, longest,
} from "./budget-helpers.mjs";

after(cleanupAll);

test("longest legal path", { skip: noGit }, () => {
  for (const level of ["standard", "thorough"]) {
    const { max, per } = longest(level);
    const detail = Object.entries(per).map(([name, w]) => `${name} ${w.steps}: ${w.sequence.join(" ")}`).join("\n");
    // The shipped delta is the smallest that leaves one failed step and its retry to spare.
    assert.equal(max, policy.limits.maxTotalSteps + policy.rigor.budgetDelta[level] - 2, `${level}\n${detail}`);
    // The table of the ADR pins the count, so a drift of either side fails.
    assert.equal(max, TABLE[level], `${level} table\n${detail}`);
    for (const [name, w] of Object.entries(per)) assert.ok(w.steps <= budgetOf(level) - 2, `${name}: ${w.steps} steps fit a budget of ${budgetOf(level)} with two to spare`);
  }
  assert.deepEqual(policy.rigor.budgetDelta, { lean: -2, standard: 5, thorough: 10 });
});

test("failure path fits", { skip: noGit }, () => {
  const fixture = { phases: ["goal"], manual: true };
  const script = { ...longScript("standard"), planReviews: pairs([SOUND, SOUND]), implReviews: pairs([["NEEDS ATTENTION", CRITICAL], ["APPROVED", CLEAN]]), implementFails: 2 };
  const w = walkFixture("failure", "standard", { fixture, script });
  assert.equal(w.res.json.action, "done", `${w.res.stdout}\n${w.sequence.join(" ")}`);
  // score (1), plan, plan-review (3), implement failed twice (5), plan-replan, plan-review (7), implement (8), manual-verify (9),
  // impl-review, fix, impl-review (12).
  assert.deepEqual(w.sequence, [
    "score", "plan", "plan-review", "implement", "implement", "plan-replan", "plan-review", "implement", "manual-verify", "impl-review", "fix", "impl-review",
  ]);
  assert.equal(w.steps, 12);
  assert.ok(w.steps <= budgetOf("standard"), `${w.steps} steps fit a budget of ${budgetOf("standard")}`);
  assert.equal(statusOf(w.project).rigor, "standard");

  // Stacked with a maxed plan loop and every fix loop the same run spends its whole budget, never more. The budget
  // has room for the manual-verify attempt and its retry, so this run adds a segment and an e2e phase and a Manual row
  // that stays pending through both attempts to reach it. Its last step is a review at the fix-loop cap, so decide's
  // own halt ends it, not the budget text (issue #87); route.test.mjs covers the budget halt of a run with a step left.
  const stacked = walkFixture("stacked", "standard", { fixture: { phases: ["goal", "e2e"], manual: "pending" }, script: { ...longScript("standard"), implementFails: 2, implReviews: pairs([["NEEDS ATTENTION", CRITICAL], ["NEEDS ATTENTION", CRITICAL], ["NEEDS ATTENTION", CRITICAL], ["APPROVED", CLEAN]]) } });
  assert.equal(stacked.res.json.action, "halt", `${stacked.res.stdout}\n${stacked.sequence.join(" ")}`);
  assert.match(stacked.res.json.reason, /Implementation still NEEDS ATTENTION after 2 fix loops/);
  assert.equal(stacked.steps, budgetOf(statusOf(stacked.project).rigor), `${stacked.sequence.join(" ")}`);
});

test("lean runs manual-verify and no pool step", () => {
  assert.equal(policy.rigor.budgetDelta.lean, -2);
  assert.equal(policy.extraSteps.allowance.lean, 0);
  const script = () => ({
    planReviews: pairs([SOUND]),
    implReviews: pairs([["REJECTED", CRITICAL], ["NEEDS ATTENTION", CRITICAL], ["APPROVED", CLEAN]]),
    implementFails: 0,
  });
  const goal = "fix typo";
  // The same walk with and without e2e rows, a valid setup and a Manual row: one the first attempt proves, and one that
  // stays pending through both attempts.
  const plain = walkFixture("plain", "lean", { fixture: FIXTURES["F-rej"], script: script(), goal, useGit: false });
  const proved = walkFixture("proved", "lean", { fixture: { phases: ["goal", "e2e"], manual: true }, script: script(), goal, useGit: false });
  const pending = walkFixture("pending", "lean", { fixture: { phases: ["goal", "e2e"], manual: "pending" }, script: script(), goal, useGit: false });
  for (const w of [plain, proved, pending]) assert.equal(w.res.json.action, "done", `${w.res.stdout}\n${w.sequence.join(" ")}`);
  // manual-verify is the only difference: one attempt, or the attempt and its retry.
  const withoutVerify = (w) => w.sequence.filter((s) => s !== "manual-verify");
  assert.deepEqual(withoutVerify(proved), plain.sequence);
  assert.deepEqual(withoutVerify(pending), plain.sequence);
  assert.equal(proved.sequence.filter((s) => s === "manual-verify").length, 1, proved.sequence.join(" "));
  assert.equal(pending.sequence.filter((s) => s === "manual-verify").length, 2, pending.sequence.join(" "));
  assert.equal(pending.steps, plain.steps + 2);
  // The pending walk is the longest lean path of this script; the shipped lean delta leaves two steps to spare.
  assert.equal(pending.steps, policy.limits.maxTotalSteps + policy.rigor.budgetDelta.lean - 2, pending.sequence.join(" "));
  assert.equal(pending.steps, TABLE.lean, pending.sequence.join(" "));
  for (const w of [plain, proved, pending]) {
    const impl = ranOf(w.project).filter((e) => e.step === "implement");
    assert.equal(impl.every((e) => e.template === "implement"), true, "no executor or segment at lean");
    assert.equal(ranOf(w.project).some((e) => e.template === "plan-rejected" || e.template === "plan-replan"), false, "no re-plan at lean");
    assert.equal(statusOf(w.project).rigor, "lean");
  }
});
