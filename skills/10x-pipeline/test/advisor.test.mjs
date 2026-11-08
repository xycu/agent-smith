// Tests for the opt-in advisor (ADR-009): no advisor text with the default policy, the place of the advisor rules in
// the prompts of the listed templates, the `advisor` log flag, malformed `advisor` blocks, the prompt file, the
// provenance link and the docs. Black-box through the CLI in scratch projects. Test names start with the plan row
// number. A test turns the advisor on with `policy: { advisor: { enabled: true } }`. No repository file is edited.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  cleanupAll, makeProject, planText, writePlan, writeReview, run, init, next, writeResult, readMetaFile, readLogEntries,
  writeLog, writeMetaFile, entry, gitAvailable, gitEnv, gitInit, commitFiles,
} from "./helpers.mjs";
import { buildPlan } from "./phase-helpers.mjs";

after(cleanupAll);

const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO = path.resolve(SKILL_DIR, "../..");
const readRepo = (rel) => fs.readFileSync(path.join(REPO, rel), "utf8");
const DEFAULT = JSON.parse(fs.readFileSync(path.join(SKILL_DIR, "policy.json"), "utf8"));
const SUFFIX = DEFAULT.prompts.suffix;
const ADVISOR_FILE = path.join(SKILL_DIR, "prompts/advisor.md");
const ADVISOR_SOURCE = fs.readFileSync(ADVISOR_FILE, "utf8");
// The advisor rules as the router appends them: the trimmed file text (it has no {placeholder}, see 3.4).
const ADVISOR = ADVISOR_SOURCE.trim();
const RULE_LINES = ADVISOR_SOURCE.split("\n").filter((line) => line.includes("**GIVEN**"));
const ON = { advisor: { enabled: true } };
const LISTED = ["plan", "implement", "implement-segment"];
// Keys of policy.prompts that are not the template of a step: the suffix, the advisor rules and the frame authority line.
const NOT_TEMPLATES = ["suffix", "advisor", "frame-authority", "worktree"];
const HEX16 = /^[0-9a-f]{16}$/;
const BOLD_KEYWORD = /\*\*(MUST NOT|MUST|SHOULD NOT|SHOULD|MAY)\*\*/g;
const BARE_KEYWORD = /\b(MUST|SHOULD|MAY|SHALL|REQUIRED|RECOMMENDED|OPTIONAL)\b/;
const noGit = !gitAvailable();

const has = (obj, key) => Object.hasOwn(obj, key);
const count = (text, part) => text.split(part).length - 1;
const ranOf = (project) => readLogEntries(project).filter((e) => !e.skipped);
const future = () => new Date(Date.now() + 60_000);

// The prompt of a listed template with the advisor on: the default prompt with the advisor rules between the rendered
// template and the suffix, each part separated by one blank line.
function withAdvisor(prompt) {
  const tail = "\n\n" + SUFFIX;
  assert.ok(prompt.endsWith(tail), "the default prompt ends with the suffix");
  return prompt.slice(0, -tail.length) + "\n\n" + ADVISOR + tail;
}

// The problems of one rule line in the form of ADR-004 (the full check runs in rules.test.mjs).
function ruleProblems(line) {
  const problems = [];
  const [given, when, then] = ["**GIVEN**", "**WHEN**", "**THEN**"].map((k) => line.indexOf(k));
  if (!(given >= 0 && given < when && when < then)) problems.push("GIVEN, WHEN, THEN missing or out of order");
  const keywords = [...line.matchAll(BOLD_KEYWORD)];
  if (keywords.length !== 1) problems.push(`${keywords.length} bold keywords, expected 1`);
  else if (keywords[0].index < then) problems.push("keyword before THEN");
  const bare = line.replace(/\*\*[^*]+\*\*/g, " ").match(BARE_KEYWORD);
  if (bare) problems.push(`unbolded keyword ${bare[1]}`);
  return problems;
}

// ---- fixtures: one project per template ------------------------------------------------

