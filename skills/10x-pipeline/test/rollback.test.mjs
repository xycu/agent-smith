// Failed-step rollback (worktree-step-commits, Phase 4): a failed step of an isolated run is snapshotted under
// refs/agent-smith/<id>/<run token>/failed-<n> and the worktree is reset to its startSha before the next step is decided; a halt
// in the same call undoes the reset. Real linked worktrees in scratch repositories, hermetic git.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  cleanupAll, makeProject, run, git, gitAvailable, gitEnv, gitInit, writeResult, writeLog, writeMetaFile,
  readLogEntries, readReportFile, entry, planText
} from "./helpers.mjs";
import { writePlan, writeReview } from "./ahead.mjs";

after(cleanupAll);

const GOAL = "Add a retry counter to the status output so the report shows how often each step ran again";
const ON = { isolation: { require: true } };
const skip = !gitAvailable() && "git is not available";
// The side ref of step n: refs/agent-smith/<id>/<run token>/failed-<n>, the token being the first 12 hex characters
// of meta.startCommit, or of the first logged startSha when init staged nothing.
const runToken = (project) => {
  const meta = JSON.parse(fs.readFileSync(path.join(project.agentDir, "meta.json"), "utf8"));
  const sha = typeof meta.startCommit === "string" ? meta.startCommit : readLogEntries(project).find((e) => e.startSha)?.startSha;
  return String(sha).slice(0, 12);
};
const REF = (project, n) => `refs/agent-smith/demo/${runToken(project)}/failed-${n}`;

