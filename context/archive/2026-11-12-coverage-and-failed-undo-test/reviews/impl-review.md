<!-- IMPL-REVIEW-REPORT -->
# Implementation Review — Router coverage and failed rollback undo

- **Plan**: `context/changes/coverage-and-failed-undo-test/plan.md`
- **Scope**: Full plan
- **Reviewed phases**: 1, 2
- **Date**: 2026-11-14
- **Source revision**: `d42bfd3`
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
| --- | --- |
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

The verdict and counts describe the implementation reviewed at `d42bfd3`. Manual acceptance row 2.6 remains pending. The automated implementation requires no corrective edits.

## Findings

### F1 — Live CI acceptance remains pending

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision, with an obvious and narrowly scoped next step.
- **Dimension**: Success Criteria
- **Location**: `context/changes/coverage-and-failed-undo-test/plan.md:252`, `context/changes/coverage-and-failed-undo-test/coverage-evidence.md:30`
- **Detail**: Manual row 2.6 is unchecked. A fresh read-only GitHub lookup returned no CI runs for `agent-smith/coverage-and-failed-undo-test`, and `gh pr view` found no pull request. The evidence correctly records local macOS runs and leaves the Linux regression execution, green CI URL, CI module table, skip identities and TrueNAS timing open. Local coverage took 20.53 minutes against an ordinary 18.95-minute baseline at concurrency 2. CI uses default concurrency on another runner, so its existing 15-minute budget still needs measurement.
- **Fix**: Publish the branch through the run-end workflow, collect its passing CI log and same-runner timing, and append the required evidence. Use those measurements to select the plan-authorized inline or separate coverage configuration within the existing job limit.
- **Decision**: PENDING — change-specific CI evidence is unavailable. The owner must decide when to publish the branch and, after measuring CI, whether inline coverage fits the job budget or the documented fallback is needed.

## Plan adherence and scope

| Planned surface | Result | Evidence |
| --- | --- | --- |
| Phase 1 CI test command | MATCH | `.github/workflows/ci.yml:66` adds only `--experimental-test-coverage`. The three existing globs, blocking failure propagation, runner temporary directory and job timeout remain effective. Coverage thresholds stay observational. |
| Phase 1 baseline evidence | MATCH | `coverage-evidence.md` records the exact source revision, Node/Git/OpenSpec versions, platform, commands, totals, three named skips, native module rows and sequential ordinary/covered timings. |
| Phase 1 recovery inventory | MATCH | Every full-suite uncovered range in `route.mjs`, `flow.mjs`, `steps.mjs` and `isolation.mjs` has a source-backed disposition. Failed undo alternatives on already-covered lines are explicitly assigned to Phase 2. |
| Phase 2 four-case matrix | MATCH | `rollback.test.mjs:392` runs both halt callers with each undo reset failing. Existing successful-undo fixtures remain present. |
| Phase 2 snapshot and sequencing proof | MATCH | `rollback.test.mjs:405-445` distinguishes the step start from a failed-step commit, checks tracked and untracked contents, snapshot parent, exact ref, one successful rollback followed by one injected failure, and each resulting HEAD. |
| Phase 2 final coverage | MATCH | The recorded final suite has 1,483 tests, 1,480 passes, three expected skips and zero failures. Route line coverage rises from 98.50% to 98.78% and branch coverage from 87.40% to 88.80%. The mixed-reset failure range 56–58 becomes covered. |
| Phase 2 live CI evidence | PENDING | F1 tracks unchecked manual row 2.6. |

The implementation range is `c24a166^..d42bfd3`, selected from the two feature-specific implementation commits and subsequent lifecycle commits. Its two implementation files are exactly the Wave 6 surfaces assigned to this change. Other changes are confined to this change folder, including evidence, Progress and router-generated lifecycle records.

## Safety, architecture and pattern checks

- Traced `isolation.mjs:561-606` through snapshot creation, side-ref publication and the initial reset, then `route.mjs:51-65`, `101-112` and `1056-1068` through both undo callers. Snapshot publication precedes every destructive fixture reset.
- The fixture-local wrapper at `rollback.test.mjs:360-390` follows the POSIX Git-wrapper pattern in `stepcommit.test.mjs:416`. Its environment targets only one router child and forwards other Git commands. Exact ref-specific suffixes distinguish the failing undo from the successful initial reset.
- The wrapper resolves the snapshot before injecting failure. Its exact marker assertion proves one rollback followed by one undo attempt. The injector lives under the main scratch fixture, outside the linked worktree. `cleanupAll` owns its cleanup through the existing `removeTree` implementation.
- Assertions cover ordinary halt exit 0, outer-catch exit 1, parseable halt JSON, original caller context, failure diagnostic, full recovery ref and mixed-reset recovery guidance. All four cases inspect preserved tracked and untracked work through real Git.
- Router modules are byte-identical to the baseline revision. Routing policy, CLI, run-state schema, snapshot namespace and runtime dependencies retain their existing contracts. Windows uses the established POSIX-wrapper skip condition.
- Reviewed the full-suite uncovered ranges against current source and matched all seven recorded module rows to the raw baseline and final logs. The recorded test blob matches the current regression file.

