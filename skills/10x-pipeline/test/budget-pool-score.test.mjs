// phase-executors, phase 6: the step budget with a raised pool allowance and with scorer failures.
// Test titles are string literals: the gate rows of the plan check them.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { cleanupAll, readLogEntries } from "./helpers.mjs";
import {
  policy, noGit, TABLE, FIXTURES, budgetOf, ranOf, statusOf, longScript, walkFixture, longest,
} from "./budget-helpers.mjs";

after(cleanupAll);

// manual-verify left the pool, so at thorough no saturating fixture above spends a fourth pool step. This shape does:
// a segment and a tdd phase (2), then the plan-rejected re-plan (2) that a pool of 3 cannot pay for. Walked only here.
const RAISED_EXTRA = { thorough: { "F-seg-tdd-pending": { phases: ["goal", "tdd", "goal"], manual: "pending" } } };

test("raised cap exceeds budget", { skip: noGit }, () => {
  for (const level of ["standard", "thorough"]) {
    const raised = { extraSteps: { allowance: { [level]: policy.extraSteps.allowance[level] + 1 } } };
    const found = longest(level, { override: raised });
    const per = { ...found.per };
    for (const [name, fixture] of Object.entries(RAISED_EXTRA[level] ?? {})) {
      const shipped = walkFixture(name, level, { fixture });
      assert.equal(shipped.res.json.action, "done", `${name} at ${level}: ${shipped.res.stdout}\n${shipped.sequence.join(" ")}`);
      assert.ok(shipped.steps <= TABLE[level], `${name}: ${shipped.steps} steps with the shipped pool stay inside the table`);
      per[name] = walkFixture(name, level, { override: raised, fixture });
    }
    const max = Math.max(...Object.values(per).map((w) => w.steps));
    const detail = Object.entries(per).map(([name, w]) => `${name} ${w.steps}: ${w.sequence.join(" ")}`).join("\n");
    // One more pool step lengthens the longest path past the point the shipped delta leaves to spare.
    assert.ok(max > policy.limits.maxTotalSteps + policy.rigor.budgetDelta[level] - 2, `${level}: ${max}\n${detail}`);
  }
});

test("scorer failures skip", { skip: noGit }, () => {
  const attempts = Math.min(policy.score.maxAttempts, policy.escalation.maxAttemptsPerStep);
  for (const level of ["standard", "thorough"]) {
    for (const name of Object.keys(FIXTURES)) {
      const w = walkFixture(name, level, { script: { ...longScript(level), scoreFails: attempts } });
      const ran = ranOf(w.project);
      const label = `${name} at ${level}: ${w.sequence.join(" ")}`;
      assert.equal(w.res.json.action, "done", `${label}\n${w.res.stdout}`);
      // The scorer failed every attempt, then the router logged a skip and went on to plan.
      const scores = ran.filter((e) => e.step === "score");
      assert.equal(scores.length, attempts, label);
      assert.equal(scores.every((e) => e.ok === false && e.advisory === true), true, label);
      assert.ok(readLogEntries(w.project).some((e) => e.skipped && e.step === "score"), `${label}: a score skip is logged`);
      // Failed advisory entries use no budget: the counted steps leave one step to spare, the executed ones at most two over.
      const counted = ran.filter((e) => !(e.advisory && e.ok === false)).length;
      assert.ok(counted <= TABLE[level] - 1, `${label}: ${counted} counted steps`);
      assert.ok(ran.length <= TABLE[level] + 2, `${label}: ${ran.length} executed steps`);
      assert.equal(statusOf(w.project).rigor, level, `${label}: the level stays ${level}`);
    }
  }
});
