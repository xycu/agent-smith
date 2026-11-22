# Lock-free pending checks and a bounded setup temp (F2, F3) — Plan Brief

> Full plan: `context/changes/prepare-run-setup-lock-and-residue-followups/plan.md`
> Frame brief: `context/changes/prepare-run-setup-lock-and-residue-followups/frame.md`

## What & Why

> **The actual problems to plan around are**: (F1) the overlay copy has no rule for paths in the start commit's change folder that are gone from the source; (F2) a read-only opt-out check takes a write lock for a file the writer already publishes atomically; (F3) the stranded temp file is inert for recovery, so the defect is a leftover plus a test that cannot see it.

This plan closes F2 and F3. F1 moves to the later change `prepare-run-deletion-propagation`.

## Starting Point

`checkCurrentPending` takes the branch setup lock only to read `<marker>.pending`, so a stale lock fails an isolation-off call that used to return `opt-out` (reproduced). `writePending` stages in `<marker>.<uuid>.tmp`; a SIGKILL before the rename leaves that file for good, and the leftovers test cannot see it (reproduced).

## Desired End State

A linked worktree with isolation off returns `opt-out` even with a stale lock, and the pre-selection checks create no file. A killed write leaves one `<marker>.tmp` that the next write replaces, so a successful retry leaves no temp. Published or invalid pending records still refuse with the same guidance.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Deletion propagation (F1) | Separate change `prepare-run-deletion-propagation` | It needs its own copy contract and deletion safeguards. | Frame |
| Lock-free call sites | Both `:248` and `:295` | One lock-free reader, and the main lock at `:297` still serializes setup. | Plan |
| Vanished marker | Treat as absent after a re-`lstat` | The writer's unlink is atomic, so an `ENOENT` means setup finished. | Plan |
| Invalid or non-regular record | Still refuses with the inspect message | An unreadable record must not be taken for "no pending setup". | Frame |
| F3 temp handling | One fixed name `<marker>.tmp`, replaced under the lock | Residue is bounded to one file and needs no directory scan. | Plan |
| Old UUID temps | Documented, removed by hand | Scanning for them adds code for a rare, inert leftover. | Plan |

## Scope

**In scope:** `checkCurrentPending`, the marker path helper and `writePending` in `prepare-run.mjs`; CLI regression tests; `docs/REFERENCE.md`, ADR-010 Amendment 7 and its index row.

**Out of scope:** F1; cleaning legacy UUID temps; the `writePending` catch-block masking; exporting internals for unit tests; any `SKILL.md` edit.

## Architecture / Approach

The Git common directory holds `<marker>.lock`, `.pending` and now `.tmp` per branch. The pre-selection check reads only `.pending` through the existing reader plus one re-`lstat`. The main lock keeps guarding selection, copy and validation, and also makes it safe for `writePending` to unlink a stale `.tmp`. Tests drive the setup CLI in scratch repos with two small `--import` preloads (kill at rename, vanish at read).

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Lock-free pending checks and a bounded temp | F2 and F3 code in `prepare-run.mjs` | The lock-free read must keep refusing real and invalid records. |
| 2. Regression tests and docs | CLI tests, `.tmp` in the leftovers check, REFERENCE, ADR-010 Amendment 7 | Tests must fail when the code change is reverted. |

**Prerequisites:** Node 24+ and local Git. The earlier pending-copy retry (ADR-010 Amendment 6) is on `main`. WAVES.md lists `run-root-worktree-readiness` as editing the same file, so land one change first.
**Estimated effort:** Two phases, about one session.

## Open Risks & Assumptions

- `run-root-worktree-readiness` also edits `prepare-run.mjs`; WAVES.md says overlapping functions move the lower-priority change to a later wave.
- Legacy `.pending.<uuid>.tmp` files stay until removed by hand.
- A downgrade can recreate the UUID temp and the stale-lock failure.

## Success Criteria (Summary)

- A stale lock alone permits an isolation-off opt-out, and no file is created or removed in the Git common directory.
- A SIGKILL before the rename plus a manual lock removal and a retry leaves no `.tmp`; the leftovers check covers `.tmp`.
- The setup tests and the full suite pass, and the docs describe the new behavior.

## References

- Frame: `context/changes/prepare-run-setup-lock-and-residue-followups/frame.md`
- `skills/10x-pipeline/scripts/prepare-run.mjs`, `skills/10x-pipeline/test/prepare-run.test.mjs`
- `docs/REFERENCE.md:160-161`, `docs/ADR/ADR-010-run-worktree-step-commits-and-rollback.md` (Amendment 6)
