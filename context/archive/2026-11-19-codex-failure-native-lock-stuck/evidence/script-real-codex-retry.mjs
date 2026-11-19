// Reproduce on macOS with Node 24+, Codex 0.169.0, authenticated file-backed Codex,
// and a host that permits the native sandbox. Run from this source checkout.
//   scratch=$(mktemp -d)
//   umask 077
//   node context/changes/codex-failure-native-lock-stuck/evidence/script-real-codex-retry.mjs \
//     "$PWD" "$scratch" "$(command -v codex)" "${CODEX_HOME:-$HOME/.codex}/auth.json"
// Only synthetic fixture prompts are sent to Codex. The script removes its private
// credential copy on exit. Keep the backed-up failed attempt in the scratch repo.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const [source, scratchArg, realCodex, authSource] = process.argv.slice(2);
const scratch = fs.realpathSync(scratchArg);
assert.equal(fs.readdirSync(scratch).length, 0, "Scratch directory must be empty.");
const home = path.join(scratch, "codex-home");
const tmp = path.join(scratch, "tmp");
const bin = path.join(scratch, "bin");
const repo = path.join(scratch, "repo");
const root = path.join(scratch, "run");
const id = "live-lock-retry";
const changeRel = `openspec/changes/${id}`;
const change = path.join(root, changeRel);
const state = path.join(change, "agent-smith");
const auth = path.join(home, "auth.json");
const scripts = path.join(source, "skills/10x-pipeline/scripts");
for (const dir of [home, tmp, bin]) fs.mkdirSync(dir, { mode: 0o700 });
const env = { ...process.env, CODEX_HOME: home, TMPDIR: tmp, LIVE_TRACE: scratch, REAL_CODEX: realCodex,
  PATH: bin + path.delimiter + process.env.PATH, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1",
  GIT_AUTHOR_NAME: "Agent Smith Fixture", GIT_AUTHOR_EMAIL: "fixture@example.invalid",
  GIT_COMMITTER_NAME: "Agent Smith Fixture", GIT_COMMITTER_EMAIL: "fixture@example.invalid" };
for (const key of Object.keys(env)) {
  if (/^GIT_(DIR|WORK_TREE|INDEX_FILE|COMMON_DIR|OBJECT_DIRECTORY|ALTERNATE_OBJECT_DIRECTORIES|CONFIG_(COUNT|KEY_|VALUE_|PARAMETERS))/.test(key)) delete env[key];
}
const write = (file, text) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
};
const call = (file, args, { cwd = root, input, status = 0 } = {}) => {
  const result = spawnSync(file, args, { cwd, env, input, encoding: "utf8", timeout: 180_000, maxBuffer: 8 * 1024 * 1024 });
  assert.ifError(result.error);
  if (status !== null && result.status !== status) throw new Error(`${path.basename(file)} ${args[0]} exited ${result.status}`);
  return result;
};
const git = (...args) => call("git", args).stdout.trim();
const route = (...args) => JSON.parse(call(process.execPath, [path.join(scripts, "route.mjs"), ...args, id, "--chain", "openspec"], { status: null }).stdout);
const dispatch = (action) => {
  const child = call(process.execPath, [path.join(scripts, "run-codex.mjs"), id, "--chain", "openspec"], { input: JSON.stringify(action), status: null });
  const envelope = JSON.parse(child.stdout);
  const reason = String(envelope.reason ?? "").replaceAll(scratch, "<scratch>");
  console.log(JSON.stringify({ n: action.n, step: action.step, runnerExit: child.status,
    launched: envelope.launched, completed: envelope.completed, execExit: envelope.exitCode,
    signal: envelope.signal, durationMs: envelope.usage?.durationMs, reason }));
  return { child, envelope };
};
const entries = () => fs.readFileSync(path.join(state, "run.jsonl"), "utf8").trim().split("\n").map(line => JSON.parse(line));
const lock = path.join(tmp, `agent-smith-${createHash("sha256").update(state).digest("hex").slice(0, 16)}.lock`);
const expect = (action, step) => {
  if (action.action !== "run" || action.step !== step) throw new Error(`Expected run ${step}, got ${action.action}: ${String(action.reason).replaceAll(scratch, "<scratch>")}`);
};

