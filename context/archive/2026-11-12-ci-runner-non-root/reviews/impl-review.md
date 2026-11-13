<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Run the CI jobs as a non-root user (ADR-020 D4)

- **Plan**: context/changes/ci-runner-non-root/plan.md
- **Scope**: Full plan (Phase 1 reviewed; Phase 2 is owner-only Manual rows, all open)
- **Reviewed phases**: 1
- **Date**: 2026-11-12
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Evidence

- Drift check against the plan, file by file: `.github/workflows/ci.yml` (guard step first in `test`, before checkout, exact command from the contract, one header comment line, no `uses:` added), `tools/test/ci-runner.test.mjs` (two tests as specified, `win32` skip on (b), header comment updated, no file written), `docs/ADR/ADR-020-...md` (D4 line, Assumptions bullet, Status suffix, Amendment 1 with finding/decision/owner action/not-claimed), `AGENTS.md` (one clause). All MATCH. No EXTRA files outside `context/changes/ci-runner-non-root/`.
- "What We're NOT Doing" respected: no `commits` guard, no edit of `no-recursive-delete.test.mjs`, no edit of the `ci-self-hosted-truenas` plan, `release.yml` and `runs-on` untouched.
- Automated criteria run as uid 501: `node --test tools/test/ci-runner.test.mjs` 4/4 pass; `node --test tools/test/workflow-pins.test.mjs` 7/7 pass; ADR-020 and AGENTS.md greps pass; `node tools/version-check.mjs` OK (1.6.1); `actionlint .github/workflows/ci.yml` exit 0. The plan's literal `grep -q 'test "$(id -u)" -ne 0'` matches with `grep -F` or an escaped `\$`, but not with the ugrep BRE of this sandbox shell (which reads `$(` as a special form); on the GNU grep of the Linux runner it is a literal match. The step itself is present (`grep -cF` = 1).
- Full suite: see the RESULT note of this run.
- Manual: row 1.9 has evidence (`evidence/judgment-ci-diff-review.md`) and the quoted diff matches the real diff. Rows 2.1 to 2.5 are open and listed in `evidence/unproven.md`; they need the owner's hosts and a CI run, so leaving them unticked is correct.

## Findings

### F1 — Guard is detective for the runner, not preventive for the `commits` job

- **Severity**: OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: .github/workflows/ci.yml:37-52
- **Detail**: Job `commits` has no uid step, checks out the pull request branch and runs `node tools/commit-lint.mjs` from that branch on the same runner. On a root runner, `test` goes red at the guard, but `commits` still runs branch code as uid 0. The plan states this choice ("both jobs use the same runner user, so a runner that fails `test` is fixed for both"), so it is not drift. The guard makes the misconfiguration visible; it does not stop branch code from running as root in `commits`.
- **Fix**: Optional follow-up change: add the same first step to `commits` and extend the test to both jobs. Outside this plan's scope.
- **Decision**: PENDING — outside the plan's scope (it excludes a `commits` guard); the owner decides whether the red `test` job is enough or `commits` needs its own guard.

### F2 — Commit type `feat` on a CI-only change

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: commit d18d38a `feat(ci-runner-non-root): fail the test job when the runner runs as root`
- **Detail**: The change touches a workflow, a test, an ADR and AGENTS.md; nothing the plugin ships. Per AGENTS.md (Commits) the owner rebase-merges and subjects land on `main`, so a `feat` subject makes release-please open a minor release PR for a CI guard (`ci:` is a hidden section and would open none). See also the memory note on run-branch release types.
- **Fix**: Retitle to `ci(ci-runner-non-root): ...` when the owner rebases the branch for the merge.
- **Decision**: PENDING — rewriting the commit would rewrite history that may already be pushed, which the repository rules forbid; the owner decides the subject at rebase-merge time.

### F3 — ADR-020 Status line still says no run has used the runners

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: docs/ADR/ADR-020-ci-on-self-hosted-truenas-runners.md:3
- **Detail**: Status reads "... no run has used the runners yet); amended (Amendment 1)", while Amendment 1 cites CI run 43134692634 on `truenas-agent-smith-1`. The plan required adding "; amended (Amendment 1)" without changing the existing text, so the implementation is faithful; the two statements now disagree.
- **Fix**: In a later ADR edit, replace "no run has used the runners yet" with a pointer to run 43134692634.
- **Decision**: PENDING — the plan forbids changing the existing Status text; the owner decides whether to correct it.
