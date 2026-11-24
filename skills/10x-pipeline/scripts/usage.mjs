import fs from "node:fs";
import path from "node:path";

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

export const TRANSCRIPT_LIMITATION = "Transcript figures can undercount Claude usage because some requests appear only in telemetry.";
export const USAGE_LIMITS = { evidenceBytes: 4096, fileBytes: 65536, readMs: 2000, sessions: 512, requests: 100000 };
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const integer = (value) => Number.isSafeInteger(value) && value >= 0;
const identifier = (value) => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
const SOURCES = new Set(["codex-rollout", "claude-native", "claude-transcript", "unknown"]);
const REASONS = {
  "capture-disabled": "Claude token capture is off. Run `node <absolute-plugin-scripts>/claude-capture.mjs` to enable it for a fresh session.",
  "invalid-evidence": "Accounting evidence is invalid or inconsistent.",
  "unsupported-host": "The host version is not qualified for accounting.",
  "unsupported-schema": "The host record schema is not qualified for accounting.",
  "missing-source": "The required host usage source is unavailable.",
  "missing-identity": "The host invocation cannot be attributed exactly.",
  "incomplete-capture": "The captured records do not prove complete invocation coverage.",
  "conflicting-duplicate": "Duplicate host records disagree.",
  "snapshot-mismatch": "Observed requests disagree with the final host snapshot.",
  "ambiguous-history": "Inherited or resumed history has no proven invocation boundary.",
  "unsafe-path": "The host usage source is not a stable regular file within its source root.",
  "resource-limit": "The accounting source exceeds a fixed resource limit.",
};

// Keep the legacy numeric contract; missing and measured zero remain distinct.
export function cleanUsage(raw) {
  if (!object(raw)) return null;
  const clean = {};
  for (const key of ["totalTokens", "toolUses", "durationMs"]) {
    if (integer(raw[key])) clean[key] = raw[key];
  }
  return Object.keys(clean).length ? clean : null;
}

export function cleanInvocation(raw) {
  if (!object(raw)) return null;
  const keys = raw.host === "codex" ? ["rootThreadId", "rootTurnId"]
    : raw.host === "claude" ? ["sessionId", "agentId", "runId"] : null;
  if (!keys || keys.some((key) => !identifier(raw[key]))) return null;
  return { host: raw.host, ...Object.fromEntries(keys.map((key) => [key, raw[key]])) };
}

const version = (value) => typeof value === "string" && value.length <= 32 && /^(?:unknown|[0-9]+\.[0-9]+\.[0-9]+(?:[-+][A-Za-z0-9.-]+)?)$/.test(value);

export function unavailableEvidence(reason, { source, hostVersion, invocation } = {}) {
  const code = Object.hasOwn(REASONS, reason) ? reason : "invalid-evidence";
  const identity = cleanInvocation(invocation);
  return {
    schemaVersion: 1, status: "unavailable", scope: "step-tree",
    source: SOURCES.has(source) ? source : "unknown",
    hostVersion: version(hostVersion) ? hostVersion : "unknown",
    ...(identity ? { invocation: identity } : {}),
    reason: code, explanation: source === "claude-transcript" && code === "capture-disabled"
      ? "Claude transcript capture is unavailable in this session." : REASONS[code],
  };
}

// A producer must replace step-authored accounting first; this validates shape, not provenance.
export function normalizeAccounting(rawUsage, rawEvidence) {
  const usage = cleanUsage(rawUsage) ?? {};
  if (rawEvidence === undefined) return Object.keys(usage).length ? { usage } : {};
  let bounded = false;
  try { bounded = Buffer.byteLength(JSON.stringify(rawEvidence) ?? "") <= USAGE_LIMITS.evidenceBytes; } catch { /* invalid evidence */ }
  const invocation = bounded && object(rawEvidence) ? cleanInvocation(rawEvidence.invocation) : null;
  const base = bounded && object(rawEvidence) && rawEvidence.schemaVersion === 1 && rawEvidence.scope === "step-tree"
    && SOURCES.has(rawEvidence.source) && version(rawEvidence.hostVersion);
  const counted = base && integer(usage.totalTokens) && integer(rawEvidence.sessionCount)
    && rawEvidence.sessionCount > 0 && rawEvidence.sessionCount <= USAGE_LIMITS.sessions
    && integer(rawEvidence.requestCount) && rawEvidence.requestCount <= USAGE_LIMITS.requests;
  const verified = counted && rawEvidence.status === "verified" && rawEvidence.hostVersion !== "unknown"
    && (rawEvidence.requestCount > 0 || usage.totalTokens === 0)
    && ((invocation?.host === "codex" && rawEvidence.source === "codex-rollout" && rawEvidence.reconciliation === "response-snapshot")
      || (invocation?.host === "claude" && rawEvidence.source === "claude-native" && rawEvidence.reconciliation === "request-records"));
  const transcript = counted && rawEvidence.status === "transcript" && invocation?.host === "claude"
    && rawEvidence.source === "claude-transcript" && rawEvidence.reconciliation === "transcript-messages"
    && claudeCaptureSupported(rawEvidence.hostVersion) && rawEvidence.requestCount > 0;
  let usageEvidence;
  if (verified || transcript) {
    usageEvidence = {
      schemaVersion: 1, status: rawEvidence.status, scope: "step-tree", source: rawEvidence.source,
      hostVersion: rawEvidence.hostVersion, invocation,
      sessionCount: rawEvidence.sessionCount, requestCount: rawEvidence.requestCount,
      reconciliation: rawEvidence.reconciliation,
    };
  } else {
    delete usage.totalTokens;
    const reason = base && rawEvidence.status === "unavailable" && Object.hasOwn(REASONS, rawEvidence.reason)
      ? rawEvidence.reason : "invalid-evidence";
    usageEvidence = unavailableEvidence(reason, base ? { ...rawEvidence, invocation } : {});
  }
  return { ...(Object.keys(usage).length ? { usage } : {}), usageEvidence };
}

