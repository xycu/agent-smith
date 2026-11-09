# Run report: split-route-mjs

Goal: Split route.mjs into state.mjs, preplan.mjs, steps.mjs, flow.mjs and isolation.mjs plus the entry, with no behavior change, following the steps in research.md
Rigor: thorough (phases 7)
Outcome: done - impl review APPROVED
Archive: requested - runs after this report was written; see the commit "chore(archive): close split-route-mjs"

| # | Step | Model | Effort | Tier | Simple | Result | Tokens |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | plan | sonnet | medium | 2 | yes | ok (3075782) | 145829 |
| 2 | plan-review | opus | high | 5 | no | ok (d6a4f80) | 154062 |
| 3 | implement | opus | high | 5 | no | ok (8b39a5f) | 217169 |
| 4 | manual-verify | sonnet | medium | 2 | no | ok (c67d983) | - |
| 5 | impl-review | opus | high | 5 | no | ok (3457fb1) | - |

Steps: 5 · Tokens: 517060 (figures for 3 of 5 steps)

## Review findings

Counts as recorded when each review step ended; later edits of a review file are not reflected.

- step 2 plan-review: REVISE, 0 critical, 3 warnings measured; 0 critical, 1 warnings open
- step 5 impl-review: APPROVED, 0 critical, 0 warnings measured; 0 critical, 0 warnings open

## Manual checks

Rows as recorded when the last manual-verify step ended. The kind comes from the evidence file name; the router never reads the content.

Proved: 4

- 1.4 Commit is `test:` or `refactor:` with a Conventional Commit subject and touches only `pr-comment.test.mjs` — judgment (evidence/judgment-1-4-commit.txt)
- 7.4 Read the AGENTS.md diff: wording accurate, ADRs and `docs/REFERENCE.md` untouched — judgment (evidence/judgment-7-4-agents-diff.txt)
- 2.5 `init` and `status` against a scratch change folder print valid JSON — command (evidence/command-2-5-init-status.txt)
- 6.6 `init` then `status` in a scratch change folder print valid JSON; `rollback.test.mjs` undo case passes — test (evidence/test-6-6-rollback.txt)

Not proved: 0
