# Run report: open-pr-base-prefix-collision

Goal: Keep a short isolation.branchPrefix from hiding the base branch in open-pr
Rigor: thorough (hot paths skills/10x-pipeline/scripts/open-pr.mjs, skills/10x-pipeline/test/open-pr.test.mjs, skills/10x-pipeline/test/run-lock.test.mjs)
Provider mode: split
Outcome: done - impl review APPROVED

| # | Step | Provider | Model | Effort | Tier | Simple | Result | Tokens |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | plan | openai | gpt-6.2-sol | medium | 2 | yes | ok (2fe1236) | - |
| 2 | plan-review | claude | sonnet | medium | 2 | no | ok (665fbf0) | - |
| 3 | implement | openai | gpt-6.2-sol | medium | 2 | no | ok (dd8c2f2) | - |
| 4 | impl-review | claude | sonnet | high | 3 | no | ok (ecdc90e) | - |

Steps: 4 · Tokens: - (figures for 0 of 4 steps)

## Token coverage

Verified observed host usage: 0 · Unavailable: 4 · Legacy/unverified scope: 0 · Missing figures: 4
Provider, model and tier groups describe the enclosing dispatch.
- Step 1 plan: unsupported-host — The host version is not qualified for accounting.
- Step 2 plan-review: missing-source — The required host usage source is unavailable.
- Step 3 implement: unsupported-host — The host version is not qualified for accounting.
- Step 4 impl-review: unsupported-host — The host version is not qualified for accounting.

## Review findings

Counts as recorded when each review step ended; later edits of a review file are not reflected.

- step 2 plan-review: SOUND, 0 critical, 0 warnings measured; 0 critical, 0 warnings open
- step 4 impl-review: APPROVED, 0 critical, 0 warnings measured; 0 critical, 0 warnings open
