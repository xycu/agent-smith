# Coauthor test coarse-mtime fix Implementation Plan

## Overview

`coauthor.test.mjs` writes the plan of a plan step with the plain `writePlan` of `helpers.mjs`. On a Linux runner the file's mtime can land at or before the step's `startedAt`, the router reads the plan step as failed, and an isolated run takes the rollback path. CI on `main` failed on this once. The fix is a one-line import change in the test, plus a recorded audit that no other test file has the same pattern.

## Current State Analysis

- The router verifies a `plan` step only when `plan.mtime > last.startedAt` (`skills/10x-pipeline/scripts/flow.mjs:474`). Reviews, `research`, `frame` and `score` have the same check (`flow.mjs:479-503`), but only the plan is in scope here.
- `skills/10x-pipeline/test/ahead.mjs` exports `writePlan` and `writeReview` that call the plain helper and then `stampAhead` the file a minute ahead. AGENTS.md says a test that writes such a file right after `next` uses it.
- `skills/10x-pipeline/test/coauthor.test.mjs:10` imports `writePlan` and `writeReview` from `./helpers.mjs`. Plan writes right after `isolatedRun()` and before `nextIn`: line 69 ("a step commit carries the trailer") and line 162 (the `BAD` loop of "a malformed coAuthor halts a step commit at next with nothing staged", which failed on CI).
- `writeReview` at `coauthor.test.mjs:93-94` is a fixture written inside `archiveProject` before the log exists; it does not stand for a step's output.

### Key Discoveries:

- Audit of the other files that import the plain `writePlan` from `helpers.mjs` (checked in context, each call site):
  - Plan written, then stamped ahead by the test itself (`later`, `future` or `fs.utimesSync`), so safe: `agents.test.mjs:65`, `advisor.test.mjs:391,442,529`, `compare.test.mjs:80,114,482`, `cost.test.mjs:176`, `lessons.test.mjs:94`, `provenance.test.mjs:44`, `route.test.mjs:365,406,535`.
  - Fixture written before `init` or before the step that reads it, or the output of an `implement` step (no `startedAt` check on the plan file for that step), so not affected: `churn.test.mjs:67`, `executors.test.mjs:47,226,325,836,920`, `advisor.test.mjs:141,393,442`, `agents.test.mjs:67`, `provenance.test.mjs:278`, `firstattempt.test.mjs` (imports it, never calls it).
  - `archive.test.mjs:948,960` rewrite `plan.md` with `fs.writeFileSync` before `next` on a run whose pending step is not a plan step; not affected.
  - Result: `coauthor.test.mjs` is the only file that needs a change.
- `helpers.mjs` must stay as it is (AGENTS.md); `ahead.mjs` exists for this.

## Desired End State

`coauthor.test.mjs` writes every plan that stands for a step's output through `ahead.mjs`. No other test file writes a step's plan output with the plain helper without stamping it. The suite passes locally, and CI on `main` is green after the merge.

## What We're NOT Doing

- No change to `helpers.mjs`, `ahead.mjs` or any router script.
- No change to the other test files: their plain writes are stamped by the test or are fixtures (audit above). Converting the stamped ones to `ahead.mjs` is cosmetic churn.
- No guard test. A source-text check cannot tell a fixture write before `init` from a step-output write after it, and a guard flagging every plain import would flag the safe fixtures. The change notes allow leaving it out.
- No change to `writeReview` in `coauthor.test.mjs` (fixtures).

## Implementation Approach

Split the import in `coauthor.test.mjs`: keep `writeReview` and the other helpers from `./helpers.mjs`, take `writePlan` from `./ahead.mjs`, as `stepcommit.test.mjs` does. Then prove the timing dependency is gone with a temporary local hack, and run the full suite.

## Phase 1: Use the ahead writer in coauthor.test.mjs

### Overview

Switch the plan writer of `coauthor.test.mjs`.

### Changes Required:

#### 1. coauthor test import

