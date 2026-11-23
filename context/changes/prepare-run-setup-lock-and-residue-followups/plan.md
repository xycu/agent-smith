# Lock-free pending checks and a bounded setup temp (F2, F3) Implementation Plan

## Overview

Replanned 2026-11-23 against `main` at bf8a105a: Wave 4 changed `prepare-run.mjs` (the lock now splits into `acquireSetupLock`, `withSetupLockSync` and `withSetupLock`) and ADR-010 Amendment 7 is taken, so this change adds Amendment 8. Scope is unchanged.

Close follow-ups F2 and F3 of the PR #252 review in `prepare-run.mjs`. The pre-selection pending checks (`checkCurrentPending`) stop taking the branch setup lock, so a stale lock no longer turns an isolation-off call into a failure. `writePending` stages the intent in one fixed temp name that the next write replaces, so a killed setup leaves at most one bounded file instead of a permanent UUID-named leftover. F1 (deletion propagation) is out of this plan; see `frame.md`.

## Current State Analysis

Problem framing is settled by `frame.md` (F2 HIGH, F3 HIGH, both reproduced on 2026-11-22). Lifted from its hypothesis table:

- `checkCurrentPending` (`skills/10x-pipeline/scripts/prepare-run.mjs:319`) calls `withSetupLockSync` only to read `<marker>.pending`. `acquireSetupLock` (`:207`) creates `<marker>.lock` with `wx` and its release unlinks it, so the "read" is a write, and a stale lock fails the call with "Setup lock exists…" where it used to return `case: "opt-out"`. It runs at `:328` (isolation off) and at `:376` (isolation on, current linked branch differs from the selected run branch). `withSetupLockSync` has a second caller, `cleanup` (`:607`), which keeps the lock.
- The writer publishes the record with temp-then-rename (`writePending`, `:259`) before registration and uses the same writer again to publish `copyComplete: true` before project gates (`:508`). It unlinks the record on a worktree-add failure with no registration (`:433`) or after successful preparation or initialized recovery (`:515`). A reader sees a whole record or absence.
- `writePending` stages in `<base>.pending.<uuid>.tmp` (`:260`; `<base>` is the shared branch marker stem). A SIGKILL between the exclusive open and the rename leaves the lock and that temp. Nothing reads the temp, a retry after manual lock removal can succeed, and the temp then stays forever. The leftovers check at `skills/10x-pipeline/test/prepare-run.test.mjs:311` matches `/\.(lock|pending)$/` and cannot see it.
- Every `writePending` call sits inside `withSetupLock`, so one branch has one writer at a time.

### Key Discoveries:

- `readPending` (`:240`) does `lstat`, then `readPolicyObject`. A removal between the two raises a filesystem `ENOENT`, which the outer catch wraps as "Cannot read pending setup" (`:255`). Check the original error at the record read so the lock-free path can recognize this race without suppressing validation or other I/O failures.
- The existing "Setup lock exists" assertions exercise the main setup lock or cleanup lock (for example `prepare-run.test.mjs:1051` and `:1136`). Those lock acquisitions stay in place.
- `docs/REFERENCE.md:183` (the pending-record bullet) and ADR-010 Amendment 6 describe the lock and the pending record; both need the new behavior. ADR index row 16 lists Amendments only in general terms.
- Lesson (`context/foundation/lessons.md`): grep every doc for the old behavior when a script's output changes, including `docs/REFERENCE.md`.

## Desired End State

- A linked worktree on a named branch with isolation off returns `opt-out` with a stale setup lock present. A published pending record still refuses with the original-project-root guidance and an invalid or non-regular record still refuses with the inspect guidance. The call creates, touches and removes no file in the Git common directory.
- The pre-selection check at `:376` is lock-free too. The main setup lock at `:378` keeps serializing selection, copy and validation.
- A SIGKILL after staging and before either pending-record rename leaves the lock and `<base>.pending.tmp`. After the operator inspects and removes the lock, a retry that publishes a record replaces the temp and leaves no setup temp. A retry that skips publishing can leave that single temp for the next writer or operator cleanup.
- Verified by the new CLI tests and the frame's two scratch reproductions.

## What We're NOT Doing

