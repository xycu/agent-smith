import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { once } from "node:events";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { CAPTURE_ENV, CAPTURE_LIMITS } from "../scripts/claude-capture-data.mjs";
import { cleanupAll, makeProject } from "./helpers.mjs";

after(cleanupAll);
const launcher = fileURLToPath(new URL("../scripts/claude-capture.mjs", import.meta.url));
const hook = fileURLToPath(new URL("../scripts/claude-capture-hook.mjs", import.meta.url));
const pluginRoot = fs.realpathSync(fileURLToPath(new URL("../../../", import.meta.url)));

function launcherFixture(source = "", version = "2.1.311") {
  const project = makeProject();
  const config = path.join(project.root, "config");
  const temp = path.join(project.root, "temp");
  const bin = path.join(project.root, "bin");
  for (const dir of [config, temp, bin]) fs.mkdirSync(dir);
  const executable = path.join(bin, "claude");
  fs.writeFileSync(executable, `#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const root = process.env.${CAPTURE_ENV};
if (process.argv[2] === "--version") {
  console.log(${JSON.stringify(version + " (Claude Code)")});
} else {
  (async () => { ${source} })().catch(error => { console.error(error); process.exitCode = 1; });
}
`, { mode: 0o700 });
  const env = { PATH: [bin, path.dirname(process.execPath), "/usr/bin", "/bin"].join(path.delimiter),
    CLAUDE_CONFIG_DIR: config, TMPDIR: temp };
  const launch = (args = [], overrides = {}) => spawnSync(process.execPath, [launcher, ...args], {
    cwd: project.root, env: { ...env, ...overrides }, encoding: "utf8", timeout: 15000,
  });
  return { project, config, temp, env, launch };
}

test("ordinary Claude hooks exit with stdin open and leave no capture or guard receipt", async (t) => {
  const child = spawn(process.execPath, [hook], { env: {}, stdio: ["pipe", "pipe", "pipe"] });
  t.after(() => child.kill("SIGKILL"));
  let output = "";
  child.stdout.on("data", bytes => { output += bytes; });
  child.stderr.on("data", bytes => { output += bytes; });
  const closed = once(child, "close");
  const timer = setTimeout(() => child.kill("SIGKILL"), 3000);
  const [status, signal] = await closed;
  clearTimeout(timer);
  assert.equal(signal, null);
  assert.equal(status, 0);
  assert.equal(output, "");
});

test("capture registrations are separate and passive, while Bash and lifecycle guards still block on failure", () => {
  const { hooks } = JSON.parse(fs.readFileSync(path.join(pluginRoot, "hooks/hooks.json"), "utf8"));
  const capture = group => group.hooks.some(item => item.args[0].endsWith("/claude-capture-hook.mjs")
    && item.onFailure === "continue" && item.async === false);
  assert.ok(hooks.PreToolUse.some(group => group.matcher === "Agent" && capture(group)));
  assert.ok(hooks.PostToolUse.some(group => group.matcher === "Agent" && capture(group)));
  assert.ok(hooks.SubagentStop.some(capture));
  assert.ok(hooks.PreToolUse.find(group => group.matcher === "Bash").hooks.every(item => item.onFailure === "block"));
  for (const event of ["SessionStart", "Stop", "SubagentStart", "SubagentStop"]) {
    assert.ok(hooks[event].flatMap(group => group.hooks).some(item =>
      item.args[0].endsWith("/claude-hook.mjs") && item.onFailure === "block"));
  }
});

