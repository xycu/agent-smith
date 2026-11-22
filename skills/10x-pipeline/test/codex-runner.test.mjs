// Fake-CLI contracts. Real permission capability is verified separately with a model-free sandbox probe.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { setTimeout } from "node:timers/promises";
import {
  cleanupAll, run, writeOverride, writeResult, readLogEntries, writeLog, writeMetaFile, entry,
  planText, gitInit, commitFiles, git,
} from "./helpers.mjs";
import { writePlan, writeReview } from "./ahead.mjs";
import { codexChildEnv } from "../scripts/run-codex.mjs";
import { writeArtifacts } from "../../openspec-pipeline/test/openspec-helpers.mjs";
import { codexFixture, execute, calls, metadataCalls, setMode, startRunner, waitForFile, runnerLeftovers } from "./codex-helpers.mjs";

after(cleanupAll);
const PRESET = JSON.parse(fs.readFileSync(new URL("../codex-policy.json", import.meta.url), "utf8"));

function snapshot(dir) {
  return Object.fromEntries(fs.readdirSync(dir, { recursive: true }).sort().filter(file => fs.statSync(path.join(dir, file)).isFile())
    .map(file => [file, fs.readFileSync(path.join(dir, file), "base64")]));
}

function assertNativeSuspension(w, reason) {
  const leftovers = runnerLeftovers(w);
  assert.equal(leftovers.length, 1, "only native ownership remains");
  const lock = path.join(w.tmp, leftovers[0]);
  assert.match(lock, /\.lock$/);
  assert.ok(reason.startsWith(`Execution suspended: native ownership unresolved (lock file ${lock}, thread root-fixture).`), reason);
  assert.ok(reason.length <= 2048);
  assert.match(reason, /Keep the enabling revision and TMPDIR/);
  assert.match(reason, /Await an active runner through its existing handle/);
  assert.match(reason, /authorized owner must inspect the recorded thread and its descendants, prove settlement and arrange router-owned recovery before mutation, relaunch or publication/);
  assert.match(reason, /Automatic recovery for a retained native lock is unavailable/);
  return lock;
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

  test(`${chain}: exact model/effort/stdin/cwd, optional profile, observed accounting and read-only state`, () => {
    for (const profile of [null, "existing-profile"]) {
      const w = codexFixture(chain, { profile });
      const before = snapshot(w.project.agentDir);
      const result = execute(w);
      assert.equal(result.status, 0, result.stdout + result.stderr);
      assert.equal(result.json.launched, true);
      assert.equal(result.json.completed, true);
      assert.deepEqual(result.json.result, { status: "done", note: "zażółć", signals: { rigor: "thorough" }, custom: true, usage: result.json.usage, usageEvidence: result.json.usageEvidence });
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
      assert.ok(model.args.includes("agents.enabled=true"));
      assert.ok(model.args.includes("multi_agent_v2"));
      assert.ok(model.args.includes("--json"));
      assert.equal(model.args.includes("--ephemeral"), false, "native settlement requires retained CLI history");
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

  test(`${chain}: fake parent collects its held descendant before publishing a reply`, async (t) => {
    const w = codexFixture(chain, { mode: { descendant: true } });
    const before = snapshot(w.project.agentDir);
    const running = startRunner(w);
    const release = path.join(w.fixture, "descendant-release");
    t.after(async () => {
      fs.writeFileSync(release, "yes");
      running.child.kill("SIGTERM");
      await running.closed;
    });
    await waitForFile(path.join(w.fixture, "descendant-ready"));
    await waitForFile(path.join(w.fixture, "descendant-waiting"));
    const pid = Number(fs.readFileSync(path.join(w.fixture, "descendant-ready"), "utf8"));
    process.kill(pid, 0);
    const args = calls(w.fixture).at(-1).args;
    const finalFile = args[args.indexOf("-o") + 1];
    assert.equal(fs.existsSync(finalFile), false, "parent awaits collection before writing its final reply");
    assert.equal(fs.existsSync(path.join(w.fixture, "descendant-collected")), false);
    assert.ok(fs.existsSync(path.dirname(finalFile)), "raw files remain until the execution closes");
    fs.writeFileSync(release, "yes");
    const result = await running.closed;
    assert.equal(result.json.completed, true, result.stdout + result.stderr);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(w.fixture, "descendant-collected"), "utf8")), { code: 0, signal: null });
    assert.equal(fs.readFileSync(path.join(w.fixture, "descendant-exited"), "utf8"), String(pid));
    assert.throws(() => process.kill(pid, 0), { code: "ESRCH" });
    assert.equal(fs.existsSync(path.dirname(finalFile)), false);
    assert.deepEqual(snapshot(w.project.agentDir), before);
    assert.deepEqual(runnerLeftovers(w), []);
  });

  test(`${chain}: handled cancellation waits for child close and removes raw files`, async (t) => {
    const w = codexFixture(chain, { mode: { hold: true, holdUntilRelease: true } });
    const running = startRunner(w);
    const release = path.join(w.fixture, "release");
    t.after(async () => {
      fs.writeFileSync(release, "yes");
      running.child.kill("SIGTERM");
      const closed = await running.closed;
      assert.notEqual(closed.json?.signal, "SIGKILL", closed.stdout);
    });
    await waitForFile(path.join(w.fixture, "ready"));
    const output = calls(w.fixture).at(-1).args;
    const finalFile = output[output.indexOf("-o") + 1];
    running.child.kill("SIGTERM");
    await waitForFile(path.join(w.fixture, "terminating"));
    assert.ok(fs.existsSync(path.dirname(finalFile)), "runner retains raw files until child closes");
    fs.writeFileSync(release, "yes");
    const result = await running.closed;
    assert.equal(result.json.launched, true, result.stdout);
    assert.equal(result.json.completed, false, result.stdout);
    assert.match(result.json.reason, /cancelled/, result.stdout);
    assert.equal(result.json.exitCode, 0, result.stdout);
    assert.equal(result.json.signal, null, result.stdout);
    assert.equal(fs.existsSync(path.dirname(finalFile)), false);
    const pid = Number(fs.readFileSync(path.join(w.fixture, "ready"), "utf8"));
    assert.throws(() => process.kill(pid, 0), { code: "ESRCH" });
    assert.equal(runnerLeftovers(w).filter(name => name.endsWith(".lock")).length, 1);
    assert.match(result.json.reason, /Execution suspended:/);
  });
}

