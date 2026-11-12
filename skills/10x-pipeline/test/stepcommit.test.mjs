// Per-step commits (worktree-step-commits, Phase 3): the start commit of the first init of an isolated run, one
// commit per successful step, startSha and commit on the log entries, and the archive "already committed" test of
// an isolated run. Real linked worktrees in scratch repositories, hermetic git.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { removeTree } from "../scripts/remove-tree.mjs";
import {
  cleanupAll, makeProject, run, git, gitAvailable, gitEnv, gitInit, writeResult, writeLog, writeMetaFile,
  readLogEntries, readMetaFile, readReportFile, entry, planText
} from "./helpers.mjs";
import { writePlan, writeReview } from "./ahead.mjs";

after(cleanupAll);

const GOAL = "Add a retry counter to the status output so the report shows how often each step ran again";
const ON = { isolation: { require: true } };
const skip = !gitAvailable() && "git is not available";

// A scratch repository whose main checkout holds the committed project (change folder and override).
function repo({ policy = ON } = {}) {
  const project = makeProject({ policy });
  gitInit(project);
  git(project, ["add", "-A"]);
  git(project, ["commit", "-q", "-m", "chore: project"]);
  project.top = project.base;
  return project;
}

// A linked worktree of `main` under .claude/worktrees/ on agent-smith/<id>, as the orchestrator makes it.
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
const subject = (wt) => gw(wt, ["log", "-1", "--format=%s"]);
const count = (wt) => Number(gw(wt, ["rev-list", "--count", "HEAD"]));
const names = (wt) => gw(wt, ["show", "--name-only", "--format=", "HEAD"]).split("\n").filter(Boolean);
const indexEmpty = (wt) => { gw(wt, ["diff", "--cached", "--quiet"]); return true; };

function writeHook(project, name, script) {
  const dir = path.join(project.base, ".git/hooks");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), `#!/bin/sh\n${script}\n`, { mode: 0o755 });
}
const dropHook = (project, name) => fs.rmSync(path.join(project.base, ".git/hooks", name), { force: true });

// An isolated run after its first init, with the plan step answered as done.
function planDone(wt) {
  writePlan(wt, planText({ phases: 1, rowsPerPhase: 1 }));
  writeResult(wt, { status: "done", note: "planned" });
}

function freshRun() {
  const main = repo();
  const wt = worktree(main);
  const res = initIn(wt);
  assert.equal(res.status, 0, res.stdout + res.stderr);
  return { main, wt, res };
}

test("3.1 a fresh isolated init commits the copied change folder after baseSha; the first startSha is that commit", { skip }, () => {
  const main = repo();
  const wt = worktree(main);
  // The orchestrator's copy: an untracked research.md and a modified change.md.
  fs.writeFileSync(path.join(wt.changeDir, "research.md"), "---\nstatus: complete\n---\n# Research\n");
  fs.appendFileSync(path.join(wt.changeDir, "change.md"), "\nNotes copied from the main checkout.\n");
  const base = head(wt);
  const res = initIn(wt);
  assert.equal(res.status, 0, res.stdout + res.stderr);
  const meta = readMetaFile(wt);
  assert.equal(meta.baseSha, base);
  assert.equal(meta.startCommit, head(wt));
  assert.equal(subject(wt), "chore(demo): start run");
  assert.equal(gw(wt, ["rev-parse", "HEAD^"]), base);
  const held = names(wt);
  for (const f of ["research.md", "change.md", "agent-smith/meta.json"]) assert.ok(held.includes(`context/changes/demo/${f}`), f);
  assert.equal(held.includes("context/changes/demo/agent-smith/run.jsonl"), false, "the first entry is written after the commit");
  assert.ok(held.every((n) => n.startsWith("context/changes/demo/")), held.join(", "));
  const [first] = readLogEntries(wt);
  assert.equal(first.startSha, meta.startCommit);
  assert.ok(indexEmpty(wt));
});

