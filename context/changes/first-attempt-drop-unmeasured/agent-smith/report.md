# Run report: first-attempt-drop-unmeasured

Goal: Run without any interaction to the user
Rigor: standard (failed steps 1)
Provider mode: codex
Outcome: done - impl review NEEDS ATTENTION

| # | Step | Provider | Model | Effort | Tier | Simple | Result | Tokens |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | plan | openai | gpt-6.2-sol | medium | 2 | yes | ok (3221e3b), 1 neutral rerun | - |
| 2 | plan-review | openai | gpt-6.2-sol | medium | 2 | no | failed | - |
| 3 | plan-review | openai | gpt-6.2-sol | high | 3 | no | ok (e8b2d2a) | - |
| 4 | implement | openai | gpt-6.2-sol | high | 3 | no | ok (9b0af87) | - |
| 5 | manual-verify | openai | gpt-6.2-sol | medium | 2 | no | ok (48ab620) | - |
| 6 | manual-verify | openai | gpt-6.2-sol | high | 3 | no | ok (d5de78c) | - |
| 7 | impl-review | openai | gpt-6.2-sol | high | 3 | no | ok (64d88d4) | - |

Steps: 7 · Tokens: - (figures for 0 of 7 steps)

## Token coverage

Verified observed host usage: 0 · Unavailable: 7 · Legacy/unverified scope: 0 · Missing figures: 7
Provider, model and tier groups describe the enclosing dispatch.
- Step 1 plan: unsupported-host — The host version is not qualified for accounting.
- Step 2 plan-review: unsupported-host — The host version is not qualified for accounting.
- Step 3 plan-review: unsupported-host — The host version is not qualified for accounting.
- Step 4 implement: unsupported-host — The host version is not qualified for accounting.
- Step 5 manual-verify: unsupported-host — The host version is not qualified for accounting.
- Step 6 manual-verify: unsupported-host — The host version is not qualified for accounting.
- Step 7 impl-review: unsupported-host — The host version is not qualified for accounting.

## Neutral reruns

Steps returned again unchanged (same prompt, model and effort) after the orchestrator declared a fault of its own; no failed attempt was counted. The notes are the orchestrator's.

- step 1 plan: 1 rerun after an orchestrator fault
  - Codex runner refused before launch (launched: false): permission preflight could not verify Git capability because the orchestrator ran it inside the Claude Bash sandbox, where the nested Codex native

## Review findings

Counts as recorded when each review step ended; later edits of a review file are not reflected.

- step 2 plan-review: REVISE, 2 critical, 3 warnings measured; 0 critical, 1 warnings open
- step 3 plan-review: REVISE, 2 critical, 3 warnings measured; 0 critical, 0 warnings open
- step 7 impl-review: NEEDS ATTENTION, 0 critical, 2 warnings measured; 0 critical, 0 warnings open

## Manual checks

Rows as recorded when the last manual-verify step ended. The kind comes from the evidence file name; the router never reads the content. Only browser, test, command or script evidence proves a browser row.

Proved: 0

Not proved: 3

- 2.1 Qualify the exact live host and provider mode with verified step-tree figures — not proved: Current run status shows zero verified figures. The prior Claude launcher run does not qualify the exact experiment revision, launch path and provider mode.
- 2.2 Record the five eligible A/B pairs and A/A control in ADR-010, or document exclusions and an exhausted or stopped measurement — not proved: ADR-010 still marks measurement pending. It records neither the required A/B pairs and A/A control nor exclusions through an exhausted or stopped measurement.
- 2.3 Apply the ADR-010 decision rule, reconcile policy and docs, and record passing local closeout tests — not proved: Policy and docs agree on interim drop 0. ADR-010 has no final experiment decision, so post-decision closeout tests cannot establish this row.
