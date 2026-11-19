import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { cleanupAll, makeProject, gitInit, git, gitEnv } from "./helpers.mjs";

after(cleanupAll);
const root = fileURLToPath(new URL("../../../", import.meta.url));
const script = path.join(root, "skills/10x-pipeline/scripts/step-guard.mjs");
const hooks = JSON.parse(fs.readFileSync(path.join(root, "hooks/hooks.json"), "utf8"));
const pluginPlaceholder = "$" + "{CLAUDE_PLUGIN_ROOT}";
const payload = (command, extra = {}) => ({
  hook_event_name: "PreToolUse", tool_name: "Bash", agent_id: "test-step", agent_type: "agent-smith:step",
  tool_input: { command }, ...extra,
});
function invoke(input, executable = script, options = {}) {
  const result = spawnSync(process.execPath, [executable], {
    input: typeof input === "string" || Buffer.isBuffer(input) ? input : JSON.stringify(input),
    encoding: "utf8", timeout: 5000, ...options,
  });
  assert.equal(result.error, undefined, result.error?.message);
  return { ...result, decision: result.stdout ? JSON.parse(result.stdout).hookSpecificOutput : null };
}
function denied(command, reason = /orchestrator|preserv|forbidden/i) {
  const result = invoke(payload(command));
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  assert.deepEqual(Object.keys(result.decision).sort(), ["hookEventName", "permissionDecision", "permissionDecisionReason"]);
  assert.equal(result.decision.hookEventName, "PreToolUse");
  assert.equal(result.decision.permissionDecision, "deny", command);
  assert.match(result.decision.permissionDecisionReason, reason);
}
function neutral(input) {
  const result = invoke(input);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "", "pass-through never grants permission");
  assert.equal(result.stderr, "");
}

function failedClosed(input, reason = /failed closed/) {
  const result = invoke(input);
  assert.equal(result.status, 2, result.stdout);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /failed closed/);
  assert.match(result.stderr, reason);
}

test("shipped hook uses synchronous Bash exec-form Node, bounded timeout and fail-closed handling", () => {
  assert.deepEqual(hooks, { hooks: { PreToolUse: [{
    matcher: "Bash", hooks: [{
      type: "command", command: "node",
      args: [pluginPlaceholder + "/skills/10x-pipeline/scripts/step-guard.mjs"],
      timeout: 5, async: false, onFailure: "block",
    }],
  }] } });
});

test("direct Git discard, hook bypass, unique-ref deletion and publication forms are denied", () => {
  for (const command of [
    "git push", "git push origin HEAD", "git push --force-with-lease", "git push -f",
    'git -C "project with spaces" -c color.ui=false push origin HEAD',
    "git --git-dir=.git push", "git --work-tree . push",
    "git reset --hard", "git reset --hard=HEAD~1", "git reset -q --hard HEAD",
    "git checkout -- change.md", "git checkout HEAD change.md", "git checkout change.md",
    "git restore change.md", "git restore --worktree change.md", "git restore --staged change.md",
    "git restore -S change.md", "git restore --staged --worktree change.md",
    "git clean -fd", "git clean -xdf", "git stash drop", "git stash clear",
    "git commit --no-verify -m fix", "git commit -n -m fix", "git commit -an -m fix",
    "git merge --no-verify branch",
    "git branch -D unique", "git branch --delete unique", "git tag -d unique",
    "git update-ref -d refs/heads/unique", "git worktree remove scratch", "git worktree prune",
    "git update-ref refs/agent-smith/run/failed-1 HEAD",
    "gh pr create", "gh pr comment 1 --body hello", "gh pr merge 1", "gh repo delete",
    "node skills/10x-pipeline/scripts/open-pr.mjs demo",
    "node -- skills/10x-pipeline/scripts/pr-comment.mjs demo",
    'node "/plugin with spaces/skills/10x-pipeline/scripts/open-pr.mjs" demo',
    "/plugin/skills/10x-pipeline/scripts/open-pr.mjs demo",
  ]) denied(command);
});

