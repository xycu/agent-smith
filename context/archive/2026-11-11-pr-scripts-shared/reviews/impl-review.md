<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Shared helpers for open-pr.mjs and pr-comment.mjs

- **Plan**: context/changes/pr-scripts-shared/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-11-11
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 1 warning, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | FAIL |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

Evidence gathered on the code at `12e6518` (code commit `a6ffff9`):

- Changed files match the plan: `pr-common.mjs` and `pr-common.test.mjs` (new), `open-pr.mjs`, `pr-comment.mjs`, `pr-comment.test.mjs`, `AGENTS.md`, `docs/REFERENCE.md`. No file outside the plan changed.
- Every extracted helper (`firstLine`, `spawn`, `runGh`, `ghFailure`, `checkReportArg`, `withTempDir`, `isEntryPoint`, the constants) matches its original line for line; `open-pr.mjs` keeps the exports `open-pr.test.mjs` imports; `pr-comment.mjs` keeps `COMMENT_JQ`, its marker and the single `c.login === viewer` text.
- The cleanup drift is fixed: `withTempDir` swallows a `removeTree` error, and `pr-common.test.mjs` pins it with the `process.chdir` case.
- Automated criteria: full suite, the three script test files, the Phase 2 `grep -cE` (prints `:0` for both files, exit 1), `node tools/version-check.mjs` and both scripts with `--bogus` (usage text, exit 2) all pass.
- The two scripts together lost 116 lines; `pr-common.mjs` adds 94.

## Findings

### F1 — The zero-width space is still the invisible character, now in the shared module

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: skills/10x-pipeline/scripts/pr-common.mjs:65; skills/10x-pipeline/test/pr-common.test.mjs:19-22
- **Detail**: The plan names this as one of the two drifts to fix: "The zero-width space is written once, as the escape `​` (never the invisible character), and a unit test pins it." `capBody` was extracted from `open-pr.mjs`, so `pr-common.mjs:65` holds the literal U+200B (`grep $'\xe2\x80\x8b'` hits it), and `pr-comment.mjs`'s escape form was dropped. The unit tests also hold the literal character, so they pass with either form and pin nothing about how the source is written. Output bytes are unchanged; the defect is that the invisible character stays in the source, where an editor or a copy can strip it unseen.
- **Fix**: Write `"$1@​"` in `capBody`, use `​` in the tests, and add a test that reads `pr-common.mjs` and asserts it holds no U+200B character.
- **Decision**: APPLIED - 4181d87 (escape in `capBody` and the tests; new test checks `pr-common.mjs`, `open-pr.mjs` and `pr-comment.mjs` hold no literal U+200B and fails on the old source; full suite 994 pass, 0 fail)

### F2 — Progress row 2.3 names an older grep than the Phase 2 criterion

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/changes/pr-scripts-shared/plan.md (Progress 2.3)
- **Detail**: The Phase 2 block was sharpened to `grep -cE "function (firstLine|spawn|runGh|ghFailure|isEntryPoint)|(MENTION_RE|BODY_CAP|ID_RE|DEFAULT_TIMEOUT_MS|GH_HOST) ="`, while Progress 2.3 still names the older `grep -c "function firstLine\|MENTION_RE =\|BODY_CAP ="`. Both pass on the current code (`:0` for both files), so nothing is wrong in the code.
- **Fix**: None in code; the Progress title stays as written because step titles are not renamed.
- **Decision**: APPLIED - bd5b22e (Progress row 2.3 now names the Phase 2 `grep -cE` and its pass rule, tick kept; the command from the row prints `:0` for both files, exit 1)
