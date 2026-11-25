// A router error after attachResult must not lose the step result: run.jsonl holds it before last-result.json goes.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  cleanupAll, makeProject, run, git, gitAvailable, gitEnv, gitInit, init, next, writeResult, writeOverride,
  readLogEntries, planText, entry, skipEntry, writeLog, preUpgradeDispatch
} from "./helpers.mjs";
import { writePlan } from "./ahead.mjs";
import { makeOpenspecProject, writeArtifacts } from "../../openspec-pipeline/test/openspec-helpers.mjs";
import { attachResult } from "../scripts/flow.mjs";
import { boundClaudeFixture, transcriptEnv, transcriptFixture } from "./claude-helpers.mjs";

after(cleanupAll);

const GOAL = "Add a retry counter to the status output so the report shows how often each step ran again";
const BROKEN = { rigor: { levels: null } };
const skip = !gitAvailable() && "git is not available";

test("a router error after the result is read keeps the result in run.jsonl, and the next call routes on", () => {
  const project = makeProject();
  assert.equal(init(project, GOAL).status, 0);
  writePlan(project, planText({ phases: 1, rowsPerPhase: 1 }));
  preUpgradeDispatch(project);
  writeResult(project, { status: "done", note: "wrote plan", usage: { totalTokens: 1234 } });
  writeOverride(project, BROKEN);

  const broken = next(project);
  assert.notEqual(broken.status, 0);
  assert.match(broken.stdout, /Router error/);
  assert.equal(fs.existsSync(path.join(project.agentDir, "last-result.json")), false);
  const [first] = readLogEntries(project);
  assert.equal(first.result.status, "done");
  assert.equal(first.usage.totalTokens, 1234);
  assert.equal(first.ok, true);

  writeOverride(project, {});
  const again = next(project);
  assert.equal(again.status, 0, again.stdout);
  assert.equal(again.json.action, "run");
  assert.doesNotMatch(again.stdout, /has no result/);
  const entries = readLogEntries(project);
  assert.equal(entries.length, 2);
  assert.deepEqual(entries[0].result, first.result);
  assert.equal(entries[1].result, undefined);
});

test("the same in an isolated run with a failed advisory score entry", { skip }, () => {
  const main = makeProject({ policy: { isolation: { require: true }, score: { minRigor: "standard" } } });
  gitInit(main);
  git(main, ["add", "-A"]);
  git(main, ["commit", "-q", "-m", "chore: project"]);
  const top = path.join(main.base, ".claude/worktrees", `agent-smith-${main.id}`);
  git(main, ["worktree", "add", "-q", "-b", `agent-smith/${main.id}`, top]);
  const changeDir = path.join(top, "context/changes", main.id);
  const wt = {
    id: main.id, base: main.base, top, root: top, changeDir,
    agentDir: path.join(changeDir, "agent-smith"), planFile: path.join(changeDir, "plan.md"),
  };
  const env = gitEnv(wt);
  const nextIn = () => run(wt, ["next", wt.id], { env });
  const policy = { isolation: { require: true }, score: { minRigor: "standard" } };

  const started = run(wt, ["init", wt.id, "--goal", GOAL, "--rigor", "standard"], { env });
  assert.equal(started.status, 0, started.stdout + started.stderr);
  assert.equal(readLogEntries(wt)[0].step, "score");
  preUpgradeDispatch(wt);
  writeResult(wt, { status: "done", note: "scored", usage: { totalTokens: 55 } });
  writeOverride(wt, { ...policy, ...BROKEN });

  const broken = nextIn();
  assert.notEqual(broken.status, 0);
  assert.match(broken.stdout, /Router error/);
  assert.equal(fs.existsSync(path.join(wt.agentDir, "last-result.json")), false);
  const [first] = readLogEntries(wt);
  assert.equal(first.result.status, "done");
  assert.equal(first.usage.totalTokens, 55);
  assert.equal(first.ok, false);
  const tracked = git(wt, ["-C", top, "ls-files"]);
  assert.doesNotMatch(tracked, /last-result\.json/);

  writeOverride(wt, policy);
  const again = nextIn();
  assert.equal(again.status, 0, again.stdout);
  assert.doesNotMatch(again.stdout, /has no result/);
  assert.equal(again.json.action, "run");
  assert.deepEqual(readLogEntries(wt)[0].result, first.result);
});

