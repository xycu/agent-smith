// Fresh-worktree dependency and readiness gates, under prepare-run's branch lock.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const POLICY = "context/foundation/agent-smith-policy.json";
const LOCKS = new Map([
  ["package-lock.json", "npm"], ["npm-shrinkwrap.json", "npm"], ["pnpm-lock.yaml", "pnpm"],
  ["yarn.lock", "yarn"], ["bun.lock", "bun"], ["bun.lockb", "bun"],
]);
// SemVer 2.0.0, including Corepack's build metadata.
const VERSION =
  /^(0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*)?(?:\+[0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*)?$/;
const ARTIFACTS = new Set([
  "node_modules", ".pnpm-store", ".pnp.js", ".pnp.cjs", ".pnp.data.json", ".pnp.loader.mjs",
]);
const YARN_ARTIFACTS = new Set(["cache", "unplugged", "install-state.gz", "build-state.yml"]);
const TERMINATION_GRACE_MS = 1000;
const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

function stat(file) {
  try { return fs.lstatSync(file); } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return null;
  }
}

function inside(top, file) {
  const relative = path.relative(top, file);
  return relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function canonicalDirectory(top, dir) {
  if (!inside(top, dir) || !stat(dir)?.isDirectory() || fs.realpathSync(dir) !== dir) {
    throw new Error(`Expected a canonical command directory inside ${top}, found ${dir}`);
  }
}

function readJson(text, location) {
  let value;
  try { value = JSON.parse(text); } catch { throw new Error(`Fix invalid JSON in ${location}`); }
  if (!isObject(value)) throw new Error(`Expected a JSON object in ${location}`);
  return value;
}

function readReadiness(top, root, gitText) {
  const relative = path.relative(top, path.join(root, POLICY)).split(path.sep).join("/");
  const location = `HEAD:${relative} in ${root}`;
  const entry = gitText(["-C", top, "ls-tree", "-z", "HEAD", "--", `:(literal)${relative}`]);
  if (!entry) return null;
  if (!/^100(?:644|755) blob [a-f0-9]+\t/.test(entry)) {
    throw new Error(`Expected a regular committed policy file at ${location}`);
  }
  const policy = readJson(gitText(["-C", top, "show", `HEAD:${relative}`]), location);
  if (!Object.hasOwn(policy, "readiness")) return null;
  if (typeof policy.readiness !== "string" || !policy.readiness.trim() || policy.readiness.includes("\0")) {
    throw new Error(`Set readiness to a non-blank command in ${location}`);
  }
  return policy.readiness;
}

function readManifest(file) {
  if (!stat(file)?.isFile()) throw new Error(`Expected a regular package manifest at ${file}`);
  return readJson(fs.readFileSync(file, "utf8"), file);
}

function installSelection(top, root) {
  const selectedFile = path.join(root, "package.json");
  if (!stat(selectedFile)) return null;
  for (let cwd = root; ; cwd = path.dirname(cwd)) {
    canonicalDirectory(top, cwd);
    const locks = [];
    for (const [name, manager] of LOCKS) {
      const file = path.join(cwd, name);
      const entry = stat(file);
      if (entry) locks.push({ file, manager, entry });
    }
    const manifestFile = path.join(cwd, "package.json");
    if (locks.length && stat(manifestFile)) {
      const families = new Set(locks.map((lock) => lock.manager));
      if (families.size !== 1) {
        throw new Error(`Conflicting package lockfiles in ${cwd}: ${locks.map((lock) => lock.file).join(", ")}. Keep one lockfile family`);
      }
      const [manager] = families;
      return { cwd, manager, locks, manifestFile, selectedFile };
    }
    if (cwd === top) break;
  }
  const selectedManifest = readManifest(selectedFile);
  if (["dependencies", "devDependencies", "optionalDependencies", "workspaces"]
    .some((key) => Object.keys(selectedManifest[key] ?? {}).length > 0)) {
    throw new Error(`No supported lockfile for ${selectedFile}. Add a lockfile in its package root: ${[...LOCKS.keys()].join(", ")}`);
  }
  return null;
}

function cancelled(signal) {
  return signal.aborted ? `interrupted by ${signal.reason}` : null;
}

function timeLeft(deadline, signal) {
  const interruption = cancelled(signal);
  if (interruption) throw new Error(interruption);
  const remaining = Math.floor(deadline - performance.now());
  if (remaining <= 0) throw new Error("setup deadline expired");
  return remaining;
}

async function runCommand(executable, args, { cwd, top, deadline, signal }, capture = false) {
  canonicalDirectory(top, cwd);
  const timeout = timeLeft(deadline, signal);
  return new Promise((resolve, reject) => {
    const detached = process.platform !== "win32";
    const child = spawn(executable, args ?? [], {
      cwd, shell: args === null, detached, stdio: ["ignore", capture ? "pipe" : "ignore", "ignore"],
    });
    const group = detached ? -child.pid : child.pid;
    let failure, escalation, closed;
    let stdout = "";
    const send = (sig) => {
      if (!child.pid) return false;
      try { return process.kill(group, sig); } catch (error) {
        if (error.code === "ESRCH") return false;
        throw error;
      }
    };
    const settle = () => {
      if (!closed || escalation) return;
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      if (failure) reject(new Error(failure));
      else if (closed[1]) reject(new Error(`terminated by ${closed[1]}`));
      else if (closed[0] !== 0) reject(new Error(`exited with status ${closed[0]}`));
      else resolve(stdout);
    };
    const stop = (reason) => {
      failure ??= reason;
      if (!escalation && send("SIGTERM")) {
        // The direct child may close before its descendants receive SIGKILL.
        escalation = setTimeout(() => {
          send("SIGKILL");
          escalation = null;
          settle();
        }, TERMINATION_GRACE_MS);
      }
    };
    const onAbort = () => stop(cancelled(signal));
    const timer = setTimeout(() => stop("timed out at the setup deadline"), timeout);
    signal.addEventListener("abort", onAbort, { once: true });
    child.on("error", (error) => {
      failure ??= error.code === "ENOENT" ? "executable not found on PATH" : `could not start (${error.code ?? "spawn error"})`;
    });
    child.stdout?.on("data", (chunk) => {
      if (stdout.length < 256) stdout += chunk.toString().slice(0, 256 - stdout.length);
    });
    child.on("close", (code, exitSignal) => {
      closed = [code, exitSignal];
      if (!failure && detached && send(0)) stop("left running processes in its group");
      settle();
    });
  });
}

function installArgs(selection) {
  const { manager, manifestFile, selectedFile } = selection;
  const fallback = manager === "npm" ? ["ci"]
    : manager === "yarn" ? null : ["install", "--frozen-lockfile"];
  if (manifestFile !== selectedFile) readManifest(selectedFile);
  const manifest = readManifest(manifestFile);
  let version;
  if (Object.hasOwn(manifest, "packageManager")) {
    const declaration = manifest.packageManager;
    version = typeof declaration === "string" && declaration.startsWith(`${manager}@`)
      ? declaration.slice(manager.length + 1).match(VERSION) : null;
    if (!version) throw new Error(`Set packageManager in ${manifestFile} to ${manager}@<version> to match its lockfile`);
  }
  if (fallback) return fallback;
  return version ? yarnArgs(version) : null;
}

function yarnArgs(version) {
  return ["install", Number(version[1]) >= 2 ? "--immutable" : "--frozen-lockfile"];
}

function safeLink(top, file) {
  const namedTarget = path.resolve(path.dirname(file), fs.readlinkSync(file));
  const external = () => new Error(`Replace external dependency link ${file} pointing outside ${top}`);
  if (!inside(top, namedTarget)) throw external();
  let target;
  try { target = fs.realpathSync(file); } catch (error) {
    if (!["ENOENT", "ENOTDIR", "ELOOP"].includes(error.code)) throw error;
    throw new Error(`Replace dangling dependency link ${file}`);
  }
  if (!inside(top, target)) throw external();
  return target;
}

function dependencyLinks(top, cwd, deadline, signal) {
  const aliases = new Set();
  const visited = new Set();
  function inspect(file, dependencyRoot = false) {
    timeLeft(deadline, signal);
    const entry = stat(file);
    if (!entry) return;
    const target = entry.isSymbolicLink() ? safeLink(top, file) : file;
    const targetEntry = target === file ? entry : fs.statSync(target);
    if (dependencyRoot && target !== file) {
      if (inside(target, file)) throw new Error(`Replace dependency link ${file} pointing to its ancestor ${target}`);
      aliases.add(target);
    }
    if (!targetEntry.isDirectory()) {
      if (dependencyRoot && path.basename(file) === "node_modules") {
        throw new Error(`Expected a dependency directory at ${file}`);
      }
      return;
    }
    if (visited.has(target)) return;
    visited.add(target);
    for (const child of fs.readdirSync(target)) inspect(path.join(target, child), false);
  }
  function visit(dir) {
    timeLeft(deadline, signal);
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const child = path.join(dir, entry.name);
      if (ARTIFACTS.has(entry.name)) {
        inspect(child, true);
      } else if (entry.name === ".yarn") {
        const target = entry.isSymbolicLink() ? safeLink(top, child) : child;
        if (!fs.statSync(target).isDirectory()) throw new Error(`Expected a dependency directory at ${child}`);
        for (const name of YARN_ARTIFACTS) {
          const artifact = path.join(target, name);
          if (target !== child) aliases.add(artifact);
          inspect(artifact, true);
        }
      } else if (entry.isDirectory() && entry.name !== ".git") {
        visit(child);
      }
    }
  }
  visit(cwd);
  return aliases;
}