test("3.1 a resume makes no start commit", { skip }, () => {
  const { wt } = freshRun();
  const before = count(wt);
  writeResult(wt, { status: "failed", note: "no plan" });
  const again = initIn(wt);
  assert.equal(again.status, 0, again.stdout + again.stderr);
  assert.equal(count(wt), before);
  assert.equal(readMetaFile(wt).startCommit, readLogEntries(wt)[0].startSha);
});

test("3.1 after a hook rejected the start commit, the next init makes it", { skip }, () => {
  const main = repo();
  const wt = worktree(main);
  fs.writeFileSync(path.join(wt.changeDir, "research.md"), "---\nstatus: complete\n---\n");
  writeHook(main, "pre-commit", "echo no commits today >&2\nexit 1");
  const base = count(wt);
  const res = initIn(wt);
  assert.equal(res.status, 1, res.stdout);
  assert.equal(res.json.action, "halt");
  assert.match(res.json.reason, /git commit failed: .*no commits today/);
  assert.match(res.json.reason, /unstaged again/);
  assert.equal(count(wt), base);
  assert.ok(indexEmpty(wt));
  assert.equal(Object.hasOwn(readMetaFile(wt), "startCommit"), false);
  assert.deepEqual(readLogEntries(wt), []);
  dropHook(main, "pre-commit");
  const again = initIn(wt);
  assert.equal(again.status, 0, again.stdout + again.stderr);
  assert.equal(subject(wt), "chore(demo): start run");
  assert.equal(readMetaFile(wt).startCommit, head(wt));
  assert.equal(readLogEntries(wt)[0].startSha, head(wt));
});

// A directory with a `git` that runs the real git, except that the first `rev-parse HEAD` after a `commit` fails.
function gitLosingHash() {
  const real = spawnSync("sh", ["-c", "command -v git"], { encoding: "utf8" }).stdout.trim();
  const bin = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "as-nohash-"));
  const mark = path.join(bin, "committed");
  fs.writeFileSync(path.join(bin, "git"), [
    "#!/bin/sh",
    `case " $* " in`,
    `  *" commit -m "*) "${real}" "$@"; code=$?; [ $code -eq 0 ] && : > "${mark}"; exit $code;;`,
    `  *" rev-parse HEAD ") if [ -e "${mark}" ]; then rm "${mark}"; echo "fatal: lost" >&2; exit 128; fi;;`,
    "esac",
    `exec "${real}" "$@"`,
    "",
  ].join("\n"), { mode: 0o755 });
  return bin;
}

test("3.1 a commit whose hash cannot be read is recorded as made with commit null, never as the label HEAD", { skip: skip || process.platform === "win32" }, () => {
  const main = repo();
  const wt = worktree(main);
  const bin = gitLosingHash();
  const env = { ...gitEnv(wt), PATH: `${bin}${path.delimiter}${process.env.PATH}` };
  try {
    const base = count(wt);
    const res = run(wt, ["init", wt.id, "--goal", GOAL], { env });
    assert.equal(res.status, 0, res.stdout + res.stderr);
    assert.equal(count(wt), base + 1);
    assert.equal(subject(wt), "chore(demo): start run");
    const meta = readMetaFile(wt);
    assert.ok(Object.hasOwn(meta, "startCommit"), "the guard is set, so a resume makes no second start commit");
    assert.equal(meta.startCommit, null);
    planDone(wt);
    const next = run(wt, ["next", wt.id], { env });
    assert.equal(next.status, 0, next.stdout + next.stderr);
    assert.equal(subject(wt), "chore(demo): step 1 plan");
    const [first] = readLogEntries(wt);
    assert.ok(Object.hasOwn(first, "commit"));
    assert.equal(first.commit, null);
  } finally {
    removeTree(bin);
  }
});

