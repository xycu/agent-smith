<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Keep short run prefixes from hiding PR bases

- **Plan**: context/changes/open-pr-base-prefix-collision/plan.md
- **Mode**: Deep (single reviewer, no sub-agent: the step runs as a subagent)
- **Date**: 2026-11-21
- **Verdict**: SOUND
- **Findings**: 0 critical, 0 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS |
| Plan Completeness | PASS |

## Grounding

Grounding: 7/7 paths and anchors checked (open-pr.mjs automaticBase/nearestBase/resolveBase, pr-common.mjs ID_RE, run-identity.mjs validateRunBranch, policy.json isolation.defaultBranches, REFERENCE.md Base bullet line 178, ADR-017 Amendment 3, test lines 950-975) ✓, symbols ✓, brief↔plan ✓. Progress rows 1.1 and 1.2 match the Success Criteria; no criterion needs a pushed branch, PR or PR CI.

## Findings

### F1 — Empty remainder is not decided

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Implementation Approach
- **Detail**: The rule says a prefixed candidate is eligible when its remainder cannot start a change ID. A name equal to the prefix (branch `release` under prefix `release`) has an empty remainder and the plan never says which way it goes. The first-character class was also only described as "the same constraint as `ID_RE`".
- **Fix**: State that an empty remainder is eligible and that the check uses the `[a-z0-9]` first-character class of `ID_RE`.
- **Decision**: APPLIED — Implementation Approach, sentence added after the first-character constraint.

### F2 — Docs sweep names no target

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1, change 3 (Base eligibility documentation)
- **Detail**: "Search other current documentation" leaves the implementer to find the text. The old rule lives in the Base bullet at `docs/REFERENCE.md` line 178; lessons.md asks for a grep of every doc when behavior changes.
- **Fix**: Name the REFERENCE.md line 178 sentences and list the folders to grep.
- **Decision**: APPLIED — Phase 1, change 3 Contract, last sentence rewritten.
