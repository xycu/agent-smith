# Protect Unfinished Git Operations During Run Publication

[Full implementation plan](plan.md)

## What & Why

When a run halts with a Git conflict, the final publication step can stage the conflict markers and commit them. The fix preserves the unfinished operation and publishes the branch history already committed.

## Starting Point

The router recognizes Git operation markers. `open-pr.mjs` currently has its own path from worktree status to `git add -A`. Its publication path already handles a failed leftover commit by attempting the push of the existing branch. [Router guard](../../../skills/10x-pipeline/scripts/isolation.mjs#L244) · [Publisher](../../../skills/10x-pipeline/scripts/open-pr.mjs#L445)

## Desired End State

With HEAD attached to a validated run branch ahead of base, the publisher still attempts its ordinary push and PR handling. An operation marker, unmerged index or failed safety probe skips the leftover commit before staging, preserving the worktree, index, operation markers and local HEAD. Its JSON reports `committed: false` and gives the reason in `commitError`, with null `commit` and `swept` fields. A detached rebase still takes the earlier isolation refusal before publication.

## Key Decisions Made

| Decision | Choice | Why |
| --- | --- | --- |
| Check ownership | Shared read-only Git helper | The router and publisher apply one operation policy while retaining their own Git runners. |
| Unsafe state | Router markers, sequencer and all unmerged index entries | Resolved operations can retain markers, and stash conflicts can have no marker. The whole-index query works from nested roots with literal pathspecs enabled. |
| Probe failure | Skip the leftover commit with a diagnostic | An unreadable Git state cannot establish that staging is safe. |
| Publication | Use the existing push and PR flow | The run’s committed work remains available for review. |

## Scope

Share the Git check, integrate it before the leftover commit, cover real Git states in regression fixtures, and update the reference, ADR-017 and ADR-019. The change brief also tracks staged-only recovery after a failed commit and the empty-index result after staging as follow-up issues. [Change brief](change.md)

## Architecture / Approach

Both callers resolve worktree-local operation markers and inspect the entire index through one shared helper. The publisher checks before status and staging. Its existing result mapping carries the diagnostic and allows the normal publication attempt. The router rejects unmerged entries before rollback snapshots and still accepts ordinary staged entries in that path.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Share the unfinished-operation guard | Guard, local regression coverage and publication docs | A marker can remain after the index is resolved, and a conflict can sit outside the current subdirectory. |

**Prerequisites** Node 24 or later, Git and the existing local test harness with `/bin/sh`.

**Estimated effort** One implementation and verification session.

## Open Risks & Assumptions

- Scope and verification evidence support one low-complexity phase. [Complexity assessment](complexity.json)
- Git’s sequencer can hold unfinished cherry-pick or revert state. The shared guard checks it alongside the existing markers. [Git cherry-pick](https://git-scm.com/docs/git-cherry-pick#_sequencer_subcommands)
- Probe failures use the existing `commitError` path and allow the normal publication attempt. [Publisher](../../../skills/10x-pipeline/scripts/open-pr.mjs#L445)
- Publication follows settled step execution and assumes the worktree has no concurrent external Git writer during the check and leftover commit. [10x pipeline publication](../../../skills/10x-pipeline/SKILL.md#L165)

## Success Criteria

- Local linked-worktree tests cover conflicted merge, cherry-pick, revert and a markerless unmerged path outside a nested run root with literal pathspecs enabled. They cover marker-only and probe failure cases. The bare remote receives the original attached run tip and fake PR handling proceeds. The detached-HEAD test checks the earlier isolation refusal.
- Router tests prove the shared archive and rollback refusals and continued snapshot support for ordinary staged entries. The full suite passes on Node 24 or later.
- The reference and ADR-017 describe the result fields and local state preservation. The reference and ADR-019 explain when late usage stays local. Live publication follows the orchestrator’s existing flow.

## References

- [Change brief](change.md)
- [Publication reference](../../../docs/REFERENCE.md#L145)
- [ADR-017](../../../docs/ADR/ADR-017-run-branch-always-pushed-for-review.md)
