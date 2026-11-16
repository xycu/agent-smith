// Standalone isolation-policy projection and immutable run identity, without router entrypoint imports.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SKILL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

export function readPolicyObject(file) {
  const value = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!isObject(value)) throw new Error(`${file} must hold a JSON object`);
  return value;
}

export function readIsolationPolicy(root, skill = SKILL, projectPolicy) {
  const policies = [readPolicyObject(path.join(skill, "policy.json")),
    readPolicyObject(path.join(skill, "../openspec-pipeline/policy.json"))];
  const override = path.join(root, "context/foundation/agent-smith-policy.json");
  let present = true;
  try { fs.lstatSync(override); } catch (error) {
    if (error.code !== "ENOENT") throw error;
    present = false;
  }
  if (projectPolicy !== undefined) policies.push(projectPolicy);
  else if (present) policies.push(readPolicyObject(override));
  let isolation;
  for (const policy of policies) {
    if (!Object.hasOwn(policy, "isolation")) continue;
    const over = policy.isolation;
    isolation = isObject(over) && (isolation === null || typeof isolation === "object") && !Array.isArray(isolation)
      ? { ...isolation, ...over } : over;
  }
  return isolation;
}

export const isolationEnabled = (config) => isObject(config) && config.require === true;

function branchPrefix(config) {
  const prefix = Object.hasOwn(config, "branchPrefix") ? config.branchPrefix : "agent-smith/";
  if (typeof prefix !== "string" || !prefix.trim()) {
    throw new Error("isolation.branchPrefix must be a non-blank string when isolation is required");
  }
  return prefix;
}

function validBranch(branch, g) {
  if (typeof branch !== "string" || !branch || branch.startsWith("-")) throw new Error(`Invalid run branch ${JSON.stringify(branch)}`);
  const result = g(["check-ref-format", `refs/heads/${branch}`]);
  if (result.status !== 0 || result.timedOut || result.missing) {
    throw new Error(`Invalid run branch ${JSON.stringify(branch)}: ${result.timedOut ? "Git timed out" : result.stderr?.trim() || "Git ref validation failed"}`);
  }
}

export function runBranch(config, id, g) {
  const branch = `${branchPrefix(config)}${id}`;
  validateRunBranch(config, id, branch, g);
  return branch;
}

export function validateRunBranch(config, id, branch, g) {
  const prefix = branchPrefix(config);
  validBranch(`${prefix}${id}`, g);
  validBranch(branch, g);
  const defaults = Array.isArray(config.defaultBranches) ? config.defaultBranches : [];
  const remote = g(["symbolic-ref", "-q", "--short", "refs/remotes/origin/HEAD"]);
  if (remote.timedOut || remote.missing || ![0, 1].includes(remote.status)) throw new Error("Cannot read the remote default branch");
  const remoteDefault = remote.status === 0 ? remote.stdout.trim().replace(/^origin\//, "") : "";
  if (defaults.includes(branch) || (remoteDefault && remoteDefault === branch)) {
    throw new Error(`Branch ${branch} is a default branch; run isolation needs a run branch of its own`);
  }
  if (!branch.startsWith(prefix)) {
    throw new Error(`Branch ${branch} does not start with ${prefix}; restore isolation.branchPrefix to match the recorded branch ${branch} and resume its worktree (configured branch ${prefix}${id})`);
  }
  return branch;
}

export function readRunIdentity(changeDir) {
  const file = path.join(changeDir, "agent-smith/meta.json");
  let meta;
  try { meta = readPolicyObject(file); } catch (error) {
    if (error.code === "ENOENT") return null;
    throw new Error(`Cannot read saved run identity at ${file}: ${error.message}`);
  }
  return ["id", "chain", "isolated", "branch"].some((key) => Object.hasOwn(meta, key)) ? meta : null;
}

export function validateRunIdentity(meta, config, id, chain, branch, g) {
  if (meta.isolated !== true || meta.id !== id || (meta.chain ?? "10x") !== chain || typeof meta.branch !== "string") {
    throw new Error(`Saved run identity does not match isolated ${chain} change ${id}; resume the original recorded run ${meta.branch ?? "(branch unavailable)"}`);
  }
  validateRunBranch(config, id, meta.branch, g);
  if (branch !== null && meta.branch !== branch) {
    throw new Error(`This run started on branch ${meta.branch} and HEAD is on ${branch}; resume it on ${meta.branch}`);
  }
  return meta.branch;
}
