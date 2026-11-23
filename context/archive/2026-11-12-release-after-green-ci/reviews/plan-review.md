<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Release only from a main commit whose CI run passed

- **Plan**: context/changes/release-after-green-ci/plan.md
- **Mode**: Deep (no sub-agent: nested subagents are banned; the riskiest claims were checked by hand)
- **Date**: 2026-11-12
- **Verdict**: SOUND
- **Findings**: 0 critical, 1 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | WARNING |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | PASS |

## Grounding

Paths 9/9 ✓ (ci.yml, release.yml, ci-runner and workflow-pins tests, ADR-008/012/020, AGENTS.md Releases, complexity.json), `release.yml:14-16` and `ci.yml:18-20` match the quoted lines, brief↔plan ✓, Progress↔Phase ✓ (1.1-1.6, 2.1-2.3, 3.1-3.7 match the criteria), no `docs/reference/contract-surfaces.md` (check skipped).

## Findings

### F1 — Tag sits on the release-PR merge commit, the gate checks the head of main

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Current State Analysis (last bullet), Key Discoveries, Phase 2 ADR-008 contract
- **Detail**: The plan says the tag is created "only after that CI run is green". release-please tags the merge commit of the release PR. The `head_sha == github.sha` guard skips a green run whose commit is no longer the head of `main`. If a push lands before the CI run of the release-PR merge commit R ends, R's run is skipped (or fails) and the next green run of the newer head tags R. R's own CI run may have been the red one, which is the v1.5.0 failure in a narrower form. The plan did not say so.
- **Fix**: State the gap as accepted residual risk in the plan (Current State, Key Discoveries) and in the ADR-008 amendment and `AGENTS.md` contracts. A step that checks the CI conclusion of the tagged commit is not added (it would be more code than the change warrants).
- **Decision**: APPLIED — plan.md: Current State Analysis last bullet, Key Discoveries new bullet, Phase 2 section 2 (ADR-008) consequences and Phase 2 section 1 (AGENTS.md) contract.

### F2 — Rerun promise holds only while main still points at the commit

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: End-State Alignment
- **Location**: Desired End State, third bullet; Phase 2 AGENTS.md contract
- **Detail**: With the stale-commit guard, a rerun of a failed CI run for commit A that passes after `main` moved to B starts a job that is skipped. The release then waits for the CI run of B. "A flake delays a release and does not lose it" is true, but the rerun route needs `main` to be unchanged.
- **Fix**: Add the condition to the Desired End State bullet and to the AGENTS.md contract.
- **Decision**: APPLIED — plan.md: Desired End State third bullet; Phase 2 section 1 (AGENTS.md) contract.

### F3 — Phase 3 rows cannot be ticked inside the implementation run

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3 Overview; Progress 3.1-3.7
- **Detail**: Row 3.1 is listed as Automated but needs a merged workflow on `main`. An unattended run cannot prove it, and the plan did not say who ticks it.
- **Fix**: State in the Phase 3 Overview that the rows stay unticked in the run and the owner ticks them after the merge.
- **Decision**: APPLIED — plan.md: Phase 3 Overview.
