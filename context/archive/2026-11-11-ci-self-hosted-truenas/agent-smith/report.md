# Run report: ci-self-hosted-truenas

Goal: Run CI (.github/workflows/ci.yml) on self-hosted TrueNAS runner instances instead of GitHub-hosted runners
Rigor: standard (phases 3, signals)
Outcome: halt - Step 9 (implement) needs a human: Owner: set Settings -> Actions -> General -> 'Fork pull request workflows from outside collaborators' to 'Require approval for all external contributors' (the gh read of fork-pr-contributor-approval currently returns first_time_contributors), then re-run so rows 3.5 and 3.6 can complete.

| # | Step | Model | Effort | Tier | Simple | Result | Tokens |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | plan | sonnet | medium | 2 | yes | ok (66cdc1a) | 107434 |
| 2 | plan-review | sonnet | high | 3 | no | ok (7a6bcb4) | 111720 |
| 3 | implement | sonnet | high | 3 | no | ok (bad273d) | 98449 |
| 4 | manual-verify | sonnet | medium | 2 | no | ok (59ae05d) | 79922 |
| 5 | manual-verify | sonnet | high | 3 | no | ok (cc4cee6) | 87095 |
| 6 | impl-review | opus | high | 5 | no | ok (f82088f) | 127756 |
| 7 | plan | opus | xhigh | 6 | no | ok (103e892) | 152583 |
| 8 | plan-review | sonnet | high | 3 | no | ok (d2fbbff) | 135226 |
| 9 | implement | sonnet | high | 3 | no | failed | 84670 |

Steps: 9 · Tokens: 984855 (figures for 9 of 9 steps)

## Review findings

Counts as recorded when each review step ended; later edits of a review file are not reflected.

- step 2 plan-review: REVISE, 1 critical, 2 warnings measured; 0 critical, 0 warnings open
- step 6 impl-review: REJECTED, 1 critical, 0 warnings measured; 1 critical, 0 warnings open
- step 8 plan-review: SOUND, 0 critical, 1 warnings measured; 0 critical, 0 warnings open

## Manual checks

Rows as recorded when the last manual-verify step ended. The kind comes from the evidence file name; the router never reads the content. Only browser, test, command or script evidence proves a browser row.

Proved: 0

Not proved: 4

- 2.3 The ADR prerequisites match what the owner's TrueNAS runners actually provide — not proved: read-only 'gh api repos/xycu/agent-smith/actions/runners' confirms 6 online Linux X64 runners (runner version 2.338.1, at or above the ADR's 2.327.1; labels self-hosted, Linux, X64, truenas), but Node
- 3.2 A pull request from this repository runs both CI jobs on the TrueNAS runner and both pass — not proved: needs a pull request run of this change's ci.yml on the TrueNAS runner; the change is unmerged and has no PR, and opening or pushing is an external action
- 3.3 A push to `main` after the merge runs the `test` job on the TrueNAS runner and it passes — not proved: needs a push to main after the merge and its CI run; external and not yet possible
- 3.4 If a fork pull request is available, its jobs run on a GitHub-hosted runner — not proved: needs a fork pull request run on GitHub; external and none available

## Lesson candidates

Candidates from the implementation review. Run a command yourself; the pipeline never runs `/10x-lesson`.

- `/10x-lesson Always verify a security prerequisite that lives in a repository setting with a read-only API call before marking the change ready, never only by stating it in an ADR.` (step 6)
