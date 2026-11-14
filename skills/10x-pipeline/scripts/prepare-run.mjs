// Shared pre-init setup. Router state and recovery remain owned by the router.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ID_RE, firstLine, spawn, isEntryPoint } from "./pr-common.mjs";

const SKILL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const USAGE = "Usage: prepare-run.mjs <id> [--chain 10x|openspec] [--cleanup]";
const GIT_TIMEOUT_MS = 120000;
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

function readPolicy(file) {
  const value = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!isObject(value)) throw new Error(`${file} must hold a JSON object`);
  return value;
}

// Only this projection affects setup. Match state.mjs deepMerge for the isolation block.
function isolationRequired(root) {
  const policies = [readPolicy(path.join(SKILL, "policy.json")),
    readPolicy(path.join(SKILL, "../openspec-pipeline/policy.json"))];
  const override = path.join(root, "context/foundation/agent-smith-policy.json");
  let present = true;
  try { fs.lstatSync(override); } catch (error) {
    if (error.code !== "ENOENT") throw error;
    present = false;
  }
  if (present) policies.push(readPolicy(override));
  let isolation;
  for (const policy of policies) {
    if (!Object.hasOwn(policy, "isolation")) continue;
    const over = policy.isolation;
    isolation = isObject(over) && typeof isolation === "object" && !Array.isArray(isolation)
      ? { ...isolation, ...over } : over;
  }
  return isObject(isolation) && isolation.require === true;
}

function git(args, input) {
  return spawn("git", args, GIT_TIMEOUT_MS, { ...process.env, GIT_OPTIONAL_LOCKS: "0" }, input);
}

function checked(res, label, allowed = [0]) {
  if (res.missing || res.timedOut || !allowed.includes(res.status)) {
    throw new Error(`${label}: ${res.timedOut ? "Git timed out after 120000 ms" : firstLine(res.stderr) || `Git exited ${res.status}`}`);
  }
  return res;
}

function gitText(args, input) {
  return checked(git(args, input), `git ${args[0]}`).stdout.replace(/\n$/, "");
}

function branchExists(branch) {
  return checked(git(["show-ref", "--verify", "--quiet", `refs/heads/${branch}`]), "read run branch", [0, 1]).status === 0;
}

