# CI scratch projects in runner temp plan brief

The [full plan](plan.md) contains file contracts and canonical Progress.

## What & Why

Set the CI suite step's `TMPDIR` to `${{ runner.temp }}`. Cancelled tests can leave scratch repositories and locks behind on the persistent TrueNAS runner, and runner-managed temp cleanup provides their job lifecycle.

## Starting Point

Scratch projects and locks already use Node's `os.tmpdir()`. Explicit test overrides already take precedence in child processes. The suite step currently inherits its default temporary directory.

## Desired End State

The suite creates scratch state under the runner-managed directory, with regression coverage for the step environment and compatibility coverage for test-specific overrides. Operational acceptance demonstrates that a subsequent job on the same runner starts without the cancelled run's earlier scratch state.

## Key Decisions Made

| Decision | Choice | Evidence |
| --- | --- | --- |
| Environment boundary | `env.TMPDIR` on the `Test suite` step | `change.md` and Wave 4 ownership |
| Directory value | Exact `${{ runner.temp }}` expression | `change.md` and GitHub runner-context documentation |
| Regression home | Existing `tools/test/ci-runner.test.mjs` | Task and existing `testJob()` scope |
| Override compatibility | Verify the existing merge precedence and nested directories | `helpers.mjs`, `run-lock.test.mjs` and `codex-helpers.mjs` |
| Planning structure | One phase, four automated rows and two manual rows | Low-complexity configuration change and unattended task instructions |
| Live acceptance | Pending until same-runner cancellation evidence exists | Task's completion condition and cleanup permission caveat |

## Scope

The implementation edits the suite-step environment, its existing configuration test and that test's shared-index description. This change folder holds planning and acceptance evidence.

Sibling Wave 4 runs own shared environment helpers, run-state writes, comparison behavior, dispatch and setup scripts. The post-wave maintenance change owns `WAVES.md`.

## Architecture / Approach

GitHub Actions supplies the step environment, Node resolves its temporary directory, and existing scratch helpers and child processes inherit the result. The configuration test checks the suite step's own environment block. The existing lock tests exercise explicit nested overrides.

## Phases at a Glance

| Phase | Deliverable | Key risk |
| --- | --- | --- |
| 1. Configure and verify the suite temporary directory | Environment declaration, scoped regression, index description and verification evidence | Runner deletion permissions and access to same-runner cancellation observations |

Node 24+ and the Wave 4 base provide the implementation prerequisites. The owner provides live runner access for operational acceptance. The implementation is one small configuration-and-test change, followed by runner observation whose timing depends on scheduling.

## Open Risks & Assumptions

- The unattended plan assumes one phase based on the settled task and existing environment behavior.
- Runner cleanup requires permission to delete retained entries. Its real behavior remains subject to the manual acceptance rows.
- Legacy system-temp entries require owner inventory and cleanup or explicit deferral.

## Success Criteria (Summary)

- The suite-step configuration check detects missing or misplaced runner-temp configuration.
- Focused lock tests and the full Node 24+ suite pass with an inherited outer `TMPDIR`, with skips recorded honestly.
- A green TrueNAS test job and cancellation followed by a subsequent same-runner job provide the two manual acceptance records.

## Verification at Planning Time

The existing 8 CI configuration tests and 12 lock tests passed locally on Node `v24.19.0`. The lock tests used a worktree-local outer `TMPDIR` and left it empty. All implementation and manual Progress rows begin pending.

## References

- Task and completion condition in [change.md](change.md).
- Ownership in [WAVES.md](../WAVES.md), Wave 4.
- Cleanup lifecycle and permission caveat in [GitHub runner context](https://docs.github.com/en/actions/reference/workflows-and-actions/contexts#runner-context).
