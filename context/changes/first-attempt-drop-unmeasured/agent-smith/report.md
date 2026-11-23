# Run report: first-attempt-drop-unmeasured

Goal: Run without any interaction to the user
Rigor: standard (failed steps 1)
Provider mode: codex
Outcome: halt - Step 2 (plan-review) needs a human: Confirm shipping drop 0 before measurement or approve retaining drop 1 through a dated ADR-010 measurement window.

| # | Step | Provider | Model | Effort | Tier | Simple | Result | Tokens |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | plan | openai | gpt-6.2-sol | medium | 2 | yes | ok (3221e3b), 1 neutral rerun | - |
| 2 | plan-review | openai | gpt-6.2-sol | medium | 2 | no | failed | - |

Steps: 2 · Tokens: - (figures for 0 of 2 steps)

## Token coverage

Verified observed host usage: 0 · Unavailable: 2 · Legacy/unverified scope: 0 · Missing figures: 2
Provider, model and tier groups describe the enclosing dispatch.
- Step 1 plan: unsupported-host — The host version is not qualified for accounting.
- Step 2 plan-review: unsupported-host — The host version is not qualified for accounting.

## Neutral reruns

Steps returned again unchanged (same prompt, model and effort) after the orchestrator declared a fault of its own; no failed attempt was counted. The notes are the orchestrator's.

- step 1 plan: 1 rerun after an orchestrator fault
  - Codex runner refused before launch (launched: false): permission preflight could not verify Git capability because the orchestrator ran it inside the Claude Bash sandbox, where the nested Codex native

## Review findings

Counts as recorded when each review step ended; later edits of a review file are not reflected.

- step 2 plan-review: REVISE, 2 critical, 3 warnings measured; 0 critical, 1 warnings open
