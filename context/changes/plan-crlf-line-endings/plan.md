# Plan CRLF Line Endings Implementation Plan

## Overview

Make the plan readers of the router tolerate CRLF line endings, so a `plan.md` saved with `\r\n` routes exactly like the same plan with `\n`. Today `readPlan` throws on `### Phase 1: Core\r`, and the row and `**Files**:` patterns silently match nothing.

## Current State Analysis

The plan readers split on `"\n"` and match each line against patterns anchored at `$`. `.` does not match `\r`, so with CRLF every `(.*)$` pattern fails on a line that ends in `\r`.

- `readPlan` (`skills/10x-pipeline/scripts/state.mjs:221`) splits the Progress section on `"\n"`. The heading pattern `/^### Phase (\d+)\s*:?\s*(.*)$/` returns `null` for `### Phase 1: Core\r`, and `Number(h[1])` throws (`Router error: Cannot read properties of null (reading '1')`). The row pattern `/^- \[( |x|X)\] (.*)$/` never matches a CRLF row, so `rows`, `autoPending`, `autoDone` and `manualPending` read 0 and `decide` treats pending work as done.
- `planFileTokens` (`state.mjs:~717`) matches `/^\*\*Files?\*\*:(.*)$/`, which fails on `\r`. `planPaths` (`state.mjs:730`, splits on `"\n"`) and `phaseFiles` (`skills/10x-pipeline/scripts/steps.mjs:135`, splits on `"\n"`) both go through it, so a CRLF plan names no paths: churn risk reads as not measured and the tdd executor never sees a pure-logic phase.
- Already tolerant, leave as is: `aggregateGap`, `e2eSetup`, `readUnprovenReasons` (`steps.mjs:393`), `readVerdict`, `preplan.mjs`, `open-pr.mjs`, `pr-common.mjs` (all `split(/\r?\n/)`); `readFindings` and `readReview` (no `$` on the captured text); `readLog` (`JSON.parse` ignores trailing whitespace); `readTasks` (`TASK_ROW` has no `$`); `churnCounts` (git output, `\n` only).
- `createdValue` (`skills/10x-pipeline/scripts/isolation.mjs:169`) reads `created:` as `/10x-archive` reads it, unmodified, on purpose (the archive folder name must equal the skill's DEST). Leave it unchanged; the choice is recorded here.

## Desired End State

A plan with CRLF line endings gives the same `readPlan` result (phases, rows, counts, `phaseList` ids and texts), the same `planPaths` and `phaseFiles`, the same `risk` output and the same first routed step as its LF copy. No plan reader throws on a `\r`. Verified by new tests and the full suite.

### Key Discoveries:

- The fix pattern already exists in the repo: `split(/\r?\n/)` in `steps.mjs:393` and `preplan.mjs:58`.
- `readPlan` stores `rowId` and `text` from the matched row. After splitting on `/\r?\n/` the lines carry no `\r`, so the stored text and ids equal the LF ones.
- `phaseFiles` is not exported; the existing "phase files reader" test in `skills/10x-pipeline/test/executors.test.mjs:837` checks it through routing (`implement-tdd` template), so the CRLF case fits there.
- `planFileTokens` is exported and tested directly in `skills/10x-pipeline/test/file-guard.test.mjs`.

## What We're NOT Doing

- No change to `createdValue`, `readFindings`, `readReview`, `readLog`, `readTasks` or any reader that already tolerates `\r`.
- No normalising of file content on write, and no change to what git or editors write.
- No support for lone `\r` (classic Mac) line endings.
- No new policy key, prompt or router command; no change to `helpers.mjs`.

## Implementation Approach

Split plan text on `/\r?\n/` in the three splitters (`readPlan`, `planPaths`, `phaseFiles`). Also let `planFileTokens` accept a trailing `\r` in its own pattern (`(.*)\r?$`), because it is exported and takes one line from any caller. Then add tests: a new `crlf-plan.test.mjs` for `readPlan`, `planFileTokens`, `init` routing and `risk` parity, and one CRLF case in the existing phase files reader test.

## Phase 1: Tolerate CRLF in the plan readers

### Overview

Fix the four reader sites.

### Changes Required:

#### 1. Progress reader and plan path reader

**File**: `skills/10x-pipeline/scripts/state.mjs`

**Intent**: `readPlan` and `planPaths` split on a line break that may carry a carriage return, so heading and row patterns match and the stored row text has no `\r`. `planFileTokens` accepts a trailing `\r` on its line.

**Contract**: `readPlan(file)` returns the same object for a plan and its CRLF copy (except `mtime`). `planFileTokens(line)` returns the same tokens for `line` and `line + "\r"`. Replace `.split("\n")` with `.split(/\r?\n/)` in `readPlan` and `planPaths`; change the `planFileTokens` pattern to `/^\*\*Files?\*\*:(.*)\r?$/`.

#### 2. Phase files reader

**File**: `skills/10x-pipeline/scripts/steps.mjs`

**Intent**: `phaseFiles` splits on `/\r?\n/` so the `## Phase N` headings and `**Files**:` lines of a CRLF plan are read.

**Contract**: `phaseFiles(planFile)` returns the same Map for a plan and its CRLF copy. One-token change at `steps.mjs:135`.

### Success Criteria:

#### Automated Verification:

- Existing suite still passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- Only the tolerant readers keep `split("\n")` in `state.mjs` (`readFindings`, `readLog`, `churnCounts`, diff hits) and none remains in `steps.mjs`: `grep -n 'split("\\n")' skills/10x-pipeline/scripts/state.mjs skills/10x-pipeline/scripts/steps.mjs`

#### Manual Verification:

- A scratch change folder with a CRLF `plan.md`: `route.mjs init demo --goal "add a thing"` prints valid JSON and no `Router error`, and `status demo` prints valid JSON.

---

## Phase 2: Tests for CRLF plans

### Overview

Pin LF and CRLF parity for every reader and for routing.

### Changes Required:

#### 1. CRLF parity tests

**File**: `skills/10x-pipeline/test/crlf-plan.test.mjs` (new)

**Intent**: One test file for the CRLF plan, built on `helpers.mjs` (`makeProject`, `planText`, `init`, `run`, git helpers) and `phase-helpers.mjs` (`buildPlan`). The CRLF text is `lf.replace(/\n/g, "\r\n")`.

**Contract**: Tests, each comparing the LF plan with its CRLF copy:
- `readPlan` gives deep-equal results ignoring `mtime`, on a plan with two phases, a done Automated row, pending Automated rows and pending Manual rows; assert `phases`, `rows`, `autoDone`, `autoPending`, `manualPending` and `phaseList` ids and texts, and that no stored `text` or `id` contains `\r`. A named heading (`### Phase 1: Core`) and a bare heading (`### Phase 2`) both appear.
- `planFileTokens` gives equal tokens for `**Files**: \`a.mjs\`, \`b.mjs\`` and the same with `\r`, for the backtick and the comma-split forms.
- `init` on the CRLF plan exits 0, prints no `Router error`, and routes to the same step as the LF plan; with a log of `plan` and `plan-review` (SOUND) and a pending row, it routes to `implement`, not to the review or `done`.
- `risk` on a git scratch repo (as in `churn.test.mjs`, skipped when git is missing) gives equal output for a `**File**: \`f9.js\`` plan and its CRLF copy, and names the plan path as a hit.

#### 2. Phase files reader case

**File**: `skills/10x-pipeline/test/executors.test.mjs`

**Intent**: Extend the "phase files reader" test with CRLF so `phaseFiles` is covered through the tdd route.

**Contract**: Add `assert.equal(route(base.replace(/\n/g, "\r\n")), "implement-tdd");` next to the existing cases, and one with a CRLF plan whose files line names a doc path (stays `implement`).

AGENTS.md is not edited in this change: the wave owner of `agents-md-slim` owns it, and a bullet for `crlf-plan.test.mjs` is left for that change.

### Success Criteria:

#### Automated Verification:

- New tests fail on the old code and pass on the fix: `node --test skills/10x-pipeline/test/crlf-plan.test.mjs`
- Phase files reader test passes: `node --test --test-name-pattern "phase files reader" skills/10x-pipeline/test/executors.test.mjs`
- Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`

#### Manual Verification:

- CI is green on the pull request of the run branch.

**Implementation Note**: After this phase and all automated verification pass, pause for manual confirmation before archiving.

---

## Testing Strategy

### Unit Tests:

- `readPlan`, `planFileTokens` LF vs CRLF parity, `\r`-free row text and ids.

### Integration Tests:

- `init` on LF and CRLF plans routes the same; `risk` output equal; tdd routing equal.

### Manual Testing Steps:

1. Make a scratch project with `isolation.require: false` and a CRLF `plan.md` containing `## Progress`, `### Phase 1: Core`, `#### Automated`, `- [ ] 1.1 Do it`.
2. Run `init demo --goal "add a thing"` and `status demo`; confirm valid JSON, no `Router error`.

## Performance Considerations

None; a regex split replaces a string split on files of a few KB.

## References

- Change: `context/changes/plan-crlf-line-endings/change.md`
- Existing pattern: `skills/10x-pipeline/scripts/steps.mjs:393`, `skills/10x-pipeline/scripts/preplan.mjs:58`
- Tests to extend: `skills/10x-pipeline/test/executors.test.mjs:837`, `skills/10x-pipeline/test/file-guard.test.mjs`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Tolerate CRLF in the plan readers

#### Automated

- [ ] 1.1 Existing suite still passes
- [ ] 1.2 Only the tolerant readers keep split("\n") in state.mjs and none remains in steps.mjs

#### Manual

- [ ] 1.3 Scratch CRLF plan: init and status print valid JSON and no Router error

### Phase 2: Tests for CRLF plans

#### Automated

- [ ] 2.1 New tests fail on the old code and pass on the fix
- [ ] 2.2 Phase files reader test passes
- [ ] 2.3 Full suite passes

#### Manual

- [ ] 2.4 CI is green on the pull request of the run branch
