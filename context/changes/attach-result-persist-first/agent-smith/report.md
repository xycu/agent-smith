# Run report: attach-result-persist-first

Goal: Persist the step result in run.jsonl before deleting last-result.json: attachResult in flow.mjs must write the log entry to disk before it removes the result file, so a router error between attachResult and the next writeLog loses nothing. Add a regression test for the failing case in context/changes/attach-result-persist-first/change.md. Done when the suite passes locally and CI is green.
Rigor: standard (goal plain)
Outcome: done - impl review APPROVED

| # | Step | Model | Effort | Tier | Simple | Result | Tokens |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | score | haiku | low | 0 | no | ok (72dff17) | 32872 |
| 2 | plan | sonnet | high | 3 | no | ok (d0e5b26) | 126449 |
| 3 | plan-review | sonnet | high | 3 | no | ok (5008913) | 115087 |
| 4 | implement | sonnet | medium | 2 | no | ok (436789a) | 105287 |
| 5 | manual-verify | sonnet | medium | 2 | no | ok (51efe1b) | 81725 |
| 6 | manual-verify | sonnet | high | 3 | no | ok (1245b9f) | 78589 |
| 7 | impl-review | sonnet | high | 3 | no | ok (2df7b8f) | 107753 |

Steps: 7 · Tokens: 647762 (figures for 7 of 7 steps)

## Review findings

Counts as recorded when each review step ended; later edits of a review file are not reflected.

- step 3 plan-review: REVISE, 1 critical, 1 warnings measured; 0 critical, 0 warnings open
- step 7 impl-review: APPROVED, 0 critical, 0 warnings measured; 0 critical, 0 warnings open

## Manual checks

Rows as recorded when the last manual-verify step ended. The kind comes from the evidence file name; the router never reads the content. Only browser, test, command or script evidence proves a browser row.

Proved: 1

- 1.2 The two tests read as the `change.md` reproduction and the isolated variant — judgment (evidence/judgment-tests-read-as-reproduction.md)

Not proved: 1

- 2.4 The pull request of the run branch shows CI green — not proved: needs the pull request of the run branch; the router pushes and opens it only at the end of the run, and pushing/gh are not allowed here

## Complexity score

Scores: cognitive 3, execution 2 (ambiguity 1, novelty 1, coupling 1, discovery 0, volume 1, verification 1)
Confidence: high · Unknowns: 0
Source: score step 1

No tier shift.
