// Run isolation gate (worktree-step-commits, Phase 2): init requires a linked worktree on a run branch, stores
// meta.isolated and meta.branch at the first init, and next puts the working-directory rules before every prompt.
// Real linked worktrees in scratch repositories, hermetic git.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  cleanupAll, makeProject, run, git, gitAvailable, gitEnv, gitInit, writeResult, writeLog, writeMetaFile,
  readLogEntries, readMetaFile, entry,
} from "./helpers.mjs";

after(cleanupAll);

const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const POLICY = JSON.parse(fs.readFileSync(path.join(SKILL_DIR, "policy.json"), "utf8"));
const RULES = fs.readFileSync(path.join(SKILL_DIR, "prompts/worktree.md"), "utf8").trim();
const GOAL = "Add a retry counter to the status output so the report shows how often each step ran again";
const ON = { isolation: { require: true } };
const OVERRIDE_NAMED = /\{ "isolation": \{ "require": false \} \}/;
const skip = !gitAvailable() && "git is not available";

// A scratch repository whose main checkout holds the committed project (change folder and override).
function repo({ policy = ON, nest = null } = {}) {
  const project = makeProject({ policy, nest });
  gitInit(project);
  git(project, ["add", "-A"]);
  git(project, ["commit", "-q", "-m", "chore: project"]);
  project.git = true;
  return project;
}

// A linked worktree of `main` under .claude/worktrees/, on a new branch, as the orchestrator makes it.
// The returned project object points at the run root inside the worktree.
function worktree(main, branch = `agent-smith/${main.id}`, name = `agent-smith-${main.id}`) {
  const top = path.join(main.base, ".claude/worktrees", name);
  git(main, ["worktree", "add", "-q", "-b", branch, top]);
  const prefix = path.relative(main.base, main.root);
  const root = prefix ? path.join(top, prefix) : top;
  const changeDir = path.join(root, "context/changes", main.id);
  return {
    id: main.id, base: main.base, top, root, changeDir, git: true,
    agentDir: path.join(changeDir, "agent-smith"), planFile: path.join(changeDir, "plan.md"),
  };
}

const initIn = (project, extra = []) => run(project, ["init", project.id, "--goal", GOAL, ...extra], { env: gitEnv(project) });
const nextIn = (project) => run(project, ["next", project.id], { env: gitEnv(project) });

function assertHalt(res, pattern, project) {
  assert.equal(res.status, 1, res.stdout + res.stderr);
  assert.equal(res.json.action, "halt", res.stdout);
  assert.match(res.json.reason, pattern);
  assert.match(res.json.reason, /Nothing was written\.$/);
  if (project) assert.equal(fs.existsSync(project.agentDir), false, "nothing was written");
}

test("2.1 policy.json ships the isolation block on, and the worktree prompt wired", () => {
  assert.deepEqual(POLICY.isolation, {
    require: true,
    defaultBranches: ["main", "master"],
    branchPrefix: "agent-smith/",
    gitTimeoutMs: 120000,
    commit: { message: "chore({id}): step {n} {step}", startMessage: "chore({id}): start run" },
    rollback: { ref: "refs/agent-smith/{id}/failed-{n}" },
  });
  assert.equal(POLICY.prompts.worktree, "@prompts/worktree.md");
  assert.ok(RULES.includes("{workdir}"));
  assert.doesNotMatch(RULES, /\b(sonnet|opus|haiku|fable|effort|tier|model)\b/i);
});

test("2.1 the main checkout halts, names the override and writes nothing", { skip }, () => {
  const main = repo();
  const res = initIn(main);
  assertHalt(res, /main checkout/, main);
  assert.match(res.json.reason, OVERRIDE_NAMED);
});

test("2.1 a project root below the repository top level halts in the main checkout too", { skip }, () => {
  const main = repo({ nest: "app" });
  assertHalt(initIn(main), /main checkout/, main);
});

test("2.1 a directory that is not a git work tree halts and names the override", { skip }, () => {
  const project = makeProject({ policy: ON });
  project.git = true;
  const res = initIn(project);
  assertHalt(res, /needs a git work tree/, project);
  assert.match(res.json.reason, OVERRIDE_NAMED);
});

test("2.1 a linked worktree on agent-smith/<id> passes and stores meta.isolated and meta.branch", { skip }, () => {
  const main = repo();
  const wt = worktree(main);
  const res = initIn(wt);
  assert.equal(res.status, 0, res.stdout + res.stderr);
  assert.equal(res.json.action, "run");
  assert.equal(res.json.step, "plan");
  const meta = readMetaFile(wt);
  assert.equal(meta.isolated, true);
  assert.equal(meta.branch, "agent-smith/demo");
  // init calls next in the same process, so the first prompt already carries the rules, with the run root.
  const rules = RULES.replaceAll("{workdir}", wt.root);
  assert.ok(res.json.prompt.startsWith(rules + "\n\n"), res.json.prompt.slice(0, 200));
  assert.ok(res.json.prompt.includes("Run /10x-plan demo"));
  // The main checkout is untouched.
  assert.equal(fs.existsSync(main.agentDir), false);
});