function checkDependencies({ top, cwd, deadline, signal }, gitText, tracked) {
  const aliases = dependencyLinks(top, cwd, deadline, signal);
  const specs = cwd === top ? [] : [cwd, ...[...aliases].filter((target) => !inside(cwd, target))]
    .map((file) => `:(literal)${path.relative(top, file).split(path.sep).join("/")}`);
  const files = (...args) => gitText(["-C", top, ...args, "--", ...specs]).split("\0").filter(Boolean);
  const matches = (file) => {
    const absolute = path.join(top, file);
    for (const alias of aliases) if (inside(alias, absolute)) return true;
    const parts = path.relative(cwd, absolute).split(path.sep);
    return parts.some((part, index) => ARTIFACTS.has(part)
      || (part === ".yarn" && YARN_ARTIFACTS.has(parts[index + 1])));
  };
  const file = tracked
    ? files("ls-files", "--cached", "-z").find(matches) ?? files("ls-tree", "-r", "--name-only", "-z", "HEAD").find(matches)
    : files("ls-files", "--others", "--exclude-standard", "-z").find(matches);
  if (file) throw new Error(tracked
    ? `Move tracked dependency content out of the install layout: ${path.join(top, file)}`
    : `Add ${path.join(top, file)} to the project's ignore rules before retrying`);
}

