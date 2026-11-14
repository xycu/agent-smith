// Host-independent instruction/packaging contracts and provider-aware manual verification.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  cleanupAll, makeProject, init, next, writeResult, writeLog, entry, readLogEntries,
} from "./helpers.mjs";
import { writePlan, writeReview, stampAhead } from "./ahead.mjs";
import { buildPlan } from "./phase-helpers.mjs";
import { promptText, ruleTail } from "../scripts/flow.mjs";

after(cleanupAll);
const PRESET = JSON.parse(fs.readFileSync(new URL("../codex-policy.json", import.meta.url), "utf8"));
const POLICY = JSON.parse(fs.readFileSync(new URL("../policy.json", import.meta.url), "utf8"));
const AUTO = [{ text: "implementation complete", done: true }];
const BROWSER = "Browser navigation displays the saved result";
const REASON = "Browser unavailable (OpenAI runner has no Claude-in-Chrome integration), no covering proof";
const plan = (manual) => buildPlan([{ auto: AUTO, manual }]);

function manualProject(host = "codex", flags = []) {
  const project = makeProject({ plan: plan([BROWSER]), policy: { ...PRESET, manualVerify: { minRigor: "lean" } } });
  writeReview(project, "plan-review", { verdict: "SOUND" });
  writeLog(project, [entry(1, "plan"), entry(2, "plan-review"), entry(3, "implement")]);
  const action = init(project, "fix typo", ["--host", host, ...flags]).json;
  assert.equal(action.step, "manual-verify", JSON.stringify(action));
  return { project, action };
}

