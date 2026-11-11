<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Run CI on self-hosted TrueNAS runners Implementation Plan

- **Plan**: context/changes/ci-self-hosted-truenas/plan.md
- **Mode**: Deep (done in this subagent, no nested subagent)
- **Date**: 2026-11-11
- **Verdict**: REVISE
- **Findings**: 1 critical, 2 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | WARNING |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | FAIL |
| Plan Completeness | WARNING |

## Grounding

Grounding: 9/9 paths checked (ci.yml, release.yml, workflow-pins.mjs and its test, ADR-008 line 45, ADR-019, AGENTS.md lines 53 and 56, docs/ADR listing) ✓, `ubuntu-latest` at ci.yml:21 and :35 and release.yml:28 ✓, `xycu/agent-smith` PUBLIC and not a fork ✓, ADR-020 number free ✓, Progress block 3 phases / 1:1 with Success Criteria ✓, brief↔plan ✓. No contract-surfaces file in the repo. Lessons.md has no rule that applies.

## Findings

### F1 — The fork fallback in `runs-on` is not a security boundary

- **Severity**: CRITICAL
- **Impact**: HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Blind Spots
- **Location**: Overview, Desired End State, Key Discoveries, Phase 1 section 1, Phase 2 ADR contract, Phase 3 Intent
- **Detail**: The plan says the ternary means "untrusted code never reaches the NAS". A `pull_request` run from a fork executes the workflow file of the PR's merge ref, so the fork author edits `runs-on` to `[self-hosted, linux, truenas]` and the expression never runs. The real control is the repository setting "Require approval for all external contributors" (Settings -> Actions -> General). The plan only mentions it as a Phase 3 check, under an outdated name ("outside collaborators"), and the repository is public. The guard test and the ADR would then record a protection that does not exist.
- **Fix**: State the fallback as defence in depth, make the approval setting a named prerequisite and the stated boundary (Overview, End State, Key Discoveries, workflow comment, ADR, Phase 3 Intent, brief), and note that the owner reads the workflow diff before approving a fork run.
- **Decision**: APPLIED — plan.md sections Overview, Current State Analysis, Desired End State, Key Discoveries, Implementation Approach, Phase 1 item 1 Intent, Phase 2 ADR Contract, Phase 3 Intent; plan-brief.md Key Decisions and Success Criteria.

### F2 — Guard test checks substrings, so an inverted ternary passes

- **Severity**: WARNING
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 section 2 — Guard test
- **Detail**: The test asserts each `runs-on:` line contains `truenas`, `ubuntu-latest` and `head.repo.full_name != github.repository`. Swapping the two branches of the ternary, or changing `!=` to `==` elsewhere in the line, keeps all three substrings and the test stays green while fork PRs go to the NAS.
- **Fix**: Compare each `runs-on:` line with the exact expression from the Contract of section 1.
- **Decision**: APPLIED — plan.md Phase 1 section 2 Contract.

### F3 — Runner prerequisites omit the runner version needed for Node 24 actions

- **Severity**: WARNING
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2 section 1 — ADR Contract
- **Detail**: `actions/checkout` v5.1.0 and `actions/setup-node` v5.0.0 run on the Node 24 action runtime, which needs a recent runner (checkout v5 documents v2.327.1 or newer). The prerequisite list covers Node for the tests but not the runner version, so an old runner fails at the first step. The plan also does not say that the runner is persistent and that anyone with write access runs code on it.
- **Fix**: Add the runner version prerequisite and the persistent-runner and write-access trust note to the ADR contract.
- **Decision**: APPLIED — plan.md Phase 2 section 1 Contract.

### F4 — The runner check comes after the change that depends on it

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: End-State Alignment
- **Location**: Phase 3 — Runner registration check
- **Detail**: The pull request of this change runs its own jobs on the NAS. If the runners are not registered or are offline when it opens, the jobs queue and the proof run never starts. Phase 3 lists the check last.
- **Fix**: Say in the Phase 3 Intent that the check happens before the pull request opens.
- **Decision**: APPLIED — plan.md Phase 3 Intent.

### F5 — Check 2.1 can pass without the ADR file existing

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 Automated Verification, Progress row 2.1
- **Detail**: `grep -l "ADR-020" AGENTS.md docs/ADR/ADR-008-...md` exits 0 when either file matches, and it does not test that `docs/ADR/ADR-020-ci-on-self-hosted-truenas-runners.md` exists, although the row title says it does. A better check is `test -f docs/ADR/ADR-020-ci-on-self-hosted-truenas-runners.md && grep -q ADR-020 AGENTS.md && grep -q ADR-020 docs/ADR/ADR-008-release-packaging-and-semver.md`.
- **Fix**: Replace the command in the row.
- **Decision**: PENDING — the fix changes the text of Progress row 2.1, and the review rules forbid editing Progress rows; the owner decides whether to reword the row.
