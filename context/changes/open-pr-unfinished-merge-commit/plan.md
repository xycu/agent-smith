# Protect Unfinished Git Operations During Run Publication

## Overview

The publisher’s final commit can stage conflict markers and conclude a Git operation that the router refused to finish. Share the router’s Git safety check with the publisher so it can skip the leftover commit and publish the commits already on the run branch.

## Current State Analysis

- The router’s archive, start, step, rollback and late-usage paths share the marker check in [isolation.mjs:244](../../../skills/10x-pipeline/scripts/isolation.mjs#L244). It checks worktree-local Git markers and applies separate worktree, HEAD, ignore and index safeguards. Unmerged entries without a marker currently reach the staged-index check only where that check is enabled.
- The publisher uses its own Git runner and isolation checks. Its leftover path goes from porcelain status to `git add -A`, which can resolve unmerged index entries with the working-copy contents. The caller already records commit failures and proceeds to a normal push and PR handling. [open-pr.mjs:275](../../../skills/10x-pipeline/scripts/open-pr.mjs#L275) · [open-pr.mjs:418](../../../skills/10x-pipeline/scripts/open-pr.mjs#L418)
- The existing publication tests use a linked worktree, a local bare remote, a logging Git shim and fake `gh`. The router’s archive tests already assert that an active merge halts with a diagnostic naming `MERGE_HEAD`. [open-pr.test.mjs:30](../../../skills/10x-pipeline/test/open-pr.test.mjs#L30) · [archive.test.mjs:709](../../../skills/10x-pipeline/test/archive.test.mjs#L709)

## Desired End State

With HEAD attached to a validated run branch ahead of its base, an operation marker, unmerged index or failed safety probe blocks the leftover commit before staging. The result contains `committed: false`, `commit: null`, `swept: null` and a `commitError` naming the state or failed probe. The guard leaves the worktree, index, operation markers and local HEAD intact. The publisher still attempts the ordinary non-force push and follows its usual PR handling with the existing commits.

A rebase with detached HEAD still takes the earlier isolation refusal. It skips the leftover check, push and PR handling, and reports the detached-HEAD reason with the default null commit fields. [Publisher identity gate](../../../skills/10x-pipeline/scripts/open-pr.mjs#L129) · [Publisher gate order](../../../skills/10x-pipeline/scripts/open-pr.mjs#L418)

### Key Discoveries

- Git locates operation state per linked worktree through `rev-parse --git-path`. A marker can outlive all unmerged entries, including a resolved operation waiting for a commit. [Git rev-parse](https://git-scm.com/docs/git-rev-parse) · [Git cherry-pick](https://git-scm.com/docs/git-cherry-pick#_sequencer_subcommands)
- The `:/` pathspec can silently match zero paths when a caller inherits `GIT_LITERAL_PATHSPECS=1`. On Git 2.54 the nested invocation’s tracked-path count went from 0 to the repository-wide 1,317 with `git --no-literal-pathspecs ls-files -z -- :/`. Use the same root scope for `--unmerged` without changing the caller’s working directory. [Git global options](https://git-scm.com/docs/git) · [Git ls-files](https://git-scm.com/docs/git-ls-files)

## Scope and Follow-ups

This phase covers the shared operation guard, publisher behavior, regression tests and publication docs. The change brief identifies two follow-ups for the safe-worktree commit path. One is preserving staged-only content when a hook rejects a commit after the worktree version of the same path was added. The other is classifying a successful add with an empty staged diff as a no-op, such as when only untracked content inside a submodule shows in status. Each has its own failure mode and test fixture. Index recovery also needs a preservation contract for index metadata and failure during restoration. [change.md](change.md) · [open-pr.mjs:249](../../../skills/10x-pipeline/scripts/open-pr.mjs#L249) · [isolation.mjs:353](../../../skills/10x-pipeline/scripts/isolation.mjs#L353)

## Implementation Approach

Use one phase because the shared guard and both callers form one testable safety behavior. Extract the operation markers into a standalone, read-only module that uses the caller’s Git runner. Keep the router’s other safeguards in isolation and the publisher’s identity, base and publication handling in the publisher.

### Assumptions

- Low complexity and one implementation phase suit the existing CLI and JSON contract. The principal work is sharing an existing check and proving both paths against local fixtures. [complexity.json](complexity.json) · [change.md](change.md)
- Include the router’s five existing markers and Git’s `sequencer` directory. A multi-commit cherry-pick or revert can depend on the sequencer even when no individual operation marker is present. [isolation.mjs:192](../../../skills/10x-pipeline/scripts/isolation.mjs#L192) · [Git cherry-pick](https://git-scm.com/docs/git-cherry-pick#_sequencer_subcommands) · [Git revert](https://git-scm.com/docs/git-revert)
- A failed safety probe prevents staging and uses the same commit-error path. The publisher already sends Git status failures down that path while attempting publication of the existing commits. [open-pr.mjs:275](../../../skills/10x-pipeline/scripts/open-pr.mjs#L275) · [open-pr.mjs:445](../../../skills/10x-pipeline/scripts/open-pr.mjs#L445)
- Publication runs after step execution has settled. The preflight observes the worktree before staging and assumes no concurrent external Git writer on that worktree during publication. The ordinary push retains Git’s existing hook behavior. [10x pipeline publication](../../../skills/10x-pipeline/SKILL.md#L165) · [ADR-017 push rules](../../../docs/ADR/ADR-017-run-branch-always-pushed-for-review.md#what-the-script-does)

## Phase 1: Share the unfinished-operation guard

### Overview

Share the guard across the router and publisher, prove the publisher sends only existing history from a conflicted worktree, and document the result.

### Changes Required

#### 1. Shared Git check and router integration

**Files** `skills/10x-pipeline/scripts/git-operation.mjs` and `skills/10x-pipeline/scripts/isolation.mjs`.

**Intent** Move the marker check into a dependency-free leaf module and recognize unmerged index entries in the same check. Preserve the router’s marker diagnostic and other safety checks.

**Contract** The helper takes a caller-supplied Git runner and returns `null` for a safe state or a diagnostic for operation state, unmerged entries or a failed probe. Resolve each of `MERGE_HEAD`, `REVERT_HEAD`, `CHERRY_PICK_HEAD`, `rebase-merge`, `rebase-apply` and `sequencer` with `git rev-parse --path-format=absolute --git-path <marker>`. Require a successful response and a usable absolute path. Use `lstatSync` to distinguish a missing path (`ENOENT`) from other filesystem errors that prevent verification. Retain the existing marker diagnostic and check markers before querying the index.

Query the whole index with `git --no-literal-pathspecs ls-files --unmerged -z -- :/` through the same runner and working directory. Check its exit status before interpreting empty output as safe. A failed probe returns a bounded diagnostic naming the command or the marker that could not be verified. Both callers keep their Git execution and timeout settings. The shared module depends only on Node built-ins and makes read-only probes.

Replace the marker loop in `gitSafety` with the shared check before its existing staged-diff check. Run the shared check even with `emptyIndex: false`. That option exempts normal staged entries for rollback snapshots. An unmerged index halts rollback before it creates a snapshot or stages files. [Rollback preflight](../../../skills/10x-pipeline/scripts/isolation.mjs#L586) · [Snapshot behavior](../../../docs/ADR/ADR-010-run-worktree-step-commits-and-rollback.md#amendment-3--preserve-distinct-staged-versions-during-rollback-2026-11-16)

#### 2. Leftover publication commit

**File** `skills/10x-pipeline/scripts/open-pr.mjs`.

**Intent** Reject unsafe leftover commits before status, staging or cleanup can touch the index.

**Contract** Run the shared check at entry to `commitLeftovers`, before the clean-status return. Map a diagnostic to the existing false commit result and error. Keep the branch-ahead and identity gates, then use the existing push and PR paths. The guarded path leaves local Git state intact and reports no commit hash or swept files. Ordinary staged entries remain eligible for the usual leftover commit.

#### 3. Regression coverage

**Files** `skills/10x-pipeline/test/open-pr.test.mjs`, `skills/10x-pipeline/test/archive.test.mjs` and `skills/10x-pipeline/test/rollback.test.mjs`.

**Intent** Reproduce the unsafe states in local Git and check state preservation as well as the result fields.

**Contract** Use real conflicted merge, cherry-pick and revert fixtures in linked worktrees. Run the markerless fixture from a nested publisher root with the conflict outside it and `GIT_LITERAL_PATHSPECS=1`. Cover operation markers with a resolved or clean index, including rebase and sequencer markers on attached HEAD, using small deterministic fixtures. Give the existing detached-HEAD fixture a rebase marker and assert the identity refusal, null commit fields and absence of writes or fake PR calls. Inject failures separately for marker-path resolution and the unmerged-index query using the Git shim.

For each refusal from the new publisher guard, assert the diagnostic and null `commit` and `swept` fields with `committed: false`. Compare local HEAD, raw index, affected file contents and operation metadata before and after the publisher, taking the final index snapshot before any status command that could refresh it. Confirm the bare-remote run ref equals the original HEAD and fake PR handling proceeds. For each conflict fixture, inspect the affected file at the bare-remote tip. Assert the shim recorded the ordinary push and no staging, commit or reset.

Extend router archive coverage to include a markerless unmerged index, retaining its merge halt and staged-only tests. In the archive command-log test, admit the new global option only for the exact read-only `ls-files` probe. Include the shared leaf in the existing router no-push and no-`gh` source guard. Add a markerless unmerged rollback fixture that halts with the index diagnostic and proves HEAD, index, working files and snapshot refs stay intact. Retain the existing rollback tests for ordinary staged entries and distinct staged and worktree versions. Router state and report writes follow the existing halt path. [Archive Git command assertions](../../../skills/10x-pipeline/test/archive.test.mjs#L1172) · [Publisher source guard](../../../skills/10x-pipeline/test/open-pr.test.mjs#L687) · [Existing rollback coverage](../../../skills/10x-pipeline/test/rollback.test.mjs#L154)

#### 4. Publication documentation

**Files** `docs/REFERENCE.md`, `docs/ADR/ADR-017-run-branch-always-pushed-for-review.md` and `docs/ADR/ADR-019-late-usage-figure.md`.

**Intent** Describe how the operation guard affects final run state and publication.

**Contract** Update the reference’s publication, resume and late-usage guidance. Record the safety rule in ADR-017 and qualify statements about kept edits, clean worktrees and which HEAD the run resumes from. Explain that a skipped commit leaves uncommitted run artifacts in the worktree, including late usage, and qualify the same claim in ADR-019. Document `committed: false`, the reason in the CLI JSON’s `commitError` and the continued publication attempt of existing commits. Document the earlier detached-HEAD refusal and describe the local resolution needed before retrying or removing the worktree. Scan live documentation for the old behavior. Both pipeline skills keep their current invocation and reporting under the change brief’s JSON compatibility constraint. The reference and ADR-017 describe the conditions on the leftover-commit step summarized by the skills. [Change brief](change.md#notes) · [10x pipeline](../../../skills/10x-pipeline/SKILL.md#L167) · [OpenSpec pipeline](../../../skills/openspec-pipeline/SKILL.md#L170) · [ADR-019](../../../docs/ADR/ADR-019-late-usage-figure.md#L55)

### Success Criteria

#### Automated Verification

- Publisher regression tests prove conflicts, marker-only state and probe failure skip the leftover commit while existing commits reach the local bare remote and fake PR handling proceeds. Run `node --test skills/10x-pipeline/test/open-pr.test.mjs`.
- Router archive tests prove active-operation and markerless-unmerged refusals. Run `node --test skills/10x-pipeline/test/archive.test.mjs`.
- The reference and ADR-017 describe the guard, preserved local state and existing-commit publication. Inspect the scoped diff and grep live docs for `commitError`, `leftover commit` and `final run state`.
- Full suite passes on Node 24 or later. Run `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`.

## Testing Strategy

Run the new regression cases against the previous behavior, then run the focused publisher, archive and rollback files and the full suite after the fix. The rollback regression is part of the full-suite gate. Reuse the fixture’s local push URL and fake `gh`. The ordinary clean and dirty worktree, pre-staged entries, failing hook and PR regression cases continue to exercise the normal path. Live PR or CI follow-up belongs to the orchestrator’s publication flow under ADR-017 Amendment 2.

## Performance Considerations

The guard reads a fixed set of worktree-local paths and issues one index query when there are no operation markers. It returns before porcelain status on a known unsafe state.

## Migration Notes

Existing run directories and both pipeline chains use the same JSON response. Deploy the module with its two callers as one commit. The guard reads Git’s existing state, so runs paused before the upgrade can use it on their next publication attempt. A source revert restores the previous behavior without a data migration and would also restore the unsafe leftover-commit path.

## References

- [Change brief](change.md)
- [Publication reference](../../../docs/REFERENCE.md#L145)
- [ADR-017 and publication ownership](../../../docs/ADR/ADR-017-run-branch-always-pushed-for-review.md#amendment-2--step-publication-and-acceptance-ownership-2026-11-15)
- [Git documentation for unmerged index entries](https://git-scm.com/docs/git-ls-files)

## Progress

> Convention — mark completed rows with `x` and append the closing commit SHA.

### Phase 1: Share the unfinished-operation guard

#### Automated

- [x] 1.1 Publisher regression tests prove conflicts, marker-only state and probe failure skip the leftover commit while existing commits reach the local bare remote and fake PR handling proceeds. Run `node --test skills/10x-pipeline/test/open-pr.test.mjs`.
- [x] 1.2 Router archive tests prove active-operation and markerless-unmerged refusals. Run `node --test skills/10x-pipeline/test/archive.test.mjs`.
- [x] 1.3 The reference and ADR-017 describe the guard, preserved local state and existing-commit publication. Inspect the scoped diff and grep live docs for `commitError`, `leftover commit` and `final run state`.
- [x] 1.4 Full suite passes on Node 24 or later. Run `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`.