const reply = 'RESULT: {"status":"done"}';
const agent = { type: "item.completed", item: { type: "agent_message", text: reply } };
const failedRoot = { status: "failed", startedAt: 10, completedAt: 20 };
const failedTurn = { fileReply: "", events: [{ type: "turn.failed" }], turns: { "root-fixture": { data: [failedRoot] } } };
const unsuccessfulExit = /Codex exited unsuccessfully\. The child result was not accepted\./;

for (const chain of ["10x", "openspec"]) {
  for (const [label, mode, reason] of [
    ["nonzero exit after valid completion", { code: 1 }, unsuccessfulExit],
    ["nonzero exit with a failed turn and no assistant message", { ...failedTurn, code: 1 }, unsuccessfulExit],
    ["zero exit with a failed turn", failedTurn, /no final successful completed turn/],
    ["matching reply without a RESULT", { reply: "No result" }, /no RESULT line/],
    ["matching reply with an invalid last RESULT", { reply: reply + "\nRESULT: broken" }, /last RESULT line is invalid/],
  ]) {
    test(`${chain}: settled failed attempt allows retry after ${label}`, () => {
      const w = codexFixture(chain, { mode });
      const before = snapshot(w.project.agentDir);
      const result = execute(w);
      assert.equal(result.status, 1, result.stdout);
      const { launched, completed, result: report, usage, usageEvidence, reason: note } = result.json;
      assert.equal(launched, true);
      assert.equal(completed, false);
      assert.equal(report, null);
      assert.equal(result.json.exitCode, mode.code ?? 0);
      assert.equal(result.json.signal, null);
      assert.match(note, reason);
      assert.doesNotMatch(note, /Execution suspended:/);
      assert.ok(Number.isSafeInteger(usage.durationMs) && usage.durationMs >= 0);
      assert.deepEqual(usage, { durationMs: usage.durationMs });
      assert.equal(usageEvidence, undefined);
      assert.deepEqual(runnerLeftovers(w), []);
      assert.deepEqual(snapshot(w.project.agentDir), before);
      const requests = metadataCalls(w.fixture);
      assert.deepEqual(requests.filter(call => call.method === "thread/turns/list").map(call => call.params.threadId), ["root-fixture"]);
      assert.deepEqual(requests.filter(call => call.method === "thread/list").map(call => call.params.archived), [false, true, false, true]);
      assert.equal(requests.some(call => call.method === "thread/read"), false);

      writeResult(w.project, { status: "unknown", note, usage });
      const retry = run(w.project, ["next", w.project.id, "--chain", chain], { env: w.env });
      const failed = readLogEntries(w.project).find(entry => entry.n === w.action.n);
      assert.equal(failed.result.status, "unknown");
      assert.equal(failed.result.note, note);
      assert.equal(failed.ok, false);
      assert.equal(failed.usage.durationMs, usage.durationMs);
      assert.equal(failed.result.usage.durationMs, usage.durationMs);
      assert.equal(retry.json.action, "run", retry.stdout);
      assert.equal(retry.json.step, w.action.step);
      assert.ok(retry.json.n > w.action.n);
      setMode(w, {});
      const retried = execute(w, retry.json);
      assert.equal(retried.status, 0, retried.stdout);
      assert.equal(retried.json.completed, true, retried.stdout);
      assert.deepEqual(runnerLeftovers(w), []);
    });
  }

  for (const [label, mode, reason, reconciles] of [
    ["untimestamped failed root", { ...failedTurn, turns: { "root-fixture": { data: [{ status: "failed", startedAt: 10 }] } } },
      /exited unsuccessfully.*Native settlement failed:.*terminal latest turn/, true],
    ["interrupted root in metadata only", { ...failedTurn, turns: { "root-fixture": { data: [{ ...failedRoot, status: "interrupted" }] } } },
      /exited unsuccessfully.*Native settlement failed:.*terminal latest turn/, true],
    ["timestamped failed descendant", { ...failedTurn, pages: { true: { first: { data: [{ id: "child" }], nextCursor: null } } },
      turns: { ...failedTurn.turns, child: { data: [failedRoot] } } },
      /exited unsuccessfully.*Native settlement failed:.*completed latest turn/, true],
    ["malformed metadata after the last response", { ...failedTurn, malformedFinalMetadata: true },
      /exited unsuccessfully.*Native settlement failed:.*response is malformed or mismatched/, true],
    ["malformed JSONL", { ...failedTurn, malformedJson: true }, /malformed JSONL/, false],
    ["malformed UTF-8 JSONL", { ...failedTurn, invalidUtf8: true }, /invalid UTF-8 JSONL/, false],
    ["explicit root interruption before a later error", { ...failedTurn, events: [{ type: "turn.interrupted", thread_id: "root-fixture" }, { type: "error" }] },
      /root turn was interrupted/, false],
    ["signalled child exit", { ...failedTurn, exitSignal: "SIGTERM" }, /exited on signal SIGTERM/, false],
  ]) {
    test(`${chain}: failed attempt retains native ownership after ${label}`, () => {
      const w = codexFixture(chain, { mode: { ...mode, code: 1 } });
      const before = snapshot(w.project.agentDir);
      const result = execute(w);
      assert.equal(result.status, 1, result.stdout);
      assert.equal(result.json.launched, true);
      assert.equal(result.json.completed, false);
      assert.equal(result.json.result, null);
      assert.equal(result.json.signal, mode.exitSignal ?? null);
      assert.match(result.json.reason, reason);
      const lock = assertNativeSuspension(w, result.json.reason);
      const ownership = fs.readFileSync(lock, "utf8");
      assert.deepEqual(snapshot(w.project.agentDir), before);
      const requests = metadataCalls(w.fixture);
      assert.equal(requests.some(call => call.method === "thread/turns/list"), reconciles);
      assert.equal(requests.some(call => call.method === "thread/read"), false);
      assert.equal(run(w.project, ["status", w.project.id, "--chain", chain], { env: w.env }).status, 0);

      writeResult(w.project, { status: "unknown", note: "must remain untouched" });
      const pending = snapshot(w.project.agentDir);
      const next = run(w.project, ["next", w.project.id, "--chain", chain], { env: w.env });
      assert.equal(next.json.action, "halt", next.stdout);
      assertNativeSuspension(w, next.json.reason);
      const beforeRelaunch = calls(w.fixture);
      const relaunch = execute(w);
      assert.equal(relaunch.json.launched, false);
      assertNativeSuspension(w, relaunch.json.reason);
      assert.deepEqual(calls(w.fixture), beforeRelaunch);
      assert.equal(fs.readFileSync(lock, "utf8"), ownership);
      assert.deepEqual(snapshot(w.project.agentDir), pending);
    });
  }
}

