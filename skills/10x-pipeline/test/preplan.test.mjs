// Pre-plan steps of the pre-plan-steps change. Black-box through the CLI, plus data checks on policy.json.
// Phase 2 covers the policy data and the prompt wiring (loader, artifact list, frame authority line).
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  cleanupAll, makeProject, planText, writeReview, init, writeLog, entry,
} from "./helpers.mjs";

after(cleanupAll);

const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROMPTS_DIR = path.join(SKILL_DIR, "prompts");
const policy = JSON.parse(fs.readFileSync(path.join(SKILL_DIR, "policy.json"), "utf8"));

const REF = /^@prompts\/([A-Za-z0-9._-]+\.md)$/;
const SUFFIX = policy.prompts.suffix;
const STATUS_RULE = "- **GIVEN** you save context/changes/{id}/research.md **WHEN** you write its first lines **THEN** you **MUST** start the file with YAML frontmatter that holds status: complete or status: partial.";

const parts = (value) => (Array.isArray(value) ? value : [value]);

// The prompt text without the shared suffix (the suffix holds a JSON example with braces).
const withoutSuffix = (prompt) => {
  assert.ok(prompt.endsWith(`\n\n${SUFFIX}`), "prompt ends with the shared suffix");
  return prompt.slice(0, -(SUFFIX.length + 2));
};

const touch = (project, file, text = "x\n") => {
  fs.writeFileSync(path.join(project.changeDir, file), text);
};

// A project whose plan review said RETHINK, so the next step is the plan-revise template.
function replanProject(id = "demo") {
  const project = makeProject({ id, plan: planText() });
  writeReview(project, "plan-review", { verdict: "RETHINK", findings: "2 critical, 0 warnings" });
  writeLog(project, [entry(1, "plan"), entry(2, "plan-review")]);
  return project;
}

// ---- policy data ----------------------------------------------------------------

test("preplan data: steps, gates, artifacts and loops", () => {
  const pp = policy.preplan;
  assert.deepEqual(pp.order, ["research", "domain-brief", "frame"]);
  assert.deepEqual(policy.steps.research, { skill: "10x-research", baseTier: 3, minTier: 2, maxTier: 5, interactive: true });
  assert.deepEqual(policy.steps["domain-brief"], { skill: null, baseTier: 3, minTier: 3, maxTier: 5, interactive: true });
  assert.deepEqual(policy.steps.frame, { skill: "10x-frame", baseTier: 4, minTier: 4, maxTier: 4, interactive: true });
  for (const step of pp.order) assert.equal(pp.gates[step].minRigor, "thorough", step);
  assert.deepEqual(pp.gates.research.skipIf, ["researchExists"]);
  assert.deepEqual(pp.gates["domain-brief"].when, ["aggregateGap", "dependencyLeak"]);
  assert.deepEqual(pp.gates.frame.when, ["framingDoubt"]);
  assert.equal(pp.loops.minRigor, "thorough");
  assert.deepEqual([pp.loops.rethinkToFrame, pp.loops.reviseResearchAfter, pp.loops.reviseResearchMax], [1, 1, 1]);
  // Every template a gate can return has a prompt and an artifact file.
  const templates = new Set(["research-revise", "frame-rethink"]);
  for (const gate of Object.values(pp.gates)) {
    if (gate.template) templates.add(gate.template);
    for (const variant of gate.variants ?? []) templates.add(variant.template);
  }
  for (const template of templates) {
    assert.ok(policy.prompts[template], `prompt for ${template}`);
    assert.match(pp.artifacts[template], /\.md$/, `artifact for ${template}`);
  }
  assert.equal(pp.artifacts.frame, "frame.md");
  assert.equal(pp.artifacts["domain-aggregate"], "refactor-invariant-aggregate.md");
  assert.equal(pp.artifacts["domain-acl"], "refactor-anti-corruption-layer.md");
});

