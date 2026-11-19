// Tests for scripts/open-pr.mjs. Each world is a real repository with a real bare remote and a real linked worktree
// (hermetic git, as in isolation.test.mjs), a `git` shim first on PATH that logs its argv and then runs the real git,
// and a /bin/sh fake `gh` (as in pr-comment.test.mjs) that logs its argv and answers from canned files.
//
// The remote: `remote.origin.url` is a github.com url, so `git remote get-url origin` (which the script parses for
// --repo) returns it, while `remote.origin.pushurl` points at the local bare repository, so the push lands there.
// `url.<base>.insteadOf` was not used: `git remote get-url` expands insteadOf and would print the local path.
// A fetch would use the github.com url, so the tests never fetch: remote-tracking refs come from pushes.
// Plain node: built-ins only.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildBody, markerFor, parseRepo, pathsToStage, prTitleFor, titleFor } from "../scripts/open-pr.mjs";
import { TYPES, lintSubject } from "../../../tools/commit-lint.mjs";
import { cleanEnv } from "./helpers.mjs";
import { removeTree } from "../scripts/remove-tree.mjs";

const SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../scripts/open-pr.mjs");
const SCRIPTS = path.dirname(SCRIPT);
const win = process.platform === "win32";
const REAL_GIT = spawnSync("sh", ["-c", "command -v git"], { encoding: "utf8" }).stdout.trim();
const skip = (win || !REAL_GIT) && "needs /bin/sh and git";
const dirs = [];

after(() => {
  for (const d of dirs.splice(0)) removeTree(d);
});

function tmpDir(prefix) {
  const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), prefix));
  dirs.push(dir);
  return dir;
}

const GIT_SHIM = (real) => `#!/bin/sh
printf '%s\\037' "$@" >> "$GIT_LOG"
printf '\\n' >> "$GIT_LOG"
if [ "$*" = "$GIT_FAIL_PROBE" ]; then exit 1; fi
exec "${real}" "$@"
`;

// Kinds: pr-list, pr-create, repo-view. Files <FAKE_GH_DIR>/<kind>.{out,err,code}. The --body-file is copied to body-<n>.txt.
const GH_SHIM = `#!/bin/sh
D="$FAKE_GH_DIR"
n=$(( $(cat "$D/count" 2>/dev/null || echo 0) + 1 ))
echo "$n" > "$D/count"
printf '%s\\037' "$@" >> "$D/calls.log"
printf '\\n' >> "$D/calls.log"
prev=
for a in "$@"; do
  if [ "$prev" = --body-file ]; then cp "$a" "$D/body-$n.txt"; fi
  prev="$a"
done
kind="$1-$2"
if [ -f "$D/$kind.err" ]; then cat "$D/$kind.err" >&2; fi
if [ -f "$D/$kind.out" ]; then cat "$D/$kind.out"; fi
code=0
if [ -f "$D/$kind.code" ]; then code=$(cat "$D/$kind.code"); fi
exit "$code"
`;

const GH_URL = "https://github.com/acme/demo.git";
const PR_URL = "https://github.com/acme/demo/pull/7";
const REPORT = "# Run report: demo\n\nGoal: ship it for @alice\nOutcome: done\n\n| # | Step |\n| --- | --- |\n| 1 | plan |\n\nSteps: 1\n";
const CHANGE_MD = "---\nchange_id: demo\ntitle: Demo title\nstatus: implementing\n---\n\n## Notes\n";

function envFor(w) {
  return {
    ...cleanEnv(),
    HOME: w.base,
    GIT_CONFIG_GLOBAL: os.devNull,
    GIT_CONFIG_SYSTEM: os.devNull,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CEILING_DIRECTORIES: path.dirname(w.base),
    GIT_AUTHOR_NAME: "Test",
    GIT_AUTHOR_EMAIL: "test@example.com",
    GIT_COMMITTER_NAME: "Test",
    GIT_COMMITTER_EMAIL: "test@example.com",
    GIT_CONFIG_COUNT: "2",
    GIT_CONFIG_KEY_0: "commit.gpgsign",
    GIT_CONFIG_VALUE_0: "false",
    GIT_CONFIG_KEY_1: "init.defaultBranch",
    GIT_CONFIG_VALUE_1: "main",
  };
}

// Setup git: the real binary, not the shim, so the logs hold only the script's calls.
function g(w, cwd, args) {
  const res = spawnSync(REAL_GIT, args, { cwd, encoding: "utf8", env: envFor(w) });
  if (res.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${res.stderr}`);
  return res.stdout.trim();
}

function commitFile(w, cwd, file, text, message) {
  fs.mkdirSync(path.dirname(path.join(cwd, file)), { recursive: true });
  fs.writeFileSync(path.join(cwd, file), text);
  g(w, cwd, ["add", "--", file]);
  g(w, cwd, ["commit", "-q", "-m", message]);
}

// A repository with main pushed to the bare remote, origin/HEAD -> main, and a linked worktree on agent-smith/demo
// branched from `from`. With start: true the worktree has the start commit of a run.
function world({ id = "demo", url = GH_URL, from = "main", feature = false, start = true, chain = "10x", withGh = true,
  prefix = "agent-smith/", branch = `${prefix}${id}`, nest = null, identity = false, worktreeName = "wt" } = {}) {
  const base = tmpDir("as-opr-");
  const w = { base, id, chain, branch, repo: path.join(base, "repo"), bare: path.join(base, "remote.git"), wt: path.join(base, worktreeName) };
  w.root = nest ? path.join(w.wt, nest) : w.wt;
  fs.mkdirSync(w.repo);
  g(w, base, ["init", "-q", "--bare", w.bare]);
  g(w, w.repo, ["init", "-q"]);
  commitFile(w, w.repo, "README.md", "hello\n", "chore: init");
  g(w, w.repo, ["remote", "add", "origin", url]);
  g(w, w.repo, ["config", "remote.origin.pushurl", w.bare]);
  g(w, w.repo, ["push", "-q", "origin", "main"]);
  g(w, w.repo, ["symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/main"]);
  if (feature) {
    g(w, w.repo, ["checkout", "-q", "-b", "feature/x"]);
    commitFile(w, w.repo, "feature.txt", "f1\n", "feat: one");
    commitFile(w, w.repo, "feature.txt", "f2\n", "feat: two");
    g(w, w.repo, ["push", "-q", "origin", "feature/x"]);
    g(w, w.repo, ["checkout", "-q", "main"]);
    from = "feature/x";
  }
  g(w, w.repo, ["worktree", "add", "-q", "-b", branch, w.wt, from]);
  const changeDir = path.join(w.root, chain === "openspec" ? "openspec/changes" : "context/changes", id);
  w.changeDir = changeDir;
  fs.mkdirSync(path.join(changeDir, "agent-smith"), { recursive: true });
  if (chain === "10x") fs.writeFileSync(path.join(changeDir, "change.md"), CHANGE_MD);
  fs.writeFileSync(path.join(changeDir, "agent-smith", "report.md"), REPORT.replace("# Run report: demo", `# Run report: ${id}`));
  if (prefix !== "agent-smith/") writePolicy(w, { isolation: { require: true, branchPrefix: prefix } });
  if (identity) fs.writeFileSync(path.join(changeDir, "agent-smith/meta.json"), JSON.stringify({ id, isolated: true, branch, ...(chain === "openspec" ? { chain } : {}) }));
  if (start) {
    g(w, w.wt, ["add", "-A"]);
    g(w, w.wt, ["commit", "-q", "-m", `chore(${id}): start run`]);
  }
  w.bin = tmpDir("as-opr-bin-");
  w.fake = tmpDir("as-opr-fake-");
  w.gitLog = path.join(w.fake, "git.log");
  fs.writeFileSync(path.join(w.bin, "git"), GIT_SHIM(REAL_GIT), { mode: 0o755 });
  if (withGh) fs.writeFileSync(path.join(w.bin, "gh"), GH_SHIM, { mode: 0o755 });
  setAnswers(w, { "pr-list": { out: "[]" }, "pr-create": { out: `${PR_URL}\n` } });
  return w;
}

function writePolicy(w, policy) {
  const file = path.join(w.root, "context/foundation/agent-smith-policy.json");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(policy));
}

