# Lock-free pending checks and a bounded setup temp (F2, F3) Implementation Plan

## Overview

Close follow-ups F2 and F3 of the PR #252 review in `prepare-run.mjs`. The pre-selection pending checks (`checkCurrentPending`) stop taking the branch setup lock, so a stale lock no longer turns an isolation-off call into a failure. `writePending` stages the intent in one fixed temp name that the next write replaces, so a killed setup leaves at most one bounded file instead of a permanent UUID-named leftover. F1 (deletion propagation) is out of this plan; see `frame.md`.

## Current State Analysis

Problem framing is settled by `frame.md` (F2 HIGH, F3 HIGH, both reproduced on 2026-11-22). Lifted from its hypothesis table:

- `checkCurrentPending` (`skills/10x-pipeline/scripts/prepare-run.mjs:239`) calls `withSetupLock` only to read `<marker>.pending`. `withSetupLock` (`:142`) creates `<marker>.lock` with `wx` and unlinks it, so the "read" is a write, and a stale lock fails the call with "Setup lock exists…" where it used to return `case: "opt-out"`. It runs at `:248` (isolation off) and at `:295` (isolation on, current linked branch differs from the selected run branch).
- The writer publishes the record with temp-then-rename (`writePending`, `:179`) and removes it by `unlinkSync` at the end of setup (`:350`, `:409`), so a reader sees a whole record or none. The registration of the worktree comes after the rename, so every registered incomplete run worktree already has a published record.
- `writePending` stages in `<marker>.<uuid>.tmp`. A SIGKILL between the exclusive open and the rename leaves the lock and that temp. Nothing reads the temp, a retry after manual lock removal succeeds, and the temp then stays forever. The leftovers check at `skills/10x-pipeline/test/prepare-run.test.mjs:310` matches `/\.(lock|pending)$/` and cannot see it.
- Every `writePending` call sits inside `withSetupLock`, so one branch has one writer at a time.

### Key Discoveries:

- `readPending` (`:161`) does `lstat`, then `readPolicyObject`; a removal between the two surfaces as "Cannot read pending setup" (`:175`). That is the only new failure a lock-free read introduces.
- The tests that expect "Setup lock exists.*inspect" (`prepare-run.test.mjs:590`, `:626`, `:675`, `:914`, `:1037`) reach the main lock at `:297`, not `checkCurrentPending`, so they stay valid.
- `docs/REFERENCE.md:160-161` and ADR-010 Amendment 6 describe the lock and the pending record; both need the new behavior. ADR index row 16 lists Amendments only in general terms.
- Lesson (`context/foundation/lessons.md`): grep every doc for the old behavior when a script's output changes, including `docs/REFERENCE.md`.

## Desired End State

- A linked worktree on a named branch with isolation off returns `opt-out` with a stale setup lock present. A published pending record still refuses with the original-project-root guidance and an invalid or non-regular record still refuses with the inspect guidance. The call creates, touches and removes no file in the Git common directory.
- The pre-selection check at `:295` is lock-free too. The main setup lock at `:297` keeps serializing selection, copy and validation.
- A SIGKILL before the rename leaves the lock and `<marker>.tmp`. After the operator removes the lock, the retry replaces the temp and the successful setup leaves no `.tmp`.
- Verified by the new CLI tests and the frame's two scratch reproductions.

## What We're NOT Doing

- F1, deletion propagation. It moves to the later change `prepare-run-deletion-propagation`.
- Scanning for or removing old UUID-named temps from earlier versions. Their cleanup stays manual and is documented.
- Changing the stale-lock policy: the lock is still never removed automatically, and the main lock at `:297` is unchanged.
- Fixing the `writePending` catch block that can mask the original error with `ENOENT` (not reproduced).
- Exporting `prepare-run.mjs` internals for unit tests; tests drive the CLI.
- Editing `SKILL.md` files, so the `skill-loop.test.mjs` ceiling stays as it is.

## Implementation Approach

Make the smallest code change that fits the existing structure. One shared helper builds the branch's marker base path so `withSetupLock` and the reader agree on the name. The lock-free reader reuses `readPending` and a single re-`lstat` to turn "vanished during the read" into "absent". The fixed temp name removes the need for a directory scan, and the existing branch lock is what makes unlinking a leftover safe. Tests then pin each behavior through the real CLI, using small `--import` preloads for the two interruption cases, as the existing cleanup tests do.

## Phase 1: Lock-free pending checks and a bounded temp

### Overview

Change `prepare-run.mjs` for F2 and F3. No test or doc edits yet.

### Changes Required:

#### 1. Shared marker path

**File**: `skills/10x-pipeline/scripts/prepare-run.mjs`

**Intent**: Give `withSetupLock` and the pre-selection check one source for `<common>/agent-smith-setup-<encodeURIComponent(branch)>`.

