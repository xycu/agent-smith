import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { spawn, spawnSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { removeTree } from "./remove-tree.mjs";
import { readBoundedFile } from "./usage.mjs";
import { CAPTURE_ENV, CAPTURE_LIMITS, CLAUDE_CAPTURE_RELEASES, appendCapture, captureFile, endpointPattern,
  markCaptureFailure, object, privateRoot, projectTelemetry, readCaptureBinding, sessionIdentifier } from "./claude-capture-data.mjs";

const script = fileURLToPath(import.meta.url);
const pluginRoot = fs.realpathSync(fileURLToPath(new URL("../../../", import.meta.url)));
const guidance = "Use the ordinary claude command, or use a supported release (" + CLAUDE_CAPTURE_RELEASES.join(", ") + ").";
const settingsConflict = key => /^(?:OTEL_|BETA_TRACING_|CLAUDE_CODE_OTEL_|CLAUDE_CODE_ENHANCED_TELEMETRY_BETA$)/.test(key)
  || [CAPTURE_ENV, "AGENT_SMITH_CLAUDE_SESSION", "CLAUDE_CODE_ENABLE_TELEMETRY", "DISABLE_TELEMETRY",
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC"].includes(key);
const conflict = () => new Error("Existing telemetry configuration or managed Claude policy prevents local capture.");
const httpProxies = ["HTTP_PROXY", "http_proxy", "ALL_PROXY", "all_proxy"];

function exists(file) {
  try { fs.lstatSync(file); return true; }
  catch (error) { if (error.code === "ENOENT") return false; throw error; }
}

function preflightSettings(config) {
  const { env, platform } = process;
  if (Object.keys(env).some(settingsConflict) || env.CLAUDECODE) throw conflict();
  const managed = platform === "darwin" ? "/Library/Application Support/ClaudeCode" : "/etc/claude-code";
  const policies = [path.join(managed, "managed-settings.json"), path.join(managed, "managed-settings.d"),
    path.join(config, "remote-settings.json")];
  if (platform === "darwin") {
    const plist = "com.anthropic.claudecode.plist";
    policies.push(path.join("/Library/Managed Preferences", plist),
      path.join("/Library/Managed Preferences", os.userInfo().username, plist),
      path.join(os.homedir(), "Library/Managed Preferences", plist));
  }
  if (policies.some(exists)) throw conflict();
  const git = spawnSync("git", ["worktree", "list", "--porcelain", "-z"], { encoding: "utf8", timeout: 2000, maxBuffer: 1024 * 1024 });
  const main = git.status === 0 ? /^worktree ([^\0]+)\0/.exec(git.stdout)?.[1] : undefined;
  const project = path.join(process.cwd(), ".claude");
  const locations = [path.join(config, "settings.json"), path.join(project, "settings.json"),
    path.join(project, "settings.local.json"), ...(main ? [path.join(main, ".claude", "settings.local.json")] : [])];
  for (const location of new Set(locations)) {
    if (!exists(location)) continue;
    const root = fs.realpathSync(path.dirname(location));
    const settings = JSON.parse(readBoundedFile(path.join(root, path.basename(location)), { root, maxBytes: 1024 * 1024 }));
    if (!object(settings) || (settings.env !== undefined && !object(settings.env))
        || Object.keys(settings.env ?? {}).some(key => settingsConflict(key) || httpProxies.includes(key) || key === "CLAUDE_CONFIG_DIR")
        || settings.disableAllHooks || settings.allowManagedHooksOnly || settings.disableSideloadFlags || settings.otelHeadersHelper) throw conflict();
  }
  // Keep existing proxy bypass rules intact; refuse a launch that could route capture through a proxy.
  const bypass = [env.NO_PROXY, env.no_proxy].filter(Boolean);
  if (httpProxies.some(key => env[key]) && (!bypass.length || !bypass.every(value =>
    value.split(",").some(item => ["*", "127.0.0.1"].includes(item.trim()))))) throw conflict();
}

function claudeExecutable() {
  for (const directory of (process.env.PATH ?? "").split(path.delimiter)) {
    if (!directory) continue;
    const candidate = path.resolve(directory, "claude");
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      if (fs.statSync(candidate).isFile()) return fs.realpathSync(candidate);
    } catch { /* Continue the PATH lookup. */ }
  }
  throw new Error("Claude Code was not found on PATH.");
}

function installedVersion(executable) {
  const probe = spawnSync(executable, ["--version"], { encoding: "utf8", timeout: 5000, maxBuffer: 8192 });
  const version = probe.status === 0 && /^(\d+\.\d+\.\d+)(?: \(Claude Code\))?\s*$/.exec(probe.stdout)?.[1];
  if (!CLAUDE_CAPTURE_RELEASES.includes(version)) throw new Error("Installed Claude Code version is not qualified for capture.");
  return version;
}

export function execClaude([executable, hostVersion, sessionId, endpoint, transcriptRoot]) {
  const root = process.env[CAPTURE_ENV];
  privateRoot(root);
  if (!path.isAbsolute(executable) || !path.isAbsolute(transcriptRoot) || !sessionIdentifier(sessionId)
      || !endpointPattern.test(endpoint) || !CLAUDE_CAPTURE_RELEASES.includes(hostVersion)) throw new Error("Invalid capture startup binding.");
  // execve replaces this wrapper, preserving the PID and process creation time the receiver checks.
  const boundProcess = { pid: process.pid, createdAt: new Date(performance.timeOrigin).toISOString() };
  const binding = { sessionId, hostVersion, endpoint, transcriptRoot, process: boundProcess };
  fs.writeFileSync(captureFile(root, "binding"), JSON.stringify(binding), { flag: "wx", mode: 0o600 });
  const env = { ...process.env, CLAUDE_CODE_ENABLE_TELEMETRY: "1",
    OTEL_LOGS_EXPORTER: "otlp", OTEL_METRICS_EXPORTER: "none", OTEL_TRACES_EXPORTER: "none",
    OTEL_EXPORTER_OTLP_LOGS_PROTOCOL: "http/json", OTEL_EXPORTER_OTLP_LOGS_ENDPOINT: endpoint,
    OTEL_RESOURCE_ATTRIBUTES: `process.pid=${boundProcess.pid},process.creation.time=${boundProcess.createdAt}`,
    OTEL_LOG_USER_PROMPTS: "0", OTEL_LOG_ASSISTANT_RESPONSES: "0", OTEL_LOG_TOOL_DETAILS: "0",
    OTEL_LOG_TOOL_CONTENT: "0", OTEL_LOG_RAW_API_BODIES: "0", OTEL_LOG_MANAGED_SETTINGS: "0" };
  process.execve(executable, [executable, "--plugin-dir", pluginRoot, "--session-id", sessionId], env);
}

async function receive(request, response, root, expected) {
  if (request.method !== "POST" || request.url !== expected.route || request.socket.remoteAddress !== "127.0.0.1"
      || request.headers.host !== expected.host) {
    response.writeHead(404).end();
    return;
  }
  if (request.headers["content-type"]?.split(";")[0].trim() !== "application/json"
      || (request.headers["content-encoding"] && request.headers["content-encoding"] !== "identity")) {
    response.writeHead(415).end();
    return;
  }
  if (Number(request.headers["content-length"]) > CAPTURE_LIMITS.bodyBytes) {
    response.writeHead(413, { connection: "close" }).end();
    return;
  }
  try {
    const binding = readCaptureBinding(root);
    if (binding.process.pid !== expected.pid || binding.sessionId !== expected.sessionId
        || binding.endpoint !== `http://${expected.host}${expected.route}`) {
      response.writeHead(400).end();
      return;
    }
    let size = 0;
    const chunks = [];
    for await (const chunk of request) {
      size += chunk.length;
      if (size > CAPTURE_LIMITS.bodyBytes) {
        response.writeHead(413).end();
        return;
      }
      chunks.push(chunk);
    }
    const batch = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks, size)));
    const projected = projectTelemetry(batch, binding);
    try { appendCapture(root, "telemetry", projected); }
    catch { markCaptureFailure(root); response.writeHead(503).end(); return; }
    response.writeHead(200, { "content-type": "application/json" }).end("{}");
  } catch {
    response.writeHead(400).end();
  }
}

