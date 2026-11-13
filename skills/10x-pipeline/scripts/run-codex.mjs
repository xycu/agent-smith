// Standalone execution boundary. Router state is read-only here, and no router command is imported.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { StringDecoder } from "node:string_decoder";
import { fileURLToPath } from "node:url";
import {
  ROOT, acquireRunLock, archiveDirs, paths, readMeta, readLog, executed, hostOf, providerOf,
  loadPolicy, policyProblems, parseFlags, isObject, guardedStat,
} from "./state.mjs";
import { dispatchProblem } from "./flow.mjs";
import { archiveDescriptor } from "./isolation.mjs";
import { removeTree } from "./remove-tree.mjs";

const MAX_MESSAGE = 1024 * 1024;
const MAX_EVENT = 8 * 1024 * 1024;
const refuse = (message) => { throw new Error(message); };

function validateAction(action, id, chain, policy) {
  if (!isObject(action) || !["run", "archive"].includes(action.action) || action.provider !== "openai") {
    refuse("Expected an OpenAI run or archive action from the router.");
  }
  if (action.change !== id || action.chain !== chain || typeof action.root !== "string"
    || fs.realpathSync(action.root) !== fs.realpathSync(ROOT)) refuse("Action belongs to another change, chain or run root.");
  const p = paths(id, policy, chain);
  // Inspect only the selected chain. An archived name in the other chain cannot claim this live run.
  if (!fs.existsSync(p.change)) {
    refuse(archiveDirs(id, chain).length ? "This change has already moved to its archive." : "The run's change folder is missing.");
  }
  if (fs.realpathSync(p.change) !== path.join(fs.realpathSync(ROOT), path.relative(ROOT, p.change))) {
    refuse("The change folder must belong to the run root without symlink redirects.");
  }
  if (fs.realpathSync(p.dir) !== path.join(fs.realpathSync(p.change), "agent-smith")
    || !guardedStat(p.meta, p.change) || !guardedStat(p.log, p.change)) refuse("Run state must be regular files inside this change.");
  const meta = readMeta(p.meta, null);
  if (!meta || meta.id !== id || (meta.chain ?? "10x") !== chain || hostOf(meta) !== action.host) {
    refuse("Action does not match the stored run identity and host.");
  }
  if (typeof action.prompt !== "string" || !action.prompt.trim() || action.prompt.includes("\0")) refuse("Action has no usable prompt.");
  if (!["model", "effort"].every((key) => typeof action[key] === "string" && action[key].trim() && !/[\0\r\n]/.test(action[key]))) {
    refuse("Action has an invalid model or effort.");
  }
  if (action.profile !== null && (typeof action.profile !== "string" || !action.profile.trim() || /[\0\r\n]/.test(action.profile))) {
    refuse("Action profile must be null or an existing configuration profile name.");
  }
  const log = readLog(p.log);
  if (action.action === "run") {
    const entry = executed(log).at(-1);
    if (meta.outcome || !entry || entry.result !== undefined || fs.existsSync(p.result)
      || !Number.isSafeInteger(action.n) || action.n < 1 || entry.n !== action.n || entry.step !== action.step
      || providerOf(entry) !== "openai" || entry.model !== action.model || entry.effort !== action.effort
      || entry.profile !== action.profile || entry.pendingPrompt !== action.prompt
      || action.resultFile !== path.relative(ROOT, p.result) || action.agent !== entry.agent) {
      refuse("Run action is stale, already consumed, or differs from the exact pending dispatch.");
    }
    const unsupported = dispatchProblem(policy, entry, entry.step, entry.template ?? entry.step);
    if (unsupported) refuse(unsupported);
  } else {
    if (meta.archive !== true || meta.outcome?.action !== "done" || Object.hasOwn(action, "resultFile")) {
      refuse("Archive action requires an ended archive run and no result destination.");
    }
    const expected = archiveDescriptor(p, id, meta, log, policy);
    for (const key of ["provider", "model", "effort", "profile", "archivePath"]) {
      if (action[key] !== expected[key]) refuse(`Archive action has a stale ${key}. Resume the router for a current action.`);
    }
    if (fs.existsSync(path.join(ROOT, expected.archivePath))) refuse("The archive destination already exists.");
    const step = chain === "openspec" ? "os-archive" : "archive";
    const unsupported = dispatchProblem(policy, expected, step, step);
    if (unsupported) refuse(unsupported);
  }
  return p;
}

