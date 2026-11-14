# Split the budget executors test file — Plan Brief

> Full plan: `context/changes/budget-test-file-split/plan.md`

## What & Why

`budget-executors.test.mjs` holds eight slow tests that run in series, about 200 s of the suite's 206 s CI wall time. `node --test` runs files in parallel, so splitting the file along its tests and moving the shared walkers into a helper module cuts the wall time without touching any test.

## Starting Point

One 468-line file with fixtures, a plan renderer, two walkers (`walkFixture`, `walkAware`) and eight tests. The repo already shares helpers between test files (`helpers.mjs`, `phase-helpers.mjs`). Only the test README indexes the file.

## Desired End State

Four test files and `budget-helpers.mjs`. The same eight test names pass, the suite's test count is unchanged, and the CI wall time is under 90 s (floor about 62 s, the single slowest test).

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Number of files | Four, balanced by CI times (29 / 54 / 54 / 62 s) | The 62.5 s test cannot be split without a body edit | Plan |
| Which file keeps the old name | `budget-executors.test.mjs` with the three fast tests | ADR-011/012 and archived plans still name it correctly | Plan |
| Helper name | `budget-helpers.mjs` | Matches `phase-helpers.mjs`; not `*.test.mjs`, so CI does not run it | Plan |
| Optional `:428` split by rigor | Out of scope | Needs test body edits; change.md marks it optional | Plan |
| Docs to update | Test README only | `AGENTS.md` no longer lists test files | Plan |

## Scope

**In scope:** new helper module, three new test files, README index rows, moving code verbatim.

**Out of scope:** body edits, the optional rigor-level split, ADR edits, CI config, router or policy changes.

## Architecture / Approach

Phase 1 moves the shared code to the helper and keeps one file green. Phase 2 moves tests into four files, each registering `after(cleanupAll)` itself, and updates the index.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Extract the helper module | `budget-helpers.mjs`; original file imports it | A missed export breaks a test at run time |
| 2. Split into four files | Four test files, README rows | Lost test or changed body; CI time depends on runner cores |

**Prerequisites:** none.
**Estimated effort:** about 2 short sessions; each full suite run takes several minutes locally.

## Open Risks & Assumptions

- The 90 s target cannot be shown locally. It depends on the CI runner's core count (`node --test` concurrency is cores minus one).
- Assumption: the CI times in change.md hold, so the 62.5 s test sets the floor.
- Assumption: the sensible reading of "about four files" is four exactly, with three new names chosen here.

## Success Criteria (Summary)

- Same eight test names and the same total test count; full suite green.
- CI `duration_ms` under 90 s, compared with 205.9 s before.
