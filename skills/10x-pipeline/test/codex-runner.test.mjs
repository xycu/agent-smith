// Fake-CLI contracts. Real permission capability is verified separately with a model-free sandbox probe.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  cleanupAll, run, writeOverride, writeResult, readLogEntries, writeLog, writeMetaFile, entry,
  planText, gitInit, commitFiles, git,
} from "./helpers.mjs";
import { writePlan, writeReview } from "./ahead.mjs";
import { writeArtifacts } from "./openspec-helpers.mjs";
import { codexFixture, execute, calls, setMode, startRunner, waitForFile, runnerLeftovers } from "./codex-helpers.mjs";

after(cleanupAll);
const PRESET = JSON.parse(fs.readFileSync(new URL("../codex-policy.json", import.meta.url), "utf8"));

function snapshot(dir) {
  return Object.fromEntries(fs.readdirSync(dir, { recursive: true }).sort().filter(file => fs.statSync(path.join(dir, file)).isFile())
    .map(file => [file, fs.readFileSync(path.join(dir, file), "base64")]));
}

for (const chain of ["10x", "openspec"]) {
  test(`${chain}: filesystem failures keep diagnostics bounded before launch`, () => {
    const w = codexFixture(chain);
    const result = execute(w, { ...w.action, root: path.join(w.project.root, "x".repeat(8192)) });
    assert.equal(result.json.launched, false);
    assert.equal(result.json.completed, false);
    assert.ok(result.json.reason.length > 0 && result.json.reason.length <= 2048);
    assert.deepEqual(calls(w.fixture), []);
    assert.deepEqual(runnerLeftovers(w), []);
  });

  test(`${chain}: exact model/effort/stdin/cwd, optional profile, cumulative accounting and read-only state`, () => {
    for (const profile of [null, "existing-profile"]) {
      const w = codexFixture(chain, { profile });
      const before = snapshot(w.project.agentDir);
      const result = execute(w);
      assert.equal(result.status, 0, result.stdout + result.stderr);
      assert.equal(result.json.launched, true);
      assert.equal(result.json.completed, true);
      assert.deepEqual(result.json.result, { status: "done", note: "zażółć", signals: { rigor: "thorough" }, custom: true, usage: result.json.usage });
      assert.equal(result.json.usage.totalTokens, 110, "input 100 plus output 10 excludes duplicate cached/cache-write/reasoning counters");
      assert.equal(Object.hasOwn(result.json.usage, "toolUses"), false);
      assert.ok(result.json.usage.durationMs >= 0);
      const [probe, model] = calls(w.fixture);
      assert.equal(probe.args[0], "sandbox");
      assert.equal(model.args[0], "exec");
      assert.equal(model.cwd, w.project.root);
      assert.equal(model.input, w.action.prompt);
      assert.equal(model.args[model.args.indexOf("-C") + 1], w.project.root);
      assert.equal(model.args[model.args.indexOf("-m") + 1], w.action.model);
      assert.ok(model.args.includes(`model_reasoning_effort=${JSON.stringify(w.action.effort)}`));
      assert.ok(model.args.includes("agents.enabled=false"));
      assert.ok(model.args.includes("multi_agent_v2"));
      assert.ok(model.args.includes("--json") && model.args.includes("--ephemeral"));
      assert.equal(model.args.includes("-p"), profile !== null);
      if (profile) assert.equal(model.args[model.args.indexOf("-p") + 1], profile);
      for (const flag of ["--approve-for-me", "--trust", "--ignore-user-config", "--worktree", "-s"]) assert.equal(model.args.includes(flag), false);
      const output = model.args[model.args.indexOf("-o") + 1];
      assert.equal(output.startsWith(w.project.root), false, "raw output is outside the worktree");
      assert.equal(fs.existsSync(path.dirname(output)), false);
      assert.deepEqual(snapshot(w.project.agentDir), before);
      assert.deepEqual(runnerLeftovers(w), []);
    }
  });

  test(`${chain}: neutral retry keeps the exact nullable profile after policy changes`, () => {
    for (const profile of [null, "existing-profile"]) {
      const w = codexFixture(chain, { profile });
      writeOverride(w.project, { ...PRESET, codex: { profile: "new-profile" } });
      writeResult(w.project, { status: "orchestrator-error", note: "fixture" });
      const retry = run(w.project, ["next", w.project.id, "--chain", chain], { env: w.env });
      assert.equal(retry.json.action, "run", retry.stdout);
      assert.equal(retry.json.profile, profile);
      assert.equal(execute(w, retry.json).status, 0);
      const model = calls(w.fixture).at(-1);
      assert.equal(model.args.includes("-p"), profile !== null);
      if (profile) assert.equal(model.args[model.args.indexOf("-p") + 1], profile);
    }
  });

  test(`${chain}: stale or changed dispatch fields refuse before any CLI spawn`, () => {
    const w = codexFixture(chain);
    const before = snapshot(w.project.agentDir);
    for (const change of [{ n: 10 }, { provider: "claude" }, { model: "other" }, { effort: "ultra" },
      { profile: "other" }, { prompt: "other" }, { resultFile: "/tmp/result" }, { root: "/tmp" },
      { chain: chain === "10x" ? "openspec" : "10x" }, { change: "other" }]) {
      const result = execute(w, { ...w.action, ...change });
      assert.equal(result.status, 1);
      assert.equal(result.json.launched, false);
      assert.equal(result.json.result, null);
    }
    assert.deepEqual(calls(w.fixture), []);
    assert.deepEqual(snapshot(w.project.agentDir), before);
    writeResult(w.project, { status: "done" });
    assert.equal(execute(w).json.launched, false, "an existing result refuses a duplicate launch");
    fs.unlinkSync(path.join(w.project.agentDir, "last-result.json"));
    const entries = readLogEntries(w.project);
    entries.at(-1).result = { status: "done" };
    writeLog(w.project, entries);
    assert.equal(execute(w).json.launched, false, "a consumed action refuses a duplicate launch");
  });

  test(`${chain}: malformed policy remains a structured pre-spawn failure`, () => {
    const w = codexFixture(chain);
    fs.writeFileSync(path.join(w.project.root, "context/foundation/agent-smith-policy.json"), "broken");
    const result = execute(w);
    assert.equal(result.json.launched, false);
    assert.equal(result.json.completed, false);
    assert.equal(result.json.result, null);
    assert.match(result.json.reason, /Cannot parse/);
    assert.deepEqual(calls(w.fixture), []);
    assert.deepEqual(runnerLeftovers(w), []);
  });

  test(`${chain}: an archived name in another chain does not capture a live run`, () => {
    const w = codexFixture(chain);
    const other = chain === "10x" ? "openspec/changes/archive" : "context/archive";
    const target = path.join(w.project.root, other, "2026-01-01-demo/agent-smith");
    fs.mkdirSync(target, { recursive: true });
    fs.writeFileSync(path.join(target, "meta.json"), JSON.stringify({ id: "demo", chain: chain === "10x" ? "openspec" : "10x" }));
    assert.equal(execute(w).status, 0);
  });

  test(`${chain}: preflight refusal and missing explicit profiles never launch a model`, () => {
    for (const options of [{ mode: { preflightFailure: true } }, { profile: "missing-profile" }]) {
      const w = codexFixture(chain, options);
      const result = execute(w);
      assert.equal(result.json.launched, false);
      assert.match(result.json.reason, /cannot verify required Git capability/);
      assert.deepEqual(calls(w.fixture).map(c => c.args[0]), ["sandbox"]);
      assert.deepEqual(runnerLeftovers(w), []);
    }
  });

  test(`${chain}: missing CLI reports a pre-spawn orchestration failure`, () => {
    const w = codexFixture(chain);
    fs.unlinkSync(path.join(w.fixture, "bin/codex"));
    w.env.PATH = path.join(w.fixture, "bin");
    const result = execute(w);
    assert.equal(result.json.launched, false);
    assert.equal(result.json.completed, false);
    assert.deepEqual(runnerLeftovers(w), []);
  });

  test(`${chain}: exec spawn errors remain pre-child failures after a successful preflight`, () => {
    const w = codexFixture(chain, { mode: { removeExecutableAfterPreflight: true } });
    w.env.PATH = path.join(w.fixture, "bin");
    const result = execute(w);
    assert.equal(result.json.launched, false);
    assert.match(result.json.reason, /launch failed/);
    assert.deepEqual(runnerLeftovers(w), []);
  });

  test(`${chain}: handled cancellation waits for child close and removes raw files`, async (t) => {
    const w = codexFixture(chain, { mode: { hold: true, closeDelay: 250 } });
    const running = startRunner(w);
    t.after(() => running.child.kill("SIGTERM"));
    await waitForFile(path.join(w.fixture, "ready"));
    const output = calls(w.fixture).at(-1).args;
    const finalFile = output[output.indexOf("-o") + 1];
    running.child.kill("SIGTERM");
    await waitForFile(path.join(w.fixture, "terminating"));
    assert.ok(fs.existsSync(path.dirname(finalFile)), "runner retains raw files until child closes");
    const result = await running.closed;
    assert.equal(result.json.launched, true);
    assert.equal(result.json.completed, false);
    assert.match(result.json.reason, /cancelled/);
    assert.equal(fs.existsSync(path.dirname(finalFile)), false);
    const pid = Number(fs.readFileSync(path.join(w.fixture, "ready"), "utf8"));
    assert.throws(() => process.kill(pid, 0), { code: "ESRCH" });
    assert.deepEqual(runnerLeftovers(w), []);
  });
}

