// Rule-form check (ADR-004): every behavior rule is one line,
// **GIVEN** ... **WHEN** ... **THEN** ... with exactly one bold RFC 2119 keyword.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TYPES } from "../../../tools/commit-lint.mjs";
import { cleanupAll, init, makeProject, next, planText, writeResult, writeReview } from "./helpers.mjs";
import { pluginPolicy } from "../scripts/state.mjs";

after(() => cleanupAll());

const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO = path.resolve(SKILL_DIR, "../..");

const BOLD_KEYWORD = /\*\*(MUST NOT|MUST|SHOULD NOT|SHOULD|MAY)\*\*/g;
const BARE_BANNED = /\b(SHALL|REQUIRED|RECOMMENDED|OPTIONAL)\b/;
const BARE_KEYWORD = /\b(MUST|SHOULD|MAY|SHALL|REQUIRED|RECOMMENDED|OPTIONAL)\b/;

// Returns a list of problems for one rule line. Empty when the line is valid.
export function ruleProblems(line) {
  const problems = [];
  const given = line.indexOf("**GIVEN**");
  const when = line.indexOf("**WHEN**");
  const then = line.indexOf("**THEN**");
  if (given < 0) problems.push("missing **GIVEN**");
  if (when < 0) problems.push("missing **WHEN**");
  if (then < 0) problems.push("missing **THEN**");
  if (given >= 0 && when >= 0 && then >= 0 && !(given < when && when < then)) {
    problems.push("GIVEN, WHEN, THEN out of order");
  }
  const keywords = [...line.matchAll(BOLD_KEYWORD)];
  if (keywords.length === 0) problems.push("no bold keyword");
  if (keywords.length > 1) problems.push(`${keywords.length} bold keywords, expected 1`);
  if (keywords.length === 1 && then >= 0 && keywords[0].index < then) problems.push("keyword before THEN");
  const bare = line.replace(/\*\*[^*]+\*\*/g, " ").match(BARE_KEYWORD);
  if (bare) problems.push(`unbolded keyword ${bare[1]}`);
  return problems;
}

// Prose lines (no **GIVEN**) carry no bold keyword and no banned upper-case keyword.
function proseProblems(line) {
  const problems = [];
  if ([...line.matchAll(BOLD_KEYWORD)].length) problems.push("bold keyword outside a rule");
  const banned = line.match(BARE_BANNED);
  if (banned) problems.push(`banned keyword ${banned[1]}`);
  return problems;
}

function lineProblems(lines, { strict }) {
  const found = [];
  lines.forEach((line, i) => {
    const problems = line.includes("**GIVEN**") ? ruleProblems(line) : strict ? proseProblems(line) : [];
    if (problems.length) found.push(`line ${i + 1}: ${problems.join("; ")}: ${line.slice(0, 80)}`);
  });
  return found;
}

