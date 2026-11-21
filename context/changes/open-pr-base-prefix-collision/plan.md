# Keep short run prefixes from hiding PR bases

## Overview

Fix automatic base selection in `open-pr.mjs` so a free-form run prefix such as `ma` does not hide the default branch `main`. Keep accepting existing project policies and saved run branches.

## Current State Analysis

`automaticBase` rejects every name that starts with the effective prefix or `agent-smith/`. The nearest-ancestor search and both default fallbacks share that filter, so an ordinary branch can be dropped at every opportunity. The publisher can then select the wrong ancestor or skip for lack of a base. [Base selection](../../../skills/10x-pipeline/scripts/open-pr.mjs#L205)

### Key Discoveries

- `ma` plus the valid ID `in` looks exactly like `main`. A saved run branch may also have a suffix after its ID, so a full-string ID check on everything after the prefix would admit some saved run refs as bases. [Change ID grammar](../../../skills/10x-pipeline/scripts/pr-common.mjs#L11) · [Saved identity validation](../../../skills/10x-pipeline/scripts/run-identity.mjs#L66)
- Isolation already reserves named defaults through `isolation.defaultBranches` and the remote HEAD. The shipped list contains `main` and `master`. [Isolation policy](../../../skills/10x-pipeline/policy.json#L116) · [Run guard](../../../skills/10x-pipeline/scripts/run-identity.mjs#L66)
- Existing tests reject fallback names under `codex/` and `agent-smith/`, including when such a name is advertised as the remote default. They also reject malformed refs. [Fallback tests](../../../skills/10x-pipeline/test/open-pr.test.mjs#L964)

## Desired End State

With `ma` as the run prefix, `main` remains eligible in the ancestor search. A valid `develop` advertised as the default remains eligible through either fallback with prefix `dev`. With prefix `release`, the ordinary ancestor `release/1.x` remains eligible because the part after the prefix begins with a slash, which cannot start a change ID.

Explicit `--base` still wins. Automatic selection keeps nearest eligible ancestor first, remote HEAD as the tie-breaker, then the local symbolic remote HEAD fallback, then the GitHub default fallback. A valid non-default branch whose name is indistinguishable from a run under a short prefix can be selected with `--base`.

## Scope

This is a low-complexity publisher change shared by both chains. Branch creation, saved identity validation, push safeguards, PR title and PR reuse remain governed by their existing contracts.

## Implementation Approach

Apply the eligibility rule once across the three automatic paths. Keep literal Git ref validation and continue excluding the current branch, the pseudo-ref `HEAD`, the legacy `agent-smith/` namespace and branches under explicit run namespaces whose configured prefix ends in `/` or `-`.

For other prefixes, a candidate with a matching prefix is eligible if its remainder cannot start a change ID, or its exact name is a known default. Use the same first-character constraint as `ID_RE` so a run ID followed by a saved suffix still counts as a possible run. Known defaults come from `isolation.defaultBranches`, the selected remote's symbolic HEAD target, or the GitHub result when considered in the existing final fallback. Keep the exception limited to the ambiguous prefix case. Use the local HEAD value already needed for ranking in ancestor selection and keep the GitHub query at its current position.

## Phase 1: Keep ordinary branches eligible as PR bases

### Overview

Change base eligibility and prove the selection behavior using the existing offline publication fixture.

### Changes Required

#### 1. Publisher base selection

**File** `skills/10x-pipeline/scripts/open-pr.mjs`

**Intent** Recover ordinary bases hidden by a prefix collision while continuing to filter possible run branches.

**Contract** Apply the eligibility rules above to the callers in `nearestBase` and `resolveBase`. Preserve ref validation, explicit override, ordering, older-Git counting, base ref resolution and no-commits handling. Keep the earlier isolation guard and the existing prefix mismatch guidance for saved runs.

#### 2. Offline regression coverage

**File** `skills/10x-pipeline/test/open-pr.test.mjs`

**Intent** Exercise real ref selection, with a local bare remote and fake GitHub responses.

**Contract** Extend the existing configured-base tests and reuse `world`, `gitCalls` and `ghCalls`. Establish these fixtures:

- Use a recorded `mademo` run, tied `aaa-copy`, and nearer possible run refs under both `ma` and `agent-smith/`. Include a custom possible run ref whose spelling continues beyond a valid change ID with a Git-valid suffix such as `.retry`. Assert JSON `base` and fake PR-create `--base` both select `main`. Use the fixture's explicit override to select `aaa-copy`.
- With prefix `release`, place the run on top of remote ancestor `release/1.x` with `main` farther back. Check that `release/1.x` wins.
- With prefix `dev` and a resolvable `develop` ref, suppress ancestor enumeration through the existing Git shim. Exercise the local symbolic remote HEAD fallback and assert that fake GitHub default lookup is absent. In a separate fixture, make the symbolic HEAD unavailable and return `develop` from fake `repo view`. Assert `develop` on both paths and assert the GitHub lookup occurred in the latter. The shipped policy's default list omits `develop`, so these checks exercise the respective sources of default evidence.
- Keep the existing namespaced and invalid fallback rejections. Add coverage for a known configured default in the ancestor search with symbolic remote HEAD unavailable, so that default evidence is tested independently as well.

#### 3. Base eligibility documentation

**Files** `docs/REFERENCE.md`, `docs/ADR/ADR-017-run-branch-always-pushed-for-review.md`

**Intent** Document when a short prefix overlaps an ordinary branch and how to select an ambiguous non-default branch.

**Contract** Update the publication base rule in the reference and amend the normative rule in ADR-017 Amendment 3. State the default evidence, saved-suffix handling, explicit namespace exclusions and `--base` precedence. Search other current documentation for the old blanket eligibility rule and align any affected descriptions.

### Success Criteria

#### Automated Verification:

- The focused offline publication tests fail on the old collision behavior and pass with the fix, covering nearest-ancestor selection, both fallback sources, configured defaults, competing run refs and explicit override.
- The full repository Node test suite passes, including existing publication and run-identity coverage, and `git diff --check` passes.

## Testing Strategy

Use the existing isolated Git fixtures and shimmed GitHub CLI. Run the focused regressions with `node --test --test-name-pattern='configured.*base' skills/10x-pipeline/test/open-pr.test.mjs` using matching test names, then run the required Node 24+ suite:

```sh
node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs
git diff --check
```

The focused assertions cover selection and the outgoing base argument entirely in local fixtures. The implementation has no live publication acceptance criterion.

## Performance Considerations

Reuse the existing remote HEAD value during ancestor selection. The eligibility change needs no extra remote lookup or per-ref Git subprocess.

## Migration Notes

Existing policies and saved run metadata work across versions. Newly selected bases affect future PR creation, and existing PRs keep their original bases through the publisher's existing reuse path. Reverting the code restores the previous selection behavior without data changes. Use explicit `--base` on either version for an ambiguous branch name.

## References

- [Change definition and collision examples](change.md)
- [Publisher fixture and offline clients](../../../skills/10x-pipeline/test/open-pr.test.mjs#L114)
- [Publication contract](../../../docs/ADR/ADR-017-run-branch-always-pushed-for-review.md#amendment-3--publish-the-validated-configured-branch-2026-11-16)
- [Reference for automatic base selection](../../../docs/REFERENCE.md#L178)

## Progress

> Convention `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Keep step titles fixed.

### Phase 1: Keep ordinary branches eligible as PR bases

#### Automated

- [ ] 1.1 The focused offline publication tests fail on the old collision behavior and pass with the fix, covering nearest-ancestor selection, both fallback sources, configured defaults, competing run refs and explicit override.
- [ ] 1.2 The full repository Node test suite passes, including existing publication and run-identity coverage, and `git diff --check` passes.
