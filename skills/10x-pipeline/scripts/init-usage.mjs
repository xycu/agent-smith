import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { ROOT, SKILL_DIR, hostOf, providerOf, providersByStep } from "./state.mjs";
import { codexChildEnv } from "./codex-startup.mjs";

// SemVer 2.0.0 version fields, as used by the release version check.
const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
const SETUP = "See docs/REFERENCE.md#accounting-activation-and-rollback.";

function codexVersion() {
  const result = spawnSync("codex", ["--version"], {
    cwd: ROOT, env: codexChildEnv(), stdio: ["ignore", "pipe", "pipe"], encoding: "utf8",
    timeout: 2000, killSignal: "SIGKILL", maxBuffer: 16 * 1024, windowsHide: true,
  });
  if (result.error || result.signal || result.status !== 0) return null;
  const [line, ...extra] = result.stdout.split(/\r?\n/);
  if (extra.length > 1 || extra[0]) return null;
  const version = /^codex-cli (\S+)$/.exec(line)?.[1];
  return version && SEMVER.test(version) ? version : null;
}

async function codexWarning() {
  const adapter = await import("./codex-usage.mjs").catch(() => null);
  if (typeof adapter?.CODEX_USAGE_FLOOR !== "string" || typeof adapter.codexUsageSupported !== "function") {
    return "Could not check Codex token capture readiness. Verify the installed agent-smith plugin.";
  }
  const { CODEX_USAGE_FLOOR, codexUsageSupported } = adapter;
  const version = codexVersion();
  if (version && codexUsageSupported(version)) return null;
  if (!version) {
    return "Could not check Codex token capture readiness. Verify that codex --version on the run's PATH " +
      "reports codex-cli " + CODEX_USAGE_FLOOR + " or later.";
  }
  return "Codex CLI version is unsupported for verified token capture. Use codex-cli " +
    CODEX_USAGE_FLOOR + " or later on the run's PATH.";
}

// "ready", "disabled", "unusable", or "unknown" when the capture module cannot be loaded.
async function claudeReadiness() {
  try {
    // The capture files are optional to the router, including when the provenance hash cannot be computed.
    const { claudeCaptureReadiness } = await import("./claude-capture-data.mjs");
    return claudeCaptureReadiness();
  } catch {
    return "unknown";
  }
}

const OFF = "Native Claude token capture is off in this session.";
const UNAVAILABLE = "Native Claude launcher capture is unavailable.";

async function claudeWarning(host) {
  if (host === "codex") {
    return "Headless Claude on Codex records duration only. Start a fresh Claude session with the capture launcher. " +
      "From that session, start a new Claude-hosted run or resume an existing Claude-hosted run " +
      "with its saved provider mode.";
  }
  const readiness = await claudeReadiness();
  if (readiness === "unknown") {
    return "Could not check native Claude token capture. Verify the installed agent-smith plugin and use the documented launcher.";
  }
  if (readiness === "disabled") return OFF + " Start a fresh Claude session with the capture launcher.";
  if (readiness === "unusable") return UNAVAILABLE + " Exit this session and relaunch Claude using the documented capture setup.";
  return null;
}

function assignedProviders(policy, selection, neutralReplay) {
  return neutralReplay ? new Set([providerOf(neutralReplay)])
    : new Set(Object.values(providersByStep(policy, selection)).flat());
}

// The halt reason for a native Claude host whose capture is definitely not ready (claudeCapture.require), or null.
export async function claudeCaptureStop(policy, selection, neutralReplay, id, chain) {
  if (policy?.claudeCapture?.require !== true || hostOf(selection) !== "claude") return null;
  if (process.env.AGENT_SMITH_CLAUDE_SESSION) return null;
  if (!assignedProviders(policy, selection, neutralReplay).has("claude")) return null;
  const readiness = await claudeReadiness();
  if (readiness !== "disabled" && readiness !== "unusable") return null;
  const skill = chain === "openspec" ? "openspec-pipeline" : "10x-pipeline";
  return (readiness === "disabled" ? OFF + " Start a fresh Claude session with the capture launcher: "
    : UNAVAILABLE + " Exit this session and relaunch Claude with the capture launcher: ") +
    `node "${path.join(SKILL_DIR, "scripts", "claude-capture.mjs")}" ` +
    "(run it from a terminal outside Claude Code, in the project root), then run " +
    `/agent-smith:${skill} ${id} again in that session with the same flags; ` +
    "a run that already has steps resumes with its saved host and provider mode. " +
    'To skip this check, set { "claudeCapture": { "require": false } } in context/foundation/agent-smith-policy.json. ' +
    "Nothing was written.";
}

export async function initUsageWarning(policy, selection, neutralReplay) {
  const providers = assignedProviders(policy, selection, neutralReplay);
  const warnings = [];
  if (providers.has("claude")) warnings.push(await claudeWarning(hostOf(selection)));
  if (providers.has("openai")) warnings.push(await codexWarning());
  const message = warnings.filter(Boolean).join(" ");
  if (message) {
    // init exits synchronously with the action, so finish the advisory write before dispatch.
    try { fs.writeSync(2, "Warning: Usage capture preflight. " + message + " " + SETUP + "\n"); }
    catch { /* A closed advisory stream cannot stop routing. */ }
  }
}
