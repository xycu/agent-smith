// review-open-findings, phase 3: the confirmation round at the shipped policy and the shipped budgetDelta.
// Test titles are string literals: the gate rows of the plan check them.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { cleanupAll } from "./helpers.mjs";
import {
  policy, noGit, TABLE, FIXTURES, budgetOf, ranOf, confirmScript, confirmOverride, confirmCount, walkAware,
} from "./budget-helpers.mjs";

after(cleanupAll);

test("confirm rounds ship off and the aware saturating shape keeps the longest legal path", { skip: noGit }, () => {
  assert.deepEqual(policy.review.confirmRounds, { lean: 0, standard: 0, thorough: 0 });
  for (const level of ["standard", "thorough"]) {
    let max = 0;
    for (const name of Object.keys(FIXTURES)) {
      const w = walkAware(name, level, { script: confirmScript(level, 0) });
      assert.equal(w.res.json.action, "done", `${name} at ${level}: ${w.res.stdout}\n${w.sequence.join(" ")}`);
      assert.equal(confirmCount(w, "plan-review-confirm") + confirmCount(w, "impl-review-confirm"), 0, `${name}: no confirmation with the shipped policy\n${w.sequence.join(" ")}`);
      assert.equal(ranOf(w.project).every((e) => e.ok), true, `${name}: every step was ok`);
      max = Math.max(max, w.steps);
    }
    // The aware reviews end the loops the way SOUND and APPROVED did, so the longest path is today's.
    assert.equal(max, TABLE[level], `${level}: the shipped path is unchanged`);
  }
});

test("a confirm round with the shipped budgetDelta passes the point that leaves a failed step and its retry to spare", { skip: noGit }, () => {
  for (const level of ["standard", "thorough"]) {
    const spare = policy.limits.maxTotalSteps + policy.rigor.budgetDelta[level] - 2;
    let max = 0;
    for (const name of Object.keys(FIXTURES)) {
      const w = walkAware(name, level, { override: confirmOverride(level, 1, { raise: false }), script: confirmScript(level, 1) });
      // The walk ends in done at the budget, or in the budget halt; it never runs past the budget.
      assert.ok(w.res.json.action === "done" || /Step budget \d+ spent/.test(w.res.json.reason ?? ""), `${name} at ${level}: ${w.res.stdout}\n${w.sequence.join(" ")}`);
      assert.ok(w.steps <= budgetOf(level), `${name}: ${w.steps} steps stay inside the budget`);
      max = Math.max(max, w.steps);
    }
    assert.ok(max > spare, `${level}: ${max} steps pass the ${spare} the shipped delta leaves room for`);
  }
});
