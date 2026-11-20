// One fresh, guarded CLI session handles capability proof and the pending dispatch.
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { ROOT, ID_RE, acquireRunLock, isObject, parseFlags } from "./state.mjs";
import { validateAction, readResult } from "./runner-dispatch.mjs";
import { digest, guardRevision, pluginRoot } from "./claude-hook.mjs";
import { PERMISSION_PROBE } from "./permission-probe.mjs";
import { unavailableEvidence } from "./usage.mjs";
import { removeTree } from "./remove-tree.mjs";

const limit = 8 * 1024 * 1024;
const fail = message => { throw new Error(message); };
const quote = value => "'" + value.replaceAll("'", "'\\''") + "'";
const startupLimit = "Trusted startup imports can read pending task files before the tool guard handshake.";
const scoreTools = ["Glob", "Grep", "Read", "Write"];
const permissionModes = new Set(["default", "manual", "acceptEdits", "auto", "dontAsk", "plan"]);
const delegatingSkills = new Set(["10x-frame", "10x-plan-review", "10x-impl-review"]);
const terminalErrors = new Set(["error_during_execution", "error_max_turns", "error_max_budget_usd", "error_max_structured_output_retries"]);
const mayCommit = new Set(["implement", "fix", "impl-review", "archive", "os-apply", "os-archive"]);
const otherLaunch = new Set(["SendMessage", "Monitor", "CronCreate", "ScheduleWakeup", "RemoteTrigger", "Workflow", "EnterWorktree", "PowerShell"]);
const denied = reason => ({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason } });

function capabilityProbe(required, scorer) {
  const scratch = fs.mkdtempSync(path.join(required.paths.change, ".agent-smith-probe-"));
  try {
    const token = randomUUID();
    const file = path.join(scratch, "write.txt");
    const check = path.join(scratch, "probe.mjs");
    let program = 'import fs from "node:fs";\n';
    if (required.openspec) program += 'import { execFileSync as run } from "node:child_process";\n'
      + 'if (run("openspec", ["--version"], { encoding: "utf8" }).trim() !== "2.0.0") throw Error("OpenSpec 2.0.0 required");\n';
    if (mayCommit.has(required.step)) program += PERMISSION_PROBE.replace('import fs from "node:fs";', "");
    program += `\nprocess.stdout.write(${JSON.stringify(token)});\n`;
    fs.writeFileSync(check, program, { flag: "wx", mode: 0o600 });
    const bash = [process.execPath, check, ROOT, scratch].map(quote).join(" ");
    // This non-existent working directory ensures the negative probe cannot contact a remote.
    const reject = "git -C " + quote(path.join(scratch, "absent")) + " push --dry-run";
    const trials = [
      ["Read", { file_path: check }],
      ["Write", { file_path: file, content: token }],
      ...scorer ? [] : [["Bash", { command: bash }], ["Bash", { command: reject }]],
    ];
    return { scratch, token, file, check, bash, reject,
      prompt: "Preflight only. Perform exactly these tool calls, using the values verbatim. The final Git probe must be denied. "
        + "Then reply with the word ready. Do not read the pending task or delegate.\n" + JSON.stringify(trials) };
  } catch (error) { removeTree(scratch); throw error; }
}

function probeInput(probe, tool, input) {
  if (tool === "Read" && input.file_path === probe.check && Object.keys(input).every(key => key === "file_path")) return "read";
  if (tool === "Write" && input.file_path === probe.file && input.content === probe.token && Object.keys(input).length === 2) return "write";
  if (tool !== "Bash" || Object.keys(input).some(key => !["command", "description", "timeout", "run_in_background"].includes(key))
      || input.run_in_background === true) return null;
  return input.command === probe.bash ? "bash" : input.command === probe.reject ? "denial" : null;
}

