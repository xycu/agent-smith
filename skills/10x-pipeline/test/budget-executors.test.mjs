// phase-executors, phase 6: the step budget from the longest legal path of each level.
// The real router walks saturating fixtures; the test derives the longest path from the policy at hand.
// Test titles are string literals: the gate rows of the plan check them.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  cleanupAll, makeProject, writeReview, init, next, run, writeResult, readLogEntries, gitInit, commitFiles, gitAvailable,
} from "./helpers.mjs";
import { buildPlan } from "./phase-helpers.mjs";

after(cleanupAll);

const noGit = gitAvailable() ? false : "git is not installed";
const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const policy = JSON.parse(fs.readFileSync(path.join(SKILL_DIR, "policy.json"), "utf8"));

// ---- fixtures ---------------------------------------------------------------

const GOAL = Array.from({ length: 30 }, (_, i) => `word${i}`).join(" ");
const THOROUGH_GOAL = "Replace the vendor SDK wrapper because the checkout leaks";
const RESEARCH = "---\nstatus: complete\n---\n# Research\n";
const BRIEF = "---\ntype: refactor-plan\n---\n# Brief\n";
const FRAME = "# Frame Brief: demo\n\n## Reframed (or Confirmed) Problem Statement\n\nThe task.\n\n## Confidence\n\n- HIGH\n- MEDIUM\n- LOW\n\nStated: MEDIUM\n";
const CRITICAL = "1 critical, 0 warnings";
const CLEAN = "0 critical, 0 warnings";

const SETUP_MD = [
  "# Test stack", "", "## E2E", "",
  "- config: playwright.config.ts",
  "- seed: `tests/e2e/seed.spec.ts` — protects the login redirect", "",
].join("\n");

const MANUAL_ROW = "Run `node --version` and see a version";

// A valid complexity.json whose sums trigger no tier shift: every factor scores 1, so both sums are 3.
const SCORE = JSON.stringify({
  schemaVersion: policy.score.schemaVersion,
  factors: Object.fromEntries([...policy.score.factors.cognitive, ...policy.score.factors.execution]
    .map((name) => [name, { score: 1, evidence: `goal phrase for ${name}` }])),
  unknowns: [],
  confidence: "medium",
});
const EVIDENCE = "evidence/out.txt";

// The three kinds of phase the router tells apart.
const KINDS = {
  goal: { name: "Parser", rows: ["Parser keeps blank lines: `node --test test/parser.test.mjs`", "Parser keeps tabs: `node --test test/parser.test.mjs`"] },
  e2e: { name: "Login flow", rows: ["Playwright spec covers the login flow: `npx playwright test tests/e2e/login.spec.ts`", "Playwright spec covers logout: `npx playwright test tests/e2e/logout.spec.ts`"] },
  tdd: { name: "Tokenizer", files: ["`src/tokenizer.mjs`"], rows: ["Tokenizer splits words: `node --test test/tokenizer.test.mjs`", "Tokenizer drops marks: `node --test test/tokenizer.test.mjs`"] },
};

// A saturating plan shape: the phase kinds in order and whether a Manual row exists (in phase 1). `manual: true` is a row
// the first manual-verify attempt proves; `manual: "pending"` is a row it leaves pending through both attempts, so the
// walk contains the retry.
const FIXTURES = {
  "F-full": { phases: ["goal", "e2e", "tdd", "goal"], manual: true },
  "F-full-pending": { phases: ["goal", "e2e", "tdd", "goal"], manual: "pending" },
  "F-e2e": { phases: ["e2e", "goal"], manual: true },
  "F-e2e-pending": { phases: ["e2e", "goal"], manual: "pending" },
  "F-seg": { phases: ["goal", "e2e"], manual: false },
  "F-tdd": { phases: ["tdd", "goal"], manual: true },
  "F-tdd-pending": { phases: ["tdd", "goal"], manual: "pending" },
  "F-rej": { phases: ["goal", "goal"], manual: false },
  "F-rej-manual": { phases: ["goal", "goal"], manual: true },
  "F-rej-pending": { phases: ["goal", "goal"], manual: "pending" },
};