test("Git option values cannot masquerade as safety flags or hide hook bypass", () => {
  for (const command of [
    "git clean -e --dry-run -fd", "git clean --exclude -n -fd",
    "git clean -en -fd", "git clean -e-n -fd", "git clean --exclude=-n -fd",
    "git clean -n --no-dry-run -fd", "git clean --dry-run --no-dry-run -fd",
    "git commit -m -- --no-verify", "git commit --message -- --no-verify",
    "git commit --trailer -- --no-verify", "git commit --pathspec-from-file -- --no-verify",
    'git commit -nm"fix: retained"', 'git commit -m"fix: retained" --no-verify',
  ]) denied(command);
  for (const command of [
    'git commit -m"fix: retain work"', 'git commit -am"fix: retain work"',
    'git commit -m"--no-verify"', "git commit -Fnotes.txt", "git commit -Ssigning-key -m fix",
    "git commit --trailer --no-verify -m fix", "git commit -m -- -- tracked-file",
    "git clean -ne pattern -fd", "git clean -e pattern -nfd", "git clean --exclude -n --dry-run -fd",
    "git clean --no-dry-run -nfd", "git clean -n --exclude --no-dry-run -fd",
  ]) neutral(payload(command));
});

test("recursive shell deletion variants are denied using inert payloads only", () => {
  for (const command of [
    "rm -rf scratch", "rm -r scratch", "rm -R scratch", "rm --recursive scratch", // Never execute.
    "rm -f -r scratch", "rm -fr scratch", "rm scratch -R", // Never execute.
    'find "scratch directory" -depth -type f -delete', // Never execute.
  ]) denied(command);
});

test("literal quotes, escapes and supported shell separators retain command positions", () => {
  for (const command of [
    '"git" "push" origin HEAD', "'git' 'restore' '--staged' 'file with spaces'",
    'cd "run root" && git push origin HEAD', "git status; git clean -fd", "git diff || git stash clear",
    "git log | gh pr create", "git status\nnode '/plugin with spaces/pr-comment.mjs' demo",
    "g'i't pu\\sh", "git \\\npush", "echo safe & git push", "echo safe # harmless comment\n git push",
  ]) denied(command);
  for (const command of [
    "git status", "git log --oneline", "git diff", "git add -- change.md",
    'git commit -m "fix(demo): preserve data"', 'git commit -am "fix(demo): safe"',
    'git commit -m "--no-verify"', "git clean -nfd", "git clean --dry-run -fd",
    "git stash list", "git stash show", "git branch --list",
    "rm -- -rf", "rm -f inspected-file", "rm inspected-file", "unlink inspected-file", "rmdir empty-directory",
    'printf "%s\\n" "git push; gh pr create"', "echo 'git restore --staged file'",
    'echo "node /plugin/open-pr.mjs demo"', "cat open-pr.mjs", "git diff -- --no-verify",
    'cd "run root" && git status && git commit -m "fix: safe"', "echo safe # git push",
  ]) neutral(payload(command));
});

const heredocGuidance = /Heredoc.*Write tool/i;

