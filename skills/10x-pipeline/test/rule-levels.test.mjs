// Rule levels (ADR-023): the order of the parts after a step template, the always-true files that no project override
// reaches, the scratch-tree reader of ruleTail, the halts on a missing or unreadable rule file, the archive prompts of
// both chains, the placeholder limits of the rule files, the ruleFiles provenance section and the precedence rules of
// rules/top.md. Test names start with the case letter of plan Phase 2. No repository file is edited: a test that changes
// a rule file works on a scratch copy of the plugin tree.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  cleanupAll, makeProject, planText, writeReview, writeLog, writeMetaFile, readMetaFile, entry, init, run,
  gitAvailable, gitEnv, gitInit, commitFiles, ruleTail as expectedTail,
} from "./helpers.mjs";
import { makeOpenspecProject, initOpenspec } from "../../openspec-pipeline/test/openspec-helpers.mjs";
import { ruleTail, checkPrompts } from "../scripts/flow.mjs";
import { pluginPolicy } from "../scripts/state.mjs";
import { removeTree } from "../scripts/remove-tree.mjs";

const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OS_DIR = path.resolve(SKILL_DIR, "../openspec-pipeline");
const REPO = path.resolve(SKILL_DIR, "../..");
const POLICY = pluginPolicy();
const SUFFIX = POLICY.prompts.suffix;
const TOP = fs.readFileSync(path.join(SKILL_DIR, "rules/top.md"), "utf8").trim();
const TOP_LINES = TOP.split("\n");
const RESULT_LINE = TOP_LINES.at(-1);
const RESEARCH = fs.readFileSync(path.join(SKILL_DIR, "rules/steps/research.md"), "utf8").trim();
const OS_CHAIN = fs.readFileSync(path.join(OS_DIR, "rules/chain.md"), "utf8").trim();
const HEX16 = /^[0-9a-f]{16}$/;
const noGit = !gitAvailable() && "git is not available";

const scratch = [];
after(() => {
  cleanupAll();
  for (const dir of scratch.splice(0)) removeTree(dir);
});

const tmp = (prefix) => {
  const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), prefix));
  scratch.push(dir);
  return dir;
};

// Asserts that each part occurs in `text` once and in the given order.
function inOrder(text, parts, label) {
  let at = -1;
  for (const part of parts) {
    const next = text.indexOf(part);
    assert.ok(next >= 0, `${label}: missing ${part.slice(0, 60)}`);
    assert.equal(text.indexOf(part, next + 1), -1, `${label}: ${part.slice(0, 60)} occurs twice`);
    assert.ok(next > at, `${label}: ${part.slice(0, 60)} is out of order`);
    at = next;
  }
}

