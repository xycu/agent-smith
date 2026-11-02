// Complexity score step of the llm-complexity-scorer change (ADR-007). Black-box through the CLI, plus data checks on
// policy.json. Phase 1 covers the policy data, the scorer prompt and the test helper default (`score data`).
// Phase 2 covers scheduling, verification by file, the log copy and the neutral failures (`score gate`,
// `score validation`, `score failure`). Phase 3 covers the tier shift read from the log and the report (`score shift`,
// `score report`). These tests opt in with `policy: { score: { minRigor: "standard" } }`.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  cleanupAll, makeProject, init, next, run, writeOverride, writeResult, writeReview, planText, readMetaFile,
  readLogEntries, readReportFile, gitAvailable, gitEnv, gitInit, commitFiles,
} from "./helpers.mjs";

after(cleanupAll);

const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROMPTS_DIR = path.join(SKILL_DIR, "prompts");
const policy = JSON.parse(fs.readFileSync(path.join(SKILL_DIR, "policy.json"), "utf8"));
const SUFFIX = policy.prompts.suffix;
const GOAL = "Add a retry counter to the status output so the report shows how often each step ran again";

const parts = (value) => (Array.isArray(value) ? value : [value]);
const readOverride = (project) =>
  JSON.parse(fs.readFileSync(path.join(project.root, "context/foundation/agent-smith-policy.json"), "utf8"));

// ---- policy data ----------------------------------------------------------------

test("score data: step pins a cheap tier and is not interactive", () => {
  assert.deepEqual(policy.steps.score, { skill: null, baseTier: 0, minTier: 0, maxTier: 1 });
});

test("score data: score block ships off with the shift thresholds", () => {
  assert.deepEqual(policy.score, {
    minRigor: null,
    file: "complexity.json",
    schemaVersion: 1,
    maxBytes: 65536,
    scale: { min: 0, max: 3 },
    factors: {
      cognitive: ["ambiguity", "novelty", "coupling"],
      execution: ["discovery", "volume", "verification"],
    },
    confidences: ["low", "medium", "high"],
    maxAttempts: 3,
    maxInvalid: 2,
    shift: {
      plan: { sum: "cognitive", templates: ["plan"], up: 7, down: null },
      implement: { sum: "execution", templates: ["implement", "implement-segment", "implement-tdd", "implement-e2e"], up: 7, down: 2 },
      downMinConfidence: "medium",
      downMaxUnknowns: 2,
    },
  });
  assert.equal(policy.score.minRigor, null);
  assert.equal(policy.score.shift.plan.down, null);
  // The file name must pass the artifact-name pattern the router uses for change-folder files.
  assert.match(policy.score.file, /^[A-Za-z0-9._-]+$/);
  // Every shifted template has a prompt.
  for (const key of ["plan", "implement"]) {
    for (const template of policy.score.shift[key].templates) assert.ok(policy.prompts[template], template);
  }
});

// ---- prompt ---------------------------------------------------------------------

test("score data: prompts.score names the change, the goal and the artifacts, and refers to score.md", () => {
  const value = policy.prompts.score;
  assert.ok(Array.isArray(value));
  assert.match(value[0], /\{id\}/);
  assert.match(value[0], /\{goal\}/);
  assert.match(value[0], /\{artifacts\}/);
  assert.ok(value.includes("@prompts/score.md"));
  assert.ok(fs.existsSync(path.join(PROMPTS_DIR, "score.md")));
});

test("score data: prompts.score resolves through the router", () => {
  // The score step is not scheduled yet, so the template is resolved as the plan prompt.
  const project = makeProject({ policy: { prompts: { plan: policy.prompts.score } } });
  const res = init(project, "fix typo");
  assert.equal(res.status, 0, res.stdout);
  const guide = fs.readFileSync(path.join(PROMPTS_DIR, "score.md"), "utf8").trim().replaceAll("{id}", "demo");
  assert.equal(res.json.prompt, `Score the complexity of change demo before it is planned. Goal: fix typo\n${guide}\n\n${SUFFIX}`);
});

