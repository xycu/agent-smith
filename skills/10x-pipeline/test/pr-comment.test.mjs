// Tests for scripts/pr-comment.mjs. A fake `gh` (a /bin/sh shim first on PATH) answers from canned files,
// so no test needs the network. Opt-in live tests (GH_LIVE=1) are run by a human.
// Plain node: built-ins only. Node 18 safe.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { makeProject, cleanupAll } from "./helpers.mjs";

const SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../scripts/pr-comment.mjs");
const win = process.platform === "win32";
const dirs = [];

after(() => {
  cleanupAll();
  for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

function tmpDir(prefix) {
  const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), prefix));
  dirs.push(dir);
  return dir;
}

// The fake gh. It logs argv (unit-separator format, one line per call), copies the `-F body=@file` file to
// body-<n>.txt while it still exists, and answers from <FAKE_GH_DIR>/<kind>.{out,err,code,sleep}.
// Kinds: pr-view, user, comments, post, patch.
const SHIM = `#!/bin/sh
D="$FAKE_GH_DIR"
n=$(( $(cat "$D/count" 2>/dev/null || echo 0) + 1 ))
echo "$n" > "$D/count"
printf '%s\\037' "$@" >> "$D/calls.log"
printf '\\n' >> "$D/calls.log"
method=GET
prev=
for a in "$@"; do
  case "$prev" in
    --method) method="$a" ;;
    -F) case "$a" in body=@*) cp "\${a#body=@}" "$D/body-$n.txt" ;; esac ;;
  esac
  prev="$a"
done
kind=other
case "$1" in
  pr) kind=pr-view ;;
  api)
    case "$method" in
      POST) kind=post ;;
      PATCH) kind=patch ;;
      *) if [ "$2" = user ]; then kind=user; else kind=comments; fi ;;
    esac ;;
esac
if [ -f "$D/$kind.sleep" ]; then exec sleep "$(cat "$D/$kind.sleep")"; fi
if [ -f "$D/$kind.err" ]; then cat "$D/$kind.err" >&2; fi
if [ -f "$D/$kind.out" ]; then cat "$D/$kind.out"; fi
code=0
if [ -f "$D/$kind.code" ]; then code=$(cat "$D/$kind.code"); fi
exit "$code"
`;

const PR_URL = "https://github.com/acme/widgets/pull/7";
const PR_OPEN = JSON.stringify({ number: 7, url: PR_URL, state: "OPEN", isDraft: false });

// A scratch world: project, fake bin, canned answers. `answers` maps kind to { out, err, code, sleep }.
function world({ id = "demo", report = `# Run report: ${id}\n\nGoal: x\n`, answers = {}, withGh = true } = {}) {
  const project = makeProject({ id });
  if (report !== null) {
    fs.mkdirSync(project.agentDir, { recursive: true });
    fs.writeFileSync(path.join(project.agentDir, "report.md"), report);
  }
  const bin = tmpDir("as-prc-bin-");
  const fake = tmpDir("as-prc-fake-");
  if (withGh) fs.writeFileSync(path.join(bin, "gh"), SHIM, { mode: 0o755 });
  const w = { project, bin, fake, id };
  setAnswers(w, answers);
  return w;
}

function setAnswers(w, answers) {
  for (const [kind, a] of Object.entries(answers)) {
    for (const [ext, value] of Object.entries(a)) fs.writeFileSync(path.join(w.fake, `${kind}.${ext}`), String(value));
  }
}

function runScript(w, args, { env = {}, cwd = w.project.root, onlyBin = false } = {}) {
  const res = spawnSync(process.execPath, [w.script ?? SCRIPT, ...args], {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: onlyBin ? w.bin : `${w.bin}${path.delimiter}${process.env.PATH}`,
      FAKE_GH_DIR: w.fake,
      ...env,
    },
  });
  let json = null;
  try { json = JSON.parse(res.stdout); } catch { /* leave null */ }
  return { status: res.status, json, stdout: res.stdout, stderr: res.stderr };
}

function calls(w) {
  const file = path.join(w.fake, "calls.log");
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => l.split("\u001f").slice(0, -1));
}

function assertSkip(res, pattern) {
  assert.equal(res.status, 0, res.stderr);
  assert.ok(res.json, `no JSON: ${res.stdout}`);
  assert.equal(res.json.action, "skipped");
  assert.equal(res.json.posted, false);
  assert.match(res.json.reason, pattern);
  assert.equal(res.json.url, null);
  assert.equal(res.json.match, null);
}

// ---- Phase 1: skips ----------------------------------------------------------------

test("skip: gh is not installed", { skip: win }, () => {
  const w = world({ withGh: false });
  assertSkip(runScript(w, ["demo"], { onlyBin: true }), /gh is not installed/);
});

test("skip: gh exits 4 (not authenticated)", { skip: win }, () => {
  const w = world({ answers: { "pr-view": { code: 4, err: "To get started with GitHub CLI, please run:  gh auth login\n" } } });
  assertSkip(runScript(w, ["demo"]), /gh is not authenticated/);
});

