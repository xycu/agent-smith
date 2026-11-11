---
change_id: file-guard-dedup
title: "File guards and the plan Files parser are duplicated"
status: new
created: 2026-11-11
updated: 2026-11-11
archived_at: null
---

## Notes

GitHub issue #98.

## What this is

Two small rules exist in several copies under `skills/10x-pipeline/scripts/`:

- "A regular file, whose real path lies inside the real folder, under a size cap": `steps.mjs:329-341` (`evidenceOk`), `steps.mjs:390-402` (`readUnprovenReasons`), `openspec.mjs:23-30` (`readGuarded`), `preplan.mjs:197-207` (`readComplexity`).
- The parser of the `**File**:` and `**Files**:` lines of a plan: `state.mjs:618-632` (`planPaths`) and `steps.mjs:133-149` (`phaseFiles`).

## Problem

A safety check fixed in one copy stays open in the others. The copies already differ: `readComplexity` checks no real path, and `evidenceOk` uses `statSync` where the others use `lstatSync`.

## Fix

Keep `readGuarded` and one path parser, and call them from the other places.

## If we skip it

More code to read and test for the same rule.


Found by a whole-repo audit on 2026-11-11 at `be0ab00` (v1.4.3). The test suite passes (982 of 984, 2 skipped), so no test covers this.

Runs in parallel with the other 12 issue changes (#87 to #99). Overlap is likely in the same router modules, `docs/REFERENCE.md` and `AGENTS.md`; whichever merges later rebases and resolves the conflict. Add an ADR only when the change needs one.