## Verification

Review-time checks use Node `v24.19.0`, the CI-selected OpenSpec `1.16.1`, telemetry disabled and the existing worktree-local temporary directory with its Git-discovery boundary.

| Check | Result |
| --- | --- |
| Focused covered rollback and override suite | PASS, 23 tests, zero failures/skips, 64,249.988083 ms |
| CI runner and workflow pin guards | PASS, 20 tests, zero failures/skips, 8,904.548709 ms |
| CI command and evidence assertions | PASS, verified the three globs, blocking propagation, observational flag, temporary directory, all seven raw module rows, revision provenance and Wave 6 ownership |
| Version guard | PASS, `version-check: OK (1.10.2)` |
| Whitespace validation | PASS, `git diff --check` |
| Full covered repository suite | PASS, exit 0, 1,483 tests, 1,480 passes, zero failures/cancellations and three expected skips, 1,098,059.9225 ms (18.30 minutes) |
| Ordinary full suite | Recorded baseline verified, 1,479 tests, 1,476 passes, zero failures and three expected skips. Timing comparison uses the original sequential, matching-source pair. |
| Live change-specific CI | PENDING, F1 |

Commands executed for this review follow the plan.

```sh
node --test --test-concurrency=2 --experimental-test-coverage skills/10x-pipeline/test/rollback.test.mjs skills/10x-pipeline/test/override-json.test.mjs
node --test tools/test/ci-runner.test.mjs tools/test/workflow-pins.test.mjs
node --test --test-concurrency=2 --experimental-test-coverage skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs
node tools/version-check.mjs
git diff --check
```

Raw review logs are worktree-local scratch artifacts under `.claude/worktrees/coverage-verification/`, named `review-focused.log`, `review-workflow.log` and `review-full-coverage.log`.

## Review-time full-suite coverage

All four new regression cases ran successfully in the full covered suite. All seven module rows match the implementation's recorded final table. The three skips remain the two GH_LIVE comment tests and the absent CLAUDE.md check. All five pinned OpenSpec contract fixtures executed.

```text
ℹ    flow.mjs          |  99.79 |    90.39 |  100.00 | 629-630
ℹ    isolation.mjs     |  98.54 |    66.67 |  100.00 | 224 279-280 318-319 662-663 694-695 698-699
ℹ    preplan.mjs       | 100.00 |    89.04 |  100.00 |
ℹ    route.mjs         |  98.78 |    88.80 |  100.00 | 78-79 146-147 834-836 896-897 907-908 1051-1052
ℹ    state.mjs         |  99.42 |    93.07 |   99.18 | 84-87 1027-1028
ℹ    steps.mjs         | 100.00 |    88.89 |   99.23 |
ℹ    openspec.mjs      |  99.52 |    83.10 |  100.00 | 152
```

The ordinary comparison uses the recorded baseline pair. Review-time performance remains a local macOS observation at concurrency 2. F1 retains the pending Linux CI and same-runner timing check.

## Assumptions and triage

- Reviewed both phases in full under the explicit task instruction, including Phase 2 whose five automated rows are checked and whose manual row is pending. Progress is 9/10 overall and 9/9 automated, with Phase 2 current. [Plan](../plan.md)
- Performed plan drift, safety and pattern review directly under the unattended single-level execution rule. The accepted foundation lesson also requires this execution model. [Lessons](../../../foundation/lessons.md)
- Retained inline coverage pending the planned same-runner measurement. The current implementation follows the ticket and records its measured 8.33% local overhead. [Evidence](../coverage-evidence.md)
- Selected all clear in-scope corrective fixes for application. The review found no CRITICAL or WARNING defects and F1 depends on external CI evidence, so no code-fix commit was required.
- Stamped `change.md` as `impl_reviewed` according to the review skill. The review reads the existing Progress and router lifecycle state through their established contracts.

The observation is specific to this change. No recurring lesson candidate was identified.
