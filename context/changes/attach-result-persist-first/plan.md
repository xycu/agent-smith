# Persist the step result before deleting last-result.json Implementation Plan

## Overview

`attachResult` in `skills/10x-pipeline/scripts/flow.mjs` deletes `agent-smith/last-result.json` before the log entry that holds the result reaches `run.jsonl`. A router error between `attachResult` and the next `writeLog` loses the result and forces a full rerun of a finished step. Fix: write the log first, delete the file after. Add regression tests for the 10x chain (non-isolated) and an isolated run with a non-ok, non-rollback entry.

## Current State Analysis

- `attachResult` (`flow.mjs:486-558`) calls `fs.rmSync(p.result)` at line 499, then verifies the step, fills `last.result`, `usage`, `signals`, `verified`, `ok`, `finishedAt` in memory only. It never calls `writeLog`.
- The caller `next()` (`route.mjs:82`) goes on to `stepCommit` (writes log only for an ok step, `isolation.mjs:472`), `rollback` (writes state only for a rolled-back step, `isolation.mjs:539`), `resolveRigor`, `decide`. Anything that throws in between ends in main's catch with no log write.
- `neutralRetry` (`flow.mjs:350-396`) already writes the log right after its `rmSync`; the only branch between them is `endRun`, which writes the log. No change needed.
- A resumed `next` sees `last.result` set, skips `attachResult` (`if (!last || last.result) return;`) and decides again from the files.
- `writeLog` is already imported in `flow.mjs`. Callers of `attachResult`: `route.mjs:82` only.

## Desired End State

A router error at any point after `attachResult` leaves the step's `result`, `usage`, `ok`, `signals` and verification fields in `run.jsonl`. After the cause is fixed, the next `next` routes on without a result file and without rerunning the step. No commit holds `last-result.json` in a normal run. Residual window, not handled: if the process dies, or `rmSync` fails, between the `writeLog` and the `rmSync`, the next `next` skips `attachResult` (`last.result` is set) and the file stays; an isolated run's `stepCommit` would then commit it. Two adjacent synchronous calls make that rare, and the old order lost the whole result in a far wider window.

### Key Discoveries:

- `flow.mjs:499` `fs.rmSync(p.result)` is the only thing to move; `writeLog` goes at the end of `attachResult`, after `last.finishedAt` (line 557).
- File removal still precedes `stepCommit`'s `git add -A` (`isolation.mjs:472` onward) and `rollback`'s snapshot (`isolation.mjs:572`), because both run after `attachResult` returns.
- A throw inside the verification switch (for example `readPlan`) now leaves the result file in place, which is a safe side effect of the move.
- `ladder: []` cannot cause the throw: since ADR-022 `policyProblems` halts `next` at load with `policy.ladder must be a non-empty array ... Nothing was written.`, before `attachResult` runs, so the `change.md` reproduction is stale. `rigor: { levels: null }` still throws after `attachResult` (`Router error: policy.rigor.levels must be a non-empty array of strings`, from `resolveRigor`); `policyProblems` and `checkPrompts` do not check `rigor.levels`. On the unfixed code it leaves `last-result.json` gone and the log entry without `result` (checked in a scratch project).
- Advisory entries (`score`, failed) are not failures (`isFailure`, `state.mjs:482`), so `rollback` skips them and `stepCommit` skips them (not ok): an isolated run writes no log for them before `decide`.

## What We're NOT Doing

- No change to `neutralRetry`, `stepCommit`, `rollback` or `route.mjs`.
- No new log field, no new policy key, no change to `SKILL.md`, `policy.json` or `docs/REFERENCE.md` (routing behavior is unchanged).
- No validation of `rigor.levels` at load (separate concern, ADR-022); the tests only use it to cause a throw.
- No test for the OpenSpec chain: it shares `attachResult`, and the 10x cases cover the changed code path.

## Implementation Approach

Test first. Phase 1 adds a new test file that fails on the current code. Phase 2 moves the delete after the write and runs the whole suite. `AGENTS.md` is not edited in this run (wave 2: `agents-md-slim` owns it). The two tests use the CLI through scratch projects, as every other test does.

## Phase 1: Regression tests

### Overview

New `skills/10x-pipeline/test/result-persist.test.mjs`, red on the current code.

### Changes Required:

#### 1. Non-isolated case

**File**: `skills/10x-pipeline/test/result-persist.test.mjs`

**Intent**: Reproduce the bug from `change.md`: `init`, write a result for step 1 `plan`, break the override, run `next`, then restore and run `next` again.

**Contract**: Use `makeProject`, `init`, `writeResult`, `writeOverride`, `next`, `readLogEntries` from `helpers.mjs`; test title is a string literal. Result is `{status:"done", note:"wrote plan", usage:{totalTokens:1234}}`; the plan file is written with `writePlan` from `ahead.mjs` (mtime ahead of `startedAt`) so the entry is `ok`. Override is rewritten with `rigor: { levels: null }` through `writeOverride` (not `ladder: []`: `policyProblems` halts that at load, before `attachResult`). Asserts after the broken `next`: exit status non-zero, `stdout` halt reason starts with `Router error`, `last-result.json` is gone, the single log entry has `result.status === "done"`, `usage.totalTokens === 1234`, `ok === true`. After restoring the override and running `next` again: exit 0, `action` is `run` (the plan-review step), no `Step 1 (plan) has no result` halt, entry 1 unchanged, entry 2 pending.

