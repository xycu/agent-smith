# Prefer the default PR base at equal or shorter distance

## Overview

Fix automatic PR base selection for runs whose default branch advances after the run forks, and for repositories without a symbolic remote HEAD. Preserve stacked PRs when the pushed feature branch is strictly closer.

## Current State Analysis

`ancestorCounts` enumerates only refs merged into HEAD and `nearestBase` returns a branch name. `resolveBase` returns an ancestor before trying the remote HEAD fallback, so a fetched default-branch advance can hand the PR to a stale branch. When remote HEAD is absent, alphabetical order currently resolves ties even if policy lists one of the tied branches as a default. [Publisher ranking and fallback](../../../skills/10x-pipeline/scripts/open-pr.mjs#L189)

### Key Discoveries

- The prefix-collision fix is present in this worktree at `3aa8feff`. Its shared `automaticBase` predicate already handles configured defaults and validates candidates from each source. [Eligibility rules](../../../skills/10x-pipeline/scripts/open-pr.mjs#L204)
- The publisher separately resolves the chosen ref before staging and pushing. It passes that ref to PR title derivation and the branch name to PR creation. An open PR is reused by head branch. [Publisher flow](../../../skills/10x-pipeline/scripts/open-pr.mjs#L433) · [PR creation and reuse](../../../skills/10x-pipeline/scripts/open-pr.mjs#L377)
- The existing fixtures use real Git with a linked worktree and local bare remote, plus a fake GitHub CLI and a Git shim that records arguments and injects failures. [Fixture and command logs](../../../skills/10x-pipeline/test/open-pr.test.mjs#L114)

## Desired End State

1. An explicit `--base` wins.
2. Rank eligible remote ancestors by commits reachable from run HEAD that the candidate lacks, equivalent to `git rev-list --count <candidate-ref>..HEAD`. If the selected remote's symbolic HEAD names an eligible default branch with a readable fetched ref, compare it on that same measure even if its tip has diverged. The default wins at equal or shorter distance. A strictly closer eligible ancestor wins.
3. If the remote HEAD target is unknown, prefer the first `isolation.defaultBranches` entry among the equally near eligible ancestors. Use alphabetical ref order for remaining ties. A configured branch needs to be an eligible ancestor to receive this preference.
4. If a remote default has no valid comparison count and an eligible ranked ancestor exists, take that ancestor. With no ranked candidate, follow the existing eligible symbolic HEAD and then GitHub default fallback, or return the existing skip. The existing chosen-base and no-commits checks still apply.

For example, fork a run from `main` at commit A and add one run commit. Advance the remote `main` by one different commit. An old branch at A and the fetched `main` both have distance 1, so `main` wins. Without a symbolic remote HEAD, tied ancestors `archive-2025`, `develop` and `main` resolve to `main` under the shipped policy. [Change cases](change.md) · [Shipped policy](../../../skills/10x-pipeline/policy.json#L120)

## Scope

The shared publisher's automatic base ranking for both chains, offline regression coverage and the publication documentation. Existing eligibility, publication ownership, branch safety checks and PR reuse remain the controlling contracts. Not in scope: ranking a diverged default when the remote's symbolic HEAD is unknown (a configured default competes only as an eligible ancestor), a network fetch or extra GitHub lookup for the comparison, and any change to `countAhead`, PR title derivation or PR reuse. [Publication ADR](../../../docs/ADR/ADR-017-run-branch-always-pushed-for-review.md)

## Implementation Approach

Keep ranking inside `open-pr.mjs`. Reuse the ancestor counts and eligibility check from the prefix-collision fix. Carry the nearest ancestor's name and distance into default comparison, using the already enumerated count for an ancestor default. Count the exact remote-tracking ref locally when a comparable default is outside the ancestor scan. Accept only a successful, nonempty non-negative integer count, so a failed probe cannot appear to be a perfect match. Apply the same check to the older-Git per-ancestor counts: `Number(gitOut(...))` turns a failed or empty `rev-list` into `0`, which would rank that ancestor as the nearest, so a candidate without a valid count is dropped. The existing GitHub lookup stays at the end of the fallback path.

### Planning assumptions

- The two-dot commit count measures “as near.” The change notes prescribe it and the publisher already uses it for ahead counts. Remote HEAD is the source for comparing a non-ancestor default. Policy order is the tie-break when that target is unknown, as described in the change notes. [Change direction](change.md) · [Existing count](../../../skills/10x-pipeline/scripts/open-pr.mjs#L245)
- A local-only default ref can still serve the existing fallback path. Ranking against remote ancestors uses the selected remote's fetched refs, so a missing remote default cannot gain a rank from a same-named local branch. This follows the existing remote candidate boundary and the no-extra-network requirement. [Current base selection](../../../skills/10x-pipeline/scripts/open-pr.mjs#L218) · [Change constraints](change.md)
- One phase covers the change because the selector, its integration fixture and its documentation can land together. The prerequisite prefix-collision fix is already present. [Prefix-collision plan](../../archive/2026-11-19-open-pr-base-prefix-collision/plan.md)

## Phase 1: Rank the default branch with eligible ancestors

### Overview

Apply the new ranking in the shared publisher and prove the effect on its JSON result and the base argument for a newly created PR.

### Changes Required

#### 1. Publisher ranking

**File**: `skills/10x-pipeline/scripts/open-pr.mjs`

**Intent**: Let a fetched default branch compete with eligible ancestors after the default branch advances.

**Contract**: Implement the ranking and fallback order in Desired End State. Retain the existing eligibility filter, explicit override, older Git fallback and chosen-base checks. Validate comparison results before ranking. Keep symbolic HEAD, candidate refs and comparisons scoped to the selected remote.

#### 2. Offline regression coverage

**File**: `skills/10x-pipeline/test/open-pr.test.mjs`

**Intent**: Reproduce the two reported wrong-base outcomes through the publisher's normal CLI entry point.

**Contract**: Extend the existing base tests using `world`, `gitCalls` and `ghCalls`. Update remote-tracking refs through fixture-local pushes.

- Fork from `main`, keep a stale branch at the fork and push a separate advance to `main`. Confirm the fixture refs give equal two-dot counts and assert JSON `base` and fake `gh pr create --base` select `main`. Exercise the same comparison with the existing older-Git shim. For a strictly closer default, create the stale ref at a commit made before the fork (the fixture's `main` holds only the init commit, so add one before `from` is forked or push an older ref from a separate clone).
- Suppress or omit symbolic remote HEAD and put `main`, `develop` and `archive-2025` on the same ancestor. Assert both outputs select `main` with shipped defaults. Add a custom policy order that chooses a different tied branch and a no-configured-match case that exercises alphabetical ordering.
- Prove a strictly closer feature ancestor still wins with a diverged default. Cover an unavailable comparison with a Git shim that fails only `rev-list --count refs/remotes/origin/main..HEAD`, because `countAhead` later runs the same rev-list for the chosen base and a blanket failure would hide the ranking result, while an eligible ancestor exists. Add an older-Git case in which the per-ancestor `rev-list` fails for one ancestor and that ancestor is not chosen. Assert the winner and verify the new comparison paths make no fetch or default-branch GitHub lookup. Retain the current tests for explicit override, remote HEAD ties, prefix exclusions, fallback, no commits and PR reuse.

#### 3. Publication documentation

**Files**: `docs/REFERENCE.md`, `docs/ADR/ADR-017-run-branch-always-pushed-for-review.md`

**Intent**: Make the automatic base choice predictable for repositories with an advancing default or missing remote HEAD.

**Contract**: Update the reference's base-selection bullet (`docs/REFERENCE.md` line 183). In ADR-017 update the places that state the rule: the "What the script does" base step (item 2), the Assumptions line on the nearest remote branch, and the closing sentence of Amendment 3 ("Nearest-ancestor counting, remote-HEAD tie preference and older-Git counting fallback continue to determine the automatic base"), or add a new dated amendment that supersedes them, as the prefix-collision change did for eligibility. Leave no current description of the old rule. State the distance, tie order, fetched default exception and continued eligibility rules. Search README, docs, skills, prompts and rules for stale current descriptions, following the repository lesson on changed output.

### Success Criteria

#### Automated Verification:

- Offline regressions show the advanced default wins at equal or shorter distance, and missing remote HEAD uses configured order and then alphabetical order. The two reported scenarios fail on the old selector and pass with the fix. Verify JSON base and fake PR-create base for both reported scenarios.
- Offline coverage passes for a strictly closer pushed feature, failed default comparison, old Git, explicit override and the existing eligibility and fallback rules. Logged comparison paths show no fetch or added GitHub default lookup.
- The full Node 24+ repository suite and `git diff --check` pass, and the reference and ADR describe the implemented selection rule.

## Testing Strategy

Use the existing local bare remote, fake GitHub CLI and logging Git shim. Name new tests with the existing `base:` prefix. Write the new tests first and run the focused command below with `open-pr.mjs` still unedited: the two reported-scenario tests must fail (stale ancestor and alphabetical winner) while the existing base tests pass. Only then change the selector and rerun to confirm the fix. Assert return values and outgoing arguments from the same local fixture. Publication stays with the orchestrator under ADR-017.

```sh
node --test --test-name-pattern='base:' skills/10x-pipeline/test/open-pr.test.mjs
node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs
git diff --check
```

## Performance Considerations

Keep the modern single ancestor enumeration and reuse the counts it returns. The extra default comparison, when needed, is bounded to one selected remote-tracking ref. Older Git continues to use its existing per-ancestor counting fallback.

## Migration Notes

The change is prospective for newly created PRs. Existing policies, recorded run data and open PRs continue through the current readers and reuse path. Reverting the selector and its documentation restores the old ranking without a data migration. Explicit `--base` remains available for a particular run on either version.

## References

- [Change definition and expected behavior](change.md)
- [Base-selection code](../../../skills/10x-pipeline/scripts/open-pr.mjs#L189)
- [Existing base tests](../../../skills/10x-pipeline/test/open-pr.test.mjs#L274)
- [Current publication reference](../../../docs/REFERENCE.md#L183)
- [Publication ADR](../../../docs/ADR/ADR-017-run-branch-always-pushed-for-review.md)
- [Repository lessons](../../foundation/lessons.md)

## Progress

> Convention `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Keep step titles fixed.

### Phase 1: Rank the default branch with eligible ancestors

#### Automated

- [ ] 1.1 Offline regressions show the advanced default wins at equal or shorter distance, and missing remote HEAD uses configured order and then alphabetical order. The two reported scenarios fail on the old selector and pass with the fix. Verify JSON base and fake PR-create base for both reported scenarios.
- [ ] 1.2 Offline coverage passes for a strictly closer pushed feature, failed default comparison, old Git, explicit override and the existing eligibility and fallback rules. Logged comparison paths show no fetch or added GitHub default lookup.
- [ ] 1.3 The full Node 24+ repository suite and `git diff --check` pass, and the reference and ADR describe the implemented selection rule.
