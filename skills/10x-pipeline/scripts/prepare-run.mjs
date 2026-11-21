// Shared pre-init setup. Router state and recovery remain owned by the router.
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { ID_RE, firstLine, spawn, isEntryPoint } from "./pr-common.mjs";
import { readPolicyObject, readIsolationPolicy, isolationEnabled, integrationBranch, runBranch, runBranchName, validateRunBranch, readRunIdentity, validateRunIdentity } from "./run-identity.mjs";

const USAGE = "Usage: prepare-run.mjs <id> [--chain 10x|openspec] [--cleanup]";
const GIT_TIMEOUT_MS = 120000;
const setupDeadline = performance.now() + 590000;
const COMMIT_RE = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

function parseArgs(args) {
  const [id, ...flags] = args;
  const cleanup = flags.includes("--cleanup");
  const rest = flags.filter((flag) => flag !== "--cleanup");
  if (flags.length - rest.length > 1) throw new Error("--cleanup may appear only once");
  if (!ID_RE.test(id ?? "")) throw new Error("a valid change id is required");
  if (rest.length === 0) return { id, chain: "10x", cleanup };
  if (rest.length !== 2 || rest[0] !== "--chain" || !["10x", "openspec"].includes(rest[1])) {
    throw new Error("expected only --chain 10x|openspec after the id");
  }
  return { id, chain: rest[1], cleanup };
}

function git(args, input) {
  const timeoutMs = Math.min(GIT_TIMEOUT_MS, Math.floor(setupDeadline - performance.now()));
  if (timeoutMs <= 0) throw new Error("Run setup deadline expired before the next Git command");
  return { ...spawn("git", args, timeoutMs, {
    ...process.env, GIT_OPTIONAL_LOCKS: "0", GIT_TERMINAL_PROMPT: "0", GCM_INTERACTIVE: "never", SSH_ASKPASS_REQUIRE: "never",
  }, input), timeoutMs };
}

function checked(res, label, allowed = [0]) {
  if (res.missing || res.timedOut || !allowed.includes(res.status)) {
    throw new Error(`${label}: ${res.timedOut ? `Git timed out after ${res.timeoutMs} ms` : firstLine(res.stderr) || `Git exited ${res.status}`}`);
  }
  return res;
}

function gitText(args, input) {
  return checked(git(args, input), `git ${args[0]}`).stdout.replace(/\n$/, "");
}

// Remote helpers can put credentials in stderr. Report outcomes without relaying their output.
function freshnessGit(args, label) {
  const res = git(args);
  if (res.status !== 0) {
    const detail = res.timedOut ? `Git timed out after ${res.timeoutMs} ms` : `Git exited ${res.status}`;
    throw new Error(`${label}: ${detail}`);
  }
  return res.stdout;
}

