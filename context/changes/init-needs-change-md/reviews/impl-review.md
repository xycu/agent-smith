<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: init and next write run state for a 10x change that has no change.md

- **Plan**: context/changes/init-needs-change-md/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2
- **Date**: 2026-11-11
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 1 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Other 10x commands still create nothing but are not covered by a test

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: skills/10x-pipeline/test/route.test.mjs:600
- **Detail**: The new test covers `init` and `next`, as planned. `status`, `risk` and `usage` already guard a missing change folder or read only; no gap in behavior, only no regression test that they stay write-free for a missing `change.md`. Out of plan scope.
- **Fix**: None needed now.
- **Decision**: PENDING - outside the plan's scope and no defect; the owner may add a regression test in a later change.

## Verification

- Plan drift: `haltNoChangeMd` in `route.mjs` is called in `next` after `guardArchived` and the OpenSpec check and before `mkdirSync`, and in `init` after `guardArchived` and the OpenSpec block and before `readMeta`, the isolation gate and `mkdirSync`. The text equals `flow.mjs:590`. The OpenSpec chain is unchanged. MATCH.
- Tests: `route.test.mjs` (plain `init`/`next`), `isolation.test.mjs` (no start commit, HEAD unchanged), `archive.test.mjs` suffix-collision (halt is the missing-change one, no `meta.json`). MATCH.
- Docs: `docs/REFERENCE.md` gets the routing bullet and the rewritten Limits bullet without the D8 pointer. MATCH.
- Extra files in the diff: run state, `evidence/`, `plan-brief.md`, `reviews/` and `change.md` of the run itself; no unplanned code change. No lesson in `context/foundation/lessons.md` is violated.
- Manual rows 1.5 and 2.2 have evidence files under `evidence/` that match the claims.
- Automated rows 1.1 to 1.4 and 2.1: the targeted tests pass (`route.test.mjs` 42 of 42, the isolated test, the suffix-collision test) and the full suite `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` ran 986 tests: 984 pass, 0 fail, 2 skipped.
