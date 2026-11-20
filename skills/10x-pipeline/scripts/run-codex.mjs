// Standalone execution boundary. Router state is read-only here, and no router command is imported.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { StringDecoder } from "node:string_decoder";
import { fileURLToPath } from "node:url";
import {
  ROOT, acquireRunLock, parseFlags, isObject,
} from "./state.mjs";
import { validateAction, readResult } from "./runner-dispatch.mjs";
import { PERMISSION_PROBE } from "./permission-probe.mjs";
import { removeTree } from "./remove-tree.mjs";
import { collectCodexUsage, CODEX_USAGE_LIMITS } from "./codex-usage.mjs";

const MAX_MESSAGE = 1024 * 1024;
const MAX_EVENT = 8 * 1024 * 1024;
const refuse = (message) => { throw new Error(message); };

function failureReason(error) {
  const message = error instanceof Error ? error.message : "Codex runner failed.";
  return message.slice(0, 2048);
}

function configArgs(action) {
  return ["-C", ROOT, ...(action.profile === null ? [] : ["-p", action.profile]),
    "-c", `model_reasoning_effort=${JSON.stringify(action.effort)}`, "-c", "agents.enabled=true", "--disable", "multi_agent_v2"];
}

// Model-free, bounded metadata reads: inactive labels and reconstructed interrupted turns prove no closure.
async function settledDescendants(threadId, rejectedResult, onSettled) {
  const server = spawn("codex", ["app-server", "--stdio"], { cwd: ROOT, stdio: ["pipe", "pipe", "pipe"] });
  let sequence = 0;
  let waiting;
  let failure;
  let buffer = "";
  const decoder = new StringDecoder("utf8");
  const fail = (message) => {
    failure ??= new Error(message);
    waiting?.reject(failure);
    waiting = null;
  };
  const closed = new Promise((resolve) => server.once("close", resolve));
  server.on("error", () => fail("Native metadata service could not start."));
  server.on("close", () => fail("Native metadata service closed before reconciliation."));
  server.stdin.on("error", () => fail("Native metadata service input failed."));
  server.stderr.resume();
  server.stdout.on("data", (chunk) => {
    buffer += decoder.write(chunk);
    const lines = buffer.split("\n");
    buffer = lines.pop();
    if (Buffer.byteLength(buffer) > MAX_EVENT) fail("Native metadata response is oversized.");
    for (const line of lines) {
      if (!line.trim() || failure) continue;
      try {
        if (Buffer.byteLength(line) > MAX_EVENT) throw new Error();
        const response = JSON.parse(line);
        if (!isObject(response)) throw new Error();
        if (!Object.hasOwn(response, "id")) continue; // host notifications carry no response
        if (!waiting || response.id !== waiting.id || response.error || !isObject(response.result)) throw new Error();
        const current = waiting;
        waiting = null;
        current.resolve(response.result);
      } catch { fail("Native metadata response is malformed or mismatched."); }
    }
  });
  let timer = setTimeout(() => fail("Native metadata reconciliation timed out."), 30000);
  const request = (method, params) => new Promise((resolve, reject) => {
    if (failure) { reject(failure); return; }
    const id = ++sequence;
    waiting = { id, resolve, reject };
    server.stdin.write(JSON.stringify({ id, method, params }) + "\n");
  });
  try {
    await request("initialize", { clientInfo: { name: "agent-smith", version: "1" }, capabilities: { experimentalApi: true } });
    server.stdin.write(JSON.stringify({ method: "initialized", params: {} }) + "\n");
    const settledTurn = async (id, allowFailed) => {
      const page = await request("thread/turns/list", { threadId: id, limit: 1, sortDirection: "desc", itemsView: "notLoaded" });
      const turn = page.data?.[0];
      const terminal = turn?.status === "completed" || (allowFailed && turn?.status === "failed");
      if (!Array.isArray(page.data) || page.data.length !== 1 || !terminal
        || !Number.isSafeInteger(turn.completedAt) || turn.completedAt <= 0
        || (turn.startedAt != null && (!Number.isSafeInteger(turn.startedAt) || turn.startedAt > turn.completedAt))) {
        refuse(allowFailed ? "Native parent has no proven terminal latest turn."
          : "Native parent or descendant has no proven completed latest turn.");
      }
      return { id, turn };
    };
    const threads = [await settledTurn(threadId, rejectedResult)];
    const enumerate = async () => {
      const descendants = new Set();
      for (const archived of [false, true]) {
        let cursor = null;
        const cursors = new Set();
        do {
          const page = await request("thread/list", { ancestorThreadId: threadId, archived, cursor, limit: 100,
            sourceKinds: ["cli", "vscode", "exec", "appServer", "subAgent", "subAgentReview", "subAgentCompact", "subAgentThreadSpawn", "subAgentOther", "unknown"] });
          if (!Array.isArray(page.data) || !Object.hasOwn(page, "nextCursor")
            || (page.nextCursor !== null && (typeof page.nextCursor !== "string" || !page.nextCursor))) {
            refuse("Native descendant enumeration is incomplete.");
          }
          for (const entry of page.data) {
            if (typeof entry?.id !== "string" || !/^[a-zA-Z0-9_/-]{1,128}$/.test(entry.id) || entry.id === threadId) {
              refuse("Native descendant identity is invalid.");
            }
            descendants.add(entry.id);
          }
          cursor = page.nextCursor;
          if (cursor !== null && (cursors.has(cursor) || cursors.size >= 1000)) refuse("Native descendant pagination did not complete.");
          cursors.add(cursor);
        } while (cursor !== null);
      }
      return descendants;
    };
    const descendants = await enumerate();
    for (const id of descendants) threads.push(await settledTurn(id, false));
    // A child may have spawned another child while its first metadata read was in flight.
    const finalDescendants = await enumerate();
    if (finalDescendants.size !== descendants.size || [...finalDescendants].some(id => !descendants.has(id))) {
      refuse("Native descendant membership changed during reconciliation.");
    }
    if (failure) throw failure;
    onSettled();
    if (rejectedResult) return;
    // Closure is already proved. Optional accounting metadata cannot retain native execution ownership.
    clearTimeout(timer);
    const deadline = Date.now() + CODEX_USAGE_LIMITS.readMs;
    let metadataReason;
    timer = setTimeout(() => fail("Native usage metadata read timed out."), CODEX_USAGE_LIMITS.readMs);
    try {
      if (threads.length > CODEX_USAGE_LIMITS.sessions) metadataReason = "resource-limit";
      else for (const item of threads) {
        const response = await request("thread/read", { threadId: item.id, includeTurns: false });
        item.metadata = response.thread;
      }
    } catch {
      metadataReason = Date.now() >= deadline ? "resource-limit" : "missing-source";
    }
    return { threads, metadataReason, deadline };
  } finally {
    clearTimeout(timer);
    server.stdin.end();
    server.kill("SIGTERM");
    const kill = setTimeout(() => server.kill("SIGKILL"), 1000);
    await closed;
    clearTimeout(kill);
  }
}