**File**: `skills/10x-pipeline/test/coauthor.test.mjs`

**Intent**: Write the plans of lines 69 and 162 through the writer that stamps the file a minute ahead, so the router always sees the plan as written after the step started.

**Contract**: Remove `writePlan` from the `./helpers.mjs` import (line 8-11) and add `import { writePlan } from "./ahead.mjs";`. `writeReview` stays on `./helpers.mjs`. Call sites do not change.

### Success Criteria:

#### Automated Verification:

- The coauthor tests pass: `node --test skills/10x-pipeline/test/coauthor.test.mjs`
- The import is split: `grep -n "ahead.mjs" skills/10x-pipeline/test/coauthor.test.mjs` prints the `writePlan` import and `writePlan` no longer appears in the `helpers.mjs` import list

---

## Phase 2: Prove the fix and run the suite

### Overview

Show the timing dependency is gone, then run the whole suite. The hack is local and never committed.

### Changes Required:

#### 1. Backdating check (temporary, not committed)

**File**: `skills/10x-pipeline/test/helpers.mjs` (temporary edit; undo it by hand with Edit, not with `git checkout -- <path>`, which the repository rules forbid)

**Intent**: Make the plain `writePlan` set the file's mtime to the step's `startedAt` (read it from `agent-smith/run.jsonl`, or use a time of one second ago), the way a coarse Linux clock can. Run `coauthor.test.mjs` against the old import to see the CI failure, then against the new import to see it pass. Because `ahead.mjs` stamps after the plain write, the new import ends a minute ahead whatever the plain helper does.

**Contract**: The edit exists only during the check. `git diff --stat` shows only `coauthor.test.mjs` before the commit step of the pipeline.

### Success Criteria:

#### Automated Verification:

- With the backdating hack and the plain import, the test reports `Rollback of step 1 (plan)`; with the `ahead.mjs` import, `node --test skills/10x-pipeline/test/coauthor.test.mjs` passes
- After removing the hack, `git diff --stat` lists only `skills/10x-pipeline/test/coauthor.test.mjs` (plus the change folder files)
- The full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`

#### Manual Verification:

- CI on `main` is green on the self-hosted runner after the fix is merged

---

## Testing Strategy

### Unit Tests:

- No new tests. The existing `coauthor.test.mjs` cases are the tests; the change makes them independent of the file clock.

### Integration Tests:

- The full `node --test` suite, as in AGENTS.md.

### Manual Testing Steps:

1. After the merge, open the CI run for the merge commit on `main` and confirm the "Test suite" step is green.

## Performance Considerations

None.

## Migration Notes

None.

## References

- Change notes: `context/changes/coauthor-test-coarse-mtime/change.md`
- Router check: `skills/10x-pipeline/scripts/flow.mjs:474`
- Ahead writer: `skills/10x-pipeline/test/ahead.mjs`
- Same pattern in use: `skills/10x-pipeline/test/stepcommit.test.mjs`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Use the ahead writer in coauthor.test.mjs

#### Automated

- [ ] 1.1 The coauthor tests pass: `node --test skills/10x-pipeline/test/coauthor.test.mjs`
- [ ] 1.2 The import is split: `grep -n "ahead.mjs" skills/10x-pipeline/test/coauthor.test.mjs` prints the `writePlan` import and `writePlan` no longer appears in the `helpers.mjs` import list

### Phase 2: Prove the fix and run the suite

#### Automated

- [ ] 2.1 With the backdating hack and the plain import, the test reports `Rollback of step 1 (plan)`; with the `ahead.mjs` import, `node --test skills/10x-pipeline/test/coauthor.test.mjs` passes
- [ ] 2.2 After removing the hack, `git diff --stat` lists only `skills/10x-pipeline/test/coauthor.test.mjs` (plus the change folder files)
- [ ] 2.3 The full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`

#### Manual

- [ ] 2.4 CI on `main` is green on the self-hosted runner after the fix is merged