const resultPath = p => path.join(p.agentDir, "last-result.json");
const executedEntries = p => readLogEntries(p).filter(e => !e.skipped);

function projectFor(chain, policy = {}) {
  return chain === "10x" ? makeProject({ policy }) : makeOpenspecProject({ policy });
}

function start(p, chain, { env = {}, flags = [] } = {}) {
  const res = run(p, ["init", p.id, "--goal", GOAL, "--chain", chain, ...flags], { env: { ...gitEnv(p), ...env } });
  assert.equal(res.status, 0, res.stdout + res.stderr);
  assert.equal(res.json.action, "run");
  return res.json;
}

function output(p, chain) {
  if (chain === "10x") writePlan(p, planText());
  else writeArtifacts(p, { proposal: true, specs: 1, tasks: { open: 1 } });
}

// Patch the child process only, after the real atomic publication has succeeded.
function fault(p, source, env = {}, flags = []) {
  const hook = path.join(p.base, "result-fault.mjs");
  fs.writeFileSync(hook, 'import fs from "node:fs";\n' + source);
  return run(p, ["next", p.id, ...flags], { env: { ...gitEnv(p), ...env, NODE_OPTIONS: "--import=" + hook } });
}

function crash(p, env, flags) {
  const res = fault(p, `
const rename = fs.renameSync;
fs.renameSync = (from, to) => {
  const value = rename(from, to);
  if (String(to) === ${JSON.stringify(path.join(p.agentDir, "run.jsonl"))}) process.exit(86);
  return value;
};`, env, flags);
  assert.equal(res.status, 86, res.stdout + res.stderr);
  assert.equal(executedEntries(p).length, 1);
  assert.ok(executedEntries(p)[0].result);
  assert.equal(fs.existsSync(resultPath(p)), true);
  return executedEntries(p)[0];
}

function denyUnlink(p) {
  return fault(p, `
const unlink = fs.unlinkSync;
fs.unlinkSync = file => {
  if (String(file) === ${JSON.stringify(resultPath(p))}) {
    const error = new Error("injected result unlink denied");
    error.code = "EACCES";
    throw error;
  }
  return unlink(file);
};`);
}

