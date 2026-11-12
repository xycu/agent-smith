<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Budget Halt After Done

- **Plan**: context/changes/budget-halt-after-done/plan.md
- **Mode**: Deep (done in this subagent, no sub-agent launched per orchestrator note)
- **Date**: 2026-11-11
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Conformance | PASS |
| Correctness | PASS |
| Test Coverage | PASS |
| Pattern Compliance | PASS |
| Scope Discipline | PASS |

## Grounding

Diff `main...HEAD` read in full: `skills/10x-pipeline/scripts/route.mjs`, `docs/REFERENCE.md`, `route.test.mjs`, `archive.test.mjs`, `budget-executors.test.mjs`. Full suite run on the branch: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` gives 986 tests, 984 pass, 0 fail, 2 skipped. Evidence files `evidence/test-budget-done.txt` and `evidence/test-budget-halt-pending.txt` exist.

## Plan conformance

- Router: the early budget check is gone; the same check with the same reason text sits after the `d.halt || d.done` block and before `tierFor`. The `needsHuman` halt still precedes it and the `fails >= maxAttemptsPerStep` halt still follows it. Matches the plan.
- Tests: both new `route.test.mjs` tests match the plan (11 and 12 entries give `done`; a `decide` halt shows its own text, not the budget text). `archive.test.mjs` keeps the budget-halt test on an unticked-row fixture and adds the `archive` assertion for the complete fixture. `budget-executors.test.mjs` changes one assertion line. The confirm-round walk needed no change (suite green).
- Docs: one bullet added under `Budget:` in `docs/REFERENCE.md`. No policy, ADR or `helpers.mjs` change.
- Progress rows 1.1 to 1.5 are ticked, the manual rows with evidence.

## Findings

### F1 — Unused-budget skip entries can now be logged in a run at budget

- **Severity**: 👀 OBSERVATION
- **Dimension**: Correctness
- **Detail**: With the check after `decide`, the skip loop may log a skip entry (pre-plan gate, score, manual-verify) in a run that then halts on the budget. Skips use no budget, and the plan names this in "Implementation Approach". No action needed.
- **Decision**: APPLIED - 10a3aa8 — a logged skip stays handled on resume, so the budget halt now drops the skips of its own call (`route.mjs`) and the resumed run decides them again; test in `preplan.test.mjs`.

### F2 — "Failure path fits" now ends on the fix-loop cap, not the budget

- **Severity**: 👀 OBSERVATION
- **Dimension**: Test Coverage
- **Detail**: The `stacked` walk of `budget-executors.test.mjs` no longer reaches the budget halt text; it keeps its `steps <= budget` assertion, which is the point of the test. The budget halt on a run with a pending step stays covered by `route.test.mjs`, `executors.test.mjs`, `firstattempt.test.mjs`, `score.test.mjs` and the fixed `archive.test.mjs` test.
- **Decision**: APPLIED - 1c93bd3 — the `stacked` walk now asserts `steps === budget` and its comment names the fix-loop halt.
