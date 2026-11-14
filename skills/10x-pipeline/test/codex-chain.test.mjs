// Real router and Git recovery through the fake Codex process. Native Claude dispatch remains live acceptance.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  cleanupAll, makeProject, run, git, gitInit, writeOverride, writeResult,
  readLogEntries, readMetaFile, readReportFile, planText,
} from "./helpers.mjs";
import { writePlan, writeReview } from "./ahead.mjs";
import { makeOpenspecProject, writeArtifacts } from "../../openspec-pipeline/test/openspec-helpers.mjs";
import { codexFixture, execute, calls, setMode, runnerLeftovers } from "./codex-helpers.mjs";

after(cleanupAll);
const PRESET = JSON.parse(fs.readFileSync(new URL("../codex-policy.json", import.meta.url), "utf8"));
const DEFAULT = JSON.parse(fs.readFileSync(new URL("../policy.json", import.meta.url), "utf8"));
const PASS = "Verdict: PASS\nCritical: 0\nWarnings: 0\n\n## Critical\n\n## Warnings\n";
const DONE = 'RESULT: {"status":"done","note":"matrix fixture"}';
const changePrefix = (chain) => chain === "openspec" ? "openspec/changes/demo" : "context/changes/demo";
const gw = (project, args) => git(project, ["-C", project.root, ...args]);

function projectFor(chain, policy, isolated = false) {
  const main = chain === "openspec" ? makeOpenspecProject({ policy }) : makeProject({ policy });
  if (chain === "10x") fs.writeFileSync(path.join(main.changeDir, "change.md"), "---\nchange_id: demo\nstatus: planned\ncreated: 2026-01-01\n---\n");
  gitInit(main);
  git(main, ["add", "--", "context", ...(chain === "openspec" ? ["openspec"] : [])]);
  git(main, ["commit", "-m", "chore: initialize matrix fixture"]);
  if (!isolated) return main;
  const root = path.join(main.base, ".claude/worktrees/agent-smith-demo");
  git(main, ["worktree", "add", "-b", "agent-smith/demo", root]);
  const changeDir = path.join(root, changePrefix(chain));
  return { ...main, root, changeDir, agentDir: path.join(changeDir, "agent-smith"), planFile: chain === "10x" ? path.join(changeDir, "plan.md") : null };
}

function artifacts(w) {
  const p = w.project;
  const step = w.action.step;
  let commitPaths;
  if (step === "plan") writePlan(p, planText({ files: ["**File**: `feature.mjs`"] }));
  else if (step === "plan-review") writeReview(p, "plan-review", { verdict: "SOUND" });
  else if (step === "os-propose") writeArtifacts(p, { proposal: true, design: true, specs: 1, tasks: { open: 1 } });
  else if (["implement", "os-apply"].includes(step)) {
    fs.writeFileSync(path.join(p.root, "feature.mjs"), "export const ready = true;\n");
    commitPaths = ["feature.mjs"];
    if (w.chain === "10x") writePlan(p, planText({ done: 1, files: ["**File**: `feature.mjs`"] }));
    else writeArtifacts(p, { tasks: { done: 1 } });
  } else if (step === "impl-review") {
    writeReview(p, "impl-review", { verdict: "APPROVED" });
    fs.writeFileSync(path.join(p.changeDir, "change.md"), "---\nchange_id: demo\nstatus: impl_reviewed\ncreated: 2026-01-01\n---\n");
  } else if (step === "os-verify") writeArtifacts(p, { verify: PASS });
  else assert.fail(`Unexpected matrix step ${step}`);
  return commitPaths;
}