const RESEARCH = "---\nstatus: complete\n---\n# Research\n";
const GOAL = "Add a retry counter to the status output so the report shows how often each step ran again";
const E2E_GOAL = "Cover the login flow in the browser";
const GOAL_ROW = "Parser keeps blank lines: `node --test test/parser.test.mjs`";
const E2E_ROW = "Playwright spec covers the login flow: `npx playwright test tests/e2e/login.spec.ts`";
const goalPhase = { name: "Parser", auto: [GOAL_ROW, `${GOAL_ROW} again`] };
const e2ePhase = { name: "Login flow", auto: [E2E_ROW, `${E2E_ROW} twice`] };
const tddPhase = { name: "Parser", files: ["`src/parser.mjs`"], auto: [GOAL_ROW, `${GOAL_ROW} again`] };
const SETUP_MD = [
  "# Test stack", "", "## E2E", "",
  "- runner: Playwright Test, @playwright/test 1.50.0",
  "- config: playwright.config.ts",
  "- single-spec command: npx playwright test tests/e2e/<name>.spec.ts",
  "- seed: `tests/e2e/seed.spec.ts` — protects the login redirect",
  "",
].join("\n");
const DISTILLATION = [
  "# Domain distillation", "", "## Invariants and policies", "",
  "| id | candidate | invariant (quoted) | source | status | guarded at | gap |",
  "| --- | --- | --- | --- | --- | --- | --- |",
  "| R-1 | World | \"A world has one slug\" | spec | **declared** | `a.js:1` | none |",
  "", "## Model vs code drift", "",
].join("\n");

// A file in the change folder, with a fresh mtime so the router sees it as written after any step start.
function put(project, file, text) {
  const abs = path.join(project.changeDir, file);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, text);
  fs.utimesSync(abs, future(), future());
}

function putRoot(project, file, text) {
  const abs = path.join(project.root, file);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, text);
}

function review(project, name, verdict, findings = "0 critical, 0 warnings") {
  writeReview(project, name, { verdict, findings });
  fs.utimesSync(path.join(project.changeDir, "reviews", `${name}.md`), future(), future());
}

// A project whose plan, reviews and log stand right before the step under test.
function staged(policy, { plan = planText(), reviews = [], log = [] } = {}) {
  const project = makeProject({ plan, policy });
  for (const [name, verdict, findings] of reviews) review(project, name, verdict, findings);
  if (log.length) writeLog(project, log);
  return project;
}

const thorough = (project, goal = "fix typo") => init(project, goal, ["--rigor", "thorough"]);
const standard = (project, goal = "Parse blank lines", extra = []) => init(project, goal, ["--rigor", "standard", ...extra]);

// The plan with the phases of `specs`; `ticked` lists the phase numbers that are done.
const planWith = (specs, ticked = []) =>
  buildPlan(specs.map((ph, i) => ({ ...ph, auto: ph.auto.map((text) => ({ text, done: ticked.includes(i + 1) })) })));

// A project at a fresh plan review with the given phases and the /10x-e2e-setup record.
function executorProject(policy, specs, { setup = true, useGit = false } = {}) {
  const project = staged(policy, { plan: planWith(specs), reviews: [["plan-review", "SOUND"]], log: [entry(1, "plan"), entry(2, "plan-review")] });
  if (setup) {
    putRoot(project, "context/foundation/test-stack.md", SETUP_MD);
    for (const f of ["playwright.config.ts", "tests/e2e/seed.spec.ts"]) putRoot(project, f, "// fixture\n");
  }
  if (useGit) {
    gitInit(project);
    commitFiles(project, ["src/base.mjs", `context/changes/${project.id}/plan.md`]);
  }
  return project;
}

// Rewrites the plan with the phases in `ticked` done, writes the result and runs `next`.
function advance(project, specs, ticked, result = { status: "done", note: "x" }) {
  writePlan(project, planWith(specs, ticked));
  writeResult(project, result);
  return next(project);
}

// An e2e step that ticked its rows without a commit: the router answers with the retry.
function retried(policy) {
  const project = executorProject(policy, [e2ePhase], { useGit: true });
  standard(project, E2E_GOAL);
  return { project, res: advance(project, [e2ePhase], [1]) };
}

// A review whose findings are all APPLIED, so the router asks for a confirmation round instead of going on.
function appliedReview(project, name, verdict) {
  const abs = path.join(project.changeDir, "reviews", `${name}.md`);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `# Review\n\n- **Verdict**: ${verdict}\n- **Findings**: 1 critical, 0 warnings\n\n### F1 — Something\n\n- **Severity**: ❌ CRITICAL\n- **Decision**: APPLIED — abc1234\n`);
  fs.utimesSync(abs, future(), future());
}