function setAnswers(w, answers) {
  for (const [kind, a] of Object.entries(answers)) {
    for (const ext of ["out", "err", "code"]) fs.rmSync(path.join(w.fake, `${kind}.${ext}`), { force: true });
    for (const [ext, value] of Object.entries(a)) fs.writeFileSync(path.join(w.fake, `${kind}.${ext}`), String(value));
  }
}

function runScript(w, args = [w.id], { cwd = w.root, onlyBin = false, env = {} } = {}) {
  const res = spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd,
    encoding: "utf8",
    env: {
      ...envFor(w),
      PATH: onlyBin ? w.bin : `${w.bin}${path.delimiter}${process.env.PATH}`,
      GIT_LOG: w.gitLog,
      FAKE_GH_DIR: w.fake,
      ...env,
    },
  });
  let json = null;
  try { json = JSON.parse(res.stdout); } catch { /* leave null */ }
  if (res.status === 0) assert.equal(res.stdout.trim().split("\n").length, 1, `one JSON line: ${res.stdout}`);
  assertNoForbidden(w);
  return { status: res.status, json, stdout: res.stdout, stderr: res.stderr };
}

const readLog = (file) => fs.existsSync(file)
  ? fs.readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => l.split("\u001f").slice(0, -1))
  : [];
const gitCalls = (w) => readLog(w.gitLog);
const ghCalls = (w) => readLog(path.join(w.fake, "calls.log"));

const FORBIDDEN = ["--force", "-f", "--force-with-lease", "-u", "--set-upstream", "--no-verify", "--amend", "rebase", "merge", "review", "--delete", "-d", "-D"];

function assertNoForbidden(w) {
  for (const args of [...gitCalls(w), ...ghCalls(w)]) {
    for (const a of args) {
      assert.ok(!FORBIDDEN.includes(a) && !a.startsWith("--force"), `forbidden argument ${a} in ${args.join(" ")}`);
    }
    assert.ok(!(args[0] === "worktree" && args[1] === "remove"), args.join(" "));
    assert.ok(!(args[0] === "config"), `git config call: ${args.join(" ")}`);
  }
}

const WRITES = new Set(["add", "commit", "push", "reset", "update-ref", "branch", "tag", "checkout", "switch", "stash", "config"]);
const writeCalls = (w) => gitCalls(w).filter((a) => WRITES.has(a[0]));

const remoteRef = (w, branch = w.branch) => {
  const res = spawnSync(REAL_GIT, ["--git-dir", w.bare, "rev-parse", "-q", "--verify", `refs/heads/${branch}`], { encoding: "utf8", env: envFor(w) });
  return res.status === 0 ? res.stdout.trim() : null;
};
const head = (w) => g(w, w.wt, ["rev-parse", "HEAD"]);

function capturedBody(w) {
  const files = fs.readdirSync(w.fake).filter((f) => /^body-\d+\.txt$/.test(f));
  assert.equal(files.length, 1, `expected one captured body, got ${files}`);
  return fs.readFileSync(path.join(w.fake, files[0]), "utf8");
}

// ---- push and create ----------------------------------------------------------------

test("create: the branch lands on the bare remote and gh pr create gets --repo, --head, --base, --title and --body-file", { skip }, () => {
  const w = world();
  const res = runScript(w);
  assert.equal(res.status, 0, res.stderr);
  assert.equal(res.json.pushed, true, res.stdout);
  assert.equal(res.json.branch, "agent-smith/demo");
  assert.equal(res.json.remote, "origin");
  assert.equal(res.json.base, "main");
  assert.equal(res.json.committed, null);
  assert.equal(res.json.reason, null);
  assert.equal(res.json.manual, null);
  assert.deepEqual(res.json.pr, { action: "created", url: PR_URL, state: "OPEN", reason: null });
  assert.equal(remoteRef(w), head(w));
  const [list, create] = ghCalls(w);
  assert.deepEqual(list, ["pr", "list", "--repo", "acme/demo", "--head", "agent-smith/demo", "--state", "all", "--json", "number,url,state"]);
  assert.equal(create.length, 12);
  assert.deepEqual(create.slice(0, 11), ["pr", "create", "--repo", "acme/demo", "--head", "agent-smith/demo", "--base", "main", "--title", "chore(demo): Demo title", "--body-file"]);
  assert.equal(ghCalls(w).length, 2);
  const push = gitCalls(w).filter((a) => a[0] === "push");
  assert.deepEqual(push, [["push", "origin", "refs/heads/agent-smith/demo:refs/heads/agent-smith/demo"]]);
  const body = capturedBody(w);
  assert.ok(body.startsWith(`${markerFor("demo")}\n\n# Run report: demo\n`), body);
  assert.ok(body.includes("Goal: ship it for @​alice"));
  assert.ok(body.includes("Outcome: done"));
  assert.ok(!body.includes("|"), "no table row in the body");
  assert.ok(!body.includes("Steps: 1"));
});

test("a second run creates nothing: the open pull request is existing and the push is a no-op", { skip }, () => {
  const w = world();
  assert.equal(runScript(w).json.pr.action, "created");
  setAnswers(w, { "pr-list": { out: JSON.stringify([{ number: 7, url: PR_URL, state: "OPEN" }]) } });
  const res = runScript(w);
  assert.equal(res.json.pushed, true);
  assert.equal(res.json.committed, null);
  assert.deepEqual(res.json.pr, { action: "existing", url: PR_URL, state: "OPEN", reason: null });
  assert.equal(ghCalls(w).filter((a) => a[1] === "create").length, 1, "only the first run created");
  assert.equal(remoteRef(w), head(w));
});

test("--draft adds --draft to gh pr create, and only then", { skip }, () => {
  const w = world();
  runScript(w, ["demo", "--draft"]);
  const create = ghCalls(w).find((a) => a[1] === "create");
  assert.equal(create.at(-1), "--draft");
});

// ---- base ---------------------------------------------------------------------------

test("base: the pushed feature branch the run was branched from, unchanged on a second run", { skip }, () => {
  const w = world({ feature: true });
  const res = runScript(w);
  assert.equal(res.json.base, "feature/x", res.stdout);
  assert.equal(res.json.pushed, true);
  assert.equal(ghCalls(w).find((a) => a[1] === "create")[7], "feature/x");
  // The run branch is now on the remote (refs/remotes/origin/agent-smith/demo exists): it is not a base candidate.
  assert.ok(g(w, w.wt, ["for-each-ref", "--format=%(refname)", "refs/remotes/origin/agent-smith/"]).includes("agent-smith/demo"));
  setAnswers(w, { "pr-list": { out: JSON.stringify([{ number: 7, url: PR_URL, state: "OPEN" }]) } });
  assert.equal(runScript(w).json.base, "feature/x");
});

