<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Refuse to run a change on another change's run branch

- **Plan**: context/changes/run-branch-must-match-change-id/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2
- **Date**: 2026-11-21
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Evidence

- Changed files match the plan: `run-identity.mjs`, `prepare-run.mjs`, the three test files, `docs/REFERENCE.md`, ADR-010. No extra source files; `open-pr.mjs`, `route.mjs` and `isolation.mjs` untouched, as planned.
- Guard: `validateRunBranch(..., saved = false)`; strict tier accepts `<prefix><id>` and `<prefix><id>-baseline`, saved tier accepts `startsWith(<prefix><id>)`; prefix error stays first; `error.otherChange` marker skips the "Restore isolation.branchPrefix" suffix in `validateRunIdentity`. Matches the plan contract.
- `prepare-run.mjs`: `savedBranch` is true for `invocation` or the single saved-candidate fallback; the call at the old line 201 runs before the setup lock, so a refusal writes nothing.
- Callers checked: `runBranch` (exact name, passes), `isolationCheck` (unsaved strict, saved through `validateRunIdentity`), `open-pr.mjs` (via `validateRunIdentity`/`runBranch`).
- Tests: the two defect-encoding assertions replaced; new cases cover other-change, `demo`/`demo-extra` prefix pair, `-baseline`, `-baselines`, `-baseline-2`, saved identity on another change's branch. The two fixtures moved to `codex/demo-other` as planned.
- Automated criteria: full suite 2115 tests, 2112 pass, 0 fail, 3 skipped (run on the code before the doc fixes); after the fixes the doc-reading tests (advisor, ladder, nested-subagents, skill-loop, agents-md-*) pass again. `grep "does not start with" docs/REFERENCE.md | grep -v "another change"` prints nothing. `node tools/version-check.mjs` exits 0.
- Manual criteria: none in the plan.

## Findings

### F1 — Init halt list lost its "or" and reads as a run-on list

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: docs/REFERENCE.md:141
- **Detail**: The edit replaced "... points to) or on a branch that does not start with ..." by "... points to) on a branch that does not start with ... or is the run branch of another change". The list "has a detached HEAD, is on a default branch (...) on a branch that ..." has no joiner between the default-branch and prefix cases, and "or is the run branch" breaks the "is on"/"on" parallelism.
- **Fix**: Restore the comma and write "or on the run branch of another change".
- **Decision**: APPLIED in commit c541ea2f (docs/REFERENCE.md:141).

### F2 — Setup bullet still says any linked run under the prefix keeps its branch

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: docs/REFERENCE.md:146
- **Detail**: "Setup inside a linked run under the effective prefix preserves its actual branch." is the prefix-only wording the plan told the implementer to fix "if it still reads as prefix-only" (and `lessons.md` says to grep every doc for the old behavior). Setup inside another change's run now refuses, so the sentence is wrong as written.
- **Fix**: Say "inside a linked run of the same change ... preserves its actual branch; inside the run of another change it refuses."
- **Decision**: APPLIED in commit c541ea2f (docs/REFERENCE.md:146).
