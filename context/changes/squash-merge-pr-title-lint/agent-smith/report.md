# Run report: squash-merge-pr-title-lint

Goal: -
Rigor: standard (goal plain)
Outcome: done - impl review NEEDS ATTENTION
Archive: requested - runs after this report was written; see the commit "chore(archive): close squash-merge-pr-title-lint"
Manual checks pending: 4
- 5.1 A bad PR title gives a red `PR title` check that does not block the merge, and fixing the title turns the new run green
- 5.2 A title edit does not cancel the running `test` job and starts no second `test` run
- 5.3 The title of this PR is conventional before the squash merge
- 5.4 After the squash merge, the subject and body on `main` are read and any difference from the documented shape is recorded in Amendment 2
Manual checks not proved: 4
- 5.1 A bad PR title gives a red `PR title` check that does not block the merge, and fixing the title turns the new run green — not proved: needs a live GitHub pull request and check run; 'gh pr list --head agent-smith/squash-merge-pr-title-lint --state all' returns [] (no PR yet); opening or editing a PR is external
- 5.2 A title edit does not cancel the running `test` job and starts no second `test` run — not proved: needs live GitHub Actions runs on a PR; no PR exists yet
- 5.3 The title of this PR is conventional before the squash merge — not proved: no PR exists yet, so there is no PR title to read
- 5.4 After the squash merge, the subject and body on `main` are read and any difference from the documented shape is recorded in Amendment 2 — not proved: needs the squash merge on main to happen first

| # | Step | Model | Effort | Tier | Simple | Result | Tokens |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | score | haiku | low | 0 | no | ok (b080b5f) | 79415 |
| 2 | plan | sonnet | high | 3 | no | ok (4c46c3d) | 144556 |
| 3 | plan-review | sonnet | high | 3 | no | ok (f6ac13e) | 113492 |
| 4 | implement | sonnet | high | 3 | no | ok (148dcc2) | 160006 |
| 5 | manual-verify | sonnet | medium | 2 | no | ok (460673b) | 77137 |
| 6 | manual-verify | sonnet | high | 3 | no | ok (9670da6) | 69100 |
| 7 | impl-review | opus | high | 5 | no | ok (5646948) | - |

Steps: 7 · Tokens: 643706 (figures for 6 of 7 steps)

## Review findings

Counts as recorded when each review step ended; later edits of a review file are not reflected.

- step 3 plan-review: REVISE, 0 critical, 2 warnings measured; 0 critical, 0 warnings open
- step 7 impl-review: NEEDS ATTENTION, 0 critical, 2 warnings measured; 0 critical, 0 warnings open

## Manual checks

Rows as recorded when the last manual-verify step ended. The kind comes from the evidence file name; the router never reads the content. Only browser, test, command or script evidence proves a browser row.

Proved: 5

- 1.4 The header comment of `tools/commit-lint.mjs` no longer says the repository rebase-merges — judgment (evidence/judgment-phase1-4-docs.md)
- 2.5 `pr-title.yml` reads correctly end to end and `ci.yml` changed only in its header comment — judgment (evidence/judgment-phase1-4-docs.md)
- 3.4 ADR-017 Decision step 5 points at Amendment 1, and the Amendment states the fallback and the set-once rule — judgment (evidence/judgment-phase1-4-docs.md)
- 4.5 ADR-008 reads consistently: Amendment 2 exists, the five old sentences point at it — judgment (evidence/judgment-phase1-4-docs.md)
- 4.6 AGENTS.md Commits section reads correctly and states both checks are advisory — judgment (evidence/judgment-phase1-4-docs.md)

Not proved: 4

- 5.1 A bad PR title gives a red `PR title` check that does not block the merge, and fixing the title turns the new run green — not proved: needs a live GitHub pull request and check run; 'gh pr list --head agent-smith/squash-merge-pr-title-lint --state all' returns [] (no PR yet); opening or editing a PR is external
- 5.2 A title edit does not cancel the running `test` job and starts no second `test` run — not proved: needs live GitHub Actions runs on a PR; no PR exists yet
- 5.3 The title of this PR is conventional before the squash merge — not proved: no PR exists yet, so there is no PR title to read
- 5.4 After the squash merge, the subject and body on `main` are read and any difference from the documented shape is recorded in Amendment 2 — not proved: needs the squash merge on main to happen first

## Complexity score

Scores: cognitive 5, execution 6 (ambiguity 2, novelty 1, coupling 2, discovery 2, volume 2, verification 2)
Confidence: medium · Unknowns: 4
Source: score step 1

No tier shift.

## Lesson candidates

Candidates from the implementation review. Run a command yourself; the pipeline never runs `/10x-lesson`.

- `/10x-lesson Always grep every doc, including docs/REFERENCE.md, for the old behavior when a change alters a script's output, not only the files the plan lists.` (step 7)