const DONE_PLAN = buildPlan([{ auto: [{ text: "row one", done: true }, { text: "row two", done: true }] }]);
const OPEN_PLAN = buildPlan([{ auto: [{ text: "row one", done: true }, "row two"] }]);
const failed = (n) => entry(n, "implement", { ok: false, verified: false, result: { status: "failed", note: "boom" } });
const BASE = [entry(1, "plan"), entry(2, "plan-review")];
const IMPLEMENTED = [...BASE, entry(3, "implement")];
const REVIEWED = [...IMPLEMENTED, entry(4, "impl-review")];
const MANUAL_PLAN = buildPlan([{ auto: [{ text: "row one", done: true }], manual: ["Run `node --version` and see a version"] }]);

// Each case builds a project for `policy` and returns the router answer that starts its template.
const CASES = [
  { template: "plan", make: (policy) => { const project = makeProject({ policy }); return { project, res: init(project, "fix typo") }; } },
  { template: "plan-revise", make: (policy) => {
    const project = staged(policy, { reviews: [["plan-review", "RETHINK", "2 critical, 0 warnings"]], log: BASE });
    return { project, res: standard(project, "fix typo") };
  } },
  { template: "plan-review", make: (policy) => {
    const project = staged(policy, { log: [entry(1, "plan")] });
    return { project, res: standard(project, "fix typo") };
  } },
  { template: "implement", make: (policy) => {
    const project = staged(policy, { reviews: [["plan-review", "SOUND"]], log: BASE });
    return { project, res: standard(project, "fix typo") };
  } },
  { template: "impl-review", make: (policy) => {
    const project = staged(policy, { plan: planText({ done: 1 }), reviews: [["plan-review", "SOUND"]], log: IMPLEMENTED });
    return { project, res: init(project, "fix typo") };
  } },
  { template: "fix", make: (policy) => {
    const reviews = [["plan-review", "SOUND"], ["impl-review", "NEEDS ATTENTION", "1 critical, 0 warnings"]];
    const project = staged(policy, { plan: planText({ done: 1 }), reviews, log: REVIEWED });
    return { project, res: init(project, "fix typo") };
  } },
  { template: "research", make: (policy) => { const project = makeProject({ policy }); return { project, res: thorough(project) }; } },
  { template: "research-with-map", make: (policy) => {
    const project = makeProject({ policy });
    putRoot(project, "context/map/repo-map.md", "---\nartifact: repo-map\n---\n# Map\n");
    return { project, res: thorough(project) };
  } },
  { template: "research-revise", make: (policy) => {
    const log = [...BASE, entry(3, "plan", { template: "plan-revise", verdict: "REVISE" }), entry(4, "plan-review")];
    const project = staged(policy, { reviews: [["plan-review", "REVISE", "1 critical, 0 warnings"]], log });
    return { project, res: thorough(project) };
  } },
  { template: "score", make: (policy) => {
    const project = makeProject({ policy: { ...policy, score: { minRigor: "standard" } } });
    return { project, res: standard(project, GOAL) };
  } },
  { template: "domain-aggregate", make: (policy) => {
    const project = makeProject({ policy });
    put(project, "research.md", RESEARCH);
    putRoot(project, "context/domain/domain-distillation.md", DISTILLATION);
    return { project, res: thorough(project, "Wrap the vendor sdk for the world tooltip") };
  } },
  { template: "domain-acl", make: (policy) => {
    const project = makeProject({ policy });
    put(project, "research.md", RESEARCH);
    return { project, res: thorough(project, "Put an adapter around the vendor sdk") };
  } },
  { template: "frame", make: (policy) => {
    const project = makeProject({ policy });
    put(project, "research.md", RESEARCH);
    return { project, res: thorough(project, "Logins fail because the token cache is stale") };
  } },
  { template: "frame-rethink", make: (policy) => {
    const project = staged(policy, { reviews: [["plan-review", "RETHINK", "2 critical, 0 warnings"]], log: BASE });
    return { project, res: thorough(project) };
  } },
  { template: "implement-segment", make: (policy) => {
    const project = executorProject(policy, [goalPhase, e2ePhase]);
    return { project, res: standard(project, E2E_GOAL) };
  } },
  { template: "implement-e2e", make: (policy) => {
    const project = executorProject(policy, [e2ePhase]);
    return { project, res: standard(project, E2E_GOAL) };
  } },
  { template: "implement-tdd", make: (policy) => {
    const project = executorProject(policy, [tddPhase], { setup: false });
    return { project, res: thorough(project, "Parse blank lines") };
  } },
  { template: "implement-retry", git: true, make: (policy) => retried(policy) },
  { template: "impl-review-warn", git: true, make: (policy) => {
    const { project } = retried(policy);
    return { project, res: advance(project, [e2ePhase], [1], { status: "done", note: "nothing to change" }) };
  } },
  { template: "plan-review-confirm", make: (policy) => {
    const project = staged({ ...policy, review: { confirmRounds: { standard: 1 } } }, { log: BASE });
    appliedReview(project, "plan-review", "REVISE");
    return { project, res: standard(project, "fix typo") };
  } },
  { template: "impl-review-confirm", make: (policy) => {
    const project = staged({ ...policy, review: { confirmRounds: { standard: 1 } } }, { plan: planText({ done: 1 }), reviews: [["plan-review", "SOUND"]], log: REVIEWED });
    appliedReview(project, "impl-review", "NEEDS ATTENTION");
    return { project, res: standard(project, "fix typo") };
  } },
  { template: "plan-replan", make: (policy) => {
    const project = staged(policy, { plan: OPEN_PLAN, reviews: [["plan-review", "SOUND"]], log: [...BASE, failed(3), failed(4)] });
    return { project, res: standard(project) };
  } },
  { template: "plan-rejected", make: (policy) => {
    const reviews = [["plan-review", "SOUND"], ["impl-review", "REJECTED", "1 critical, 0 warnings"]];
    const project = staged(policy, { plan: DONE_PLAN, reviews, log: REVIEWED });
    return { project, res: standard(project) };
  } },
  { template: "manual-verify", make: (policy) => {
    const project = staged({ ...policy, manualVerify: { minRigor: "lean" } }, { plan: MANUAL_PLAN, reviews: [["plan-review", "SOUND"]], log: IMPLEMENTED });
    return { project, res: standard(project) };
  } },
  { template: "manual-verify-nochrome", make: (policy) => {
    const project = staged({ ...policy, manualVerify: { minRigor: "lean" } }, { plan: MANUAL_PLAN, reviews: [["plan-review", "SOUND"]], log: IMPLEMENTED });
    return { project, res: standard(project, "Parse blank lines", ["--chrome", "false"]) };
  } },
];
const CASE = Object.fromEntries(CASES.map((c) => [c.template, c]));
const runnable = CASES.filter((c) => !(c.git && noGit));

