// Reconstructed fixtures for pinned source d32063f96c2dff1dc96af839b3952abb6acfeda4; no live-host qualification.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { collectCodexUsage, CODEX_USAGE_LIMITS } from "../scripts/codex-usage.mjs";
import { cleanupAll, makeProject } from "./helpers.mjs";
import { codexUsageRecords } from "./codex-helpers.mjs";

after(cleanupAll);
const small = { input_tokens: 20, output_tokens: 2 };
function fixture({ children = [], usages } = {}) {
  const project = makeProject();
  const rootThreadId = "root-fixture";
  const codexHome = path.join(project.root, "host");
  const files = {};
  const records = {};
  const threads = [rootThreadId, ...children].map(id => {
    const parentThreadId = id === rootThreadId ? null : rootThreadId;
    const file = path.join(codexHome, id.startsWith("archived") ? "archived_sessions" : "sessions", id + ".jsonl");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    files[id] = file;
    records[id] = codexUsageRecords({ id, rootId: rootThreadId, parentId: parentThreadId,
      ...(usages?.[id] ? { usages: usages[id] } : id === rootThreadId ? {} : { usages: [small] }) });
    fs.writeFileSync(file, records[id].map(record => JSON.stringify(record)).join("\n") + "\n");
    return { id, turn: { id: "turn-" + id, rootTurnId: "turn-root-fixture", status: "completed", completedAt: 20 },
      metadata: { id, parentThreadId, sessionId: rootThreadId, forkedFromId: null, cliVersion: "0.169.0", path: file } };
  });
  const input = { rootThreadId, codexHome, threads };
  return { project, input, records, files, write(id = rootThreadId) {
    fs.writeFileSync(files[id], records[id].map(record => JSON.stringify(record)).join("\n") + "\n");
  } };
}
const unavailable = (value, reason) => {
  assert.equal(value.usage, undefined);
  assert.equal(value.usageEvidence.status, "unavailable");
  assert.equal(value.usageEvidence.reason, reason);
  assert.doesNotMatch(JSON.stringify(value), /private-source|private-prompt|\.jsonl|\/Users\//);
};

test("flat and multi-request archived child records reconcile once with cache/reasoning as subsets", () => {
  const f = fixture({ children: ["child", "archived-child"], usages: { child: [small, { input_tokens: 30, output_tokens: 3 }] } });
  const measured = collectCodexUsage(f.input);
  assert.equal(measured.usage.totalTokens, 187, "root 110 + child 22 + 33 + archived 22");
  assert.deepEqual(measured.usageEvidence, { schemaVersion: 1, status: "verified", scope: "step-tree", source: "codex-rollout",
    hostVersion: "0.169.0", invocation: { host: "codex", rootThreadId: "root-fixture", rootTurnId: "turn-root-fixture" },
    sessionCount: 3, requestCount: 4, reconciliation: "response-snapshot" });
  assert.equal(collectCodexUsage({ ...f.input, execUsage: { input_tokens: 100, output_tokens: 10 } }).usage.totalTokens, 187,
    "missing optional primary subsets do not contradict the source");
});

test("stable response duplicates, even after the terminal marker, add nothing", () => {
  const f = fixture();
  f.records["root-fixture"].push(structuredClone(f.records["root-fixture"][2]));
  f.write();
  const measured = collectCodexUsage(f.input);
  assert.equal(measured.usage.totalTokens, 110);
  assert.equal(measured.usageEvidence.requestCount, 1);
});

test("a conflicting duplicate cannot supply a total", () => {
  const f = fixture();
  const duplicate = structuredClone(f.records["root-fixture"][2]);
  duplicate.payload.usage.cached_input_tokens = 1;
  f.records["root-fixture"].push(duplicate);
  f.write();
  unavailable(collectCodexUsage(f.input), "conflicting-duplicate");
});

test("an attributable explicit zero is measured; empty/default-zero capture is unavailable", () => {
  const f = fixture({ usages: { "root-fixture": [{ input_tokens: 0, output_tokens: 0 }] } });
  assert.equal(collectCodexUsage(f.input).usage.totalTokens, 0);
  f.records["root-fixture"].splice(2, 1);
  f.write();
  unavailable(collectCodexUsage(f.input), "incomplete-capture");
});

for (const [label, alter, reason] of [
  ["missing first response with final snapshot retained", f => f.records["root-fixture"].splice(2, 1), "snapshot-mismatch"],
  ["missing terminal", f => f.records["root-fixture"].pop(), "incomplete-capture"],
  ["foreign causal root", f => { f.records["root-fixture"][2].payload.root_turn_id = "foreign"; }, "missing-identity"],
  ["foreign actual thread", f => { f.records["root-fixture"][2].payload.thread_id = "foreign"; }, "missing-identity"],
  ["foreign session", f => { f.records["root-fixture"][2].payload.session_id = "foreign"; }, "missing-identity"],
  ["inherited root history", f => { f.input.threads[0].metadata.forkedFromId = "old"; }, "ambiguous-history"],
  ["unsupported version", f => { f.input.threads[0].metadata.cliVersion = "0.170.0"; }, "unsupported-host"],
  ["unsupported record schema", f => { f.records["root-fixture"][2].payload.usage.input_tokens = "100"; }, "unsupported-schema"],
  ["snapshot conflict", f => { f.records["root-fixture"].at(-2).payload.info.total_token_usage.output_tokens = 1; }, "snapshot-mismatch"],
  ["resumed root turn", f => { f.records["root-fixture"].push(...f.records["root-fixture"].slice(1)); }, "ambiguous-history"],
]) {
  test(`${label} omits all tokens`, () => {
    const f = fixture({ usages: { "root-fixture": [small, { input_tokens: 30, output_tokens: 3 }] } });
    alter(f);
    f.write();
    unavailable(collectCodexUsage(f.input), reason);
  });
}

test("collaboration without an accounted child tree and usage-only metadata errors fail closed", () => {
  const f = fixture();
  unavailable(collectCodexUsage({ ...f.input, delegated: true }), "incomplete-capture");
  unavailable(collectCodexUsage({ ...f.input, metadataReason: "missing-source" }), "missing-source");
  unavailable(collectCodexUsage({ ...f.input, execUsage: { input_tokens: -1, output_tokens: 2 } }), "unsupported-schema");
});

test("a reported incomplete response remains observed usage when its host counters reconcile", () => {
  const f = fixture({ usages: { "root-fixture": [small, { input_tokens: 4, output_tokens: 1 }] } });
  f.records["root-fixture"].splice(3, 0, { type: "response_item", payload: { type: "message", status: "incomplete" } });
  f.write();
  assert.equal(collectCodexUsage(f.input).usage.totalTokens, 27);
});

for (const paginated of [false, true]) {
  test(`a ${paginated ? "paginated" : "legacy"} copied child prefix has an exact own-thread boundary`, () => {
    const f = fixture({ children: ["child"] });
    const child = f.input.threads[1];
    child.metadata.forkedFromId = "root-fixture";
    const own = f.records.child;
    own[0].payload.forked_from_id = "root-fixture";
    own.splice(1, 0, structuredClone(f.records["root-fixture"][1]), structuredClone(f.records["root-fixture"][2]));
    if (paginated) {
      own[0].payload.history_mode = "paginated";
      own[0].payload.subagent_history_start_ordinal = 3;
      own.forEach((record, ordinal) => { record.ordinal = ordinal; });
    }
    f.write("child");
    assert.equal(collectCodexUsage(f.input).usage.totalTokens, 132);
    own[2].payload.thread_id = "child";
    f.write("child");
    unavailable(collectCodexUsage(f.input), "ambiguous-history");
  });
}

test("unknown child history references and discontinuous ordinals are unavailable", () => {
  const f = fixture({ children: ["child"] });
  f.records.child[0].payload.history_base = { thread_id: "private-source", end_ordinal_exclusive: 8 };
  f.write("child");
  unavailable(collectCodexUsage(f.input), "ambiguous-history");
  delete f.records.child[0].payload.history_base;
  f.records.child[0].payload.history_mode = "paginated";
  f.records.child.forEach((record, ordinal) => { record.ordinal = ordinal; });
  f.records.child[2].ordinal++;
  f.write("child");
  unavailable(collectCodexUsage(f.input), "ambiguous-history");
});

test("missing, redirected, outside-root, replaced and truncated sources expose bounded reasons", (t) => {
  const f = fixture();
  const file = f.files["root-fixture"];
  fs.unlinkSync(file);
  unavailable(collectCodexUsage(f.input), "missing-source");
  f.write();
  const external = path.join(f.project.root, "private-source");
  fs.copyFileSync(file, external);
  f.input.threads[0].metadata.path = external;
  unavailable(collectCodexUsage(f.input), "unsafe-path");
  f.input.threads[0].metadata.path = file;
  fs.unlinkSync(file);
  fs.symlinkSync(external, file);
  unavailable(collectCodexUsage(f.input), "unsafe-path");
  fs.unlinkSync(file);
  f.write();
  const bytes = fs.readFileSync(file);
  fs.writeFileSync(file, bytes.subarray(0, bytes.length - 1));
  unavailable(collectCodexUsage(f.input), "incomplete-capture");
  f.write();
  const read = fs.readSync;
  t.mock.method(fs, "readSync", (...args) => {
    const count = read(...args);
    fs.appendFileSync(file, "private-prompt");
    return count;
  });
  unavailable(collectCodexUsage(f.input), "unsafe-path");
});

test("fixed record, invocation-byte, session and read-time limits refuse without subtotals", () => {
  const f = fixture();
  const file = f.files["root-fixture"];
  fs.writeFileSync(file, "x".repeat(CODEX_USAGE_LIMITS.recordBytes + 1));
  unavailable(collectCodexUsage(f.input), "resource-limit");
  fs.truncateSync(file, CODEX_USAGE_LIMITS.bytes + 1);
  unavailable(collectCodexUsage(f.input), "resource-limit");
  f.write();
  unavailable(collectCodexUsage({ ...f.input, threads: Array.from({ length: CODEX_USAGE_LIMITS.sessions + 1 }, () => f.input.threads[0]) }), "resource-limit");
  unavailable(collectCodexUsage({ ...f.input, deadline: Date.now() - 1 }), "resource-limit");
});

test("token sums cannot overflow safe integer arithmetic", () => {
  const f = fixture({ usages: { "root-fixture": [{ input_tokens: Number.MAX_SAFE_INTEGER, output_tokens: 1 }] } });
  unavailable(collectCodexUsage(f.input), "resource-limit");
});
