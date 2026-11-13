<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Share one fallback for the churn exclude globs

- **Plan**: context/changes/shared-churn-excludes/plan.md
- **Mode**: Deep (claims verified by hand against the code; no sub-agent, the run is itself a subagent)
- **Date**: 2026-11-13
- **Verdict**: SOUND
- **Findings**: 0 critical, 1 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS |
| Plan Completeness | WARNING |

## Grounding

Grounding: 4/4 paths ✓ (state.mjs, steps.mjs, executors.test.mjs, policy.json), symbols ✓ (`churnConfig` state.mjs:655, `evidenceExcludes` steps.mjs:37, `globToRegex` still used at steps.mjs:157, `SKILL_DIR`/`readJson` only at steps.mjs:4 and :40, `path` used elsewhere), brief↔plan ✓. Progress↔Phase ✓ (rows 1.1 to 1.6 match the criteria). No `docs/reference/contract-surfaces.md`. Lessons: none apply.

## Findings

### F1 — Second assertion of the regression test cannot reuse the same project

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1, change 3 (Regression test, Contract)
- **Detail**: The contract asks for a second commit of `src/real.mjs` "in the same test" asserting `ok === true`. `finish(project)` writes the result and runs `next`, which finishes the pending `implement` entry (`readLogEntries(project)[2]`). A second `finish` on the same project has no pending entry, so the "path specific" assertion would be meaningless or fail. Neighbouring tests use one `strictProject` per assertion.
- **Fix**: Build a second `strictProject` with the same policy for the `src/real.mjs` case.
- **Decision**: APPLIED — plan.md, Phase 1, change 3 "Regression test", Contract: the second half now uses a second `strictProject`.

### F2 — "Fails on the pre-change code" is not proven by the row 1.1 command

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1, change 3; Progress row 1.1
- **Detail**: Row 1.1 says the test "fails on the pre-change code" but its command only runs the file on the final code. The red state is never checked unless the implementer runs the test before the source edits. The Progress row text must stay unchanged.
- **Fix**: State in the test contract that the test is written and run red first.
- **Decision**: APPLIED — plan.md, Phase 1, change 3 "Regression test", Contract: "Write this test first and run it red ... row 1.1's command only shows green."

### F3 — Current State miscounts the callers of churnConfig

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Current State Analysis, fourth bullet
- **Detail**: The plan says `churnConfig` has "two other callers inside state.mjs (`hotSet`, line 689)". Grep over `scripts/*.mjs` finds one: `hotSet` at state.mjs:689. `evidenceExcludes` is the other, in steps.mjs, and it goes away.
- **Fix**: Correct the sentence to one other caller.
- **Decision**: APPLIED — plan.md, Current State Analysis, fourth bullet.
