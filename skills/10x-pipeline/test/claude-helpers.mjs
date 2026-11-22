// Hand-authored documented 2.1.311 capture shapes, not retained telemetry or live-host qualification.
import fs from "node:fs";
import path from "node:path";
import { CAPTURE_ENV, captureFile, projectNative, projectTelemetry } from "../scripts/claude-capture-data.mjs";
import { makeProject } from "./helpers.mjs";

export const claudeBuckets = ["input_tokens", "output_tokens", "cache_read_tokens", "cache_creation_tokens"];
export const otelAttribute = (key, value) => ({ key, value: typeof value === "number" ? { intValue: value } : { stringValue: value } });
export const eventValue = (event, key) => event.attributes.find(item => item.key === key)?.value;
export const setEvent = (event, key, value) => {
  const item = otelAttribute(key, value);
  const index = event.attributes.findIndex(attribute => attribute.key === key);
  if (index < 0) event.attributes.push(item);
  else event.attributes[index] = item;
};

export function claudeUsageFixture({ project = makeProject(), chain = "10x", n = 1,
  step = chain === "openspec" ? "os-propose" : "plan", children = true } = {}) {
  const root = path.join(project.root, "claude-capture");
  fs.mkdirSync(root);
  const descriptor = { router: { change: project.id, chain, n, step }, hostVersion: "2.1.311",
    invocation: { host: "claude", sessionId: "native-session", agentId: "step-agent", runId: "tool-root" },
    process: { pid: 4242, createdAt: "2026-11-18T00:00:00.000Z" }, usage: { toolUses: 4, durationMs: 50 },
    sources: { root, nativeFile: path.join(root, "hooks.jsonl"), telemetryFile: path.join(root, "otel.jsonl") } };
  const native = [];
  const transcripts = new Map();
  const events = [];
  const event = (name, attrs = {}) => {
    const record = { body: { stringValue: `claude_code.${name}` }, attributes: Object.entries({
      "session.id": "native-session", "event.sequence": events.length, ...attrs,
    }).map(([key, value]) => otelAttribute(key, value)) };
    events.push(record);
    return record;
  };
  const agents = new Map();
  const add = (id, parent, runId, prompt, usages) => {
    const file = path.join(root, `${id}.jsonl`);
    const records = [{ type: "user", uuid: `${id}-user`, parentUuid: null,
      message: { role: "user", content: prompt } }];
    usages.forEach((values, index) => {
      if (index) records.push({ type: "user", uuid: `${id}-tool-${index}`, parentUuid: records.at(-1).uuid,
        message: { role: "user", content: [{ type: "tool_result", tool_use_id: `${id}-local-tool` }] } });
      records.push({ type: "assistant", uuid: `${id}-answer-${index}`, parentUuid: records.at(-1).uuid,
        requestId: `${id}-request-${index}`, message: { id: `${id}-message-${index}`, role: "assistant",
          content: index === usages.length - 1 ? [{ type: "text", text: `${id} finished` }]
            : [{ type: "tool_use", id: `${id}-local-tool`, name: "Bash", input: {} }],
          usage: Object.fromEntries(["input_tokens", "output_tokens", "cache_read_input_tokens", "cache_creation_input_tokens"].map((key, i) => [key, values[i]])) } });
    });
    records[1].parentUuid = `${id}-attachment`;
    records.push({ type: "attachment", uuid: `${id}-attachment`, parentUuid: records[0].uuid,
      attachment: { type: "directory", content: "private-prompt ignored attachment" } });
    for (const record of records) Object.assign(record, { sessionId: "native-session", agentId: id, version: "2.1.311", isSidechain: true });
    transcripts.set(file, records);
    const parentField = parent ? { agent_id: parent } : {};
    const description = id === "step-agent" ? (n == null ? `agent-smith ${project.id} archive` : `agent-smith ${project.id} step ${n} ${step}`) : "bounded child";
    native.push({ hook_event_name: "PreToolUse", session_id: "native-session", tool_name: "Agent", tool_use_id: runId,
      ...parentField, tool_input: { description, prompt } },
    { hook_event_name: "SubagentStop", session_id: "native-session", agent_id: id, agent_type: "agent-smith:step",
      agent_transcript_path: file, last_assistant_message: `${id} finished` },
    { hook_event_name: "PostToolUse", session_id: "native-session", tool_name: "Agent", tool_use_id: runId,
      ...parentField, tool_response: { status: "completed", agentId: id, totalTokens: usages.at(-1).reduce((a, b) => a + b, 0) } });
    agents.set(id, { id, parent, runId, usages, records });
  };
  add("step-agent", null, "tool-root", "private-prompt-root", [[10, 2, 30, 5], [20, 3, 40, 7]]);
  if (children) add("leaf-agent", "step-agent", "tool-leaf", "private-prompt-child", [[4, 1, 8, 2], [5, 2, 9, 3]]);
  const request = (agent, index) => {
    const id = `${agent.id}-request-${index}`;
    const attribution = { agent_id: agent.id, ...(agent.parent ? { parent_agent_id: agent.parent } : {}) };
    event("api_request", { ...attribution, request_id: id,
      ...Object.fromEntries(claudeBuckets.map((key, i) => [key, agent.usages[index][i]])) });
    if (index === agent.usages.length - 1) event("assistant_response", { ...attribution, request_id: id, "message.uuid": `${agent.id}-answer-${index}` });
  };
  event("api_request", { request_id: "orchestrator-request", input_tokens: 900, output_tokens: 90, cache_read_tokens: 0, cache_creation_tokens: 0 });
  event("assistant_response", { request_id: "orchestrator-request", "message.uuid": "orchestrator-answer" });
  request(agents.get("step-agent"), 0);
  if (children) {
    const child = agents.get("leaf-agent");
    request(child, 0);
    request(child, 1);
    event("subagent_completed", { agent_id: child.id, parent_agent_id: child.parent, total_tokens: 19 });
    event("tool_result", { agent_id: child.parent, tool_use_id: child.runId, tool_name: "Agent", success: "true" });
  }
  request(agents.get("step-agent"), 1);
  event("subagent_completed", { agent_id: "step-agent", total_tokens: 70 });
  event("tool_result", { tool_use_id: "tool-root", tool_name: "Agent", success: "true" });
  const resource = { attributes: [otelAttribute("process.pid", 4242), otelAttribute("process.creation.time", descriptor.process.createdAt)] };
  const write = () => {
    fs.writeFileSync(descriptor.sources.nativeFile, native.map(record => JSON.stringify(record)).join("\n") + "\n");
    fs.writeFileSync(descriptor.sources.telemetryFile, JSON.stringify({ resourceLogs: [{ resource, scopeLogs: [{ logRecords: events }] }] }) + "\n");
    for (const [file, records] of transcripts) fs.writeFileSync(file, records.map(record => JSON.stringify(record)).join("\n") + "\n");
  };
  write();
  return { project, descriptor, native, transcripts, events, resource, write };
}

