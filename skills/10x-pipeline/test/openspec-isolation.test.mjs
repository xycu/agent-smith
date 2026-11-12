// OpenSpec chain, Phase 3 (ADR-013 D3, D8, D11 on ADR-010): an isolated OpenSpec run gets the start commit of
// openspec/changes/<id>/, a step commit per verified step and the rollback of a failed step, and its fix-loop halt names
// the commit rule. Real linked worktrees in scratch repositories, hermetic git.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  cleanupAll, run, git, gitAvailable, gitEnv, gitInit, writeResult, writeLog, writeMetaFile, readLogEntries,
  readMetaFile, entry,
} from "./helpers.mjs";
import { makeOpenspecProject, writeArtifacts, writeVerify } from "./openspec-helpers.mjs";

after(cleanupAll);

const GOAL = "Add a greeting script that prints hello";
const ON = { isolation: { require: true } };
const PROPOSED = { proposal: true, specs: 1, tasks: { done: 0, open: 2 } };
const TICKED = { proposal: true, specs: 1, tasks: { done: 2, open: 0 } };
const CHANGE = "openspec/changes/demo";
const skip = !gitAvailable() && "git is not available";

// A scratch repository whose main checkout holds the committed OpenSpec project and override.
function repo(artifacts = PROPOSED, { setup = () => {} } = {}) {
  const project = makeOpenspecProject({ policy: ON, ...artifacts });
  setup(project);
  gitInit(project);
  git(project, ["add", "-A"]);
  git(project, ["commit", "-q", "-m", "chore: project"]);
  return project;
}

// A linked worktree of `main` under .claude/worktrees/ on agent-smith/<id>, as the orchestrator makes it.
function worktree(main) {
  const top = path.join(main.base, ".claude/worktrees", `agent-smith-${main.id}`);
  git(main, ["worktree", "add", "-q", "-b", `agent-smith/${main.id}`, top]);
  const changeDir = path.join(top, CHANGE);
  return { id: main.id, base: main.base, top, root: top, changeDir, agentDir: path.join(changeDir, "agent-smith") };
}

const gw = (wt, args) => git(wt, ["-C", wt.top, ...args]);
const initIn = (project) => run(project, ["init", project.id, "--goal", GOAL, "--chain", "openspec"], { env: gitEnv(project) });
const nextIn = (project) => run(project, ["next", project.id], { env: gitEnv(project) });
const head = (wt) => gw(wt, ["rev-parse", "HEAD"]);
const subject = (wt, rev = "HEAD") => gw(wt, ["log", "-1", "--format=%s", rev]);
const names = (wt, rev = "HEAD") => gw(wt, ["show", "--name-only", "--format=", rev]).split("\n").filter(Boolean);
const showFile = (wt, rev, rel) => gw(wt, ["show", `${rev}:${rel}`]);
const refExists = (wt, ref) => spawnSync("git", ["-C", wt.top, "rev-parse", "-q", "--verify", ref], { env: gitEnv(wt) }).status === 0;
const tasksOf = (wt) => fs.readFileSync(path.join(wt.changeDir, "tasks.md"), "utf8");

function freshRun(artifacts = PROPOSED) {
  const main = repo(artifacts);
  const wt = worktree(main);
  const res = initIn(wt);
  assert.equal(res.status, 0, res.stdout + res.stderr);
  return { main, wt, res };
}

test("the start commit of an isolated OpenSpec run holds only openspec/changes/<id>/", { skip }, () => {
  const main = repo();
  const wt = worktree(main);
  // The orchestrator's copy: an edited proposal and an untracked note in the change folder.
  fs.appendFileSync(path.join(wt.changeDir, "proposal.md"), "\nCopied from the main checkout.\n");
  fs.writeFileSync(path.join(wt.changeDir, "notes.md"), "notes\n");
  const base = head(wt);
  const res = initIn(wt);
  assert.equal(res.status, 0, res.stdout + res.stderr);
  assert.equal(res.json.step, "os-apply");
  const meta = readMetaFile(wt);
  assert.equal(meta.isolated, true);
  assert.equal(meta.branch, "agent-smith/demo");
  assert.equal(meta.baseSha, base);
  assert.match(meta.startCommit, /^[0-9a-f]{40,64}$/);
  assert.equal(meta.startCommit, head(wt));
  assert.equal(subject(wt), "chore(demo): start run");
  const files = names(wt);
  assert.ok(files.every((f) => f.startsWith(`${CHANGE}/`)), files.join(", "));
  for (const f of [`${CHANGE}/agent-smith/meta.json`, `${CHANGE}/proposal.md`, `${CHANGE}/notes.md`]) assert.ok(files.includes(f), f);
  assert.equal(readLogEntries(wt)[0].startSha, meta.startCommit);
  // The prompt opens with the working-directory rules of an isolated run.
  assert.ok(res.json.prompt.includes(wt.top), res.json.prompt.slice(0, 300));
});

