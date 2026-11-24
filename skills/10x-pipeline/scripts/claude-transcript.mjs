// Fresh Agent calls in the current Claude session: a foreground root, or a background root settled by its finished metadata.
// Retain projections, never raw transcript records.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { claudeCaptureSupported, cleanInvocation, readBoundedFile, readBoundedLines } from "./usage.mjs";
import { CLAUDE_USAGE_LIMITS as limits, counters, fail, hash, identifier, integer, object, textContent, transcriptBuckets } from "./claude-capture-data.mjs";

const pathId = value => identifier(value) && !value.includes(":");
const sameFile = (a, b) => a.dev === b.dev && a.ino === b.ino;
const stable = (a, b) => sameFile(a, b) && a.size === b.size && a.mtimeMs === b.mtimeMs && a.ctimeMs === b.ctimeMs;
const checkTime = deadline => { if (Date.now() > deadline) fail("resource-limit"); };

function scan(directory, budget, visit) {
  if (fs.realpathSync(directory) !== directory) fail("unsafe-path");
  const before = fs.lstatSync(directory);
  if (!before.isDirectory()) fail("unsafe-path");
  const dir = fs.opendirSync(directory);
  try {
    for (;;) {
      checkTime(budget.deadline);
      const entry = dir.readSync();
      if (!entry) break;
      if (--budget.entries < 0) fail("resource-limit");
      visit(entry);
    }
    if (!stable(before, fs.lstatSync(directory)) || fs.realpathSync(directory) !== directory) fail("unsafe-path");
  } finally {
    dir.closeSync();
  }
  return before;
}

function locateSession(env, budget) {
  const sessionId = env.CLAUDE_CODE_SESSION_ID;
  if (!pathId(sessionId) || env.AGENT_SMITH_CLAUDE_SESSION) fail("missing-identity");
  const config = env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude");
  if (!path.isAbsolute(config)) fail("unsafe-path");
  const root = path.join(config, "projects");
  let main;
  scan(root, budget, entry => {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) return;
    const file = path.join(root, entry.name, sessionId + ".jsonl");
    if (entry.isSymbolicLink() && !fs.statSync(path.dirname(file), { throwIfNoEntry: false })?.isDirectory()) return;
    let stat = fs.lstatSync(file, { throwIfNoEntry: false });
    if (!stat) stat = fs.lstatSync(file, { throwIfNoEntry: false });
    if (!stat) return;
    if (entry.isSymbolicLink() || !stat.isFile() || fs.realpathSync(file) !== file) fail("unsafe-path");
    if (main) fail("ambiguous-history");
    main = file;
  });
  if (!main) fail("missing-source");
  return { root, main, sessionId, agents: path.join(path.dirname(main), sessionId, "subagents") };
}

function budgetForSession() {
  return { deadline: Date.now() + limits.readMs, entries: limits.agents * 8, records: limits.events, bytes: limits.bytes };
}

