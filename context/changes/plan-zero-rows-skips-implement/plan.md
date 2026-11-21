# Plan With No Readable Progress Rows Must Not Skip Implement — Implementation Plan

## Overview

The `plan` and `plan-revise` steps are verified today when `plan.md` has a `## Progress` heading and a fresh mtime. A plan whose rows are written as `* [ ]`, `1. [ ]` or indented items reads as zero rows, so the step verifies, the run reaches `impl-review` with "implementation complete" and can finish with no `implement` step. The reader also takes the first `## Progress` heading even when it sits inside a code fence, so a quoted example before the real section hides the real rows. This plan makes those two steps verify only with at least one pending Automated row, makes the Progress reader (and `readFindings`) ignore code fences, and documents the minimum a plan needs to verify.

## Current State Analysis

- `readPlan` (`skills/10x-pipeline/scripts/state.mjs:318-357`) takes the first `^## Progress\s*$` line, then counts `^- \[( |x|X)\] ` lines at column 0 until the next `## ` heading. It has no code-fence state.
- `skills/10x-pipeline/scripts/flow.mjs:607` verifies the `plan` step on `plan.hasProgress && plan.mtime > last.startedAt`. Only `plan-replan` and `plan-rejected` (`CODE_REPLANS`, `steps.mjs:475`) also call `verifyCodeReplan` (`steps.mjs:515`), which requires `plan.autoPending > 0`.
- `decide` (`flow.mjs:747`) treats a plan with `hasProgress` and no pending Automated row as finished work: `flow.mjs:856` only runs `implement` when `plan.autoPending > 0` or there are reopen rows.
- A failed step is retried only through its own gate. In an isolated run the failed `plan` step is rolled back (`route.mjs:100-118`), so `plan.md` disappears and `decide` asks for `plan` again (`flow.mjs:772`). In a non-isolated run nothing rolls back: `decide` sees `hasProgress`, no ok `plan` entry (`lp < 0`), no plan review, and schedules `plan-review` (`flow.mjs:790-815`), then `impl-review`. So verification alone does not stop the skip; `decide` must route a failed first plan back to `plan`.
- A failed `plan-revise` already retries: its plan review is still fresh (`lpr > lp`) and `replanNext` (`preplan.mjs:316`) runs again, bounded by `limits.maxPlanRevisions`.
- `readFindings` (`state.mjs:363-385`) ends a finding block at any `## ` or `### ` line, fenced or not, so a quoted heading drops the `**Decision**` line that follows.
- The OpenSpec chain already halts on zero task rows (`skills/openspec-pipeline/scripts/openspec.mjs:176`) and its `TASK_ROW` (line 11) accepts `*`, `+`, numbered items and indentation. It is a separate reader of a separate file.
- A trial of the verification change alone in a scratch copy of the repository (not this worktree): the first 570 tests of the suite passed with no failure, but the run was stopped before it finished, so whether an existing fixture verifies a `plan` step on a plan with no pending Automated row is still open; Phase 2 names it and the full suite in Phase 3 decides.
- Measured on this branch with a prototype fence-aware reader: all 98 `context/archive/*/plan.md` read the same as before (phases, rows, done, pending, manual pending), none has an unclosed fence, none has zero rows, and no `context/archive` review has a `##` or `###` line inside a fence.

## Desired End State

- A `plan` or `plan-revise` step that leaves no pending Automated row in `plan.md` is recorded as failed (`ok: false`, `verified: false`) and the router asks for the same step again until the attempt limit halts the run. The run cannot reach `impl-review` or `done` on a plan it could not read.
- `readPlan` finds the real `## Progress` section when the plan quotes the heading inside a code fence, before or after it, and ignores checkbox lines and headings inside fences within the section. `readFindings` ignores `##` and `###` lines inside a fence when it cuts finding blocks.
- Archived plans read the same as before, pinned by a test against a copy of the old reader.
- `docs/REFERENCE.md` states the minimum a plan needs to verify, the row form, and the fence rule; the plan step rule file tells the planner the same.

### Key Discoveries:

