// Optional native 2.1.311 capture adapter. It reads existing sources; it never configures capture or writes run state.
// Default telemetry can lack process provenance; only a matched process prefix plus native UUID/request closure qualifies.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { fileURLToPath } from "node:url";
import { cleanInvocation, cleanUsage, normalizeAccounting, readBoundedLines, unavailableEvidence, USAGE_LIMITS } from "./usage.mjs";

export const CLAUDE_USAGE_VERSION = "2.1.311";
export const CLAUDE_USAGE_LIMITS = { descriptorBytes: USAGE_LIMITS.fileBytes, recordBytes: 1024 * 1024,
  bytes: 32 * 1024 * 1024, agents: USAGE_LIMITS.sessions, requests: USAGE_LIMITS.requests,
  events: 200000, readMs: USAGE_LIMITS.readMs };
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const identifier = value => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
const integer = value => Number.isSafeInteger(value) && value >= 0;
const hash = value => createHash("sha256").update(value).digest("hex");
const fail = reason => { throw Object.assign(new Error(), { reason, accounting: true }); };
const buckets = ["input_tokens", "output_tokens", "cache_read_tokens", "cache_creation_tokens"];
const transcriptBuckets = ["input_tokens", "output_tokens", "cache_read_input_tokens", "cache_creation_input_tokens"];

function counters(raw, keys = buckets) {
  if (!object(raw)) fail("unsupported-schema");
  const values = keys.map(key => raw[key]);
  if (values.some(value => !integer(value))) fail("unsupported-schema");
  const total = values.reduce((sum, value) => sum + value, 0);
  if (!Number.isSafeInteger(total)) fail("resource-limit");
  return { values, total };
}

function attributes(raw) {
  if (!Array.isArray(raw)) fail("unsupported-schema");
  const values = new Map();
  for (const item of raw) {
    if (!object(item) || typeof item.key !== "string" || !object(item.value)) fail("unsupported-schema");
    if (values.has(item.key) && !isDeepStrictEqual(values.get(item.key), item.value)) fail("conflicting-duplicate");
    values.set(item.key, item.value);
  }
  return values;
}

function scalar(attrs, key) {
  const value = attrs.get(key);
  if (value === undefined) return undefined;
  if (Object.hasOwn(value, "stringValue")) return value.stringValue;
  if (Object.hasOwn(value, "intValue")) {
    const raw = value.intValue;
    if (typeof raw !== "string" || !/^\d+$/.test(raw) || !integer(Number(raw))) fail("unsupported-schema");
    return Number(raw);
  }
  if (Object.hasOwn(value, "doubleValue")) return value.doubleValue;
  if (Object.hasOwn(value, "boolValue")) return value.boolValue;
  fail("unsupported-schema");
}

function numeric(attrs, key) {
  const value = scalar(attrs, key);
  const number = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
  if (!integer(number)) fail("unsupported-schema");
  return number;
}

function textContent(message) {
  if (typeof message?.content === "string") return message.content;
  if (!Array.isArray(message?.content)) fail("unsupported-schema");
  return message.content.filter(item => item?.type === "text").map(item => item.text).join("");
}

function routerDescription(router) {
  if (!object(router) || !/^[a-z0-9][a-z0-9-]*$/.test(router.change ?? "")
      || !["10x", "openspec"].includes(router.chain) || !/^[a-z0-9][a-z0-9-]*$/.test(router.step ?? "")) fail("missing-identity");
  if (["archive", "os-archive"].includes(router.step)) {
    if (router.n != null) fail("missing-identity");
    return `agent-smith ${router.change} archive`;
  }
  if (!Number.isSafeInteger(router.n) || router.n < 1) fail("missing-identity");
  return `agent-smith ${router.change} step ${router.n} ${router.step}`;
}