#### 2. Isolated case with a non-ok, non-rollback entry

**File**: `skills/10x-pipeline/test/result-persist.test.mjs`

**Intent**: Same flow in a real linked worktree, with a last entry that neither `stepCommit` nor `rollback` writes: a failed `score` (advisory) entry.

**Contract**: Reuse the hermetic-git pattern of `stepcommit.test.mjs` (`repo`, `worktree`, `initIn`, `nextIn`, `gitEnv`; copy the few helpers, do not export from that file), policy `{ isolation: { require: true }, score: { minRigor: "standard" } }`, skip when `gitAvailable()` is false. Result is `{status:"done", ...}` with no `complexity.json`, so the entry is `ok === false`, `advisory`. Break with `rigor: { levels: null }` in the worktree's override (the same key as case 1), assert the same four things as case 1 (`Router error`, file gone, entry holds `result`/`usage`, `ok === false`), then restore and assert `next` routes on. Also assert `last-result.json` is absent from the worktree and from `git ls-files` after the broken `next`; it is a guard, not red/green evidence, because the failed `score` entry makes no commit.

### Success Criteria:

#### Automated Verification:

- New file fails on the unfixed code: `node --test skills/10x-pipeline/test/result-persist.test.mjs`

#### Manual Verification:

- The two tests read as the `change.md` reproduction and the isolated variant.

---

## Phase 2: Fix and wiring

### Overview

Reorder `attachResult`, document the test file, run everything.

### Changes Required:

#### 1. Persist before delete

**File**: `skills/10x-pipeline/scripts/flow.mjs`

**Intent**: Remove the early `fs.rmSync(p.result)`; after `last.finishedAt = Date.now();` call `writeLog(p.log, log)` and then `fs.rmSync(p.result)`. Keep `delete last.pendingPrompt` where it is, so the stored entry has no prompt.

**Contract**: Order at the end of `attachResult` is `last.finishedAt` -> `writeLog(p.log, log)` -> `fs.rmSync(p.result)`. One comment line says why: a router error later in `next` must not lose the result. `attachResult` still returns nothing and still halts on a missing result file.

#### 2. No `AGENTS.md` edit

**File**: none

**Intent**: Do not edit `AGENTS.md`. Another run of this wave (`agents-md-slim`) owns it; the bullet for `result-persist.test.mjs` is added after that run merges.

**Contract**: `git diff --name-only` of the run branch lists no `AGENTS.md`.

### Success Criteria:

#### Automated Verification:

- New tests pass: `node --test skills/10x-pipeline/test/result-persist.test.mjs`
- Whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- `init` and `status` on a scratch change folder print valid JSON: `node skills/10x-pipeline/scripts/route.mjs init <id> --goal "x"` then `status <id>` in a scratch project

#### Manual Verification:

- The pull request of the run branch shows CI green

---

## Testing Strategy

### Unit Tests:

- None; `attachResult` is exercised through the CLI like the rest of the router.

### Integration Tests:

- `result-persist.test.mjs`: non-isolated and isolated router error after `attachResult`, then recovery by `next`.
- Existing suites (`route`, `neutral`, `stepcommit`, `rollback`, `late-usage`, `executors`) guard the unchanged paths: `neutralRetry` order, step commits, rollback, usage attach.

### Manual Testing Steps:

1. Reproduce `change.md` steps 1-5 by hand on a scratch project; step 4 must leave `result` in the last log line and step 5 must route on.

## Performance Considerations

One extra `run.jsonl` write per `next` call that attaches a result. The file is small and later code already writes it again in the same call.

## References

- Problem and reproduction: `context/changes/attach-result-persist-first/change.md`
- Similar order already in place: `skills/10x-pipeline/scripts/flow.mjs:381` (`neutralRetry`)
- Test patterns: `skills/10x-pipeline/test/stepcommit.test.mjs:15-70`, `skills/10x-pipeline/test/neutral.test.mjs`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Regression tests

#### Automated

- [x] 1.1 New file fails on the unfixed code: `node --test skills/10x-pipeline/test/result-persist.test.mjs` — 98191c8

#### Manual

- [ ] 1.2 The two tests read as the `change.md` reproduction and the isolated variant

### Phase 2: Fix and wiring

#### Automated

- [x] 2.1 New tests pass: `node --test skills/10x-pipeline/test/result-persist.test.mjs` — 98191c8
- [x] 2.2 Whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` — 98191c8
- [x] 2.3 `init` and `status` on a scratch change folder print valid JSON: `node skills/10x-pipeline/scripts/route.mjs init <id> --goal "x"` then `status <id>` in a scratch project — 98191c8

#### Manual

- [ ] 2.4 The pull request of the run branch shows CI green