// Reader projections never upgrade a legacy scalar or mutate the stored entry.
export function accountingFor(entry) {
  const accounting = normalizeAccounting(entry?.usage, entry?.usageEvidence);
  return { ...accounting, usage: accounting.usage ?? null, tokenScope: accounting.usageEvidence?.status ?? "legacy" };
}

export function usageCoverage(entries) {
  const coverage = { verified: 0, transcript: 0, unavailable: 0, legacy: 0, missing: 0 };
  for (const entry of entries) {
    const accounting = accountingFor(entry);
    if (accounting.tokenScope !== "legacy" || accounting.usage?.totalTokens !== undefined) coverage[accounting.tokenScope]++;
    if (accounting.usage?.totalTokens === undefined) coverage.missing++;
  }
  return coverage;
}

// Null is sticky: an overflow is unavailable, never a smaller selectively accumulated sum.
export function addFigures(total, value) {
  return integer(total) && integer(value) && Number.isSafeInteger(total + value) ? total + value : null;
}

export function usageFigure(entries, key) {
  let total = 0;
  let stepsWithFigures = 0;
  for (const entry of entries) {
    const value = accountingFor(entry).usage?.[key];
    if (!integer(value)) continue;
    total = addFigures(total, value);
    stepsWithFigures++;
  }
  return { total, stepsWithFigures };
}

// Explicit local inputs only: bound reads and reject redirects and replacement during a read.
// `append` reads the prefix present at open and tolerates growth of the same file (a live, append-only log).
// shortcut: elapsed budgets cannot interrupt a filesystem syscall; isolate reads before supporting blocking remote storage.
function readStableFile(file, { root, maxBytes, deadline = Date.now() + USAGE_LIMITS.readMs, append = false }, consume) {
  let fd;
  try {
    const canonicalRoot = fs.realpathSync(root);
    const absolute = path.resolve(file);
    const relative = path.relative(canonicalRoot, absolute);
    if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)
        || fs.realpathSync(absolute) !== absolute) throw new Error();
    const before = fs.lstatSync(absolute);
    if (!before.isFile() || before.size > maxBytes) {
      if (before.isFile() && before.size > maxBytes) throw Object.assign(new Error(), { reason: "resource-limit" });
      throw new Error();
    }
    fd = fs.openSync(absolute, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
    const opened = fs.fstatSync(fd);
    const same = append ? (a, b) => a.dev === b.dev && a.ino === b.ino && b.size >= a.size
      : (a, b) => a.dev === b.dev && a.ino === b.ino && a.size === b.size && a.mtimeMs === b.mtimeMs && a.ctimeMs === b.ctimeMs;
    if (!opened.isFile() || !same(before, opened) || opened.size > maxBytes) {
      if (opened.isFile() && opened.size > maxBytes) throw Object.assign(new Error(), { reason: "resource-limit" });
      throw new Error();
    }
    const bytes = Buffer.alloc(Math.min(opened.size + 1, 65536));
    let length = 0;
    for (;;) {
      if (Date.now() > deadline) throw Object.assign(new Error(), { reason: "resource-limit" });
      const want = append ? Math.min(bytes.length, opened.size - length) : bytes.length;
      if (want === 0) break;
      const count = fs.readSync(fd, bytes, 0, want, null);
      if (count === 0) break;
      length += count;
      if (length > maxBytes) throw Object.assign(new Error(), { reason: "resource-limit" });
      if (length > opened.size) throw new Error();
      consume(bytes.subarray(0, count));
    }
    if (Date.now() > deadline) throw Object.assign(new Error(), { reason: "resource-limit" });
    if (length !== opened.size || !same(opened, fs.fstatSync(fd)) || !same(opened, fs.lstatSync(absolute))
        || fs.realpathSync(absolute) !== absolute) throw new Error();
    return length;
  } catch (error) {
    if (error.accounting) throw error;
    throw Object.assign(new Error(error.reason === "resource-limit" ? REASONS["resource-limit"] : REASONS["unsafe-path"]),
      { reason: error.reason === "resource-limit" ? "resource-limit" : "unsafe-path" });
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

export function readBoundedFile(file, { root, maxBytes = USAGE_LIMITS.fileBytes, deadline } = {}) {
  const chunks = [];
  readStableFile(file, { root, maxBytes, deadline }, chunk => chunks.push(Buffer.from(chunk)));
  return Buffer.concat(chunks).toString("utf8");
}

// Visitors retain derived counters only; no whole transcript is held in memory.
export function readBoundedLines(file, { root, maxBytes, recordBytes, deadline, append = false }, visit) {
  let pending = Buffer.alloc(0);
  const size = readStableFile(file, { root, maxBytes, deadline, append }, chunk => {
    pending = Buffer.concat([pending, chunk]);
    let end;
    while ((end = pending.indexOf(10)) >= 0) {
      if (end > recordBytes) throw Object.assign(new Error(), { reason: "resource-limit", accounting: true });
      const line = pending.subarray(0, end);
      pending = pending.subarray(end + 1);
      if (!line.length) throw Object.assign(new Error(), { reason: "unsupported-schema", accounting: true });
      visit(line.toString("utf8"));
    }
    if (pending.length > recordBytes) throw Object.assign(new Error(), { reason: "resource-limit", accounting: true });
  });
  // A live log may end in a record still being written; its complete prefix is the read.
  if (pending.length && !append) throw Object.assign(new Error(), { reason: "incomplete-capture", accounting: true });
  return size;
}