test("base: a tie goes to the branch origin/HEAD points to, and --base wins over the search", { skip }, () => {
  const w = world();
  g(w, w.repo, ["push", "-q", "origin", "main:refs/heads/aaa-copy"]);
  assert.equal(runScript(w).json.base, "main");
  const forced = world();
  g(forced, forced.repo, ["push", "-q", "origin", "main:refs/heads/release"]);
  const res = runScript(forced, ["demo", "--base", "release"]);
  assert.equal(res.json.base, "release");
  assert.equal(ghCalls(forced).find((a) => a[1] === "create")[7], "release");
});

test("base: one for-each-ref call finds and counts the ancestors, with no git process per remote branch", { skip }, () => {
  const w = world({ feature: true });
  for (const n of [1, 2, 3]) g(w, w.repo, ["push", "-q", "origin", `main:refs/heads/copy-${n}`]);
  assert.equal(runScript(w).json.base, "feature/x");
  const calls = gitCalls(w);
  assert.equal(calls.filter((a) => a[0] === "for-each-ref").length, 1, JSON.stringify(calls));
  assert.equal(calls.filter((a) => a[0] === "merge-base").length, 0);
  assert.equal(calls.filter((a) => a[0] === "rev-list").length, 1, "only the ahead count of the chosen base");
});

test("base: a git without %(ahead-behind) falls back to one rev-list per ancestor and picks the same base", { skip }, () => {
  const w = world({ feature: true });
  g(w, w.repo, ["push", "-q", "origin", "main:refs/heads/aaa-copy"]);
  const shim = GIT_SHIM(REAL_GIT).replace("exec ", "case \"$*\" in *ahead-behind*) echo 'fatal: unknown field name: ahead-behind:HEAD' >&2; exit 128;; esac\nexec ");
  fs.writeFileSync(path.join(w.bin, "git"), shim, { mode: 0o755 });
  assert.equal(runScript(w).json.base, "feature/x");
  const merged = gitCalls(w).filter((a) => a[0] === "for-each-ref" && a.includes("--merged"));
  assert.equal(merged.length, 2, "the rejected call, then the plain one");
  assert.equal(gitCalls(w).filter((a) => a[0] === "merge-base").length, 0);
  const tie = world();
  g(tie, tie.repo, ["push", "-q", "origin", "main:refs/heads/aaa-copy"]);
  fs.writeFileSync(path.join(tie.bin, "git"), shim, { mode: 0o755 });
  assert.equal(runScript(tie).json.base, "main", "a tie still goes to origin/HEAD");
});

test("base: a remote branch the run does not descend from is never picked", { skip }, () => {
  const w = world();
  g(w, w.repo, ["checkout", "-q", "-b", "other"]);
  commitFile(w, w.repo, "other.txt", "o\n", "feat: other");
  g(w, w.repo, ["push", "-q", "origin", "other"]);
  assert.equal(runScript(w).json.base, "main");
});

// ---- PR skips -------------------------------------------------------------------------

test("a remote url not on github.com skips the pull request and still pushes", { skip }, () => {
  for (const url of ["https://gitlab.com/acme/demo.git", "not a url"]) {
    const w = world({ url });
    const res = runScript(w);
    assert.equal(res.json.pushed, true, `${url}: ${res.stdout}`);
    assert.equal(remoteRef(w), head(w));
    assert.equal(res.json.pr.action, "skipped");
    assert.match(res.json.pr.reason, /not a github\.com repository/);
    assert.deepEqual(ghCalls(w), [], url);
  }
});

test("a MERGED or CLOSED pull request creates nothing, and the push happens", { skip }, () => {
  for (const state of ["MERGED", "CLOSED"]) {
    const w = world();
    setAnswers(w, { "pr-list": { out: JSON.stringify([{ number: 7, url: PR_URL, state }]) } });
    const res = runScript(w);
    assert.equal(res.json.pushed, true);
    assert.equal(remoteRef(w), head(w));
    assert.deepEqual(res.json.pr, { action: "skipped", url: PR_URL, state, reason: `pull request is ${state}` });
    assert.equal(ghCalls(w).length, 1, state);
    assert.equal(res.json.manual, null);
  }
});

test("gh missing gives pushed: true and a pull request skip with the manual command", { skip }, () => {
  const w = world({ withGh: false });
  const res = runScript(w, ["demo"], { onlyBin: true });
  assert.equal(res.status, 0, res.stderr);
  assert.equal(res.json.pushed, true, res.stdout);
  assert.equal(res.json.pr.action, "skipped");
  assert.equal(res.json.pr.reason, "gh is not installed");
  assert.match(res.json.manual, /^gh pr create --repo 'acme\/demo' --head 'agent-smith\/demo' --base 'main'/);
});

test("gh failures: not authenticated, a failed create and unexpected output are pull request skips", { skip }, () => {
  const cases = [
    { answers: { "pr-list": { code: 4, err: "To get started with GitHub CLI, please run:  gh auth login\n" } }, reason: /^gh is not authenticated$/ },
    { answers: { "pr-list": { out: "not json" } }, reason: /^unexpected gh output$/ },
    { answers: { "pr-create": { code: 1, err: "GraphQL: No commits between main and agent-smith/demo\n" } }, reason: /^gh pr create failed: GraphQL: No commits/ },
    { answers: { "pr-create": { out: "\n" } }, reason: /^gh pr create failed: unexpected gh output$/ },
  ];
  for (const c of cases) {
    const w = world();
    setAnswers(w, c.answers);
    const res = runScript(w);
    assert.equal(res.json.pushed, true);
    assert.equal(res.json.pr.action, "skipped");
    assert.match(res.json.pr.reason, c.reason);
  }
});

// ---- no push --------------------------------------------------------------------------

test("no commits ahead pushes nothing and commits nothing", { skip }, () => {
  const w = world({ start: false });
  const before = head(w);
  const res = runScript(w);
  assert.equal(res.status, 0, res.stderr);
  assert.equal(res.json.pushed, false);
  assert.equal(res.json.reason, "no commits on the run branch");
  assert.equal(res.json.manual, "nothing to push: no commit beyond main", "pushed: false always carries a manual text");
  assert.equal(res.json.committed, null);
  assert.equal(head(w), before);
  assert.notEqual(g(w, w.wt, ["status", "--porcelain"]), "", "the copied change folder stays uncommitted");
  assert.equal(remoteRef(w), null);
  assert.deepEqual(writeCalls(w), []);
  assert.deepEqual(ghCalls(w), []);
});