test("fresh launcher binds private, minimized and bounded capture to one Claude process and loopback route", async () => {
  const f = launcherFixture(`
    const read = name => fs.readFileSync(path.join(root, name), "utf8");
    const binding = JSON.parse(read("binding.json"));
    assert.deepEqual(process.argv.slice(2), ["--plugin-dir", ${JSON.stringify(pluginRoot)}, "--session-id", binding.sessionId]);
    assert.equal(binding.process.pid, process.pid);
    assert.equal(process.env.OTEL_RESOURCE_ATTRIBUTES,
      "process.pid=" + process.pid + ",process.creation.time=" + binding.process.createdAt);
    assert.equal(binding.endpoint, process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT);
    assert.equal(binding.transcriptRoot, path.join(process.env.CLAUDE_CONFIG_DIR, "projects"));
    assert.equal(process.env.OTEL_METRICS_EXPORTER, "none");
    assert.equal(process.env.OTEL_TRACES_EXPORTER, "none");
    for (const [key, value] of Object.entries(process.env)) if (key.startsWith("OTEL_LOG_")) assert.equal(value, "0");
    assert.equal(fs.statSync(root).mode & 0o777, 0o700);
    for (const file of ["binding.json", "hooks.jsonl", "otel.jsonl"]) assert.equal(fs.statSync(path.join(root, file)).mode & 0o777, 0o600);
    const record = { hook_event_name: "PreToolUse", session_id: binding.sessionId,
      tool_name: "Agent", tool_use_id: "toolu_synthetic", tool_input: { prompt: "private-prompt", description: "private-description" } };
    const capture = (payload, overrides = {}) => {
      const result = spawnSync(process.execPath, [${JSON.stringify(hook)}], { encoding: "utf8", input: JSON.stringify(payload),
        env: { ...process.env, CLAUDE_PLUGIN_ROOT: ${JSON.stringify(pluginRoot)}, ...overrides } });
      assert.equal(result.status, 0);
      assert.equal(result.stdout + result.stderr, "");
    };
    capture({ ...record, session_id: "foreign-session" });
    capture(record, { AGENT_SMITH_CLAUDE_SESSION: "external-guarded-session" });
    assert.equal(read("hooks.jsonl"), "");
    capture(record);
    assert.ok(JSON.parse(read("hooks.jsonl")).promptHash);
    assert.doesNotMatch(read("hooks.jsonl"), /private-prompt|private-description/);
    const attr = (key, value) => ({ key, value: typeof value === "number" ? { intValue: value } : { stringValue: value } });
    const resource = { attributes: [attr("process.pid", process.pid), attr("process.creation.time", binding.process.createdAt),
      attr("private-resource", "private-value")] };
    const event = (name, sequence, details = []) => ({ body: { stringValue: "claude_code." + name },
      attributes: [attr("event.sequence", sequence), attr("session.id", binding.sessionId), ...details] });
    const events = [
      event("user_prompt", 0, [attr("prompt", "private-value")]),
      event("tool_result", 1, [attr("tool_name", "private-tool"), attr("tool_use_id", "toolu_other"), attr("full_command", "private-value")]),
    ];
    const batch = { resourceLogs: [{ resource, scopeLogs: [{ logRecords: events }] }] };
    const post = (body, endpoint = binding.endpoint) => fetch(endpoint, { method: "POST",
      headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then(response => response.status);
    assert.equal(await post(batch, new URL("/v1/logs", binding.endpoint)), 404);
    resource.attributes[0] = attr("process.pid", process.pid + 1);
    assert.equal(await post(batch), 400);
    resource.attributes[0] = attr("process.pid", process.pid);
    events[0].attributes[1] = attr("session.id", "foreign-session");
    assert.equal(await post(batch), 400);
    events[0].attributes[1] = attr("session.id", binding.sessionId);
    assert.equal(read("otel.jsonl"), "");
    assert.equal(await post(batch), 200);
    const captured = read("otel.jsonl");
    const exported = JSON.parse(captured).resourceLogs[0].scopeLogs[0].logRecords;
    assert.deepEqual(exported.map(event => event.attributes.find(attr => attr.key === "event.sequence").value.intValue), [0, 1]);
    assert.doesNotMatch(captured, /private-value|private-tool|private-resource/);
    const oversized = await fetch(binding.endpoint, { method: "POST", headers: { "content-type": "application/json" },
      body: Buffer.alloc(${CAPTURE_LIMITS.bodyBytes + 1}) });
    assert.equal(oversized.status, 413);
    const overLimitChunks = async function* () {
      yield Buffer.alloc(${CAPTURE_LIMITS.bodyBytes});
      yield Buffer.from("1");
    };
    const chunked = await fetch(binding.endpoint, { method: "POST", headers: { "content-type": "application/json" },
      body: overLimitChunks(), duplex: "half" });
    assert.equal(chunked.status, 413);
    assert.equal(read("otel.jsonl"), captured, "oversized uploads leave no captured data");
    fs.truncateSync(path.join(root, "otel.jsonl"), ${CAPTURE_LIMITS.telemetryBytes});
    assert.equal(await post(batch), 503);
    assert.ok(fs.existsSync(path.join(root, "failed")));
    assert.equal(fs.statSync(path.join(root, "otel.jsonl")).size, ${CAPTURE_LIMITS.telemetryBytes});
    console.log(JSON.stringify({ root, endpoint: binding.endpoint, sessionId: binding.sessionId }));
  `);
  const sessions = [];
  for (let i = 0; i < 2; i++) {
    const result = f.launch();
    assert.equal(result.status, 0, result.stderr + result.error);
    const session = JSON.parse(result.stdout);
    assert.equal(fs.existsSync(session.root), false);
    await assert.rejects(fetch(session.endpoint));
    sessions.push(session);
  }
  assert.notEqual(sessions[0].sessionId, sessions[1].sessionId);
  assert.notEqual(sessions[0].root, sessions[1].root);
  assert.notEqual(sessions[0].endpoint, sessions[1].endpoint);
  assert.deepEqual(fs.readdirSync(f.temp), []);
});

