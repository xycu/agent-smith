# Archived-change guards and retained-input cleanup Implementation Plan

## Overview

Prevent a stale live folder from starting a second run of an archived change in either chain. After a fresh isolated initialization retains the inputs in its start commit, remove eligible untracked copies from the original checkout and report retained paths.

## Current State Analysis

`prepare-run.mjs` creates the worktree and copies the change before the router runs. Its `left` field is reserved and always empty. `init` subsequently creates the isolated start commit through `startCommit`, records its SHA in router-owned metadata, and creates the first pending step. Cleanup therefore requires a second invocation after initialization.

`guardArchived` checks archive names only when the live folder is absent. With a live folder present, 10x checks its frontmatter and OpenSpec returns immediately. An untracked stale folder with an old status bypasses this protection. Both skills currently instruct the user to remove or stash the original copy in their final message.

Planning verification on Node v24.19.0 reproduced both failures through the real CLI in scratch repositories. Live and matching archive folders together returned `run plan` for 10x and `run os-propose` for OpenSpec. Ten selected existing tests passed, covering archived-only guards, setup/resume behavior, real isolated initialization, dated OpenSpec names and both skills' setup contracts. Implementation acceptance remains pending in Progress.

### Key Discoveries

- Archive matching already handles exact dated names, suffix collisions and date-prefixed OpenSpec ids. Reuse `archiveDirs` and `archiveRoot`. [state.mjs](../../../skills/10x-pipeline/scripts/state.mjs#L394)
- The current archive guard's live-folder branch explains the bypass. Wave 5 assigns the new init halt to `route.mjs`, while the shared guard belongs to `state.mjs`. [state.mjs](../../../skills/10x-pipeline/scripts/state.mjs#L429) [Wave 5](../WAVES.md)
- `init` validates arguments, reads state, writes metadata and then creates the start commit before dispatch. A duplicate check can run after chain resolution and before run-lock acquisition. [route.mjs](../../../skills/10x-pipeline/scripts/route.mjs#L915)
- Start-commit retention is recorded in `meta.startCommit`, with a SHA or null. A failed commit can leave the field absent. Cleanup must establish an actual retained blob independently. [isolation.mjs](../../../skills/10x-pipeline/scripts/isolation.mjs#L460)
- Setup already owns branch discovery, prefix handling, copy fidelity and the per-branch lock. Its standalone Git wrapper returns UTF-8 text, so arbitrary file bytes require a binary-safe comparison. [prepare-run.mjs](../../../skills/10x-pipeline/scripts/prepare-run.mjs#L50)
- Whole-fixture teardown uses `removeTree`. Selective pruning must retain ineligible entries and remove only empty directories. [remove-tree.mjs](../../../skills/10x-pipeline/scripts/remove-tree.mjs) [ADR-016](../../../docs/ADR/ADR-016-no-recursive-force-delete.md)

## Desired End State

- `init` refuses a live folder accompanied by any matching archive folder in its resolved chain. The halt names the live path and every matching archive path, exits unsuccessfully and leaves repository files, index, refs and run-state temps unchanged.
- A freshly created isolated run performs cleanup after `init` returns `action: run`, `done` or `archive`, before dispatching that action. Each deleted source file is untracked in the original checkout and byte-identical to a regular-file blob in the verified start commit retained on the run branch.
- Tracked files, changed files, files absent from that commit, symlinks and uncertain entries remain in place and appear in `left`. Resumed setup cases perform no cleanup.
- Both skills describe the executable cleanup and report the paths retained. Existing branch, worktree, PR and terminal-state reporting continues to work.
- A later invocation from the original checkout discovers and resumes the existing run even after cleanup removed the entire original change folder. Missing-input and archive diagnostics use the selected run root, with original-root fallback when setup cannot select a run.

## Scope Boundaries

Wave 5 implementation owns the init halt in `skills/10x-pipeline/scripts/route.mjs`, cleanup in `skills/10x-pipeline/scripts/prepare-run.mjs`, and the stale-copy paragraph under Start step 3 in each skill. Cleanup also requires moving each skill's Start step 2 change-folder existence check after setup selects the run root, and validating a missing fresh source before setup creates resources. These prerequisite changes use the same owned files and leave the parallel skill-frontmatter work independent. Extend the existing `archive.test.mjs`, `openspec-archive.test.mjs`, `prepare-run.test.mjs`, `skill-loop.test.mjs` and `openspec-skill.test.mjs`. Update only the corresponding setup and archive-init paragraphs in the shared `docs/REFERENCE.md`.

Other Wave 5 owners retain CI, `helpers.mjs`, `openspec-contract.test.mjs`, skill frontmatter and manifest descriptions, the policy ladder, and `no-recursive-delete.test.mjs`. `state.mjs`, isolation commit code, setup case selection, routing policy, runtime state schemas and archive contents remain outside this implementation's edit surface. `WAVES.md` is the ownership source and stays read-only. Existing tests receive additions, keeping their README indexes sufficient.

The brief's historical `context/changes/agent-smith-coauthor/change.md` is absent from this worktree. The original-checkout restriction makes any remaining one-off cleanup elsewhere an owner maintenance action. Scratch fixtures exercise that scenario during implementation.

## Implementation Approach

Use an init-specific preflight in the router and an explicit post-init mode of the existing setup executable. The orchestrator passes the original setup result to that mode, allowing it to distinguish fresh creation from a resume without introducing persistent cleanup state. Router-owned metadata remains read-only to the setup script.

### Assumptions and decisions

- Assess this as medium complexity across three phases. The unattended instruction replaces the skill interview and phase approval with evidence-backed decisions. The change brief specifies the desired behavior, and ADR-010 Amendment 2 reserves cleanup for Wave 5.
- Scope the additional archive refusal to `init`. Existing `next`, `status`, `usage`, comparison and archive-verification contracts retain their existing behavior. Evidence comes from the brief's init requirement and Wave 5's assigned region.
- Add `--cleanup` to the same executable, with the original setup JSON on stdin. Retain `<id>` and optional `--chain 10x|openspec`. This provides the required post-init timing while reusing setup ownership and avoiding another state file. Existing setup calls retain their CLI and output contract.
- Resolve the run before applying the skills' change-folder existence checks. Preserve early project/tooling checks and the setup script's six-case ordering. When fresh creation finds no valid source directory, fail before adding an exclude or creating a branch/worktree. Existing resume branches can therefore be selected after source cleanup, while missing fresh inputs retain the existing archive/new-change guidance. Evidence comes from both skills' Start step 2 checks and setup's existing branch reuse/attachment paths. Wave 5's other skill owner edits frontmatter, so these prerequisite checks have independent ownership.
- Gate cleanup on a validated setup result with `case: created`, `copied: true`, `reason: null`, matching original root, run root and expected branch. Other valid setup cases return successfully without deleting anything. Evidence comes from ADR-010's fresh-copy rule and the existing six-case tests.
- Preserve symlinks and special entries and report them. The brief authorizes deletion based on retained file bytes, while existing setup explicitly preserves symlink targets and rejects symlink destination parents. Conservative retention keeps link-target semantics intact.
- A cleanup failure reports a bounded diagnostic and retained paths, while the already initialized run continues from its original validated run root. Retention is sufficient for data safety. The start-commit requirement and the brief's instruction to name files left behind support this recovery behavior.

## Critical Implementation Details

### Timing and retention

Creating or copying a worktree proves insufficient retention. Run cleanup only after a fresh setup and a successful `init` response with `action: run`, `done` or `archive`. Perform it before the first step launch, final reporting/PR handling or archive dispatch respectively. Halted initialization skips cleanup. A fresh 10x change with completed Progress and fresh reviews can immediately return `done` or `archive` while still creating a start commit. Require `meta.isolated === true`, the expected branch and a valid non-null `meta.startCommit` resolving to a commit reachable from the run branch. Read each comparison blob from that immutable commit even if the worktree has changed since initialization.

### Source and destination identity

Validate the cleanup input before mutation. Resolve the original root from cwd and the run root from the saved setup result. Verify distinct roots, shared Git common directory, a registered linked worktree on the expected branch and the same project prefix. Reject symlinked source ancestors and path escapes. Hold the existing branch setup lock throughout validation and pruning, preserving its contention and interruption behavior.

### File eligibility and interruption

List and inspect entries within only the selected chain's change folder using `lstat`, preserving symlink entries. Treat a path present in either the original checkout's HEAD or index, including staged additions or removals, as tracked and retain it. Compare raw source bytes against the start commit's regular-file blob. `git hash-object --no-filters --stdin` with Buffer input can compare its object id with `ls-tree` output through the existing text-returning wrapper without UTF-8 conversion of file contents.

Validate the complete candidate list before deletion. Recheck file identity, type, tracking and bytes immediately before each unlink, retaining any observed change. Unlink eligible files individually and prune empty directories deepest first with empty-only `rmdir`; a directory becoming nonempty remains in place. Use the existing `removeTree` helper for whole scratch-fixture teardown. Selective pruning follows its list/check/unlink/empty-directory procedure while preserving mixed-content source folders.

Each successful deletion remains recoverable from the retained start commit. On partial failure, report actual surviving paths and the diagnostic. Repeating cleanup with the original fresh setup result safely processes only still-eligible files. Ordinary setup resumes retain their existing no-copy, no-cleanup behavior. External editors do not participate in the setup lock, so immediate revalidation is required and concurrent editing remains a filesystem race to document.

## Phase 1: Reject duplicate archived initialization

### Overview

Close the re-entry path in both chains while preserving the shared readers and existing commands.

### Changes Required

#### Router init preflight

**File** `skills/10x-pipeline/scripts/route.mjs`

**Intent** Reject a live change folder when the resolved chain already has an archive for the same id, before any init state mutation.

**Contract** Reuse `paths`, `archiveDirs` and `archiveRoot` after chain resolution and before run-lock acquisition. Emit the existing JSON halt shape with both live and matching archive paths. Keep missing-live, half-archived, chain-collision and argument-validation behavior.

#### Both-chain archive regressions

**Files** `skills/10x-pipeline/test/archive.test.mjs`, `skills/openspec-pipeline/test/openspec-archive.test.mjs`

**Intent** Demonstrate that stale live inputs cannot initiate a duplicate run and that valid names still initialize.

**Contract** Cover a fresh live folder and a live folder with prior run state beside one or multiple matching archives, with and without `--archive`. Include default 10x resolution, explicit OpenSpec resolution, dated OpenSpec ids, suffix-collision folders and an archive belonging only to the other chain. Assert exit status, named paths and byte/content snapshots, including existing router temps and Git state in Git-backed fixtures. Preserve the existing test that allows `next` on a live 10x folder beside an archive.

### Success Criteria

#### Automated Verification

- Both-chain init regressions reject matching live/archive pairs without changing files, index, refs or existing router temps.
- Archived-only and half-archived guards, suffix/date matching, chain selection and ordinary fresh/resumed initialization retain their specified behavior.
- The required complete repository test suite passes after the router change.

## Phase 2: Add verified post-init source cleanup

### Overview

Implement selective cleanup in the executable that owns copying and worktree setup.

### Changes Required

#### Cleanup invocation and safety checks

**File** `skills/10x-pipeline/scripts/prepare-run.mjs`

**Intent** Add a post-init cleanup operation that removes only source inputs safely retained in the isolated start commit.

**Contract** Accept `<id> [--chain 10x|openspec] --cleanup` with the original setup JSON on stdin. Validate its shape, chain-derived change path, cwd and worktree identity. Honor fresh-case gating and the retention/eligibility rules above. Keep ordinary preparation behavior and its result fields stable. Cleanup returns the same setup-result shape, populating `left` with original-project-relative surviving paths. Runtime failures retain the established bounded `reason` and null `runRoot` convention. The caller keeps the earlier successful setup result for continued execution. Invalid arguments or input exit 2 before mutation.

For ordinary preparation's fresh-creation branch, validate the source directory under the existing setup lock before `addExclude` or `git worktree add`. Reuse `copyChange`'s directory-type requirement at that earlier point. A missing fresh source returns the existing runtime-failure shape with all repository resources intact. Reuse and attachment continue selecting their run roots when the original change folder has been removed.

#### Real Git cleanup acceptance

**File** `skills/10x-pipeline/test/prepare-run.test.mjs`

**Intent** Exercise setup, real router initialization and cleanup as a single lifecycle for both chains.

**Contract** Extend local test helpers and the wrapper's read-only Git allowlist within this file. Use direct `spawnSync` with stdin for the new mode, keeping shared helpers under their Wave 5 owner. Existing setup assertions still expect empty `left`; cleanup-specific assertions inspect retained paths. Cover the following scenarios with repository-local scratch projects.

- Identical untracked text, binary, hidden and nested files disappear only after the real start commit exists, and are recoverable from its blobs. Empty source directories disappear deepest first.
- Tracked files remain even when identical, modified or staged. A file removed from the index but retained in HEAD also remains. Source index, refs, branch, config and unrelated files retain their bytes.
- Source edits after copying, source edits after init, files added after copying, files absent from the commit and symlinks remain and are named. A file changed after candidate enumeration is preserved by the final recheck.
- Valid resumed cases, opt-out and in-flight-main setup results delete nothing. Repeated cleanup of the original fresh result is safe and preserves later changed files.
- After complete source removal, a later setup from the original root reuses the existing registered run, and attachment to an existing branch also works with an absent source. A fresh missing-source invocation creates no exclude, branch or worktree and preserves original-root archive diagnostics.
- A fresh 10x fixture with completed Progress and fresh reviews returns `done`, or `archive` with the flag, while retaining a valid start commit; cleanup still removes eligible source files before terminal handling. Ordinary `run` responses and halted initialization keep their specified ordering.
- Missing/null/invalid/unreachable start commits, failed init, malformed input, wrong roots, wrong branch/common directory, invalid prefixes and symlinked ancestors cause no deletion.
- Read/lookup/unlink/rmdir failures and lock contention produce honest diagnostics and surviving-path reports. A failure after one approved deletion preserves other inputs, and the deleted bytes remain in the start commit.
- Prefixes with spaces, Unicode and Git pathspec metacharacters resolve exactly once. Extend the existing wrapper only with read-only Git operations needed for verification and byte comparison.

### Success Criteria

#### Automated Verification

- Both chains remove only identical untracked regular files after a real retained start commit and prune only empty source directories.
- Tracked, edited, additional, unsupported and unretained paths survive with accurate `left` reporting across root and nested-project fixtures.
- Resume cases and failed retention or identity checks delete nothing, including deterministic source-change and partial-failure regressions.
- Existing setup policy, copy fidelity, concurrency, command restrictions and runtime error tests pass alongside the cleanup tests.
- The required complete repository test suite passes after the setup-script change.

## Phase 3: Integrate both skills and document the lifecycle

### Overview

Make the cleanup run through the normal orchestrator entry points and report retained inputs accurately.

### Changes Required

#### Replace the stale-copy instruction

**Files** `skills/10x-pipeline/SKILL.md`, `skills/openspec-pipeline/SKILL.md`

**Intent** Connect the new executable mode to fresh initialization and replace blanket removal advice with the actual retained-path outcome.

**Contract** Edit the owned stale-copy paragraph under Start step 3. Specify that after step 4 returns `action: run`, `done` or `archive`, and before dispatching the returned action, a saved `created`/`copied: true` setup result is sent verbatim on stdin to `cd "<root>" && node "$PREPARE_RUN" <id> --cleanup`, adding `--chain openspec` for that chain. Cleanup precedes the first step launch, final reporting/PR handling or archive dispatch respectively. Use the existing absolute script path and 600000 ms host timeout. Perform this once for a fresh invocation. Preserve the initial setup result independently from the cleanup response. Validate cleanup JSON, report nonempty `left` or cleanup diagnostics, and retain the initialized run root. Resumes and halted initialization skip this operation. The final worktree message names branch/root and any retained original paths, while preserving existing final-state commit guidance.

Move only the change-folder existence requirement from each skill's Start step 2 to after successful setup, checking `change.md` for 10x or the OpenSpec change directory under `<run root>`. Keep project configuration and toolkit checks early. Apply the existing `verify-archive` and missing-change guidance from the selected root when its inputs are absent. If setup fails with an absent original source and cannot select a root, apply that guidance from `<root>` before stopping. The preparation preflight in Phase 2 prevents this fallback from leaving newly created resources. Preserve the exact missing-change, ambiguous-archive and archived-change outcomes. This lets a main-checkout invocation reach an existing run after full source cleanup.

#### Skill contracts and reference text

**Files** `skills/10x-pipeline/test/skill-loop.test.mjs`, `skills/openspec-pipeline/test/openspec-skill.test.mjs`, `docs/REFERENCE.md`

**Intent** Pin post-init ordering and fresh-only behavior in both skills and reconcile public setup/archive documentation.

**Contract** Replace the existing `stale copy` content expectations with cleanup timing, saved-input, chain, failure and retained-path assertions. Assert that change-folder existence checks follow successful run-root selection, that missing fresh inputs keep archive/new-change guidance without creating resources, and that an invocation from the original root after full cleanup reaches the existing run. Assert cleanup ordering for `run`, `done` and `archive`, with resumes and halts skipping cleanup. Preserve anti-stall equality and dispatch/PR contracts. Update reference paragraphs that currently say `left` is empty, defer cleanup to Wave 5, or instruct blanket stale-copy removal. Describe source-absent resumes and immediate terminal initialization alongside the cleanup lifecycle. Describe init's additional duplicate guard in both archive sections, leaving shared `guardArchived` behavior accurately attributed.

### Success Criteria

#### Automated Verification

- Both skill content suites require fresh-only cleanup after successful init and before first dispatch, with retained-path reporting and unchanged terminal commit guidance.
- Real both-chain CLI lifecycles cover clean removal, mixed retained files, a halted duplicate init and a subsequent unchanged resume.
- Focused setup, archive, skill and deletion-guard tests pass, and the required complete repository test suite passes.
- The final diff stays within Wave 5 ownership and the relevant shared reference paragraphs.

#### Manual Verification

- A live host invocation for each chain performs the post-init call before its first step and reports retained original paths in its final message.

## Testing Strategy

### Focused commands

Run `node --test --test-concurrency=2 skills/10x-pipeline/test/archive.test.mjs skills/openspec-pipeline/test/openspec-archive.test.mjs skills/10x-pipeline/test/prepare-run.test.mjs skills/10x-pipeline/test/skill-loop.test.mjs skills/openspec-pipeline/test/openspec-skill.test.mjs skills/10x-pipeline/test/no-recursive-delete.test.mjs`.

Run the repository-required suite after each implementation phase that changes scripts or prompts, and at final integration, using `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`.

### Evidence

Use real linked-worktree CLI fixtures for commit retention and source pruning, local Git wrappers for deterministic failures and timing boundaries, and exact Buffer snapshots for retained bytes and index/config preservation. Compare file paths, modes and mtimes where relevant. Capture refs and branch identity around cleanup. Human acceptance covers host execution of the written skill instructions. Keep pending Manual rows open until observed.

Planning's selected baseline command used `--test-name-pattern="six cases|prepare then real init|only the archive folder|live folder with a same-named archive|date-prefixed id|Start step 3"` against the five affected setup/archive/skill test files. It passed 10 tests with zero failures or skips. A separate inline scratch reproduction confirmed duplicate initialization in both chains. The full suite belongs to implementation verification.

## Performance Considerations

Limit enumeration and blob lookup to the selected change folder. Batch read-only tracked-path and tree queries where practical, and hash only regular-file candidates. Preserve the existing 120000 ms Git timeout and exclusive setup lock. Files retained for uncertainty provide a safe bounded result after Git or filesystem failure.

## Migration Notes

Existing runs and metadata require no migration. A valid resumed setup skips source cleanup, preserving its established behavior. New isolated runs use the start commit as recovery evidence for each removed file. Historical stale copies remain subject to the new init refusal and explicit owner maintenance. A cleanup interruption can leave a partially pruned source folder whose removed bytes remain in the run branch's start commit.

After complete source cleanup, invoke the skill from the original checkout as before. Setup selects the existing run before the skill requires its change inputs, and a resume performs no source cleanup. Successful immediate `done` and `archive` initialization responses also perform fresh-only cleanup before terminal handling.

## References

- [Change brief](change.md)
- [Wave 5 ownership](../WAVES.md)
- [Lessons on chain ownership, verdicts and document discovery](../../foundation/lessons.md)
- [Run setup and archive reference](../../../docs/REFERENCE.md)
- [ADR-010 and Amendment 2](../../../docs/ADR/ADR-010-run-worktree-step-commits-and-rollback.md)
- [ADR-016 deletion procedure](../../../docs/ADR/ADR-016-no-recursive-force-delete.md)
- [Existing setup integration tests](../../../skills/10x-pipeline/test/prepare-run.test.mjs)
- [10x archive contracts](../../../skills/10x-pipeline/test/archive.test.mjs)
- [OpenSpec archive contracts](../../../skills/openspec-pipeline/test/openspec-archive.test.mjs)

## Progress

### Phase 1: Reject duplicate archived initialization

#### Automated

- [x] 1.1 Both-chain init regressions reject matching live/archive pairs without changing files, index, refs or existing router temps. — e92775b
- [x] 1.2 Archived-only and half-archived guards, suffix/date matching, chain selection and ordinary fresh/resumed initialization retain their specified behavior. — e92775b
- [x] 1.3 The required complete repository test suite passes after the router change. — e92775b

### Phase 2: Add verified post-init source cleanup

#### Automated

- [x] 2.1 Both chains remove only identical untracked regular files after a real retained start commit and prune only empty source directories. — ceb49af
- [x] 2.2 Tracked, edited, additional, unsupported and unretained paths survive with accurate `left` reporting across root and nested-project fixtures. — ceb49af
- [x] 2.3 Resume cases and failed retention or identity checks delete nothing, including deterministic source-change and partial-failure regressions. — ceb49af
- [x] 2.4 Existing setup policy, copy fidelity, concurrency, command restrictions and runtime error tests pass alongside the cleanup tests. — ceb49af
- [x] 2.5 The required complete repository test suite passes after the setup-script change. — ceb49af

### Phase 3: Integrate both skills and document the lifecycle

#### Automated

- [x] 3.1 Both skill content suites require fresh-only cleanup after successful init and before first dispatch, with retained-path reporting and unchanged terminal commit guidance.
- [x] 3.2 Real both-chain CLI lifecycles cover clean removal, mixed retained files, a halted duplicate init and a subsequent unchanged resume.
- [x] 3.3 Focused setup, archive, skill and deletion-guard tests pass, and the required complete repository test suite passes.
- [x] 3.4 The final diff stays within Wave 5 ownership and the relevant shared reference paragraphs.

#### Manual

- [ ] 3.5 A live host invocation for each chain performs the post-init call before its first step and reports retained original paths in its final message.