for (const chain of ["10x", "openspec"]) {
  for (const byFile of [false, true]) {
    test(`${chain}: post-publication crash recovers ${byFile ? "file" : "inline"} result ownership`, () => {
      const p = projectFor(chain, { prompts: { byFile } });
      start(p, chain, { flags: ["--provider-mode", "codex"] });
      output(p, chain);
      writeResult(p, { status: "done", note: "only step one", signals: { rigor: "standard", ignored: true },
        usage: { totalTokens: 42 } });
      const completed = crash(p);
      // Recovery must use persisted verification even after artifacts and leftover bytes change.
      if (chain === "10x") fs.writeFileSync(p.planFile, planText());
      fs.writeFileSync(resultPath(p), "{malformed leftover");
      const recovered = next(p);
      assert.equal(recovered.json.action, "run", recovered.stdout);
      assert.equal(recovered.json.n, 2);
      assert.equal(fs.existsSync(resultPath(p)), false);
      const first = executedEntries(p)[0];
      const expected = { ...completed };
      delete expected.pendingHandoff;
      assert.deepEqual(first, expected);
      assert.equal(first.result.note, "only step one");
      assert.deepEqual(first.signals, { rigor: "standard" });
      assert.equal(first.usage.totalTokens, 42);
      const missing = next(p);
      assert.equal(missing.status, 1, missing.stdout);
      assert.match(missing.json.reason, /Step 2 .* has no result/);
      assert.equal(executedEntries(p)[1].result, undefined);
      writeResult(p, { status: "failed", note: "only step two", usage: { totalTokens: 7 } });
      next(p);
      assert.equal(executedEntries(p)[1].result.note, "only step two");
      assert.equal(executedEntries(p)[1].usage.totalTokens, 7);
      assert.deepEqual(executedEntries(p)[0], first);
    });
  }

  for (const recovery of [false, true]) {
    test(`${chain}: unlink denial stops ${recovery ? "recovery" : "fresh intake"} before dispatch`, () => {
      const p = projectFor(chain);
      start(p, chain);
      output(p, chain);
      writeResult(p, { status: "done", note: "durable" });
      const completed = recovery ? crash(p) : null;
      const refused = denyUnlink(p);
      assert.equal(refused.json.action, "halt", refused.stdout);
      assert.match(refused.json.reason, /injected result unlink denied/);
      assert.equal(executedEntries(p).length, 1);
      const first = executedEntries(p)[0];
      assert.equal(first.result.note, "durable");
      if (completed) assert.deepEqual(first, completed);
      assert.equal(fs.existsSync(resultPath(p)), true);
      assert.equal(next(p).json.n, 2);
      assert.equal(fs.existsSync(resultPath(p)), false);
      assert.deepEqual(executedEntries(p)[0], first);
    });
  }

  test(`${chain}: absent leftover recovers idempotently and terminal routing cleans leftovers`, () => {
    const p = projectFor(chain);
    start(p, chain);
    output(p, chain);
    writeResult(p, { status: "done", signals: { needsHuman: "inspect output" } });
    const first = crash(p);
    fs.unlinkSync(resultPath(p));
    const stopped = next(p);
    assert.equal(stopped.json.action, "halt", stopped.stdout);
    assert.equal(executedEntries(p)[0].finishedAt, first.finishedAt);
    writeResult(p, { status: "orchestrator-error", note: "stale" });
    // A repeated human halt is terminal without dispatch when its acknowledgement is reset in a fixture.
    writeLog(p, [first]);
    assert.equal(next(p).json.action, "halt");
    assert.equal(fs.existsSync(resultPath(p)), false);
    assert.equal(executedEntries(p).length, 1);
  });
}

test("result owner boundaries ignore skip rows and preserve unowned and pending input", () => {
  const p = makeProject();
  const paths = { result: resultPath(p), log: path.join(p.agentDir, "run.jsonl") };
  writeResult(p, { status: "done", note: "untouched" });
  const bytes = fs.readFileSync(paths.result);
  for (const log of [[], [skipEntry("score", 0)]]) {
    attachResult(paths, log, {});
    assert.deepEqual(fs.readFileSync(paths.result), bytes);
  }
  const completed = entry(1, "plan");
  const log = [completed, skipEntry("research", 1)];
  attachResult(paths, log, {});
  assert.equal(fs.existsSync(paths.result), false);
  attachResult(paths, log, {});
  assert.deepEqual(log[0], entry(1, "plan"));
  const pending = entry(2, "fix", { result: undefined });
  writeResult(p, { status: "done", note: "pending owner" });
  attachResult({ ...paths, plan: path.join(p.changeDir, "plan.md") }, [completed, pending], {});
  assert.equal(pending.result.note, "pending owner");
  assert.deepEqual(completed, entry(1, "plan"));
});

// Recovery must finish before isolated Git writes, even with staged partial work.
function isolatedProject(chain) {
  const main = projectFor(chain, { isolation: { require: true } });
  gitInit(main);
  git(main, ["add", "--", "context", ...(chain === "openspec" ? ["openspec"] : [])]);
  git(main, ["commit", "-qm", "test: project"]);
  const root = path.join(main.base, ".claude/worktrees", "agent-smith-" + main.id);
  git(main, ["worktree", "add", "-qb", "agent-smith/" + main.id, root]);
  const changeDir = path.join(root, path.relative(main.root, main.changeDir));
  return { ...main, root, changeDir, agentDir: path.join(changeDir, "agent-smith"),
    planFile: chain === "10x" ? path.join(changeDir, "plan.md") : null };
}

