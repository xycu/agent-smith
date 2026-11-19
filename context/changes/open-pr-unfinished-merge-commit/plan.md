# Protect Unfinished Git Operations During Run Publication

## Overview

The publisher’s final commit can stage conflict markers and conclude a Git operation that the router refused to finish. Share the router’s Git safety check with the publisher so it can skip the leftover commit and publish the commits already on the run branch.

## Current State Analysis

- The router’s archive, start, step, rollback and late-usage paths share the marker check in [isolation.mjs:244](../../../skills/10x-pipeline/scripts/isolation.mjs#L244). It checks worktree-local Git markers and applies separate worktree, HEAD, ignore and index safeguards. Unmerged entries without a marker currently reach the staged-index check only where that check is enabled.
- The publisher uses its own Git runner and isolation checks. Its leftover path goes from porcelain status to `git add -A`, which can resolve unmerged index entries with the working-copy contents. The caller already records commit failures and proceeds to a normal push and PR handling. [open-pr.mjs:275](../../../skills/10x-pipeline/scripts/open-pr.mjs#L275) · [open-pr.mjs:418](../../../skills/10x-pipeline/scripts/open-pr.mjs#L418)
- The existing publication tests use a linked worktree, a local bare remote, a logging Git shim and fake `gh`. The router’s archive tests already assert that an active merge halts with a diagnostic naming `MERGE_HEAD`. [open-pr.test.mjs:30](../../../skills/10x-pipeline/test/open-pr.test.mjs#L30) · [archive.test.mjs:709](../../../skills/10x-pipeline/test/archive.test.mjs#L709)

## Desired End State

For a validated run branch ahead of its base, an in-progress merge, rebase, cherry-pick, revert or unmerged index blocks the leftover commit before staging. The result contains `committed: false`, `commit: null`, `swept: null` and a `commitError` naming the marker or unmerged index. The worktree, index, operation markers and local HEAD stay intact. The publisher still attempts the ordinary non-force push and follows its usual PR handling with the existing commits.

### Key Discoveries

- Git locates operation state per linked worktree through `rev-parse --git-path`. A marker can outlive all unmerged entries, including a resolved operation waiting for a commit. [Git rev-parse](https://git-scm.com/docs/git-rev-parse) · [Git cherry-pick](https://git-scm.com/docs/git-cherry-pick#_sequencer_subcommands)
- `git ls-files --unmerged -z -- :/` reads the entire index for unmerged entries, including paths outside the invoking subdirectory. The root pathspec was checked from `skills/10x-pipeline` on Git 2.54. [Git ls-files](https://git-scm.com/docs/git-ls-files) · [Git pathspec glossary](https://git-scm.com/docs/gitglossary)

## Scope and Follow-ups

This phase covers the shared operation guard, publisher behavior, regression tests and publication docs. The change brief identifies two follow-ups for the safe-worktree commit path. One is preserving staged-only content when a hook rejects a commit after the worktree version of the same path was added. The other is classifying a successful add with an empty staged diff as a no-op, such as when only untracked content inside a submodule shows in status. Each has its own failure mode and test fixture. Index recovery also needs a preservation contract for index metadata and failure during restoration. [change.md](change.md) · [open-pr.mjs:249](../../../skills/10x-pipeline/scripts/open-pr.mjs#L249) · [isolation.mjs:353](../../../skills/10x-pipeline/scripts/isolation.mjs#L353)

## Implementation Approach

Use one phase because the shared guard and both callers form one testable safety behavior. Extract the operation markers into a standalone, read-only module that uses the caller’s Git runner. Keep the router’s other safeguards in isolation and the publisher’s identity, base and publication handling in the publisher.

### Assumptions

- Low complexity and one implementation phase suit the existing CLI and JSON contract. The principal work is sharing an existing check and proving both paths against local fixtures. [complexity.json](complexity.json) · [change.md](change.md)
- Include the router’s five existing markers and Git’s `sequencer` directory. A multi-commit cherry-pick or revert can depend on the sequencer even when no individual operation marker is present. [isolation.mjs:192](../../../skills/10x-pipeline/scripts/isolation.mjs#L192) · [Git cherry-pick](https://git-scm.com/docs/git-cherry-pick#_sequencer_subcommands) · [Git revert](https://git-scm.com/docs/git-revert)
- A failed safety probe prevents staging and uses the same commit-error path. The publisher already sends Git status failures down that path while attempting publication of the existing commits. [open-pr.mjs:275](../../../skills/10x-pipeline/scripts/open-pr.mjs#L275) · [open-pr.mjs:445](../../../skills/10x-pipeline/scripts/open-pr.mjs#L445)

## Phase 1: Share the unfinished-operation guard

### Overview

Share the guard across the router and publisher, prove the publisher sends only existing history from a conflicted worktree, and document the result.

### Changes Required

#### 1. Shared Git check and router integration

**Files** `skills/10x-pipeline/scripts/git-operation.mjs` and `skills/10x-pipeline/scripts/isolation.mjs`.

**Intent** Move the marker check into a dependency-free leaf module and recognize unmerged index entries in the same check. Preserve the router’s marker diagnostic and other safety checks.

**Contract** The helper takes a caller-supplied Git runner and returns `null` for a safe state or a diagnostic for operation state, unmerged entries or a failed probe. Resolve `MERGE_HEAD`, `REVERT_HEAD`, `CHERRY_PICK_HEAD`, `rebase-merge`, `rebase-apply` and `sequencer` with worktree-local Git paths. Probe the entire index using Git’s unmerged entries and keep marker diagnostics first. Both callers keep their Git execution and timeout settings. The shared module depends only on Node built-ins and makes read-only probes.

#### 2. Leftover publication commit

**File** `skills/10x-pipeline/scripts/open-pr.mjs`.

**Intent** Reject unsafe leftover commits before status, staging or cleanup can touch the index.

**Contract** Run the shared check at entry to `commitLeftovers`, before the clean-status return. Map a diagnostic to the existing false commit result and error. Keep the branch-ahead and identity gates, then use the existing push and PR paths. The guarded path leaves local Git state intact and reports no commit hash or swept files. Ordinary staged entries remain eligible for the usual leftover commit.

#### 3. Regression coverage

**Files** `skills/10x-pipeline/test/open-pr.test.mjs` and `skills/10x-pipeline/test/archive.test.mjs`.

**Intent** Reproduce the unsafe states in local Git and check state preservation as well as the result fields.

**Contract** Use real conflicted merge, cherry-pick and revert fixtures in linked worktrees. Use a markerless unmerged fixture with the conflict outside the publisher’s current subdirectory. Cover operation markers with a resolved or clean index, including rebase and sequencer markers, using small deterministic fixtures. Simulate a failed safety probe with the Git shim. Check the diagnostic, local HEAD, saved index and working-copy content, and expected operation metadata. For the conflict cases, confirm the bare-remote run ref equals the original HEAD, inspect the formerly conflicted path at that ref, and confirm the shim recorded a push and normal fake PR handling with no staging, commit or reset. Extend router archive coverage to include a markerless unmerged index, retaining its existing merge halt and staged-only tests.

#### 4. Publication documentation

**Files** `docs/REFERENCE.md` and `docs/ADR/ADR-017-run-branch-always-pushed-for-review.md`.

**Intent** Describe how the operation guard affects final run state and publication.

**Contract** Update the reference’s publication and resume guidance. Record the safety rule in ADR-017 and qualify statements about kept edits and clean worktrees. Document `committed: false`, the state in `commitError` and the continued publication attempt of existing commits. Scan live documentation for the old behavior. Both pipeline skills already delegate to the same CLI and the result shape supports their current handling. [10x pipeline](../../../skills/10x-pipeline/SKILL.md#L167) · [OpenSpec pipeline](../../../skills/openspec-pipeline/SKILL.md#L170)

### Success Criteria

#### Automated Verification

- Publisher regression tests prove conflicts, marker-only state and probe failure skip the leftover commit while existing commits reach the local bare remote and fake PR handling proceeds. Run `node --test skills/10x-pipeline/test/open-pr.test.mjs`.
- Router archive tests prove active-operation and markerless-unmerged refusals. Run `node --test skills/10x-pipeline/test/archive.test.mjs`.
- The reference and ADR-017 describe the guard, preserved local state and existing-commit publication. Inspect the scoped diff and grep live docs for `commitError`, `leftover commit` and `final run state`.
- Full suite passes on Node 24 or later. Run `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`.

## Testing Strategy

Run the focused regression tests against the previous behavior to establish the failure, then run both affected test files and the full suite after the fix. Reuse the fixture’s local push URL and fake `gh`. The ordinary clean and dirty worktree, pre-staged entries, failing hook and PR regression cases continue to exercise the normal path. Any live PR or CI follow-up belongs to the orchestrator’s publication flow under ADR-017 Amendment 2.

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

- [ ] 1.1 Publisher regression tests prove conflicts, marker-only state and probe failure skip the leftover commit while existing commits reach the local bare remote and fake PR handling proceeds. Run `node --test skills/10x-pipeline/test/open-pr.test.mjs`.
- [ ] 1.2 Router archive tests prove active-operation and markerless-unmerged refusals. Run `node --test skills/10x-pipeline/test/archive.test.mjs`.
- [ ] 1.3 The reference and ADR-017 describe the guard, preserved local state and existing-commit publication. Inspect the scoped diff and grep live docs for `commitError`, `leftover commit` and `final run state`.
- [ ] 1.4 Full suite passes on Node 24 or later. Run `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`.
