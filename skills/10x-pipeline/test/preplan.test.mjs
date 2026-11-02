// Pre-plan steps of the pre-plan-steps change. Black-box through the CLI, plus data checks on policy.json.
// Phase 2 covers the policy data and the prompt wiring (loader, artifact list, frame authority line).
// Phase 3 covers the gates, the predicates, the verification by artifact and the skip-cap fix.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  cleanupAll, makeProject, planText, writeReview, init, next, run, writeLog, entry, writeResult,
  readLogEntries, readMetaFile, readReportFile, writeOverride,
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

test("a bad prompt reference halts before the subagent result is consumed", () => {
  const project = makeProject();
  assert.equal(init(project, "fix typo").json.step, "plan");
  const overrideFile = path.join(project.root, "context/foundation/agent-smith-policy.json");
  const resultFile = path.join(project.agentDir, "last-result.json");
  const bad = {
    "missing file": ["@prompts/does-not-exist.md"],
    "path out of the folder": ["@prompts/../README.md"],
    "missing key": null,
  };
  // The broken prompt is one the next step does not use, so only the early check can catch it.
  for (const [name, value] of Object.entries(bad)) {
    writeOverride(project, { prompts: { "plan-review": value } });
    writeResult(project, { status: "done", note: "kept" });
    const halted = next(project);
    assert.equal(halted.status, 1, name);
    assert.equal(halted.json.action, "halt", name);
    assert.match(halted.json.reason, /^Router error: policy\.prompts\.plan-review /, name);
    assert.match(halted.json.reason, /result file and the log are untouched/, name);
    assert.ok(fs.existsSync(resultFile), `${name}: the result file is still there`);
    assert.equal(readLogEntries(project).filter((e) => !e.skipped)[0].result, undefined, `${name}: the log entry has no result yet`);
  }
  // After the policy is fixed the same result is consumed and the run goes on.
  fs.rmSync(overrideFile);
  const resumed = next(project);
  assert.equal(resumed.status, 0, resumed.stdout);
  assert.equal(resumed.json.action, "run");
  assert.equal(readLogEntries(project)[0].result.note, "kept");
  assert.ok(!fs.existsSync(resultFile), "the result file is consumed once");
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

// ---- Phase 3 helpers --------------------------------------------------------------

const RESEARCH = "---\nstatus: complete\n---\n# Research\n";
const BRIEF = "---\ntype: refactor-plan\n---\n# Brief\n";
const frameText = (label = "HIGH") =>
  `# Frame Brief: demo\n\n## Reframed (or Confirmed) Problem Statement\n\nThe task.\n\n## Confidence\n\n- HIGH\n- MEDIUM\n- LOW\n\nStated: ${label}\n`;

const future = () => new Date(Date.now() + 60_000);

// An artifact in the change folder with a fresh mtime (or the given one), so ordering with startedAt never depends on the clock.
function put(project, file, text, when = future()) {
  const abs = path.join(project.changeDir, file);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, text);
  fs.utimesSync(abs, when, when);
}

// A file under the project root (distillation report, repo map).
function putRoot(project, file, text) {
  const abs = path.join(project.root, file);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, text);
}

const thorough = (project, goal, extra = []) => init(project, goal, ["--rigor", "thorough", ...extra]);
const finish = (project, result = { status: "done", note: "ok" }) => {
  writeResult(project, result);
  return next(project);
};
const ranOf = (project) => readLogEntries(project).filter((e) => !e.skipped);
const skipsOf = (project) => readLogEntries(project).filter((e) => e.skipped);
const lastRan = (project) => ranOf(project)[ranOf(project).length - 1];

// What the first answer of a thorough run was: the step, the template the router logged, and the skips before it.
function start(project, goal, extra = []) {
  const res = thorough(project, goal, extra);
  assert.equal(res.status, 0, res.stdout + res.stderr);
  return { res, step: res.json.step, template: lastRan(project)?.template, skips: skipsOf(project) };
}

// ---- distillation fixtures: synthetic rows in the real report format -----------------

const REF_HEADER = "| id | candidate | invariant (quoted) | source | status | guarded at | gap |\n| --- | --- | --- | --- | --- | --- | --- |";
const SHORT_HEADER = "| id | invariant (quoted) | source | status | guarded at | gap |\n| --- | --- | --- | --- | --- | --- |";
const POLICY_HEADER = "| id | policy (quoted) | source | status | guarded at | gap |\n| --- | --- | --- | --- | --- | --- |";
const DRIFT = "## Model vs code drift\n\n| id | the documents say (newest) | the code does |\n| --- | --- | --- |\n| D-1 | x | y |\n";
const FILE_A = "context/domain/domain-distillation.md";
const FILE_B = "context/domain/01-domain-distillation.md";

const section = (...blocks) => `# Domain distillation\n\n## Summary\n\nx\n\n## Invariants and policies\n\n${blocks.join("\n\n")}\n\n${DRIFT}`;
const refRow = (id, candidate, invariant, status, gap = "none") => `| ${id} | ${candidate} | "${invariant}" | spec | ${status} | \`a.js:1\` | ${gap} |`;
const row = (id, invariant, status, gap = "none") => `| ${id} | "${invariant}" | spec | ${status} | \`a.js:1\` | ${gap} |`;

// Does the aggregateGap predicate hit for this report and goal? Research exists, so the domain brief is the first gate asked.
function gapHit(files, goal) {
  const project = makeProject();
  put(project, "research.md", RESEARCH);
  for (const [file, text] of Object.entries(files)) putRoot(project, file, text);
  const out = start(project, goal);
  assert.ok(out.step === "domain-brief" || out.step === "plan", `unexpected step ${out.step}`);
  return out.step === "domain-brief" && out.template === "domain-aggregate";
}

