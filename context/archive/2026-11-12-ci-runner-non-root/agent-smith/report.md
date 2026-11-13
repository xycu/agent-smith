# Run report: ci-runner-non-root

Goal: Run the CI jobs as a non-root user as ADR-020 requires: the CI jobs on the self-hosted TrueNAS runners run as uid 0 although the ADR lists a non-root service user as a prerequisite. Add the guard in the first step of the test job in ci.yml and align ADR-020 and the tests that pin the workflow, as context/changes/ci-runner-non-root/change.md describes. The runner setup on the NAS hosts is an owner action: leave it as a Manual row and do not claim it done. Done when the suite passes locally and the workflow change is reviewed.
Rigor: standard (goal plain)
Outcome: done - impl review APPROVED

| # | Step | Model | Effort | Tier | Simple | Result | Tokens |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | score | haiku | low | 0 | no | ok (1eb86d0) | 80377 |
| 2 | plan | sonnet | high | 3 | no | ok (7fcb749) | 120201 |
| 3 | plan-review | sonnet | high | 3 | no | ok (4e6caa3) | 104598 |
| 4 | implement | sonnet | medium | 2 | no | ok (4faef75) | 105129 |
| 5 | implement | sonnet | medium | 2 | no | ok (2d7fceb) | 87004 |
| 6 | manual-verify | sonnet | medium | 2 | no | ok (34f7210) | 79545 |
| 7 | manual-verify | sonnet | high | 3 | no | ok (d722073) | 79053 |
| 8 | impl-review | sonnet | high | 3 | no | ok (37b16d7) | 129905 |

Steps: 8 · Tokens: 785812 (figures for 8 of 8 steps)

## Review findings

Counts as recorded when each review step ended; later edits of a review file are not reflected.

- step 3 plan-review: SOUND, 0 critical, 1 warnings measured; 0 critical, 1 warnings open
- step 8 impl-review: APPROVED, 0 critical, 0 warnings measured; 0 critical, 0 warnings open

## Manual checks

Rows as recorded when the last manual-verify step ended. The kind comes from the evidence file name; the router never reads the content. Only browser, test, command or script evidence proves a browser row.

Proved: 1

- 1.9 The workflow change was reviewed: the diff of `ci.yml` shows only the new first step and the header comment line, and the step runs before checkout — judgment (evidence/judgment-ci-diff-review.md)

Not proved: 5

- 2.1 The owner has changed the runner user on every TrueNAS runner host (service user or fresh non-root container) and the work dataset is writable by it — not proved: owner action on TrueNAS hosts; cannot be observed from this worktree
- 2.2 A CI run of a pull request from this repository on the TrueNAS runner passes the uid step, and its log shows a non-root user — not proved: needs a live CI run on the TrueNAS runner; no push or external service allowed
- 2.3 In that run the two privileged-skip tests of `no-recursive-delete.test.mjs` run with a pass mark, and `skipped` is 2 lower than the 10 of run 43134692634 — not proved: needs the same live CI run log
- 2.4 A root runner fails the job: seen in a run before the owner's fix, or by temporarily running one job as root and reading the `::error::` line — not proved: needs a root runner job in CI; cannot be run here
- 2.5 After rows 2.2 and 2.3, the owner (or a later run) ticks row 2.3 of `context/changes/ci-self-hosted-truenas/plan.md` — not proved: owner decision after rows 2.2 and 2.3; edits another change's plan

## Complexity score

Scores: cognitive 3, execution 3 (ambiguity 1, novelty 1, coupling 1, discovery 0, volume 1, verification 2)
Confidence: medium · Unknowns: 4
Source: score step 1

No tier shift.
