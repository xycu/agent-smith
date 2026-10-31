// Loop rules of the pre-plan-steps change. Black-box through the CLI.
// The characterization of today's behaviour lives in loops-existing.test.mjs and is never edited.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import {
  cleanupAll, makeProject, planText, writeReview, init, writeLog, entry, readLogEntries,
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