test("3.1 a start commit that made no commit and fails its folder check leaves the guard absent, so the next init retries", { skip }, () => {
  const main = repo();
  const wt = worktree(main);
  writeHook(main, "pre-commit", "exit 1");
  assert.equal(initIn(wt).status, 1);
  dropHook(main, "pre-commit");
  // A nested repository in the change folder, committed by hand with the folder: `git add` then stages nothing,
  // and an untracked file inside the nested repository keeps the folder dirty.
  const nested = path.join(wt.changeDir, "nested");
  fs.mkdirSync(nested);
  git(wt, ["-C", nested, "init", "-q"]);
  fs.writeFileSync(path.join(nested, "a.txt"), "a\n");
  git(wt, ["-C", nested, "add", "-A"]);
  git(wt, ["-C", nested, "commit", "-q", "-m", "chore: nested"]);
  gw(wt, ["add", "-A"]);
  gw(wt, ["commit", "-q", "-m", "chore: by hand"]);
  fs.writeFileSync(path.join(nested, "stray.txt"), "x\n");
  const base = count(wt);
  const res = initIn(wt);
  assert.equal(res.status, 1, res.stdout);
  assert.match(res.json.reason, /The start commit of the run was not made: The change folder is not clean after the commit: .*nested/);
  assert.doesNotMatch(res.json.reason, /exists and the router does not undo it/);
  assert.equal(count(wt), base);
  assert.equal(Object.hasOwn(readMetaFile(wt), "startCommit"), false);
  fs.rmSync(path.join(nested, "stray.txt"));
  const again = initIn(wt);
  assert.equal(again.status, 0, again.stdout + again.stderr);
  assert.ok(Object.hasOwn(readMetaFile(wt), "startCommit"));
});

test("3.1 a successful step is committed; the entry records commit and the next entry starts there", { skip }, () => {
  const { wt } = freshRun();
  planDone(wt);
  const res = nextIn(wt);
  assert.equal(res.status, 0, res.stdout + res.stderr);
  assert.equal(res.json.action, "run");
  const sha = head(wt);
  assert.equal(subject(wt), "chore(demo): step 1 plan");
  const held = names(wt);
  for (const f of ["plan.md", "agent-smith/run.jsonl"]) assert.ok(held.includes(`context/changes/demo/${f}`), f);
  // The commit holds the step's own result; its commit hash lands in the following commit.
  const committedLog = gw(wt, ["show", "HEAD:context/changes/demo/agent-smith/run.jsonl"]);
  assert.match(committedLog, /"ok":true/);
  assert.doesNotMatch(committedLog, /"commit":/);
  const entries = readLogEntries(wt);
  assert.equal(entries[0].commit, sha);
  assert.equal(entries[1].startSha, sha);
  assert.ok(indexEmpty(wt));
  // status and report.md show the short commit.
  const st = run(wt, ["status", "demo", "--report"], { env: gitEnv(wt) });
  assert.equal(st.status, 0, st.stdout);
  assert.equal(st.json.steps[0].commit, sha.slice(0, 7));
  assert.equal(st.json.steps[1].commit, undefined);
  assert.match(readReportFile(wt), new RegExp(`^\\| 1 \\| plan \\| .* \\| ok \\(${sha.slice(0, 7)}\\) \\| - \\|$`, "m"));
});

test("3.1 an ok entry whose state is already committed gets commit null and no empty commit", { skip }, () => {
  const { wt } = freshRun();
  const start = head(wt);
  writePlan(wt, planText({ phases: 1, rowsPerPhase: 1 }));
  writeLog(wt, [entry(1, "plan", { startSha: start })]);
  gw(wt, ["add", "-A"]);
  gw(wt, ["commit", "-q", "-m", "chore: by hand"]);
  const before = count(wt);
  const res = nextIn(wt);
  assert.equal(res.status, 0, res.stdout + res.stderr);
  assert.equal(count(wt), before);
  assert.equal(readLogEntries(wt)[0].commit, null);
});

test("3.1 a failed step is not committed", { skip }, () => {
  const { wt } = freshRun();
  const before = head(wt);
  writeResult(wt, { status: "failed", note: "no plan" });
  const res = nextIn(wt);
  assert.equal(res.status, 0, res.stdout + res.stderr);
  assert.equal(head(wt), before);
  assert.equal(Object.hasOwn(readLogEntries(wt)[0], "commit"), false);
});

