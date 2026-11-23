// Hand-authored accounting contracts; these fixtures do not qualify a live host.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { cleanUsage, normalizeAccounting, unavailableEvidence, readBoundedFile, USAGE_LIMITS } from "../scripts/usage.mjs";
import { cleanupAll, makeProject } from "./helpers.mjs";

after(cleanupAll);
const invocation = { host: "codex", rootThreadId: "root", rootTurnId: "turn" };
const verified = { schemaVersion: 1, status: "verified", scope: "step-tree", source: "codex-rollout", hostVersion: "0.169.0",
  invocation, sessionCount: 2, requestCount: 4, reconciliation: "response-snapshot" };

test("legacy usage remains numeric, safe, and distinct from missing or measured zero", () => {
  assert.equal(cleanUsage(null), null);
  assert.deepEqual(normalizeAccounting({ totalTokens: 0, toolUses: 2, durationMs: -1, ignored: "raw" }),
    { usage: { totalTokens: 0, toolUses: 2 } });
  assert.deepEqual(normalizeAccounting({ totalTokens: Number.MAX_SAFE_INTEGER + 1 }), {});
  assert.deepEqual(normalizeAccounting(undefined), {});
  assert.deepEqual(normalizeAccounting({ totalTokens: 0 }, verified), { usage: { totalTokens: 0 }, usageEvidence: verified });
});

test("verified evidence keeps only bounded fields and never persists raw source content", () => {
  const result = normalizeAccounting({ totalTokens: 42, durationMs: 50, raw: "private-transcript" },
    { ...verified, prompt: "private-transcript", path: "/private/source", invocation: { ...invocation, raw: "private-transcript" } });
  assert.deepEqual(result, { usage: { totalTokens: 42, durationMs: 50 }, usageEvidence: verified });
  assert.doesNotMatch(JSON.stringify(result), /private/);
});

test("malformed or overflowing evidence removes tokens without erasing independent counters", () => {
  for (const evidence of [null, [], "private-transcript", {},
    { ...verified, schemaVersion: 2 }, { ...verified, scope: "query" },
    { ...verified, source: "private-transcript" }, { ...verified, hostVersion: "x".repeat(33) },
    { ...verified, invocation: { ...invocation, rootTurnId: "/private/source" } },
    { ...verified, invocation: null }, { ...verified, sessionCount: 0 },
    { ...verified, sessionCount: USAGE_LIMITS.sessions + 1 },
    { ...verified, requestCount: 0 },
    { ...verified, requestCount: Number.MAX_SAFE_INTEGER + 1 },
    { ...verified, requestCount: USAGE_LIMITS.requests + 1 },
    { ...verified, reconciliation: "private-transcript" },
    { ...verified, raw: "private-transcript".repeat(USAGE_LIMITS.evidenceBytes) },
    { ...verified, source: "claude-native", reconciliation: "request-records" },
  ]) {
    const result = normalizeAccounting({ totalTokens: 42, durationMs: 3, toolUses: 0 }, evidence);
    assert.deepEqual(result.usage, { durationMs: 3, toolUses: 0 });
    assert.equal(result.usageEvidence.status, "unavailable");
    assert.equal(result.usageEvidence.reason, "invalid-evidence");
    assert.doesNotMatch(JSON.stringify(result), /private-transcript|\/private\/source/);
  }
  assert.equal(normalizeAccounting({}, verified).usageEvidence.status, "unavailable");
});

test("unavailable evidence records a stable reason, preserves exact attribution, and ignores raw explanations", () => {
  const evidence = unavailableEvidence("incomplete-capture", verified);
  assert.deepEqual(evidence.invocation, invocation);
  const result = normalizeAccounting({ totalTokens: 99, toolUses: 4 }, { ...evidence, explanation: "/private/source secret prompt" });
  assert.deepEqual(result, { usage: { toolUses: 4 }, usageEvidence: evidence });
  assert.equal(Object.hasOwn(unavailableEvidence("missing-identity"), "invocation"), false);
  assert.equal(unavailableEvidence("/private/source").reason, "invalid-evidence");
});

test("Claude identities require an exact run boundary, not just an agent or repeated description", () => {
  const evidence = { ...verified, source: "claude-native", hostVersion: "2.1.311", reconciliation: "request-records",
    invocation: { host: "claude", sessionId: "session", agentId: "agent", runId: "run" } };
  assert.equal(normalizeAccounting({ totalTokens: 42 }, evidence).usageEvidence.status, "verified");
  delete evidence.invocation.runId;
  assert.equal(normalizeAccounting({ totalTokens: 42 }, evidence).usageEvidence.status, "unavailable");
});

test("bounded regular inputs accept the limit and reject redirects, outside roots, and excess bytes", () => {
  const p = makeProject();
  const file = path.join(p.root, "usage.json");
  fs.writeFileSync(file, "x".repeat(USAGE_LIMITS.fileBytes));
  assert.equal(readBoundedFile(file, { root: p.root }).length, USAGE_LIMITS.fileBytes);
  fs.appendFileSync(file, "x");
  assert.throws(() => readBoundedFile(file, { root: p.root }), { reason: "resource-limit" });
  const link = path.join(p.root, "redirect");
  fs.symlinkSync(file, link);
  assert.throws(() => readBoundedFile(link, { root: p.root }), { reason: "unsafe-path" });
  assert.throws(() => readBoundedFile(file, { root: p.changeDir }), { reason: "unsafe-path" });
  assert.throws(() => readBoundedFile(p.changeDir, { root: p.root }), { reason: "unsafe-path" });
  const directoryLink = path.join(p.root, "directory-link");
  fs.symlinkSync(p.changeDir, directoryLink);
  fs.writeFileSync(path.join(p.changeDir, "source"), "{}");
  assert.throws(() => readBoundedFile(path.join(directoryLink, "source"), { root: p.root }), { reason: "unsafe-path" });
});

test("a source that changes during reading is rejected without exposing its contents", (t) => {
  const p = makeProject();
  const file = path.join(p.root, "source");
  fs.writeFileSync(file, "private-source");
  const read = fs.readSync;
  t.mock.method(fs, "readSync", (...args) => {
    const count = read(...args);
    fs.appendFileSync(file, "changed");
    return count;
  });
  assert.throws(() => readBoundedFile(file, { root: p.root }), { reason: "unsafe-path" });
});
