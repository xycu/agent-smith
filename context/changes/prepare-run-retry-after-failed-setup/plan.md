# Finish the change-folder copy on setup retry

## Overview

Make the shared pre-init setup command finish an interrupted change-folder copy when the same setup is retried from the original project root. Keep the registered branch and worktree and report success only after the copy and worktree validation finish.

## Current State Analysis

The fresh path validates the source, creates a linked worktree from HEAD, and copies inputs under a per-branch setup lock. A copy failure leaves the branch and worktree in place. The registered path reports a successful reuse without inspecting copy completion, so the pipeline can hand partial inputs to `init`. The existing copy-failure test explicitly expects this reuse. [Setup and lock](../../../skills/10x-pipeline/scripts/prepare-run.mjs#L100) · [Creation and reuse](../../../skills/10x-pipeline/scripts/prepare-run.mjs#L212) · [Failure fixture](../../../skills/10x-pipeline/test/prepare-run.test.mjs#L334)

Both pipeline skills stop on setup failure, check inputs in the selected root, and invoke original-source cleanup only after a successful `init` using a successful `created` result with `copied: true`. The router owns run metadata and logs. The standalone helper reads saved identity, and an object such as `{}` has no identity even though a metadata file exists. [10x caller](../../../skills/10x-pipeline/SKILL.md#L38) · [OpenSpec caller](../../../skills/openspec-pipeline/SKILL.md#L43) · [Cleanup gate](../../../skills/10x-pipeline/scripts/prepare-run.mjs#L347) · [Identity reader](../../../skills/10x-pipeline/scripts/run-identity.mjs#L94)

## Desired End State

With an outstanding copy recorded for the matching setup, an unresolved failure still yields a reason and a null run root. After the source is fixed, the retry copies the inputs, keeps the same registration, and returns `case: "reused"`, `copied: true` and `reason: null`. Subsequent calls resume normally with `copied: false`. A registered worktree whose top directory is missing returns a bounded reason naming the path and suggesting inspection with `git worktree prune --dry-run` before pruning a stale registration.

### Key discoveries

- Both chains share the copy helper and lock. The lock key is the full branch and intentionally spans chains and project prefixes, so the pending copy must also identify the invocation it belongs to. [Setup lock](../../../skills/10x-pipeline/scripts/prepare-run.mjs#L128) · [Concurrent setup fixtures](../../../skills/10x-pipeline/test/prepare-run.test.mjs#L402)
- Custom registrations and completed copies accept worktree-local edits before router metadata exists. Metadata absence alone is insufficient to authorize an overlay. [Reuse fixtures](../../../skills/10x-pipeline/test/prepare-run.test.mjs#L47)

## Scope boundaries

This change covers interrupted overlays, safe registered reuse and stale-registration guidance. Propagating staged and unstaged deletions requires a separate copy contract and deletion safeguards. Keep this repair within the existing overlay semantics, branch selection, setup JSON schema and cleanup eligibility. [Change notes](change.md) · [Copy helper](../../../skills/10x-pipeline/scripts/prepare-run.mjs#L100) · [Cleanup contract](../../../docs/REFERENCE.md#L147)

## Implementation Approach

Use one phase because the pending-copy record, recovery path and compatibility tests define the same setup contract. Store pending-copy intent in the Git common directory under the existing full-branch setup lock. Record the owning original project root, expected worktree, project prefix, chain and starting commit before registering the fresh worktree, since interruption can occur immediately after registration. Keep the record through the overlay and usable-root validation. Clear it on successful completion before returning success. An ordinary add failure that leaves no branch or registration should retire the intent so normal fresh setup can proceed.

Before a registered retry writes, verify the owning invocation and canonical target, then verify the actual linked worktree's top, Git common directory, branch and recorded starting commit under the lock. Validate the worktree top before resolving the final project root because a valid nested prefix may be created by the overlay. Reuse the existing copy helper and final root checks. Treat mismatched or unreadable intent and conflicting ownership as setup errors with recovery guidance. A call from inside the incomplete worktree should direct the user back to the recorded original root. A matching intent with neither a branch nor a registration can proceed through fresh creation after revalidating the source. When the recorded branch has no registered worktree and ownership cannot be proved, report actionable recovery guidance and retain the evidence for inspection.

A pending record authorizes copying only while the destination has no router metadata or log. Check path presence without following a dangling final symlink. Preserve destination files if router state is present, using the current identity checks for resume and refusing damaged or ambiguous state. If the original project acquires router state or its source directory disappears while setup is pending, fail with a reason and retain the destination. Keep pending copies distinct from the setup lock so the lock can be released on ordinary failure without losing retry evidence.

## Phase 1: Recover the interrupted copy

### Overview

Complete pending copies through the shared CLI and prove that ordinary resumes are read-only.

### Changes Required

#### 1. Setup executable

**File** `skills/10x-pipeline/scripts/prepare-run.mjs`

**Intent** — Retry a copy that the setup executable still owns and report a usable run root only after recovery. Give missing-worktree diagnostics at the stale registration.

**Contract** — Publish the pending intent as a complete record before registration. Keep all intent access and copy mutations under the setup lock. Retain the existing copy validation and mode, timestamp and symlink semantics. Set `copied: true` only after the entire copy and validation succeed. A successful retry remains `reused`, so the original change folder remains available. Preserve the existing JSON shape, runtime exit behavior and usage errors. A missing registered worktree top gets prune guidance. An existing replacement repository, wrong branch, or missing nested prefix takes its own validation path.

#### 2. Setup regression coverage

**Files** `skills/10x-pipeline/test/prepare-run.test.mjs` and `skills/10x-pipeline/test/README.md`

**Intent** — Turn the current false-success fixture into a regression and exercise the shared retry behavior through the real CLI for both chains.

**Contract** — Force a deterministic filesystem error by making a source path a directory where the destination has a committed file. Check the first failure and repeated failure before fixing it, then check the copy, initialized reuse and retained original inputs. Use the fixture and Git wrapper already in the suite. Exercise a nested path, stale registration, and refusal to write into a replacement repository. Keep existing success and concurrency assertions, strengthening them where they establish recovery ownership. Record the added coverage in the test index.

#### 3. Worktree documentation

**Files** `docs/REFERENCE.md` and `docs/ADR/ADR-010-run-worktree-step-commits-and-rollback.md`

**Intent** — Document how to retry an unfinished setup and how to handle a missing registered worktree.

**Contract** — Update the active isolation reference and record the decision alongside ADR-010's setup amendments. Cover the existing JSON fields on retry, original-root ownership, stale lock inspection, and the compatibility boundary for failures from older releases.

### Success Criteria

#### Automated Verification

- The real setup CLI on both chains reports failure until the copy conflict is fixed, then returns reused with copied true for the same worktree and restores every source input to the selected run root.
- Setup preserves completed, initialized and custom worktrees, and a mismatched pending invocation cannot write or obtain the unfinished run root.
- A missing registered worktree reports its path and git worktree prune guidance, and a replacement repository is refused before copy.
- The full repository suite passes on Node 24 or later.

## Testing Strategy

Use `node --test skills/10x-pipeline/test/prepare-run.test.mjs` for focused feedback. Drive real `init` after a recovered copy and assert `action: "run"` plus subsequent `copied: false` reuse. Verify local bytes in both source and destination. Use the existing paused Git wrapper to terminate setup after registration and before copying, then verify recovery after inspecting and explicitly removing the stale test lock. Keep setup, init and cleanup assertions in scratch repositories.

Run `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs` for the implementation gate. These checks require only local fixtures.

## Performance Considerations

A regular resume checks for pending setup intent without scanning or copying the change folder. Only fresh setup or a matching pending retry performs the filesystem overlay.

## Migration and Rollback

- Existing initialized runs, completed pre-init copies and custom registered worktrees keep their reuse semantics when upgrading. No router-state or Git-history migration is needed. Older failed copies have no pending record, so operators must inspect their destination and restore missing inputs after preserving any local edits before retrying.
- Finish pending copies using the updated executable before downgrading or mixing versions on the same branch. An older executable can report ordinary reuse for an incomplete destination. Roll back through a normal revert after resolving pending copies and retain the branch, worktree, original inputs and router state.
- The setup lock serializes setup processes. Repair the original source while setup is idle and leave the incomplete destination to setup until it reports success. Preserve any destination edits before retrying.

## References

- [Original reproduction and related deletion case](change.md)
- [Setup, initialization and cleanup contracts](../../../docs/REFERENCE.md#L147)
- [Isolation decisions and compatibility rules](../../../docs/ADR/ADR-010-run-worktree-step-commits-and-rollback.md)
- [Setup regression tests](../../../skills/10x-pipeline/test/prepare-run.test.mjs)

## Progress

### Phase 1: Recover the interrupted copy

#### Automated

- [ ] 1.1 The real setup CLI on both chains reports failure until the copy conflict is fixed, then returns reused with copied true for the same worktree and restores every source input to the selected run root.
- [ ] 1.2 Setup preserves completed, initialized and custom worktrees, and a mismatched pending invocation cannot write or obtain the unfinished run root.
- [ ] 1.3 A missing registered worktree reports its path and git worktree prune guidance, and a replacement repository is refused before copy.
- [ ] 1.4 The full repository suite passes on Node 24 or later.
