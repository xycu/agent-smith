# Run report: ci-job-and-spawn-timeouts

Goal: Add timeout-minutes: 15 to both CI jobs in ci.yml, and a 120000 ms spawn timeout with a clear failure on res.error to the run and git helpers in skills/10x-pipeline/test/helpers.mjs, so a router process that never returns fails its test within two minutes and no CI job runs longer than 15 minutes. Scope and details in context/changes/ci-job-and-spawn-timeouts/change.md. Done when the suite passes locally and the new tests (run helper timeout, ci-runner.test.mjs timeout-minutes check) pass.
Rigor: standard (goal plain)
Outcome: done - impl review APPROVED

| # | Step | Model | Effort | Tier | Simple | Result | Tokens |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | score | haiku | low | 0 | no | ok (50a949f) | 30706 |
| 2 | plan | sonnet | high | 3 | no | ok (8182102) | 95548 |
| 3 | plan-review | sonnet | high | 3 | no | ok (ebd3ba2) | 105630 |
| 4 | implement | sonnet | medium | 2 | no | ok (1279fe2) | 108012 |
| 5 | manual-verify | sonnet | medium | 2 | no | ok (81ab740) | 67509 |
| 6 | manual-verify | sonnet | high | 3 | no | ok (46e61b1) | 68357 |
| 7 | impl-review | sonnet | high | 3 | no | ok (8a0d017) | 108426 |

Steps: 7 · Tokens: 584188 (figures for 7 of 7 steps)

## Review findings

Counts as recorded when each review step ended; later edits of a review file are not reflected.

- step 3 plan-review: REVISE, 0 critical, 2 warnings measured; 0 critical, 0 warnings open
- step 7 impl-review: APPROVED, 0 critical, 0 warnings measured; 0 critical, 0 warnings open

## Manual checks

Rows as recorded when the last manual-verify step ended. The kind comes from the evidence file name; the router never reads the content. Only browser, test, command or script evidence proves a browser row.

Proved: 0

Not proved: 1

- 2.7 CI is green on the pull request and both jobs carry the 15-minute limit (self-hosted runner, ADR-020; cannot be confirmed from the repository) — not proved: CI green on the pull request is a GitHub result; the run's PR is opened only at the end of the run (open-pr.mjs, ADR-017), so none exists to read, and reading or triggering CI needs an external servic

## Complexity score

Scores: cognitive 4, execution 3 (ambiguity 1, novelty 1, coupling 2, discovery 1, volume 1, verification 1)
Confidence: high · Unknowns: 2
Source: score step 1

No tier shift.
