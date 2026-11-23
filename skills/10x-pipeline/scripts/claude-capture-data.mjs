import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { readBoundedFile } from "./usage.mjs";

export const CAPTURE_ENV = "AGENT_SMITH_CLAUDE_CAPTURE";
export const CAPTURE_LIMITS = {
  bodyBytes: 8 * 1024 * 1024,
  recordBytes: 1024 * 1024,
  nativeBytes: 4 * 1024 * 1024,
  telemetryBytes: 24 * 1024 * 1024,
  events: 200000,
  lifetimeMs: 24 * 60 * 60 * 1000,
};
const files = { binding: "binding.json", native: "hooks.jsonl", telemetry: "otel.jsonl", failure: "failed", lock: "hooks.lock" };
export const captureFile = (root, kind) => path.join(root, files[kind]);

// The floor is the oldest release whose headless wire format has a reviewed capture and sanitized
// reconciliation fixtures. Later releases pass; a changed record shape fails closed in the collector.
export const CLAUDE_CAPTURE_MIN_VERSION = "2.1.311";
export function claudeCaptureSupported(version) {
  if (typeof version !== "string" || !/^\d+\.\d+\.\d+$/.test(version)) return false;
  const have = version.split(".").map(Number);
  const floor = CLAUDE_CAPTURE_MIN_VERSION.split(".").map(Number);
  for (let i = 0; i < 3; i++) if (have[i] !== floor[i]) return have[i] > floor[i];
  return true;
}
export const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
export const identifier = value => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
export const integer = value => Number.isSafeInteger(value) && value >= 0;
export const hash = value => createHash("sha256").update(value).digest("hex");
export const fail = reason => { throw Object.assign(new Error(), { reason, accounting: true }); };
export const tokenBuckets = ["input_tokens", "output_tokens", "cache_read_tokens", "cache_creation_tokens"];
export const sessionIdentifier = value => typeof value === "string" && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(value);
export const validProcess = (value) => object(value) && integer(value.pid) && value.pid > 0
  && typeof value.createdAt === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(value.createdAt)
  && Number.isFinite(Date.parse(value.createdAt));
export const endpointPattern = /^http:\/\/127\.0\.0\.1:[1-9]\d{0,4}\/[a-f0-9]{48}\/v1\/logs$/;

const privateOwner = stat => (stat.mode & 0o077) === 0 && stat.uid === process.getuid();
const singleFile = stat => stat.isFile() && stat.nlink === 1;
const sameInode = (left, right) => left.dev === right.dev && left.ino === right.ino;

function privateStat(file, isDirectory) {
  const stat = fs.lstatSync(file);
  if ((isDirectory ? !stat.isDirectory() : !singleFile(stat)) || !privateOwner(stat)
      || fs.realpathSync(file) !== file) fail("unsafe-path");
  return stat;
}

export function privateRoot(root) {
  if (typeof root !== "string" || !path.isAbsolute(root)) fail("unsafe-path");
  return privateStat(root, true);
}

export function readCaptureBinding(root) {
  privateRoot(root);
  const file = captureFile(root, "binding");
  privateStat(file, false);
  const binding = JSON.parse(readBoundedFile(file, { root, maxBytes: 8192 }));
  if (!object(binding) || !sessionIdentifier(binding.sessionId) || !validProcess(binding.process)
      || typeof binding.endpoint !== "string" || !endpointPattern.test(binding.endpoint)
      || typeof binding.transcriptRoot !== "string" || !path.isAbsolute(binding.transcriptRoot)
      || path.resolve(binding.transcriptRoot) !== binding.transcriptRoot
      || typeof binding.hostVersion !== "string") fail("missing-source");
  if (!claudeCaptureSupported(binding.hostVersion)) fail("unsupported-host");
  assertCaptureAvailable(root, binding);
  return binding;
}

export function assertCaptureAvailable(root, binding) {
  const age = Date.now() - Date.parse(binding.process.createdAt);
  if (age < 0 || age > CAPTURE_LIMITS.lifetimeMs) fail("missing-source");
  try { fs.lstatSync(captureFile(root, "failure")); }
  catch (error) { if (error.code === "ENOENT") return; throw error; }
  fail("missing-source");
}

export function captureStat(root, kind) {
  const stat = privateStat(captureFile(root, kind), false);
  if (stat.size > CAPTURE_LIMITS[kind + "Bytes"]) fail("resource-limit");
  return stat;
}

