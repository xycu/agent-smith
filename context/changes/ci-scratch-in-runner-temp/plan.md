# CI scratch projects in runner temp implementation plan

## Overview

Set the `Test suite` step's `TMPDIR` to `${{ runner.temp }}` so CI scratch projects and locks participate in the runner's job cleanup. Extend the existing CI configuration tests and verify that test-specific temporary-directory overrides continue to work.

## Current State Analysis

The test suite runs on Node 24. The TrueNAS runner serves same-repository events, and fork pull requests use the hosted fallback. The `Test suite` step currently invokes all three test globs with the inherited environment. Its present location is `.github/workflows/ci.yml:38`, resolving the older line numbers in `change.md`.

Scratch creation already follows `os.tmpdir()`. `makeProject` creates `as-*` projects there, and router run locks use that directory too. `cleanupAll` removes projects through after hooks, which abrupt termination can bypass. The persistent-runner consequences are recorded in ADR-020.

The lock tests create their own nested temporary directory and pass it as a child-process `TMPDIR`. The shared `run` helper merges those supplied values after `process.env`. Codex execution fixtures also supply their own `TMPDIR`, beneath a scratch project. The environment inheritance already provides the behavior this change needs.

### Key discoveries

- `.github/workflows/ci.yml:38-41` contains the owned suite step and the following version-check step.
- `skills/10x-pipeline/test/helpers.mjs:23-35`, `:62-79` and `:129-135` contain cleanup, scratch creation and child environment precedence.
- `skills/10x-pipeline/scripts/state.mjs:880-881` derives run-lock paths from `os.tmpdir()`.
- `skills/10x-pipeline/test/run-lock.test.mjs:24-31` supplies its nested `TMPDIR`. The live-lock assertions at `:45-59` verify the exact lock directory used by child router commands.
- `skills/10x-pipeline/test/codex-helpers.mjs:68-82` supplies a separate scratch-backed execution directory.
- `tools/test/ci-runner.test.mjs:37-40` already isolates the test job for textual configuration checks.
- `skills/10x-pipeline/test/README.md:106` indexes this configuration test in the current layout. It is the applicable shared test index.
- `context/changes/WAVES.md`, Wave 4, assigns this run the test-step environment. `tests-strip-git-env` owns shared helper environment changes, and `run-state-atomic-writes` owns state-write paths.

## Desired End State

The suite step declares `env.TMPDIR` with the exact value `${{ runner.temp }}`. Existing scratch and lock creation inherit that path. Explicit fixture overrides retain precedence for child processes, including both-chain execution and contention tests.

A configuration regression test binds the environment assertion to the suite step. Local tests establish configuration and compatibility. Operational completion requires evidence that a cancelled run's scratch state is absent when the next test job starts on the same runner.

## Scope and Ownership

Implementation owns `.github/workflows/ci.yml` only within the `Test suite` environment, and its covering assertions in `tools/test/ci-runner.test.mjs`. A narrow update to the existing `ci-runner.test.mjs` index row in `skills/10x-pipeline/test/README.md` records this behavior.

The change folder owns the plan, brief, lifecycle metadata and subsequent verification evidence. The Wave 4 table remains maintained by the post-wave maintenance change. Sibling runs retain their helper, state, comparison, skill-dispatch and setup-script ownership. Wave 5 owns unexpected-skip handling, and Wave 6 owns the CI test command and coverage work.

## Implementation Approach

Use GitHub Actions' step environment and Node's existing temporary-directory resolution. Extend the current text-based CI tests with built-in Node assertions. Keep the workflow's environment declaration at the suite-step boundary so its ownership remains precise.

### Evidence-backed assumptions

- Complexity is low and one implementation phase is sufficient. The requested configuration value is settled by `change.md`, and the existing environment merge and lock tests establish compatibility. This unattended invocation resolves the skill's interview and phase-approval prompts from those sources.
- Runner-owned cleanup is the operational mechanism. GitHub documents that `runner.temp` is emptied at job start and end, subject to the runner account's deletion permissions. Live acceptance remains pending until the owner supplies actual same-runner evidence. [GitHub runner context](https://docs.github.com/en/actions/reference/workflows-and-actions/contexts#runner-context)
- An existing configuration test is the appropriate home for the regression, as specified by `change.md` and established by `ci-runner.test.mjs`. Updating its existing index description is within the task's shared-documentation allowance.

## Phase 1: Configure and verify the suite temporary directory

### Overview

Add the suite-step environment and its regression check together, then verify inherited defaults, explicit overrides and the complete test suite. Record operational acceptance separately in the Manual rows.

### Changes Required

#### 1. CI suite environment

**File** `.github/workflows/ci.yml`

**Intent** Put the test suite's scratch projects and lock files under the runner-managed temporary directory so job cleanup can reclaim cancelled-run leftovers.

**Contract** The `Test suite` step in job `test` has `env.TMPDIR` equal to `${{ runner.temp }}`. The owned edit is that step's environment block.

#### 2. CI configuration regression

**File** `tools/test/ci-runner.test.mjs`

**Intent** Detect removal, replacement or misplacement of the suite's runner-temp environment declaration.

**Contract** Select the suite step within the existing `testJob()` scope and assert its own `env` mapping contains the exact runner-temp expression. An adjacent step's or job-level declaration cannot satisfy the assertion. Follow the existing built-in assertion and text-inspection pattern, bounded by step indentation. Avoid tying the assertion to the complete suite command, which a later wave owns. First run the new assertion against the current workflow and observe the missing-environment failure, then apply the workflow edit and rerun it.

#### 3. Existing test index

**File** `skills/10x-pipeline/test/README.md`

**Intent** Add the new temporary-directory assertion to the existing `ci-runner.test.mjs` row.

