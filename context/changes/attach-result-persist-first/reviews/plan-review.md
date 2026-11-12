<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Persist the step result before deleting last-result.json

- **Plan**: context/changes/attach-result-persist-first/plan.md
- **Mode**: Quick (no nested subagent; claims checked by hand against the code and by running the router in scratch projects)
- **Date**: 2026-11-12
- **Verdict**: REVISE
- **Findings**: 1 critical, 1 warning, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | WARNING |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | FAIL |

## Grounding

Grounding: 7/7 paths and line anchors checked (flow.mjs attachResult/neutralRetry, route.mjs next, isolation.mjs stepCommit/rollback, state.mjs isFailure/policyProblems, route.mjs main), 5/5 symbols found, brief and plan agree, Progress rows 1.1-2.4 match the Success Criteria bullets. The fix itself (write the log, then delete the file) is sound and `neutralRetry` already has that order. The test trigger was not: see F1.

## Findings

### F1 — `ladder: []` is halted at load, so both tests cannot work

- **Severity**: CRITICAL
- **Impact**: HIGH — the plan's tests fail before and after the fix
- **Dimension**: Plan Completeness
- **Location**: Key Discoveries bullet 3; Phase 1 items 1 and 2 (Contract); plan-brief.md Key Decisions and Open Risks
- **Detail**: The plan says `policyProblems` does not catch `ladder: []`. It does: `state.mjs:133` returns `policy.ladder must be a non-empty array`, and `main()` halts `init`, `next` and `usage` on it before the run lock or any write (`route.mjs:841-845`, ADR-022). Run in a scratch project, `next` with `ladder: []` halts with `policy.ladder must be a non-empty array (got []) ... Nothing was written.`, which does not start with `Router error`, never reaches `attachResult` and leaves `last-result.json` in place. The `change.md` reproduction predates ADR-022. The tests would fail on the fixed code at the assertion that the file is gone, and so prove nothing. `rigor: { levels: null }` does throw after `attachResult` (`Router error: policy.rigor.levels must be a non-empty array of strings`, from `resolveRigor`). On the unfixed code it leaves the file gone and the log entry without `result`, and a second `next` halts with `Step 1 (plan) has no result`, which is the bug.
- **Fix**: Use `rigor: { levels: null }` as the breaking key in both cases and say why `ladder: []` is not usable.
- **Decision**: APPLIED — Key Discoveries bullet 3, What We're NOT Doing bullet 2, Phase 1 items 1 and 2 (Contract) of plan.md, and the Key Decisions row, Out of scope and Open Risks of plan-brief.md now use `rigor: { levels: null }`. `change.md` (outside the files this run may edit) still names `ladder: []`.

### F2 — "No commit ever holds `last-result.json`" is overstated

- **Severity**: WARNING
- **Impact**: LOW — narrow window, quick decision
- **Dimension**: Blind Spots
- **Location**: Desired End State
- **Detail**: After the move there is a window between `writeLog` and `fs.rmSync(p.result)`. If the process dies or `rmSync` fails in it, the next `next` sees `last.result` set, skips `attachResult` and leaves the file; in an isolated run `stepCommit` then runs `git add -A` and commits it. The two calls are adjacent and synchronous, and the old order lost the whole result in a far wider window, so this is acceptable, but the stated end state is not strictly true.
- **Fix**: State the residual window in the end state and keep the code as planned.
- **Decision**: APPLIED — Desired End State of plan.md now says no commit holds the file in a normal run and names the unhandled window; plan-brief.md Open Risks says the same.

### F3 — Line anchors are off

- **Severity**: OBSERVATION
- **Impact**: LOW — cosmetic
- **Dimension**: Plan Completeness
- **Location**: Current State Analysis bullets 1-2; Key Discoveries bullets 1-2
- **Detail**: `attachResult` spans `flow.mjs:486-558`, not 486-545; the `rmSync` is at 499, not ~501; `last.finishedAt` is line 557; the rollback snapshot is at `isolation.mjs:572`, not ~565.
- **Fix**: Correct the anchors.
- **Decision**: APPLIED — the four anchors in Current State Analysis and Key Discoveries of plan.md are corrected.

### F4 — The `HEAD` assertion of the isolated case cannot fail

- **Severity**: OBSERVATION
- **Impact**: LOW — the assertion is harmless but gives no evidence
- **Dimension**: Lean Execution
- **Location**: Phase 1 item 2 (Contract), last sentence
- **Detail**: The failed advisory `score` entry makes no step commit, so `HEAD` is the start commit and never holds `last-result.json`, on the unfixed code too.
- **Fix**: Say it is a guard, and assert the file is absent from the worktree and from `git ls-files`.
- **Decision**: APPLIED — the last sentence of Phase 1 item 2 (Contract) in plan.md is reworded that way.
