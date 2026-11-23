// Read launcher-bound or independently authorized native evidence without writing run state.
import fs from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { fileURLToPath } from "node:url";
import { cleanInvocation, cleanUsage, normalizeAccounting, readBoundedLines, unavailableEvidence, USAGE_LIMITS } from "./usage.mjs";
import { CAPTURE_ENV, CAPTURE_LIMITS, assertCaptureAvailable, attributes, captureFile, captureStat, claudeCaptureSupported,
  fail, hash, identifier, integer, numeric, object, projectNative, readCaptureBinding, scalar, tokenBuckets, validProcess } from "./claude-capture-data.mjs";

export const CLAUDE_USAGE_LIMITS = { descriptorBytes: USAGE_LIMITS.fileBytes, recordBytes: CAPTURE_LIMITS.recordBytes,
  bytes: 32 * 1024 * 1024, agents: USAGE_LIMITS.sessions, requests: USAGE_LIMITS.requests,
  events: CAPTURE_LIMITS.events, readMs: USAGE_LIMITS.readMs };
const transcriptBuckets = ["input_tokens", "output_tokens", "cache_read_input_tokens", "cache_creation_input_tokens"];

function counters(raw, keys = tokenBuckets) {
  if (!object(raw)) fail("unsupported-schema");
  const values = keys.map(key => raw[key]);
  if (values.some(value => !integer(value))) fail("unsupported-schema");
  const total = values.reduce((sum, value) => sum + value, 0);
  if (!Number.isSafeInteger(total)) fail("resource-limit");
  return { values, total };
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

export function claudeCaptureCheckpoint(env = process.env) {
  try {
    if (!env[CAPTURE_ENV] || env.AGENT_SMITH_CLAUDE_SESSION) return null;
    const root = env[CAPTURE_ENV];
    const { sessionId } = readCaptureBinding(root);
    return { sessionId, offset: captureStat(root, "native").size };
  } catch {
    return null;
  }
}

const digestOrNull = value => value === null || (typeof value === "string" && /^[0-9a-f]{64}$/.test(value));

function validateProjectedNative(record, sessionId) {
  if (record.sessionId !== sessionId) fail("missing-identity");
  if (record.event === "SubagentStop") {
    if (!identifier(record.agentId) || !digestOrNull(record.textHash)) fail("unsupported-schema");
  } else {
    if (!identifier(record.runId) || (record.parent !== null && !identifier(record.parent))) fail("missing-identity");
    if (record.event === "PreToolUse") {
      if (!digestOrNull(record.descriptionHash) || !digestOrNull(record.promptHash) || typeof record.resumed !== "boolean") fail("unsupported-schema");
    } else if (record.event !== "PostToolUse" || !identifier(record.response?.agentId)
        || !["completed", "other"].includes(record.response.status)
        || (record.response.totalTokens !== undefined && !integer(record.response.totalTokens))) fail("unsupported-schema");
  }
  return record;
}

function scopedTranscript(root, file, sessionId, agentId) {
  const parts = path.relative(root, file).split(path.sep);
  if (fs.realpathSync(root) !== root || parts.length !== 4 || !parts[0] || parts[0] === ".."
      || parts[1] !== sessionId || parts[2] !== "subagents" || parts[3] !== `agent-${agentId}.jsonl`) fail("unsafe-path");
  return root;
}

export function collectClaudeUsage(descriptor = {}, env = process.env) {
  if (!object(descriptor)) descriptor = {};
  let invocation = cleanInvocation(descriptor.invocation);
  let hostVersion = descriptor.hostVersion;
  const independent = cleanUsage(descriptor.usage) ?? {};
  delete independent.totalTokens;
  const unavailable = reason => normalizeAccounting(independent,
    unavailableEvidence(reason, { source: "claude-native", hostVersion, invocation }));
  try {
    let sources = descriptor.sources;
    let hostProcess = descriptor.process;
    let binding, checkpoint;
    const observed = descriptor.invocation ?? {};
    if (sources === undefined) {
      const root = env[CAPTURE_ENV];
      if (!root || env.AGENT_SMITH_CLAUDE_SESSION) fail("capture-disabled");
      invocation = null;
      binding = readCaptureBinding(root);
      hostVersion = binding.hostVersion;
      if (descriptor.hostVersion !== undefined && descriptor.hostVersion !== hostVersion) fail("unsupported-host");
      if (!object(observed) || (observed.host !== undefined && observed.host !== "claude")
          || (observed.sessionId !== undefined && observed.sessionId !== binding.sessionId)
          || [observed.runId, observed.agentId].some(value => value !== undefined && !identifier(value))) fail("missing-identity");
      checkpoint = descriptor.checkpoint;
      if (checkpoint != null && (!object(checkpoint) || checkpoint.sessionId !== binding.sessionId
          || !integer(checkpoint.offset) || checkpoint.offset > CAPTURE_LIMITS.nativeBytes)) fail("missing-identity");
      if (observed.runId === undefined && !checkpoint) fail("missing-identity");
      captureStat(root, "native");
      sources = { root, nativeFile: captureFile(root, "native"), telemetryFile: captureFile(root, "telemetry") };
      hostProcess = binding.process;
    } else {
      if (!invocation || invocation.host !== "claude") fail("missing-identity");
      if (!claudeCaptureSupported(hostVersion)) fail("unsupported-host");
      if (!object(sources) || ![sources.root, sources.nativeFile, sources.telemetryFile].every(value => typeof value === "string" && path.isAbsolute(value))) fail("missing-source");
      if (!validProcess(hostProcess)) fail("missing-identity");
    }
    const description = routerDescription(descriptor.router);
    const deadline = Date.now() + CLAUDE_USAGE_LIMITS.readMs;
    let remaining = CLAUDE_USAGE_LIMITS.bytes;
    const read = (file, visit, root = sources.root) => {
      if (!fs.existsSync(file)) fail("missing-source");
      remaining -= readBoundedLines(file, { root, maxBytes: remaining,
        recordBytes: CLAUDE_USAGE_LIMITS.recordBytes, deadline }, line => {
        let record;
        try { record = JSON.parse(line); } catch { fail("unsupported-schema"); }
        if (!object(record)) fail("unsupported-schema");
        visit(record, Buffer.byteLength(line) + 1);
      });
    };
    const launches = new Map();
    const stops = new Map();
    const sessionId = binding?.sessionId ?? invocation.sessionId;
    let position = 0;
    let checkpointBoundary = checkpoint == null;
    read(sources.nativeFile, (raw, bytes) => {
      const offset = position;
      position += bytes;
      if (offset === checkpoint?.offset) checkpointBoundary = true;
      const record = binding ? validateProjectedNative(raw, sessionId) : projectNative(raw, sessionId);
      if (!record) return;
      if (record.event === "SubagentStop") {
        const stop = { file: record.file, textHash: record.textHash };
        if (stops.has(record.agentId) && !isDeepStrictEqual(stops.get(record.agentId), stop)) fail("ambiguous-history");
        stops.set(record.agentId, stop);
        if (stops.size > CLAUDE_USAGE_LIMITS.agents * 4) fail("resource-limit");
        return;
      }
      const launch = launches.get(record.runId) ?? {};
      const key = record.event === "PreToolUse" ? "pre" : "post";
      const value = key === "pre" ? { parent: record.parent, descriptionHash: record.descriptionHash, promptHash: record.promptHash, resumed: record.resumed }
        : { parent: record.parent, response: record.response };
      if (launch[key] && !isDeepStrictEqual(launch[key], value)) fail("ambiguous-history");
      launch[key] = value;
      launch[key + "Offset"] ??= offset;
      launches.set(record.runId, launch);
      if (launches.size > CLAUDE_USAGE_LIMITS.agents * 4) fail("resource-limit");
    });
    let runId = observed.runId;
    if (binding) {
      if (!checkpointBoundary && position !== checkpoint?.offset) fail("missing-identity");
      if (runId === undefined) {
        const candidates = [...launches].filter(([, launch]) => (launch.pre
          ? launch.pre.parent === null && launch.preOffset >= checkpoint.offset
          : launch.post.parent === null && launch.postOffset >= checkpoint.offset));
        if (candidates.length > 1) fail("ambiguous-history");
        if (candidates.length !== 1) fail("missing-identity");
        [[runId]] = candidates;
      }
      const launch = launches.get(runId);
      if (!launch?.pre || !launch.post || launch.pre.parent !== null || launch.post.parent !== null
          || (checkpoint && launch.preOffset < checkpoint.offset)
          || launch.postOffset < launch.preOffset || (observed.agentId !== undefined && observed.agentId !== launch.post.response.agentId)
          || launch.pre.descriptionHash !== hash(description)) fail("missing-identity");
      invocation = cleanInvocation({ host: "claude", sessionId, runId, agentId: launch.post.response.agentId });
    }
    const root = launches.get(invocation.runId);
    if (!root?.pre || !root.post || root.post.response.agentId !== invocation.agentId
        || root.pre.descriptionHash !== hash(description)) fail("missing-identity");
    const agents = new Map();
    const addAgent = (runId, launch) => {
      const { pre, post } = launch;
      // Interactive hosts launch the step in the background: only the invocation's own root may settle from a non-completed status (the projection folds async_launched and others together).
      const rootRun = runId === invocation.runId && pre?.parent === null;
      if (!pre || !post || pre.parent !== post.parent
          || (post.response?.status !== "completed" && !rootRun) || !identifier(post.response.agentId)) fail("incomplete-capture");
      if (pre.resumed || !pre.promptHash) fail("ambiguous-history");
      const id = post.response.agentId;
      if (agents.has(id)) fail("ambiguous-history");
      const stop = stops.get(id);
      if (!stop || typeof stop.file !== "string" || !path.isAbsolute(stop.file)) fail("incomplete-capture");
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
    if (binding) captureStat(sources.root, "telemetry");
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
              if (name === "claude_code.api_request") value.counts = counters(Object.fromEntries(tokenBuckets.map(key => [key, numeric(attrs, key)])));
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
    const rootLaunched = root.post.response.status !== "completed";
    const rootEnded = terminal.get(invocation.agentId);
    if (rootLaunched && !rootEnded) fail("incomplete-capture");
    // A launched root returns before it ends, so its events run on to subagent_completed.
    const bound = rootLaunched ? rootEnded.sequence : terminalSequence;
    // event.sequence restarts across processes, so its prefix only corroborates the independently matched process.
    for (let sequence = 0; sequence <= bound; sequence++) if (!events.has(sequence)) fail("incomplete-capture");
    if ([...responses.keys()].some(requestId => !requests.has(requestId))) fail("snapshot-mismatch");
    let totalTokens = 0;
    let requestCount = 0;
    const transcriptFiles = new Set();
    for (const agent of agents.values()) {
      const ended = terminal.get(agent.id);
      const returned = agent.id === invocation.agentId ? { sequence: terminalSequence } : toolResults.get(agent.runId);
      const launched = rootLaunched && agent.id === invocation.agentId;
      if (!ended || !returned || (launched ? returned.sequence >= ended.sequence
          : ended.sequence >= returned.sequence || returned.sequence > bound)) fail("incomplete-capture");
      if (agent.parent !== null && agent.id !== invocation.agentId && returned.agent !== agent.parent) fail("missing-identity");
      if (agent.id !== invocation.agentId && returned.sequence >= (terminal.get(agent.parent)?.sequence ?? -1)) fail("incomplete-capture");
      if (transcriptFiles.has(agent.stop.file)) fail("missing-identity");
      transcriptFiles.add(agent.stop.file);
      const native = new Map();
      const messages = new Map();
      const entries = new Map();
      const transcriptRoot = binding ? scopedTranscript(binding.transcriptRoot, agent.stop.file, sessionId, agent.id) : sources.root;
      read(agent.stop.file, record => {
        if (!["user", "assistant", "attachment"].includes(record.type)) return;
        if (record.sessionId !== invocation.sessionId || record.agentId !== agent.id || record.version !== hostVersion
            || !identifier(record.uuid) || (record.parentUuid !== null && !identifier(record.parentUuid))) fail("missing-identity");
        const entry = { type: record.type, parent: record.parentUuid, request: record.requestId, message: record.message?.id };
        if (record.type === "user") entry.textHash = hash(textContent(record.message));
        if (record.type === "assistant") {
          if (!identifier(entry.request) || !identifier(entry.message)) fail("missing-identity");
          entry.counts = counters(record.message.usage, transcriptBuckets);
          entry.textHash = hash(textContent(record.message));
        }
        const prior = entries.get(record.uuid);
        if (prior) {
          if (isDeepStrictEqual(prior, entry)) return;
          if (prior.type !== entry.type || prior.parent !== entry.parent || prior.request !== entry.request || prior.message !== entry.message) fail("conflicting-duplicate");
          if (!isDeepStrictEqual(prior, entry) && (!entry.counts
              || entry.counts.values.some((value, index) => value < prior.counts.values[index]))) fail("conflicting-duplicate");
        }
        entries.set(record.uuid, entry);
        if (record.type !== "assistant") return;
        if (messages.has(entry.message) && messages.get(entry.message) !== entry.request) fail("conflicting-duplicate");
        messages.set(entry.message, entry.request);
        const old = native.get(entry.request);
        if (old && (old.message !== entry.message || entry.counts.values.some((value, index) => value < old.counts.values[index]))) fail("conflicting-duplicate");
        native.set(entry.request, { message: entry.message, counts: entry.counts, uuid: record.uuid });
        if (native.size > CLAUDE_USAGE_LIMITS.requests) fail("resource-limit");
      }, transcriptRoot);
      const exported = [...requests].filter(([, request]) => request.agent === agent.id);
      if ([...native.keys()].some(requestId => requests.get(requestId)?.agent !== agent.id)) fail("snapshot-mismatch");
      let finalSequence = -1;
      let finalRequest;
      for (const [requestId, observed] of exported) {
        const record = native.get(requestId);
        const response = responses.get(requestId);
        if (!record) {
          // Side queries reach telemetry without a transcript entry; each needs its own response event and counts only while the run is still open.
          if (!response || response.agent !== agent.id || observed.sequence >= ended.sequence
              || response.sequence >= ended.sequence) fail("ambiguous-history");
        } else {
          if ((response && (response.agent !== agent.id || response.uuid !== record.uuid))
              || !isDeepStrictEqual(record.counts, observed.counts)) fail("snapshot-mismatch");
          if (observed.sequence >= ended.sequence || (response && response.sequence >= ended.sequence)) fail("ambiguous-history");
          if (observed.sequence > finalSequence) { finalSequence = observed.sequence; finalRequest = { record, observed }; }
        }
        totalTokens += observed.counts.total;
        if (!Number.isSafeInteger(totalTokens)) fail("resource-limit");
        requestCount++;
      }
      const last = entries.get(finalRequest?.record.uuid);
      if (last?.type !== "assistant" || last.textHash !== (agent.stop.textHash ?? (rootLaunched && agent.id === invocation.agentId ? hash("") : null)) || !native.size) fail("incomplete-capture");
      // Attachments can be serialized late; membership follows UUID links, never file order.
      const visited = new Set();
      let uuid = finalRequest.record.uuid;
      while (uuid !== null) {
        const entry = entries.get(uuid);
        if (!entry || visited.has(uuid)) fail("ambiguous-history");
        visited.add(uuid);
        if (entry.parent === null && (entry.type !== "user" || entry.textHash !== agent.promptHash)) fail("ambiguous-history");
        uuid = entry.parent;
      }
      // Branches (attachments, side entries) may hang off the chain; an assistant response off it is unaccounted.
      for (const [id, entry] of entries) {
        if (visited.has(id)) continue;
        if (entry.type === "assistant") fail("ambiguous-history");
        const seen = new Set([id]);
        let up = entry.parent;
        while (!visited.has(up)) {
          if (up === null || seen.has(up) || !entries.has(up)) fail("ambiguous-history");
          seen.add(up);
          up = entries.get(up).parent;
        }
      }
      if (ended.total !== finalRequest.observed.counts.total
          || (agent.response.totalTokens !== undefined && agent.response.totalTokens !== ended.total)) fail("snapshot-mismatch");
    }
    if (binding) assertCaptureAvailable(sources.root, binding);
    return normalizeAccounting({ ...independent, totalTokens }, { schemaVersion: 1, status: "verified", scope: "step-tree",
      source: "claude-native", hostVersion, invocation, sessionCount: agents.size, requestCount, reconciliation: "request-records" });
  } catch (error) {
    return unavailable(error.reason ?? (error.code === "ENOENT" ? "missing-source" : "unsupported-schema"));
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

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === "checkpoint") process.stdout.write(JSON.stringify(claudeCaptureCheckpoint()) + "\n");
  else await main();
}
