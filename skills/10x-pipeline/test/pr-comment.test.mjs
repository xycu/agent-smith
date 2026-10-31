// Tests for scripts/pr-comment.mjs. A fake `gh` (a /bin/sh shim first on PATH) answers from canned files,
// so no test needs the network. Opt-in live tests (GH_LIVE=1) are run by a human.
// Plain node: built-ins only. Node 18 safe.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { makeProject, cleanupAll } from "./helpers.mjs";
import { COMMENT_JQ } from "../scripts/pr-comment.mjs";

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
// Without --paginate the comments call prints comments.firstpage (one page) when that file exists; without --jq it
// prints comments.nojq (raw JSON) when that file exists. Both fall back to comments.out.
const SHIM = `#!/bin/sh
D="$FAKE_GH_DIR"
n=$(( $(cat "$D/count" 2>/dev/null || echo 0) + 1 ))
echo "$n" > "$D/count"
printf '%s\\037' "$@" >> "$D/calls.log"
printf '\\n' >> "$D/calls.log"
method=GET
prev=
paginate=0
jq=0
for a in "$@"; do
  case "$a" in
    --paginate) paginate=1 ;;
    --jq) jq=1 ;;
  esac
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
out="$D/$kind.out"
if [ "$kind" = comments ]; then
  if [ "$paginate" = 0 ] && [ -f "$D/comments.firstpage" ]; then out="$D/comments.firstpage"; fi
  if [ "$jq" = 0 ] && [ -f "$D/comments.nojq" ]; then out="$D/comments.nojq"; fi
fi
if [ -f "$out" ]; then cat "$out"; fi
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

test("the first gh call is pr view with the fixed field list", { skip: win }, () => {
  const w = world({ answers: { "pr-view": { out: PR_OPEN } } });
  const res = runScript(w, ["demo"]);
  assert.equal(res.status, 0, res.stderr);
  assert.equal(res.json.pr, PR_URL);
  assert.deepEqual(calls(w)[0], ["pr", "view", "--json", "number,url,state,isDraft"]);
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

// ---- Phase 2: create or update -----------------------------------------------------

const COMMENT_URL = `${PR_URL}#issuecomment-99`;
const markerOf = (id) => `<!-- agent-smith:pr-report change=${id} -->`;
const entry = (id, login, head) => JSON.stringify({ id, login, head });
const postable = { "pr-view": { out: PR_OPEN }, user: { out: "bot\n" }, post: { out: `${COMMENT_URL}\n` }, patch: { out: `${COMMENT_URL}\n` } };

function postWorld({ id = "demo", report, comments = [], answers = {} } = {}) {
  return world({
    id,
    report,
    answers: { ...postable, comments: { out: comments.length ? `${comments.join("\n")}\n` : "" }, ...answers },
  });
}

const writeCall = (w) => calls(w).find((a) => a.includes("--method"));
const methodsOf = (w) => calls(w).filter((a) => a.includes("--method")).map((a) => a[a.indexOf("--method") + 1]);
function capturedBody(w) {
  const files = fs.readdirSync(w.fake).filter((f) => /^body-\d+\.txt$/.test(f));
  assert.equal(files.length, 1, `expected one captured body, got ${files}`);
  return fs.readFileSync(path.join(w.fake, files[0]), "utf8");
}

test("create: POST to the repo of the pull request url, marker first, report bytes after one blank line", { skip: win }, () => {
  const report = "# Run report: demo\n\n| a | b |\n| --- | --- |\n| 1 | 2 |\n";
  const w = postWorld({ report });
  const res = runScript(w, ["demo"]);
  assert.equal(res.status, 0, res.stderr);
  assert.deepEqual(res.json, { posted: true, action: "created", reason: null, url: COMMENT_URL, pr: PR_URL, match: null });
  const write = writeCall(w);
  assert.deepEqual(write.slice(0, 4), ["api", "--method", "POST", "repos/acme/widgets/issues/7/comments"]);
  assert.equal(capturedBody(w), `${markerOf("demo")}\n\n${report}`);
});

test("create: a draft pull request is posted to", { skip: win }, () => {
  const w = postWorld({ answers: { "pr-view": { out: JSON.stringify({ number: 7, url: PR_URL, state: "OPEN", isDraft: true }) } } });
  assert.equal(runScript(w, ["demo"]).json.action, "created");
});