export function collectClaudeUsage(descriptor = {}) {
  if (!object(descriptor)) descriptor = {};
  const invocation = cleanInvocation(descriptor.invocation);
  const hostVersion = descriptor.hostVersion;
  const independent = cleanUsage(descriptor.usage) ?? {};
  delete independent.totalTokens;
  const unavailable = reason => normalizeAccounting(independent,
    unavailableEvidence(reason, { source: "claude-native", hostVersion, invocation }));
  try {
    if (!invocation || invocation.host !== "claude") fail("missing-identity");
    if (hostVersion !== CLAUDE_USAGE_VERSION) fail("unsupported-host");
    const description = routerDescription(descriptor.router);
    const sources = descriptor.sources;
    if (!object(sources) || ![sources.root, sources.nativeFile, sources.telemetryFile].every(value => typeof value === "string" && path.isAbsolute(value))) fail("missing-source");
    const hostProcess = descriptor.process;
    if (!object(hostProcess) || !Number.isSafeInteger(hostProcess.pid) || hostProcess.pid < 1
        || typeof hostProcess.createdAt !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(hostProcess.createdAt)
        || !Number.isFinite(Date.parse(hostProcess.createdAt))) fail("missing-identity");
    const deadline = Date.now() + CLAUDE_USAGE_LIMITS.readMs;
    let remaining = CLAUDE_USAGE_LIMITS.bytes;
    const read = (file, visit) => {
      if (!fs.existsSync(file)) fail("missing-source");
      remaining -= readBoundedLines(file, { root: sources.root, maxBytes: remaining,
        recordBytes: CLAUDE_USAGE_LIMITS.recordBytes, deadline }, line => {
        let record;
        try { record = JSON.parse(line); } catch { fail("unsupported-schema"); }
        if (!object(record)) fail("unsupported-schema");
        visit(record);
      });
    };
    const launches = new Map();
    const stops = new Map();
    read(sources.nativeFile, record => {
      if (!["PreToolUse", "PostToolUse", "SubagentStop"].includes(record.hook_event_name)) return;
      if (record.session_id !== invocation.sessionId) return;
      if (record.hook_event_name === "SubagentStop") {
        if (!identifier(record.agent_id)) fail("missing-identity");
        const stop = { file: record.agent_transcript_path, textHash: typeof record.last_assistant_message === "string" ? hash(record.last_assistant_message) : null };
        if (stops.has(record.agent_id) && !isDeepStrictEqual(stops.get(record.agent_id), stop)) fail("ambiguous-history");
        stops.set(record.agent_id, stop);
        if (stops.size > CLAUDE_USAGE_LIMITS.agents * 4) fail("resource-limit");
        return;
      }
      if (record.tool_name !== "Agent") return;
      if (!identifier(record.tool_use_id)) fail("missing-identity");
      const launch = launches.get(record.tool_use_id) ?? {};
      const key = record.hook_event_name === "PreToolUse" ? "pre" : "post";
      if (record.agent_id != null && !identifier(record.agent_id)) fail("missing-identity");
      if (key === "post" && (!identifier(record.tool_response?.agentId)
          || (record.tool_response.totalTokens !== undefined && !integer(record.tool_response.totalTokens)))) fail("unsupported-schema");
      const value = key === "pre" ? { parent: record.agent_id ?? null,
        descriptionHash: typeof record.tool_input?.description === "string" ? hash(record.tool_input.description) : null,
        promptHash: typeof record.tool_input?.prompt === "string" ? hash(record.tool_input.prompt) : null, resumed: record.tool_input?.resume != null }
        : { parent: record.agent_id ?? null, response: { agentId: record.tool_response?.agentId,
          status: record.tool_response?.status === "completed" ? "completed" : "other", totalTokens: record.tool_response?.totalTokens } };
      if (launch[key] && !isDeepStrictEqual(launch[key], value)) fail("ambiguous-history");
      launch[key] = value;
      launches.set(record.tool_use_id, launch);
      if (launches.size > CLAUDE_USAGE_LIMITS.agents * 4) fail("resource-limit");
    });
    const root = launches.get(invocation.runId);
    if (!root?.pre || !root.post || root.post.response?.agentId !== invocation.agentId
        || root.pre.descriptionHash !== hash(description)) fail("missing-identity");
    const agents = new Map();
    const addAgent = (runId, launch) => {
      const { pre, post } = launch;
      if (!pre || !post || pre.parent !== post.parent
          || post.response?.status !== "completed" || !identifier(post.response.agentId)) fail("incomplete-capture");
      if (pre.resumed || !pre.promptHash) fail("ambiguous-history");
      const id = post.response.agentId;
      if (agents.has(id)) fail("ambiguous-history");
      const stop = stops.get(id);
      if (!stop?.textHash || typeof stop.file !== "string" || !path.isAbsolute(stop.file)) fail("incomplete-capture");
      agents.set(id, { id, runId, parent: pre.parent, promptHash: pre.promptHash, stop, response: post.response });
      if (agents.size > CLAUDE_USAGE_LIMITS.agents) fail("resource-limit");
    };
    addAgent(invocation.runId, root);
    for (const agent of agents.values()) {
      for (const [runId, launch] of launches) {
        if (launch.pre?.parent === agent.id || launch.post?.parent === agent.id) addAgent(runId, launch);
      }
    }
    for (const [runId, launch] of launches) {
      const recorded = agents.get(launch.post?.response?.agentId);
      if (recorded && recorded.runId !== runId) fail("ambiguous-history");
    }
    const events = new Map();
    read(sources.telemetryFile, batch => {
      if (!Array.isArray(batch.resourceLogs)) fail("unsupported-schema");
      for (const resource of batch.resourceLogs) {
        const resourceAttrs = attributes(resource.resource?.attributes);
        if (scalar(resourceAttrs, "process.pid") === undefined || scalar(resourceAttrs, "process.creation.time") === undefined) fail("missing-identity");
        if (numeric(resourceAttrs, "process.pid") !== hostProcess.pid || scalar(resourceAttrs, "process.creation.time") !== hostProcess.createdAt) fail("ambiguous-history");
        if (!Array.isArray(resource.scopeLogs)) fail("unsupported-schema");
        for (const scope of resource.scopeLogs) {
          if (!Array.isArray(scope.logRecords)) fail("unsupported-schema");
          for (const record of scope.logRecords) {
            const attrs = attributes(record.attributes);
            const sequence = numeric(attrs, "event.sequence");
            if (sequence >= CLAUDE_USAGE_LIMITS.events) fail("resource-limit");
            if (scalar(attrs, "session.id") !== invocation.sessionId) fail("ambiguous-history");
            const appVersion = scalar(attrs, "app.version");
            if (appVersion !== undefined && appVersion !== hostVersion) fail("unsupported-host");
            const name = record.body?.stringValue;
            if (typeof name !== "string" || !/^claude_code\.[a-z_]{1,64}$/.test(name)) fail("unsupported-schema");
            const id = scalar(attrs, "agent_id");
            const parent = scalar(attrs, "parent_agent_id") ?? null;
            if ((id !== undefined && !identifier(id)) || (parent !== null && !identifier(parent))) fail("missing-identity");
            const value = { name, sequence, id, parent };
            if (["claude_code.api_request", "claude_code.assistant_response"].includes(name)) {
              value.requestId = scalar(attrs, "request_id");
              if (!identifier(value.requestId)) fail("missing-identity");
              if (name === "claude_code.api_request") value.counts = counters(Object.fromEntries(buckets.map(key => [key, numeric(attrs, key)])));
              else {
                value.uuid = scalar(attrs, "message.uuid");
                if (!identifier(value.uuid)) fail("missing-identity");
              }
            } else if (name === "claude_code.subagent_completed") value.total = numeric(attrs, "total_tokens");
            else if (name === "claude_code.tool_result") {
              value.runId = scalar(attrs, "tool_use_id");
              if (!identifier(value.runId)) fail("missing-identity");
              value.isAgent = scalar(attrs, "tool_name") === "Agent";
              value.success = [true, "true"].includes(scalar(attrs, "success"));
            }
            value.signature = hash(JSON.stringify(value));
            if (events.has(sequence) && events.get(sequence).signature !== value.signature) fail("conflicting-duplicate");
            events.set(sequence, value);
          }
        }
      }
    });
    const terminal = new Map();
    const toolResults = new Map();
    const requests = new Map();
    const responses = new Map();
    let terminalSequence;
    for (const [sequence, event] of [...events].sort(([a], [b]) => a - b)) {
      const { name, id, parent } = event;
      if (!agents.has(id)) {
        if (agents.has(parent)) fail("incomplete-capture");
        if (name === "claude_code.tool_result") {
          if (event.runId === invocation.runId && (id ?? null) === root.pre.parent && event.isAgent && event.success) {
            if (terminalSequence !== undefined) fail("ambiguous-history");
            terminalSequence = sequence;
          }
        }
        continue;
      }
      const agent = agents.get(id);
      if (parent !== agent.parent) fail("missing-identity");
      if (name === "claude_code.subagent_completed") {
        if (terminal.has(id)) fail("ambiguous-history");
        terminal.set(id, { sequence, total: event.total });
      } else if (name === "claude_code.api_request") {
        const requestId = event.requestId;
        const value = { agent: id, counts: event.counts, sequence };
        if (requests.has(requestId) && !isDeepStrictEqual(requests.get(requestId).counts, value.counts)) fail("conflicting-duplicate");
        if (requests.has(requestId) && requests.get(requestId).agent !== id) fail("missing-identity");
        requests.set(requestId, requests.get(requestId) ?? value);
        if (requests.size > CLAUDE_USAGE_LIMITS.requests) fail("resource-limit");
      } else if (name === "claude_code.assistant_response") {
        const { requestId, uuid } = event;
        const value = { agent: id, uuid, sequence };
        if (responses.has(requestId) && (responses.get(requestId).agent !== id || responses.get(requestId).uuid !== uuid)) fail("conflicting-duplicate");
        responses.set(requestId, responses.get(requestId) ?? value);
      } else if (name === "claude_code.tool_result") {
        const runId = event.runId;
        if (event.isAgent && event.success) {
          if (toolResults.has(runId)) fail("ambiguous-history");
          toolResults.set(runId, { agent: id, sequence });
        }
      }
    }
    if (terminalSequence === undefined) fail("incomplete-capture");
    // event.sequence restarts across processes, so its prefix only corroborates the independently matched process.
    for (let sequence = 0; sequence <= terminalSequence; sequence++) if (!events.has(sequence)) fail("incomplete-capture");
    if (responses.size !== requests.size || [...responses.keys()].some(requestId => !requests.has(requestId))) fail("snapshot-mismatch");
    let totalTokens = 0;
    let requestCount = 0;
    const transcriptFiles = new Set();
    for (const agent of agents.values()) {
      const ended = terminal.get(agent.id);
      const returned = agent.id === invocation.agentId ? { sequence: terminalSequence } : toolResults.get(agent.runId);
      if (!ended || !returned || ended.sequence >= returned.sequence || returned.sequence > terminalSequence) fail("incomplete-capture");
      if (agent.parent !== null && agent.id !== invocation.agentId && returned.agent !== agent.parent) fail("missing-identity");
      if (agent.id !== invocation.agentId && returned.sequence >= (terminal.get(agent.parent)?.sequence ?? -1)) fail("incomplete-capture");
      if (transcriptFiles.has(agent.stop.file)) fail("missing-identity");
      transcriptFiles.add(agent.stop.file);
      const native = new Map();
      const messages = new Map();
      const entries = new Map();
      let previous = null;
      let last;
      read(agent.stop.file, record => {
        if (!["user", "assistant"].includes(record.type)) return;
        if (record.sessionId !== invocation.sessionId || record.agentId !== agent.id || record.version !== hostVersion
            || !identifier(record.uuid) || (record.parentUuid !== null && !identifier(record.parentUuid))) fail("missing-identity");
        const entry = { type: record.type, parent: record.parentUuid, request: record.requestId, message: record.message?.id };
        if (record.type === "assistant") {
          if (!identifier(entry.request) || !identifier(entry.message)) fail("missing-identity");
          entry.counts = counters(record.message.usage, transcriptBuckets);
          entry.textHash = hash(textContent(record.message));
        }
        const prior = entries.get(record.uuid);
        if (prior) {
          if (isDeepStrictEqual(prior, entry)) return;
          if (prior.type !== entry.type || prior.parent !== entry.parent || prior.request !== entry.request || prior.message !== entry.message) fail("conflicting-duplicate");
          if (!isDeepStrictEqual(prior, entry) && (record.uuid !== previous || !entry.counts
              || entry.counts.values.some((value, index) => value < prior.counts.values[index]))) fail("conflicting-duplicate");
        } else {
          if (record.parentUuid !== previous) fail("ambiguous-history");
          if (previous === null && (record.type !== "user" || hash(textContent(record.message)) !== agent.promptHash)) fail("ambiguous-history");
          previous = record.uuid;
        }
        entries.set(record.uuid, entry);
        if (record.uuid === previous) last = { ...entry, uuid: record.uuid };
        if (record.type !== "assistant") return;
        if (messages.has(entry.message) && messages.get(entry.message) !== entry.request) fail("conflicting-duplicate");
        messages.set(entry.message, entry.request);
        const old = native.get(entry.request);
        if (old && (old.message !== entry.message || entry.counts.values.some((value, index) => value < old.counts.values[index]))) fail("conflicting-duplicate");
        native.set(entry.request, { message: entry.message, counts: entry.counts, uuid: record.uuid });
        if (native.size > CLAUDE_USAGE_LIMITS.requests) fail("resource-limit");
      });
      if (last?.type !== "assistant" || last.textHash !== agent.stop.textHash || !native.size) fail("incomplete-capture");
      const exported = [...requests].filter(([, request]) => request.agent === agent.id);
      if (exported.length !== native.size) fail("snapshot-mismatch");
      let finalSequence = -1;
      let finalRequest;
      for (const [requestId, observed] of exported) {
        const record = native.get(requestId);
        const response = responses.get(requestId);
        if (!record || !response || response.agent !== agent.id || response.uuid !== record.uuid
            || !isDeepStrictEqual(record.counts, observed.counts)) fail("snapshot-mismatch");
        if (observed.sequence >= ended.sequence || response.sequence >= ended.sequence) fail("ambiguous-history");
        if (response.sequence > finalSequence) { finalSequence = response.sequence; finalRequest = { record, observed }; }
        totalTokens += observed.counts.total;
        if (!Number.isSafeInteger(totalTokens)) fail("resource-limit");
        requestCount++;
      }
      if (finalRequest?.record.uuid !== last.uuid || ended.total !== finalRequest.observed.counts.total
          || (agent.response.totalTokens !== undefined && agent.response.totalTokens !== ended.total)) fail("snapshot-mismatch");
    }
    return normalizeAccounting({ ...independent, totalTokens }, { schemaVersion: 1, status: "verified", scope: "step-tree",
      source: "claude-native", hostVersion, invocation, sessionCount: agents.size, requestCount, reconciliation: "request-records" });
  } catch (error) {
    return unavailable(error.reason ?? "unsupported-schema");
  }
}

async function main() {
  let input = "";
  process.stdin.setEncoding("utf8");
  const timer = setTimeout(() => process.stdin.destroy(Object.assign(new Error(), { reason: "resource-limit" })), CLAUDE_USAGE_LIMITS.readMs);
  try {
    for await (const chunk of process.stdin) {
      input += chunk;
      if (Buffer.byteLength(input) > CLAUDE_USAGE_LIMITS.descriptorBytes) fail("resource-limit");
    }
    clearTimeout(timer);
    process.stdout.write(JSON.stringify(collectClaudeUsage(JSON.parse(input))) + "\n");
  } catch (error) {
    process.stdout.write(JSON.stringify({ usageEvidence: unavailableEvidence(error.reason ?? "unsupported-schema", { source: "claude-native" }) }) + "\n");
  } finally {
    clearTimeout(timer);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
