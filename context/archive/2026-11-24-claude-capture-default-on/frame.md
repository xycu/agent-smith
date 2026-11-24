# Frame Brief: Token capture on by default for Claude-hosted runs

> Framing step before /10x-plan. It separates what is observed from what was assumed.

## Reported Observation

On a Claude-hosted run, step token figures show `-` with `capture-disabled` unless the session started through `claude-capture.mjs`. Codex steps show figures. The owner most often hits this by starting plain `claude` and forgetting the launcher.

## Initial Framing (preserved)

- **User's stated cause or approach**: capture should be on by default for both providers; Claude needs OTEL env set at launch, so the route is auto-relaunch (owner choice, 2026-11-24).
- **User's proposed direction**: make the launcher the expected path and amend ADR-018 and ADR-019.
- **Pre-dispatch narrowing**: the case that matters is "forgot the launcher" on interactive Claude. The owner also wants the Claude Code version check in scope.

## Dimension Map

1. **Detection** (`init-usage.mjs`, `claudeCaptureReadiness`) — knows the session is unbound (`disabled`) or broken (`unusable`). Works.
2. **Consequence at `init`** (`route.mjs:1134`) — only a one-line stderr advisory; the run starts anyway.  ← where the failure lives
3. **Enablement** — OTEL env must exist when `claude` starts; the plugin cannot set it in a running session and must not edit user settings.
4. **Version gate** — `CLAUDE_CAPTURE_MIN_VERSION = "2.1.311"` is a floor, not an exact match.
5. **Codex** — no opt-in; `codexWarning` only checks the CLI version.

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| Detection is missing or wrong | `claudeCaptureReadiness` returns `disabled`/`unusable`/`ready` (`claude-capture-data.mjs:102`); `claudeWarning` maps both (`init-usage.mjs:55-60`) | NONE |
| Init only advises, so a forgotten launcher goes unnoticed | `initUsageWarning` writes to stderr and returns; `route.mjs:1134` proceeds to write state. A halting gate exists for isolation (`route.mjs:89`, `isolationCheck`) but none for capture | STRONG |
| Plugin could enable capture without relaunch | Launcher exports OTEL only to its child (`REFERENCE.md:505`); it refuses existing OTEL settings and managed policy (`claude-capture.mjs:17-21`) | NONE |
| Version check blocks newer releases | `claudeCaptureSupported` accepts any later release (`claude-capture-data.mjs:22-28`); the older "exact version" text in the archived change is out of date | NONE |
| Codex is off by default | Collector runs after settlement on CLI 0.169.0 or later; owner saw no missing Codex figures | NONE |

## Narrowing Signals

- Owner hits the missing-figure case by forgetting the launcher, not by launcher refusal.
- The version range question is already answered by the code: floor, not exact.

## Cross-System Convention

`isolation.require` is the existing pattern: a policy key, a halt before anything is written, an opt-out through `context/foundation/agent-smith-policy.json`. A capture gate fits it.

## Reframed (or Confirmed) Problem Statement

> **The actual problem to plan around is**: an unbound Claude session is detected but never acted on — `init` warns on stderr and starts a run that is guaranteed to have no token figures.

"Auto-relaunch" in the literal sense is impossible: a plugin cannot relaunch its host or set its telemetry env. What can change is that `init` stops treating the missing launcher as advisory. The version question needs no work.

## Confidence

**HIGH** — `init-usage.mjs` and `route.mjs:1134` show warn-only behavior; the docs and `claude-capture.mjs` show the enablement limit; `claudeCaptureSupported` settles the version question.

## What Changes for /10x-plan

Plan an `init` gate for Claude-hosted runs: when readiness is not `ready`, halt before writing anything, name the launcher command and how to resume the run, and give an explicit opt-out (policy key or flag). Decide how the gate treats headless runs and neutral replays, and whether the Codex floor check joins it. Then update `docs/REFERENCE.md`, the README coverage paragraph and amend ADR-018 and ADR-019 (it overturns the 2026-11-21 opt-in decision). Drop the version-range work from scope.

## References

- Source files: `skills/10x-pipeline/scripts/init-usage.mjs:47-60`, `skills/10x-pipeline/scripts/route.mjs:1134`, `skills/10x-pipeline/scripts/claude-capture-data.mjs:21-28,102-113`, `skills/10x-pipeline/scripts/claude-capture.mjs:17-21`
- Prior decision: `context/archive/2026-11-19-claude-token-figures-default/frame.md`
- Related change: `context/changes/usage-capture-preflight/` (PR #278), the warning this builds on
