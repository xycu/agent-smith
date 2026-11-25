// The `usage` command (late-step-usage): attaches a usage figure that reached the orchestrator after `next` ran to an
// executed step of either chain. Black-box through the CLI in scratch projects; isolated runs use real linked worktrees
// and hermetic git, as in rollback.test.mjs. Test names start with the plan row number.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  cleanupAll, makeProject, commitFiles, run, git, gitAvailable, gitEnv, gitInit, writeResult, seedRun, writeLog,
  writeMetaFile, readLogEntries, readMetaFile, readReportFile, entry, planText
} from "./helpers.mjs";
import { writePlan, writeReview } from "./ahead.mjs";
import { makeOpenspecProject, moveToArchive, writeArtifacts } from "../../openspec-pipeline/test/openspec-helpers.mjs";
import { boundClaudeFixture, collectInput, transcriptEnv, transcriptFixture } from "./claude-helpers.mjs";
import { claudeCaptureCheckpoint, collectClaudeUsage } from "../scripts/claude-usage.mjs";
import { unavailableEvidence } from "../scripts/usage.mjs";

after(cleanupAll);

const skip = !gitAvailable() && "git is not available";
const GOAL = "Add a retry counter to the status output so the report shows how often each step ran again";
const FIG = { totalTokens: 1200, toolUses: 7, durationMs: 4500 };
const FLAGS = ["--tokens", "1200", "--tool-uses", "7", "--duration-ms", "4500"];
const PRICES = { prices: { usdPerMillionTokens: { opus: 30, sonnet: 6, haiku: 2 } } };

// Every file under dir as { relative path: content }, for the byte-identical assertions.
function snapshot(dir) {
  const files = {};
  const walk = (d) => {
    for (const name of fs.readdirSync(d).sort()) {
      const abs = path.join(d, name);
      if (fs.statSync(abs).isDirectory()) walk(abs);
      else files[path.relative(dir, abs)] = fs.readFileSync(abs, "utf8");
    }
  };
  if (fs.existsSync(dir)) walk(dir);
  return files;
}

const usage = (project, n, extra = FLAGS) => run(project, ["usage", project.id, ...(n === null ? [] : [String(n)]), ...extra], { env: gitEnv(project) });

// Step 1 done without a figure, step 2 pending. `chain` projects store their chain in meta.json.
function running(over = {}) {
  const project = makeProject(over);
  writeLog(project, [
    entry(1, "plan"),
    entry(2, "plan-review", { result: undefined, verified: undefined, ok: undefined, finishedAt: undefined, pendingPrompt: "the prompt" }),
  ]);
  writeMetaFile(project, { id: "demo", goal: "fix typo", rigor: { level: "standard" } });
  return project;
}

// Both steps done and the run ended.
function ended(action = "done", over = {}) {
  const project = makeProject(over);
  writeLog(project, [
    entry(1, "plan", { usage: { totalTokens: 1_000_000 } }),
    entry(2, "plan-review"),
    entry(3, "implement", { model: "opus", usage: { totalTokens: 500_000 } }),
  ]);
  writeMetaFile(project, {
    id: "demo", goal: "fix typo", rigor: { level: "standard" },
    outcome: action === "done" ? { action, reason: "all rows done", manualPending: [] } : { action, reason: "needs a human" },
  });
  return project;
}

// ---- 1.1 arguments ----------------------------------------------------------------------------

test("1.1 a bad step number, no flag, a flag without a value and a bad value exit 1 and leave the folder byte-identical", () => {
  const project = running();
  const before = snapshot(project.changeDir);
  const cases = [
    [null, FLAGS], ["0", FLAGS], ["01", FLAGS], ["-1", FLAGS], ["1.5", FLAGS], ["x", FLAGS], ["9007199254740993", FLAGS],
    [1, []], [1, ["--tokens"]], [1, ["--tokens", "--tool-uses", "3"]],
    [1, ["--tokens", "-5"]], [1, ["--tokens", "1.5"]], [1, ["--tokens", "1e3"]], [1, ["--tokens", "abc"]],
    [1, ["--tokens", "9007199254740993"]], [1, ["--tokens", "100", "--tool-uses", "-1"]], [1, ["--duration-ms", "2.5"]],
  ];
  for (const [n, extra] of cases) {
    const res = usage(project, n, extra);
    assert.equal(res.status, 1, `${n} ${extra.join(" ")}: ${res.stdout}`);
    assert.equal(res.json.action, "usage");
    assert.equal(res.json.attached, false);
    assert.equal(typeof res.json.reason, "string");
  }
  // A flag first makes <n> a flag, which is refused.
  const flagFirst = run(project, ["usage", project.id, "--tokens", "5", "1"]);
  assert.equal(flagFirst.status, 1, flagFirst.stdout);
  assert.equal(flagFirst.json.attached, false);
  assert.deepEqual(snapshot(project.changeDir), before);
});

test("1.1 usage help advertises --usage-file", () => {
  const project = makeProject();
  const synopsis = "usage <change-id> <n> (--usage-file <path> | --tokens N [--tool-uses N] [--duration-ms N])";

  const refused = usage(project, null, []);
  assert.equal(refused.status, 1, refused.stdout);
  assert.equal(refused.json.action, "usage");
  assert.equal(refused.json.attached, false);
  assert.equal(refused.json.n, null);
  assert.ok(refused.json.reason.startsWith(`Usage: route.mjs ${synopsis} [--chain 10x|openspec]; <n> is the step number`), refused.stdout);

  const halted = run(project, []);
  assert.equal(halted.status, 1, halted.stdout);
  assert.equal(halted.json.action, "halt");
  assert.ok(halted.json.reason.startsWith("Usage: route.mjs next <change-id> [--agent-id <id>] | init|status|risk <change-id> "), halted.stdout);
  assert.ok(halted.json.reason.includes(` | ${synopsis} | verify-archive `), halted.stdout);
  assert.ok(halted.json.reason.endsWith("; every command takes [--chain 10x|openspec]"), halted.stdout);
});

// ---- 1.2 refusals -----------------------------------------------------------------------------

