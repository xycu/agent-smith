---
change_id: init-goal-flag
title: "init drops a goal that starts with -- and cuts an unquoted goal to one word"
status: new
created: 2026-11-11
updated: 2026-11-11
archived_at: null
---

## Notes

GitHub issue #90.

## What this is

`parseFlags` reads `--goal <text>` for `init` (`skills/10x-pipeline/scripts/state.mjs:14-23`). A flag takes the next argument as its value unless that argument starts with `--`. Arguments that belong to no flag are skipped.

## Problem

- A goal that starts with `--` is read as a flag. The goal is then empty and the run still starts.
- An unquoted goal keeps only its first word.

## Reproduce

- `route.mjs init demo --goal "--verbose flag should print timings"` prints `run`, and `meta.json` holds `"goal": ""`.
- `route.mjs init demo --goal fix the bug` stores `"goal": "fix"`.

## Fix

For `--goal`, always take the next argument as the value. Halt on leftover words that belong to no flag.

## If we skip it

The plan step runs with no goal or a one-word goal, the goal class and the rigor level are picked from the wrong text, and tokens are spent on the wrong work.


Found by a whole-repo audit on 2026-11-11 at `be0ab00` (v1.4.3). The test suite passes (982 of 984, 2 skipped), so no test covers this.

Runs in parallel with the other 12 issue changes (#87 to #99). Overlap is likely in the same router modules, `docs/REFERENCE.md` and `AGENTS.md`; whichever merges later rebases and resolves the conflict. Add an ADR only when the change needs one.