function checkFreshBase(startCommit, branch, result) {
  const remotes = gitText(["remote"]).split("\n").filter(Boolean);
  if (!remotes.length) {
    result.base = { skipped: "no-remote" };
    return;
  }
  const remote = remotes.includes("origin") ? "origin" : remotes[0];
  if (remote !== "origin" && remotes.length > 1) {
    throw new Error("Cannot select an integration remote: several remotes are configured and none is origin");
  }
  if (gitText(["rev-parse", "--is-shallow-repository"]) !== "false") {
    throw new Error(`Cannot compare integration history from ${remote} in a shallow repository. Unshallow the original checkout and rerun setup`);
  }

  const target = branch === null ? "HEAD" : `refs/heads/${branch}`;
  const flag = branch === null ? "--symref" : "--refs";
  const advertised = freshnessGit(["ls-remote", flag, "--", remote, target], `Read integration branch ${branch ?? "HEAD"} from ${remote}`);
  const values = advertised.split("\n").filter(Boolean).map((row) => row.split("\t"))
    .filter((fields) => fields.length === 2 && fields[1] === target).map(([value]) => value);
  if (branch === null) {
    const symbolic = values.filter((value) => value.startsWith("ref: "));
    const ref = symbolic.length === 1 ? symbolic[0].slice(5) : "";
    if (!ref.startsWith("refs/heads/")) {
      throw new Error(`Remote ${remote} did not advertise a default branch via symbolic HEAD. Configure isolation.integrationBranch or repair the remote HEAD`);
    }
    freshnessGit(["check-ref-format", ref], `Validate advertised integration branch from ${remote}`);
    branch = ref.slice("refs/heads/".length);
  }
  const commits = values.filter((value) => !value.startsWith("ref: "));
  const tip = commits.length === 1 ? commits[0] : "";
  if (!COMMIT_RE.test(tip)) {
    throw new Error(`Remote ${remote} did not advertise a valid commit for integration branch ${branch}`);
  }
  freshnessGit(["fetch", "--no-tags", "--no-recurse-submodules", "--refmap=", "--no-write-fetch-head",
    "--no-prune", "--no-prune-tags", "--no-auto-maintenance", "--no-write-commit-graph", "--", remote, tip],
    `Fetch integration branch ${branch} from ${remote}`);
  const localTip = freshnessGit(["rev-parse", "--verify", `${tip}^{commit}`], `Verify integration commit for ${remote}/${branch}`).trim();
  if (localTip !== tip) throw new Error(`Invalid integration commit for ${remote}/${branch}`);
  const counts = freshnessGit(["rev-list", "--left-right", "--count", `${startCommit}...${tip}`],
    `Compare original HEAD with ${remote}/${branch}`).trim().match(/^\d+\s+(\d+)$/);
  const behind = counts ? Number(counts[1]) : NaN;
  if (!Number.isSafeInteger(behind)) throw new Error(`Invalid integration commit count for ${remote}/${branch}`);
  result.base = { remote, branch, behind };
  if (behind > 0) {
    throw new Error(`Original checkout is ${behind} commit${behind === 1 ? "" : "s"} behind ${remote}/${branch}. Update the original checkout and rerun setup`);
  }
}

function branchExists(branch) {
  return checked(git(["show-ref", "--verify", "--quiet", `refs/heads/${branch}`]), "read run branch", [0, 1]).status === 0;
}

function registeredWorktrees() {
  return gitText(["worktree", "list", "--porcelain", "-z"]).split("\0\0").filter(Boolean).map((record) => {
    const fields = record.split("\0");
    return { worktree: fields.find((field) => field.startsWith("worktree ")).slice(9),
      branch: fields.find((field) => field.startsWith("branch refs/heads/"))?.slice(18) ?? null };
  });
}

function registeredWorktree(branch) {
  return registeredWorktrees().find((record) => record.branch === branch)?.worktree ?? null;
}

function savedRunCandidates(opts, prefix, change, common, current) {
  const candidates = [];
  for (const record of registeredWorktrees()) {
    if (!record.branch || record.branch === current) continue;
    const root = path.resolve(record.worktree, prefix);
    const candidateCommon = git(["-C", root, "rev-parse", "--path-format=absolute", "--git-common-dir"]);
    const candidatePrefix = git(["-C", root, "rev-parse", "--show-prefix"]);
    if (candidateCommon.timedOut || candidatePrefix.timedOut) throw new Error("Git timed out while validating registered run roots");
    if (candidateCommon.status !== 0 || candidatePrefix.status !== 0
      || path.resolve(candidateCommon.stdout.trim()) !== path.resolve(common)
      || candidatePrefix.stdout.replace(/\n$/, "") !== prefix) continue;
    const meta = readRunIdentity(path.join(root, change));
    if (!meta || meta.id !== opts.id || (meta.chain ?? "10x") !== opts.chain) continue;
    candidates.push({ ...record, meta });
  }
  return candidates;
}

function outsidePaths(prefix, change) {
  const selected = `${prefix}${change}/`;
  const records = gitText(["status", "--porcelain=v1", "-z", "--untracked-files=all"]).split("\0");
  const paths = [];
  for (let i = 0; i < records.length; i++) {
    if (!records[i]) continue;
    const status = records[i].slice(0, 2);
    const names = [records[i].slice(3)];
    if (/[RC]/.test(status)) names.push(records[++i]);
    for (const name of names) {
      if (!name.startsWith(selected) && name !== selected.slice(0, -1)) paths.push(name);
    }
  }
  return [...new Set(paths)];
}