const reply = 'RESULT: {"status":"done"}';
const agent = { type: "item.completed", item: { type: "agent_message", text: reply } };
for (const [label, mode, ok, tokens] of [
  ["latest cumulative snapshot", { reply, events: [agent, { type: "turn.completed", usage: { input_tokens: 50, output_tokens: 5 } }, { type: "turn.completed", usage: { input_tokens: 100, output_tokens: 10 } }] }, true, 110],
  ["missing usage", { reply, events: [agent, { type: "turn.completed" }] }, true, undefined],
  ["negative usage", { reply, events: [agent, { type: "turn.completed", usage: { input_tokens: -1, output_tokens: 2 } }] }, false],
  ["unsafe usage", { reply, events: [agent, { type: "turn.completed", usage: { input_tokens: 9007199254740992, output_tokens: 2 } }] }, false],
  ["overflowing total", { reply, events: [agent, { type: "turn.completed", usage: { input_tokens: Number.MAX_SAFE_INTEGER, output_tokens: 2 } }] }, false],
  ["last malformed RESULT", { reply: reply + "\nRESULT: broken" }, false],
  ["missing RESULT", { reply: "No result" }, false],
  ["model-authored usage is replaced", { reply: 'RESULT: {"status":"done","usage":{"totalTokens":1,"toolUses":999}}' }, true, 110],
  ["RESULT array", { reply: "RESULT: []" }, false],
  ["child self-declared orchestration fault", { reply: 'RESULT: {"status":"orchestrator-error"}' }, true, 110],
  ["nonzero exit after plausible result", { code: 1 }, false],
  ["missing completed turn", { reply, events: [agent] }, false],
  ["later failed turn", { reply, events: [agent, { type: "turn.completed" }, { type: "turn.failed" }] }, false],
  ["later interrupted turn", { reply, events: [agent, { type: "turn.completed" }, { type: "turn.interrupted" }] }, false],
  ["later unfinished turn", { reply, events: [agent, { type: "turn.completed" }, { type: "turn.started" }] }, false],
  ["different final file", { fileReply: reply + "\nRESULT: {}" }, false],
  ["valid unsuccessful child result", { reply: 'RESULT: {"status":"failed","note":"check failed","signals":{"needsHuman":"review"}}' }, true, 110],
]) {
  test(`completion boundary accepts ${label} only when evidence is valid`, () => {
    const w = codexFixture("10x", { mode });
    const result = execute(w);
    assert.equal(result.json.launched, true, result.stdout);
    assert.equal(result.json.completed, ok, result.stdout);
    if (ok) {
      assert.equal(result.json.usage.totalTokens, tokens);
      assert.deepEqual(result.json.result.usage, result.json.usage);
      assert.equal(Object.hasOwn(result.json.result.usage, "toolUses"), false);
    }
    if (label === "child self-declared orchestration fault") assert.equal(result.json.result.status, "unknown");
    if (label === "valid unsuccessful child result") assert.equal(result.json.result.status, "failed");
    if (!ok) assert.equal(result.json.result, null);
    assert.deepEqual(runnerLeftovers(w), []);
  });
}