- `verifyCodeReplan` already requires pending Automated rows for re-plans (`steps.mjs:515-520`); the first plan and `plan-revise` adopt the same bar.
- `lastIdx(log, ["plan"])` counts ok entries only (`state.mjs:762`), so after a failed first plan `lp` is `-1`; this is why `decide` falls through to `plan-review`.
- `tierFor` counts consecutive failures of a step and `route.mjs:205` halts at `escalation.maxAttemptsPerStep`, so a routed retry is bounded.
- The 10x-plan skill's `progress-format.md` defines the row as `- [ ] <phase>.<index> <title>` and says "no nested checkboxes"; the executors tick exactly that line. A reader that counted `*`, numbered or indented rows would count rows the executors do not tick.
- Prompt text of `plan` and `plan-revise` is pinned verbatim by `preplan.test.mjs:241-263,314`; the always-true rule file `skills/10x-pipeline/rules/steps/plan.md` is appended to every plan template and is not pinned, so the row-form rule goes there.

## What We're NOT Doing

- No tolerant row forms in `readPlan` (see Key Decisions). The OpenSpec `TASK_ROW` stays as it is.
- No change to how an existing `plan.md` that a user supplied at `init` (no `plan` step logged) is read or routed. The new check applies to verifying a fresh `plan` or `plan-revise` step, not to every read of the plan; a resumed run whose rows are all done on purpose still routes to review.
- No change to `plan-replan` and `plan-rejected` verification, `readReviewVerdict` or its parser, the prompts in `policy.json`, or any other step.
- No hand-written Markdown parser beyond a fence tracker for the CommonMark fences the plans use (backtick or tilde, three or more, up to three spaces of indent). Fences indented deeper, inside block quotes or list items, and HTML `<pre>` blocks are not tracked.
- No edit of `context/archive/`, `run.jsonl` or `meta.json`.

## Implementation Approach

Three phases, each leaving the suite green. Phase 1 changes only readers (no routing change), so archived and fenced plans are proven first. Phase 2 changes verification and `decide` and the rule file. Phase 3 writes the docs and indexes and runs the full suite.

Decisions taken without a human, from the evidence above: strict reader (reason below), fence-state scanning instead of "last `## Progress`" (a quoted example can also sit after the real section, and a fence inside the section must not end it), `readFindings` takes the fence route because the helper is shared and the cost is a few lines.

## Phase 1: Fence-aware readers

### Overview

One shared fence tracker in `state.mjs`; `readPlan` and `readFindings` use it. No routing change.

### Changes Required:

#### 1. Fence tracker and `readPlan`

**File**: `skills/10x-pipeline/scripts/state.mjs`

**Intent**: Find the first `## Progress` heading that is outside a code fence, and inside the section ignore every line that is inside a fence (rows, `### Phase`, `####` and `## ` headings alike). Everything else in `readPlan` keeps its behaviour and result shape.

**Contract**: A small module-private function over an array of lines returns, per line, whether the line is inside a fence or is a fence line. A fence opens on a line of up to three spaces then three or more backticks or tildes (a backtick fence's info string has no backtick) and closes on a line of the same character, at least as long, followed by blanks only. A trailing `\r` is stripped before matching so CRLF plans read like LF plans. An unclosed fence runs to the end of the text. `readPlan` returns the same fields; a plan whose only `## Progress` is fenced reads `hasProgress: false`.

#### 2. `readFindings`

**File**: `skills/10x-pipeline/scripts/state.mjs`

**Intent**: A `##` or `###` line inside a fence no longer ends or starts a finding block; fenced lines stay in the block body as they do today (so a `**Decision**` line is still found where it is).

**Contract**: `readFindings(text)` returns the same records; the loop asks the tracker before treating a line as a heading. It splits on `\n` today, so the tracker's `\r` strip also covers CRLF review files.

#### 3. Tests

**File**: `skills/10x-pipeline/test/plan-rows.test.mjs` (new; row in `skills/10x-pipeline/test/README.md`)

**Intent**: Pin the new reading and the archive equivalence.

**Contract**: Titles are string literals. Cases: (a) a plan quoting `## Progress` plus two example rows inside a backtick fence before the real section reads the real rows (`phases`, `rows`, `autoPending`); same with a tilde fence and with CRLF; (b) a quoted heading and rows after the real section, and a fenced `## Notes` line and fenced `- [ ] 9.9` inside the section, change nothing; (c) a plan whose only `## Progress` is fenced reads `hasProgress: false`; (d) an unclosed fence reads as fenced to the end; (e) `readPlan` equals a copy of the old algorithm kept in the test, for every `context/archive/*/plan.md` present whose text has no fence line (a line of up to three spaces then three or more backticks or tildes) at or after its `## Progress` heading, so a future archived plan that legitimately quotes a fence cannot turn the test red; the test also asserts that at least one archived plan was compared (skipped when the folder is absent); (f) `readReview` keeps a finding's `**Decision**` when a fenced `### Example` line sits inside its block, and still cuts at an unfenced heading; an unclosed fence inside a finding block never reads cleaner than the header counts (`openCounts` still adds the header's extra critical or warning as open).

