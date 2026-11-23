import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { ROOT, hostOf, providerOf, providersByStep } from "./state.mjs";
import { codexChildEnv } from "./codex-startup.mjs";
import { CODEX_USAGE_VERSION } from "./codex-usage.mjs";

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

function codexWarning() {
  const version = codexVersion();
  if (version === CODEX_USAGE_VERSION) return null;
  if (!version) {
    return "Could not check Codex token capture readiness. Verify that codex --version on the run's PATH " +
      "reports codex-cli " + CODEX_USAGE_VERSION + ".";
  }
  return "Codex CLI version is unsupported for verified token capture. Use codex-cli " +
    CODEX_USAGE_VERSION + " on the run's PATH.";
}

async function claudeWarning(host) {
  if (host === "codex") {
    return "Headless Claude on Codex records duration only. For verified token totals, use the capture launcher " +
      "in a fresh Claude session and start a new Claude-hosted run or resume an existing Claude-hosted run " +
      "with its saved provider mode.";
  }
  let readiness;
  try {
    // The capture files are optional to the router, including when the provenance hash cannot be computed.
    const { claudeCaptureReadiness } = await import("./claude-capture-data.mjs");
    readiness = claudeCaptureReadiness();
  } catch {
    return "Could not check native Claude token capture. Verify the installed agent-smith plugin and use the documented launcher.";
  }
  if (readiness === "disabled") {
    return "Native Claude token capture is off in this session. Start a fresh Claude session with the capture launcher.";
  }
  if (readiness === "unusable") {
    return "Native Claude launcher capture is unavailable. Exit this session and relaunch Claude using the documented capture setup.";
  }
  return null;
}

export async function initUsageWarning(policy, selection, neutralReplay) {
  const providers = neutralReplay ? new Set([providerOf(neutralReplay)])
    : new Set(Object.values(providersByStep(policy, selection)).flat());
  const warnings = [];
  if (providers.has("claude")) warnings.push(await claudeWarning(hostOf(selection)));
  if (providers.has("openai")) warnings.push(codexWarning());
  const message = warnings.filter(Boolean).join(" ");
  if (message) {
    // init exits synchronously with the action, so finish the advisory write before dispatch.
    try { fs.writeSync(2, "Warning: Usage capture preflight. " + message + " " + SETUP + "\n"); }
    catch { /* A closed advisory stream cannot stop routing. */ }
  }
}
