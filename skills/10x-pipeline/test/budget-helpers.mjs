// Shared fixtures, plan renderer and walkers of the budget tests (budget-*.test.mjs); registers no tests.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import {
  makeProject, writeReview, init, next, run, writeResult, readLogEntries, gitInit, commitFiles, gitAvailable,
} from "./helpers.mjs";
import { buildPlan } from "./phase-helpers.mjs";

export const noGit = gitAvailable() ? false : "git is not installed";
const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const policy = JSON.parse(fs.readFileSync(path.join(SKILL_DIR, "policy.json"), "utf8"));

// ---- fixtures ---------------------------------------------------------------

const GOAL = Array.from({ length: 30 }, (_, i) => `word${i}`).join(" ");
const THOROUGH_GOAL = "Replace the vendor SDK wrapper because the checkout leaks";
const RESEARCH = "---\nstatus: complete\n---\n# Research\n";
const BRIEF = "---\ntype: refactor-plan\n---\n# Brief\n";
const FRAME = "# Frame Brief: demo\n\n## Reframed (or Confirmed) Problem Statement\n\nThe task.\n\n## Confidence\n\n- HIGH\n- MEDIUM\n- LOW\n\nStated: MEDIUM\n";
export const CRITICAL = "1 critical, 0 warnings";
export const CLEAN = "0 critical, 0 warnings";

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
export const FIXTURES = {
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

export const ranOf = (project) => readLogEntries(project).filter((e) => !e.skipped);
const lastRan = (project) => ranOf(project)[ranOf(project).length - 1];
const sequence = (project) => ranOf(project).map((e) => (e.template === e.step ? e.step : e.template));
export const statusOf = (project) => run(project, ["status", project.id]).json;
const finish = (project, result = { status: "done", note: "ok" }) => {
  writeResult(project, result);
  return next(project);
};

export const budgetOf = (level, shipped = policy) => shipped.limits.maxTotalSteps + shipped.rigor.budgetDelta[level];
export const pairs = (list) => list.map(([verdict, findings]) => ({ verdict, findings }));
export const SOUND = ["SOUND", CLEAN];

// The answers that lengthen a run: plan review REVISE until maxPlanRevisions (RETHINK first where frame-rethink applies),
// the first implementation review REJECTED, later ones NEEDS ATTENTION with a critical finding until maxFixLoops, then APPROVED.
export function longScript(level) {
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

export function walkFixture(name, level, { override = null, script = longScript(level), useGit = true, goal = level === "thorough" ? THOROUGH_GOAL : GOAL, fixture = FIXTURES[name] } = {}) {
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
export function longest(level, options = {}) {
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
export const TABLE = { lean: 10, standard: 17, thorough: 22 };

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
export function confirmScript(level, rounds) {
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

export function walkAware(name, level, { override = null, script, goal = level === "thorough" ? THOROUGH_GOAL : GOAL, fixture = FIXTURES[name] } = {}) {
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
export const confirmOverride = (level, rounds, { raise = true } = {}) => ({
  review: { confirmRounds: { [level]: rounds } },
  ...(raise ? { rigor: { budgetDelta: { ...policy.rigor.budgetDelta, [level]: policy.rigor.budgetDelta[level] + 2 * rounds } } } : {}),
});

export const confirmCount = (w, template) => w.sequence.filter((s) => s === template).length;
