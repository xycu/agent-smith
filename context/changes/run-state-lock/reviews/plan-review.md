<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Run-state lock Implementation Plan

- **Plan**: context/changes/run-state-lock/plan.md
- **Mode**: Deep (done inline, no sub-agent: nested subagents are banned in this run)
- **Date**: 2026-11-11
- **Verdict**: REVISE
- **Findings**: 0 critical, 2 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

Grounding: 7/7 paths and symbols checked (`state.mjs:373` writeLog, `route.mjs:688` usageCommand, `route.mjs:806` main, `SKILL.md:87` rule 3, `halt`/`out` via `process.exit`, `helpers.mjs` `run` merges `env` over `process.env`, `state.mjs` imports no router module) ✓, Progress↔Phase rows match ✓, brief↔plan ✓. Lessons in `context/foundation/lessons.md` checked; none applies. Contract-surfaces file absent, skipped.

## Findings

### F1 — Empty or fresh lock file is read as stale, so a live lock can be stolen

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Implementation Approach; Phase 1 change 1 (lock helper) and 3 (tests)
- **Detail**: The plan creates the lock with `openSync(path, "wx")` and then writes the pid, and treats an unreadable lock as stale ("content is unreadable, unlink and retry"). Between the create and the write, the file is empty. A second caller that hits `EEXIST` in that window reads nothing, calls the lock stale, unlinks it and takes it. Both calls then run, which is exactly the lost-write the change exists to stop. No test in the plan covers it.
- **Fix**: Write the pid to a private temp file and `fs.linkSync` it to the lock path (atomic, `EEXIST` when held, pid already inside), unlink the temp file; treat `EPERM` from `process.kill(pid, 0)` as alive; add a test case that a lock is never observable without its pid.
  - Strength: Removes the window with built-ins only (ADR-006), no timing constant.
  - Tradeoff: A few more lines than the issue's "about 10".
  - Confidence: HIGH — `link` fails on an existing target on all platforms the router supports.
  - Blind spot: A file system without hard links (rare for a temp dir).
- **Decision**: APPLIED — Plan changed: Implementation Approach (temp file plus `linkSync`, `EPERM` as alive), Phase 1 change 3 test case (f); `plan-brief.md` Key Decisions row "Acquire" updated.

### F2 — Manual check 1.4 depends on timing

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 Manual Verification 1.4; Testing Strategy, Manual Testing Steps
- **Detail**: "Two parallel `next` calls: one succeeds, the other halts" cannot be relied on: `next` ends in milliseconds, so the second call may start after the first has released the lock and simply runs as the next step. The check can fail, or pass without proving the lock, on timing alone. The automated pre-held-lock tests are the real proof.
- **Fix**: In Manual Testing Steps, pre-hold the lock with a live pid and run `next`; then remove the lock by hand and confirm `next` runs.
- **Decision**: APPLIED — Plan changed: Testing Strategy, Manual Testing Steps (Progress row 1.4 left as it is).

### F3 — Known limits of the lock are not documented

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2 — Docs
- **Detail**: The key follows `os.tmpdir()`, so callers with different `TMPDIR` (for example one sandboxed call and one unsandboxed) do not exclude each other. Two callers that both find a stale lock can both take it. A killed process leaves its file until the next call, and a reused pid keeps a stale lock alive. None of this is wrong for a best-effort guard, but REFERENCE.md should say so rather than imply full exclusion.
- **Fix**: Add the four limits to the REFERENCE.md bullets of Phase 2.
- **Decision**: APPLIED — Plan changed: Phase 2, change 1 contract (limits added to the REFERENCE.md bullets).
