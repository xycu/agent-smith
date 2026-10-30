---
change_id: rigor-levels
title: Rigor levels, churn risk and skip logging for the 10x pipeline router
status: implemented
created: 2026-10-30
updated: 2026-10-30
archived_at: null
---

## Notes

Change 1 of 4, split from `rigor-gated-routing` on 2026-10-30. Research for all four changes: `research.md` in this folder (Follow-up 2 holds the decisions and the split). The shared design goes into `docs/ADR/ADR-003`, which this change writes; changes 2-4 extend it.

Scope:

- Per-change rigor level `lean | standard | thorough`, set from the goal class, churn risk paths, phase count, failures and an `--rigor` flag. Rigor only rises during a run and survives `init` on resume. The step budget scales per level.
- Churn risk paths from git history, configured under `risk.churn` in `policy.json` (proposal in research.md, Follow-up 2). Checked against the plan's `**File**:` lines, then against the actual diff.
- `lean` skips plan-review. Elevated risk never runs at `lean` (FR-010). Update PRD FR-002 and roadmap S-03/S-04 to match.
- Effort floor for interactive toolkit skills (plan, plan-review, impl-review, and every later one): effort `high` or above at `standard`/`thorough`, `medium` or above at `lean`.
- Optional `signals` object in the subagent RESULT line, sanitized like `usage`. Unknown keys are ignored. Signals can raise rigor or stop the run (`needsHuman`); they never lower rigor, remove a step or add a skip.
- Skipped steps logged in `run.jsonl` with a reason, with every count kept correct (budget, numbering, failure streaks, freshness, report totals). They are shown in `report.md`.
- Rule format: copy life-to-lore ADR-012 (GIVEN/WHEN/THEN with one bold RFC 2119 keyword) as an agent-smith ADR. Add a `node:test` check for the rule form in `policy.json` prompts and `skills/10x-pipeline/prompts/*.md`.
- Update `SKILL.md` "How the tier moves" and the README routing bullets.

Next: `pre-plan-steps`, then `phase-executors`, then `lesson-candidates`, one after another because all of them edit `decide()` in `route.mjs`. `archive-adapter` needs only this change and may start its research and plan in parallel.

Original scope of `rigor-gated-routing`, kept for reference (decisions in research.md supersede parts of it):

Rigor-gated routing for /agent-smith:10x-pipeline, so optional steps from ADR-002 diagrams 5, 6 and 7 run only when worth their cost. Scope: (1) per-change rigor level lean|standard|thorough from goal class, risk paths, phase count, failures and an --rigor flag; it only rises during a run; step budget scales per level. (2) Step gates in policy.json: rigor threshold plus named `when`/`skipIf` predicates implemented in route.mjs, for research (legacy template when repo-map exists), domain brief (m4l5-2/m4l5-3 prompt), frame, plan-review, impl-review (always runs, lean only lowers tier), archive (opt-in --archive, commits agent-smith/ before /10x-archive because it blocks on a dirty change folder). (3) Optional `signals` object in the subagent RESULT line; unknown keys ignored; signals only add steps or raise rigor. (4) Per-phase executor routing: 10x-e2e when phase rows mention playwright/e2e/browser and E2E setup exists, 10x-tdd for pure-logic phases at thorough, 10x-goal-implement otherwise (one call when no phase needs another executor); a blocked tdd/e2e falls back to goal-implement without a tier bump. (5) Backward loops: RETHINK goes to frame once then re-plan, second RETHINK halts; REVISE twice adds research then re-plans; third implement attempt re-plans with the failure note; impl-review REJECTED re-plans. (6) Frame runs pinned to opus/high. Its prompt carries a decision guide: wherever /10x-frame would ask the user, the subagent resolves the choice from researched best practices (codebase conventions, project docs, lessons.md, authoritative external sources), cites the evidence and states confidence. If it cannot make an evidence-backed call (LOW confidence or no source), it reports blocked with a needsHuman signal and the router halts the run for manual intervention. (7) Lesson candidates from impl-review go to report.md with a ready /10x-lesson command; /10x-lesson does not run unattended. (8) Skipped steps are logged in run.jsonl with a reason and shown in report.md. (9) Document the design as docs/ADR/ADR-003, building on ADR-001 and ADR-002, and update SKILL.md "How the tier moves" and the README routing bullets.
