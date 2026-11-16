# Quote router calls in pipeline skills — Plan Brief

> Full plan: `context/changes/quote-router-in-skill-loops/plan.md`

## What & Why

The skills define script paths safely but show unquoted variables in their commands. Bash splits a spaced plugin path before Node starts. Quote every router, PR-comment and open-PR invocation in both skills and update the tests that currently require the unsafe spelling.

## Starting Point

At `e1d18a0`, each skill contains 12 router invocations and one invocation of each PR script. Setup and Codex-runner calls are already quoted. The three baseline content suites pass 71 tests while preserving the defect; Bash reproduction confirms two script words without quotes and one with quotes.

## Desired End State

All three script variables are quoted at every call, with root selection, chain flags, usage ordering and identical anti-stall rules preserved. Tests reject a single unquoted call and execute representative documented commands using harmless scripts under spaced paths. Separate live evidence establishes installed-plugin behavior for both chains.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Owning layer | Command text in both skills | The shell splits the path before the router can run. | Ticket; Bash reproduction |
| Rewrite overlap | Implement after the Wave 7 rewrite is integrated | It owns both whole skill files; this follow-up is outside the scheduled waves. | WAVES.md; planning assumption |
| Earlier live checks | Require fresh evidence before skill edits | Archived rows 3.5 and 3.6 remain unproved; the ticket requires them first. | Ticket; archived evidence |
| Test scope | Four pinned files, plus regression in skill-loop and its index row | PR-comment has an additional literal assertion; OpenSpec tests moved. | Current source |
| Regression proof | Both-chain quote guard, six isolated mutations and shell fixtures | Content coverage and argument handling are distinct from Claude substitution. | Plan |
| Final host acceptance | Leave two Manual rows pending if unavailable | The ticket allows an explicit acceptance gap, not an invented pass. | Ticket |

## Scope

**In scope:** both SKILL.md files; skill-loop, OpenSpec skill, archive-gate and PR-comment tests; the existing skill-loop test index row; evidence and progress in this active change.

**Out of scope:** router, policy, prompts, rule files, PR-script implementation, Wave 7 compression, versions, WAVES.md, archives, installed-cache changes by this unattended step, or edits to router-owned run state.

## Architecture / Approach

Reuse double quoting already used for PREPARE_RUN and RUN_CODEX. Keep original-root diagnostics distinct from selected-run-root calls. OpenSpec retains its router/open-PR chain flags and PR-comment report path. If the rewrite centralizes late usage, test the shared command and branch references without restoring duplicate paragraphs. Land both skills and their test updates together.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Establish prerequisites and the integration baseline | Integrated rewrite inventory and fresh evidence for both earlier substitution checks | Requires the completed rewrite and a live installed-plugin host |
| 2. Quote the commands and prove the contract | Paired skill fix, non-vacuous assertions, shell regression and final acceptance rows | Stale cache or weakened ordering assertions could conceal a defect |

**Prerequisites:** Phase 2 cannot start until the rewrite is integrated and both Phase 1 live checks are proved. Planning can finish while these remain pending.

**Estimated effort:** one small implementation pass after dependencies clear, plus live host sessions; their availability is not estimated.

## Open Risks & Assumptions

- The current checkout contains the rewrite's change description, not evidence it has completed. Serialization after it is an evidence-backed planning decision; WAVES.md stays untouched.
- The prior live checks remain unproved. Missing evidence blocks implementation before skill edits; record the reason and return blocked rather than bypassing the prerequisite.
- Final spaced-cache acceptance has two separate Manual rows. Shell fixtures, simulated environment variables and `--plugin-dir` cannot tick them.
- No nested agent or installation outside this worktree is authorized in the current step. Live host acceptance must occur separately.
- The full suite and new regression have not run during planning; only the existing 71-test baseline and shell word-splitting reproduction ran.

## Success Criteria (Summary)

- Every targeted call is quoted, with root, chain, usage and anti-stall contracts preserved.
- Updated focused tests, mutation checks, shell fixtures and the complete current suite pass.
- Live evidence proves both installed-plugin prerequisites and both final spaced-cache checks, or the applicable rows remain explicitly pending with their gate enforced.

## References

- `context/changes/quote-router-in-skill-loops/change.md`
- `context/changes/WAVES.md` and `context/changes/skill-md-context-diet/change.md`
- `context/archive/2026-11-12-skill-dir-variable/evidence/unproven.md` and its implementation/plan reviews (read-only)
- Full plan: current paths, source anchors, test commands, manual procedure and canonical Progress.
