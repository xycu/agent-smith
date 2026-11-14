// Tests for tool-restricted step agents: the agents block of the policy, the `agent` field of the run output, the
// log entry and status, the agent definition file, the provenance link and the SKILL.md dispatch line.
// Black-box through the CLI in scratch projects. Test names start with the plan row number. A test turns the scorer
// and the restriction on with `policy: { score: { minRigor: "standard" }, agents: { restricted: true } }`.
// A test that changes agents/score.md edits a scratch copy of the plugin tree and spawns that copy's route.mjs.
// The repository files are never edited.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { removeTree } from "../scripts/remove-tree.mjs";
import {
  cleanEnv, cleanupAll, makeProject, planText, writePlan, writeReview, run, init, next, writeResult, readMetaFile, readLogEntries,
  writeLog, writeMetaFile, entry, gitAvailable, gitEnv, gitInit, commitFiles,
} from "./helpers.mjs";

const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO = path.resolve(SKILL_DIR, "../..");
const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const readRepo = (rel) => fs.readFileSync(path.join(REPO, rel), "utf8");
const DEFAULT = readJson(path.join(SKILL_DIR, "policy.json"));
const PLUGIN = readJson(path.join(REPO, ".claude-plugin/plugin.json"));
const MARKETPLACE = readJson(path.join(REPO, ".claude-plugin/marketplace.json"));
const HEX16 = /^[0-9a-f]{16}$/;
const SCORE_AGENT = "agent-smith:score";
const GOAL = "Add a retry counter to the status output so the report shows how often each step ran again";
const SCORER = { score: { minRigor: "standard" } };
const RESTRICTED = { ...SCORER, agents: { restricted: true } };
const RUN_KEYS = ["action", "change", "root", "chain", "n", "step", "host", "provider", "model", "effort", "reason", "prompt", "resultFile"];
const RUN_KEYS_AGENT = ["action", "change", "root", "chain", "n", "step", "agent", "host", "provider", "model", "effort", "reason", "prompt", "resultFile"];
const FACTORS = [...DEFAULT.score.factors.cognitive, ...DEFAULT.score.factors.execution];

const copies = [];
after(() => {
  cleanupAll();
  for (const dir of copies.splice(0)) removeTree(dir);
});

const has = (obj, key) => Object.hasOwn(obj, key);

// Sets a file's mtime 5 s ahead, so the router sees it as written after the step started.
function later(file) {
  const t = new Date(Date.now() + 5000);
  fs.utimesSync(file, t, t);
}

// A valid complexity.json, written after the step started.
function putScore(project) {
  const factors = Object.fromEntries(FACTORS.map((name) => [name, { score: 1, evidence: `goal phrase for ${name}` }]));
  const file = path.join(project.changeDir, "complexity.json");
  fs.writeFileSync(file, JSON.stringify({ schemaVersion: 1, factors, unknowns: [], confidence: "medium" }));
  later(file);
}

// Does the work of one step on disk, writes a done result and asks the router for the next step.
function respond(project, step) {
  const review = (name, verdict) => {
    writeReview(project, name, { verdict });
    later(path.join(project.changeDir, `reviews/${name}.md`));
  };
  if (step === "score") putScore(project);
  else if (step === "plan") { writePlan(project, planText()); later(project.planFile); }
  else if (step === "plan-review") review("plan-review", "SOUND");
  else if (step === "implement") writePlan(project, planText({ done: 1 }));
  else if (step === "impl-review") review("impl-review", "APPROVED");
  else throw new Error(`unexpected step ${step}`);
  writeResult(project, { status: "done", note: step });
  return next(project);
}

// A whole run at standard, from init to its end. Returns the project and every router answer in order.
function walk(policy) {
  const project = makeProject({ policy });
  const answers = [init(project, GOAL, ["--rigor", "standard"])];
  for (let i = 0; i < 12 && answers.at(-1).json?.action === "run"; i++) answers.push(respond(project, answers.at(-1).json.step));
  for (const res of answers) assert.equal(res.status, 0, res.stdout + res.stderr);
  assert.equal(answers.at(-1).json.action, "done", answers.at(-1).stdout);
  for (const res of answers) {
    if (res.json.action !== "run") continue;
    assert.equal(res.json.root, project.root);
    res.json.root = "<run-root>";
    res.stdout = res.stdout.replaceAll(project.root, "<run-root>");
  }
  return { project, answers, runs: answers.filter((res) => res.json.action === "run") };
}