test("1.2 a step that is not logged, a pending step and no run log are refused and write nothing", () => {
  const project = running();
  const before = snapshot(project.changeDir);
  const missing = usage(project, 3);
  assert.equal(missing.status, 1, missing.stdout);
  assert.deepEqual(missing.json, { action: "usage", attached: false, n: 3, reason: "Step 3 is not logged." });
  const pending = usage(project, 2);
  assert.equal(pending.status, 1, pending.stdout);
  assert.equal(pending.json.reason, "Step 2 (plan-review) has no result yet; put the figure in its result file.");
  assert.deepEqual(snapshot(project.changeDir), before);

  const bare = makeProject();
  const none = usage(bare, 1);
  assert.equal(none.status, 1, none.stdout);
  assert.equal(none.json.reason, "No run log for demo.");
  assert.deepEqual(snapshot(bare.changeDir), { "change.md": "---\nchange_id: demo\nstatus: planned\n---\n" });
});

test("1.2 a skip entry is never matched", () => {
  const project = makeProject();
  seedRun(project, [{ skipped: true, step: "research", reason: "fixture", rigor: "lean", afterN: 0, at: 1 }, entry(1, "plan")]);
  const before = snapshot(project.changeDir);
  const res = usage(project, 2);
  assert.equal(res.status, 1, res.stdout);
  assert.equal(res.json.reason, "Step 2 is not logged.");
  assert.deepEqual(snapshot(project.changeDir), before);
});

test("1.2 a different figure over an existing one, a subset and a superset included, is refused and writes nothing", () => {
  const project = running();
  assert.equal(usage(project, 1).status, 0);
  const before = snapshot(project.changeDir);
  for (const extra of [["--tokens", "1201"], ["--tokens", "1200"], ["--tokens", "1200", "--tool-uses", "7", "--duration-ms", "4500", "--tool-uses", "8"]]) {
    const res = usage(project, 1, extra);
    assert.equal(res.status, 1, res.stdout);
    assert.equal(res.json.attached, false);
    assert.match(res.json.reason, /^Step 1 \(plan\) already has the figure \{.*\}; a figure is never overwritten\.$/);
  }
  assert.deepEqual(snapshot(project.changeDir), before);
});

// ---- 1.3 attaching ----------------------------------------------------------------------------

test("1.3 a figure for step 1 while step 2 is pending: usage and usageLate set, pending entry untouched, status shows it, no report", () => {
  const project = running();
  const res = usage(project, 1);
  assert.equal(res.status, 0, res.stdout);
  assert.deepEqual(res.json, { action: "usage", attached: true, n: 1, step: "plan", usage: FIG, unchanged: false, report: null, commit: null });
  const entries = readLogEntries(project);
  assert.deepEqual(entries[0].usage, FIG);
  assert.equal(entries[0].usageLate, true);
  assert.equal(entries[1].pendingPrompt, "the prompt");
  assert.equal(Object.hasOwn(entries[1], "usage"), false);
  assert.equal(fs.existsSync(path.join(project.agentDir, "report.md")), false);
  const status = run(project, ["status", project.id]);
  assert.deepEqual(status.json.steps[0].usage, FIG);
  assert.equal(status.json.steps[1].usage, null);
});

test("1.3 one flag is enough and only the given keys are stored", () => {
  const project = running();
  const res = usage(project, 1, ["--tokens", "0"]);
  assert.equal(res.status, 0, res.stdout);
  assert.deepEqual(readLogEntries(project)[0].usage, { totalTokens: 0 });
});

test("1.3 the same figure again prints unchanged and leaves run.jsonl byte-identical", () => {
  const project = running();
  assert.equal(usage(project, 1).status, 0);
  const before = snapshot(project.changeDir);
  const again = usage(project, 1, ["--duration-ms", "4500", "--tokens", "1200", "--tool-uses", "7"]);
  assert.equal(again.status, 0, again.stdout);
  assert.equal(again.json.attached, true);
  assert.equal(again.json.unchanged, true);
  assert.deepEqual(snapshot(project.changeDir), before);
});

// ---- 1.4 ended runs ---------------------------------------------------------------------------

test("1.4 an ended done run: report.md shows the figure, the totals count it and the output names the report", () => {
  const project = ended("done");
  const res = usage(project, 2);
  assert.equal(res.status, 0, res.stdout);
  assert.equal(res.json.report, "context/changes/demo/agent-smith/report.md");
  const report = readReportFile(project);
  assert.match(report, /\| 2 \| plan-review \| claude \| sonnet \| high \| 3 \| no \| ok \| 1200 \|/);
  assert.match(report, /Tokens: 1501200 \(figures for 3 of 3 steps\)/);
  assert.equal(readMetaFile(project).outcome.action, "done");
});

test("1.4 an ended halt run rewrites the report too", () => {
  const project = ended("halt");
  const res = usage(project, 2);
  assert.equal(res.status, 0, res.stdout);
  assert.match(readReportFile(project), /Outcome: halt - needs a human/);
  assert.match(readReportFile(project), /Tokens: 1501200 \(figures for 3 of 3 steps\)/);
});

test("1.4 with prices set the Cost (est.) cell and the Cost (estimate) line include the late figure", () => {
  const project = ended("done", { policy: PRICES });
  const res = usage(project, 2, ["--tokens", "500000"]);
  assert.equal(res.status, 0, res.stdout);
  const report = readReportFile(project);
  assert.match(report, /\| 2 \| plan-review \| claude \| sonnet \| high \| 3 \| no \| ok \| 500000 \| \$3\.0000 \|/);
  assert.match(report, /Cost \(estimate\): \$24\.00 at a blended rate/);
  assert.match(report, /priced 3 of 3 steps with a token figure/);
});

// ---- 1.5 compare ------------------------------------------------------------------------------

test("1.5 compare reports usage-incomplete for the routed side before the command and not after it", () => {
  const side = (totals) => {
    const project = makeProject();
    writeLog(project, totals.map((t, i) => entry(i + 1, "plan", t === null ? {} : { usage: { totalTokens: t, toolUses: 2, durationMs: 100 } })));
    writeMetaFile(project, { id: "demo", goal: "fix typo", baseSha: "a".repeat(40), rigor: { level: "standard" }, outcome: { action: "done" } });
    return project;
  };
  const routed = side([100, null, 50]);
  const baseline = side([100, 100, 100]);
  const cmp = () => run(routed, ["compare", routed.id, "--baseline", baseline.root]);
  assert.ok(cmp().json.reasons.includes("usage-incomplete:routed"));
  assert.equal(usage(routed, 2, ["--tokens", "40", "--tool-uses", "1", "--duration-ms", "9"]).status, 0);
  const after2 = cmp();
  assert.ok(!after2.json.reasons.includes("usage-incomplete:routed"), JSON.stringify(after2.json.reasons));
  assert.equal(after2.json.routed.tokens.total, 190);
});

