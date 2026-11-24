// Both external transports consume the exact dispatch retained by the router under its run lock.
import fs from "node:fs";
import path from "node:path";
import {
  ROOT, archiveDirs, paths, readMeta, readLog, executed, hostOf, providerOf,
  selectionProblem, isObject, guardedStat, loadPolicy, policyProblems, PERMISSIONS_NAME_RE,
} from "./state.mjs";
import { advisorOn, dispatchProblem, promptFilePath } from "./flow.mjs";
import { archiveDescriptor, matchesHeadlessGuard } from "./isolation.mjs";

const refuse = (message) => { throw new Error(message); };

export function validateAction(action, id, chain, provider, preflight) {
  const policy = loadPolicy(refuse);
  const problem = policyProblems(policy, false);
  if (problem) refuse(problem);
  if (!isObject(action) || !["run", "archive"].includes(action.action) || action.provider !== provider) {
    refuse(`Expected ${provider === "openai" ? "an OpenAI" : "a Claude"} run or archive action from the router.`);
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
  if (provider === "claude" && hostOf(meta) !== "codex") refuse("Native Claude actions belong to the Claude host.");
  if (provider === "claude" && !matchesHeadlessGuard(meta)) refuse("The Claude agent or hook revision differs from the routed run. Resume on its enabling revision.");
  const invalid = selectionProblem(policy, meta, action.action === "archive");
  if (invalid) refuse(invalid);
  if (typeof action.prompt !== "string" || !action.prompt.trim() || action.prompt.includes("\0")) refuse("Action has no usable prompt.");
  if (!["model", "effort"].every((key) => typeof action[key] === "string" && action[key].trim() && !/[\0\r\n]/.test(action[key]))) {
    refuse("Action has an invalid model or effort.");
  }
  if (!(provider === "claude" && action.profile === undefined) && action.profile !== null && (typeof action.profile !== "string" || !action.profile.trim() || /[\0\r\n]/.test(action.profile))) {
    refuse("Action profile must be null or an existing configuration profile name.");
  }
  if (action.permissions != null && (typeof action.permissions !== "string" || !PERMISSIONS_NAME_RE.test(action.permissions))) {
    refuse("Action permissions must be null or a custom permissions profile name.");
  }
  const { entries: log } = readLog(p.log);
  let dispatch;
  if (action.action === "run") {
    const entry = executed(log).at(-1);
    if (meta.outcome || !entry || entry.result !== undefined || fs.existsSync(p.result)
      || !Number.isSafeInteger(action.n) || action.n < 1 || entry.n !== action.n || entry.step !== action.step
      || providerOf(entry) !== provider || entry.model !== action.model || entry.effort !== action.effort
      || entry.profile !== action.profile || (entry.permissions ?? null) !== (action.permissions ?? null)
      || action.resultFile !== path.relative(ROOT, p.result) || action.agent !== entry.agent) {
      refuse("Run action is stale, already consumed, or differs from the exact pending dispatch.");
    }
    if (entry.pendingHandoff) {
      const file = promptFilePath(p);
      if (entry.pendingHandoff.promptFile !== path.relative(ROOT, file)
        || action.promptFile !== entry.pendingHandoff.promptFile || action.prompt !== entry.pendingHandoff.prompt
        || !guardedStat(file, p.dir) || !fs.readFileSync(file).equals(Buffer.from(entry.pendingPrompt))) {
        refuse("File handoff differs from the exact pending dispatch or task bytes.");
      }
    } else if (Object.hasOwn(action, "promptFile") || entry.pendingPrompt !== action.prompt) {
      refuse("Run action differs from the exact inline pending dispatch.");
    }
    dispatch = entry;
    const unsupported = dispatchProblem(policy, entry, entry.step, entry.template ?? entry.step);
    if (unsupported) refuse(unsupported);
  } else {
    if (meta.archive !== true || meta.outcome?.action !== "done" || Object.hasOwn(action, "resultFile") || Object.hasOwn(action, "promptFile") || Object.hasOwn(action, "pendingHandoff")) {
      refuse("Archive action requires an ended archive run and no result destination.");
    }
    const expected = archiveDescriptor(p, id, meta, log, policy);
    for (const key of ["provider", "model", "effort", "profile", "permissions", "archivePath", "prompt", "agent"]) {
      // Actions and descriptors saved before codex.permissions lack the key; absent reads as null.
      const value = (source) => key === "permissions" ? source[key] ?? null : source[key];
      if (value(action) !== value(expected)) refuse(`Archive action has a stale ${key}. Resume the router for a current action.`);
    }
    if (fs.existsSync(path.join(ROOT, expected.archivePath))) refuse("The archive destination already exists.");
    const step = chain === "openspec" ? "os-archive" : "archive";
    dispatch = { step, template: step, skill: policy.steps[step].skill, advisor: advisorOn(policy, step) };
    const unsupported = dispatchProblem(policy, expected, step, step);
    if (unsupported) refuse(unsupported);
  }
  const required = { paths: p, step: dispatch.step, template: dispatch.template ?? dispatch.step,
    skill: dispatch.skill, advisor: dispatch.advisor === true, openspec: chain === "openspec" };
  if (preflight && ["skill", "template", "advisor"].some(key => required[key] !== preflight[key])) {
    refuse("Pending dispatch requirements changed during preflight.");
  }
  return required;
}

export function readResult(message, action) {
  const lines = message.trimEnd().split(/\r?\n/);
  const archive = action.action === "archive";
  const line = archive || action.provider === "claude" ? lines.at(-1) : lines.findLast(line => line.startsWith("RESULT:"));
  if (!line?.startsWith("RESULT:")) refuse("The final assistant message has no RESULT line at the expected position.");
  let result;
  try { result = JSON.parse(line.slice("RESULT:".length).trim()); }
  catch { refuse("The last RESULT line is invalid JSON."); }
  if (!isObject(result) || typeof result.status !== "string" || !result.status.trim()) refuse("RESULT must be an object with a status.");
  if (archive && !["done", "blocked", "failed"].includes(result.status)) refuse("Archive RESULT has an invalid status.");
  if (result.status === "orchestrator-error") result.status = "unknown";
  return result;
}