const statusOf = (project) => run(project, ["status", project.id]).json;

// ---- 2.1 default off ---------------------------------------------------------------------

test("2.1 policy.json ships the agents block off, mapping only the score step", () => {
  assert.deepEqual(DEFAULT.agents, { restricted: false, steps: { score: SCORE_AGENT } });
});

test("2.1 with the default policy no run output, no log entry and no status row has an agent field", () => {
  const { project, answers, runs } = walk(SCORER);
  assert.deepEqual(runs.map((res) => res.json.step), ["score", "plan", "plan-review", "implement", "impl-review"]);
  for (const res of runs) assert.deepEqual(Object.keys(res.json), RUN_KEYS, res.json.step);
  for (const res of answers) assert.equal(res.stdout.includes("\"agent\""), false, res.json.step ?? res.json.action);
  const log = readLogEntries(project);
  assert.equal(log.filter((e) => !e.skipped).length, 5);
  for (const e of log) assert.equal(has(e, "agent"), false, e.step);
  for (const row of statusOf(project).steps) assert.equal(has(row, "agent"), false, row.step);
});

test("2.1 the default agents block prints byte for byte what a policy without the block prints", () => {
  const shipped = walk(SCORER);
  const without = walk({ ...SCORER, agents: null });
  const off = walk({ ...SCORER, agents: { restricted: false } });
  assert.deepEqual(without.answers.map((res) => res.stdout), shipped.answers.map((res) => res.stdout));
  assert.deepEqual(off.answers.map((res) => res.stdout), shipped.answers.map((res) => res.stdout));
  const rows = (w) => statusOf(w.project).steps;
  assert.deepEqual(rows(without), rows(shipped));
});

// ---- 2.2 restricted ------------------------------------------------------------------------

test("2.2 with agents.restricted true the score output and log entry carry agent-smith:score, no other step does, and status shows it", () => {
  const shipped = walk(SCORER);
  const { project, answers, runs } = walk(RESTRICTED);
  assert.deepEqual(runs.map((res) => res.json.step), ["score", "plan", "plan-review", "implement", "impl-review"]);

  const [score, ...rest] = runs;
  assert.deepEqual(Object.keys(score.json), RUN_KEYS_AGENT);
  assert.equal(score.json.agent, SCORE_AGENT);
  // The score output is the default output plus the agent field; nothing else moves.
  const { agent, ...plain } = score.json;
  assert.equal(agent, SCORE_AGENT);
  assert.deepEqual(plain, shipped.runs[0].json);
  for (const res of rest) assert.deepEqual(Object.keys(res.json), RUN_KEYS, res.json.step);
  // Every other answer, the done output included, is byte for byte the default one.
  assert.deepEqual(answers.slice(1).map((res) => res.stdout), shipped.answers.slice(1).map((res) => res.stdout));

  const ran = readLogEntries(project).filter((e) => !e.skipped);
  assert.deepEqual(ran.map((e) => [e.step, e.agent]), [
    ["score", SCORE_AGENT], ["plan", undefined], ["plan-review", undefined], ["implement", undefined], ["impl-review", undefined],
  ]);
  assert.equal(ran.filter((e) => has(e, "agent")).length, 1);

  const rows = statusOf(project).steps;
  assert.equal(rows[0].step, "score");
  assert.equal(rows[0].agent, SCORE_AGENT);
  for (const row of rows.slice(1)) assert.equal(has(row, "agent"), false, row.step);
  const { agent: shown, ...rowPlain } = rows[0];
  assert.equal(shown, SCORE_AGENT);
  assert.deepEqual([rowPlain, ...rows.slice(1)], statusOf(shipped.project).steps);
});

