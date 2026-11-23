// Observed-usage adapter. It never resumes a thread or writes run state.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { cleanInvocation, normalizeAccounting, unavailableEvidence, readBoundedLines, USAGE_LIMITS } from "./usage.mjs";

const CODEX_USAGE_MIN_VERSION = [0, 169, 0];
export const CODEX_USAGE_FLOOR = CODEX_USAGE_MIN_VERSION.join(".");

export function codexUsageSupported(version) {
  if (typeof version !== "string" || !/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/.test(version)) return false;
  const components = version.split(".").map(Number);
  for (const [index, floor] of CODEX_USAGE_MIN_VERSION.entries()) {
    if (components[index] !== floor) return components[index] > floor;
  }
  return true;
}

// Invocation-wide limits, including ignored transcript records; exhaustion never yields a partial total.
export const CODEX_USAGE_LIMITS = { recordBytes: 1024 * 1024, bytes: 32 * 1024 * 1024,
  sessions: USAGE_LIMITS.sessions, requests: USAGE_LIMITS.requests, readMs: USAGE_LIMITS.readMs };
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const identifier = value => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
const integer = value => Number.isSafeInteger(value) && value >= 0;
const keys = ["input_tokens", "output_tokens", "cached_input_tokens", "cache_write_input_tokens", "reasoning_output_tokens", "total_tokens"];
const fail = reason => { throw Object.assign(new Error(), { reason, accounting: true }); };
const empty = () => Object.fromEntries(keys.map(key => [key, 0]));

function counters(raw, snapshot = true) {
  if (!object(raw) || !integer(raw.input_tokens) || !integer(raw.output_tokens)) fail("unsupported-schema");
  const total = raw.input_tokens + raw.output_tokens;
  if (!Number.isSafeInteger(total)) fail("resource-limit");
  const value = {};
  for (const key of keys) {
    const v = raw[key] ?? (["cached_input_tokens", "cache_write_input_tokens", "reasoning_output_tokens"].includes(key) ? 0 : undefined);
    if (key === "total_tokens" && !snapshot && v === undefined) continue;
    if (!integer(v)) fail("unsupported-schema");
    value[key] = v;
  }
  if (value.total_tokens !== undefined && value.total_tokens !== total) fail("snapshot-mismatch");
  value.total_tokens = total;
  if (value.cached_input_tokens > value.input_tokens || value.cache_write_input_tokens > value.input_tokens
      || value.reasoning_output_tokens > value.output_tokens) fail("unsupported-schema");
  return value;
}

function add(left, right) {
  const sum = {};
  for (const key of keys) {
    sum[key] = left[key] + right[key];
    if (!Number.isSafeInteger(sum[key])) fail("resource-limit");
  }
  return sum;
}

function sourceRoot(file, home) {
  if (typeof file !== "string" || !path.isAbsolute(file)) fail("missing-source");
  for (const name of ["sessions", "archived_sessions"]) {
    const root = path.resolve(home, name);
    const rel = path.relative(root, file);
    if (rel && rel !== ".." && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel)) return root;
  }
  fail("unsafe-path");
}

