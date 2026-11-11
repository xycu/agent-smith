---
change_id: init-needs-change-md
title: "init and next write run state for a 10x change that has no change.md"
status: planned
created: 2026-11-11
updated: 2026-11-11
archived_at: null
---

## Notes

GitHub issue #96.

## What this is

For the 10x chain, `init` and `next` create `context/changes/<id>/agent-smith/` (`skills/10x-pipeline/scripts/route.mjs:69` and `:870`) before `decide` checks that `change.md` exists.

## Problem

A mistyped id leaves a folder with `meta.json`, `run.jsonl` and `report.md`, and in an isolated run a `chore(<id>): start run` commit, before the halt `No change folder. Run /10x-new <id> first.` The OpenSpec branch already halts before it writes anything, and `docs/REFERENCE.md` lists the empty folder as a known limit there.

The orchestrator skill checks `change.md` first, so only a hand-run command causes it.

## Fix

Check `change.md` before `mkdirSync`, with the same halt text, as the OpenSpec branch does for its change folder.

## If we skip it

Hand-run commands leave junk folders, which must be removed by hand and can collide with a later OpenSpec run of that name.


Found by a whole-repo audit on 2026-11-11 at `be0ab00` (v1.4.3). The test suite passes (982 of 984, 2 skipped), so no test covers this.

Runs in parallel with the other 12 issue changes (#87 to #99). Overlap is likely in the same router modules, `docs/REFERENCE.md` and `AGENTS.md`; whichever merges later rebases and resolves the conflict. Add an ADR only when the change needs one.