test("main checkout, detached HEAD, wrong branch prefix and no git skip before any write", { skip }, () => {
  const main = world();
  const inMain = runScript(main, ["demo"], { cwd: main.repo });
  assert.match(inMain.json.reason, /^run is not isolated: this is the main checkout/);

  const detached = world();
  g(detached, detached.wt, ["checkout", "-q", "--detach"]);
  writeOperationFile(detached, "rebase-merge/head-name", `refs/heads/${detached.branch}\n`);
  const detachedResult = refuseWithoutWrites(detached);
  assert.match(detachedResult.reason, /^run is not isolated: HEAD is detached$/);
  assert.equal(detachedResult.committed, null);
  assert.equal(detachedResult.commit, null);
  assert.equal(detachedResult.commitError, null);
  assert.equal(detachedResult.swept, null);
  assert.ok(gitCalls(detached).every((args) => !args.includes("--git-path") && !args.includes("--unmerged")));

  const other = world();
  assert.match(runScript(other, ["other"]).json.reason, /^run is not isolated: HEAD is on agent-smith\/demo, not agent-smith\/other$/);

  const prefix = world();
  g(prefix, prefix.wt, ["checkout", "-q", "-b", "feature/demo"]);
  assert.match(runScript(prefix).json.reason, /HEAD is on feature\/demo/);

  const plain = world();
  const outside = tmpDir("as-opr-plain-");
  assert.match(runScript(plain, ["demo"], { cwd: outside }).json.reason, /^run is not isolated: not a git work tree$/);

  for (const w of [main, detached, other, prefix, plain]) {
    assert.deepEqual(writeCalls(w), []);
    assert.deepEqual(ghCalls(w), []);
    assert.equal(remoteRef(w), null);
  }
  const res = runScript(other, ["other"]);
  assert.equal(res.json.pushed, false);
  assert.equal(res.json.pr.action, "skipped");
  assert.match(res.json.manual, /run worktree on agent-smith\/other/);
});

test("no remote of the given name is a skip that names it", { skip }, () => {
  const w = world();
  const res = runScript(w, ["demo", "--remote", "upstream"]);
  assert.equal(res.json.pushed, false);
  assert.equal(res.json.reason, "no remote upstream");
  assert.deepEqual(writeCalls(w), []);
});

test("a diverged remote branch gives pushed: false with git's line, and no force", { skip }, () => {
  const w = world();
  const tree = g(w, w.repo, ["rev-parse", "HEAD^{tree}"]);
  const stray = g(w, w.repo, ["commit-tree", tree, "-p", "HEAD", "-m", "stray"]);
  g(w, w.repo, ["push", "-q", "origin", `${stray}:refs/heads/agent-smith/demo`]);
  const res = runScript(w);
  assert.equal(res.status, 0, res.stderr);
  assert.equal(res.json.pushed, false, res.stdout);
  assert.match(res.json.reason, /^push failed: /);
  assert.equal(remoteRef(w), stray, "the remote branch is untouched");
  assert.equal(gitCalls(w).filter((a) => a[0] === "push").length, 1, "no second push");
  assert.match(res.json.manual, /push 'origin' 'refs\/heads\/agent-smith\/demo:refs\/heads\/agent-smith\/demo'/);
  assert.deepEqual(ghCalls(w), []);
});

// ---- leftover commit ------------------------------------------------------------------

test("leftover edits are committed once as the final run state and pushed", { skip }, () => {
  const w = world();
  fs.appendFileSync(path.join(w.wt, "context/changes/demo/agent-smith/report.md"), "late line\n");
  fs.writeFileSync(path.join(w.wt, "context/changes/demo/agent-smith/meta.json"), "{}\n");
  const res = runScript(w);
  assert.equal(res.json.committed, true, res.stdout);
  assert.equal(res.json.commit, head(w));
  assert.deepEqual(res.json.swept, [], "a report-only leftover holds nothing outside the change folder");
  assert.equal(g(w, w.wt, ["log", "-1", "--format=%s"]), "chore(demo): final run state");
  assert.equal(g(w, w.wt, ["status", "--porcelain"]), "");
  assert.equal(remoteRef(w), head(w));
  setAnswers(w, { "pr-list": { out: JSON.stringify([{ number: 7, url: PR_URL, state: "OPEN" }]) } });
  const none = runScript(w).json;
  assert.equal(none.committed, null);
  assert.equal(none.swept, null);
  assert.equal(g(w, w.wt, ["log", "--format=%s"]).split("\n").filter((s) => s === "chore(demo): final run state").length, 1);
});

function gitPath(w, name) {
  return g(w, w.wt, ["rev-parse", "--path-format=absolute", "--git-path", name]);
}