export async function runCodex(id, chain, action, { terminationGraceMs = 5000 } = {}) {
  const envelope = { action: "codex-result", launched: false, completed: false, result: null };
  let lock;
  let temp;
  let child;
  let cancelled = null;
  let killTimer;
  const terminate = (signal) => {
    cancelled ??= signal;
    if (!child?.pid) return;
    const kill = (sig) => {
      try { process.kill(process.platform === "win32" ? child.pid : -child.pid, sig); }
      catch (error) { if (error.code !== "ESRCH") throw error; }
    };
    kill(signal);
    killTimer ??= setTimeout(() => kill("SIGKILL"), terminationGraceMs);
  };
  const onInt = () => terminate("SIGINT");
  const onTerm = () => terminate("SIGTERM");
  process.on("SIGINT", onInt);
  process.on("SIGTERM", onTerm);
  // Every spawned process is awaited through close, including preflight and spawn failures.
  const launch = (args, input, onStdout, model = false) => new Promise((resolve) => {
    let error;
    let streamError;
    lock.setChild(null, model);
    try {
      child = spawn("codex", args, { cwd: ROOT, stdio: ["pipe", "pipe", "pipe"], detached: process.platform !== "win32" });
    } catch (cause) {
      lock.clearChild(true); // synchronous spawn failure created no process
      resolve({ error: cause.code ?? "spawn error" });
      return;
    }
    child.on("spawn", () => {
      if (model) envelope.launched = true;
      try { lock.setChild(child.pid, model); }
      catch { error = "child ownership could not be recorded"; terminate("SIGTERM"); }
      if (cancelled) terminate(cancelled);
    });
    child.on("error", (e) => { error = e.code ?? "spawn error"; });
    child.stdout.on("data", (chunk) => {
      try { onStdout(chunk); }
      catch { streamError = "Codex output could not be captured."; terminate("SIGTERM"); }
    });
    child.stdout.on("error", () => { streamError ??= "Codex output could not be captured."; });
    child.stderr.on("error", () => { streamError ??= "Codex error output could not be drained."; });
    child.stderr.resume();
    child.stdin.on("error", () => { streamError ??= "Codex input could not be sent."; });
    child.on("close", (code, signal) => {
      child = null;
      clearTimeout(killTimer);
      killTimer = null;
      try { if (!model || !envelope.launched) lock.clearChild(true); }
      catch (cause) { error = failureReason(cause); }
      resolve({ code, signal, error, streamError });
    });
    child.stdin.end(input);
  });
  try {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(id ?? "") || !["10x", "openspec"].includes(chain)) refuse("Invalid change ID or chain.");
    lock = acquireRunLock(id, chain, refuse);
    const required = validateAction(action, id, chain, "openai");
    const tempRoot = fs.realpathSync(os.tmpdir());
    temp = fs.mkdtempSync(path.join(tempRoot, "agent-smith-codex-"));
    const probe = path.join(temp, "permission-probe.mjs");
    fs.writeFileSync(probe, `import { proveCodexToolkit } from ${JSON.stringify(new URL("./runner-toolkit.mjs", import.meta.url).href)};
`
      + `try { await proveCodexToolkit(${JSON.stringify({ skill: required.skill ?? null, openspec: required.openspec, profile: action.profile })}); } catch { process.stdout.write(JSON.stringify({ toolkitUnavailable: true })); process.exit(1); }
`
      + PERMISSION_PROBE, { mode: 0o600 });
    let proofText = "";
    let preflightExpired = false;
    const preflightTimer = setTimeout(() => { preflightExpired = true; terminate("SIGTERM"); }, 30000);
    let preflight;
    try {
      preflight = await launch(["sandbox", ...configArgs(action).slice(2), "--", process.execPath, probe, ROOT, temp], "",
        (chunk) => { proofText = (proofText + chunk).slice(-8192); });
    } finally { clearTimeout(preflightTimer); }
    if (preflightExpired) refuse("Codex permission preflight timed out. Resolve pending Git hooks, signing or approvals before retrying. No model launched.");
    if (cancelled) refuse(`Execution cancelled by ${cancelled} during permission preflight.`);
    if (preflight.code !== 0 && proofText.trim() === '{"toolkitUnavailable":true}') {
      refuse(`Codex cannot verify ${required.skill ?? "the required toolkit"} for ${required.template}${required.openspec ? " and OpenSpec CLI 2.0.0" : ""} inside its sandbox. No model launched.`);
    }
    if (preflight.error || preflight.streamError || preflight.code !== 0) {
      refuse("Codex permission preflight cannot verify required Git capability. Check the existing default configuration or selected optional profile, managed requirements, outer host permissions and native sandbox support. The native sandbox can force legacy sandbox_mode configuration to read-only, preventing proof of permission parity with exec. Resolve the unavailable or inconsistent preflight before retrying. No model launched.");
    }
    let proof;
    try { proof = JSON.parse(proofText.trim()); } catch { refuse("Codex sandbox returned no verifiable permission proof. Upgrade to a CLI with supported sandbox preflight."); }
    if (!isObject(proof) || !/^[a-f0-9]{40,64}$/.test(proof.commit ?? "")) refuse("Codex permission proof is incomplete.");
    envelope.preflight = proof;
    // Recheck after preflight without releasing the shared lock.
    validateAction(action, id, chain, "openai", required);
    const finalFile = path.join(temp, "final.txt");
    const transcript = fs.openSync(path.join(temp, "events.jsonl"), "wx", 0o600);
    let fragments = [];
    let pendingBytes = 0;
    const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
    let protocolError;
    let terminal;
    let interrupted = false;
    let latestUsage;
    let finalMessage;
    let delegated = false;
    let rootThread;
    const finishEvent = () => {
      const bytes = Buffer.concat(fragments, pendingBytes);
      fragments = [];
      pendingBytes = 0;
      let line;
      try { line = decoder.decode(bytes); }
      catch { protocolError = "Codex emitted invalid UTF-8 JSONL."; return; }
      if (!line.trim()) return;
      try {
        const e = JSON.parse(line);
        if (!isObject(e)) throw new Error();
        if (e.item?.type === "collab_tool_call") delegated = true;
        if (e.type === "thread.started" && rootThread === undefined) {
          if (typeof e.thread_id !== "string" || !/^[a-zA-Z0-9_/-]{1,128}$/.test(e.thread_id)) throw new Error();
          lock.setThread(e.thread_id);
          rootThread = e.thread_id;
        }
        if (e.thread_id !== undefined && e.thread_id !== rootThread) return;
        if (e.type === "turn.interrupted") interrupted = true;
        if (e.type === "turn.started") {
          terminal = "started";
          finalMessage = undefined;
        }
        if (["turn.completed", "turn.failed", "turn.interrupted", "error"].includes(e.type)) terminal = e.type;
        if (e.type === "turn.completed") latestUsage = e.usage;
        if (e.type === "item.completed" && e.item?.type === "agent_message") finalMessage = e.item.text;
      } catch { protocolError = "Codex emitted malformed JSONL."; }
    };
    const start = process.hrtime.bigint();
    let completion;
    try {
      completion = await launch(["exec", ...configArgs(action), "-m", action.model, "--json", "-o", finalFile, "-"], action.prompt, (chunk) => {
        fs.writeSync(transcript, chunk);
        for (let start = 0; start < chunk.length && !protocolError;) {
          const newline = chunk.indexOf(0x0a, start);
          const end = newline < 0 ? chunk.length : newline;
          pendingBytes += end - start;
          if (pendingBytes > MAX_EVENT) { protocolError = "Codex emitted an oversized event."; break; }
          fragments.push(chunk.subarray(start, end));
          if (newline < 0) break;
          finishEvent();
          start = newline + 1;
        }
      }, true);
    } finally { fs.closeSync(transcript); }
    envelope.usage = { durationMs: Number((process.hrtime.bigint() - start) / 1000000n) };
    envelope.exitCode = completion.code;
    envelope.signal = completion.signal;
    if (!protocolError && pendingBytes) finishEvent();
    if (cancelled) refuse(`Execution cancelled by ${cancelled}. Native settlement is unverified.`);
    if (completion.error) refuse(`Codex launch failed (${completion.error}).`);
    if (completion.streamError) refuse(completion.streamError);
    if (completion.signal) refuse(`Codex exited on signal ${completion.signal}. The child result was not accepted.`);
    if (protocolError) refuse(protocolError);
    if (interrupted && action.action === "run") refuse("The Codex root turn was interrupted.");
    if (!rootThread) refuse("Missing native parent identity.");
    const canSettleFailure = envelope.launched && action.action === "run";
    let rejection;
    let result;
    let reply;
    if (completion.code !== 0) {
      rejection = "Codex exited unsuccessfully. The child result was not accepted.";
      if (!canSettleFailure || !Number.isInteger(completion.code)) refuse(rejection);
    } else if (canSettleFailure && terminal === "turn.failed") {
      rejection = "Codex has no final successful completed turn.";
    } else {
      if (terminal !== "turn.completed") refuse("Codex has no final successful completed turn.");
      const stat = fs.lstatSync(finalFile);
      if (!stat.isFile() || stat.size > MAX_MESSAGE) refuse("Codex final message file is missing or oversized.");
      reply = fs.readFileSync(finalFile, "utf8");
      if (typeof finalMessage !== "string" || finalMessage !== reply) refuse("Codex final file does not match the final assistant message.");
      try { result = readResult(reply, action); }
      catch (error) {
        if (!canSettleFailure) throw error;
        rejection = failureReason(error);
      }
    }
    let settled;
    try {
      settled = await settledDescendants(rootThread, Boolean(rejection), () => {
        if (cancelled) refuse(`Execution cancelled by ${cancelled} during native reconciliation.`);
        lock.clearChild(true);
      });
    } catch (error) {
      if (rejection) refuse(`${rejection} Native settlement failed: ${failureReason(error)}`);
      throw error;
    }
    if (rejection) refuse(rejection);
    const accounting = collectCodexUsage({ rootThreadId: rootThread, ...settled, delegated, execUsage: latestUsage });
    Object.assign(envelope.usage, accounting.usage);
    envelope.usageEvidence = accounting.usageEvidence;
    envelope.result = { ...result, usage: envelope.usage, usageEvidence: envelope.usageEvidence };
    if (accounting.usageEvidence.status === "unavailable") {
      const assumptions = Array.isArray(result.assumptions) ? result.assumptions : [];
      envelope.result.assumptions = [...assumptions,
        `Codex observed step-tree token coverage is unavailable (${accounting.usageEvidence.reason}); totalTokens omitted. Duration measures the enclosing exec including child waits.`];
    }
    envelope.completed = true;
    if (action.action === "archive") envelope.reply = reply;
  } catch (error) {
    envelope.reason = failureReason(error);
  } finally {
    // Cancellation leaves the lock held until close and cleanup. No file is ever written back into a moved change.
    clearTimeout(killTimer);
    if (temp) {
      try { removeTree(temp); }
      catch {
        envelope.completed = false;
        envelope.reason = [envelope.reason, "Codex temporary-file cleanup failed."].filter(Boolean).join(" ").slice(0, 2048);
      }
    }
    const retained = lock?.retainedReason();
    if (retained) {
      envelope.completed = false;
      envelope.result = null;
      envelope.reason = (retained + " " + (envelope.reason ?? "")).slice(0, 2048);
    }
    lock?.release();
    process.removeListener("SIGINT", onInt);
    process.removeListener("SIGTERM", onTerm);
  }
  return envelope;
}

async function main() {
  const [id, ...rest] = process.argv.slice(2);
  const flags = parseFlags(rest, ["chain"]);
  if (flags._.length || Object.keys(flags).some((key) => !["_", "chain"].includes(key))) refuse("Usage: run-codex.mjs <id> [--chain 10x|openspec], with the router action on stdin.");
  let input = "";
  process.stdin.setEncoding("utf8");
  for await (const chunk of process.stdin) {
    input += chunk;
    if (Buffer.byteLength(input) > 8 * MAX_MESSAGE) refuse("Router action is oversized.");
  }
  let action;
  try { action = JSON.parse(input); } catch { refuse("Expected a JSON router action on stdin."); }
  const result = await runCodex(id, flags.chain ?? "10x", action);
  process.stdout.write(JSON.stringify(result) + "\n");
  process.exitCode = result.completed ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stdout.write(JSON.stringify({ action: "codex-result", launched: false, completed: false, result: null, reason: failureReason(error) }) + "\n");
    process.exitCode = 1;
  });
}
