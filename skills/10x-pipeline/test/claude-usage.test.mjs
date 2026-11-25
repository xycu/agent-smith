// Deterministic native-capture contracts; passing these fixtures does not qualify an interactive or headless host.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { claudeCaptureCheckpoint, collectClaudeUsage, CLAUDE_USAGE_LIMITS } from "../scripts/claude-usage.mjs";
import { claudeTranscriptReadiness } from "../scripts/claude-transcript.mjs";
import { captureFile } from "../scripts/claude-capture-data.mjs";
import { cleanupAll, cleanEnv } from "./helpers.mjs";
import { boundClaudeFixture, claudeUsageFixture, transcriptFixture, eventValue, otelAttribute, setEvent } from "./claude-helpers.mjs";

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
  ["unsupported host", f => { f.descriptor.hostVersion = "2.1.310"; }, "unsupported-host"],
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
  const extra = structuredClone(named(fixture, "assistant_response").at(-1));
  setEvent(extra, "event.sequence", fixture.events.length);
  setEvent(extra, "request_id", "unaccounted-request");
  fixture.events.push(extra);
  fixture.write();
  unavailable(collectClaudeUsage(fixture.descriptor), "snapshot-mismatch");
});

test("decimal-string OTLP integers and text responses on earlier requests remain supported", () => {
  const fixture = claudeUsageFixture();
  for (const event of named(fixture, "api_request").filter(event => key(event, "agent_id"))) {
    const request = key(event, "request_id");
    if (named(fixture, "assistant_response").some(response => key(response, "request_id") === request)) continue;
    const response = structuredClone(event);
    response.body.stringValue = "claude_code.assistant_response";
    setEvent(response, "message.uuid", `${key(event, "agent_id")}-answer-0`);
    fixture.events.splice(fixture.events.indexOf(event) + 1, 0, response);
  }
  fixture.events.forEach((event, sequence) => setEvent(event, "event.sequence", sequence));
  for (const attr of [...fixture.resource.attributes, ...fixture.events.flatMap(event => event.attributes)]) {
    if (Object.hasOwn(attr.value, "intValue")) attr.value.intValue = String(attr.value.intValue);
  }
  fixture.write();
  assert.equal(collectClaudeUsage(fixture.descriptor).usage.totalTokens, 151);
});

for (const value of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1, "1.5", "-1", "9007199254740992"]) {
  test(`unsafe OTLP intValue ${value} is unavailable`, () => {
    const fixture = claudeUsageFixture();
    eventValue(fixture.events[0], "event.sequence").intValue = value;
    fixture.write();
    unavailable(collectClaudeUsage(fixture.descriptor), "unsupported-schema");
  });
}

for (const [name, mutate] of [
  ["broken", records => { records.find(record => record.type === "attachment").parentUuid = "missing"; }],
  ["cyclic", records => { records.find(record => record.type === "attachment").parentUuid = records[1].uuid; }],
  // A branch that reaches the chain is tolerated (async launch tests); an entry with no path to it is not.
  ["disconnected", records => { records.push({ ...records.at(-1), uuid: "disconnected", parentUuid: null }); }],
  ["wrong launch prompt", records => { records[0].message.content = "different prompt"; }],
]) {
  test(`${name} attachment history cannot establish invocation coverage`, () => {
    const fixture = claudeUsageFixture();
    mutate([...fixture.transcripts.values()][0]);
    fixture.write();
    unavailable(collectClaudeUsage(fixture.descriptor), "ambiguous-history");
  });
}