export function collectCodexUsage({ rootThreadId, threads, delegated = false, execUsage, metadataReason,
  deadline = Date.now() + CODEX_USAGE_LIMITS.readMs, codexHome = process.env.CODEX_HOME ?? path.join(os.homedir(), ".codex") }) {
  const root = threads?.find(item => item.id === rootThreadId);
  const hostVersion = root?.metadata?.cliVersion;
  const invocation = cleanInvocation({ host: "codex", rootThreadId, rootTurnId: root?.turn?.id });
  const unavailable = reason => ({ usageEvidence: unavailableEvidence(reason, { source: "codex-rollout", hostVersion, invocation }) });
  try {
    if (!invocation || root?.turn?.rootTurnId !== invocation.rootTurnId) fail("missing-identity");
    if (metadataReason) fail(metadataReason);
    if (!Array.isArray(threads) || !threads.length) fail("missing-identity");
    if (threads.length > CODEX_USAGE_LIMITS.sessions) fail("resource-limit");
    if (!codexUsageSupported(hostVersion)) fail("unsupported-host");
    const ids = new Set(threads.map(item => item.id));
    if (ids.size !== threads.length || !ids.has(rootThreadId)) fail("missing-identity");
    if (delegated && threads.length === 1) fail("incomplete-capture");
    const byId = new Map(threads.map(item => [item.id, item]));
    for (const item of threads) {
      const meta = item.metadata;
      if (!identifier(item.id) || !object(meta) || meta.id !== item.id || meta.sessionId !== item.id
          || !identifier(item.turn?.id) || item.turn.rootTurnId !== invocation.rootTurnId) fail("missing-identity");
      if (!codexUsageSupported(meta.cliVersion)) fail("unsupported-host");
      if (meta.forkedFromId != null && (item.id === rootThreadId || meta.forkedFromId !== meta.parentThreadId)) fail("ambiguous-history");
      const seen = new Set([item.id]);
      let current = item;
      while (current.id !== rootThreadId) {
        const parent = current.metadata.parentThreadId;
        if (!ids.has(parent) || seen.has(parent)) fail("missing-identity");
        seen.add(parent);
        current = byId.get(parent);
      }
      if (root.metadata.parentThreadId != null) fail("ambiguous-history");
    }
    deadline = Math.min(deadline, Date.now() + CODEX_USAGE_LIMITS.readMs);
    let remainingBytes = CODEX_USAGE_LIMITS.bytes;
    let requestCount = 0;
    let total = 0;
    for (const item of threads) {
      let header;
      let prefix = false;
      let boundaryOrdinal;
      let previousOrdinal;
      const ancestors = new Set();
      for (let parent = item.metadata.parentThreadId; parent != null; parent = byId.get(parent).metadata.parentThreadId) ancestors.add(parent);
      let currentTurn;
      let terminalTurn;
      let snapshot;
      let snapshotCurrent = false;
      let sum = empty();
      let turnSum = empty();
      const starts = new Set();
      const responses = new Map();
      const rootPath = sourceRoot(item.metadata.path, codexHome);
      if (!fs.existsSync(item.metadata.path)) fail("missing-source");
      const size = readBoundedLines(item.metadata.path, { root: rootPath, maxBytes: remainingBytes,
        recordBytes: CODEX_USAGE_LIMITS.recordBytes, deadline }, line => {
        let record;
        try { record = JSON.parse(line); } catch { fail("unsupported-schema"); }
        if (!object(record) || typeof record.type !== "string" || !object(record.payload)) fail("unsupported-schema");
        const p = record.payload;
        if (!header && record.type !== "session_meta") fail("unsupported-schema");
        if (!header) {
          if (p.id !== item.id || p.session_id !== rootThreadId) fail("missing-identity");
          if (!codexUsageSupported(p.cli_version)) fail("unsupported-host");
          if ((p.parent_thread_id ?? null) !== (item.metadata.parentThreadId ?? null)
              || (p.forked_from_id ?? null) !== (item.metadata.forkedFromId ?? null)) fail("missing-identity");
          if (p.history_base != null || !["legacy", "paginated"].includes(p.history_mode)) fail("ambiguous-history");
          const fork = p.forked_from_id != null;
          if (item.id === rootThreadId && (fork || p.forked_from_ordinal_exclusive != null || p.subagent_history_start_ordinal != null)) fail("ambiguous-history");
          if (p.history_mode === "paginated") {
            if (!integer(record.ordinal)) fail("ambiguous-history");
            previousOrdinal = record.ordinal;
            if (fork || p.subagent_history_start_ordinal != null) {
              if (!integer(p.subagent_history_start_ordinal) || p.subagent_history_start_ordinal < record.ordinal) fail("ambiguous-history");
              boundaryOrdinal = p.subagent_history_start_ordinal;
              prefix = boundaryOrdinal > record.ordinal;
            } else if (record.ordinal !== 0) fail("ambiguous-history");
          } else {
            if (p.subagent_history_start_ordinal != null || p.forked_from_ordinal_exclusive != null) fail("ambiguous-history");
            prefix = fork;
          }
          if (p.forked_from_ordinal_exclusive != null && (!integer(p.forked_from_ordinal_exclusive)
              || !integer(boundaryOrdinal) || p.forked_from_ordinal_exclusive > boundaryOrdinal)) fail("ambiguous-history");
          header = { historyMode: p.history_mode };
          return;
        }
        if (header.historyMode === "paginated") {
          if (!integer(record.ordinal) || record.ordinal !== previousOrdinal + 1) fail("ambiguous-history");
          previousOrdinal = record.ordinal;
        }
        if (prefix) {
          const ownStart = record.type === "event_msg" && ["task_started", "turn_started"].includes(p.type)
            && p.turn_id === item.turn.id && p.root_turn_id === invocation.rootTurnId;
          const inherited = boundaryOrdinal !== undefined ? record.ordinal < boundaryOrdinal : !ownStart;
          if (inherited) {
            if (record.type === "token_usage_record" && (p.thread_id === item.id || !ancestors.has(p.thread_id))) fail("ambiguous-history");
            return;
          }
          prefix = false;
        }
        if (record.type === "session_meta") fail("ambiguous-history");
        if (record.type === "event_msg" && ["task_started", "turn_started"].includes(p.type)) {
          if (!identifier(p.turn_id) || p.root_turn_id !== invocation.rootTurnId || starts.has(p.turn_id)
              || (currentTurn && terminalTurn !== currentTurn)) fail("ambiguous-history");
          if (item.id === rootThreadId && (starts.size || p.turn_id !== invocation.rootTurnId)) fail("ambiguous-history");
          starts.add(p.turn_id);
          currentTurn = p.turn_id;
          turnSum = empty();
        } else if (record.type === "token_usage_record") {
          if (p.thread_id !== item.id || p.session_id !== rootThreadId || p.root_turn_id !== invocation.rootTurnId
              || !identifier(p.turn_id) || !identifier(p.response_id)) fail("missing-identity");
          const usage = counters(p.usage);
          const observed = { turnId: p.turn_id, usage, turn: counters(p.turn_token_usage), thread: counters(p.thread_token_usage) };
          if (responses.has(p.response_id)) {
            if (!isDeepStrictEqual(responses.get(p.response_id), observed)) fail("conflicting-duplicate");
            return;
          }
          if (!currentTurn || p.turn_id !== currentTurn || terminalTurn === currentTurn) fail("incomplete-capture");
          if (++requestCount > CODEX_USAGE_LIMITS.requests) fail("resource-limit");
          responses.set(p.response_id, observed);
          sum = add(sum, usage);
          turnSum = add(turnSum, usage);
          if (!isDeepStrictEqual(sum, observed.thread) || !isDeepStrictEqual(turnSum, observed.turn)) fail("snapshot-mismatch");
          snapshotCurrent = false;
        } else if (record.type === "event_msg" && p.type === "token_count" && p.info != null) {
          if (!currentTurn || !object(p.info)) fail("ambiguous-history");
          snapshot = counters(p.info.total_token_usage);
          snapshotCurrent = true;
        } else if (record.type === "event_msg" && ["task_complete", "turn_complete"].includes(p.type)) {
          if (!currentTurn || p.turn_id !== currentTurn || p.root_turn_id !== invocation.rootTurnId || p.error != null) fail("incomplete-capture");
          terminalTurn = currentTurn;
        } else if (record.type === "event_msg" && ["turn_aborted", "task_started", "task_complete"].includes(p.type)) {
          fail("incomplete-capture");
        }
      });
      remainingBytes -= size;
      if (!header || prefix || !responses.size || !currentTurn || terminalTurn !== item.turn.id || currentTurn !== terminalTurn || !snapshotCurrent || !snapshot) fail("incomplete-capture");
      if (!isDeepStrictEqual(sum, snapshot)) fail("snapshot-mismatch");
      if (item.id === rootThreadId && execUsage != null) {
        const primary = counters(execUsage, false);
        for (const key of keys) {
          if ((Object.hasOwn(execUsage, key) || key === "total_tokens") && primary[key] !== snapshot[key]) fail("snapshot-mismatch");
        }
      }
      total += sum.total_tokens;
      if (!Number.isSafeInteger(total)) fail("resource-limit");
    }
    return normalizeAccounting({ totalTokens: total }, {
      schemaVersion: 1, status: "verified", scope: "step-tree", source: "codex-rollout", hostVersion, invocation,
      sessionCount: threads.length, requestCount, reconciliation: "response-snapshot",
    });
  } catch (error) {
    return unavailable(error.reason ?? "unsupported-schema");
  }
}