const VARIANTS = { default: {}, on: ON, off: { advisor: { enabled: false } }, none: { advisor: null } };
const cache = new Map();

// The router answer of a case under a policy variant, its project and the entry it logged. Memoized per variant.
function runCase(c, variant = "default", policy = VARIANTS[variant]) {
  const key = `${c.template}|${variant}`;
  if (!cache.has(key)) {
    const { project, res } = c.make(policy);
    assert.equal(res.status, 0, `${c.template} (${variant}): ${res.stdout}${res.stderr}`);
    assert.equal(res.json.action, "run", `${c.template} (${variant}): ${res.stdout}`);
    const logged = ranOf(project).at(-1);
    assert.equal(logged.template, c.template, `${c.template} (${variant}): the fixture reached ${logged.template}`);
    cache.set(key, { project, res, json: res.json, entry: logged });
  }
  return cache.get(key);
}

// ---- 3.1 default off ---------------------------------------------------------------------

test("3.1 the cases reach every step template of the policy", () => {
  const covered = new Set([...CASES.map((c) => c.template), "archive"]);
  const templates = Object.keys(DEFAULT.prompts).filter((k) => !NOT_TEMPLATES.includes(k));
  assert.deepEqual(templates.filter((t) => !covered.has(t)), [], "every template has a case");
  assert.ok(RULE_LINES.length >= 6, "advisor.md has its rule lines");
});

test("3.1 with the default policy no prompt contains the advisor text, for every template", () => {
  for (const c of runnable) {
    const { json, entry: logged } = runCase(c);
    assert.ok(json.prompt.endsWith("\n\n" + SUFFIX), c.template);
    assert.equal(json.prompt.includes(ADVISOR), false, c.template);
    for (const line of RULE_LINES) assert.equal(json.prompt.includes(line), false, `${c.template}: ${line}`);
    assert.equal(/advisor/i.test(json.prompt), false, c.template);
    assert.equal(has(logged, "advisor"), false, c.template);
  }
});