for (const chain of ["10x", "openspec"]) {
  for (const failed of [false, true]) {
    test(`${chain}: isolated interrupted ${failed ? "failure snapshot" : "success commit"} excludes consumed result`, { skip }, () => {
      const p = isolatedProject(chain);
      start(p, chain);
      const gw = args => git(p, ["-C", p.root, ...args]);
      const head = gw(["rev-parse", "HEAD"]);
      output(p, chain);
      fs.writeFileSync(path.join(p.root, "partial.txt"), "step output\n");
      if (failed) gw(["add", "--", "partial.txt"]);
      const index = gw(["write-tree"]);
      writeResult(p, { status: failed ? "failed" : "done", note: "interrupted isolated result" });
      const completed = crash(p);
      assert.equal(completed.ok, !failed);
      const refused = denyUnlink(p);
      assert.equal(refused.json.action, "halt", refused.stdout);
      assert.match(refused.json.reason, /injected result unlink denied/);
      assert.equal(gw(["rev-parse", "HEAD"]), head);
      assert.equal(gw(["write-tree"]), index);
      assert.equal(gw(["for-each-ref", "refs/agent-smith/"]), "");
      assert.deepEqual(executedEntries(p), [completed]);
      assert.equal(nextIn(p).json.action, "run");
      const first = executedEntries(p)[0];
      const revision = failed ? first.rolledBack : first.commit;
      assert.ok(revision);
      assert.equal(gw(["show", revision + ":partial.txt"]), "step output");
      assert.doesNotMatch(gw(["ls-tree", "-r", "--name-only", revision]), /last-result\.json/);
      assert.doesNotMatch(gw(["ls-files"]), /last-result\.json/);
      assert.equal(fs.existsSync(resultPath(p)), false);
      assert.deepEqual(first.result, completed.result);
      assert.equal(first.finishedAt, completed.finishedAt);
      assert.equal(gw(["rev-parse", "HEAD"]), failed ? head : revision);
      const missing = nextIn(p);
      assert.equal(missing.status, 1);
      assert.match(missing.json.reason, /Step 2 .* has no result/);
    });
  }

  test(chain + ": isolated fresh unlink failure preserves HEAD, index and dispatch", { skip }, () => {
    const p = isolatedProject(chain);
    start(p, chain);
    output(p, chain);
    const gw = args => git(p, ["-C", p.root, ...args]);
    const head = gw(["rev-parse", "HEAD"]);
    const index = gw(["write-tree"]);
    writeResult(p, { status: "done" });
    const refused = denyUnlink(p);
    assert.equal(refused.json.action, "halt", refused.stdout);
    assert.match(refused.json.reason, /injected result unlink denied/);
    assert.equal(gw(["rev-parse", "HEAD"]), head);
    assert.equal(gw(["write-tree"]), index);
    assert.equal(executedEntries(p).length, 1);
    assert.equal(executedEntries(p)[0].ok, true);
    assert.equal(executedEntries(p)[0].commit, undefined);
    assert.equal(nextIn(p).json.n, 2);
    assert.equal(fs.existsSync(resultPath(p)), false);
  });

  test(chain + ": pending neutral retry after completion retains its original dispatch", () => {
    const p = projectFor(chain);
    start(p, chain);
    output(p, chain);
    writeResult(p, { status: "done", note: "first owner" });
    const dispatched = next(p).json;
    assert.equal(dispatched.n, 2);
    const before = executedEntries(p);
    writeResult(p, { status: "orchestrator-error", note: "dispatch failed" });
    const retry = next(p).json;
    assert.deepEqual(retry, { ...dispatched, neutralRetry: { count: 1, cap: 2 } });
    const after = executedEntries(p);
    assert.deepEqual(after[0], before[0]);
    const pending = { ...after[1] };
    assert.equal(pending.neutralRetries.length, 1);
    assert.equal(pending.neutralRetries[0].note, "dispatch failed");
    delete pending.neutralRetries;
    assert.deepEqual(pending, before[1]);
    assert.equal(fs.existsSync(resultPath(p)), false);
    writeResult(p, { status: "failed", note: "real second owner" });
    next(p);
    assert.equal(executedEntries(p)[1].result.note, "real second owner");
    assert.equal(executedEntries(p)[1].neutralRetries.length, 1);
  });

  for (const interrupted of [false, true]) {
    test(`${chain}: late usage preserves ${interrupted ? "interrupted completion" : "later pending result"} ownership`, () => {
      const p = projectFor(chain);
      start(p, chain, { flags: ["--provider-mode", "codex"] });
      output(p, chain);
      writeResult(p, { status: "done", note: "first without usage" });
      if (interrupted) crash(p);
      else {
        assert.equal(next(p).json.n, 2);
        writeResult(p, { status: "failed", note: "later owner", signals: { rigor: "standard" },
          usage: { totalTokens: 7 } });
      }
      const bytes = fs.readFileSync(resultPath(p));
      for (const [tokens, status, unchanged] of [["42", 0, false], ["42", 0, true], ["43", 1, undefined]]) {
        const result = run(p, ["usage", p.id, "1", "--tokens", tokens]);
        assert.equal(result.status, status, result.stdout);
        if (status === 0) assert.equal(result.json.unchanged, unchanged);
        assert.deepEqual(fs.readFileSync(resultPath(p)), bytes);
        assert.deepEqual(executedEntries(p)[0].usage, { totalTokens: 42 });
        assert.equal(executedEntries(p)[0].usageLate, true);
      }
      const first = executedEntries(p)[0];
      const resumed = next(p);
      assert.equal(resumed.json.action, "run", resumed.stdout);
      assert.equal(fs.existsSync(resultPath(p)), false);
      assert.deepEqual(executedEntries(p)[0], first);
      if (interrupted) {
        assert.equal(resumed.json.n, 2);
        assert.match(next(p).json.reason, /Step 2 .* has no result/);
        assert.equal(executedEntries(p)[1].result, undefined);
      } else {
        const second = executedEntries(p)[1];
        assert.equal(second.result.note, "later owner");
        assert.deepEqual(second.usage, { totalTokens: 7 });
        assert.deepEqual(second.signals, { rigor: "standard" });
      }
    });
  }
}

