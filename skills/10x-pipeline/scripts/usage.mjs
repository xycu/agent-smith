import fs from "node:fs";
import path from "node:path";

export const USAGE_LIMITS = { evidenceBytes: 4096, fileBytes: 65536, readMs: 2000, sessions: 512, requests: 100000 };
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const integer = (value) => Number.isSafeInteger(value) && value >= 0;
const identifier = (value) => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
const SOURCES = new Set(["codex-rollout", "claude-native", "unknown"]);
const REASONS = {
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
    reason: code, explanation: REASONS[code],
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
  let usageEvidence;
  if (base && rawEvidence.status === "verified" && invocation && integer(usage.totalTokens)
      && integer(rawEvidence.sessionCount) && rawEvidence.sessionCount > 0 && rawEvidence.sessionCount <= USAGE_LIMITS.sessions
      && integer(rawEvidence.requestCount) && rawEvidence.requestCount <= USAGE_LIMITS.requests
      && (rawEvidence.requestCount > 0 || usage.totalTokens === 0)
      && rawEvidence.hostVersion !== "unknown"
      && (invocation.host === "codex" ? rawEvidence.source === "codex-rollout" && rawEvidence.reconciliation === "response-snapshot"
        : rawEvidence.source === "claude-native" && rawEvidence.reconciliation === "request-records")) {
    usageEvidence = {
      schemaVersion: 1, status: "verified", scope: "step-tree", source: rawEvidence.source,
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

// Explicit local inputs only: bound allocation and reject file/parent redirects and replacement during a read.
export function readBoundedFile(file, { root, maxBytes = USAGE_LIMITS.fileBytes } = {}) {
  let fd;
  const started = Date.now();
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
    const same = (a, b) => a.dev === b.dev && a.ino === b.ino && a.size === b.size && a.mtimeMs === b.mtimeMs && a.ctimeMs === b.ctimeMs;
    if (!opened.isFile() || !same(before, opened)) throw new Error();
    const bytes = Buffer.alloc(opened.size + 1);
    let length = 0;
    while (length < bytes.length) {
      if (Date.now() - started > USAGE_LIMITS.readMs) throw Object.assign(new Error(), { reason: "resource-limit" });
      const count = fs.readSync(fd, bytes, length, bytes.length - length, null);
      if (count === 0) break;
      length += count;
    }
    if (Date.now() - started > USAGE_LIMITS.readMs) throw Object.assign(new Error(), { reason: "resource-limit" });
    if (length !== opened.size || !same(opened, fs.fstatSync(fd)) || !same(opened, fs.lstatSync(absolute))
        || fs.realpathSync(absolute) !== absolute) throw new Error();
    return bytes.subarray(0, length).toString("utf8");
  } catch (error) {
    throw Object.assign(new Error(error.reason === "resource-limit" ? REASONS["resource-limit"] : REASONS["unsafe-path"]),
      { reason: error.reason === "resource-limit" ? "resource-limit" : "unsafe-path" });
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}
