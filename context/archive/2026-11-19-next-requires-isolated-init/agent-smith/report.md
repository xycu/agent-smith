# Run report: next-requires-isolated-init

Goal: Make next refuse a run that init would refuse for missing isolation: when isolation is required and meta.json does not record an isolated run, next halts, writes nothing and tells the caller to run init first; an isolated run started by init still advances, isolation-off projects keep today's behavior, and docs/REFERENCE.md gets one line under next.
Rigor: thorough (hot paths skills/10x-pipeline/scripts/route.mjs, skills/10x-pipeline/test/agents.test.mjs, skills/10x-pipeline/test/archive.test.mjs +15)
Provider mode: claude
Outcome: done - impl review APPROVED

| # | Step | Provider | Model | Effort | Tier | Simple | Result | Tokens |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | score | claude | haiku | low | 0 | no | ok (28ed9b8) | - |
| 2 | plan | claude | sonnet | high | 3 | no | ok (54b6ca2) | - |
| 3 | plan-review | claude | sonnet | high | 3 | no | ok (25741fd) | - |
| 4 | implement | claude | sonnet | medium | 2 | no | ok (20a4eb5), 1 neutral rerun | - |
| 5 | manual-verify | claude | sonnet | medium | 2 | no | ok (a34409b) | - |
| 6 | impl-review | claude | sonnet | high | 3 | no | ok (b499717) | - |

Steps: 6 · Tokens: - (figures for 0 of 6 steps)

## Token coverage

Verified observed host usage: 0 · Unavailable: 6 · Legacy/unverified scope: 0 · Missing figures: 6
Provider, model and tier groups describe the enclosing dispatch.
- Step 1 score: unsupported-host — The host version is not qualified for accounting.
- Step 2 plan: unsupported-host — The host version is not qualified for accounting.
- Step 3 plan-review: missing-source — The required host usage source is unavailable.
- Step 4 implement: unsupported-host — The host version is not qualified for accounting.
- Step 5 manual-verify: unsupported-host — The host version is not qualified for accounting.
- Step 6 impl-review: unsupported-host — The host version is not qualified for accounting.

## Neutral reruns

Steps returned again unchanged (same prompt, model and effort) after the orchestrator declared a fault of its own; no failed attempt was counted. The notes are the orchestrator's.

- step 4 implement: 1 rerun after an orchestrator fault
  - step agent blocked by linked-session write hook; run returned to owner session

## Review findings

Counts as recorded when each review step ended; later edits of a review file are not reflected.

- step 3 plan-review: SOUND, 0 critical, 1 warnings measured; 0 critical, 0 warnings open
- step 6 impl-review: APPROVED, 0 critical, 1 warnings measured; 0 critical, 0 warnings open

## Manual checks

Rows as recorded when the last manual-verify step ended. The kind comes from the evidence file name; the router never reads the content. Only browser, test, command or script evidence proves a browser row.

Proved: 2

- 1.4 Read the halt reason once and confirm it tells a person what to do (run `init` in the run worktree) without suggesting the opt-out as the first remedy — judgment (evidence/judgment-halt-reason.md)
- 2.4 The new REFERENCE bullet reads clearly next to the `init` bullets and mentions the isolation-off exception — judgment (evidence/judgment-reference-bullet.md)

Not proved: 0

## Complexity score

Scores: cognitive 3, execution 2 (ambiguity 1, novelty 1, coupling 1, discovery 0, volume 1, verification 1)
Confidence: high · Unknowns: 2
Source: score step 1

No tier shift.
