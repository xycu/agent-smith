import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const hook = "skills/10x-pipeline/scripts/step-guard.mjs";
const checkHook = (command) => {
  const result = spawnSync(process.execPath, [hook], {
    input: JSON.stringify({
      hook_event_name: "PreToolUse", tool_name: "Bash",
      agent_type: "agent-smith:step", agent_id: "local-evidence",
      tool_input: { command },
    }),
    encoding: "utf8",
    timeout: 5000,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  return result.stdout;
};

const bash = ["/bin/bash", "--noprofile", "--norc"];
const zsh = ["/bin/zsh", "-f"];
const runShell = ([shell, ...options], ...args) => spawnSync(shell, [...options, ...args], {
  env: { PATH: "/usr/bin:/bin", LC_ALL: "C" },
  encoding: "utf8",
  timeout: 5000,
});
const checkOutput = (result, expected) => {
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  assert.equal(result.stdout, expected);
};

for (const [label, body] of [
  ["apostrophe", "it doesn't matter"],
  ["recursive-delete text", "rm -rf build"],
]) {
  const command = "cat <<EOF\n" + body + "\nEOF\n";
  assert.equal(checkHook(command), "");
  checkOutput(runShell(bash, "-c", command), body + "\n");
  console.log(label + ": hook returned neutral and Bash printed the literal text");
}

const message = "fix: it doesn't matter if a \"quote remains open";
const commit = "git commit -m \"$(cat <<'EOF'\n" + message + "\nEOF\n)\"";
assert.equal(checkHook(commit), "");
const capture = "git() { printf '%s\\0' \"$@\"; }\n" + commit;
const expectedArgs = ["commit", "-m", message, ""].join("\0");
const bashResult = runShell(bash, "-c", capture);
assert.ifError(bashResult.error);
console.log("commit-message capture: hook returned neutral");
if (bashResult.status === 0) {
  checkOutput(bashResult, expectedArgs);
  console.log("Bash supplied one literal message argument to a stand-in");
} else {
  console.log(runShell(bash, "--version").stdout.split("\n")[0]);
  console.log(bashResult.stderr.trim());
  checkOutput(runShell(zsh, "-c", capture), expectedArgs);
  console.log("zsh supplied one literal message argument to a stand-in");
}

const decision = JSON.parse(checkHook("gh --version")).hookSpecificOutput;
assert.equal(decision.hookEventName, "PreToolUse");
assert.equal(decision.permissionDecision, "deny");
assert.match(decision.permissionDecisionReason, /orchestrator/);
console.log("gh --version: the hook returned a denial for the inert payload");
console.log("Live Claude Code integration and an actual scratch Git commit remain unverified.");
