# Report a stale change.md status when a run ends done — Implementation Plan

## Overview

A 10x run without `--archive` that ends `done` leaves its folder in `context/changes/`, and `change.md` often still says `new` or `planned`, so `/10x-status` shows finished work as not started. This plan makes the router's `done` output carry the `change.md` status it found, and makes the `done` branch of the 10x skill tell the user when that status is stale and how to close the change. The housekeeping archive of the finished folders is already done and is not part of this plan.

## Current State Analysis

- The plain `done` output is built in one place: `skills/10x-pipeline/scripts/route.mjs:148-151` (`end({ action: "done", reason, manualPending, ...doneNotes(d), steps })`). A run with `meta.archive === true` never gets here: it goes to `archiveDone` (`route.mjs:147`, action `archive`). An isolated run (worktree) also ends through this line when it has no `--archive`; `isolation.mjs:673` is the archive path only.
- `frontmatterField(file, key)` (`skills/10x-pipeline/scripts/state.mjs:371`) already reads one frontmatter field, quotes stripped, `null` when the file, block or field is missing. The router already uses it for `status` in `route.mjs:281,289`.
- `doneNotes` (`steps.mjs:255`) feeds `meta.outcome`, the `archive` summary and the report's archive lines. It is the wrong home for a value that the skills (not the router) change after the run.
- The OpenSpec chain has no `change.md` and no status stamp (`openspec/changes/<id>/`), so `decideOpenspec` runs reach the same `end(...)` line with `openspec === true`.
- The `done` branch of `skills/10x-pipeline/SKILL.md:62-65` reports verdict, steps, Manual checklist, `status`, the `report` path, then the pull request step. `skills/openspec-pipeline/SKILL.md:70-73` is the same branch for OpenSpec.
- Status values and order (`/10x-new`): `new`, `planned`, `plan_reviewed`, `implementing`, `implemented`, `impl_reviewed`, `archived`. A run that passed its implementation review should read `impl_reviewed`.
- Test conventions: black-box CLI tests on scratch projects (`helpers.mjs`: `makeProject` writes `change.md` with `status: planned`; the `done` fixture of `route.test.mjs:185-196` is a plan with one ticked row, an approved impl review and a log of `plan`, `plan-review`, `implement`, `impl-review` entries). Skill content tests read `SKILL.md` and slice a branch (`archive-gate.test.mjs:19-28`).

## Desired End State

- `route.mjs next|init` on a 10x run that ends `done` without `--archive` prints `changeStatus`: the string `status` of `change.md`, or `null` when the file, the frontmatter or the field is missing. An OpenSpec run prints none. The `archive` and `halt` outputs, `meta.json` and `report.md` are unchanged.
- The `done` branch of `skills/10x-pipeline/SKILL.md` prints one line when `changeStatus` is not `impl_reviewed`, and always names the two ways to close the change: `/10x-archive <change-id>`, or `/agent-smith:10x-pipeline <change-id> --archive` run again.
- Verified by the new tests, the whole suite locally and a green CI run on the pull request.

### Key Discoveries:

- One output site covers both the plain run and the isolated run: `route.mjs:150`. No change to `isolation.mjs`.
- The skills own `change.md`; the router only reads it (`change.md` fix direction 2). `changeStatus` is a live read at the `done` call, so it is not stored in `meta.outcome` where it would go stale.
- `AGENTS.md` hard rules: no model, effort or tier word in `SKILL.md` (no such word is needed here); the six-`**GIVEN**` and Anti-stall tests (`skill-loop.test.mjs`, `archive-gate.test.mjs`) stay green as long as the new text is not a `**GIVEN**` line and sits inside the `done` branch.

## What We're NOT Doing

- No write to `change.md` by the router or by the skill: the line only informs the user.
- No `--archive` by default (needs its own decision record, per `change.md`).
- No research item 4 of `change.md` (which step skips the frontmatter update and a prompt rule for it); the goal limits this plan to the router output and the skill text. It stays open in `change.md`.
- No change to `skills/openspec-pipeline/SKILL.md`, the `archive` or `halt` outputs, `doneNotes`, `meta.json`, `report.md`, `status` or the policy.
- No test through a real linked worktree: the isolated run ends on the same output line.

## Implementation Approach

Test first. Phase 1 adds the router tests, which fail against today's output, then the one-line router change and the `docs/REFERENCE.md` bullet. Phase 2 adds the skill content test, which fails against today's `SKILL.md`, then the skill text (`AGENTS.md` is not edited in this run). Each phase ends with the full suite.

## Phase 1: Router output

### Overview

Add `changeStatus` to the plain `done` output of a 10x run and pin it.

### Changes Required:

#### 1. New test file

**File**: `skills/10x-pipeline/test/change-status.test.mjs`

