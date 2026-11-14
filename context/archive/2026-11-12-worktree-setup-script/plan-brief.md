# Shared run setup — Plan Brief

> Full plan: [plan.md](plan.md)

## What & Why

Move duplicated worktree setup from both pipeline skills into one dependency-free Node script. Today an orchestrator interprets several conditional Git and copy commands, and picking the wrong resume case can overwrite newer run files. The refactor makes those choices executable and testable.

## Starting Point

Both Start step 3 sections specify the same six setup cases with different change-folder paths. The router already enforces isolation and owns run state, commits and rollback; existing isolation tests construct worktrees but do not test the setup recipe.

## Desired End State

Both skills call `prepare-run.mjs`, consume one JSON result and continue from its absolute `runRoot`. Every setup case is covered through the real script, including subdirectory projects, fresh copies with preserved timestamps, and resumes that copy nothing. The main-checkout source folder remains in place until the separately scheduled cleanup change.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Owner | One standalone script under `skills/10x-pipeline/scripts/` | Both chains share setup without importing router modules. | change.md; standalone-script precedent |
| Preservation | Keep all six cases and their current order | Already-running linked branches and stale source copies must not change behavior. | Both current Start step 3 sections |
| Failure reporting | Runtime JSON/exit 0 with `reason`; failed `runRoot` is null; usage exit 2 | Callers must not interpret process success as successful setup. | change.md; open-pr.mjs; plan |
| Policy | Relevant isolation projection, tested against the real loader | Preserve strict-true and merge semantics without a general loader refactor. | state.mjs; isolation.mjs |
| Cleanup | None; `left` is empty in Wave 4 | Cleanup needs the later start commit and belongs to Wave 5. | WAVES.md; stale-main-change-copy |
| Setup serialization | Exclusive per-branch filesystem lock in the Git common directory through the complete copy | Git registers a reusable worktree before its copied inputs are ready. | Plan review F1; real Git publication proof |
| Tests | New real-script suite and setup-only content assertions | Protect behavior without editing sibling-owned test environments. | Wave 4 ownership |

## Scope

**In scope:** new script and test file; test-index row; both skills' Start step 3; setup assertions in the two shared skill-content tests; command/reference documentation and ADR-010 Amendment 2.

**Out of scope:** stale-copy cleanup; router/policy/run-state changes; shared test helpers and sibling-owned test files; dispatch/anti-stall/late-usage sections; WAVES maintenance; dependencies; unrelated documentation repairs.

## Architecture / Approach

The skill invokes the script from the original project root. The script resolves isolation policy, selects the first matching case, uses bounded argument-array Git calls, and copies only for a newly created branch using Node filesystem APIs that preserve timestamps. It returns absolute directories and an explicit failure signal. Router initialization and run-state writes remain separate. Existing standalone helpers and scratch-test helpers are reused unchanged.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Implement and prove standalone setup | CLI, six-case behavior, policy parity, real-worktree tests and command guards | Accidentally copying on resume or changing path/timestamp semantics |
| 2. Wire skills and document the contract | Thin Start step 3 callers, content assertions, command/reference/ADR updates | Continuing after setup failure or touching sibling-owned skill regions |

**Prerequisites:** Node 24+, Git with linked worktrees, current Wave 4 layout and this worktree's ownership constraints.
**Estimated effort:** two focused implementation phases; most effort is in real-worktree regression coverage.

## Open Risks & Assumptions

- Unattended planning assumes medium complexity and two phases based on the six shared stateful paths; no human decisions remain unresolved.
- Setup failures can leave a branch/worktree or partial copy for inspection. Concurrent setup fails while the shared branch lock is held. Process interruption can leave a lock requiring inspection before manual removal.
- Existing `agent-smith/` linked branches are accepted even for a different requested id, matching current skill behavior; the router remains the enforcement layer.
- Invalid present policy fails before setup writes, matching the current router loader. Missing overrides retain defaults.
- Host permission behavior is unchanged and not proven by local CLI tests. No live Claude/Codex launch is required or claimed here.
- `open-pr.test.mjs` is sibling-owned, so equivalent setup command guards live in the new test file. The source folder and stale-copy warning remain until Wave 5.

## Success Criteria (Summary)

- The real CLI proves all six cases for both chains, policy parity, subdirectory paths, preserved copy timestamps, unchanged resumes and concurrent-setup exclusion. Its real Git-timeout test uses a 150000 ms outer deadline to observe the script's 120000 ms failure result.
- Both skills use the shared script and stop on failure while retaining their existing safety rules; setup commands are absent from their prose.
- Focused and full repository suites pass, and the scoped diff respects Wave 4 ownership. The full plan has seven automated Progress rows, initially unchecked.

## References

`change.md`; `../WAVES.md`; `../stale-main-change-copy/change.md`; `../tests-strip-git-env/change.md`; both pipeline SKILL.md Start step 3 sections; `docs/REFERENCE.md` Run isolation; ADR-010; `context/foundation/lessons.md`.
