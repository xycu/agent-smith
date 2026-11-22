<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Recovering from a failed re-plan

- **Plan**: context/changes/replan-failure-halt-recoverable/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1
- **Date**: 2026-11-22
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Evidence

- Reviewed by reading the diff of `2ef962c6..HEAD` against the plan (no sub-agents; the change is 3 router files, 2 test files, 2 docs). All Progress rows 1.1 to 1.4 are `[x]` with commit `d22c149b`.
- Automated criteria: the full suite (`node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`) on the code as reviewed: 2203 tests, 2200 pass, 0 fail, 3 skipped. After the F1 fix I ran only the focused files (`codereplan.test.mjs`, `rollback.test.mjs`: 47 tests, 47 pass). I did not rerun the full suite after the fix, on the coordinator's instruction; CI runs it.
- Contract check: `replanAck` and `planBaseline` are additive fields on the failed entry, set in `route.mjs` `next()` before `rollback()`; the recovery helper `replanRecoveryProblem` lives in `flow.mjs`; the old unconditional halt in `decide()` is removed; the gate applies only to a failed 10x `plan-replan` as last executed entry; an unchanged plan fails even when valid; the legacy path needs a numeric `finishedAt`, an old-prefix `meta.outcome` read at the start of the call, and `mtime` strictly later; `LEGACY_REPLAN_HALT_PREFIX` is one shared constant used by the matcher and the fixtures. The rollback is skipped only on recovery, and `kept` already stops a second rollback on a repeat halt.
- Docs: `docs/REFERENCE.md` and ADR-003 describe the exit. A grep of `docs`, `skills`, `README.md`, `agents` and `tools` found no other text that states the old permanent halt, except the decision table row in F2.

## Findings

### F1 — A missing plan with an absent-file baseline reads as "content is unchanged"

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: skills/10x-pipeline/scripts/flow.mjs:757
- **Detail**: When the failed re-plan left no `plan.md`, the baseline is `null`. A resume with the plan still missing compared `null === null` before the missing-file check, so the halt said "plan.md content is unchanged." The plan asks the guidance to name the current failure, such as a missing plan. Behavior was safe (still a halt with repair instructions) but the reason was less specific.
- **Fix**: Check `!plan.exists` before the baseline comparison, and update the one test assertion that expected the old text.
- **Decision**: APPLIED — commit 7e45f710 (`fix(replan-failure-halt-recoverable): name a missing plan before unchanged content`).

### F2 — ADR-003 decision table row 6 still says only "a halt follows a failed plan-replan"

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: docs/ADR/ADR-003-rigor-gated-routing.md:406
- **Detail**: The row is a record of the original decision and stays true (the run still halts). The new paragraph under the code re-plan section at line 352 already names the exit, so a reader of the section is told. Whether the decision table should also point to the exit is an owner choice about how the ADR history is kept.
- **Fix**: Optionally append "(recoverable, see the note under Code re-plans)" to the row.
- **Decision**: PENDING — not a defect and outside the plan's file contract; the owner decides whether ADR decision rows are amended or left as history.
