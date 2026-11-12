# Run report: pin-action-shas

Goal: Pin the GitHub Actions of ci.yml and release.yml to commit SHAs
Rigor: lean (goal short)
Outcome: done - impl review APPROVED

| # | Step | Model | Effort | Tier | Simple | Result | Tokens |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | plan | sonnet | medium | 2 | yes | ok (474a8b7) | 151037 |
| 2 | implement | sonnet | medium | 2 | no | ok (19db5b0) | 151984 |
| 3 | manual-verify | sonnet | medium | 2 | no | ok (7316e3d) | 131307 |
| 4 | manual-verify | sonnet | high | 3 | no | ok (2c31a84) | 124980 |
| 5 | impl-review | sonnet | medium | 2 | no | ok (c3cc3c6) | 143900 |

Steps: 5 · Tokens: 703208 (figures for 5 of 5 steps) · Skipped: 1

## Skipped steps

| After step | Step | Reason | Rigor |
| --- | --- | --- | --- |
| 1 | plan-review | rigor lean: plan-review skipped (churn window, 3 plan paths, none hot) | lean |

## Review findings

Counts as recorded when each review step ended; later edits of a review file are not reflected.

- step 5 impl-review: APPROVED, 0 critical, 0 warnings measured; 0 critical, 0 warnings open

## Manual checks

Rows as recorded when the last manual-verify step ended. The kind comes from the evidence file name; the router never reads the content. Only browser, test, command or script evidence proves a browser row.

Proved: 2

- 1.4 Reviewer reads the diff: five `uses:` lines changed, nothing else — judgment (evidence/judgment-diff-five-uses-lines.md)
- 2.4 Test failure message names the file and the offending `uses:` line — test (evidence/test-workflow-pins-failure-message.txt)

Not proved: 1

- 1.5 After merge, CI and the next release-please run resolve the actions — not proved: needs a pull request CI run and a post-merge release-please run on GitHub; both are external and not possible from this unattended step (and would push/post)