// Native sandbox uses the same config selection and cwd. Legacy sandbox_mode can be forced read-only, so failure
// cannot establish exec's effective permissions. Exec retains its hooks and execpolicy, which this filesystem proof
// does not exercise. Probe files have invalid ref names and are removed immediately. Commit proof uses an unrelated repo.
const PERMISSION_PROBE = `
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { removeTree } from ${JSON.stringify(new URL("./remove-tree.mjs", import.meta.url).href)};
const [root, scratch] = process.argv.slice(2);
const git = (args, cwd = root) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const gitDir = fs.realpathSync(git(["rev-parse", "--path-format=absolute", "--git-dir"]));
const common = fs.realpathSync(git(["rev-parse", "--path-format=absolute", "--git-common-dir"]));
const dirs = [...new Set([gitDir, common, path.join(common, "objects"), path.join(common, "refs"), path.join(common, "refs/heads")])];
for (const dir of dirs) {
  const file = path.join(fs.realpathSync(dir), ".agent-smith-probe-" + crypto.randomUUID());
  let fd;
  try { fd = fs.openSync(file, "wx", 0o600); fs.writeSync(fd, "permission probe"); }
  finally { if (fd !== undefined) { fs.closeSync(fd); fs.unlinkSync(file); } }
}
const fixture = path.join(scratch, "git-proof");
fs.mkdirSync(fixture);
try {
  git(["init", "--quiet", "--initial-branch=main", fixture]);
  const identity = ["-c", "user.name=Agent Smith permission probe", "-c", "user.email=agent-smith@example.invalid"];
  git([...identity, "commit", "--quiet", "--allow-empty", "-m", "chore: initialize permission proof"], fixture);
  const linked = path.join(fixture, "linked");
  git(["worktree", "add", "--quiet", "--detach", linked, "HEAD"], fixture);
  fs.writeFileSync(path.join(linked, "proof.txt"), "child-owned commit proof\\n");
  git(["add", "--", "proof.txt"], linked);
  git([...identity, "commit", "--quiet", "-m", "test: prove child commit permissions", "-m", "Co-Authored-By: Agent Smith <agent-smith@example.invalid>"], linked);
  if (git(["log", "-1", "--format=%s"], linked) !== "test: prove child commit permissions") throw new Error("Commit proof was not retained");
  if (git(["status", "--porcelain"], linked)) throw new Error("Commit proof left uncommitted changes");
  process.stdout.write(JSON.stringify({ gitDir, commonDir: common, commit: git(["rev-parse", "HEAD"], linked) }) + "\\n");
} finally { removeTree(fixture); }
`;

function configArgs(action) {
  return ["-C", ROOT, ...(action.profile === null ? [] : ["-p", action.profile]),
    "-c", `model_reasoning_effort=${JSON.stringify(action.effort)}`, "-c", "agents.enabled=false", "--disable", "multi_agent_v2"];
}

function readResult(message) {
  const lines = message.split(/\r?\n/).filter((line) => /^RESULT:/.test(line));
  if (!lines.length) refuse("The final assistant message has no RESULT line.");
  let result;
  try { result = JSON.parse(lines.at(-1).slice("RESULT:".length).trim()); }
  catch { refuse("The last RESULT line is invalid JSON."); }
  if (!isObject(result) || typeof result.status !== "string" || !result.status.trim()) refuse("RESULT must be an object with a status.");
  if (result.status === "orchestrator-error") result.status = "unknown";
  return result;
}

function tokenTotal(usage) {
  if (usage === undefined || usage === null) return undefined;
  if (!isObject(usage)) refuse("Codex returned malformed usage counters.");
  for (const key of ["input_tokens", "output_tokens", "cached_input_tokens", "cache_write_input_tokens", "reasoning_output_tokens"]) {
    const value = usage[key];
    if (value !== undefined && (!Number.isSafeInteger(value) || value < 0)) refuse("Codex returned unsafe usage counters.");
  }
  if (usage.input_tokens === undefined || usage.output_tokens === undefined) return undefined;
  const total = usage.input_tokens + usage.output_tokens;
  if (!Number.isSafeInteger(total)) refuse("Codex token total overflowed.");
  return total;
}