test("an oversized completed JSONL record is refused with bounded diagnostics", () => {
  const w = codexFixture("10x", { mode: { fragmentSize: 65536,
    events: [{ type: "item.completed", item: { type: "agent_message", text: "x".repeat(8 * 1024 * 1024) } }, { type: "turn.completed" }] } });
  const result = execute(w);
  assert.equal(result.json.launched, true);
  assert.equal(result.json.completed, false);
  assert.match(result.json.reason, /oversized event/);
  assert.ok(result.stdout.length < 1000);
  assert.deepEqual(runnerLeftovers(w), []);
});

for (const chain of ["10x", "openspec"]) {
  test(`${chain}: archive returns reply after folder move without recreating run state`, () => {
    const w = codexFixture(chain);
    const p = w.project;
    if (chain === "10x") {
      writePlan(p, planText({ done: 1 }));
      fs.writeFileSync(path.join(p.changeDir, "change.md"), "---\nchange_id: demo\nstatus: impl_reviewed\ncreated: 2026-01-01\n---\n");
      writeReview(p, "plan-review", { verdict: "SOUND" });
      writeReview(p, "impl-review", { verdict: "APPROVED" });
    } else {
      writeArtifacts(p, { proposal: true, design: true, specs: 1, tasks: { done: 1 }, verify: "Verdict: PASS\nCritical: 0\nWarnings: 0\n\n## Critical\n\n## Warnings\n" });
    }
    writeLog(p, [entry(1, chain === "10x" ? "implement" : "os-apply", { provider: "openai", profile: null }),
      entry(2, chain === "10x" ? "impl-review" : "os-verify", { provider: "openai", profile: null })]);
    writeMetaFile(p, { id: p.id, host: "codex", goal: "fixture", archive: true, ...(chain === "openspec" ? { chain } : {}) });
    gitInit(p);
    commitFiles(p, ["README.md"]);
    const archive = run(p, ["next", p.id, "--chain", chain], { env: w.env });
    assert.equal(archive.json.action, "archive", archive.stdout);
    w.action = archive.json;
    const before = snapshot(p.agentDir);
    const oldHead = git(p, ["rev-parse", "HEAD"]);
    const moved = path.join(p.root, archive.json.archivePath);
    fs.mkdirSync(path.dirname(moved), { recursive: true });
    for (const field of ["archivePath", "profile"]) {
      const bad = execute(w, { ...archive.json, [field]: field === "profile" ? "other" : "context/archive/wrong" });
      assert.equal(bad.json.launched, false);
    }
    setMode(w, { moveFrom: p.changeDir, moveTo: moved });
    const result = execute(w);
    assert.equal(result.status, 0, result.stdout);
    assert.equal(result.json.result.status, "done");
    assert.match(result.json.reply, /^RESULT:/);
    assert.equal(fs.existsSync(p.changeDir), false);
    assert.deepEqual(snapshot(path.join(moved, "agent-smith")), before);
    assert.equal(git(p, ["rev-parse", "HEAD"]), oldHead, "runner does not commit or sweep child work");
    assert.equal(execute(w).json.launched, false, "moved archive cannot run twice");
    assert.deepEqual(runnerLeftovers(w), []);
  });
}
