# archiveDone reuses routerCommit Implementation Plan

## Overview

`archiveDone` (`skills/10x-pipeline/scripts/isolation.mjs`) stages, commits and runs the post-commit checks inline. `routerCommit` (same file) already does the same for the start commit, step commits and the late usage commit. Make `archiveDone` call `routerCommit(g, timeout, { rel, message })` and map its result to the archive halt fields. GitHub issue #94.

## Current State Analysis

- `routerCommit` (`isolation.mjs:322-357`): `add`, `diff --cached --quiet`, `commit -- rel`, then index-empty, commit-only-in-folder and folder-clean checks. It returns `{ commit }` or `{ error, commit? }`; `commit` is set only when the commit exists.
- `archiveDone` (`isolation.mjs:645-672`) repeats those steps. Differences found:
  - Folder-clean and index-empty checks also run when no commit was made (a resume with the folder already committed); `routerCommit` returns early with `{ commit: null }` and skips them.
  - Listed names in the clean check are unprefixed in `archiveDone` (`unprefix`) and raw in `routerCommit`.
  - Failure texts differ: "The change folder was unstaged again" versus "The router's own add was unstaged again"; the post-commit halt appends `COMMIT_EXISTS`, `routerCommit` appends "The commit <sha> exists and the router does not undo it."
  - `archiveDone` yields `archive: SKIP_FAILED, committed: false` before the commit and `archive: SKIP_COMMITTED, committed: true` after.
- Tests match only loosely: `archive.test.mjs` (`/Nothing was committed/`, `/not clean after the commit: .*stray\.txt/`), `stepcommit.test.mjs` (`/unstaged again/`, `/Nothing was committed\./`). No test pins the other texts.

## Desired End State

One commit path. `archiveDone` has no inline `git add`, `commit` or post-commit check. All its observable outputs (halt fields, reasons that tests match, `commit` short hash, `ignored`) are unchanged except the harmless text unification above. `routerCommit`'s other callers (start, step, late usage) keep their behavior.

## What We're NOT Doing

- No change to the pre-checks (steps 1 to 3 of `archiveDone`), the report write, or the archive action.
- No new policy keys, no ADR (no decision beyond the issue's fix), no change to `route.mjs`.
- No unification of halt wording beyond what `routerCommit` already says.

## Implementation Approach

Extend `routerCommit` so it covers what `archiveDone` needs, then replace the inline block. Keep the extension small: the post-commit checks run on the no-commit path too when `rel` is set, and every error from `routerCommit` carries the reason without its own "commit exists" suffix, so `archiveDone` can add `COMMIT_EXISTS`.

## Phase 1: Single commit path

### Overview

Adapt `routerCommit`, switch `archiveDone` to it, run the suite.

### Changes Required:

#### 1. routerCommit covers the resume path

**File**: `skills/10x-pipeline/scripts/isolation.mjs`

**Intent**: Run the index-empty and folder-clean checks also when nothing was staged (`rel` set), so a resumed archive still halts on a dirty folder. Show names without the git prefix in the folder-clean message, as `archiveDone` does. Keep the commit-only-in-folder check tied to a commit that was made.

**Contract**: Return shape `{ commit, made }` or `{ error, reason?, commit?, made? }`. `made` says whether this call made a commit. `commit` is its full hash, or `null` when nothing was staged or git could not report the hash; it is never the label "HEAD" (review F1). Errors of the post-commit checks carry `reason` (the message without the "The commit ... exists" suffix), `commit` and `made`, so callers read a defined `commit` as "post-commit". Pre-commit errors (`failed`) have `error` only. The start and step commits set their guard (`meta.startCommit`, the entry's `commit`) when `made` is true or there is no error, so a check that fails with no commit made leaves the guard absent and the next `init` retries (review F2). The late usage command restores the old bytes only when `made` is false.

#### 2. archiveDone calls routerCommit

**File**: `skills/10x-pipeline/scripts/isolation.mjs`

**Intent**: Replace step 4's add/diff/commit block and step 5 with one `routerCommit` call after the report is written. Map: no `commit` key → halt with `error`, `archive: SKIP_FAILED`, `committed: false`; `commit` defined with `error` → halt with `reason + " " + COMMIT_EXISTS`, `archive: SKIP_COMMITTED`, `committed: true`; success → the archive action's short `commit` is `null` when `made` is false, else the hash cut to 7 characters, or the label "HEAD" when git could not report the hash (as before this change). Remove the now unused `commitFailed`, `commitHalt`, `madeCommit` and the `unprefix` helper if nothing else uses it (`prefix` is still used by `ignored`).

**Contract**: Archive action output fields unchanged: `commit` is a short hash string or `null`; halt fields `archive` and `committed` as above. Keep the report-write failure halt before the commit.

### Success Criteria:

#### Automated Verification:

- Archive, step-commit, late-usage, isolation and OpenSpec archive tests pass: `node --test skills/10x-pipeline/test/archive.test.mjs skills/10x-pipeline/test/stepcommit.test.mjs skills/10x-pipeline/test/late-usage.test.mjs skills/10x-pipeline/test/isolation.test.mjs skills/10x-pipeline/test/openspec-archive.test.mjs`
- Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- `archiveDone` has no direct `"commit", "-m"` call: `grep -c '"commit", "-m"' skills/10x-pipeline/scripts/isolation.mjs` prints 1 (`grep -c` counts lines, and the two `routerCommit` forms sit on one line)
- A resume with a stray file in the change folder still halts with `not clean after the commit`: covered by the existing `archive.test.mjs` case at line 794, plus one new test for the no-commit path (folder already committed, then a stray file added)

#### Manual Verification:

- `init` and `status` against a scratch change folder print valid JSON (AGENTS.md Testing)
- Diff read: no remaining duplicate of the add/commit/post-commit logic in `archiveDone`

**Implementation Note**: After automated verification passes, pause for manual confirmation before archiving.

---

## Testing Strategy

### Unit Tests:

- New case in `skills/10x-pipeline/test/archive.test.mjs`: resume where the folder is already committed and clean passes with `commit: null`; same resume with an untracked stray file in the folder halts with `committed: true` and the clean-check text (the no-commit path now handled by `routerCommit`).
- Existing cases cover: pre-commit failure (`committed: false`, "Nothing was committed"), hook-staged index, paths outside the folder, dirty folder after commit.

### Manual Testing Steps:

1. Run `init` and `status` in a scratch project with `context/changes/<id>/change.md`.

## Performance Considerations

None: same git calls, same order.

## Migration Notes

None. Halt texts differ slightly (see Current State); no doc or test pins them. `docs/REFERENCE.md` line 101 stays accurate ("unstages the router's own add").

## References

- Issue: GitHub #94, `context/changes/archive-done-routercommit/change.md`
- `routerCommit`: `skills/10x-pipeline/scripts/isolation.mjs:322`; callers at `:400`, `:417`, `:444`
- `archiveDone`: `skills/10x-pipeline/scripts/isolation.mjs:545`
- ADR-010, ADR-019 (commit paths)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Single commit path

#### Automated

- [x] 1.1 Archive, step-commit, late-usage, isolation and OpenSpec archive tests pass
- [x] 1.2 Full suite passes
- [x] 1.3 archiveDone has no direct commit call
- [x] 1.4 A resume with a stray file in the change folder still halts with not clean after the commit

#### Manual

- [x] 1.5 init and status against a scratch change folder print valid JSON — evidence: evidence/command-init-status-json.txt
- [x] 1.6 Diff read shows no remaining duplicate of the add/commit/post-commit logic in archiveDone — evidence: evidence/judgment-archivedone-no-duplicate.txt