### Success Criteria:

#### Automated Verification:

- Fenced and CRLF plans read the real rows: `node --test skills/10x-pipeline/test/plan-rows.test.mjs`
- Archived plans read the same as the old reader: the archive-equivalence case of `plan-rows.test.mjs` passes against all `context/archive/*/plan.md`
- Finding blocks survive fenced headings: the `readReview` cases of `plan-rows.test.mjs` pass
- Archived reviews read the same: a scratch script imports the pre-change `state.mjs` (`git show $(git merge-base HEAD main):skills/10x-pipeline/scripts/state.mjs`, written to a scratch file) and the new one and compares `readReview(...).findings` for every `context/archive/*/reviews/*.md`, printing zero differences
- Existing reader tests still pass: `node --test skills/10x-pipeline/test/crlf-plan.test.mjs skills/10x-pipeline/test/run-state.test.mjs`

#### Manual Verification:

- The tracker's comment names its limit (fences deeper than three spaces, in block quotes or list items, and `<pre>` are not tracked) in the `shortcut:` form

---

## Phase 2: Verify only with a pending Automated row, and retry a failed first plan

### Overview

The `plan` and `plan-revise` steps verify only with at least one pending Automated row; a failed first plan is routed back to `plan` in non-isolated runs too; the rule file tells the planner the row form.

### Changes Required:

#### 1. Verification

**File**: `skills/10x-pipeline/scripts/flow.mjs` (the `case "plan"` of the verification switch, line 607)

**Intent**: For the `plan` and `plan-revise` templates, verified means a fresh `plan.md` with `plan.autoPending > 0`. The code re-plan templates keep `verifyCodeReplan`, which already includes that bar.

**Contract**: `verified = plan.mtime > last.startedAt && (CODE_REPLANS.includes(last.template) ? verifyCodeReplan(last, plan) : plan.autoPending > 0)`; `hasProgress` is implied by a pending row.

#### 2. Retry of a failed first plan

**File**: `skills/10x-pipeline/scripts/flow.mjs` (`decide`, the branch that schedules `plan` when there is no plan or no Progress, line 772)

**Intent**: When the most recent `plan` entry has the template `plan`, is not ok and not verified, no `plan` step has succeeded (`lp < 0`), no code ran, and the plan reads zero pending Automated rows (it may read ticked Automated rows, Manual rows or none), schedule `plan` again with a reason that says what is missing. A ticked-only plan is retried too, because the entry test already separates a failed first plan from a plan the user supplied at `init` (no `plan` entry in the log). This closes the non-isolated path (isolated runs already lose `plan.md` to the rollback). A plan with pending rows that failed for another reason (stale mtime, failed status) keeps today's routing.

**Contract**: The retry case has `plan.hasProgress` true, so the existing condition `!plan.exists || !plan.hasProgress` does not reach it: widen that condition with a boolean computed before it from `log`, `lp` and `codeRan`, so the retry returns before the `prFresh` check that schedules `plan-review` (`flow.mjs:795`). The widened branch keeps its body (pre-plan, score, goal-class bump), so the retry test asserts that no second pre-plan or score step is scheduled. The reason names the minimum: `plan.md has no pending Automated Progress row (read N rows)`. The step keeps template `plan` and the first-plan bump, so `tierFor` counts the consecutive failures and `route.mjs` halts at `escalation.maxAttemptsPerStep`. `plan-revise` needs no change: its plan review stays fresh and `replanNext` runs again, capped by `limits.maxPlanRevisions`.

#### 3. Rule file

**File**: `skills/10x-pipeline/rules/steps/plan.md`

**Intent**: One more always-true rule for the four plan templates: each Progress row is `- [ ] N.M title` (or `- [x]`) at the start of the line, outside a code fence, and the Automated section keeps at least one pending row. It matches the reader and the existing re-plan prompts.

