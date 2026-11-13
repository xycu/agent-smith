<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Job timeouts in CI and spawn timeouts in the test helpers

- **Plan**: context/changes/ci-job-and-spawn-timeouts/plan.md
- **Mode**: Deep (single-agent: grounding and blast-radius sweep done inline, no nested subagent)
- **Date**: 2026-11-13
- **Verdict**: REVISE
- **Findings**: 0 critical, 2 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | WARNING |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | PASS |

## Grounding

Grounding: 6/6 paths ✓ (`ci.yml`, `helpers.mjs`, `ci-runner.test.mjs`, `test/README.md`, `archive.test.mjs`, `pr-title.yml`), 5/5 symbols ✓ (`run` at helpers.mjs:98, `git` at :200, `gitAvailable` at :177, `testJob()`, job-key regexp), brief↔plan n/a (no plan-brief.md), Progress↔Phase ✓ (2 phases, 4+6 automated rows and 1 manual row match the Success Criteria). 45 files import `helpers.mjs` ✓. Two line numbers were stale (F4).

## Findings

### F1 — git timeout test races a 1 ms limit

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2 — Helper test, "git throws a timeout error"
- **Detail**: The test runs `git --version` with `timeout: 1` and relies on 1 ms expiring before git starts and exits. A fast Linux runner can finish `git --version` in about 1 ms, so the test can pass or fail by timing (the plan itself notes the `could not run` fallback, which is also a failure). A flaky test on a self-hosted runner is the kind of defect this change is meant to remove.
- **Fix**: Make the timeout deterministic with a git alias that sleeps: `git(project, ["-c", "alias.slow=!exec sleep 5", "slow"], { timeout: 300 })`, match `/git -c alias\.slow=!exec sleep 5 slow timed out after 300 ms/`, and assert the call took under 10 seconds.
- **Decision**: APPLIED — Phase 2, "2. Helper test", third test bullet rewritten.

### F2 — "router never returns fails within two minutes" holds only for the two helpers

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: End-State Alignment
- **Location**: Desired End State; What We're NOT Doing
- **Detail**: `change.md` "Done when" says a router process that never returns fails its test within two minutes. Several test files spawn the router or git with their own `spawnSync` and no `timeout`: `agents.test.mjs:315-316`, `provenance.test.mjs:73`, `open-pr.test.mjs:150`, `pr-comment.test.mjs:105` and `:843`, `rollback.test.mjs:52-53`, `openspec-isolation.test.mjs:49`. The plan scopes these out in general terms ("other test files") but never says that the two-minute bound does not reach them, so the end state reads stronger than the work delivers. The 15-minute job limit still bounds them.
- **Fix**: State the limit of the bound in the plan: the 120 s bound covers only `run` and `git` from `helpers.mjs`; the listed files keep no spawn timeout and the 15-minute job limit is their backstop. (Wrapping those call sites is a larger change; left as a possible follow-up.)
- **Decision**: APPLIED — What We're NOT Doing, second bullet extended with the call sites and the backstop.

### F3 — pr-title.yml job stays unbounded although "no CI job can run longer than 15 minutes"

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: End-State Alignment
- **Location**: What We're NOT Doing, first bullet; `change.md` "Done when"
- **Detail**: `change.md` ends with "no CI job can run longer than 15 minutes". `pr-title.yml` (one job, `title`, same self-hosted runner expression) now exists and has no `timeout-minutes`. The plan excludes it on the grounds that `change.md` scopes the change to the two jobs of `ci.yml`, but the "Done when" sentence is not limited to `ci.yml`. Adding the key to `pr-title.yml` is a one-line change plus one test assertion, but it widens the scope the plan set on purpose.
- **Fix**: Either extend Phase 1 to `pr-title.yml` (key plus one assertion in `ci-runner.test.mjs`), or keep the exclusion and reword the done-when reading to "no job of `ci.yml`". Which one is the owner's call.
- **Decision**: APPLIED — commit 8e7f245: `pr-title.yml` carries `timeout-minutes: 15` and `ci-runner.test.mjs` asserts it, so "no CI job can run longer than 15 minutes" holds for every job of the repository's workflows that runs on the self-hosted runner (`release.yml` stays hosted).

### F4 — Stale line numbers for the ci.yml jobs

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Current State Analysis, first bullet
- **Detail**: The plan says `test` is at line 23 and `commits` at line 36. In the current `ci.yml` they are at lines 26 and 41 (the file grew a comment and the uid-guard step). The implementer finds the jobs by name anyway, but the wrong numbers cost a moment of doubt.
- **Fix**: Change to lines 26 and 41.
- **Decision**: APPLIED — Current State Analysis, first bullet.