export async function runCodex(id, chain, action) {
  const envelope = { action: "codex-result", launched: false, completed: false, result: null };
  let release;
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
    killTimer ??= setTimeout(() => kill("SIGKILL"), 5000);
  };
  const onInt = () => terminate("SIGINT");
  const onTerm = () => terminate("SIGTERM");
  process.on("SIGINT", onInt);
  process.on("SIGTERM", onTerm);
  // Every spawned process is awaited through close, including preflight and spawn failures.
  const launch = (args, input, onStdout, model = false) => new Promise((resolve) => {
    let error;
    let streamError;
    child = spawn("codex", args, { cwd: ROOT, stdio: ["pipe", "pipe", "pipe"], detached: process.platform !== "win32" });
    child.on("spawn", () => { if (model) envelope.launched = true; if (cancelled) terminate(cancelled); });
    child.on("error", (e) => { error = e.code ?? "spawn error"; });
    child.stdout.on("data", (chunk) => {
      try { onStdout(chunk); }
      catch { streamError = "Codex output could not be captured."; terminate("SIGTERM"); }
    });
    child.stderr.resume();
    child.stdin.on("error", () => { /* close carries early exit and broken-pipe failures */ });
    child.on("close", (code, signal) => { child = null; clearTimeout(killTimer); killTimer = null; resolve({ code, signal, error: error ?? streamError }); });
    child.stdin.end(input);
  });
  try {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(id ?? "") || !["10x", "openspec"].includes(chain)) refuse("Invalid change ID or chain.");
    release = acquireRunLock(id, chain, refuse);
    const policy = loadPolicy(refuse);
    const bad = policyProblems(policy);
    if (bad) refuse(bad);
    validateAction(action, id, chain, policy);
    const tempRoot = fs.realpathSync(os.tmpdir());
    const relativeTemp = path.relative(fs.realpathSync(ROOT), tempRoot);
    if (relativeTemp === "" || (!relativeTemp.startsWith(".." + path.sep) && relativeTemp !== ".." && !path.isAbsolute(relativeTemp))) {
      refuse("The OS temporary directory must be outside the run worktree. Select an external TMPDIR before retrying.");
    }
    temp = fs.mkdtempSync(path.join(tempRoot, "agent-smith-codex-"));
    const probe = path.join(temp, "permission-probe.mjs");
    fs.writeFileSync(probe, PERMISSION_PROBE, { mode: 0o600 });
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
    if (preflight.error || preflight.code !== 0) {
      refuse("Codex permission preflight cannot verify required Git capability. Check the existing default configuration or selected optional profile, managed requirements, outer host permissions and native sandbox support. The native sandbox can force legacy sandbox_mode configuration to read-only, preventing proof of permission parity with exec. Resolve the unavailable or inconsistent preflight before retrying. No model launched.");
    }
    let proof;
    try { proof = JSON.parse(proofText.trim()); } catch { refuse("Codex sandbox returned no verifiable permission proof. Upgrade to a CLI with supported sandbox preflight."); }
    if (!isObject(proof) || !/^[a-f0-9]{40,64}$/.test(proof.commit ?? "")) refuse("Codex permission proof is incomplete.");
    envelope.preflight = proof;
    // Recheck after preflight without releasing the shared lock.
    validateAction(action, id, chain, policy);
    const finalFile = path.join(temp, "final.txt");
    const transcript = fs.openSync(path.join(temp, "events.jsonl"), "wx", 0o600);
    let pending = "";
    const decoder = new StringDecoder("utf8");
    let protocolError;
    let terminal;
    let latestUsage;
    let finalMessage;
    const event = (line) => {
      if (!line.trim() || protocolError) return;
      if (Buffer.byteLength(line) > MAX_EVENT) { protocolError = "Codex emitted an oversized event."; return; }
      try {
        const e = JSON.parse(line);
        if (e.type === "turn.started") terminal = "started";
        if (["turn.completed", "turn.failed", "turn.interrupted", "error"].includes(e.type)) terminal = e.type;
        if (e.type === "turn.completed") latestUsage = e.usage;
        if (e.type === "item.completed" && e.item?.type === "agent_message") finalMessage = e.item.text;
      } catch { protocolError = "Codex emitted malformed JSONL."; }
    };
    const start = process.hrtime.bigint();
    let completion;
    try {
      completion = await launch(["exec", ...configArgs(action), "-m", action.model, "--json", "--ephemeral", "-o", finalFile, "-"], action.prompt, (chunk) => {
        fs.writeSync(transcript, chunk);
        if (protocolError) return;
        pending += decoder.write(chunk);
        const lines = pending.split("\n");
        pending = lines.pop();
        for (const line of lines) event(line);
        if (Buffer.byteLength(pending) > MAX_EVENT) { protocolError = "Codex emitted an oversized event."; pending = ""; }
      }, true);
    } finally { fs.closeSync(transcript); }
    envelope.usage = { durationMs: Number((process.hrtime.bigint() - start) / 1000000n) };
    envelope.exitCode = completion.code;
    envelope.signal = completion.signal;
    pending += decoder.end();
    if (pending) event(pending);
    const total = tokenTotal(latestUsage);
    if (total !== undefined) envelope.usage.totalTokens = total;
    if (cancelled) refuse(`Execution cancelled by ${cancelled}. The child has closed.`);
    if (completion.error) refuse(`Codex launch failed (${completion.error}).`);
    if (completion.code !== 0) refuse("Codex exited unsuccessfully. The child result was not accepted.");
    if (protocolError) refuse(protocolError);
    if (terminal !== "turn.completed") refuse("Codex has no final successful completed turn.");
    const stat = fs.lstatSync(finalFile);
    if (!stat.isFile() || stat.size > MAX_MESSAGE) refuse("Codex final message file is missing or oversized.");
    const reply = fs.readFileSync(finalFile, "utf8");
    if (typeof finalMessage !== "string" || finalMessage !== reply) refuse("Codex final file does not match the final assistant message.");
    envelope.result = { ...readResult(reply), usage: envelope.usage };
    envelope.completed = true;
    if (action.action === "archive") envelope.reply = reply;
  } catch (error) {
    envelope.reason = error instanceof Error ? error.message : "Codex runner failed.";
  } finally {
    // Cancellation leaves the lock held until close and cleanup. No file is ever written back into a moved change.
    clearTimeout(killTimer);
    if (temp) {
      try { removeTree(temp); }
      catch { envelope.completed = false; envelope.reason = "Codex temporary-file cleanup failed."; }
    }
    release?.();
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
    process.stdout.write(JSON.stringify({ action: "codex-result", launched: false, completed: false, result: null, reason: error.message }) + "\n");
    process.exitCode = 1;
  });
}
