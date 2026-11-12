<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Array-form archive prompt and suffix override Implementation Plan

- **Plan**: context/changes/array-prompt-override/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1
- **Date**: 2026-11-11
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 1 observations

Reviewed in this subagent, no sub-agent launched. Diff range `main...HEAD`: `isolation.mjs`, `route.mjs`, `archive.test.mjs`, `route.test.mjs` (plus run state under the change folder). Every file is named in the plan; no planned file is missing.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Success criteria

- 1.1, 1.2: the new archive and route tests pass.
- 1.3: full suite `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` passes: 991 tests, 989 pass, 0 fail, 2 skipped.
- 1.4: `grep -rn "policy\.prompts\.\(archive\|suffix\)" skills/10x-pipeline/scripts` prints nothing.
- 1.5: evidence file `evidence/script-array-suffix-output.txt` is on the branch; not re-run.

## Findings

### F1 — A string `archive` or `suffix` that starts with `@prompts/` now resolves as a file

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: skills/10x-pipeline/scripts/isolation.mjs:680-681, skills/10x-pipeline/scripts/route.mjs:180
- **Detail**: `promptText` treats any part starting with `@prompts/` as a file reference. A plain-string override of `suffix` or `archive` that starts so was text before and is a reference now; a bad one is caught by `checkPrompts` at `next`. This is the documented prompt form and the same as every other template, and the plan review recorded it (its F2). The shipped defaults do not start with the prefix, so their prompts are byte-identical.
- **Fix**: None needed.
- **Decision**: APPLIED - 473bcf0 — the behaviour is intended (the same rule as every other template) and stays; `docs/REFERENCE.md` and `prompts/README.md` now state it, and tests pin the string form, the literal form and the halt before the pre-archive commit.
