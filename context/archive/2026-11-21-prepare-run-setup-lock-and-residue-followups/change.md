---
change_id: prepare-run-setup-lock-and-residue-followups
title: Close the three prepare-run follow-ups from the PR 252 review
status: archived
created: 2026-11-21
updated: 2026-11-24
archived_at: 2026-11-24T22:04:39Z
---

## Notes

Follow-ups from impl-review observations F1-F3 of PR #252 (`prepare-run-retry-after-failed-setup`). Depends on PR #252 merging first: the code below is in `prepare-run.mjs` as that PR leaves it.

- F1, deletion propagation: an uncommitted deletion in a change folder is undone by the worktree checked out from HEAD, so a stale `plan.md` reappears. This needs its own copy contract with deletion safeguards.
- F2, `checkCurrentPending` in `prepare-run.mjs` takes the branch setup lock for opt-out calls from a linked worktree, so a stale lock fails a call that used to return `opt-out`. Read the pending file lock-free for that check.
- F3, `writePending` can leave a `.pending.<uuid>.tmp` file after SIGKILL. Make it harmless and documented or cleaned, and extend the leftovers test to match the `.tmp` suffix.