test("update: only the viewer's marker comment of this change is patched", { skip: win }, () => {
  const marker = markerOf("demo");
  const cases = [
    { name: "marker comment by the viewer", comments: [entry(5, "bot", `${marker}\n\nold`)], patch: 5 },
    { name: "marker comment by another login", comments: [entry(5, "mallory", `${marker}\n\nold`)], patch: null },
    { name: "unmarked comment by the viewer", comments: [entry(5, "bot", "just a note")], patch: null },
    { name: "two marker entries by the viewer patch the lowest id", comments: [entry(9, "bot", marker), entry(5, "bot", marker)], patch: 5 },
    { name: "marker of a different change id", comments: [entry(5, "bot", markerOf("other"))], patch: null },
    { name: "marker of change demo-two is not a match for demo", comments: [entry(5, "bot", markerOf("demo-two"))], patch: null },
    { name: "marker not at the start", comments: [entry(5, "bot", `quoted: ${marker}`)], patch: null },
    { name: "CRLF head from a web edit", comments: [entry(5, "bot", `${marker}\r\n\r\nedited`)], patch: 5 },
    { name: "a null login is never the viewer", comments: [entry(5, null, marker)], patch: null },
  ];
  for (const c of cases) {
    const w = postWorld({ comments: c.comments });
    const res = runScript(w, ["demo"]);
    assert.equal(res.status, 0, `${c.name}: ${res.stderr}`);
    if (c.patch === null) {
      assert.deepEqual(methodsOf(w), ["POST"], c.name);
      assert.equal(res.json.action, "created", c.name);
    } else {
      assert.deepEqual(methodsOf(w), ["PATCH"], c.name);
      assert.equal(writeCall(w)[3], `repos/acme/widgets/issues/comments/${c.patch}`, c.name);
      assert.equal(res.json.action, "updated", c.name);
      assert.equal(res.json.match, "author", c.name);
      assert.equal(res.json.url, COMMENT_URL, c.name);
    }
  }
});

test("update: change ids a and ab do not patch each other", { skip: win }, () => {
  for (const [mine, other] of [["a", "ab"], ["ab", "a"]]) {
    const w = postWorld({ id: mine, comments: [entry(5, "bot", `${markerOf(other)}\n\nold`)] });
    const res = runScript(w, [mine]);
    assert.deepEqual(methodsOf(w), ["POST"], `${mine} vs ${other}: ${res.stdout}`);
  }
});

test("viewer lookup fails closed: any /user failure is a skip with no comment call and no write", { skip: win }, () => {
  const marker = markerOf("demo");
  const cases = [
    { name: "403", answers: { user: { code: 1, err: "HTTP 403: Resource not accessible by integration\n" } }, args: [], reason: /viewer lookup failed: HTTP 403/ },
    { name: "exit without stderr", answers: { user: { code: 1 } }, args: [], reason: /viewer lookup failed: gh exited 1/ },
    { name: "empty login", answers: { user: { out: "\n" } }, args: [], reason: /viewer lookup failed: empty login/ },
    { name: "timeout", answers: { user: { sleep: 5 } }, args: ["--timeout-ms", "300"], reason: /viewer lookup failed: gh timed out/ },
  ];
  for (const c of cases) {
    // A marker comment planted by another user is the case this protects against.
    const w = postWorld({ comments: [entry(5, "mallory", `${marker}\n\nplanted`)], answers: c.answers });
    const res = runScript(w, ["demo", ...c.args]);
    assertSkip(res, c.reason);
    assert.equal(res.json.pr, PR_URL, c.name);
    assert.deepEqual(methodsOf(w), [], c.name);
    assert.ok(!calls(w).some((a) => a.includes("--paginate")), `${c.name}: comments were listed`);
  }
});

test("failures: a timed-out POST or PATCH is a skip that names the timeout", { skip: win }, () => {
  const post = postWorld({ answers: { post: { sleep: 5 } } });
  assertSkip(runScript(post, ["demo", "--timeout-ms", "300"]), /^comment request failed: gh timed out$/);
  assert.deepEqual(methodsOf(post), ["POST"]);

  const patch = postWorld({ comments: [entry(5, "bot", markerOf("demo"))], answers: { patch: { sleep: 5 } } });
  assertSkip(runScript(patch, ["demo", "--timeout-ms", "300"]), /^comment request failed: gh timed out$/);
  assert.deepEqual(methodsOf(patch), ["PATCH"]);
});

