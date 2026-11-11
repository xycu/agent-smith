---
change_id: agents-md-no-imports
title: "AGENTS.md imports README.md and REFERENCE.md into every session (158 KB)"
status: planned
created: 2026-11-11
updated: 2026-11-11
archived_at: null
---

## Notes

GitHub issue #93.

## What this is

`AGENTS.md:3` says "See @README.md for install and use, and @docs/REFERENCE.md for routing behavior." The `@` imports the whole file into the session context.

## Problem

Every session in this repository, and every subagent started in it, loads `AGENTS.md` (28 KB), `README.md` (4.5 KB) and `docs/REFERENCE.md` (125 KB) before any work starts: about 158 KB of text.

## Fix

Write `docs/REFERENCE.md` (and `README.md`) without the `@`, so an agent reads them only when the task needs them.

## If we skip it

Every session here pays for that text and has less room for the task.


Found by a whole-repo audit on 2026-11-11 at `be0ab00` (v1.4.3). The test suite passes (982 of 984, 2 skipped), so no test covers this.

Runs in parallel with the other 12 issue changes (#87 to #99). Overlap is likely in the same router modules, `docs/REFERENCE.md` and `AGENTS.md`; whichever merges later rebases and resolves the conflict. Add an ADR only when the change needs one.
