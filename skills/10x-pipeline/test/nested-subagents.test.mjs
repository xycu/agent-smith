// Bounded native children retain parent ownership and exact invocation matching (ADR-018).
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
const suffixRules = () => TOP.filter((l) => l.includes("**GIVEN**") && l.includes("calls for delegation"));
const IMPLEMENT_RULE = "- **GIVEN** `/10x-goal-implement` delegates phase code or a gate fix **WHEN** you run it in this step **THEN** you **MUST** apply the shared child contract, collect the work and retain gates, Progress and authorized commits in this enclosing step.";

test("top.md permits exactly one child layer with parent-owned gates and safety", () => {
  const rules = suffixRules();
  assert.equal(rules.length, 1);
  assert.match(rules[0], /\*\*MAY\*\* start one native child layer/);
  const text = TOP.join("\n");
  for (const needle of ["historical flat-delegation lessons", "absolute run root", "invocation identity",
    "always-true, chain and step safety rules", "stricter task restriction", "agent-smith:step",
    "awaited foreground call", "run_in_background", "depth two", "signals.needsHuman",
    "restricted scoring tools", "read-only verification", "archive restrictions", "custom agent mappings",
    "delegated leaf", "no further delegation", "update Progress, stage or commit, publish, invoke the router",
    "last-result.json", "findings, touched paths and failures", "disjoint write ownership",
    "overlapping writes sequentially", "collect every launched child", "reconcile edits and failures",
    "run gates", "authorized commits yourself", "no result intake, rollback or relaunch",
    "verified child-inclusive token snapshot once", "partial or unknown token coverage"]) {
    assert.ok(text.includes(needle), needle);
    assert.ok(text.indexOf(needle) < text.indexOf("\nRESULT:"), needle);
  }
  for (const line of TOP.filter(l => l.includes("**GIVEN**"))) assert.deepEqual(ruleProblems(line), []);
});

test("implement, implement-segment and executor-retry.md retain enclosing step ownership", () => {
  assert.equal(typeof POLICY.prompts.implement, "string", "implement stays a string");
  assert.ok(flat(POLICY.prompts.implement).includes(IMPLEMENT_RULE), "implement");
  assert.ok(flat(POLICY.prompts["implement-segment"]).includes(IMPLEMENT_RULE), "implement-segment");
  assert.ok(flat(POLICY.prompts["implement-retry"]).includes("@prompts/executor-retry.md"));
  assert.ok(prompt("executor-retry.md").split("\n").includes(IMPLEMENT_RULE), "executor-retry.md");
  assert.deepEqual(ruleProblems(IMPLEMENT_RULE), []);
});

test("the tdd and e2e guides apply the shared child contract", () => {
  for (const [file, skill] of [["executor-tdd.md", "`/10x-tdd`"], ["executor-e2e.md", "`/10x-e2e`"]]) {
    const rules = prompt(file).split("\n").filter((l) => l.includes("**GIVEN**") && l.includes(skill) && /shared child contract/.test(l));
    assert.equal(rules.length, 1, file);
    assert.match(rules[0], /collect every child/);
    assert.deepEqual(ruleProblems(rules[0]), [], file);
  }
});