test("lookup: output with no valid entry fails closed and posts nothing", { skip: win }, () => {
  const marker = markerOf("demo");
  const mine = { id: 5, login: "bot", head: marker };
  const cases = {
    "pretty-printed array": JSON.stringify([mine], null, 2),
    "pretty-printed objects": JSON.stringify(mine, null, 2),
    "garbage": "<html>rate limited</html>",
    "only entries without a numeric id": JSON.stringify({ login: "bot", head: marker }),
  };
  for (const [name, out] of Object.entries(cases)) {
    const w = postWorld({ answers: { comments: { out: `${out}\n` } } });
    assertSkip(runScript(w, ["demo"]), /^comment lookup failed: unexpected gh output$/);
    assert.deepEqual(methodsOf(w), [], name);
  }
  // An empty list is a real answer and creates the comment.
  assert.equal(runScript(postWorld({ comments: [] }), ["demo"]).json.action, "created");
  assert.equal(runScript(postWorld({ answers: { comments: { out: "\n\n" } } }), ["demo"]).json.action, "created");
});

test("lookup argv: the calls and their flags are exactly the planned ones", { skip: win }, () => {
  const w = postWorld({ comments: [entry(5, "bot", `${markerOf("demo")}\n\nold`)] });
  assert.equal(runScript(w, ["demo"]).json.action, "updated");
  const [view, user, list, patch] = calls(w);
  assert.deepEqual(view, ["pr", "view", "--json", "number,url,state,isDraft"]);
  assert.deepEqual(user, ["api", "user", "--jq", ".login"]);
  assert.deepEqual(list, ["api", "--paginate", "repos/acme/widgets/issues/7/comments", "--jq", COMMENT_JQ]);
  assert.equal(patch.length, 8);
  assert.deepEqual([...patch.slice(0, 5), patch[6], patch[7]], ["api", "--method", "PATCH", "repos/acme/widgets/issues/comments/5", "-F", "--jq", ".html_url"]);
  assert.match(patch[5], /^body=@/);

  const created = postWorld();
  runScript(created, ["demo"]);
  const post = calls(created)[3];
  assert.equal(post.length, 8);
  assert.deepEqual([...post.slice(0, 5), post[6], post[7]], ["api", "--method", "POST", "repos/acme/widgets/issues/7/comments", "-F", "--jq", ".html_url"]);
  assert.match(post[5], /^body=@/);
});

test("lookup: a comment on page 2 is found only because --paginate is passed", { skip: win }, () => {
  const page1 = [entry(1, "bot", "a note"), entry(2, "ann", "another note")];
  const w = postWorld({ comments: [...page1, entry(31, "bot", `${markerOf("demo")}\n\nold`)] });
  fs.writeFileSync(path.join(w.fake, "comments.firstpage"), `${page1.join("\n")}\n`);
  const res = runScript(w, ["demo"]);
  assert.equal(res.json.action, "updated");
  assert.equal(writeCall(w)[3], "repos/acme/widgets/issues/comments/31");
});

test("lookup: the raw list that gh prints without --jq is unusable, so --jq COMMENT_JQ is required", { skip: win }, () => {
  const marker = markerOf("demo");
  const w = postWorld({ comments: [entry(5, "bot", `${marker}\n\nold`)] });
  fs.writeFileSync(path.join(w.fake, "comments.nojq"), `${JSON.stringify([{ id: 5, user: { login: "bot" }, body: marker }], null, 2)}\n`);
  const res = runScript(w, ["demo"]);
  assert.equal(res.json.action, "updated");
  assert.equal(res.json.match, "author");
});

test("a viewer-matched PATCH failure is reported as is", { skip: win }, () => {
  const w = postWorld({ comments: [entry(5, "bot", markerOf("demo"))], answers: { patch: { code: 1, err: "HTTP 500\n" } } });
  const res = runScript(w, ["demo"]);
  assertSkip(res, /comment request failed: HTTP 500$/);
});

test("internal error: an unwritable TMPDIR is a skip, not a crash", { skip: win }, () => {
  const w = postWorld();
  const res = runScript(w, ["demo"], { env: { TMPDIR: path.join(w.fake, "missing-dir") } });
  assertSkip(res, /^internal error: /);
  assert.equal(res.stdout.trim().split("\n").length, 1);
  assert.deepEqual(methodsOf(w), []);
});