function nextIn(p) {
  return run(p, ["next", p.id], { env: gitEnv(p) });
}

for (const chain of ["10x", "openspec"]) {
  test(`${chain}: intake sanitizes reserved accounting in both result and entry without changing result acceptance`, () => {
    const p = projectFor(chain);
    start(p, chain, { flags: ["--provider-mode", "codex"] });
    output(p, chain);
    const evidence = { schemaVersion: 1, status: "verified", scope: "step-tree", source: "codex-rollout", hostVersion: "0.169.0",
      invocation: { host: "codex", rootThreadId: "root", rootTurnId: "turn" },
      sessionCount: 1, requestCount: 2, reconciliation: "response-snapshot" };
    writeResult(p, { status: "done", note: "valid artifacts", unrelated: { kept: true },
      usage: { totalTokens: 42, toolUses: 2, durationMs: 3, raw: "private-source" },
      usageEvidence: { ...evidence, raw: "private-source", path: "/private/transcript" } });
    const result = next(p);
    assert.equal(result.status, 0, result.stdout);
    const first = executedEntries(p)[0];
    assert.equal(first.ok, true);
    assert.deepEqual(first.usageEvidence, evidence);
    assert.deepEqual(first.result.usageEvidence, evidence);
    assert.deepEqual(first.result.usage, { totalTokens: 42, toolUses: 2, durationMs: 3 });
    assert.deepEqual(first.result.unrelated, { kept: true });
    assert.doesNotMatch(JSON.stringify(first), /private-source|private\/transcript/);
  });

  test(`${chain}: invalid accounting remains unavailable after post-publication crash and single intake recovery`, () => {
    const p = projectFor(chain);
    start(p, chain, { flags: ["--provider-mode", "codex"] });
    output(p, chain);
    writeResult(p, { status: "done", note: "complete with invalid accounting", extra: "preserved",
      usage: { totalTokens: 7, toolUses: 2, durationMs: 3 },
      usageEvidence: { schemaVersion: 99, raw: "/private/source" } });
    const completed = crash(p);
    assert.equal(completed.ok, true);
    assert.deepEqual(completed.usage, { toolUses: 2, durationMs: 3 });
    assert.equal(completed.usageEvidence.reason, "invalid-evidence");
    assert.equal(completed.result.extra, "preserved");
    assert.deepEqual(completed.result.usageEvidence, completed.usageEvidence);
    assert.equal(next(p).json.n, 2);
    assert.deepEqual(executedEntries(p)[0], completed);
    assert.doesNotMatch(JSON.stringify(completed), /private\/source/);
  });
}