function addExclude(prefix, id, result) {
  const ignored = checked(git(["check-ignore", "-q", "--", `.claude/worktrees/agent-smith-${id}/x`]), "check local ignore", [0, 1]);
  if (ignored.status === 0) return;
  const file = gitText(["rev-parse", "--path-format=absolute", "--git-path", "info/exclude"]);
  let text = "";
  try { text = fs.readFileSync(file, "utf8"); } catch (error) { if (error.code !== "ENOENT") throw error; }
  const escaped = prefix.replace(/[\\*?\[\]#! ]/g, "\\$&");
  fs.appendFileSync(file, `${text && !text.endsWith("\n") ? "\n" : ""}/${escaped}.claude/worktrees/\n`);
  result.excludeAdded = true;
}

function lstat(file) {
  try { return fs.lstatSync(file); } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return null;
  }
}

function validateSource(source) {
  const stat = lstat(source);
  if (!stat) throw new Error(`Change folder is missing: ${source}`);
  if (!stat.isDirectory()) throw new Error(`Change folder is not a directory: ${source}`);
}

function checkCopyParents(destination, root) {
  for (let parent = path.dirname(destination); parent !== root; parent = path.dirname(parent)) {
    if (lstat(parent)?.isSymbolicLink()) throw new Error(`Copy destination has a symlink parent: ${parent}`);
  }
}

function copyChange(source, destination, worktree) {
  validateSource(source);
  checkCopyParents(destination, worktree);
  fs.cpSync(source, destination, {
    recursive: true, preserveTimestamps: true, dereference: false, verbatimSymlinks: true,
    filter(sourceFile, target) {
      // copyFile follows destination links, so replace the link itself before copying.
      try {
        const targetStat = fs.lstatSync(target);
        const sourceStat = fs.lstatSync(sourceFile);
        if (targetStat.isSymbolicLink() || (sourceStat.isSymbolicLink() && targetStat.isFile())) fs.unlinkSync(target);
        else if (sourceStat.isDirectory() !== targetStat.isDirectory()) {
          throw new Error(`Copy source and destination types differ: ${target}`);
        }
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      return true;
    },
  });
}

function withSetupLock(common, branch, operation) {
  const file = path.join(common, `agent-smith-setup-${encodeURIComponent(branch)}`);
  const lock = `${file}.lock`;
  let fd;
  try {
    try { fd = fs.openSync(lock, "wx"); } catch (error) {
      if (error.code === "EEXIST") throw new Error(`Setup lock exists at ${lock}. Wait for setup to finish; after an interruption inspect it before manual removal.`);
      throw error;
    }
    fs.writeFileSync(fd, `${process.pid}\n`);
    return operation(`${file}.pending`);
  } finally {
    if (fd !== undefined) {
      fs.closeSync(fd);
      fs.unlinkSync(lock);
    }
  }
}

function readPending(file) {
  try {
    const stat = lstat(file);
    if (!stat) return null;
    if (!stat.isFile()) throw new Error("expected a regular file");
    const pending = readPolicyObject(file);
    if (typeof pending.root !== "string" || !path.isAbsolute(pending.root)
      || typeof pending.worktree !== "string" || !path.isAbsolute(pending.worktree)
      || typeof pending.prefix !== "string" || !["10x", "openspec"].includes(pending.chain)
      || typeof pending.startCommit !== "string" || !COMMIT_RE.test(pending.startCommit)) {
      throw new Error("invalid pending copy record");
    }
    return pending;
  } catch (error) {
    throw new Error(`Cannot read pending setup at ${file}: ${error.message}. Inspect the record and registered worktree before retrying`);
  }
}

function writePending(file, pending) {
  const temp = `${file}.${randomUUID()}.tmp`;
  const fd = fs.openSync(temp, "wx", 0o600);
  try {
    try { fs.writeFileSync(fd, `${JSON.stringify(pending)}\n`); } finally { fs.closeSync(fd); }
    fs.renameSync(temp, file);
  } catch (error) {
    fs.unlinkSync(temp);
    throw error;
  }
}

function routerState(changeDir) {
  const state = path.join(changeDir, "agent-smith");
  return { meta: lstat(path.join(state, "meta.json")), log: lstat(path.join(state, "run.jsonl")) };
}

function validatePendingSource(source, file) {
  validateSource(source);
  const { meta, log } = routerState(source);
  if (meta || log) {
    throw new Error(`Pending setup source now contains router state: ${source}. Inspect ${file} and preserve both copies before recovery`);
  }
}

function validateWorktreePath(root, worktree, common, branch) {
  if (!lstat(worktree)) {
    throw new Error(`Registered worktree is missing: ${worktree}. Inspect stale registrations with git worktree prune --dry-run before pruning`);
  }
  if (!fs.statSync(root).isDirectory()) throw new Error(`Run root is not a directory: ${root}`);
  const top = gitText(["-C", root, "rev-parse", "--show-toplevel"]);
  if (fs.realpathSync(top) !== fs.realpathSync(worktree)) throw new Error(`Unavailable registered worktree: ${worktree}`);
  const selectedCommon = gitText(["-C", root, "rev-parse", "--path-format=absolute", "--git-common-dir"]);
  const selectedBranch = gitText(["-C", root, "symbolic-ref", "--quiet", "--short", "HEAD"]);
  if (fs.realpathSync(selectedCommon) !== fs.realpathSync(common) || selectedBranch !== branch) {
    throw new Error(`Run worktree no longer belongs to this repository and branch ${branch}: ${root}`);
  }
}

function pendingOrigin(pending, file) {
  return `Pending ${pending.chain} setup belongs to the original project root ${pending.root}. Inspect ${file} and retry setup from that root`;
}

function prepare(opts, result) {
  const inside = git(["rev-parse", "--is-inside-work-tree"]);
  if (inside.missing || (inside.status === 128 && /not a git repository/i.test(inside.stderr))) {
    result.case = "opt-out";
    result.runRoot = result.root;
    return;
  }
  checked(inside, "discover Git worktree");
  if (inside.stdout.trim() !== "true") {
    result.case = "opt-out";
    result.runRoot = result.root;
    return;
  }
  const config = readIsolationPolicy(result.root);
  const gitDir = gitText(["rev-parse", "--absolute-git-dir"]);
  const common = gitText(["rev-parse", "--path-format=absolute", "--git-common-dir"]);
  const current = checked(git(["symbolic-ref", "--quiet", "--short", "HEAD"]), "read current branch", [0, 1]).stdout.replace(/\n$/, "");
  const checkCurrentPending = () => {
    if (gitDir !== common && current) {
      withSetupLock(common, current, (file) => {
        const pending = readPending(file);
        if (pending) throw new Error(pendingOrigin(pending, file));
      });
    }
  };
  if (!isolationEnabled(config)) {
    checkCurrentPending();
    result.case = "opt-out";
    result.runRoot = result.root;
    return;
  }
  const baseBranch = integrationBranch(config, git);
  const prefix = gitText(["rev-parse", "--show-prefix"]);
  const change = `${opts.chain === "openspec" ? "openspec" : "context"}/changes/${opts.id}`;
  let invocation = readRunIdentity(path.join(result.root, change));
  if (invocation && !Object.hasOwn(invocation, "isolated") && !Object.hasOwn(invocation, "branch")
    && invocation.id === opts.id && (invocation.chain ?? "10x") === opts.chain) {
    // Opt-out runs record id/chain without an isolated branch and retain the in-flight-main setup case.
    invocation = null;
  }
  if (invocation) validateRunIdentity(invocation, config, opts.id, opts.chain, gitDir !== common ? current : null, git);
  let generated;
  try { generated = runBranchName(config, opts.id, git); } catch (error) {
    const saved = savedRunCandidates(opts, prefix, change, common, current);
    if (!saved.length) throw error;
    const runs = saved.map((record) => `${record.meta.branch ?? record.branch} at ${record.worktree}`).sort().join(", ");
    throw new Error(`${error.message}. Restore isolation.branchPrefix to match the recorded branch of the saved run (${runs}) and resume its original worktree`);
  }
  const inRun = gitDir !== common && current.startsWith(config.branchPrefix ?? "agent-smith/");
  let branch = inRun ? current : invocation?.branch ?? generated;
  const validateSelected = (worktree, expected) => {
    const root = path.resolve(worktree, prefix);
    const meta = readRunIdentity(path.join(root, change));
    if (meta) {
      validateRunIdentity(meta, config, opts.id, opts.chain, expected, git);
      const selectedConfig = readIsolationPolicy(root);
      if (!isolationEnabled(selectedConfig)) throw new Error(`Restore isolation.require before resuming recorded branch ${meta.branch}`);
      validateRunIdentity(meta, selectedConfig, opts.id, opts.chain, expected, git);
    }
    return meta;
  };
  let savedBranch = Boolean(invocation);
  if (!inRun && !invocation && !branchExists(generated)) {
    const candidates = savedRunCandidates(opts, prefix, change, common, current);
    if (candidates.length > 1) {
      throw new Error(`Ambiguous saved runs for ${opts.id}: ${candidates.map((c) => `${c.branch} at ${c.worktree}`).sort().join(", ")}. Resume from the intended run worktree`);
    }
    if (candidates.length === 1) {
      const selected = candidates[0];
      branch = validateRunIdentity(selected.meta, config, opts.id, opts.chain, selected.branch, git);
      savedBranch = true;
    }
  }
  // An incomplete checkout may carry a different isolation policy than its origin.
  if (!inRun && current !== branch) checkCurrentPending();
  validateRunBranch(config, opts.id, branch, git, savedBranch);
  withSetupLock(common, branch, (file) => {
    const registrations = registeredWorktrees();
    const registered = registrations.find((entry) => entry.branch === branch)?.worktree ?? null;
    const exists = branchExists(branch);
    const source = path.join(result.root, change);
    const expectedWorktree = path.join(result.root, ".claude/worktrees", `agent-smith-${opts.id}`);
    const isExpectedPath = (entry) => path.resolve(entry.worktree) === expectedWorktree;
    let pending = readPending(file);
    if (pending) {
      if (inRun || pending.root !== result.root || pending.worktree !== expectedWorktree
        || pending.prefix !== prefix || pending.chain !== opts.chain) {
        throw new Error(pendingOrigin(pending, file));
      }
      if (exists && registered === null) {
        throw new Error(`Pending setup branch ${branch} has no registered worktree at ${expectedWorktree}. Inspect git worktree list and ${file} before recovery`);
      }
      if (registered !== null && (!exists || path.resolve(registered) !== expectedWorktree)) {
        throw new Error(`Pending setup expected worktree ${expectedWorktree} for branch ${branch}, found ${registered}. Inspect the registration and ${file} before recovery`);
      }
      if (registered === null) {
        if (registrations.some(isExpectedPath)) {
          throw new Error(`Pending setup worktree ${expectedWorktree} is registered to another branch or detached. Inspect git worktree list and ${file} before recovery`);
        }
        validatePendingSource(source, file);
      }
    }
    if (invocation) {
      validateRunIdentity(readRunIdentity(source) ?? {}, config, opts.id, opts.chain, inRun ? current : null, git);
      if (!exists) throw new Error(`Recorded run branch ${branch} is unavailable; restore it and resume its original worktree`);
    }
    result.branch = branch;
    if (inRun) {
      result.case = "in-run-worktree";
      result.worktree = gitText(["rev-parse", "--show-toplevel"]);
    } else if (!exists) {
      if (fs.existsSync(path.join(source, "agent-smith/meta.json"))) {
        result.case = "in-flight-main";
        result.branch = null;
        result.runRoot = result.root;
        return;
      }
      result.case = "created";
      validateSource(source);
      checkCopyParents(expectedWorktree, result.root);
      const startCommit = gitText(["rev-parse", "--verify", "HEAD^{commit}"]);
      if (!COMMIT_RE.test(startCommit)) throw new Error("Cannot verify the original HEAD commit");
      checkFreshBase(startCommit, baseBranch, result);
      addExclude(prefix, opts.id, result);
      result.notInRun = outsidePaths(prefix, change);
      result.worktree = expectedWorktree;
      pending = { root: result.root, worktree: expectedWorktree, prefix, chain: opts.chain, startCommit };
      writePending(file, pending);
      const added = git(["worktree", "add", "--no-track", "-b", branch, expectedWorktree, startCommit]);
      if (!added.timedOut && added.status !== 0 && !branchExists(branch)
        && !registeredWorktrees().some((entry) => entry.branch === branch || isExpectedPath(entry))) {
        fs.unlinkSync(file);
      }
      checked(added, "create run worktree");
    } else {
      result.worktree = registered;
      if (result.worktree !== null) {
        result.case = "reused";
      } else {
        const branchObject = (file) => {
          const tree = gitText(["ls-tree", "-r", "--name-only", "-z", branch, "--", `:(literal)${file}`]);
          if (!tree.split("\0").includes(file)) return null;
          const value = JSON.parse(gitText(["show", `${branch}:${file}`]));
          if (!isObject(value)) throw new Error(`Saved ${file} must hold a JSON object`);
          return value;
        };
        const projectPolicy = branchObject(`${prefix}context/foundation/agent-smith-policy.json`) ?? {};
        const selectedConfig = readIsolationPolicy(result.root, undefined, projectPolicy);
        const meta = branchObject(`${prefix}${change}/agent-smith/meta.json`);
        if (meta && ["id", "chain", "isolated", "branch"].some((key) => Object.hasOwn(meta, key))) {
          validateRunIdentity(meta, config, opts.id, opts.chain, branch, git);
          if (!isolationEnabled(selectedConfig)) throw new Error("Restore isolation.require in the saved run before attachment");
          validateRunIdentity(meta, selectedConfig, opts.id, opts.chain, branch, git);
        }

        result.case = "attached";
        result.worktree = path.join(result.root, ".claude/worktrees", `agent-smith-${opts.id}`);
        checked(git(["worktree", "add", result.worktree, branch]), "attach run worktree");
      }
    }
    const runRoot = inRun ? result.root : path.resolve(result.worktree, prefix);
    let copied = false;
    if (pending) {
      validateWorktreePath(result.worktree, result.worktree, common, branch);
      if (fs.realpathSync(result.worktree) !== expectedWorktree) {
        throw new Error(`Pending setup worktree is not canonical: ${expectedWorktree}. Inspect ${file} before recovery`);
      }
      validatePendingSource(source, file);
      const destination = path.join(runRoot, change);
      const { meta, log } = routerState(destination);
      if (!meta && !log) {
        const head = gitText(["-C", result.worktree, "rev-parse", "--verify", "HEAD^{commit}"]);
        if (head !== pending.startCommit) {
          throw new Error(`Pending setup expected commit ${pending.startCommit} in ${result.worktree}, found ${head}. Inspect ${file} and preserve worktree edits before recovery`);
        }
        copyChange(source, destination, result.worktree);
        copied = true;
      } else {
        if (!meta?.isFile() || (log && !log.isFile()) || fs.realpathSync(runRoot) !== runRoot) {
          throw new Error(`Pending setup found ambiguous router state in ${destination}. Inspect ${file} and preserve worktree inputs before recovery`);
        }
        checkAncestors(runRoot, path.join(destination, "agent-smith/meta.json"));
      }
    }
    validateWorktreePath(runRoot, result.worktree, common, branch);
    const identity = validateSelected(result.worktree, branch);
    if (pending) {
      if (!copied && !identity) {
        throw new Error(`Pending setup found router state without a saved run identity in ${runRoot}. Inspect ${file} and preserve worktree inputs before recovery`);
      }
      fs.unlinkSync(file);
    }
    result.copied = copied;
    result.runRoot = runRoot;
  });
}

function readSetupInput() {
  const saved = JSON.parse(fs.readFileSync(0, "utf8"));
  const nullablePath = (value) => value === null || (typeof value === "string" && path.isAbsolute(value));
  const pathList = (value) => Array.isArray(value) && value.every((item) => typeof item === "string");
  if (!isObject(saved) || typeof saved.root !== "string" || !path.isAbsolute(saved.root)
    || !nullablePath(saved.runRoot) || !nullablePath(saved.worktree)
    || !(saved.branch === null || typeof saved.branch === "string")
    || ![null, "created", "reused", "attached", "in-run-worktree", "in-flight-main", "opt-out"].includes(saved.case)
    || typeof saved.copied !== "boolean" || typeof saved.excludeAdded !== "boolean"
    || !pathList(saved.notInRun) || !pathList(saved.left)
    || !(saved.reason === null || typeof saved.reason === "string")) {
    throw new Error("stdin must hold the original setup JSON object");
  }
  return saved;
}

function checkAncestors(root, target) {
  const relative = path.relative(root, target);
  if (!relative || relative.startsWith(`..${path.sep}`) || relative === ".." || path.isAbsolute(relative)) {
    throw new Error(`Source path escapes the project: ${target}`);
  }
  let parent = root;
  for (const part of relative.split(path.sep).slice(0, -1)) {
    parent = path.join(parent, part);
    if (!fs.lstatSync(parent).isDirectory()) throw new Error(`Source ancestor is not a directory: ${parent}`);
  }
}

function sourceEntries(root, change) {
  const files = [];
  const dirs = [];
  const visit = (file) => {
    checkAncestors(root, file);
    let stat;
    try { stat = fs.lstatSync(file); } catch (error) {
      if (error.code === "ENOENT") return;
      throw error;
    }
    if (stat.isDirectory()) {
      dirs.push(file);
      for (const name of fs.readdirSync(file).sort()) visit(path.join(file, name));
    } else files.push({ file, rel: path.relative(root, file), stat });
  };
  try { visit(path.join(root, change)); } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  return { files, dirs };
}

function trackedPaths(top, change) {
  const spec = `:(literal)${change}`;
  return new Set([
    ...gitText(["-C", top, "ls-files", "--cached", "-z", "--", spec]).split("\0"),
    ...gitText(["-C", top, "ls-tree", "-r", "--name-only", "-z", "HEAD", "--", spec]).split("\0"),
  ]);
}

const sameFile = (a, b) => ["dev", "ino", "mode", "size", "mtimeMs", "ctimeMs"].every((key) => a[key] === b[key]);

function sourceHash(entry) {
  const stat = fs.lstatSync(entry.file);
  if (!stat.isFile() || !sameFile(stat, entry.stat)) return null;
  const fd = fs.openSync(entry.file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    if (!sameFile(fs.fstatSync(fd), entry.stat)) return null;
    const hash = gitText(["hash-object", "--no-filters", "--stdin"], fs.readFileSync(fd));
    return sameFile(fs.lstatSync(entry.file), entry.stat) ? hash : null;
  } finally { fs.closeSync(fd); }
}

function cleanup(opts, result) {
  if (fs.realpathSync(result.root) !== process.cwd()) throw new Error("Setup root differs from the invocation root");
  if (result.reason !== null || result.runRoot === null) throw new Error("Setup did not succeed");
  if (result.case !== "created" || result.copied !== true) return;
  const config = readIsolationPolicy(result.root);
  if (!isolationEnabled(config)) throw new Error("Cleanup needs the original active isolation policy");
  const change = `${opts.chain === "openspec" ? "openspec" : "context"}/changes/${opts.id}`;
  const prefix = gitText(["rev-parse", "--show-prefix"]);
  const top = gitText(["rev-parse", "--show-toplevel"]);
  const common = gitText(["rev-parse", "--path-format=absolute", "--git-common-dir"]);
  const expected = path.join(result.root, ".claude/worktrees", `agent-smith-${opts.id}`);
  const selectedRoot = path.resolve(expected, prefix);
  if (fs.realpathSync(selectedRoot) !== selectedRoot) throw new Error("Cleanup run root is not canonical");
  const original = readRunIdentity(path.join(selectedRoot, change));
  if (original) validateRunIdentity(original, config, opts.id, opts.chain, result.branch, git);
  const branch = runBranch(config, opts.id, git);
  withSetupLock(common, branch, () => {
    if (result.branch !== branch || result.worktree !== expected
      || result.runRoot !== selectedRoot || result.runRoot === result.root
      || fs.realpathSync(result.runRoot) !== result.runRoot) {
      throw new Error("Cleanup roots, project prefix or branch differ from fresh setup");
    }
    checkAncestors(result.root, path.join(result.root, change));
    const registered = registeredWorktree(branch);
    const selectedTop = gitText(["-C", result.runRoot, "rev-parse", "--show-toplevel"]);
    const selectedCommon = gitText(["-C", result.runRoot, "rev-parse", "--path-format=absolute", "--git-common-dir"]);
    const selectedBranch = gitText(["-C", result.runRoot, "symbolic-ref", "--quiet", "--short", "HEAD"]);
    if (registered === null || fs.realpathSync(registered) !== fs.realpathSync(expected)
      || fs.realpathSync(selectedTop) !== fs.realpathSync(expected)
      || fs.realpathSync(selectedCommon) !== fs.realpathSync(common) || selectedBranch !== branch
      || gitText(["-C", result.runRoot, "rev-parse", "--show-prefix"]) !== prefix) {
      throw new Error("Cleanup run is not the registered worktree of this repository and branch");
    }
    const meta = readPolicyObject(path.join(result.runRoot, change, "agent-smith/meta.json"));
    validateRunIdentity(meta, config, opts.id, opts.chain, branch, git);
    const selectedConfig = readIsolationPolicy(result.runRoot);
    if (!isolationEnabled(selectedConfig)) throw new Error("Cleanup needs the original active isolation policy in the run");
    validateRunIdentity(meta, selectedConfig, opts.id, opts.chain, branch, git);
    const sha = meta.startCommit;
    if (meta.id !== opts.id || meta.isolated !== true || meta.branch !== branch
      || (meta.chain ?? "10x") !== opts.chain || meta.outcome?.action === "halt"
      || typeof sha !== "string" || !/^[0-9a-f]{40,64}$/.test(sha)) {
      throw new Error("Cleanup needs a successful isolated init with a retained start commit");
    }
    if (gitText(["-C", result.runRoot, "rev-parse", "--verify", `${sha}^{commit}`]) !== sha) {
      throw new Error("Start commit does not resolve to the recorded commit");
    }
    checked(git(["-C", result.runRoot, "merge-base", "--is-ancestor", sha, `refs/heads/${branch}`]), "retain start commit on run branch");
    const fullChange = `${prefix}${change}`;
    const retained = new Map();
    for (const row of gitText(["-C", top, "ls-tree", "-r", "-z", sha, "--", `:(literal)${fullChange}`]).split("\0")) {
      const match = row.match(/^(100644|100755) blob ([0-9a-f]+)\t([\s\S]+)$/);
      if (match) retained.set(match[3], match[2]);
    }
    const { files, dirs } = sourceEntries(result.root, change);
    const tracked = trackedPaths(top, fullChange);
    // Validate the complete list before the first unlink. Read blobs only from the immutable start commit.
    const approved = files.filter((entry) => entry.stat.isFile() && !tracked.has(`${prefix}${entry.rel}`)
      && retained.has(`${prefix}${entry.rel}`) && sourceHash(entry) === retained.get(`${prefix}${entry.rel}`));
    for (const entry of approved) {
      checkAncestors(result.root, entry.file);
      if (trackedPaths(top, fullChange).has(`${prefix}${entry.rel}`)
        || sourceHash(entry) !== retained.get(`${prefix}${entry.rel}`)) continue;
      checkAncestors(result.root, entry.file);
      if (!sameFile(fs.lstatSync(entry.file), entry.stat)) continue;
      fs.unlinkSync(entry.file);
    }
    for (const dir of dirs.reverse()) {
      checkAncestors(result.root, dir);
      if (!fs.lstatSync(dir).isDirectory()) throw new Error(`Source directory changed: ${dir}`);
      try { fs.rmdirSync(dir); } catch (error) {
        if (!["ENOTEMPTY", "EEXIST", "ENOENT"].includes(error.code)) throw error;
      }
    }
  });
}

function main() {
  let opts;
  let saved;
  try {
    opts = parseArgs(process.argv.slice(2));
    if (opts.cleanup) saved = readSetupInput();
  } catch (error) {
    process.stderr.write(`${firstLine(error.message)}\n${USAGE}\n`);
    process.exitCode = 2;
    return;
  }
  const result = saved ? { ...saved, left: [] } : { root: process.cwd(), runRoot: null, worktree: null, branch: null,
    case: null, copied: false, excludeAdded: false, notInRun: [], left: [], reason: null };
  try {
    if (opts.cleanup) cleanup(opts, result);
    else prepare(opts, result);
  } catch (error) {
    result.runRoot = null;
    result.reason = firstLine(error.message, 1000) || "Run setup failed";
  }
  if (opts.cleanup && saved.case === "created" && saved.copied === true) {
    const change = `${opts.chain === "openspec" ? "openspec" : "context"}/changes/${opts.id}`;
    try {
      const { files, dirs } = sourceEntries(process.cwd(), change);
      result.left = [...files.map((entry) => entry.rel),
        ...dirs.filter((dir) => fs.readdirSync(dir).length === 0).map((dir) => path.relative(process.cwd(), dir))].sort();
    } catch (error) {
      result.left = [change];
      result.runRoot = null;
      result.reason = firstLine(`${result.reason ?? ""} Surviving paths could not be listed: ${error.message}`, 1000);
    }
  }
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (isEntryPoint(import.meta.url)) main();