**Contract** Edit that row's description to name the suite-step `TMPDIR` contract.

### Success Criteria

#### Automated Verification

- The suite-step configuration check fails before the environment edit and passes afterward with `node --test tools/test/ci-runner.test.mjs`.
- With an existing, writable, worktree-local outer `TMPDIR`, `node --test skills/10x-pipeline/test/run-lock.test.mjs` passes all 12 current cases, including exact child-lock paths and both-chain execution fixtures.
- With an existing, writable, worktree-local outer `TMPDIR`, the complete Node 24+ command `node --test skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs` passes, with observed skips and their reasons recorded.
- `git diff --check` passes, and the reviewed diff is confined to the owned suite environment, its configuration test, its index description and this change's artifacts.

#### Manual Verification

- A green CI test job on a TrueNAS runner records its run URL, runner identity, effective suite `TMPDIR` and observed scratch or lock paths beneath the resolved runner-temp directory.
- After cancelling a CI test job with observed scratch state, the next test job on the same runner starts with those earlier scratch projects and lock files absent, with both run URLs, runner identity, paths and job-start observations recorded.

## Testing Strategy

### Planning baseline

On 2026-11-14, Node `v24.19.0` passed all 8 existing `ci-runner.test.mjs` cases. The existing 12 `run-lock.test.mjs` cases also passed with `TMPDIR` set to a fresh directory inside this worktree. That directory was empty after the test hooks ran and was removed with `rmdir`. These results establish the pre-change baseline. Implementation criteria begin pending.

### Automated implementation proof

Run every shell command from this run's worktree with the working-directory prefix required by the task. Create a fresh writable verification directory beneath that worktree and supply its real path as the command's outer `TMPDIR`. Use the focused configuration check for the initial failing assertion, then rerun the lock test and the repository-required complete suite after the change. The full suite covers the other explicit overrides in `pr-comment.test.mjs`, `pr-common.test.mjs`, `no-recursive-delete.test.mjs` and the Codex fixtures.

Record exit codes, counts and reasons for skipped tests. Existing optional live integrations retain their own prerequisites. Investigate unexpected failures against the owned change and report external prerequisites with evidence. Test-created directories receive the existing hook cleanup. Inspect any remaining verification contents before using the repository's file-by-file cleanup helper, then remove the empty outer directory.

### Live runner acceptance procedure

1. Use a CI run containing this change. Capture the `test` job URL and the runner name or ID. Observe the effective suite environment and at least one created `as-*` project or `agent-smith-*.lock` path under that runner's resolved temp directory, including nested override paths where relevant.
2. Cancel that run while its suite is active. Record the cancellation and any retained scratch paths using owner-provided runner observations.
3. Observe the next `test` job assigned to that same runner instance. Capture the temp-directory inventory at job start, before the suite creates fresh entries, and verify that the earlier paths are absent. A run on another runner requires a subsequent same-runner observation.
4. Record evidence in this change folder. A green job or local cleanup result alone leaves the cancellation row pending. If the runner user cannot delete a retained entry, record the path and permissions and leave acceptance pending until the runner issue is resolved.

## Migration and Operational Notes

The older system-temp `as-*` projects and `agent-smith-*.lock` files need a separate owner inventory on the runner. The owner can verify each candidate is abandoned, check that associated processes have exited, list its files, remove confirmed files individually and remove empty directories deepest first. Record cleanup or explicit deferral in the acceptance evidence. New job-scoped placement addresses subsequent test runs.

The runner cleanup mechanism depends on directory ownership and permissions, and a terminated runner may defer cleanup until its next job starts. Manual rows remain unchecked until the recorded observations satisfy them. The planning run has performed local baseline checks only.

Rollback is a normal follow-up commit reverting this change's suite environment, matching assertion and index wording. That restores the earlier placement for future tests. Existing leftovers continue to require their corresponding runner-temp or owner cleanup.

## References

- Task and acceptance outcome in [change.md](change.md).
- Wave ownership in [WAVES.md](../WAVES.md), Wave 4 and shared-documentation rules.
- Shared environment ownership in [tests-strip-git-env/change.md](../tests-strip-git-env/change.md).
- Persistent-runner behavior and prerequisites in [ADR-020](../../../docs/ADR/ADR-020-ci-on-self-hosted-truenas-runners.md).
- Source anchors are listed under Current State Analysis and resolve against the current repository layout.
- Job-scoped temp cleanup and permission caveat in [GitHub runner context](https://docs.github.com/en/actions/reference/workflows-and-actions/contexts#runner-context).

## Progress

### Phase 1: Configure and verify the suite temporary directory

#### Automated

- [x] 1.1 The suite-step configuration check fails before the environment edit and passes afterward with `node --test tools/test/ci-runner.test.mjs`.
- [x] 1.2 With an existing, writable, worktree-local outer `TMPDIR`, `node --test skills/10x-pipeline/test/run-lock.test.mjs` passes all 12 current cases, including exact child-lock paths and both-chain execution fixtures.
- [x] 1.3 With an existing, writable, worktree-local outer `TMPDIR`, the complete Node 24+ command `node --test skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs` passes, with observed skips and their reasons recorded.
- [x] 1.4 `git diff --check` passes, and the reviewed diff is confined to the owned suite environment, its configuration test, its index description and this change's artifacts.

#### Manual

- [ ] 1.5 A green CI test job on a TrueNAS runner records its run URL, runner identity, effective suite `TMPDIR` and observed scratch or lock paths beneath the resolved runner-temp directory.
- [ ] 1.6 After cancelling a CI test job with observed scratch state, the next test job on the same runner starts with those earlier scratch projects and lock files absent, with both run URLs, runner identity, paths and job-start observations recorded.