// ---- gates ----------------------------------------------------------------------------

test("default policy keeps the first step at lean and standard", () => {
  const lean = makeProject();
  const a = init(lean, "fix typo");
  assert.equal(a.json.step, "plan");
  assert.equal(readMetaFile(lean).rigor.level, "lean");
  assert.deepEqual(skipsOf(lean), []);

  const standard = makeProject();
  const b = init(standard, Array.from({ length: 30 }, (_, i) => `word${i}`).join(" "));
  assert.equal(b.json.step, "plan");
  assert.equal(readMetaFile(standard).rigor.level, "standard");
  assert.deepEqual(skipsOf(standard), []);

  // A cause-shaped goal and a distillation report change nothing below thorough.
  const loud = makeProject();
  putRoot(loud, FILE_A, section(REF_HEADER + "\n" + refRow("R-1", "World", "A world has one slug", "**declared**", "unchecked")));
  const c = init(loud, "Worlds break because the slug is unchecked", ["--rigor", "standard"]);
  assert.equal(c.json.step, "plan");
  assert.deepEqual(skipsOf(loud), []);
});

test("thorough opens the pre-plan gates", () => {
  const project = makeProject();
  const first = start(project, "fix typo");
  assert.equal(first.step, "research");
  assert.equal(first.template, "research");
  assert.equal(first.res.json.model, "sonnet");
  assert.equal(first.res.json.effort, "high");
  assert.match(first.res.json.reason, /rigor thorough: research runs/);
  assert.deepEqual(first.skips, []);

  // fix typo: research runs, then the domain brief and the frame step are skipped and the plan follows without a halt.
  put(project, "research.md", RESEARCH);
  const res = finish(project);
  assert.equal(res.status, 0);
  assert.equal(res.json.step, "plan");
  const skips = skipsOf(project);
  assert.deepEqual(skips.map((s) => s.step), ["domain-brief", "frame"]);
  assert.ok(skips.every((s) => s.afterN === 1 && s.rigor === "thorough"));
});

test("research skipped when research.md exists", () => {
  const project = makeProject();
  put(project, "research.md", RESEARCH);
  const out = start(project, "fix typo");
  assert.equal(out.step, "plan");
  const skip = out.skips.find((s) => s.step === "research");
  assert.ok(skip, "a skip entry for research");
  assert.match(skip.reason, /^rigor thorough: research skipped \(researchExists: research\.md exists\)$/);
  assert.equal(skip.afterN, 0);
  // The next gate was evaluated in the same call.
  assert.ok(out.skips.some((s) => s.step === "domain-brief"));
});

test("repo map selects research-with-map", () => {
  const legacyFirstLine = fs.readFileSync(path.join(PROMPTS_DIR, "research-with-map.md"), "utf8").split("\n")[0].replace("{id}", "demo").replace("{goal}", "fix typo");

  const mapped = makeProject();
  putRoot(mapped, "context/map/repo-map.md", "---\nartifact: repo-map\n---\n# Map\n");
  const a = start(mapped, "fix typo");
  assert.equal(a.step, "research");
  assert.equal(a.template, "research-with-map");
  assert.ok(a.res.json.prompt.startsWith(legacyFirstLine));
  assert.ok(a.res.json.prompt.includes(STATUS_RULE.replace("{id}", "demo")));

  const other = makeProject();
  putRoot(other, "context/map/repo-map.md", "---\nartifact: something-else\n---\n# Map\n");
  assert.equal(start(other, "fix typo").template, "research");

  const plain = makeProject();
  putRoot(plain, "context/map/repo-map.md", "# Map without frontmatter\n");
  assert.equal(start(plain, "fix typo").template, "research");

  const none = makeProject();
  assert.equal(start(none, "fix typo").template, "research");
});

// ---- aggregateGap ---------------------------------------------------------------------

test("aggregateGap on the reference template", () => {
  const declared = section(`${REF_HEADER}\n${refRow("R-1", "World", "A world has one slug", "**declared**", "no check at insert")}`);
  assert.equal(gapHit({ [FILE_A]: declared }, "Rename the world tooltip"), true);
  // Other statuses in the policy list count too.
  for (const status of ["ignored", "contradicted"]) {
    const text = section(`${REF_HEADER}\n${refRow("R-1", "World", "A world has one slug", `**${status}**`)}`);
    assert.equal(gapHit({ [FILE_A]: text }, "Rename the world tooltip"), true, status);
  }
  // No shared word: no hit.
  assert.equal(gapHit({ [FILE_A]: declared }, "Polish the footer layout"), false);
  // An enforced row does not hit, even with a shared word.
  const enforced = section(`${REF_HEADER}\n${refRow("R-1", "World", "A world has one slug", "**enforced**")}`);
  assert.equal(gapHit({ [FILE_A]: enforced }, "Rename the world tooltip"), false);
  // The second file path works.
  assert.equal(gapHit({ [FILE_B]: declared }, "Rename the world tooltip"), true);
  // The first existing file wins: it has no declared row, so the second file is never read.
  assert.equal(gapHit({ [FILE_A]: enforced, [FILE_B]: declared }, "Rename the world tooltip"), false);
});