test("heredocs distinguish literal text routes from executable or unresolved recipients", () => {
  const prose = 'it doesn\'t matter if a "quote remains open\nrm -rf build';
  for (const command of [
    "cat<<EOF\n" + prose + "\nEOF",
    "cat << 'EOF' >notes.txt\n" + prose + "\nEOF\n",
    "1>notes.txt cat 0<<EOF\n" + prose + "\nEOF\n",
    "cat <<EOF >/dev/null\n" + prose + "\nEOF\n",
    'cat <<"EOF" >>"more notes.txt" # a comment\n' + prose + "\nEOF\n",
    'cat <<EOF >\\\n>"more notes.txt"\n' + prose + "\nEOF\n",
    "false |\\\n| cat <<EOF\n" + prose + "\nEOF\n",
    "cat <<EOF | tee -a notes.txt\n" + prose + "\nEOF\n",
    "cat <<EOF | # pipeline continues after the heredoc\n" + prose + "\nEOF\ntee notes.txt",
    "cat <<A | tee <<B notes.txt\nfirst\nA\nsecond\nB\n",
  ]) neutral(payload(command));
  for (const command of [
    "bash <<'EOF'\n" + prose + "\nEOF",
    "node <<'EOF'\n" + prose + "\nEOF",
    "cat <<EOF | tee notes.txt | sh\n" + prose + "\nEOF",
    "cat <<EOF | # pipeline continues after the heredoc\n" + prose + "\nEOF\nsh",
    'cat <<EOF >"$destination"\n' + prose + "\nEOF",
    "cat <<EOF 2>&1\n" + prose + "\nEOF",
    "cat 3<<EOF\n" + prose + "\nEOF",
    "cat <<EOF >/dev/fd/1\nliteral text\nEOF\n",
    "cat <<EOF >/dev/stdout\nliteral text\nEOF\n",
    "cat <<EOF >/dev/tcp/example.invalid/1\nliteral text\nEOF\n",
    "cat <<EOF > >(tee notes.txt)\n" + prose + "\nEOF",
    "if true; then\ncat <<EOF\n" + prose + "\nEOF\nfi",
    "time -p {\ncat <<'EOF'\nliteral text\nEOF\n}",
    "! {\ncat <<'EOF'\nliteral text\nEOF\n}",
    "coproc WRITER {\ncat <<'EOF'\nliteral text\nEOF\n}",
    "if true; then if true; then true; fi\ncat <<'EOF'\nliteral text\nEOF\nfi",
    "((cat <<'EOF'\nliteral text\nEOF\n) )",
  ]) denied(command, heredocGuidance);
  denied("cat <<EOF\n" + prose + "\nEOF\ngit push");
  denied("git push; cat <<EOF\n" + prose + "\nEOF");
});

test("heredoc delimiters and body escapes follow their lexical context", () => {
  for (const command of [
    "cat <<-EOF\n\tfirst\n\tEOF\n",
    "cat <<-'EOF'\n\tEOF \n\tmore text\n\tEOF\n",
    "cat <<EOF\nEOF \n\tEOF\nmore text\nEOF",
    "cat <<EOF\nfirst\nEO\\\nF\n",
    "cat <<EOF\nfirst\nEOF\\\n",
    "cat <\\\n<EO\\\nF\\\n >notes.txt\nfirst\nEOF\n",
    'cat << "EO\\\nF"\\\n # trailing comment\nfirst\nEOF',
    "cat <<EOF\nliteral \\$(echo hi) \\$HOME \\\x60echo hi\\\x60 and $.\nEOF",
    "cat <<EOF\nliteral \\$\\\n(name)\nEOF",
    "cat <<'EOF'\n$(echo hi) $((1+2)) $HOME \x60echo hi\x60\nEOF",
    'echo "<<EOF" \'<<EOF\' \\<\\<EOF # <<IGNORED',
    'echo "$(printf \'<<EOF\')"',
    'echo "\x60printf \'<<EOF\'\x60"',
    "echo $((1<<2)); ((1<<2))",
    "cat <<< 'literal <<EOF'",
  ]) neutral(payload(command));
  for (const body of ["$(echo hi)", "$HOME", "\x60echo hi\x60", "$((1+2))", "$\\\n(echo hi)", "\\\\$(echo hi)"]) {
    denied("cat <<EOF\n" + body + "\nEOF", /active expansion.*quote.*Write tool/i);
  }
  for (const command of [
    "cat <<EOF\nmissing terminator",
    "cat <<-EOF\n EOF\n",
    "cat <<EOF\nEOF \n",
    "cat <<EOF\nEO\\\\\nF\n",
    "cat <<EOF\nEO\\\n",
    "cat <<EOF\nfirst\n",
    'cat <<E"OF"\nfirst\nEOF\n',
  ]) {
    const result = invoke(payload(command));
    assert.equal(result.status, 2, command);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /heredoc.*Write tool/i);
  }
});

