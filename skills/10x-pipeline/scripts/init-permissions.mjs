import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { ROOT, isObject, providerOf, providersByStep, runGit } from "./state.mjs";
import { readBoundedFile } from "./usage.mjs";
import { codexChildEnv, codexProfileArgs } from "./codex-startup.mjs";

const TIMEOUT_MS = 2000;
const MISSING_PERMISSIONS = 'Error: default_permissions requires a `[permissions]` table';
const UNDEFINED_PROFILE = /^Error: default_permissions refers to undefined profile `(.+)`$/;
const UNSAFE_TEXT = /[\p{Cc}\p{Cf}\p{Cs}\p{Zl}\p{Zp}\uFFFD]/u;
const PATH_PATTERN = /[*?\[\]{}]/;

function safeText(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 1024 && !UNSAFE_TEXT.test(value);
}

function realDirectory(directory) {
  try {
    return path.isAbsolute(directory) ? fs.realpathSync(directory) : null;
  } catch {
    return null;
  }
}

function gitMetadata(flag) {
  const result = runGit(["rev-parse", "--path-format=absolute", flag], { timeout: TIMEOUT_MS });
  return result.status === 0 ? realDirectory(result.stdout.replace(/\n$/, "")) : null;
}

function codexDiagnostic(profile, overrides = []) {
  if (profile != null && (typeof profile !== "string" || !profile.trim() || /[\0\r\n]/.test(profile))) return null;
  const result = spawnSync("codex",
    ["sandbox", ...codexProfileArgs(profile), ...overrides, "--", process.execPath, "-e", ""], {
      cwd: ROOT, env: codexChildEnv(), stdio: ["ignore", "pipe", "pipe"], encoding: "utf8",
      timeout: TIMEOUT_MS, killSignal: "SIGKILL", maxBuffer: 16 * 1024, windowsHide: true,
    });
  if (result.error || result.signal || result.status !== 1) return null;
  const error = result.stderr.split(/\r?\n/).find(line => line.startsWith("Error: "));
  if (error === MISSING_PERMISSIONS) return { name: null };
  const match = UNDEFINED_PROFILE.exec(error ?? "");
  return match ? { name: match[1] } : null;
}

function codexWarning(profile, common) {
  const diagnostic = codexDiagnostic(profile);
  if (!diagnostic) return null;
  const name = diagnostic.name ?? codexDiagnostic(profile, ["-c", "permissions={}"])?.name;
  const profileKey = safeText(name) ? JSON.stringify(name) : '"<default_permissions>"';
  const overlay = profile == null ? "" : ` Check default_permissions in the active -p overlay ${safeText(profile) ? JSON.stringify(profile) : "selected by codex.profile"}.`;
  const selector = safeText(name) ? "" : ' Replace "<default_permissions>" with the selected default_permissions value.';
  const header = `[permissions.${profileKey}]`;
  return [
    `Warning: Codex could not resolve its default_permissions profile.${overlay}`,
    `In the target project's trusted .codex/config.toml, merge this profile.${selector}`,
    header,
    'extends = ":workspace"',
    ...(safeText(common) && !PATH_PATTERN.test(common) ? [
      "", `[permissions.${profileKey}.filesystem]`, `${JSON.stringify(common)} = "write"`,
    ] : []),
  ].join("\n");
}

function mainCheckout() {
  const result = runGit(["worktree", "list", "--porcelain", "-z"], { timeout: TIMEOUT_MS });
  if (result.status !== 0) return null;
  // In porcelain output Git lists the main worktree (or bare repository) first.
  const [record] = result.stdout.split("\0\0", 1);
  const [entry, ...fields] = record.split("\0");
  return entry.startsWith("worktree ") && !fields.includes("bare") ? realDirectory(entry.slice(9)) : null;
}