// ---- 1.6 OpenSpec chain -----------------------------------------------------------------------

function openspecRun(outcome = null) {
  const project = makeOpenspecProject({ proposal: true, specs: 1, tasks: { done: 1 } });
  writeLog(project, [
    entry(1, "os-propose"),
    entry(2, "os-apply", outcome ? {} : { result: undefined, verified: undefined, ok: undefined, finishedAt: undefined, pendingPrompt: "p" }),
  ]);
  writeMetaFile(project, { id: "demo", goal: "fix typo", chain: "openspec", rigor: { level: "standard" }, ...(outcome ? { outcome } : {}) });
  return project;
}

test("1.6 OpenSpec: attach with --chain openspec and without the flag on a running run", () => {
  for (const extra of [["--chain", "openspec"], []]) {
    const project = openspecRun();
    const res = usage(project, 1, [...FLAGS, ...extra]);
    assert.equal(res.status, 0, res.stdout);
    assert.equal(res.json.step, "os-propose");
    assert.deepEqual(readLogEntries(project)[0].usage, FIG);
    assert.equal(fs.existsSync(path.join(project.agentDir, "report.md")), false);
  }
});

test("1.6 OpenSpec: an ended run gets its report.md rewritten, with and without the flag", () => {
  for (const extra of [["--chain", "openspec"], []]) {
    const project = openspecRun({ action: "done", reason: "verify passed", manualPending: [] });
    const res = usage(project, 2, [...FLAGS, ...extra]);
    assert.equal(res.status, 0, res.stdout);
    assert.equal(res.json.report, "openspec/changes/demo/agent-smith/report.md");
    assert.match(readReportFile(project), /\| 2 \| os-apply \| .* \| 1200 \|/);
  }
});

test("1.6 OpenSpec: a moved change halts as archived and writes nothing; a missing folder is refused", () => {
  const project = openspecRun({ action: "done", reason: "ok", manualPending: [] });
  const target = moveToArchive(project);
  const before = snapshot(target);
  for (const extra of [["--chain", "openspec"], []]) {
    const res = usage(project, 2, [...FLAGS, ...extra]);
    assert.equal(res.status, 1, res.stdout);
    assert.equal(res.json.action, "halt");
    assert.match(res.json.reason, /is archived at/);
  }
  assert.deepEqual(snapshot(target), before);

  const none = makeOpenspecProject({ change: false });
  const res = usage(none, 1, [...FLAGS, "--chain", "openspec"]);
  assert.equal(res.status, 1, res.stdout);
  assert.equal(res.json.attached, false);
  assert.match(res.json.reason, /No OpenSpec change folder/);
});

// ---- 1.7 archived 10x changes -----------------------------------------------------------------

test("1.7 a 10x change stamped archived with its folder in place, and a moved one, halt and write nothing", () => {
  const stamped = ended("done");
  fs.writeFileSync(path.join(stamped.changeDir, "change.md"), "---\nchange_id: demo\nstatus: archived\n---\n");
  const before = snapshot(stamped.changeDir);
  const res = usage(stamped, 2);
  assert.equal(res.status, 1, res.stdout);
  assert.equal(res.json.action, "halt");
  assert.match(res.json.reason, /stamped archived/);
  assert.deepEqual(snapshot(stamped.changeDir), before);

  const moved = ended("done");
  const target = path.join(moved.root, "context/archive/2026-01-01-demo");
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.renameSync(moved.changeDir, target);
  const after = snapshot(target);
  const res2 = usage(moved, 2);
  assert.equal(res2.status, 1, res2.stdout);
  assert.match(res2.json.reason, /is archived at/);
  assert.deepEqual(snapshot(target), after);
});

// ---- 1.8 isolated runs ------------------------------------------------------------------------

const ON = { isolation: { require: true } };
const CHANGE = "context/changes/demo";
const LOG = `${CHANGE}/agent-smith/run.jsonl`;

function repo() {
  const project = makeProject({ policy: ON });
  gitInit(project);
  git(project, ["add", "-A"]);
  git(project, ["commit", "-q", "-m", "chore: project"]);
  project.top = project.base;
  return project;
}

function worktree(main) {
  const top = path.join(main.base, ".claude/worktrees", `agent-smith-${main.id}`);
  git(main, ["worktree", "add", "-q", "-b", `agent-smith/${main.id}`, top]);
  const changeDir = path.join(top, "context/changes", main.id);
  return {
    id: main.id, base: main.base, top, root: top, changeDir,
    agentDir: path.join(changeDir, "agent-smith"), planFile: path.join(changeDir, "plan.md"),
  };
}

const gw = (wt, args) => git(wt, ["-C", wt.top, ...args]);
const nextIn = (wt) => run(wt, ["next", wt.id], { env: gitEnv(wt) });

// Step 1 (plan) verified and committed, step 2 (plan-review) pending.
function isolatedAtReview() {
  const main = repo();
  const wt = worktree(main);
  const init = run(wt, ["init", wt.id, "--goal", GOAL, "--provider-mode", "codex"], { env: gitEnv(wt) });
  assert.equal(init.status, 0, init.stdout + init.stderr);
  writePlan(wt, planText({ phases: 1 }));
  writeResult(wt, { status: "done", note: "planned" });
  const review = nextIn(wt);
  assert.equal(review.json.step, "plan-review", review.stdout);
  return wt;
}

