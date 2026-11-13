// No nested subagents (ADR-018): a step subagent never calls the Agent or Task tool, because a nested subagent's
// report goes to the top session and never reaches its parent. Pins the always-true rule of rules/top.md (ADR-023), the "same subagent" lines of the
// implement templates and the executor guides, the research prompt without subagents, and the router's delivery.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cleanupAll, init, makeProject, next, planText, writeResult, writeReview } from "./helpers.mjs";

const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const POLICY = JSON.parse(fs.readFileSync(path.join(SKILL_DIR, "policy.json"), "utf8"));
const prompt = (file) => fs.readFileSync(path.join(SKILL_DIR, "prompts", file), "utf8");
const flat = (v) => (Array.isArray(v) ? v : [v]).flatMap((part) => String(part).split("\n"));

after(() => cleanupAll());

const BOLD_KEYWORD = /\*\*(MUST NOT|MUST|SHOULD NOT|SHOULD|MAY)\*\*/g;
const BARE_KEYWORD = /\b(MUST|SHOULD|MAY|SHALL|REQUIRED|RECOMMENDED|OPTIONAL)\b/;
const NO_TIER_WORD = /\b(sonnet|opus|haiku|fable|effort|tier|model)\b/i;

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

// The rule lives in the always-true rules/top.md (ADR-023), which no policy key or project override changes.
const TOP = fs.readFileSync(path.join(SKILL_DIR, "rules/top.md"), "utf8").split("\n");
const suffixRules = () => TOP.filter((l) => l.includes("**GIVEN**") && l.includes("Agent tool"));
const IMPLEMENT_RULE = "- **GIVEN** `/10x-goal-implement` would dispatch a subagent for the code of a phase or for the fix of a failed gate **WHEN** you run it in this step **THEN** you **MUST** write that code and those fixes yourself in this subagent, for every phase, and call no Agent or Task tool.";

test("top.md has exactly one rule that bans the Agent tool, in rule form, before the RESULT line", () => {
  const rules = suffixRules();
  assert.equal(rules.length, 1, "exactly one top.md line names the Agent tool");
  assert.ok(!POLICY.prompts.suffix.includes("Agent tool"), "the overridable suffix no longer carries the rule");
  const [rule] = rules;
  assert.ok(rule.includes("**MUST NOT**"), rule);
  assert.match(rule, /Task tool/);
  assert.match(rule, /top session/);
  assert.deepEqual(ruleProblems(rule), []);
  const at = TOP.indexOf(rule);
  assert.ok(at < TOP.findIndex((l) => l.startsWith("RESULT:")), "the rule comes before the RESULT line");
  assert.ok(at > TOP.findIndex((l) => l.includes("deepest first")), "the rule comes after the deletion rules");
  assert.doesNotMatch(rule, /advisor|\bRead\b|\bGrep\b|\bGlob\b/, "the rule forbids subagents only");
});

test("implement, implement-segment and executor-retry.md carry the same subagent line", () => {
  assert.equal(typeof POLICY.prompts.implement, "string", "implement stays a string");
  assert.ok(flat(POLICY.prompts.implement).includes(IMPLEMENT_RULE), "implement");
  assert.ok(flat(POLICY.prompts["implement-segment"]).includes(IMPLEMENT_RULE), "implement-segment");
  assert.ok(flat(POLICY.prompts["implement-retry"]).includes("@prompts/executor-retry.md"));
  assert.ok(prompt("executor-retry.md").split("\n").includes(IMPLEMENT_RULE), "executor-retry.md");
  assert.deepEqual(ruleProblems(IMPLEMENT_RULE), []);
});

test("the tdd and e2e guides each forbid the skill's own delegation", () => {
  for (const [file, skill] of [["executor-tdd.md", "`/10x-tdd`"], ["executor-e2e.md", "`/10x-e2e`"]]) {
    const rules = prompt(file).split("\n").filter((l) => l.includes("**GIVEN**") && l.includes(skill) && /Agent or Task tool/.test(l));
    assert.equal(rules.length, 1, file);
    assert.match(rules[0], /subagent/);
    assert.deepEqual(ruleProblems(rules[0]), [], file);
  }
});

test("research-with-map.md asks for no subagent and keeps the three analyses", () => {
  const text = prompt("research-with-map.md");
  assert.doesNotMatch(text, /subagent/i);
  for (const name of ["e2e trace", "test gaps", "blast radius"]) assert.ok(text.includes(name), name);
  assert.match(text, /\*\*MUST\*\* work through three analyses yourself, one after the other/);
});

