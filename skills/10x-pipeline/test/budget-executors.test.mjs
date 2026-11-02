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

// A saturating plan shape: the phase kinds in order and whether a command-checkable Manual row exists (in phase 1).
const FIXTURES = {
  "F-full": { phases: ["goal", "e2e", "tdd", "goal"], manual: true },
  "F-e2e": { phases: ["e2e", "goal"], manual: true },
  "F-seg": { phases: ["goal", "e2e"], manual: false },
  "F-tdd": { phases: ["tdd", "goal"], manual: true },
  "F-rej": { phases: ["goal", "goal"], manual: false },
  "F-rej-manual": { phases: ["goal", "goal"], manual: true },
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
// Every walk opts into the score step (score.minRigor "standard"), whatever the override says otherwise.
function walkFixture(name, level, { override = null, script = longScript(level), useGit = true, goal = level === "thorough" ? THOROUGH_GOAL : GOAL, fixture = FIXTURES[name] } = {}) {
  const merged = { ...(override ?? {}), score: { ...(override?.score ?? {}), minRigor: "standard" } };
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
const TABLE = { standard: 15, thorough: 20 };

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
  assert.deepEqual(policy.rigor.budgetDelta, { lean: -4, standard: 3, thorough: 8 });
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

  // Stacked with a maxed plan loop and every fix loop the same run ends in the budget halt, never past it.
  const stacked = walkFixture("stacked", "standard", { fixture, script: { ...longScript("standard"), implementFails: 2, implReviews: pairs([["NEEDS ATTENTION", CRITICAL], ["NEEDS ATTENTION", CRITICAL], ["NEEDS ATTENTION", CRITICAL], ["APPROVED", CLEAN]]) } });
  assert.equal(stacked.res.json.action, "halt", `${stacked.res.stdout}\n${stacked.sequence.join(" ")}`);
  assert.match(stacked.res.json.reason, /Step budget \d+ spent/);
  assert.ok(stacked.steps <= budgetOf(statusOf(stacked.project).rigor), `${stacked.steps} steps stay inside the budget`);
});

test("lean unchanged", () => {
  assert.equal(policy.rigor.budgetDelta.lean, -4);
  assert.equal(policy.extraSteps.allowance.lean, 0);
  const script = () => ({
    planReviews: pairs([SOUND]),
    implReviews: pairs([["REJECTED", CRITICAL], ["NEEDS ATTENTION", CRITICAL], ["APPROVED", CLEAN]]),
    implementFails: 0,
  });
  const goal = "fix typo";
  // The same walk with and without e2e rows, a valid setup and an eligible Manual row.
  const plain = walkFixture("plain", "lean", { fixture: FIXTURES["F-rej"], script: script(), goal, useGit: false });
  const rich = walkFixture("rich", "lean", { fixture: { phases: ["goal", "e2e"], manual: true }, script: script(), goal, useGit: false });
  assert.equal(plain.res.json.action, "done", plain.res.stdout);
  assert.equal(rich.res.json.action, "done", rich.res.stdout);
  assert.deepEqual(rich.sequence, plain.sequence);
  assert.equal(rich.steps, plain.steps);
  assert.ok(rich.steps <= budgetOf("lean") - 2, `${rich.steps} lean steps fit a budget of ${budgetOf("lean")}`);
  for (const w of [plain, rich]) {
    const impl = ranOf(w.project).filter((e) => e.step === "implement");
    assert.equal(impl.every((e) => e.template === "implement"), true, "no executor or segment at lean");
    assert.equal(ranOf(w.project).some((e) => e.step === "manual-verify" || e.template === "plan-rejected"), false);
    assert.equal(statusOf(w.project).rigor, "lean");
  }
});

test("raised cap exceeds budget", { skip: noGit }, () => {
  for (const level of ["standard", "thorough"]) {
    const raised = { extraSteps: { allowance: { [level]: policy.extraSteps.allowance[level] + 1 } } };
    const { max, per } = longest(level, { override: raised });
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