test("3.1 a hook failure halts and unstages; the resume commits", { skip }, () => {
  const { main, wt } = freshRun();
  const before = head(wt);
  planDone(wt);
  writeHook(main, "pre-commit", "echo hook says no >&2\nexit 1");
  const res = nextIn(wt);
  assert.equal(res.status, 0, res.stdout);
  assert.equal(res.json.action, "halt");
  assert.match(res.json.reason, /git commit failed: .*hook says no/);
  assert.match(res.json.reason, /unstaged again/);
  assert.equal(head(wt), before);
  assert.ok(indexEmpty(wt));
  const entries = readLogEntries(wt);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].ok, true);
  assert.equal(Object.hasOwn(entries[0], "commit"), false);
  dropHook(main, "pre-commit");
  const again = nextIn(wt);
  assert.equal(again.json.action, "run", again.stdout);
  assert.equal(subject(wt), "chore(demo): step 1 plan");
  assert.equal(readLogEntries(wt)[0].commit, head(wt));
});

test("3.1 staged files at the end of a step halt and are named; no commit key is set", { skip }, () => {
  const { wt } = freshRun();
  const before = head(wt);
  planDone(wt);
  fs.writeFileSync(path.join(wt.top, "other.txt"), "staged by the step\n");
  gw(wt, ["add", "other.txt"]);
  const res = nextIn(wt);
  assert.equal(res.json.action, "halt", res.stdout);
  assert.match(res.json.reason, /The index holds staged changes: other\.txt/);
  assert.equal(head(wt), before);
  assert.equal(Object.hasOwn(readLogEntries(wt)[0], "commit"), false);
});

test("3.1 HEAD off the run branch halts before any write", { skip }, () => {
  const { wt } = freshRun();
  planDone(wt);
  gw(wt, ["checkout", "-q", "-b", "agent-smith/other"]);
  const before = head(wt);
  const res = nextIn(wt);
  assert.equal(res.json.action, "halt", res.stdout);
  assert.match(res.json.reason, /HEAD is on agent-smith\/other, not on the run branch agent-smith\/demo/);
  assert.equal(head(wt), before);
  assert.equal(Object.hasOwn(readLogEntries(wt)[0], "commit"), false);
});

test("3.1 require false makes no commit and logs no startSha", { skip }, () => {
  const main = repo({ policy: {} });
  const before = count(main);
  const res = initIn(main);
  assert.equal(res.status, 0, res.stdout + res.stderr);
  planDone(main);
  const second = nextIn(main);
  assert.equal(second.json.action, "run", second.stdout);
  assert.equal(count(main), before);
  const entries = readLogEntries(main);
  for (const e of entries) {
    assert.equal(Object.hasOwn(e, "startSha"), false);
    assert.equal(Object.hasOwn(e, "commit"), false);
  }
  assert.equal(Object.hasOwn(readMetaFile(main), "startCommit"), false);
});

test("3.1 an isolated --archive run whose report a step commit took reports committed false when the archive pre-check fails", { skip }, () => {
  const main = repo();
  const wt = worktree(main);
  // A finished isolated run that halted once (report.md written) and resumed: the step commits took every file,
  // so report.md is tracked and the folder is clean, but no pre-archive commit exists. change.md has no created line.
  writePlan(wt, planText({ phases: 1, rowsPerPhase: 1, done: 1 }));
  writeReview(wt, "plan-review", { verdict: "SOUND" });
  writeReview(wt, "impl-review", { verdict: "APPROVED" });
  const start = head(wt);
  writeLog(wt, [
    entry(1, "plan", { startSha: start, commit: null }), entry(2, "plan-review", { startSha: start, commit: null }),
    entry(3, "implement", { startSha: start, commit: null }), entry(4, "impl-review", { startSha: start, commit: null }),
  ]);
  writeMetaFile(wt, { id: "demo", goal: GOAL, archive: true, isolated: true, branch: "agent-smith/demo", startCommit: null });
  // The first done halts on the pre-check and writes report.md and meta.json; a step commit takes them by hand.
  const first = nextIn(wt);
  assert.equal(first.json.committed, false, first.stdout);
  gw(wt, ["add", "-A"]);
  gw(wt, ["commit", "-q", "-m", "chore(demo): step 4 impl-review"]);
  assert.equal(gw(wt, ["status", "--porcelain"]), "");
  const before = count(wt);
  const res = nextIn(wt);
  assert.equal(res.json.action, "halt", res.stdout);
  assert.match(res.json.reason, /created: YYYY-MM-DD/);
  assert.match(res.json.reason, /Nothing was committed\./);
  assert.equal(res.json.committed, false);
  assert.doesNotMatch(res.json.reason, /pre-archive commit exists/);
  assert.equal(count(wt), before);
  // The end state is written (kind A), not only printed.
  assert.equal(readMetaFile(wt).outcome.action, "halt");
  assert.match(readReportFile(wt), /^Outcome: halt/m);
});