test("research-with-map.md delegates read-only analyses and retains synthesis", () => {
  const text = prompt("research-with-map.md");
  assert.match(text, /delegate independent read-only analyses under the shared child contract/);
  for (const name of ["e2e trace", "test gaps", "blast radius"]) assert.ok(text.includes(name), name);
  assert.match(text, /synthesize their collected findings in this step/);
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
    ...["executor-tdd.md", "executor-e2e.md"].flatMap((f) => prompt(f).split("\n").filter((l) => /shared child contract/.test(l))),
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

test("child notifications never certify a whole native step token total", () => {
  for (const file of Object.values(SKILLS)) {
    const source = fs.readFileSync(file, "utf8");
    assert.match(source, /never map it to `totalTokens`, even for a flat step/);
    assert.match(source, /Delete step-authored `usage` and `usageEvidence` before merging collector output/);
    assert.match(source, /Missing sources produce unavailable evidence through the same reader/);
    assert.match(source, /child notifications never complete the step/);
  }
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

test("project settings cap Claude Code subagent depth at the string 2", () => {
  const settings = JSON.parse(fs.readFileSync(path.join(REPO, ".claude/settings.json"), "utf8"));
  assert.equal(settings.env?.CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH, "2");
});

test("the reference documents the depth cap and optional plugin-user setup", () => {
  const text = fs.readFileSync(path.join(REPO, "docs/REFERENCE.md"), "utf8");
  const block = text.split("- A step may collect one native child layer.")[1]?.split("\n- ")[0];
  assert.ok(block, "the nesting Limits bullet exists");
  assert.match(block, /Plugin users enable delegation by merging/);
  assert.match(block, /"CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH":"2"/);
  assert.match(block, /CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH=2 claude/);
  assert.match(block, /2\.1\.311/);
  assert.match(block, /orchestrator → step → child/);
  assert.match(block, /Higher-precedence settings can override/);
  for (const url of [
    "https://code.claude.com/docs/en/env-vars",
    "https://code.claude.com/docs/en/sub-agents#let-subagents-spawn-their-own-subagents",
    "https://code.claude.com/docs/en/settings#settings-precedence",
    "ADR/ADR-018-no-nested-subagents.md#amendment-3--bounded-native-children",
  ]) assert.ok(block.includes(url), url);
  assert.doesNotMatch(text, /CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` of \d+ or more/);
});

test("the README offers optional string-valued project setup and a fresh session", () => {
  const text = fs.readFileSync(path.join(REPO, "README.md"), "utf8");
  const block = text.split("### Claude Code subagent depth\n")[1]?.split("\n## ")[0];
  assert.ok(block, "the Configure subsection exists");
  assert.ok(text.indexOf("### Claude Code subagent depth") > text.indexOf("## ⚙️ Configure"));
  assert.ok(text.indexOf("### Claude Code subagent depth") < text.indexOf("## 📚 More"));
  const example = block.match(/```json\n([\s\S]*?)\n```/);
  assert.ok(example, "a mergeable JSON example exists");
  assert.equal(JSON.parse(example[1]).env.CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH, "2");
  assert.match(block, /Plugin users enable delegation by merging/);
  assert.match(block, /every Claude session/);
  assert.match(block, /Commit the setting before creating run worktrees/);
  assert.match(block, /fresh Claude session/);
  assert.ok(block.includes("(docs/REFERENCE.md)"));
});

test("ADR-018 amends the historical enforcement gap and records pending live acceptance", () => {
  const text = fs.readFileSync(path.join(REPO, "docs/ADR/ADR-018-no-nested-subagents.md"), "utf8");
  const block = text.split("## Amendment 2 — Harness depth cap\n")[1]?.split("\n## ")[0];
  assert.ok(block, "the amendment exists");
  for (const needle of [
    "2026-11-14", "supersedes the Context", "Consequences", "Not covered",
    "`env.CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` to the string `\"1\"`",
    "disallowedTools: Agent", "PreToolUse", "invocation identity checks",
    "Live acceptance is **unavailable**", "Manual row 2.4 stays pending",
    "https://code.claude.com/docs/en/env-vars",
    "https://code.claude.com/docs/en/sub-agents#let-subagents-spawn-their-own-subagents",
    "https://code.claude.com/docs/en/settings#settings-precedence",
  ]) assert.ok(block.includes(needle), needle);
});

test("ADR-018 exists and its rule lines follow the rule form", () => {
  const file = path.join(REPO, "docs/ADR/ADR-018-no-nested-subagents.md");
  assert.ok(fs.statSync(file).isFile());
  const rules = fs.readFileSync(file, "utf8").split("\n").filter((l) => l.includes("**GIVEN**"));
  assert.ok(rules.length > 0, "ADR-018 has rule lines");
  for (const rule of rules) assert.deepEqual(ruleProblems(rule), [], rule);
});
