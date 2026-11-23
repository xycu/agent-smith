# Lock-free pending checks and a bounded setup temp (F2, F3) — Plan Brief

> Full plan: `context/changes/prepare-run-setup-lock-and-residue-followups/plan.md`
> Frame brief: `context/changes/prepare-run-setup-lock-and-residue-followups/frame.md`

## What & Why

> **The actual problems to plan around are**: (F1) the overlay copy has no rule for paths in the start commit's change folder that are gone from the source; (F2) a read-only opt-out check takes a write lock for a file the writer already publishes atomically; (F3) the stranded temp file is inert for recovery, so the defect is a leftover plus a test that cannot see it.

This plan closes F2 and F3. F1 moves to the later change `prepare-run-deletion-propagation`.

## Starting Point

`checkCurrentPending` takes the branch setup lock only to read `<base>.pending`, so a stale lock fails an isolation-off call that used to return `opt-out` (reproduced). `writePending` stages in `<base>.pending.<uuid>.tmp`. A SIGKILL before the rename leaves that temp and the lock, and the leftovers test cannot see the temp (reproduced).

## Desired End State

A linked worktree with isolation off can return `opt-out` with a stale lock, and both pre-selection checks perform no writes. A killed publication can leave one `<base>.pending.tmp`, which the next updated writer replaces under the branch lock. Published or invalid pending records still refuse with the same guidance.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Deletion propagation (F1) | Separate change `prepare-run-deletion-propagation` | It needs its own copy contract and deletion safeguards. | Frame |
| Lock-free call sites | The opt-out and different-current-branch pre-selection checks at `:328` and `:376` | The resolved branch's main lock at `:378` still serializes setup. | Plan |
| Vanished marker | Treat a payload read's `ENOENT` as absence when a second `lstat` confirms it | This handles concurrent unlink while preserving diagnostics for other errors. | Plan |
| Invalid or non-regular record | Still refuses with the inspect message | An unreadable record must not be taken for "no pending setup". | Frame |
| F3 temp handling | One fixed name `<base>.pending.tmp`, replaced under the lock at either publication | Residue is bounded to one file and needs no directory scan. | Plan |
| Old UUID temps | Documented, removed by hand | Scanning for them adds code for a rare, inert leftover. | Plan |

## Scope

**In scope:** `checkCurrentPending`, `readPending`, the marker path helper and `writePending` in `prepare-run.mjs`, CLI regression tests, `docs/REFERENCE.md`, ADR-010 Amendment 8 and its index row.

**Out of scope:** F1; cleaning legacy UUID temps; the `writePending` catch-block masking; exporting internals for unit tests; any `SKILL.md` edit.

## Architecture / Approach

The Git common directory holds `<base>.lock`, `<base>.pending` and `<base>.pending.tmp` per branch. Only the pre-selection reader allows disappearance during read. The main lock keeps guarding the resolved worktree, copying, validation and project gates, and serializes temp replacement by `writePending`. Tests drive the setup CLI in scratch repos with path-scoped preloads for read errors and interrupted renames.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Lock-free pending checks and a bounded temp | F2 and F3 code in `prepare-run.mjs` | The lock-free read must keep refusing real and invalid records. |
| 2. Regression tests and docs | CLI tests, `.tmp` in the leftovers check, REFERENCE, ADR-010 Amendment 8 | Deliberate breaks must fail the matching assertions. |

**Prerequisites:** Node 24+ and local Git. The pinned base `bf8a105a` includes pending-copy retry and Wave 4's `run-root-worktree-readiness`. The unattended pipeline proceeds after focused checks and leaves the Phase 1 Manual rows for manual verification.
**Estimated effort:** Two phases, about one session.

## Open Risks & Assumptions

- A retry that skips publishing, or uses an older writer, can leave the fixed temp. Legacy UUID temps also require manual cleanup after the operator confirms setup and its descendants have stopped. Keep the canonical record for recovery.
- A downgrade can recreate UUID residue and the stale-lock failure. Finish pending readiness recovery on a compatible version before rollback.

## Success Criteria (Summary)

- A stale lock alone permits an isolation-off opt-out, and no file is created or removed in the Git common directory.
- A SIGKILL before either rename, followed by manual lock removal and a retry that publishes a record, leaves no setup temp. The leftovers check covers `.tmp`.
- Focused setup and deletion-guard tests pass, and the docs describe the new behavior. Full-suite row 2.2 is Manual for CI confirmation after publication or an owner-requested local run.

## References

- Frame: `context/changes/prepare-run-setup-lock-and-residue-followups/frame.md`
- `skills/10x-pipeline/scripts/prepare-run.mjs`, `skills/10x-pipeline/test/prepare-run.test.mjs`
- `docs/REFERENCE.md:179`, `docs/ADR/ADR-010-run-worktree-step-commits-and-rollback.md` (Amendments 6 and 7), `context/changes/WAVES.md`