- F1, deletion propagation. It moves to the later change `prepare-run-deletion-propagation`.
- Scanning for or removing old UUID-named temps from earlier versions. Their cleanup stays manual and is documented.
- Changing the stale-lock policy: the lock is still never removed automatically, and the main lock at `:378` is unchanged.
- Fixing the `writePending` catch block that can mask the original error with `ENOENT` (not reproduced).
- Exporting `prepare-run.mjs` internals for unit tests; tests drive the CLI.
- Editing `SKILL.md` files, so the `skill-loop.test.mjs` ceiling stays as it is.

## Implementation Approach

Use a shared helper for the branch marker base. Give `readPending` a lock-free option that handles a confirmed disappearance during the payload read. Use the existing branch lock to replace the fixed temp. Verify both fixes through the CLI with path-scoped `--import` preloads for the read race and interrupted renames.

## Phase 1: Lock-free pending checks and a bounded temp

### Overview

Change `prepare-run.mjs` for F2 and F3. No test or doc edits yet.

### Changes Required:

#### 1. Shared marker path

**File**: `skills/10x-pipeline/scripts/prepare-run.mjs`

**Intent**: Give `acquireSetupLock` and the pre-selection check one source for `<common>/agent-smith-setup-<encodeURIComponent(branch)>`.

**Contract**: A small helper returns that base path for `(common, branch)`; the lock is `<base>.lock`, the record `<base>.pending`, the staging file `<base>.pending.tmp`. `acquireSetupLock`, `withSetupLockSync` and `withSetupLock` keep their signatures and error text; `cleanup` still takes the lock.

#### 2. Lock-free `checkCurrentPending`

**File**: `skills/10x-pipeline/scripts/prepare-run.mjs` (`prepare`, `checkCurrentPending`, `:319`)

**Intent**: Read the current branch's canonical record without the lock, at both call sites, and keep the refusal behavior for real records.

**Contract**: When `gitDir !== common` and the checkout is on a named branch, call `readPending` on `<base>.pending` with its lock-free option. A record throws `pendingOrigin(...)` as today. Initial `lstat` absence still returns null. For the lock-free option, handle `ENOENT` from the payload read after the regular-file check and before the outer error wrapper. Return null only if a second `lstat` confirms absence. If an entry remains or that check fails, retain the inspect diagnostic for the read error. Preserve the same diagnostic for malformed, invalid, non-regular or unreadable records. The main-lock call keeps the default strict behavior. The pre-selection reader performs no Git-common-directory writes. Both call sites (`:328`, `:376`) keep calling `checkCurrentPending`.

#### 3. Fixed staging name in `writePending`

**File**: `skills/10x-pipeline/scripts/prepare-run.mjs` (`writePending`, `:259`)

**Intent**: Bound the residue of a killed write to one file that the next write replaces.

**Contract**: Stage both record publications in `${file}.tmp` (`<base>.pending.tmp`, the record path plus `.tmp`). Before the exclusive `wx` open (mode `0o600`), unlink any existing entry at that path when `lstat` finds one. Unlink a symlink itself. If the entry is a directory or unlink fails, stop with that error and preserve the entry and canonical record. One comment line states that the branch lock makes any existing entry stale. Keep the existing write, rename and catch block. Remove the `randomUUID` import at `:2`.

### Success Criteria:

#### Automated Verification:

- Existing setup suites pass: `node --test --test-concurrency=2 skills/10x-pipeline/test/prepare-run.test.mjs skills/10x-pipeline/test/prepare-run-timeout.test.mjs`
- The recursive-delete guard passes: `node --test skills/10x-pipeline/test/no-recursive-delete.test.mjs`

#### Manual Verification:

- Frame F2 repro: in a scratch repo, a linked worktree with `isolation.require: false` and a stale `agent-smith-setup-agent-smith%2Fdemo.lock` returns `case: "opt-out"`, the lock file is unchanged.
- Frame F3 repro: SIGKILL at the temp-to-pending rename, then remove the lock and rerun setup; setup succeeds and no `.tmp` remains in the Git common directory.

**Implementation Note**: After this phase and its automated checks pass, continue to Phase 2 in the unattended pipeline and leave the Manual rows for the manual-verification step. Row 1.4 reproduces interruption at the initial publication, before registration.

---

## Phase 2: Regression tests and docs

### Overview

Pin both behaviors through the CLI, extend the leftovers check, and update the docs that describe the lock and the pending record.

### Changes Required:

#### 1. F2 tests

**File**: `skills/10x-pipeline/test/prepare-run.test.mjs`

**Intent**: Prove the pre-selection checks are lock-free and still refuse real records.

**Contract**: Drive the setup CLI in scratch repos (helpers `fixture`, `linked`, `override`, `setup`). Reuse existing tests where they already cover the path:

- `:376` path: extend the existing test "unrelated linked branch…" (`prepare-run.test.mjs:142`, `linked(p, "feature/demo")`, isolation on, expects `created`) with a stale `agent-smith-setup-feature%2Fdemo.lock` before the call; assert `created` and the lock bytes unchanged.
- `:328` valid record: extend "an incomplete worktree with a committed opt-out points back to the original project" (`prepare-run.test.mjs:994`). Add a stale lock and assert the existing original-project-root refusal plus unchanged record and lock bytes. Keep the locked-path refusal coverage at `:855`.
- New: isolation off in a named linked worktree, with a stale lock for that branch: assert `case: "opt-out"` and unchanged lock bytes. For the no-lock run, use a preload that rejects a write-open of the exact branch lock path so a transient lock acquisition fails the check. Keep the Git common directory listing comparison as a final-state check.
- New: with a stale lock present, malformed JSON and a non-regular pending entry each retain the "Cannot read pending setup" inspect diagnostic and preserve the entry and lock.
- New: use a complete pending record and an `fs.readFileSync` preload scoped to its exact path. Remove it immediately before the real read to force `ENOENT` and assert `opt-out`. In a separate case, inject a non-`ENOENT` read error after removing that path and assert the inspect diagnostic. This second case detects an overbroad absence fallback.

#### 2. F3 tests and leftovers check

**File**: `skills/10x-pipeline/test/prepare-run.test.mjs`

**Intent**: Prove a killed write leaves one bounded temp and the next write replaces it; make the existing leftovers check see temps.

**Contract**: Extend the regex at `:311` to `/\.(lock|pending|tmp)$/`. In separate fixtures, intercept the first and second renames to the exact canonical record path and SIGKILL before the real rename. Match the destination and rename count so the preload reaches both the original UUID and fixed-name writers. Use direct `spawnSync` with `--import` and the normal fixture Git environment to assert `signal === "SIGKILL"`. Before retry, assert one matching staging file at `<base>.pending.tmp` and the retained lock. The first kill leaves no canonical record or branch registration. The second leaves the registered worktree and the previous canonical record without `copyComplete`. Unlink only the fixture lock and retry with the normal helper. Assert successful `created` after the first kill and `reused` after the second, with no setup temp, pending record or lock left. Also test that setup removes a symlink at the fixed temp path and leaves its outside target bytes intact. A directory at the temp path must cause setup to fail and the directory and its contents must survive.

#### 3. Docs

**Files**: `docs/REFERENCE.md` (pending-record bullet at `:183`), `docs/ADR/ADR-010-run-worktree-step-commits-and-rollback.md`, `docs/ADR/README.md` (row 16)

**Intent**: Record the new contract where Amendment 6 and the setup bullets describe the lock and the intent.

**Contract**: In `REFERENCE.md`, describe the two lock-free pre-selection reads and the unchanged resolved-branch setup lock. State that an interrupted publication can leave `agent-smith-setup-<encoded branch>.pending.tmp`. The next updated writer on that branch replaces it. For manual removal of either fixed or legacy UUID temps, use the existing PID and descendant check before touching the staging entry and preserve the canonical `.pending` record for recovery. Add ADR-010 Amendment 8 (2026-11-23) at the end of the file with GIVEN/WHEN/THEN rules for pending-read errors and fixed staging, and include the rollback and no-write retry limits from Migration Notes. Add one phrase to the ADR index row. Search project docs for the old wording per the lessons register.

### Success Criteria:

#### Automated Verification:

- The setup tests, including the new ones, pass: `node --test --test-concurrency=2 skills/10x-pipeline/test/prepare-run.test.mjs`

#### Manual Verification:

- The full suite passes: `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- Each new F2/F3 test fails when its matching change in a scratch copy of `prepare-run.mjs` is reverted.
- `grep -rniE "setup lock|\.pending" docs README.md skills --include=*.md` shows no remaining text that says the opt-out or pre-selection check takes the lock, or that names the UUID temp as current behavior.
- The ADR-010 Amendment 8 text and the `REFERENCE.md` bullets read correctly against the code.

**Verification Notes**: Row 2.2 uses the repository's full-suite CI result after publication. The listed local full-suite command is for an owner-requested run or CI failure reproduction under `AGENTS.md`. For row 2.3, use a throwaway copy that preserves the plugin's relative imports and policies, following the fixture at `prepare-run.test.mjs:237`. Revert lock-free reads or fixed staging and check that the corresponding assertions fail. For the read-error contract, deliberately broaden the absence fallback and confirm the injected non-`ENOENT` case fails. Count failures at the intended assertions and run preserved behavior assertions alongside their matching regression.

---

## Testing Strategy

### Unit Tests:

- No unit tests: `prepare-run.mjs` exports nothing for them, and the existing suite drives the CLI in scratch repos.

### Integration Tests:

- The CLI tests of Phase 2 cover stale-lock opt-out, the no-lock path, pre-selection on a different current branch, valid and invalid records, read-error classification, both interrupted publications and retries, and symlink and directory entries at the temp path.

### Manual Testing Steps:

1. Rerun the frame's F2 and F3 scratch reproductions against the changed script.
2. Use the Phase 2 verification notes to check the new regressions against deliberate breaks in a scratch copy.

## Performance Considerations

None. The lock-free reader removes one create/unlink pair from each opt-out call.

## Migration Notes

The setup JSON, canonical record path and schema, and checkout and lock ownership stay compatible. Writers from either version serialize on the same branch lock. The updated writer replaces only the fixed temp, and the older writer uses UUID temps. A retry that skips `writePending` or uses an older writer can leave a fixed temp. After verifying that setup and its descendants have stopped, an operator may remove a stranded temp by its exact path and keep the canonical record for recovery. Legacy UUID temps also need manual removal.

Finish any `copyComplete` recovery on a version that understands it, as required by ADR-010 Amendment 7. Roll back with a normal revert once pending setup settles, preserving run worktrees, branches and records. Reverting this change restores the earlier opt-out lock behavior and UUID staging.

## References

- Frame brief: `context/changes/prepare-run-setup-lock-and-residue-followups/frame.md`
- `skills/10x-pipeline/scripts/prepare-run.mjs:207`, `:240`, `:259`, `:319`, `:376`, `:378`
- `skills/10x-pipeline/test/prepare-run.test.mjs:311`, `:337` (`setupRecord`), `:1051`
- `docs/REFERENCE.md:183`, `docs/ADR/ADR-010-run-worktree-step-commits-and-rollback.md` (Amendments 6 and 7)
- Wave 4 readiness merge and Wave 5 scheduling: `context/changes/WAVES.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Lock-free pending checks and a bounded temp

#### Automated

- [x] 1.1 Existing setup suites pass: `node --test --test-concurrency=2 skills/10x-pipeline/test/prepare-run.test.mjs skills/10x-pipeline/test/prepare-run-timeout.test.mjs`
- [x] 1.2 The recursive-delete guard passes: `node --test skills/10x-pipeline/test/no-recursive-delete.test.mjs`

#### Manual

- [ ] 1.3 Frame F2 repro: in a scratch repo, a linked worktree with `isolation.require: false` and a stale `agent-smith-setup-agent-smith%2Fdemo.lock` returns `case: "opt-out"`, the lock file is unchanged
- [ ] 1.4 Frame F3 repro: SIGKILL at the temp-to-pending rename, then remove the lock and rerun setup; setup succeeds and no `.tmp` remains in the Git common directory

### Phase 2: Regression tests and docs

#### Automated

- [ ] 2.1 The setup tests, including the new ones, pass: `node --test --test-concurrency=2 skills/10x-pipeline/test/prepare-run.test.mjs`

#### Manual

- [ ] 2.2 The full suite passes: `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- [ ] 2.3 Each new F2/F3 test fails when its matching change in a scratch copy of `prepare-run.mjs` is reverted
- [ ] 2.4 `grep -rniE "setup lock|\.pending" docs README.md skills --include=*.md` shows no remaining text that says the opt-out or pre-selection check takes the lock, or that names the UUID temp as current behavior
- [ ] 2.5 The ADR-010 Amendment 8 text and the `REFERENCE.md` bullets read correctly against the code