test("conflicting telemetry settings, managed policy and unqualified versions fail before capture starts", () => {
  const f = launcherFixture();
  for (const args of [["--resume"], ["--print"]]) {
    const supplied = f.launch(args);
    assert.equal(supplied.status, 2);
    assert.match(supplied.stderr, /fresh interactive/);
  }
  const conflict = f.launch([], { OTEL_EXPORTER_OTLP_LOGS_ENDPOINT: "https://private-config.example" });
  assert.equal(conflict.status, 2);
  assert.match(conflict.stderr, /Existing telemetry/);
  assert.doesNotMatch(conflict.stderr, /private-config/);
  const user = path.join(f.config, "settings.json");
  fs.writeFileSync(user, JSON.stringify({ env: { OTEL_LOG_RAW_API_BODIES: "file:private-value" } }));
  const configured = f.launch();
  assert.equal(configured.status, 2);
  assert.match(configured.stderr, /Existing telemetry/);
  assert.doesNotMatch(configured.stderr, /private-value/);
  fs.writeFileSync(user, JSON.stringify({ env: { HTTP_PROXY: "http://private-proxy.example" } }));
  assert.equal(f.launch().status, 2);
  fs.unlinkSync(user);
  fs.writeFileSync(path.join(f.config, "remote-settings.json"), "{}");
  const managed = f.launch();
  assert.equal(managed.status, 2);
  assert.match(managed.stderr, /managed Claude policy/);
  assert.deepEqual(fs.readdirSync(f.temp), []);
  const other = launcherFixture("", "2.1.323");
  const unsupported = other.launch();
  assert.equal(unsupported.status, 2);
  assert.match(unsupported.stderr, /not qualified.*supported release \(2\.1\.311\)/);
  assert.equal(other.launch(["--versions"]).stdout.trim(), "2.1.311");
  assert.deepEqual(fs.readdirSync(other.temp), []);
});

test("a stale native append lock fails capture closed without blocking Agent execution", () => {
  const f = launcherFixture(`
    const binding = JSON.parse(fs.readFileSync(path.join(root, "binding.json"), "utf8"));
    fs.writeFileSync(path.join(root, "hooks.lock"), "", { mode: 0o600 });
    const result = spawnSync(process.execPath, [${JSON.stringify(hook)}], { encoding: "utf8",
      env: { ...process.env, CLAUDE_PLUGIN_ROOT: ${JSON.stringify(pluginRoot)} }, input: JSON.stringify({
        hook_event_name: "PreToolUse", session_id: binding.sessionId, tool_name: "Agent",
        tool_use_id: "synthetic-tool", tool_input: { prompt: "private-prompt", description: "synthetic-description" },
      }) });
    assert.equal(result.status, 0);
    assert.equal(result.stdout + result.stderr, "");
    assert.equal(fs.readFileSync(path.join(root, "hooks.jsonl"), "utf8"), "");
    assert.ok(fs.existsSync(path.join(root, "failed")));
  `);
  const result = f.launch();
  assert.equal(result.status, 0, result.stderr + result.error);
  assert.deepEqual(fs.readdirSync(f.temp), []);
});

test("launcher interruption settles the bound process and receiver before cleanup", async (t) => {
  const f = launcherFixture(`
    const binding = JSON.parse(fs.readFileSync(path.join(root, "binding.json"), "utf8"));
    console.log(JSON.stringify({ root, endpoint: binding.endpoint, pid: process.pid }));
    setInterval(() => {}, 1000);
  `);
  const child = spawn(process.execPath, [launcher], { cwd: f.project.root, env: f.env, stdio: ["ignore", "pipe", "pipe"] });
  t.after(() => child.kill("SIGKILL"));
  const closed = once(child, "close");
  const timer = setTimeout(() => child.kill("SIGTERM"), 10000);
  const ready = await Promise.race([once(child.stdout, "data").then(([bytes]) => JSON.parse(bytes)),
    closed.then(() => assert.fail("launcher settled before the fake child started"))]);
  assert.ok(fs.existsSync(ready.root));
  child.kill("SIGTERM");
  const [status, signal] = await closed;
  clearTimeout(timer);
  assert.equal(signal, null);
  assert.equal(status, 143);
  assert.throws(() => process.kill(ready.pid, 0), { code: "ESRCH" });
  assert.equal(fs.existsSync(ready.root), false);
  await assert.rejects(fetch(ready.endpoint));
});