test("aggregateGap on multi-candidate sections", () => {
  const text = [
    "# Domain distillation",
    "",
    "## Invariants and policies",
    "",
    "### World lifecycle",
    "",
    SHORT_HEADER,
    row("R-1", "A realm needs one slug", "**declared**", "the slug is not checked"),
    row("R-2", "A pod is archived once", "**enforced**"),
    "",
    "### Ticket handling",
    "",
    SHORT_HEADER,
    row("R-3", "A ticket closes once", "**declared**", "double close possible"),
    "",
    "### Code-only rules",
    "",
    "- C-1 a pigeon rule that is declared in code only",
    "",
    "## Model vs code drift",
    "",
    SHORT_HEADER,
    row("D-2", "A comet orbits", "**declared**"),
    "",
  ].join("\n");
  const files = { [FILE_A]: text };
  // A row under the first heading hits through its own text, a row under the second heading through the second table.
  assert.equal(gapHit(files, "Fix the slug check"), true);
  assert.equal(gapHit(files, "Close the ticket twice"), true);
  // The enforced row does not hit even when the goal names it.
  assert.equal(gapHit(files, "Archive the pod"), false);
  // A heading word is not a word source.
  assert.equal(gapHit(files, "World lifecycle handling"), false);
  // A table under a later ## section is not read.
  assert.equal(gapHit(files, "Comet orbits"), false);
  // A list such as Code-only rules is ignored.
  assert.equal(gapHit(files, "A pigeon rule"), false);
});

test("aggregateGap on a policy (quoted) table", () => {
  const text = section(`### Product-wide policies\n\n${POLICY_HEADER}\n${row("R-9", "Every export is logged", "**declared**", "exports skip the log")}\n${row("R-10", "Every import is checked", "**enforced**")}`);
  assert.equal(gapHit({ [FILE_A]: text }, "Log the export"), true);
  assert.equal(gapHit({ [FILE_A]: text }, "Check the import"), false);
  // The gap cell is a word source too.
  assert.equal(gapHit({ [FILE_A]: text }, "Skip the exports"), true);
});

test("aggregateGap heading word does not hit rows", () => {
  const text = section(`### World\n\n${SHORT_HEADER}\n${row("R-1", "A ticket closes once", "**declared**", "double close")}\n${row("R-2", "A ledger balances", "**declared**", "none")}`);
  assert.equal(gapHit({ [FILE_A]: text }, "world"), false);
  assert.equal(gapHit({ [FILE_A]: text }, "Rework the world page"), false);
  // The same words in a row do hit.
  assert.equal(gapHit({ [FILE_A]: text }, "Close the ticket"), true);
});

test("aggregateGap matches whole words", () => {
  const under = section(`${SHORT_HEADER}\n${row("R-1", "An underworld gate opens once", "**declared**")}`);
  assert.equal(gapHit({ [FILE_A]: under }, "Rename the world tooltip"), false);
  assert.equal(gapHit({ [FILE_A]: under }, "Rename the underworld tooltip"), true);
  const plural = section(`${SHORT_HEADER}\n${row("R-1", "Worlds are numbered", "**declared**")}`);
  assert.equal(gapHit({ [FILE_A]: plural }, "Rename the world tooltip"), false);
  assert.equal(gapHit({ [FILE_A]: plural }, "Rename the worlds tooltip"), true);
});

test("aggregateGap qualified status", () => {
  const rowFor = (status) => section(`${SHORT_HEADER}\n${row("R-1", "A world has one slug", status)}`);
  assert.equal(gapHit({ [FILE_A]: rowFor("**enforced** (new worlds)") }, "Rename the world tooltip"), false);
  assert.equal(gapHit({ [FILE_A]: rowFor("declared (soft)") }, "Rename the world tooltip"), true);
  assert.equal(gapHit({ [FILE_A]: rowFor("**declared**") }, "Rename the world tooltip"), true);
  assert.equal(gapHit({ [FILE_A]: rowFor("`declared`") }, "Rename the world tooltip"), true);
  assert.equal(gapHit({ [FILE_A]: rowFor("_ignored_ for now") }, "Rename the world tooltip"), true);
  assert.equal(gapHit({ [FILE_A]: rowFor("") }, "Rename the world tooltip"), false);
});

test("aggregateGap ignores stopwords and short words", () => {
  const text = section(`${SHORT_HEADER}\n${row("R-1", "Every page needs a tag", "**declared**", "none")}`);
  // "page" and "every" are stopwords, "tag" is shorter than minWordLength.
  assert.equal(gapHit({ [FILE_A]: text }, "Update the page tag every day"), false);
  assert.equal(gapHit({ [FILE_A]: text }, "Rename the tag"), false);
});

test("aggregateGap with no file, no section or no usable table is no hit and no halt", () => {
  const cases = {
    "no file": {},
    "no section": { [FILE_A]: "# Domain distillation\n\n## Summary\n\nWorld rows.\n" },
    "section without a table": { [FILE_A]: "# D\n\n## Invariants and policies\n\n- R-1 a world rule that is declared\n" },
    "table without status": { [FILE_A]: `# D\n\n## Invariants and policies\n\n| id | invariant (quoted) | gap |\n| --- | --- | --- |\n| R-1 | "world rule" | declared world |\n` },
    "table without invariant or policy": { [FILE_A]: `# D\n\n## Invariants and policies\n\n| id | rule | status |\n| --- | --- | --- |\n| R-1 | world rule | declared |\n` },
    "table without separator row": { [FILE_A]: `# D\n\n## Invariants and policies\n\n| id | invariant (quoted) | status |\n| R-1 | world rule | declared |\n` },
    "empty file": { [FILE_A]: "" },
  };
  for (const [name, files] of Object.entries(cases)) {
    assert.equal(gapHit(files, "Rename the world rule tooltip"), false, name);
  }
});