test("an exec input stream fault prevents ordinary failure settlement", () => {
  const w = codexFixture("openspec", { mode: { ...failedTurn, rejectInput: true } });
  // Overflow the pipe so exiting without reading reports a write fault.
  const prompt = w.action.prompt + "\n" + "x".repeat(512 * 1024);
  const entries = readLogEntries(w.project);
  entries.at(-1).pendingPrompt = prompt;
  writeLog(w.project, entries);
  const result = execute(w, { ...w.action, prompt });
  assert.equal(result.status, 1, result.stdout);
  assert.equal(result.json.launched, true);
  assert.equal(result.json.exitCode, 1);
  assert.match(result.json.reason, /Codex input could not be sent/);
  assertNativeSuspension(w, result.json.reason);
  assert.deepEqual(metadataCalls(w.fixture), []);
});

for (const [label, mode, ok, retainsLock, tokens] of [
  ["latest cumulative snapshot", { reply, events: [agent, { type: "turn.completed", usage: { input_tokens: 50, output_tokens: 5 } }, { type: "turn.completed", usage: { input_tokens: 100, output_tokens: 10 } }] }, true, false, 110],
  ["missing usage", { reply, events: [agent, { type: "turn.completed" }] }, true, false],
  ["negative usage", { reply, events: [agent, { type: "turn.completed", usage: { input_tokens: -1, output_tokens: 2 } }] }, true, false],
  ["unsafe usage", { reply, events: [agent, { type: "turn.completed", usage: { input_tokens: 9007199254740992, output_tokens: 2 } }] }, true, false],
  ["overflowing total", { reply, events: [agent, { type: "turn.completed", usage: { input_tokens: Number.MAX_SAFE_INTEGER, output_tokens: 2 } }] }, true, false],
  ["last malformed RESULT", { reply: reply + "\nRESULT: broken" }, false, false],
  ["missing RESULT", { reply: "No result" }, false, false],
  ["model-authored accounting is replaced", { reply: 'RESULT: {"status":"done","usage":{"totalTokens":1,"toolUses":999},"usageEvidence":{"status":"verified","path":"/private-source"}}' }, true, false, 110],
  ["RESULT array", { reply: "RESULT: []" }, false, false],
  ["child self-declared orchestration fault", { reply: 'RESULT: {"status":"orchestrator-error"}' }, true, false, 110],
  ["nonzero exit after plausible result", { code: 1 }, false, false],
  ["missing completed turn", { reply, events: [agent] }, false, true],
  ["later failed turn", { reply, events: [agent, { type: "turn.completed" }, { type: "turn.failed" }] }, false, false],
  ["later interrupted turn", { reply, events: [agent, { type: "turn.completed" }, { type: "turn.interrupted" }] }, false, true],
  ["later unfinished turn", { reply, events: [agent, { type: "turn.completed" }, { type: "turn.started" }] }, false, true],
  ["reply from an earlier turn", { reply: "No result", events: [
    { type: "item.completed", item: { type: "agent_message", text: "No result" } },
    { type: "turn.completed" }, { type: "turn.started" }, { type: "turn.completed" },
  ] }, false, true],
  ["different final file", { fileReply: reply + "\nRESULT: {}" }, false, true],
  ["valid unsuccessful child result", { reply: 'RESULT: {"status":"failed","note":"check failed","signals":{"needsHuman":"review"}}' }, true, false, 110],
]) {
  test(`completion boundary accepts ${label} only when evidence is valid`, () => {
    const w = codexFixture("10x", { mode });
    const result = execute(w);
    assert.equal(result.json.launched, true, result.stdout);
    assert.equal(result.json.completed, ok, result.stdout);
    if (ok) {
      assert.equal(result.json.usage.totalTokens, tokens);
      assert.deepEqual(result.json.result.usage, result.json.usage);
      assert.deepEqual(result.json.result.usageEvidence, result.json.usageEvidence);
      assert.equal(result.json.usageEvidence.status, tokens === undefined ? "unavailable" : "verified");
      assert.doesNotMatch(JSON.stringify(result.json.result.usageEvidence), /private-source/);
      assert.equal(Object.hasOwn(result.json.result.usage, "toolUses"), false);
    }
    if (label === "child self-declared orchestration fault") assert.equal(result.json.result.status, "unknown");
    if (label === "valid unsuccessful child result") assert.equal(result.json.result.status, "failed");
    if (!ok) assert.equal(result.json.result, null);
    assert.equal(runnerLeftovers(w).filter(name => name.endsWith(".lock")).length, retainsLock ? 1 : 0);
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
  assert.equal(runnerLeftovers(w).filter(name => name.endsWith(".lock")).length, 1);
});

function archiveFixture(chain) {
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
  return w;
}

for (const chain of ["10x", "openspec"]) {
  test(`${chain}: archive returns reply after folder move without recreating run state`, () => {
    const w = archiveFixture(chain);
    const { project: p, action: archive } = w;
    const before = snapshot(p.agentDir);
    const oldHead = git(p, ["rev-parse", "HEAD"]);
    const moved = path.join(p.root, archive.archivePath);
    fs.mkdirSync(path.dirname(moved), { recursive: true });
    for (const field of ["archivePath", "profile", "prompt", "agent"]) {
      const bad = execute(w, { ...archive, [field]: field === "profile" ? "other" : "context/archive/wrong" });
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

  test(`${chain}: archive failure retains native ownership despite a timestamped failed root`, () => {
    const w = archiveFixture(chain);
    setMode(w, { ...failedTurn, code: 1 });
    const before = snapshot(w.project.agentDir);
    const result = execute(w);
    assert.equal(result.status, 1, result.stdout);
    assert.equal(result.json.launched, true);
    assert.equal(result.json.completed, false);
    assert.equal(result.json.result, null);
    assert.match(result.json.reason, unsuccessfulExit);
    assertNativeSuspension(w, result.json.reason);
    assert.deepEqual(metadataCalls(w.fixture), []);
    assert.deepEqual(snapshot(w.project.agentDir), before);
  });

  test(`${chain}: an invalid final archive RESULT retains native ownership`, () => {
    for (const reply of ['RESULT: {"status":"done"}\nmore output', 'RESULT: {"status":"unknown"}']) {
      const w = archiveFixture(chain);
      setMode(w, { reply });
      const result = execute(w);
      assert.equal(result.json.completed, false, result.stdout);
      assert.equal(result.json.launched, true);
      assertNativeSuspension(w, result.json.reason);
    }
  });
}

test("fake child readiness guarantees immediate cancellation can be handled", async (t) => {
  const w = codexFixture("openspec", { mode: { hold: true, holdUntilRelease: true } });
  const bin = path.join(w.fixture, "bin/codex");
  const ready = 'fs.writeFileSync(path.join(fixture, "ready"), String(process.pid));';
  const source = fs.readFileSync(bin, "utf8");
  assert.ok(source.includes(ready));
  // Deliver cancellation at the earliest instant another process can observe readiness.
  fs.writeFileSync(bin, source.replace(ready, ready + '\nprocess.kill(process.pid, "SIGTERM");'));
  const running = startRunner(w);
  const release = path.join(w.fixture, "release");
  t.after(async () => {
    fs.writeFileSync(release, "yes");
    running.child.kill("SIGTERM");
    await running.closed;
  });
  await waitForFile(path.join(w.fixture, "ready"));
  await waitForFile(path.join(w.fixture, "terminating"));
  running.child.kill("SIGTERM");
  fs.writeFileSync(release, "yes");
  const result = await running.closed;
  assert.equal(result.json.exitCode, 0, result.stdout);
  assert.equal(result.json.signal, null, result.stdout);
  assert.equal(runnerLeftovers(w).filter(name => name.endsWith(".lock")).length, 1);
  assert.match(result.json.reason, /Execution suspended:/);
});

test("SIGTERM grace expires while the fake child is held and awaits SIGKILL close", async (t) => {
  const w = codexFixture("10x", { mode: { hold: true, holdUntilRelease: true } });
  const running = startRunner(w, { terminationGraceMs: 750 });
  let childCollected = false;
  t.after(() => {
    if (childCollected) return;
    const model = calls(w.fixture).find(call => call.args[0] === "exec");
    if (model) {
      try { process.kill(model.pid, "SIGKILL"); }
      catch (error) { if (error.code !== "ESRCH") throw error; }
    }
    if (running.child.exitCode === null && running.child.signalCode === null) running.child.kill("SIGKILL");
    return Promise.race([running.closed, setTimeout(2000, null, { ref: false })]);
  });
  const ready = path.join(w.fixture, "ready");
  await waitForFile(ready);
  const pid = Number(fs.readFileSync(ready, "utf8"));
  const args = calls(w.fixture).find(call => call.args[0] === "exec").args;
  const temp = path.dirname(args[args.indexOf("-o") + 1]);
  assert.equal(fs.existsSync(temp), true);
  const start = performance.now();
  assert.equal(running.child.kill("SIGTERM"), true);
  const result = await Promise.race([running.closed, setTimeout(4000, null, { ref: false })]);
  assert.ok(result && performance.now() - start < 4000, "runner must close within the shortened grace deadline");
  assert.throws(() => process.kill(pid, 0), { code: "ESRCH" });
  childCollected = true;
  assert.equal(fs.readFileSync(path.join(w.fixture, "terminating"), "utf8"), "yes");
  assert.equal(result.code, 1, result.stdout + result.stderr);
  assert.equal(result.signal, null);
  assert.equal(result.json.launched, true);
  assert.equal(result.json.completed, false);
  assert.equal(result.json.result, null);
  assert.equal(result.json.exitCode, null);
  assert.equal(result.json.signal, "SIGKILL");
  assert.match(result.json.reason, /Execution cancelled by SIGTERM/);
  assertNativeSuspension(w, result.json.reason);
  assert.equal(fs.existsSync(temp), false);
});

for (const chain of ["10x", "openspec"]) {
  test(`${chain}: recursive paginated metadata accounts for settled archived children once`, () => {
    const w = codexFixture(chain, { mode: {
      pages: {
        false: { first: { data: [{ id: "child-one" }], nextCursor: "page-two" },
          "page-two": { data: [{ id: "child-two" }], nextCursor: null } },
        true: { first: { data: [{ id: "archived-child" }], nextCursor: null } },
      },
    } });
    const result = execute(w);
    assert.equal(result.json.completed, true, result.stdout);
    assert.equal(result.json.usage.totalTokens, 176, "root 110 plus three disjoint child totals of 22");
    assert.equal(result.json.usageEvidence.sessionCount, 4);
    assert.equal(result.json.usageEvidence.requestCount, 4);
    assert.deepEqual(runnerLeftovers(w), []);
    const requests = metadataCalls(w.fixture);
    const turns = requests.filter(r => r.method === "thread/turns/list");
    assert.deepEqual(turns.map(r => r.params.threadId), ["root-fixture", "child-one", "child-two", "archived-child"]);
    for (const r of turns) assert.deepEqual(r.params, { threadId: r.params.threadId, limit: 1, sortDirection: "desc", itemsView: "notLoaded" });
    const lists = requests.filter(r => r.method === "thread/list");
    assert.equal(lists.length, 6, "enumeration is repeated after completion to catch newly spawned descendants");
    for (const r of lists) {
      assert.equal(r.params.ancestorThreadId, "root-fixture");
      assert.equal(r.params.parentThreadId, undefined);
      assert.deepEqual(r.params.sourceKinds, ["cli", "vscode", "exec", "appServer", "subAgent", "subAgentReview", "subAgentCompact", "subAgentThreadSpawn", "subAgentOther", "unknown"]);
    }
  });
  for (const [label, mode] of [
    ["missing parent identity", { noThread: true }],
    ["invalid parent identity", { threadId: "" }],
    ["metadata error", { metadataFailure: true }],
    ["mismatched response", { mismatchedResponse: true }],
    ["unfinished parent", { turns: { "root-fixture": { data: [{ status: "interrupted", completedAt: null }] } } }],
    ["missing timestamp", { turns: { "root-fixture": { data: [{ status: "completed" }] } } }],
    ["failed parent after successful report", { turns: failedTurn.turns }],
    ["malformed enumeration", { pages: { false: { first: { data: [] } } } }],
    ["parent returned as child", { pages: { false: { first: { data: [{ id: "root-fixture" }], nextCursor: null } } } }],
    ["cursor cycle", { pages: { false: { first: { data: [], nextCursor: "first" } } } }],
    ["held child", { pages: { false: { first: { data: [{ id: "held-child" }], nextCursor: null } } },
      turns: { "held-child": { data: [{ status: "interrupted", completedAt: null }] } } }],
    ["archived unfinished child", { pages: { true: { first: { data: [{ id: "held-child" }], nextCursor: null } } },
      turns: { "held-child": { data: [{ status: "inProgress", completedAt: null }] } } }],
  ]) {
    test(`${chain}: ${label} retains native ownership and rejects relaunch`, () => {
      const w = codexFixture(chain, { mode });
      const before = snapshot(w.project.agentDir);
      const result = execute(w);
      assert.equal(result.json.launched, true, result.stdout);
      assert.equal(result.json.completed, false);
      assert.equal(result.json.result, null);
      assert.match(result.json.reason, /^Execution suspended:/);
      assert.match(result.json.reason, /lock file .*\.lock.*settlement.*recovery/);
      assert.equal(runnerLeftovers(w).length, 1, "only the durable lock remains");
      assert.deepEqual(snapshot(w.project.agentDir), before);
      assert.equal(execute(w).json.launched, false);
      assert.deepEqual(snapshot(w.project.agentDir), before);
    });
  }
  test(`${chain}: child report and terminal events cannot replace the enclosing failed result`, () => {
    const reply = 'RESULT: {"status":"failed","note":"child failed; parent reconciled edits"}';
    const w = codexFixture(chain, { mode: { reply, events: [
      { type: "item.completed", item: { type: "collab_tool_call", text: 'RESULT: {"status":"done"}' } },
      { type: "item.completed", item: { type: "agent_message", text: reply } },
      { type: "turn.completed", usage: { input_tokens: 10, output_tokens: 5 } },
      { type: "item.completed", thread_id: "foreign-child", item: { type: "agent_message", text: 'RESULT: {"status":"done"}' } },
      { type: "turn.failed", thread_id: "foreign-child" },
    ] } });
    const result = execute(w);
    assert.equal(result.json.completed, true, result.stdout);
    assert.equal(result.json.result.status, "failed");
    assert.equal(result.json.usage.totalTokens, undefined);
    assert.deepEqual(runnerLeftovers(w), []);
  });
}

for (const chain of ["10x", "openspec"]) {
  for (const [label, mode, reason] of [
    ["optional native metadata error", { usageMetadataFailure: true }, "missing-source"],
    ["optional native metadata timeout", { usageMetadataHang: true }, "resource-limit"],
    ["unsupported host", { hostVersion: "0.170.0" }, "unsupported-host"],
    ["missing source", { noUsageSource: true }, "missing-source"],
  ]) {
    test(`${chain}: ${label} leaves completed execution accepted and releases its lock`, () => {
      const w = codexFixture(chain, { mode });
      const before = snapshot(w.project.agentDir);
      const result = execute(w);
      assert.equal(result.status, 0, result.stdout);
      assert.equal(result.json.completed, true);
      assert.equal(result.json.result.status, "done");
      assert.equal(result.json.usage.totalTokens, undefined);
      assert.equal(result.json.usageEvidence.reason, reason);
      assert.ok(result.json.usage.durationMs >= 0);
      assert.deepEqual(snapshot(w.project.agentDir), before);
      assert.deepEqual(runnerLeftovers(w), []);
      assert.equal(calls(w.fixture).filter(call => call.args[0] === "exec").length, 1);
      const requests = metadataCalls(w.fixture);
      assert.equal(requests.some(request => /resume|turn\/start/.test(request.method)), false);
      assert.equal(run(w.project, ["status", w.project.id, "--report", "--chain", chain], { env: w.env }).status, 0);
    });
  }

  test(`${chain}: malformed execution JSON still suspends even when usage sources are complete`, () => {
    const w = codexFixture(chain, { mode: { malformedJson: true } });
    const result = execute(w);
    assert.equal(result.json.completed, false);
    assert.equal(result.json.result, null);
    assert.match(result.json.reason, /Execution suspended:.*malformed JSONL/);
    assert.equal(runnerLeftovers(w).length, 1);
  });

  test(`${chain}: settled duplicate child enumeration and multi-request usage count once`, () => {
    const w = codexFixture(chain, { mode: {
      pages: { false: { first: { data: [{ id: "child" }, { id: "child" }], nextCursor: null } },
        true: { first: { data: [{ id: "child" }], nextCursor: null } } },
      rolloutUsages: { child: [{ input_tokens: 20, output_tokens: 2 }, { input_tokens: 30, output_tokens: 3 }] },
    } });
    const result = execute(w);
    assert.equal(result.json.completed, true, result.stdout);
    assert.equal(result.json.usage.totalTokens, 165, "root 110 + child 22 + 33");
    assert.equal(result.json.usageEvidence.sessionCount, 2);
    assert.equal(result.json.usageEvidence.requestCount, 3);
    assert.equal(calls(w.fixture).filter(call => call.args[0] === "exec").length, 1);
    assert.deepEqual(runnerLeftovers(w), []);
  });
}

test("Codex rechecks policy, skill, template and advisor after preflight", () => {
  for (const drift of ["policy", "skill", "template", "advisor"]) {
    const w = codexFixture();
    let changeAfterPreflight;
    if (drift === "policy") {
      changeAfterPreflight = { file: path.join(w.project.root, "context/foundation/agent-smith-policy.json"), content: "[]" };
    } else {
      const log = readLogEntries(w.project);
      log.at(-1)[drift] = drift === "advisor" ? true : "changed-" + drift;
      changeAfterPreflight = { file: path.join(w.project.agentDir, "run.jsonl"), content: log.map(e => JSON.stringify(e)).join("\n") + "\n" };
    }
    setMode(w, { changeAfterPreflight });
    const res = execute(w);
    assert.equal(res.json.launched, false, res.stdout);
    assert.match(res.json.reason, drift === "policy" ? /policy keys/ : /changed during preflight/);
    assert.equal(calls(w.fixture).some(c => c.args[0] === "exec"), false);
  }
});

test("Codex discovers the retained executor skill and required OpenSpec CLI inside its sandbox before exec", () => {
  for (const chain of ["10x", "openspec"]) {
    const w = codexFixture(chain);
    const required = chain === "10x" ? "10x-e2e" : "openspec-propose";
    const action = { ...w.action };
    if (chain === "10x") {
      const log = readLogEntries(w.project);
      Object.assign(log.at(-1), { step: "implement", template: "implement-e2e", skill: required });
      writeLog(w.project, log);
      action.step = "implement";
    }
    gitInit(w.project);
    commitFiles(w.project, ["README.md"]);
    fs.writeFileSync(path.join(w.fixture, "SKILL.md"), "# Fixture skill");
    const cli = path.join(w.fixture, "bin/openspec");
    fs.writeFileSync(cli, "#!/bin/sh\necho 2.0.0\n", { mode: 0o755 });
    setMode(w, { checkToolkit: true, discoveredSkill: "wrong" });
    const missing = execute(w, action);
    assert.equal(missing.json.launched, false);
    assert.match(missing.json.reason, new RegExp(required));
    if (chain === "10x") {
      setMode(w, { oversizedDiscovery: true });
      const module = new URL("../scripts/runner-toolkit.mjs", import.meta.url);
      const probe = spawnSync(process.execPath, ["--input-type=module", "-e",
        `import { proveCodexToolkit } from ${JSON.stringify(module.href)}; await proveCodexToolkit({ skill: "10x-e2e" });`],
      { cwd: w.project.root, env: w.env, encoding: "utf8", timeout: 10000 });
      assert.equal(probe.status, 1, probe.error?.message);
      assert.match(probe.stderr, /discovery exceeded its output limit/);
    }
    setMode(w, { checkToolkit: true, discoveredSkill: required });
    if (chain === "openspec") {
      fs.writeFileSync(cli, "#!/bin/sh\necho 1.0.0\n");
      assert.equal(execute(w, action).json.launched, false);
      fs.writeFileSync(cli, "#!/bin/sh\necho 2.0.0\n");
    }
    const ok = execute(w, action);
    assert.equal(ok.json.completed, true, ok.json.reason);
    assert.equal(calls(w.fixture).filter(c => c.args[0] === "exec").length, 1);
  }
});

test("codexChildEnv drops GitHub token variables in any case and keeps the rest", () => {
  const tokens = ["GH_TOKEN", "GITHUB_TOKEN", "GH_ENTERPRISE_TOKEN", "GITHUB_ENTERPRISE_TOKEN"];
  const kept = { PATH: "/bin", GH_HOST: "github.example", OPENAI_API_KEY: "key", CODEX_TEST_KEEP: "1" };
  const input = { ...kept, ...Object.fromEntries([...tokens, ...tokens.map(name => name.toLowerCase())].map(name => [name, "secret"])) };
  const copy = { ...input };
  assert.deepEqual(codexChildEnv(input), kept);
  assert.deepEqual(input, copy, "the input is not mutated");
});

for (const chain of ["10x", "openspec"]) {
  test(`${chain}: probe, exec and metadata server start without GitHub tokens`, () => {
    const tokens = ["GH_TOKEN", "GITHUB_TOKEN", "GH_ENTERPRISE_TOKEN", "GITHUB_ENTERPRISE_TOKEN"];
    const w = codexFixture(chain);
    Object.assign(w.env, Object.fromEntries(tokens.map(name => [name, "secret"])), { CODEX_TEST_KEEP: "kept" });
    const result = execute(w);
    assert.equal(result.json.completed, true, result.stdout + result.stderr);
    const records = calls(w.fixture);
    assert.deepEqual(records.map(call => call.args[0]), ["sandbox", "exec"]);
    const server = JSON.parse(fs.readFileSync(path.join(w.fixture, "server-env.json"), "utf8"));
    for (const seen of [...records.map(call => call.env), server]) {
      for (const name of tokens) assert.equal(Object.hasOwn(seen, name), false, name);
      assert.equal(seen.CODEX_TEST_KEEP, "kept");
    }
  });
}
