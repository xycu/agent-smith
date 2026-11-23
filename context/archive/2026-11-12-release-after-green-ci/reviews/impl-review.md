<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Release only from a main commit whose CI run passed

- **Plan**: context/changes/release-after-green-ci/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2
- **Date**: 2026-11-12
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 1 observation

Phase 3 (live check after merge) has no code changes and is not fully ticked: rows 3.1, 3.2, 3.3 and 3.7 are checked, and their evidence matches `gh run list` (CI runs 43183448157 and 43183485936 both `success`; Release run 43183971597 `skipped` for the stale CI run of 5f033ba, Release run 43184000512 `success`). Rows 3.4, 3.5 and 3.6 are pending owner checks. The latest Release run, 43236144410 (head edfc947, after a green CI run), failed. The cause was a GitHub 5xx page (`release-please failed: <!DOCTYPE html> ... Unicorn!`), a transient API outage that this change did not cause.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

Success criteria run on the reviewed code:

- `node --test tools/test/release-gate.test.mjs tools/test/ci-runner.test.mjs tools/test/workflow-pins.test.mjs`: 16 pass, 0 fail.
- `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`: 1116 tests, 1113 pass, 0 fail, 3 skipped.
- `node tools/version-check.mjs`: `version-check: OK (1.6.1)`.
- `actionlint .github/workflows/ci.yml .github/workflows/release.yml`: clean (exit 0).
- `git diff --stat 00a990b~1 00a990b -- docs/ADR/ADR-008-release-packaging-and-semver.md`: 32 insertions, 1 deletion (the Status line).

Plan vs diff: `tools/test/release-gate.test.mjs`, `.github/workflows/ci.yml` and `.github/workflows/release.yml` (be497dd), and `AGENTS.md` and ADR-008 (00a990b) all match their Contracts. No `uses:` line changed. `release.yml` stays on `ubuntu-latest`. The other files in `main..` history come from the merge of `main` (74900cc) and are not part of this change.

## Findings

### F1 — Head check uses the SHA fixed at run creation; release-please reads main later

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: .github/workflows/release.yml:11-13, docs/ADR/ADR-008-release-packaging-and-semver.md (Amendment 1, Consequences)
- **Detail**: For a `workflow_run` event, `github.sha` is the head of `main` at the moment the run is created. `release-please-action` reads `main` through the API when its step runs. The job-level `release-please` concurrency group can make the job wait behind a running release job. A push that lands between run creation and the release-please API read passes `head_sha == github.sha` but is read untested. The header comment says the check "keeps a green run of commit A from releasing commit B", and that overstates the guard. In practice the window is seconds to about a minute. It only leads to a tag if the release PR is merged inside that window. The plan already accepts the same kind of gap (the tag sits on the release-PR merge commit) and documents it.
- **Fix**: State the window in the `release.yml` header comment and as a bullet in ADR-008 Amendment 1 Consequences, next to the gap the plan already accepts.
- **Decision**: APPLIED in ae333e3. The window is now stated in the `release.yml` header comment and as a Consequences bullet of ADR-008 Amendment 1. After the fix: tools tests and actionlint are clean, version-check reports OK, and the full suite has 1113 pass, 0 fail, 3 skipped.