**Contract**: One `GIVEN/WHEN/THEN` line in the style of the file; no placeholders. Rule files are not pinned by text; `provenance.test.mjs` only hashes the file.

#### 4. Tests

**File**: `skills/10x-pipeline/test/plan-rows.test.mjs`, plus any existing fixture the new verification rejects

**Intent**: Black-box through the CLI in scratch projects (`makeProject`, `init`, `writeResult`, `next`, `readLogEntries`, `ahead.mjs` writers).

**Contract**: (a) `plan` step result `done`, plan with `* [ ] 1.1 ...` rows: the log entry has `ok: false`, `verified: false`; `next` returns step `plan` with the new reason, and again after a second failure; the run never returns `impl-review`, `plan-review` or `done`, and halts at the attempt limit; (b) numbered `1. [ ]` and indented `  - [ ]` rows do the same; (c) a plan with only Manual pending rows, and a plan with only ticked Automated rows, are not verified, and `next` returns step `plan` again for each; (d) a plan with `- [ ] 1.1` verifies and moves to `plan-review` (positive control); (e) a `plan-revise` that leaves zero rows fails and the next step is `plan-revise` again; (f) a plan supplied at `init` with all rows ticked still routes to review (unchanged). Fixtures in other test files that verify a `plan` step on a plan with no pending Automated row are given a pending row. The full suite of row 3.3 runs once at the end of this phase to find those fixtures before Phase 3 starts; the subset in rows 2.2 and 2.3 does not reach them all.

### Success Criteria:

#### Automated Verification:

- New CLI cases pass: `node --test skills/10x-pipeline/test/plan-rows.test.mjs`
- Re-plan, pre-plan and loop tests still pass: `node --test --test-concurrency=2 skills/10x-pipeline/test/codereplan.test.mjs skills/10x-pipeline/test/preplan.test.mjs skills/10x-pipeline/test/loops.test.mjs skills/10x-pipeline/test/loops-existing.test.mjs`
- Prompt and rule pins still pass: `node --test skills/10x-pipeline/test/step-safety.test.mjs skills/10x-pipeline/test/rule-levels.test.mjs skills/10x-pipeline/test/provenance.test.mjs`
- The rule file names the row form and the pending row: `grep -n "pending" skills/10x-pipeline/rules/steps/plan.md` lists the new rule

#### Manual Verification:

- The retry reason reads clearly in the `next` output of a failed first plan

---

## Phase 3: Documentation, indexes and full suite

### Overview

`docs/REFERENCE.md` states the minimum a plan needs to verify and the reader's row and fence rules; the indexes list the new test and the new rule; the whole suite passes.

### Changes Required:

#### 1. REFERENCE

**File**: `docs/REFERENCE.md` (the verification bullet at line 126, the plan-step rules paragraph at line 61, the review-findings bullet at line 193)

**Intent**: Say, in one bullet each: a `plan` or `plan-revise` step verifies only when `plan.md` has at least one pending Automated row (`- [ ] N.M title` at the start of a line under `#### Automated`), and a failed first plan is asked for again; the reader counts only that row form (`*`, numbered and indented items are not rows) and ignores code fences; a plan supplied by the user and all-done resumed runs route as before; findings blocks ignore fenced headings.

**Contract**: Edit the existing bullets; add no new section. Update the routing bullets as `AGENTS.md` requires for a change to `decide`.

#### 2. Indexes

**Files**: `skills/10x-pipeline/test/README.md` (row for `plan-rows.test.mjs`), `skills/10x-pipeline/rules/README.md` (the `steps/plan.md` row mentions the row-form rule)

**Intent**: Keep the indexes true.

**Contract**: One row each, same table style.

### Success Criteria:

#### Automated Verification:

