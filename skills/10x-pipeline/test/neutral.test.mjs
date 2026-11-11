// Neutral rerun after an orchestrator fault: the result status orchestrator-error reruns the pending step unchanged
// (same entry, same tier, same prompt), with no failed attempt, rigor rise or budget use, up to limits.maxNeutralRetries.
// Black-box tests through the CLI in scratch projects: the 10x chain, status and report.md, the OpenSpec chain and an
// isolated run in a real linked worktree (hermetic git, as in rollback.test.mjs).
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  cleanupAll, makeProject, planText, init, next, writeLog, entry, readLogEntries, readMetaFile, writeResult, run,
  readReportFile, writeMetaFile, gitAvailable, gitEnv, gitInit, git, commitFiles
} from "./helpers.mjs";
import { writePlan, writeReview } from "./ahead.mjs";
import { makeOpenspecProject, initOpenspec, writeArtifacts, moveToArchive } from "./openspec-helpers.mjs";

after(cleanupAll);

const noGit = !gitAvailable() && "git is not available";
const PASS = "Verdict: PASS\nCritical: 0\nWarnings: 0\n\n## Critical\n\n## Warnings\n";
const FAULT = { status: "orchestrator-error", note: "prompt truncated\nby the harness" };
const resultPath = (project) => path.join(project.agentDir, "last-result.json");
const reportPath = (project) => path.join(project.agentDir, "report.md");

// A plan.md with Progress whose mtime is later than any step start of the test.
function writeFreshPlan(project) {
  writePlan(project, planText({ files: ["**File**: `x.js`"] }));
  const later = new Date(Date.now() + 9000);
  fs.utimesSync(project.planFile, later, later);
}

function fault(project, result = FAULT) {
  writeResult(project, result);
  return next(project);
}

test("a rerun returns the identical step and keeps one entry without a result", () => {
  const project = makeProject();
  const first = init(project, "fix typo");
  assert.equal(first.json.action, "run");
  assert.equal(first.json.step, "plan");
  const before = readLogEntries(project)[0];

  const res = fault(project);
  assert.equal(res.status, 0);
  assert.equal(res.json.action, "run");
  for (const key of ["n", "step", "model", "effort", "reason", "prompt", "resultFile"]) {
    assert.deepEqual(res.json[key], first.json[key], key);
  }
  assert.deepEqual(res.json.neutralRetry, { count: 1, cap: 2 });
  assert.equal(fs.existsSync(resultPath(project)), false);

  const log = readLogEntries(project);
  assert.equal(log.length, 1);
  const e = log[0];
  assert.equal(e.n, 1);
  assert.equal(e.neutralRetries.length, 1);
  assert.equal(e.neutralRetries[0].note, "prompt truncated by the harness");
  assert.equal(typeof e.neutralRetries[0].at, "number");
  for (const key of ["result", "ok", "rolledBack", "verified", "finishedAt"]) assert.equal(Object.hasOwn(e, key), false, key);
  for (const key of ["tier", "tierWhy", "startedAt", "before", "rigor", "model", "effort", "pendingPrompt"]) {
    assert.deepEqual(e[key], before[key], key);
  }
});

test("the note is one line cut to 200 characters and empty when absent", () => {
  const project = makeProject();
  init(project, "fix typo");
  fault(project, { status: "orchestrator-error", note: "x".repeat(300) });
  fault(project, { status: "orchestrator-error" });
  const [a, b] = readLogEntries(project)[0].neutralRetries;
  assert.equal(a.note, "x".repeat(200));
  assert.equal(b.note, "");
});

test("no tier bump: a done result after the rerun continues as without the fault", () => {
  const control = makeProject();
  init(control, "fix typo");
  writeFreshPlan(control);
  writeResult(control, { status: "done", note: "planned" });
  const want = next(control);
  assert.equal(want.json.step, "plan-review");

  const project = makeProject();
  init(project, "fix typo");
  fault(project);
  writeFreshPlan(project);
  writeResult(project, { status: "done", note: "planned" });
  const got = next(project);
  for (const key of ["n", "step", "model", "effort", "reason"]) assert.deepEqual(got.json[key], want.json[key], key);
  const first = readLogEntries(project)[0];
  assert.equal(first.ok, true);
  assert.equal(first.neutralRetries.length, 1);
});

