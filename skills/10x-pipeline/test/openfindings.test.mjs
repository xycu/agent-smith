// Open findings of a review (review-open-findings change). Black-box through the CLI.
// Phase 1: the parser, the policy keys and the `review` field of the log entry and of `status`; routing is unchanged.
// Later phases append their own describe blocks below.
import { describe, test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  cleanupAll, makeProject, planText, writeReview, run, next, writeLog, entry, writeResult, readLogEntries,
} from "./helpers.mjs";

after(cleanupAll);

const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const shipped = JSON.parse(fs.readFileSync(path.join(SKILL_DIR, "policy.json"), "utf8"));

// A Decision-bearing review. `blocks` are { id, severity, decision, heading }: `severity` is the text after
// "**Severity**:" (emoji and all), `decision` the text after "**Decision**:" or null for no Decision line.
// `findings` is the header count line, written as it would be before the fixes (pre-edit counts).
function reviewText({ verdict = "REVISE", findings = "0 critical, 0 warnings", blocks = [], tail = "" } = {}) {
  const parts = [`# Review\n\n- **Verdict**: ${verdict}\n- **Findings**: ${findings}\n\n## Findings\n`];
  for (const b of blocks) {
    const heading = b.heading ?? `### ${b.id} — Something`;
    const lines = [heading, "", `- **Location**: plan.md:1`];
    if (b.severity !== null) lines.push(`- **Severity**: ${b.severity}`);
    if (b.decision !== null && b.decision !== undefined) lines.push(`- **Decision**: ${b.decision}`);
    parts.push(lines.join("\n") + "\n");
  }
  return parts.join("\n") + tail;
}

const block = (id, severity, decision, extra = {}) => ({ id, severity, decision, ...extra });
const CRIT = "❌ CRITICAL";
const WARN = "⚠️ WARNING";
const OBS = "💡 OBSERVATION";

// Runs one `next` on a project whose last log entry is a pending review step and returns what the router logged for it.
// `text` is the review file; `policy` goes into the project override.
function observe(text, { step = "plan-review", policy = {} } = {}) {
  const project = makeProject({ plan: planText({ done: step === "impl-review" ? 1 : 0 }), policy });
  const name = step === "plan-review" ? "plan-review" : "impl-review";
  fs.mkdirSync(path.join(project.changeDir, "reviews"), { recursive: true });
  fs.writeFileSync(path.join(project.changeDir, "reviews", `${name}.md`), text);
  const pending = { result: undefined, verified: undefined, ok: undefined, finishedAt: undefined };
  const log = step === "plan-review"
    ? [entry(1, "plan"), entry(2, "plan-review", pending)]
    : [entry(1, "plan"), entry(2, "plan-review"), entry(3, "implement"), entry(4, "impl-review", pending)];
  if (step === "impl-review") writeReview(project, "plan-review", { verdict: "SOUND" });
  writeLog(project, log);
  writeResult(project, { status: "done", note: "fixture" });
  const res = next(project);
  const logged = readLogEntries(project)[log.length - 1];
  return { project, res, entry: logged, review: logged.review };
}