// The test of "swept" (ADR-010 Amendment 1): the step commit records the paths outside the change folder it takes.
// Plan ok, plan review ok: the run waits for the result of its first implement step (step 3).
function toImplement(wt, plan) {
  writePlan(wt, plan);
  writeResult(wt, { status: "done", note: "planned" });
  assert.equal(nextIn(wt).json.step, "plan-review");
  writeReview(wt, "plan-review", { verdict: "SOUND" });
  writeResult(wt, { status: "done", note: "reviewed" });
  const impl = nextIn(wt);
  assert.equal(impl.json.step, "implement", impl.stdout);
}

// A tracked src/old.js on the run branch, then the implement step's work: src/done.js committed by the step itself,
// src/left.js new and src/old.js renamed to src/moved.js left uncommitted.
function implementWithLeftovers(wt) {
  fs.mkdirSync(path.join(wt.top, "src"), { recursive: true });
  fs.writeFileSync(path.join(wt.top, "src/old.js"), "export const old = 1;\n");
  gw(wt, ["add", "src/old.js"]);
  gw(wt, ["commit", "-q", "-m", "chore: seed old"]);
  toImplement(wt, planText({ phases: 1, rowsPerPhase: 1 }));
  fs.writeFileSync(path.join(wt.top, "src/done.js"), "export const done = 1;\n");
  gw(wt, ["add", "src/done.js"]);
  gw(wt, ["commit", "-q", "-m", "feat(demo): done"]);
  fs.writeFileSync(path.join(wt.top, "src/left.js"), "export const left = 1;\n");
  gw(wt, ["mv", "src/old.js", "src/moved.js"]);
  gw(wt, ["reset", "-q"]);
  writePlan(wt, planText({ phases: 1, rowsPerPhase: 1, done: 1 }));
  writeResult(wt, { status: "done", note: "implemented" });
}

const SWEPT = ["src/left.js", "src/moved.js", "src/old.js"];

test("swept: a step commit records the paths outside the change folder it takes; status and report.md name them", { skip }, () => {
  const { wt } = freshRun();
  implementWithLeftovers(wt);
  const res = nextIn(wt);
  assert.equal(res.status, 0, res.stdout + res.stderr);
  assert.equal(subject(wt), "chore(demo): step 3 implement");
  const entries = readLogEntries(wt);
  const impl = entries.find((e) => e.step === "implement");
  assert.deepEqual(impl.swept, SWEPT);
  assert.equal(Object.hasOwn(entries.find((e) => e.step === "plan"), "swept"), false);
  const st = run(wt, ["status", "demo", "--report"], { env: gitEnv(wt) });
  assert.deepEqual(st.json.steps.find((s) => s.step === "implement").swept, SWEPT);
  assert.equal(st.json.steps.find((s) => s.step === "plan").swept, undefined);
  const report = readReportFile(wt);
  assert.match(report, /^Code under chore commits: 3 path\(s\) in 1 step commit\(s\); see "Code committed by the router"$/m);
  assert.match(report, /^## Code committed by the router$/m);
  assert.match(report, new RegExp(`^- step 3 implement \\(${impl.commit.slice(0, 7)}\\):$`, "m"));
  for (const f of SWEPT) assert.match(report, new RegExp(`^  - \`${f.replace(".", "\\.")}\`$`, "m"));
  assert.doesNotMatch(report, /src\/done\.js/);
});

test("swept: a run with no path outside the change folder has no key, no header line and no section", { skip }, () => {
  const { wt } = freshRun();
  planDone(wt);
  assert.equal(nextIn(wt).json.action, "run");
  assert.equal(Object.hasOwn(readLogEntries(wt)[0], "swept"), false);
  run(wt, ["status", "demo", "--report"], { env: gitEnv(wt) });
  const report = readReportFile(wt);
  assert.doesNotMatch(report, /Code under chore commits/);
  assert.doesNotMatch(report, /Code committed by the router/);
});

// A directory with a `git` that runs the real git, except that the given subcommand fails while the marker exists.
function gitFailingNames(marker, sub = "diff --cached --name-only") {
  const real = spawnSync("sh", ["-c", "command -v git"], { encoding: "utf8" }).stdout.trim();
  const bin = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "as-nonames-"));
  fs.writeFileSync(path.join(bin, "git"), [
    "#!/bin/sh",
    `case " $* " in`,
    `  *" ${sub} "*) if [ -e "${marker}" ]; then echo "fatal: no names" >&2; exit 128; fi;;`,
    "esac",
    `exec "${real}" "$@"`,
    "",
  ].join("\n"), { mode: 0o755 });
  return bin;
}

