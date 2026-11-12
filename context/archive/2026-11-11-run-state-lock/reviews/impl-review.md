<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Run-state lock

- **Plan**: context/changes/run-state-lock/plan.md
- **Date**: 2026-11-11
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 1 warnings, 1 observation

## Plan compliance

- Phase 1: `runLockPath` and `acquireRunLock` in `skills/10x-pipeline/scripts/state.mjs` (temp file plus `linkSync`, `EEXIST` read of the pid, `EPERM` counts as alive, unparsable or dead pid replaced once, release on `exit`); one call in `main()` of `route.mjs` after the reserved-name check for `init`, `next`, `usage`. Built-ins only, `state.mjs` still imports no router module. Matches the plan.
- Tests cases (a) to (f) of `run-lock.test.mjs` exist and pass (7 tests).
- Phase 2: one bullet each in the two sections of `docs/REFERENCE.md` with the limits the plan names; `AGENTS.md` lists `acquireRunLock`, `runLockPath` and the new test file. Halt text in the docs equals the code. SKILL.md files unchanged, as planned.
- No scope creep: read-only commands take no lock, no wait, no ADR.

## Findings

### F1 — Lock tests leave a scratch folder in the temp directory per test

- **Severity**: ⚠️ WARNING
- **Dimension**: Test hygiene
- **Location**: `skills/10x-pipeline/test/run-lock.test.mjs`, `setup()`
- **Detail**: `setup()` makes a `lock-*` directory with `fs.mkdtempSync` for `TMPDIR`, and nothing removes it. `cleanupAll` only removes the folders `makeProject` registered. Every run of the suite leaves about seven folders in `os.tmpdir()` (56 were found).
- **Fix**: Collect the folders in `setup()` and remove them in `after` with `removeTree` (ADR-016).
- **Decision**: APPLIED - 8a5c803 (fix(run-state-lock): remove the lock test scratch folders)

### F2 — `release` in `acquireRunLock` is hard to read

- **Severity**: 💡 OBSERVATION
- **Dimension**: Maintainability
- **Location**: `skills/10x-pipeline/scripts/state.mjs`, `release`
- **Detail**: One loop over `[tmp, lock]` with an inline `f === tmp ||` ownership test does two jobs. It works (the lock is removed only when it still holds this process's pid). Not worth a change now.
- **Decision**: APPLIED - cde8deb (refactor(run-state-lock): split the lock release into two named steps)

## Notes

- Known limits are documented in `docs/REFERENCE.md` (different `TMPDIR`, simultaneous stale takeover, killed process, pid reuse; signals do not fire `exit`).
