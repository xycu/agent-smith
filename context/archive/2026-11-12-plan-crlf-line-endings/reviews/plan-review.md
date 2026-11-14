<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Plan CRLF Line Endings Implementation Plan

- **Plan**: context/changes/plan-crlf-line-endings/plan.md
- **Mode**: Deep (done inline, no sub-agent: nested subagents are banned in this run)
- **Date**: 2026-11-12
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

Grounding: 7/7 paths checked (state.mjs, steps.mjs, executors.test.mjs, file-guard.test.mjs, helpers.mjs, phase-helpers.mjs, ahead.mjs) exist, 6/6 symbols found (`readPlan` state.mjs:210, `planFileTokens` :719, `planPaths` :727, `phaseFiles` steps.mjs:132, `"phase files reader"` test, `createdValue` isolation.mjs:169), brief and plan agree. Line numbers drift by a few lines from the plan (`planPaths` at 727 not 730; `readPlan` split at 221); the plan marks them approximate. The audit of other `split("\n")` sites holds: state.mjs:270 (`readFindings`), :447 (`readLog`), :677 (`churnCounts`), :786 (diff hits) and openspec.mjs:26 (`TASK_ROW`, no `$`) are tolerant. Progress and phase blocks are consistent (2 phases, 7 rows, one `## Progress`).

## Findings

### F1 — "New tests fail on the old code" cannot be observed in the phase order

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Phase 2 — Success Criteria, Automated Verification (row 2.1)
- **Detail**: Phase 1 lands the fix before Phase 2 writes the tests, so by the time the tests exist the old code is gone. The criterion lists only the command that passes on the fix, with no way to see the failure. The obvious way to prove it (revert the fix) is a `git checkout -- <path>` or `git stash` of work, which AGENTS.md forbids.
- **Fix**: Name a safe check: run the two test files in a scratch git worktree at the commit before the Phase 1 step commit (`git worktree add`), copy the test files in, expect failures, delete the copies, `git worktree remove`.
  - Strength: Uses only operations AGENTS.md allows; leaves the run worktree untouched.
  - Tradeoff: A few extra commands in the verification step.
  - Confidence: HIGH — worktrees and `git worktree add` are named as allowed in AGENTS.md.
  - Blind spot: None significant.
- **Decision**: APPLIED — added a "Fail on the old code" bullet to Phase 2, Success Criteria, Automated Verification.

### F2 — Test build details the implementer would have to discover

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 — `crlf-plan.test.mjs` contract
- **Detail**: Three facts decide whether the tests work. `planText` and `buildPlan` never write a bare `### Phase 2` heading, which the contract needs. `dryRunRepo` and `risk` are local to `churn.test.mjs` and not exported. A review file written as a step output needs the `ahead.mjs` wrappers (`writePlan`, `writeReview`), per AGENTS.md, or the `init` resume test is flaky on Linux CI.
- **Fix**: Add a short build note under the contract naming these three points.
- **Decision**: APPLIED — added a "Build notes" paragraph to Phase 2, Changes Required, section 1.

### F3 — Grep criterion has no pass or fail result

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — Success Criteria, Automated Verification (row 1.2)
- **Detail**: The `grep -n` command only prints lines; it exits 0 when `steps.mjs` still holds a `split("\n")`, so a script cannot judge it. Today `state.mjs` holds 6 such lines and the plan removes 2, leaving 4.
- **Fix**: Replace with `[ "$(grep -c 'split("\\n")' state.mjs)" = 4 ] && ! grep -n 'split("\\n")' steps.mjs`.
- **Decision**: APPLIED — replaced the command in Phase 1, Success Criteria, Automated Verification.