describe("parser: findings, decisions and open counts", () => {
  test("severities with emoji, decisions with trailing text, an observation never counts", () => {
    const { review } = observe(reviewText({
      findings: "1 critical, 2 warnings",
      blocks: [
        block("F1", CRIT, "APPLIED — abc1234"),
        block("F2", WARN, "PENDING — needs an owner"),
        block("F3", WARN, "APPLIED — def5678"),
        block("F4", OBS, "PENDING"),
      ],
    }));
    assert.deepEqual(review, { verdict: "REVISE", critical: 1, warnings: 2, openCritical: 0, openWarnings: 1 });
  });

  test("a PENDING critical is open critical", () => {
    const { review } = observe(reviewText({ findings: "1 critical, 0 warnings", blocks: [block("F1", CRIT, "PENDING")] }));
    assert.equal(review.openCritical, 1);
    assert.equal(review.openWarnings, 0);
  });

  test("severity is case-insensitive and the first word on the line wins", () => {
    const { review } = observe(reviewText({
      findings: "1 critical, 1 warnings",
      blocks: [block("F1", "critical (was warning)", "PENDING"), block("F2", "Warning", "PENDING")],
    }));
    assert.equal(review.openCritical, 1);
    assert.equal(review.openWarnings, 1);
  });

  test("a block with no recognizable severity reads as a warning", () => {
    const { review } = observe(reviewText({
      findings: "0 critical, 1 warnings",
      blocks: [block("F1", "MAJOR", "PENDING"), block("F2", null, "PENDING")],
    }));
    assert.equal(review.openCritical, 0);
    assert.equal(review.openWarnings, 2);
  });

  test("FIXED, SKIPPED, DISMISSED and Accepted. are closed", () => {
    const { review } = observe(reviewText({
      findings: "0 critical, 4 warnings",
      blocks: [
        block("F1", WARN, "FIXED"),
        block("F2", WARN, "SKIPPED — not worth it"),
        block("F3", WARN, "DISMISSED"),
        block("F4", WARN, "Accepted."),
      ],
    }));
    assert.equal(review.openWarnings, 0);
    assert.equal(review.openCritical, 0);
  });

  test("ACCEPTED-AS-RULE and FIXED + ACCEPTED-AS-RULE are closed", () => {
    const { review } = observe(reviewText({
      findings: "1 critical, 1 warnings",
      blocks: [
        block("F1", CRIT, "ACCEPTED-AS-RULE: Never trust the header"),
        block("F2", WARN, "FIXED + ACCEPTED-AS-RULE: Always read the blocks"),
      ],
    }));
    assert.equal(review.openCritical, 0);
    assert.equal(review.openWarnings, 0);
  });

  test("an unknown word such as Fix (abc1234): is open, and so is a block without a Decision line", () => {
    const { review } = observe(reviewText({
      findings: "1 critical, 1 warnings",
      blocks: [block("F1", CRIT, "Fix (abc1234): done"), block("F2", WARN, null), block("F3", WARN, "APPLIED")],
    }));
    assert.equal(review.openCritical, 1);
    assert.equal(review.openWarnings, 1);
  });

  test("a Decision word is read from the first letters after the colon, in any case", () => {
    const { review } = observe(reviewText({
      findings: "0 critical, 2 warnings",
      blocks: [block("F1", WARN, "applied"), block("F2", WARN, "Dismissed — duplicate")],
    }));
    assert.equal(review.openWarnings, 0);
  });

  test("a block ends at the next heading, so a later block's Decision is not read into an earlier one", () => {
    const text = reviewText({
      findings: "0 critical, 2 warnings",
      blocks: [block("F1", WARN, null), block("F2", WARN, "APPLIED")],
    });
    const { review } = observe(text);
    // F1 has no Decision line of its own: open, even though F2 right below it has one.
    assert.equal(review.openWarnings, 1);
  });

  test("a #### sub-heading stays inside its block", () => {
    const text = `# Review\n\n- **Verdict**: REVISE\n- **Findings**: 1 critical, 0 warnings\n\n## Findings\n\n### F1 \u2014 Thing\n\n- **Severity**: ${CRIT}\n\n#### Detail\n\ntext\n\n- **Decision**: APPLIED\n`;
    const { review } = observe(text);
    assert.equal(review.openCritical, 0);
  });

  test("a ### W1 block is not parsed: the header count adds it as unlisted open", () => {
    const { review } = observe(reviewText({
      findings: "0 critical, 2 warnings",
      blocks: [block("F1", WARN, "APPLIED"), { id: "W1", heading: "### W1 — Other", severity: WARN, decision: "APPLIED" }],
    }));
    assert.equal(review.openWarnings, 1);
  });

  test("a header count above the parsed blocks adds the difference as open", () => {
    const { review } = observe(reviewText({
      findings: "3 critical, 2 warnings",
      blocks: [block("F1", CRIT, "APPLIED"), block("F2", WARN, "APPLIED")],
    }));
    assert.equal(review.openCritical, 2);
    assert.equal(review.openWarnings, 1);
  });

  test("a header count below the parsed blocks adds nothing", () => {
    const { review } = observe(reviewText({
      findings: "0 critical, 0 warnings",
      blocks: [block("F1", WARN, "PENDING")],
    }));
    assert.equal(review.openWarnings, 1);
  });

  test("a SOUND review with only a pending observation logs zero open", () => {
    const { review } = observe(reviewText({ verdict: "SOUND", findings: "0 critical, 0 warnings", blocks: [block("F1", OBS, "PENDING")] }));
    assert.deepEqual(review, { verdict: "SOUND", critical: 0, warnings: 0, openCritical: 0, openWarnings: 0 });
  });
});

