---
change_id: budget-halt-after-done
title: "A finished run is reported as halted when it ends exactly on the step budget"
status: new
created: 2026-11-11
updated: 2026-11-11
archived_at: null
---

## Notes

GitHub issue #87.

## What this is

Each run has a step budget (12, 19 or 24 by rigor level). `next` checks it before it decides the next step (`skills/10x-pipeline/scripts/route.mjs:112-115`).

## Problem

A run that uses its last budget step and is complete gets `halt: Step budget 12 spent.` instead of `done`. The longest failure-free path plus one failed step and its retry lands exactly on the budget (10 + 2 = 12 at `lean`, 17 + 2 = 19 at `standard`), which `docs/REFERENCE.md` says "still fit".

## Reproduce

A scratch project with a plan whose Automated rows are all ticked, a `SOUND` plan review, an `APPROVED` implementation review and a log of ok entries that ends in `impl-review`:

- 11 logged steps: `init` prints `done`, `impl review APPROVED`.
- 12 logged steps: `init` prints `halt`, `Step budget 12 spent.`

## Fix

Call `decide` first and apply the budget check only when it returns a step to run (not `done`, not `halt`).

## If we skip it

A good run shows as failed, an `--archive` run is never archived, and every resume halts again until the budget is raised by hand. The budget halt also hides the more useful halt texts of `decide`.


Found by a whole-repo audit on 2026-11-11 at `be0ab00` (v1.4.3). The test suite passes (982 of 984, 2 skipped), so no test covers this.

Runs in parallel with the other 12 issue changes (#87 to #99). Overlap is likely in the same router modules, `docs/REFERENCE.md` and `AGENTS.md`; whichever merges later rebases and resolves the conflict. Add an ADR only when the change needs one.
