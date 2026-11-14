<!-- IMPL-REVIEW-REPORT -->
# Implementation Review — CI scratch projects in runner temp

- **Plan**: context/changes/ci-scratch-in-runner-temp/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1
- **Date**: 2026-11-14
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 0 observations

## Verdicts

| Dimension | Verdict |
| --- | --- |
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

Success Criteria covers the automated implementation checks and accurate recording of pending manual acceptance. Operational acceptance remains pending for rows 1.5 and 1.6.

## Findings

No findings.

## Plan Adherence and Safety

| Planned contract | Reviewed evidence |
| --- | --- |
| Suite-step temporary directory | `.github/workflows/ci.yml:38` declares `env.TMPDIR` as `${{ runner.temp }}` directly on `Test suite` in job `test`. |
| Step-bounded regression | `tools/test/ci-runner.test.mjs:41` uses `testJob()`, splits at sibling step indentation, selects the suite by name and checks its own environment mapping and exact value. |
| Existing test index | `skills/10x-pipeline/test/README.md:106` extends the existing configuration-test row with the suite-step `TMPDIR` contract. |
| Inherited scratch and lock placement | `makeProject()` in `helpers.mjs` and `runLockPath()` in `state.mjs` derive their directories from `os.tmpdir()`. OpenSpec fixtures reuse the shared project helper. |
| Explicit child overrides | `run()` merges fixture environment values after `process.env`. Lock tests and Codex fixtures provide nested temporary directories. All focused lock cases and both-chain execution checks passed. |

The workflow environment mechanism owns the placement change. The existing textual workflow assertions provide the covering pattern.

The phase implementation commit is `b62ced5`. Its source and index edits match the three planned targets. Later lifecycle commits also carry an `AGENTS.md` test-concurrency adjustment, recorded as an external edit in the implementation verification. The supplied repository instructions prescribe that same concurrency value. The review treated this as an enclosing-run instruction update. Remaining changes in the reviewed range are this change's workflow artifacts.

## Automated Verification

All review commands ran from this worktree on Node `v24.19.0`.

- `node --test tools/test/ci-runner.test.mjs skills/10x-pipeline/test/run-lock.test.mjs` exited 0 with 21 passes, zero failures and zero skips. This covers all 9 configuration cases and all 12 lock cases, including both chains.
- An in-memory check executed the current suite assertion against the historical workflow from `b62ced5^` and six invalid variants. It rejected the historical missing declaration, removal, replacement, movement to an adjacent step, movement to job level, movement to another job and placement under the wrong mapping. The current workflow passed. The implementation's original failing-then-passing test run is recorded in `verification.md`.
- The complete repository-required suite exited 0 with 1,285 tests, 1,282 passes, zero failures, zero cancellations and 3 skips across 13 suites. Duration was 542,610.427 ms.
- Two optional live PR-comment tests were skipped because `GH_LIVE=1` was unset. Their declared prerequisites are network access and authenticated `gh`.
- The optional `CLAUDE.md` import check was skipped because that file is absent. All observed skips match existing conditions.
- `node tools/version-check.mjs` exited 0 with version `1.10.0`.
- `git diff --check` passed, and the phase source diff matched the planned ownership boundary.

Both test invocations used an existing writable worktree-local outer `TMPDIR`. The full-suite command was the following.

```sh
TMPDIR="$PWD/context/changes/ci-scratch-in-runner-temp/evidence/impl-review-tmp" GIT_CEILING_DIRECTORIES="$PWD/context/changes/ci-scratch-in-runner-temp/evidence/impl-review-tmp" node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs
```

Test hooks left the verification directory empty. The review inspected that inventory before removing the empty directory. Test totals and skip reasons above preserve the verification results.

## Pending Operational Acceptance

Progress contains four completed automated rows and two pending manual rows, giving completion of 4/6 and current phase 1. The review checked the entire implementation phase and both manual evidence requirements.

- Row 1.5 requires a green TrueNAS job for this change with its run URL, runner identity, effective suite `TMPDIR` and observed scratch or lock paths. Existing live recheck evidence records no qualifying branch run.
- Row 1.6 requires the cancelled job's scratch inventory and a subsequent job-start inventory from the same runner showing the earlier entries absent. Those observations remain outstanding.
- Actual runner cleanup depends on the service user's deletion permissions. Legacy system-temp leftovers require the owner inventory described in the plan.

These checks retain their pending state in Progress and the existing acceptance evidence. The owner must obtain the specified runner observations to establish operational completion. [Live acceptance recheck](../evidence/judgment-live-acceptance-recheck.md) · [Outstanding evidence](../evidence/unproven.md)

## Evidence-backed Assumptions

- The explicit full-plan request authorizes review of phase 1's implemented work while its two manual acceptance rows remain pending. The report lists phase 1 as its exact coverage.
- The current repository-required concurrency of two governs the complete-suite rerun. The Git discovery ceiling follows the local-fixture isolation requirement established in `verification.md`, because the requested worktree-local scratch directory lies beneath a Git worktree.
- The unattended review performed both plan-drift and safety/pattern analysis directly, following the supplied prohibition on nested delegation and the accepted lesson in `context/foundation/lessons.md`.
