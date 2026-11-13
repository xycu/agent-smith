// review-open-findings, phase 3: each confirmation round adds a plan-review and an impl-review step, with a raised budgetDelta.
// Test titles are string literals: the gate rows of the plan check them.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { cleanupAll } from "./helpers.mjs";
import {
  policy, noGit, TABLE, FIXTURES, budgetOf, ranOf, statusOf, confirmScript, confirmOverride, confirmCount, walkAware,
} from "./budget-helpers.mjs";

after(cleanupAll);

test("each confirm round adds one plan-review and one impl-review step, which a budgetDelta raised by 2 per round holds", { skip: noGit }, () => {
  for (const [level, rounds, names] of [
    ["standard", 1, Object.keys(FIXTURES)],
    ["thorough", 1, Object.keys(FIXTURES)],
    ["standard", 2, ["F-full-pending"]],
    ["thorough", 2, ["F-full-pending"]],
  ]) {
    let max = 0;
    for (const name of names) {
      const off = walkAware(name, level, { script: confirmScript(level, 0) });
      const on = walkAware(name, level, { override: confirmOverride(level, rounds), script: confirmScript(level, rounds) });
      const label = `${name} at ${level}, ${rounds} round(s)\n${on.sequence.join(" ")}`;
      assert.equal(on.res.json.action, "done", `${label}\n${on.res.stdout}`);
      assert.equal(confirmCount(on, "plan-review-confirm"), rounds, label);
      assert.equal(confirmCount(on, "impl-review-confirm"), rounds, label);
      assert.equal(on.steps, off.steps + 2 * rounds, label);
      assert.equal(ranOf(on.project).every((e) => e.ok), true, label);
      assert.equal(statusOf(on.project).rigor, level, label);
      max = Math.max(max, on.steps);
    }
    const budget = budgetOf(level, { ...policy, rigor: { ...policy.rigor, budgetDelta: confirmOverride(level, rounds).rigor.budgetDelta } });
    assert.equal(max, TABLE[level] + 2 * rounds, `${level} x${rounds}: the longest path grows by two steps per round`);
    // The raised delta keeps one failed step and its retry to spare, as the shipped one does with the round off.
    assert.ok(max <= budget - 2, `${level} x${rounds}: ${max} steps fit a budget of ${budget} with two to spare`);
  }
});