test("aggregateGap wins when both hit", () => {
  const project = makeProject();
  put(project, "research.md", RESEARCH);
  putRoot(project, FILE_A, section(`${REF_HEADER}\n${refRow("R-1", "World", "A world has one slug", "**declared**")}`));
  const out = start(project, "Wrap the vendor sdk for the world tooltip");
  assert.equal(out.step, "domain-brief");
  assert.equal(out.template, "domain-aggregate");
  assert.match(out.res.json.reason, /aggregateGap/);
});

// ---- domain brief ---------------------------------------------------------------------

test("domain brief by dependencyLeak", () => {
  const project = makeProject();
  put(project, "research.md", RESEARCH);
  const out = start(project, "Put an adapter around the vendor sdk");
  assert.equal(out.step, "domain-brief");
  assert.equal(out.template, "domain-acl");
  assert.equal(out.res.json.model, "sonnet");
  assert.match(out.res.json.reason, /dependencyLeak/);
  assert.ok(out.res.json.prompt.startsWith("You are a Domain-Driven Design specialist who finds leaking dependencies"));
});

test("domain brief skipped with no signal", () => {
  const project = makeProject();
  put(project, "research.md", RESEARCH);
  const out = start(project, "fix typo");
  const skip = out.skips.find((s) => s.step === "domain-brief");
  assert.ok(skip);
  assert.match(skip.reason, /^rigor thorough: domain-brief skipped \(no signal; aggregateGap: .*; dependencyLeak: .*\)$/);
  assert.equal(out.step, "plan");

  // An existing brief file skips the step even when the goal names a leak.
  for (const file of ["refactor-invariant-aggregate.md", "refactor-anti-corruption-layer.md"]) {
    const done = makeProject();
    put(done, "research.md", RESEARCH);
    put(done, file, BRIEF);
    const res = start(done, "Put an adapter around the vendor sdk");
    assert.equal(res.step, "plan", file);
    assert.match(res.skips.find((s) => s.step === "domain-brief").reason, /briefExists: .*\.md exists/, file);
  }
});

test("briefExists and the frame authority line follow the policy, not fixed names", () => {
  // A project renames the brief template and its artifact; the skip must follow, not the two shipped names.
  const policyOverride = {
    preplan: {
      gates: { "domain-brief": { variants: [{ when: "dependencyLeak", template: "acl-custom" }] } },
      artifacts: { "acl-custom": "custom-acl-brief.md", frame: "reframe.md" },
    },
    prompts: { "acl-custom": "Write the custom brief for {id}" },
  };
  const open = makeProject({ policy: policyOverride });
  put(open, "research.md", RESEARCH);
  const a = start(open, "Put an adapter around the vendor sdk");
  assert.equal(a.step, "domain-brief");
  assert.equal(a.template, "acl-custom");

  const done = makeProject({ policy: policyOverride });
  put(done, "research.md", RESEARCH);
  put(done, "custom-acl-brief.md", BRIEF);
  const b = start(done, "Put an adapter around the vendor sdk");
  assert.equal(b.step, "plan");
  assert.match(b.skips.find((s) => s.step === "domain-brief").reason, /briefExists: custom-acl-brief\.md exists/);
  // The plan prompt lists the renamed brief.
  assert.match(b.res.json.prompt, /context\/changes\/demo\/custom-acl-brief\.md/);

  // The authority line follows the renamed frame artifact: reframe.md triggers it, frame.md does not.
  const renamed = replanProject();
  writeOverride(renamed, policyOverride);
  touch(renamed, "frame.md");
  assert.ok(!withoutSuffix(init(renamed, "fix typo", ["--rigor", "standard"]).json.prompt).includes("authoritative"));
  const named = replanProject();
  writeOverride(named, policyOverride);
  touch(named, "reframe.md");
  assert.ok(withoutSuffix(init(named, "fix typo", ["--rigor", "standard"]).json.prompt).includes("authoritative"));
});

// ---- frame ----------------------------------------------------------------------------

test("framing doubt by cause-shaped goal", () => {
  for (const goal of ["Logins fail because the token cache is stale", "Bug caused by token expiry", "Rethink the session store"]) {
    const project = makeProject();
    put(project, "research.md", RESEARCH);
    const out = start(project, goal);
    assert.equal(out.step, "frame", goal);
    assert.equal(out.template, "frame", goal);
    assert.equal(out.res.json.model, "opus", goal);
    assert.equal(out.res.json.effort, "high", goal);
    assert.match(out.res.json.reason, /framingDoubt/, goal);
  }
});

test("framing doubt by signals.rigor of an earlier step", () => {
  const project = makeProject();
  put(project, "research.md", RESEARCH);
  writeLog(project, [entry(1, "research", { signals: { rigor: "thorough" } })]);
  const out = start(project, "fix typo");
  assert.equal(out.step, "frame");
  assert.match(out.res.json.reason, /signals\.rigor of step 1 \(research\)/);

  // Without the signal the same log goes on to plan.
  const quiet = makeProject();
  put(quiet, "research.md", RESEARCH);
  writeLog(quiet, [entry(1, "research")]);
  assert.equal(start(quiet, "fix typo").step, "plan");
});

