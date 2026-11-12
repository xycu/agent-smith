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
- Existing budget tests `route.test.mjs:149`, `executors.test.mjs:691`, `firstattempt.test.mjs:152`, `score.test.mjs:501` leave a step pending, so they still halt on budget. `archive.test.mjs:848` ("an ordinary halt of an archive run carries archive and committed") does not: its `archiveProject` is a complete run (all rows ticked, `SOUND` and `APPROVED` reviews, a 4-step log) with `maxTotalSteps: 1`, so after the move `decide` returns `done` and the run reaches the `archive` action. The "failure path fits" test of `budget-executors.test.mjs` (the `stacked` walk, line ~264) ends with a `NEEDS ATTENTION` review after 2 fix loops, so after the move `decide` halts first with `Implementation still NEEDS ATTENTION after 2 fix loops` instead of the budget text (confirmed on a scratch copy). Both need test changes (Phase 1, change 3); the "confirm round" walk at `budget-executors.test.mjs:460` accepts only `done` or the budget text and must be checked the same way.

## What We're NOT Doing

- No change to `budgetSteps`, `rigor.budgetDelta` or any policy value.
- No new ADR; no change to tier logic.
- The `needsHuman` halt stays before the budget check.

## Implementation Approach

Delete the early check; after the `if (d.halt || d.done)` block, add the same check with the same reason text. The loop may now reach a skip in a run already at budget. Skips use no budget, but a logged skip stays handled, so the budget halt drops the skips of its own call from the log and the resumed run decides them again (review finding F1). The `fails >= maxAttemptsPerStep` halt after `tierFor` keeps its place after the budget check, so the order of those two halts is unchanged. A run over budget whose `decide` returns `done` with `meta.archive` now commits the change folder and returns `archive`, as any complete run does.

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

**Intent**: Add two tests next to "step budget differs per level". (a) A project at `lean` with all Automated rows ticked (`planText({ done: <phases> })`), a `SOUND` plan review and an `APPROVED` impl review, and 12 ok log entries ending in `impl-review`, gives `done` (and 11 entries give `done` too). (b) A `decide` halt is not masked by the budget text: same fixture with a `NEEDS ATTENTION` impl review that has 1 critical in its header and no `### F<n>` blocks, and a 12-entry log that holds two `fix` entries and ends in `impl-review`, gives a halt whose reason matches `Implementation still NEEDS ATTENTION after 2 fix loops` and not `Step budget`.

**Contract**: Use existing helpers (`makeProject`, `writeLog`, `entry`, `writePlan`/`writeReview` as the neighbouring tests do); no change to `helpers.mjs`.

#### 3. Existing tests that end on the budget text

**File**: `skills/10x-pipeline/test/budget-executors.test.mjs`

**Intent**: In "failure path fits" (`stacked`), expect the halt `Implementation still NEEDS ATTENTION after 2 fix loops` (the run is at the fix-loop cap, which `decide` now reports) instead of `Step budget \d+ spent`, and assert that the walk spent exactly its budget (`steps === budget`; review finding F2). In the confirm-round walk (line ~460) widen the accepted end to `done`, the budget text or a `decide` halt, if the full suite shows it ends there. Run the whole suite and fix any other assertion that expected the budget text for a run that `decide` ends itself; do not change an assertion for a run with a step still to run.

**Contract**: Assertion lines only; no walk, fixture or policy change.

**File**: `skills/10x-pipeline/test/archive.test.mjs`

**Intent**: Keep "an ordinary halt of an archive run carries archive and committed" (line ~848) testing the budget halt of an archive run: leave a step to run, for example by rewriting `plan.md` with an unticked Automated row after `archiveProject`, so `decide` returns a step and the budget halt still applies. Add one sibling assertion that the unmodified `archiveProject` with `maxTotalSteps: 1` now returns the `archive` action (a complete run at the budget is archived).

**Contract**: Only fixture lines of that test change; its expectations (`Step budget`, `archive: "skipped: run halted"`, `committed: false`, `commitCount` 1, the report line) stay.

#### 4. Docs

**File**: `docs/REFERENCE.md`

**Intent**: In "Budget", state that the budget halts only a run that still has a step to run; a run that is complete at the budget ends `done`, and a run started with `--archive` goes on to the archive. Both chains share it.

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
- Run at budget with a step still to run gives the budget halt (existing tests, plus the fixed archive test).
- Run at budget whose `decide` halts on its own shows that halt, not the budget text.
- A budget halt leaves no skip entry in the log; the resumed run logs the skips with the reasons of the resume (`preplan.test.mjs`).
- Complete `--archive` run at the budget returns `archive`.

### Manual Testing Steps:

1. Build the issue's scratch project with 11 then 12 entries; both print `done`.

## References

- GitHub issue #87; `context/changes/budget-halt-after-done/change.md`
- `skills/10x-pipeline/scripts/route.mjs:112`, `docs/REFERENCE.md` "Budget"

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Move the budget check after decide

#### Automated

- [x] 1.1 New regression test passes: `node --test skills/10x-pipeline/test/route.test.mjs`
- [x] 1.2 Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- [x] 1.3 Router prints valid JSON for `init` and `status` in a scratch change folder

#### Manual

- [x] 1.4 Issue reproduction (12 logged steps) prints `done` instead of `halt` — evidence: evidence/test-budget-done.txt
- [x] 1.5 A 12-step log with a pending step still prints `halt` `Step budget 12 spent.` — evidence: evidence/test-budget-halt-pending.txt