export async function runClaude(id, chain, action) {
  const envelope = { action: "claude-result", launched: false, completed: false, result: null };
  const session = randomUUID();
  const work = randomUUID();
  const qualification = randomUUID();
  let lock, child, probe, timer, killTimer, error, cancellation, pid, start;
  let sentProbe = false;
  let finished = false;
  let terminal, stop, finalText;
  let launchedCli = false;
  let unresolvedLeaf = false;
  let version;
  const awaiting = new Set();
  const active = new Set();
  const stopped = new Set();
  const collected = new Set();
  const calls = new Set();
  const leavesPending = () => active.size > 0 || calls.size > 0 || stopped.size !== collected.size;
  const proven = new Set();
  const probeCalls = new Map();
  const terminate = (signal = "SIGTERM") => {
    if (!pid) return;
    const kill = sig => { try { process.kill(-pid, sig); } catch (e) { if (e.code !== "ESRCH") throw e; } };
    kill(signal);
    killTimer ??= setTimeout(() => kill("SIGKILL"), 3000);
  };
  const onInt = () => { cancellation = "SIGINT"; terminate("SIGINT"); };
  const onTerm = () => { cancellation = "SIGTERM"; terminate(); };
  process.on("SIGINT", onInt);
  process.on("SIGTERM", onTerm);
  try {
    if (process.platform === "win32") fail("Headless Claude requires verifiable POSIX process-group closure.");
    if (!ID_RE.test(id ?? "") || !["10x", "openspec"].includes(chain)) fail("Invalid change ID or chain.");
    lock = acquireRunLock(id, chain, fail);
    const required = validateAction(action, id, chain, "claude");
    const scorer = action.agent === "agent-smith:score" && required.step === "score";
    if (!(scorer || action.agent === "agent-smith:step") || required.advisor) {
      fail("Headless Claude cannot prove this exact agent mapping or native advisor requirement.");
    }
    const revision = guardRevision(pluginRoot, action.agent);
    const agentFile = fs.realpathSync(path.join(pluginRoot, "agents", scorer ? "score.md" : "step.md"));
    probe = capabilityProbe(required, scorer);
    let initialized = false, discovery = false, handshake = false, initTools = false;
    let models, effortProven = false;
    const send = message => child.stdin.write(JSON.stringify(message) + "\n");
    const request = (request_id, request) => { awaiting.add(request_id); send({ type: "control_request", request_id, request }); };
    const user = (uuid, content) => send({ type: "user", uuid, session_id: session, parent_tool_use_id: null, message: { role: "user", content } });
    const refuse = message => {
      error ??= message;
      terminate();
    };
    const maybeProbe = () => {
      if (!sentProbe && handshake && initialized && discovery) {
        sentProbe = true;
        user(qualification, probe.prompt);
      }
    };
    function callback(req) {
      const event = req.input;
      if (!isObject(event) || req.callback_id !== event.hook_event_name || event.session_id !== session) {
        fail("Claude tool callback did not match the registered guard or session.");
      }
      const leaf = event.agent_id !== undefined;
      if (leaf && !active.has(event.agent_id)) unresolvedLeaf = true;
      const tool = event.tool_name === "Task" ? "Agent" : event.tool_name;
      if (!leaf && event.effort?.level !== undefined) {
        if (event.effort.level !== action.effort) fail("Claude tool call changed the routed reasoning effort.");
        effortProven = true;
      }
      const input = event.tool_input;
      const key = event.tool_use_id;
      if ((leaf ? event.agent_type !== "agent-smith:step" || !active.has(event.agent_id) : event.agent_type !== action.agent)
          || typeof key !== "string" || !key || !isObject(input)
          || (event.permission_mode !== undefined && !permissionModes.has(event.permission_mode))) {
        fail("Claude tool identity or effective permission mode could not be verified.");
      }
      if (req.callback_id === "PreToolUse") {
        if (!envelope.launched) {
          const trial = sentProbe && handshake && !leaf && initTools && probeInput(probe, tool, input);
          if (!trial || (scorer && tool === "Bash")) return denied("Only the exact capability probe is authorized before dispatch.");
          probeCalls.set(key, trial);
        } else if (finished || (scorer && !scoreTools.includes(tool)) || otherLaunch.has(tool)
            || input.run_in_background === true || input.dangerouslyDisableSandbox === true) {
          return denied("Detached work, permission overrides and unsupported tools are unavailable in this session.");
        } else if (tool === "Agent") {
          if (leaf || scorer || input.subagent_type !== "agent-smith:step"
              || typeof input.prompt !== "string" || !input.prompt.trim()
              || Object.keys(input).some(k => !["description", "prompt", "subagent_type", "run_in_background"].includes(k))
              || (Object.hasOwn(input, "run_in_background") && input.run_in_background !== false)) {
            return denied("Delegate only an awaited foreground agent-smith:step leaf with inherited restrictions.");
          }
          if (calls.has(key) || calls.size >= 512) fail("Duplicate or excessive native leaf calls.");
          calls.add(key);
        }
      } else if (req.callback_id === "PostToolUse") {
        if (finished) fail("Claude reported tool completion after its terminal event.");
        if (!envelope.launched) {
          const trial = probeCalls.get(key);
          if (trial && trial === probeInput(probe, tool, input)) {
            const out = event.tool_response;
            if (trial === "denial") fail("The Bash guard allowed the negative permission probe.");
            if (trial === "write" && out?.filePath === probe.file && fs.readFileSync(probe.file, "utf8") === probe.token) proven.add(trial);
            if (trial === "read" && out?.file?.filePath === probe.check) proven.add(trial);
            if (trial === "bash" && typeof out?.stdout === "string" && out.stdout.trimEnd().endsWith(probe.token)
                && out.interrupted !== true && !out.backgroundTaskId) proven.add(trial);
          }
        } else if (tool === "Agent") {
          const out = event.tool_response;
          if (leaf || !calls.delete(key) || out?.status !== "completed" || !stopped.has(out.agentId)
              || collected.has(out.agentId) || !Array.isArray(out.content) || !out.content.some(c => c.type === "text" && c.text?.trim())) {
            fail("Claude foreground leaf collection did not match a completed invocation.");
          }
          collected.add(out.agentId);
        }
      } else fail("Unknown Claude guard callback.");
      // An idle receipt must follow both authorization and completion in the same turn.
      stop = null;
      return {};
    }
    function receive(e) {
      if (!isObject(e)) fail("Malformed Claude stream event.");
      if (e.type === "control_request") {
        if (e.request?.subtype !== "hook_callback" || typeof e.request_id !== "string") fail("Unexpected Claude control request.");
        const response = callback(e.request);
        send({ type: "control_response", response: { subtype: "success", request_id: e.request_id, response } });
        return;
      }
      if (e.type === "control_response") {
        const r = e.response;
        if (!awaiting.delete(r?.request_id) || r.subtype !== "success") fail("Claude rejected or mismatched capability discovery.");
        const data = r.response;
        if (r.request_id === "initialize") {
          version = data?.claude_code_version;
          if (data?.hooks_applied !== true || !data.agents?.some(a => a.name === action.agent)
              || !/^2\.1\.\d+$/.test(version ?? "") || Number(version.split(".")[2]) < 304) fail("Claude cannot prove its registered guards or selected agent.");
          models = new Set([action.model, ...data.models?.filter(m => m.value === action.model).map(m => m.resolvedModel).filter(Boolean) ?? []]);
          initialized = true;
          request("discovery", { subtype: "get_context_usage", detail: "summary" });
        } else {
          const agents = data?.agents?.filter(a => a.agentType === action.agent) ?? [];
          if (agents.length !== 1 || !agents[0].path || fs.realpathSync(agents[0].path) !== agentFile) {
            fail("Fresh Claude session did not discover the routed plugin agent from its trusted revision.");
          }
          if (required.skill) {
            const skills = data.skills?.skillFrontmatter?.filter(s => s.name === required.skill) ?? [];
            if (skills.length !== 1 || !path.isAbsolute(skills[0].path ?? "") || !fs.statSync(skills[0].path).isFile()) {
              fail(`Fresh Claude session cannot locate required skill ${required.skill} for ${required.template}.`);
            }
          }
          discovery = true;
        }
        maybeProbe();
        return;
      }
      if (e.session_id !== session || e.parent_tool_use_id || e.agent_id) return;
      if (e.type === "system" && e.subtype === "hook_response") {
        if (!envelope.launched && ["SubagentStart","SubagentStop"].includes(e.hook_event)) unresolvedLeaf = true;
        if (e.outcome !== "success" || e.exit_code !== 0) {
          if (["PreToolUse","SessionStart","SubagentStart","SubagentStop","Stop"].includes(e.hook_event)) fail("Claude session guard failed.");
          return;
        }
        if (e.hook_event === "PreToolUse" && !envelope.launched && e.stderr?.trim() === "agent-smith-bash " + session + " " + digest(probe.reject)) {
          let decision;
          try { decision = JSON.parse(e.stdout).hookSpecificOutput; } catch { /* unrelated hook output */ }
          if (decision?.permissionDecision === "deny" && decision.permissionDecisionReason?.includes("Step publication belongs")) proven.add("denial");
        }
        if (!e.stderr?.startsWith("agent-smith-hook ")) return;
        const record = JSON.parse(e.stderr.slice("agent-smith-hook ".length));
        if (record.session !== session || record.event !== e.hook_event) fail("Mismatched Claude lifecycle receipt.");
        switch (record.event) {
          case "SessionStart":
            if (handshake || record.agent !== action.agent || record.id !== undefined || record.root !== pluginRoot || record.revision !== revision) {
              fail("Claude session startup guard does not match the trusted plugin and agent.");
            }
            handshake = true;
            maybeProbe();
            break;
          case "SubagentStart":
            if (!envelope.launched || !calls.size || record.agent !== "agent-smith:step" || typeof record.id !== "string"
                || !record.id || active.has(record.id) || stopped.has(record.id) || active.size + stopped.size >= 512) fail("Unmatched native leaf start.");
            active.add(record.id);
            break;
          case "SubagentStop":
            if (!active.delete(record.id) || record.agent !== "agent-smith:step") fail("Unmatched native leaf stop.");
            stopped.add(record.id);
            break;
          case "Stop":
            if (leavesPending()) fail("Claude stopped with unresolved leaf ownership.");
            if (record.agent !== action.agent || record.id !== undefined || record.idle !== true || !/^[a-f\d]{64}$/.test(record.reply)) {
              fail("Claude could not prove an idle enclosing stop.");
            }
            stop = record.reply;
            break;
          default: fail("Unexpected Claude lifecycle receipt.");
        }
      } else if (e.type === "system" && e.subtype === "init") {
        if (!permissionModes.has(e.permissionMode)) fail("Claude did not report a supported effective permission mode.");
        if (!models?.has(e.model) || (e.effort != null && e.effort !== action.effort) || !Array.isArray(e.tools) || e.cwd !== ROOT
            || e.plugin_errors?.length || !e.plugins?.some(p => p.name === "agent-smith" && fs.realpathSync(p.path) === pluginRoot)
            || (scorer ? JSON.stringify([...e.tools].sort()) !== JSON.stringify(scoreTools) : !["Bash","Read","Write"].every(t => e.tools.includes(t)))
            || (required.skill && (!e.skills?.includes(required.skill) || !e.tools.includes("Skill")))) {
          fail("Claude did not expose the required effective tools, skill, or trusted plugin in the execution session.");
        }
        if ((required.step === "implement" || delegatingSkills.has(required.skill)) && !e.tools.some(t => t === "Task" || t === "Agent")) {
          fail(`Claude did not expose the required foreground delegation tool for ${required.skill ?? required.step}.`);
        }
        effortProven ||= e.effort === action.effort;
        initTools = true;
      } else if (e.type === "assistant" && envelope.launched && e.message?.role === "assistant") {
        if (finished) fail("Claude emitted enclosing assistant output after its terminal event.");
        const content = e.message.content;
        if (Array.isArray(content)) finalText = content.filter(c => c.type === "text").map(c => c.text).join("\n");
      } else if (e.type === "result") {
        if (e.user_message_uuid !== (envelope.launched ? work : qualification)) return;
        if (finished || leavesPending()) fail("Claude returned with unresolved leaf ownership.");
        if (!envelope.launched) {
          if (!sentProbe || !handshake || e.subtype !== "success" || e.is_error !== false || !initTools || !effortProven || !stop || digest(e.result) !== stop
              || !(scorer ? ["read","write"] : ["read","write","bash","denial"]).every(k => proven.has(k))) {
            fail("Claude could not demonstrate the required tool permissions and effective guard decisions.");
          }
          removeTree(probe.scratch);
          probe = null;
          validateAction(action, id, chain, "claude", required);
          if (guardRevision(pluginRoot, action.agent) !== revision) fail("Trusted plugin changed during preflight.");
          stop = null;
          clearTimeout(timer);
          envelope.preflight = { agent: action.agent, sessionId: session, skill: required.skill ?? null };
          start = process.hrtime.bigint();
          envelope.launched = true;
          user(work, action.prompt);
        } else {
          const success = e.subtype === "success" && e.is_error === false;
          const failure = terminalErrors.has(e.subtype) && e.is_error === true;
          if (!stop || !(success || failure) || (success && (typeof finalText !== "string" || e.result !== finalText || stop !== digest(finalText)))) {
            fail("Claude terminal output was not verified against the enclosing assistant and stop event.");
          }
          terminal = e;
          finished = true;
          child.stdin.end();
          timer = setTimeout(() => refuse("Claude did not close after its terminal event."), 10000);
        }
      }
    }

    lock.setChild(null, true, session);
    const args = ["-p", "--verbose", "--input-format", "stream-json", "--output-format", "stream-json",
      "--include-hook-events", "--permission-prompts", "none", "--no-session-persistence", "--no-chrome",
      "--plugin-dir", pluginRoot, "--session-id", session, "--agent", action.agent, "--model", action.model, "--effort", action.effort,
      ...(scorer ? ["--tools", scoreTools.join(","), "--strict-mcp-config"] : [])];
    child = spawn("claude", args, { cwd: ROOT, detached: true, stdio: ["pipe","pipe","pipe"], env: { ...process.env,
      AGENT_SMITH_CLAUDE_SESSION: session, AGENT_SMITH_CLAUDE_AGENT: action.agent, AGENT_SMITH_CLAUDE_COMMIT: mayCommit.has(required.step) ? "1" : "0",
      CLAUDE_CODE_DISABLE_BACKGROUND_TASKS: "1", CLAUDE_CODE_FORK_SUBAGENT: "0", CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH: "2" } });
    child.on("spawn", () => {
      launchedCli = true;
      pid = child.pid;
      try {
        lock.setChild(pid, true, session);
        if (cancellation) { terminate(); return; }
        const hooks = Object.fromEntries(["PreToolUse","PostToolUse"].map(name => [name, [{ hookCallbackIds: [name], onFailure: "block" }]]));
        request("initialize", { subtype: "initialize", hooks });
      } catch (cause) { refuse(cause.message); }
    });
    child.on("error", cause => { error ??= `Claude launch failed (${cause.code ?? "unknown"}).`; });
    child.stdin.on("error", () => refuse("Claude input stream failed."));
    child.stderr.resume();
    child.stderr.on("error", () => refuse("Claude error stream failed."));
    child.stdout.on("error", () => refuse("Claude output stream failed."));
    let buffer = Buffer.alloc(0);
    const decoder = new TextDecoder("utf-8", { fatal: true });
    child.stdout.on("data", bytes => {
      if (error) return;
      try {
        buffer = Buffer.concat([buffer, bytes]);
        let end;
        while ((end = buffer.indexOf(10)) >= 0) {
          if (end > limit) fail("Oversized Claude event.");
          const line = decoder.decode(buffer.subarray(0, end));
          buffer = buffer.subarray(end + 1);
          if (line.trim()) receive(JSON.parse(line));
        }
        if (buffer.length > limit) fail("Oversized Claude event.");
      } catch (cause) { refuse(cause.message); }
    });
    timer = setTimeout(() => refuse("Claude guard, skill discovery or permission proof timed out."), 90000);
    const [code, signal] = await new Promise(resolve => child.once("close", (...args) => resolve(args)));
    if (buffer.length) error ??= "Incomplete final Claude stream record.";
    envelope.exitCode = code;
    envelope.signal = signal;
    if (cancellation) fail(`Execution cancelled by ${cancellation}. Native settlement is unverified.`);
    if (!envelope.launched && !unresolvedLeaf && !active.size && !calls.size) {
      lock.clearChild(true);
      fail((error ?? "Claude closed without a verified preflight.") + " " + startupLimit);
    }
    if (error || signal || !finished || !terminal) fail(error ?? "Claude closed without a verified enclosing terminal event.");
    if ((code !== 0 || terminal.is_error || terminal.subtype !== "success") && action.action === "archive") fail("Claude archive did not complete.");
    if (action.action !== "archive") lock.clearChild(true);
    envelope.usage = { durationMs: Number((process.hrtime.bigint() - start) / 1000000n) };
    envelope.usageEvidence = unavailableEvidence("incomplete-capture", { source: "claude-native", hostVersion: version });
    if (code !== 0 || terminal.is_error || terminal.subtype !== "success") fail("Claude exited unsuccessfully after confirmed settlement.");
    const reply = terminal.result;
    const result = readResult(reply, action);
    if (action.action === "archive") lock.clearChild(true);
    envelope.result = { ...result, usage: envelope.usage, usageEvidence: envelope.usageEvidence };
    envelope.completed = true;
    if (action.action === "archive") envelope.reply = reply;
  } catch (cause) {
    envelope.reason = String(cause.message).slice(0, 2048);
    if (!launchedCli && !child && lock?.retainedReason()) lock.clearChild(true);
  } finally {
    clearTimeout(timer);
    clearTimeout(killTimer);
    if (probe && !lock?.retainedReason()) {
      try { removeTree(probe.scratch); } catch { envelope.reason = "Claude preflight cleanup failed."; }
    }
    if (lock?.retainedReason()) {
      envelope.completed = false;
      envelope.result = null;
      envelope.reason = (lock.retainedReason() + " " + (envelope.reason ?? "")).slice(0, 2048);
    }
    lock?.release();
    process.removeListener("SIGINT", onInt);
    process.removeListener("SIGTERM", onTerm);
  }
  return envelope;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [id, ...rest] = process.argv.slice(2);
    const flags = parseFlags(rest, ["chain"]);
    if (flags._.length || Object.keys(flags).some(k => !["_","chain"].includes(k))) fail("Usage: run-claude.mjs <id> [--chain 10x|openspec]");
    const chunks = [];
    let size = 0;
    for await (const chunk of process.stdin) {
      size += chunk.length;
      if (size > limit) fail("Router action is oversized.");
      chunks.push(chunk);
    }
    const result = await runClaude(id, flags.chain ?? "10x", JSON.parse(Buffer.concat(chunks)));
    process.stdout.write(JSON.stringify(result) + "\n");
    process.exitCode = result.completed ? 0 : 1;
  } catch (cause) {
    process.stdout.write(JSON.stringify({ action: "claude-result", launched: false, completed: false, result: null, reason: cause.message.slice(0,2048) }) + "\n");
    process.exitCode = 1;
  }
}