test("3.1 the shipped advisor block prints byte for byte what a policy without the block prints", () => {
  for (const c of runnable) {
    const shipped = runCase(c).res.stdout;
    assert.equal(runCase(c, "off").res.stdout, shipped, `${c.template}: advisor.enabled false`);
    assert.equal(runCase(c, "none").res.stdout, shipped, `${c.template}: advisor null`);
  }
});

test("3.1 the archive prompt never carries the advisor text", { skip: noGit }, () => {
  const archived = (policy) => {
    const project = makeProject({ policy, plan: planText({ done: 1 }) });
    fs.writeFileSync(path.join(project.changeDir, "change.md"), "---\nchange_id: demo\nstatus: implemented\ncreated: 2026-10-30\n---\n");
    writeReview(project, "plan-review", { verdict: "SOUND" });
    writeReview(project, "impl-review", { verdict: "APPROVED" });
    writeLog(project, REVIEWED);
    writeMetaFile(project, { id: "demo", goal: "fix typo", archive: true });
    gitInit(project);
    commitFiles(project, ["README.md"]);
    const res = run(project, ["next", project.id], { env: gitEnv(project) });
    assert.equal(res.json.action, "archive", res.stdout);
    return res.json.prompt;
  };
  const shipped = archived({});
  assert.ok(shipped.endsWith("\n\n" + SUFFIX));
  assert.equal(/advisor/i.test(shipped), false);
  // Even a list that names the archive gives it no advisor text: the archive prompt is built on its own path.
  assert.equal(archived({ advisor: { enabled: true, templates: [...LISTED, "archive"] } }), shipped);
});

// ---- 3.2 advisor on ------------------------------------------------------------------------

test("3.2 with advisor.enabled true the plan, implement and implement-segment prompts carry the advisor rules once, before the suffix", () => {
  for (const template of LISTED) {
    const off = runCase(CASE[template]);
    const on = runCase(CASE[template], "on");
    assert.equal(on.json.prompt, withAdvisor(off.json.prompt), template);
    assert.equal(count(on.json.prompt, ADVISOR), 1, template);
    assert.equal(count(on.json.prompt, SUFFIX), 1, template);
    assert.ok(on.json.prompt.indexOf(ADVISOR) < on.json.prompt.lastIndexOf(SUFFIX), template);
    // Only the prompt moves: the run output has the same keys and values otherwise.
    const { prompt: a, ...restOff } = off.json;
    const { prompt: b, ...restOn } = on.json;
    assert.deepEqual(restOn, restOff, template);
    assert.equal(on.entry.advisor, true, template);
  }
});

test("3.2 with advisor.enabled true every other template carries no advisor text and logs no advisor flag", () => {
  const others = runnable.filter((c) => !LISTED.includes(c.template));
  assert.ok(others.some((c) => c.template === "plan-revise") && others.some((c) => c.template === "score"));
  for (const c of others) {
    const off = runCase(c);
    const on = runCase(c, "on");
    assert.equal(on.json.prompt, off.json.prompt, c.template);
    assert.equal(has(on.entry, "advisor"), false, c.template);
  }
});

test("3.2 advisor.templates is matched against the template, not the step name", () => {
  // implement-retry and implement-tdd run as step implement, plan-revise as step plan: a list that names only them gives
  // them the rules and leaves the plain plan and implement prompts as they are.
  const list = ["plan-revise", "implement-retry", "implement-tdd", "fix"];
  const policy = { advisor: { enabled: true, templates: list } };
  for (const c of runnable) {
    const off = runCase(c);
    const custom = runCase(c, "custom", policy);
    const listed = list.includes(c.template);
    assert.equal(custom.json.prompt, listed ? withAdvisor(off.json.prompt) : off.json.prompt, c.template);
    assert.equal(custom.entry.advisor, listed ? true : undefined, c.template);
  }
});

