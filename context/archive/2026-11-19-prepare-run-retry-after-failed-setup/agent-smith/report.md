# Run report: prepare-run-retry-after-failed-setup

Goal: Finish the change-folder copy when prepare-run is retried after a failed setup
Rigor: thorough (hot paths skills/10x-pipeline/test/prepare-run.test.mjs, skills/10x-pipeline/test/run-lock.test.mjs, skills/10x-pipeline/test/skill-loop.test.mjs +1)
Provider mode: split
Outcome: done - impl review APPROVED

| # | Step | Provider | Model | Effort | Tier | Simple | Result | Tokens |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | plan | openai | gpt-6.2-sol | medium | 2 | yes | ok (b90f45b) | - |
| 2 | plan-review | claude | sonnet | medium | 2 | no | ok (91f0152) | - |
| 3 | implement | openai | gpt-6.2-sol | medium | 2 | yes | ok (9511662) | - |
| 4 | impl-review | claude | sonnet | high | 3 | no | ok (4226cf6) | - |

Steps: 4 · Tokens: - (figures for 0 of 4 steps)

## Token coverage

Verified observed host usage: 0 · Unavailable: 4 · Legacy/unverified scope: 0 · Missing figures: 4
Provider, model and tier groups describe the enclosing dispatch.
- Step 1 plan: unsupported-host — The host version is not qualified for accounting.
- Step 2 plan-review: missing-source — The required host usage source is unavailable.
- Step 3 implement: unsupported-host — The host version is not qualified for accounting.
- Step 4 impl-review: missing-source — The required host usage source is unavailable.

## Review findings

Counts as recorded when each review step ended; later edits of a review file are not reflected.

- step 2 plan-review: REVISE, 0 critical, 1 warnings measured; 0 critical, 0 warnings open
- step 4 impl-review: APPROVED, 0 critical, 0 warnings measured; 0 critical, 0 warnings open
