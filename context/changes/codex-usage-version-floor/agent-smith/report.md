# Run report: codex-usage-version-floor

Goal: Accept Codex CLI releases at or above a reviewed floor in Codex token accounting. skills/10x-pipeline/scripts/codex-usage.mjs pins CODEX_USAGE_VERSION = 0.169.0 and compares the app-server host version, each thread metadata cliVersion and the rollout session_meta cli_version with !==, so codex-cli 0.171.0 gets usageEvidence unavailable/unsupported-host and no totalTokens. Mirror commit fdf6a7e4 (claudeCaptureSupported in claude-capture-data.mjs): one shared helper that accepts a strict X.Y.Z at or above the floor 0.169.0 and refuses non-SemVer, used by all three checks; no new dependency; a changed record shape keeps failing closed with unsupported-schema or its specific reason, never unsupported-host. change.md records the 0.171.0 schema check. Update docs/REFERENCE.md and README.md where they state the pinned Codex accounting version, and the codex-usage.test.mjs row in skills/10x-pipeline/test/README.md. Add focused tests in skills/10x-pipeline/test/codex-usage.test.mjs: below the floor refused (unsupported-host), at the floor and above it (0.171.0) accepted with verified tokens, non-SemVer refused, for the app-server version and the rollout cli_version. Run only the touched test files. Commit subject type fix(codex-usage-version-floor).
Rigor: standard (goal hard)
Provider mode: codex
Outcome: done - impl review APPROVED

| # | Step | Provider | Model | Effort | Tier | Simple | Result | Tokens |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | score | openai | gpt-6-luna | low | 0 | no | ok (c5c88dd), 1 neutral rerun | - |
| 2 | plan | openai | gpt-6.2-astra | high | 5 | no | ok (817f49f) | - |
| 3 | plan-review | openai | gpt-6.2-sol | high | 3 | no | ok (f3f1aa0) | - |
| 4 | implement | openai | gpt-6.2-sol | medium | 2 | yes | ok (4e9ab1e) | - |
| 5 | impl-review | openai | gpt-6.2-sol | high | 3 | no | ok (cc1c4a4) | - |

Steps: 5 · Tokens: - (figures for 0 of 5 steps)

## Token coverage

Verified observed host usage: 0 · Unavailable: 5 · Legacy/unverified scope: 0 · Missing figures: 5
Provider, model and tier groups describe the enclosing dispatch.
- Step 1 score: unsupported-host — The host version is not qualified for accounting.
- Step 2 plan: unsupported-host — The host version is not qualified for accounting.
- Step 3 plan-review: unsupported-host — The host version is not qualified for accounting.
- Step 4 implement: unsupported-host — The host version is not qualified for accounting.
- Step 5 impl-review: unsupported-host — The host version is not qualified for accounting.

## Neutral reruns

Steps returned again unchanged (same prompt, model and effort) after the orchestrator declared a fault of its own; no failed attempt was counted. The notes are the orchestrator's.

- step 1 score: 1 rerun after an orchestrator fault
  - The orchestrator did not save the step 1 action JSON for the runner stdin, so the step was never launched.

## Review findings

Counts as recorded when each review step ended; later edits of a review file are not reflected.

- step 3 plan-review: REVISE, 0 critical, 2 warnings measured; 0 critical, 0 warnings open
- step 5 impl-review: APPROVED, 0 critical, 0 warnings measured

## Complexity score

Scores: cognitive 2, execution 2 (ambiguity 0, novelty 1, coupling 1, discovery 0, volume 1, verification 1)
Confidence: high · Unknowns: 0
Source: score step 1

No tier shift.