test("3.2 a whole standard run with the advisor on flags only the plan and implement entries", () => {
  const walk = (policy) => {
    const project = makeProject({ policy });
    const answers = [init(project, GOAL, ["--rigor", "standard"])];
    for (let i = 0; i < 10 && answers.at(-1).json?.action === "run"; i++) {
      const step = answers.at(-1).json.step;
      if (step === "plan") { writePlan(project, planText()); fs.utimesSync(project.planFile, future(), future()); }
      else if (step === "plan-review") review(project, "plan-review", "SOUND");
      else if (step === "implement") writePlan(project, planText({ done: 1 }));
      else if (step === "impl-review") review(project, "impl-review", "APPROVED");
      else throw new Error(`unexpected step ${step}`);
      writeResult(project, { status: "done", note: step });
      answers.push(next(project));
    }
    for (const res of answers) assert.equal(res.status, 0, res.stdout + res.stderr);
    assert.equal(answers.at(-1).json.action, "done", answers.at(-1).stdout);
    return { project, answers };
  };
  const off = walk({});
  const on = walk(ON);
  const flags = (w) => ranOf(w.project).map((e) => [e.template, e.advisor]);
  assert.deepEqual(flags(on), [["plan", true], ["plan-review", undefined], ["implement", true], ["impl-review", undefined]]);
  assert.deepEqual(flags(off), [["plan", undefined], ["plan-review", undefined], ["implement", undefined], ["impl-review", undefined]]);
  on.answers.forEach((res, i) => {
    const before = off.answers[i].json;
    const listed = res.json.action === "run" && ["plan", "implement"].includes(res.json.step);
    assert.equal(res.json.prompt, listed ? withAdvisor(before.prompt) : before.prompt, res.json.step ?? res.json.action);
  });
  // status keeps its rows: the advisor flag lives in the log entry only.
  assert.deepEqual(run(on.project, ["status", on.project.id]).json.steps.map((row) => Object.keys(row)),
    run(off.project, ["status", off.project.id]).json.steps.map((row) => Object.keys(row)));
});

// ---- 3.3 malformed blocks ------------------------------------------------------------------

test("3.3 a malformed advisor block reads as off and never halts", () => {
  const malformed = [
    true, "yes", 1, [], {}, { enabled: "true" }, { enabled: 1 }, { enabled: null }, { enabled: [true] },
    { enabled: true, templates: "plan" }, { enabled: true, templates: null }, { enabled: true, templates: [1, "plan"] },
    { enabled: true, templates: { plan: true } }, { enabled: true, templates: [] },
  ];
  const plain = { plan: runCase(CASE.plan).json.prompt, implement: runCase(CASE.implement).json.prompt };
  malformed.forEach((value, i) => {
    const what = JSON.stringify(value);
    for (const template of ["plan", "implement"]) {
      const { project, res } = CASE[template].make({ advisor: value });
      assert.equal(res.status, 0, `${what}: ${res.stdout}${res.stderr}`);
      assert.equal(res.json.action, "run", what);
      assert.equal(res.json.prompt, plain[template], `${template} with ${what}`);
      assert.equal(has(ranOf(project).at(-1), "advisor"), false, what);
      // Only a run with no executed step gets a provenance record: the plan case starts fresh, the implement case does not.
      if (template !== "plan") continue;
      // The flag records advisor.enabled as set (the boolean true or not); the section hash records the whole block.
      const enabled = value !== null && typeof value === "object" && !Array.isArray(value) && value.enabled === true;
      assert.equal(readMetaFile(project).provenance.flags["advisor.enabled"], enabled, what);
      if (i % 2) continue;
      // The run goes on: the next step and status answer as usual.
      writePlan(project, planText());
      fs.utimesSync(project.planFile, future(), future());
      writeResult(project, { status: "done", note: "plan" });
      const second = next(project);
      assert.equal(second.status, 0, `${what}: ${second.stdout}${second.stderr}`);
      assert.equal(second.json.action, "run", what);
      assert.equal(run(project, ["status", project.id]).status, 0, what);
    }
  });
});

// ---- 3.4 the prompt file -------------------------------------------------------------------

test("3.4 policy.json ships the advisor block off and wires prompts.advisor to the file", () => {
  assert.deepEqual(DEFAULT.advisor, { enabled: false, templates: LISTED });
  assert.equal(DEFAULT.prompts.advisor, "@prompts/advisor.md");
});

