// Rule-form check (ADR-004): every behavior rule is one line,
// **GIVEN** ... **WHEN** ... **THEN** ... with exactly one bold RFC 2119 keyword.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

test("policy.json prompts follow the rule form", () => {
  const policy = JSON.parse(fs.readFileSync(path.join(SKILL_DIR, "policy.json"), "utf8"));
  // A prompt is a string or an array of strings; a part may be a @prompts/<file>.md reference (the files are checked below).
  const lines = Object.values(policy.prompts).flatMap((s) => (Array.isArray(s) ? s : [s]).flatMap((part) => String(part).split("\n")));
  assert.deepEqual(lineProblems(lines, { strict: true }), []);
});

test("skills/10x-pipeline/prompts/*.md follow the rule form", () => {
  const dir = path.join(SKILL_DIR, "prompts");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md") && f !== "README.md");
  assert.ok(files.length > 0, "no prompt files found");
  for (const f of files) {
    const lines = fs.readFileSync(path.join(dir, f), "utf8").split("\n");
    assert.deepEqual(lineProblems(lines, { strict: true }), [], f);
  }
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