test("2.1 a project root below the repository top level passes in its worktree", { skip }, () => {
  const main = repo({ nest: "app" });
  const wt = worktree(main);
  assert.ok(wt.root.endsWith(path.join("agent-smith-demo", "app")));
  const res = initIn(wt);
  assert.equal(res.status, 0, res.stdout + res.stderr);
  assert.equal(readMetaFile(wt).isolated, true);
  assert.ok(res.json.prompt.includes(`\`${wt.root}\``));
});

test("2.1 a detached HEAD halts", { skip }, () => {
  const main = repo();
  const wt = worktree(main);
  git(main, ["-C", wt.top, "checkout", "-q", "--detach"]);
  assertHalt(initIn(wt), /HEAD is detached/, wt);
});

test("2.1 a default branch from the policy list halts", { skip }, () => {
  const main = repo();
  const wt = worktree(main, "master", "wt-master");
  assertHalt(initIn(wt), /Branch master is a default branch/, wt);
});

test("2.1 the branch origin/HEAD points to counts as a default branch, without its remote name", { skip }, () => {
  const main = repo();
  git(main, ["update-ref", "refs/remotes/origin/trunk", "HEAD"]);
  git(main, ["symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/trunk"]);
  const wt = worktree(main, "trunk", "wt-trunk");
  assertHalt(initIn(wt), /Branch trunk is a default branch/, wt);
});

test("2.1 a linked worktree on a branch without the agent-smith/ prefix halts", { skip }, () => {
  const main = repo();
  const wt = worktree(main, "feature/x", "wt-feature");
  assertHalt(initIn(wt), /does not start with agent-smith\//, wt);
});

test("2.1 git ignoring a router file halts", { skip }, () => {
  const main = repo();
  const wt = worktree(main);
  fs.writeFileSync(path.join(wt.top, ".gitignore"), "*.jsonl\n");
  assertHalt(initIn(wt), /git ignores context\/changes\/demo\/agent-smith\/run\.jsonl/, wt);
});

test("2.1 a resume of a log with executed entries and no meta.isolated halts, names the override and writes nothing", { skip }, () => {
  const main = repo();
  const wt = worktree(main);
  writeLog(wt, [entry(1, "plan", { template: "plan" })]);
  writeMetaFile(wt, { id: "demo", goal: GOAL });
  const before = fs.readFileSync(path.join(wt.agentDir, "meta.json"), "utf8");
  const res = initIn(wt);
  assertHalt(res, /not started isolated/);
  assert.match(res.json.reason, OVERRIDE_NAMED);
  assert.equal(fs.readFileSync(path.join(wt.agentDir, "meta.json"), "utf8"), before);
  assert.equal(readLogEntries(wt).length, 1);
});

test("2.1 a resume keeps meta.isolated, and a resume on another branch halts", { skip }, () => {
  const main = repo();
  const wt = worktree(main);
  assert.equal(initIn(wt).status, 0);
  writeResult(wt, { status: "failed", note: "x" });
  const again = initIn(wt);
  assert.equal(again.status, 0, again.stdout);
  assert.equal(readMetaFile(wt).isolated, true);
  assert.equal(readMetaFile(wt).branch, "agent-smith/demo");
  git(main, ["-C", wt.top, "checkout", "-q", "-b", "agent-smith/other"]);
  const before = fs.readFileSync(path.join(wt.agentDir, "meta.json"), "utf8");
  assertHalt(initIn(wt), /started on branch agent-smith\/demo and HEAD is on agent-smith\/other/);
  assert.equal(fs.readFileSync(path.join(wt.agentDir, "meta.json"), "utf8"), before);
});

test("2.1 require false keeps today's behaviour: no meta.isolated, no worktree rules, also in the main checkout", { skip }, () => {
  const main = repo({ policy: {} });
  const res = initIn(main);
  assert.equal(res.status, 0, res.stdout + res.stderr);
  assert.equal(res.json.step, "plan");
  const meta = readMetaFile(main);
  assert.equal(Object.hasOwn(meta, "isolated"), false);
  assert.equal(Object.hasOwn(meta, "branch"), false);
  assert.ok(res.json.prompt.startsWith("Run /10x-plan demo"));
  assert.equal(res.json.prompt.includes("Working directory rules"), false);
  // A value other than the boolean true is off too.
  const loose = repo({ policy: { isolation: { require: "true" } } });
  const res2 = initIn(loose);
  assert.equal(res2.status, 0, res2.stdout);
  assert.equal(Object.hasOwn(readMetaFile(loose), "isolated"), false);
});

test("2.2 next puts the worktree rules before every prompt of an isolated run only", { skip }, () => {
  const main = repo();
  const wt = worktree(main);
  assert.equal(initIn(wt).status, 0);
  writeResult(wt, { status: "failed", note: "no plan" });
  const retry = nextIn(wt);
  assert.equal(retry.json.action, "run", retry.stdout);
  assert.ok(retry.json.prompt.startsWith(RULES.replaceAll("{workdir}", wt.root) + "\n\n"));
  assert.equal(retry.json.prompt.split("Working directory rules").length - 1, 1, "the rules appear once");

  const plain = repo({ policy: {} });
  assert.equal(initIn(plain).status, 0);
  writeResult(plain, { status: "failed", note: "no plan" });
  const plainRetry = nextIn(plain);
  assert.equal(plainRetry.json.action, "run");
  assert.equal(plainRetry.json.prompt.includes("Working directory rules"), false);
});