// The plan as the walker keeps it: which phases are done, whether the manual row is ticked, whether a re-plan added a phase.
function render(fixture, state) {
  const kinds = state.rework ? [...fixture.phases, "rework"] : fixture.phases;
  return buildPlan(kinds.map((kind, i) => {
    const spec = kind === "rework" ? { name: "Rework", rows: ["Rework applied: `node --test test/rework.test.mjs`"] } : KINDS[kind];
    const manual = i === 0 && fixture.manual ? [{ text: state.manualDone ? `${MANUAL_ROW} — evidence: ${EVIDENCE}` : MANUAL_ROW, done: state.manualDone }] : [];
    return { name: spec.name, files: spec.files ?? [], auto: spec.rows.map((text) => ({ text, done: state.done.has(i + 1) })), manual };
  }));
}

const phaseCount = (fixture, state) => fixture.phases.length + (state.rework ? 1 : 0);

// ---- the walker -------------------------------------------------------------

const future = () => new Date(Date.now() + 60_000);

// A file in the change folder with a fresh mtime, so ordering with startedAt never depends on the clock.
function put(project, file, text) {
  const abs = path.join(project.changeDir, file);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, text);
  const when = future();
  fs.utimesSync(abs, when, when);
}

function review(project, name, verdict, findings) {
  writeReview(project, name, { verdict, findings });
  const abs = path.join(project.changeDir, "reviews", `${name}.md`);
  const when = future();
  fs.utimesSync(abs, when, when);
}

const ranOf = (project) => readLogEntries(project).filter((e) => !e.skipped);
const lastRan = (project) => ranOf(project)[ranOf(project).length - 1];
const sequence = (project) => ranOf(project).map((e) => (e.template === e.step ? e.step : e.template));
const statusOf = (project) => run(project, ["status", project.id]).json;
const finish = (project, result = { status: "done", note: "ok" }) => {
  writeResult(project, result);
  return next(project);
};

const budgetOf = (level, shipped = policy) => shipped.limits.maxTotalSteps + shipped.rigor.budgetDelta[level];
const pairs = (list) => list.map(([verdict, findings]) => ({ verdict, findings }));
const SOUND = ["SOUND", CLEAN];

// The answers that lengthen a run: plan review REVISE until maxPlanRevisions (RETHINK first where frame-rethink applies),
// the first implementation review REJECTED, later ones NEEDS ATTENTION with a critical finding until maxFixLoops, then APPROVED.
function longScript(level) {
  const revisions = policy.limits.maxPlanRevisions;
  const plan = level === "thorough"
    ? [["RETHINK", "2 critical, 0 warnings"], ...Array.from({ length: revisions - 1 }, () => ["REVISE", CRITICAL]), SOUND]
    : [...Array.from({ length: revisions }, () => ["REVISE", CRITICAL]), SOUND];
  const impl = [["REJECTED", CRITICAL], ...Array.from({ length: policy.limits.maxFixLoops - 1 }, () => ["NEEDS ATTENTION", CRITICAL]), ["APPROVED", CLEAN]];
  return { planReviews: pairs(plan), implReviews: pairs(impl), implementFails: 0 };
}

// A scratch project for one fixture. `git` makes it a repository, so the strict commit check of e2e and tdd runs for real.
function fixtureProject(fixture, { override = null, useGit = true } = {}) {
  const project = makeProject({ policy: override });
  fs.mkdirSync(path.join(project.root, "context/foundation"), { recursive: true });
  fs.writeFileSync(path.join(project.root, "context/foundation/test-stack.md"), SETUP_MD);
  for (const f of ["playwright.config.ts", "tests/e2e/seed.spec.ts"]) {
    fs.mkdirSync(path.dirname(path.join(project.root, f)), { recursive: true });
    fs.writeFileSync(path.join(project.root, f), "// fixture\n");
  }
  project.git = useGit;
  if (useGit) {
    gitInit(project);
    commitFiles(project, ["src/base.mjs", "playwright.config.ts", "tests/e2e/seed.spec.ts"]);
  }
  return project;
}

