---
change_id: coverage-and-failed-undo-test
title: Measure coverage in CI and test the halt text of a rollback that was not undone
status: new
created: 2026-11-12
updated: 2026-11-12
archived_at: null
---

## Notes

Source: the repo review of 2026-11-12 (tests, tools and CI audit). Severity: medium.

### Problem

The suite drives the router through the CLI in child processes, and nothing measures which branches those processes reach. So an untested branch is found only by reading. One was found:

- `skills/10x-pipeline/scripts/route.mjs:94` and `:964` build the halt text for the case where the undo of a failed-step rollback itself fails: "The rollback was not undone: … The partial edits are kept under `<ref>`." This sentence is the user's only pointer to the snapshot ref that holds their uncommitted work.
- `grep -rn "not undone" skills/10x-pipeline/test/` has no hit. A change that breaks this branch, or drops the ref from the text, passes the suite.

Measuring is possible with no dependency: Node's built-in coverage follows the spawned router. `node --test --experimental-test-coverage skills/10x-pipeline/test/override-json.test.mjs` reports `route.mjs` 17.79% lines, `state.mjs` 40.10%, `flow.mjs` 17.87% with the uncovered line ranges, for that one file.

### Fix direction

1. Add `--experimental-test-coverage` to the test command of `.github/workflows/ci.yml`, so that each CI log ends with the per-file table. No threshold at first. If the flag slows the run noticeably, use a second, non-blocking step instead.
2. Read the first full table and list the uncovered ranges of `route.mjs`, `flow.mjs`, `steps.mjs` and `isolation.mjs` that hold halt or recovery paths; add tests for those, starting with the failed undo: an isolated run, a failed step, a rollback, then an undo that cannot be applied (for example a snapshot ref that was removed, or a fake `git` on PATH that fails `stash apply` or the equivalent call), asserting the reason text and the ref name at both call sites.
3. Later, when the number is stable: `--test-coverage-lines=<n>` as a floor.

### Tests

- The new rollback test in `rollback.test.mjs`.
- The CI log shows the coverage table.

### Done when

A CI log shows line coverage per router module, and the failed-undo halt text is asserted by a test at both places that build it.
