---
change_id: pr-scripts-shared
title: "open-pr.mjs and pr-comment.mjs hold copied helpers that drift"
status: impl_reviewed
created: 2026-11-11
updated: 2026-11-11
archived_at: null
---

## Notes

GitHub issue #95.

## What this is

`skills/10x-pipeline/scripts/open-pr.mjs` and `scripts/pr-comment.mjs` each hold their own copy of `firstLine`, the `gh` runner, the id pattern, the `--report` path check, the mention rule, the 60000 cap with its truncation and the entry-point check (`open-pr.mjs:74-99`, `316-332`, `445-451`; `pr-comment.mjs:76-100`, `149-157`, `252-258`).

## Problem

The copies drift. Two examples:

- `pr-comment.mjs` wraps its temp-folder cleanup in `try`. `open-pr.mjs:368-370` does not, so a cleanup error after a good push and a created pull request ends in `internal error` with `pushed: false`.
- `pr-comment.mjs` writes the zero-width space as `​`. `open-pr.mjs:325` holds the invisible character itself.

## Fix

Move the shared helpers to one small module that both scripts import. `open-pr.mjs` already imports `remove-tree.mjs`, so an import is allowed. About 60 lines less.

## If we skip it

The next change to mention handling, the cap or the `gh` error mapping lands in one script only.


Found by a whole-repo audit on 2026-11-11 at `be0ab00` (v1.4.3). The test suite passes (982 of 984, 2 skipped), so no test covers this.

Runs in parallel with the other 12 issue changes (#87 to #99). Overlap is likely in the same router modules, `docs/REFERENCE.md` and `AGENTS.md`; whichever merges later rebases and resolves the conflict. Add an ADR only when the change needs one.