test("3.4 prompts/advisor.md follows the rule form, names no model and holds the rules of the plan", () => {
  const lines = ADVISOR_SOURCE.split("\n");
  for (const line of lines) {
    if (line.includes("**GIVEN**")) assert.deepEqual(ruleProblems(line), [], line);
    else assert.equal([...line.matchAll(BOLD_KEYWORD)].length, 0, `bold keyword outside a rule: ${line}`);
  }
  assert.ok(RULE_LINES.length >= 6);
  assert.doesNotMatch(ADVISOR_SOURCE, /\b(haiku|sonnet|opus|fable|claude-)/i);
  // The router renders the file like a template; the tests compare against the file text, so it has no placeholder.
  assert.doesNotMatch(ADVISOR_SOURCE, /\{\w+\}/);
  const rule = (pattern) => assert.ok(RULE_LINES.some((line) => pattern.test(line)), String(pattern));
  rule(/available to you .*\*\*THEN\*\* you \*\*MUST\*\* consult the advisor once/);
  rule(/complete and you have not written the RESULT line yet/);
  rule(/not complete yet \*\*THEN\*\* you \*\*MUST NOT\*\* consult the advisor/);
  rule(/no advisor tool is available .*\*\*MUST\*\* continue without it and leave it out of your reply/);
  rule(/consulted the advisor once .*\*\*MUST NOT\*\* call it a second time/);
  rule(/`\/10x-goal-implement` starts worker subagents .*\*\*MUST NOT\*\* ask that worker to consult the advisor/);
  rule(/\*\*MUST\*\* act on it or state in your reply why you did not/);
  rule(/\*\*MUST\*\* add one `assumptions` entry that says the advisor was consulted once/);
});

test("3.4 prompts/README.md lists advisor.md in the wired table", () => {
  const readme = fs.readFileSync(path.join(SKILL_DIR, "prompts/README.md"), "utf8").split("\n");
  const section = (heading) => {
    const start = readme.findIndex((line) => line === heading);
    assert.ok(start >= 0, heading);
    const end = readme.findIndex((line, i) => i > start && line.startsWith("## "));
    return readme.slice(start + 1, end < 0 ? undefined : end);
  };
  const row = section("## Wired").find((line) => line.startsWith("| `advisor.md` |"));
  assert.ok(row, "advisor.md has a row under Wired");
  const cells = row.split(" | ");
  assert.equal(cells[1], "none (this pipeline)");
  assert.match(cells[2], /`plan` and `implement`/);
  assert.match(cells[3], /`advisor` template/);
  assert.match(cells[3], /`advisor\.enabled`/);
  assert.equal(section("## Not wired").some((line) => line.includes("advisor.md")), false);
  assert.ok(readme.some((line) => /`advisor\.md` are written for this pipeline and have no course source/.test(line)));
});

// ---- 3.5 provenance ------------------------------------------------------------------------

test("3.5 provenance records advisor.enabled in flags, and flipping it changes the advisor section only", () => {
  const record = (variant, policy) => readMetaFile(runCase(CASE.plan, variant, policy).project).provenance;
  const off = record("default");
  const on = record("on");
  assert.equal(off.flags["advisor.enabled"], false);
  assert.equal(on.flags["advisor.enabled"], true);
  assert.match(off.sections.advisor, HEX16);
  assert.match(on.sections.advisor, HEX16);
  const differing = (a, b) => [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => a[k] !== b[k]).sort();
  assert.deepEqual(differing(off.sections, on.sections), ["advisor"]);
  assert.deepEqual(differing(off.flags, on.flags), ["advisor.enabled"]);
  // The resolved advisor text is part of the prompts hash in both arms, so the flag alone does not move it.
  assert.equal(on.sections.prompts, off.sections.prompts);
  // A malformed flag reads false but still changes the section.
  const odd = record("odd", { advisor: { enabled: "true" } });
  assert.equal(odd.flags["advisor.enabled"], false);
  assert.deepEqual(differing(off.sections, odd.sections), ["advisor"]);
  // The explicit default records what the shipped block records.
  assert.deepEqual(record("off").sections, off.sections);
});