async function launch() {
  if (!["darwin", "linux"].includes(process.platform) || typeof process.execve !== "function") {
    throw new Error("Local capture requires the Node.js process.execve API on macOS or Linux.");
  }
  const config = path.resolve(process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude"));
  preflightSettings(config);
  const executable = claudeExecutable();
  const version = installedVersion(executable);
  const configRoot = exists(config) ? fs.realpathSync(config) : config;
  const transcriptRoot = path.join(configRoot, "projects");
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "agent-smith-claude-capture-"));
  let child, server, termination, interruption;
  const handlers = new Map(["SIGINT", "SIGTERM", "SIGHUP"].map(signal => [signal, () => {
    if (interruption) return;
    interruption = signal;
    child?.kill(signal);
    termination = setTimeout(() => child?.kill("SIGKILL"), 5000).unref();
  }]));
  for (const [signal, handler] of handlers) process.on(signal, handler);
  try {
    fs.closeSync(fs.openSync(captureFile(root, "native"), "wx", 0o600));
    fs.closeSync(fs.openSync(captureFile(root, "telemetry"), "wx", 0o600));
    const expected = { sessionId: randomUUID(), route: "/" + randomBytes(24).toString("hex") + "/v1/logs" };
    server = http.createServer({ requestTimeout: 5000, headersTimeout: 5000, connectionsCheckingInterval: 1000 },
      (request, response) => { void receive(request, response, root, expected); });
    server.maxConnections = 8;
    server.setTimeout(5000, socket => socket.destroy());
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    if (interruption) return 128 + os.constants.signals[interruption];
    expected.host = "127.0.0.1:" + server.address().port;
    const endpoint = `http://${expected.host}${expected.route}`;
    const exec = `import { execClaude } from ${JSON.stringify(import.meta.url)};
      try { execClaude(process.argv.slice(1)); }
      catch { process.stderr.write("Could not start the bound Claude process.\\n"); process.exitCode = 2; }`;
    child = spawn(process.execPath, ["--disable-warning=ExperimentalWarning", "--input-type=module", "-e", exec,
      executable, version, expected.sessionId, endpoint, transcriptRoot], {
      stdio: "inherit", env: { ...process.env, [CAPTURE_ENV]: root },
    });
    expected.pid = child.pid;
    const code = await new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("close", (status, signal) => resolve(status ?? (128 + os.constants.signals[signal])));
    });
    return interruption ? 128 + os.constants.signals[interruption] : code;
  } finally {
    clearTimeout(termination);
    if (server?.listening) {
      const closed = new Promise(resolve => server.close(resolve));
      server.closeAllConnections();
      await closed;
    }
    for (const [signal, handler] of handlers) process.off(signal, handler);
    // The launcher owns this freshly created directory. Native transcripts stay in Claude's project store.
    try { removeTree(root); }
    catch { process.stderr.write(`Claude capture cleanup failed for ${JSON.stringify(root)}.\n`); }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === script) {
  const [command, ...args] = process.argv.slice(2);
  try {
    if (command === "--versions" && !args.length) process.stdout.write(CLAUDE_CAPTURE_RELEASES.join("\n") + "\n");
    else if (command !== undefined) throw new Error("Start capture without arguments to reserve a fresh interactive Claude session.");
    else process.exitCode = await launch();
  } catch (error) {
    // Settings, exporter responses, and paths provided by them never go into diagnostics.
    const message = error.code || error instanceof SyntaxError || error.reason
      ? "Could not start private Claude capture." : error.message;
    process.stderr.write(`${message} ${guidance}\n`);
    process.exitCode = 2;
  }
}
