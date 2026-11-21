<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Step guard bypass forms

- **Plan**: context/changes/step-guard-bypass-forms/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-11-21
- **Verdict**: REJECTED
- **Findings**: 1 critical, 0 warnings, 1 observation

Verdict and counts are as measured on the code at `97f6db31`, before the fixes of this review. This is the second full review. The first (at `c4b1d34d`, phases 1-3, REJECTED with F1-F3) is in the history of this file at `0a44b7dc`; its F1 and F2 landed in `ecb46f8f`, and its F3 became Phase 4 (`83a9c242`).

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | FAIL |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

Notes:
- Plan Adherence: Phase 4 items 1-5 are present. Item 1 (value options scoped to the subcommand) and item 2 (bare `-` after `env`) match the code in `gitOptions` and the `env` wrapper spec. Their allow tests (`git tag -a v1 --mess x`, `git tag --fi notes v1`, `env - git status`) are in the `abbreviations` and `wrappers` tests. Item 3 is in `commands()` and `shellWord`, item 4 is the test `command shapes: ANSI-C and locale quoting` with every listed pair, and item 5 is in `docs/REFERENCE.md` and the test index. Phases 1-3 were re-probed with about 30 extra commands through the hook CLI (wrappers with value options, `select`/`case`/`until`, `[[ ]]`, `git clean -fdn`, `git -C sub -c x=y push`, `env --chdir=/x git push`). All matched the plan.
- Success Criteria: on the pre-fix code every automated row passes. `step-guard.test.mjs` has 34 tests and 34 pass. The `abbreviat`, `wrappers`, `ANSI-C`, `no execution`, `nesting` and `search patterns` patterns pass 1/1 each. `grep -c ANSI-C docs/REFERENCE.md` = 1, `grep -c "not decoded"` = 1, `grep -c xargs` = 1, `grep -c "wrappers and helper internals"` = 0, and `version-check` is OK at 1.15.0. Manual row 3.4 (the live `agent-smith:step` check) is still `[ ]`. It needs a human with the plugin installed, and plan Manual Testing step 3 asks for it after Phase 4. Rows 1.4, 2.4 and 3.5 cite `evidence/judgment-review.md`. That evidence predates Phase 4, and plan step 3 asks for the `docs/REFERENCE.md` guard paragraphs to be read again after Phase 4. This review read the Phase 4 doc lines against the tests, and they match.

## Findings

### F1 — `$$` before a quote is read as ANSI-C quoting, which hides a command

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: skills/10x-pipeline/scripts/step-guard.mjs:430 (`commands`), :118 (`shellWord`)
- **Detail**: Phase 4 opens an ANSI-C quote at any unquoted `$` followed by `'`. Bash reads `$$` as the process-ID parameter first, so in `$$'...'` the quote after it is an ordinary single quote, and a backslash inside it does not escape. The scanner instead reads the second `$` as the start of `$'...'`, so `\'` no longer ends the string and quote tracking shifts. Probed through the hook CLI on `97f6db31`: `echo $$'\' ; git push #'` is **allowed**, while `bash -c "echo \$\$'\\' ; echo RAN #'"` prints the PID followed by `\` and then `RAN`, which means Bash runs the second command. The same probe on `ecb46f8f` (before Phase 4) denies it, so this is a regression Phase 4 introduced. The mirror case `echo $$'\'` fails closed with "Unterminated shell quote" (a false denial). The plan contract says to read `$'...'` "the way Bash does".
- **Fix**: In `commands()` and `shellWord`, consume an unquoted `$$` as one token before the `$'`/`$"` check, so the quote after it opens as an ordinary quote. Add `echo $$'\' ; git push #'` as a deny test and `echo $$'\'` as an allow test in `command shapes: ANSI-C and locale quoting`.
- **Decision**: APPLIED in commit 41151780. `echo $$'\' ; git push #'`, `x=$$'\' ; git push #'` and `echo $$$'\'' ; git push #'` are denied. `echo $$'\'`, `echo "$(echo $$'\')"` and `echo $$$'it\'s'` pass. `$$(git push)` stays denied.

### F2 — Unreachable `$'`/`$"` clause left in `shellWord`

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: skills/10x-pipeline/scripts/step-guard.mjs:135 (`shellWord`)
- **Detail**: Before Phase 4, the `literal = false` rule for an unquoted `$` read `parameterStart.test(marker) || !quote && (marker === "'" || marker === '"')`. Phase 4 added an earlier branch that handles every unquoted `$'` and `$"` and sets `literal = false` itself, so the second half of that condition can no longer be true. It is dead code that suggests a path the lexer no longer takes.
- **Fix**: Reduce the condition to `parameterStart.test(marker)`.
- **Decision**: APPLIED in commit 41151780.
