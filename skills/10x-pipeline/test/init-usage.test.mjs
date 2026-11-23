import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { CAPTURE_ENV, CAPTURE_LIMITS, CLAUDE_CAPTURE_MIN_VERSION, captureFile } from "../scripts/claude-capture-data.mjs";
import { CODEX_USAGE_VERSION } from "../scripts/codex-usage.mjs";
import { cleanupAll, entry, gitEnv, makeProject, run, seedRun, writeMetaFile, writeResult } from "./helpers.mjs";
import { makeOpenspecProject } from "../../openspec-pipeline/test/openspec-helpers.mjs";

after(cleanupAll);

const WARNING = /^Warning: Usage capture preflight\./;
const SETUP = /docs\/REFERENCE\.md#accounting-activation-and-rollback/;
const OFF = /Native Claude token capture is off.*fresh Claude session.*launcher/;
const UNAVAILABLE = /Native Claude launcher capture is unavailable.*relaunch/;
const HEADLESS = /Headless Claude on Codex records duration only.*fresh Claude session.*new Claude-hosted run.*saved provider mode/;
const UNKNOWN_VERSION = /Could not check Codex token capture readiness/;
const WRONG_VERSION = /Codex CLI version is unsupported for verified token capture/;
const PRIVATE = "private-fixture-details";
const PIN = "codex-cli " + CODEX_USAGE_VERSION;
const PERMISSION_MESSAGE = 'Error: default_permissions refers to undefined profile `fixture`\n';

function fakeCodex(project, config = {}) {
  const bin = path.join(project.base, "fake bin");
  const home = path.join(project.base, "codex-home");
  const executable = path.join(bin, "codex");
  const log = path.join(home, "calls.jsonl");
  fs.mkdirSync(bin);
  fs.mkdirSync(home);
  fs.writeFileSync(executable, `#!${process.execPath}
const fs = require("node:fs");
const args = process.argv.slice(2);
const config = ${JSON.stringify(config)};
const version = args.length === 1 && args[0] === "--version";
fs.appendFileSync(${JSON.stringify(log)}, JSON.stringify({
  args,
  cwd: process.cwd(),
  scrubbed: !Object.keys(process.env).some(name => /^(GH|GITHUB)_([A-Z0-9]+_)*TOKEN$/i.test(name)),
  keep: process.env.CODEX_TEST_KEEP,
  closedStdin: version ? fs.readFileSync(0).length === 0 : undefined,
}) + "\\n");
if (version) {
  if (config.timeout) setInterval(() => {}, 1000);
  process.stdout.write(config.stdout ?? ${JSON.stringify(PIN + "\n")});
  process.stderr.write(config.stderr ?? "");
  process.exitCode = config.status ?? 0;
} else if (args[0] === "sandbox" && config.permissionWarning) {
  process.stderr.write(${JSON.stringify(PERMISSION_MESSAGE)});
  process.exitCode = 1;
} else if (args[0] !== "sandbox") {
  process.exitCode = 99;
}
`, { mode: 0o700 });
  const env = {
    ...gitEnv(project),
    PATH: bin + path.delimiter + process.env.PATH,
    CODEX_HOME: home,
    CLAUDE_CONFIG_DIR: path.join(project.base, "claude-home"),
    [CAPTURE_ENV]: "",
    AGENT_SMITH_CLAUDE_SESSION: "",
    GH_TOKEN: "fixture-only",
    GITHUB_ENTERPRISE_TOKEN: "fixture-only",
    CODEX_TEST_KEEP: "retained",
  };
  return {
    env,
    home,
    calls() { return fs.existsSync(log) ? fs.readFileSync(log, "utf8").trimEnd().split("\n").map(JSON.parse) : []; },
  };
}

function init(project, env, flags = []) {
  const result = run(project, ["init", project.id, "--chain", project.chain ?? "10x", "--goal", "fix typo", ...flags], { env });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(JSON.parse(result.stdout).action, "run", result.stdout);
  const warnings = result.stderr.split("\n").filter(line => WARNING.test(line));
  assert.ok(warnings.length <= 1, result.stderr);
  for (const warning of warnings) {
    assert.match(warning, SETUP);
    assert.ok(warning.length < 1024, warning);
    assert.ok(!warning.includes(project.base), warning);
    assert.ok(!warning.includes(PRIVATE), warning);
  }
  return { action: result.json, stderr: result.stderr, warning: warnings[0] ?? "" };
}

