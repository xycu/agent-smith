// The OpenSpec chain switch (ADR-013): --chain, run state under openspec/changes/<id>/agent-smith/, the D3 and D8
// halts, chain detection without the flag and the D4 routing order.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  cleanupAll, makeProject, run, init, writeResult, readLogEntries, readMetaFile,
} from "./helpers.mjs";
import { makeOpenspecProject, writeArtifacts, initOpenspec, moveToArchive } from "./openspec-helpers.mjs";

after(cleanupAll);

const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const POLICY = JSON.parse(fs.readFileSync(path.join(SKILL_DIR, "policy.json"), "utf8"));
const SUFFIX = POLICY.prompts.suffix;
const PROPOSE_GUIDE = fs.readFileSync(path.join(SKILL_DIR, "prompts/os-propose.md"), "utf8");

const PROPOSED = { proposal: true, specs: 1, tasks: { done: 0, open: 2 } };
const TICKED = { proposal: true, specs: 1, tasks: { done: 2, open: 0 } };

const exists = (project, rel) => fs.existsSync(path.join(project.root, rel));

test("an unknown --chain value halts before anything is written", () => {
  const project = makeOpenspecProject(PROPOSED);
  for (const args of [["init", "demo", "--goal", "x", "--chain", "spec"], ["next", "demo", "--chain", "spec"], ["status", "demo", "--chain"]]) {
    const res = run(project, args);
    assert.equal(res.status, 1, res.stdout);
    assert.equal(res.json.action, "halt");
    assert.match(res.json.reason, /^Invalid --chain/);
  }
  assert.equal(fs.existsSync(project.agentDir), false);
  assert.equal(exists(project, "context/changes/demo"), false);
});

test("init --chain openspec halts on a missing change folder and creates no agent-smith folder", () => {
  const project = makeOpenspecProject({ change: false });
  const res = initOpenspec(project, "Add a thing");
  assert.equal(res.status, 1, res.stdout);
  assert.equal(res.json.action, "halt");
  assert.match(res.json.reason, /openspec new change demo/);
  assert.match(res.json.reason, /Store-hosted changes \(--store\) are not supported/);
  assert.equal(fs.existsSync(project.changeDir), false);
  assert.equal(exists(project, "context/changes/demo"), false);
});

test("next --chain openspec halts on a missing change folder and creates nothing", () => {
  const project = makeOpenspecProject({ change: false });
  const res = run(project, ["next", "demo", "--chain", "openspec"]);
  assert.equal(res.status, 1, res.stdout);
  assert.match(res.json.reason, /openspec new change demo/);
  assert.equal(fs.existsSync(project.changeDir), false);
});

test("init --chain openspec halts when context/changes/<id>/ exists (D8)", () => {
  const project = makeOpenspecProject(PROPOSED);
  fs.mkdirSync(project.tenxChangeDir, { recursive: true });
  const res = initOpenspec(project, "Add a thing");
  assert.equal(res.status, 1, res.stdout);
  assert.match(res.json.reason, /context\/changes\/demo\/ exists/);
  assert.equal(fs.existsSync(project.agentDir), false);
  assert.deepEqual(fs.readdirSync(project.tenxChangeDir), []);
});

test("init stores meta.chain and writes run state only under openspec/changes/<id>/agent-smith/", () => {
  const project = makeOpenspecProject();
  const res = initOpenspec(project, "Add a thing");
  assert.equal(res.status, 0, res.stdout);
  assert.equal(res.json.action, "run");
  const meta = readMetaFile(project);
  assert.equal(meta.chain, "openspec");
  assert.equal(meta.provenance.flags.chain, "openspec");
  assert.ok(fs.existsSync(path.join(project.agentDir, "run.jsonl")));
  assert.equal(exists(project, "context/changes/demo"), false);
  assert.deepEqual(fs.readdirSync(path.join(project.root, "context")).sort(), ["changes", "foundation"]);
  assert.deepEqual(fs.readdirSync(path.join(project.root, "context/changes")), []);
  // A resume keeps the chain.
  const again = initOpenspec(project, "");
  assert.equal(again.status, 1, again.stdout); // the step has no result yet
  assert.equal(readMetaFile(project).chain, "openspec");
});