test("score data: prompts/score.md is listed as wired", () => {
  const readme = fs.readFileSync(path.join(PROMPTS_DIR, "README.md"), "utf8").split("\n");
  const start = readme.findIndex((line) => /^## Wired\s*$/.test(line));
  assert.ok(start >= 0, "README has a 'Wired' heading");
  const rows = [];
  for (const line of readme.slice(start + 1)) {
    if (/^## /.test(line)) break;
    if (line.startsWith("| `")) rows.push(line);
  }
  const row = rows.find((line) => line.startsWith("| `score.md` |"));
  assert.ok(row, "score.md has a row in the Wired table");
  assert.match(row, /`score` template/);
});

test("score data: scorer prompt carries the rules and a four-level rubric per factor", () => {
  const text = fs.readFileSync(path.join(PROMPTS_DIR, "score.md"), "utf8");
  const rules = text.split("\n").filter((line) => line.includes("**GIVEN**"));
  const has = (pred, what) => assert.ok(rules.some(pred), what);
  has((l) => l.includes("plan.md") && l.includes("**MUST NOT**") && l.includes("read it"), "never reads plan.md");
  has((l) => l.includes("context/changes/{id}/complexity.json") && l.includes("**MUST**"), "writes complexity.json");
  has((l) => l.includes("signals.rigor") && l.includes("**MUST NOT**"), "never adds signals.rigor");
  has((l) => l.includes("needsHuman") && l.includes("goal is empty"), "needsHuman only for an empty goal");
  has((l) => l.includes("lower `confidence` instead of lowering"), "unknowns lower confidence, not a score");
  has((l) => l.includes("generic unattended rules disagree") && l.includes("**MUST** win"), "precedence over the suffix");
  // The rubric table: one row per factor with four non-empty, distinct levels.
  const factors = [...policy.score.factors.cognitive, ...policy.score.factors.execution];
  for (const factor of factors) {
    const row = text.split("\n").find((line) => line.startsWith(`| ${factor} |`));
    assert.ok(row, `rubric row for ${factor}`);
    const levels = row.split("|").slice(2, -1).map((cell) => cell.trim());
    assert.equal(levels.length, 4, `${factor} has levels 0 to 3`);
    assert.ok(levels.every(Boolean), `${factor} has no empty level`);
    assert.equal(new Set(levels).size, 4, `${factor} levels are distinct`);
  }
  // The schema example names every factor.
  for (const factor of factors) assert.match(text, new RegExp(`"${factor}": \\{ "score": 0, "evidence": "\\.\\.\\." \\}`));
});

// ---- test helper default ---------------------------------------------------------

test("score data: makeProject keeps plan as the first step at standard", () => {
  const project = makeProject();
  assert.deepEqual(readOverride(project), { score: { minRigor: null } });
  const res = init(project, GOAL, ["--rigor", "standard"]);
  assert.equal(res.status, 0, res.stdout);
  assert.equal(res.json.step, "plan");
  assert.equal(readMetaFile(project).rigor.level, "standard");
});

test("score data: an override replaced through writeOverride keeps plan first", () => {
  const project = makeProject({ policy: { lessons: { maxCandidates: 2 } } });
  assert.deepEqual(readOverride(project), { lessons: { maxCandidates: 2 }, score: { minRigor: null } });
  writeOverride(project, { limits: { maxPlanRevisions: 1 } });
  assert.deepEqual(readOverride(project), { limits: { maxPlanRevisions: 1 }, score: { minRigor: null } });
  const res = init(project, GOAL, ["--rigor", "standard"]);
  assert.equal(res.status, 0, res.stdout);
  assert.equal(res.json.step, "plan");
});

test("score data: a test-provided score block wins whole", () => {
  const project = makeProject({ policy: { score: { minRigor: "standard" } } });
  assert.deepEqual(readOverride(project), { score: { minRigor: "standard" } });
  writeOverride(project, { score: { maxAttempts: 2 } });
  assert.deepEqual(readOverride(project), { score: { maxAttempts: 2 } });
});

// ---- Phase 2 helpers: the score step through the CLI ------------------------------

const OPT_IN = { score: { minRigor: "standard" } };
const FACTORS = [...policy.score.factors.cognitive, ...policy.score.factors.execution];
const future = () => new Date(Date.now() + 60_000);
const past = () => new Date(Date.now() - 60_000);

// A valid complexity.json value. `scores` maps factor names to scores; the rest score 1.
function scoreFile(scores = {}, over = {}) {
  const factors = {};
  for (const name of FACTORS) factors[name] = { score: scores[name] ?? 1, evidence: `goal phrase for ${name}` };
  return { schemaVersion: 1, factors, unknowns: [], confidence: "medium", ...over };
}

// The summary the router copies into run.jsonl for scoreFile(scores, over).
function summaryOf(value) {
  const factors = Object.fromEntries(FACTORS.map((name) => [name, value.factors[name].score]));
  const sum = (group) => policy.score.factors[group].reduce((total, name) => total + factors[name], 0);
  return {
    schemaVersion: value.schemaVersion,
    factors,
    cognitive: sum("cognitive"),
    execution: sum("execution"),
    confidence: value.confidence,
    unknowns: value.unknowns.length,
  };
}

// Writes complexity.json (an object as JSON, a string as it is) with a fresh mtime, or the given one.
function putScore(project, value, when = future()) {
  const abs = path.join(project.changeDir, "complexity.json");
  fs.writeFileSync(abs, typeof value === "string" ? value : JSON.stringify(value));
  fs.utimesSync(abs, when, when);
}

function put(project, file, text, when = future()) {
  const abs = path.join(project.changeDir, file);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, text);
  fs.utimesSync(abs, when, when);
}

// A project with a scratch git repository runs the router in the hermetic git environment.
const envOf = (project) => (project.git ? { env: gitEnv(project) } : {});
const finish = (project, result = { status: "done", note: "ok" }) => {
  writeResult(project, result);
  return project.git ? run(project, ["next", project.id], envOf(project)) : next(project);
};
const ranOf = (project) => readLogEntries(project).filter((e) => !e.skipped);
const skipsOf = (project) => readLogEntries(project).filter((e) => e.skipped);
const scoreRuns = (project) => ranOf(project).filter((e) => e.step === "score");
const lastRan = (project) => ranOf(project)[ranOf(project).length - 1];

// An opted-in project at standard whose first step is score.
function scoreProject(policyOver = OPT_IN, goal = GOAL) {
  const project = makeProject({ policy: policyOver });
  const res = init(project, goal, ["--rigor", "standard"]);
  assert.equal(res.status, 0, res.stdout + res.stderr);
  assert.equal(res.json.step, "score");
  return project;
}

// ---- gate -------------------------------------------------------------------------

test("score gate: the shipped default, lean and minRigor null run no score and log no skip", () => {
  // The shipped default: an override file with no score key, written without the helper.
  const shipped = makeProject();
  fs.writeFileSync(path.join(shipped.root, "context/foundation/agent-smith-policy.json"), "{}");
  const a = init(shipped, GOAL, ["--rigor", "standard"]);
  assert.equal(a.json.step, "plan");
  assert.deepEqual(skipsOf(shipped), []);

  // Opted in at standard, but the run is lean.
  const lean = makeProject({ policy: OPT_IN });
  const b = init(lean, "fix typo");
  assert.equal(b.json.step, "plan");
  assert.equal(readMetaFile(lean).rigor.level, "lean");
  assert.deepEqual(skipsOf(lean), []);

  // An explicit minRigor null.
  const off = makeProject({ policy: { score: { minRigor: null } } });
  const c = init(off, GOAL, ["--rigor", "thorough"]);
  assert.notEqual(c.json.step, "score");
  assert.ok(readLogEntries(off).every((e) => e.step !== "score"));
});

test("score gate: with the opt-in, standard returns score first on the pinned tier", () => {
  const project = makeProject({ policy: OPT_IN });
  const res = init(project, GOAL, ["--rigor", "standard"]);
  assert.equal(res.status, 0, res.stdout);
  assert.equal(res.json.action, "run");
  assert.equal(res.json.step, "score");
  assert.equal(res.json.model, policy.ladder[0].model);
  assert.equal(res.json.effort, policy.ladder[0].effort);
  assert.ok(res.json.prompt.startsWith(`Score the complexity of change demo before it is planned. Goal: ${GOAL}`));
  const e = lastRan(project);
  assert.equal(e.template, "score");
  assert.equal(e.advisory, true);
  assert.equal(e.skill, null);
});

test("score gate: at thorough the score step follows research", () => {
  const project = makeProject({ policy: OPT_IN });
  const first = init(project, "fix typo", ["--rigor", "thorough"]);
  assert.equal(first.json.step, "research");
  put(project, "research.md", "---\nstatus: complete\n---\n# Research\n");
  const second = finish(project);
  assert.equal(second.json.step, "score");
  assert.deepEqual(skipsOf(project).map((s) => s.step), ["domain-brief", "frame"]);
  putScore(project, scoreFile());
  const third = finish(project);
  assert.equal(third.json.step, "plan");
});

test("score gate: the score step runs once", () => {
  const project = scoreProject();
  putScore(project, scoreFile());
  assert.equal(finish(project).json.step, "plan");
  // The plan fails (no plan.md): the plan retries and no second score step runs.
  const res = finish(project, { status: "failed", note: "no plan" });
  assert.equal(res.json.step, "plan");
  assert.equal(scoreRuns(project).length, 1);
  assert.ok(skipsOf(project).every((s) => s.step !== "score"));
});

test("score gate: a plan with a Progress section gets no score step and no skip entry", () => {
  const project = makeProject({ plan: planText(), policy: OPT_IN });
  const res = init(project, GOAL, ["--rigor", "standard"]);
  assert.equal(res.json.step, "plan-review");
  assert.ok(readLogEntries(project).every((e) => e.step !== "score"));
});

test("score gate: a valid file skips with a logged reason and the summary", () => {
  const project = makeProject({ policy: OPT_IN });
  const value = scoreFile({ ambiguity: 3, volume: 0 }, { unknowns: ["which output"], confidence: "high" });
  putScore(project, value, past());
  const res = init(project, GOAL, ["--rigor", "standard"]);
  assert.equal(res.json.step, "plan");
  const skip = skipsOf(project).find((s) => s.step === "score");
  assert.ok(skip, "a skip entry for score");
  assert.match(skip.reason, /complexity\.json/);
  assert.equal(skip.afterN, 0);
  assert.deepEqual(skip.score, summaryOf(value));
  assert.equal(scoreRuns(project).length, 0);

  const st = run(project, ["status", "demo", "--report"]);
  assert.equal(st.status, 0, st.stdout);
  assert.ok(st.json.steps.some((s) => s.skipped && s.step === "score" && /complexity\.json/.test(s.reason)));
  assert.match(readReportFile(project), /\| 0 \| score \| [^|]*complexity\.json[^|]* \|/);
});

test("score gate: an invalid file does not skip", () => {
  const project = makeProject({ policy: OPT_IN });
  putScore(project, "{ not json", past());
  const res = init(project, GOAL, ["--rigor", "standard"]);
  assert.equal(res.json.step, "score");
  assert.deepEqual(skipsOf(project), []);
});

// ---- validation -------------------------------------------------------------------

// One failed attempt: the score step fails and retries one tier up.
function failsOnce(write, { invalid = true } = {}) {
  const project = scoreProject();
  write(project);
  const res = finish(project);
  assert.equal(res.status, 0, res.stdout);
  assert.equal(res.json.step, "score", res.stdout);
  assert.equal(res.json.model, policy.ladder[1].model);
  assert.equal(res.json.effort, policy.ladder[1].effort);
  const first = scoreRuns(project)[0];
  assert.equal(first.ok, false);
  assert.equal(first.verified, false);
  assert.equal(first.score, undefined);
  if (invalid) assert.equal(typeof first.invalid, "string");
  else assert.equal(first.invalid, undefined);
  return project;
}

const withFactor = (name, entry) => {
  const value = scoreFile();
  value.factors[name] = entry;
  return value;
};

test("score validation: a missing file fails the step and retries", () => {
  failsOnce(() => {}, { invalid: false });
});

test("score validation: a stale valid file fails the step and retries", () => {
  failsOnce((project) => putScore(project, scoreFile(), past()), { invalid: false });
});

test("score validation: bad JSON fails the step and retries", () => {
  failsOnce((project) => putScore(project, "{ \"schemaVersion\": 1,"));
  failsOnce((project) => putScore(project, "[1, 2]"));
});

test("score validation: a wrong schemaVersion fails the step and retries", () => {
  failsOnce((project) => putScore(project, scoreFile({}, { schemaVersion: 2 })));
});

test("score validation: a missing factor fails the step and retries", () => {
  failsOnce((project) => {
    const value = scoreFile();
    delete value.factors.volume;
    putScore(project, value);
  });
});

test("score validation: a score outside the scale or not an integer fails the step and retries", () => {
  failsOnce((project) => putScore(project, scoreFile({ coupling: 4 })));
  failsOnce((project) => putScore(project, scoreFile({ coupling: 1.5 })));
  failsOnce((project) => putScore(project, scoreFile({ coupling: -1 })));
  failsOnce((project) => putScore(project, scoreFile({ coupling: "2" })));
});

test("score validation: empty evidence fails the step and retries", () => {
  failsOnce((project) => putScore(project, withFactor("novelty", { score: 1, evidence: "   " })));
  failsOnce((project) => putScore(project, withFactor("novelty", { score: 1 })));
});

test("score validation: unknowns not an array fails the step and retries", () => {
  failsOnce((project) => putScore(project, scoreFile({}, { unknowns: "none" })));
});

test("score validation: an unknown confidence fails the step and retries", () => {
  failsOnce((project) => putScore(project, scoreFile({}, { confidence: "certain" })));
});

test("score validation: a symlink fails the step and retries", () => {
  failsOnce((project) => {
    const target = path.join(project.root, "elsewhere.json");
    fs.writeFileSync(target, JSON.stringify(scoreFile()));
    const when = future();
    fs.utimesSync(target, when, when);
    fs.symlinkSync(target, path.join(project.changeDir, "complexity.json"));
  });
});

test("score validation: an oversize file fails the step and retries", () => {
  failsOnce((project) => putScore(project, scoreFile({}, { pad: "x".repeat(policy.score.maxBytes) })));
});

test("score validation: false evidence text is accepted and the summary lands on the ok entry", () => {
  const project = scoreProject();
  const value = scoreFile({ ambiguity: 0, novelty: 2, coupling: 3, discovery: 0, volume: 2, verification: 1 }, {
    unknowns: ["a", "b"],
    confidence: "low",
    extra: "ignored",
  });
  value.factors.ambiguity.evidence = "the moon is made of cheese";
  putScore(project, value);
  const res = finish(project);
  assert.equal(res.json.step, "plan");
  const e = scoreRuns(project)[0];
  assert.equal(e.ok, true);
  assert.equal(e.verified, true);
  assert.equal(e.invalid, undefined);
  assert.deepEqual(e.score, { schemaVersion: 1, factors: { ambiguity: 0, novelty: 2, coupling: 3, discovery: 0, volume: 2, verification: 1 }, cognitive: 5, execution: 3, confidence: "low", unknowns: 2 });
  // Evidence text is not copied.
  assert.ok(!JSON.stringify(readLogEntries(project)).includes("cheese"));
});

// ---- failure ----------------------------------------------------------------------

test("score failure: three failed attempts skip, the plan follows and nothing halts", () => {
  const project = scoreProject();
  assert.equal(finish(project, { status: "failed", note: "no file one" }).json.step, "score");
  assert.equal(finish(project, { status: "failed", note: "no file two" }).json.step, "score");
  const res = finish(project, { status: "failed", note: "no file three" });
  assert.equal(res.status, 0, res.stdout);
  assert.equal(res.json.action, "run");
  assert.equal(res.json.step, "plan");
  assert.equal(scoreRuns(project).length, 3);
  assert.ok(scoreRuns(project).every((e) => e.ok === false && e.advisory === true));
  const skip = skipsOf(project).find((s) => s.step === "score");
  assert.ok(skip, "a skip entry for score");
  assert.equal(skip.afterN, 3);
  assert.match(skip.reason, /no file three/);
  assert.match(skip.reason, /going on with deterministic signals/);
  // Failed score attempts raise no rigor.
  assert.equal(readMetaFile(project).rigor.level, "standard");
  // The plan gets no failure bump from the score attempts.
  assert.doesNotMatch(lastRan(project).tierWhy, /failed attempt/);
});

test("score failure: two invalid files skip", () => {
  const project = scoreProject();
  putScore(project, "{");
  assert.equal(finish(project).json.step, "score");
  putScore(project, scoreFile({}, { confidence: "certain" }));
  const res = finish(project);
  assert.equal(res.json.step, "plan");
  assert.equal(scoreRuns(project).length, 2);
  const skip = skipsOf(project).find((s) => s.step === "score");
  assert.ok(skip);
  assert.match(skip.reason, /2 invalid/);
  assert.match(skip.reason, /going on with deterministic signals/);
});

test("score failure: the simple-change discount survives failed score attempts", () => {
  const project = scoreProject();
  for (let i = 0; i < 3; i++) finish(project, { status: "failed", note: `fail ${i}` });
  assert.equal(lastRan(project).step, "plan");
  put(project, "plan.md", planText());
  assert.equal(finish(project).json.step, "plan-review");
  // One warning: no clean-review drop, so the clamp does not absorb the discount.
  writeReview(project, "plan-review", { findings: "0 critical, 1 warnings" });
  fs.utimesSync(path.join(project.changeDir, "reviews/plan-review.md"), future(), future());
  const res = finish(project);
  assert.equal(res.json.step, "implement");
  const e = lastRan(project);
  assert.equal(e.simple, true, e.tierWhy);
  assert.match(e.tierWhy, /simple change/);
});

test("score failure: a score result's signals.rigor leaves the level unchanged", () => {
  const project = scoreProject();
  putScore(project, scoreFile());
  const res = finish(project, { status: "done", note: "ok", signals: { rigor: "thorough", needsHuman: 3 } });
  assert.equal(res.json.step, "plan");
  assert.equal(readMetaFile(project).rigor.level, "standard");
  const e = scoreRuns(project)[0];
  assert.equal(e.signals?.rigor, undefined);
});

test("score failure: failed score attempts use no step budget", () => {
  const project = scoreProject({ ...OPT_IN, limits: { maxTotalSteps: 2 }, rigor: { budgetDelta: { standard: 0 } } });
  for (let i = 0; i < 3; i++) finish(project, { status: "failed", note: `fail ${i}` });
  assert.equal(lastRan(project).step, "plan");
  put(project, "plan.md", planText());
  const res = finish(project);
  assert.equal(res.json.action, "run", res.stdout);
  assert.equal(res.json.step, "plan-review");
  // The two counted steps spend the budget.
  writeReview(project, "plan-review");
  fs.utimesSync(path.join(project.changeDir, "reviews/plan-review.md"), future(), future());
  const end = finish(project);
  assert.equal(end.json.action, "halt");
  assert.match(end.json.reason, /Step budget 2 spent/);
});

test("score failure: a score result with needsHuman halts once with a report", () => {
  const project = scoreProject();
  const res = finish(project, { status: "blocked", note: "nothing to score", signals: { needsHuman: "the goal is empty" } });
  assert.equal(res.json.action, "halt");
  assert.match(res.json.reason, /Step 1 \(score\) needs a human: the goal is empty/);
  assert.ok(res.json.report);
  assert.ok(fs.existsSync(path.join(project.agentDir, "report.md")));
  const again = next(project);
  assert.equal(again.json.action, "run");
  assert.equal(again.json.step, "score");
});

// ---- Phase 3 helpers: tiers from the logged score ----------------------------------

const gitSkip = gitAvailable() ? false : "git is not installed";
// GOAL is a short goal (25 words or fewer): its first plan sits on the effort floor. PLAIN_GOAL is longer.
const PLAIN_GOAL = `${GOAL} and also lists, for every step that ran again, the note of the attempt that failed before it in one line`;
const HARD_GOAL = "Refactor the status output so the report shows how often each step ran again after a failure";
const ONE_WARNING = { findings: "0 critical, 1 warnings" };
// Scores that move nothing (sums 3 and 3), a high cognitive sum, a high and a low execution sum.
const QUIET = () => scoreFile();
const HIGH_COGNITIVE = (over) => scoreFile({ ambiguity: 3, novelty: 3, coupling: 1 }, over);
const HIGH_EXECUTION = (over) => scoreFile({ discovery: 3, volume: 3, verification: 1 }, over);
const LOW_EXECUTION = (over) => scoreFile({ discovery: 0, volume: 0, verification: 1 }, over);
const shiftOf = (e) => e.scoreShift;

// 10 commits: f9.js and f4.js are hot, g1.js to g4.js are cold, README.md is excluded. Risk is measured for a plan
// that names g1.js. Same shape as the churn tests.
function coldRepo(project) {
  gitInit(project);
  for (let i = 1; i <= 9; i++) {
    const files = ["f9.js"];
    if (i <= 4) files.push("f4.js", `g${i}.js`);
    commitFiles(project, files, { message: `c${i}` });
  }
  commitFiles(project, ["README.md"], { message: "c10" });
  project.git = true;
}

function gitProject(policyOver = OPT_IN) {
  const project = makeProject({ policy: policyOver });
  coldRepo(project);
  return project;
}

const twoPhases = (file = "g1.js") => planText({ phases: 2, files: file ? [`**File**: \`${file}\``] : [] });

// Walks an opted-in project through score (with `value`), plan and plan review. Returns the response that follows
// the plan review: the first implement step for a plan with pending rows.
function toImplement(project, value, { plan = twoPhases(), goal = PLAIN_GOAL, rigor = "standard", review = ONE_WARNING } = {}) {
  let res = run(project, ["init", project.id, "--goal", goal, "--rigor", rigor], envOf(project));
  assert.equal(res.json?.step, "score", res.stdout);
  putScore(project, value);
  res = finish(project);
  assert.equal(res.json.step, "plan", res.stdout);
  put(project, "plan.md", plan);
  res = finish(project);
  assert.equal(res.json.step, "plan-review", res.stdout);
  writeReview(project, "plan-review", review);
  fs.utimesSync(path.join(project.changeDir, "reviews/plan-review.md"), future(), future());
  return finish(project);
}

// The first plan step of an opted-in project at standard, scored with `value`.
function firstPlan(value, { goal = PLAIN_GOAL, policyOver = OPT_IN } = {}) {
  const project = makeProject({ policy: policyOver });
  const res = init(project, goal, ["--rigor", "standard"]);
  assert.equal(res.json.step, "score", res.stdout);
  putScore(project, value);
  const plan = finish(project);
  assert.equal(plan.json.step, "plan", plan.stdout);
  return { project, res: plan, e: lastRan(project) };
}

// ---- shift: up --------------------------------------------------------------------

test("score shift: a cognitive sum of 7 moves a plain-goal first plan from 3 to 4", () => {
  const control = firstPlan(scoreFile({ ambiguity: 3, novelty: 2, coupling: 1 })).e;
  assert.equal(control.tier, 3, control.tierWhy);
  assert.equal(shiftOf(control), undefined);

  const { e } = firstPlan(HIGH_COGNITIVE());
  assert.equal(e.tier, 4, e.tierWhy);
  assert.deepEqual(shiftOf(e), { sum: "cognitive", value: 7, shift: 1, effective: 1 });
  assert.match(e.tierWhy, /\+1 score \(cognitive 7\/9, confidence medium\)/);
});

test("score shift: a hard-keyword first plan moves from 4 to 5", () => {
  const control = firstPlan(QUIET(), { goal: HARD_GOAL }).e;
  assert.equal(control.tier, 4, control.tierWhy);
  const { e } = firstPlan(HIGH_COGNITIVE(), { goal: HARD_GOAL });
  assert.equal(e.tier, 5, e.tierWhy);
  assert.equal(shiftOf(e).effective, 1);
});

test("score shift: the up shift has no guards: low confidence and 3 unknowns", () => {
  const { e } = firstPlan(HIGH_COGNITIVE({ confidence: "low", unknowns: ["a", "b", "c"] }));
  assert.equal(e.tier, 4, e.tierWhy);
  assert.equal(shiftOf(e).shift, 1);
});

test("score shift: an execution sum of 7 moves implement up one rung", { skip: gitSkip }, () => {
  const project = gitProject();
  const res = toImplement(project, HIGH_EXECUTION());
  assert.equal(res.json.step, "implement", res.stdout);
  const e = lastRan(project);
  assert.equal(e.tier, 4, e.tierWhy);
  assert.deepEqual(shiftOf(e), { sum: "execution", value: 7, shift: 1, effective: 1 });
});

test("score shift: the implement up shift also applies with a hot path, unmeasured risk, a phase bump or a discount", { skip: gitSkip }, () => {
  const hot = gitProject();
  toImplement(hot, HIGH_EXECUTION(), { plan: twoPhases("f9.js") });
  assert.equal(lastRan(hot).tier, 4, lastRan(hot).tierWhy);

  const unmeasured = makeProject({ policy: OPT_IN });
  toImplement(unmeasured, HIGH_EXECUTION());
  assert.equal(lastRan(unmeasured).tier, 4, lastRan(unmeasured).tierWhy);

  const phases = gitProject();
  toImplement(phases, HIGH_EXECUTION(), { plan: planText({ phases: 3, files: ["**File**: `g1.js`"] }) });
  assert.equal(lastRan(phases).tier, 5, lastRan(phases).tierWhy);

  const discount = gitProject();
  toImplement(discount, HIGH_EXECUTION(), { plan: planText({ phases: 1, files: ["**File**: `g1.js`"] }) });
  const d = lastRan(discount);
  assert.equal(d.tier, 3, d.tierWhy);
  assert.equal(shiftOf(d).shift, 1);
});

// ---- shift: plan down is off ----------------------------------------------------------

test("score shift: a low cognitive sum never moves the first plan down", () => {
  const low = scoreFile({ ambiguity: 0, novelty: 0, coupling: 0 }, { confidence: "high" });
  const { e } = firstPlan(low);
  assert.equal(e.tier, 3, e.tierWhy);
  assert.equal(shiftOf(e), undefined);
  // An override threshold changes nothing: churn risk is never measured before the first plan.
  const over = firstPlan(low, { policyOver: { score: { minRigor: "standard", shift: { plan: { down: 2 } } } } }).e;
  assert.equal(over.tier, 3, over.tierWhy);
  assert.equal(shiftOf(over), undefined);
});

// ---- shift: implement down ------------------------------------------------------------

test("score shift: a low execution sum moves plain implement from 3 to 2 with measured risk and no hot path", { skip: gitSkip }, () => {
  const project = gitProject();
  const res = toImplement(project, LOW_EXECUTION());
  assert.equal(res.json.step, "implement", res.stdout);
  const e = lastRan(project);
  assert.equal(e.template, "implement");
  assert.equal(e.tier, 2, e.tierWhy);
  assert.equal(e.model, policy.ladder[2].model);
  assert.equal(e.effort, policy.ladder[2].effort);
  assert.deepEqual(shiftOf(e), { sum: "execution", value: 1, shift: -1, effective: -1 });
  assert.match(e.tierWhy, /-1 score \(execution 1\/9, confidence medium\)/);
  assert.equal(readMetaFile(project).rigor.level, "standard");
});

// Each case must leave plain implement at tier 3 with no shift recorded.
const noDown = [
  ["confidence low", () => [gitProject(), LOW_EXECUTION({ confidence: "low" }), {}]],
  ["3 unknowns", () => [gitProject(), LOW_EXECUTION({ unknowns: ["a", "b", "c"] }), {}]],
  ["a hot plan path", () => [gitProject(), LOW_EXECUTION(), { plan: twoPhases("f9.js") }]],
  ["risk unavailable (no git)", () => [makeProject({ policy: OPT_IN }), LOW_EXECUTION(), {}]],
  ["a plan that names no path", () => [gitProject(), LOW_EXECUTION(), { plan: twoPhases(null) }]],
  ["an unclassified plan token", () => [gitProject(), LOW_EXECUTION(), { plan: twoPhases("/etc/hosts") }]],
];
for (const [name, build] of noDown) {
  test(`score shift: no implement down shift on ${name}`, { skip: gitSkip }, () => {
    const [project, value, opts] = build();
    const res = toImplement(project, value, opts);
    assert.equal(res.json.step, "implement", res.stdout);
    const e = lastRan(project);
    assert.equal(e.tier, 3, `${name}: ${e.tierWhy}`);
    assert.equal(shiftOf(e), undefined, name);
    assert.doesNotMatch(e.tierWhy, /score/, name);
  });
}

test("score shift: no implement down shift after a failed step", { skip: gitSkip }, () => {
  const project = gitProject();
  run(project, ["init", project.id, "--goal", GOAL, "--rigor", "standard"], envOf(project));
  putScore(project, LOW_EXECUTION());
  assert.equal(finish(project).json.step, "plan");
  assert.equal(finish(project, { status: "failed", note: "no plan" }).json.step, "plan");
  put(project, "plan.md", twoPhases());
  assert.equal(finish(project).json.step, "plan-review");
  writeReview(project, "plan-review", ONE_WARNING);
  fs.utimesSync(path.join(project.changeDir, "reviews/plan-review.md"), future(), future());
  assert.equal(finish(project).json.step, "implement");
  const e = lastRan(project);
  assert.equal(e.tier, 3, e.tierWhy);
  assert.equal(shiftOf(e), undefined);
});

test("score shift: no implement down shift with a simple-change discount or a phase-count bump", { skip: gitSkip }, () => {
  const simple = gitProject();
  toImplement(simple, LOW_EXECUTION(), { plan: planText({ phases: 1, files: ["**File**: `g1.js`"] }) });
  const s = lastRan(simple);
  assert.equal(s.tier, 2, s.tierWhy);
  assert.equal(s.simple, true);
  assert.equal(shiftOf(s), undefined);

  const bumped = gitProject();
  toImplement(bumped, scoreFile({ discovery: 0, volume: 0, verification: 0 }, { confidence: "high" }), {
    plan: planText({ phases: 3, files: ["**File**: `g1.js`"] }),
  });
  const b = lastRan(bumped);
  assert.equal(b.tier, 4, b.tierWhy);
  assert.equal(shiftOf(b), undefined);
});

test("score shift: no implement down shift once the diff touches a hot path", { skip: gitSkip }, () => {
  const project = gitProject();
  toImplement(project, LOW_EXECUTION());
  assert.equal(lastRan(project).tier, 2, lastRan(project).tierWhy);
  // The first implement step finishes phase 1 and commits a hot file; phase 2 is still pending.
  put(project, "plan.md", planText({ phases: 2, done: 1, files: ["**File**: `g1.js`"] }));
  commitFiles(project, ["f9.js"], { message: "touch hot" });
  const res = finish(project);
  assert.equal(res.json.step, "implement", res.stdout);
  const e = lastRan(project);
  assert.equal(e.tier, 3, e.tierWhy);
  assert.equal(shiftOf(e), undefined);
});

// ---- shift: bounds ------------------------------------------------------------------

// Two code phases whose rows name a test command: at thorough both go to the tdd executor.
function tddPlan() {
  const phase = (n) => `## Phase ${n}: Logic ${n}\n\n**File**: \`g${n}.js\`\n`;
  const progress = (n) => `### Phase ${n}: Logic ${n}\n\n#### Automated\n\n- [ ] ${n}.1 Unit tests pass: \`node --test g${n}.test.mjs\`\n\n#### Manual\n\n- [ ] ${n}.9 Look at it\n`;
  return `# Plan\n\n${phase(1)}\n${phase(2)}\n## Progress\n\n${progress(1)}\n${progress(2)}`;
}

test("score shift: an implement-tdd step at thorough never goes below the effort floor", { skip: gitSkip }, () => {
  const project = gitProject();
  put(project, "research.md", "---\nstatus: complete\n---\n# Research\n", past());
  const res = toImplement(project, scoreFile({ discovery: 0, volume: 0, verification: 0 }, { confidence: "high" }), {
    plan: tddPlan(), rigor: "thorough",
  });
  assert.equal(res.json.step, "implement", res.stdout);
  const e = lastRan(project);
  assert.equal(e.template, "implement-tdd");
  assert.equal(e.tier, 3, e.tierWhy);
  assert.deepEqual(shiftOf(e), { sum: "execution", value: 0, shift: -1, effective: 0 });
  assert.match(e.tierWhy, /-1 score not applied \(clamp or floor\)/);
});

test("score shift: maxTier bounds the up shift and records effective 0", () => {
  const nine = scoreFile({ ambiguity: 3, novelty: 3, coupling: 3 });
  const { e } = firstPlan(nine, { goal: HARD_GOAL, policyOver: { ...OPT_IN, steps: { plan: { maxTier: 4 } } } });
  assert.equal(e.tier, 4, e.tierWhy);
  assert.deepEqual(shiftOf(e), { sum: "cognitive", value: 9, shift: 1, effective: 0 });
  assert.match(e.tierWhy, /\+1 score not applied \(clamp or floor\)/);
});

// ---- shift: scope -------------------------------------------------------------------

test("score shift: plan reads cognitive only and implement reads execution only", { skip: gitSkip }, () => {
  // High execution, quiet cognitive: the plan stays, implement moves.
  const project = gitProject();
  toImplement(project, HIGH_EXECUTION());
  const [plan, review, impl] = ranOf(project).slice(1);
  assert.equal(plan.tier, 3, plan.tierWhy);
  assert.equal(shiftOf(plan), undefined);
  assert.equal(shiftOf(review), undefined);
  assert.equal(shiftOf(impl).sum, "execution");
  // High cognitive, quiet execution: the plan moves, implement stays.
  const other = gitProject();
  toImplement(other, HIGH_COGNITIVE());
  const [plan2, , impl2] = ranOf(other).slice(1);
  assert.equal(shiftOf(plan2).sum, "cognitive");
  assert.equal(impl2.tier, 3, impl2.tierWhy);
  assert.equal(shiftOf(impl2), undefined);
});

test("score shift: a plan-revise step and the review and fix steps get no shift", () => {
  const all = scoreFile({ ambiguity: 3, novelty: 3, coupling: 3, discovery: 3, volume: 3, verification: 3 });
  const project = makeProject({ policy: OPT_IN });
  toImplement(project, all, { review: { verdict: "REVISE", findings: "1 critical, 0 warnings" } });
  const revise = lastRan(project);
  assert.equal(revise.template, "plan-revise");
  assert.equal(shiftOf(revise), undefined);
  assert.doesNotMatch(revise.tierWhy, /score/);

  const done = makeProject({ policy: OPT_IN });
  toImplement(done, all, { plan: planText({ phases: 2 }) });
  put(done, "plan.md", planText({ phases: 2, done: 2 }));
  let res = finish(done);
  for (let i = 0; i < 3 && res.json.step !== "impl-review"; i++) res = finish(done);
  assert.equal(res.json.step, "impl-review", res.stdout);
  writeReview(done, "impl-review", { verdict: "NEEDS ATTENTION", findings: "1 critical, 0 warnings" });
  fs.utimesSync(path.join(done.changeDir, "reviews/impl-review.md"), future(), future());
  res = finish(done);
  assert.equal(res.json.step, "fix", res.stdout);
  for (const e of ranOf(done).filter((x) => ["plan-review", "impl-review", "fix", "manual-verify"].includes(x.step))) {
    assert.equal(shiftOf(e), undefined, e.step);
  }
});

test("score shift: a retried first plan and a repeated implement keep the up shift on top of the failure bump", () => {
  const project = makeProject({ policy: OPT_IN });
  const all = scoreFile({ ambiguity: 3, novelty: 3, coupling: 3, discovery: 3, volume: 3, verification: 3 });
  init(project, PLAIN_GOAL, ["--rigor", "standard"]);
  putScore(project, all);
  assert.equal(finish(project).json.step, "plan");
  assert.equal(lastRan(project).tier, 4);
  assert.equal(finish(project, { status: "failed", note: "no plan" }).json.step, "plan");
  const retry = lastRan(project);
  assert.equal(retry.template, "plan");
  assert.equal(retry.tier, 5, retry.tierWhy);
  assert.equal(shiftOf(retry).effective, 1);

  put(project, "plan.md", twoPhases(null));
  assert.equal(finish(project).json.step, "plan-review");
  writeReview(project, "plan-review", ONE_WARNING);
  fs.utimesSync(path.join(project.changeDir, "reviews/plan-review.md"), future(), future());
  assert.equal(finish(project).json.step, "implement");
  assert.equal(lastRan(project).tier, 4, lastRan(project).tierWhy);
  assert.equal(finish(project, { status: "failed", note: "no rows" }).json.step, "implement");
  const again = lastRan(project);
  assert.equal(again.template, "implement");
  assert.equal(again.tier, 5, again.tierWhy);
  assert.equal(shiftOf(again).effective, 1);
});

// ---- shift: stability ---------------------------------------------------------------

test("score shift: editing or deleting complexity.json after the score step changes neither tiers nor the report", () => {
  const project = makeProject({ policy: OPT_IN });
  init(project, PLAIN_GOAL, ["--rigor", "standard"]);
  putScore(project, HIGH_COGNITIVE());
  assert.equal(finish(project).json.step, "plan");
  // A quiet file now: the logged copy still decides.
  putScore(project, QUIET());
  finish(project, { status: "failed", note: "no plan" });
  assert.equal(lastRan(project).tier, 5, lastRan(project).tierWhy);
  const report = () => {
    const st = run(project, ["status", "demo", "--report"]);
    assert.equal(st.status, 0, st.stdout);
    return readReportFile(project);
  };
  const before = report();
  fs.rmSync(path.join(project.changeDir, "complexity.json"));
  finish(project, { status: "failed", note: "no plan again" });
  assert.equal(lastRan(project).tier, 6, lastRan(project).tierWhy);
  assert.equal(shiftOf(lastRan(project)).effective, 1);
  const section = (text) => text.slice(text.indexOf("## Complexity score"));
  assert.match(before, /## Complexity score/);
  assert.equal(section(report()).split("\n").slice(0, 6).join("\n"), section(before).split("\n").slice(0, 6).join("\n"));
});

test("score shift: a run without a score summary has today's tiers and the same rigor", () => {
  const walk = (project, failScore) => {
    const res = init(project, GOAL, ["--rigor", "standard"]);
    if (failScore) {
      assert.equal(res.json.step, "score");
      for (let i = 0; i < 3; i++) finish(project, { status: "failed", note: `fail ${i}` });
    }
    assert.equal(lastRan(project).step, "plan");
    put(project, "plan.md", twoPhases(null));
    finish(project);
    writeReview(project, "plan-review", ONE_WARNING);
    fs.utimesSync(path.join(project.changeDir, "reviews/plan-review.md"), future(), future());
    finish(project);
    return ranOf(project).filter((e) => e.step !== "score").map(({ step, template, tier, model, effort, tierWhy, simple }) => ({ step, template, tier, model, effort, tierWhy, simple }));
  };
  const off = makeProject();
  const skipped = makeProject({ policy: OPT_IN });
  assert.deepEqual(walk(skipped, true), walk(off, false));
  assert.equal(readMetaFile(skipped).rigor.level, readMetaFile(off).rigor.level);
});

// ---- report -------------------------------------------------------------------------

test("score report: the section lists the sums, the factors and every shift, and an absorbed shift reads not applied", { skip: gitSkip }, () => {
  const nine = scoreFile({ ambiguity: 3, novelty: 3, coupling: 3, discovery: 0, volume: 0, verification: 0 }, { confidence: "high", unknowns: ["one"] });
  const project = gitProject({ ...OPT_IN, steps: { plan: { maxTier: 4 } } });
  toImplement(project, nine, { goal: HARD_GOAL });
  const st = run(project, ["status", "demo", "--report"], envOf(project));
  assert.equal(st.status, 0, st.stdout);
  const report = readReportFile(project);
  assert.match(report, /^## Complexity score$/m);
  assert.match(report, /cognitive 9/);
  assert.match(report, /execution 0/);
  assert.match(report, /ambiguity 3, novelty 3, coupling 3, discovery 0, volume 0, verification 0/);
  assert.match(report, /Confidence: high/);
  assert.match(report, /Unknowns: 1/);
  assert.match(report, /^- plan \+1 not applied \(clamp or floor\) \(step 2\)$/m);
  assert.match(report, /^- implement -1 \(step 4\)$/m);
  // The table still lists the score step.
  assert.match(report, /^\| 1 \| score \| /m);
});

test("score report: no section without a score, a section from a skip with a valid file", () => {
  const off = makeProject();
  init(off, GOAL, ["--rigor", "standard"]);
  run(off, ["status", "demo", "--report"]);
  assert.doesNotMatch(readReportFile(off), /Complexity score/);

  const failed = scoreProject();
  for (let i = 0; i < 3; i++) finish(failed, { status: "failed", note: `fail ${i}` });
  run(failed, ["status", "demo", "--report"]);
  assert.doesNotMatch(readReportFile(failed), /Complexity score/);

  const skipped = makeProject({ policy: OPT_IN });
  putScore(skipped, HIGH_COGNITIVE(), past());
  init(skipped, PLAIN_GOAL, ["--rigor", "standard"]);
  run(skipped, ["status", "demo", "--report"]);
  const report = readReportFile(skipped);
  assert.match(report, /^## Complexity score$/m);
  assert.match(report, /cognitive 7/);
  assert.match(report, /^- plan \+1 \(step 1\)$/m);
});

test("score report: status shows the score, the skip summary, invalid and scoreShift", () => {
  const project = scoreProject(OPT_IN, PLAIN_GOAL);
  putScore(project, "{");
  finish(project);
  putScore(project, HIGH_COGNITIVE());
  finish(project);
  const st = run(project, ["status", "demo"]);
  assert.equal(st.status, 0, st.stdout);
  const [bad, good, plan] = st.json.steps;
  assert.equal(bad.step, "score");
  assert.equal(bad.invalid, "not valid JSON");
  assert.equal(bad.score, undefined);
  assert.deepEqual(good.score, summaryOf(HIGH_COGNITIVE()));
  assert.equal(good.invalid, undefined);
  assert.deepEqual(plan.scoreShift, { sum: "cognitive", value: 7, shift: 1, effective: 1 });
  assert.equal(good.scoreShift, undefined);

  const skipped = makeProject({ policy: OPT_IN });
  putScore(skipped, QUIET(), past());
  init(skipped, GOAL, ["--rigor", "standard"]);
  const s = run(skipped, ["status", "demo"]).json.steps.find((x) => x.skipped && x.step === "score");
  assert.deepEqual(s.score, summaryOf(QUIET()));
});
