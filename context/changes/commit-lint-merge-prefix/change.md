---
change_id: commit-lint-merge-prefix
title: Stop commit-lint from accepting any subject that starts with Merge
status: impl_reviewed
created: 2026-11-12
updated: 2026-11-15
archived_at: null
---

## Notes

Source: the repo review of 2026-11-12 (tests, tools and CI audit). Severity: low.

### Problem

`tools/commit-lint.mjs:17`: `if (subject.startsWith("Merge ")) return null;`. The line is meant for merge commits, but it tests the text, not the commit. An ordinary commit with the subject "Merge the two parsers into one" is accepted: `lintSubject("Merge the two parsers into one")` returns `null`.

Such a commit passes the `commits` job, lands on `main` through the rebase-merge, and release-please finds no type in it: no changelog line and no version bump for that change.

Second gap: `.github/workflows/ci.yml:38` runs the lint only on `pull_request`. A commit pushed straight to `main` is never linted. All commits on `main` pass today, so this is a missing check and not a present fault.

### Fix direction

- Delete line 17 and pass `--no-merges` to `git log` in `lintRange` (`:27`). Real merge commits are then left out by git, and a subject is judged on its form alone.
- Optional: lint pushes to `main` too, over `${{ github.event.before }}..${{ github.sha }}`, in a job that reports and does not block (the commits are already on `main`).

### Tests

- `tools/test/commit-lint.test.mjs`: "Merge the two parsers into one" is an error; a range that holds a real merge commit passes; the existing cases stay.

### Done when

A non-merge commit whose subject starts with "Merge " fails the `commits` job.

**Rescoped 2026-11-13.** Gap 1 (the `Merge ` exemption) is folded into `squash-merge-pr-title-lint` phase 1. Gap 2 (lint pushes to `main`) no longer applies: the ruleset blocks direct pushes, and with squash-only merging the pull request title is the one subject on `main`.

### Implementation verification, 2026-11-14–15

The inherited fix is present at local `main` and `origin/main` baseline `45a7a5087f0298536ee9d74181846a503583bb4a`. Git confirms integration commit `a506d638d72d1c47fd9e25fc8f004faa99953b07` is an ancestor of that baseline. Implementation started at `ce07804fa193c9e0f9ea5312e53c85f93838885e`. The linter and both workflow files match the baseline. These observations use local Git references.

The range-failure test now covers both `wip stuff` and the ordinary commit subject `Merge the two parsers into one`, each alongside a conventional commit. Both cases require exit 1 and the offending short hash and full subject in stderr. The existing real-merge fixture checks Git topology filtering, and title mode rejects the same reported subject. CI invokes `node tools/commit-lint.mjs "$BASE..$HEAD"`, and the title workflow invokes `node tools/commit-lint.mjs --title "$TITLE"`. The extended test uses the existing hermetic fixture, CLI helper, and `removeTree` cleanup. [Range and title implementation](../../../tools/commit-lint.mjs) · [Regression coverage](../../../tools/test/commit-lint.test.mjs)

#### Gate evidence

- Node v24.19.0 ran `TMPDIR="$PWD/context/changes/commit-lint-merge-prefix" node --test tools/test/commit-lint.test.mjs tools/test/pr-title-workflow.test.mjs`. All 14 tests passed, with zero failures, cancellations, or skips, both before and after the deliberate-break check.
- The deliberate-break check temporarily restored `if (subject.startsWith("Merge ")) return null;` in `lintSubject`. Running only the new Merge-prefixed range test failed with actual exit 0 against expected exit 1. A `finally` block restored the original source bytes, and `git diff --exit-code -- tools/commit-lint.mjs` passed.
- The literal planned full-suite command, `TMPDIR="$PWD/context/changes/commit-lint-merge-prefix" node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`, completed with 1,524 tests, 1,508 passes, 13 failures, three skips, and zero cancellations. No-Git fixtures discovered the enclosing worktree. The isolated `entry records before state` reproduction recorded this run HEAD where it expected `null`.
- The environment adjustment places scratch projects in the change-local `verification-tmp/` directory with a temporary `.git` file containing `gitdir: unavailable-test-parent`. This stops parent repository discovery for no-Git fixtures while fixture-owned repositories initialize normally. The three initially failing executor cases passed together with this boundary. This is an execution-environment adaptation supported by the reproduced HEAD mismatch and the successful bounded retry.
- The full-suite retry ran `TMPDIR="$PWD/context/changes/commit-lint-merge-prefix/verification-tmp" node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`. All 1,524 tests completed with 1,521 passes, zero failures, three skips, and zero cancellations in 1,349,097 ms. All 13 failures from the first run passed with the temporary boundary.
- The three expected skips were the two live `pr-comment` checks, which require `GH_LIVE=1`, network access, and authenticated `gh`, and `CLAUDE.md has no @ imports`, because that file is absent. Live GitHub behavior remains unverified.
- `node tools/version-check.mjs` passed at version 1.11.0. `git diff --check` passed. The phase deliverables are the extended regression, this completion evidence, and the canonical Progress update. Temporary logs and the discovery boundary were removed after verification.

#### Assumptions

The 2026-11-13 rescope and ADR-008 Amendment 2 govern the direct-push scope. Local CLI and suite checks establish this change’s acceptance evidence. [Rescope](#done-when) · [ADR-008 Amendment 2](../../../docs/ADR/ADR-008-release-packaging-and-semver.md#amendment-2-squash-only-merging-and-a-pr-title-lint-change-squash-merge-pr-title-lint)