function writeOperationFile(w, name, content) {
  const file = gitPath(w, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function unsafePublicationSnapshot(w) {
  const read = (file) => fs.existsSync(file) ? fs.readFileSync(file) : null;
  const markers = ["MERGE_HEAD", "MERGE_MODE", "MERGE_MSG", "AUTO_MERGE", "REVERT_HEAD", "CHERRY_PICK_HEAD",
    "rebase-merge/head-name", "rebase-apply/head-name", "sequencer/todo"];
  return {
    head: head(w),
    index: fs.readFileSync(gitPath(w, "index")),
    file: fs.readFileSync(path.join(w.wt, "README.md")),
    operations: markers.map((name) => read(gitPath(w, name))),
  };
}

function assertGuardedPublication(w, diagnostic, env) {
  const before = unsafePublicationSnapshot(w);
  const res = runScript(w, [w.id], { env });
  assert.equal(res.status, 0, res.stderr);
  assert.equal(res.json.committed, false, res.stdout);
  assert.equal(res.json.commit, null);
  assert.equal(res.json.swept, null);
  assert.match(res.json.commitError, diagnostic);
  assert.deepEqual(unsafePublicationSnapshot(w), before);
  assert.equal(res.json.pushed, true, res.stdout);
  assert.equal(remoteRef(w), before.head);
  assert.equal(res.json.pr.action, "created");
  assert.deepEqual(ghCalls(w).map((args) => args.slice(0, 2)), [["pr", "list"], ["pr", "create"]]);
  const ref = `refs/heads/${w.branch}`;
  assert.deepEqual(writeCalls(w), [["push", "origin", `${ref}:${ref}`]]);
  assert.ok(gitCalls(w).every((args) => args[0] !== "status"));
}

for (const [operation, marker] of [
  ["merge", "MERGE_HEAD"], ["cherry-pick", "CHERRY_PICK_HEAD"], ["revert", "REVERT_HEAD"], ["stash", null],
]) {
  test(`an unfinished ${operation} preserves the conflict and publishes only existing commits`, { skip }, () => {
    const w = world({ nest: marker === null ? "apps/widget" : null });
    let args;
    if (marker === null) {
      fs.writeFileSync(path.join(w.wt, "README.md"), "stashed changes\n");
      g(w, w.wt, ["stash", "push", "--", "README.md"]);
      args = ["stash", "apply"];
    } else {
      commitFile(w, w.repo, "README.md", "upstream changes\n", "fix: upstream edit");
      args = [operation, ...(operation === "revert" ? ["--no-edit"] : []), g(w, w.repo, ["rev-parse", "HEAD"])];
    }
    commitFile(w, w.wt, "README.md", "run changes\n", "fix: run edit");
    const failed = spawnSync(REAL_GIT, args, { cwd: w.wt, encoding: "utf8", env: envFor(w) });
    assert.equal(failed.status, 1, failed.stdout + failed.stderr);
    assert.match(g(w, w.wt, ["ls-files", "--unmerged"]), /README\.md/);
    if (marker !== null) assert.ok(fs.existsSync(gitPath(w, marker)));
    assertGuardedPublication(w, marker === null ? /index holds unmerged entries/ : new RegExp(marker),
      marker === null ? { GIT_LITERAL_PATHSPECS: "1" } : {});
    assert.equal(g(w, w.wt, ["--git-dir", w.bare, "show", `refs/heads/${w.branch}:README.md`]), "run changes");
  });
}

for (const [marker, file] of [
  ["MERGE_HEAD", "MERGE_HEAD"], ["rebase-merge", "rebase-merge/head-name"],
  ["rebase-apply", "rebase-apply/head-name"], ["sequencer", "sequencer/todo"],
]) {
  test(`${marker} blocks the leftover check even with a resolved or clean index`, { skip }, () => {
    const w = world();
    writeOperationFile(w, file, `${head(w)}\n`);
    if (marker === "MERGE_HEAD") {
      fs.writeFileSync(path.join(w.wt, "README.md"), "resolved work\n");
      g(w, w.wt, ["add", "README.md"]);
    }
    assert.equal(g(w, w.wt, ["ls-files", "--unmerged"]), "");
    assertGuardedPublication(w, new RegExp(marker));
    assert.ok(gitCalls(w).every((args) => !args.includes("--unmerged")));
  });
}

for (const [probe, diagnostic] of [
  ["rev-parse --path-format=absolute --git-path MERGE_HEAD", /Cannot verify MERGE_HEAD with git rev-parse/],
  ["--no-literal-pathspecs ls-files --unmerged -z -- :/", /Cannot verify the index with git ls-files --unmerged/],
]) {
  test(`failure of ${probe} preserves local state and publishes existing commits`, { skip }, () => {
    const w = world();
    fs.writeFileSync(path.join(w.wt, "README.md"), "unstaged changes\n");
    assertGuardedPublication(w, diagnostic, { GIT_FAIL_PROBE: probe });
  });
}

test("swept names the code a leftover commit holds outside the change folder", { skip }, () => {
  const w = world();
  fs.appendFileSync(path.join(w.wt, "context/changes/demo/agent-smith/report.md"), "late line\n");
  fs.mkdirSync(path.join(w.wt, "src"), { recursive: true });
  fs.writeFileSync(path.join(w.wt, "src/x.js"), "export const x = 1;\n");
  const res = runScript(w);
  assert.equal(res.json.committed, true, res.stdout);
  assert.deepEqual(res.json.swept, ["src/x.js"]);
});

test("swept leaves out both sides of a staged archive move of the change folder", { skip }, () => {
  const w = world();
  fs.mkdirSync(path.join(w.wt, "context/archive"), { recursive: true });
  g(w, w.wt, ["mv", "context/changes/demo", "context/archive/2026-11-09-demo"]);
  const res = runScript(w, ["demo", "--report", path.join(w.wt, "context/archive/2026-11-09-demo/agent-smith/report.md")]);
  assert.equal(res.json.committed, true, res.stdout);
  assert.deepEqual(res.json.swept, []);
});

test("the leftover commit carries the Agent Smith trailer by default, none with coAuthor null, none with a malformed value", { skip }, () => {
  const TRAILER = "Co-Authored-By: Agent Smith <agent-smith@ksycki.pl>";
  const cases = [
    [undefined, TRAILER], [null, null], [{ name: "", email: "a@b" }, null], ["Agent Smith", null],
    // merged into the default as the router's deepMerge does
    [{ name: "Someone" }, "Co-Authored-By: Someone <agent-smith@ksycki.pl>"],
  ];
  for (const [override, want] of cases) {
    const w = world();
    if (override !== undefined) {
      const file = path.join(w.wt, "context/foundation/agent-smith-policy.json");
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify({ coAuthor: override }));
    }
    fs.appendFileSync(path.join(w.wt, "context/changes/demo/agent-smith/report.md"), "late line\n");
    const res = runScript(w);
    assert.equal(res.json.committed, true, `${JSON.stringify(override)}: ${res.stdout}`);
    assert.equal(res.json.pushed, true);
    const body = g(w, w.wt, ["log", "-1", "--format=%B"]);
    assert.equal(body, want ? `chore(demo): final run state\n\n${want}` : "chore(demo): final run state", JSON.stringify(override));
  }
});

test("a failing pre-commit hook gives committed: false, unstages its add, and the branch still pushes", { skip }, () => {
  const w = world();
  const hook = path.join(w.repo, ".git/hooks/pre-commit");
  fs.writeFileSync(hook, "#!/bin/sh\necho 'hook says no' >&2\nexit 1\n", { mode: 0o755 });
  fs.appendFileSync(path.join(w.wt, "context/changes/demo/agent-smith/report.md"), "late line\n");
  const before = head(w);
  const res = runScript(w);
  assert.equal(res.json.committed, false, res.stdout);
  assert.equal(res.json.commit, null);
  assert.match(res.json.commitError, /hook says no/);
  assert.equal(head(w), before);
  assert.equal(g(w, w.wt, ["diff", "--cached", "--name-only"]), "", "the add was undone");
  assert.notEqual(g(w, w.wt, ["status", "--porcelain"]), "");
  assert.equal(res.json.pushed, true);
  assert.equal(remoteRef(w), before);
});

test("a failed leftover commit unstages only its own add: an entry staged before the script stays staged", { skip }, () => {
  const w = world();
  const hook = path.join(w.repo, ".git/hooks/pre-commit");
  fs.writeFileSync(hook, "#!/bin/sh\necho 'hook says no' >&2\nexit 1\n", { mode: 0o755 });
  fs.writeFileSync(path.join(w.wt, "unrelated.txt"), "staged by a human\n");
  g(w, w.wt, ["add", "--", "unrelated.txt"]);
  fs.appendFileSync(path.join(w.wt, "context/changes/demo/agent-smith/report.md"), "late line\n");
  fs.writeFileSync(path.join(w.wt, "context/changes/demo/agent-smith/meta.json"), "{}\n");
  const before = head(w);
  const res = runScript(w, ["demo"], { cwd: path.join(w.wt, "context") });
  assert.equal(res.json.committed, false, res.stdout);
  assert.match(res.json.commitError, /hook says no/);
  assert.equal(head(w), before);
  assert.equal(g(w, w.wt, ["diff", "--cached", "--name-only"]), "unrelated.txt", "the earlier staged entry stays staged");
  const status = spawnSync(REAL_GIT, ["status", "--porcelain", "--untracked-files=all"], { cwd: w.wt, encoding: "utf8", env: envFor(w) });
  assert.deepEqual(status.stdout.split("\n").filter(Boolean).sort(), [
    " M context/changes/demo/agent-smith/report.md",
    "?? context/changes/demo/agent-smith/meta.json",
    "A  unrelated.txt",
  ]);
  assert.equal(res.json.pushed, true);
});

test("pathsToStage: the worktree column decides, untracked and renamed entries included", () => {
  const z = ["M  staged.txt", " M edited.txt", "?? new dir/file.txt", "MM both.txt", "R  new.txt", "old.txt", "RM moved.txt", "was.txt", " D gone.txt", ""].join("\0");
  assert.deepEqual(pathsToStage(z), ["edited.txt", "new dir/file.txt", "both.txt", "moved.txt", "gone.txt"]);
  assert.deepEqual(pathsToStage(""), []);
});

// ---- chains and body ------------------------------------------------------------------

test("openspec chain: default report under openspec/changes and the id as title", { skip }, () => {
  const w = world({ chain: "openspec" });
  const res = runScript(w, ["demo", "--chain", "openspec"]);
  assert.equal(res.json.pr.action, "created", res.stdout);
  const create = ghCalls(w).find((a) => a[1] === "create");
  assert.equal(create[9], "chore(demo): demo");
  assert.ok(capturedBody(w).includes("Outcome: done"));
});

test("--report names the archived report and its change folder holds the title", { skip }, () => {
  const w = world();
  const archived = path.join(w.wt, "context/archive/2026-11-09-demo");
  fs.mkdirSync(path.join(archived, "agent-smith"), { recursive: true });
  fs.writeFileSync(path.join(archived, "change.md"), CHANGE_MD.replace("Demo title", "Archived title"));
  fs.writeFileSync(path.join(archived, "agent-smith/report.md"), REPORT.replace("Outcome: done", "Outcome: archived"));
  const res = runScript(w, ["demo", "--report", path.join(archived, "agent-smith/report.md")]);
  assert.equal(res.json.committed, true);
  const create = ghCalls(w).find((a) => a[1] === "create");
  assert.equal(create[9], "chore(demo): Archived title");
  assert.ok(capturedBody(w).includes("Outcome: archived"));
});

test("body: marker, header lines only, mentions neutralized, emails kept, missing report named", () => {
  const body = buildBody("demo", "# Run report: demo\n\nGoal: ask @alice (@bob) mail a@b.com\nOutcome: done\n\n| # |\n| 1 |\n", "r.md");
  assert.equal(body, `${markerFor("demo")}\n\n# Run report: demo\n\nGoal: ask @​alice (@​bob) mail a@b.com\nOutcome: done\n`);
  assert.equal(buildBody("demo", null, "x/report.md"), `${markerFor("demo")}\n\nRun report not found: x/report.md\n`);
  assert.match(buildBody("demo", "# Run report: other\n", "x/report.md"), /Run report not found/);
  assert.equal(markerFor("demo"), "<!-- agent-smith:pr change=demo -->");
});

test("body: the cap keeps 60000 code units, names the omitted count and never splits a pair", () => {
  const long = buildBody("demo", `# Run report: demo\nGoal: ${"a".repeat(70000)}\n`, "r");
  const m = /\n\nReport truncated: (\d+) characters omitted\.$/.exec(long);
  assert.ok(m);
  assert.equal(long.slice(0, m.index).length, 60000);
  const prefix = `${markerFor("demo")}\n\n# Run report: demo\nGoal: `.length;
  const pad = (60000 - prefix) % 2 === 0 ? "x" : "";
  const emoji = buildBody("demo", `# Run report: demo\nGoal: ${pad}${"\u{1F600}".repeat(40000)}\n`, "r");
  const kept = emoji.replace(/\n\nReport truncated: \d+ characters omitted\.$/, "");
  assert.equal(kept.length, 59999);
  assert.doesNotMatch(emoji, /[\ud800-\udbff](?![\udc00-\udfff])/);
});

test("title: frontmatter title, quotes stripped, else the id", () => {
  assert.equal(titleFor("demo", CHANGE_MD), "Demo title");
  assert.equal(titleFor("demo", "---\ntitle: \"Quoted\"\n---\n"), "Quoted");
  assert.equal(titleFor("demo", "---\ntitle:\n---\n"), "demo");
  assert.equal(titleFor("demo", "title: not frontmatter\n"), "demo");
  assert.equal(titleFor("demo", null), "demo");
});

test("run PR title: the highest-ranked type of the run commits, bookkeeping only gives chore", { skip }, () => {
  const w = world();
  commitFile(w, w.wt, "src/a.txt", "a\n", "fix(demo): repair a");
  const res = runScript(w);
  assert.equal(res.json.pr.action, "created", res.stdout);
  assert.equal(ghCalls(w).find((a) => a[1] === "create")[9], "fix(demo): Demo title");
});

test("run PR title: if git log fails the title is the untyped titleFor result", { skip }, () => {
  const w = world();
  fs.writeFileSync(path.join(w.bin, "git"), `#!/bin/sh\ncase "$1" in log) exit 1;; esac\nexec "${REAL_GIT}" "$@"\n`, { mode: 0o755 });
  const res = runScript(w);
  assert.equal(res.json.pr.action, "created", res.stdout);
  assert.equal(ghCalls(w).find((a) => a[1] === "create")[9], "Demo title");
});

test("prTitleFor: rank, bang, ignored subjects, chore fallback, lint-valid results", () => {
  const t = (subjects) => prTitleFor("demo", CHANGE_MD, subjects);
  assert.equal(t(["chore(demo): a", "feat(demo): b"]), "feat(demo): Demo title");
  assert.equal(t(["docs(demo): a", "fix(demo): b"]), "fix(demo): Demo title");
  assert.equal(t(["chore(demo): a"]), "chore(demo): Demo title");
  assert.equal(t(["chore(demo): a", "feat(demo)!: b"]), "feat(demo)!: Demo title");
  assert.equal(t(["feat(demo): a", "feat(demo)!: b"]), "feat(demo): Demo title");
  assert.equal(t(["fix(demo)!: a", "feat(demo): b"]), "feat(demo): Demo title");
  assert.equal(t(["Merge branch 'main' into x", 'Revert "feat: x"', "wip", "feat:x", "feature: y", ""]), "chore(demo): Demo title");
  assert.equal(t([]), "chore(demo): Demo title");
  assert.equal(prTitleFor("demo", null, ["fix: x"]), "fix(demo): demo");
  for (const subjects of [[], ["feat(demo)!: b"], ["revert: x", "docs: y"], ["build: z"]]) assert.equal(lintSubject(t(subjects)), null);
  const long = prTitleFor("demo", `---\ntitle: ${"x".repeat(300)}\n---\n`, ["feat(demo)!: b"]);
  assert.equal(long.length, 256);
  assert.ok(long.startsWith("feat(demo)!: xxx"), long);
});

test("prTitleFor: the type list is the one of tools/commit-lint.mjs", () => {
  for (const type of TYPES) assert.equal(prTitleFor("demo", null, [`${type}: x`]), `${type}(demo): demo`);
  const src = fs.readFileSync(SCRIPT, "utf8");
  const list = /const TYPE_RANK = \[(.*)\];/.exec(src)[1].split(",").map((x) => x.trim().replaceAll('"', ""));
  assert.deepEqual([...list].sort(), [...TYPES].sort());
});

test("repo: https, ssh and scp forms of github.com parse; other hosts and garbage do not", () => {
  assert.equal(parseRepo("https://github.com/acme/demo.git"), "acme/demo");
  assert.equal(parseRepo("https://github.com/acme/demo"), "acme/demo");
  assert.equal(parseRepo("https://x-access-token@github.com/acme/demo.git"), "acme/demo");
  assert.equal(parseRepo("git@github.com:acme/demo.git"), "acme/demo");
  assert.equal(parseRepo("ssh://git@github.com/acme/demo.git"), "acme/demo");
  assert.equal(parseRepo("https://gitlab.com/acme/demo.git"), null);
  assert.equal(parseRepo("git@ghe.example.com:acme/demo.git"), null);
  assert.equal(parseRepo("/tmp/remote.git"), null);
  assert.equal(parseRepo("not a url"), null);
});

// ---- usage ----------------------------------------------------------------------------

test("usage errors exit 2 with no JSON on stdout", { skip }, () => {
  const w = world();
  const cases = {
    "missing id": [],
    "bad id": ["Bad Id"],
    "id of 101 characters": ["a".repeat(101)],
    "unknown flag": ["demo", "--force"],
    "bad chain": ["demo", "--chain", "other"],
    "chain without value": ["demo", "--chain"],
    "bad remote": ["demo", "--remote", "-x"],
    "bad base": ["demo", "--base", "a..b"],
    "zero timeout": ["demo", "--timeout-ms", "0"],
    "report not named report.md": ["demo", "--report", "notes.md"],
    "second positional": ["demo", "extra"],
  };
  for (const [name, args] of Object.entries(cases)) {
    const res = runScript(w, args);
    assert.equal(res.status, 2, `${name}: ${res.stdout}${res.stderr}`);
    assert.equal(res.stdout, "", name);
    assert.match(res.stderr, /usage: node open-pr\.mjs/, name);
  }
  assert.deepEqual(gitCalls(w), []);
  assert.deepEqual(ghCalls(w), []);
});

// ---- guards -----------------------------------------------------------------------------

test("guard: the router modules spawn no gh and make no git push (ADR-017)", () => {
  for (const file of ["route.mjs", "state.mjs", "preplan.mjs", "steps.mjs", "../../openspec-pipeline/scripts/openspec.mjs", "flow.mjs", "isolation.mjs", "git-operation.mjs"]) {
    const source = fs.readFileSync(path.join(SCRIPTS, file), "utf8");
    assert.equal(/["'`]gh["'`]/.test(source), false, `${file} must not call gh`);
    assert.equal(/["'`]push["'`]/.test(source), false, `${file} must not call git push`);
  }
});

test("guard: the script source names no merge, review, delete or force operation", () => {
  const source = fs.readFileSync(SCRIPT, "utf8");
  for (const word of ["\"merge\"", "\"review\"", "--force", "--delete", "--no-verify", "--set-upstream", "\"-u\"", "\"remove\"", "\"--amend\""]) {
    assert.equal(source.includes(word), false, word);
  }
});

// ---- configured and recorded branch identity ---------------------------------------------

function publicationSnapshot(w) {
  const index = g(w, w.wt, ["rev-parse", "--path-format=absolute", "--git-path", "index"]);
  const read = (file) => fs.existsSync(file) ? fs.readFileSync(file) : null;
  return { head: head(w), index: read(index), kept: read(path.join(w.root, "kept.txt")),
    meta: read(path.join(w.changeDir, "agent-smith/meta.json")),
    policy: read(path.join(w.root, "context/foundation/agent-smith-policy.json")) };
}

function refuseWithoutWrites(w, args = [w.id, "--chain", w.chain]) {
  const before = publicationSnapshot(w);
  const gitStart = gitCalls(w).length;
  const ghStart = ghCalls(w).length;
  const result = runScript(w, args);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.json.pushed, false, result.stdout);
  assert.ok(result.json.reason, result.stdout);
  assert.deepEqual(publicationSnapshot(w), before);
  assert.deepEqual(gitCalls(w).slice(gitStart).filter((a) => WRITES.has(a[0])), []);
  assert.deepEqual(ghCalls(w).slice(ghStart), []);
  return result.json;
}

for (const chain of ["10x", "openspec"]) {
  for (const nest of [null, "apps/widget"]) {
    test(`${chain}: configured publication carries the branch through push and repeated PR creation (${nest})`, { skip }, () => {
      const w = world({ chain, prefix: "codex/", nest, identity: true });
      const args = ["demo", "--chain", chain];
      const result = runScript(w, args).json;
      assert.equal(result.pushed, true, JSON.stringify(result));
      assert.equal(result.branch, "codex/demo");
      assert.equal(result.base, "main");
      assert.equal(result.pr.action, "created");
      assert.equal(remoteRef(w), head(w));
      assert.deepEqual(gitCalls(w).find((a) => a[0] === "push"), ["push", "origin", "refs/heads/codex/demo:refs/heads/codex/demo"]);
      assert.equal(ghCalls(w).find((a) => a[1] === "create")[5], "codex/demo");
      setAnswers(w, { "pr-list": { out: JSON.stringify([{ number: 7, url: PR_URL, state: "OPEN" }]) } });
      assert.equal(runScript(w, args).json.pr.action, "existing");
      assert.equal(ghCalls(w).filter((a) => a[1] === "create").length, 1);
    });
  }

  test(`${chain}: saved suffix and archived report retain the original configured identity`, { skip }, () => {
    const defaults = world({ chain, identity: true });
    assert.equal(runScript(defaults, ["demo", "--chain", chain]).json.pushed, true);
    assert.equal(remoteRef(defaults), head(defaults));
    const w = world({ chain, prefix: "runs-", branch: "runs-demo-baseline", identity: true });
    const archive = path.join(w.root, chain === "10x" ? "context/archive/2026-11-16-demo" : "openspec/changes/archive/2026-11-16-demo");
    fs.mkdirSync(path.dirname(archive), { recursive: true });
    fs.renameSync(w.changeDir, archive);
    const report = path.join(archive, "agent-smith/report.md");
    const args = ["demo", "--chain", chain, "--report", report];
    assert.equal(runScript(w, args).json.pushed, true);
    assert.equal(remoteRef(w), head(w));
    w.changeDir = archive;
    writePolicy(w, { isolation: { require: true, branchPrefix: "changed/" } });
    const refused = refuseWithoutWrites(w, args);
    assert.match(refused.reason, /isolation.branchPrefix.*recorded branch runs-demo-baseline/);
    assert.match(refused.manual, /runs-demo-baseline/);
  });

  test(`${chain}: saved invalid-prefix drift names the retained branch and restoration prerequisite`, { skip }, () => {
    const w = world({ chain, prefix: "codex/", identity: true });
    fs.writeFileSync(path.join(w.root, "kept.txt"), "staged contents");
    g(w, w.wt, ["add", "--", path.relative(w.wt, path.join(w.root, "kept.txt"))]);
    fs.writeFileSync(path.join(w.root, "kept.txt"), "working contents");
    const refs = g(w, w.wt, ["show-ref"]);
    for (const prefix of [null, "", " ", "bad..ref/"]) {
      writePolicy(w, { isolation: { require: true, branchPrefix: prefix } });
      const refused = refuseWithoutWrites(w);
      for (const text of [refused.reason, refused.manual]) {
        assert.ok(text.includes(w.branch), text);
        assert.match(text, /isolation.branchPrefix/);
        assert.match(text, /restore|resume/i);
      }
      assert.equal(g(w, w.wt, ["show-ref"]), refs);
      assert.equal(remoteRef(w), null);
    }
  });

  test(`${chain}: malformed and contradictory recorded identities preserve working and staged contents`, { skip }, () => {
    const cases = ["{", "null", "[]", { id: "other", isolated: true, branch: "codex/demo", chain },
      { id: "demo", isolated: true, branch: "codex/demo", chain: chain === "10x" ? "openspec" : "10x" },
      { id: "demo" }, { id: "demo", isolated: false, branch: "codex/demo", chain },
      { id: "demo", isolated: true, branch: null, chain },
      { id: "demo", isolated: true, branch: "codex/other", chain },
      { id: "demo", isolated: true, branch: "codex/@{-1}", chain }];
    const w = world({ chain, prefix: "codex/", identity: true });
    fs.writeFileSync(path.join(w.root, "kept.txt"), "staged contents");
    g(w, w.wt, ["add", "--", path.relative(w.wt, path.join(w.root, "kept.txt"))]);
    fs.writeFileSync(path.join(w.root, "kept.txt"), "working contents");
    for (const meta of cases) {
      fs.writeFileSync(path.join(w.changeDir, "agent-smith/meta.json"), typeof meta === "string" ? meta : JSON.stringify(meta));
      const result = refuseWithoutWrites(w);
      assert.match(result.reason, /saved run identity|Saved run identity|started on branch|Invalid run branch/);
    }
    assert.equal(remoteRef(w), null);
  });
}

test("configured publication preserves missing and empty legacy identity while requiring the exact generated branch", { skip }, () => {
  for (const empty of [false, true]) {
    const w = world({ prefix: "codex/" });
    if (empty) fs.writeFileSync(path.join(w.changeDir, "agent-smith/meta.json"), "{}");
    assert.equal(runScript(w).json.pushed, true);
    assert.equal(remoteRef(w), head(w));
  }
  const other = world({ prefix: "codex/", branch: "codex/demo-baseline" });
  assert.match(refuseWithoutWrites(other).reason, /HEAD is on codex\/demo-baseline, not codex\/demo/);
});

test("configured publication validates active prefixes, policy parsing and default branches before writes", { skip }, () => {
  const w = world({ prefix: "codex/", identity: true });
  for (const prefix of ["", " ", null, [], {}, 5, "-option/", "bad..ref/"]) {
    writePolicy(w, { isolation: { require: true, branchPrefix: prefix } });
    assert.match(refuseWithoutWrites(w).reason, /branchPrefix|Invalid run branch/);
    writePolicy(w, { isolation: { require: false, branchPrefix: prefix } });
    assert.match(refuseWithoutWrites(w).reason, /isolation.require/);
  }
  const policy = path.join(w.root, "context/foundation/agent-smith-policy.json");
  fs.writeFileSync(policy, "{");
  assert.match(refuseWithoutWrites(w).reason, /JSON|Unexpected|Expected/);
  writePolicy(w, { isolation: { require: true, branchPrefix: "codex/", defaultBranches: [w.branch] } });
  assert.match(refuseWithoutWrites(w).reason, /default branch/);
  writePolicy(w, { isolation: { require: true, branchPrefix: "codex/" } });
  g(w, w.wt, ["symbolic-ref", "refs/remotes/upstream/HEAD", "refs/remotes/upstream/codex/demo"]);
  assert.match(refuseWithoutWrites(w, ["demo", "--remote", "upstream"]).reason, /default branch of upstream/);
  fs.writeFileSync(path.join(w.bin, "git"), GIT_SHIM(REAL_GIT).replace("exec ", 'case "$*" in *refs/remotes/upstream/HEAD*) exit 70;; esac\nexec '));
  assert.match(refuseWithoutWrites(w, ["demo", "--remote", "upstream"]).reason, /Cannot read the default branch of upstream/);
});

test("configured base discovery excludes both run namespaces and keeps feature, tie and older-Git behavior", { skip }, () => {
  for (const oldGit of [false, true]) {
    const w = world({ prefix: "codex/", feature: true, identity: true });
    g(w, w.wt, ["push", "-q", "origin", "HEAD:refs/heads/codex/other-run", "HEAD:refs/heads/agent-smith/older-run"]);
    commitFile(w, w.wt, "later.txt", "later", "fix: later");
    if (oldGit) fs.writeFileSync(path.join(w.bin, "git"), GIT_SHIM(REAL_GIT).replace("exec ", 'case "$*" in *ahead-behind*) exit 128;; esac\nexec '));
    assert.equal(runScript(w).json.base, "feature/x");
  }
  const tie = world({ prefix: "codex/" });
  g(tie, tie.repo, ["push", "-q", "origin", "main:refs/heads/aaa-copy"]);
  assert.equal(runScript(tie).json.base, "main");
  assert.equal(runScript(tie, ["demo", "--base", "aaa-copy"]).json.base, "aaa-copy");
});

test("configured automatic fallback bases validate names and exclude both run namespaces", { skip }, () => {
  for (const fallback of ["main", "codex/other-run", "agent-smith/older-run", "-option", "bad..ref"]) {
    const w = world({ prefix: "codex/" });
    g(w, w.wt, ["symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/codex/other-run"]);
    fs.writeFileSync(path.join(w.bin, "git"), GIT_SHIM(REAL_GIT).replace("exec ", 'if [ "$1" = for-each-ref ]; then exit 0; fi\nexec '));
    setAnswers(w, { "repo-view": { out: fallback } });
    const result = runScript(w).json;
    assert.equal(result.pushed, fallback === "main", JSON.stringify(result));
    if (fallback === "main") assert.equal(result.base, "main");
    else assert.match(result.reason, /base branch not found/);
  }
  const remoteHead = world({ prefix: "codex/" });
  fs.writeFileSync(path.join(remoteHead.bin, "git"), GIT_SHIM(REAL_GIT).replace("exec ", 'if [ "$1" = for-each-ref ]; then exit 0; fi\nexec '));
  assert.equal(runScript(remoteHead).json.base, "main");
  assert.equal(ghCalls(remoteHead).some((a) => a[0] === "repo"), false);
});

test("configured recovery commands preserve literal argv for Git-valid shell metacharacters", { skip }, () => {
  for (const prefix of ["codex/$(probe)/", "codex/;probe;/", "codex/'/"]) {
    for (const failure of ["missing-remote", "push", "pr"]) {
      const w = world({ prefix, identity: true, worktreeName: "wt $(probe);'" });
      const base = "feature/$(probe);'";
      g(w, w.repo, ["push", "-q", "origin", `main:refs/heads/${base}`]);
      g(w, w.repo, ["symbolic-ref", "refs/remotes/origin/HEAD", `refs/remotes/origin/${base}`]);
      let args = ["demo"];
      if (failure === "missing-remote") args.push("--remote", "upstream");
      if (failure === "push") {
        const stray = g(w, w.repo, ["commit-tree", g(w, w.repo, ["rev-parse", "HEAD^{tree}"]), "-p", "HEAD", "-m", "diverged"]);
        g(w, w.repo, ["push", "-q", "origin", `${stray}:refs/heads/${w.branch}`]);
      }
      if (failure === "pr") setAnswers(w, { "pr-create": { code: 1, err: "injected failure" } });
      const result = runScript(w, args).json;
      assert.ok(result.manual, JSON.stringify(result));
      const inert = tmpDir("as-opr-inert-");
      const calls = path.join(inert, "calls.log");
      const expanded = path.join(inert, "expanded");
      for (const command of ["git", "gh"]) fs.writeFileSync(path.join(inert, command),
        `#!/bin/sh\nprintf '%s\\037' '${command}' "$@" >> "$INERT_LOG"\nprintf '\\n' >> "$INERT_LOG"\n`, { mode: 0o755 });
      fs.writeFileSync(path.join(inert, "probe"), '#!/bin/sh\nprintf expanded >> "$EXPANDED"\n', { mode: 0o755 });
      const command = result.manual.split(", then")[0];
      const ran = spawnSync("/bin/sh", ["-c", command], {
        cwd: inert, encoding: "utf8", env: { ...envFor(w), PATH: inert, INERT_LOG: calls, EXPANDED: expanded },
      });
      assert.equal(ran.status, 0, ran.stderr);
      assert.equal(fs.existsSync(expanded), false, "no command substitution or extra command executes");
      const received = readLog(calls);
      const pr = ["gh", "pr", "create", "--repo", "acme/demo", "--head", w.branch, "--base", base, "--fill"];
      if (failure === "missing-remote") assert.deepEqual(received, [["git", "-C", w.wt, "remote", "add", "upstream", "<url>"]]);
      else if (failure === "push") assert.deepEqual(received, [["git", "-C", w.wt, "push", "origin", `refs/heads/${w.branch}:refs/heads/${w.branch}`], pr]);
      else assert.deepEqual(received, [pr]);
    }
  }
});
