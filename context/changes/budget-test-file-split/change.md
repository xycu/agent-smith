---
change_id: budget-test-file-split
title: Split the budget executors test file that sets the suite wall time
status: impl_reviewed
created: 2026-11-12
updated: 2026-11-13
archived_at: null
---

## Notes

Source: the repo review of 2026-11-12 (tests, tools and CI audit). Severity: low (speed of every CI run and every local run).

### Problem

`node --test` runs test files in parallel and the tests of one file in series. One file, `skills/10x-pipeline/test/budget-executors.test.mjs`, holds eight slow tests, so the whole suite waits for it.

CI run 43134692634 (`duration_ms 205939`), times from the log:

| Test (line) | Seconds |
| --- | --- |
| longest legal path (`:232`) | 25.0 |
| failure path fits (`:245`) | 2.1 |
| lean runs manual-verify and no pool step (`:269`) | 1.8 |
| raised cap exceeds budget (`:306`) | 27.9 |
| scorer failures skip (`:324`) | 26.5 |
| confirm rounds ship off … (`:412`) | 25.2 |
| each confirm round adds … (`:428`) | 62.5 |
| a confirm round with the shipped budgetDelta … (`:455`) | 28.9 |

Sum: 199.9 s, 97% of the suite's wall time. The next slowest test of any other file takes 11 s. The audit counted 3,114 router processes for this file in a local run (151 `init`, 2,876 `next`, 87 `status`) and noted that the test at `:428` repeats the walks with confirm rounds off that `:412` already did; neither was repeated here.

### Fix direction

- Split the file along its tests into about four files; move the walkers (`walkFixture`, `walkAware`) and fixtures into a helper module next to `phase-helpers.mjs`. No test body changes. The wall time then falls to about the longest part, near 65 s on CI.
- Optional second step: split the `:428` test by rigor level and reuse one walk per (fixture, level, script) inside a file.
- Update the `budget-executors.test.mjs` entry in `AGENTS.md` (or in the test index, if `agents-md-slim` has landed).

### Tests

- The same test names pass, and the total number of tests is unchanged.
- Compare `duration_ms` of the CI run before and after.

### Done when

The suite's CI wall time is under 90 seconds with the same tests.
