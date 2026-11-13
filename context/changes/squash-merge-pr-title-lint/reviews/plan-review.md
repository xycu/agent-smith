<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Squash-only merging: lint the PR title, fix run PR titles, update the docs

- **Plan**: context/changes/squash-merge-pr-title-lint/plan.md
- **Mode**: Deep (done inline, no sub-agent: unattended run)
- **Date**: 2026-11-13
- **Verdict**: REVISE
- **Findings**: 0 critical, 2 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | WARNING |
| Blind Spots | PASS |
| Plan Completeness | WARNING |

## Grounding

Grounding: 12/12 paths ✓ (ci.yml, release.yml, commit-lint.mjs and test, ci-runner test, workflow-pins, open-pr.mjs and test, ADR-008, ADR-017, AGENTS.md, test README), symbols ✓ (`lintSubject`, `lintRange`, `titleFor`, `countAhead`, `TITLE_CAP`, `EXPECTED`), brief↔plan ✓, Progress↔Phase ✓ (5 phases, every success bullet has a row, no checkboxes outside Progress). AGENTS.md is 10,409 bytes, so the 1.2 KB budget fits under 12,288. Line numbers cited for ADR-008 (12, 13, 52, 62, 85) match.

## Findings

### F1 — Success criterion 4.2 cannot pass: the grep also hits `isolation.mjs`

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 4 — Automated Verification, second bullet (Progress row 4.2)
- **Detail**: The command `git grep -n -i "rebase-merge" -- . ':!context' ':!CHANGELOG.md'` also matches `skills/10x-pipeline/scripts/isolation.mjs:160` (`"rebase-merge"` is the git directory name of a rebase in progress). The bullet says only ADR-008 lines with an Amendment 2 pointer may remain, so it fails however well the docs are fixed, and an implementer would be tempted to edit router code.
- **Fix**: Use the plural `rebase-merges`, which matches the stale sentences (`ci.yml:6`, `commit-lint.mjs:2`, `AGENTS.md:38`, ADR-008 lines 12 and 52) and not the git directory name.
- **Decision**: APPLIED — Phase 4, Automated Verification, second bullet (grep pattern and a note that `isolation.mjs:160` stays).

### F2 — New workflow runs branch code on the self-hosted runner without the ADR-020 uid guard

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Phase 2 — The workflow (Contract) and Workflow tests
- **Detail**: ADR-020 Amendment 1 puts `Refuse to run as root (ADR-020)` first in job `test` "before checkout and before any model-written code runs", so a root runner fails closed. The planned `pr-title.yml` job uses the same TrueNAS `runs-on`, checks out the PR branch and runs `tools/commit-lint.mjs` from it, but has no guard. The runner's persistence risk (ADR-020, same-repository run branches run code with no approval step) applies to it equally. `ci.yml`'s `commits` job also lacks the guard, but a new job should not copy that gap, and the plan's `ci-runner` extension pins only the `runs-on` line.
- **Fix**: Make the guard the first step of the `pr-title.yml` job (same command as `ci.yml`), and add a `ci-runner` test that it is first, before the lint step.
- **Decision**: APPLIED — Phase 2, The workflow Contract (Steps) and Workflow tests Contract (`ci-runner.test.mjs` second test).

### F3 — `countAhead` returns only a count, so the ref cannot be reused as the plan says

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3 — Title derivation (Intent)
- **Detail**: The plan says to reuse the ref that `countAhead` resolves for `git log --format=%s`. `countAhead` (`open-pr.mjs:211-217`) returns `{ count }` only, and `openPullRequest(opts, branch, base, repo)` has no ref. The implementer must change a return shape and a call chain the plan does not name.
- **Fix**: State that `countAhead` also returns `ref` and that `main` passes it to `openPullRequest`.
- **Decision**: APPLIED — Phase 3, Title derivation Intent.
