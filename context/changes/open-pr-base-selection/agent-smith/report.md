# Run report: open-pr-base-selection

Goal: Pick the default branch as PR base when it is as near as any other candidate
Rigor: standard (hot paths skills/10x-pipeline/scripts/open-pr.mjs, skills/10x-pipeline/test/open-pr.test.mjs)
Provider mode: split
Outcome: halt - Step commit of step 4 (impl-review): git add failed: error: '.as-env-victim-vkixNq/local/' does not have a commit checked out | error: unable to index file '.as-env-victim-vkixNq/local/' | fatal: adding files failed. The router's own add was unstaged again. Nothing was committed.

| # | Step | Provider | Model | Effort | Tier | Simple | Result | Tokens |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | plan | openai | gpt-6.2-sol | medium | 2 | yes | ok (51b88a4) | - |
| 2 | plan-review | claude | sonnet | high | 3 | no | ok (d47fce1) | - |
| 3 | implement | openai | gpt-6.2-sol | medium | 2 | yes | ok (77991c4) | - |
| 4 | impl-review | claude | sonnet | high | 3 | no | ok | - |

Steps: 4 · Tokens: - (figures for 0 of 4 steps)

## Token coverage

Verified observed host usage: 0 · Unavailable: 2 · Legacy/unverified scope: 0 · Missing figures: 4
Provider, model and tier groups describe the enclosing dispatch.
- Step 1 plan: unsupported-host — The host version is not qualified for accounting.
- Step 3 implement: unsupported-host — The host version is not qualified for accounting.

## Review findings

Counts as recorded when each review step ended; later edits of a review file are not reflected.

- step 2 plan-review: REVISE, 0 critical, 2 warnings measured; 0 critical, 0 warnings open
- step 4 impl-review: APPROVED, 0 critical, 0 warnings measured
