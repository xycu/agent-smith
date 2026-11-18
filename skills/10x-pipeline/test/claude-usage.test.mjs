// Deterministic native-capture contracts; passing these fixtures does not qualify an interactive or headless host.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { collectClaudeUsage, CLAUDE_USAGE_LIMITS } from "../scripts/claude-usage.mjs";
import { cleanupAll, cleanEnv } from "./helpers.mjs";
import { claudeUsageFixture, eventValue, otelAttribute, setEvent } from "./claude-helpers.mjs";

after(cleanupAll);
const CLI = fileURLToPath(new URL("../scripts/claude-usage.mjs", import.meta.url));
const named = (fixture, name) => fixture.events.filter(event => event.body.stringValue === `claude_code.${name}`);
const key = (event, name) => eventValue(event, name)?.stringValue;
const unavailable = (measurement, reason) => {
  assert.equal(measurement.usage?.totalTokens, undefined);
  assert.equal(measurement.usageEvidence.status, "unavailable");
  if (reason) assert.equal(measurement.usageEvidence.reason, reason);
  assert.doesNotMatch(JSON.stringify(measurement), /private-prompt|\.jsonl|\/Users\//);
};

for (const children of [false, true]) {
  test(`${children ? "step and leaf" : "flat multi-request step"}: exact native request sets count four token buckets once`, () => {
    const fixture = claudeUsageFixture({ children });
    const measured = collectClaudeUsage(fixture.descriptor);
    assert.deepEqual(measured.usage, { toolUses: 4, durationMs: 50, totalTokens: children ? 151 : 117 });
    assert.deepEqual(measured.usageEvidence, { schemaVersion: 1, status: "verified", scope: "step-tree", source: "claude-native",
      hostVersion: "2.1.311", invocation: fixture.descriptor.invocation, sessionCount: children ? 2 : 1,
      requestCount: children ? 4 : 2, reconciliation: "request-records" });
    assert.notEqual(measured.usage.totalTokens, 70, "the final-request footprint is not whole-step usage");
  });
}

test("streamed updates and stable transcript/export duplicates do not become separate requests", () => {
  const fixture = claudeUsageFixture();
  const records = [...fixture.transcripts.values()][0];
  const final = structuredClone(records[1]);
  const partial = structuredClone(final);
  partial.message.usage.output_tokens = 0;
  partial.message.content[0].text = "streaming";
  records.splice(1, 1, partial, final, structuredClone(final));
  records.push(structuredClone(final));
  fixture.events.push(structuredClone(fixture.events[2]));
  const reordered = structuredClone(fixture.events[2]);
  reordered.attributes.reverse();
  reordered.attributes.push(otelAttribute("response", "private-prompt ignored content"));
  fixture.events.push(reordered);
  fixture.write();
  assert.equal(collectClaudeUsage(fixture.descriptor).usage.totalTokens, 151);
});

test("a missing process attribute is unavailable rather than inferred from the session", () => {
  const fixture = claudeUsageFixture();
  fixture.resource.attributes = fixture.resource.attributes.filter(item => item.key !== "process.creation.time");
  fixture.write();
  unavailable(collectClaudeUsage(fixture.descriptor), "missing-identity");
});

test("a zero requires explicit matching native and telemetry request counters", () => {
  const fixture = claudeUsageFixture({ children: false });
  for (const event of named(fixture, "api_request").filter(event => key(event, "agent_id"))) {
    for (const bucket of ["input_tokens", "output_tokens", "cache_read_tokens", "cache_creation_tokens"]) setEvent(event, bucket, 0);
  }
  for (const record of [...fixture.transcripts.values()][0]) {
    if (record.type === "assistant") for (const bucket of Object.keys(record.message.usage)) record.message.usage[bucket] = 0;
  }
  setEvent(named(fixture, "subagent_completed")[0], "total_tokens", 0);
  fixture.native.find(record => record.hook_event_name === "PostToolUse").tool_response.totalTokens = 0;
  fixture.write();
  assert.equal(collectClaudeUsage(fixture.descriptor).usage.totalTokens, 0);
});

test("late exports remain unavailable until terminal and exact request membership reconcile", () => {
  const fixture = claudeUsageFixture();
  const last = named(fixture, "api_request").at(-1);
  fixture.events.splice(fixture.events.indexOf(last), 1);
  fixture.write();
  unavailable(collectClaudeUsage(fixture.descriptor), "incomplete-capture");
  fixture.events.push(last);
  fixture.write();
  assert.equal(collectClaudeUsage(fixture.descriptor).usage.totalTokens, 151);
});

for (const [name, mutate, reason] of [
  ["unsupported host", f => { f.descriptor.hostVersion = "2.1.312"; }, "unsupported-host"],
  ["missing process provenance", f => { delete f.descriptor.process; }, "missing-identity"],
  ["resumed process", f => { f.resource.attributes[0] = otelAttribute("process.pid", 4243); }, "ambiguous-history"],
  ["missing native stop", f => { f.native.splice(f.native.findIndex(record => record.hook_event_name === "SubagentStop"), 1); }, "incomplete-capture"],
  ["resumed agent", f => { f.native[0].tool_input.resume = "old-agent"; }, "ambiguous-history"],
  ["superseded run", f => { f.descriptor.invocation.runId = "old-tool-root"; }, "missing-identity"],
  ["wrong native session", f => { f.native[0].session_id = "wrong-session"; }, "missing-identity"],
  ["wrong native agent", f => { f.native[2].tool_response.agentId = "wrong-agent"; }, "missing-identity"],
  ["foreign event session", f => { setEvent(f.events[2], "session.id", "wrong-session"); }, "ambiguous-history"],
  ["wrong child parent", f => { setEvent(named(f, "api_request").find(event => key(event, "agent_id") === "leaf-agent"), "parent_agent_id", "foreign"); }, "missing-identity"],
  ["internal unexplained agent", f => { setEvent(f.events[2], "agent_id", "internal-agent"); setEvent(f.events[2], "parent_agent_id", "step-agent"); }, "incomplete-capture"],
  ["missing terminal export", f => { f.events.splice(f.events.findIndex(event => event.body.stringValue === "claude_code.subagent_completed"), 1); }, "incomplete-capture"],
  ["missing Agent tool result", f => { setEvent(f.events.at(-1), "tool_name", "Bash"); }, "incomplete-capture"],
  ["failed Agent tool result", f => { setEvent(f.events.at(-1), "success", "false"); }, "incomplete-capture"],
  ["conflicting snapshot", f => { setEvent(f.events[2], "input_tokens", 999); }, "snapshot-mismatch"],
  ["unknown transcript lineage", f => { [...f.transcripts.values()][0][0].parentUuid = "old-history"; }, "ambiguous-history"],
  ["wrong final UUID", f => { setEvent(named(f, "assistant_response").at(-1), "message.uuid", "unknown-final"); }, "snapshot-mismatch"],
]) {
  test(`${name} omits tokens and preserves independent counters`, () => {
    const fixture = claudeUsageFixture();
    mutate(fixture);
    fixture.write();
    const measured = collectClaudeUsage(fixture.descriptor);
    unavailable(measured, reason);
    assert.deepEqual(measured.usage, { toolUses: 4, durationMs: 50 });
  });
}

test("equal sums with different request membership are unavailable", () => {
  const fixture = claudeUsageFixture();
  setEvent(fixture.events[2], "request_id", "another-request");
  fixture.write();
  unavailable(collectClaudeUsage(fixture.descriptor), "snapshot-mismatch");
});

test("an extra assistant response cannot hide an unaccounted request", () => {
  const fixture = claudeUsageFixture();
  const extra = structuredClone(fixture.events[3]);
  setEvent(extra, "event.sequence", fixture.events.length);
  setEvent(extra, "request_id", "unaccounted-request");
  fixture.events.push(extra);
  fixture.write();
  unavailable(collectClaudeUsage(fixture.descriptor), "snapshot-mismatch");
});

test("request and message identity are a bijection, not just equal counters", () => {
  const fixture = claudeUsageFixture({ children: false });
  const assistant = [...fixture.transcripts.values()][0].filter(record => record.type === "assistant");
  assistant[1].message.id = assistant[0].message.id;
  fixture.write();
  unavailable(collectClaudeUsage(fixture.descriptor), "conflicting-duplicate");
});

test("a selected child identity reused by another launch is ambiguous", () => {
  const fixture = claudeUsageFixture();
  for (const record of [structuredClone(fixture.native[3]), structuredClone(fixture.native[5])]) {
    record.tool_use_id = "old-child-run";
    delete record.agent_id;
    fixture.native.push(record);
  }
  fixture.write();
  unavailable(collectClaudeUsage(fixture.descriptor), "ambiguous-history");
});

test("conflicting exports and new-sequence terminal replays never move the boundary", () => {
  const fixture = claudeUsageFixture();
  const duplicate = structuredClone(fixture.events[2]);
  setEvent(duplicate, "input_tokens", 100);
  fixture.events.push(duplicate);
  fixture.write();
  unavailable(collectClaudeUsage(fixture.descriptor), "conflicting-duplicate");
  fixture.events.pop();
  const terminal = structuredClone(fixture.events.at(-1));
  setEvent(terminal, "event.sequence", fixture.events.length);
  fixture.events.push(terminal);
  fixture.write();
  unavailable(collectClaudeUsage(fixture.descriptor), "ambiguous-history");
});

test("missing and unsafe sources, malformed records and resource exhaustion never expose a subtotal", () => {
  const fixture = claudeUsageFixture();
  const file = fixture.descriptor.sources.telemetryFile;
  fs.unlinkSync(file);
  unavailable(collectClaudeUsage(fixture.descriptor), "missing-source");
  fixture.write();
  const bytes = fs.readFileSync(file);
  fs.writeFileSync(file, bytes.subarray(0, bytes.length - 1));
  unavailable(collectClaudeUsage(fixture.descriptor), "incomplete-capture");
  fixture.write();
  const other = path.join(fixture.project.root, "outside-capture");
  fs.copyFileSync(file, other);
  fs.unlinkSync(file);
  fs.symlinkSync(other, file);
  unavailable(collectClaudeUsage(fixture.descriptor), "unsafe-path");
  fs.unlinkSync(file);
  fs.writeFileSync(file, "x".repeat(CLAUDE_USAGE_LIMITS.recordBytes + 1));
  unavailable(collectClaudeUsage(fixture.descriptor), "resource-limit");
  fs.truncateSync(file, CLAUDE_USAGE_LIMITS.bytes + 1);
  unavailable(collectClaudeUsage(fixture.descriptor), "resource-limit");
});

test("agent count, arithmetic overflow and the invocation-wide read budget fail closed", (t) => {
  const fixture = claudeUsageFixture();
  const child = fixture.native.slice(3);
  for (let index = 0; index < CLAUDE_USAGE_LIMITS.agents; index++) {
    const records = structuredClone(child);
    for (const record of records) {
      if (record.tool_use_id) record.tool_use_id = `bulk-tool-${index}`;
      if (record.tool_response) record.tool_response.agentId = `bulk-agent-${index}`;
      if (record.hook_event_name === "SubagentStop") record.agent_id = `bulk-agent-${index}`;
    }
    fixture.native.push(...records);
  }
  fixture.write();
  unavailable(collectClaudeUsage(fixture.descriptor), "resource-limit");
  fixture.native.splice(6);
  setEvent(fixture.events[2], "input_tokens", Number.MAX_SAFE_INTEGER);
  fixture.write();
  unavailable(collectClaudeUsage(fixture.descriptor), "resource-limit");
  let calls = 0;
  t.mock.method(Date, "now", () => calls++ ? CLAUDE_USAGE_LIMITS.readMs + 1 : 0);
  unavailable(collectClaudeUsage(fixture.descriptor), "resource-limit");
});

test("immediate, late and archive boundaries use the same read-only collector", () => {
  for (const [chain, step, n] of [["10x", "plan", 1], ["openspec", "os-propose", 1], ["10x", "archive", null], ["openspec", "os-archive", null]]) {
    const fixture = claudeUsageFixture({ chain, step, n });
    const before = fs.readFileSync(fixture.descriptor.sources.telemetryFile);
    const measured = collectClaudeUsage(fixture.descriptor);
    const result = spawnSync(process.execPath, [CLI], { cwd: fixture.project.root, env: cleanEnv(), input: JSON.stringify(fixture.descriptor), encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), measured);
    assert.equal(result.stderr, "");
    assert.equal(measured.usage.totalTokens, 151);
    assert.deepEqual(fs.readFileSync(fixture.descriptor.sources.telemetryFile), before);
  }
});

test("unavailable CLI and malformed import boundaries are successful measurements without step-authored tokens", () => {
  for (const descriptor of [null, [], 42, {}, { usage: { totalTokens: 999, durationMs: 2 } }]) unavailable(collectClaudeUsage(descriptor));
  const result = spawnSync(process.execPath, [CLI], { input: "private-prompt malformed", encoding: "utf8" });
  assert.equal(result.status, 0);
  unavailable(JSON.parse(result.stdout), "unsupported-schema");
  assert.equal(result.stderr, "");
  const large = spawnSync(process.execPath, [CLI], { input: "x".repeat(CLAUDE_USAGE_LIMITS.descriptorBytes + 1), encoding: "utf8" });
  assert.equal(large.status, 0);
  unavailable(JSON.parse(large.stdout), "resource-limit");
});

test("the CLI decodes a Unicode source path across arbitrary descriptor chunk boundaries", () => {
  const fixture = claudeUsageFixture();
  const file = path.join(fixture.descriptor.sources.root, "otel-zażółć.jsonl");
  fs.renameSync(fixture.descriptor.sources.telemetryFile, file);
  fixture.descriptor.sources.telemetryFile = file;
  const wrapper = `
    import { Readable } from "node:stream";
    const bytes = Buffer.from(${JSON.stringify(JSON.stringify(fixture.descriptor))});
    Object.defineProperty(process, "stdin", { value: Readable.from(Array.from(bytes, byte => Buffer.from([byte])), { objectMode: false }) });
    process.argv[1] = ${JSON.stringify(CLI)};
    await import(${JSON.stringify(new URL("../scripts/claude-usage.mjs", import.meta.url).href)});
  `;
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", wrapper], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).usage.totalTokens, 151);
});

test("an unfinished descriptor stream reaches the fixed deadline without waiting for telemetry", async (t) => {
  const child = spawn(process.execPath, [CLI], { stdio: ["pipe", "pipe", "pipe"] });
  t.after(() => child.kill("SIGKILL"));
  let output = "";
  child.stdout.on("data", chunk => { output += chunk; });
  const code = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { child.kill("SIGKILL"); reject(new Error("collector descriptor timeout did not fire")); }, 10000);
    child.once("error", error => { clearTimeout(timer); reject(error); });
    child.once("close", code => { clearTimeout(timer); resolve(code); });
  });
  assert.equal(code, 0);
  unavailable(JSON.parse(output), "resource-limit");
});
