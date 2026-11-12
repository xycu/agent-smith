---
change_id: at-or-above-helper
title: "The rigor gate test is written seven times"
status: archived
created: 2026-11-11
updated: 2026-11-12
archived_at: 2026-11-12T12:39:42Z
---

## Notes

GitHub issue #97.

## What this is

"Is the run's level at or above `minRigor`" is written as three `levels.indexOf` calls:

```js
levels.indexOf(level) < 0 || levels.indexOf(cfg.minRigor) < 0 || levels.indexOf(level) < levels.indexOf(cfg.minRigor)
```

## Problem

Seven copies of one rule: `skills/10x-pipeline/scripts/steps.mjs:125`, `161`, `305`, `503` and `scripts/preplan.mjs:162`, `246`, `319`.

## Fix

One helper `atOrAbove(policy, level, minRigor)` in `state.mjs`, used in all seven places.

## If we skip it

A change to the rule must be made in seven places.


Found by a whole-repo audit on 2026-11-11 at `be0ab00` (v1.4.3). The test suite passes (982 of 984, 2 skipped), so no test covers this.

Runs in parallel with the other 12 issue changes (#87 to #99). Overlap is likely in the same router modules, `docs/REFERENCE.md` and `AGENTS.md`; whichever merges later rebases and resolves the conflict. Add an ADR only when the change needs one.
