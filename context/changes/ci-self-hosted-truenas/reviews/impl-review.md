<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Run CI on self-hosted TrueNAS runners

- **Plan**: context/changes/ci-self-hosted-truenas/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-11-11
- **Verdict**: REJECTED
- **Findings**: 1 critical, 0 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | FAIL |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Scope and evidence

- Diff `main...HEAD` (outside the change folder): `.github/workflows/ci.yml`, `tools/test/ci-runner.test.mjs`, `docs/ADR/ADR-020-ci-on-self-hosted-truenas-runners.md`, `docs/ADR/ADR-008-release-packaging-and-semver.md`, `AGENTS.md`. Every file is in the plan; no plan file is missing; `release.yml` is untouched.
- `ci.yml`: both `runs-on` lines equal the plan's contract expression byte for byte; header comment states the fallback is not the boundary; no new `uses:`. A deleted fork (`head.repo` null) also falls back to `ubuntu-latest`.
- `ci-runner.test.mjs`: built-ins only, plain-text compare, job count 2, `release.yml` has no `self-hosted`. Matches the contract.
- ADR-020: has every item the plan's contract lists (labels, release stays hosted, prerequisites, runner version, no secrets, persistent runner, approval setting as boundary, fork consequence).
- Automated criteria (run 2026-11-11 on the pre-fix code): `node --test tools/test/ci-runner.test.mjs` 2/2 pass; `node --test tools/test/workflow-pins.test.mjs` 7/7 pass; `node tools/version-check.mjs` OK (1.4.13); `actionlint .github/workflows/ci.yml` clean (exit 0); `grep -l "ADR-020" AGENTS.md docs/ADR/ADR-008-release-packaging-and-semver.md` lists both; full suite 1059 pass, 0 fail, 3 skipped (same after the fixes of commit b8541af); `gh api repos/xycu/agent-smith/actions/runners` lists 6 online runners `truenas-agent-smith-1..6` with labels `self-hosted, Linux, X64, truenas` (label match is case-insensitive).
- Manual rows 2.3, 3.2, 3.3, 3.4 are unchecked, with reasons in `evidence/unproven.md`; none is rubber-stamped.

## Findings

### F1 — Fork approval setting is not the one the plan requires

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: repository setting (Settings -> Actions -> General); plan Phase 3 item 1; docs/ADR/ADR-020-ci-on-self-hosted-truenas-runners.md D2
- **Detail**: The plan and ADR-020 D2 name "Require approval for all external contributors" as the only boundary that keeps fork code off the NAS, and Phase 3 asks the owner to confirm it before the pull request opens. Read-only `gh api repos/xycu/agent-smith/actions/permissions/fork-pr-contributor-approval` returns `{"approval_policy":"first_time_contributors"}`. With that policy a fork contributor who already had a run approved or a PR merged gets no approval gate, and can edit `runs-on` to the `self-hosted, truenas` labels in the fork's `ci.yml` and run code on the NAS. The six runners are already registered and online, so this exposure exists now, not only after merge. The code matches the plan; the prerequisite does not hold.
- **Fix**: The owner sets "Fork pull request workflows from outside collaborators" to "Require approval for all external contributors" (API value `all_external_contributors`) before this change's pull request is opened or merged, and re-reads the endpoint above.
- **Decision**: PENDING — changing a repository setting is forbidden to agents (AGENTS.md Hard Rules), so the owner must switch the fork approval policy to all_external_contributors, or decide to accept the first-time-contributors gate as the boundary and amend ADR-020 D2.

### F2 — ADR-008 sentence contradicts itself

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: docs/ADR/ADR-008-release-packaging-and-semver.md:45
- **Detail**: The edited line reads "The workflows run only on GitHub. Since ADR-020 the CI jobs run on self-hosted TrueNAS runners ...". The kept first sentence now reads as false next to the new one; its original meaning was that no workflow runs locally.
- **Fix**: Reword the first sentence to "The workflows run only in GitHub Actions, never locally."
- **Decision**: APPLIED — commit b8541af

### F3 — ADR-020 assumption misstates how the approval setting is checked

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: docs/ADR/ADR-020-ci-on-self-hosted-truenas-runners.md:58
- **Detail**: The assumption reads "The fork approval setting is on. No file of the repository can check it (Progress row of Phase 3)." No Progress row covers the setting (the plan says so in Phase 3), a read-only `gh api` call can check it, and the measured value contradicts the assumption (F1).
- **Fix**: Name the required value, the read-only command and its expected `approval_policy`, drop the wrong Progress reference, and record the measured value.
- **Decision**: APPLIED — commit b8541af