test("preplan data: aggregateGap files, statuses, word length and stopwords", () => {
  const a = policy.preplan.predicates.aggregateGap;
  assert.deepEqual(a.files, ["context/domain/domain-distillation.md", "context/domain/01-domain-distillation.md"]);
  assert.deepEqual(a.statuses, ["declared", "ignored", "contradicted"]);
  assert.equal(a.minWordLength, 4);
  for (const word of [
    "the", "and", "for", "with", "from", "that", "this", "into", "when", "then", "must", "only", "each", "every",
    "page", "view", "add", "fix", "update", "change", "make", "should", "have", "been", "will", "work", "code",
    "test", "tests", "file", "files", "data", "new", "use", "using",
  ]) {
    assert.ok(a.stopwords.includes(word), `stopword ${word}`);
  }
  assert.ok(a.stopwords.every((w) => w === w.toLowerCase() && /^[a-z]+$/.test(w)), "stopwords are lowercase letters");
  assert.equal(new Set(a.stopwords).size, a.stopwords.length, "no duplicate stopword");
});

// ---- prompt files ---------------------------------------------------------------

test("every @prompts reference in policy.prompts resolves to a file", () => {
  let seen = 0;
  for (const [name, value] of Object.entries(policy.prompts)) {
    for (const part of parts(value)) {
      if (typeof part !== "string" || !part.startsWith("@prompts/")) continue;
      const m = part.match(REF);
      assert.ok(m, `${name}: malformed reference ${part}`);
      assert.ok(fs.existsSync(path.join(PROMPTS_DIR, m[1])), `${name}: ${part} does not exist`);
      seen++;
    }
  }
  assert.ok(seen >= 4, "the policy refers to prompt files");
});

