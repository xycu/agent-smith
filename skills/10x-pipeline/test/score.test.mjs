// Complexity score step of the llm-complexity-scorer change (ADR-007). Black-box through the CLI, plus data checks on
// policy.json. Phase 1 covers the policy data, the scorer prompt and the test helper default (`score data`).
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cleanupAll, makeProject, init, writeOverride, readMetaFile } from "./helpers.mjs";

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
