# Archived-change guards and retained-input cleanup — Plan Brief

See the [full implementation plan](plan.md).

## What & Why

A fresh change copied into a run worktree can remain untracked in the original checkout. After the run is archived and merged, that stale folder can still start another run. This change prevents duplicate initialization and removes source files once the isolated start commit safely retains their exact bytes.

## Starting Point

The shared setup script copies inputs before initialization. The router creates the start commit during `init`. Existing archive guards overlook a live folder beside an archive, and both skills currently leave source cleanup to the user. Planning reproduced duplicate initialization in both chains and passed 10 existing focused tests.

## Desired End State

Both chains reject duplicate archived ids with a diagnostic naming the live and archive paths. Fresh isolated runs remove identical untracked regular files after successful initialization. Tracked, edited and uncertain files remain and are reported. Resumes preserve their current behavior.

## Key Decisions Made

| Decision | Choice | Reason | Source |
| --- | --- | --- | --- |
| Archive guard | Add an init-specific preflight using existing archive lookup | Wave 5 assigns this init region and leaves the shared state module under its current ownership | Brief, WAVES.md, code |
| Cleanup timing | After `init` returns `run`, before the first launch | The start commit first exists during initialization | ADR-010, code |
| Cleanup interface | Existing setup script with `--cleanup` and saved setup JSON on stdin | Carries original roots and fresh/resume identity without a state sidecar | Plan assumption |
| Resume behavior | Only a saved fresh-created/copy-success result permits cleanup | Existing setup copies inputs only during creation | Brief, ADR-010 |
| Deletion proof | Regular-file bytes equal an immutable retained start-commit blob, source path untracked in HEAD and index | Makes every removed file recoverable and preserves source work | Brief, code |
| Uncertain entries | Retain symlinks, changed or unretained files and name them | Existing setup preserves link semantics and the brief requires safe retention | Plan assumption |
| Failure recovery | Report surviving paths and continue the initialized run | Source retention safely contains cleanup failures | Plan assumption |

## Scope

Implementation covers the router's init guard, cleanup in `prepare-run.mjs`, the stale-copy paragraph in both skills, existing affected tests and corresponding shared reference paragraphs.

Wave 5's other owners retain CI, shared helpers, frontmatter/descriptions, ladder policy and the deletion-guard implementation. WAVES.md and archive contents remain read-only. The historical one-off stale file is absent from this worktree, and any copy elsewhere requires owner maintenance under the working-directory restriction.

## Architecture / Approach

The router checks the resolved chain's archive names before init writes. The orchestrator retains the initial setup JSON, then sends it to cleanup after successful initialization. Cleanup verifies the original/run roots, branch, Git common directory, project prefix and start-commit retention under the existing setup lock. It checks candidates before individual unlinks and prunes empty directories deepest first. Its existing `left` field reports surviving original-project-relative paths.

## Phases at a Glance

| Phase | Deliverable | Primary risk |
| --- | --- | --- |
| 1. Reject duplicate archived initialization | Both-chain preflight and exact-preservation regressions | Matching the correct chain and dated id |
| 2. Add verified post-init source cleanup | Standalone cleanup mode and real Git acceptance | Deleting an input without retained bytes |
| 3. Integrate both skills and document the lifecycle | Normal-entry-point ordering, reporting and reference updates | Cleanup launched before commit retention or on resume |

Wave 4's setup script is already present, and verification uses Node 24+ and Git. Estimated effort is three implementation phases with real Git integration tests.

## Open Risks & Assumptions

- The unattended instruction supplies evidence-based decisions in place of the skill interview and phase approvals. Complexity is medium.
- Saved setup JSON gates fresh-only execution. The executable independently verifies actual Git and filesystem identity before deletion.
- External editors do not share the setup lock. Final identity, tracking and byte rechecks preserve observed concurrent changes, with a residual filesystem race during unlink.
- Cleanup failures preserve surviving files and report diagnostics. The caller retains the original successful setup result independently.
- Live host acceptance remains a pending Manual row. The full repository suite runs during implementation.

## Success Criteria (Summary)

- Both chains refuse duplicate initialization while preserving repository state.
- Every removed source file is recoverable from the isolated start commit, and tracked or changed files remain.
- Fresh runs invoke cleanup in order, resumes delete nothing, retained paths are visible, and automated acceptance passes.

## References

- [Change brief](change.md)
- [Wave 5 ownership](../WAVES.md)
- [ADR-010 setup and start-commit contract](../../../docs/ADR/ADR-010-run-worktree-step-commits-and-rollback.md)
- [ADR-016 deletion procedure](../../../docs/ADR/ADR-016-no-recursive-force-delete.md)
