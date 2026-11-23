---
change_id: usage-capture-preflight
title: Warn before the first step when token usage cannot be captured
status: implementing
created: 2026-11-21
updated: 2026-11-23
archived_at: null
---

## Notes

**Origin.** [Issue #232](https://github.com/xycu/agent-smith/issues/232), seen on two runs in a row (Claude host 2.1.311, `--pr-comment`).

**The defect.** A full run finishes with no token figures, and nothing warns the operator before or during the run. Every step gets `usageEvidence.status: "unavailable"`, `reason: "missing-source"`, and the report and PR comment show no token values. The data cannot be recovered afterwards.

**Cause.** `claude-usage.mjs` needs `sources.nativeFile` (hooks JSONL with paired `PreToolUse`/`PostToolUse` Agent records and `SubagentStop`) and `sources.telemetryFile` (OTLP JSON logs with `api_request` events). `docs/REFERENCE.md` says the plugin installs no hooks, configures no exporters and enables no telemetry. The host had neither, so the collector correctly returned `missing-source` for every step. `init` and `prepare-run` do not check for a capture.

**Expected (from the issue).**

- A preflight at `init` (or `prepare-run`) that reports, before the first step, whether token accounting can work on this host: on Claude, an OTLP JSON log file and a hook capture of `PreToolUse`/`PostToolUse`/`SubagentStop`, both readable regular files; on Codex, the equivalent source.
- If not set up: one clear warning that points to the setup steps in the docs. Optionally a flag such as `--require-usage` that stops the run instead.
- The final report and PR comment say why tokens are missing ("no capture configured"), not only `missing-source` per step.
- Nice to have: a documented copy-paste capture setup that passes the collector's provenance checks (`process.pid`, `process.creation.time`, event-sequence prefix).

**Relation to other changes.** `claude-token-figures-default` asks the owner whether Claude steps report token figures by default and from which source. That decision may change which sources this preflight checks, so this change waits for it.

**Schedule.** `context/changes/WAVES.md`: Wave 5, after `claude-token-figures-default`. It feeds S-15 `actionable-run-prerequisites`.
