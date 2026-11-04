// Open findings of a review (review-open-findings change). Black-box through the CLI.
// Phase 1: the parser, the policy keys and the `review` field of the log entry and of `status`; routing is unchanged.
// Later phases append their own describe blocks below.
import { describe, test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  cleanupAll, makeProject, planText, writeReview, run, init, next, writeLog, entry, writeResult, readLogEntries,
  git, gitAvailable, gitEnv, gitInit, writePlan,
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

  test("an all-APPLIED REVISE goes on to implement; the same header without Decision lines still re-plans", () => {
    const aware = observe(reviewText({
      findings: "1 critical, 0 warnings",
      blocks: [block("F1", CRIT, "APPLIED — abc1234")],
    }));
    assert.equal(aware.res.json.step, "implement");

    const project = makeProject({ plan: planText() });
    writeReview(project, "plan-review", { verdict: "REVISE", findings: "1 critical, 0 warnings" });
    writeLog(project, [entry(1, "plan"), entry(2, "plan-review", { result: undefined, verified: undefined, ok: undefined, finishedAt: undefined })]);
    writeResult(project, { status: "done", note: "fixture" });
    const plain = next(project);
    assert.equal(plain.json.step, "plan");
    assert.equal(readLogEntries(project).pop().template, "plan-revise");
    assert.match(plain.json.reason, /^plan review REVISE \(1 critical, 0 warnings\);/);
  });

  test("an all-APPLIED NEEDS ATTENTION is done, with no fix step", () => {
    const { res, review } = observe(reviewText({
      verdict: "NEEDS ATTENTION",
      findings: "1 critical, 0 warnings",
      blocks: [block("F1", CRIT, "APPLIED")],
    }), { step: "impl-review" });
    assert.equal(res.json.action, "done");
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

// ---- Phase 2: routing on open findings ----------------------------------------------------

const GOAL = "Add a retry counter to the status output so the report shows how often each step ran again";

function writeReviewFile(project, name, text) {
  fs.mkdirSync(path.join(project.changeDir, "reviews"), { recursive: true });
  fs.writeFileSync(path.join(project.changeDir, "reviews", `${name}.md`), text);
}

// A run whose last step is a finished plan-review (or impl-review) with the given review file, resumed by `init`.
function routePlan(text, { policy = {}, rigor = "standard", log = null, plan = planText() } = {}) {
  const project = makeProject({ plan, policy });
  writeReviewFile(project, "plan-review", text);
  writeLog(project, log ?? [entry(1, "plan"), entry(2, "plan-review")]);
  return { project, res: init(project, GOAL, ["--rigor", rigor]) };
}

function routeImpl(text, { policy = {}, rigor = "standard" } = {}) {
  const project = makeProject({ plan: planText({ done: 1 }), policy });
  writeReview(project, "plan-review", { verdict: "SOUND" });
  writeReviewFile(project, "impl-review", text);
  writeLog(project, [entry(1, "plan"), entry(2, "plan-review"), entry(3, "implement"), entry(4, "impl-review")]);
  return { project, res: init(project, GOAL, ["--rigor", rigor]) };
}

const lastEntry = (project) => readLogEntries(project).filter((e) => !e.skipped).pop();
const RETRY = { review: { openFindings: { onOpen: "retry" } } };

describe("plan review routing on open findings", () => {
  test("every finding APPLIED: REVISE goes on to implement in one call", () => {
    const { project, res } = routePlan(reviewText({
      findings: "1 critical, 3 warnings",
      blocks: [block("F1", CRIT, "APPLIED — plan.md section 2"), block("F2", WARN, "APPLIED"), block("F3", WARN, "FIXED"), block("F4", WARN, "ACCEPTED")],
    }));
    assert.equal(res.json.action, "run");
    assert.equal(res.json.step, "implement");
    assert.equal(lastEntry(project).step, "implement");
  });

  test("an open critical halts, and names the finding", () => {
    const { res } = routePlan(reviewText({
      findings: "1 critical, 0 warnings",
      blocks: [block("F1", CRIT, "PENDING — needs an owner")],
    }));
    assert.equal(res.json.action, "halt");
    assert.match(res.json.reason, /^Plan review REVISE left 1 open critical and 0 open warnings \(F1\)\. Needs a human\./);
  });

  test("open warnings at the tolerance go on, above it halt", () => {
    const at = routePlan(reviewText({
      findings: "0 critical, 2 warnings",
      blocks: [block("F1", WARN, "PENDING"), block("F2", WARN, "APPLIED")],
    }));
    assert.equal(at.res.json.step, "implement");
    const over = routePlan(reviewText({
      findings: "0 critical, 2 warnings",
      blocks: [block("F1", WARN, "PENDING"), block("F2", WARN, "Fix (abc1234): done")],
    }));
    assert.equal(over.res.json.action, "halt");
    assert.match(over.res.json.reason, /left 0 open critical and 2 open warnings \(F1, F2\)\./);
  });

  test("a project tolerance of 0 halts on one open warning", () => {
    const { res } = routePlan(reviewText({
      findings: "0 critical, 1 warnings",
      blocks: [block("F1", WARN, "PENDING")],
    }), { policy: { review: { reviseToleranceWarnings: 0 } } });
    assert.equal(res.json.action, "halt");
  });

  test("a pending observation is ignored", () => {
    const { res } = routePlan(reviewText({
      findings: "0 critical, 0 warnings",
      blocks: [block("F1", OBS, "PENDING"), block("F2", CRIT, "APPLIED")],
    }));
    assert.equal(res.json.step, "implement");
  });

  test("a block without a Decision line is open when a sibling has one", () => {
    const { res } = routePlan(reviewText({
      findings: "1 critical, 0 warnings",
      blocks: [block("F1", CRIT, null), block("F2", OBS, "APPLIED")],
    }));
    assert.equal(res.json.action, "halt");
    assert.match(res.json.reason, /\(F1\)/);
  });

  test("retry mode re-plans on an open critical, with the open counts in the reason", () => {
    const { project, res } = routePlan(reviewText({
      findings: "1 critical, 1 warnings",
      blocks: [block("F1", CRIT, "PENDING"), block("F2", WARN, "APPLIED")],
    }), { policy: RETRY });
    assert.equal(res.json.step, "plan");
    assert.equal(lastEntry(project).template, "plan-revise");
    assert.match(res.json.reason, /^plan review REVISE \(1 critical, 1 warnings; open 1 critical, 0 warnings\);/);
  });

  test("retry mode does not re-plan an all-applied REVISE", () => {
    const { res } = routePlan(reviewText({
      findings: "1 critical, 0 warnings",
      blocks: [block("F1", CRIT, "APPLIED")],
    }), { policy: RETRY });
    assert.equal(res.json.step, "implement");
  });

  test("retry mode puts the same suffix on the research-revise reason", () => {
    const log = [entry(1, "plan"), entry(2, "plan-review"), entry(3, "plan", { template: "plan-revise", verdict: "REVISE" }), entry(4, "plan-review")];
    const { project, res } = routePlan(reviewText({
      findings: "1 critical, 0 warnings",
      blocks: [block("F1", CRIT, "PENDING")],
    }), { policy: RETRY, rigor: "thorough", log });
    assert.equal(res.json.step, "research");
    assert.equal(lastEntry(project).template, "research-revise");
    assert.match(res.json.reason, /^plan review REVISE \(1 critical, 0 warnings; open 1 critical, 0 warnings\) after 1 REVISE re-plan\(s\)/);
  });

  for (const [name, value] of [["a string", "explode"], ["a number", 3], ["null", null], ["upper case", "RETRY"]]) {
    test(`an onOpen that is ${name} reads halt`, () => {
      const { res } = routePlan(reviewText({
        findings: "1 critical, 0 warnings",
        blocks: [block("F1", CRIT, "PENDING")],
      }), { policy: { review: { openFindings: { onOpen: value } } } });
      assert.equal(res.json.action, "halt");
    });
  }

  test("RETHINK keeps its routing whatever the Decision lines say, in halt and retry mode", () => {
    for (const policy of [{}, RETRY]) {
      const { project, res } = routePlan(reviewText({
        verdict: "RETHINK",
        findings: "1 critical, 0 warnings",
        blocks: [block("F1", CRIT, "APPLIED")],
      }), { policy });
      assert.equal(res.json.step, "plan");
      assert.equal(lastEntry(project).template, "plan-revise");
      assert.match(res.json.reason, /^plan review RETHINK \(1 critical, 0 warnings\);/, "no open suffix on a RETHINK");
    }
  });

  test("a review without Decision lines keeps the old routing and the exact reason prefix", () => {
    const project = makeProject({ plan: planText() });
    writeReview(project, "plan-review", { verdict: "REVISE", findings: "1 critical, 1 warnings" });
    writeLog(project, [entry(1, "plan"), entry(2, "plan-review")]);
    const res = init(project, GOAL, ["--rigor", "standard"]);
    assert.equal(res.json.step, "plan");
    assert.match(res.json.reason, /^plan review REVISE \(1 critical, 1 warnings\);/);
    assert.doesNotMatch(res.json.reason, /open/);
    // The same header with a tolerated count goes on, as before.
    const ok = makeProject({ plan: planText() });
    writeReview(ok, "plan-review", { verdict: "REVISE", findings: "0 critical, 1 warnings" });
    writeLog(ok, [entry(1, "plan"), entry(2, "plan-review")]);
    assert.equal(init(ok, GOAL, ["--rigor", "standard"]).json.step, "implement");
  });

  test("openFindings.enabled false routes on the header counts", () => {
    const { res } = routePlan(reviewText({
      findings: "1 critical, 0 warnings",
      blocks: [block("F1", CRIT, "APPLIED")],
    }), { policy: { review: { openFindings: { enabled: false } } } });
    assert.equal(res.json.step, "plan");
    assert.match(res.json.reason, /^plan review REVISE \(1 critical, 0 warnings\);/);
  });

  test("a header count above the parsed blocks counts as open", () => {
    const { res } = routePlan(reviewText({
      findings: "2 critical, 0 warnings",
      blocks: [block("F1", CRIT, "APPLIED")],
    }));
    assert.equal(res.json.action, "halt");
    assert.match(res.json.reason, /left 1 open critical and 0 open warnings\. Needs a human\. Plus 1 counted in the Findings header with no ### F<n> block: add a block with a Decision line for each, or lower the header count\./);
  });

  test("a ### W1 block is unlisted and halts through the header count", () => {
    const { res } = routePlan(reviewText({
      findings: "1 critical, 0 warnings",
      blocks: [block("F1", OBS, "APPLIED"), { id: "W1", heading: "### W1 — Other", severity: CRIT, decision: "APPLIED" }],
    }));
    assert.equal(res.json.action, "halt");
    assert.match(res.json.reason, /Plus 1 counted/);
  });

  test("the gate acts only before any automated row is done", () => {
    const { res } = routePlan(reviewText({
      findings: "1 critical, 0 warnings",
      blocks: [block("F1", CRIT, "PENDING")],
    }), { plan: planText({ phases: 1, rowsPerPhase: 2, done: 1 }) });
    assert.notEqual(res.json.action, "halt");
    assert.equal(res.json.step, "implement");
  });
});

describe("plan review halt text", () => {
  const pending = reviewText({ findings: "1 critical, 0 warnings", blocks: [block("F1", CRIT, "PENDING")] });

  test("names the review path, the closed words and the skill to triage with", () => {
    const { res } = routePlan(pending);
    const rel = "context/changes/demo/reviews/plan-review.md";
    assert.equal(
      res.json.reason,
      `Plan review REVISE left 1 open critical and 0 open warnings (F1). Needs a human. Set each finding's Decision in ${rel} (APPLIED, FIXED, ACCEPTED, SKIPPED or DISMISSED) or triage with /10x-plan-review ${rel}, then run again.`,
    );
  });

  test("a closedDecisions override changes the listed words", () => {
    const { res } = routePlan(pending, { policy: { review: { openFindings: { closedDecisions: ["applied", "waived"] } } } });
    assert.match(res.json.reason, /\(APPLIED or WAIVED\) or triage with/);
    const one = routePlan(pending, { policy: { review: { openFindings: { closedDecisions: ["done"] } } } });
    assert.match(one.res.json.reason, /Decision in \S+ \(DONE\) or triage/);
  });

  test("a run that is not isolated gets no commit sentence", () => {
    const { res } = routePlan(pending);
    assert.doesNotMatch(res.json.reason, /Commit the edit/);
  });

  test("an unlisted-count sentence sits before the way back in", () => {
    const { res } = routePlan(reviewText({ findings: "3 critical, 1 warnings", blocks: [block("F1", CRIT, "PENDING")] }));
    assert.match(res.json.reason, /left 3 open critical and 1 open warnings \(F1\)\. Needs a human\. Plus 3 counted in the Findings header/);
    assert.ok(res.json.reason.indexOf("Plus 3 counted") < res.json.reason.indexOf("Set each finding's Decision"));
  });
});

describe("implementation review routing on open findings", () => {
  test("every finding APPLIED: NEEDS ATTENTION is done, with no fix step", () => {
    const { project, res } = routeImpl(reviewText({
      verdict: "NEEDS ATTENTION",
      findings: "1 critical, 2 warnings",
      blocks: [block("F1", CRIT, "APPLIED — abc1234"), block("F2", WARN, "APPLIED"), block("F3", WARN, "FIXED")],
    }));
    assert.equal(res.json.action, "done");
    assert.equal(readLogEntries(project).some((e) => e.step === "fix"), false);
  });

  test("an open critical halts and names the finding", () => {
    const { res } = routeImpl(reviewText({
      verdict: "NEEDS ATTENTION",
      findings: "1 critical, 0 warnings",
      blocks: [block("F2", CRIT, "PENDING")],
    }));
    assert.equal(res.json.action, "halt");
    assert.match(res.json.reason, /^Implementation review NEEDS ATTENTION left 1 open critical and 0 open warnings \(F2\)\. Needs a human\./);
  });

  test("open warnings at the tolerance are done (even with fixOnNeedsAttention on), above it halt", () => {
    const at = routeImpl(reviewText({
      verdict: "NEEDS ATTENTION",
      findings: "0 critical, 2 warnings",
      blocks: [block("F1", WARN, "PENDING"), block("F2", WARN, "APPLIED")],
    }));
    assert.equal(at.res.json.action, "done");
    const over = routeImpl(reviewText({
      verdict: "NEEDS ATTENTION",
      findings: "0 critical, 2 warnings",
      blocks: [block("F1", WARN, "PENDING"), block("F2", WARN, "PENDING")],
    }));
    assert.equal(over.res.json.action, "halt");
    assert.match(over.res.json.reason, /left 0 open critical and 2 open warnings \(F1, F2\)\./);
  });

  test("a pending observation is ignored", () => {
    const { res } = routeImpl(reviewText({
      verdict: "NEEDS ATTENTION",
      findings: "0 critical, 0 warnings",
      blocks: [block("F1", OBS, "PENDING")],
    }));
    assert.equal(res.json.action, "done");
  });

  test("retry mode runs fix on an open critical, with the open counts appended to the reason", () => {
    const { project, res } = routeImpl(reviewText({
      verdict: "NEEDS ATTENTION",
      findings: "1 critical, 0 warnings",
      blocks: [block("F1", CRIT, "PENDING")],
    }), { policy: RETRY });
    assert.equal(res.json.step, "fix");
    assert.equal(lastEntry(project).template, "fix");
    assert.match(res.json.reason, /^impl review NEEDS ATTENTION \(1 critical, 0 warnings\); open 1 critical, 0 warnings;/);
  });

  test("retry mode does not bring back a fix for nothing open or for tolerated warnings", () => {
    const none = routeImpl(reviewText({
      verdict: "NEEDS ATTENTION",
      findings: "1 critical, 0 warnings",
      blocks: [block("F1", CRIT, "APPLIED")],
    }), { policy: RETRY });
    assert.equal(none.res.json.action, "done");
    const tolerated = routeImpl(reviewText({
      verdict: "NEEDS ATTENTION",
      findings: "0 critical, 1 warnings",
      blocks: [block("F1", WARN, "PENDING")],
    }), { policy: RETRY });
    assert.equal(tolerated.res.json.action, "done");
  });

  test("fixOnNeedsAttention false changes nothing for an aware review", () => {
    const { res } = routeImpl(reviewText({
      verdict: "NEEDS ATTENTION",
      findings: "1 critical, 0 warnings",
      blocks: [block("F1", CRIT, "PENDING")],
    }), { policy: { review: { fixOnNeedsAttention: false } } });
    assert.equal(res.json.action, "halt");
  });

  test("REJECTED keeps its fix, with no open suffix, in halt and retry mode", () => {
    for (const policy of [{}, RETRY]) {
      const { project, res } = routeImpl(reviewText({
        verdict: "REJECTED",
        findings: "1 critical, 0 warnings",
        blocks: [block("F1", CRIT, "APPLIED")],
      }), { policy, rigor: "lean" });
      assert.equal(res.json.step, "fix");
      assert.equal(lastEntry(project).template, "fix");
      assert.match(res.json.reason, /^impl review REJECTED \(1 critical, 0 warnings\);/);
      assert.doesNotMatch(res.json.reason, /open 0 critical/);
    }
  });

  test("a review without Decision lines keeps the old routing and the exact reason prefix", () => {
    const project = makeProject({ plan: planText({ done: 1 }) });
    writeReview(project, "plan-review", { verdict: "SOUND" });
    writeReview(project, "impl-review", { verdict: "NEEDS ATTENTION", findings: "0 critical, 1 warnings" });
    writeLog(project, [entry(1, "plan"), entry(2, "plan-review"), entry(3, "implement"), entry(4, "impl-review")]);
    const res = init(project, GOAL, ["--rigor", "standard"]);
    assert.equal(res.json.step, "fix");
    assert.match(res.json.reason, /^impl review NEEDS ATTENTION \(0 critical, 1 warnings\);/);
    assert.doesNotMatch(res.json.reason, /open/);
    // fixOnNeedsAttention still decides for an unaware review.
    const off = makeProject({ plan: planText({ done: 1 }), policy: { review: { fixOnNeedsAttention: false } } });
    writeReview(off, "plan-review", { verdict: "SOUND" });
    writeReview(off, "impl-review", { verdict: "NEEDS ATTENTION", findings: "0 critical, 1 warnings" });
    writeLog(off, [entry(1, "plan"), entry(2, "plan-review"), entry(3, "implement"), entry(4, "impl-review")]);
    assert.equal(init(off, GOAL, ["--rigor", "standard"]).json.action, "done");
  });

  test("openFindings.enabled false routes on the header counts", () => {
    const { res } = routeImpl(reviewText({
      verdict: "NEEDS ATTENTION",
      findings: "1 critical, 0 warnings",
      blocks: [block("F1", CRIT, "APPLIED")],
    }), { policy: { review: { openFindings: { enabled: false } } } });
    assert.equal(res.json.step, "fix");
  });

  test("an unparsed header count is open and halts, FIXED and ACCEPTED are closed", () => {
    const closed = routeImpl(reviewText({
      verdict: "NEEDS ATTENTION",
      findings: "1 critical, 1 warnings",
      blocks: [block("F1", CRIT, "FIXED"), block("F2", WARN, "ACCEPTED-AS-RULE: Always read the blocks")],
    }));
    assert.equal(closed.res.json.action, "done");
    const unparsed = routeImpl(reviewText({
      verdict: "NEEDS ATTENTION",
      findings: "2 critical, 0 warnings",
      blocks: [block("F1", CRIT, "FIXED")],
    }));
    assert.equal(unparsed.res.json.action, "halt");
    assert.match(unparsed.res.json.reason, /Plus 1 counted in the Findings header/);
  });

  test("the halt text names the review path, the effective words and /10x-impl-review", () => {
    const text = reviewText({ verdict: "NEEDS ATTENTION", findings: "1 critical, 0 warnings", blocks: [block("F1", CRIT, "PENDING")] });
    const rel = "context/changes/demo/reviews/impl-review.md";
    const { res } = routeImpl(text);
    assert.equal(
      res.json.reason,
      `Implementation review NEEDS ATTENTION left 1 open critical and 0 open warnings (F1). Needs a human. Set each finding's Decision in ${rel} (APPLIED, FIXED, ACCEPTED, SKIPPED or DISMISSED) or triage with /10x-impl-review ${rel}, then run again.`,
    );
    const custom = routeImpl(text, { policy: { review: { openFindings: { closedDecisions: ["applied", "waived"] } } } });
    assert.match(custom.res.json.reason, /\(APPLIED or WAIVED\)/);
  });
});

describe("halt text in an isolated run", { skip: !gitAvailable() && "git is not available" }, () => {
  const ON = { isolation: { require: true } };

  // A real linked worktree on agent-smith/demo, a first init and a plan step answered as done, so the next call asks for the plan review.
  function isolatedRun() {
    const main = makeProject({ policy: ON });
    gitInit(main);
    git(main, ["add", "-A"]);
    git(main, ["commit", "-q", "-m", "chore: project"]);
    const top = path.join(main.base, ".claude/worktrees", "agent-smith-demo");
    git(main, ["worktree", "add", "-q", "-b", "agent-smith/demo", top]);
    const changeDir = path.join(top, "context/changes/demo");
    const wt = { id: "demo", base: main.base, root: top, changeDir, agentDir: path.join(changeDir, "agent-smith"), planFile: path.join(changeDir, "plan.md") };
    const env = gitEnv(main);
    const first = run(wt, ["init", "demo", "--goal", GOAL, "--rigor", "standard"], { env });
    assert.equal(first.status, 0, first.stdout + first.stderr);
    writePlan(wt, planText());
    writeResult(wt, { status: "done", note: "planned" });
    const review = run(wt, ["next", "demo"], { env });
    assert.equal(review.json.step, "plan-review", review.stdout + review.stderr);
    return { wt, env };
  }

  test("the text ends with the commit sentence", () => {
    const { wt, env } = isolatedRun();
    writeReviewFile(wt, "plan-review", reviewText({ findings: "1 critical, 0 warnings", blocks: [block("F1", CRIT, "PENDING")] }));
    writeResult(wt, { status: "done", note: "reviewed" });
    const res = run(wt, ["next", "demo"], { env });
    assert.equal(res.json.action, "halt", res.stdout + res.stderr);
    assert.match(res.json.reason, /^Plan review REVISE left 1 open critical and 0 open warnings \(F1\)\. Needs a human\./);
    assert.ok(res.json.reason.endsWith(", then run again. Commit the edit in the run worktree first: a failed step rolls back uncommitted edits."), res.json.reason);
  });
});