// Answers one run action with the files the real skill would leave, then reports the result through the router.
// While `script.scoreFails` is above 0 a score step fails without a file.
function answer(project, fixture, state, json, script) {
  const e = lastRan(project);
  switch (json.step) {
    case "score":
      if (script.scoreFails > 0) {
        script.scoreFails--;
        return finish(project, { status: "failed", note: "fixture scorer failure" });
      }
      put(project, policy.score.file, SCORE);
      break;
    case "research": put(project, "research.md", RESEARCH); break;
    case "domain-brief": put(project, e.template === "domain-aggregate" ? "refactor-invariant-aggregate.md" : "refactor-anti-corruption-layer.md", BRIEF); break;
    case "frame": put(project, "frame.md", FRAME); break;
    case "plan":
      if (e.template === "plan-rejected") state.rework = true;
      put(project, "plan.md", render(fixture, state));
      break;
    case "plan-review": { const r = script.planReviews.shift() ?? { verdict: SOUND[0], findings: SOUND[1] }; review(project, "plan-review", r.verdict, r.findings); break; }
    case "implement": {
      if (script.implementFails > 0) {
        script.implementFails--;
        return finish(project, { status: "failed", note: "fixture failure" });
      }
      // A plain step covers every pending phase; a segment or executor step covers its own phases.
      const from = e.phase ?? 1;
      const to = e.lastPhase ?? phaseCount(fixture, state);
      for (let n = from; n <= to; n++) state.done.add(n);
      if (project.git) commitFiles(project, [`src/work${e.n}.mjs`]);
      put(project, "plan.md", render(fixture, state));
      break;
    }
    case "manual-verify":
      if (fixture.manual === "pending") break; // the row stays pending: the attempt ends done with no tick
      state.manualDone = true;
      put(project, EVIDENCE, "output\n");
      put(project, "plan.md", render(fixture, state));
      break;
    case "impl-review": { const r = script.implReviews.shift() ?? { verdict: "APPROVED", findings: CLEAN }; review(project, "impl-review", r.verdict, r.findings); break; }
    case "fix": break; // trusted on status; the next impl-review checks the code
    default: assert.fail(`unexpected step ${json.step}`);
  }
  return finish(project);
}

// A failure-free walk of the whole run. Returns the project, the last answer and the executed steps.
// Every walk opts into the score step (score.minRigor "standard") and the manual-verify step (manualVerify.minRigor
// "lean"), whatever the override says otherwise.
const optIn = (override) => ({
  ...(override ?? {}),
  score: { ...(override?.score ?? {}), minRigor: "standard" },
  manualVerify: { ...(override?.manualVerify ?? {}), minRigor: "lean" },
});

function walkFixture(name, level, { override = null, script = longScript(level), useGit = true, goal = level === "thorough" ? THOROUGH_GOAL : GOAL, fixture = FIXTURES[name] } = {}) {
  const merged = optIn(override);
  const project = fixtureProject(fixture, { override: merged, useGit });
  const state = { done: new Set(), manualDone: false, rework: false };
  let res = init(project, goal, ["--rigor", level]);
  for (let i = 0; res.json.action === "run"; i++) {
    assert.ok(i < 40, `${name}: the walk ends`);
    res = answer(project, fixture, state, res.json, script);
  }
  return { project, res, steps: ranOf(project).length, sequence: sequence(project) };
}

// The most steps any fixture takes at `level`, and where each one ended.
function longest(level, options = {}) {
  let max = 0;
  const per = {};
  for (const name of Object.keys(FIXTURES)) {
    const w = walkFixture(name, level, options);
    assert.equal(w.res.json.action, "done", `${name} at ${level}: ${w.res.stdout}\n${w.sequence.join(" ")}`);
    assert.equal(statusOf(w.project).rigor, level, `${name}: the level stays ${level}`);
    assert.equal(ranOf(w.project).every((e) => e.ok), true, `${name}: every step was ok\n${w.sequence.join(" ")}`);
    per[name] = w;
    max = Math.max(max, w.steps);
  }
  return { max, per };
}