// ADR prose may discuss the keywords, so ADRs check only rule lines outside fenced code.
function outsideFences(text) {
  let fenced = false;
  return text.split("\n").map((line) => {
    if (/^\s*```/.test(line)) { fenced = !fenced; return ""; }
    return fenced ? "" : line;
  });
}

test("ruleProblems accepts a valid rule", () => {
  const rule = "- **GIVEN** the skill would ask **WHEN** no human answers **THEN** you **MUST** decide from evidence.";
  assert.deepEqual(ruleProblems(rule), []);
  assert.deepEqual(ruleProblems("**GIVEN** a **WHEN** b **THEN** c **MUST NOT** d"), []);
});

test("ruleProblems rejects bad rules", () => {
  const bad = {
    "missing WHEN": "**GIVEN** a **THEN** you **MUST** b",
    "two keywords": "**GIVEN** a **WHEN** b **THEN** you **MUST** c and **SHOULD** d",
    "no keyword": "**GIVEN** a **WHEN** b **THEN** you decide",
    "wrong order": "**WHEN** b **GIVEN** a **THEN** you **MUST** c",
  };
  for (const [name, line] of Object.entries(bad)) {
    assert.ok(ruleProblems(line).length > 0, `${name} must be rejected: ${line}`);
  }
});

test("ruleProblems rejects a bare keyword next to a valid bold one", () => {
  // Exactly one bold keyword each, so only the bare-keyword check can reject them.
  const bad = {
    "unbolded MUST": ["**GIVEN** a **WHEN** b **THEN** you **SHOULD** c and MUST d", "unbolded keyword MUST"],
    "unbolded SHOULD": ["**GIVEN** a **WHEN** b **THEN** you **MUST** c and SHOULD d", "unbolded keyword SHOULD"],
    "SHALL": ["**GIVEN** a **WHEN** b **THEN** you **MUST** c, as SHALL be", "unbolded keyword SHALL"],
  };
  for (const [name, [line, problem]] of Object.entries(bad)) {
    assert.deepEqual(ruleProblems(line), [problem], `${name}: ${line}`);
  }
});

test("prose checker rejects stray keywords", () => {
  assert.ok(proseProblems("You **MUST** do it").length > 0);
  assert.ok(proseProblems("This is REQUIRED").length > 0);
  assert.deepEqual(proseProblems("The RESULT line says signals is optional."), []);
});

test("policy.json prompts of both skills follow the rule form", () => {
  // The plugin policy: skills/10x-pipeline/policy.json merged with skills/openspec-pipeline/policy.json.
  const policy = pluginPolicy();
  // A prompt is a string or an array of strings; a part may be a @prompts/<file>.md reference (the files are checked below).
  const lines = Object.values(policy.prompts).flatMap((s) => (Array.isArray(s) ? s : [s]).flatMap((part) => String(part).split("\n")));
  assert.deepEqual(lineProblems(lines, { strict: true }), []);
});

test("skills/10x-pipeline/prompts/*.md and skills/openspec-pipeline/prompts/*.md follow the rule form", () => {
  for (const dir of [path.join(SKILL_DIR, "prompts"), path.join(SKILL_DIR, "../openspec-pipeline/prompts")]) {
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md") && f !== "README.md");
    assert.ok(files.length > 0, `no prompt files found in ${dir}`);
    for (const f of files) {
      const lines = fs.readFileSync(path.join(dir, f), "utf8").split("\n");
      assert.deepEqual(lineProblems(lines, { strict: true }), [], f);
    }
  }
});

test("SKILL.md anti-stall rules follow the rule form", () => {
  const lines = fs.readFileSync(path.join(SKILL_DIR, "SKILL.md"), "utf8").split("\n");
  const start = lines.findIndex((l) => l === "## Anti-stall rules");
  assert.ok(start >= 0, "no ## Anti-stall rules section");
  let end = start + 1;
  while (end < lines.length && !lines[end].startsWith("## ")) end++;
  const section = lines.slice(start + 1, end);
  assert.ok(section.some((l) => l.includes("**GIVEN**")), "section has no rule line");
  assert.deepEqual(lineProblems(section, { strict: true }), []);
});

test("ADR rule lines follow the rule form", () => {
  const dir = path.join(REPO, "docs/ADR");
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir).filter((f) => /^ADR-\d{3}-.*\.md$/.test(f));
  for (const f of files) {
    const lines = outsideFences(fs.readFileSync(path.join(dir, f), "utf8"));
    assert.deepEqual(lineProblems(lines, { strict: false }), [], f);
  }
});

test("both review templates carry the apply-fixes rules", () => {
  const POLICY = JSON.parse(fs.readFileSync(path.join(SKILL_DIR, "policy.json"), "utf8"));
  const flat = (v) => (Array.isArray(v) ? v : [v]);
  assert.ok(flat(POLICY.prompts["plan-review"]).includes("@prompts/plan-review-apply.md"));
  for (const k of ["impl-review", "impl-review-warn"]) assert.ok(flat(POLICY.prompts[k]).includes("@prompts/impl-review-apply.md"), k);
  for (const k of ["plan-review", "impl-review", "impl-review-warn"]) assert.doesNotMatch(flat(POLICY.prompts[k]).join("\n"), /Do not (apply fixes|fix findings)|choose to save and stop/, k);
});

test("both confirm templates carry their apply-fixes rules", () => {
  const POLICY = JSON.parse(fs.readFileSync(path.join(SKILL_DIR, "policy.json"), "utf8"));
  const flat = (v) => (Array.isArray(v) ? v : [v]);
  assert.ok(flat(POLICY.prompts["plan-review-confirm"]).includes("@prompts/plan-review-apply.md"));
  assert.ok(flat(POLICY.prompts["plan-review-confirm"]).includes("@prompts/plan-review-confirm.md"));
  assert.ok(flat(POLICY.prompts["impl-review-confirm"]).includes("@prompts/impl-review-apply.md"));
  assert.ok(flat(POLICY.prompts["impl-review-confirm"]).includes("@prompts/impl-review-confirm.md"));
  for (const k of ["plan-review-confirm", "impl-review-confirm"]) assert.doesNotMatch(flat(POLICY.prompts[k]).join("\n"), /Do not (apply fixes|fix findings)|choose to save and stop/, k);
});

// The commit rule of the implement-class templates (change step-commit-code-under-chore): the code is committed by the
// subagent under a typed subject, never chore, so release-please lists it.
const COMMIT_RULE = "- **GIVEN** a phase changed files outside `context/changes/{id}/` **WHEN** its gates pass **THEN** you **MUST** commit those files before you write the RESULT line, under a Conventional Commits subject `<type>({id}): <summary>` whose type is `feat`, `fix`, `refactor`, `perf`, `test` or `docs`, never `chore`.";
const parts = (v) => (Array.isArray(v) ? v : [v]).flatMap((part) => String(part).split("\n"));

test("implement, implement-segment and implement-retry carry the commit rule once", () => {
  const policy = JSON.parse(fs.readFileSync(path.join(SKILL_DIR, "policy.json"), "utf8"));
  assert.equal(typeof policy.prompts.implement, "string", "implement stays a string");
  for (const k of ["implement", "implement-segment", "implement-retry"]) {
    assert.equal(parts(policy.prompts[k]).filter((l) => l === COMMIT_RULE).length, 1, k);
  }
  assert.deepEqual(ruleProblems(COMMIT_RULE), []);
});

test("the types of the commit rule are Conventional Commits types without chore", () => {
  const listed = [...COMMIT_RULE.matchAll(/`(feat|fix|refactor|perf|test|docs|chore)`/g)].map((m) => m[1]);
  assert.deepEqual(listed.slice(0, 6), ["feat", "fix", "refactor", "perf", "test", "docs"]);
  assert.ok(listed.slice(0, 6).every((t) => TYPES.includes(t) && t !== "chore"));
});

test("os-apply.md commits the code by type, never chore, and no longer bans commits", () => {
  const text = fs.readFileSync(path.join(SKILL_DIR, "../openspec-pipeline/prompts/os-apply.md"), "utf8");
  const rule = text.split("\n").filter((l) => l.includes("**GIVEN**") && l.includes("Conventional Commits subject"));
  assert.equal(rule.length, 1);
  assert.match(rule[0], /`feat`, `fix`, `refactor`, `perf`, `test` or `docs`, never `chore`/);
  assert.match(rule[0], /stage those files one by one by name/);
  assert.match(rule[0], /leave every file under `openspec\/changes\/\{id\}\/` unstaged/);
  assert.deepEqual(ruleProblems(rule[0]), []);
  assert.doesNotMatch(text, /\*\*MUST NOT\*\* commit/);
  assert.ok(text.split("\n").some((l) => l.includes("**GIVEN**") && l.includes("**MUST NOT** stash")));
});

test("the suffix no longer reads as a ban on commits", () => {
  const policy = JSON.parse(fs.readFileSync(path.join(SKILL_DIR, "policy.json"), "utf8"));
  assert.doesNotMatch(policy.prompts.suffix, /Do not commit unless/);
  assert.match(policy.prompts.suffix, /Commit only where the skill or a rule of this prompt tells you to\./);
});

test("the router's implement prompt holds the commit rule once, before the RESULT line", () => {
  const project = makeProject({ plan: planText({ files: ["**File**: `x.js`"] }) });
  assert.equal(init(project, "add a parser for config files with tests").json.step, "plan-review");
  writeReview(project, "plan-review");
  writeResult(project, { status: "done" });
  const res = next(project);
  assert.equal(res.json.step, "implement");
  const lines = res.json.prompt.split("\n");
  const rule = COMMIT_RULE.replaceAll("{id}", "demo");
  assert.equal(lines.filter((l) => l === rule).length, 1);
  assert.ok(lines.indexOf(rule) < lines.findIndex((l) => l.startsWith("RESULT:")));
});
