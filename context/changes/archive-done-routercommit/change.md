---
change_id: archive-done-routercommit
title: "archiveDone duplicates the commit and post-commit checks of routerCommit"
status: new
created: 2026-11-11
updated: 2026-11-11
archived_at: null
---

## Notes

GitHub issue #94.

## What this is

`routerCommit` (`skills/10x-pipeline/scripts/isolation.mjs:322-357`) stages, commits and runs the post-commit checks: the index is empty, the commit holds only the change folder, the folder is clean. `archiveDone` (`isolation.mjs:645-672`) does the same steps inline.

## Problem

The two copies must change together, and they already differ in details (prefix handling of the listed names, error texts, timeout note).

## Fix

Let `archiveDone` call `routerCommit(g, timeout, { rel, message })` and map its result to the archive halt fields (`archive`, `committed`). About 30 lines less.

## If we skip it

A fix to one commit path misses the other.


Found by a whole-repo audit on 2026-11-11 at `be0ab00` (v1.4.3). The test suite passes (982 of 984, 2 skipped), so no test covers this.

Runs in parallel with the other 12 issue changes (#87 to #99). Overlap is likely in the same router modules, `docs/REFERENCE.md` and `AGENTS.md`; whichever merges later rebases and resolves the conflict. Add an ADR only when the change needs one.
