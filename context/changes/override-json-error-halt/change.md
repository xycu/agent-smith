---
change_id: override-json-error-halt
title: "A project override file with a JSON error is ignored silently"
status: new
created: 2026-11-11
updated: 2026-11-11
archived_at: null
---

## Notes

GitHub issue #88.

## What this is

`context/foundation/agent-smith-policy.json` lets a project override policy keys. `mergedPolicy` reads it with `readJson(file, null)` (`skills/10x-pipeline/scripts/state.mjs:34-44`).

## Problem

When the file has a JSON error, `readJson` returns `null` and the router runs on the shipped defaults, with no message.

## Reproduce

Write the override as `{ "isolation": { "require": false }, "limits": { "maxTotalSteps": 1 }, }` (trailing comma) in a project without git and run `init`. The router halts with `Run isolation (isolation.require) needs a git work tree ... To run without isolation, set { "isolation": { "require": false } } in context/foundation/agent-smith-policy.json.`, which is the key the file already sets.

## Fix

In `mergedPolicy`, halt with the file name when the file exists and does not parse. A missing file stays "no override". About 4 lines.

## If we skip it

Opt-outs, limits, prices and a pinned baseline policy are dropped silently, and the user debugs the wrong thing.


Found by a whole-repo audit on 2026-11-11 at `be0ab00` (v1.4.3). The test suite passes (982 of 984, 2 skipped), so no test covers this.

Runs in parallel with the other 12 issue changes (#87 to #99). Overlap is likely in the same router modules, `docs/REFERENCE.md` and `AGENTS.md`; whichever merges later rebases and resolves the conflict. Add an ADR only when the change needs one.