test("every prompt file is wired or documented as not wired", () => {
  const wired = new Set();
  for (const value of Object.values(policy.prompts)) {
    for (const part of parts(value)) {
      const m = typeof part === "string" ? part.match(REF) : null;
      if (m) wired.add(m[1]);
    }
  }
  const readme = fs.readFileSync(path.join(PROMPTS_DIR, "README.md"), "utf8").split("\n");
  const start = readme.findIndex((line) => /^## Not wired\s*$/.test(line));
  assert.ok(start >= 0, "README has a 'Not wired' heading");
  const notWired = new Set();
  for (const line of readme.slice(start + 1)) {
    if (/^## /.test(line)) break;
    const m = line.match(/^\| `([A-Za-z0-9._-]+\.md)` \|/);
    if (m) notWired.add(m[1]);
  }
  const files = fs.readdirSync(PROMPTS_DIR).filter((f) => f.endsWith(".md") && f !== "README.md");
  assert.ok(files.length >= 7, "prompt files found");
  for (const f of files) {
    assert.ok(wired.has(f) || notWired.has(f), `${f} is neither wired nor listed under Not wired`);
    assert.ok(!(wired.has(f) && notWired.has(f)), `${f} is both wired and listed as not wired`);
  }
  for (const f of notWired) assert.ok(files.includes(f), `README lists ${f}, which does not exist`);
  assert.deepEqual([...notWired].sort(), [
    "ast-grep-verification.md", "ranking-ast-grep-verification.md", "refactor-opportunities-research.md",
  ]);
});

test("research templates ask for status frontmatter", () => {
  for (const name of ["research", "research-with-map", "research-revise"]) {
    assert.ok(parts(policy.prompts[name]).includes(STATUS_RULE), `${name} holds the status rule line`);
  }
  // The shipped legacy prompt stays unedited: it asks for no frontmatter itself.
  const legacy = fs.readFileSync(path.join(PROMPTS_DIR, "research-with-map.md"), "utf8");
  assert.ok(!/frontmatter/i.test(legacy));
});

test("frame guide covers each ask point", () => {
  const guide = fs.readFileSync(path.join(PROMPTS_DIR, "frame-unattended.md"), "utf8");
  const rules = guide.split("\n").filter((line) => line.includes("**GIVEN**"));
  const ruleFor = (needle) => rules.filter((line) => line.includes(needle));
  assert.ok(ruleFor("Step 1 ").length >= 1, "Step 1 confirm");
  assert.ok(ruleFor("Step 1.5").length >= 2, "Step 1.5 answered, and the not-sure option");
  assert.ok(ruleFor("Step 4").length >= 2, "Step 4 skipped, answered, and the not-sure option");
  assert.ok(ruleFor("Step 7").length >= 3, "Step 7 hand off, stop, and the clipboard");
  assert.ok(rules.some((line) => line.includes("Step 7") && line.includes("pbcopy") && line.includes("**MUST NOT**")), "clipboard is never run");
  assert.ok(rules.some((line) => line.includes("plain-text question") && line.includes("**MUST NOT**")), "no plain-text question");
  assert.ok(rules.some((line) => line.includes("## Reframed (or Confirmed) Problem Statement") && line.includes("exactly one Confidence label")));
  assert.ok(rules.some((line) => line.includes("needsHuman") && line.includes("goal is empty")), "empty goal blocks");
  assert.ok(rules.some((line) => line.includes("names a task but no separate observation") && line.includes("LOW") && line.includes("`done`")), "plain goal ends done at LOW");
  // The frame prompts hand the guide to the subagent.
  assert.ok(parts(policy.prompts.frame).includes("@prompts/frame-unattended.md"));
  assert.ok(parts(policy.prompts["frame-rethink"]).includes("@prompts/frame-unattended.md"));
});

// ---- loader ---------------------------------------------------------------------

test("loader joins array parts and resolves a file reference", () => {
  const project = makeProject({ policy: { prompts: { plan: ["Run it {id}", "@prompts/frame-unattended.md"] } } });
  const res = init(project, "fix typo");
  assert.equal(res.status, 0);
  const guide = fs.readFileSync(path.join(PROMPTS_DIR, "frame-unattended.md"), "utf8").trim().replaceAll("{id}", "demo");
  assert.equal(res.json.prompt, `Run it demo\n${guide}\n\n${SUFFIX}`);
});

test("a goal text never resolves a prompt reference", () => {
  const project = makeProject();
  const res = init(project, "@prompts/README.md");
  assert.equal(res.status, 0);
  assert.ok(res.json.prompt.startsWith("Run /10x-plan demo @prompts/README.md\n"));
  assert.ok(!res.json.prompt.includes("# Pipeline prompts"));
});

test("a missing or malformed prompt reference ends in a JSON halt", () => {
  const bad = {
    "missing file": ["@prompts/does-not-exist.md"],
    "path out of the folder": ["@prompts/../README.md"],
    "no .md": ["@prompts/frame-unattended"],
    "not a string part": [1],
    "missing key": null,
  };
  for (const [name, value] of Object.entries(bad)) {
    const project = makeProject({ policy: { prompts: { plan: value } } });
    const res = init(project, "fix typo");
    assert.equal(res.status, 1, name);
    assert.equal(res.json.action, "halt", name);
    assert.match(res.json.reason, /^Router error: policy\.prompts\.plan /, name);
  }
});

// ---- plan prompt: artifacts ------------------------------------------------------

test("plan prompt without artifacts equals today's text", () => {
  const project = makeProject();
  const res = init(project, "fix typo");
  assert.equal(res.status, 0);
  assert.equal(
    res.json.prompt,
    "Run /10x-plan demo fix typo\nWrite the plan to context/changes/demo/plan.md with a valid ## Progress section.\n\n" + SUFFIX,
  );
});

test("plan-revise prompt without artifacts equals today's text", () => {
  const project = replanProject();
  const res = init(project, "fix typo", ["--rigor", "standard"]);
  assert.equal(res.status, 0);
  assert.equal(res.json.step, "plan");
  assert.equal(
    res.json.prompt,
    "Run /10x-plan demo\nRevise the existing context/changes/demo/plan.md. Resolve every CRITICAL finding and every WARNING with a clear fix in context/changes/demo/reviews/plan-review.md (verdict: RETHINK). Keep the ## Progress contract, step indices and titles.\n\n" + SUFFIX,
  );
});

test("plan prompt lists the artifacts that exist", () => {
  const listed = (project) => {
    const lines = init(project, "fix typo").json.prompt.split("\n");
    assert.equal(lines[0], "Run /10x-plan demo fix typo");
    return lines[1];
  };
  const none = makeProject();
  assert.equal(listed(none), "Write the plan to context/changes/demo/plan.md with a valid ## Progress section.");

  const research = makeProject();
  touch(research, "research.md");
  assert.equal(listed(research), "Upstream artifacts (read each fully before planning): context/changes/demo/research.md");

  const both = makeProject();
  touch(both, "frame.md");
  touch(both, "research.md");
  assert.equal(listed(both), "Upstream artifacts (read each fully before planning): context/changes/demo/research.md, context/changes/demo/frame.md");

  const all = makeProject();
  for (const f of ["frame.md", "refactor-anti-corruption-layer.md", "refactor-invariant-aggregate.md", "research.md"]) touch(all, f);
  assert.equal(
    listed(all),
    "Upstream artifacts (read each fully before planning): context/changes/demo/research.md, context/changes/demo/refactor-invariant-aggregate.md, context/changes/demo/refactor-anti-corruption-layer.md, context/changes/demo/frame.md",
  );

  // A brief alone is listed, and an absent artifact is not named.
  const brief = makeProject();
  touch(brief, "refactor-anti-corruption-layer.md");
  const line = listed(brief);
  assert.ok(line.endsWith("context/changes/demo/refactor-anti-corruption-layer.md"));
  assert.ok(!line.includes("research.md") && !line.includes("frame.md") && !line.includes("invariant"));
});

test("plan-revise prompt lists the artifacts that exist on its second line", () => {
  const project = replanProject();
  touch(project, "research.md");
  const res = init(project, "fix typo", ["--rigor", "standard"]);
  const lines = res.json.prompt.split("\n");
  assert.equal(lines[0], "Run /10x-plan demo");
  assert.equal(lines[1], "Upstream artifacts (read each fully before planning): context/changes/demo/research.md");
  assert.ok(lines[2].startsWith("Revise the existing"));
});

// ---- plan-revise prompt: frame authority -----------------------------------------

test("frame authority rule only with frame.md", () => {
  const without = replanProject();
  const a = withoutSuffix(init(without, "fix typo", ["--rigor", "standard"]).json.prompt);
  assert.ok(!a.includes("authoritative"));
  assert.ok(!a.includes("frame.md"));

  const withFrame = replanProject();
  touch(withFrame, "frame.md");
  const b = withoutSuffix(init(withFrame, "fix typo", ["--rigor", "standard"]).json.prompt);
  assert.ok(b.includes("treat its reframed problem statement as authoritative"));
  // The rule is the last line of the prompt, after the unchanged re-plan text.
  const lines = b.split("\n");
  assert.ok(lines[lines.length - 1].startsWith("- **GIVEN** context/changes/demo/frame.md is listed under the upstream artifacts"));
  assert.ok(lines[lines.length - 2].endsWith("Keep the ## Progress contract, step indices and titles."));

  // The plain plan prompt never carries the rule.
  const fresh = makeProject();
  touch(fresh, "frame.md");
  assert.ok(!withoutSuffix(init(fresh, "fix typo").json.prompt).includes("authoritative"));
});

test("frame authority line names the real change id and leaves no braces", () => {
  for (const frame of [false, true]) {
    const project = replanProject("my-change");
    if (frame) touch(project, "frame.md");
    const text = withoutSuffix(init(project, "fix typo", ["--rigor", "standard"]).json.prompt);
    assert.ok(!text.includes("{"), `no brace left (frame.md ${frame ? "present" : "absent"}): ${text}`);
    assert.ok(!text.includes("}"), `no brace left (frame.md ${frame ? "present" : "absent"})`);
    assert.equal(text.includes("context/changes/my-change/frame.md is listed under the upstream artifacts"), frame);
  }
});

test("frame authority rule wins over the Progress titles line and keeps the contract", () => {
  const project = replanProject();
  touch(project, "frame.md");
  const text = withoutSuffix(init(project, "fix typo", ["--rigor", "standard"]).json.prompt);
  const rule = text.split("\n").pop();
  assert.match(rule, /rework every phase and row that contradicts it/);
  assert.match(rule, /Progress contract \(format, numbering and checkbox syntax\)/);
  assert.match(rule, /wins over the line that keeps step indices and titles/);
  // Exactly one rule line with one bold keyword (the form test in rules.test.mjs checks the shape).
  assert.equal([...rule.matchAll(/\*\*(MUST NOT|MUST|SHOULD NOT|SHOULD|MAY)\*\*/g)].length, 1);
});
