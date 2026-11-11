<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Budget Halt After Done Implementation Plan

- **Plan**: context/changes/budget-halt-after-done/plan.md
- **Mode**: Deep (done in this subagent, no sub-agent launched per orchestrator note)
- **Date**: 2026-11-11
- **Verdict**: REVISE
- **Findings**: 2 critical, 1 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | FAIL |
| Plan Completeness | WARNING |

## Grounding

Grounding: paths and symbols checked ✓ (`route.mjs:112-115` budget check, decide loop, `d.done`/`d.halt` block, `budgetSteps` state.mjs:393, `decide` flow.mjs:580, fix-loop cap flow.mjs:720, helpers `entry`/`writeLog`/`planText`/`writeReview`), brief↔plan ✓, Progress↔Phase rows ✓ (5 rows, one heading). Existing budget tests were checked against the planned move by applying it to a scratch copy of the repo (outside the worktree) and running them. Two tests fail: `archive.test.mjs` "an ordinary halt of an archive run carries archive and committed" (`actual: 'archive'`, `expected: 'halt'`) and `budget-executors.test.mjs` "failure path fits" (`actual: 'Implementation still NEEDS ATTENTION after 2 fix loops. Needs a human.'`, `expected: /Step budget \d+ spent/`). The other tests the plan names (`route`, `executors`, `firstattempt`, `score`) leave a step pending and keep the budget halt; the full suite was still running when the review was written, so the confirm-round walk of `budget-executors.test.mjs` is unchecked.

## Findings

### F1 — The archive budget-halt test is not a pending-step test and would fail

- **Severity**: 🔴 CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Key Discoveries, last bullet; Phase 1 (no test change listed for `archive.test.mjs`)
- **Detail**: The plan says `archive.test.mjs:848` leaves a step pending. Its `archiveProject` is a complete run (all rows ticked, `SOUND` and `APPROVED` reviews, a 4-step log) with `maxTotalSteps: 1`. After the move `decide` returns `done` and the run reaches the `archive` action, so the test fails and the plan's "full suite passes" criterion (1.2) cannot be met as written.
- **Fix**: Add a change that fixes that test's fixture (leave a step to run) and adds one assertion that the complete fixture now archives at the budget.
- **Decision**: APPLIED — Key Discoveries last bullet; Phase 1, new change 3 "Archive test fixture"; Testing Strategy.

### F2 — The stacked budget test now ends in the fix-loop halt

- **Severity**: 🔴 CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Key Discoveries, last bullet (it lists `budget-executors.test.mjs` as leaving a step pending)
- **Detail**: The `stacked` walk of "failure path fits" ends with a `NEEDS ATTENTION` review after 2 fix loops while the budget is spent. `decide` now answers first with `Implementation still NEEDS ATTENTION after 2 fix loops. Needs a human.`, so its `Step budget \d+ spent` assertion fails. The confirm-round walk (line ~460) accepts only `done` or the budget text and may end the same way.
- **Fix**: Add the assertion change to the plan's test work and tell the implementer to run the whole suite for other such assertions.
- **Decision**: APPLIED — Key Discoveries last bullet; Phase 1, change 3 (budget-executors part).

### F3 — The "decide halt is not masked" test names no halt

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — 2. Test, Intent
- **Detail**: The Intent says "a decide halt is not masked by the budget text" without a reachable fixture. An implementer would have to find one. The fix-loop cap halt (`Implementation still NEEDS ATTENTION after 2 fix loops`, flow.mjs:720) is reachable with a header-only `NEEDS ATTENTION` review and two `fix` entries in a 12-entry log.
- **Fix**: Name that fixture and the expected reason in the Intent; split the test into the `done` case and the halt case.
- **Decision**: APPLIED — Phase 1, 2. Test, Intent.

### F4 — Archive and OpenSpec consequences are not stated

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Implementation Approach; Phase 1 — 4. Docs
- **Detail**: A complete `--archive` run over budget now makes the pre-archive commit and returns `archive`, and the OpenSpec chain shares the code path. Both are intended (the issue's "If we skip it" names the archive case) but the plan and the docs bullet do not say so. The order of the budget halt and the `fails >= maxAttemptsPerStep` halt after `tierFor` is unchanged, which is also worth one line.
- **Fix**: Add both to Implementation Approach and to the docs bullet.
- **Decision**: APPLIED — Implementation Approach; Phase 1, 4. Docs, Intent.

### F5 — Plan brief scope line out of step with the plan

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: plan-brief.md, Scope
- **Detail**: The brief said one regression test; the plan now has two tests and a fixture fix.
- **Fix**: Update the brief's in-scope line.
- **Decision**: APPLIED — plan-brief.md, Scope (in scope).