function registeredWorktree(branch) {
  const records = gitText(["worktree", "list", "--porcelain", "-z"]).split("\0\0");
  for (const record of records) {
    const fields = record.split("\0");
    if (fields.includes(`branch refs/heads/${branch}`)) return fields.find((field) => field.startsWith("worktree ")).slice(9);
  }
  return null;
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

function copyChange(source, destination, worktree) {
  if (!fs.lstatSync(source).isDirectory()) throw new Error(`Change folder is not a directory: ${source}`);
  for (let parent = path.dirname(destination); parent !== worktree; parent = path.dirname(parent)) {
    try {
      if (fs.lstatSync(parent).isSymbolicLink()) throw new Error(`Copy destination has a symlink parent: ${parent}`);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
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
  const lock = path.join(common, `agent-smith-setup-${encodeURIComponent(branch)}.lock`);
  let fd;
  try {
    try { fd = fs.openSync(lock, "wx"); } catch (error) {
      if (error.code === "EEXIST") throw new Error(`Setup lock exists at ${lock}. Wait for setup to finish; after an interruption inspect it before manual removal.`);
      throw error;
    }
    fs.writeFileSync(fd, `${process.pid}\n`);
    return operation();
  } finally {
    if (fd !== undefined) {
      fs.closeSync(fd);
      fs.unlinkSync(lock);
    }
  }
}

function prepare(opts, result) {
  const inside = git(["rev-parse", "--is-inside-work-tree"]);
  if (inside.missing || (inside.status === 128 && /not a git repository/i.test(inside.stderr))) {
    result.case = "opt-out";
    result.runRoot = result.root;
    return;
  }
  checked(inside, "discover Git worktree");
  if (inside.stdout.trim() !== "true" || !isolationRequired(result.root)) {
    result.case = "opt-out";
    result.runRoot = result.root;
    return;
  }
  const prefix = gitText(["rev-parse", "--show-prefix"]);
  const gitDir = gitText(["rev-parse", "--absolute-git-dir"]);
  const common = gitText(["rev-parse", "--path-format=absolute", "--git-common-dir"]);
  const current = checked(git(["symbolic-ref", "--quiet", "--short", "HEAD"]), "read current branch", [0, 1]).stdout.replace(/\n$/, "");
  const inRun = gitDir !== common && current.startsWith("agent-smith/");
  const branch = inRun ? current : `agent-smith/${opts.id}`;
  const change = `${opts.chain === "openspec" ? "openspec" : "context"}/changes/${opts.id}`;
  if (!inRun && !branchExists(branch) && fs.existsSync(path.join(result.root, change, "agent-smith/meta.json"))) {
    result.case = "in-flight-main";
    result.runRoot = result.root;
    return;
  }
  withSetupLock(common, branch, () => {
    result.branch = branch;
    if (inRun) {
      result.case = "in-run-worktree";
      result.worktree = gitText(["rev-parse", "--show-toplevel"]);
    } else if (!branchExists(branch)) {
      // Refresh in-flight detection under the same lock as creation and the complete copy.
      if (fs.existsSync(path.join(result.root, change, "agent-smith/meta.json"))) {
        result.case = "in-flight-main";
        result.branch = null;
        result.runRoot = result.root;
        return;
      }
      result.case = "created";
      const source = path.join(result.root, change);
      if (!fs.lstatSync(source).isDirectory()) throw new Error(`Change folder is not a directory: ${source}`);
      addExclude(prefix, opts.id, result);
      result.notInRun = outsidePaths(prefix, change);
      result.worktree = path.join(result.root, ".claude/worktrees", `agent-smith-${opts.id}`);
      checked(git(["worktree", "add", "--no-track", "-b", branch, result.worktree, "HEAD"]), "create run worktree");
      copyChange(source, path.join(result.worktree, prefix, change), result.worktree);
      result.copied = true;
    } else {
      result.worktree = registeredWorktree(branch);
      if (result.worktree !== null) {
        result.case = "reused";
      } else {
        result.case = "attached";
        result.worktree = path.join(result.root, ".claude/worktrees", `agent-smith-${opts.id}`);
        checked(git(["worktree", "add", result.worktree, branch]), "attach run worktree");
      }
    }
    const runRoot = inRun ? result.root : path.resolve(result.worktree, prefix);
    if (!fs.statSync(runRoot).isDirectory()) throw new Error(`Run root is not a directory: ${runRoot}`);
    const top = gitText(["-C", runRoot, "rev-parse", "--show-toplevel"]);
    if (fs.realpathSync(top) !== fs.realpathSync(result.worktree)) throw new Error(`Unavailable registered worktree: ${result.worktree}`);
    const selectedCommon = gitText(["-C", runRoot, "rev-parse", "--path-format=absolute", "--git-common-dir"]);
    const selectedBranch = gitText(["-C", runRoot, "symbolic-ref", "--quiet", "--short", "HEAD"]);
    if (fs.realpathSync(selectedCommon) !== fs.realpathSync(common) || selectedBranch !== branch) {
      throw new Error(`Run worktree no longer belongs to this repository and branch ${branch}: ${runRoot}`);
    }
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
  const branch = `agent-smith/${opts.id}`;
  const change = `${opts.chain === "openspec" ? "openspec" : "context"}/changes/${opts.id}`;
  const prefix = gitText(["rev-parse", "--show-prefix"]);
  const top = gitText(["rev-parse", "--show-toplevel"]);
  const common = gitText(["rev-parse", "--path-format=absolute", "--git-common-dir"]);
  withSetupLock(common, branch, () => {
    const expected = path.join(result.root, ".claude/worktrees", `agent-smith-${opts.id}`);
    if (result.branch !== branch || result.worktree !== expected
      || result.runRoot !== path.resolve(expected, prefix) || result.runRoot === result.root
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
    const meta = readPolicy(path.join(result.runRoot, change, "agent-smith/meta.json"));
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
