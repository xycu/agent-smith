// The Agent Smith co-author trailer (agent-smith-coauthor): every router commit carries
// `Co-Authored-By: Agent Smith <agent-smith@ksycki.pl>` from policy.coAuthor; null turns it off; a malformed value halts
// at the first router commit, before anything is staged. Real linked worktrees in scratch repositories, hermetic git.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  cleanupAll, makeProject, commitFiles, run, git, gitAvailable, gitEnv, gitInit, writeOverride, writeResult, writeLog,
  writeMetaFile, writeReview, readMetaFile, entry, planText,
} from "./helpers.mjs";
import { writePlan } from "./ahead.mjs";
import { coAuthorProblem, coAuthorTrailer } from "../scripts/state.mjs";

after(cleanupAll);

const skip = !gitAvailable() && "git is not available";
const GOAL = "Add a retry counter to the status output so the report shows how often each step ran again";
const TRAILER = "Co-Authored-By: Agent Smith <agent-smith@ksycki.pl>";
const ON = { isolation: { require: true } };
const BAD = [
  [{ name: " ", email: "agent-smith@ksycki.pl" }, /^policy\.coAuthor name /],
  [{ name: "Agent Smith", email: "a>b@ksycki.pl" }, /^policy\.coAuthor email /],
  ["Agent Smith", /^policy\.coAuthor must be null or an object/],
];