test("lookup: garbage lines and lines without a numeric id are ignored", { skip: win }, () => {
  const w = postWorld({
    comments: ["not json", JSON.stringify({ login: "bot", head: markerOf("demo") }), JSON.stringify({ id: "7", login: "bot", head: markerOf("demo") }), entry(5, "bot", markerOf("demo"))],
  });
  const res = runScript(w, ["demo"]);
  assert.equal(res.json.action, "updated");
  assert.equal(writeCall(w)[3], "repos/acme/widgets/issues/comments/5");
});

test("failures: lookup, POST and empty URL are skips and a failed lookup posts nothing", { skip: win }, () => {
  const lookup = postWorld({ answers: { comments: { code: 1, err: "HTTP 502\n" } } });
  assertSkip(runScript(lookup, ["demo"]), /comment lookup failed: HTTP 502/);
  assert.deepEqual(methodsOf(lookup), []);

  const slow = postWorld({ answers: { comments: { sleep: 5 } } });
  assertSkip(runScript(slow, ["demo", "--timeout-ms", "300"]), /comment lookup failed: gh timed out/);
  assert.deepEqual(methodsOf(slow), []);

  const failedPost = postWorld({ answers: { post: { code: 1, err: "HTTP 403\n" } } });
  assertSkip(runScript(failedPost, ["demo"]), /comment request failed: HTTP 403/);

  const emptyUrl = postWorld({ answers: { post: { out: "\n" } } });
  assertSkip(runScript(emptyUrl, ["demo"]), /comment request failed/);
});

test("body: mentions are neutralized, emails are not", { skip: win }, () => {
  const report = "# Run report: demo\n\nGoal: ask @alice (@bob) mail a@b.com\n@carol and x.@dave and @@eve\n";
  const w = postWorld({ report });
  runScript(w, ["demo"]);
  const body = capturedBody(w);
  for (const name of ["alice", "bob", "carol", "dave", "eve"]) {
    assert.ok(body.includes(`@\u200b${name}`), `${name} not neutralized: ${JSON.stringify(body)}`);
  }
  assert.ok(body.includes("a@b.com"));
  assert.ok(body.startsWith(`${markerOf("demo")}\n\n`));
});

const TRUNCATED = /\n\nReport truncated: (\d+) characters omitted\.$/;

test("body: 70000 ASCII characters are cut to exactly 60000 code units with the omitted count", { skip: win }, () => {
  const report = `# Run report: demo\n${"a".repeat(70000 - 19)}`;
  const w = postWorld({ report });
  runScript(w, ["demo"]);
  const body = capturedBody(w);
  const m = TRUNCATED.exec(body);
  assert.ok(m, "no truncation line");
  const kept = body.slice(0, m.index);
  assert.equal(kept.length, 60000);
  assert.ok(kept.startsWith(markerOf("demo")));
  const original = markerOf("demo").length + 2 + report.length;
  assert.equal(Number(m[1]), original - 60000);
});

test("body: the cut backs off one unit instead of splitting a surrogate pair", { skip: win }, () => {
  const lone = /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/;
  const head = "# Run report: demo\n";
  const prefix = markerOf("demo").length + 2 + head.length;
  // One ASCII character before the emoji run makes the cap fall between the two units of a pair (F19).
  const pad = (60000 - prefix) % 2 === 0 ? "x" : "";
  assert.equal((60000 - prefix - pad.length) % 2, 1, "fixture must straddle a pair at the cap");
  const report = `${head}${pad}${"\u{1F600}".repeat(40000)}`;
  const w = postWorld({ report });
  runScript(w, ["demo"]);
  const body = capturedBody(w);
  const m = TRUNCATED.exec(body);
  assert.ok(m, "no truncation line");
  const kept = body.slice(0, m.index);
  assert.equal(kept.length, 59999);
  assert.equal(lone.test(body), false, "lone surrogate in the body");
  assert.ok(body.length < 65536);
  assert.equal(Number(m[1]), markerOf("demo").length + 2 + report.length - 59999);
});

test("body: a cut on a pair boundary keeps the full 60000 units", { skip: win }, () => {
  const head = "# Run report: demo\n";
  const prefix = markerOf("demo").length + 2 + head.length;
  const pad = (60000 - prefix) % 2 === 0 ? "" : "x";
  const w = postWorld({ report: `${head}${pad}${"\u{1F600}".repeat(40000)}` });
  runScript(w, ["demo"]);
  const kept = capturedBody(w).replace(TRUNCATED, "");
  assert.equal(kept.length, 60000);
});