function expectCalls(project, fake, ...commands) {
  assert.deepEqual(fake.calls(), commands.map(command => ({
    args: command === "sandbox" ? ["sandbox", "--", process.execPath, "-e", ""] : ["--version"],
    cwd: project.root,
    scrubbed: true,
    keep: "retained",
    ...(command === "--version" ? { closedStdin: true } : {}),
  })));
}

function capture(project, over = {}) {
  const root = path.join(project.base, PRIVATE);
  fs.mkdirSync(root, { mode: 0o700 });
  const binding = captureFile(root, "binding");
  const native = captureFile(root, "native");
  const telemetry = captureFile(root, "telemetry");
  fs.writeFileSync(binding, JSON.stringify({
    sessionId: "00112233-4455-6677-8899-aabbccddeeff",
    process: { pid: process.pid, createdAt: new Date().toISOString() },
    hostVersion: CLAUDE_CAPTURE_MIN_VERSION,
    endpoint: "http://127.0.0.1:12345/" + "f".repeat(48) + "/v1/logs",
    transcriptRoot: path.join(project.base, "transcripts"),
    ...over,
  }), { mode: 0o600 });
  for (const file of [native, telemetry]) fs.writeFileSync(file, "", { mode: 0o600 });
  return { root, binding, native, telemetry };
}

for (const [chain, make] of [["10x", makeProject], ["openspec", makeOpenspecProject]]) {
  test(chain + " native init warns without capture and rechecks empty launcher files on resume", () => {
    const project = { ...make(), chain };
    const fake = fakeCodex(project);
    const first = init(project, fake.env);
    assert.match(first.warning, OFF);
    assert.doesNotMatch(first.warning, /Codex|duration only/);

    const { root } = capture(project);
    writeResult(project, { status: "orchestrator-error", note: "no child started" });
    const resumed = init(project, { ...fake.env, [CAPTURE_ENV]: root });
    assert.equal(resumed.warning, "");
    assert.deepEqual(resumed.action, { ...first.action, neutralRetry: { count: 1, cap: 2 } });
    expectCalls(project, fake);
  });

  test(chain + " split init combines usage guidance without hiding permission diagnostics", () => {
    for (const host of ["claude", "codex"]) {
      const project = { ...make(), chain };
      const fake = fakeCodex(project, { stdout: "codex-cli 12.34.56-beta.1+build\n", permissionWarning: true });
      const launcher = host === "codex" ? capture(project).root : "";
      const { stderr, warning } = init(project, { ...fake.env, [CAPTURE_ENV]: launcher }, ["--host", host, "--provider-mode", "split"]);
      assert.match(stderr, /^Warning: Codex could not resolve its default_permissions profile/m);
      assert.match(warning, host === "codex" ? HEADLESS : OFF);
      assert.match(warning, WRONG_VERSION);
      assert.ok(warning.includes(PIN));
      assert.doesNotMatch(warning, /12\.34\.56/);
      expectCalls(project, fake, "sandbox", "--version");
    }
  });
}