function evidence(project, name, text) {
  const file = path.join(project.changeDir, "evidence", name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
  stampAhead(file);
}

for (const host of ["claude", "codex"]) {
  test(`${host}: OpenAI manual fallback is selected after provider dispatch and recorded exactly`, () => {
    const { project, action } = manualProject(host);
    const pending = readLogEntries(project).at(-1);
    assert.equal(action.provider, "openai");
    assert.equal(pending.template, "manual-verify-openai");
    assert.equal(pending.pendingPrompt, action.prompt);
    assert.match(action.prompt, /Browser rows: 1\.2/);
    assert.match(action.prompt, /Browser: unavailable \(OpenAI runner has no Claude-in-Chrome integration\)/);
    assert.doesNotMatch(action.prompt, /Chrome: off|--chrome false|ToolSearch call/);
    const off = manualProject(host, ["--chrome", "false"]);
    assert.equal(readLogEntries(off.project).at(-1).template, "manual-verify-nochrome");
    assert.match(off.action.prompt, /Chrome: off \(--chrome false\)/);
  });
}

test("OpenAI fallback refuses a claimed browser evidence prefix through the shared evidence-kind check", () => {
  const { project, action } = manualProject();
  evidence(project, "browser-invented.txt", "Fixture claim without an available browser integration\n");
  writePlan(project, plan([{ text: `${BROWSER} — evidence: evidence/browser-invented.txt`, done: true }]));
  writeResult(project, { status: "done" });
  next(project);
  const finished = readLogEntries(project).find((item) => item.n === action.n);
  assert.equal(finished.ok, false);
  assert.deepEqual(finished.unproven, ["1.2"]);
  assert.match(finished.unprovenWhy["1.2"], /only test, command, script evidence/);
});

for (const kind of ["test", "command", "script"]) {
  test(`OpenAI fallback accepts covering ${kind} evidence without fabricating browser access`, () => {
    const { project, action } = manualProject();
    const file = `${kind}-covering.txt`;
    evidence(project, file, "Browser: unavailable (OpenAI runner has no Claude-in-Chrome integration)\nFixture covering proof\n");
    writePlan(project, plan([{ text: `${BROWSER} — evidence: evidence/${file}`, done: true }]));
    writeResult(project, { status: "done" });
    next(project);
    const finished = readLogEntries(project).find((item) => item.n === action.n);
    assert.equal(finished.ok, true);
    assert.equal(finished.proved[0].kind, kind);
  });
}

test("OpenAI pending browser rows retain their truthful unproved reason", () => {
  const { project, action } = manualProject();
  evidence(project, "unproven.md", `- 1.2 — ${REASON}\n`);
  writeResult(project, { status: "done" });
  next(project);
  const finished = readLogEntries(project).find((item) => item.n === action.n);
  assert.deepEqual(finished.pending, ["1.2"]);
  assert.equal(finished.reasons["1.2"], REASON);
});

test("OpenAI browser fallback preserves native advisor refusals under either template spelling", () => {
  for (const template of ["manual-verify", "manual-verify-openai"]) {
    const project = makeProject({ plan: plan([BROWSER]), policy: {
      ...PRESET, manualVerify: { minRigor: "lean" }, advisor: { enabled: true, templates: [template] },
    } });
    writeReview(project, "plan-review", { verdict: "SOUND" });
    writeLog(project, [entry(1, "plan"), entry(2, "plan-review"), entry(3, "implement")]);
    const before = readLogEntries(project).length;
    const refused = init(project, "fix typo", ["--host", "codex"]);
    assert.equal(refused.json.action, "halt", refused.stdout);
    assert.match(refused.json.reason, /cannot use the native Claude advisor/);
    assert.equal(readLogEntries(project).length, before);
  }
});

test("shared wired prompts explain named skills and forbid every child delegation mechanism", () => {
  for (const template of Object.keys(POLICY.prompts)) {
    const text = promptText(POLICY, template);
    assert.equal(typeof text, "string", template);
  }
  const suffix = ruleTail(POLICY, { step: "plan" });
  assert.match(suffix, /load its SKILL\.md through the host's skill discovery/);
  assert.match(suffix, /treating the slash text as a skill name and arguments/);
  assert.match(suffix, /\*\*MUST NOT\*\* call the Agent tool, the Task tool, spawn_agent or any other delegation tool/);
  assert.doesNotMatch(suffix, /AskUserQuestion is unavailable/);
});

test("the compatibility manifest declares the same shared skills and preserves version ownership", () => {
  const plugin = JSON.parse(fs.readFileSync(new URL("../../../.claude-plugin/plugin.json", import.meta.url), "utf8"));
  const marketplace = JSON.parse(fs.readFileSync(new URL("../../../.claude-plugin/marketplace.json", import.meta.url), "utf8"));
  const manifest = JSON.parse(fs.readFileSync(new URL("../../../.release-please-manifest.json", import.meta.url), "utf8"));
  assert.equal(plugin.skills, "./skills/");
  assert.equal(plugin.version, marketplace.metadata.version);
  assert.equal(Object.hasOwn(marketplace.plugins[0], "version"), false);
  assert.equal(plugin.version, manifest["."]);
});

test("both shared skills bind the actual host, runner lifetime, archive and comment authorization", () => {
  const texts = ["../SKILL.md", "../../openspec-pipeline/SKILL.md"].map((file) => fs.readFileSync(new URL(file, import.meta.url), "utf8"));
  const sections = [];
  for (const text of texts) {
    assert.match(text, /absolute SKILL\.md path/);
    assert.match(text, /--host <host> --pr-comment <true\|false>/);
    assert.match(text, /For `provider: "claude"`, require host `claude`/);
    assert.match(text, /For `provider: "openai"`/);
    assert.match(text, /entire router action JSON on stdin/);
    assert.match(text, /write only `envelope\.result` unchanged/);
    assert.match(text, /Only an envelope with `launched: false` permits an `orchestrator-error`/);
    assert.match(text, /shared runner command from `run` step 2/);
    assert.match(text, /no question tool/);
    assert.match(text, /Legacy or missing intent reads false/);
    assert.doesNotMatch(text, /TaskList|TaskCreate/);
    sections.push(text.split("## Anti-stall rules\n")[1].split("\n## ")[0]);
  }
  assert.equal(sections[0], sections[1]);
  assert.match(texts[1], /sibling `\.\.\/10x-pipeline\/` directory/);
  assert.match(texts[1], /node "\$RUN_CODEX" <change-name> --chain openspec/);
});