test("2.2 a failed score attempt is retried with the agent, and after 3 the step skips and the run goes on without a halt", () => {
  const project = makeProject({ policy: RESTRICTED });
  const first = init(project, GOAL, ["--rigor", "standard"]);
  assert.equal(first.json.agent, SCORE_AGENT);
  // What the orchestrator writes when the Agent call fails, for example an agent type that does not resolve.
  const failed = () => { writeResult(project, { status: "unknown", note: "no RESULT line" }); return next(project); };
  const second = failed();
  assert.equal(second.json.step, "score");
  assert.equal(second.json.agent, SCORE_AGENT);
  assert.equal(second.json.n, 2);
  const third = failed();
  assert.equal(third.json.agent, SCORE_AGENT);
  const after3 = failed();
  assert.equal(after3.status, 0, after3.stdout);
  assert.equal(after3.json.action, "run");
  assert.equal(after3.json.step, "plan");
  assert.equal(has(after3.json, "agent"), false);
  const log = readLogEntries(project);
  assert.deepEqual(log.filter((e) => !e.skipped).map((e) => [e.step, e.agent, e.ok ?? null]), [
    ["score", SCORE_AGENT, false], ["score", SCORE_AGENT, false], ["score", SCORE_AGENT, false], ["plan", undefined, null],
  ]);
  assert.equal(log.filter((e) => e.skipped && e.step === "score").length, 1);
  assert.equal(readMetaFile(project).rigor.level, "standard", "a failed score attempt raises no rigor");
});

test("2.2 a step the map names gets its own agent, and a step with no usable value gets none", () => {
  const project = makeProject({ policy: { ...SCORER, agents: { restricted: true, steps: { score: "", plan: "agent-smith:plan" } } } });
  const score = init(project, GOAL, ["--rigor", "standard"]);
  assert.equal(score.json.step, "score");
  assert.equal(has(score.json, "agent"), false);
  const plan = respond(project, "score");
  assert.equal(plan.json.step, "plan");
  assert.equal(plan.json.agent, "agent-smith:plan");
  assert.deepEqual(readLogEntries(project).map((e) => [e.step, e.agent]), [["score", undefined], ["plan", "agent-smith:plan"]]);
});

// A finished run in a git repository with --archive, as in archive.test.mjs.
function archiveProject(policy) {
  const project = makeProject({ policy, plan: planText({ done: 1 }) });
  fs.writeFileSync(path.join(project.changeDir, "change.md"), "---\nchange_id: demo\nstatus: implemented\ncreated: 2026-10-30\n---\n");
  writeReview(project, "plan-review", { verdict: "SOUND" });
  writeReview(project, "impl-review", { verdict: "APPROVED" });
  writeLog(project, [entry(1, "plan"), entry(2, "plan-review"), entry(3, "implement"), entry(4, "impl-review")]);
  writeMetaFile(project, { id: "demo", goal: "fix typo", archive: true });
  gitInit(project);
  commitFiles(project, ["README.md"]);
  return run(project, ["next", project.id], { env: gitEnv(project) });
}

test("2.2 the archive action carries no agent, also when the map names the archive step", { skip: !gitAvailable() }, () => {
  const plain = archiveProject({});
  const restricted = archiveProject({ agents: { restricted: true, steps: { archive: "agent-smith:archive" } } });
  for (const res of [plain, restricted]) {
    assert.equal(res.status, 0, res.stdout + res.stderr);
    assert.equal(res.json.action, "archive");
    assert.equal(has(res.json, "agent"), false);
  }
  assert.deepEqual(Object.keys(restricted.json), Object.keys(plain.json));
  assert.equal(restricted.json.prompt, plain.json.prompt);
});

// ---- 2.3 malformed blocks ------------------------------------------------------------------

