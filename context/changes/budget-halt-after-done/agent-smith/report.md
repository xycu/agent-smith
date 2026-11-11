# Run report: budget-halt-after-done

Goal: A finished run is reported as halted when it ends exactly on the step budget
Rigor: thorough (hot paths skills/10x-pipeline/scripts/route.mjs, skills/10x-pipeline/test/archive.test.mjs, skills/10x-pipeline/test/route.test.mjs)
Outcome: done - impl review APPROVED

| # | Step | Model | Effort | Tier | Simple | Result | Tokens |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | plan | sonnet | medium | 2 | yes | ok (784a4b9) | 149375 |
| 2 | plan-review | sonnet | high | 3 | no | ok (b7afd7d) | 179650 |
| 3 | implement | sonnet | medium | 2 | yes | ok (52bc02f) | 172101 |
| 4 | manual-verify | sonnet | medium | 2 | no | ok (b8eff2a) | 132682 |
| 5 | impl-review | sonnet | high | 3 | no | ok (9eb2c0a) | 141575 |

Steps: 5 · Tokens: 775383 (figures for 5 of 5 steps)

## Review findings

Counts as recorded when each review step ended; later edits of a review file are not reflected.

- step 2 plan-review: REVISE, 2 critical, 1 warnings measured; 0 critical, 0 warnings open
- step 5 impl-review: APPROVED, 0 critical, 0 warnings measured; 0 critical, 0 warnings open

## Manual checks

Rows as recorded when the last manual-verify step ended. The kind comes from the evidence file name; the router never reads the content. Only browser, test, command or script evidence proves a browser row.

Proved: 2

- 1.4 Issue reproduction (12 logged steps) prints `done` instead of `halt` — test (evidence/test-budget-done.txt)
- 1.5 A 12-step log with a pending step still prints `halt` `Step budget 12 spent.` — test (evidence/test-budget-halt-pending.txt)

Not proved: 0