- The documented minimum is present: `grep -n "pending Automated row" docs/REFERENCE.md`
- The new test is indexed: `grep -n "plan-rows.test.mjs" skills/10x-pipeline/test/README.md`
- The full suite passes: `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- Smoke check in a scratch project (`isolation.require` false): `init <id> --goal "<text>"` returns `action: "run"` with step `plan`, and after a result `done` on a plan written with `* [ ]` rows, `next` returns step `plan` again

#### Manual Verification:

- The REFERENCE wording reads as the minimum a plan needs, not as a change of the plan format
- Before merging: the plan of the next run in this wave has its rows in `- [ ]` form (the check `WAVES.md` asks for)

---

## Testing Strategy

### Unit Tests:

- `readPlan` and `readReview` fence cases, CRLF and the archive-equivalence test, all in `plan-rows.test.mjs`.

### Integration Tests:

- CLI cases through `init` and `next` for the non-verifying `plan` and `plan-revise`, the positive control and the unchanged resumed-run routing.

### Manual Testing Steps:

1. Read the `next` output after a `plan` step that wrote `* [ ]` rows and confirm the reason names the missing pending Automated row.
2. Read the REFERENCE bullets once for wording.

## Performance Considerations

The tracker is one pass over the lines of `plan.md` and of each review file; both are read once per `next`, as before.

## References

- Change identity and origin: `context/changes/plan-zero-rows-skips-implement/change.md`
- `readPlan`: `skills/10x-pipeline/scripts/state.mjs:318`; `readFindings`: `state.mjs:363`
- Verification and `decide`: `skills/10x-pipeline/scripts/flow.mjs:607`, `:772`, `:856`
- `verifyCodeReplan`: `skills/10x-pipeline/scripts/steps.mjs:515`
- OpenSpec reader for contrast: `skills/openspec-pipeline/scripts/openspec.mjs:11`, `:176`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Fence-aware readers

#### Automated

- [x] 1.1 Fenced and CRLF plans read the real rows: `node --test skills/10x-pipeline/test/plan-rows.test.mjs` — f4fbfefa
- [x] 1.2 Archived plans read the same as the old reader: the archive-equivalence case of `plan-rows.test.mjs` passes against all `context/archive/*/plan.md` — f4fbfefa
- [x] 1.3 Finding blocks survive fenced headings: the `readReview` cases of `plan-rows.test.mjs` pass — f4fbfefa
- [x] 1.4 Archived reviews read the same: a scratch script compares `readReview(...).findings` of the pre-change `state.mjs` and the new one over every `context/archive/*/reviews/*.md` and prints zero differences — f4fbfefa
- [x] 1.5 Existing reader tests still pass: `node --test skills/10x-pipeline/test/crlf-plan.test.mjs skills/10x-pipeline/test/run-state.test.mjs` — f4fbfefa

#### Manual

- [ ] 1.6 The tracker's comment names its limit (fences deeper than three spaces, in block quotes or list items, and `<pre>` are not tracked) in the `shortcut:` form

### Phase 2: Verify only with a pending Automated row, and retry a failed first plan

#### Automated

- [x] 2.1 New CLI cases pass: `node --test skills/10x-pipeline/test/plan-rows.test.mjs` — 1e1e3f4f
- [x] 2.2 Re-plan, pre-plan and loop tests still pass: `node --test --test-concurrency=2 skills/10x-pipeline/test/codereplan.test.mjs skills/10x-pipeline/test/preplan.test.mjs skills/10x-pipeline/test/loops.test.mjs skills/10x-pipeline/test/loops-existing.test.mjs` — 1e1e3f4f
- [x] 2.3 Prompt and rule pins still pass: `node --test skills/10x-pipeline/test/step-safety.test.mjs skills/10x-pipeline/test/rule-levels.test.mjs skills/10x-pipeline/test/provenance.test.mjs` — 1e1e3f4f
- [x] 2.4 The rule file names the row form and the pending row: `grep -n "pending" skills/10x-pipeline/rules/steps/plan.md` lists the new rule — 1e1e3f4f

#### Manual

- [ ] 2.5 The retry reason reads clearly in the `next` output of a failed first plan

### Phase 3: Documentation, indexes and full suite

#### Automated

- [x] 3.1 The documented minimum is present: `grep -n "pending Automated row" docs/REFERENCE.md`
- [x] 3.2 The new test is indexed: `grep -n "plan-rows.test.mjs" skills/10x-pipeline/test/README.md`
- [x] 3.3 The full suite passes: `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- [x] 3.4 Smoke check in a scratch project with `isolation.require` false: `init` returns `action: "run"` with step `plan`, and `next` after a `done` result on a plan written with `* [ ]` rows returns step `plan` again

#### Manual

- [ ] 3.5 The REFERENCE wording reads as the minimum a plan needs, not as a change of the plan format
- [ ] 3.6 Before merging: the plan of the next run in this wave has its rows in `- [ ]` form (the check `WAVES.md` asks for)