test("skip: no pull request for this branch", { skip: win }, () => {
  const w = world({ answers: { "pr-view": { code: 1, err: 'no pull requests found for branch "x"\n' } } });
  assertSkip(runScript(w, ["demo"]), /no pull request for this branch/);
});

test("skip: not a git work tree", { skip: win }, () => {
  const w = world({ answers: { "pr-view": { code: 1, err: "failed to run git: fatal: not a git repository\n" } } });
  assertSkip(runScript(w, ["demo"]), /not a git work tree/);
});

test("skip: another gh pr view failure carries the first stderr line", { skip: win }, () => {
  const w = world({ answers: { "pr-view": { code: 1, err: "\nboom: something broke\nsecond line\n" } } });
  const res = runScript(w, ["demo"]);
  assertSkip(res, /gh pr view failed: boom: something broke$/);
});

test("skip: invalid JSON on stdout is unexpected gh output", { skip: win }, () => {
  const w = world({ answers: { "pr-view": { out: "not json" } } });
  assertSkip(runScript(w, ["demo"]), /unexpected gh output/);
});

test("skip: JSON without a url is unexpected gh output", { skip: win }, () => {
  const w = world({ answers: { "pr-view": { out: JSON.stringify({ number: 7, state: "OPEN" }) } } });
  assertSkip(runScript(w, ["demo"]), /unexpected gh output/);
});

test("skip: a pull request that is not open", { skip: win }, () => {
  for (const state of ["MERGED", "CLOSED"]) {
    const w = world({ answers: { "pr-view": { out: JSON.stringify({ number: 7, url: PR_URL, state, isDraft: false }) } } });
    const res = runScript(w, ["demo"]);
    assertSkip(res, new RegExp(`pull request is ${state}`));
    assert.equal(res.json.pr, PR_URL);
  }
});

test("skip: a host other than github.com is unsupported", { skip: win }, () => {
  const url = "https://ghe.example.com/acme/widgets/pull/7";
  const w = world({ answers: { "pr-view": { out: JSON.stringify({ number: 7, url, state: "OPEN", isDraft: false }) } } });
  const res = runScript(w, ["demo"]);
  assertSkip(res, /unsupported host ghe\.example\.com/);
  assert.equal(res.json.pr, url);
});

test("skip: gh pr view past the timeout is gh timed out", { skip: win }, () => {
  const w = world({ answers: { "pr-view": { sleep: 5, out: PR_OPEN } } });
  const started = Date.now();
  assertSkip(runScript(w, ["demo", "--timeout-ms", "200"]), /gh timed out/);
  assert.ok(Date.now() - started < 4000, "the timeout did not cut the call short");
});

test("skip: missing report carries the archive hint on the default path", { skip: win }, () => {
  const w = world({ report: null, answers: { "pr-view": { out: PR_OPEN } } });
  const res = runScript(w, ["demo"]);
  assertSkip(res, /report not found: context[\\/]changes[\\/]demo[\\/]agent-smith[\\/]report\.md/);
  assert.match(res.json.reason, /after an archive pass --report context\/archive\/<date>-demo\/agent-smith\/report\.md/);
  const explicit = path.join(w.project.root, "gone", "agent-smith", "report.md");
  const res2 = runScript(w, ["demo", "--report", explicit]);
  assertSkip(res2, /report not found: /);
  assert.doesNotMatch(res2.json.reason, /archive pass/);
});

test("skip: empty report", { skip: win }, () => {
  const w = world({ report: "  \n", answers: { "pr-view": { out: PR_OPEN } } });
  assertSkip(runScript(w, ["demo"]), /report is empty/);
});

test("skip: report that names another change id", { skip: win }, () => {
  const w = world({ report: "# Run report: other\n\nGoal: x\n", answers: { "pr-view": { out: PR_OPEN } } });
  assertSkip(runScript(w, ["demo"]), /report is not a run report for demo/);
});

test("no gh call is logged when the report check fails", { skip: win }, () => {
  for (const report of [null, "", "# Run report: other\n"]) {
    const w = world({ report, answers: { "pr-view": { out: PR_OPEN } } });
    const res = runScript(w, ["demo"]);
    assert.equal(res.json.action, "skipped");
    assert.deepEqual(calls(w), []);
  }
});

test("an open pull request reaches the posting stub in phase 1 only", { skip: win }, () => {
  const w = world({ answers: { "pr-view": { out: PR_OPEN } } });
  const res = runScript(w, ["demo"]);
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.json.reason, /posting not implemented/);
  assert.equal(res.json.pr, PR_URL);
  const first = calls(w)[0];
  assert.deepEqual(first, ["pr", "view", "--json", "number,url,state,isDraft"]);
});

// ---- usage errors ------------------------------------------------------------------