test("native launcher probe rejects bad prerequisites without reading the capture records", () => {
  const cases = [
    ["invalid binding", ({ binding }) => fs.writeFileSync(binding, PRIVATE)],
    ["expired binding", ({ binding }) => {
      const data = JSON.parse(fs.readFileSync(binding, "utf8"));
      data.process.createdAt = new Date(Date.now() - CAPTURE_LIMITS.lifetimeMs - 1000).toISOString();
      fs.writeFileSync(binding, JSON.stringify(data));
    }],
    ["unsupported binding", ({ binding }) => {
      const data = JSON.parse(fs.readFileSync(binding, "utf8"));
      fs.writeFileSync(binding, JSON.stringify({ ...data, hostVersion: "0.0.0" }));
    }],
    ["failure marker", ({ root }) => fs.writeFileSync(captureFile(root, "failure"), PRIVATE, { mode: 0o600 })],
    ["missing hooks", ({ native }) => fs.unlinkSync(native)],
    ["missing OTLP", ({ telemetry }) => fs.unlinkSync(telemetry)],
    ["public mode", ({ native }) => fs.chmodSync(native, 0o644)],
    ["hard link", ({ root, telemetry }) => fs.linkSync(telemetry, path.join(root, "another-otel"))],
    ["symbolic link", ({ native, telemetry }) => {
      fs.unlinkSync(native);
      fs.symlinkSync(telemetry, native);
    }],
    ["over the limit", ({ telemetry }) => fs.truncateSync(telemetry, CAPTURE_LIMITS.telemetryBytes + 1)],
  ];
  for (const [label, damage] of cases) {
    const project = makeProject();
    const fake = fakeCodex(project);
    const sources = capture(project);
    damage(sources);
    const { warning } = init(project, { ...fake.env, [CAPTURE_ENV]: sources.root });
    assert.match(warning, UNAVAILABLE, label);
    expectCalls(project, fake);
  }
  const project = makeProject();
  const fake = fakeCodex(project);
  const { root, native, telemetry } = capture(project);
  for (const file of [native, telemetry]) fs.writeFileSync(file, PRIVATE);
  assert.equal(init(project, { ...fake.env, [CAPTURE_ENV]: root }).warning, "");
  writeResult(project, { status: "orchestrator-error", note: "no child started" });
  assert.match(init(project, { ...fake.env, [CAPTURE_ENV]: root, AGENT_SMITH_CLAUDE_SESSION: "headless" }).warning, OFF);
});

function preload(project, source) {
  const script = path.join(project.base, "fixture.mjs");
  fs.writeFileSync(script, "import fs from \"node:fs\";\n" + source);
  return { NODE_OPTIONS: "--import=" + pathToFileURL(script).href };
}

test("native probe opens both sources safely and permits live append growth", () => {
  for (const mode of ["unreadable hooks", "unreadable OTLP", "growth", "replaced", "failure during probe"]) {
    const project = makeProject();
    const fake = fakeCodex(project);
    const { root, native, telemetry } = capture(project);
    const target = mode === "unreadable hooks" ? native : telemetry;
    const hooks = preload(project, `
const open = fs.openSync;
const native = ${JSON.stringify(native)};
const telemetry = ${JSON.stringify(telemetry)};
const mode = ${JSON.stringify(mode)};
fs.openSync = (file, flags, ...args) => {
  if (file === native || file === telemetry) {
    const required = fs.constants.O_NONBLOCK | fs.constants.O_NOFOLLOW;
    if ((flags & required) !== required) throw new Error("unsafe probe open");
    if (mode.startsWith("unreadable") && file === ${JSON.stringify(target)}) {
      throw Object.assign(new Error("fixture EACCES"), { code: "EACCES" });
    }
    if (mode === "growth") {
      const writer = open(file, "a");
      try { fs.writeSync(writer, ${JSON.stringify(PRIVATE)}); } finally { fs.closeSync(writer); }
    }
    if (mode === "replaced" && file === telemetry) {
      const fd = open(file, flags, ...args);
      fs.renameSync(file, file + ".old");
      fs.closeSync(open(file, "wx", 0o600));
      return fd;
    }
    if (mode === "failure during probe" && file === telemetry) {
      fs.closeSync(open(${JSON.stringify(captureFile(root, "failure"))}, "wx", 0o600));
    }
  }
  return open(file, flags, ...args);
};
`);
    const { warning } = init(project, { ...fake.env, ...hooks, [CAPTURE_ENV]: root });
    if (mode === "growth") {
      assert.equal(warning, "");
      assert.equal(fs.readFileSync(native, "utf8"), PRIVATE);
      assert.equal(fs.readFileSync(telemetry, "utf8"), PRIVATE);
    } else {
      assert.match(warning, UNAVAILABLE, mode);
    }
  }
});