test("tool-only requests still require complete membership and settle the final request by sequence", () => {
  const fixture = claudeUsageFixture();
  const first = named(fixture, "api_request").find(event => key(event, "agent_id") === "leaf-agent");
  fixture.events.splice(fixture.events.indexOf(first), 1);
  fixture.events.forEach((event, sequence) => setEvent(event, "event.sequence", sequence));
  fixture.write();
  unavailable(collectClaudeUsage(fixture.descriptor), "snapshot-mismatch");
  const complete = claudeUsageFixture();
  const terminal = named(complete, "assistant_response").at(-1);
  complete.events.splice(complete.events.indexOf(terminal), 1);
  complete.events.forEach((event, sequence) => setEvent(event, "event.sequence", sequence));
  complete.write();
  const measured = collectClaudeUsage(complete.descriptor);
  assert.equal(measured.usageEvidence.status, "verified");
  assert.equal(measured.usage.totalTokens, 151);
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

for (const children of [false, true]) {
  test(`bound capture proves ${children ? "step and leaf" : "flat step"} using the checkpoint CLI`, () => {
    const f = boundClaudeFixture({ children });
    const checkpoint = spawnSync(process.execPath, [CLI, "checkpoint"], { env: { ...cleanEnv(), ...f.env }, encoding: "utf8" });
    assert.equal(checkpoint.status, 0, checkpoint.stderr);
    assert.deepEqual(JSON.parse(checkpoint.stdout), { sessionId: f.binding.sessionId, offset: 0 });
    f.write();
    const descriptor = { ...f.descriptor, checkpoint: JSON.parse(checkpoint.stdout), invocation: { host: "claude", agentId: "step-agent" } };
    const result = spawnSync(process.execPath, [CLI], {
      env: { ...cleanEnv(), ...f.env }, encoding: "utf8", input: JSON.stringify(descriptor),
    });
    assert.equal(result.status, 0);
    const measured = JSON.parse(result.stdout);
    assert.equal(measured.usage.totalTokens, children ? 151 : 117);
    assert.equal(measured.usageEvidence.status, "verified");
    assert.deepEqual(measured.usageEvidence.invocation, { host: "claude", sessionId: f.binding.sessionId, agentId: "step-agent", runId: "tool-root" });
  });
}

test("checkpoint refuses competing top-level launches even with an observed agent and different descriptions", () => {
  const f = boundClaudeFixture({ children: false });
  const checkpoint = claudeCaptureCheckpoint(f.env);
  const competitor = structuredClone(f.native[0]);
  competitor.tool_use_id = "competing-launch";
  competitor.tool_input.description = "different description";
  f.native.push(competitor);
  f.write();
  const descriptor = { ...f.descriptor, invocation: { host: "claude", agentId: "step-agent" } };
  const ambiguous = collectClaudeUsage({ ...descriptor, checkpoint }, f.env, "step-agent");
  unavailable(ambiguous, "ambiguous-history");
  assert.equal(ambiguous.usageEvidence.invocation, undefined);
  assert.equal(collectClaudeUsage({ ...descriptor, invocation: { ...descriptor.invocation, runId: "tool-root" } }, f.env).usage.totalTokens, 117);
});

test("a malformed launch observation never opens a source or becomes accounting identity", t => {
  const f = boundClaudeFixture();
  const checkpoint = claudeCaptureCheckpoint(f.env);
  const open = t.mock.method(fs, "openSync", () => { throw new Error("unexpected read"); });
  for (const mode of ["transcript", "telemetry"]) {
    for (const id of [true, "", "compound:id", "a/b", "a".repeat(129)]) {
      const result = collectClaudeUsage({ mode, router: f.descriptor.router, checkpoint }, f.env, id);
      unavailable(result, "missing-identity");
      assert.equal(result.usageEvidence.invocation, undefined);
    }
  }
  assert.equal(open.mock.callCount(), 0);
});

test("checkpoint boundaries cannot attribute an earlier retry or a guessed offset", () => {
  const f = boundClaudeFixture({ children: false });
  const opening = claudeCaptureCheckpoint(f.env);
  f.write();
  const settled = claudeCaptureCheckpoint(f.env);
  assert.ok(settled.offset > opening.offset);
  for (const checkpoint of [settled, { ...opening, offset: 1 }, { ...opening, sessionId: "different-session" }]) {
    unavailable(collectClaudeUsage({ ...f.descriptor, checkpoint }, f.env), "missing-identity");
  }
});

test("late bound capture preserves the observed invocation before the full prefix arrives", () => {
  const f = boundClaudeFixture();
  const checkpoint = claudeCaptureCheckpoint(f.env);
  const pending = f.events.splice(2, 1)[0];
  f.write();
  const initial = collectClaudeUsage({ ...f.descriptor, checkpoint }, f.env);
  unavailable(initial, "incomplete-capture");
  assert.deepEqual(initial.usage, { toolUses: 4, durationMs: 50 });
  assert.equal(initial.usageEvidence.invocation.runId, "tool-root");
  f.events.push(pending);
  f.write();
  const delayed = collectClaudeUsage({ ...f.descriptor, invocation: initial.usageEvidence.invocation }, f.env);
  assert.equal(delayed.usage.totalTokens, 151);
  assert.deepEqual(delayed.usageEvidence.invocation, initial.usageEvidence.invocation);
});

test("bound files and session transcripts reject a symlink or an out-of-session path", () => {
  const f = boundClaudeFixture({ children: false });
  const descriptor = { ...f.descriptor, checkpoint: claudeCaptureCheckpoint(f.env) };
  f.write();
  const transcript = [...f.transcripts.keys()][0];
  const other = path.join(f.project.root, "outside-transcript");
  fs.renameSync(transcript, other);
  fs.symlinkSync(other, transcript);
  unavailable(collectClaudeUsage(descriptor, f.env), "unsafe-path");
  const stop = f.native.find(record => record.hook_event_name === "SubagentStop");
  stop.agent_transcript_path = other;
  f.transcripts.delete(transcript);
  f.write();
  unavailable(collectClaudeUsage(descriptor, f.env), "unsafe-path");
  const telemetry = captureFile(f.root, "telemetry");
  const outside = path.join(f.project.root, "outside-telemetry");
  fs.renameSync(telemetry, outside);
  fs.symlinkSync(outside, telemetry);
  unavailable(collectClaudeUsage(descriptor, f.env), "unsafe-path");
});

test("default-off, a failed opt-in and unsupported host are distinct and explicit sources stay readable", () => {
  const f = boundClaudeFixture({ children: false });
  const off = collectClaudeUsage(f.descriptor, {});
  unavailable(off, "capture-disabled");
  assert.match(off.usageEvidence.explanation, /node <absolute-plugin-scripts>\/claude-capture.mjs/);
  unavailable(collectClaudeUsage(f.descriptor, { ...f.env, AGENT_SMITH_CLAUDE_CAPTURE: path.join(f.root, "missing") }), "missing-source");
  fs.writeFileSync(captureFile(f.root, "binding"), JSON.stringify({ ...f.binding, hostVersion: "2.1.310" }));
  unavailable(collectClaudeUsage(f.descriptor, f.env), "unsupported-host");
  assert.equal(collectClaudeUsage(claudeUsageFixture().descriptor, f.env).usage.totalTokens, 151);
});

const resequence = fixture => fixture.events.forEach((event, sequence) => setEvent(event, "event.sequence", sequence));
const stepEvent = (fixture, name) => named(fixture, name).find(event => key(event, "agent_id") === "step-agent");
const stepRecords = fixture => [...fixture.transcripts.values()][0];

test("async launch: verifies the root from stop, completion and transcript, counting a telemetry-only request", () => {
  const fixture = claudeUsageFixture({ async: true, telemetryOnly: "response" });
  assert.equal(fixture.native[2].tool_response.status, "async_launched");
  assert.equal(fixture.native[2].tool_response.totalTokens, undefined);
  const measured = collectClaudeUsage(fixture.descriptor);
  assert.deepEqual(measured.usage, { toolUses: 4, durationMs: 50, totalTokens: 155 });
  assert.deepEqual(measured.usageEvidence, { schemaVersion: 1, status: "verified", scope: "step-tree", source: "claude-native",
    hostVersion: "2.1.311", invocation: fixture.descriptor.invocation, sessionCount: 2, requestCount: 5, reconciliation: "request-records" });
});

test("async launch: verifies a telemetry-only request on a synchronous root and on a child run", () => {
  const sync = collectClaudeUsage(claudeUsageFixture({ telemetryOnly: "response" }).descriptor);
  assert.equal(sync.usageEvidence.status, "verified");
  assert.equal(sync.usage.totalTokens, 155);
  const fixture = claudeUsageFixture({ async: true });
  const leaf = named(fixture, "api_request").find(event => key(event, "agent_id") === "leaf-agent");
  const answer = named(fixture, "assistant_response").find(event => key(event, "agent_id") === "leaf-agent");
  const side = structuredClone(leaf);
  setEvent(side, "request_id", "leaf-agent-side-query");
  const sideAnswer = structuredClone(answer);
  setEvent(sideAnswer, "request_id", "leaf-agent-side-query");
  setEvent(sideAnswer, "message.uuid", "leaf-agent-side-answer");
  fixture.events.splice(fixture.events.indexOf(named(fixture, "subagent_completed")[0]), 0, side, sideAnswer);
  resequence(fixture);
  fixture.write();
  const measured = collectClaudeUsage(fixture.descriptor);
  assert.equal(measured.usageEvidence.status, "verified");
  assert.equal(measured.usage.totalTokens, 166);
});

test("async launch: unavailable when a telemetry-only request has no response event", () => {
  unavailable(collectClaudeUsage(claudeUsageFixture({ async: true, telemetryOnly: true }).descriptor), "ambiguous-history");
});

test("async launch: unavailable when telemetry-only counts overflow", () => {
  const fixture = claudeUsageFixture({ async: true, telemetryOnly: "response" });
  const side = named(fixture, "api_request").find(event => key(event, "request_id") === "step-agent-side-query");
  setEvent(side, "input_tokens", Number.MAX_SAFE_INTEGER);
  fixture.write();
  unavailable(collectClaudeUsage(fixture.descriptor), "resource-limit");
});

test("async launch: verifies a flat root without children", () => {
  const measured = collectClaudeUsage(claudeUsageFixture({ async: true, children: false }).descriptor);
  assert.equal(measured.usageEvidence.status, "verified");
  assert.equal(measured.usage.totalTokens, 117);
});

test("async launch: verifies a null stop hash when the final response has empty text", () => {
  const fixture = claudeUsageFixture({ async: true, nullStop: true });
  assert.equal(fixture.native[1].last_assistant_message, undefined);
  const measured = collectClaudeUsage(fixture.descriptor);
  assert.equal(measured.usageEvidence.status, "verified");
  assert.equal(measured.usage.totalTokens, 151);
});

test("async launch: unavailable when a null stop hash meets a non-empty final response", () => {
  const fixture = claudeUsageFixture({ async: true, nullStop: true });
  stepRecords(fixture).find(record => record.uuid === "step-agent-answer-1").message.content[0].text = "private-prompt text the stop never carried";
  fixture.write();
  unavailable(collectClaudeUsage(fixture.descriptor), "incomplete-capture");
});

test("async launch: unavailable when a synchronous root or a child run has a null stop hash", () => {
  unavailable(collectClaudeUsage(claudeUsageFixture({ nullStop: true }).descriptor), "incomplete-capture");
  const fixture = claudeUsageFixture({ async: true });
  const stop = fixture.native.find(record => record.hook_event_name === "SubagentStop" && record.agent_id === "leaf-agent");
  delete stop.last_assistant_message;
  [...fixture.transcripts.values()][1].find(record => record.uuid === "leaf-agent-answer-1").message.content[0].text = "";
  fixture.write();
  unavailable(collectClaudeUsage(fixture.descriptor), "incomplete-capture");
});

test("async launch: verifies a launched root with any status other than completed", () => {
  const fixture = claudeUsageFixture({ async: true });
  fixture.native[2].tool_response = { status: "failed", agentId: "step-agent" };
  fixture.write();
  const measured = collectClaudeUsage(fixture.descriptor);
  assert.equal(measured.usageEvidence.status, "verified");
  assert.equal(measured.usage.totalTokens, 151);
});

test("async launch: verifies a tool-only final request settled by sequence", () => {
  const fixture = claudeUsageFixture({ async: true, nullStop: true });
  fixture.events.splice(fixture.events.indexOf(named(fixture, "assistant_response").at(-1)), 1);
  resequence(fixture);
  fixture.write();
  const measured = collectClaudeUsage(fixture.descriptor);
  assert.equal(measured.usageEvidence.status, "verified");
  assert.equal(measured.usage.totalTokens, 151);
});

test("async launch: verifies a branch attachment off the chain", () => {
  const fixture = claudeUsageFixture({ async: true, branch: true });
  assert.ok(stepRecords(fixture).some(record => record.uuid === "step-agent-branch"));
  const measured = collectClaudeUsage(fixture.descriptor);
  assert.equal(measured.usageEvidence.status, "verified");
  assert.equal(measured.usage.totalTokens, 151);
});

test("async launch: unavailable when an assistant entry hangs off the chain", () => {
  const fixture = claudeUsageFixture({ async: true, branch: true });
  const records = stepRecords(fixture);
  records.push({ ...structuredClone(records.find(record => record.uuid === "step-agent-answer-0")), uuid: "step-agent-offchain", parentUuid: "step-agent-user" });
  fixture.write();
  unavailable(collectClaudeUsage(fixture.descriptor), "ambiguous-history");
});

test("async launch: unavailable when a transcript request has no telemetry", () => {
  const fixture = claudeUsageFixture({ async: true });
  fixture.events.splice(fixture.events.indexOf(stepEvent(fixture, "api_request")), 1);
  resequence(fixture);
  fixture.write();
  unavailable(collectClaudeUsage(fixture.descriptor), "snapshot-mismatch");
});

test("async launch: unavailable when a telemetry-only request follows subagent_completed", () => {
  const fixture = claudeUsageFixture({ async: true, telemetryOnly: "response" });
  const side = named(fixture, "api_request").find(event => key(event, "request_id") === "step-agent-side-query");
  fixture.events.splice(fixture.events.indexOf(side), 1);
  fixture.events.splice(fixture.events.indexOf(stepEvent(fixture, "subagent_completed")) + 1, 0, side);
  resequence(fixture);
  fixture.write();
  unavailable(collectClaudeUsage(fixture.descriptor), "ambiguous-history");
});

test("async launch: unavailable for a launch-only status on a nested child run", () => {
  const fixture = claudeUsageFixture({ async: true });
  fixture.native[5].tool_response = { status: "async_launched", agentId: "leaf-agent" };
  fixture.write();
  unavailable(collectClaudeUsage(fixture.descriptor), "incomplete-capture");
});

test("async launch: unavailable without subagent_completed", () => {
  const fixture = claudeUsageFixture({ async: true });
  fixture.events.splice(fixture.events.indexOf(stepEvent(fixture, "subagent_completed")), 1);
  resequence(fixture);
  fixture.write();
  unavailable(collectClaudeUsage(fixture.descriptor), "incomplete-capture");
});

test("async launch: unavailable without SubagentStop", () => {
  const fixture = claudeUsageFixture({ async: true });
  fixture.native.splice(fixture.native.findIndex(record => record.hook_event_name === "SubagentStop" && record.agent_id === "step-agent"), 1);
  fixture.write();
  unavailable(collectClaudeUsage(fixture.descriptor), "incomplete-capture");
});

test("async launch: unavailable when the launch result follows completion", () => {
  const fixture = claudeUsageFixture({ async: true });
  const result = named(fixture, "tool_result").at(-1);
  fixture.events.splice(fixture.events.indexOf(result), 1);
  fixture.events.splice(fixture.events.indexOf(stepEvent(fixture, "subagent_completed")) + 1, 0, result);
  resequence(fixture);
  fixture.write();
  unavailable(collectClaudeUsage(fixture.descriptor), "incomplete-capture");
});

const transcript = f => collectClaudeUsage(f.descriptor, f.env);
for (const options of [{ children: false }, { children: true }, { chain: "openspec", n: null, step: "os-archive", children: false }]) {
  test(`transcript counts each attributed message once for ${options.step ?? "numbered"} with children=${options.children}`, () => {
    const f = transcriptFixture(options);
    const rows = f.records.get("step-agent");
    const repeated = structuredClone(rows[1]);
    repeated.uuid += "-repeated";
    rows[1].parentUuid = repeated.uuid;
    rows.push(repeated);
    const placeholder = structuredClone(repeated);
    placeholder.uuid = "placeholder";
    placeholder.parentUuid = rows[0].uuid;
    placeholder.message = { ...placeholder.message, id: "placeholder", model: "<synthetic>", content: [],
      usage: Object.fromEntries(Object.keys(placeholder.message.usage).map(key => [key, 0])) };
    delete placeholder.requestId;
    rows[4].parentUuid = placeholder.uuid;
    rows.push(placeholder);
    f.main.push({ ...f.main[1], timestamp: f.ts(12) });
    f.metadata.set("sibling", { spawnDepth: 1, toolUseId: "tool-other", description: f.metadata.get("step-agent").description, finished: true });
    f.records.set("sibling", [{ malformedUnrelatedUsage: true }]);
    f.write();
    const measured = transcript(f);
    assert.deepEqual(measured.usage, { totalTokens: options.children ? 151 : 117, durationMs: 50, toolUses: 4 });
    assert.deepEqual(measured.usageEvidence, { schemaVersion: 1, status: "transcript", scope: "step-tree", source: "claude-transcript",
      hostVersion: "2.1.311", invocation: { host: "claude", agentId: "step-agent", sessionId: "native-session", runId: "tool-root" },
      sessionCount: options.children ? 2 : 1, requestCount: options.children ? 4 : 2, reconciliation: "transcript-messages" });
  });
}

const rootInvocation = { host: "claude", sessionId: "native-session", agentId: "step-agent", runId: "tool-root" };

test("transcript versions come from records even when a descriptor supplies another release", () => {
  const f = transcriptFixture();
  for (const hostVersion of [undefined, "2.2.0", "2.1.310", "not-a-release"]) {
    if (hostVersion !== undefined) f.descriptor.hostVersion = hostVersion;
    const measured = transcript(f);
    assert.equal(measured.usage.totalTokens, 151);
    assert.equal(measured.usageEvidence.hostVersion, "2.1.311");
  }
});

test("main and child record version failures retain the root identity and independent counters", () => {
  for (const select of [f => f.main[1], f => f.records.get("leaf-agent")[1]]) {
    for (const [version, reason] of [[undefined, "unsupported-schema"], ["2.2.0-dev", "unsupported-schema"],
      ["2.1.310", "unsupported-host"], ["2.2.0", "version-conflict"]]) {
      const f = transcriptFixture();
      select(f).version = version;
      f.write();
      const measured = transcript(f);
      unavailable(measured, reason);
      assert.equal(measured.usageEvidence.hostVersion, "unknown");
      assert.deepEqual(measured.usageEvidence.invocation, rootInvocation);
      assert.deepEqual(measured.usage, { durationMs: 50, toolUses: 4 });
    }
  }
});

test("contradictory root launch or return invalidates identity even when accounting also fails", () => {
  for (const modify of [
    f => { f.main[0].message.content[0].input.description = "wrong"; },
    f => { f.main[1].toolUseResult.agentId = "wrong"; },
    f => { f.main[1].sessionId = "wrong"; },
    f => { f.main[1].toolUseResult.agentId = "wrong"; f.main[1].toolUseResult.totalTokens = 100; },
    f => { f.main[0].message.content[0].input.description = "wrong"; delete f.main[0].version; },
  ]) {
    const f = transcriptFixture();
    modify(f);
    f.write();
    const measured = transcript(f);
    unavailable(measured);
    assert.equal(measured.usageEvidence.invocation, undefined);
  }
});

test("transcript binds launch, return, tool IDs, membership and fresh message lineage", () => {
  for (const [reason, modify] of [
    ["missing-identity", f => { delete f.descriptor.invocation.agentId; }],
    ["missing-identity", f => { f.descriptor.invocation.sessionId = "another-session"; }],
    ["missing-identity", f => { f.descriptor.invocation.runId = "another-tool"; }],
    ["missing-identity", f => { f.main[0].message.content[0].input.description = "other"; }],
    ["ambiguous-history", f => { f.main[0].message.content[0].input.resume = "step-agent"; }],
    ["ambiguous-history", f => { f.records.get("leaf-agent")[0].message.content = "different prompt"; }],
    ["ambiguous-history", f => { f.main[0].message.content.push({ name: "SendMessage", type: "tool_use", input: { to: "leaf-agent" } }); }],
    ["ambiguous-history", f => { f.main.push({ ...f.main[1], message: { content: [{ type: "tool_result", tool_use_id: "second-run" }] } }); }],
    ["incomplete-capture", f => { f.metadata.get("leaf-agent").parentAgentId = "unrelated"; }],
    ["incomplete-capture", f => { f.metadata.get("step-agent").finished = false; }],
    ["missing-identity", f => { f.records.get("step-agent")[2].toolUseResult.agentId = "wrong-child"; }],
    ["ambiguous-history", f => { f.records.get("leaf-agent")[1].message.content = f.main[0].message.content; }],
    ["ambiguous-history", f => { f.records.get("step-agent")[3].parentUuid = "missing-ancestor"; }],
    ["snapshot-mismatch", f => { f.main[1].toolUseResult.usage = f.records.get("step-agent")[1].message.usage; }],
    ["ambiguous-history", f => {
      const rows = f.records.get("step-agent");
      rows.push({ ...rows[3], uuid: "competing-tip", message: { ...rows[3].message, id: "same-counts" } });
    }],
    ["ambiguous-history", f => {
      const rows = f.records.get("step-agent");
      rows.push({ ...rows[3], uuid: "resume", parentUuid: rows[3].uuid, timestamp: f.ts(11), message: { ...rows[3].message, id: "later" } });
    }],
    ["conflicting-duplicate", f => {
      const rows = f.records.get("step-agent");
      rows.push({ ...rows[1], uuid: "stream", message: { ...rows[1].message, usage: rows[3].message.usage } });
    }],
    ["conflicting-duplicate", f => {
      f.main.push({ ...f.main[0], message: { ...f.main[0].message, content: [{ ...f.main[0].message.content[0],
        input: { ...f.main[0].message.content[0].input, prompt: "other" } }] } });
    }],
    ["conflicting-duplicate", f => { f.main.push({ ...f.main[1], toolUseResult: { ...f.main[1].toolUseResult, agentId: "other" } }); }],
    ["unsupported-schema", f => { f.records.get("step-agent")[0].message.usage = {}; }],
    ["resource-limit", f => { f.records.get("step-agent")[1].message.usage.input_tokens = Number.MAX_SAFE_INTEGER; }],
    ["invalid-evidence", f => { f.descriptor.sources = {}; }],
  ]) {
    const f = transcriptFixture();
    modify(f);
    f.write();
    const measurement = transcript(f);
    unavailable(measurement, reason);
    assert.deepEqual(measurement.usage, { durationMs: 50, toolUses: 4 });
    assert.equal(measurement.usageEvidence.source, "claude-transcript");
  }
});

test("transcript binds the launch prompt time to the parent call and its first response", () => {
  for (const [agent, seconds] of [["step-agent", -1], ["step-agent", 11], ["leaf-agent", 2], ["leaf-agent", 6]]) {
    const f = transcriptFixture();
    f.records.get(agent)[0].timestamp = f.ts(seconds);
    f.write();
    unavailable(transcript(f), "ambiguous-history");
  }
});

test("transcript cross-checks returned agent ownership even when the matched return omits the ID", () => {
  for (const agentId of ["step-agent", "leaf-agent"]) {
    const f = transcriptFixture();
    const ownReturn = agentId === "step-agent" ? f.main[1] : f.records.get("step-agent")[2];
    delete ownReturn.toolUseResult.agentId;
    f.write();
    assert.equal(transcript(f).usage.totalTokens, 151);
    f.main.push({ ...f.main[1], message: { content: [{ type: "tool_result", tool_use_id: "other" }] },
      toolUseResult: { agentId } });
    f.write();
    unavailable(transcript(f), "ambiguous-history");
  }
});

test("transcript rejects metadata for a deeper descendant even before its launch is visible", () => {
  const f = transcriptFixture();
  const meta = { spawnDepth: 3, parentAgentId: "other-agent", toolUseId: "tool-grandchild" };
  f.metadata.set("grandchild", meta);
  f.write();
  assert.equal(transcript(f).usage.totalTokens, 151);
  meta.parentAgentId = "leaf-agent";
  f.write();
  unavailable(transcript(f), "ambiguous-history");
});

test("transcript rejects membership changes after scanning the metadata directory", t => {
  const f = transcriptFixture();
  const open = fs.openSync;
  t.mock.method(fs, "openSync", (file, ...args) => {
    if (file === path.join(f.directory, "agent-step-agent.jsonl")) {
      fs.writeFileSync(path.join(f.directory, "agent-another.meta.json"), JSON.stringify(f.metadata.get("step-agent")));
    }
    return open(file, ...args);
  });
  unavailable(transcript(f), "unsafe-path");
});

test("transcript refuses repeated launch IDs with conflicting execution parameters", () => {
  const f = transcriptFixture();
  const copy = structuredClone(f.main[0]);
  copy.message.content[0].input.subagent_type = "different-agent";
  f.main.push(copy);
  f.write();
  unavailable(transcript(f), "conflicting-duplicate");
});

test("transcript refuses a combined result for multiple nested tool calls", () => {
  const f = transcriptFixture();
  const result = f.records.get("step-agent")[2];
  result.message.content.push({ type: "tool_result", tool_use_id: "other" });
  f.write();
  unavailable(transcript(f), "incomplete-capture");
});

test("transcript discovery probes an active main file before any agents exist and rejects ambiguity or redirects", () => {
  const f = transcriptFixture();
  fs.renameSync(f.directory, f.directory + "-away");
  assert.equal(claudeTranscriptReadiness(f.env), "ready");
  assert.equal(claudeTranscriptReadiness({ ...f.env, CLAUDE_CODE_SESSION_ID: "../foreign" }), "unusable");
  const second = path.join(path.dirname(f.projectDir), "other");
  fs.mkdirSync(second);
  fs.writeFileSync(path.join(second, path.basename(f.mainFile)), "");
  assert.equal(claudeTranscriptReadiness(f.env), "unusable");
  unavailable(transcript(f), "ambiguous-history");
  fs.unlinkSync(path.join(second, path.basename(f.mainFile)));
  fs.renameSync(f.mainFile, f.mainFile + "-actual");
  fs.symlinkSync(f.mainFile + "-actual", f.mainFile);
  assert.equal(claudeTranscriptReadiness(f.env), "unusable");
  unavailable(transcript(f), "unsafe-path");
});

test("transcript readiness and evidence reads accept a growing main file but refuse its replacement or truncation", t => {
  const f = transcriptFixture();
  const measuredStatus = () => transcript(f).usageEvidence.status;
  // The live session appends while the collector reads; a record still being written ends the prefix.
  fs.appendFileSync(f.mainFile, '{"type":"summ');
  assert.equal(measuredStatus(), "transcript");
  f.write();
  const fstat = fs.fstatSync;
  const growing = t.mock.method(fs, "fstatSync", (...args) => {
    fs.appendFileSync(f.mainFile, JSON.stringify({ type: "summary" }) + "\n");
    return fstat(...args);
  });
  assert.equal(claudeTranscriptReadiness(f.env), "ready");
  assert.equal(measuredStatus(), "transcript");
  growing.mock.restore();
  for (const change of [
    () => { fs.writeFileSync(f.mainFile + "-new", fs.readFileSync(f.mainFile)); fs.renameSync(f.mainFile + "-new", f.mainFile); },
    () => fs.truncateSync(f.mainFile, 10),
  ]) {
    f.write();
    // Change the main file between its path check and the open descriptor's check.
    let mainFd;
    const open = fs.openSync;
    const opening = t.mock.method(fs, "openSync", (file, ...args) => {
      const fd = open(file, ...args);
      if (file === f.mainFile && mainFd === undefined) mainFd = fd;
      return fd;
    });
    let changed = false;
    const once = t.mock.method(fs, "fstatSync", (fd, ...args) => {
      if (fd === mainFd && !changed) { changed = true; change(); }
      return fstat(fd, ...args);
    });
    unavailable(transcript(f), "unsafe-path");
    assert.equal(changed, true);
    once.mock.restore();
    opening.mock.restore();
  }
});

for (const children of [false, true]) {
  test(`transcript settles a background root launch from its finished metadata with children=${children}`, () => {
    const f = transcriptFixture({ children });
    const result = f.main[1].toolUseResult;
    f.main[1].toolUseResult = { isAsync: true, status: "async_launched", agentId: "step-agent", description: "launch", prompt: "launch" };
    f.main[1].timestamp = f.ts(0);
    f.write();
    const measured = transcript(f);
    assert.equal(measured.usageEvidence.status, "transcript");
    assert.equal(measured.usage.totalTokens, children ? 151 : 117);
    assert.equal(measured.usageEvidence.sessionCount, children ? 2 : 1);
    for (const [reason, modify] of [
      ["incomplete-capture", () => { f.metadata.get("step-agent").finished = false; }],
      ["incomplete-capture", () => { delete f.main[1].toolUseResult.isAsync; }],
      ["incomplete-capture", () => { f.main[1].message.content[0].is_error = true; }],
      ["missing-identity", () => { f.main[1].toolUseResult.agentId = "other-agent"; }],
    ]) {
      const saved = structuredClone({ main: f.main, meta: f.metadata.get("step-agent") });
      modify();
      f.write();
      unavailable(transcript(f), reason);
      f.main.splice(0, f.main.length, ...saved.main);
      f.metadata.set("step-agent", saved.meta);
    }
    if (children) {
      // Only the invocation's own root may return before it settles.
      f.records.get("step-agent")[2].toolUseResult = { isAsync: true, status: "async_launched", agentId: "leaf-agent" };
      f.write();
      unavailable(transcript(f), "incomplete-capture");
    }
    f.main[1].toolUseResult = result;
  });
}

test("transcript accepts host meta records and parallel tool results on the final chain, never as a fork", () => {
  const f = transcriptFixture({ children: false });
  const rows = f.records.get("step-agent");
  const meta = { ...structuredClone(rows[2]), uuid: "skill-body", parentUuid: rows[1].parentUuid, isMeta: true,
    message: { role: "user", content: [{ type: "text", text: "loaded skill body" }] } };
  rows[1].parentUuid = meta.uuid;
  const parallel = { ...structuredClone(rows[2]), uuid: "parallel-result", parentUuid: rows[1].uuid,
    message: { role: "user", content: [{ type: "tool_result", tool_use_id: "other-local-tool" }] } };
  rows.push(meta, parallel);
  f.write();
  assert.equal(transcript(f).usageEvidence.status, "transcript");
  assert.equal(transcript(f).usage.totalTokens, 117);
  delete meta.isMeta;
  f.write();
  unavailable(transcript(f), "ambiguous-history");
  meta.isMeta = true;
  rows.push({ ...structuredClone(parallel), uuid: "forked-result", parentUuid: parallel.uuid });
  f.write();
  unavailable(transcript(f), "ambiguous-history");
});

test("transcript refuses redirected metadata, oversized aggregate input and a shared deadline during metadata reads", t => {
  const f = transcriptFixture();
  const leaf = path.join(f.directory, "agent-leaf-agent.meta.json");
  fs.renameSync(leaf, leaf + "-other");
  fs.symlinkSync(leaf + "-other", leaf);
  unavailable(transcript(f), "unsafe-path");
  fs.unlinkSync(leaf);
  fs.renameSync(leaf + "-other", leaf);
  const cap = CLAUDE_USAGE_LIMITS.bytes;
  try {
    CLAUDE_USAGE_LIMITS.bytes = fs.statSync(leaf).size + fs.statSync(f.mainFile).size;
    unavailable(transcript(f), "resource-limit");
  } finally { CLAUDE_USAGE_LIMITS.bytes = cap; }
  let now = 0;
  const open = fs.openSync;
  t.mock.method(Date, "now", () => now);
  t.mock.method(fs, "openSync", (file, ...args) => {
    if (file === leaf) now += CLAUDE_USAGE_LIMITS.readMs + 1;
    return open(file, ...args);
  });
  unavailable(transcript(f), "resource-limit");
});

test("delayed transcript completion keeps only established late-attachment identity and version", () => {
  const f = transcriptFixture();
  f.metadata.get("leaf-agent").finished = false;
  f.write();
  const early = transcript(f);
  unavailable(early, "incomplete-capture");
  assert.equal(early.usageEvidence.hostVersion, "2.1.311");
  assert.equal(early.usageEvidence.invocation.runId, "tool-root");
  f.metadata.get("leaf-agent").finished = true;
  f.write();
  assert.equal(transcript(f).usage.totalTokens, 151);
  f.main.splice(0, 2);
  f.write();
  const missingLaunch = transcript(f);
  unavailable(missingLaunch, "incomplete-capture");
  assert.deepEqual(missingLaunch.usageEvidence.invocation, rootInvocation);
  assert.equal(missingLaunch.usageEvidence.hostVersion, "unknown");
});

test("only fully observed Claude identity survives delayed root metadata", () => {
  const f = transcriptFixture();
  f.descriptor.hostVersion = "2.1.311";
  f.descriptor.invocation = { ...rootInvocation };
  fs.unlinkSync(path.join(f.directory, "agent-step-agent.meta.json"));
  const delayed = transcript(f);
  unavailable(delayed, "missing-source");
  assert.deepEqual(delayed.usageEvidence.invocation, f.descriptor.invocation);
  assert.equal(delayed.usageEvidence.hostVersion, "unknown");
  delete f.descriptor.invocation.runId;
  assert.equal(transcript(f).usageEvidence.invocation, undefined);
  f.descriptor.invocation.runId = rootInvocation.runId;
  f.metadata.get("step-agent").toolUseId = "contradictory-tool";
  f.write();
  const conflicting = transcript(f);
  unavailable(conflicting, "missing-identity");
  assert.equal(conflicting.usageEvidence.invocation, undefined);
});

test("observed invocation survives delayed main source, launch and final counters", () => {
  const f = transcriptFixture();
  f.descriptor.hostVersion = "2.1.311";
  f.descriptor.invocation = { ...rootInvocation };
  const check = () => {
    const early = transcript(f);
    unavailable(early);
    assert.deepEqual(early.usageEvidence.invocation, f.descriptor.invocation);
    assert.equal(early.usageEvidence.hostVersion, "unknown");
  };
  fs.unlinkSync(f.mainFile);
  check();
  fs.writeFileSync(f.mainFile, "");
  check();
  const usage = f.main[1].toolUseResult.usage;
  delete f.main[1].toolUseResult.usage;
  f.write();
  delete f.descriptor.invocation.runId;
  const early = transcript(f);
  unavailable(early, "incomplete-capture");
  assert.deepEqual(early.usageEvidence.invocation, rootInvocation);
  assert.equal(early.usageEvidence.hostVersion, "2.1.311");
  f.main[1].toolUseResult.usage = usage;
  f.write();
  assert.equal(transcript(f).usage.totalTokens, 151);
});