test("a 10x init on an OpenSpec run halts and writes nothing", () => {
  const project = makeOpenspecProject();
  assert.equal(initOpenspec(project, "Add a thing").status, 0);
  const metaBefore = fs.readFileSync(path.join(project.agentDir, "meta.json"), "utf8");
  for (const extra of [[], ["--chain", "10x"]]) {
    const res = init(project, "Add a thing", extra);
    assert.equal(res.status, 1, res.stdout);
    assert.equal(res.json.action, "halt");
    assert.match(res.json.reason, /OpenSpec run/);
  }
  assert.equal(exists(project, "context/changes/demo"), false);
  assert.equal(fs.readFileSync(path.join(project.agentDir, "meta.json"), "utf8"), metaBefore);
});

test("a 10x meta.json has no chain key and its provenance flags no chain", () => {
  const project = makeProject();
  const res = init(project, "Add a thing");
  assert.equal(res.status, 0, res.stdout);
  const meta = readMetaFile(project);
  assert.equal(Object.hasOwn(meta, "chain"), false);
  assert.equal(Object.hasOwn(meta.provenance.flags, "chain"), false);
  assert.deepEqual(Object.keys(meta.provenance.flags), ["archive", "chrome", "score.minRigor", "agents.restricted", "advisor.enabled"]);
});

test("next and status detect the chain without the flag", () => {
  const project = makeOpenspecProject();
  const first = initOpenspec(project, "Add a thing");
  assert.equal(first.json.step, "os-propose");
  writeArtifacts(project, PROPOSED);
  writeResult(project, { status: "done", note: "proposed" });
  const res = run(project, ["next", "demo"]);
  assert.equal(res.status, 0, res.stdout);
  assert.equal(res.json.step, "os-apply");
  assert.equal(res.json.resultFile, "openspec/changes/demo/agent-smith/last-result.json");
  const entries = readLogEntries(project);
  assert.deepEqual(entries.map((e) => e.step), ["os-propose", "os-apply"]);
  assert.deepEqual(entries[1].before, { ticks: 0 });
  const status = run(project, ["status", "demo"]);
  assert.equal(status.status, 0, status.stdout);
  assert.deepEqual(status.json.steps.map((s) => s.step), ["os-propose", "os-apply"]);
  // The flag that agrees with the stored chain is accepted.
  assert.equal(run(project, ["status", "demo", "--chain", "openspec"]).status, 0);
});

test("--chain 10x on an OpenSpec run halts", () => {
  const project = makeOpenspecProject(PROPOSED);
  assert.equal(initOpenspec(project, "Add a thing").status, 0);
  for (const cmd of ["next", "status", "risk", "verify-archive"]) {
    const res = run(project, [cmd, "demo", "--chain", "10x"]);
    assert.equal(res.status, 1, `${cmd}: ${res.stdout}`);
    assert.match(res.json.reason, /--chain 10x does not apply/, cmd);
  }
  assert.equal(exists(project, "context/changes/demo"), false);
});

test("the first step follows the D4 order", () => {
  const cases = [
    [{}, "os-propose", /planning incomplete \(missing proposal\.md, specs\/\*\*\/\*\.md, tasks\.md\)/],
    [{ proposal: true, specs: 1 }, "os-propose", /missing tasks\.md/],
    [{ proposal: true, tasks: { done: 0, open: 1 } }, "os-propose", /missing specs/],
    [PROPOSED, "os-apply", /2 of 2 tasks open/],
    [{ proposal: true, specs: 2, tasks: { done: 1, open: 1 } }, "os-apply", /1 of 2 tasks open/],
    [TICKED, "os-verify", /all 2 tasks ticked/],
  ];
  for (const [artifacts, step, reason] of cases) {
    const project = makeOpenspecProject(artifacts);
    const res = initOpenspec(project, "Add a thing");
    assert.equal(res.status, 0, res.stdout);
    assert.equal(res.json.step, step, JSON.stringify(artifacts));
    assert.match(res.json.reason, reason);
    const entry = readLogEntries(project).at(-1);
    assert.equal(entry.template, step);
    assert.equal(entry.skill, POLICY.steps[step].skill);
  }
});