**Intent**: Pin `changeStatus` for a stale, a correct, a missing-field and a missing-file status, that the other actions and the stored files do not carry it, and that an OpenSpec `done` has none. Same style as `route.test.mjs` (CLI through `run`/`init`, `after(cleanupAll)`).

**Contract**: Tests:
- 10x `done` (fixture as `route.test.mjs:185-196`) with `change.md` status `planned` → `json.action === "done"` and `json.changeStatus === "planned"`; with `impl_reviewed` → `"impl_reviewed"`; with a quoted value `"impl_reviewed"` → the unquoted string.
- `change.md` with frontmatter but no `status:` line, and `change.md` with no frontmatter → `json.changeStatus === null` and `"changeStatus" in json` is true. `change.md` deleted before the final `next` is a precheck halt (`haltNoChangeMd`, `route.mjs:63`), so "missing file" is shown by the no-frontmatter case; the test does not delete the file.
- The value is read at the call: change `change.md` status after a first `done`, run `next` again, and the new status shows.
- `readMetaFile(project).outcome` and `readReportFile(project)` carry no `changeStatus`.
- A run with `--archive` (git project, see `archive.test.mjs`) returns `action: "archive"` with no `changeStatus` in the output or in `summary`; a halt output carries none.
- OpenSpec `done` (build it as `openspec-steps.test.mjs:150-165` does) has no `changeStatus` key.

#### 2. Router output

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: In the `done` object returned at the plain end of a run, add `changeStatus` for the 10x chain only, read with the existing `frontmatterField` from `change.md` of the run's change folder.

**Contract**: `{ action: "done", reason, manualPending, ...doneNotes(d), steps, changeStatus }` where `changeStatus = frontmatterField(path.join(p.change, "change.md"), "status")` when `!openspec`, and the key is absent for OpenSpec. `frontmatterField` already returns `null` for a missing file, block or field. No new import (`frontmatterField`, `path` are imported at `route.mjs:23`).

#### 3. Reference

**File**: `docs/REFERENCE.md`

**Intent**: Document the field next to the other `done` output notes of the 10x section (near the `--archive` bullets at lines 101-114), per the AGENTS.md rule to keep routing behavior documented.

**Contract**: One bullet: a 10x run that ends `done` without `--archive` prints `changeStatus` (the `status` of `change.md` at that call, or `null` when it cannot be read); the router never writes `change.md`; `archive`, `halt`, `meta.json`, `report.md` and the OpenSpec chain carry none; the 10x skill uses it in its `done` branch.

### Success Criteria:

#### Automated Verification:

- New tests fail against the unchanged router, then pass: `node --test skills/10x-pipeline/test/change-status.test.mjs`
- Existing router, archive and OpenSpec tests stay green: `node --test skills/10x-pipeline/test/route.test.mjs skills/10x-pipeline/test/archive.test.mjs skills/10x-pipeline/test/openspec-steps.test.mjs`
- Whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- No recursive delete in the new test: `node --test skills/10x-pipeline/test/no-recursive-delete.test.mjs`

#### Manual Verification:

- In a scratch project with a finished 10x run, `node skills/10x-pipeline/scripts/route.mjs init <id> --goal "<text>"` prints valid JSON with `changeStatus` and no other change to the `done` object.

**Implementation Note**: After this phase and its automated checks, pause for confirmation before the skill phase.

---

## Phase 2: Skill text

### Overview

Tell the user at `done` that the change is still open, and how to close it.

### Changes Required:

#### 1. Skill content test

**File**: `skills/10x-pipeline/test/change-status.test.mjs` (same file as Phase 1)

**Intent**: Content check of the new `done` text in `SKILL.md`, in the style of `archive-gate.test.mjs`. It fails before the skill edit.

**Contract**: Tests on the `done` branch of `skills/10x-pipeline/SKILL.md` (slice from the line starting `- **`done`**` to the next `- **` line):
- It names `changeStatus`, `impl_reviewed`, `/10x-archive <change-id>`, `--archive` and the phrase `both commands run from the run root` (the bare words `run root` already occur in the branch).
- The new text sits after the `status` call and before `Then do the pull request step`.
- It contains no `AskUserQuestion` and no `**GIVEN**` (the six-rule count stays: `skill-loop.test.mjs`).
- `skills/openspec-pipeline/SKILL.md` `done` branch does not name `changeStatus`.

#### 2. 10x skill

**File**: `skills/10x-pipeline/SKILL.md`