test("1.8 isolated run: a figure attached while step 2 runs survives step 2's rollback and the next step commit holds it", { skip }, () => {
  const wt = isolatedAtReview();
  const res = usage(wt, 1);
  assert.equal(res.status, 0, res.stdout);
  writeResult(wt, { status: "failed", note: "review cut short" });
  const retry = nextIn(wt);
  assert.equal(retry.json.step, "plan-review", retry.stdout);
  const entries = readLogEntries(wt);
  assert.deepEqual(entries[0].usage, FIG);
  assert.equal(entries[0].usageLate, true);
  assert.ok(entries[1].rolledBack, "step 2 was rolled back");
  // The retry succeeds: its step commit holds the figure.
  writeReview(wt, "plan-review", { verdict: "SOUND" });
  writeResult(wt, { status: "done", note: "reviewed" });
  const done = nextIn(wt);
  assert.equal(done.json.action, "run", done.stdout);
  const committed = gw(wt, ["show", `HEAD:${LOG}`]).split("\n").filter(Boolean).map((l) => JSON.parse(l));
  assert.deepEqual(committed[0].usage, FIG);
});

test("1.8 isolated run: a failed step that hits the attempt cap halts with the kept state still holding the figure", { skip }, () => {
  const wt = isolatedAtReview();
  assert.equal(usage(wt, 1).status, 0);
  let last;
  for (let i = 0; i < 3; i++) {
    writeResult(wt, { status: "failed", note: `attempt ${i + 1}` });
    last = nextIn(wt);
  }
  assert.equal(last.json.action, "halt", last.stdout);
  assert.match(last.json.reason, /plan-review failed 3 times in a row/);
  const entries = readLogEntries(wt);
  assert.deepEqual(entries[0].usage, FIG);
  assert.equal(entries[0].usageLate, true);
  assert.ok(entries.at(-1).kept, "the final failure keeps its edits");
});

// ---- 2.1 the archive state --------------------------------------------------------------------

const MESSAGE = "chore(demo): add late usage figure of step 4";
const PRE_ARCHIVE = "chore(demo): commit change folder before archive";

// A finished 10x run in a git repository: change.md with `created`, a plan with every Automated row done, both
// reviews, a log that ends in an approved impl-review, meta.json with the archive flag, one base commit. `next` then
// commits the folder and returns the archive action (the state the orchestrator hands to the archive subagent).
function archiveProject({ policy = null } = {}) {
  const project = makeProject({ policy, plan: planText({ phases: 1, rowsPerPhase: 1, done: 1 }) });
  fs.writeFileSync(path.join(project.changeDir, "change.md"), "---\nchange_id: demo\nstatus: implemented\ncreated: 2026-10-30\n---\n");
  writeReview(project, "plan-review", { verdict: "SOUND" });
  writeReview(project, "impl-review", { verdict: "APPROVED" });
  writeLog(project, [entry(1, "plan"), entry(2, "plan-review"), entry(3, "implement"), entry(4, "impl-review")]);
  writeMetaFile(project, { id: "demo", goal: "fix typo", archive: true });
  gitInit(project);
  commitFiles(project, ["README.md"]);
  return project;
}

const rel = (project) => path.relative(project.base, project.changeDir).split(path.sep).join("/");
const subject = (project) => git(project, ["log", "-1", "--format=%s"]);
const showNames = (project) => git(project, ["show", "--name-only", "--format=", "HEAD"]).split("\n").filter(Boolean);
const folderStatus = (project) => git(project, ["status", "--porcelain", "--", rel(project)]);
const blob = (project, file) => git(project, ["show", `HEAD:${rel(project)}/${file}`]);
const onDisk = (project, file) => fs.readFileSync(path.join(project.changeDir, file), "utf8");

test("2.1 10x --archive: after the archive action the figure commits the folder with archive.usageMessage", { skip }, () => {
  const project = archiveProject();
  assert.equal(nextIn(project).json.action, "archive");
  assert.equal(subject(project), PRE_ARCHIVE);
  const res = usage(project, 4);
  assert.equal(res.status, 0, res.stdout + res.stderr);
  assert.equal(res.json.attached, true);
  assert.equal(res.json.commit, git(project, ["rev-parse", "--short", "HEAD"]));
  assert.equal(subject(project), MESSAGE);
  const names = showNames(project);
  assert.ok(names.length > 0 && names.every((n) => n.startsWith(`${rel(project)}/`)), names.join(", "));
  assert.ok(names.includes(`${rel(project)}/agent-smith/report.md`));
  assert.equal(folderStatus(project), "");
  git(project, ["diff", "--cached", "--quiet"]);
  assert.match(blob(project, "agent-smith/report.md"), /\| 4 \| impl-review \| claude \| sonnet \| high \| 3 \| no \| ok \| 1200 \|/);
  assert.deepEqual(JSON.parse(blob(project, "agent-smith/run.jsonl").split("\n")[3]).usage, FIG);
  // The same figure again is a no-op and makes no commit.
  const count = git(project, ["rev-list", "--count", "HEAD"]);
  const again = usage(project, 4);
  assert.equal(again.json.unchanged, true);
  assert.equal(git(project, ["rev-list", "--count", "HEAD"]), count);
});

test("2.1 a failing pre-commit hook: attached false, exit 1, the folder is as committed and the index is empty", { skip }, () => {
  const project = archiveProject();
  assert.equal(nextIn(project).json.action, "archive");
  const hooks = path.join(project.base, ".git/hooks");
  fs.mkdirSync(hooks, { recursive: true });
  fs.writeFileSync(path.join(hooks, "pre-commit"), "#!/bin/sh\necho nope >&2\nexit 1\n", { mode: 0o755 });
  const head = git(project, ["rev-parse", "HEAD"]);
  const res = usage(project, 4);
  assert.equal(res.status, 1, res.stdout);
  assert.equal(res.json.attached, false);
  assert.match(res.json.reason, /The figure was not kept; the change folder is as committed\.$/);
  assert.equal(git(project, ["rev-parse", "HEAD"]), head);
  assert.equal(folderStatus(project), "");
  git(project, ["diff", "--cached", "--quiet"]);
  for (const file of ["agent-smith/run.jsonl", "agent-smith/report.md"]) assert.equal(onDisk(project, file).trim(), blob(project, file).trim(), file);
  assert.equal(readLogEntries(project)[3].usage, undefined);
});

test("2.1 a dirty change folder refuses before writing", { skip }, () => {
  const project = archiveProject();
  assert.equal(nextIn(project).json.action, "archive");
  fs.writeFileSync(path.join(project.changeDir, "extra.txt"), "stray\n");
  const before = snapshot(project.changeDir);
  const res = usage(project, 4);
  assert.equal(res.status, 1, res.stdout);
  assert.match(res.json.reason, /The change folder context\/changes\/demo is not clean; the archive may have started, or the pre-archive commit failed\./);
  assert.deepEqual(snapshot(project.changeDir), before);
});