test("usage errors exit 2 with no JSON on stdout", { skip: win }, () => {
  const w = world({ answers: { "pr-view": { out: PR_OPEN } } });
  const inAgentSmith = (dir) => {
    const d = path.join(w.project.root, dir);
    fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, "report.md"), "# Run report: demo\n");
    return path.join(d, "report.md");
  };
  const notes = path.join(w.project.root, "notes.md");
  fs.writeFileSync(notes, "# Run report: demo\n");
  const cases = {
    "missing id": [],
    "bad id": ["Demo"],
    "id of 101 characters": ["a".repeat(101)],
    "unknown flag": ["demo", "--bogus"],
    "non-numeric timeout": ["demo", "--timeout-ms", "abc"],
    "zero timeout": ["demo", "--timeout-ms", "0"],
    "timeout without value": ["demo", "--timeout-ms"],
    "report not named report.md": ["demo", "--report", notes],
    "report in a directory named other": ["demo", "--report", inAgentSmith("other")],
    "report in a directory named xagent-smith": ["demo", "--report", inAgentSmith("xagent-smith")],
    "second positional": ["demo", "extra"],
  };
  for (const [name, args] of Object.entries(cases)) {
    const res = runScript(w, args);
    assert.equal(res.status, 2, `${name}: ${res.stdout}${res.stderr}`);
    assert.equal(res.stdout, "", name);
    assert.match(res.stderr, /usage: node pr-comment\.mjs/, name);
  }
  assert.deepEqual(calls(w), []);
  // An id of 100 characters is accepted.
  assert.equal(runScript(w, ["a".repeat(100)]).status, 0);
});

test("--report inside a directory named agent-smith is accepted", { skip: win }, () => {
  const w = world({ answers: { "pr-view": { out: PR_OPEN } } });
  const archived = path.join(w.project.root, "context", "archive", "2026-10-31-demo", "agent-smith");
  fs.mkdirSync(archived, { recursive: true });
  fs.writeFileSync(path.join(archived, "report.md"), "# Run report: demo\n\nGoal: x\n");
  const res = runScript(w, ["demo", "--report", path.join(archived, "report.md")]);
  assert.equal(res.status, 0, res.stderr);
  assert.equal(res.json.pr, PR_URL);
});

test("every skip prints one parseable JSON object with the six keys and exits 0", { skip: win }, () => {
  const w = world({ answers: { "pr-view": { code: 1, err: 'no pull requests found for branch "x"\n' } } });
  const res = runScript(w, ["demo"]);
  assert.equal(res.status, 0);
  assert.equal(res.stdout.trim().split("\n").length, 1);
  assert.deepEqual(Object.keys(res.json).sort(), ["action", "match", "posted", "pr", "reason", "url"]);
});

// ---- real gh, no network -----------------------------------------------------------

const realGh = spawnSync("sh", ["-c", "command -v gh"], { encoding: "utf8" }).stdout.trim();

test("real gh without a login is not authenticated", { skip: win || !realGh }, () => {
  const w = world({ report: "# Run report: demo\n\nGoal: x\n" });
  const repo = w.project.root;
  const git = (...args) => spawnSync("git", args, { cwd: repo, encoding: "utf8", env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null" } });
  git("init", "-q");
  git("remote", "add", "origin", "https://github.com/acme/widgets.git");
  const res = runScript(w, ["demo"], {
    onlyBin: false,
    env: { PATH: process.env.PATH, GH_CONFIG_DIR: tmpDir("as-prc-ghcfg-"), GH_TOKEN: "", GITHUB_TOKEN: "" },
  });
  assert.equal(res.status, 0, res.stderr);
  assert.equal(res.json.action, "skipped");
  assert.match(res.json.reason, /gh is not authenticated/, res.stdout);
});

// ---- live, opt-in (run by a human with GH_LIVE=1) -----------------------------------

const live = process.env.GH_LIVE === "1";

function requireLiveGh() {
  const found = spawnSync("sh", ["-c", "command -v gh"], { encoding: "utf8" });
  assert.equal(found.status, 0, "GH_LIVE=1 needs gh on PATH");
  const auth = spawnSync("gh", ["auth", "status"], { encoding: "utf8" });
  assert.equal(auth.status, 0, `GH_LIVE=1 needs an authenticated gh: ${auth.stderr}`);
}

test("live: a branch with no pull request is skipped", { skip: !live && "set GH_LIVE=1 to run (needs network and an authenticated gh)" }, () => {
  requireLiveGh();
  const project = makeProject({ id: "demo" });
  fs.mkdirSync(project.agentDir, { recursive: true });
  fs.writeFileSync(path.join(project.agentDir, "report.md"), "# Run report: demo\n\nGoal: x\n");
  const git = (...args) => {
    const r = spawnSync("git", args, { cwd: project.root, encoding: "utf8", env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null" } });
    assert.equal(r.status, 0, r.stderr);
  };
  git("init", "-q");
  git("remote", "add", "origin", "https://github.com/cli/cli.git");
  git("checkout", "-q", "-b", `agent-smith-live-${Math.random().toString(36).slice(2, 10)}`);
  const res = spawnSync(process.execPath, [SCRIPT, "demo"], { cwd: project.root, encoding: "utf8", env: process.env });
  assert.equal(res.status, 0, res.stderr);
  const json = JSON.parse(res.stdout);
  assert.equal(json.action, "skipped");
  assert.match(json.reason, /no pull request for this branch/);
});