write(path.join(home, "config.toml"), `default_permissions = "fixture"
approval_policy = "never"
[permissions.fixture]
extends = ":workspace"
[permissions.fixture.filesystem]
${JSON.stringify(scratch)} = "write"
${JSON.stringify(path.join(repo, ".git"))} = "write"
${JSON.stringify(path.join(repo, ".git/worktrees/run"))} = "write"
`);
const wrapper = path.join(bin, "codex");
write(wrapper, `#!/bin/sh
set -eu
case "$1" in
  exec)
    attempt=1
    if test -f "$LIVE_TRACE/exec-1.status"; then attempt=2; fi
    code=0
    "$REAL_CODEX" "$@" 2>"$LIVE_TRACE/exec-$attempt.stderr" || code=$?
    printf '%s\\n' "$code" > "$LIVE_TRACE/exec-$attempt.status"
    if test "$attempt" -eq 1 && test "$code" -eq 0; then exit 1; fi
    exit "$code"
    ;;
  sandbox) exec "$REAL_CODEX" "$@" 2>"$LIVE_TRACE/preflight.stderr" ;;
  *) exec "$REAL_CODEX" "$@" ;;
esac
`);
fs.chmodSync(wrapper, 0o700);
call("git", ["init", "--quiet", "--initial-branch=main", repo], { cwd: scratch });
call("git", ["commit", "--quiet", "--allow-empty", "-m", "chore: initialize scratch fixture"], { cwd: repo });
call("git", ["worktree", "add", "--quiet", "-b", `agent-smith/${id}`, root, "HEAD"], { cwd: repo });
write(path.join(root, "openspec/config.yaml"), "schema: spec-driven\n");
fs.mkdirSync(change, { recursive: true });
const ladder = JSON.parse(fs.readFileSync(path.join(scripts, "../codex-policy.json"), "utf8")).ladder;
const fixturePrompt = `This is an isolated local router verification fixture. Use your shell tool to create these three files under ${changeRel}:
- proposal.md with the heading "# Scratch proposal"
- specs/scratch/spec.md with the heading "# Scratch spec"
- tasks.md with one line "- [ ] 1.1 Add a local fixture marker."
Write those files now. Use paths within the worktree. Do not use Git, delegate, publish, contact a remote, or write other files. The outer router takes care of Git. After creating the files, end your reply with exactly:
RESULT: {"status":"done","note":"Scratch planning artifacts written.","assumptions":[]}`;
write(path.join(root, "context/foundation/agent-smith-policy.json"), JSON.stringify({ ladder, prompts: { "os-propose": fixturePrompt } }));
git("add", "--all");
git("commit", "--quiet", "-m", "chore: configure scratch fixture");

try {
  fs.copyFileSync(authSource, auth, fs.constants.COPYFILE_EXCL);
  fs.chmodSync(auth, 0o600);
  console.log(call(realCodex, ["--version"]).stdout.trim());
  const firstCall = call(process.execPath, [path.join(scripts, "route.mjs"), "init", id, "--chain", "openspec", "--host", "codex",
    "--rigor", "lean", "--goal", "Write three local planning fixtures."], { status: null });
  const first = JSON.parse(firstCall.stdout);
  expect(first, "os-propose");
  assert.equal(JSON.parse(fs.readFileSync(path.join(state, "meta.json"))).isolated, true);
  const before = fs.readFileSync(path.join(state, "run.jsonl"), "utf8");
  const { child, envelope } = dispatch(first);
  assert.equal(child.status, 1);
  assert.equal(envelope.launched, true, "Native preflight must pass before exec can start.");
  assert.equal(fs.readFileSync(path.join(scratch, "exec-1.status"), "utf8").trim(), "0");
  assert.equal(envelope.completed, false);
  assert.equal(envelope.result, null);
  assert.equal(envelope.exitCode, 1);
  assert.equal(envelope.signal, null);
  assert.match(envelope.reason, /^Codex exited unsuccessfully/);
  assert.ok(Number.isSafeInteger(envelope.usage?.durationMs));
  assert.equal(fs.existsSync(lock), false);
  assert.equal(fs.readFileSync(path.join(state, "run.jsonl"), "utf8"), before);
  assert.equal(fs.existsSync(path.join(root, first.resultFile)), false);
  assert.equal(fs.existsSync(path.join(change, "proposal.md")), true);
  console.log("Real exec exited 0. Wrapper returned 1. Runner reconciled real native metadata, released the lock and left the result file unwritten.");

  write(path.join(root, first.resultFile), JSON.stringify({ status: "unknown", note: envelope.reason, usage: envelope.usage }));
  const retry = route("next");
  expect(retry, first.step);
  assert.ok(retry.n > first.n);
  const failed = entries().find(entry => entry.n === first.n);
  assert.equal(failed.result.status, "unknown");
  assert.equal(failed.ok, false);
  assert.equal(failed.result.note, envelope.reason);
  assert.equal(failed.usage.durationMs, envelope.usage.durationMs);
  assert.match(failed.rolledBack, /^refs\/agent-smith\//);
  assert.equal(fs.existsSync(path.join(change, "proposal.md")), false);
  assert.match(git("show", `${failed.rolledBack}:${changeRel}/proposal.md`), /Scratch proposal/i);
  console.log(JSON.stringify({ recordedAttempt: failed.n, status: failed.result.status, ok: failed.ok,
    durationMs: failed.usage.durationMs, rollbackPreservedProposal: true, retry: retry.n, step: retry.step }));

  const second = dispatch(retry);
  assert.equal(second.child.status, 0);
  assert.equal(fs.readFileSync(path.join(scratch, "exec-2.status"), "utf8").trim(), "0");
  assert.equal(second.envelope.completed, true);
  assert.equal(second.envelope.result.status, "done");
  assert.equal(fs.existsSync(lock), false);
  write(path.join(root, retry.resultFile), JSON.stringify(second.envelope.result));
  const next = route("next");
  expect(next, "os-apply");
  const accepted = entries().find(entry => entry.n === retry.n);
  assert.equal(accepted.result.status, "done");
  assert.equal(accepted.ok, true);
  console.log(JSON.stringify({ recordedRetry: accepted.n, status: accepted.result.status, ok: accepted.ok, nextStep: next.step }));
} finally {
  if (fs.existsSync(auth)) fs.unlinkSync(auth);
}

