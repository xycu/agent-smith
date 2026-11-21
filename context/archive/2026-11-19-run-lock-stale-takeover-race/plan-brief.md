# Exclusive stale run-lock takeover — Plan Brief

> Full plan: `context/changes/run-lock-stale-takeover-race/plan.md`

## What & Why

Two router processes that find the same stale run lock can both take it, and then both write `run.jsonl`; the last writer silently drops the other's record. The plan makes the stale takeover exclusive, keeps the lock format, improves the busy message for a live pid, and proves exclusion with a multi-process test.

## Starting Point

`lockRunDirectory` in `skills/10x-pipeline/scripts/run-lock.mjs` (not `state.mjs`, which only forwards) links a pid temp file to the lock name. On `EEXIST` it deletes a stale lock and retries once, so a second caller can delete the first caller's fresh lock. The audit reproduced overlaps in 8 of 200 rounds (2 processes) and 12 of 150 (8 processes).

## Desired End State

At most one process holds a run lock at any instant, even when many find it stale together. Native and execution locks are never taken over. The lock path and format are unchanged. A live-pid halt tells the owner how to check the pid and when to remove the lock file.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Fix shape | Takeover guard `${lock}.takeover`, re-read under it, then delete and link | A guard proves exclusion; a re-read after a wait only narrows the window. |
| Guard held by a live pid | Poll about 20 ms, budget about 1 s, then halt busy naming the guard | The guard is held for microseconds, so a longer hold means something is wrong. |
| Guard of a dead pid | Halt and say to remove the file | Removing it would reopen the race; exclusion beats self-healing in a crash-in-a-microsecond case. |
| Lost link after delete | Loop again and classify the new owner | A caller that saw no lock needs no guard and may have linked first. |
| Older plugin versions | Accepted limit, documented | The lock format must not change, so old versions cannot use the guard. |
| Test shape | Long-lived workers on a shared time grid, one stale lock per round | One spawn per worker keeps 120 rounds near 6 s. |
| Red proof | `LOCK_MODULE` env points the worker at the pre-fix source | It shows the harness fails without the fix, without a red commit. |

## Scope

**In scope:** `run-lock.mjs` takeover and live-pid message; focused tests; multi-process test and worker; `docs/REFERENCE.md` limit; test README rows.

**Out of scope:** reused-pid detection; native and execution branches; lock path or format; `tools/test-durations.json`; an ADR.

## Architecture / Approach

The `EEXIST` branch becomes a bounded loop. One classifier returns a busy reason or "stale". Busy reasons halt as today. A stale result takes the guard, classifies again, and only then deletes and links, releasing the guard in a `finally` and in `release()`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Exclusive takeover, safe guard, clearer message | Fixed `run-lock.mjs`, focused tests, updated limit in `REFERENCE.md` | Existing tests pin message text and leftovers |
| 2. Multi-process exclusion proof | Worker helper, overlap test, red proof on the pre-fix module | Timing flakiness; rounds must fail pre-fix every time |

**Prerequisites:** none; Node 24 and `main` reachable for the pre-fix source.
**Estimated effort:** about 2 sessions across 2 phases.

## Open Risks & Assumptions

- Assumed, no human to ask: guard design over the wait alternative, halt on a dead-pid guard, 1 s wait budget; grounded in `change.md` Direction and the constraint that exclusion must not weaken.
- Round count (about 120) and worker count (about 6) are starting values; Phase 2 tunes them until the pre-fix run fails 5 of 5.
- The test adds about 7 s to a file listed at 14.4 s; shard timings are refreshed by another change.

## Success Criteria (Summary)

- The multi-process test passes on the fix and fails on the pre-fix module.
- Single-caller stale recovery, native retention and the full suite pass.
- `docs/REFERENCE.md` no longer says that two callers can both take a stale lock.
