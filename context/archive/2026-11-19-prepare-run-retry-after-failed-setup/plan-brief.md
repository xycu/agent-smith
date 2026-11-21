# Finish the change-folder copy on setup retry — Plan Brief

[Full implementation plan](plan.md)

## What & Why

A failed or interrupted copy can leave a registered run worktree with incomplete change inputs. Retrying setup should finish the copy so either pipeline can proceed from the worktree it already created.

## Starting Point

The shared `prepare-run.mjs` creates the worktree before copying the change folder. Its registered-reuse path currently returns success even when the original copy failed.

## Desired End State

After the cause is fixed, setup from the original project root copies the change inputs into the same worktree and reports `reused` with `copied: true`. A subsequent call reports ordinary reuse with `copied: false`. If the registered worktree directory is missing, setup names it and gives stale-registration inspection guidance.

## Key Decisions Made

| Decision | Choice | Reason |
| --- | --- | --- |
| Retry evidence | Record pending intent under the branch lock before registering a fresh worktree. | A completed copy or custom worktree can legitimately lack router metadata. |
| Write boundary | Check the original invocation, registration, repository, branch and absence of router state before retrying. | Setup must preserve initialized runs and unrelated worktrees. |
| Cleanup | Keep the `reused` case and report `copied: true` on recovery. | Both skills already restrict original-source cleanup to successful fresh creation. |
| Copy semantics | Reuse the existing overlay for both chains. | Propagating source deletions requires a separate change to the copy contract. |

## Scope

The phase covers registering a pending copy, recovering it through the shared setup CLI, preserving ordinary reuse and explaining stale registrations. Proof runs through the local Git fixtures for both 10x and OpenSpec.

## Architecture

The setup executable owns the temporary intent in the Git common directory. It checks the intent and validates the destination under the existing branch lock, then runs the current copy helper and checks the resulting project root before clearing the intent and returning success.

## Phases at a Glance

| Phase | Deliverable | Key risk |
| --- | --- | --- |
| 1. Recover the interrupted copy | Retry behavior, focused CLI tests and updated isolation docs | Overwriting an unrelated or already initialized worktree |

**Prerequisites** — Node 24 or later and local Git.

**Estimated effort** — One implementation session including the full suite.

## Open Risks & Assumptions

- Legacy partial copies lack the evidence needed for automatic recovery. Inspect them and restore missing inputs after preserving local edits.
- Complete pending setup with the updated executable before using an older release on that branch. Preserve any edits made in the incomplete worktree before retrying.

## Success Criteria

- Both chains recover the same worktree after resolving a deterministic copy failure.
- Ordinary, initialized and custom resumes preserve local files. A missing registration gives prune guidance and a replacement repository is refused.
- The Node 24+ repository suite passes locally.

## References

- [Change notes and reproduction](change.md)
- [Shared setup executable](../../../skills/10x-pipeline/scripts/prepare-run.mjs)
- [Worktree isolation contract](../../../docs/REFERENCE.md#L147)