export function boundClaudeFixture(options) {
  const fixture = claudeUsageFixture(options);
  const root = path.join(fixture.project.root, "bound-capture");
  fs.mkdirSync(root, { mode: 0o700 });
  const binding = { sessionId: "3ae13fa9-8a1b-4607-902c-5777a81ff2be", process: {
    pid: 4242, createdAt: new Date().toISOString(),
  }, hostVersion: "2.1.311", endpoint: "http://127.0.0.1:1234/" + "1".repeat(48) + "/v1/logs",
  transcriptRoot: path.join(fixture.project.root, "claude-projects") };
  fs.writeFileSync(captureFile(root, "binding"), JSON.stringify(binding), { mode: 0o600 });
  fs.writeFileSync(captureFile(root, "native"), "", { mode: 0o600 });
  fs.writeFileSync(captureFile(root, "telemetry"), "", { mode: 0o600 });
  const boundTranscripts = new Map();
  for (const record of fixture.native) {
    record.session_id = binding.sessionId;
    if (record.hook_event_name !== "SubagentStop") continue;
    const directory = path.join(binding.transcriptRoot, "-fixture-project", binding.sessionId, "subagents");
    fs.mkdirSync(directory, { recursive: true });
    const transcript = fixture.transcripts.get(record.agent_transcript_path);
    record.agent_transcript_path = path.join(directory, `agent-${record.agent_id}.jsonl`);
    for (const line of transcript) line.sessionId = binding.sessionId;
    boundTranscripts.set(record.agent_transcript_path, transcript);
  }
  fixture.resource.attributes[1] = otelAttribute("process.creation.time", binding.process.createdAt);
  for (const event of fixture.events) setEvent(event, "session.id", binding.sessionId);
  const write = () => {
    const projected = fixture.native.map(record => projectNative(record, binding.sessionId));
    fs.writeFileSync(captureFile(root, "native"), projected.map(record => JSON.stringify(record)).join("\n") + "\n");
    const batch = { resourceLogs: [{ resource: fixture.resource, scopeLogs: [{ logRecords: fixture.events }] }] };
    fs.writeFileSync(captureFile(root, "telemetry"), JSON.stringify(projectTelemetry(batch, binding)) + "\n");
    for (const [file, records] of boundTranscripts) fs.writeFileSync(file, records.map(record => JSON.stringify(record)).join("\n") + "\n");
  };
  return { ...fixture, root, binding, transcripts: boundTranscripts, write, env: { [CAPTURE_ENV]: root },
    descriptor: { router: fixture.descriptor.router, usage: fixture.descriptor.usage } };
}