test("framing doubt: any valid signals.rigor of an earlier step counts, as the plan says", () => {
  // The plan (Decision 1, Phase 3) names "a signals.rigor on an earlier pre-plan step", whatever its value: the
  // step ran at thorough already, so the value cannot raise the level, and a subagent that adds the key says the
  // change is riskier than the goal suggested. A value that is no rigor level is dropped before the router sees it.
  for (const value of ["lean", "standard", "thorough"]) {
    const project = makeProject();
    assert.equal(start(project, "fix typo").step, "research");
    put(project, "research.md", RESEARCH);
    const res = finish(project, { status: "done", note: "n", signals: { rigor: value } });
    assert.equal(res.json.step, "frame", value);
    assert.match(res.json.reason, /signals\.rigor of step 1 \(research\)/, value);
    assert.equal(readMetaFile(project).rigor.level, "thorough", value);
  }
  const bogus = makeProject();
  start(bogus, "fix typo");
  put(bogus, "research.md", RESEARCH);
  const res = finish(bogus, { status: "done", note: "n", signals: { rigor: "extreme" } });
  assert.equal(res.json.step, "plan");
  assert.equal(ranOf(bogus)[0].signals, undefined);
});

test("framing doubt does not fire on fix typo", () => {
  for (const goal of ["fix typo", "fixture cleanup", "fixes for the router", "bug report template"]) {
    const project = makeProject();
    put(project, "research.md", RESEARCH);
    const out = start(project, goal);
    assert.equal(out.step, "plan", goal);
    const skip = out.skips.find((s) => s.step === "frame");
    assert.ok(skip, goal);
    assert.match(skip.reason, /^rigor thorough: frame skipped \(no signal; framingDoubt: /, goal);
  }
  // A word start is needed: "because" inside another word does not count.
  const project = makeProject();
  put(project, "research.md", RESEARCH);
  assert.equal(start(project, "Rename unbecause").step, "plan");
});

// ---- skip cap -------------------------------------------------------------------------

test("three skips in one call", () => {
  const project = makeProject();
  put(project, "research.md", RESEARCH);
  const out = start(project, "fix typo");
  assert.equal(out.step, "plan");
  assert.equal(out.res.json.action, "run");
  assert.deepEqual(out.skips.map((s) => s.step), ["research", "domain-brief", "frame"]);
  for (const s of out.skips) {
    assert.equal(s.afterN, 0);
    assert.equal(s.rigor, "thorough");
    assert.equal(typeof s.reason, "string");
    assert.ok(!("risk" in s), "a pre-plan skip row has no risk key");
  }
  assert.equal(ranOf(project).length, 1);
  // The report lists all three.
  const res = run(project, ["status", project.id, "--report"]);
  assert.equal(res.status, 0);
  const report = readReportFile(project);
  assert.match(report, /Skipped: 3/);
  const rows = report.split("\n").filter((l) => /^\| 0 \| (research|domain-brief|frame) \|/.test(l));
  assert.equal(rows.length, 3);
});

test("pre-plan skip row in status and report", () => {
  const project = makeProject();
  put(project, "research.md", RESEARCH);
  start(project, "fix typo");
  const res = run(project, ["status", project.id, "--report"]);
  assert.equal(res.status, 0);
  const skipped = res.json.steps.filter((s) => s.skipped);
  assert.deepEqual(skipped.map((s) => s.step), ["research", "domain-brief", "frame"]);
  for (const s of skipped) {
    assert.equal(s.skipped, true);
    assert.equal(s.risk, null);
    assert.equal(s.rigor, "thorough");
    assert.equal(s.afterN, 0);
    assert.ok(s.reason.startsWith(`rigor thorough: ${s.step} skipped`));
  }
  const report = readReportFile(project);
  const at = report.indexOf("## Skipped steps");
  assert.ok(at >= 0, "report has a Skipped steps section");
  const table = report.slice(at);
  assert.match(table, /\| 0 \| research \| rigor thorough: research skipped \(researchExists: research\.md exists\) \| thorough \|/);
  assert.match(table, /\| 0 \| frame \| rigor thorough: frame skipped \(no signal; framingDoubt: /);
});

// ---- failures and retries -----------------------------------------------------------

test("failed research is retried at the next tier and halts after three failures", () => {
  const project = makeProject();
  putRoot(project, "context/map/repo-map.md", "---\nartifact: repo-map\n---\n# Map\n");
  const first = start(project, "fix typo");
  assert.equal(first.step, "research");
  assert.equal(lastRan(project).tier, 3);

  // The repo map is gone, yet the retry keeps the template of the failed attempt.
  fs.rmSync(path.join(project.root, "context/map/repo-map.md"));
  const second = finish(project, { status: "failed", note: "no luck" });
  assert.equal(second.status, 0);
  assert.equal(second.json.step, "research");
  assert.equal(lastRan(project).template, "research-with-map");
  assert.equal(lastRan(project).tier, 4);
  assert.match(lastRan(project).tierWhy, /\+1 for 1 failed attempt\(s\)/);

  const third = finish(project, { status: "failed", note: "again" });
  assert.equal(third.json.step, "research");
  assert.equal(lastRan(project).tier, 5);
  assert.equal(skipsOf(project).length, 0, "a retry writes no skip");

  const last = finish(project, { status: "failed", note: "third time" });
  assert.equal(last.json.action, "halt");
  assert.match(last.json.reason, /research failed 3 times in a row. Last note: third time/);
  assert.equal(ranOf(project).length, 3);
});

test("a failed pre-plan step is retried before skipIf, when and the rigor check", () => {
  // (a) A failed research often leaves a research.md without status frontmatter. researchExists would now hit
  // skipIf, but the failed attempt is retried first: no skip, no plan, and three failures halt the run.
  const research = makeProject();
  assert.equal(start(research, "fix typo").step, "research");
  put(research, "research.md", "# Research without frontmatter\n");
  const again = finish(research);
  assert.equal(ranOf(research)[0].verified, false);
  assert.equal(again.json.action, "run");
  assert.equal(again.json.step, "research", "retried, not skipped and not passed on to plan");
  assert.deepEqual(skipsOf(research), []);
  assert.equal(lastRan(research).tier, 4);
  assert.equal(finish(research).json.step, "research");
  const halted = finish(research);
  assert.equal(halted.json.action, "halt");
  assert.match(halted.json.reason, /research failed 3 times in a row/);
  assert.deepEqual(ranOf(research).map((e) => e.step), ["research", "research", "research"]);
  assert.deepEqual(skipsOf(research), []);

  // (b) The same for frame: a frame.md without "## Reframed" makes frameExists true, yet the step is retried.
  const frame = makeProject();
  put(frame, "research.md", RESEARCH);
  assert.equal(start(frame, "Logins fail because the cache is stale").step, "frame");
  put(frame, "frame.md", "# Frame Brief: demo\n\nNo reframed heading.\n");
  const frameAgain = finish(frame);
  assert.equal(frameAgain.json.step, "frame");
  assert.equal(lastRan(frame).template, "frame");
  assert.deepEqual(skipsOf(frame).filter((sk) => sk.step === "frame"), []);

  // (c) A policy that closes the gate under a run (an unknown minRigor reads as closed) does not drop a failed attempt.
  const closed = makeProject();
  assert.equal(start(closed, "fix typo").step, "research");
  writeOverride(closed, { preplan: { gates: { research: { minRigor: "bogus" } } } });
  const retry = finish(closed, { status: "failed", note: "no luck" });
  assert.equal(retry.json.step, "research", "retried although the gate is now closed");
  assert.equal(lastRan(closed).tier, 4);
  assert.deepEqual(skipsOf(closed), []);

  // (d) A failed domain brief is retried when its `when` signal is gone.
  const brief = makeProject();
  put(brief, "research.md", RESEARCH);
  const first = start(brief, "Put an adapter around the vendor sdk");
  assert.equal(first.step, "domain-brief");
  assert.equal(first.template, "domain-acl");
  writeOverride(brief, { preplan: { predicates: { dependencyLeak: { goalWords: ["zzz"] } } } });
  const briefAgain = finish(brief, { status: "failed", note: "no luck" });
  assert.equal(briefAgain.json.step, "domain-brief");
  assert.equal(lastRan(brief).template, "domain-acl", "the retry keeps the template of the failed attempt");
  assert.deepEqual(skipsOf(brief).filter((s) => s.step === "domain-brief"), []);
});

test("a missing 10x-research or 10x-frame skill fails the step three times and halts", () => {
  // The router cannot see which skills are installed. A subagent that cannot find the skill reports a
  // non-done status without signals.needsHuman, which is a failed attempt: retried, then a halt with the last note.
  for (const status of ["blocked", "failed"]) {
    const research = makeProject();
    assert.equal(start(research, "fix typo").step, "research");
    assert.equal(finish(research, { status, note: "Unknown skill: 10x-research" }).json.step, "research", status);
    assert.equal(finish(research, { status, note: "Unknown skill: 10x-research" }).json.step, "research", status);
    const haltedResearch = finish(research, { status, note: "Unknown skill: 10x-research" });
    assert.equal(haltedResearch.json.action, "halt", status);
    assert.match(haltedResearch.json.reason, /^research failed 3 times in a row\. Last note: Unknown skill: 10x-research/, status);
    assert.ok(ranOf(research).every((e) => e.ok === false && e.verified === false), status);

    const frame = makeProject();
    put(frame, "research.md", RESEARCH);
    assert.equal(start(frame, "Logins fail because the cache is stale").step, "frame");
    finish(frame, { status, note: "Unknown skill: 10x-frame" });
    finish(frame, { status, note: "Unknown skill: 10x-frame" });
    const haltedFrame = finish(frame, { status, note: "Unknown skill: 10x-frame" });
    assert.equal(haltedFrame.json.action, "halt", status);
    assert.match(haltedFrame.json.reason, /^frame failed 3 times in a row\. Last note: Unknown skill: 10x-frame/, status);
  }
});

test("both domain prompt templates name their artifact file and type refactor-plan", () => {
  // What the router verifies (the file of the template, type: refactor-plan) is what the prompt asks the skill to write.
  const aggregate = makeProject();
  put(aggregate, "research.md", RESEARCH);
  putRoot(aggregate, FILE_A, section(`${REF_HEADER}\n${refRow("R-1", "World", "A world has one slug", "**declared**")}`));
  const a = start(aggregate, "Rename the world tooltip");
  assert.equal(a.template, "domain-aggregate");

  const acl = makeProject();
  put(acl, "research.md", RESEARCH);
  const b = start(acl, "Put an adapter around the vendor sdk");
  assert.equal(b.template, "domain-acl");

  for (const [out, template] of [[a, "domain-aggregate"], [b, "domain-acl"]]) {
    const file = policy.preplan.artifacts[template];
    const prompt = withoutSuffix(out.res.json.prompt);
    assert.ok(prompt.includes(`context/changes/demo/${file}`), `${template}: the prompt names ${file}`);
    assert.ok(prompt.includes("type: refactor-plan"), `${template}: the prompt asks for type: refactor-plan`);
    assert.ok(!prompt.includes("{id}"), `${template}: the id is filled`);
  }
});

test("frame stays at opus/high on retry", () => {
  const project = makeProject();
  put(project, "research.md", RESEARCH);
  const first = start(project, "Logins fail because the cache is stale");
  assert.equal(first.step, "frame");
  assert.equal(lastRan(project).tier, 4);

  for (const note of ["one", "two"]) {
    const res = finish(project, { status: "failed", note });
    assert.equal(res.json.step, "frame", note);
    assert.equal(res.json.model, "opus", note);
    assert.equal(res.json.effort, "high", note);
    assert.equal(lastRan(project).tier, 4, note);
    assert.equal(lastRan(project).template, "frame", note);
  }
  assert.match(lastRan(project).tierWhy, /clamped to 4/);
  const halted = finish(project, { status: "failed", note: "three" });
  assert.equal(halted.json.action, "halt");
  assert.match(halted.json.reason, /frame failed 3 times in a row/);
});

test("frame blocked with needsHuman halts and writes the report", () => {
  const project = makeProject();
  put(project, "research.md", RESEARCH);
  start(project, "Logins fail because the cache is stale");
  const res = finish(project, { status: "blocked", note: "nothing to frame", signals: { needsHuman: "the goal is empty and change.md has no notes" } });
  assert.equal(res.status, 0);
  assert.equal(res.json.action, "halt");
  assert.match(res.json.reason, /Step 1 \(frame\) needs a human: the goal is empty and change\.md has no notes/);
  assert.ok(res.json.report, "the halt names a report");
  assert.ok(fs.existsSync(path.join(project.root, res.json.report)));
  assert.match(readReportFile(project), /Outcome: halt - Step 1 \(frame\) needs a human/);
});

test("needsHuman wins over a frame.md that says Confidence HIGH", () => {
  for (const status of ["blocked", "done"]) {
    const project = makeProject();
    put(project, "research.md", RESEARCH);
    start(project, "Logins fail because the cache is stale");
    put(project, "frame.md", frameText("HIGH"));
    const res = finish(project, { status, note: "n", signals: { needsHuman: "no evidence-backed answer" } });
    assert.equal(res.json.action, "halt", status);
    assert.match(res.json.reason, /needs a human: no evidence-backed answer/, status);
    assert.equal(lastRan(project).verified, true, `${status}: the artifact itself passed`);
  }
});

test("frame done with Confidence LOW does not raise rigor and the plan step follows", () => {
  const project = makeProject();
  put(project, "research.md", RESEARCH);
  start(project, "Logins fail because the cache is stale");
  put(project, "frame.md", frameText("LOW"));
  const res = finish(project);
  assert.equal(res.status, 0);
  assert.equal(res.json.action, "run");
  assert.equal(res.json.step, "plan");
  assert.equal(ranOf(project)[0].ok, true);
  const meta = readMetaFile(project);
  assert.equal(meta.rigor.level, "thorough");
  assert.equal(meta.rigor.by, "--rigor thorough");
  assert.equal(skipsOf(project).filter((s) => s.step === "frame").length, 0);
  assert.ok(res.json.prompt.split("\n")[1].includes("context/changes/demo/frame.md"));
});

// ---- verification by artifact ---------------------------------------------------------

test("verification by artifact: research", () => {
  const cases = [
    ["missing status frontmatter fails", "# Research without frontmatter\n", future(), false],
    ["frontmatter without status fails", "---\ntitle: x\n---\n# Research\n", future(), false],
    ["status present passes", RESEARCH, future(), true],
    ["status partial passes", "---\nstatus: partial\n---\n# Research\n", future(), true],
    ["stale mtime fails", RESEARCH, new Date(1000), false],
  ];
  for (const [name, text, when, ok] of cases) {
    const project = makeProject();
    start(project, "fix typo");
    put(project, "research.md", text, when);
    finish(project);
    assert.equal(ranOf(project)[0].ok, ok, name);
    assert.equal(ranOf(project)[0].verified, ok, name);
  }
  // No file at all fails.
  const none = makeProject();
  start(none, "fix typo");
  finish(none);
  assert.equal(ranOf(none)[0].verified, false);
});

test("verification by artifact: frame", () => {
  const cases = [
    ["no Reframed heading fails", "# Frame Brief: demo\n\n## Confidence\n\n- HIGH\n- MEDIUM\n- LOW\n", future(), false],
    ["Reframed heading passes", frameText("MEDIUM"), future(), true],
    ["Confidence LOW still passes", frameText("LOW"), future(), true],
    ["stale mtime fails", frameText("HIGH"), new Date(1000), false],
  ];
  for (const [name, text, when, ok] of cases) {
    const project = makeProject();
    put(project, "research.md", RESEARCH);
    start(project, "Logins fail because the cache is stale");
    put(project, "frame.md", text, when);
    finish(project);
    assert.equal(ranOf(project)[0].ok, ok, name);
    assert.equal(ranOf(project)[0].verified, ok, name);
  }
});

test("verification by artifact: both domain templates", () => {
  const acl = "refactor-anti-corruption-layer.md";
  const aggregate = "refactor-invariant-aggregate.md";
  const wrongType = "---\ntype: notes\n---\n# Brief\n";
  const setups = {
    "domain-acl": (project) => start(project, "Put an adapter around the vendor sdk"),
    "domain-aggregate": (project) => {
      putRoot(project, FILE_A, section(`${REF_HEADER}\n${refRow("R-1", "World", "A world has one slug", "**declared**")}`));
      return start(project, "Rename the world tooltip");
    },
  };
  const own = { "domain-acl": acl, "domain-aggregate": aggregate };
  const other = { "domain-acl": aggregate, "domain-aggregate": acl };
  for (const template of ["domain-acl", "domain-aggregate"]) {
    const attempts = [
      ["the right file with type refactor-plan passes", own[template], BRIEF, future(), true],
      ["the other template's file fails", other[template], BRIEF, future(), false],
      ["the right file with another type fails", own[template], wrongType, future(), false],
      ["the right file without frontmatter fails", own[template], "# Brief\n", future(), false],
      ["a stale mtime fails", own[template], BRIEF, new Date(1000), false],
    ];
    for (const [name, file, text, when, ok] of attempts) {
      const project = makeProject();
      put(project, "research.md", RESEARCH);
      const out = setups[template](project);
      assert.equal(out.template, template, `${template}: ${name}`);
      put(project, file, text, when);
      finish(project);
      assert.equal(ranOf(project)[0].ok, ok, `${template}: ${name}`);
      assert.equal(ranOf(project)[0].verified, ok, `${template}: ${name}`);
    }
  }
});

// ---- the walk into the plan -------------------------------------------------------------

test("plan runs after the pre-plan steps with the artifacts listed", () => {
  const project = makeProject();
  const first = start(project, "Logins fail because the cache is stale");
  assert.equal(first.step, "research");
  put(project, "research.md", RESEARCH);
  const second = finish(project);
  assert.equal(second.json.step, "frame");
  assert.deepEqual(skipsOf(project).map((s) => [s.step, s.afterN]), [["domain-brief", 1]]);
  put(project, "frame.md", frameText("MEDIUM"));
  const third = finish(project);
  assert.equal(third.json.step, "plan");
  assert.equal(third.json.n, 3);
  const lines = third.json.prompt.split("\n");
  assert.equal(lines[0], "Run /10x-plan demo Logins fail because the cache is stale");
  assert.equal(lines[1], "Upstream artifacts (read each fully before planning): context/changes/demo/research.md, context/changes/demo/frame.md");
  assert.deepEqual(ranOf(project).map((e) => e.step), ["research", "frame", "plan"]);
  assert.ok(ranOf(project).slice(0, 2).every((e) => e.ok && e.verified));
});

test("a plan attempt closes the pre-plan phase", () => {
  const project = makeProject();
  writeLog(project, [entry(1, "plan", { ok: false, verified: false, result: { status: "failed", note: "x" } })]);
  const res = thorough(project, "fix typo");
  assert.equal(res.status, 0);
  assert.equal(res.json.step, "plan");
  assert.equal(res.json.n, 2);
  assert.deepEqual(skipsOf(project), []);
  assert.deepEqual(ranOf(project).map((e) => e.step), ["plan", "plan"]);
});

// ---- malformed config -------------------------------------------------------------------

test("malformed preplan config never throws", () => {
  const cases = {
    "unknown predicates": { preplan: { gates: { research: { skipIf: ["nope"], when: ["nope"] }, frame: { when: ["nope"] } } } },
    "unknown level": { preplan: { gates: { research: { minRigor: "bogus" }, "domain-brief": { minRigor: "bogus" }, frame: { minRigor: "bogus" } } } },
    "no minRigor": { preplan: { gates: { research: { minRigor: null }, "domain-brief": { minRigor: 3 }, frame: { minRigor: [] } } } },
    "gates is not an object": { preplan: { gates: "research" } },
    "preplan is null": { preplan: null },
    "order is not a list": { preplan: { order: "research" } },
    "gate is not an object": { preplan: { gates: { research: 5, "domain-brief": null, frame: [] } } },
    "order names a step without a policy entry": { preplan: { order: ["ghost"], gates: { ghost: { minRigor: "thorough", template: "frame" } } } },
    "skipIf is not a list": { preplan: { gates: { research: { skipIf: "researchExists", when: 7 }, "domain-brief": { when: "x" }, frame: { when: [], skipIf: {} } } } },
    "predicate config is wrong": { preplan: { predicates: { aggregateGap: "x", repoMapExists: 1, framingDoubt: { goalWords: "because" }, dependencyLeak: null } } },
    "artifacts is wrong": { preplan: { artifacts: ["research.md"] } },
    "unsafe artifact name": { preplan: { artifacts: { research: "../research.md", frame: "" } } },
  };
  for (const [name, policy] of Object.entries(cases)) {
    const project = makeProject({ policy });
    putRoot(project, FILE_A, section(`${REF_HEADER}\n${refRow("R-1", "World", "A world has one slug", "**declared**")}`));
    const res = thorough(project, "Logins fail because the world slug is unchecked");
    assert.equal(res.status, 0, `${name}: ${res.stdout}${res.stderr}`);
    assert.equal(res.json.action, "run", name);
    assert.ok(["research", "domain-brief", "frame", "plan"].includes(res.json.step), `${name}: ${res.json.step}`);
    assert.ok(!/Router error/.test(res.stdout), name);
  }
  // Closed or broken gates go to the plan without a skip row.
  for (const name of ["unknown level", "no minRigor", "gates is not an object", "preplan is null", "order is not a list", "gate is not an object", "order names a step without a policy entry"]) {
    const project = makeProject({ policy: cases[name] });
    const res = thorough(project, "fix typo");
    assert.equal(res.json.step, "plan", name);
    assert.deepEqual(skipsOf(project), [], name);
  }
  // Malformed variants still give the gate's own template.
  const variants = makeProject({ policy: { preplan: { gates: { research: { variants: [5, null, { when: 3, template: "x" }, { when: "nope", template: "research-with-map" }] } } } } });
  const res = thorough(variants, "fix typo");
  assert.equal(res.json.step, "research");
  assert.equal(lastRan(variants).template, "research");
});