test("swept: a failed name read halts with nothing committed and no commit key; the resume commits and records swept", { skip: skip || process.platform === "win32" }, () => {
  const { wt } = freshRun();
  implementWithLeftovers(wt);
  const bin = gitFailingNames(path.join(wt.top, "..", "fail-names"));
  const marker = path.join(wt.top, "..", "fail-names");
  fs.writeFileSync(marker, "");
  const before = head(wt);
  try {
    const env = { ...gitEnv(wt), PATH: `${bin}${path.delimiter}${process.env.PATH}` };
    const res = run(wt, ["next", wt.id], { env });
    assert.equal(res.json.action, "halt", res.stdout);
    assert.match(res.json.reason, /git diff --cached --name-only failed: .*no names/);
    assert.match(res.json.reason, /Nothing was committed\./);
    assert.equal(head(wt), before);
    assert.ok(indexEmpty(wt));
    const stuck = readLogEntries(wt).find((e) => e.step === "implement");
    assert.equal(Object.hasOwn(stuck, "commit"), false);
    assert.equal(Object.hasOwn(stuck, "swept"), false);
    fs.rmSync(marker);
    const again = run(wt, ["next", wt.id], { env });
    assert.equal(again.json.action, "run", again.stdout);
  } finally {
    fs.rmSync(marker, { force: true });
    removeTree(bin);
  }
  assert.equal(subject(wt), "chore(demo): step 3 implement");
  assert.deepEqual(readLogEntries(wt).find((e) => e.step === "implement").swept, SWEPT);
});

test("swept: an unreadable show-prefix records no swept paths and does not halt", { skip: skip || process.platform === "win32" }, () => {
  const { wt } = freshRun();
  implementWithLeftovers(wt);
  const marker = path.join(wt.top, "..", "fail-prefix");
  const bin = gitFailingNames(marker, "rev-parse --show-prefix");
  fs.writeFileSync(marker, "");
  try {
    const env = { ...gitEnv(wt), PATH: `${bin}${path.delimiter}${process.env.PATH}` };
    const res = run(wt, ["next", wt.id], { env });
    assert.equal(res.json.action, "run", res.stdout);
  } finally {
    fs.rmSync(marker, { force: true });
    removeTree(bin);
  }
  const impl = readLogEntries(wt).find((e) => e.step === "implement");
  assert.equal(typeof impl.commit, "string", "the commit is made and recorded");
  assert.equal(Object.hasOwn(impl, "swept"), false, "no path is guessed without the prefix");
});

test("swept: a step commit with an unreadable hash names its paths without empty parentheses", { skip }, () => {
  const { wt } = freshRun();
  implementWithLeftovers(wt);
  assert.equal(nextIn(wt).status, 0);
  const entries = readLogEntries(wt);
  entries.find((e) => e.step === "implement").commit = null;
  writeLog(wt, entries);
  run(wt, ["status", "demo", "--report"], { env: gitEnv(wt) });
  const report = readReportFile(wt);
  assert.match(report, /^- step 3 implement:$/m);
  assert.doesNotMatch(report, /\(\)/);
});