test("2.3 a malformed agents block reads as off and never halts", () => {
  const cases = {
    "restricted is the string true": { restricted: "true" },
    "restricted is 1": { restricted: 1 },
    "restricted is an array": { restricted: [true] },
    "restricted is null": { restricted: null },
    "steps is an array": { restricted: true, steps: [SCORE_AGENT] },
    "steps is a string": { restricted: true, steps: SCORE_AGENT },
    "steps is null": { restricted: true, steps: null },
    "the value is empty": { restricted: true, steps: { score: "" } },
    "the value is blank": { restricted: true, steps: { score: "   " } },
    "the value is a number": { restricted: true, steps: { score: 42 } },
    "the value is null": { restricted: true, steps: { score: null } },
    "the value is an array": { restricted: true, steps: { score: [SCORE_AGENT] } },
    "the value is an object": { restricted: true, steps: { score: { name: SCORE_AGENT } } },
    "the block is a string": "on",
    "the block is true": true,
    "the block is null": null,
    "the block is an array": [SCORE_AGENT],
  };
  for (const [label, agents] of Object.entries(cases)) {
    const project = makeProject({ policy: { ...SCORER, agents } });
    const res = init(project, GOAL, ["--rigor", "standard"]);
    assert.equal(res.status, 0, `${label}: ${res.stdout}`);
    assert.equal(res.json.action, "run", label);
    assert.equal(res.json.step, "score", label);
    assert.deepEqual(Object.keys(res.json), RUN_KEYS, label);
    const plan = respond(project, "score");
    assert.equal(plan.status, 0, `${label}: ${plan.stdout}`);
    assert.equal(plan.json.step, "plan", label);
    assert.equal(has(plan.json, "agent"), false, label);
    for (const e of readLogEntries(project)) assert.equal(has(e, "agent"), false, label);
    const status = run(project, ["status", project.id]);
    assert.equal(status.status, 0, label);
    for (const row of status.json.steps) assert.equal(has(row, "agent"), false, label);
  }
});

// ---- 2.4 the definition file -----------------------------------------------------------------

// The keys of the first --- block, as plain `key: value` lines. Any other line in the block fails the test.
function frontmatter(text) {
  const block = text.match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(block, "the file starts with a --- block");
  const fields = {};
  for (const line of block[1].split("\n")) {
    const m = line.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/);
    assert.ok(m, `not a plain key: value line: ${line}`);
    assert.equal(has(fields, m[1]), false, `key ${m[1]} twice`);
    fields[m[1]] = m[2].trim();
  }
  return { fields, body: text.slice(block[0].length).trim() };
}

test("2.4 agents/score.md has name, description and tools exactly Read, Grep, Glob, Write, and no model or other banned key", () => {
  const { fields, body } = frontmatter(readRepo("agents/score.md"));
  assert.deepEqual(Object.keys(fields).sort(), ["description", "name", "tools"]);
  for (const banned of ["model", "effort", "hooks", "mcpServers", "permissionMode", "disallowedTools"]) {
    assert.equal(has(fields, banned), false, banned);
  }
  assert.equal(fields.name, "score");
  assert.equal(fields.tools, "Read, Grep, Glob, Write");
  assert.match(fields.description, /^[^.]+\.$/, "one sentence");
  // The body is a short role line that defers to the prompt the router passes and names no model or effort.
  assert.ok(body.length > 0 && body.split("\n").length <= 3, body);
  assert.match(body, /prompt/);
  const models = [...new Set(DEFAULT.ladder.map((rung) => rung.model))];
  for (const word of [...models, "effort"]) assert.doesNotMatch(readRepo("agents/score.md"), new RegExp(`\\b${word}\\b`, "i"), word);
});

test("2.4 every value of agents.steps is <plugin name>:<file> for an existing agents/<file>.md whose name is <file>", () => {
  // The marketplace serves the repository root as the plugin, so agents/ at the root is the plugin's agent folder.
  assert.equal(MARKETPLACE.plugins[0].name, PLUGIN.name);
  assert.equal(MARKETPLACE.plugins[0].source, "./");
  const entries = Object.entries(DEFAULT.agents.steps);
  assert.ok(entries.length > 0);
  for (const [step, value] of entries) {
    assert.ok(has(DEFAULT.steps, step), `agents.steps.${step} names a step of the policy`);
    const m = typeof value === "string" ? value.match(/^([^:]+):([A-Za-z0-9._-]+)$/) : null;
    assert.ok(m, `agents.steps.${step} is <plugin>:<file>: ${value}`);
    assert.equal(m[1], PLUGIN.name);
    const file = path.join(REPO, "agents", `${m[2]}.md`);
    assert.ok(fs.existsSync(file), `agents/${m[2]}.md exists`);
    assert.equal(frontmatter(fs.readFileSync(file, "utf8")).fields.name, m[2]);
  }
});

// ---- 2.5 provenance --------------------------------------------------------------------------