test("a verified os-apply gets a step commit", { skip }, () => {
  const { wt } = freshRun();
  fs.mkdirSync(path.join(wt.top, "src"), { recursive: true });
  fs.writeFileSync(path.join(wt.top, "src/hello.sh"), "echo hello\n");
  writeArtifacts(wt, { tasks: { done: 2, open: 0 } });
  writeResult(wt, { status: "done", note: "applied" });
  const res = nextIn(wt);
  assert.equal(res.status, 0, res.stdout + res.stderr);
  assert.equal(res.json.step, "os-verify");
  assert.equal(subject(wt), "chore(demo): step 1 os-apply");
  const files = names(wt);
  for (const f of ["src/hello.sh", `${CHANGE}/tasks.md`, `${CHANGE}/agent-smith/run.jsonl`]) assert.ok(files.includes(f), f);
  const [applied, verify] = readLogEntries(wt);
  assert.equal(applied.ok, true);
  assert.equal(applied.commit, head(wt));
  assert.equal(verify.startSha, head(wt));
  assert.deepEqual(Object.keys(verify.before.mtimes).sort(), ["tasks", "verify"]);
  // The committed run.jsonl holds the step's result.
  assert.match(showFile(wt, "HEAD", `${CHANGE}/agent-smith/run.jsonl`), /"note":"applied"/);
  // The code file is recorded as swept; nothing under the change folder is.
  assert.deepEqual(applied.swept, ["src/hello.sh"]);
  assert.equal(Object.hasOwn(verify, "swept"), false);
});

test("a failed os-apply resets the code and tasks.md to startSha and writes the side ref", { skip }, () => {
  const { wt } = freshRun();
  const start = head(wt);
  const before = tasksOf(wt);
  fs.mkdirSync(path.join(wt.top, "src"), { recursive: true });
  fs.writeFileSync(path.join(wt.top, "src/half.sh"), "echo half\n");
  writeArtifacts(wt, { tasks: { done: 1, open: 1 } });
  writeResult(wt, { status: "failed", note: "tests red" });
  const res = nextIn(wt);
  assert.equal(res.status, 0, res.stdout + res.stderr);
  assert.equal(res.json.step, "os-apply");
  const token = readMetaFile(wt).startCommit.slice(0, 12);
  const ref = `refs/agent-smith/demo/${token}/failed-1`;
  assert.ok(refExists(wt, ref));
  assert.equal(showFile(wt, ref, "src/half.sh"), "echo half");
  assert.match(showFile(wt, ref, `${CHANGE}/tasks.md`), /- \[x\] 1\.1/);
  assert.equal(subject(wt, ref), "agent-smith: failed step 1 (os-apply)");
  // The worktree is back at startSha: no code, no tick.
  assert.equal(head(wt), start);
  assert.equal(fs.existsSync(path.join(wt.top, "src/half.sh")), false);
  assert.equal(tasksOf(wt), before);
  const entries = readLogEntries(wt);
  assert.equal(entries[0].rolledBack, ref);
  assert.equal(entries[1].template, "os-apply");
  assert.deepEqual(entries[1].before.ticks, 0);
  assert.match(entries[1].tierWhy, /\+1 for 1 failed attempt/);
});

test("an OpenSpec init in a worktree that holds context/changes/<id>/ halts", { skip }, () => {
  const main = repo(PROPOSED, {
    setup: (project) => {
      fs.mkdirSync(project.tenxChangeDir, { recursive: true });
      fs.writeFileSync(path.join(project.tenxChangeDir, "change.md"), "---\nchange_id: demo\nstatus: planned\n---\n");
    },
  });
  const wt = worktree(main);
  const start = head(wt);
  const res = initIn(wt);
  assert.equal(res.status, 1, res.stdout + res.stderr);
  assert.equal(res.json.action, "halt");
  assert.match(res.json.reason, /^context\/changes\/demo\/ exists: a 10x change already uses the name demo\./);
  assert.match(res.json.reason, /Nothing was written\.$/);
  assert.equal(fs.existsSync(wt.agentDir), false);
  assert.equal(head(wt), start);
});

test("the fix-loop halt of an isolated run adds the commit rule", () => {
  // Run state only: the last entry is a verified os-verify with a step commit, so next makes no git call.
  const project = makeOpenspecProject({ policy: ON, ...TICKED });
  writeMetaFile(project, { id: "demo", goal: GOAL, chain: "openspec", isolated: true, branch: "agent-smith/demo", startCommit: null });
  const fix = { template: "os-apply-fix", commit: null };
  writeLog(project, [
    entry(1, "os-verify", { commit: null }),
    entry(2, "os-apply", fix),
    entry(3, "os-verify", { commit: null }),
    entry(4, "os-apply", fix),
    entry(5, "os-verify", { commit: null }),
  ]);
  writeVerify(project, "Verdict: FAIL\nCritical: 1\nWarnings: 0\n\n## Critical\n\n- broken\n\n## Warnings\n");
  const res = run(project, ["next", "demo"]);
  assert.equal(res.json.action, "halt", res.stdout);
  assert.equal(res.json.reason,
    `OpenSpec verify FAIL after 2 fix loops. Needs a human. Fix the issues, set the first lines of ${CHANGE}/agent-smith/verify.md ` +
    'to "Verdict: PASS" and "Critical: 0", then run /agent-smith:openspec-pipeline demo again. ' +
    "Commit the edit in the run worktree first: a failed step rolls back uncommitted edits.");
});
