---
change_id: run-state-lock
title: "usage and next can overwrite each other's run.jsonl: add a lock"
status: new
created: 2026-11-11
updated: 2026-11-11
archived_at: null
---

## Notes

GitHub issue #92.

## What this is

`next` and `usage` both read `run.jsonl`, change it in memory and write the whole file back (`writeLog`, `skills/10x-pipeline/scripts/state.mjs:373`; `usageCommand`, `scripts/route.mjs:688-762`).

## Problem

Only a prompt rule keeps the two apart: rule 3 of the anti-stall rules says the `usage` call is "never alongside another router call". The router does not enforce it. When an orchestrator sends both calls in one turn, the later write drops the other's change.

## Fix

Take a lock file with `fs.openSync(lock, "wx")` at the start of `init`, `next` and `usage`, remove it on exit, and halt with a clear message when it exists. About 10 lines.

## If we skip it

A lost pending entry makes the router return the same step again, so the step runs twice. A lost `usage` write drops the figure, and `compare` then reports `usage-incomplete`.


Found by a whole-repo audit on 2026-11-11 at `be0ab00` (v1.4.3). The test suite passes (982 of 984, 2 skipped), so no test covers this.

Runs in parallel with the other 12 issue changes (#87 to #99). Overlap is likely in the same router modules, `docs/REFERENCE.md` and `AGENTS.md`; whichever merges later rebases and resolves the conflict. Add an ADR only when the change needs one.