// A scratch rule tree in the plugin layout: <root>/skills/10x-pipeline and <root>/skills/openspec-pipeline.
function ruleTree(files) {
  const root = tmp("as-rules-");
  const dirs = { "10x": path.join(root, "skills/10x-pipeline"), openspec: path.join(root, "skills/openspec-pipeline") };
  for (const [rel, text] of Object.entries(files)) {
    const file = path.join(root, "skills", rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    if (text === null) fs.mkdirSync(file);
    else fs.writeFileSync(file, text);
  }
  fs.mkdirSync(dirs["10x"], { recursive: true });
  fs.mkdirSync(dirs.openspec, { recursive: true });
  return dirs;
}

// A scratch copy of the plugin tree without the test folders, with its own route.mjs.
function pluginCopy() {
  const root = tmp("as-plugin-");
  for (const [dir, name] of [[SKILL_DIR, "10x-pipeline"], [OS_DIR, "openspec-pipeline"]]) {
    const tests = path.join(dir, "test");
    fs.cpSync(dir, path.join(root, "skills", name), { recursive: true, filter: (src) => src !== tests });
  }
  fs.cpSync(path.join(REPO, ".claude-plugin"), path.join(root, ".claude-plugin"), { recursive: true });
  return { root, route: path.join(root, "skills/10x-pipeline/scripts/route.mjs") };
}

function runCopy(copy, project, args) {
  const res = spawnSync(process.execPath, [copy.route, ...args], { cwd: project.root, encoding: "utf8", env: process.env });
  let json = null;
  try { json = JSON.parse(res.stdout); } catch { /* leave null */ }
  return { status: res.status, json, stdout: res.stdout };
}

// ---- (a) the order of a run prompt ---------------------------------------------

test("(a) a 10x run prompt: template, chain defaults, suffix, step file, chain file, top.md, RESULT line last", () => {
  const project = makeProject({ policy: { prompts: { "chain-10x": "Chain default of 10x for {id}." } } });
  const res = init(project, "fix typo", ["--rigor", "thorough"]);
  assert.equal(res.json.step, "research", res.stdout);
  const prompt = res.json.prompt;
  inOrder(prompt, ["Run /10x-research", "Chain default of 10x for demo.", SUFFIX, RESEARCH.replaceAll("{id}", "demo"), TOP], "10x research");
  assert.ok(prompt.endsWith("\n\n" + expectedTail(`Chain default of 10x for demo.\n\n${SUFFIX}`, { step: "research" })));
  assert.equal(prompt.split("\n").at(-1), RESULT_LINE);
});

test("(a) an OpenSpec run prompt: template, chain defaults, suffix, chain file, top.md, RESULT line last", () => {
  const project = makeOpenspecProject({ policy: { prompts: { "chain-openspec": "Chain default of OpenSpec for {id}." } } });
  const res = initOpenspec(project, "Add a greeting script");
  assert.equal(res.json.step, "os-propose", res.stdout);
  const prompt = res.json.prompt;
  inOrder(prompt, ["Run /openspec-propose", "Chain default of OpenSpec for demo.", SUFFIX, OS_CHAIN.replaceAll("{id}", "demo"), TOP], "os-propose");
  assert.equal(prompt.includes("Chain default of 10x"), false);
  assert.equal(prompt.split("\n").at(-1), RESULT_LINE);
});

// ---- (b) a suffix override replaces only the defaults --------------------------

test("(b) a prompts.suffix override replaces the defaults and keeps every line of top.md", () => {
  const project = makeProject({ policy: { prompts: { suffix: "My own defaults." } } });
  const prompt = init(project, "fix typo").json.prompt;
  assert.ok(prompt.endsWith("\n\nMy own defaults.\n\n" + TOP), prompt.slice(-400));
  for (const line of TOP_LINES) assert.ok(prompt.includes(line), line);
  for (const line of SUFFIX.split("\n").filter((l) => l.includes("**GIVEN**"))) assert.equal(prompt.includes(line), false, line);
});

// ---- (c) ruleTail on a scratch tree --------------------------------------------

test("(c) ruleTail reads the step file and the chain file of both chains and skips a missing file or a bad step name", () => {
  const dirs = ruleTree({
    "10x-pipeline/rules/top.md": "TOP\n",
    "10x-pipeline/rules/chain.md": "C10 {id}\n",
    "10x-pipeline/rules/steps/plan.md": "S10 {id} {goal}\n",
    "10x-pipeline/rules/x.md": "BAD\n",
    "openspec-pipeline/rules/chain.md": "COS {id}\n",
    "openspec-pipeline/rules/steps/os-apply.md": "SOS {id}\n",
  });
  const policy = { prompts: { suffix: "SUF", "chain-openspec": "DOS {id}" } };
  const vars = { id: "d", goal: "g" };
  assert.equal(ruleTail(policy, { chain: "10x", step: "plan", vars, dirs }), "SUF\n\nS10 d g\n\nC10 d\n\nTOP");
  assert.equal(ruleTail(policy, { chain: "openspec", step: "os-apply", vars, dirs }), "DOS d\n\nSUF\n\nSOS d\n\nCOS d\n\nTOP");
  assert.equal(ruleTail(policy, { chain: "10x", step: "implement", vars, dirs }), "SUF\n\nC10 d\n\nTOP", "a missing step file reads as none");
  assert.equal(ruleTail(policy, { chain: "10x", step: "../x", vars, dirs }), "SUF\n\nC10 d\n\nTOP", "a step name outside the pattern is not read");
  assert.equal(ruleTail(policy, { chain: "openspec", step: "os-propose", vars, dirs: ruleTree({ "10x-pipeline/rules/top.md": "TOP" }) }),
    "DOS d\n\nSUF\n\nTOP", "no chain file and no step file");
});

// ---- (d) a missing or unreadable rule file halts --------------------------------

test("(d) a missing top.md throws, and checkPrompts turns it into the halt text", () => {
  const dirs = ruleTree({ "10x-pipeline/rules/chain.md": "C10\n" });
  const policy = { prompts: { suffix: "SUF" }, steps: { plan: {} } };
  assert.throws(() => ruleTail(policy, { step: "plan", dirs }), { message: "skills/10x-pipeline/rules/top.md cannot be read" });
  assert.throws(() => checkPrompts(policy, dirs),
    { message: "skills/10x-pipeline/rules/top.md cannot be read. The result file and the log are untouched: restore the plugin file and run next again." });
});

test("(d) an unreadable chain.md (a folder in its place) throws in ruleTail and in checkPrompts", () => {
  const dirs = ruleTree({ "10x-pipeline/rules/top.md": "TOP\n", "openspec-pipeline/rules/chain.md": null });
  const policy = { prompts: { suffix: "SUF" }, steps: { "os-apply": {} } };
  assert.throws(() => ruleTail(policy, { chain: "openspec", step: "os-apply", dirs }), { message: "skills/openspec-pipeline/rules/chain.md cannot be read" });
  assert.throws(() => checkPrompts(policy, dirs), /^Error: skills\/openspec-pipeline\/rules\/chain\.md cannot be read\. /);
  assert.equal(ruleTail(policy, { chain: "10x", step: "plan", dirs }), "SUF\n\nTOP", "the 10x chain does not read the OpenSpec file");
});

test("(d) init in a plugin copy without rules/top.md halts and writes nothing", () => {
  const copy = pluginCopy();
  fs.unlinkSync(path.join(copy.root, "skills/10x-pipeline/rules/top.md"));
  const project = makeProject();
  const res = runCopy(copy, project, ["init", project.id, "--goal", "fix typo"]);
  assert.equal(res.json?.action, "halt", res.stdout);
  assert.match(res.json.reason, /skills\/10x-pipeline\/rules\/top\.md cannot be read\. Restore the plugin file\. Nothing was written\./);
  assert.equal(fs.existsSync(path.join(project.agentDir, "meta.json")), false);
  assert.equal(fs.existsSync(path.join(project.agentDir, "run.jsonl")), false);
});

// ---- (e) the archive prompts of both chains -------------------------------------

test("(e) the archive prompt of the 10x chain ends with top.md", { skip: noGit }, () => {
  const project = makeProject({ plan: planText({ done: 1 }) });
  fs.writeFileSync(path.join(project.changeDir, "change.md"), "---\nchange_id: demo\nstatus: implemented\ncreated: 2026-10-30\n---\n");
  writeReview(project, "plan-review", { verdict: "SOUND" });
  writeReview(project, "impl-review", { verdict: "APPROVED" });
  writeLog(project, [entry(1, "plan"), entry(2, "plan-review"), entry(3, "implement"), entry(4, "impl-review")]);
  writeMetaFile(project, { id: "demo", goal: "fix typo", archive: true });
  gitInit(project);
  commitFiles(project, ["README.md"]);
  const res = run(project, ["next", project.id], { env: gitEnv(project) });
  assert.equal(res.json.action, "archive", res.stdout);
  assert.ok(res.json.prompt.endsWith("\n\n" + SUFFIX + "\n\n" + TOP), res.json.prompt.slice(-300));
});

test("(e) the os-archive prompt of the OpenSpec chain ends with the chain file and top.md", { skip: noGit }, () => {
  const project = makeOpenspecProject({ proposal: true, specs: 1, tasks: { done: 2, open: 0 }, verify: "Verdict: PASS\nCritical: 0\nWarnings: 0\n" });
  writeLog(project, [entry(1, "os-apply", { template: "os-apply" }), entry(2, "os-verify", { review: { verdict: "PASS", critical: 0, warnings: 0 } })]);
  writeMetaFile(project, { id: "demo", goal: "Add a thing", chain: "openspec", archive: true });
  gitInit(project);
  commitFiles(project, ["README.md"]);
  const res = run(project, ["next", project.id], { env: gitEnv(project) });
  assert.equal(res.json.action, "archive", res.stdout);
  assert.ok(res.json.prompt.endsWith("\n\n" + SUFFIX + "\n\n" + OS_CHAIN.replaceAll("{id}", "demo") + "\n\n" + TOP), res.json.prompt.slice(-600));
});

// ---- (f) placeholder limits -----------------------------------------------------

test("(f) the rule files use only {id}, top.md uses none, and a chain default with another placeholder halts", () => {
  // The archive site renders the step and chain files with {id} only, so any other placeholder would render empty there.
  const files = [];
  for (const dir of [SKILL_DIR, OS_DIR]) {
    for (const rel of fs.readdirSync(path.join(dir, "rules"), { recursive: true })) {
      if (rel.endsWith(".md") && path.basename(rel) !== "README.md") files.push(path.join(dir, "rules", rel));
    }
  }
  assert.ok(files.length >= 3);
  for (const file of files) {
    const names = [...fs.readFileSync(file, "utf8").matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
    if (file.endsWith(path.join("rules", "top.md"))) assert.deepEqual(names, [], file);
    else assert.ok(names.every((n) => n === "id"), `${file}: ${names.join(",")}`);
  }
  for (const key of ["chain-10x", "chain-openspec"]) {
    const res = init(makeProject({ policy: { prompts: { [key]: "Goal {goal}" } } }), "fix typo");
    assert.equal(res.json.action, "halt", res.stdout);
    assert.match(res.json.reason, new RegExp(`policy\\.prompts\\.${key} uses \\{goal\\}, which the router never fills\\. Known placeholders: id\\.`));
  }
});

// ---- (g) ruleFiles provenance ---------------------------------------------------

test("(g) the ruleFiles provenance section is a hash and changes when a rule file changes", () => {
  const copy = pluginCopy();
  const record = () => {
    const project = makeProject();
    const res = runCopy(copy, project, ["init", project.id, "--goal", "fix typo"]);
    assert.equal(res.json?.action, "run", res.stdout);
    return readMetaFile(project).provenance.sections;
  };
  const before = record();
  assert.match(before.ruleFiles, HEX16);
  fs.appendFileSync(path.join(copy.root, "skills/openspec-pipeline/rules/chain.md"), "Changed.\n");
  const after = record();
  assert.notEqual(after.ruleFiles, before.ruleFiles);
  assert.deepEqual({ ...after, ruleFiles: null }, { ...before, ruleFiles: null }, "only ruleFiles moves");
  fs.writeFileSync(path.join(copy.root, "skills/10x-pipeline/rules/README.md"), "Index only.\n");
  assert.equal(record().ruleFiles, after.ruleFiles, "README.md is not a rule file");
});

// ---- (h) the precedence rules of top.md -----------------------------------------

test("(h) top.md opens with its always-true heading and holds both precedence rules, the higher-level-wins clause included", () => {
  assert.match(TOP_LINES[0], /^Always-true rules for every step of agent-smith\./);
  const rules = TOP_LINES.filter((l) => l.includes("**GIVEN**"));
  const always = rules.filter((l) => l.includes("at least one of them stands under an always-true heading"));
  assert.equal(always.length, 1);
  assert.match(always[0], /\*\*MUST\*\* follow the always-true rule/);
  assert.match(always[0], /the rule for every step wins over the rule of the chain, which wins over the rule of the step/);
  const earlier = rules.filter((l) => l.includes("neither stands under an always-true heading"));
  assert.equal(earlier.length, 1);
  assert.match(earlier[0], /\*\*MUST\*\* follow the rule written earlier in this prompt/);
  assert.ok(TOP_LINES.indexOf(always[0]) < TOP_LINES.findIndex((l) => l.startsWith("RESULT:")));
  // The level files below top.md open with their own always-true heading.
  assert.match(RESEARCH.split("\n")[0], /^Always-true rules of the step `research`:$/);
  assert.match(OS_CHAIN.split("\n")[0], /^Always-true rules of the OpenSpec chain:$/);
  // The overridable suffix opens with the default heading.
  assert.match(SUFFIX.split("\n")[0], /^Default rules for every step\. A rule earlier in this prompt may change them\.$/);
});