test("2.1 an archive.usageMessage that is not a non-blank string refuses before writing", { skip }, () => {
  for (const bad of [5, "", "   ", null, ["x"]]) {
    const project = archiveProject({ policy: { archive: { usageMessage: bad } } });
    assert.equal(nextIn(project).json.action, "archive", JSON.stringify(bad));
    const before = snapshot(project.changeDir);
    const head = git(project, ["rev-parse", "HEAD"]);
    const res = usage(project, 4);
    assert.equal(res.status, 1, `${JSON.stringify(bad)}: ${res.stdout}`);
    assert.equal(res.json.reason, "policy.archive.usageMessage must be a non-blank string.");
    assert.deepEqual(snapshot(project.changeDir), before);
    assert.equal(git(project, ["rev-parse", "HEAD"]), head);
  }
});

test("2.1 staged changes refuse before writing", { skip }, () => {
  const project = archiveProject();
  assert.equal(nextIn(project).json.action, "archive");
  fs.writeFileSync(path.join(project.base, "other.txt"), "staged\n");
  git(project, ["add", "other.txt"]);
  const before = snapshot(project.changeDir);
  const res = usage(project, 4);
  assert.equal(res.status, 1, res.stdout);
  assert.match(res.json.reason, /The index holds staged changes/);
  assert.deepEqual(snapshot(project.changeDir), before);
});

test("2.1 a halted archive run keeps the Phase 1 behavior and makes no commit", { skip }, () => {
  const project = archiveProject();
  writeMetaFile(project, { id: "demo", goal: "fix typo", archive: true, outcome: { action: "halt", reason: "needs a human" } });
  git(project, ["add", "-A"]);
  git(project, ["commit", "-q", "-m", "state"]);
  const head = git(project, ["rev-parse", "HEAD"]);
  const res = usage(project, 4);
  assert.equal(res.status, 0, res.stdout);
  assert.equal(res.json.commit, null);
  assert.equal(git(project, ["rev-parse", "HEAD"]), head);
  assert.notEqual(folderStatus(project), "", "the figure and the report stay uncommitted for the next commit");
});

// ---- 2.2 isolated --archive run ---------------------------------------------------------------

test("2.2 isolated --archive run: the commit lands on the run branch and a following next resumes with commit null", { skip }, () => {
  const main = repo();
  const wt = worktree(main);
  const init = run(wt, ["init", wt.id, "--goal", GOAL, "--archive"], { env: gitEnv(wt) });
  assert.equal(init.status, 0, init.stdout + init.stderr);
  // Replace the pending first step with a finished run, as archiveProject does.
  fs.writeFileSync(path.join(wt.changeDir, "change.md"), "---\nchange_id: demo\nstatus: implemented\ncreated: 2026-10-30\n---\n");
  writePlan(wt, planText({ phases: 1, rowsPerPhase: 1, done: 1 }));
  writeReview(wt, "plan-review", { verdict: "SOUND" });
  writeReview(wt, "impl-review", { verdict: "APPROVED" });
  const start = gw(wt, ["rev-parse", "HEAD"]);
  writeLog(wt, [1, 2, 3, 4].map((n) => entry(n, ["plan", "plan-review", "implement", "impl-review"][n - 1], { startSha: start, commit: null })));
  gw(wt, ["add", "-A"]);
  gw(wt, ["commit", "-q", "-m", "chore(demo): finished run"]);
  const archive = nextIn(wt);
  assert.equal(archive.json.action, "archive", archive.stdout);
  assert.equal(gw(wt, ["log", "-1", "--format=%s"]), PRE_ARCHIVE);

  const res = usage(wt, 4);
  assert.equal(res.status, 0, res.stdout + res.stderr);
  assert.equal(gw(wt, ["log", "-1", "--format=%s"]), MESSAGE);
  assert.equal(gw(wt, ["rev-parse", "--abbrev-ref", "HEAD"]), "agent-smith/demo");
  assert.equal(res.json.commit, gw(wt, ["rev-parse", "--short", "HEAD"]));
  assert.equal(gw(wt, ["status", "--porcelain", "--", CHANGE]), "");
  assert.match(gw(wt, ["show", `HEAD:${CHANGE}/agent-smith/report.md`]), /\| 4 \| impl-review \| .* \| 1200 \|/);

  // The resume path of archiveDone: HEAD is not the pre-archive commit, so it writes the report again, finds nothing to
  // stage and returns the action with commit null; the folder stays clean.
  const head = gw(wt, ["rev-parse", "HEAD"]);
  const again = nextIn(wt);
  assert.equal(again.json.action, "archive", again.stdout);
  assert.equal(again.json.commit, null);
  assert.equal(gw(wt, ["rev-parse", "HEAD"]), head);
  assert.equal(gw(wt, ["status", "--porcelain", "--", CHANGE]), "");
});

test("2.2 an isolated run in the main checkout is refused before writing", { skip }, () => {
  const main = repo();
  const wt = worktree(main);
  assert.equal(run(wt, ["init", wt.id, "--goal", GOAL, "--archive"], { env: gitEnv(wt) }).status, 0);
  writeLog(main, [entry(1, "plan")]);
  writeMetaFile(main, { id: "demo", goal: GOAL, archive: true, isolated: true, branch: "agent-smith/demo", outcome: { action: "done", reason: "ok", manualPending: [] } });
  git(main, ["add", "-A"]);
  git(main, ["commit", "-q", "-m", "state"]);
  const before = snapshot(main.changeDir);
  const res = usage(main, 1);
  assert.equal(res.status, 1, res.stdout);
  assert.match(res.json.reason, /is the main checkout, not the run worktree/);
  assert.deepEqual(snapshot(main.changeDir), before);
});

// ---- 2.3 OpenSpec --archive run ---------------------------------------------------------------

