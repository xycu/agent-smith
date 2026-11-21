<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Step guard bypass forms

- **Plan**: context/changes/step-guard-bypass-forms/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-11-21
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 3 observations

Verdict and counts are as measured on the code at `5d09472c` (guard code as of `41151780`), before the fix of this review. This is the third full review. The second (at `97f6db31`, REJECTED, F1 CRITICAL `$$'...'` read as ANSI-C quoting, F2 dead clause) is in the history of this file at `4f073fc6`; both landed in `41151780`. The first (at `c4b1d34d`) is at `0a44b7dc`.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

Notes:
- Plan Adherence: Phases 1-4 match the plan. The `$$` rule from the second review is in `commands()` (`step-guard.mjs:432`) and `shellWord` (`:119`); the dead `$'`/`$"` clause is gone (`:137`). About 60 extra commands were probed through the hook CLI with `evidence/script-guard-probe.mjs`: ANSI-C edge cases (`$'\\'`, `$'\\\''`, `$\<newline>'...'`, `$$$$'\'`, `${x:-'}'}`, `a$'b'c`, `$"$(git push)"`), every wrapper with `--`, Git global-option abbreviations and attached `-c` (Git 2.54.0 rejects both, so they are not bypasses), `-c CORE.HOOKSPATH`, `git commit -mn` (allowed, message `n`) and `git commit -nm x` (denied). Every result matched Bash and the plan.
- Scope Discipline: no unplanned files. `sudo -k` is treated as a flag that still runs the command, which is right (the plan text listed `-k` among the options that run nothing; the code is stricter).
- Success Criteria: all automated rows pass on the pre-fix code. `step-guard.test.mjs` 34/34. The `no execution`, `nesting`, `search patterns`, `abbreviat`, `wrappers` and `ANSI-C` patterns pass 1/1 each. `grep -c xargs` = 1, `grep -c "wrappers and helper internals"` = 0, `grep -c ANSI-C` = 1 and `grep -c "not decoded"` = 1 in `docs/REFERENCE.md`. `version-check` is OK at 1.15.0. The full suite passes. Manual row 3.4 (live `agent-smith:step` check) is still `[ ]` and needs a human with the plugin installed; plan Manual Testing step 3 asks for it after Phase 4.

## Findings

### F1 — The `shellWord` half of the `$$` fix has no test

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: skills/10x-pipeline/scripts/step-guard.mjs:119, skills/10x-pipeline/test/step-guard.test.mjs:369
- **Detail**: `41151780` added the `$$` rule to both `commands()` and `shellWord`. The tests it added (`echo $$'\' ; git push #'`, `echo $$'\'`) reach only `commands()`, because `shellWord` runs only inside a substitution or a command with a heredoc. Deleting line 119 in a scratch copy kept all 34 guard tests green, while `echo "$(echo $$'\')"` and a heredoc command followed by `echo $$'\'` then failed closed with "Unterminated shell quote". The lexers can drift apart again without a test noticing.
- **Fix**: Add `echo "$(echo $$'\')"` and `cat > out.txt <<'EOF'\nx\nEOF\necho $$'\'` to the allow list of `command shapes: ANSI-C and locale quoting`.
- **Decision**: APPLIED in commit 526340a5. With line 119 deleted in a scratch copy the ANSI-C test now fails (0/1); on the real guard it passes (1/1). After the fix, the guard tests pass 34/34, every plan pattern passes, `version-check` is OK and the full suite passes 2123 with 3 skipped and 0 failures.

### F2 — Command names built by expansion or letter case pass

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: skills/10x-pipeline/scripts/step-guard.mjs:562 (`commandProblem`), :536 (`gitProblem`)
- **Detail**: The guard compares the executable and the Git subcommand as literal words. Three forms pass the hook CLI while Bash runs the forbidden command: brace expansion (`git pu{s,}h` runs `git push puh`, `{git,push}` runs `git push`), globbing (`/usr/bin/gi? push`), and letter case on a case-insensitive filesystem (`GIT push`; `GIT --version` runs Git on this macOS host). `git PUSH` is not a bypass (Git refuses it). These forms predate this change and are not in `change.md` or the plan. `docs/REFERENCE.md:71` covers them only loosely as "unrecognized syntax or executables".
- **Fix A ⭐ Recommended**: Name brace expansion, globbing and case-insensitive executable lookup in the out-of-scope list of `docs/REFERENCE.md:71`.
  - Strength: Keeps the guard a literal-word scanner, as the plan and the file's own `shortcut:` comment say.
  - Tradeoff: The bypass stays; it is not a form an AI step writes by habit.
  - Confidence: MED — matches the documented scope rule for dynamic construction.
  - Blind spot: How often a model writes `GIT` or a brace form in practice is unmeasured.
- **Fix B**: Compare executable basenames case-insensitively and deny an unquoted `{`, `*`, `?` or `[` in the executable or Git subcommand word.
  - Strength: Closes the three forms with a few lines.
  - Tradeoff: New denials need allow tests and a scope decision; an unquoted glob in a command name also has rare legitimate uses.
  - Confidence: MED — straightforward, but outside this plan.
  - Blind spot: Other places that compare names (`publicationScript`, wrappers) would need the same rule.
- **Decision**: PENDING — outside the plan's scope (not listed in change.md or the plan). The owner decides whether to document these forms as out of scope or deny them in a follow-up change.

### F3 — Git forms that drop unreachable commits or move a branch are not denied

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: skills/10x-pipeline/scripts/step-guard.mjs:544-556 (`gitProblem`)
- **Detail**: Phase 2 denies discarding flags by verb, but these pass the hook CLI: `git fetch . +HEAD~3:main` (forced refspec, moves `main` back like `branch -f`), `git reflog expire --expire=now --all`, `git gc --prune=now` and `git prune` (delete commits reachable from nowhere else, which the always-true rules forbid). None is in `change.md` or the plan's deny list, and the docs do not name them as out of scope.
- **Fix A ⭐ Recommended**: Open a follow-up change that decides the deny list for ref-moving fetch refspecs and reflog/gc/prune pruning, with allow tests for `git fetch`, `git gc` and `git reflog`.
  - Strength: Keeps this change's scope; the follow-up can weigh the `update-ref` rule (ref writes stay allowed).
  - Tradeoff: The gap stays open until then.
  - Confidence: MED — same pattern as the Phase 2 verbs.
  - Blind spot: Other ref writers (`symbolic-ref`, `replace`, `notes`) were not audited.
- **Fix B**: Name these forms as out of scope in `docs/REFERENCE.md:71`.
  - Strength: Cheap and honest.
  - Tradeoff: Leaves a destructive form open with no runtime check.
  - Confidence: HIGH — doc-only.
  - Blind spot: None significant.
- **Decision**: PENDING — outside the plan's scope (the plan lists the verbs it denies). The owner decides whether to deny these forms in a follow-up change or document them as out of scope.
