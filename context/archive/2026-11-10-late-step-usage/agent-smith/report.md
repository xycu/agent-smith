# Run report: late-step-usage

Goal: Fix GitHub issue #71: keep a step's usage figure when its task notification arrives after next ran. Add a route.mjs usage command that attaches a late figure to a logged step on both chains, survives rollback, rewrites report.md for ended runs and lands before the archive subagent; change anti-stall rule 3 in both orchestrator skills to use it; update REFERENCE.md, AGENTS.md and tests
Rigor: standard (goal hard)
Outcome: done - impl review APPROVED
Archive: requested - runs after this report was written; see the commit "chore(archive): close late-step-usage"

| # | Step | Model | Effort | Tier | Simple | Result | Tokens |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | score | haiku | low | 0 | no | ok (c6f6f8c) | - |
| 2 | plan | opus | high | 5 | no | ok (1eb1766) | - |
| 3 | plan-review | sonnet | high | 3 | no | ok (814bf33) | - |
| 4 | implement | sonnet | high | 3 | no | ok (6b78e2f) | 200148 |
| 5 | manual-verify | sonnet | medium | 2 | no | ok (fac9c85) | - |
| 6 | impl-review | opus | high | 5 | no | ok (68a3608) | - |

Steps: 6 · Tokens: 200148 (figures for 1 of 6 steps)

## Review findings

Counts as recorded when each review step ended; later edits of a review file are not reflected.

- step 3 plan-review: SOUND, 0 critical, 1 warnings measured; 0 critical, 0 warnings open
- step 6 impl-review: APPROVED, 0 critical, 1 warnings measured; 0 critical, 0 warnings open

## Manual checks

Rows as recorded when the last manual-verify step ended. The kind comes from the evidence file name; the router never reads the content.

Proved: 2

- 3.3 A read of both `archive` branches shows the `usage` call before the archive subagent launch and states that a later figure is dropped — judgment (evidence/judgment-3-3-archive-branches.md)
- 4.4 `REFERENCE.md`, `AGENTS.md` and ADR-019 describe the same syntax, guards and output as `route.mjs` — judgment (evidence/judgment-4-4-docs-match-router.md)

Not proved: 0

## Complexity score

Scores: cognitive 4, execution 5 (ambiguity 1, novelty 1, coupling 2, discovery 2, volume 2, verification 1)
Confidence: medium · Unknowns: 2
Source: score step 1

No tier shift.