describe("fallback: a review without Decision lines is unaware", () => {
  test("no ### F block at all: verdict and measured pair only", () => {
    const project = makeProject({ plan: planText() });
    writeReview(project, "plan-review", { verdict: "REVISE", findings: "1 critical, 2 warnings" });
    writeLog(project, [entry(1, "plan"), entry(2, "plan-review", { result: undefined, verified: undefined, ok: undefined, finishedAt: undefined })]);
    writeResult(project, { status: "done", note: "fixture" });
    next(project);
    const logged = readLogEntries(project)[1];
    assert.deepEqual(logged.review, { verdict: "REVISE", critical: 1, warnings: 2 });
    assert.equal("openCritical" in logged.review, false);
  });

  test("### F blocks that carry no Decision line at all stay unaware", () => {
    const { review } = observe(reviewText({
      findings: "1 critical, 1 warnings",
      blocks: [block("F1", CRIT, null), block("F2", WARN, null)],
    }));
    assert.deepEqual(review, { verdict: "REVISE", critical: 1, warnings: 1 });
  });

  test("routing is unchanged in this phase: an all-APPLIED REVISE still re-plans, an unaware one the same", () => {
    const aware = observe(reviewText({
      findings: "1 critical, 0 warnings",
      blocks: [block("F1", CRIT, "APPLIED — abc1234")],
    }));
    assert.equal(aware.res.json.step, "plan");
    assert.equal(readLogEntries(aware.project).pop().template, "plan-revise");
    assert.match(aware.res.json.reason, /^plan review REVISE \(1 critical, 0 warnings\);/);

    const project = makeProject({ plan: planText() });
    writeReview(project, "plan-review", { verdict: "REVISE", findings: "1 critical, 0 warnings" });
    writeLog(project, [entry(1, "plan"), entry(2, "plan-review", { result: undefined, verified: undefined, ok: undefined, finishedAt: undefined })]);
    writeResult(project, { status: "done", note: "fixture" });
    const plain = next(project);
    assert.equal(plain.json.step, aware.res.json.step);
    assert.equal(readLogEntries(project).pop().template, "plan-revise");
    assert.equal(plain.json.reason, aware.res.json.reason);
  });

  test("an all-APPLIED NEEDS ATTENTION still runs fix in this phase", () => {
    const { res, review } = observe(reviewText({
      verdict: "NEEDS ATTENTION",
      findings: "1 critical, 0 warnings",
      blocks: [block("F1", CRIT, "APPLIED")],
    }), { step: "impl-review" });
    assert.equal(res.json.step, "fix");
    assert.equal(review.openCritical, 0);
  });

  test("openFindings.enabled false reads the review as unaware", () => {
    const { review } = observe(reviewText({
      findings: "1 critical, 0 warnings",
      blocks: [block("F1", CRIT, "PENDING")],
    }), { policy: { review: { openFindings: { enabled: false } } } });
    assert.deepEqual(review, { verdict: "REVISE", critical: 1, warnings: 0 });
  });

  test("a step other than a review keeps its entry shape", () => {
    const { project } = observe(reviewText({ findings: "0 critical, 0 warnings", blocks: [] }));
    const planEntry = readLogEntries(project)[0];
    assert.equal("review" in planEntry, false);
  });

  test("an unverified review (no verdict) logs no review field", () => {
    const project = makeProject({ plan: planText() });
    fs.mkdirSync(path.join(project.changeDir, "reviews"), { recursive: true });
    fs.writeFileSync(path.join(project.changeDir, "reviews", "plan-review.md"), "# Review\n\nnothing\n");
    writeLog(project, [entry(1, "plan"), entry(2, "plan-review", { result: undefined, verified: undefined, ok: undefined, finishedAt: undefined })]);
    writeResult(project, { status: "done", note: "fixture" });
    next(project);
    const logged = readLogEntries(project)[1];
    assert.equal(logged.verified, false);
    assert.equal("review" in logged, false);
  });
});