**Intent**: In the `done` branch, after the lines that report verdict, steps, checklist, `status` and the `report` path, add three sentences. First: when `changeStatus` is not `impl_reviewed`, print one line `Change status: <changeStatus or missing>, expected impl_reviewed. The run did not set change.md to that status.` (`null` is printed as `missing`). Second, always: tell the user the change is still open in `context/changes/` and name the two ways to close it, `/10x-archive <change-id>` or running `/agent-smith:10x-pipeline <change-id> --archive` again (a resume keeps the log and ends in the `archive` branch). Third, when the run root is not `<root>` (an isolated run), say that both commands run from the run root (the worktree), because the change folder and its status live on the run branch and the main checkout keeps the old status until that branch is merged. The orchestrator never edits `change.md` itself.

**Contract**: Plain prose in the existing `done` bullet, no new `**GIVEN**` line, no model, effort or tier word. The wording of the printed line is the one above, so the content test can match it.

#### 3. AGENTS.md (not edited)

**Out of scope for this run**: `AGENTS.md` is owned by the parallel run `agents-md-slim`, so this run does not edit it. The test-inventory bullet for `skills/10x-pipeline/test/change-status.test.mjs` is left for a follow-up after that run merges.

### Success Criteria:

#### Automated Verification:

- Skill content tests fail before the edit, then pass: `node --test skills/10x-pipeline/test/change-status.test.mjs`
- Anti-stall, archive-gate, rule-form and no-model-word checks stay green: `node --test skills/10x-pipeline/test/skill-loop.test.mjs skills/10x-pipeline/test/archive-gate.test.mjs skills/10x-pipeline/test/rules.test.mjs skills/10x-pipeline/test/openspec-skill.test.mjs`
- Whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- Version fields still equal: `node tools/version-check.mjs`

#### Manual Verification:

- The diff of `SKILL.md` reads as one coherent `done` branch: the step order (usage, report, status, line, pull request step) is unchanged.
- CI is green on the pull request of the run branch.

---

## Testing Strategy

### Unit Tests:

- `change-status.test.mjs`: the `changeStatus` value for a stale, a correct, a quoted, a missing-field and a no-frontmatter `change.md`; a re-read at a later call; absence in `meta.outcome`, `report.md`, the `archive` output and `summary`, a halt, and an OpenSpec `done`.

### Integration Tests:

- The whole `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` run, which drives the router through the CLI.

### Manual Testing Steps:

1. In a scratch project, finish a run with `change.md` at `planned` and read `changeStatus` from the `done` output.
2. Read the new `done` text in `SKILL.md` as the orchestrator would.

## Performance Considerations

One extra small file read at the end of a run. None otherwise.

## Migration Notes

None. `changeStatus` is a new optional key of an existing output; the skills ignore a router output without it only if the plugin is older than the router, which ships together.

## References

- Change: `context/changes/finished-changes-left-open/change.md`
- Done output: `skills/10x-pipeline/scripts/route.mjs:148-151`
- Frontmatter reader: `skills/10x-pipeline/scripts/state.mjs:371`
- Skill `done` branches: `skills/10x-pipeline/SKILL.md:62-65`, `skills/openspec-pipeline/SKILL.md:70-73`
- Test patterns: `skills/10x-pipeline/test/route.test.mjs:185`, `skills/10x-pipeline/test/archive-gate.test.mjs:19`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Router output

#### Automated

- [x] 1.1 New tests fail against the unchanged router, then pass: `node --test skills/10x-pipeline/test/change-status.test.mjs` — 48a761d
- [x] 1.2 Existing router, archive and OpenSpec tests stay green: `node --test skills/10x-pipeline/test/route.test.mjs skills/10x-pipeline/test/archive.test.mjs skills/10x-pipeline/test/openspec-steps.test.mjs` — 48a761d
- [x] 1.3 Whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` — 48a761d
- [x] 1.4 No recursive delete in the new test: `node --test skills/10x-pipeline/test/no-recursive-delete.test.mjs` — 48a761d

#### Manual

- [ ] 1.5 In a scratch project with a finished 10x run, `init` prints valid JSON with `changeStatus` and no other change to the `done` object — evidence: evidence/test-done-changestatus.txt

### Phase 2: Skill text

#### Automated

- [x] 2.1 Skill content tests fail before the edit, then pass: `node --test skills/10x-pipeline/test/change-status.test.mjs` — 48a761d
- [x] 2.2 Anti-stall, archive-gate, rule-form and no-model-word checks stay green: `node --test skills/10x-pipeline/test/skill-loop.test.mjs skills/10x-pipeline/test/archive-gate.test.mjs skills/10x-pipeline/test/rules.test.mjs skills/10x-pipeline/test/openspec-skill.test.mjs` — 48a761d
- [x] 2.3 Whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` — 48a761d
- [x] 2.4 Version fields still equal: `node tools/version-check.mjs` — 48a761d

#### Manual

- [ ] 2.5 The diff of `SKILL.md` reads as one coherent `done` branch with the step order unchanged — evidence: evidence/judgment-skill-done-branch.md
- [ ] 2.6 CI is green on the pull request of the run branch