test("a failed result after the rerun is the first failed attempt", () => {
  const control = makeProject();
  init(control, "fix typo");
  writeResult(control, { status: "failed", note: "no plan" });
  const want = next(control);

  const project = makeProject();
  init(project, "fix typo");
  fault(project);
  fault(project);
  writeResult(project, { status: "failed", note: "no plan" });
  const got = next(project);
  assert.equal(got.json.step, "plan");
  assert.equal(got.json.n, 2);
  for (const key of ["model", "effort", "reason"]) assert.deepEqual(got.json[key], want.json[key], key);
  assert.match(got.json.reason, /\+1 for 1 failed attempt\(s\)/);
});

test("the maximum reruns of several steps raise no rigor and use no budget", () => {
  // lean budget = maxTotalSteps 5 + budgetDelta.lean -2 = 3: plan and plan-review use 2, so implement still fits.
  const project = makeProject({ policy: { limits: { maxTotalSteps: 5 } } });
  init(project, "fix typo");
  fault(project);
  fault(project);
  writeFreshPlan(project);
  writeResult(project, { status: "done", note: "planned" });
  const review = next(project);
  assert.equal(review.json.step, "plan-review");
  fault(project);
  const again = fault(project);
  assert.equal(again.json.step, "plan-review");
  assert.deepEqual(again.json.neutralRetry, { count: 2, cap: 2 });
  writeReview(project, "plan-review", { verdict: "SOUND" });
  writeResult(project, { status: "done", note: "reviewed" });
  const impl = next(project);
  assert.equal(impl.json.action, "run");
  assert.equal(impl.json.step, "implement");
  assert.equal(impl.json.n, 3);
  assert.equal(readMetaFile(project).rigor.level, "lean");
  assert.equal(readLogEntries(project).length, 3);
});

test("the original startedAt stays, so a file the lost run wrote still verifies the step", () => {
  const project = makeProject();
  init(project, "fix typo");
  const startedAt = readLogEntries(project)[0].startedAt;
  // The lost run wrote the plan before the fault was declared.
  writePlan(project, planText({ files: ["**File**: `x.js`"] }));
  const mid = new Date(startedAt + 5);
  fs.utimesSync(project.planFile, mid, mid);
  fault(project);
  assert.equal(readLogEntries(project)[0].startedAt, startedAt);
  writeResult(project, { status: "done", note: "planned" });
  const res = next(project);
  assert.equal(res.json.step, "plan-review");
  const first = readLogEntries(project)[0];
  assert.equal(first.startedAt, startedAt);
  assert.equal(first.verified, true);
  assert.equal(first.ok, true);
});

test("the third fault of one step halts with a report and meta.outcome and consumes the file", () => {
  const project = makeProject();
  init(project, "fix typo");
  fault(project);
  fault(project);
  const res = fault(project);
  assert.equal(res.json.action, "halt");
  assert.equal(
    res.json.reason,
    "Step 1 (plan) hit its limit of 2 neutral reruns after orchestrator faults (limits.maxNeutralRetries). Needs a human. " +
      "Fix the harness, then either write a result file with the real status (the router verifies the step by its files), " +
      "or raise limits.maxNeutralRetries in context/foundation/agent-smith-policy.json and write the orchestrator-error result file again, then run next.",
  );
  assert.equal(fs.existsSync(resultPath(project)), false);
  assert.equal(fs.existsSync(reportPath(project)), true);
  assert.equal(readMetaFile(project).outcome.action, "halt");
  const e = readLogEntries(project)[0];
  assert.equal(e.neutralRetries.length, 2);
  assert.equal(Object.hasOwn(e, "result"), false);

  // A next with no file halts with the missing-result text, which names the way out.
  const missing = next(project);
  assert.equal(missing.status, 1);
  assert.match(missing.json.reason, /^Step 1 \(plan\) has no result\. Write .*last-result\.json first\./);
  assert.match(missing.json.reason, /"status":"orchestrator-error"/);

  // A real result afterwards continues and clears the stale outcome.
  writeFreshPlan(project);
  writeResult(project, { status: "done", note: "planned" });
  const cont = next(project);
  assert.equal(cont.json.step, "plan-review");
  assert.equal(Object.hasOwn(readMetaFile(project), "outcome"), false);
});

test("a raised cap lets the rerun go on after the halt", () => {
  const project = makeProject();
  init(project, "fix typo");
  fault(project);
  fault(project);
  assert.equal(fault(project).json.action, "halt");
  const policyFile = path.join(project.root, "context/foundation/agent-smith-policy.json");
  const policy = JSON.parse(fs.readFileSync(policyFile, "utf8"));
  fs.writeFileSync(policyFile, JSON.stringify({ ...policy, limits: { maxNeutralRetries: 3 } }));
  const res = fault(project);
  assert.equal(res.json.action, "run");
  assert.deepEqual(res.json.neutralRetry, { count: 3, cap: 3 });
  assert.equal(Object.hasOwn(readMetaFile(project), "outcome"), false);
});

