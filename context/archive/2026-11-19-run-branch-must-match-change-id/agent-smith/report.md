# Run report: run-branch-must-match-change-id

Goal: Refuse to run a change on another change's run branch: validateRunBranch requires the branch to be the run branch of that change id (prefix plus id, with <id>-baseline still accepted), so prepare-run and init refuse with a message that names both ids and what to do and write nothing; keep the older-prefix recovery message and document the rule in the isolation section of docs/REFERENCE.md.
Rigor: standard (goal plain)
Provider mode: claude
Outcome: done - impl review APPROVED

| # | Step | Provider | Model | Effort | Tier | Simple | Result | Tokens |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | score | claude | haiku | low | 0 | no | ok (1fa9a33) | - |
| 2 | plan | claude | sonnet | high | 3 | no | ok (9d8c150) | - |
| 3 | plan-review | claude | sonnet | high | 3 | no | ok (700851e), 1 neutral rerun | - |
| 4 | implement | claude | sonnet | medium | 2 | no | ok (a9a2b4c) | - |
| 5 | impl-review | claude | sonnet | high | 3 | no | ok (a7100f4) | - |

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

- step 3 plan-review: 1 rerun after an orchestrator fault
  - step agent blocked by linked-session write hook; run returned to owner session

## Review findings

Counts as recorded when each review step ended; later edits of a review file are not reflected.

- step 3 plan-review: REVISE, 0 critical, 1 warnings measured; 0 critical, 0 warnings open
- step 5 impl-review: APPROVED, 0 critical, 2 warnings measured; 0 critical, 0 warnings open

## Complexity score

Scores: cognitive 4, execution 4 (ambiguity 1, novelty 1, coupling 2, discovery 1, volume 2, verification 1)
Confidence: medium · Unknowns: 2
Source: score step 1

No tier shift.