test("2.3 OpenSpec --archive: the commit holds only openspec/changes/demo/ and the committed report shows the figure", { skip }, () => {
  const PASS = "Verdict: PASS\nCritical: 0\nWarnings: 0\n\n## Critical\n\n## Warnings\n";
  const project = makeOpenspecProject({ proposal: true, specs: 1, tasks: { done: 2, open: 0 }, verify: PASS });
  writeLog(project, [entry(1, "os-apply", { template: "os-apply" }), entry(2, "os-verify", { review: { verdict: "PASS", critical: 0, warnings: 0 } })]);
  writeMetaFile(project, { id: "demo", goal: "Add a thing", chain: "openspec", archive: true });
  gitInit(project);
  commitFiles(project, ["README.md"]);
  assert.equal(nextIn(project).json.action, "archive");
  const res = usage(project, 2, [...FLAGS, "--chain", "openspec"]);
  assert.equal(res.status, 0, res.stdout + res.stderr);
  assert.equal(subject(project), "chore(demo): add late usage figure of step 2");
  const names = showNames(project);
  assert.ok(names.length > 0 && names.every((n) => n.startsWith("openspec/changes/demo/")), names.join(", "));
  assert.equal(folderStatus(project), "");
  assert.match(blob(project, "agent-smith/report.md"), /\| 2 \| os-verify \| .* \| 1200 \|/);
});

// Hand-authored invocation evidence, independent of live telemetry availability.
const TREE_EVIDENCE = {
  schemaVersion: 1, status: "verified", scope: "step-tree", source: "codex-rollout", hostVersion: "0.169.0",
  invocation: { host: "codex", rootThreadId: "root", rootTurnId: "turn" },
  sessionCount: 2, requestCount: 4, reconciliation: "response-snapshot",
};
const WAITING_EVIDENCE = {
  schemaVersion: 1, status: "unavailable", scope: "step-tree", source: "codex-rollout", hostVersion: "0.169.0",
  invocation: TREE_EVIDENCE.invocation, reason: "incomplete-capture",
  explanation: "The captured records do not prove complete invocation coverage.",
};

function treeProject(chain) {
  const p = chain === "openspec" ? openspecRun() : running();
  const log = readLogEntries(p);
  log[0].usage = { durationMs: 45, toolUses: 7 };
  log[0].usageEvidence = WAITING_EVIDENCE;
  // Matching descriptions and neutral reruns cannot substitute for the host invocation.
  log[0].neutralRetries = [{ at: 1, note: "repeated description" }];
  writeLog(p, log);
  return p;
}

function treePayload(p, chain, over = {}) {
  const first = readLogEntries(p)[0];
  return { change: p.id, chain, n: 1, step: first.step,
    usage: { totalTokens: 123, durationMs: 45 }, usageEvidence: TREE_EVIDENCE, ...over };
}

function treeFile(p, payload) {
  const file = path.join(p.root, "late-usage.json");
  fs.writeFileSync(file, JSON.stringify(payload));
  return file;
}