test("maxNeutralRetries 0 reads the status as a failed attempt", () => {
  const project = makeProject({ policy: { limits: { maxNeutralRetries: 0 } } });
  init(project, "fix typo");
  const res = fault(project);
  assert.equal(res.json.action, "run");
  assert.equal(res.json.n, 2);
  assert.equal(Object.hasOwn(res.json, "neutralRetry"), false);
  assert.match(res.json.reason, /\+1 for 1 failed attempt\(s\)/);
  const first = readLogEntries(project)[0];
  assert.equal(first.ok, false);
  assert.equal(first.result.status, "orchestrator-error");
  assert.equal(Object.hasOwn(first, "neutralRetries"), false);
});

test("a malformed maxNeutralRetries reads as 2", () => {
  for (const bad of ["3", -1, 1.5, null]) {
    const project = makeProject({ policy: { limits: { maxNeutralRetries: bad } } });
    init(project, "fix typo");
    assert.deepEqual(fault(project).json.neutralRetry, { count: 1, cap: 2 }, String(bad));
    assert.deepEqual(fault(project).json.neutralRetry, { count: 2, cap: 2 }, String(bad));
    const res = fault(project);
    assert.equal(res.json.action, "halt", String(bad));
    assert.match(res.json.reason, /limit of 2 neutral reruns/);
  }
});

test("an entry without a stored prompt halts plainly and leaves the file", () => {
  const project = makeProject();
  init(project, "fix typo");
  const [e] = readLogEntries(project);
  delete e.pendingPrompt;
  writeLog(project, [e]);
  const res = fault(project);
  assert.equal(res.status, 1);
  assert.equal(res.json.action, "halt");
  assert.match(res.json.reason, /^Step 1 \(plan\) was logged without a stored prompt, so it cannot be rerun unchanged/);
  assert.match(res.json.reason, /"status":"failed"/);
  assert.equal(fs.existsSync(resultPath(project)), true);
  assert.equal(fs.existsSync(reportPath(project)), false);
  assert.equal(Object.hasOwn(readMetaFile(project), "outcome"), false);
  const after = readLogEntries(project);
  assert.equal(after.length, 1);
  assert.equal(Object.hasOwn(after[0], "neutralRetries"), false);
  assert.equal(Object.hasOwn(after[0], "result"), false);
});

test("a stray orchestrator-error file with no pending entry is not consumed and changes nothing", () => {
  const control = makeProject({ plan: planText({ files: ["**File**: `x.js`"] }) });
  writeLog(control, [entry(1, "plan")]);
  const want = init(control, "fix typo");

  const project = makeProject({ plan: planText({ files: ["**File**: `x.js`"] }) });
  writeLog(project, [entry(1, "plan")]);
  writeResult(project, FAULT);
  const got = init(project, "fix typo");
  assert.equal(got.json.action, "run");
  for (const key of ["n", "step", "model", "effort", "reason", "prompt"]) assert.deepEqual(got.json[key], want.json[key], key);
  assert.equal(Object.hasOwn(got.json, "neutralRetry"), false);
  assert.equal(fs.existsSync(resultPath(project)), true);
  const log = readLogEntries(project);
  assert.equal(log.length, 2);
  assert.equal(log.some((e) => Object.hasOwn(e, "neutralRetries")), false);
  assert.deepEqual(log[0], entry(1, "plan"));
});

test("pendingPrompt is stored while the step is pending and gone once the real result is consumed", () => {
  const project = makeProject();
  const first = init(project, "fix typo");
  assert.equal(readLogEntries(project)[0].pendingPrompt, first.json.prompt);
  writeFreshPlan(project);
  writeResult(project, { status: "done", note: "planned" });
  const second = next(project);
  const log = readLogEntries(project);
  assert.equal(Object.hasOwn(log[0], "pendingPrompt"), false);
  assert.equal(log[1].pendingPrompt, second.json.prompt);
  const raw = fs.readFileSync(path.join(project.agentDir, "run.jsonl"), "utf8").split("\n")[0];
  assert.equal(raw.includes("pendingPrompt"), false);

  // A failed result drops it too.
  writeResult(project, { status: "failed", note: "x" });
  next(project);
  assert.equal(Object.hasOwn(readLogEntries(project)[1], "pendingPrompt"), false);
});