test("3.5 compare warns when two arms differ in the advisor flag", () => {
  const walk = (policy) => {
    const project = makeProject({ policy });
    let res = init(project, "fix typo");
    for (let i = 0; i < 8 && res.json?.action === "run"; i++) {
      const step = res.json.step;
      if (step === "plan") { writePlan(project, planText()); fs.utimesSync(project.planFile, future(), future()); }
      else if (step === "plan-review") review(project, "plan-review", "SOUND");
      else if (step === "implement") writePlan(project, planText({ done: 1 }));
      else if (step === "impl-review") review(project, "impl-review", "APPROVED");
      writeResult(project, { status: "done", note: step });
      res = next(project);
    }
    assert.equal(res.json.action, "done", res.stdout);
    return project;
  };
  const baseline = walk({});
  const routed = walk(ON);
  const res = run(routed, ["compare", routed.id, "--baseline", baseline.root]);
  assert.equal(res.status, 0, res.stdout + res.stderr);
  const provenanceWarnings = res.json.warnings.filter((w) => /^(provenance|flags)-/.test(w));
  assert.deepEqual(provenanceWarnings, ["provenance-differs:advisor", "flags-differ:advisor.enabled"]);
  // Two arms with the same advisor setting raise none.
  const same = run(baseline, ["compare", baseline.id, "--baseline", walk({}).root]);
  assert.deepEqual(same.json.warnings.filter((w) => /^(provenance|flags)-/.test(w)), []);
});

// ---- 3.6 ADR-009 and the docs --------------------------------------------------------------

test("3.6 ADR-009 rule lines follow the rule form and the decision rules are fixed before any run", () => {
  const adr = readRepo("docs/ADR/ADR-009-managed-agent-patterns.md");
  let fenced = false;
  const rules = adr.split("\n").filter((line) => {
    if (/^\s*```/.test(line)) { fenced = !fenced; return false; }
    return !fenced && line.includes("**GIVEN**");
  });
  assert.ok(rules.length >= 12, `ADR-009 has its rule lines (${rules.length})`);
  for (const line of rules) assert.deepEqual(ruleProblems(line), [], line);
  assert.match(adr, /^- \*\*Status:\*\* Accepted/m);
  for (const heading of ["## Context", "## Decision", "## Consequences", "## Alternatives considered", "## Live checks", "### A/B result"]) {
    assert.ok(adr.split("\n").includes(heading), heading);
  }
  assert.match(adr, /### A\/B result\n\nPending\./);
  for (const check of ["Live check 1", "Live check 2", "Live check P0"]) assert.match(adr, new RegExp(`\\| ${check} \\|.*\\| Pending \\|`));
  // The advisor rule: precondition P0 and the four conditions over at least 5 comparable pairs.
  assert.match(adr, /`totalTokens` includes the advisor's tokens\. If it does not, no advisor pair can be read and `advisor\.enabled` stays `false`/);
  assert.match(adr, /at least 5 comparable pairs/);
  assert.match(adr, /The sum of `steps` of the advisor arm is below the baseline's/);
  assert.match(adr, /The sum of `failedAttempts` of the advisor arm is at most the baseline's/);
  assert.match(adr, /The median `dropPercent` is -10 or higher/);
  assert.match(adr, /One A\/A pair .* has an absolute `dropPercent` below 10/);
  assert.match(adr, /no more failed `score` attempts than the baseline in total and no halt, and live checks 1 and 2 passed/);
  // The alternatives the plan names.
  for (const alt of ["nested `Agent` call", "reads `advisorModel`", "`research` and `frame`", "fallback to `general-purpose`", "A hook"]) {
    assert.ok(adr.includes(alt), alt);
  }
});

test("3.6 README and AGENTS.md describe the advisor flag", () => {
  const readme = readRepo("README.md");
  const start = readme.indexOf("\nAdvisor (opt-in):\n");
  assert.ok(start > readme.indexOf("\nRestricted step agents (opt-in):\n"), "the advisor bullets follow the restricted agents");
  const block = readme.slice(start, readme.indexOf("\nLimits:\n", start));
  assert.match(block, /`advisor\.enabled` cannot configure or cap the advisor/);
  assert.match(block, /`advisorModel`/);
  assert.match(block, /never checks that a consult happened and never caps the consults/);
  assert.match(block, /record the advisor setting and the Claude Code version of both arms by hand/);
  assert.match(block, /ADR-009/);
  const agents = readRepo("AGENTS.md");
  for (const part of ["`skills/10x-pipeline/prompts/advisor.md`", "`skills/10x-pipeline/test/advisor.test.mjs`", "(ADR-001 to ADR-011)"]) {
    assert.ok(agents.includes(part), part);
  }
});
