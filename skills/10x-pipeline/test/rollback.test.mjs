// Failed-step rollback (worktree-step-commits, Phase 4): a failed step of an isolated run is snapshotted under
// refs/agent-smith/<id>/failed-<n> and the worktree is reset to its startSha before the next step is decided; a halt
// in the same call undoes the reset. Real linked worktrees in scratch repositories, hermetic git.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  cleanupAll, makeProject, run, git, gitAvailable, gitEnv, gitInit, writeResult, writeLog, writeMetaFile, writePlan,
  writeReview, readLogEntries, readReportFile, entry, planText,
} from "./helpers.mjs";

after(cleanupAll);

const GOAL = "Add a retry counter to the status output so the report shows how often each step ran again";
const ON = { isolation: { require: true } };
const skip = !gitAvailable() && "git is not available";
const REF = (n) => `refs/agent-smith/demo/failed-${n}`;

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
  assert.ok(refExists(wt, REF(1)));
  assert.equal(showFile(wt, REF(1), "src/new.js"), "export const half = 1;");
  assert.match(showFile(wt, REF(1), `${CHANGE}/plan.md`), /## Progress/);
  assert.match(showFile(wt, REF(1), `${CHANGE}/change.md`), /half-done edit/);
  assert.equal(gw(wt, ["rev-parse", `${REF(1)}^`]), start);
  assert.equal(gw(wt, ["log", "-1", "--format=%s", REF(1)]), "agent-smith: failed step 1 (plan)");
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
  assert.equal(entries[0].rolledBack, REF(1));
  assert.equal(entries[1].startSha, start);
  // status and report.md list the rolled-back step.
  const st = run(wt, ["status", "demo", "--report"], { env: gitEnv(wt) });
  assert.equal(st.json.steps[0].rolledBack, REF(1));
  assert.match(readReportFile(wt), /^## Rolled-back steps$/m);
  assert.match(readReportFile(wt), new RegExp(`^- step 1 plan: \`${REF(1)}\` rolled back to ${start.slice(0, 7)}$`, "m"));
});

test("4.1 a failed step that left a staged file is snapshotted with it", { skip }, () => {
  const { wt } = freshRun();
  fs.writeFileSync(path.join(wt.top, "staged.txt"), "staged by the step\n");
  gw(wt, ["add", "staged.txt"]);
  writeResult(wt, { status: "failed", note: "hook said no" });
  const res = nextIn(wt);
  assert.equal(res.json.action, "run", res.stdout);
  assert.equal(showFile(wt, REF(1), "staged.txt"), "staged by the step");
  assert.equal(fs.existsSync(path.join(wt.top, "staged.txt")), false);
  gw(wt, ["diff", "--cached", "--quiet"]);
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
  assert.equal(entries[2].rolledBack, REF(3));
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
  assert.ok(ancestor(wt, phase, REF(3)), "the phase commit is an ancestor of the side ref");
  assert.equal(gw(wt, ["rev-parse", `${REF(3)}^`]), phase);
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
  assert.equal(readLogEntries(wt)[0].rolledBack, REF(1));
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
  assert.equal(refExists(wt, REF(3)), false);
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
  assert.equal(readLogEntries(wt)[3].rolledBack, REF(4));
  assert.equal(head(wt), start);
  assert.equal(fs.existsSync(path.join(wt.top, "two.js")), false);
  assert.equal(showFile(wt, REF(4), "two.js"), "2");
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
  assert.ok(refExists(wt, REF(3)));
  assert.ok(fs.existsSync(path.join(wt.top, "new.txt")));
  assert.ok(status(wt).includes("?? new.txt"), status(wt).join(", "));
  assert.match(fs.readFileSync(path.join(wt.changeDir, "change.md"), "utf8"), /edited by attempt 3/);
  assert.ok(near(at(wt.planFile), times.plan));
  assert.ok(near(at(PLAN_REVIEW(wt)), times.planReview));
  assert.ok(near(at(IMPL_REVIEW(wt)), times.implReview));
  const entries = readLogEntries(wt);
  assert.equal(entries.length, 3);
  assert.equal(entries[2].kept, REF(3));
  assert.equal(Object.hasOwn(entries[2], "rolledBack"), false);
  assert.match(readReportFile(wt), new RegExp(`^- step 3 plan: \`${REF(3)}\` kept \\(run halted\\)$`, "m"));
  // A later next does not reset again: the kept edits (a plan and a clean review) decide the next step.
  const again = nextIn(wt);
  assert.equal(again.json.action, "run", again.stdout);
  assert.equal(again.json.step, "implement");
  assert.ok(fs.existsSync(path.join(wt.top, "new.txt")));
  assert.equal(readLogEntries(wt)[2].kept, REF(3));
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
  assert.equal(last.kept, REF(last.n));
  assert.equal(Object.hasOwn(last, "rolledBack"), false);
});

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
  assert.equal(refExists(main, REF(1)), false);
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
  assert.equal(refExists(main, REF(1)), false);
});
