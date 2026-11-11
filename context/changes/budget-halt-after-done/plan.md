# Budget halt after done Implementation Plan

## Overview

`next` checks the step budget before `decide`, so a complete run that used its last budget step is reported `halt: Step budget N spent.` instead of `done` (GitHub issue #87). Move the check after `decide`, applied only when `decide` returns a step to run.

## Current State Analysis

`skills/10x-pipeline/scripts/route.mjs:112-115` computes `budget` and halts when `budgetSteps(log) >= budget`, before the `decide` loop (`route.mjs:120-141`). The longest failure-free path plus one failed step and its retry lands exactly on the budget (10 + 2 = 12 at `lean`, 17 + 2 = 19 at `standard`), and `docs/REFERENCE.md` ("Budget") says those runs "still fit". Result: a good run shows as halted, an `--archive` run is never archived, every resume halts again. The budget halt also hides the more useful halt texts of `decide`.

## Desired End State

A run whose log is at or over budget but whose `decide` returns `done` (or its own `halt`) ends with that result. A run for which `decide` returns a step to run still halts with `Step budget N spent.` Verify: the reproduction from the issue (12 logged ok steps ending in `impl-review` with `APPROVED`) prints `done`.

### Key Discoveries:

- `route.mjs:112-115` budget check, `route.mjs:120-141` decide loop (skips use no budget, so running the loop first is safe).
- After the loop, `route.mjs:143-148` already handles `d.done`/`d.halt` (archive included); the new check goes right after, before `tierFor`.
- Existing budget tests (`route.test.mjs:149`, `archive.test.mjs:848`, `executors.test.mjs:691`, `firstattempt.test.mjs:152`, `score.test.mjs:501`, `budget-executors.test.mjs`) leave a step pending, so they still halt on budget.

## What We're NOT Doing

- No change to `budgetSteps`, `rigor.budgetDelta` or any policy value.
- No new ADR; no change to tier logic.
- The `needsHuman` halt stays before the budget check.

## Implementation Approach

Delete the early check; after the `if (d.halt || d.done)` block, add the same check with the same reason text. The loop may now log a skip entry in a run already at budget; skips use no budget, so this is harmless.

## Phase 1: Move the budget check after decide

### Overview

Router change plus a regression test and doc line.

### Changes Required:

#### 1. Router

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: Apply the budget halt only when `decide` returned a step to run, so `done` and `decide`'s own halts win.

**Contract**: `next` output unchanged for every case except budget-at-or-over with `d.done`/`d.halt`; the halt reason stays `Step budget <n> spent.`, returned via `end(...)`.

#### 2. Test

**File**: `skills/10x-pipeline/test/route.test.mjs`

**Intent**: Add a test next to "step budget differs per level": a project at `lean` with all Automated rows ticked, a `SOUND` plan review and an `APPROVED` impl review, and 12 ok log entries ending in `impl-review`, gives `done`; a decide halt is not masked by the budget text.

**Contract**: Use existing helpers (`makeProject`, `writeLog`, `entry`, `writePlan`/`writeReview` as the neighbouring tests do); no change to `helpers.mjs`.

#### 3. Docs

**File**: `docs/REFERENCE.md`

**Intent**: In "Budget", state that the budget halts only a run that still has a step to run; a run that is complete at the budget ends `done`.

**Contract**: One added bullet under `Budget:`.

### Success Criteria:

#### Automated Verification:

- New regression test passes: `node --test skills/10x-pipeline/test/route.test.mjs`
- Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- Router prints valid JSON for `init` and `status` in a scratch change folder

#### Manual Verification:

- Issue reproduction (12 logged steps) prints `done` instead of `halt`
- A 12-step log with a pending step still prints `halt` `Step budget 12 spent.`

---

## Testing Strategy

### Unit Tests:

- Complete run at exactly the budget gives `done`.
- Run at budget with a step still to run gives the budget halt (existing tests).

### Manual Testing Steps:

1. Build the issue's scratch project with 11 then 12 entries; both print `done`.

## References

- GitHub issue #87; `context/changes/budget-halt-after-done/change.md`
- `skills/10x-pipeline/scripts/route.mjs:112`, `docs/REFERENCE.md` "Budget"

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Move the budget check after decide

#### Automated

- [ ] 1.1 New regression test passes: `node --test skills/10x-pipeline/test/route.test.mjs`
- [ ] 1.2 Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- [ ] 1.3 Router prints valid JSON for `init` and `status` in a scratch change folder

#### Manual

- [ ] 1.4 Issue reproduction (12 logged steps) prints `done` instead of `halt`
- [ ] 1.5 A 12-step log with a pending step still prints `halt` `Step budget 12 spent.`