function repo({ policy = ON } = {}) {
  const project = makeProject({ policy });
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
const initIn = (project, extra = []) => run(project, ["init", project.id, "--goal", GOAL, ...extra], { env: gitEnv(project) });
const nextIn = (project) => run(project, ["next", project.id], { env: gitEnv(project) });
const head = (wt) => gw(wt, ["rev-parse", "HEAD"]);
const refExists = (wt, ref) => spawnSync("git", ["-C", wt.top, "rev-parse", "-q", "--verify", ref], { env: gitEnv(wt) }).status === 0;
const ancestor = (wt, a, b) => spawnSync("git", ["-C", wt.top, "merge-base", "--is-ancestor", a, b], { env: gitEnv(wt) }).status === 0;
const showFile = (wt, rev, rel) => gw(wt, ["show", `${rev}:${rel}`]);
const status = (wt) => gw(wt, ["status", "--porcelain", "--untracked-files=all"]).split("\n").filter(Boolean);
// `git` output is trimmed, so the first line can lose the leading blank of its status code.
const routerOnly = (wt) => status(wt).every((line) => /^\S{1,2} context\/changes\/demo\/agent-smith\//.test(line));
const at = (file) => fs.statSync(file).mtimeMs;
const near = (a, b) => Math.abs(a - b) < 2;
const touch = (file, ms) => fs.utimesSync(file, ms / 1000, ms / 1000);
const CHANGE = "context/changes/demo";
const PLAN_REVIEW = (wt) => path.join(wt.changeDir, "reviews/plan-review.md");
const IMPL_REVIEW = (wt) => path.join(wt.changeDir, "reviews/impl-review.md");

function freshRun(extra = []) {
  const main = repo();
  const wt = worktree(main);
  const res = initIn(wt, extra);
  assert.equal(res.status, 0, res.stdout + res.stderr);
  return { main, wt, res };
}

// Plan ok, plan review ok: the run waits for the result of its first implement step.
function toImplement(wt, plan) {
  writePlan(wt, plan);
  writeResult(wt, { status: "done", note: "planned" });
  const review = nextIn(wt);
  assert.equal(review.json.step, "plan-review", review.stdout);
  writeReview(wt, "plan-review", { verdict: "SOUND" });
  writeResult(wt, { status: "done", note: "reviewed" });
  const impl = nextIn(wt);
  assert.equal(impl.json.step, "implement", impl.stdout);
  return impl;
}

test("4.1 a failed step is snapshotted with untracked files and reset to startSha; router files stay intact", { skip }, () => {
  const { wt } = freshRun();
  const start = head(wt);
  writePlan(wt, planText({ phases: 1 }));
  fs.mkdirSync(path.join(wt.top, "src"), { recursive: true });
  fs.writeFileSync(path.join(wt.top, "src/new.js"), "export const half = 1;\n");
  fs.appendFileSync(path.join(wt.changeDir, "change.md"), "half-done edit\n");
  writeResult(wt, { status: "failed", note: "ran out of road" });
  const res = nextIn(wt);
  assert.equal(res.status, 0, res.stdout + res.stderr);
  assert.equal(res.json.action, "run");
  assert.equal(res.json.step, "plan");
  // The side ref holds the partial files; its parent is the head the step left.
  assert.ok(refExists(wt, REF(wt, 1)));
  assert.equal(showFile(wt, REF(wt, 1), "src/new.js"), "export const half = 1;");
  assert.match(showFile(wt, REF(wt, 1), `${CHANGE}/plan.md`), /## Progress/);
  assert.match(showFile(wt, REF(wt, 1), `${CHANGE}/change.md`), /half-done edit/);
  assert.equal(gw(wt, ["rev-parse", `${REF(wt, 1)}^`]), start);
  assert.equal(gw(wt, ["log", "-1", "--format=%s", REF(wt, 1)]), "agent-smith: failed step 1 (plan)");
  // The worktree is at startSha.
  assert.equal(head(wt), start);
  assert.equal(fs.existsSync(path.join(wt.top, "src/new.js")), false);
  assert.equal(fs.existsSync(wt.planFile), false);
  assert.doesNotMatch(fs.readFileSync(path.join(wt.changeDir, "change.md"), "utf8"), /half-done edit/);
  assert.ok(routerOnly(wt), status(wt).join(", "));
  // Router state is intact and the entry says rolledBack.
  const entries = readLogEntries(wt);
  assert.equal(entries.length, 2);
  assert.equal(entries[0].result.note, "ran out of road");
  assert.equal(entries[0].rolledBack, REF(wt, 1));
  assert.equal(entries[1].startSha, start);
  // status and report.md list the rolled-back step.
  const st = run(wt, ["status", "demo", "--report"], { env: gitEnv(wt) });
  assert.equal(st.json.steps[0].rolledBack, REF(wt, 1));
  assert.match(readReportFile(wt), /^## Rolled-back steps$/m);
  assert.match(readReportFile(wt), new RegExp(`^- step 1 plan: \`${REF(wt, 1)}\` rolled back to ${start.slice(0, 7)}$`, "m"));
});

test("4.1 the side ref carries the run token: an earlier run's ref of the same id and step stays as it was", { skip }, () => {
  const { wt } = freshRun();
  const meta = JSON.parse(fs.readFileSync(path.join(wt.agentDir, "meta.json"), "utf8"));
  assert.match(meta.startCommit, /^[0-9a-f]{40,64}$/);
  // A ref an earlier run of change `demo` left for its step 1, under its own token.
  const earlier = "refs/agent-smith/demo/aaaaaaaaaaaa/failed-1";
  const old = head(wt);
  gw(wt, ["update-ref", earlier, old]);
  fs.writeFileSync(path.join(wt.top, "partial.txt"), "half\n");
  writeResult(wt, { status: "failed", note: "x" });
  const res = nextIn(wt);
  assert.equal(res.json.step, "plan", res.stdout);
  const ref = readLogEntries(wt)[0].rolledBack;
  assert.equal(ref, `refs/agent-smith/demo/${meta.startCommit.slice(0, 12)}/failed-1`);
  assert.equal(showFile(wt, ref, "partial.txt"), "half");
  assert.equal(gw(wt, ["rev-parse", earlier]), old, "the earlier run's ref is not overwritten");
});

test("4.1 an isolated run that cannot read the start commit of a step halts before logging it", { skip }, () => {
  // meta.isolated in a project that is not a git repository: rev-parse HEAD fails, so the step would have no startSha.
  const project = makeProject({ policy: ON });
  writeMetaFile(project, { id: "demo", goal: GOAL, isolated: true, branch: "agent-smith/demo", startCommit: null });
  writeLog(project, [entry(1, "plan", { commit: null, ok: true, verified: true, result: { status: "done", note: "ok" } })]);
  writePlan(project, planText({ phases: 1 }));
  const res = nextIn(project);
  assert.equal(res.json.action, "halt", res.stdout);
  assert.match(res.json.reason, /^Cannot read the start commit of step 2 \(plan-review\) of an isolated run: git rev-parse HEAD failed: .+\. Fix git in the run worktree, then run next again\.$/);
  assert.equal(readLogEntries(project).length, 1, "the step is not logged");
});

test("4.1 a failed step that left a staged file is snapshotted with it", { skip }, () => {
  const { wt } = freshRun();
  fs.writeFileSync(path.join(wt.top, "staged.txt"), "staged by the step\n");
  gw(wt, ["add", "staged.txt"]);
  writeResult(wt, { status: "failed", note: "hook said no" });
  const res = nextIn(wt);
  assert.equal(res.json.action, "run", res.stdout);
  assert.equal(showFile(wt, REF(wt, 1), "staged.txt"), "staged by the step");
  assert.equal(fs.existsSync(path.join(wt.top, "staged.txt")), false);
  gw(wt, ["diff", "--cached", "--quiet"]);
});

test("rollback refuses markerless unmerged entries before creating a snapshot", { skip }, () => {
  const { wt } = freshRun();
  const file = path.join(wt.top, "conflict.txt");
  const content = "conflicting version\n";
  fs.writeFileSync(file, content);
  const ours = gw(wt, ["rev-parse", `HEAD:${CHANGE}/change.md`]);
  const theirs = gw(wt, ["hash-object", "-w", file]);
  const conflict = spawnSync("git", ["update-index", "--index-info"], {
    cwd: wt.top, env: gitEnv(wt), encoding: "utf8",
    input: `100644 ${ours} 2\tconflict.txt\n100644 ${theirs} 3\tconflict.txt\n`,
  });
  assert.equal(conflict.status, 0, conflict.stderr);
  const index = gw(wt, ["rev-parse", "--path-format=absolute", "--git-path", "index"]);
  const before = fs.readFileSync(index);
  const start = head(wt);
  const refs = gw(wt, ["for-each-ref", "refs/agent-smith/"]);
  writeResult(wt, { status: "failed", note: "left an unmerged index" });
  const res = nextIn(wt);
  assert.equal(res.json.action, "halt", res.stdout);
  assert.match(res.json.reason, /Rollback of step 1 \(plan\): The index holds unmerged entries/);
  assert.deepEqual(fs.readFileSync(index), before);
  assert.equal(head(wt), start);
  assert.equal(fs.readFileSync(file, "utf8"), content);
  assert.equal(gw(wt, ["for-each-ref", "refs/agent-smith/"]), refs);
});

test("rollback retry retains an interrupted index snapshot in the recovery ancestry", { skip }, () => {
  const { wt } = freshRun();
  fs.writeFileSync(path.join(wt.top, "staged.txt"), "original staged bytes\n");
  gw(wt, ["add", "staged.txt"]);
  const saved = gw(wt, ["commit-tree", gw(wt, ["write-tree"]), "-p", "HEAD", "-m", "saved index"]);
  gw(wt, ["update-ref", REF(wt, 1), saved]);
  // An interrupted rollback already replaced the index with the working copy.
  fs.writeFileSync(path.join(wt.top, "staged.txt"), "working bytes\n");
  gw(wt, ["add", "staged.txt"]);
  writeResult(wt, { status: "failed", note: "retry interrupted snapshot" });
  const res = nextIn(wt);
  assert.equal(res.json.action, "run", res.stdout);
  assert.ok(ancestor(wt, saved, REF(wt, 1)));
  assert.equal(showFile(wt, saved, "staged.txt"), "original staged bytes");
  assert.equal(showFile(wt, REF(wt, 1), "staged.txt"), "working bytes");
});

test("4.1 a failed implement that ticked every row is followed by implement, from the restored plan", { skip }, () => {
  const { wt } = freshRun();
  toImplement(wt, planText({ phases: 2 }));
  const start = readLogEntries(wt)[2].startSha;
  assert.equal(start, head(wt));
  writePlan(wt, planText({ phases: 2, done: 2 }));
  writeResult(wt, { status: "failed", note: "tests red" });
  const res = nextIn(wt);
  assert.equal(res.json.action, "run", res.stdout);
  assert.equal(res.json.step, "implement");
  const entries = readLogEntries(wt);
  assert.equal(entries[2].rolledBack, REF(wt, 3));
  assert.equal(entries[3].step, "implement");
  assert.equal(entries[3].before.autoDone, 0);
  assert.equal(head(wt), start);
});

test("4.1 commits the failed step made itself leave the branch and stay reachable from the side ref", { skip }, () => {
  const { wt } = freshRun();
  toImplement(wt, planText({ phases: 2 }));
  const start = head(wt);
  // Phase 1 committed by the step, with its row ticked; phase 2 failed.
  fs.writeFileSync(path.join(wt.top, "a.js"), "export const a = 1;\n");
  writePlan(wt, planText({ phases: 2, done: 1 }));
  gw(wt, ["add", "-A"]);
  gw(wt, ["commit", "-q", "-m", "feat(demo): phase 1 (p1)"]);
  const phase = head(wt);
  fs.writeFileSync(path.join(wt.top, "b.js"), "export const b = 'half';\n");
  writeResult(wt, { status: "failed", note: "phase 2 red" });
  const res = nextIn(wt);
  assert.equal(res.json.step, "implement", res.stdout);
  assert.equal(head(wt), start);
  assert.ok(ancestor(wt, phase, REF(wt, 3)), "the phase commit is an ancestor of the side ref");
  assert.equal(gw(wt, ["rev-parse", `${REF(wt, 3)}^`]), phase);
  assert.equal(fs.existsSync(path.join(wt.top, "a.js")), false);
  assert.equal(readLogEntries(wt)[3].before.autoDone, 0);
});

test("4.1 a failed first step keeps the inputs the start commit holds", { skip }, () => {
  const main = repo();
  const wt = worktree(main);
  fs.writeFileSync(path.join(wt.changeDir, "research.md"), "---\nstatus: complete\n---\n# Research\n");
  fs.appendFileSync(path.join(wt.changeDir, "change.md"), "\nNotes copied from the main checkout.\n");
  assert.equal(initIn(wt).status, 0);
  writeResult(wt, { status: "failed", note: "no plan" });
  const res = nextIn(wt);
  assert.equal(res.json.action, "run", res.stdout);
  assert.equal(readLogEntries(wt)[0].rolledBack, REF(wt, 1));
  assert.match(fs.readFileSync(path.join(wt.changeDir, "research.md"), "utf8"), /status: complete/);
  assert.match(fs.readFileSync(path.join(wt.changeDir, "change.md"), "utf8"), /Notes copied from the main checkout/);
});

test("4.1 a run that starts with a reviewed plan: a rolled-back implement keeps the review fresh", { skip }, () => {
  const main = repo();
  const wt = worktree(main);
  writePlan(wt, planText({ phases: 1 }));
  writeReview(wt, "plan-review", { verdict: "SOUND" });
  touch(wt.planFile, Date.parse("2026-01-01T10:00:00Z"));
  touch(PLAN_REVIEW(wt), Date.parse("2026-01-01T11:00:00Z"));
  const first = initIn(wt);
  assert.equal(first.status, 0, first.stdout + first.stderr);
  assert.equal(first.json.step, "implement");
  writePlan(wt, planText({ phases: 1, done: 1 }));
  writeResult(wt, { status: "failed", note: "red" });
  const res = nextIn(wt);
  assert.equal(res.json.step, "implement", res.stdout);
  assert.ok(near(at(wt.planFile), Date.parse("2026-01-01T10:00:00Z")));
});

test("4.1 a run that starts with a stale review: a rolled-back plan review that rewrote it runs again", { skip }, () => {
  const main = repo();
  const wt = worktree(main);
  writePlan(wt, planText({ phases: 1 }));
  writeReview(wt, "plan-review", { verdict: "SOUND" });
  touch(PLAN_REVIEW(wt), Date.parse("2026-01-01T10:00:00Z"));
  touch(wt.planFile, Date.parse("2026-01-01T11:00:00Z"));
  const first = initIn(wt);
  assert.equal(first.status, 0, first.stdout + first.stderr);
  assert.equal(first.json.step, "plan-review");
  writeReview(wt, "plan-review", { verdict: "REVISE" });
  writeResult(wt, { status: "failed", note: "review cut short" });
  const res = nextIn(wt);
  assert.equal(res.json.step, "plan-review", res.stdout);
  assert.ok(near(at(PLAN_REVIEW(wt)), Date.parse("2026-01-01T10:00:00Z")));
  assert.match(fs.readFileSync(PLAN_REVIEW(wt), "utf8"), /SOUND/);
});

test("4.1 a failed tdd entry with uncommitted rows is not reset; implement-retry sees its ticks", { skip }, () => {
  const { wt } = freshRun();
  const start = head(wt);
  writePlan(wt, planText({ phases: 1, done: 1 }));
  writeReview(wt, "plan-review", { verdict: "SOUND" });
  fs.writeFileSync(path.join(wt.top, "code.js"), "export const x = 1;\n");
  writeLog(wt, [
    entry(1, "plan", { startSha: start, commit: null }),
    entry(2, "plan-review", { startSha: start, commit: null }),
    entry(3, "implement", {
      template: "implement-tdd", startSha: start, executor: "tdd", phase: 1, lastPhase: 1,
      before: { autoDone: 0, head: start, done: [] }, ok: false, verified: false, uncommitted: ["1.1"],
    }),
  ]);
  const res = nextIn(wt);
  assert.equal(res.json.action, "run", res.stdout);
  assert.equal(res.json.step, "implement");
  assert.match(res.json.reason, /ticked without a code commit \(1\.1\)/);
  assert.equal(readLogEntries(wt)[3].template, "implement-retry");
  assert.equal(Object.hasOwn(readLogEntries(wt)[2], "rolledBack"), false);
  assert.equal(refExists(wt, REF(wt, 3)), false);
  assert.ok(fs.existsSync(path.join(wt.top, "code.js")));
  assert.match(fs.readFileSync(wt.planFile, "utf8"), /- \[x\] 1\.1/);
});

test("4.1 a second implement failure followed by plan-replan is reset", { skip }, () => {
  const { wt } = freshRun(["--rigor", "standard"]);
  toImplement(wt, planText({ phases: 1 }));
  fs.writeFileSync(path.join(wt.top, "one.js"), "1\n");
  writeResult(wt, { status: "failed", note: "first" });
  assert.equal(nextIn(wt).json.step, "implement");
  const start = head(wt);
  fs.writeFileSync(path.join(wt.top, "two.js"), "2\n");
  writeResult(wt, { status: "failed", note: "second" });
  const res = nextIn(wt);
  assert.equal(res.json.action, "run", res.stdout);
  assert.equal(readLogEntries(wt)[4].template, "plan-replan");
  assert.equal(readLogEntries(wt)[3].rolledBack, REF(wt, 4));
  assert.equal(head(wt), start);
  assert.equal(fs.existsSync(path.join(wt.top, "two.js")), false);
  assert.equal(showFile(wt, REF(wt, 4), "two.js"), "2");
});

test("4.1 the failure that hits the attempt cap halts with its partial edits back, kept, and is not reset again", { skip }, () => {
  const { wt } = freshRun();
  for (let n = 1; n <= 2; n++) {
    writeResult(wt, { status: "failed", note: `attempt ${n}` });
    assert.equal(nextIn(wt).json.step, "plan");
  }
  const start = head(wt);
  // The third attempt leaves partial edits and the three files decide compares, with known times.
  writePlan(wt, planText({ phases: 1 }));
  writeReview(wt, "plan-review", { verdict: "SOUND" });
  writeReview(wt, "impl-review", { verdict: "APPROVED" });
  const times = { plan: Date.parse("2026-02-01T10:00:00Z"), planReview: Date.parse("2026-02-02T10:00:00Z"), implReview: Date.parse("2026-02-03T10:00:00Z") };
  touch(wt.planFile, times.plan);
  touch(PLAN_REVIEW(wt), times.planReview);
  touch(IMPL_REVIEW(wt), times.implReview);
  fs.writeFileSync(path.join(wt.top, "new.txt"), "added by attempt 3\n");
  fs.appendFileSync(path.join(wt.changeDir, "change.md"), "edited by attempt 3\n");
  writeResult(wt, { status: "failed", note: "attempt 3" });
  const res = nextIn(wt);
  assert.equal(res.json.action, "halt", res.stdout);
  assert.match(res.json.reason, /plan failed 3 times in a row/);
  // The branch is at the head the failed step left and the worktree holds the partial edits.
  assert.equal(head(wt), start);
  assert.ok(refExists(wt, REF(wt, 3)));
  assert.ok(fs.existsSync(path.join(wt.top, "new.txt")));
  assert.ok(status(wt).includes("?? new.txt"), status(wt).join(", "));
  assert.match(fs.readFileSync(path.join(wt.changeDir, "change.md"), "utf8"), /edited by attempt 3/);
  assert.ok(near(at(wt.planFile), times.plan));
  assert.ok(near(at(PLAN_REVIEW(wt)), times.planReview));
  assert.ok(near(at(IMPL_REVIEW(wt)), times.implReview));
  const entries = readLogEntries(wt);
  assert.equal(entries.length, 3);
  assert.equal(entries[2].kept, REF(wt, 3));
  assert.equal(Object.hasOwn(entries[2], "rolledBack"), false);
  assert.match(readReportFile(wt), new RegExp(`^- step 3 plan: \`${REF(wt, 3)}\` kept \\(run halted\\)$`, "m"));
  // A later next does not reset again: the kept edits (a plan and a clean review) decide the next step.
  const again = nextIn(wt);
  assert.equal(again.json.action, "run", again.stdout);
  assert.equal(again.json.step, "implement");
  assert.ok(fs.existsSync(path.join(wt.top, "new.txt")));
  assert.equal(readLogEntries(wt)[2].kept, REF(wt, 3));
});

test("4.1 a router error after the rollback undoes it: partial edits back, entry kept", { skip }, () => {
  const { wt } = freshRun();
  toImplement(wt, planText({ phases: 1, rowsPerPhase: 2 }));
  const start = head(wt);
  fs.writeFileSync(path.join(wt.top, "partial.txt"), "partial work\n");
  // A malformed complexity block makes the tier math throw after the rollback ran.
  const override = path.join(wt.top, "context/foundation/agent-smith-policy.json");
  const current = JSON.parse(fs.readFileSync(override, "utf8"));
  fs.writeFileSync(override, JSON.stringify({ ...current, complexity: { appliesTo: null } }));
  writeResult(wt, { status: "failed", note: "boom" });
  const res = nextIn(wt);
  assert.equal(res.json.action, "halt", res.stdout);
  assert.match(res.json.reason, /^Router error: .*The rollback of the failed step was undone/);
  assert.equal(head(wt), start);
  assert.ok(fs.existsSync(path.join(wt.top, "partial.txt")));
  const last = readLogEntries(wt).at(-1);
  assert.equal(last.kept, REF(wt, last.n));
  assert.equal(Object.hasOwn(last, "rolledBack"), false);
});

// The injector lives in the main fixture, outside the linked worktree that rollback resets.
function gitFailingUndo(wt, ref, start, reset) {
  const real = spawnSync("sh", ["-c", "command -v git"], { encoding: "utf8" });
  assert.equal(real.status, 0, real.stderr);
  const bin = path.join(wt.base, "undo-bin");
  fs.mkdirSync(bin);
  const marker = path.join(bin, "invocations");
  fs.writeFileSync(path.join(bin, "git"), [
    "#!/bin/sh",
    `case " $* " in`,
    `  *" reset -q --hard $UNDO_START ")`,
    `    "$UNDO_REAL_GIT" "$@" || exit $?`,
    `    printf "rollback %s\\n" "$("$UNDO_REAL_GIT" rev-parse HEAD)" >> "$UNDO_MARKER"`,
    "    exit 0;;",
    "  *' reset -q '*)",
    `    snapshot=$("$UNDO_REAL_GIT" rev-parse --verify "$UNDO_REF") || exit $?`,
    '    if [ "$UNDO_RESET" = "hard" ]; then target="reset -q --hard $snapshot"; else target="reset -q $snapshot^"; fi',
    '    case " $* " in',
    '      *" $target ")',
    `        printf "undo %s\\n" "$snapshot" >> "$UNDO_MARKER"`,
    `        echo "fatal: injected undo reset failure" >&2`,
    "        exit 128;;",
    "    esac;;",
    "esac",
    `exec "$UNDO_REAL_GIT" "$@"`,
    "",
  ].join("\n"), { mode: 0o755 });
  return {
    marker,
    env: {
      ...gitEnv(wt), PATH: `${bin}${path.delimiter}${process.env.PATH}`,
      UNDO_REAL_GIT: real.stdout.trim(), UNDO_REF: ref, UNDO_START: start, UNDO_MARKER: marker,
      UNDO_RESET: reset,
    },
  };
}

for (const caller of ["attempt-cap", "router-error"]) {
  for (const reset of ["hard", "mixed"]) {
    test(`4.1 failed undo: ${caller}, ${reset} reset retains recovery text and snapshot`, { skip: skip || process.platform === "win32" }, () => {
      const { wt } = freshRun();
      if (caller === "attempt-cap") {
        for (let n = 1; n <= 2; n++) {
          writeResult(wt, { status: "failed", note: `attempt ${n}` });
          assert.equal(nextIn(wt).json.step, "plan");
        }
      } else {
        toImplement(wt, planText({ phases: 1, rowsPerPhase: 2 }));
      }
      const start = readLogEntries(wt).at(-1).startSha;
      assert.equal(head(wt), start);
      // Distinguish the step start from the HEAD its failed work leaves.
      fs.writeFileSync(path.join(wt.top, "committed.txt"), "committed before failure\n");
      gw(wt, ["add", "committed.txt"]);
      gw(wt, ["commit", "-q", "-m", "test(demo): partial step commit"]);
      const left = head(wt);
      const trackedFile = path.join(wt.changeDir, "change.md");
      const tracked = fs.readFileSync(trackedFile, "utf8") + "partial tracked work\n";
      fs.writeFileSync(trackedFile, tracked);
      fs.writeFileSync(path.join(wt.top, "partial.txt"), "partial untracked work\n");
      if (caller === "router-error") {
        const override = path.join(wt.top, "context/foundation/agent-smith-policy.json");
        const current = JSON.parse(fs.readFileSync(override, "utf8"));
        fs.writeFileSync(override, JSON.stringify({ ...current, complexity: { appliesTo: null } }));
      }
      const ref = REF(wt, readLogEntries(wt).at(-1).n);
      const injector = gitFailingUndo(wt, ref, start, reset);
      writeResult(wt, { status: "failed", note: "undo failure" });
      const res = run(wt, ["next", wt.id], { env: injector.env });
      assert.equal(res.status, caller === "attempt-cap" ? 0 : 1, res.stdout + res.stderr);
      assert.equal(res.json?.action, "halt", res.stdout);
      if (caller === "attempt-cap") {
        assert.match(res.json.reason, /plan failed 3 times in a row\. Last note: undo failure/);
        assert.ok(res.json.reason.includes(`The partial edits are kept under ${ref}.`), res.stdout);
      } else {
        assert.match(res.json.reason, /^Router error: /);
      }
      assert.ok(res.json.reason.includes("The rollback was not undone:"), res.stdout);
      assert.ok(res.json.reason.includes("fatal: injected undo reset failure"), res.stdout);
      const diagnostic = reset === "hard" ? `git reset --hard ${ref} failed:` : `git reset ${ref}^ failed:`;
      assert.ok(res.json.reason.includes(diagnostic), res.stdout);
      assert.ok(refExists(wt, ref));
      const snapshot = gw(wt, ["rev-parse", ref]);
      assert.equal(showFile(wt, ref, `${CHANGE}/change.md`), tracked.trim());
      assert.equal(showFile(wt, ref, "partial.txt"), "partial untracked work");
      assert.equal(showFile(wt, ref, "committed.txt"), "committed before failure");
      assert.equal(gw(wt, ["rev-parse", `${ref}^`]), left);
      assert.equal(fs.readFileSync(injector.marker, "utf8"), `rollback ${start}\nundo ${snapshot}\n`);
      assert.equal(head(wt), reset === "hard" ? start : snapshot);
      if (reset === "mixed") {
        assert.ok(res.json.reason.includes(`The run branch now points at the snapshot commit of ${ref}`), res.stdout);
        assert.ok(res.json.reason.includes(`run git reset -q ${ref}^ in the run worktree before resuming.`), res.stdout);
      }
    });
  }
}

test("4.1 a rollback ref outside refs/agent-smith/ halts before any git write", { skip }, () => {
  // refs/heads/* is shared by every worktree of the repository: such a ref would move or create another branch.
  const main = repo({ policy: { isolation: { require: true, rollback: { ref: "refs/heads/elsewhere" } } } });
  const wt = worktree(main);
  assert.equal(initIn(wt).status, 0);
  const start = head(wt);
  fs.writeFileSync(path.join(wt.top, "partial.txt"), "partial work\n");
  writeResult(wt, { status: "failed", note: "boom" });
  const res = nextIn(wt);
  assert.equal(res.json.action, "halt", res.stdout);
  assert.match(res.json.reason, /must render to a ref under refs\/agent-smith\//);
  assert.equal(refExists(wt, "refs/heads/elsewhere"), false);
  assert.equal(head(wt), start);
  assert.ok(status(wt).includes("?? partial.txt"), status(wt).join(", "));
});

test("4.1 the main checkout is refused: no reset there", { skip }, () => {
  const main = repo();
  const start = head(main);
  writeMetaFile(main, { id: "demo", goal: GOAL, isolated: true, branch: "agent-smith/demo", startCommit: null });
  writeLog(main, [entry(1, "plan", { startSha: start, ok: false, verified: false, result: { status: "failed", note: "x" } })]);
  fs.writeFileSync(path.join(main.root, "partial.txt"), "keep me\n");
  const res = nextIn(main);
  assert.equal(res.json.action, "halt", res.stdout);
  assert.match(res.json.reason, /is the main checkout, not the run worktree/);
  assert.ok(fs.existsSync(path.join(main.root, "partial.txt")));
  assert.equal(head(main), start);
  assert.equal(refExists(main, REF(main, 1)), false);
});

test("4.1 require false: no reset", { skip }, () => {
  const main = repo({ policy: {} });
  assert.equal(initIn(main).status, 0);
  fs.writeFileSync(path.join(main.root, "partial.txt"), "keep me\n");
  writeResult(main, { status: "failed", note: "x" });
  const res = nextIn(main);
  assert.equal(res.json.action, "run", res.stdout);
  assert.ok(fs.existsSync(path.join(main.root, "partial.txt")));
  assert.equal(Object.hasOwn(readLogEntries(main)[0], "rolledBack"), false);
  assert.equal(refExists(main, REF(main, 1)), false);
});

function confirmationFixture() {
  const main = repo({ policy: { ...ON, review: { confirmRounds: { standard: 1 } } } });
  const wt = worktree(main);
  const before = [Date.parse("2026-01-01T10:00:00Z"), Date.parse("2026-01-01T11:00:00Z")];
  const left = [Date.parse("2026-02-01T10:00:00Z"), Date.parse("2026-02-01T11:00:00Z")];
  const files = [wt.planFile, PLAN_REVIEW(wt)];
  writePlan(wt, planText({ phases: 1 }));
  writeReview(wt, "plan-review", { verdict: "REVISE", findings: "1 critical, 0 warnings" });
  fs.appendFileSync(files[1], "\n## Findings\n\n### F1 — Fixed\n\n- **Severity**: CRITICAL\n- **Decision**: APPLIED\n");
  files.forEach((file, i) => touch(file, before[i]));
  const first = initIn(wt, ["--rigor", "standard"]);
  assert.equal(readLogEntries(wt).at(-1).template, "plan-review-confirm", first.stdout + first.stderr);
  const start = head(wt);
  writeReview(wt, "plan-review", { verdict: "BROKEN" });
  fs.appendFileSync(files[0], "\nedit from failed confirmation\n");
  files.forEach((file, i) => touch(file, left[i]));
  const artifact = path.join(wt.top, "partial.txt");
  fs.writeFileSync(artifact, "staged version\n");
  gw(wt, ["add", "partial.txt"]);
  fs.writeFileSync(artifact, "working version\n");
  writeResult(wt, { status: "done", note: "bad confirmation" });
  return { wt, start, files, before, left };
}

function injectTimestampFault(wt, direction, fault) {
  const hook = path.join(wt.base, "timestamp-fault.mjs");
  fs.writeFileSync(hook, `
import fs from "node:fs";
const log = ${JSON.stringify(path.join(wt.agentDir, "run.jsonl"))};
const meta = ${JSON.stringify(path.join(wt.agentDir, "meta.json"))};
const rename = fs.renameSync;
let active = false;
fs.renameSync = (from, to) => {
  const result = rename(from, to);
  if (to === log) {
    const last = fs.readFileSync(log, "utf8").trimEnd().split("\\n").map(JSON.parse).at(-1);
    if (last.${direction} && typeof last.timestamps === "object") {
      if (JSON.parse(fs.readFileSync(meta)).branch !== "agent-smith/demo") process.exit(87);
      active = true;
      if (${fault === "before"}) process.exit(86);
    }
  }
  return result;
};
const touch = fs.futimesSync;
fs.futimesSync = (...args) => {
  if (active && ${fault === "error"}) throw new Error("injected timestamp fault");
  const result = touch(...args);
  if (active && ${fault === "partial"}) process.exit(86);
  return result;
};
`);
  return run(wt, ["next", wt.id], { env: { ...gitEnv(wt), NODE_OPTIONS: "--import=" + hook } });
}

for (const { direction, fault, command } of [
  { direction: "rolledBack", fault: "before", command: "init" },
  { direction: "rolledBack", fault: "partial", command: "next" },
  { direction: "rolledBack", fault: "error", command: "next" },
  { direction: "kept", fault: "partial", command: "init" },
  { direction: "kept", fault: "error", command: "next" },
]) {
  test(`timestamp checkpoint resumes ${direction} after ${fault} via ${command}`, { skip }, () => {
    const { wt, start, files, before, left } = confirmationFixture();
    const halted = injectTimestampFault(wt, direction, fault);
    if (fault === "error") {
      assert.equal(halted.json?.action, "halt", halted.stdout + halted.stderr);
      assert.match(halted.json.reason, /Timestamp restoration .*plan\.md.*refs\/agent-smith\/.*injected timestamp fault.*retry next/);
      assert.match(readReportFile(wt), /injected timestamp fault/);
    } else {
      assert.equal(halted.status, 86, halted.stdout + halted.stderr);
    }

    const pending = readLogEntries(wt).at(-1);
    const ref = pending[direction];
    const snapshot = gw(wt, ["rev-parse", ref]);
    const expected = direction === "kept" ? left : before;
    assert.equal(pending.timestamps.commit, direction === "kept" ? snapshot : start);
    assert.equal(pending.timestamps.files.plan.time, expected[0]);
    assert.equal(pending.timestamps.files.planReview.time, expected[1]);
    assert.match(pending.timestamps.files.plan.sha256, /^[a-f0-9]{64}$/);
    assert.equal(pending.result.note, "bad confirmation");
    assert.equal(pending.ok, false);
    if (fault === "partial") assert.ok(near(at(files[0]), expected[0]));
    assert.ok(!near(at(files[1]), expected[1]), "confirmation review time still pending");

    if (fault === "error") {
      fs.writeFileSync(path.join(wt.top, "owner.txt"), "new head\n");
      gw(wt, ["add", "owner.txt"]);
      gw(wt, ["commit", "-m", "test(demo): advance head before resuming"]);
      assert.notEqual(head(wt), start);
    }
    const expectedHead = head(wt);
    for (let repeat = 0; repeat < 2; repeat++) {
      const resumed = run(wt, [command, wt.id], { env: gitEnv(wt) });
      assert.equal(resumed.json?.action, "halt", resumed.stdout + resumed.stderr);
      assert.match(resumed.json.reason, /Unknown review verdict "BROKEN"/);
      const completed = readLogEntries(wt).at(-1);
      assert.deepEqual(completed, { ...pending, timestamps: "completed" });
      files.forEach((file, i) => assert.ok(near(at(file), expected[i]), `${file} time was restored`));
      assert.equal(completed[direction], ref);
      assert.equal(head(wt), expectedHead);
      assert.equal(gw(wt, ["rev-parse", ref]), snapshot);
      assert.equal(showFile(wt, ref, "partial.txt"), "working version");
      assert.equal(showFile(wt, `${ref}^2`, "partial.txt"), "staged version");
    }
  });
}

for (const [link, diagnostic] of [["symlink", "no symlink"], ["hardlink", "hard-linked file"]]) {
  test(`timestamp recovery refuses a ${link} introduced after checkpoint publication`, { skip: skip || process.platform === "win32" }, () => {
    const { wt, files, before } = confirmationFixture();
    const halted = injectTimestampFault(wt, "rolledBack", "before");
    assert.equal(halted.status, 86, halted.stdout + halted.stderr);
    const pending = readLogEntries(wt).at(-1);
    const original = files[1] + ".original";
    fs.renameSync(files[1], original);
    const target = path.join(wt.base, "owner.md");
    if (link === "symlink") {
      fs.copyFileSync(original, target);
      fs.symlinkSync(target, files[1]);
    } else {
      fs.linkSync(original, target);
      fs.linkSync(target, files[1]);
    }
    const time = Date.parse("2026-04-01T10:00:00Z");
    touch(target, time);
    const refused = nextIn(wt);
    assert.match(refused.json.reason, new RegExp(`Timestamp restoration .*plan-review\\.md.*${diagnostic}`));
    assert.ok(near(at(target), time));
    assert.deepEqual(readLogEntries(wt).at(-1), pending);
    fs.unlinkSync(files[1]);
    fs.unlinkSync(target);
    fs.renameSync(original, files[1]);
    assert.match(nextIn(wt).json.reason, /Unknown review verdict "BROKEN"/);
    assert.ok(near(at(files[1]), before[1]));
    assert.equal(readLogEntries(wt).at(-1).timestamps, "completed");
  });
}
