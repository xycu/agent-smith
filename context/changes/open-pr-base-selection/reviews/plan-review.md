<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Prefer the default PR base at equal or shorter distance

- **Plan**: context/changes/open-pr-base-selection/plan.md
- **Mode**: Deep (blast radius checked by direct grep, no sub-agent)
- **Date**: 2026-11-21
- **Verdict**: REVISE
- **Findings**: 0 critical, 2 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

Grounding: 8/8 paths ✓ (open-pr.mjs, open-pr.test.mjs, REFERENCE.md, ADR-017, policy.json, change.md, prefix-collision archive plan, lessons.md), 4/4 symbols ✓ (`ancestorCounts`, `nearestBase`, `resolveBase`, `automaticBase`; no callers outside `open-pr.mjs`), brief↔plan ✓. Progress block: one `## Progress`, rows 1.1 to 1.3 match the three Automated criteria, no Manual rows, no publication-dependent Automated criterion.

## Findings

### F1 — Count validation covers only the new default probe, not the older-Git ancestor counts

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Implementation Approach; Phase 1 change 1 (Publisher ranking)
- **Detail**: The plan accepts only a successful, nonempty, non-negative integer count for the default comparison. The existing older-Git path in `ancestorCounts` computes `Number(gitOut(["rev-list", "--count", ...]))`, and `gitOut` returns `null` on failure, so `Number(null)` is `0`. A failed `rev-list` makes that ancestor look like a perfect match and it outranks the default under the new "default wins at equal or shorter distance" rule. The plan's own goal (a failed probe must not look perfect) is not met on that path.
- **Fix**: Apply the same validity check to the older-Git per-ancestor counts, drop a candidate without a valid count, and add a test case for it.
- **Decision**: APPLIED — plan.md Implementation Approach (added the older-Git count validation) and Phase 1 change 2 (added an older-Git failing `rev-list` test case); plan-brief.md Architecture / Approach.

### F2 — ADR-017 edit locations are not named and one would stay stale

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 change 3 (Publication documentation)
- **Detail**: "ADR-017's current base contract" is vague. ADR-017 states the rule in "What the script does" item 2, in the Assumptions line on the nearest remote branch, and in the last sentence of Amendment 3 ("Nearest-ancestor counting, remote-HEAD tie preference and older-Git counting fallback continue to determine the automatic base"). The Amendment 3 sentence would silently contradict the new rule. The repository lesson on greping docs for changed behavior applies.
- **Fix**: Name the three places and `docs/REFERENCE.md` line 183, or add a dated amendment that supersedes them, and require that no current description of the old rule remains.
- **Decision**: APPLIED — plan.md Phase 1 change 3 (Publication documentation) Contract.

### F3 — Diverged default with unknown remote HEAD is silently out of scope

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Scope; Desired End State items 2 and 3
- **Detail**: Case 1 (default advanced, stale ancestor wins) still occurs when the remote has no symbolic HEAD: the configured default only competes as an eligible ancestor. The plan decides this deliberately but has no non-goals statement, so an implementer or reviewer cannot tell whether the gap is intended.
- **Fix**: State the exclusion, and the no-fetch and no-extra-lookup limits, in Scope and the brief.
- **Decision**: APPLIED — plan.md Scope; plan-brief.md Scope.

### F4 — "Fails on the old selector" is a process claim with no ordering

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Success Criteria 1.1; Testing Strategy
- **Detail**: Criterion 1.1 says the two reported scenarios fail on the old selector, but only a red-first order makes that checkable, and the Testing Strategy did not fix it.
- **Fix**: Order the work: write the tests, run the focused `base:` command with `open-pr.mjs` unedited and expect the two reported-scenario tests to fail, then change the selector.
- **Decision**: APPLIED — plan.md Testing Strategy.

### F5 — Test fixture details would trip the implementer

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 change 2 (Offline regression coverage)
- **Detail**: Two bullets are underspecified. The `world()` fixture's `main` holds only the init commit, so "stale ref predates the fork" needs an extra earlier commit. A blanket failing `rev-list` shim would also break `countAhead`, which runs the same `rev-list ...main..HEAD` for the chosen base, so the shim must fail only the default probe.
- **Fix**: Spell out both in the test bullets.
- **Decision**: APPLIED — plan.md Phase 1 change 2 (first and third bullets).
