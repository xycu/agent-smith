<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Step guard bypass forms

- **Plan**: context/changes/step-guard-bypass-forms/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-11-21
- **Verdict**: REJECTED
- **Findings**: 1 critical, 1 warning, 1 observation

Verdict and counts are as measured on the code at `c4b1d34d`, before the fixes of this review.

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
- Plan Adherence: every planned item is present (scanner separators, substitutions, glued redirects, `resolve` with the wrapper table, `find -exec`, the nesting cap, prefix-aware long options, scoped `--no-verify`, global value options, `core.hooksPath`, the discarding verbs, `send-pack`/`http-push`, docs, test index, and all named deny/allow tests including the headless and recording-executable additions). One small deviation: the `sudo` "run nothing" list leaves out `-k`. That is the safer reading, because `sudo -k cmd` runs `cmd`.
- Success Criteria: all automated rows pass on the pre-fix code (`step-guard.test.mjs` 33/33; the `no execution`, `nesting`, `search patterns` and `abbreviat` patterns 1/1 each; `grep -c xargs docs/REFERENCE.md` = 1; `grep -c "wrappers and helper internals"` = 0; `version-check` OK at 1.15.0). Manual row 3.4 (live `agent-smith:step` check) is still `[ ]` and needs a human with the plugin installed. Rows 1.4, 2.4 and 3.5 cite `evidence/judgment-review.md`, which the probes in this review agree with apart from F1 and F2.

## Findings

### F1 — Value-option prefix match hides denied abbreviations

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: skills/10x-pipeline/scripts/step-guard.mjs:475-481 (`gitOptions`)
- **Detail**: Phase 2 item 1 told `gitOptions` to prefix-match the generic value options `--message`, `--file`, `--author` and `--date` for every subcommand. A short abbreviation of a denied option that is also a prefix of one of those names gets read as a value option: the word is not recorded as a flag, and the word after it is skipped. Probed through the hook CLI, these were allowed: `git branch --d old`, `git tag --d v1`, `git rm --f src` and `git checkout-index --f -a`. On Git 2.54.0 in a scratch repository, `git branch --d old2` deleted the branch, `git tag --d v3` deleted the tag, `git rm --f f` removed a modified file, and `git checkout-index --f g` threw away a working change. Git has no `--date` or `--file` option for those subcommands, so `--d` and `--f` are their unique abbreviations of `--delete` and `--force`. `docs/REFERENCE.md` says denied long options match any non-empty prefix, which was false for these four forms. Side effect: `git clean --d` (Git's unique abbreviation of `--dry-run`) was denied by mistake.
- **Fix**: Prefix-match only the value options the subcommand really has (commit: its full list; tag: `--message`, `--file`; clean: `--exclude`). The generic four stay exact matches for the other subcommands, as before this change. Add the four forms as deny tests and `git clean --d` as an allow test.
- **Decision**: APPLIED in commit ecb46f8f. The four forms are denied, `git clean --d` passes, and `git tag -a v1 --mess 'x'`, `git tag --fi notes v1` and `git commit --mess x -m y` still pass.

### F2 — Bare `-` after `env` hides the command

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: skills/10x-pipeline/scripts/step-guard.mjs:578 (`unwrap`)
- **Detail**: `unwrap` stops at a bare `-`, so `env - git push` resolves to the executable `-` and is allowed. For `env`, a bare `-` is the short form of `-i`, and `env - /usr/bin/true` runs on this host, so `env - git push` runs the push. Plan Phase 1 item 2 says `env` skips its flags before the command.
- **Fix**: Give the `env` wrapper spec `dash: true`, skip a bare `-` when that is set, and add `env - git push` to the wrappers deny test.
- **Decision**: APPLIED in commit ecb46f8f. `env - git push` is denied and `env - git status` passes.

### F3 — ANSI-C and locale quoting of the command name pass

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: skills/10x-pipeline/scripts/step-guard.mjs (`commands`, the `$` character before a quote)
- **Detail**: `$'git' push` and `$"git" push` are allowed. The scanner keeps the `$` as part of the word, so the executable reads as `$git`, while Bash runs `git push`. This gap existed before this change. Neither the plan nor `change.md` lists it, and `docs/REFERENCE.md` does not name it as out of scope.
- **Fix**: Either drop a `$` that comes right before an unquoted `'` or `"` in `commands()` and add a deny/allow pair, or list `$'...'` and `$"..."` quoting as out of scope in `docs/REFERENCE.md`.
  - Strength: The first option is a one-line scanner change; the second keeps the documented scope accurate.
  - Tradeoff: The first widens the plan's scope; the second leaves a literal obfuscation form open.
  - Confidence: MED — no step writes this form by habit; it is a deliberate obfuscation.
  - Blind spot: Other Bash quoting forms (for example `$"..."` with translation catalogs) were not checked.
- **Decision**: PENDING. It lies outside the plan's scope (a form that existed before this change and is not on the change.md list). The owner decides whether the guard should cover `$'...'`/`$"..."` command names or whether the reference should list them as out of scope.