function finishStep(w) {
  const commitPaths = artifacts(w);
  if (w.action.provider === "openai") {
    setMode(w, { reply: DONE, commitPaths, commitMessage: "feat(demo): complete fixture implementation" });
    const result = execute(w);
    assert.equal(result.json.completed, true, result.stdout + result.stderr);
    assert.equal(result.json.result.usage.totalTokens, 110);
    assert.equal(Object.hasOwn(result.json.result.usage, "toolUses"), false);
    if (commitPaths) assert.equal(gw(w.project, ["log", "-1", "--format=%s"]), "feat(demo): complete fixture implementation");
    writeResult(w.project, result.json.result);
  } else {
    // This is an artifact/result fixture for native dispatch, with no assertion that Agent was called.
    if (commitPaths) {
      gw(w.project, ["add", "--", ...commitPaths]);
      gw(w.project, ["commit", "-m", "feat(demo): complete native fixture", "-m", "Co-Authored-By: Codex <noreply@openai.com>"]);
    }
    writeResult(w.project, { status: "done", note: "native result fixture", usage: { totalTokens: 13 } });
  }
  const next = run(w.project, ["next", "demo", "--chain", w.chain], { env: w.env });
  assert.equal(next.status, 0, next.stdout + next.stderr);
  w.action = next.json;
}

function finishRun(w) {
  for (let remaining = 12; w.action.action === "run" && remaining > 0; remaining--) finishStep(w);
  assert.equal(w.action.action, "done", JSON.stringify(w.action));
  const status = run(w.project, ["status", "demo", "--report", "--chain", w.chain], { env: w.env });
  assert.equal(status.status, 0, status.stdout);
  assert.ok(status.json.steps.filter((step) => !step.skipped).every((step) => ["claude", "openai"].includes(step.provider)));
  assert.match(readReportFile(w.project), /openai/);
  const compared = run(w.project, ["compare", "demo", "--chain", w.chain, "--baseline", w.project.root, "--routed", w.project.root, "--unpinned"], { env: w.env });
  assert.equal(compared.json.comparable, true, compared.stdout);
  assert.ok(Object.keys(compared.json.routed.tokens.byProviderModel).some((key) => key.startsWith("openai/")));
  assert.deepEqual(runnerLeftovers(w), []);
  return compared.json;
}