test("a design.md is optional for planning (predicate A)", () => {
  const project = makeOpenspecProject({ ...PROPOSED, design: false });
  assert.equal(initOpenspec(project, "Add a thing").json.step, "os-apply");
});

test("os-verify is not repeated after a verified os-verify that follows the last verified os-apply", () => {
  const project = makeOpenspecProject(TICKED);
  assert.equal(initOpenspec(project, "Add a thing").json.step, "os-verify");
  writeResult(project, { status: "done", note: "verified" });
  const res = run(project, ["next", "demo"]);
  assert.equal(res.json.action, "halt", res.stdout);
  assert.notEqual(res.json.step, "os-verify");
});

test("a tasks.md without a checkbox row halts", () => {
  for (const tasks of ["## 1. Work\n\n- Task one\n- [x]\n", "", "* [ ] 1.1 Star bullet\n"]) {
    const project = makeOpenspecProject({ proposal: true, specs: 1, tasks });
    const res = initOpenspec(project, "Add a thing");
    // A routing halt ends the run with a report and exit 0, as a 10x decide halt does.
    assert.equal(res.json.action, "halt", res.stdout);
    assert.match(res.json.reason, /openspec\/changes\/demo\/tasks\.md has no task row/);
    assert.equal(res.json.report, "openspec/changes/demo/agent-smith/report.md");
    assert.deepEqual(readLogEntries(project), []);
  }
});

test("the os-propose prompt holds the lead line, the guide text and prompts.suffix", () => {
  const project = makeOpenspecProject();
  const res = initOpenspec(project, "Add a greeting script");
  assert.equal(res.json.step, "os-propose");
  const prompt = res.json.prompt;
  assert.ok(prompt.startsWith("Run /openspec-propose for the existing OpenSpec change demo (openspec/changes/demo/). Goal: Add a greeting script\n"), prompt);
  const rules = PROPOSE_GUIDE.split("\n").filter((line) => line.includes("**GIVEN**"));
  assert.ok(rules.length > 0);
  for (const line of rules) assert.ok(prompt.includes(line.replaceAll("{id}", "demo")), line);
  assert.equal(prompt.includes("{id}"), false);
  assert.ok(prompt.endsWith("\n\n" + SUFFIX));
});

test("next, status and verify-archive on a moved OpenSpec run halt as archived without the flag", () => {
  const project = makeOpenspecProject(PROPOSED);
  assert.equal(initOpenspec(project, "Add a thing").status, 0);
  writeResult(project, { status: "done", note: "applied" });
  moveToArchive(project, "2026-02-03");
  for (const cmd of ["next", "status", "verify-archive"]) {
    const res = run(project, [cmd, "demo"]);
    assert.equal(res.status, 1, `${cmd}: ${res.stdout}`);
    assert.equal(res.json.action, "halt", cmd);
    assert.equal(res.json.reason, "Change demo is archived at openspec/changes/archive/2026-02-03-demo. Nothing was written.", cmd);
  }
  // A 10x init without the flag halts as archived too, and nothing is recreated.
  const again = init(project, "Add a thing");
  assert.equal(again.status, 1, again.stdout);
  assert.match(again.json.reason, /is archived at openspec\/changes\/archive\/2026-02-03-demo/);
  assert.equal(fs.existsSync(project.changeDir), false);
  assert.equal(exists(project, "context/changes/demo"), false);
});
