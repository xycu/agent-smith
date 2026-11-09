// The `usage` command (late-step-usage): attaches a usage figure that reached the orchestrator after `next` ran to an
// executed step of either chain. Black-box through the CLI in scratch projects; isolated runs use real linked worktrees
// and hermetic git, as in rollback.test.mjs. Test names start with the plan row number.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  cleanupAll, makeProject, run, git, gitAvailable, gitEnv, gitInit, writeResult, writeLog, writeMetaFile, writePlan,
  writeReview, readLogEntries, readMetaFile, readReportFile, entry, planText,
} from "./helpers.mjs";
import { makeOpenspecProject, moveToArchive } from "./openspec-helpers.mjs";

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

const usage = (project, n, extra = FLAGS) => run(project, ["usage", project.id, ...(n === null ? [] : [String(n)]), ...extra]);

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
  writeLog(project, [{ skipped: true, step: "research", reason: "fixture", rigor: "lean", afterN: 0, at: 1 }, entry(1, "plan")]);
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
  assert.match(report, /\| 2 \| plan-review \| sonnet \| high \| 3 \| no \| ok \| 1200 \|/);
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
  assert.match(report, /\| 2 \| plan-review \| sonnet \| high \| 3 \| no \| ok \| 500000 \| \$3\.0000 \|/);
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
  const init = run(wt, ["init", wt.id, "--goal", GOAL], { env: gitEnv(wt) });
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

// ---- 1.9 interim archive-state refusal --------------------------------------------------------

test("1.9 an ended archive run is refused before anything is written until the archive branch exists", () => {
  const project = ended("done");
  writeMetaFile(project, { id: "demo", goal: "fix typo", archive: true, rigor: { level: "standard" }, outcome: { action: "done", reason: "ok", manualPending: [] } });
  const before = snapshot(project.changeDir);
  const res = usage(project, 2);
  assert.equal(res.status, 1, res.stdout);
  assert.equal(res.json.reason, "The run is in the archive state; a late figure there needs the folder commit of the archive branch.");
  assert.deepEqual(snapshot(project.changeDir), before);
});