function snapshot(root) {
  const out = [];
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir).sort()) {
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) {
        out.push(`d ${path.relative(root, full)}`);
        walk(full);
      } else {
        out.push(`f ${path.relative(root, full)} ${createHash("sha1").update(fs.readFileSync(full)).digest("hex")}`);
      }
    }
  };
  walk(root);
  return out.join("\n");
}

test("audit: allowed argv only, body only as a file, four calls at most, temp dir removed, nothing written under the project", { skip: win }, () => {
  const marker = markerOf("demo");
  const secret = "UNIQUE-BODY-TEXT-4711";
  const report = `# Run report: demo\n\n${secret}\n`;
  const scenarios = [
    { name: "create", comments: [] },
    { name: "update", comments: [entry(5, "bot", marker)] },
    { name: "viewer lookup fails", comments: [entry(5, "x", marker)], answers: { user: { code: 1 } } },
    { name: "skipped", comments: [], answers: { "pr-view": { code: 1, err: 'no pull requests found for branch "x"\n' } } },
  ];
  for (const sc of scenarios) {
    const w = postWorld({ report, comments: sc.comments, answers: sc.answers });
    const tmp = tmpDir("as-prc-tmp-");
    const before = snapshot(w.project.root);
    const res = runScript(w, ["demo"], { env: { TMPDIR: tmp } });
    assert.equal(res.status, 0, `${sc.name}: ${res.stderr}`);
    assert.equal(snapshot(w.project.root), before, `${sc.name}: the project tree changed`);
    assert.deepEqual(fs.readdirSync(tmp), [], `${sc.name}: temp directory left behind`);
    const all = calls(w);
    assert.ok(all.length <= 4, `${sc.name}: ${all.length} calls`);
    for (const args of all) {
      assert.ok(args[0] === "pr" || args[0] === "api", args.join(" "));
      if (args[0] === "pr") assert.deepEqual(args.slice(0, 2), ["pr", "view"]);
      const forbidden = ["merge", "close", "review", "--web", "--editor", "--input", "--hostname", "DELETE"];
      assert.ok(!args.some((a) => forbidden.includes(a)), args.join(" "));
      assert.ok(!args.some((a) => a.includes(secret)), "body text in argv");
      args.forEach((a, i) => {
        if (a.startsWith("body=")) {
          assert.equal(args[i - 1], "-F");
          assert.match(a, /^body=@/);
        }
      });
      if (args[0] === "api") {
        const method = args.includes("--method") ? args[args.indexOf("--method") + 1] : "GET";
        assert.ok(["GET", "POST", "PATCH"].includes(method), method);
        const target = args.slice(1).find((a, i, arr) => !a.startsWith("-") && arr[i - 1] !== "--method" && arr[i - 1] !== "--jq" && arr[i - 1] !== "-F");
        assert.ok(target === "user" || target.startsWith("repos/"), `api path ${target}`);
      }
    }
  }
});

test("mutation: without the author comparison a foreign marker comment would be patched", { skip: win }, () => {
  const source = fs.readFileSync(SCRIPT, "utf8");
  const needle = "c.login === viewer";
  assert.equal(source.split(needle).length - 1, 1, "the author comparison must occur exactly once");
  const dir = tmpDir("as-prc-mut-");
  const mutant = path.join(dir, "pr-comment.mjs");
  fs.writeFileSync(mutant, source.replace(needle, "true"));
  const scenario = () => postWorld({ comments: [entry(5, "mallory", `${markerOf("demo")}\n\nold`)] });
  const original = scenario();
  runScript(original, ["demo"]);
  assert.deepEqual(methodsOf(original), ["POST"]);
  const broken = scenario();
  broken.script = mutant;
  runScript(broken, ["demo"]);
  assert.deepEqual(methodsOf(broken), ["PATCH"], "the mutant must behave differently");
});