test("Codex startup requires only the pinned version on either host and keeps probing model-free", () => {
  for (const host of ["claude", "codex"]) {
    const project = makeProject();
    const fake = fakeCodex(project, { stdout: PIN + "\r\n" });
    const { action, warning } = init(project, fake.env, ["--host", host, "--provider-mode", "codex"]);
    assert.equal(action.provider, "openai");
    assert.equal(warning, "");
    expectCalls(project, fake, "sandbox", "--version");
    assert.deepEqual(fs.readdirSync(fake.home), ["calls.jsonl"], "a fresh Codex home needs no rollout data");
  }
});

test("Codex startup distinguishes known mismatches from failures and hides command output", () => {
  const cases = [
    [{ stdout: PIN + "-beta\n" }, WRONG_VERSION],
    [{ stdout: PRIVATE + "\n" + PIN + "\n" }, UNKNOWN_VERSION],
    [{ stdout: PIN + "\n\n" }, UNKNOWN_VERSION],
    [{ stdout: "codex-cli 00.169.0\n" }, UNKNOWN_VERSION],
    [{ status: 1, stderr: PRIVATE }, UNKNOWN_VERSION],
    [{ timeout: true }, UNKNOWN_VERSION],
    [{ stdout: PIN + "\n" + PRIVATE.repeat(3000) }, UNKNOWN_VERSION],
  ];
  for (const [config, expected] of cases) {
    const project = makeProject();
    const fake = fakeCodex(project, config);
    const { warning } = init(project, fake.env, ["--host", "codex"]);
    assert.match(warning, expected);
    assert.ok(warning.includes(PIN));
    assert.doesNotMatch(warning, /Native Claude|duration only/);
    expectCalls(project, fake, "sandbox", "--version");
  }
  const project = makeProject();
  const fake = fakeCodex(project);
  const { warning } = init(project, { ...fake.env, PATH: path.join(project.base, "missing") }, ["--host", "codex"]);
  assert.match(warning, UNKNOWN_VERSION);
  expectCalls(project, fake);
});

test("legacy provider arrays check each assigned transport once", () => {
  const { ladder } = JSON.parse(fs.readFileSync(new URL("../policy.json", import.meta.url), "utf8"));
  ladder.at(-1).provider = "openai";
  const project = makeProject({ policy: { ladder } });
  writeMetaFile(project, { host: "claude" });
  const fake = fakeCodex(project, { stdout: "codex-cli 99.0.0" });
  const { action, warning } = init(project, fake.env);
  assert.deepEqual(action.providersByStep.plan, ["claude", "openai"]);
  assert.match(warning, OFF);
  assert.match(warning, WRONG_VERSION);
  expectCalls(project, fake, "sandbox", "--version");
});

test("neutral replay checks usage only for its saved dispatch while permission selection stays independent", () => {
  for (const provider of ["claude", "openai"]) {
    const project = makeProject();
    const fake = fakeCodex(project, { stdout: "codex-cli 99.0.0" });
    const otherMode = provider === "claude" ? "codex" : "claude";
    seedRun(project, [entry(1, "plan", {
      provider, model: "saved-model", effort: "high", profile: null, result: undefined, pendingPrompt: "saved prompt",
    })], { host: otherMode, providerMode: otherMode });
    writeResult(project, { status: "orchestrator-error", note: "no child started" });
    const { action, warning } = init(project, fake.env);
    assert.equal(action.provider, provider);
    assert.equal(action.providerMode, otherMode);
    assert.equal(action.neutralRetry.count, 1);
    if (provider === "claude") {
      assert.match(warning, HEADLESS);
      assert.doesNotMatch(warning, /Codex CLI version|readiness/);
      expectCalls(project, fake, "sandbox");
    } else {
      assert.match(warning, WRONG_VERSION);
      assert.doesNotMatch(warning, /Native Claude|duration only/);
      expectCalls(project, fake, "sandbox", "--version");
    }
  }
});

test("failure to write advisory stderr leaves the init action and exit status intact", () => {
  const project = makeProject();
  const fake = fakeCodex(project);
  const hooks = preload(project, `
const write = fs.writeSync;
fs.writeSync = (fd, ...args) => {
  if (fd === 2) throw Object.assign(new Error("closed stderr"), { code: "EPIPE" });
  return write(fd, ...args);
};
`);
  const { warning } = init(project, { ...fake.env, ...hooks });
  assert.equal(warning, "");
});