function writeList(configDir, file) {
  try {
    const directory = fs.realpathSync(configDir);
    const settingsPath = path.join(directory, file);
    fs.lstatSync(settingsPath); // Only ENOENT means the scope is absent.
    const settings = JSON.parse(readBoundedFile(settingsPath, { root: directory, maxBytes: 1024 * 1024 }));
    if (!isObject(settings)) return null;
    const { sandbox = {} } = settings;
    if (!isObject(sandbox)) return null;
    const { filesystem = {} } = sandbox;
    if (!isObject(filesystem)) return null;
    const { allowWrite = [] } = filesystem;
    return Array.isArray(allowWrite) ? allowWrite : null;
  } catch (error) {
    return error.code === "ENOENT" ? [] : null;
  }
}

function unsupportedClaudePath(value) {
  return PATH_PATTERN.test(value) || (process.platform !== "win32" && value.includes("\\"));
}

function coversCommon(entry, anchor, home, common) {
  if (typeof entry !== "string" || !entry.trim() || entry.includes("\0")) return null;
  const trailingTree = process.platform === "win32" ? /[/\\]\*\*[/\\]*$/ : /\/\*\*\/*$/;
  const directory = entry.replace(trailingTree, path.sep);
  if (unsupportedClaudePath(directory)) return null;
  const homeRelative = process.platform === "win32" ? /^~[/\\]/ : /^~\//;
  if (directory.startsWith("~") && directory !== "~" && !homeRelative.test(directory)) return null;
  const absolute = directory === "~" ? home
    : homeRelative.test(directory) ? path.join(home, directory.slice(2))
    : path.resolve(anchor, directory);
  try {
    const relative = path.relative(fs.realpathSync(absolute), common);
    return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
  } catch (error) {
    return error.code === "ENOENT" || error.code === "ENOTDIR" ? false : null;
  }
}

function claudeWarning(common) {
  if (!safeText(common) || unsupportedClaudePath(common)) return null;
  const home = os.homedir();
  const user = path.resolve(process.env.CLAUDE_CONFIG_DIR || path.join(home, ".claude"));
  const project = path.join(ROOT, ".claude");
  const main = mainCheckout();
  const scopes = [[user, "settings.json", user], [project, "settings.json", ROOT], [project, "settings.local.json", ROOT]];
  // Claude reads an older worktree-local file alongside the main-checkout file.
  // Both local lists can contain entries relative to the session's launch directory.
  if (main && main !== ROOT) scopes.push([path.join(main, ".claude"), "settings.local.json", ROOT]);
  let uncertain = !main;
  for (const [dir, file, anchor] of scopes) {
    const entries = writeList(dir, file);
    if (!entries) { uncertain = true; continue; }
    for (const entry of entries) {
      const covered = coversCommon(entry, anchor, home, common);
      if (covered) return null;
      if (covered === null) uncertain = true;
    }
  }
  return [
    uncertain
      ? "Warning: Could not verify an explicit Claude sandbox write-list entry for this worktree's shared Git directory."
      : "Warning: The inspected Claude sandbox write lists have no explicit entry for this worktree's shared Git directory.",
    "Claude can grant shared Git access automatically when launched at the worktree root. If sandboxed Git writes fail, merge this into the applicable settings and preserve existing entries.",
    JSON.stringify({ sandbox: { filesystem: { allowWrite: [common] } } }, null, 2),
  ].join("\n");
}

export function initPermissionWarnings(policy, selection, neutralReplay) {
  const providers = new Set(Object.values(providersByStep(policy, selection)).flat());
  const replayProvider = neutralReplay ? providerOf(neutralReplay) : null;
  if (replayProvider) providers.add(replayProvider);
  const common = gitMetadata("--git-common-dir");
  const warnings = [];
  if (providers.has("openai")) {
    const profile = replayProvider === "openai" ? neutralReplay.profile : policy.codex?.profile;
    warnings.push(codexWarning(profile, common));
  }
  if (providers.has("claude") && common) {
    const gitDir = gitMetadata("--git-dir");
    if (gitDir && gitDir !== common) warnings.push(claudeWarning(common));
  }
  const message = warnings.filter(Boolean).join("\n\n");
  if (message) {
    // init exits synchronously with the action, so finish the advisory write before dispatch.
    try { fs.writeSync(2, message + "\n"); } catch { /* A closed advisory stream cannot stop routing. */ }
  }
}