function repo(policy = ON) {
  const project = makeProject({ policy });
  gitInit(project);
  git(project, ["add", "-A"]);
  git(project, ["commit", "-q", "-m", "chore: project"]);
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
const initIn = (p, extra = []) => run(p, ["init", p.id, "--goal", GOAL, ...extra], { env: gitEnv(p) });
const nextIn = (p) => run(p, ["next", p.id], { env: gitEnv(p) });
const body = (wt, rev = "HEAD") => gw(wt, ["log", "-1", "--format=%B", rev]);
const lines = (wt, rev) => body(wt, rev).split("\n");
const indexEmpty = (wt) => gw(wt, ["diff", "--cached", "--name-only"]) === "";

function isolatedRun(policy = ON) {
  const wt = worktree(repo(policy));
  const res = initIn(wt);
  assert.equal(res.status, 0, res.stdout + res.stderr);
  return wt;
}

// ---- router commits ------------------------------------------------------------------------

test("the start commit carries the trailer after its subject", { skip }, () => {
  const wt = isolatedRun();
  assert.equal(lines(wt)[0], "chore(demo): start run");
  assert.equal(lines(wt).at(-1), TRAILER);
  assert.match(body(wt), /^chore\(demo\): start run\n\nCo-Authored-By: Agent Smith <agent-smith@ksycki\.pl>$/);
});

test("a step commit carries the trailer", { skip }, () => {
  const wt = isolatedRun();
  writePlan(wt, planText({ phases: 1 }));
  writeResult(wt, { status: "done", note: "planned" });
  const res = nextIn(wt);
  assert.equal(res.json.step, "plan-review", res.stdout);
  assert.equal(lines(wt)[0], "chore(demo): step 1 plan");
  assert.equal(lines(wt).at(-1), TRAILER);
});

test("the rollback snapshot carries the trailer", { skip }, () => {
  const wt = isolatedRun();
  fs.writeFileSync(path.join(wt.top, "partial.txt"), "half\n");
  writeResult(wt, { status: "failed", note: "x" });
  const res = nextIn(wt);
  assert.equal(res.json.action, "run", res.stdout);
  const meta = readMetaFile(wt);
  const ref = `refs/agent-smith/demo/${meta.startCommit.slice(0, 12)}/failed-1`;
  assert.equal(lines(wt, ref)[0], "agent-smith: failed step 1 (plan)");
  assert.equal(lines(wt, ref).at(-1), TRAILER);
});

// A finished 10x --archive run in a plain repository, as in late-usage.test.mjs.
function archiveProject(policy = null) {
  const project = makeProject({ policy, plan: planText({ phases: 1, rowsPerPhase: 1, done: 1 }) });
  fs.writeFileSync(path.join(project.changeDir, "change.md"), "---\nchange_id: demo\nstatus: implemented\ncreated: 2026-10-30\n---\n");
  writeReview(project, "plan-review", { verdict: "SOUND" });
  writeReview(project, "impl-review", { verdict: "APPROVED" });
  writeLog(project, [entry(1, "plan"), entry(2, "plan-review"), entry(3, "implement"), entry(4, "impl-review")]);
  writeMetaFile(project, { id: "demo", goal: "fix typo", archive: true });
  gitInit(project);
  commitFiles(project, ["README.md"]);
  project.top = project.base;
  return project;
}

test("the pre-archive and the late-usage commits carry the trailer", { skip }, () => {
  const project = archiveProject();
  assert.equal(nextIn(project).json.action, "archive");
  assert.equal(lines(project)[0], "chore(demo): commit change folder before archive");
  assert.equal(lines(project).at(-1), TRAILER);
  const res = run(project, ["usage", "demo", "4", "--tokens", "1200"], { env: gitEnv(project) });
  assert.equal(res.status, 0, res.stdout + res.stderr);
  assert.equal(lines(project)[0], "chore(demo): add late usage figure of step 4");
  assert.equal(lines(project).at(-1), TRAILER);
});

test("a malformed coAuthor halts the pre-archive commit and refuses the late-usage commit before staging", { skip }, () => {
  const project = archiveProject({ coAuthor: { name: "", email: "x@y" } });
  const head = git(project, ["rev-parse", "HEAD"]);
  const res = nextIn(project);
  assert.equal(res.json.action, "halt", res.stdout);
  assert.match(res.json.reason, /^policy\.coAuthor name /);
  assert.equal(git(project, ["rev-parse", "HEAD"]), head);
  assert.ok(indexEmpty(project));

  const ok = archiveProject();
  assert.equal(nextIn(ok).json.action, "archive");
  writeOverride(ok, { coAuthor: 5 });
  git(ok, ["add", "-A"]);
  git(ok, ["commit", "-q", "-m", "chore: bad override"]);
  const top = git(ok, ["rev-parse", "HEAD"]);
  const usage = run(ok, ["usage", "demo", "4", "--tokens", "1200"], { env: gitEnv(ok) });
  assert.equal(usage.status, 1, usage.stdout);
  assert.match(usage.json.reason, /^policy\.coAuthor must be null or an object/);
  assert.equal(git(ok, ["rev-parse", "HEAD"]), top);
});

// ---- off and malformed ---------------------------------------------------------------------

test("coAuthor null gives no trailer", { skip }, () => {
  const wt = isolatedRun({ ...ON, coAuthor: null });
  assert.equal(body(wt), "chore(demo): start run");
  assert.doesNotMatch(body(wt), /Co-Authored-By/);
});

test("a malformed coAuthor halts the start commit at init with nothing staged; status still works", { skip }, () => {
  for (const [value, reason] of BAD) {
    const wt = worktree(repo({ ...ON, coAuthor: value }));
    const head = gw(wt, ["rev-parse", "HEAD"]);
    const res = initIn(wt);
    assert.equal(res.json.action, "halt", `${JSON.stringify(value)}: ${res.stdout}`);
    assert.match(res.json.reason, /^The start commit of the run was not made: /);
    assert.match(res.json.reason.replace(/^The start commit of the run was not made: /, ""), reason);
    assert.equal(gw(wt, ["rev-parse", "HEAD"]), head, "no commit");
    assert.ok(indexEmpty(wt), "nothing staged");
    const st = run(wt, ["status", "demo"], { env: gitEnv(wt) });
    assert.equal(st.status, 0, st.stdout + st.stderr);
  }
});

test("a malformed coAuthor halts a step commit at next with nothing staged", { skip }, () => {
  for (const [value, reason] of BAD) {
    const wt = isolatedRun();
    writeOverride(wt, { ...ON, coAuthor: value });
    writePlan(wt, planText({ phases: 1 }));
    writeResult(wt, { status: "done", note: "planned" });
    const head = gw(wt, ["rev-parse", "HEAD"]);
    const res = nextIn(wt);
    assert.equal(res.json.action, "halt", `${JSON.stringify(value)}: ${res.stdout}`);
    assert.match(res.json.reason, /^Step commit of step 1 \(plan\): /);
    assert.match(res.json.reason.replace(/^Step commit of step 1 \(plan\): /, ""), reason);
    assert.equal(gw(wt, ["rev-parse", "HEAD"]), head, "no commit");
    assert.ok(indexEmpty(wt), "nothing staged");
  }
});

test("a malformed coAuthor halts the rollback before its snapshot", { skip }, () => {
  const wt = isolatedRun();
  writeOverride(wt, { ...ON, coAuthor: { name: "A", email: "a>b" } });
  fs.writeFileSync(path.join(wt.top, "partial.txt"), "half\n");
  writeResult(wt, { status: "failed", note: "x" });
  const head = gw(wt, ["rev-parse", "HEAD"]);
  const res = nextIn(wt);
  assert.equal(res.json.action, "halt", res.stdout);
  assert.match(res.json.reason, /^Rollback of step 1 \(plan\): policy\.coAuthor email /);
  assert.equal(gw(wt, ["rev-parse", "HEAD"]), head, "no reset");
  assert.equal(gw(wt, ["for-each-ref", "refs/agent-smith/"]), "", "no snapshot ref");
  assert.ok(indexEmpty(wt), "nothing staged");
  assert.ok(fs.existsSync(path.join(wt.top, "partial.txt")), "partial edits kept");
});

test("coAuthor does not change the provenance record", () => {
  const sections = (policy) => {
    const project = makeProject({ policy });
    const res = run(project, ["init", project.id, "--goal", "fix typo"]);
    assert.equal(res.status, 0, res.stdout);
    return readMetaFile(project).provenance.sections;
  };
  const base = sections({});
  assert.equal(Object.hasOwn(base, "coAuthor"), false);
  assert.deepEqual(sections({ coAuthor: null }), base);
  assert.deepEqual(sections({ coAuthor: { name: "Someone", email: "s@example.com" } }), base);
});

// ---- helper values -------------------------------------------------------------------------

test("coAuthorProblem and coAuthorTrailer", () => {
  const good = { coAuthor: { name: "Agent Smith", email: "agent-smith@ksycki.pl" } };
  assert.equal(coAuthorProblem(good), null);
  assert.equal(coAuthorTrailer(good), TRAILER);
  for (const off of [{ coAuthor: null }, {}]) {
    assert.equal(coAuthorProblem(off), null);
    assert.equal(coAuthorTrailer(off), null);
  }
  for (const bad of [
    { name: "", email: "a@b" }, { name: "A", email: "  " }, { name: "A\nB", email: "a@b" }, { name: "A", email: "a@b\r" },
    { name: "<A>", email: "a@b" }, { name: "A", email: "<a@b>" }, { name: "A" }, { name: 1, email: "a@b" }, "A", [], 5, true,
  ]) {
    assert.match(coAuthorProblem({ coAuthor: bad }), /^policy\.coAuthor /, JSON.stringify(bad));
  }
});

// ---- parity with open-pr.mjs ---------------------------------------------------------------

test("open-pr.mjs coAuthorLine gives the router's trailer, and null where the router reports a problem", async () => {
  const { coAuthorLine } = await import("../scripts/open-pr.mjs");
  const values = [
    { name: "Agent Smith", email: "agent-smith@ksycki.pl" }, { name: " Agent Smith ", email: " a@b " }, null, undefined,
    { name: "", email: "a@b" }, { name: "A", email: "  " }, { name: "A\nB", email: "a@b" }, { name: "A", email: "a@b\r" },
    { name: "<A>", email: "a@b" }, { name: "A", email: "<a@b>" }, { name: "A" }, { name: 1, email: "a@b" }, "A", [], 5, true,
  ];
  for (const value of values) {
    const policy = value === undefined ? {} : { coAuthor: value };
    const want = coAuthorProblem(policy) === null ? coAuthorTrailer(policy) : null;
    assert.equal(coAuthorLine(policy), want, JSON.stringify(value));
  }
});