test("guard: route.mjs never calls gh and policy.json has no prComment key", () => {
  const skill = path.resolve(path.dirname(SCRIPT), "..");
  const source = fs.readFileSync(path.join(skill, "scripts/route.mjs"), "utf8");
  assert.equal(/["'`]gh["'`]/.test(source), false);
  const policy = JSON.parse(fs.readFileSync(path.join(skill, "policy.json"), "utf8"));
  assert.equal("prComment" in policy, false);
});

test("COMMENT_JQ only projects and bounds", () => {
  assert.equal(COMMENT_JQ, '.[] | {id: .id, login: .user.login, head: ((.body // "") | .[0:200])}');
  assert.doesNotMatch(COMMENT_JQ, /select|startswith|test\(/);
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

// ---- Phase 3: docs consistency -----------------------------------------------------

const REPO = path.resolve(path.dirname(SCRIPT), "../../..");
const readRepo = (rel) => fs.readFileSync(path.join(REPO, rel), "utf8");
const SUBJECT = "PR comment: <change-id>";

// A SKILL.md loop branch: from the line starting `- **`<name>`**` to the next line that starts with `- **` or `## `.
function branch(skill, name) {
  const lines = skill.split("\n");
  const start = lines.findIndex((l) => l.startsWith(`- **\`${name}\`**`));
  assert.ok(start >= 0, `no ${name} branch`);
  let end = start + 1;
  while (end < lines.length && !lines[end].startsWith("- **") && !lines[end].startsWith("## ")) end++;
  return lines.slice(start, end).join("\n");
}

const countOf = (text, needle) => text.split(needle).length - 1;

test("SKILL.md: flag, script variable and the single node $PR_COMMENT call", () => {
  const skill = readRepo("skills/10x-pipeline/SKILL.md");
  assert.match(skill, /^argument-hint:.*--pr-comment/m);
  assert.ok(skill.includes("PR_COMMENT="));
  assert.ok(!skill.includes("gh pr") && !skill.includes("gh api"));
  assert.equal(countOf(skill, "node $PR_COMMENT"), 1);
  const section = skill.indexOf("## PR comment (opt-in)");
  const rules = skill.indexOf("## Rules");
  const call = skill.indexOf("node $PR_COMMENT");
  assert.ok(section >= 0 && section < rules, "section must precede ## Rules");
  assert.ok(call > section && call < rules, "node $PR_COMMENT must lie inside the section");
});

test("SKILL.md: Start step 4 stores the flag as a task and fails closed", () => {
  const skill = readRepo("skills/10x-pipeline/SKILL.md");
  const start = skill.slice(skill.indexOf("## Start"), skill.indexOf("## Loop"));
  for (const needle of ["TaskList", "TaskCreate", "--pr-comment", SUBJECT, "task list unavailable", "completed", "another change"]) {
    assert.ok(start.includes(needle), `Start section lacks ${needle}`);
  }
  // F18: the printed fallback needs the flag; without it a task tool error is silent.
  const fallback = start.split("\n").find((l) => l.includes("task list unavailable"));
  assert.match(fallback, /`--pr-comment` was given/);
  assert.ok(start.includes("a task tool error is silent"));
});

test("SKILL.md: done, archive and halt each point at TaskList, the subject and the PR comment step once", () => {
  const skill = readRepo("skills/10x-pipeline/SKILL.md");
  for (const name of ["done", "archive", "halt"]) {
    const text = branch(skill, name);
    assert.equal(countOf(text, "PR comment step"), 1, `${name}: PR comment step`);
    assert.equal(countOf(text, "TaskList"), 1, `${name}: TaskList`);
    assert.equal(countOf(text, SUBJECT), 1, `${name}: subject`);
    // F18: a TaskList error at an end branch posts nothing and says so.
    assert.equal(countOf(text, "task list unavailable"), 1, `${name}: task list unavailable`);
    assert.match(text, /post nothing/, `${name}: fail closed`);
  }
  const archive = branch(skill, "archive");
  assert.ok(archive.indexOf("PR comment step") < archive.indexOf("Call the Agent tool"), "the archive pointer must come before the archive step");
  assert.match(branch(skill, "halt"), /Before you STOP/);
});

test("SKILL.md: the PR comment section names the task, the subject and the script-error fallback", () => {
  const skill = readRepo("skills/10x-pipeline/SKILL.md");
  const section = skill.slice(skill.indexOf("## PR comment (opt-in)"), skill.indexOf("## Rules"));
  assert.ok(section.includes("TaskList") && section.includes(SUBJECT));
  // F20: no JSON or a non-zero exit is a skip, and the id length difference is named.
  assert.ok(section.includes("PR comment: skipped, script error"));
  assert.ok(section.includes("100 characters"));
  assert.ok(section.includes("PR comment: skipped, no report"));
});

test("SKILL.md: lines about the PR comment name no model, effort or tier", () => {
  const skill = readRepo("skills/10x-pipeline/SKILL.md");
  const banned = /\b(sonnet|opus|haiku|fable|effort|tier|model)\b/i;
  const lines = skill.split("\n").filter((l) => /PR_COMMENT|--pr-comment|PR comment/.test(l));
  assert.ok(lines.length >= 8, "expected the PR comment lines");
  for (const line of lines) assert.doesNotMatch(line, banned, line);
});

test("README documents the flag, and its PR comment group lies after Limits: and before ## Layout", () => {
  const readme = readRepo("README.md");
  assert.ok(readme.includes("--pr-comment"));
  const limits = readme.indexOf("\nLimits:");
  const group = readme.indexOf("\nPR comment (opt-in):");
  const layout = readme.indexOf("\n## Layout");
  assert.ok(limits >= 0 && group > limits && layout > group);
  const text = readme.slice(group, layout);
  for (const needle of ["task list unavailable", "unsupported host", "gh timed out", "100 characters", "script error", "report.md", "agent-smith"]) {
    assert.ok(text.includes(needle), `README group lacks ${needle}`);
  }
});

const ADR_RULES = [
  "- **GIVEN** a run started without `--pr-comment` **WHEN** the run ends **THEN** the orchestrator **MUST NOT** call `pr-comment.mjs`.",
  "- **GIVEN** the router runs any command **WHEN** it handles a step **THEN** it **MUST NOT** call `gh`.",
  "- **GIVEN** `pr-comment.mjs` cannot reach an open pull request **WHEN** it handles the failure **THEN** it **MUST** skip the comment and exit 0.",
  "- **GIVEN** the script finds a marker comment by the viewer **WHEN** it posts **THEN** it **MUST** edit that comment instead of creating another.",
  "- **GIVEN** the script posts **WHEN** it builds the body **THEN** it **MUST NOT** pass the body as a command argument.",
  "- **GIVEN** `--report` does not name a file `report.md` inside a directory `agent-smith` **WHEN** the script starts **THEN** it **MUST** refuse it as a usage error.",
  "- **GIVEN** the script has run **WHEN** the orchestrator records the result **THEN** it **MUST NOT** write under `context/changes/<id>/`.",
];

test("ADR-003 has a PR comment section with exactly seven rule lines, each once", () => {
  const adr = readRepo("docs/ADR/ADR-003-rigor-gated-routing.md");
  const archive = adr.indexOf("### Archive adapter");
  const start = adr.indexOf("### PR comment");
  const end = adr.indexOf("## Alternatives considered");
  assert.ok(archive >= 0 && start > archive && end > start, "section order");
  const lines = adr.slice(start, end).split("\n");
  assert.equal(lines.filter((l) => l.includes("**GIVEN**")).length, 7);
  for (const rule of ADR_RULES) assert.equal(lines.filter((l) => l === rule).length, 1, rule);
});

test("AGENTS.md names the script in Hard Rules and Commands and the test file in Commands", () => {
  const agents = readRepo("AGENTS.md");
  const rules = agents.slice(agents.indexOf("## Hard Rules"), agents.indexOf("## Project Structure"));
  const commands = agents.slice(agents.indexOf("## Commands"), agents.indexOf("## Coding Style"));
  assert.ok(rules.includes("pr-comment.mjs"));
  assert.ok(commands.includes("pr-comment.mjs") && commands.includes("pr-comment.test.mjs"));
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

test("live: the real comment projection is one parseable object per line across pages", { skip: !live && "set GH_LIVE=1 to run (needs network and an authenticated gh)" }, () => {
  requireLiveGh();
  const res = spawnSync("gh", ["api", "--paginate", "repos/cli/cli/issues/14090/comments", "--jq", COMMENT_JQ], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  assert.equal(res.status, 0, res.stderr);
  const lines = res.stdout.split("\n").filter((l) => l !== "");
  assert.ok(lines.length > 30, `only ${lines.length} lines, expected more than one page`);
  for (const line of lines) {
    const c = JSON.parse(line);
    assert.equal(typeof c.id, "number");
    assert.ok(c.login === null || typeof c.login === "string");
    assert.equal(typeof c.head, "string");
    assert.ok([...c.head].length <= 200);
  }
});