export function claudeTranscriptReadiness(env = process.env) {
  if (!env.CLAUDE_CODE_SESSION_ID || env.AGENT_SMITH_CLAUDE_SESSION) return "disabled";
  try {
    const budget = budgetForSession();
    const { main } = locateSession(env, budget);
    const before = fs.lstatSync(main);
    const fd = fs.openSync(main, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
    try {
      const opened = fs.fstatSync(fd);
      if (!opened.isFile() || !sameFile(before, opened) || !sameFile(opened, fs.lstatSync(main))
          || fs.realpathSync(main) !== main) fail("unsafe-path");
      checkTime(budget.deadline);
    } finally {
      fs.closeSync(fd);
    }
    return "ready";
  } catch { return "unusable"; }
}

function json(text) {
  let value;
  try { value = JSON.parse(text); } catch { fail("unsupported-schema"); }
  if (!object(value)) fail("unsupported-schema");
  return value;
}

function recordOnce(map, key, value) {
  if (map.has(key) && !isDeepStrictEqual(map.get(key), value)) fail("conflicting-duplicate");
  map.set(key, value);
}

function instant(raw) {
  const value = typeof raw === "string" ? Date.parse(raw) : NaN;
  if (!Number.isFinite(value)) fail("incomplete-capture");
  return value;
}

export function measureClaudeTranscript(descriptor, env, description, evidence) {
  if (["checkpoint", "process", "sources"].some(key => Object.hasOwn(descriptor, key))) fail("invalid-evidence");
  const observed = descriptor.invocation;
  if (!object(observed) || !pathId(observed.agentId) || (observed.host !== undefined && observed.host !== "claude")
      || (observed.runId !== undefined && !identifier(observed.runId))
      || (observed.sessionId !== undefined && observed.sessionId !== env.CLAUDE_CODE_SESSION_ID)) fail("missing-identity");
  if (descriptor.hostVersion !== undefined) {
    if (!claudeCaptureSupported(descriptor.hostVersion)) fail("unsupported-host");
    evidence.hostVersion = descriptor.hostVersion;
  }
  const budget = budgetForSession();
  const { root, main, sessionId, agents } = locateSession(env, budget);
  const rootId = observed.agentId;
  const seenFiles = new Map();
  const metaFile = id => path.join(agents, `agent-${id}.meta.json`);
  const chargeRecord = () => {
    checkTime(budget.deadline);
    if (--budget.records < 0) fail("resource-limit");
  };
  const trackFile = (file, append = false) => {
    const stat = fs.lstatSync(file, { throwIfNoEntry: false });
    if (!stat) fail(fs.lstatSync(file, { throwIfNoEntry: false }) ? "unsafe-path" : "missing-source");
    seenFiles.set(file, { stat, append });
  };
  const readMeta = id => {
    const file = metaFile(id);
    trackFile(file);
    chargeRecord();
    const text = readBoundedFile(file, { root, maxBytes: Math.min(limits.recordBytes, budget.bytes), deadline: budget.deadline });
    budget.bytes -= Buffer.byteLength(text);
    return json(text);
  };
  // The live session appends to the main transcript while it is read; agent transcripts must be settled.
  const lines = (file, visit, append = false) => {
    trackFile(file, append);
    budget.bytes -= readBoundedLines(file, { root, maxBytes: budget.bytes, recordBytes: limits.recordBytes, deadline: budget.deadline, append }, line => {
      chargeRecord();
      visit(json(line));
    });
  };
  const rootMeta = readMeta(rootId);
  if (!identifier(rootMeta.toolUseId) || rootMeta.spawnDepth !== 1 || rootMeta.parentAgentId != null
      || rootMeta.description !== description || (observed.runId !== undefined && rootMeta.toolUseId !== observed.runId)) fail("missing-identity");
  const version = value => {
    if (!claudeCaptureSupported(value) || (evidence.hostVersion !== undefined && value !== evidence.hostVersion)) {
      delete evidence.hostVersion;
      fail("unsupported-host");
    }
    evidence.hostVersion = value;
  };
  const messages = new Map();
  const attributed = new Set();
  const reused = new Set();
  const agentClaims = new Map();
  const mainCalls = { launches: new Map(), returns: new Map() };
  const children = new Map();
  const metadataParents = new Set();

  function claimAgent(id, owner, runId) {
    const key = JSON.stringify([owner, runId]);
    if (agentClaims.has(id) && agentClaims.get(id) !== key) reused.add(id);
    agentClaims.set(id, key);
  }

  // A tool_result is keyed by its own tool_use_id. Multi-result rows cannot attribute a single toolUseResult.
  function inspectCalls(record, calls, owner, target) {
    const content = record.message?.content;
    if (!Array.isArray(content)) return;
    const identity = () => {
      if (record.sessionId !== sessionId || (record.agentId ?? null) !== owner) fail("missing-identity");
      version(record.version);
    };
    const singleResult = record.type === "user" && content.filter(item => item?.type === "tool_result").length === 1;
    for (const block of content) {
      if (record.type === "assistant" && block?.type === "tool_use") {
        if (block.name === "SendMessage") reused.add(block.input?.to ?? block.input?.recipient);
        if (block.name !== "Agent") continue;
        if (block.input?.resume != null) reused.add(block.input.resume);
        if (target !== undefined && block.id !== target) continue;
        identity();
        if (!identifier(block.id) || !identifier(record.message.id) || typeof block.input?.description !== "string"
            || typeof block.input.prompt !== "string" || !block.input.prompt) fail("missing-identity");
        if (block.input.resume != null) fail("ambiguous-history");
        const time = instant(record.timestamp);
        const previous = calls.launches.get(block.id);
        if (previous) previous.time = Math.min(previous.time, time);
        // Hash all launch parameters, including the agent type, without retaining the prompt.
        const inputHash = hash(JSON.stringify(block.input, (_, value) => object(value)
          ? Object.fromEntries(Object.keys(value).sort().map(key => [key, value[key]])) : value));
        recordOnce(calls.launches, block.id, { inputHash, message: record.message.id, prompt: hash(block.input.prompt),
          description: block.input.description, time: previous?.time ?? time });
      }
      if (record.type !== "user" || block?.type !== "tool_result") continue;
      const result = record.toolUseResult;
      if (result?.agentId) claimAgent(result.agentId, owner, block.tool_use_id);
      if (target !== undefined && block.tool_use_id !== target) continue;
      if (target === undefined && !children.has(block.tool_use_id) && !calls.launches.has(block.tool_use_id)) continue;
      identity();
      // Only the invocation's own root may return a background launch; its finished metadata proves settlement.
      if (owner === null && singleResult && object(result) && !block.is_error && result.status === "async_launched"
          && result.isAsync === true && pathId(result.agentId)) {
        recordOnce(calls.returns, block.tool_use_id, { agentId: result.agentId, background: true, time: instant(record.timestamp) });
        continue;
      }
      if (!singleResult || !object(result)
          || block.is_error || result.status !== "completed") {
        recordOnce(calls.returns, block.tool_use_id, null);
        continue;
      }
      if (result.agentId !== undefined && !pathId(result.agentId)) fail("missing-identity");
      const values = result.usage !== undefined ? counters(result.usage, transcriptBuckets) : null;
      if (result.totalTokens !== undefined && (!integer(result.totalTokens) || (values && result.totalTokens !== values.total))) fail("snapshot-mismatch");
      const time = instant(record.timestamp);
      const previous = calls.returns.get(block.tool_use_id);
      if (previous) previous.time = Math.min(previous.time, time);
      recordOnce(calls.returns, block.tool_use_id, { agentId: result.agentId, counts: values,
        total: result.totalTokens ?? values?.total, time: previous?.time ?? time,
        text: Array.isArray(result.content) ? hash(textContent(result)) : undefined });
    }
  }
  lines(main, record => inspectCalls(record, mainCalls, null, rootMeta.toolUseId), true);
  const rootLaunch = mainCalls.launches.get(rootMeta.toolUseId);
  const rootReturn = mainCalls.returns.get(rootMeta.toolUseId);
  if ((rootLaunch && rootLaunch.description !== description) || (rootReturn?.agentId !== undefined && rootReturn.agentId !== rootId)) fail("missing-identity");
  if (!rootLaunch) fail("incomplete-capture");
  evidence.invocation = cleanInvocation({ host: "claude", sessionId, agentId: rootId, runId: rootMeta.toolUseId });
  if (!rootReturn || rootMeta.finished !== true) fail("incomplete-capture");

  const agentDirectoryStat = scan(agents, budget, entry => {
    const match = /^agent-(.+)\.meta\.json$/.exec(entry.name);
    if (!match || match[1] === rootId) return;
    if (!pathId(match[1])) fail("unsafe-path");
    const meta = readMeta(match[1]);
    if (meta.toolUseId === rootMeta.toolUseId) fail("ambiguous-history");
    if (identifier(meta.parentAgentId)) metadataParents.add(meta.parentAgentId);
    if (meta.parentAgentId !== rootId) return;
    if (meta.spawnDepth !== 2 || !identifier(meta.toolUseId) || children.has(meta.toolUseId)) fail("ambiguous-history");
    children.set(meta.toolUseId, { id: match[1], finished: meta.finished, description: meta.description });
  });

  function measureAgent(id, runId, launch, returned, parent) {
    if (parent && metadataParents.has(id)) fail("ambiguous-history");
    if (returned.total === undefined && !returned.background) fail("incomplete-capture");
    // A background launch returns before the agent works; its records have no return-time ceiling.
    const until = returned.background ? Infinity : returned.time;
    claimAgent(id, parent, runId);
    if (attributed.has(id)) fail("ambiguous-history");
    attributed.add(id);
    if (attributed.size > limits.agents) fail("resource-limit");
    if (returned.time < launch.time || (returned.agentId !== undefined && returned.agentId !== id)) fail("missing-identity");
    const calls = { launches: new Map(), returns: new Map() };
    const nodes = new Map();
    let firstResponse = Infinity;
    lines(path.join(agents, `agent-${id}.jsonl`), record => {
      if (record.type !== "assistant" && record.message?.usage !== undefined) fail("unsupported-schema");
      if (!["assistant", "user", "attachment", "system", "progress"].includes(record.type)) return;
      if (!record.uuid && !record.message) return;
      if (record.sessionId !== sessionId || record.agentId !== id || !identifier(record.uuid)
          || (record.parentUuid !== null && !identifier(record.parentUuid))) fail("missing-identity");
      version(record.version);
      // Host-injected context (system reminders, loaded skill bodies) is a meta user record, not a new prompt.
      const meta = record.type === "user" && record.parentUuid !== null && record.isMeta === true;
      const node = { parent: record.parentUuid, type: meta ? "meta" : record.type };
      if (record.type === "assistant" || (record.type === "user" && record.parentUuid === null)) {
        node.time = instant(record.timestamp);
        if (node.time < launch.time || node.time > until) fail("ambiguous-history");
      }
      if (record.type === "assistant") {
        const msg = record.message;
        if (msg?.role !== "assistant" || !identifier(msg.id) || (record.requestId !== undefined && !identifier(record.requestId))) fail("missing-identity");
        const count = counters(msg.usage, transcriptBuckets);
        firstResponse = Math.min(firstResponse, node.time);
        node.text = hash(textContent(msg));
        if (msg.model === "<synthetic>") {
          if (count.total !== 0) fail("unsupported-schema");
        } else {
          node.message = msg.id;
          const prior = messages.get(msg.id);
          if (prior && (prior.owner !== id || !isDeepStrictEqual(count, prior.count)
              || (prior.request && record.requestId && prior.request !== record.requestId))) fail("conflicting-duplicate");
          messages.set(msg.id, { owner: id, count, request: record.requestId ?? prior?.request });
          if (messages.size > limits.requests) fail("resource-limit");
        }
      } else if (record.type === "user") {
        if (record.message?.role !== "user") fail("unsupported-schema");
        if (record.parentUuid === null) node.prompt = hash(textContent(record.message));
        else if (!meta && (!Array.isArray(record.message.content) || !record.message.content.some(block => block?.type === "tool_result"))) fail("ambiguous-history");
        else if (!meta) node.type = "result";
      }
      recordOnce(nodes, record.uuid, node);
      inspectCalls(record, calls, id);
    });

    // Mark the ancestors once across all messages. The final assistant must be the only countable tip.
    const ancestors = new Set();
    const assistants = [...nodes].filter(([, node]) => node.message);
    for (const [, node] of assistants) {
      let up = node.parent;
      while (up !== null && !ancestors.has(up)) {
        checkTime(budget.deadline);
        ancestors.add(up);
        if (!nodes.has(up)) fail("ambiguous-history");
        up = nodes.get(up).parent;
      }
    }
    const tips = assistants.filter(([uuid]) => !ancestors.has(uuid));
    if (!assistants.length) fail("incomplete-capture");
    if (tips.length !== 1) fail("ambiguous-history");
    const [end, last] = tips[0];
    const count = messages.get(last.message).count;
    if (!returned.background && (returned.total !== count.total || (returned.counts && !isDeepStrictEqual(count, returned.counts))
        || (returned.text !== undefined && returned.text !== last.text))) fail("snapshot-mismatch");
    const lineage = new Set();
    let up = end;
    while (up !== null) {
      const node = nodes.get(up);
      if (!node || lineage.has(up)) fail("ambiguous-history");
      lineage.add(up);
      if (node.parent === null && (node.prompt !== launch.prompt || node.time > firstResponse)) fail("ambiguous-history");
      up = node.parent;
    }
    // Parallel tool calls leave a tool_result branch on an earlier tool_use record of the final chain.
    for (const [uuid, node] of nodes) {
      if (lineage.has(uuid)) continue;
      if (["assistant", "user"].includes(node.type) || (node.type === "result" && !lineage.has(node.parent))) fail("ambiguous-history");
    }
    if (parent && calls.launches.size) fail("ambiguous-history");
    if (!parent && children.size !== calls.launches.size) fail("incomplete-capture");
    for (const [runId, childLaunch] of calls.launches) {
      const child = children.get(runId);
      const result = calls.returns.get(runId);
      if (!child || child.finished !== true || !result) fail("incomplete-capture");
      if (child.description !== childLaunch.description || childLaunch.time < launch.time || result.time > until) fail("missing-identity");
      measureAgent(child.id, runId, childLaunch, result, id);
    }
  }
  measureAgent(rootId, rootMeta.toolUseId, rootLaunch, rootReturn, null);
  for (const id of attributed) if (reused.has(id)) fail("ambiguous-history");
  seenFiles.set(agents, { stat: agentDirectoryStat, append: false });
  for (const [file, { stat: before, append }] of seenFiles) {
    checkTime(budget.deadline);
    const after = fs.lstatSync(file);
    if (fs.realpathSync(file) !== file || !(append ? sameFile(before, after) && after.size >= before.size : stable(before, after))) fail("unsafe-path");
  }
  let totalTokens = 0;
  for (const { count } of messages.values()) {
    totalTokens += count.total;
    if (!Number.isSafeInteger(totalTokens)) fail("resource-limit");
  }
  checkTime(budget.deadline);
  return { totalTokens, sessionCount: attributed.size, requestCount: messages.size };
}
