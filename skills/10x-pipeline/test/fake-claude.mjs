// Model-free stream-json peer. Exercise the installed candidate hook commands through real processes.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline";
import { once } from "node:events";

const arg = flag => process.argv[process.argv.indexOf(flag) + 1];
const session = arg("--session-id");
const agent = arg("--agent");
const root = arg("--plugin-dir");
const fixture = process.env.CLAUDE_FIXTURE_DIR;
const mode = JSON.parse(fs.readFileSync(path.join(fixture, "mode.json")));
const agentPath = path.join(root, "agents", agent.split(":")[1] + ".md");
const skill = mode.skill ?? (mode.chain === "openspec" ? "openspec-propose" : "10x-plan");
const environment = { ...process.env, CLAUDE_PLUGIN_ROOT: root };
const send = value => process.stdout.write(JSON.stringify(value) + "\n");
const event = value => send({ session_id: session, ...value });
const hook = (name, extra = {}) => {
  const input = { session_id: session, agent_type: agent, cwd: process.cwd(), hook_event_name: name, ...extra };
  const script = path.join(root, "skills/10x-pipeline/scripts", name === "PreToolUse" ? "step-guard.mjs" : "claude-hook.mjs");
  const out = spawnSync(process.execPath, [script], { env: environment, input: JSON.stringify(input), encoding: "utf8" });
  event({ type: "system", subtype: "hook_response", hook_event: name, outcome: out.status === 0 ? "success" : "error",
    exit_code: out.status, stdout: out.stdout, stderr: out.stderr });
  return out;
};
const lines = createInterface({ input: process.stdin });
const replies = new Map();
let seq = 0;
async function callback(name, tool, input, key, extra = {}) {
  const request_id = "native-" + ++seq;
  const response = new Promise(resolve => replies.set(request_id, resolve));
  send({ type: "control_request", request_id, request: { subtype: "hook_callback", callback_id: name,
    input: { session_id: session, agent_type: agent, permission_mode: mode.callbackPermissionMode,
      hook_event_name: name, tool_use_id: key, tool_name: tool, tool_input: input, ...extra } } });
  return await response;
}
function stop(reply) {
  hook("Stop", { last_assistant_message: reply, background_tasks: [], session_crons: [] });
}
function result(uuid, reply, terminal = { subtype: "success", is_error: false }) {
  event({ type: "result", result: reply, user_message_uuid: uuid, usage: { totalTokens: 998 }, ...terminal });
}
let first = true;
async function handle(message) {
  if (message.type === "control_response") {
    replies.get(message.response.request_id)?.(message.response.response);
    replies.delete(message.response.request_id);
    return;
  }
  if (message.type === "control_request") {
    const init = message.request.subtype === "initialize";
    if (init) {
      assert.equal(process.env.CLAUDE_CODE_DISABLE_BACKGROUND_TASKS, "1");
      assert.equal(arg("--permission-prompts"), "none");
      fs.writeFileSync(path.join(fixture, "args.json"), JSON.stringify(process.argv.slice(2)));
      if (!mode.missingHandshake) hook("SessionStart", { source: "startup", ...mode.badHandshake ? { session_id: "another-session" } : {} });
      if (mode.earlyLeaf) hook("SubagentStart", { agent_type: "agent-smith:step", agent_id: "unowned" });
    }
    send({ type: "control_response", response: { subtype: "success", request_id: message.request_id, response: init ? {
      hooks_applied: !mode.disabledHooks, agents: [{ name: agent }], claude_code_version: "2.1.311",
      models: [{ value: arg("--model"), resolvedModel: arg("--model") }],
    } : { agents: [{ agentType: agent, path: mode.foreignAgent ? path.join(fixture, "mode.json") : agentPath }],
      skills: { skillFrontmatter: mode.missingSkill ? [] : [{ name: skill, path: path.join(fixture, "SKILL.md") }] } } } });
    if (!init && mode.missingHandshake) process.exit(0);
    return;
  }
  if (message.type !== "user") return;
  if (first) {
    first = false;
    const tools = agent.endsWith(":score") ? ["Read","Write","Glob","Grep", ...mode.extraTool ? ["Bash"] : []] : ["Read","Write","Bash","Agent","Skill","Edit"];
    event({ type: "system", subtype: "init", plugins: [{ name: "agent-smith", path: root }], tools: tools.filter(t => t !== mode.missingTool), skills: [skill],
      model: arg("--model"), effort: arg("--effort"), cwd: process.cwd(),
      permissionMode: mode.missingPermissionMode ? undefined : mode.permissionMode ?? "dontAsk" });
    const trials = JSON.parse(message.message.content.split("\n").at(-1));
    if (mode.earlyProbeStop) stop("ready");
    for (const [tool, input] of trials) {
      const key = "probe-" + ++seq;
      const allowed = await callback("PreToolUse", tool, input, key);
      if (allowed.hookSpecificOutput?.permissionDecision === "deny") continue;
      let output;
      if (tool === "Read") { fs.readFileSync(input.file_path); output = { file: { filePath: input.file_path } }; }
      if (tool === "Write") { fs.writeFileSync(input.file_path, input.content); output = { filePath: input.file_path }; }
      if (tool === "Bash") {
        const out = hook("PreToolUse", { tool_name: tool, tool_input: input, tool_use_id: key });
        if (out.stdout && JSON.parse(out.stdout).hookSpecificOutput?.permissionDecision === "deny") continue;
        assert.doesNotMatch(input.command, / push --dry-run$/);
        // CLI-generated permission fixture only. No provider or publication client is invoked.
        const proof = spawnSync("/bin/sh", ["-c", input.command], { env: environment, encoding: "utf8" });
        if (proof.status !== 0) throw Error(proof.stderr);
        output = { stdout: proof.stdout, interrupted: false };
      }
      await callback("PostToolUse", tool, input, key, { tool_response: output });
    }
    if (mode.changeHandoff) fs.appendFileSync(mode.changeHandoff, "altered");
    if (!mode.earlyProbeStop) stop("ready");
    result(message.uuid, "ready");
    return;
  }
  fs.writeFileSync(path.join(fixture, "work.txt"), message.message.content);
  if (mode.hold) return;
  const reply = mode.reply ?? 'RESULT: {"status":"done","usage":{"totalTokens":987654},"usageEvidence":{"status":"verified"}}';
  const leafInput = { subagent_type: "agent-smith:step", prompt: "Bounded fixture task", description: "Read fixture" };
  if (mode.background || mode.leaf) {
    const refusal = await callback("PreToolUse", "Agent", { ...leafInput, run_in_background: true }, "background");
    assert.equal(refusal.hookSpecificOutput.permissionDecision, "deny");
  }
  if (mode.leaf) {
    assert.deepEqual(await callback("PreToolUse", "Agent", leafInput, "parent-call"), {});
    hook("SubagentStart", { agent_id: "leaf" });
    if (mode.earlyStop) stop(reply);
    const nested = await callback("PreToolUse", "Agent", leafInput, "nested-call", { agent_id: "leaf" });
    assert.equal(nested.hookSpecificOutput.permissionDecision, "deny");
    event({ type: "assistant", parent_tool_use_id: "parent-call", message: { role: "assistant", content: [{ type: "text", text: "foreign RESULT" }] } });
    hook("SubagentStop", { agent_id: "leaf" });
    if (!mode.uncollected) await callback("PostToolUse", "Agent", leafInput, "parent-call", {
      tool_response: { status: "completed", agentId: "leaf", content: [{ type: "text", text: "bounded evidence" }] },
    });
  }
  if (mode.scorerCall) {
    const denied = await callback("PreToolUse", "Bash", { command: "pwd" }, "restricted");
    assert.equal(denied.hookSpecificOutput.permissionDecision, "deny");
  }
  event({ type: "result", session_id: "foreign", result: 'RESULT: {"status":"done"}' });
  event({ type: "result", user_message_uuid: "unrelated", result: 'RESULT: {"status":"done"}' });
  event({ type: "assistant", message: { role: "assistant", content: [{ type: "text", text: reply }] } });
  if (mode.moveFrom) fs.renameSync(mode.moveFrom, mode.moveTo);
  const reported = mode.mismatch ? reply + "mismatch" : reply;
  const input = { file_path: path.join(fixture, "work.txt") };
  if (mode.toolFinishesAfterStop) await callback("PreToolUse", "Read", input, "late-read");
  if (!mode.earlyStop) stop(reported);
  if (mode.toolAfterStop) await callback("PreToolUse", "Read", input, "late-read");
  if (mode.toolAfterStop || mode.toolFinishesAfterStop) {
    await callback("PostToolUse", "Read", input, "late-read");
  }
  result(message.uuid, reported, mode.terminal);
  if (mode.trailingAssistant) event({ type: "assistant", message: { role: "assistant", content: [{ type: "text", text: "late output" }] } });
}
lines.on("line", line => { handle(JSON.parse(line)).catch(e => { process.stderr.write(e.message); process.exit(1); }); });
await once(lines, "close");