function probeCaptureFile(root, kind) {
  const before = captureStat(root, kind);
  const fd = fs.openSync(captureFile(root, kind), fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
  try {
    const opened = fs.fstatSync(fd);
    const current = captureStat(root, kind);
    // Live capture can append between these checks. Identity and the limit matter, exact sizes do not.
    if (!singleFile(opened) || !privateOwner(opened) || !sameInode(before, opened) || !sameInode(opened, current)) {
      fail("unsafe-path");
    }
    if (opened.size > CAPTURE_LIMITS[kind + "Bytes"]) fail("resource-limit");
  } finally {
    fs.closeSync(fd);
  }
}

export function claudeCaptureReadiness(env = process.env) {
  const root = env[CAPTURE_ENV];
  if (!root || env.AGENT_SMITH_CLAUDE_SESSION) return "disabled";
  try {
    readCaptureBinding(root);
    probeCaptureFile(root, "native");
    probeCaptureFile(root, "telemetry");
    return "ready";
  } catch {
    return "unusable";
  }
}

export function markCaptureFailure(root) {
  try {
    privateRoot(root);
    fs.closeSync(fs.openSync(captureFile(root, "failure"), "wx", 0o600));
  } catch { /* Passive capture has no path into the execution decision. */ }
}

export function appendCapture(root, kind, record) {
  const bytes = Buffer.from(JSON.stringify(record) + "\n");
  if (bytes.length > CAPTURE_LIMITS.recordBytes) fail("resource-limit");
  const stat = captureStat(root, kind);
  if (stat.size + bytes.length > CAPTURE_LIMITS[kind + "Bytes"]) fail("resource-limit");
  const fd = fs.openSync(captureFile(root, kind), fs.constants.O_WRONLY | fs.constants.O_APPEND | fs.constants.O_NOFOLLOW);
  try {
    const opened = fs.fstatSync(fd);
    if (opened.dev !== stat.dev || opened.ino !== stat.ino || opened.size !== stat.size) fail("unsafe-path");
    if (fs.writeSync(fd, bytes) !== bytes.length) fail("missing-source");
  } finally {
    fs.closeSync(fd);
  }
}

export function appendNative(root, record) {
  const lock = captureFile(root, "lock");
  const deadline = performance.now() + 100;
  const wait = new Int32Array(new SharedArrayBuffer(4));
  let fd;
  for (;;) {
    try { fd = fs.openSync(lock, "wx", 0o600); break; }
    catch (error) {
      if (error.code !== "EEXIST" || performance.now() >= deadline) throw error;
      Atomics.wait(wait, 0, 0, 5);
    }
  }
  try {
    appendCapture(root, "native", record);
  } finally {
    fs.closeSync(fd);
    fs.unlinkSync(lock);
  }
}

export function projectNative(record, sessionId) {
  const event = record?.hook_event_name;
  if (!["PreToolUse", "PostToolUse", "SubagentStop"].includes(event) || record.session_id !== sessionId) return null;
  if (event === "SubagentStop") {
    if (!identifier(record.agent_id)) fail("missing-identity");
    return { event, sessionId, agentId: record.agent_id,
      file: typeof record.agent_transcript_path === "string" && record.agent_transcript_path.length <= 4096 ? record.agent_transcript_path : null,
      textHash: typeof record.last_assistant_message === "string" ? hash(record.last_assistant_message) : null };
  }
  if (record.tool_name !== "Agent") return null;
  if (!identifier(record.tool_use_id) || (record.agent_id != null && !identifier(record.agent_id))) fail("missing-identity");
  const base = { event, sessionId, runId: record.tool_use_id, parent: record.agent_id ?? null };
  if (event === "PreToolUse") {
    return { ...base,
      descriptionHash: typeof record.tool_input?.description === "string" ? hash(record.tool_input.description) : null,
      promptHash: typeof record.tool_input?.prompt === "string" ? hash(record.tool_input.prompt) : null,
      resumed: record.tool_input?.resume != null };
  }
  if (!identifier(record.tool_response?.agentId)
      || (record.tool_response.totalTokens !== undefined && !integer(record.tool_response.totalTokens))) fail("unsupported-schema");
  return { ...base, response: { agentId: record.tool_response.agentId,
    status: record.tool_response.status === "completed" ? "completed" : "other", totalTokens: record.tool_response.totalTokens } };
}

export function attributes(raw) {
  if (!Array.isArray(raw)) fail("unsupported-schema");
  const values = new Map();
  for (const item of raw) {
    if (!object(item) || typeof item.key !== "string" || !object(item.value)) fail("unsupported-schema");
    if (values.has(item.key) && !isDeepStrictEqual(values.get(item.key), item.value)) fail("conflicting-duplicate");
    values.set(item.key, item.value);
  }
  return values;
}

export function scalar(attrs, key) {
  const value = attrs.get(key);
  if (value === undefined) return undefined;
  if (Object.hasOwn(value, "stringValue")) return value.stringValue;
  if (Object.hasOwn(value, "intValue")) {
    const raw = value.intValue;
    if (!(integer(raw) || (typeof raw === "string" && /^\d+$/.test(raw) && integer(Number(raw))))) fail("unsupported-schema");
    return Number(raw);
  }
  if (Object.hasOwn(value, "doubleValue")) return value.doubleValue;
  if (Object.hasOwn(value, "boolValue")) return value.boolValue;
  fail("unsupported-schema");
}

export function numeric(attrs, key) {
  const value = scalar(attrs, key);
  const number = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
  if (!integer(number)) fail("unsupported-schema");
  return number;
}

const resourceKeys = ["process.pid", "process.creation.time"];
const baseKeys = ["event.sequence", "session.id", "app.version", "agent_id", "parent_agent_id"];
const eventKeys = {
  "claude_code.api_request": ["request_id", ...tokenBuckets],
  "claude_code.assistant_response": ["request_id", "message.uuid"],
  "claude_code.tool_result": ["tool_use_id", "tool_name", "success"],
  "claude_code.subagent_completed": ["total_tokens"],
};
function contentFreeAttributes(attrs, keys) {
  const output = [];
  for (const key of keys) {
    const original = attrs.get(key);
    if (original === undefined) continue;
    const value = scalar(attrs, key);
    const tag = Object.keys(original).find(name => ["stringValue", "intValue", "doubleValue", "boolValue"].includes(name));
    if (tag === "stringValue" ? typeof value !== "string" || !identifier(value)
      : tag === "boolValue" ? typeof value !== "boolean" : !integer(value)) fail("unsupported-schema");
    output.push({ key, value: { [tag]: value } });
  }
  return output;
}

export function projectTelemetry(batch, binding) {
  if (!Array.isArray(batch?.resourceLogs) || !batch.resourceLogs.length) fail("unsupported-schema");
  const resourceLogs = [];
  for (const resource of batch.resourceLogs) {
    const observed = attributes(resource.resource?.attributes);
    if (numeric(observed, "process.pid") !== binding.process.pid
        || scalar(observed, "process.creation.time") !== binding.process.createdAt) fail("missing-identity");
    if (!Array.isArray(resource.scopeLogs)) fail("unsupported-schema");
    const scopeLogs = resource.scopeLogs.map(scope => {
      if (!Array.isArray(scope.logRecords)) fail("unsupported-schema");
      return { logRecords: scope.logRecords.map(record => {
        const attrs = attributes(record.attributes);
        const name = record.body?.stringValue;
        if (typeof name !== "string" || !/^claude_code\.[a-z_]{1,64}$/.test(name)) fail("unsupported-schema");
        if (scalar(attrs, "session.id") !== binding.sessionId) fail("missing-identity");
        if (numeric(attrs, "event.sequence") >= CAPTURE_LIMITS.events) fail("resource-limit");
        // Preserve sequence markers for every event, but only retain fields used by reconciliation.
        const details = name === "claude_code.tool_result" && scalar(attrs, "tool_name") !== "Agent"
          ? ["tool_use_id"] : eventKeys[name] ?? [];
        const selected = contentFreeAttributes(attrs, [...baseKeys, ...details]);
        return { body: { stringValue: name }, attributes: selected };
      }) };
    });
    // The independently checked creation time is an ISO timestamp, not an arbitrary exported string.
    const projectedResource = { attributes: resourceKeys.map((key, i) => ({ key, value: i === 0
      ? { intValue: binding.process.pid } : { stringValue: binding.process.createdAt } })) };
    resourceLogs.push({ resource: projectedResource, scopeLogs });
  }
  return { resourceLogs };
}