const forged = {
  status: "done", note: "settled", extra: "kept", agentId: "step-agent", sessionId: "native-session", runId: "tool-root",
  invocation: { host: "claude", sessionId: "native-session", agentId: "step-agent", runId: "tool-root" },
  usage: { totalTokens: 999, durationMs: 888, toolUses: 777 }, source: "forged-source", sources: { root: "/private/forged" },
  usageEvidence: { status: "verified" }, signals: { ignored: true },
};

function nativeDispatch(chain) {
  const project = projectFor(chain);
  const env = transcriptEnv(project);
  const action = start(project, chain, { env });
  const row = executedEntries(project)[0];
  assert.deepEqual(row.pendingCapture, { sessionId: env.CLAUDE_CODE_SESSION_ID });
  const capture = transcriptFixture({ project, chain, step: action.step, n: action.n, startedAt: row.startedAt });
  output(project, chain);
  return { project, env, capture };
}

for (const chain of ["10x", "openspec"]) {
  test(chain + ": the native launch ID measures the settled tree once and survives publication recovery", () => {
    const { project, env, capture } = nativeDispatch(chain);
    if (chain === "openspec") {
      capture.main[1].toolUseResult = { status: "async_launched", isAsync: true, agentId: "step-agent", totalTokens: 70 };
    } else Object.assign(capture.main[1].toolUseResult, { totalToolUseCount: 4, totalDurationMs: 50 });
    capture.write();
    writeResult(project, forged);
    const flags = chain === "openspec" ? ["--agent-id=step-agent", "--chain", chain] : ["--agent-id", "step-agent"];
    const accepted = crash(project, env, flags);
    assert.equal(accepted.ok, true);
    assert.equal(accepted.pendingCapture, undefined);
    assert.deepEqual(accepted.usage, { totalTokens: 151, ...(chain === "10x" ? { durationMs: 50, toolUses: 4 } : {}) });
    const evidence = accepted.usageEvidence;
    assert.equal(evidence.sessionCount, 2);
    assert.equal(evidence.requestCount, 4);
    assert.equal(evidence.status, "transcript");
    assert.equal(evidence.hostVersion, "2.1.311");
    assert.deepEqual(evidence.invocation, forged.invocation);
    assert.deepEqual(accepted.result, { status: "done", note: "settled", extra: "kept", usage: accepted.usage, usageEvidence: evidence });
    fs.unlinkSync(capture.mainFile);
    const recovered = run(project, ["next", project.id, ...flags], { env });
    assert.equal(recovered.json.n, 2, recovered.stdout);
    assert.deepEqual(executedEntries(project)[0], accepted);
    const status = run(project, ["status", project.id, "--report"]);
    assert.equal(status.json.tokens.total, 151);
    assert.equal(status.json.usageCoverage.transcript, 1);
    assert.match(fs.readFileSync(path.join(project.agentDir, "report.md"), "utf8"), /can undercount/);
  });
}

