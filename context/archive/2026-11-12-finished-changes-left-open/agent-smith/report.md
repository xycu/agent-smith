# Run report: finished-changes-left-open

Goal: Report a stale change.md status when a run ends done: the router's done output names the status mismatch and the skills' done branch tells the user, so finished runs no longer show as not started. The housekeeping archive of the finished folders is already done; only the router output and the skill text remain. Scope and details in context/changes/finished-changes-left-open/change.md. Done when the suite passes locally and CI is green.
Rigor: standard (goal plain)
Outcome: done - impl review APPROVED

| # | Step | Model | Effort | Tier | Simple | Result | Tokens |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | score | haiku | low | 0 | no | ok (f2b51a6) | 85316 |
| 2 | plan | sonnet | high | 3 | no | ok (3bdba8c) | 156324 |
| 3 | plan-review | sonnet | high | 3 | no | ok (a58738b) | 136684 |
| 4 | implement | sonnet | medium | 2 | no | ok (b7985ba) | 115634 |
| 5 | manual-verify | sonnet | medium | 2 | no | ok (db73ce3) | 82216 |
| 6 | manual-verify | sonnet | high | 3 | no | ok (a150b4d) | 81055 |
| 7 | impl-review | sonnet | high | 3 | no | ok (7b8bcbe) | 116045 |

Steps: 7 · Tokens: 773274 (figures for 7 of 7 steps)

## Review findings

Counts as recorded when each review step ended; later edits of a review file are not reflected.

- step 3 plan-review: SOUND, 0 critical, 1 warnings measured; 0 critical, 0 warnings open
- step 7 impl-review: APPROVED, 0 critical, 0 warnings measured; 0 critical, 0 warnings open

## Manual checks

Rows as recorded when the last manual-verify step ended. The kind comes from the evidence file name; the router never reads the content. Only browser, test, command or script evidence proves a browser row.

Proved: 2

- 1.5 In a scratch project with a finished 10x run, `init` prints valid JSON with `changeStatus` and no other change to the `done` object — test (evidence/test-done-changestatus.txt)
- 2.5 The diff of `SKILL.md` reads as one coherent `done` branch with the step order unchanged — judgment (evidence/judgment-skill-done-branch.md)

Not proved: 1

- 2.6 CI is green on the pull request of the run branch — not proved: CI on the pull request needs the pushed run branch and a live GitHub check; not available in this unattended step

## Complexity score

Scores: cognitive 4, execution 3 (ambiguity 1, novelty 1, coupling 2, discovery 1, volume 1, verification 1)
Confidence: medium · Unknowns: 2
Source: score step 1

No tier shift.
