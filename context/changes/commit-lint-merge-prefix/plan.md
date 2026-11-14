# Commit-lint Merge-prefix verification plan

## Overview

Close the Wave 7 Merge-prefix gap by verifying the implementation inherited from `squash-merge-pr-title-lint`, adding the missing range-CLI regression, and recording completion evidence in this change. Complexity is LOW, with one implementation phase and all acceptance checks executable locally.

## Current State Analysis

On 2026-11-14, local `main`, `origin/main`, and the remote `refs/heads/main` all resolve to `45a7a5087f0298536ee9d74181846a503583bb4a`. The run HEAD is `aacdf1ca8d4ecdfa03ebde8fd3739d00105f5d36`. The linter, its tests, and both relevant workflows match `main` byte-for-byte. Integration commit `a506d638d72d1c47fd9e25fc8f004faa99953b07` is an ancestor of `main` and contains the folded fix.

The shared subject validator rejects `Merge the two parsers into one`. Range mode delegates merge detection to `git log --no-merges`, then validates each remaining subject. The range CLI is the command used by the `commits` job. Title mode uses the same subject validator. [Linter](../../../tools/commit-lint.mjs#L19) · [CI entry point](../../../.github/workflows/ci.yml#L82) · [Title entry point](../../../.github/workflows/pr-title.yml#L35)

Existing coverage rejects the reported subject through `lintSubject` and title mode, and exercises a genuine two-parent merge through range mode. The generic invalid-range test uses `wip stuff`, leaving the specific ordinary Merge-prefixed commit untested through that entry point. [Subject regression](../../../tools/test/commit-lint.test.mjs#L65) · [Invalid range](../../../tools/test/commit-lint.test.mjs#L78) · [Real merge](../../../tools/test/commit-lint.test.mjs#L95) · [Title mode](../../../tools/test/commit-lint.test.mjs#L104)

### Planning verification

- `TMPDIR="$PWD/context/changes/commit-lint-merge-prefix" node --test tools/test/commit-lint.test.mjs tools/test/pr-title-workflow.test.mjs` passed all 13 tests on Node v24.19.0, with zero failures or skips.
- An ephemeral scratch repository inside this change contained an ordinary commit with the reported Merge-prefixed subject. Invoking the actual range CLI returned exit 1 and named its hash and subject. Direct `lintSubject` rejection passed too. The scratch repository was removed through the existing `removeTree` helper.
- The existing real-merge range regression passed. Its divergent histories and `--no-ff` merge create the genuine merge topology needed to exercise `--no-merges`.
- The full repository suite is an implementation-phase gate and remains pending.

## Desired End State

An ordinary Merge-prefixed commit fails through the same range CLI used by CI and its diagnostic identifies the commit. A genuine merge commit remains excluded by Git, and conventional subjects, revert handling, title mode, and existing exit codes retain their tested behavior. This change holds reproducible completion evidence referencing the inherited implementation and the added regression.

### Key Discoveries

- The 2026-11-13 rescope folds the original fix into the squash-title change and resolves the direct-push proposal through the documented squash-only workflow. [Change notes](change.md#L35) · [ADR-008 Amendment 2](../../../docs/ADR/ADR-008-release-packaging-and-semver.md#L91)
- `lintRange` already owns merge exclusion with `git log --no-merges`. Its existing implementation satisfies the behavior requested here. [Range implementation](../../../tools/commit-lint.mjs#L28)
- Existing `makeRepo`, `git`, `cli`, hermetic `GIT_ENV`, and `removeTree` provide the entire regression-test fixture and cleanup path. [Test helpers](../../../tools/test/commit-lint.test.mjs#L15)
- The existing test-index row already identifies accepted/rejected subjects, range mode, title mode, and exit codes. [Test index](../../../skills/10x-pipeline/test/README.md#L113)

## Scope

Implementation edits belong in `tools/test/commit-lint.test.mjs` and the completion notes in `context/changes/commit-lint-merge-prefix/change.md`. Planning produces this plan, its brief, and the bounded `planned` metadata update. The 2026-11-13 rescope governs direct-push CI. Preserve the existing workflows, runtime implementation, `WAVES.md`, archive contents, and router-owned run state. The existing test-index entry covers the extended test file.

## Implementation Approach

Reuse the inherited validator and Git filtering. Extend the existing range-CLI failure coverage with the reported ordinary-commit subject, retaining its generic invalid-subject case. Reuse the existing real-merge and title tests as acceptance proof. Run the focused checks followed by the repository-required full suite, then append the measured results to this change's completion notes.

### Assumptions and decisions

- The unattended instruction delegates interview and phase-structure decisions. LOW complexity and zero substantive questions follow the explicit rescope, the narrow existing owner, and `complexity.json`'s high-confidence assessment. One phase covers the single coverage gap and its closure evidence. [Change notes](change.md#L24) · [Complexity assessment](complexity.json)
- Closure is complete when local CLI regression proof and the required suite pass and their results are recorded. The workflows invoke those CLI entry points, and the goal concerns the lint gap. The documented repository ruleset and squash-only policy supply the direct-push scope decision. [CI](../../../.github/workflows/ci.yml#L70) · [ADR-008](../../../docs/ADR/ADR-008-release-packaging-and-semver.md#L95)
- Planning leaves execution rows pending. Lifecycle completion follows implementation and verification. The pre-existing run-log modification belongs to the orchestrator. [Repository instructions](../../../AGENTS.md)

## Phase 1: Complete range regression and closure evidence

### Overview

Add the missing persistent proof through the CI entry point, verify the inherited behavior, and document closure within the change.

### Changes Required

#### Range CLI regression

**File** `tools/test/commit-lint.test.mjs`

**Intent** Exercise an ordinary commit whose subject is `Merge the two parsers into one` through the actual range CLI, using the existing fixture and CLI helpers. Preserve the generic bad-subject case and reuse the existing real-merge and title-mode regressions.

**Contract** For a range containing conventional commits and that ordinary Merge-prefixed commit, the CLI exits 1 and stderr contains the bad commit's short hash and full subject. The existing range containing a genuine two-parent merge and a valid ordinary commit exits 0. The existing title-mode assertion rejects the same Merge-prefixed text with exit 1.

#### Change-local completion evidence

**File** `context/changes/commit-lint-merge-prefix/change.md`

**Intent** Append a dated verification/completion note connecting the original gap to the inherited fix and the newly covered range case. Preserve the historical problem statement and the 2026-11-13 rescope.

**Contract** Record the verified baseline SHA, integration commit `a506d63`, the relevant entry points, actual commands and outcomes, and any failures or skips. Keep lifecycle metadata consistent with the execution skill. Preserve router-owned state and the user-designated protected paths.

### Success Criteria

#### Automated Verification

- Focused regressions pass, including ordinary Merge-prefixed range rejection with hash/subject diagnostics, genuine merge exclusion, and title rejection. Run `TMPDIR="$PWD/context/changes/commit-lint-merge-prefix" node --test tools/test/commit-lint.test.mjs tools/test/pr-title-workflow.test.mjs`.
- The repository-required full suite passes. Run `TMPDIR="$PWD/context/changes/commit-lint-merge-prefix" node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`, recording any skips and their conditions.
- Change-local completion evidence records the inherited fix, baseline SHA, and actual verification outcomes. `git diff --check` passes and the final diff respects the scoped files and protected paths.

## Testing Strategy

### Unit coverage

Reuse the existing valid/invalid subject tests, including the reported Merge-prefixed text and revert subjects.

### Integration coverage

Use the existing scratch-repository helpers to drive the real executable. Cover an ordinary Merge-prefixed commit in a nonempty range alongside conventional commits, a real merge with a valid ordinary commit remaining after filtering, and title mode. Assert the documented CLI exits and the failing commit diagnostic. The workflow tests verify the title command and its input transport.

All checks are executable by the unattended agent. Scratch repositories must stay inside this worktree through `TMPDIR` and use the established hermetic Git environment and `removeTree` cleanup.

## Performance Considerations

One additional scratch-repository fixture adds a small amount of test work. Runtime behavior and complexity stay as inherited from `main`.

## Migration Notes

The change adds regression proof and completion notes. Existing commit history and stored run data require no migration.

## References

- [Change identity and rescope](change.md)
- [Complexity assessment](complexity.json)
- [Shared subject validator and range implementation](../../../tools/commit-lint.mjs#L19)
- [Existing CLI tests](../../../tools/test/commit-lint.test.mjs#L78)
- [CI range invocation](../../../.github/workflows/ci.yml#L82)
- [Title workflow invocation](../../../.github/workflows/pr-title.yml#L35)
- [ADR-008 Amendment 2](../../../docs/ADR/ADR-008-release-packaging-and-semver.md#L91)
- [Repository test and state rules](../../../AGENTS.md)
- [Lessons learned](../../foundation/lessons.md)

## Progress

### Phase 1: Complete range regression and closure evidence

#### Automated

- [ ] 1.1 Focused regressions pass, including ordinary Merge-prefixed range rejection with hash/subject diagnostics, genuine merge exclusion, and title rejection. Run `TMPDIR="$PWD/context/changes/commit-lint-merge-prefix" node --test tools/test/commit-lint.test.mjs tools/test/pr-title-workflow.test.mjs`.
- [ ] 1.2 The repository-required full suite passes. Run `TMPDIR="$PWD/context/changes/commit-lint-merge-prefix" node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`, recording any skips and their conditions.
- [ ] 1.3 Change-local completion evidence records the inherited fix, baseline SHA, and actual verification outcomes. `git diff --check` passes and the final diff respects the scoped files and protected paths.