// The longest failure-free paths the policy table of the ADR names.
// manual-verify is outside the pool, so its attempt and its retry add two steps to the paths of every level.
const TABLE = { lean: 10, standard: 17, thorough: 22 };

// ---- tests ------------------------------------------------------------------

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

// ---- review-open-findings, phase 3: the confirmation round ------------------
// The walker above writes header-only reviews, which are unaware and never confirm. These cases write Decision-bearing
// reviews with a local writer, so helpers.mjs and the cases above stay as they are.

// A Decision-bearing review whose findings are all APPLIED; the header counts stay as measured before the edits.
function awareReviewText(verdict) {
  return [
    "# Review", "",
    `- **Verdict**: ${verdict}`,
    "- **Findings**: 1 critical, 1 warnings", "",
    "## Findings", "",
    "### F1 — First", "", "- **Severity**: ❌ CRITICAL", "- **Decision**: APPLIED — abc1234", "",
    "### F2 — Second", "", "- **Severity**: ⚠️ WARNING", "- **Decision**: APPLIED", "",
  ].join("\n");
}

function awareReview(project, name, verdict) {
  const abs = path.join(project.changeDir, "reviews", `${name}.md`);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, awareReviewText(verdict));
  const when = future();
  fs.utimesSync(abs, when, when);
}

// The saturating shape: longScript's loop reviews stay header-only, and the review that ends each loop (the SOUND plan
// review, the APPROVED implementation review) becomes an aware REVISE / NEEDS ATTENTION with every finding APPLIED, so it
// goes on exactly as that review did. With confirmRounds N it is followed by N confirmation reviews, which the script
// answers with the same aware review; the last one exhausts the cap.
function confirmScript(level, rounds) {
  const base = longScript(level);
  const aware = (verdict) => Array.from({ length: rounds + 1 }, () => ({ verdict, aware: true }));
  return { ...base, planReviews: [...base.planReviews.slice(0, -1), ...aware("REVISE")], implReviews: [...base.implReviews.slice(0, -1), ...aware("NEEDS ATTENTION")] };
}

// Answers a review step with a scripted aware review when the next script entry is one; everything else goes through the
// walker of the cases above.
function answerAware(project, fixture, state, json, script) {
  const queue = json.step === "plan-review" ? script.planReviews : json.step === "impl-review" ? script.implReviews : null;
  if (queue && queue[0]?.aware) {
    const r = queue.shift();
    awareReview(project, json.step, r.verdict);
    return finish(project);
  }
  return answer(project, fixture, state, json, script);
}

function walkAware(name, level, { override = null, script, goal = level === "thorough" ? THOROUGH_GOAL : GOAL, fixture = FIXTURES[name] } = {}) {
  const merged = optIn(override);
  const project = fixtureProject(fixture, { override: merged, useGit: true });
  const state = { done: new Set(), manualDone: false, rework: false };
  let res = init(project, goal, ["--rigor", level]);
  for (let i = 0; res.json.action === "run"; i++) {
    assert.ok(i < 40, `${name}: the walk ends`);
    res = answerAware(project, fixture, state, res.json, script);
  }
  return { project, res, steps: ranOf(project).length, sequence: sequence(project) };
}

// The confirmation round on at `rounds` for `level`, with `budgetDelta` raised by 2 per round (the documented answer) unless asked otherwise.
const confirmOverride = (level, rounds, { raise = true } = {}) => ({
  review: { confirmRounds: { [level]: rounds } },
  ...(raise ? { rigor: { budgetDelta: { ...policy.rigor.budgetDelta, [level]: policy.rigor.budgetDelta[level] + 2 * rounds } } } : {}),
});

const confirmCount = (w, template) => w.sequence.filter((s) => s === template).length;

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
