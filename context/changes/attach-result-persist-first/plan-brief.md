# Persist the step result before deleting last-result.json — Plan Brief

> Full plan: `context/changes/attach-result-persist-first/plan.md`

## What & Why

`attachResult` deletes `last-result.json` before the log entry holding the result is written to `run.jsonl`. A router error after it loses the step's status, usage, signals and verification, and the next `next` demands a result again (a full step rerun). Fix the order and add regression tests.

## Starting Point

`attachResult` (`flow.mjs:486`) fills the entry in memory and returns; `next()` writes the log later (skip loop, `endRun`, ok-step `stepCommit`, rollback, or the next push). `neutralRetry` already writes right after its delete.

## Desired End State

An error anywhere after `attachResult` keeps the result in `run.jsonl`. After the cause is fixed, `next` routes on with no result file and no rerun. No commit holds `last-result.json`.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Where to write | End of `attachResult`, then delete the file | Smallest change; file still gone before `stepCommit` and `rollback` | Plan (from `change.md`) |
| `neutralRetry` | Unchanged | Already writes the log after its delete | Plan |
| Test placement | New `result-persist.test.mjs` | Isolated case needs hermetic-git helpers that `route.test.mjs` lacks | Plan |
| Isolated case entry | Failed `score` (advisory) entry | Neither `stepCommit` nor `rollback` writes the log for it | Plan |
| Way to throw | `rigor: { levels: null }` in the override | `ladder: []` is halted at load by `policyProblems` (ADR-022); `rigor.levels` is read only in `resolveRigor`, after `attachResult` | Plan review F1 |

## Scope

**In scope:** reorder in `flow.mjs`; new test file with two cases. `AGENTS.md` is not edited (owned by `agents-md-slim` in this wave).

**Out of scope:** OpenSpec-chain test, `rigor.levels` validation at load, `SKILL.md`/`REFERENCE.md` edits, other routing code.

## Architecture / Approach

Tests first (red), then move `fs.rmSync(p.result)` after a new `writeLog(p.log, log)` at the end of `attachResult`. Run the full suite.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Regression tests | Two failing tests: plain and isolated | Isolated setup copies helpers |
| 2. Fix and wiring | Reorder, green suite | An existing test relies on the old order |

**Prerequisites:** Node 24, git.
**Estimated effort:** ~1 session, 2 small phases.

## Open Risks & Assumptions

- Assumes a failed `score` entry stays unwritten before `decide` on the current code; Phase 1 confirms it by failing red.
- A kill between the new `writeLog` and the `rmSync` leaves a stale `last-result.json` (an isolated run's step commit would commit it); not handled, window is two adjacent sync calls.

## Success Criteria (Summary)

- A router error after `attachResult` keeps the result in `run.jsonl`; the next `next` routes on.
- Suite passes locally and CI is green.