// ---- Phase 2: status, report, OpenSpec chain, isolated run ------------------------------------------------------------

test("status shows neutralRetries on the row of a rerun step only", () => {
  const project = makeProject();
  init(project, "fix typo");
  fault(project);
  writeFreshPlan(project);
  writeResult(project, { status: "done", note: "planned" });
  next(project);
  const st = run(project, ["status", "demo"]);
  assert.equal(st.status, 0, st.stdout);
  assert.equal(st.json.steps[0].neutralRetries, 1);
  assert.equal(Object.hasOwn(st.json.steps[1], "neutralRetries"), false);
  for (const row of st.json.steps) assert.equal(Object.hasOwn(row, "pendingPrompt"), false);
});

test("status of a run without reruns has no neutralRetries field", () => {
  const project = makeProject();
  init(project, "fix typo");
  const st = run(project, ["status", "demo"]);
  assert.equal(Object.hasOwn(st.json.steps[0], "neutralRetries"), false);
});

test("report.md marks the Result cell and lists the reruns with cleaned notes", () => {
  const project = makeProject();
  init(project, "fix typo");
  fault(project, { status: "orchestrator-error", note: "prompt `cut`\nby the | harness" });
  // A pending entry shows the suffix on its empty result.
  run(project, ["status", "demo", "--report"]);
  assert.match(readReportFile(project), /^\| 1 \| plan \| .* \| -, 1 neutral rerun \| - \|$/m);
  fault(project, { status: "orchestrator-error" });
  writeFreshPlan(project);
  writeResult(project, { status: "done", note: "planned" });
  next(project);
  run(project, ["status", "demo", "--report"]);
  const report = readReportFile(project);
  assert.match(report, /^\| 1 \| plan \| .* \| ok, 2 neutral reruns \| - \|$/m);
  assert.match(report, /^\| 2 \| plan-review \| .* \| - \| - \|$/m);
  assert.match(report, /^## Neutral reruns$/m);
  assert.match(report, /^- step 1 plan: 2 reruns after an orchestrator fault$/m);
  assert.match(report, /^ {2}- prompt 'cut' by the \| harness$/m);
  assert.equal(report.includes("`cut`"), false);
  // One line per non-empty note: the empty second note adds none.
  const section = report.slice(report.indexOf("## Neutral reruns"));
  assert.equal(section.split("\n").filter((l) => l.startsWith("  - ")).length, 1);
});

test("report.md of a run without reruns has no section and no cell suffix", () => {
  const project = makeProject();
  init(project, "fix typo");
  writeFreshPlan(project);
  writeResult(project, { status: "done", note: "planned" });
  next(project);
  run(project, ["status", "demo", "--report"]);
  const report = readReportFile(project);
  assert.doesNotMatch(report, /neutral rerun/i);
  assert.match(report, /^\| 1 \| plan \| .* \| ok \| - \|$/m);
});

// ---- OpenSpec chain ---------------------------------------------------------------------------------------------------

test("OpenSpec chain: an os-apply rerun keeps the prompt, the tier and the pre-fault ticks", () => {
  const project = makeOpenspecProject({ proposal: true, specs: 1, tasks: { done: 0, open: 2 } });
  const first = initOpenspec(project, "Add a thing");
  assert.equal(first.status, 0, first.stdout);
  assert.equal(first.json.step, "os-apply");
  // The lost run ticked a row before the fault was declared.
  writeArtifacts(project, { tasks: { done: 1, open: 1 } });
  writeResult(project, FAULT);
  const res = run(project, ["next", project.id, "--chain", "openspec"]);
  assert.equal(res.json.action, "run", res.stdout);
  for (const key of ["n", "step", "model", "effort", "reason", "prompt", "resultFile"]) {
    assert.deepEqual(res.json[key], first.json[key], key);
  }
  assert.deepEqual(res.json.neutralRetry, { count: 1, cap: 2 });
  assert.doesNotMatch(res.json.reason, /failed attempt/);
  const [e] = readLogEntries(project);
  assert.equal(e.before.ticks, 0);
  assert.doesNotMatch(e.tierWhy, /\+1 for 1 failed attempt\(s\)/);
  // The real result verifies on the ticks the lost run and the rerun made together.
  writeArtifacts(project, { tasks: { done: 2, open: 0 } });
  writeResult(project, { status: "done", note: "applied" });
  const verify = run(project, ["next", project.id, "--chain", "openspec"]);
  assert.equal(verify.json.step, "os-verify", verify.stdout);
  const log = readLogEntries(project);
  assert.equal(log[0].ok, true);
  assert.equal(log[0].neutralRetries.length, 1);
  assert.equal(Object.hasOwn(log[0], "pendingPrompt"), false);
  const st = run(project, ["status", project.id, "--chain", "openspec"]);
  assert.equal(st.json.steps[0].neutralRetries, 1);
});

test("OpenSpec chain: an archived-run report keeps the Neutral reruns section", { skip: noGit }, () => {
  const project = makeOpenspecProject({ proposal: true, specs: 1, tasks: { done: 2, open: 0 }, verify: PASS });
  writeLog(project, [
    entry(1, "os-apply", { template: "os-apply", neutralRetries: [{ at: 1, note: "Agent call refused" }] }),
    entry(2, "os-verify", { review: { verdict: "PASS", critical: 0, warnings: 0 } }),
  ]);
  writeMetaFile(project, { id: "demo", goal: "Add a thing", chain: "openspec", archive: true });
  gitInit(project);
  commitFiles(project, ["README.md"]);
  const res = run(project, ["next", project.id], { env: gitEnv(project) });
  assert.equal(res.json.action, "archive", res.stdout);
  const moved = moveToArchive(project);
  const report = fs.readFileSync(path.join(moved, "agent-smith/report.md"), "utf8");
  assert.match(report, /^## Neutral reruns$/m);
  assert.match(report, /^- step 1 os-apply: 1 rerun after an orchestrator fault$/m);
  assert.match(report, /^ {2}- Agent call refused$/m);
  assert.match(report, /^\| 1 \| os-apply \| .* \| ok, 1 neutral rerun \| - \|$/m);
});

// ---- isolated run -----------------------------------------------------------------------------------------------------

test("isolated run: a rerun makes no ref, no commit and no reset; a later failure rolls back to the original startSha", { skip: noGit }, () => {
  const main = makeProject({ policy: { isolation: { require: true } } });
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
  const gw = (args) => git(wt, ["-C", top, ...args]);
  const first = run(wt, ["init", wt.id, "--goal", "fix typo"], { env: gitEnv(wt) });
  assert.equal(first.status, 0, first.stdout + first.stderr);
  const start = gw(["rev-parse", "HEAD"]);
  const [logged] = readLogEntries(wt);
  assert.equal(logged.startSha, start);
  const commits = gw(["rev-list", "--count", "HEAD"]);
  // Partial edits of the lost run, made after the step started.
  fs.writeFileSync(path.join(top, "partial.txt"), "half\n");
  writePlan(wt, planText({ files: ["**File**: `x.js`"] }));

  writeResult(wt, FAULT);
  const res = run(wt, ["next", wt.id], { env: gitEnv(wt) });
  assert.equal(res.json.action, "run", res.stdout);
  for (const key of ["n", "step", "model", "effort", "reason", "prompt", "resultFile"]) {
    assert.deepEqual(res.json[key], first.json[key], key);
  }
  assert.equal(gw(["for-each-ref", "refs/agent-smith/"]), "");
  assert.equal(gw(["rev-parse", "HEAD"]), start);
  assert.equal(gw(["rev-list", "--count", "HEAD"]), commits);
  assert.equal(fs.readFileSync(path.join(top, "partial.txt"), "utf8"), "half\n");
  assert.equal(fs.existsSync(wt.planFile), true);
  const [e] = readLogEntries(wt);
  assert.equal(e.startSha, start);
  for (const key of ["commit", "rolledBack", "kept", "result"]) assert.equal(Object.hasOwn(e, key), false, key);

  // A failed result afterwards rolls back to the original startSha and snapshots the partial edits.
  writeResult(wt, { status: "failed", note: "red" });
  const retry = run(wt, ["next", wt.id], { env: gitEnv(wt) });
  assert.equal(retry.json.action, "run", retry.stdout);
  const later = readLogEntries(wt);
  assert.match(later[0].rolledBack, /^refs\/agent-smith\/demo\/[0-9a-f]{12}\/failed-1$/);
  assert.equal(gw(["rev-parse", "HEAD"]), start);
  assert.equal(fs.existsSync(path.join(top, "partial.txt")), false);
  assert.equal(gw(["show", `${later[0].rolledBack}:partial.txt`]), "half");
  assert.match(retry.json.reason, /\+1 for 1 failed attempt\(s\)/);
});