for (const [name, flags, reason] of [
  ["missing ID", [], "missing-identity"],
  ["bare ID", ["--agent-id"], "missing-identity"],
  ["path-like ID", ["--agent-id=../step-agent"], "missing-identity"],
  ["child ID", ["--agent-id=leaf-agent"], "missing-identity"],
  ["other description", ["--agent-id=step-agent"], "missing-identity"],
  ["missing source", ["--agent-id=unrecorded"], "missing-source"],
  ["changed session", ["--agent-id=step-agent"], "missing-identity"],
  ["old launch", ["--agent-id=step-agent"], "missing-identity"],
  ["missing launch", ["--agent-id=step-agent"], "incomplete-capture"],
  ["unfinished root", ["--agent-id=step-agent"], "incomplete-capture"],
  ["conflicting version", ["--agent-id=step-agent"], "version-conflict"],
]) {
  test("native intake keeps the verdict with " + name, () => {
    const { project, env, capture } = nativeDispatch("10x");
    if (name === "changed session") env.CLAUDE_CODE_SESSION_ID = "session-B";
    if (name === "other description") capture.metadata.get("step-agent").description += " elsewhere";
    if (name === "unfinished root") {
      capture.metadata.get("step-agent").finished = false;
      Object.assign(capture.main[1].toolUseResult, { totalToolUseCount: 0, totalDurationMs: 5 });
    }
    if (name === "conflicting version") capture.records.get("leaf-agent")[0].version = "2.1.312";
    if (name === "missing launch") capture.main.shift();
    capture.write();
    if (name === "old launch") {
      writeResult(project, { status: "orchestrator-error", note: "retry after settlement" });
      assert.equal(run(project, ["next", project.id], { env }).json.neutralRetry.count, 1);
    }
    writeResult(project, forged);
    const result = run(project, ["next", project.id, ...flags], { env });
    assert.equal(result.status, 0, result.stdout);
    const row = executedEntries(project)[0];
    assert.equal(row.ok, true);
    assert.equal(row.usageEvidence.reason, reason);
    assert.deepEqual(row.result.usageEvidence, row.usageEvidence);
    assert.equal(row.result.agentId, undefined);
    assert.equal(row.result.invocation, undefined);
    assert.equal(row.result.usage?.totalTokens, undefined);
    assert.equal(row.usageEvidence.source, "claude-transcript");
    if (name === "unfinished root") {
      assert.equal(row.usageEvidence.hostVersion, "2.1.311");
      assert.deepEqual(row.usage, { toolUses: 0, durationMs: 5 });
    } else {
      assert.equal(row.usage, undefined);
      assert.equal(row.usageEvidence.hostVersion, "unknown");
    }
    if (name === "unfinished root" || name === "conflicting version") assert.deepEqual(row.usageEvidence.invocation, forged.invocation);
    else assert.equal(row.usageEvidence.invocation, undefined);
  });
}

test("pre-upgrade native intake flags absent evidence and preserves independently observed counters", () => {
  const p = projectFor("10x");
  start(p, "10x");
  preUpgradeDispatch(p);
  output(p, "10x");
  writeResult(p, { status: "done", usage: { durationMs: 0 } });
  const resumed = run(p, ["init", p.id, "--goal", GOAL]);
  assert.equal(resumed.json.n, 2, resumed.stdout);
  const row = executedEntries(p)[0];
  assert.deepEqual(row.usage, { durationMs: 0 });
  assert.equal(row.usageEvidence.reason, "missing-identity");
});

test("telemetry intake needs a unique launch after the saved checkpoint and cross-checks the supplied ID", () => {
  for (const cause of ["competing launch", "wrong ID", "missing checkpoint"]) {
    const p = makeProject({ policy: { claudeCapture: { mode: "telemetry", require: false } } });
    const capture = boundClaudeFixture({ project: p });
    const env = { ...capture.env, AGENT_SMITH_CLAUDE_SESSION: "" };
    start(p, "10x", { env: cause === "missing checkpoint" ? { ...env, AGENT_SMITH_CLAUDE_CAPTURE: "" } : env });
    if (cause === "competing launch") capture.native.push({ ...capture.native[0], tool_use_id: "tool-competing" });
    capture.write();
    output(p, "10x");
    writeResult(p, forged);
    const id = cause === "wrong ID" ? "unrelated" : "step-agent";
    assert.equal(run(p, ["next", p.id, "--agent-id", id], { env }).json.action, "run");
    const row = executedEntries(p)[0];
    assert.equal(row.ok, true);
    assert.equal(row.usage, undefined);
    assert.equal(row.usageEvidence.source, "claude-native");
    assert.equal(row.usageEvidence.invocation, undefined);
    assert.equal(row.usageEvidence.reason, cause === "competing launch" ? "ambiguous-history" : "missing-identity");
  }
});
