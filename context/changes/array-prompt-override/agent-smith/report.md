# Run report: array-prompt-override

Goal: An array-form archive prompt or suffix override breaks the run
Rigor: thorough (hot paths skills/10x-pipeline/scripts/route.mjs, skills/10x-pipeline/test/archive.test.mjs, skills/10x-pipeline/test/route.test.mjs)
Outcome: done - impl review APPROVED

| # | Step | Model | Effort | Tier | Simple | Result | Tokens |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | plan | sonnet | medium | 2 | yes | ok (ebcc03f) | 157328 |
| 2 | plan-review | sonnet | high | 3 | no | ok (bb02ead) | 140810 |
| 3 | implement | sonnet | medium | 2 | yes | ok (17067bb) | 177193 |
| 4 | manual-verify | sonnet | medium | 2 | no | ok (2aa16d5) | 132904 |
| 5 | impl-review | sonnet | high | 3 | no | ok (010e3b7) | 157700 |

Steps: 5 · Tokens: 765935 (figures for 5 of 5 steps)

## Review findings

Counts as recorded when each review step ended; later edits of a review file are not reflected.

- step 2 plan-review: SOUND, 0 critical, 1 warnings measured; 0 critical, 0 warnings open
- step 5 impl-review: APPROVED, 0 critical, 0 warnings measured; 0 critical, 0 warnings open

## Manual checks

Rows as recorded when the last manual-verify step ended. The kind comes from the evidence file name; the router never reads the content. Only browser, test, command or script evidence proves a browser row.

Proved: 1

- 1.5 In a scratch project with an array `suffix` override, `route.mjs next` prints a prompt whose suffix lines are newline-separated — script (evidence/script-array-suffix-output.txt)

Not proved: 0