for (const chain of ["10x", "openspec"]) {
  test(`${chain}: a finished transcript rechecks the recorded dispatch and enriches it exactly once`, () => {
    const project = chain === "openspec" ? makeOpenspecProject() : makeProject();
    const env = transcriptEnv(project);
    const first = run(project, ["init", project.id, "--goal", "fix typo", "--chain", chain], { env });
    assert.equal(first.json.action, "run", first.stdout);
    const { step, n } = first.json;
    const capture = transcriptFixture({ project, chain, step, n, startedAt: readLogEntries(project).find(row => row.n === n).startedAt });
    const meta = capture.metadata.get("step-agent");
    meta.finished = false;
    Object.assign(capture.main[1].toolUseResult, { totalToolUseCount: 4, totalDurationMs: 50 });
    capture.write();
    if (chain === "10x") writePlan(project, planText());
    else writeArtifacts(project, { proposal: true, specs: 1, tasks: { open: 1 } });
    writeResult(project, { status: "done", note: "finished" });
    const next = run(project, ["next", project.id, "--chain", chain, "--agent-id", "step-agent"], { env });
    assert.equal(next.json.action, "run", next.stdout);
    const statusStep = () => run(project, ["status", project.id, "--chain", chain]).json.steps.find(row => row.n === n);
    const waiting = statusStep();
    assert.equal(waiting.usageEvidence.reason, "incomplete-capture");
    assert.deepEqual(waiting.usage, { toolUses: 4, durationMs: 50 });
    const { collectorInput } = waiting;
    assert.deepEqual(collectorInput, { mode: "transcript", router: { change: project.id, chain, n, step },
      invocation: waiting.usageEvidence.invocation });
    meta.finished = true;
    capture.write();
    const completed = collectInput(project, collectorInput, env);
    assert.equal(completed.usageEvidence.status, "transcript");
    assert.equal(completed.usage.totalTokens, 151);
    const file = treeFile(project, { ...collectorInput.router, usage: { totalTokens: completed.usage.totalTokens },
      usageEvidence: completed.usageEvidence });
    const args = ["--chain", chain, "--usage-file", file];
    assert.equal(usage(project, n, args).json.attached, true);
    assert.equal(statusStep().collectorInput, undefined);
    assert.deepEqual(statusStep().usage, { ...waiting.usage, totalTokens: 151 });
    const bytes = snapshot(project.changeDir);
    assert.equal(usage(project, n, args).json.unchanged, true);
    assert.deepEqual(snapshot(project.changeDir), bytes);
  });

  test(`${chain}: a delayed bound Claude export supplies the recorded step total only once`, () => {
    const project = chain === "openspec" ? openspecRun() : running();
    const log = readLogEntries(project);
    const [first, pending] = log;
    const capture = boundClaudeFixture({ project, chain, n: first.n, step: first.step });
    const checkpoint = claudeCaptureCheckpoint(capture.env);
    const terminal = capture.events.pop();
    capture.write();
    const awaiting = collectClaudeUsage({ ...capture.descriptor, checkpoint }, capture.env);
    assert.equal(awaiting.usageEvidence.reason, "incomplete-capture");
    assert.equal(awaiting.usageEvidence.invocation.sessionId, capture.binding.sessionId);
    assert.equal(awaiting.usage.totalTokens, undefined);
    Object.assign(first, awaiting);
    writeLog(project, log);

    capture.events.push(terminal);
    capture.write();
    const { router } = capture.descriptor;
    const status = run(project, ["status", project.id, "--chain", chain]);
    const { collectorInput } = status.json.steps[0];
    assert.deepEqual(collectorInput, { mode: "telemetry", router, invocation: awaiting.usageEvidence.invocation,
      hostVersion: awaiting.usageEvidence.hostVersion });
    const completed = collectInput(project, collectorInput, capture.env);
    assert.equal(completed.usage.totalTokens, 151);
    assert.equal(completed.usageEvidence.status, "verified");
    const { totalTokens } = completed.usage;
    const file = treeFile(project, { ...router, usage: { totalTokens }, usageEvidence: completed.usageEvidence });
    const args = ["--usage-file", file, "--chain", chain];
    // An exact version match alone cannot qualify a pre-floor telemetry capture.
    const unqualified = { ...completed.usageEvidence, hostVersion: "2.1.310" };
    first.usageEvidence = { ...awaiting.usageEvidence, hostVersion: unqualified.hostVersion };
    writeLog(project, log);
    treeFile(project, { ...router, usage: { totalTokens }, usageEvidence: unqualified });
    const before = snapshot(project.changeDir);
    assert.equal(usage(project, first.n, args).status, 1);
    assert.deepEqual(snapshot(project.changeDir), before);
    first.usageEvidence = awaiting.usageEvidence;
    writeLog(project, log);
    treeFile(project, { ...router, usage: { totalTokens }, usageEvidence: completed.usageEvidence });
    const attached = usage(project, first.n, args);
    assert.equal(attached.status, 0, attached.stdout + attached.stderr);
    assert.equal(attached.json.unchanged, false);
    const [updated, later] = readLogEntries(project);
    assert.deepEqual(updated.usage, { ...awaiting.usage, totalTokens });
    assert.deepEqual(updated.usageEvidence, completed.usageEvidence);
    assert.equal(updated.usageLate, true);
    assert.deepEqual(later, pending);
    const bytes = snapshot(project.changeDir);
    const replay = usage(project, first.n, args);
    assert.equal(replay.json.unchanged, true, replay.stdout);
    assert.deepEqual(snapshot(project.changeDir), bytes);
  });

  test(`${chain}: late transcript totals preserve attribution, counters and identical replay`, () => {
    const p = treeProject(chain);
    const log = readLogEntries(p);
    const capture = transcriptFixture({ project: p, chain, n: 1, step: log[0].step });
    const measure = () => collectClaudeUsage(capture.descriptor, capture.env);
    fs.unlinkSync(path.join(capture.directory, "agent-step-agent.jsonl"));
    const waiting = measure();
    assert.equal(waiting.usageEvidence.reason, "missing-source");
    capture.write();
    const { usage: { totalTokens }, usageEvidence: measured } = measure();
    assert.equal(measured.status, "transcript");
    assert.equal(totalTokens, 151);
    assert.deepEqual(waiting.usageEvidence.invocation, measured.invocation);
    assert.equal(waiting.usageEvidence.hostVersion, measured.hostVersion);
    const attach = (usageEvidence, tokens = totalTokens) => usage(p, 1, ["--usage-file",
      treeFile(p, treePayload(p, chain, { usage: { totalTokens: tokens }, usageEvidence })), "--chain", chain]);

    const returned = capture.main[1].toolUseResult;
    returned.agentId = "contradictory";
    capture.write();
    const noIdentity = measure();
    assert.equal(noIdentity.usageEvidence.invocation, undefined);
    assert.equal(noIdentity.usageEvidence.hostVersion, measured.hostVersion);
    returned.agentId = measured.invocation.agentId;
    fs.writeFileSync(capture.mainFile, "");
    const noVersion = measure();
    assert.deepEqual(noVersion.usageEvidence.invocation, measured.invocation);
    assert.equal(noVersion.usageEvidence.hostVersion, "unknown");
    for (const incomplete of [noIdentity, noVersion]) {
      Object.assign(log[0], incomplete);
      writeLog(p, log);
      const before = snapshot(p.changeDir);
      assert.equal(attach(measured).status, 1);
      assert.deepEqual(snapshot(p.changeDir), before);
    }

    Object.assign(log[0], waiting);
    writeLog(p, log);
    const before = snapshot(p.changeDir);
    for (const over of [{ invocation: { ...measured.invocation, runId: "other" } }, { hostVersion: "2.1.324" },
      { source: "claude-native", status: "verified", reconciliation: "request-records" }]) {
      assert.equal(attach({ ...measured, ...over }).status, 1);
      assert.deepEqual(snapshot(p.changeDir), before);
    }
    const attached = attach(measured);
    assert.equal(attached.status, 0, attached.stdout);
    assert.deepEqual(attached.json.usage, { ...waiting.usage, totalTokens });
    assert.deepEqual(readLogEntries(p).slice(1), log.slice(1));
    assert.deepEqual(attached.json.usageEvidence, measured);
    const after = snapshot(p.changeDir);
    assert.equal(attach(measured).json.unchanged, true);
    assert.equal(attach(measured, 1).status, 1);
    assert.equal(attach({ ...measured, requestCount: 3 }).status, 1);
    assert.deepEqual(snapshot(p.changeDir), after);
  });

  test(`${chain}: structured late tokens fill duration-only usage once for the exact invocation`, () => {
    const p = treeProject(chain);
    const pending = readLogEntries(p)[1];
    const file = treeFile(p, treePayload(p, chain));
    const args = ["--usage-file", file, "--chain", chain];
    const res = usage(p, 1, args);
    assert.equal(res.status, 0, res.stdout);
    assert.equal(res.json.unchanged, false);
    const [first, later] = readLogEntries(p);
    assert.deepEqual(first.usage, { durationMs: 45, toolUses: 7, totalTokens: 123 });
    assert.deepEqual(first.usageEvidence, TREE_EVIDENCE);
    assert.deepEqual(later, pending);
    const bytes = snapshot(p.changeDir);
    const replay = usage(p, 1, args);
    assert.equal(replay.json.unchanged, true, replay.stdout);
    assert.deepEqual(snapshot(p.changeDir), bytes);
  });

  test(`${chain}: late verification removes the usage limitation from an ended run's report`, () => {
    const project = chain === "openspec" ? makeOpenspecProject() : makeProject();
    const step = chain === "openspec" ? "os-propose" : "plan";
    seedRun(project, [entry(1, step, { provider: "openai", usage: { durationMs: 45 },
      usageEvidence: unavailableEvidence("missing-source", TREE_EVIDENCE) })],
    { chain, host: "codex", providerMode: "codex", outcome: { action: "done" } });
    const status = run(project, ["status", project.id, "--report", "--chain", chain]);
    assert.equal(status.status, 0, status.stdout + status.stderr);
    assert.match(readReportFile(project), /^Token capture limitations: Codex usage source unavailable \(1 step\)$/m);
    assert.match(readReportFile(project), /Tokens: - \(figures for 0 of 1 steps\)/);

    const file = treeFile(project, treePayload(project, chain));
    const result = usage(project, 1, ["--usage-file", file, "--chain", chain]);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(result.json.report, status.json.report);
    const refreshed = readReportFile(project);
    assert.doesNotMatch(refreshed, /^Token capture limitations:/m);
    assert.match(refreshed, /Tokens: 123 \(figures for 1 of 1 steps\)/);
    assert.match(refreshed, /Verified observed host usage: 1 · Unavailable: 0/);
  });

  test(`${chain}: structured late refusals preserve every run file and legacy flags cannot bypass evidence`, () => {
    const p = treeProject(chain);
    const payload = treePayload(p, chain);
    const before = snapshot(p.changeDir);
    for (const over of [
      { change: "another" }, { chain: chain === "10x" ? "openspec" : "10x" },
      { n: 2 }, { step: "same description" },
      { usageEvidence: { ...TREE_EVIDENCE, invocation: { ...TREE_EVIDENCE.invocation, rootTurnId: "other-turn" } } },
      { usageEvidence: { ...TREE_EVIDENCE, schemaVersion: 2 } },
      { usageEvidence: { ...TREE_EVIDENCE, hostVersion: "0.170.0" } },
      { usageEvidence: { ...TREE_EVIDENCE, source: "unknown" } },
      { usageEvidence: WAITING_EVIDENCE },
      { usageEvidence: { ...TREE_EVIDENCE, invocation: undefined } },
      { usage: { totalTokens: 123, durationMs: 46 } },
      { usage: { totalTokens: 123, toolUses: 8 } },
      { usage: { totalTokens: Number.MAX_SAFE_INTEGER + 1 } },
      { usage: { totalTokens: 123, raw: "ignored" } },
    ]) {
      const file = treeFile(p, { ...payload, ...over });
      const res = usage(p, 1, ["--usage-file", file, "--chain", chain]);
      assert.equal(res.status, 1, JSON.stringify(over) + res.stdout);
      assert.deepEqual(snapshot(p.changeDir), before);
    }
    const file = treeFile(p, payload);
    for (const extra of [["--tokens", "123"], ["--tool-uses", "7"], ["--duration-ms", "45"]]) {
      const res = usage(p, 1, ["--usage-file", file, ...extra]);
      assert.equal(res.status, 1, res.stdout);
      assert.deepEqual(snapshot(p.changeDir), before);
    }
    assert.equal(usage(p, 1, ["--tokens", "123"]).status, 1);
    assert.deepEqual(snapshot(p.changeDir), before);
    assert.equal(usage(p, 2, ["--usage-file", file]).status, 1);
    assert.deepEqual(snapshot(p.changeDir), before);
    fs.writeFileSync(file, "x".repeat(65537));
    const oversized = usage(p, 1, ["--usage-file", file]);
    assert.equal(oversized.status, 1, oversized.stdout);
    assert.doesNotMatch(oversized.stdout, /x{20}/);
    assert.deepEqual(snapshot(p.changeDir), before);
  });

  test(`${chain}: structured late input cannot upgrade legacy attribution or fill other missing counters`, () => {
    const p = treeProject(chain);
    const log = readLogEntries(p);
    delete log[0].usageEvidence;
    writeLog(p, log);
    const payload = treePayload(p, chain);
    const file = treeFile(p, payload);
    const before = snapshot(p.changeDir);
    assert.equal(usage(p, 1, ["--usage-file", file]).status, 1);
    assert.deepEqual(snapshot(p.changeDir), before);
    log[0].usageEvidence = WAITING_EVIDENCE;
    delete log[0].usage.toolUses;
    writeLog(p, log);
    treeFile(p, { ...payload, usage: { totalTokens: 123, toolUses: 7 } });
    const missing = snapshot(p.changeDir);
    assert.equal(usage(p, 1, ["--usage-file", file]).status, 1);
    assert.deepEqual(snapshot(p.changeDir), missing);
  });

  test(`${chain}: verified zero can arrive late, but neither that total nor its evidence can be replaced`, () => {
    const p = treeProject(chain);
    const payload = treePayload(p, chain, { usage: { totalTokens: 0 } });
    const file = treeFile(p, payload);
    assert.equal(usage(p, 1, ["--usage-file", file]).status, 0);
    assert.equal(readLogEntries(p)[0].usage.totalTokens, 0);
    const before = snapshot(p.changeDir);
    for (const over of [{ usage: { totalTokens: 1 } }, { usageEvidence: { ...TREE_EVIDENCE, requestCount: 5 } }]) {
      treeFile(p, { ...payload, ...over });
      assert.equal(usage(p, 1, ["--usage-file", file]).status, 1);
      assert.deepEqual(snapshot(p.changeDir), before);
    }
  });
}


for (const chain of ["10x", "openspec"]) {
  test(`${chain}: structured file redirects and archived targets refuse without changing run files`, () => {
    const p = treeProject(chain);
    const file = treeFile(p, treePayload(p, chain));
    const link = path.join(p.root, "late-redirect.json");
    fs.symlinkSync(file, link);
    const before = snapshot(p.changeDir);
    const res = usage(p, 1, ["--usage-file", link, "--chain", chain]);
    assert.equal(res.status, 1, res.stdout);
    assert.deepEqual(snapshot(p.changeDir), before);
    if (chain === "10x") {
      fs.writeFileSync(path.join(p.changeDir, "change.md"), "---\nchange_id: demo\nstatus: archived\n---\n");
      const stamped = snapshot(p.changeDir);
      assert.equal(usage(p, 1, ["--usage-file", file]).status, 1);
      assert.deepEqual(snapshot(p.changeDir), stamped);
    } else {
      const target = moveToArchive(p);
      const archived = snapshot(target);
      assert.equal(usage(p, 1, ["--usage-file", file, "--chain", chain]).status, 1);
      assert.deepEqual(snapshot(target), archived);
    }
  });
}
