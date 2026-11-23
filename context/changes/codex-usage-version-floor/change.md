---
change_id: codex-usage-version-floor
title: Accept Codex releases at or above the reviewed usage floor
status: impl_reviewed
created: 2026-11-23
updated: 2026-11-23
archived_at: null
---

## Notes

Codex token accounting reports no tokens on every Codex release except one. `skills/10x-pipeline/scripts/codex-usage.mjs` pins `CODEX_USAGE_VERSION = "0.169.0"` and compares the app-server host version, each thread's `meta.cliVersion` and the rollout `session_meta` `cli_version` with `!==`. A live run of `usage-capture-preflight` on 2026-11-23 with codex-cli 0.171.0 got `usageEvidence.status: "unavailable"`, `reason: "unsupported-host"` and no `totalTokens` for every step.

Mirror the Claude fix of commit fdf6a7e4 (`claudeCaptureSupported` in `skills/10x-pipeline/scripts/claude-capture-data.mjs`): accept any strict `X.Y.Z` at or above a reviewed floor, with one shared helper and no new dependency. A changed record shape must keep failing closed with `unsupported-schema` (or the existing specific reason), never `unsupported-host`.

Schema check, 2026-11-23: the 0.171.0 rollouts under `~/.codex/sessions/2026/11/23` keep every field the collector reads (`session_meta` id, session_id, cli_version, history_mode, ordinal, parent_thread_id, forked_from_id, subagent_history_start_ordinal; `task_started`/`task_complete` turn_id and root_turn_id; `token_usage_record` usage, turn_token_usage, thread_token_usage; `token_count` info.total_token_usage). A scratch copy of the collector with the pin set to 0.171.0 verified 27 of 35 real step trees (flat and delegated, up to 3 children). The other 8 failed with `incomplete-capture`, and each holds a rollout without a terminal `task_complete`.
