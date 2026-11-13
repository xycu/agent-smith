<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Job timeouts in CI and spawn timeouts in the test helpers

- **Plan**: context/changes/ci-job-and-spawn-timeouts/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2
- **Date**: 2026-11-13
- **Verdict**: APPROVED
- **Findings**: 0 critical 0 warnings 1 observations

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

- Phase 1: `.github/workflows/ci.yml` has `timeout-minutes: 15` under `runs-on` in `test` and `commits`, plus the one-line header comment; action pins unchanged. `tools/test/ci-runner.test.mjs` has the new test (2 blocks, exactly one key each).
- Phase 2: `skills/10x-pipeline/test/helpers.mjs` exports `SPAWN_TIMEOUT_MS = 120000`, one `throwOnSpawnError` used by `run` and `git`, `run` takes `timeout` and `script`, `git` takes `timeout`; the return shape and the `status !== 0` check are unchanged. `helpers-timeout.test.mjs` holds the three planned tests. `test/README.md` has the three planned edits.
- Automated checks run: `grep -c` prints 2; `ci-runner`, `workflow-pins` and `helpers-timeout` tests pass (17 of 17); README grep prints 1; `node tools/version-check.mjs` OK (1.7.0); `node tools/commit-lint.mjs main..HEAD` OK. Full suite `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`: 1153 tests, 1150 pass, 0 fail, 3 skipped (run under a machine load average of about 230, 1090 s; no call hit the 120 s limit).
- Manual 2.7 (CI green, self-hosted runner) is unchecked in Progress and cannot be confirmed from the repository; it stays pending.

## Findings

### F1 — Spawn killed by an external signal is not reported by the helpers

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: skills/10x-pipeline/test/helpers.mjs:17
- **Detail**: `throwOnSpawnError` acts only on `res.error`. A child killed by a signal other than the timeout kill (for example the OOM killer on the runner) sets `res.signal` with `status: null` and no `error`, so `run` still returns a null `json`, the symptom the plan set out to remove. The plan specifies `res.error` only, so the code matches the plan; the case is outside the plan's scope.
- **Fix**: Optional follow-up: also throw `<label> was killed by <res.signal>` when `res.signal` is set.
- **Decision**: PENDING — outside the plan's scope (the plan names `res.error` as the trigger); the owner decides whether to widen the helper.