// skills/10x-pipeline and skills/openspec-pipeline (without their tests), .claude-plugin and agents, with the same relative layout.
function pluginCopy() {
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "as-plugin-"));
  copies.push(root);
  const skill = path.join(root, "skills/10x-pipeline");
  const tests = path.join(SKILL_DIR, "test");
  fs.cpSync(SKILL_DIR, skill, { recursive: true, filter: (src) => src !== tests });
  const osSkill = path.resolve(SKILL_DIR, "../openspec-pipeline");
  const osTests = path.join(osSkill, "test");
  fs.cpSync(osSkill, path.join(root, "skills/openspec-pipeline"), { recursive: true, filter: (src) => src !== osTests });
  fs.cpSync(path.join(REPO, ".claude-plugin"), path.join(root, ".claude-plugin"), { recursive: true });
  fs.cpSync(path.join(REPO, "agents"), path.join(root, "agents"), { recursive: true });
  return { root, route: path.join(skill, "scripts/route.mjs") };
}

// The record a fresh init writes, through the real router or through a copy's route.mjs.
function record({ policy = null, copy = null } = {}) {
  const project = makeProject({ policy });
  const args = ["init", project.id, "--goal", "fix typo"];
  const res = copy
    ? spawnSync(process.execPath, [copy.route, ...args], { cwd: project.root, encoding: "utf8", env: cleanEnv() })
    : spawnSync(process.execPath, [path.join(SKILL_DIR, "scripts/route.mjs"), ...args], { cwd: project.root, encoding: "utf8", env: cleanEnv() });
  assert.equal(res.status, 0, res.stdout + res.stderr);
  return readMetaFile(project).provenance;
}

const differing = (a, b) => Object.keys({ ...a, ...b }).filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k])).sort();

test("2.5 editing agents/score.md changes only the agentFiles hash", () => {
  const real = record();
  assert.match(real.sections.agentFiles, HEX16, "the repository has an agents folder now");
  const copy = pluginCopy();
  const before = record({ copy });
  assert.deepEqual(before, real, "an unedited copy records the same");
  fs.appendFileSync(path.join(copy.root, "agents/score.md"), "Read the rules twice.\n");
  const edited = record({ copy });
  assert.match(edited.sections.agentFiles, HEX16);
  assert.deepEqual(differing(edited.sections, before.sections), ["agentFiles"]);
  assert.deepEqual(edited.flags, before.flags);
  assert.equal(edited.plugin, before.plugin);
});

test("2.5 flipping agents.restricted changes the agents section and the agents.restricted flag only", () => {
  const off = record();
  const on = record({ policy: { agents: { restricted: true } } });
  assert.equal(off.flags["agents.restricted"], false);
  assert.equal(on.flags["agents.restricted"], true);
  assert.deepEqual(differing(on.sections, off.sections), ["agents"]);
  assert.deepEqual(differing(on.flags, off.flags), ["agents.restricted"]);
  assert.match(on.sections.agents, HEX16);
  assert.match(off.sections.agents, HEX16);
});

// ---- 2.6 SKILL.md --------------------------------------------------------------------------

test("2.6 SKILL.md dispatches with the router's agent when present, else general-purpose, and names no model alias", () => {
  const skill = readRepo("skills/10x-pipeline/SKILL.md");
  const loop = skill.slice(skill.indexOf("## Loop"), skill.indexOf("## PR comment"));
  const lines = loop.split("\n").filter((l) => l.includes("Call the Agent tool") && l.includes("subagent_type"));
  assert.equal(lines.length, 1, "one dispatch line in the run action");
  const [line] = lines;
  assert.match(line, /^ {2}2\. /, "loop step 2 of the run action");
  const agentAt = line.indexOf("the router's `agent` when the output has one");
  const fallbackAt = line.indexOf("else `general-purpose`");
  assert.ok(agentAt >= 0 && fallbackAt > agentAt, line);
  assert.match(line, /do not call it again with another type/);
  assert.equal(skill.includes("subagent_type: general-purpose"), false, "no hard-coded type is left");
  // The archive action reuses the run parameters, so it dispatches the same way.
  assert.match(skill, /Call the Agent tool with the same parameters as for `run`/);
  const models = [...new Set(DEFAULT.ladder.map((rung) => rung.model))];
  assert.ok(models.length >= 3);
  for (const model of models) assert.doesNotMatch(skill, new RegExp(`\\b${model}\\b`, "i"), model);
});