describe("policy keys", () => {
  test("the shipped policy carries the review keys", () => {
    assert.deepEqual(shipped.review.openFindings, {
      enabled: true,
      closedDecisions: ["APPLIED", "FIXED", "ACCEPTED", "SKIPPED", "DISMISSED"],
      onOpen: "halt",
    });
    assert.deepEqual(shipped.review.confirmRounds, { lean: 0, standard: 0, thorough: 0 });
    assert.equal(shipped.review.reviseToleranceWarnings, 1);
    assert.equal(shipped.review.fixOnNeedsAttention, true);
  });

  const text = reviewText({
    findings: "0 critical, 2 warnings",
    blocks: [block("F1", WARN, "APPLIED"), block("F2", WARN, "SKIPPED")],
  });

  test("a closedDecisions override changes which words close a finding", () => {
    const { review } = observe(text, { policy: { review: { openFindings: { closedDecisions: ["APPLIED"] } } } });
    assert.equal(review.openWarnings, 1);
  });

  test("closedDecisions words are matched case-insensitively and trimmed", () => {
    const { review } = observe(text, { policy: { review: { openFindings: { closedDecisions: [" applied ", "skipped"] } } } });
    assert.equal(review.openWarnings, 0);
  });

  for (const [name, value] of [
    ["a string", "APPLIED"],
    ["an object", { APPLIED: true }],
    ["a list with a number", ["APPLIED", 3]],
    ["a list with a blank string", ["APPLIED", "  "]],
    ["null", null],
  ]) {
    test(`closedDecisions that is ${name} reads as the shipped list and does not halt`, () => {
      const { res, review } = observe(text, { policy: { review: { openFindings: { closedDecisions: value } } } });
      assert.equal(res.status, 0);
      assert.equal(review.openWarnings, 0);
    });
  }

  for (const [name, value] of [
    ["a string", "yes"],
    ["a number", 1],
    ["null", null],
  ]) {
    test(`a non-boolean enabled (${name}) reads as off and does not halt`, () => {
      const { res, review } = observe(text, { policy: { review: { openFindings: { enabled: value } } } });
      assert.equal(res.status, 0);
      assert.deepEqual(review, { verdict: "REVISE", critical: 0, warnings: 2 });
    });
  }

  for (const [name, value] of [
    ["a string", "off"],
    ["a list", [1]],
    ["null", null],
    ["a number", 7],
  ]) {
    test(`an openFindings that is ${name} reads as the shipped default and does not halt`, () => {
      const { res, review } = observe(text, { policy: { review: { openFindings: value } } });
      assert.equal(res.status, 0);
      assert.deepEqual(review, { verdict: "REVISE", critical: 0, warnings: 2, openCritical: 0, openWarnings: 0 });
    });
  }

  test("malformed onOpen and confirmRounds values never halt in this phase", () => {
    const { res, review } = observe(text, {
      policy: { review: { openFindings: { onOpen: "explode" }, confirmRounds: { standard: -1, thorough: "two", lean: 1.5 } } },
    });
    assert.equal(res.status, 0);
    assert.equal(review.openWarnings, 0);
  });
});

describe("log entry and status", () => {
  test("impl-review entries carry the same review field", () => {
    const { entry: logged } = observe(reviewText({
      verdict: "NEEDS ATTENTION",
      findings: "1 critical, 1 warnings",
      blocks: [block("F1", CRIT, "APPLIED"), block("F2", WARN, "PENDING")],
    }), { step: "impl-review" });
    assert.deepEqual(logged.review, { verdict: "NEEDS ATTENTION", critical: 1, warnings: 1, openCritical: 0, openWarnings: 1 });
  });

  test("status shows review on a review row and on no other row", () => {
    const { project } = observe(reviewText({
      findings: "1 critical, 0 warnings",
      blocks: [block("F1", CRIT, "APPLIED")],
    }));
    const res = run(project, ["status", project.id]);
    assert.equal(res.status, 0);
    const rows = res.json.steps.filter((s) => !s.skipped);
    assert.deepEqual(rows[1].review, { verdict: "REVISE", critical: 1, warnings: 0, openCritical: 0, openWarnings: 0 });
    assert.equal("review" in rows[0], false);
    assert.equal("review" in rows[rows.length - 1], false);
  });

  test("status shows the measured pair for a review without Decision lines", () => {
    const project = makeProject({ plan: planText() });
    writeLog(project, [entry(1, "plan"), entry(2, "plan-review", { review: { verdict: "SOUND", critical: 0, warnings: 1 } })]);
    const res = run(project, ["status", project.id]);
    assert.deepEqual(res.json.steps[1].review, { verdict: "SOUND", critical: 0, warnings: 1 });
  });

  test("status ignores a review value that is not an object", () => {
    const project = makeProject({ plan: planText() });
    writeLog(project, [entry(1, "plan"), entry(2, "plan-review", { review: "bad" })]);
    const res = run(project, ["status", project.id]);
    assert.equal(res.status, 0);
    assert.equal("review" in res.json.steps[1], false);
  });

  test("a round-4 style review (pre-edit header counts, every finding applied) reads as nothing open", () => {
    // A trimmed copy of the real file's shape: pre-edit header counts, every finding APPLIED or FIXED.
    const text = reviewText({
      verdict: "REVISE",
      findings: "1 critical, 3 warnings",
      blocks: [
        block("F1", CRIT, "APPLIED — plan.md now names the commit"),
        block("F2", WARN, "APPLIED — abc1234"),
        block("F3", WARN, "FIXED"),
        block("F4", WARN, "APPLIED"),
        block("F5", OBS, "PENDING"),
      ],
    });
    const { review } = observe(text);
    assert.equal(review.openCritical, 0);
    assert.equal(review.openWarnings, 0);
  });
});