export async function prepareProjectGates(top, root, deadline, signal, gitText) {
  canonicalDirectory(top, top);
  canonicalDirectory(top, root);
  const readiness = readReadiness(top, root, gitText);
  const install = installSelection(top, root);
  if (install) {
    const options = { top, cwd: install.cwd, deadline, signal };
    let invocation = install.manager === "npm" ? "npm ci"
      : install.manager === "yarn" ? "yarn --version" : `${install.manager} install --frozen-lockfile`;
    try {
      let args = installArgs(install);
      if (args) invocation = [install.manager, ...args].join(" ");
      for (const { file, entry } of install.locks) {
        if (!entry.isFile()) throw new Error(`Expected a regular lockfile at ${file}`);
      }
      checkDependencies(options, gitText, true);
      if (!args) {
        const output = await runCommand("yarn", ["--version"], options, true);
        const version = output.trim().match(VERSION);
        if (!version) throw new Error("could not determine Yarn generation from yarn --version");
        args = yarnArgs(version);
        invocation = [install.manager, ...args].join(" ");
      }
      await runCommand(install.manager, args, options);
      checkDependencies(options, gitText, false);
    } catch (error) {
      throw new Error(`Dependency setup in ${install.cwd} (${invocation}): ${error.message}`);
    }
  }
  if (readiness !== null) {
    const options = { top, cwd: root, deadline, signal };
    try {
      if (!install) dependencyLinks(top, root, deadline, signal);
      await runCommand(readiness, null, options);
    } catch (error) {
      throw new Error(`Readiness command ${JSON.stringify(readiness.slice(0, 250))} in ${root}: ${error.message}`);
    }
  }
  timeLeft(deadline, signal);
}
