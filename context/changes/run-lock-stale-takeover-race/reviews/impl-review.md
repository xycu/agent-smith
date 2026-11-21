<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Exclusive stale run-lock takeover

- **Plan**: context/changes/run-lock-stale-takeover-race/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2
- **Date**: 2026-11-21
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 1 observation

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

- Plan files against the diff (`git diff main...HEAD`): `skills/10x-pipeline/scripts/run-lock.mjs`, `docs/REFERENCE.md`, `skills/10x-pipeline/test/run-lock.test.mjs`, `skills/10x-pipeline/test/run-lock-worker.mjs` and `skills/10x-pipeline/test/README.md` all changed as planned. Nothing planned is missing. No production file outside the plan changed. `context/changes/WAVES.md` shows in the range only because the local `main` is one commit behind (`52f6a179`); this change did not touch it.
- `run-lock.mjs`: `busyReason` is one classifier, used before the guard (`:123`) and again under it (`:102`). Native locks and live-group execution locks halt before any guard is taken. The guard `${lock}.takeover` is linked from the same temp file, so it holds the pid. `removeGuard` runs in the takeover `finally` and in `release()`, and it deletes the guard only while the guard holds this pid. A guard that vanishes or cannot be read is retried at once. A readable dead holder halts with removal advice and is never auto-removed. A live holder is polled every 20 ms with `Atomics.wait` for at most 1 s. A failed link with `EEXIST` under the guard returns to the loop, where the new owner is classified. The retry bound is 10 attempts, and then the `EEXIST` error is rethrown. Lock path, name and format are unchanged.
- Race analysis: every delete of a lock now happens under the guard, after a re-read. A fresh caller links only when no lock exists, so it can never replace a lock that a guard holder has read. Unguarded takeover remains possible only for older plugin versions, and `docs/REFERENCE.md` states that limit.
- Automated criteria, run in this review:
  - 1.1 and 2.1: `run-lock.test.mjs`, 26 of 26 pass, including `1.2a` (6.6 s).
  - 1.3: the lock path and format grep prints nothing.
  - 1.4: no `can both take it` remains.
  - 1.5: smoke check in a scratch project. `init smk --goal "x"` returns `action: "run"` and `status smk` exits 0.
  - 2.2: the pre-fix module from merge-base, run through `LOCK_MODULE`, fails with an overlap message in 3 of 3 runs, for example `round 11: held intervals overlap`.
  - 2.5: `no-recursive-delete.test.mjs`, 11 of 11 pass.
  - 2.6: `version-check: OK (1.15.0)`.
  - 2.4: full suite after the F1 fix: 2116 tests, 2113 pass, 0 fail, 3 skipped.
- Manual criteria: none in the plan.

## Findings

### F1 — Live-guard halt gives no way out when the guard pid is reused

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: skills/10x-pipeline/scripts/run-lock.mjs:93
- **Detail**: Suppose a taker crashes inside the takeover and the OS later reuses its pid for an unrelated live process. Every caller then waits 1 s and halts with "Another caller is taking over ... Retry in a moment." Retrying never helps, and unlike the dead-holder message and the live-pid lock message, this one does not say the guard file may be removed. This is the same pid-reuse gap that `change.md` names for the lock itself.
- **Fix**: Add the removal advice to the live-guard halt, assert it in test `1.1g`, and state it in the "Run lock" bullet of `docs/REFERENCE.md`.
- **Decision**: APPLIED — commit e67f5b82 (message extended; `1.1g` asserts `removes the guard file and retries`; REFERENCE "Run lock" bullet updated).