test("only an entire separate git commit message operand can capture a literal heredoc", () => {
  const capture = (body) => '"$(cat <<\'EOF\'\n' + body + "EOF\n)\"";
  const message = capture('fix: an apostrophe isn\'t a "quote\ngit push\n');
  for (const command of [
    "git commit -m " + message,
    "git commit -m " + message.replace("$(", "$\\\n("),
    "git commit -m " + capture(""),
    "git commit -m " + capture("--no-verify\n"),
    "git commit -a -m " + message + " -- tracked-file",
  ]) neutral(payload(command));
  denied("git commit --no-verify -m " + message);
  denied("git commit -m " + capture("") + " --no-verify");
  denied("git commit -m " + message + " && gh --version");
  for (const command of [
    "echo " + message,
    "echo " + capture("literal text\n").replace("$(", "$\\\n("),
    'echo "$((cat <<\'EOF\'\nliteral text\nEOF\n) )"',
    "git commit --trailer -m " + message,
    "git commit -- -m " + message,
    "git commit -m" + message,
    "git commit -m " + message + "suffix",
    'git commit -m "$(cat <<\'EOF\'\nmessage\nEOF\necho extra\n)"',
    "echo $(cat <<'EOF'\nmessage\nEOF\n)",
  ]) denied(command, heredocGuidance);
});

test("orchestrator and unrelated agents pass through, including publication script calls", () => {
  for (const extra of [
    { agent_id: undefined, agent_type: undefined }, { agent_id: undefined },
    { agent_type: "general-purpose" }, { agent_type: "agent-smith:score" }, { agent_type: "custom:step" },
  ]) neutral(payload("node /plugin/open-pr.mjs demo && gh pr create", extra));
});

test("dynamic programs and wrappers are outside the documented direct-command subset", () => {
  for (const command of ["bash -c 'git push'", 'echo "$(git push)"', "custom-helper"]) neutral(payload(command));
});

test("malformed guarded events deny and malformed JSON, oversized input and quote errors fail closed", () => {
  for (const extra of [
    { tool_input: undefined }, { tool_input: { command: 4 } }, { tool_input: { command: "" } },
    { tool_name: "Other" }, { hook_event_name: "PostToolUse" }, { agent_id: "" }, { agent_id: 4 },
  ]) assert.equal(invoke(payload("git status", extra)).decision?.permissionDecision, "deny");
  for (const input of [
    "{", "null", "[]", JSON.stringify(payload("x".repeat(65536))),
    JSON.stringify(payload("git 'unterminated")), JSON.stringify(payload("git \\")),
  ]) failedClosed(input);
});

const hookByteCap = 64 * 1024;
const oversizedCommand = "x".repeat(hookByteCap);
const oversizedCommandField = '"tool_input":' + JSON.stringify({ command: oversizedCommand });
const oversized = (...members) => "{" + [oversizedCommandField, ...members].join(",") + "}";
const stepType = '"agent_type":"agent-smith:step"';
const stepId = '"agent_id":"step"';
const sizeDiagnostic = /exceeds 64 KiB/;

test("hook byte cap applies only to guarded steps even with a present invalid ID", () => {
  for (const extra of [
    { agent_id: undefined, agent_type: undefined },
    { agent_id: undefined },
    { agent_type: "general-purpose" },
  ]) neutral(payload(oversizedCommand, extra));
  for (const extra of [{}, { agent_id: null }]) {
    failedClosed(payload(oversizedCommand, extra), sizeDiagnostic);
  }

  const guarded = JSON.stringify(payload("git push"));
  const atLimit = guarded + " ".repeat(hookByteCap - Buffer.byteLength(guarded));
  assert.equal(Buffer.byteLength(atLimit), hookByteCap);
  const result = invoke(atLimit);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  assert.equal(result.decision?.permissionDecision, "deny");
  assert.match(result.decision.permissionDecisionReason, /orchestrator/i);
  failedClosed(atLimit + " ", sizeDiagnostic);
});