**Contract**: A small helper returns that base path for `(common, branch)`; the lock is `<base>.lock`, the record `<base>.pending`, the staging file `<base>.tmp`. `withSetupLock` keeps its signature and error text.

#### 2. Lock-free `checkCurrentPending`

**File**: `skills/10x-pipeline/scripts/prepare-run.mjs` (`prepare`, `checkCurrentPending`, `:239`)

**Intent**: Read the current branch's canonical record without the lock, at both call sites, and keep the refusal behavior for real records.

**Contract**: When `gitDir !== common` and the checkout is on a named branch, call `readPending` on `<base>.pending`. A record throws `pendingOrigin(...)` as today. If `readPending` throws and `lstat` of the record now reports no file, treat it as absent (the writer's unlink won the race); any other error, including an invalid or non-regular record, propagates with its existing message. The function creates, opens for write, and removes nothing. Both call sites (`:248`, `:295`) keep calling it unchanged.

#### 3. Fixed staging name in `writePending`

**File**: `skills/10x-pipeline/scripts/prepare-run.mjs` (`writePending`, `:179`)

**Intent**: Bound the residue of a killed write to one file that the next write replaces.

**Contract**: Stage in `<marker>.tmp` instead of `<marker>.<uuid>.tmp`. Before the exclusive `wx` open (mode `0o600`), unlink any existing entry at that path when `lstat` finds one (a symlink is unlinked, never followed; a directory makes the unlink fail, and setup stops with that error and deletes nothing). One comment line states that the branch lock makes any existing entry stale. The write, rename and existing catch block are unchanged. Remove the `randomUUID` import at `:2`; the UUID temp name was its only use.

### Success Criteria:

#### Automated Verification:

- Existing setup suites pass: `node --test --test-concurrency=2 skills/10x-pipeline/test/prepare-run.test.mjs skills/10x-pipeline/test/prepare-run-timeout.test.mjs`
- The recursive-delete guard passes: `node --test skills/10x-pipeline/test/no-recursive-delete.test.mjs`

#### Manual Verification:

- Frame F2 repro: in a scratch repo, a linked worktree with `isolation.require: false` and a stale `agent-smith-setup-agent-smith%2Fdemo.lock` returns `case: "opt-out"`, the lock file is unchanged.
- Frame F3 repro: SIGKILL at the temp-to-pending rename, then remove the lock and rerun setup; setup succeeds and no `.tmp` remains in the Git common directory.

**Implementation Note**: After this phase and its automated checks pass, pause for the manual confirmation before Phase 2.

---

## Phase 2: Regression tests and docs

### Overview

Pin both behaviors through the CLI, extend the leftovers check, and update the docs that describe the lock and the pending record.

### Changes Required:

#### 1. F2 tests

**File**: `skills/10x-pipeline/test/prepare-run.test.mjs`

**Intent**: Prove the pre-selection checks are lock-free and still refuse real records.

**Contract**: Drive the setup CLI in scratch repos (helpers `fixture`, `linked`, `override`, `setup`). Reuse existing tests where they already cover the path:

- `:295` path: extend the existing test "unrelated linked branch…" (`prepare-run.test.mjs:142`, `linked(p, "feature/demo")`, isolation on, expects `created`) with a stale `agent-smith-setup-feature%2Fdemo.lock` before the call; assert `created` and the lock bytes unchanged.
- `:248` valid record: the existing test at `:520` (linked run worktree, isolation off, published record refuses with the original-project-root message) stays as the coverage; no new test.
- New: isolation off, linked worktree on a named branch, stale lock for that branch: result `case: "opt-out"`, lock bytes unchanged. With no lock, the Git common directory listing is identical before and after the call (no lock created).
- New: an invalid record for that branch refuses with "Cannot read pending setup" and leaves the record and the lock state untouched.
- New: a vanished record: a small `--import` preload (written in the scratch project) removes the record when `fs.readFileSync` first reads it, so the read hits `ENOENT`; the call returns `opt-out`.

#### 2. F3 tests and leftovers check

**File**: `skills/10x-pipeline/test/prepare-run.test.mjs`

**Intent**: Prove a killed write leaves one bounded temp and the next write replaces it; make the existing leftovers check see temps.

**Contract**: Extend the regex at `:310` to `/\.(lock|pending|tmp)$/`. Add a test where a preload SIGKILLs the process at the rename of the staging file to the record: assert exit by signal, the lock and `<marker>.tmp` present, then unlink the lock (the documented manual step), rerun setup, and assert `created` or `reused` success with no `.tmp`, no `.pending` and no `.lock` left. Add a case where `<marker>.tmp` is a symlink to a file outside the Git directory: setup replaces the link and the target bytes are unchanged.

#### 3. Docs

**Files**: `docs/REFERENCE.md` (setup bullets at `:160-161`), `docs/ADR/ADR-010-run-worktree-step-commits-and-rollback.md`, `docs/ADR/README.md` (row 16)

**Intent**: Record the new contract where Amendment 6 and the setup bullets describe the lock and the intent.

**Contract**: In `REFERENCE.md`, say the opt-out and pre-selection pending checks read the record without the lock and never fail on a stale lock, and that a killed write leaves `agent-smith-setup-<encoded branch>.tmp`, which the next write on that branch replaces and which an operator may delete after inspecting the lock; temps named `.pending.<uuid>.tmp` from earlier versions stay until removed by hand. Add ADR-010 Amendment 7 (2026-11-22) with a GIVEN/WHEN/THEN rule for the lock-free read (record, invalid record, vanished record) and for the fixed staging name, plus the known limits (legacy UUID temps, symlink replacement under the lock). Add one phrase to the ADR index row. Grep every doc for the old wording per the lessons register before finishing.

### Success Criteria:

#### Automated Verification:

- The setup tests, including the new ones, pass: `node --test --test-concurrency=2 skills/10x-pipeline/test/prepare-run.test.mjs`
- The full suite passes: `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`

#### Manual Verification:

- Each new F2/F3 test fails when its matching change in a scratch copy of `prepare-run.mjs` is reverted.
- `grep -rniE "setup lock|\.pending" docs README.md skills --include=*.md` shows no remaining text that says the opt-out or pre-selection check takes the lock, or that names the UUID temp as current behavior.
- The ADR-010 Amendment 7 text and the `REFERENCE.md` bullets read correctly against the code.

---

## Testing Strategy

### Unit Tests:

- No unit tests: `prepare-run.mjs` exports nothing for them, and the existing suite drives the CLI in scratch repos.

### Integration Tests:

- The CLI tests of Phase 2: stale-lock opt-out, no lock created, pre-selection path (extended `:142`), valid record (existing `:520`), invalid and vanished records, SIGKILL before rename plus retry, symlinked temp.

### Manual Testing Steps:

1. Rerun the frame's F2 and F3 scratch reproductions against the changed script.
2. Revert each code change in a scratch copy and confirm the matching new test fails.

## Performance Considerations

None. The lock-free reader removes one create/unlink pair from each opt-out call.

## Migration Notes

None. Setup output and the record format are unchanged. A downgrade can recreate a UUID temp and the stale-lock failure; old UUID temps need manual removal.

## References

- Frame brief: `context/changes/prepare-run-setup-lock-and-residue-followups/frame.md`
- `skills/10x-pipeline/scripts/prepare-run.mjs:142`, `:161`, `:179`, `:239`, `:295`, `:297`
- `skills/10x-pipeline/test/prepare-run.test.mjs:310`, `:336`, `:590`, `:626`
- `docs/REFERENCE.md:160-161`, `docs/ADR/ADR-010-run-worktree-step-commits-and-rollback.md` (Amendment 6)
- Earlier F2/F3 plan, for comparison only: the run worktree's `context/changes/prepare-run-setup-lock-and-residue-followups/plan.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Lock-free pending checks and a bounded temp

#### Automated

- [ ] 1.1 Existing setup suites pass: `node --test --test-concurrency=2 skills/10x-pipeline/test/prepare-run.test.mjs skills/10x-pipeline/test/prepare-run-timeout.test.mjs`
- [ ] 1.2 The recursive-delete guard passes: `node --test skills/10x-pipeline/test/no-recursive-delete.test.mjs`

#### Manual

- [ ] 1.3 Frame F2 repro: in a scratch repo, a linked worktree with `isolation.require: false` and a stale `agent-smith-setup-agent-smith%2Fdemo.lock` returns `case: "opt-out"`, the lock file is unchanged
- [ ] 1.4 Frame F3 repro: SIGKILL at the temp-to-pending rename, then remove the lock and rerun setup; setup succeeds and no `.tmp` remains in the Git common directory

### Phase 2: Regression tests and docs

#### Automated

- [ ] 2.1 The setup tests, including the new ones, pass: `node --test --test-concurrency=2 skills/10x-pipeline/test/prepare-run.test.mjs`
- [ ] 2.2 The full suite passes: `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`

#### Manual

- [ ] 2.3 Each new F2/F3 test fails when its matching change in a scratch copy of `prepare-run.mjs` is reverted
- [ ] 2.4 `grep -rniE "setup lock|\.pending" docs README.md skills --include=*.md` shows no remaining text that says the opt-out or pre-selection check takes the lock, or that names the UUID temp as current behavior
- [ ] 2.5 The ADR-010 Amendment 7 text and the `REFERENCE.md` bullets read correctly against the code
