---
change_id: phase-executors
title: Per-phase executor routing and automated manual checks in the 10x pipeline
status: impl_reviewed
created: 2026-10-30
updated: 2026-10-31
archived_at: null
---

## Notes

Change 3 of 4, split from `rigor-gated-routing` on 2026-10-30. Depends on `rigor-levels`; run after `pre-plan-steps`, because both edit `decide()` in `route.mjs`. Research: `context/changes/rigor-levels/research.md` (section 3, Follow-ups 1-2); after that change is archived, look under `context/archive/*-rigor-levels/`.

Scope:

- Per-phase executor routing: `/10x-e2e` when a phase's rows mention playwright/e2e/browser and E2E setup exists (`test-stack.md` `## E2E` with existing `config` and `seed` paths); `/10x-tdd` for pure-logic phases at `thorough`; `/10x-goal-implement` otherwise, in one call when no phase needs another executor. Prompts tell tdd and e2e to stop after phase N and never pick "Skip".
- A blocked tdd or e2e run falls back to `/10x-goal-implement` without a tier bump.
- Verify implement steps by a new commit or SHA suffix, not only by the `[x]` count, so a skip flip does not count as done.
- The third implement attempt re-plans with the failure note. impl-review REJECTED re-plans.
- Manual Progress rows: a `manual-verify` step before impl-review tries to automate them. It uses Claude-in-Chrome when the orchestrator reports it available (`--chrome`) and it helps, for example to mimic a human. A row it ticks carries an evidence suffix (command output, screenshot or GIF path). Rows it cannot automate stay in `manualPending`.
- Update ADR-003, `SKILL.md` "How the tier moves" and the README routing bullets.