test("hook overflow uses decoded top-level identity and the last supplied type", () => {
  failedClosed(oversized(stepType, stepId), sizeDiagnostic);
  neutral(oversized(
    '"nested":{' + stepType + "," + stepId + "}",
    '"text":' + JSON.stringify("{" + stepType + "," + stepId + "}")
  ));
  neutral(oversized(stepType, stepId, '"agent_type":"general-purpose"'));
  neutral(oversized(stepType, stepId, '"agent_type":{"value":"agent-smith:step"}'));
  failedClosed(oversized('"agent_type":"general-purpose"', stepId, stepType), sizeDiagnostic);

  const longKey = JSON.stringify("agent_type" + oversizedCommand);
  const longType = JSON.stringify("agent-smith:step" + oversizedCommand);
  neutral(oversized(longKey + ':"agent-smith:step"', stepId));
  neutral(oversized('"agent_type":' + longType, stepId));
  failedClosed(oversized('"agent_type":' + longType, stepId, stepType), sizeDiagnostic);
});

test("hook overflow handoff preserves UTF-8 and decoded key escapes at 64 KiB", () => {
  const commandStart = '{"tool_input":{"command":"';
  const padding = (beforeSplit) => "x".repeat(hookByteCap - Buffer.byteLength(commandStart + beforeSplit));
  const multibyte = commandStart + padding("x") + '€"},' + stepType + "," + stepId + "}";
  assert.equal(Buffer.from(multibyte)[hookByteCap - 1], 0xe2);
  failedClosed(multibyte, sizeDiagnostic);

  const keyStart = '"},"agent_\\u00';
  const escaped = commandStart + padding(keyStart) + keyStart + '74ype":"agent-smith:\\u0073tep","agent_\\u0069d":"step"}';
  assert.equal(escaped.slice(hookByteCap, hookByteCap + 2), "74");
  failedClosed(escaped, sizeDiagnostic);

  // An invalid continuation inside this command becomes replacement text, as on the Buffer path.
  const invalidUtf8 = Buffer.from(multibyte);
  invalidUtf8[hookByteCap] = 0x78;
  failedClosed(invalidUtf8, sizeDiagnostic);
});

test("hook overflow validates ignored values, trailing bytes, and 64 open containers", () => {
  const nonStep = oversized('"agent_type":"general-purpose"', stepId);
  neutral(nonStep);
  neutral(oversized('"metadata":[null,true,false,0,-0,12,-1.25e+42,3E-9,{}]'));
  for (const input of [
    nonStep + "false", "\uFEFF" + nonStep, nonStep.slice(0, -3),
    nonStep.slice(0, -1) + ',"bad":[true,]}',
    nonStep.slice(0, -1) + ',"bad":01}',
    nonStep.slice(0, -1) + ',"bad":1.e2}',
    nonStep.slice(0, -1) + ',"bad":"\\u00ZZ"}',
    nonStep.slice(0, -1) + ',"bad":"\\v"}',
    "[" + nonStep + "]",
  ]) failedClosed(input, /Invalid JSON/);

  const nested = (arrayDepth) => oversized('"metadata":' + "[".repeat(arrayDepth) + "{}" + "]".repeat(arrayDepth));
  neutral(nested(62));
  failedClosed(nested(63), /64 nested JSON containers/);
});