for (const chain of ["10x", "openspec"]) {
  test(`${chain}: a failed OpenAI result rolls back before the higher-tier retry`, () => {
    const policy = { ...PRESET, isolation: { require: true } };
    const project = projectFor(chain, policy, true);
    const w = codexFixture(chain, { project, policy });
    const first = w.action;
    const firstTier = readLogEntries(project).at(-1).tier;
    fs.writeFileSync(path.join(project.root, "partial-gpt.mjs"), "incomplete GPT fixture\n");
    setMode(w, { reply: 'RESULT: {"status":"failed","note":"model failure fixture"}' });
    const result = execute(w);
    assert.equal(result.json.completed, true, result.stdout);
    assert.equal(result.json.result.status, "failed");
    writeResult(project, result.json.result);
    const retry = run(project, ["next", "demo", "--chain", chain], { env: w.env });
    assert.equal(retry.json.action, "run", retry.stdout);
    assert.equal(retry.json.step, first.step);
    assert.equal(retry.json.provider, "openai");
    assert.ok(readLogEntries(project).at(-1).tier > firstTier);
    const failed = readLogEntries(project).find((entry) => entry.n === first.n);
    assert.equal(failed.usage.totalTokens, 110);
    assert.match(failed.rolledBack, /^refs\/agent-smith\/demo\//);
    assert.equal(gw(project, ["show", `${failed.rolledBack}:partial-gpt.mjs`]), "incomplete GPT fixture");
    assert.equal(fs.existsSync(path.join(project.root, "partial-gpt.mjs")), false);
    w.action = retry.json;
    finishRun(w);
  });

  test(`${chain}: OpenAI runner results drive completion, report, comparison and guarded archive`, () => {
    const policy = { ...PRESET, codex: { profile: null } };
    const project = projectFor(chain, policy);
    const w = codexFixture(chain, { project, policy, mode: { reply: DONE } });
    assert.equal(w.action.provider, "openai");
    finishRun(w);
    assert.ok(readLogEntries(project).filter((entry) => !entry.skipped).every((entry) => entry.ok && entry.provider === "openai"));
    const ended = run(project, ["init", "demo", "--chain", chain, "--archive"], { env: w.env });
    assert.equal(ended.json.action, "archive", ended.stdout);
    w.action = ended.json;
    const denied = execute(w, { ...w.action, archivePath: "context/archive/wrong" });
    assert.equal(denied.json.launched, false);
    const moved = path.join(project.root, w.action.archivePath);
    fs.mkdirSync(path.dirname(moved), { recursive: true });
    if (chain === "10x") fs.writeFileSync(path.join(project.changeDir, "change.md"), "---\nchange_id: demo\nstatus: archived\ncreated: 2026-01-01\narchived_at: 2026-11-14\n---\n");
    setMode(w, { reply: DONE, moveFrom: project.changeDir, moveTo: moved,
      commitPaths: [changePrefix(chain), w.action.archivePath], commitMessage: "chore(archive): close demo" });
    const archived = execute(w);
    assert.equal(archived.json.completed, true, archived.stdout);
    assert.equal(fs.existsSync(project.changeDir), false);
    assert.equal(gw(project, ["log", "-1", "--format=%s"]), "chore(archive): close demo");
    const verified = run(project, ["verify-archive", "demo", "--chain", chain, "--path", w.action.archivePath], { env: w.env });
    assert.equal(verified.json.archived, true, verified.stdout);
    assert.equal(execute(w).json.launched, false);
    assert.deepEqual(runnerLeftovers(w), []);
  });

  test(`${chain}: isolated mixed escalation preserves rollback and exact GPT neutral retry`, () => {
    const cutoff = chain === "10x" ? 3 : 4;
    const ladder = DEFAULT.ladder.map((rung, i) => i < cutoff ? { ...rung, provider: "claude" } : PRESET.ladder[i]);
    const policy = { ladder, codex: { profile: null }, isolation: { require: true } };
    const project = projectFor(chain, policy, true);
    const w = codexFixture(chain, { project, policy, host: "claude", mode: { reply: DONE } });
    const implementation = chain === "10x" ? "implement" : "os-apply";
    for (let remaining = 6; w.action.step !== implementation && remaining > 0; remaining--) finishStep(w);
    assert.equal(w.action.step, implementation);
    assert.equal(w.action.provider, "claude");
    assert.equal(readMetaFile(project).isolated, true);
    const failedN = w.action.n;
    fs.writeFileSync(path.join(project.root, "broken.mjs"), "partial native fixture\n");
    writeResult(project, { status: "failed", note: "native failure fixture", usage: { totalTokens: 13 } });
    const escalated = run(project, ["next", "demo", "--chain", chain], { env: w.env });
    assert.equal(escalated.json.step, implementation, escalated.stdout);
    assert.equal(escalated.json.provider, "openai", escalated.stdout);
    w.action = escalated.json;
    const failed = readLogEntries(project).find((entry) => entry.n === failedN);
    assert.match(failed.rolledBack, /^refs\/agent-smith\/demo\//);
    assert.equal(gw(project, ["show", `${failed.rolledBack}:broken.mjs`]), "partial native fixture");
    assert.equal(fs.existsSync(path.join(project.root, "broken.mjs")), false);
    setMode(w, { preflightFailure: true });
    const preflight = execute(w);
    assert.equal(preflight.json.launched, false);
    const callsBeforeRetry = calls(w.fixture).filter((call) => call.args[0] === "exec").length;
    writeOverride(project, { ...policy, ladder: ladder.map((rung) => ({ ...rung, model: "drifted-fixture-model" })), codex: { profile: "drifted-profile" } });
    writeResult(project, { status: "orchestrator-error", note: preflight.json.reason });
    const retry = run(project, ["next", "demo", "--chain", chain], { env: w.env });
    assert.ok(retry.json.neutralRetry, retry.stdout);
    for (const key of ["n", "provider", "model", "effort", "profile", "prompt"]) assert.equal(retry.json[key], w.action[key], key);
    assert.equal(calls(w.fixture).filter((call) => call.args[0] === "exec").length, callsBeforeRetry);
    w.action = retry.json;
    const compared = finishRun(w);
    assert.ok(compared.warnings.includes("cross-provider-raw-tokens"));
    assert.ok(readLogEntries(project).some((entry) => entry.provider === "openai" && entry.ok));
  });
}
