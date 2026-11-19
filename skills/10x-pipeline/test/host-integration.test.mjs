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

function manualProject(host = "codex", flags = [], mode = "codex") {
  const project = makeProject({ plan: plan([BROWSER]), policy: { ...PRESET, manualVerify: { minRigor: "lean" } } });
  writeReview(project, "plan-review", { verdict: "SOUND" });
  writeLog(project, [entry(1, "plan"), entry(2, "plan-review"), entry(3, "implement")]);
  const action = init(project, "fix typo", ["--host", host, "--provider-mode", mode, ...flags]).json;
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

test("headless Claude records local browser capability and replays the exact pending task", () => {
  for (const off of [false, true]) {
    const { project, action } = manualProject("codex", off ? ["--chrome=false"] : [], "claude");
    const pending = readLogEntries(project).at(-1);
    assert.equal(pending.browserEvidence, "local");
    assert.equal(pending.template, off ? "manual-verify-nochrome" : "manual-verify-headless");
    const reason = off ? "Chrome off (--chrome false)" : "Browser unavailable (headless Claude runner has no Claude-in-Chrome integration), no covering proof";
    assert.ok(action.prompt.includes(reason));
    writeResult(project, { status: "orchestrator-error" });
    assert.equal(next(project).json.prompt, action.prompt);
    evidence(project, "unproven.md", `- 1.2 — ${reason}\n`);
    writeResult(project, { status: "done" });
    next(project);
    assert.equal(readLogEntries(project).find((e) => e.n === action.n).reasons["1.2"], reason);
  }
});

for (const kind of ["test", "browser"]) {
  test(`headless Claude browser rows check ${kind} evidence against the saved capability`, () => {
    const { project, action } = manualProject("codex", [], "claude");
    evidence(project, `${kind}-claim.txt`, "local fixture");
    writePlan(project, plan([{ text: `${BROWSER} — evidence: evidence/${kind}-claim.txt`, done: true }]));
    writeResult(project, { status: "done" });
    next(project);
    assert.equal(readLogEntries(project).find((e) => e.n === action.n).ok, kind === "test");
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

test("shared wired prompts explain named skills and bound delegation to collected leaves", () => {
  for (const template of Object.keys(POLICY.prompts).filter((key) => key !== "byFile")) {
    const text = promptText(POLICY, template);
    assert.equal(typeof text, "string", template);
  }
  const suffix = ruleTail(POLICY, { step: "plan" });
  assert.match(suffix, /load its SKILL\.md through the host's skill discovery/);
  assert.match(suffix, /treating the slash text as a skill name and arguments/);
  assert.match(suffix, /\*\*MAY\*\* start one native child layer/);
  assert.match(suffix, /identify the child as a leaf with no further delegation/);
  assert.match(suffix, /collect every launched child, reconcile edits and failures/);
  assert.match(suffix, /you are a delegated leaf.*\*\*MUST NOT\*\* do so/);
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
    const start = text.split("## Start")[1].split("## Loop")[0];
    const parse = start.split("\n2. ")[0];
    assert.match(parse, /consume `--provider-mode <mode>` or `--provider-mode=<mode>` before deriving goal text or preparing isolation/i);
    assert.match(parse, /Require `claude`, `codex` or `split`/);
    assert.match(start, /Append `--provider-mode <mode>` only when explicitly supplied, including on resume/);
    assert.match(start, /Show init `providerMode` and `providersByStep` before dispatch/);
    assert.match(text, /^argument-hint:.*\[--provider-mode <mode>\]/m);
    assert.match(text, /RUN_CLAUDE` \(`scripts\/run-claude\.mjs`\).*absolute SKILL\.md path/);
    const run = text.split("- **`run`**")[1].split("- **`done`**")[0];
    assert.match(run, /For `provider: "claude"` on host `claude`, use native Agent/);
    assert.match(run, /For `provider: "openai"` on either host, run [^`]*`[^\n]*"\$RUN_CODEX"/);
    assert.match(run, /For `provider: "claude"` on host `codex`, run [^`]*`[^\n]*"\$RUN_CLAUDE"/);
    for (const role of ["Step <n>: <step>", "Archive:"]) {
      assert.ok(text.split("\n").some(line => line.includes(role) && line.includes("<provider>/<model>/<effort>")));
    }
    for (const owner of ["PR comment (opt-in)", "Pull request (always)"]) {
      const section = text.split("## " + owner)[1].split("\n## ")[0];
      assert.match(section, /Check the suspension STOP before handling its JSON/);
    }
    assert.match(text, /entire router action JSON on stdin/);
    assert.match(text, /write only `envelope\.result` unchanged/);
    assert.match(text, /Only an envelope with `launched: false` permits an `orchestrator-error`/);
    assert.match(text, /entire archive action unchanged to its runner command from `run` step 2/);
    assert.match(text, /no question tool/);
    assert.match(text, /Legacy or missing intent reads false/);
    assert.doesNotMatch(text, /TaskList|TaskCreate/);
    sections.push(text.split("## Anti-stall rules\n")[1].split("\n## ")[0]);
  }
  assert.equal(sections[0], sections[1]);
  assert.match(texts[1], /sibling `\.\.\/10x-pipeline\/` directory/);
  for (const runner of ["RUN_CODEX", "RUN_CLAUDE"]) assert.ok(texts[1].includes(`node "$${runner}" <change-name> --chain openspec`));
});