test("hook argument vector preserves plugin paths containing spaces and shell metacharacters", () => {
  const p = makeProject();
  const plugin = path.join(p.root, "plugin with spaces ' $ literal");
  const target = path.join(plugin, "skills/10x-pipeline/scripts/step-guard.mjs");
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(script, target);
  const hook = hooks.hooks.PreToolUse[0].hooks[0];
  const args = hook.args.map((value) => value.replace(pluginPlaceholder, plugin));
  const result = spawnSync(hook.command, args, { input: JSON.stringify(payload("git push")), encoding: "utf8", timeout: 5000 });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).hookSpecificOutput.permissionDecision, "deny");
});

test("distinct HEAD, index and working-copy versions survive denied staged restore before a recording executable", () => {
  const p = makeProject();
  gitInit(p);
  const file = path.join(p.root, "unique.txt");
  fs.writeFileSync(file, "HEAD version\n");
  git(p, ["add", "--", "unique.txt"]);
  git(p, ["commit", "-qm", "test: HEAD version"]);
  fs.writeFileSync(file, "staged-only version\n");
  git(p, ["add", "--", "unique.txt"]);
  fs.writeFileSync(file, "working-copy version\n");
  const bin = path.join(p.root, "bin");
  const calls = path.join(p.root, "calls");
  fs.mkdirSync(bin);
  for (const name of ["git", "node"]) {
    fs.writeFileSync(path.join(bin, name), '#!/bin/sh\nprintf "%s\\n" "$*" >> "$STEP_GUARD_CALLS"\n', { mode: 0o755 });
  }
  const options = { cwd: p.root, env: { ...gitEnv(p), PATH: bin + path.delimiter + process.env.PATH, STEP_GUARD_CALLS: calls } };
  function guarded(command, extra = {}) {
    const result = invoke(payload(command, extra), script, options);
    if (result.status === 0 && result.decision?.permissionDecision !== "deny") {
      const executed = spawnSync("/bin/sh", ["-c", command], { ...options, encoding: "utf8", timeout: 5000 });
      assert.equal(executed.status, 0, executed.stderr);
    }
  }
  guarded("git restore --staged unique.txt");
  guarded("node /plugin/open-pr.mjs demo");
  assert.equal(fs.existsSync(calls), false, "denied calls reach no recording executable");
  assert.equal(git(p, ["show", "HEAD:unique.txt"]), "HEAD version");
  assert.equal(git(p, ["show", ":unique.txt"]), "staged-only version");
  assert.equal(fs.readFileSync(file, "utf8"), "working-copy version\n");
  guarded('git commit -m "fix(demo): safe"');
  guarded('git commit -m "chore(archive): close demo"');
  guarded("node /plugin/open-pr.mjs demo", { agent_id: undefined, agent_type: undefined });
  guarded("node /plugin/pr-comment.mjs demo", { agent_id: undefined, agent_type: undefined });
  assert.equal(fs.readFileSync(calls, "utf8").trim().split("\n").length, 4);
});

test("the standalone guard has no execution, filesystem, network or routing dependency", () => {
  const source = fs.readFileSync(script, "utf8");
  assert.doesNotMatch(source, /\b(?:import|require|eval|Function)\b/);
  assert.doesNotMatch(source, /\b(?:fetch|WebSocket|spawn|spawnSync|exec|execSync|execFile|fork)\s*\(/);
  assert.doesNotMatch(source, /getBuiltinModule|process\.(?:binding|dlopen|mainModule)/);
  assert.match(source, /for await \(const chunk of process\.stdin\)/);
});

test("guarded leaf identities retain denials without broadening the orchestrator boundary", () => {
  for (const agent_id of ["leaf-id", "/root/step/leaf"]) {
    for (const command of ["git push", "git restore --staged unique.txt", "node /plugin/open-pr.mjs demo"]) {
      const result = invoke(payload(command, { agent_id }));
      assert.equal(result.decision?.permissionDecision, "deny");
    }
    neutral(payload("git diff", { agent_id }));
  }
  neutral(payload("node /plugin/open-pr.mjs demo", { agent_id: undefined, agent_type: undefined }));
});