test("the router returns an implement prompt with the top.md rule and the implement rule, once each", () => {
  const project = makeProject({ plan: planText({ files: ["**File**: `x.js`"] }) });
  assert.equal(init(project, "add a parser for config files with tests").json.step, "plan-review");
  writeReview(project, "plan-review");
  writeResult(project, { status: "done" });
  const res = next(project);
  assert.equal(res.json.action, "run");
  assert.equal(res.json.step, "implement");
  const lines = res.json.prompt.split("\n");
  const [suffixRule] = suffixRules();
  assert.equal(lines.filter((l) => l === suffixRule).length, 1, "top.md rule once");
  assert.equal(lines.filter((l) => l === IMPLEMENT_RULE).length, 1, "implement rule once");
  assert.ok(lines.indexOf(suffixRule) < lines.findIndex((l) => l.startsWith("RESULT:")), "top.md rule before RESULT");
});

test("the new lines name no model, effort or tier", () => {
  const added = [
    ...suffixRules(),
    IMPLEMENT_RULE,
    ...["executor-tdd.md", "executor-e2e.md"].flatMap((f) => prompt(f).split("\n").filter((l) => /Agent or Task tool/.test(l))),
    // The blast radius line names the data model of the target project, so only the new split line is checked.
    ...prompt("research-with-map.md").split("\n").filter((l) => l.includes("three analyses")),
  ];
  for (const line of added) assert.doesNotMatch(line, NO_TIER_WORD, line);
});

// ---- Phase 2: the sixth anti-stall rule of both orchestrator skills ----------------------------

const SKILLS = {
  "10x": path.join(SKILL_DIR, "SKILL.md"),
  openspec: path.resolve(SKILL_DIR, "../openspec-pipeline/SKILL.md"),
};

// The `## Anti-stall rules` section: from its heading to the next `## ` heading.
function antiStall(file) {
  const lines = fs.readFileSync(file, "utf8").split("\n");
  const start = lines.indexOf("## Anti-stall rules");
  assert.ok(start >= 0, `no anti-stall section in ${file}`);
  let end = start + 1;
  while (end < lines.length && !lines[end].startsWith("## ")) end++;
  return lines.slice(start + 1, end);
}

const sixthRule = (file) => antiStall(file).filter((l) => l.includes("**GIVEN**"))[5];

test("the sixth rule of both skills ignores a hand-back from a subagent the orchestrator did not launch", () => {
  for (const [chain, file] of Object.entries(SKILLS)) {
    const rule = sixthRule(file);
    assert.ok(rule, `${chain}: no sixth rule`);
    for (const needle of ["hand-back", "did not launch for the current step", "**MUST NOT**", "result file", "`next`", "own report"]) {
      assert.ok(rule.includes(needle), `${chain}: sixth rule lacks "${needle}"`);
    }
    assert.deepEqual(ruleProblems(rule), [], chain);
    assert.doesNotMatch(rule, NO_TIER_WORD, chain);
  }
});

test("the sixth rule is the same line in both skills", () => {
  assert.equal(sixthRule(SKILLS["10x"]), sixthRule(SKILLS.openspec));
});

test("the intro of both anti-stall sections names the sixth rule", () => {
  for (const [chain, file] of Object.entries(SKILLS)) {
    const intro = antiStall(file).find((l) => l.startsWith("Rules "));
    assert.ok(intro, `${chain}: no intro line`);
    assert.match(intro, /Rules 1, 2, 3 and 6 hold for every `run` step/, chain);
    assert.match(intro, /Rules 1 and 6 also hold for the archive subagent/, chain);
  }
});

// ---- Phase 3: the documents ---------------------------------------------------------------------

const REPO = path.resolve(SKILL_DIR, "../..");

test("docs/REFERENCE.md drops the spawn-depth requirement and names ADR-018", () => {
  const text = fs.readFileSync(path.join(REPO, "docs/REFERENCE.md"), "utf8");
  assert.ok(!text.includes(["spawns", "its own", "subagents"].join(" ")), "the old Limits note is gone");
  assert.doesNotMatch(text, /CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` of \d+ or more/);
  assert.ok(text.includes("ADR-018"));
});

test("ADR-018 exists and its rule lines follow the rule form", () => {
  const file = path.join(REPO, "docs/ADR/ADR-018-no-nested-subagents.md");
  assert.ok(fs.statSync(file).isFile());
  const rules = fs.readFileSync(file, "utf8").split("\n").filter((l) => l.includes("**GIVEN**"));
  assert.ok(rules.length > 0, "ADR-018 has rule lines");
  for (const rule of rules) assert.deepEqual(ruleProblems(rule), [], rule);
});
