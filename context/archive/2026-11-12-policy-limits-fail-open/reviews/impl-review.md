<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Validate policy limits, ladder and tiers at load

- **Plan**: context/changes/policy-limits-fail-open/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-11-12
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Summary

- `policyProblems` (`state.mjs:118`) matches the plan's contract: block shapes, `limits.*` (incl. `maxNeutralRetries`), `escalation.maxAttemptsPerStep`, `rigor.budgetDelta.<level>`, ladder rungs, step tiers in `0..ladder.length-1` with `minTier <= maxTier`, lenient `baseTier`. First problem wins, never throws.
- Wiring (`route.mjs:840-844`) runs before `resolveChain` and `acquireRunLock` for `init`, `next`, `usage`; `status` adds `policyProblem` only when there is one.
- `PROMPT_PLACEHOLDERS` (`steps.mjs:672`) holds the 16 `vars` keys of `route.mjs` plus `workdir`; `promptProblem` (`flow.mjs:790`) skips unresolvable templates so `checkPrompts` keeps its text.
- `maxNeutralRetries` is a plain read; its only caller is `neutralRetry` (`flow.mjs:327`), which runs after the load check.
- Docs: REFERENCE "Policy validation" group, `prompts/README.md` placeholder list, AGENTS.md entries, ADR-022 in ADR-021's layout, ADR-015 Amendment 1.
- Automated criteria: full suite 1093 tests, 1090 pass, 3 skipped, 0 fail (before fixes); `policy-validate`, `neutral`, `no-recursive-delete` 49/49 pass. Manual rows 1.6, 1.7, 2.5, 3.3 carry evidence files whose output matches the code.

## Findings

### F1 — Unplanned edits to two existing tests; archive test title went stale

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: skills/10x-pipeline/test/archive.test.mjs:1047, skills/10x-pipeline/test/ladder.test.mjs:350
- **Detail**: The plan names only `policy-validate.test.mjs` and `neutral.test.mjs` as test edits. Two more were changed because the load check now rejects their fixtures: `ladder.test.mjs` caps `implement`, `fix`, `os-propose`, `os-apply` at `maxTier: 6` for the 7-rung `OLD_LADDER` (benign), and `archive.test.mjs` now asserts the load halt `policy.steps.plan.baseTier must be an integer from 0 to 2` with `committed: undefined`. The archive test kept its title "too short for the pinned archive tier halts before git add", but it no longer reaches the archive precheck. The precheck `policy.ladder has no entry for tier ...` (`isolation.mjs:643-646`) is now unreachable from any policy that passes the load check and has no test. Both edits are needed and correct; the plan did not list them.
- **Fix**: Rename the archive test to say what it checks (the load halt before git add); keep the defensive precheck.
- **Decision**: APPLIED — test renamed to "a custom ladder too short for the step tiers halts at load before git add" in commit 7fc7673.

### F2 — REFERENCE override paragraph still says values are not checked

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: docs/REFERENCE.md:224
- **Detail**: "The values of the keys inside it are not checked there." sits above the new "Policy validation" group with no pointer, so a reader of the override paragraph alone learns that no value is checked. The manual-verify judgment (evidence/judgment-docs-consistency.md) saw the same line and called it no contradiction.
- **Fix**: Add a pointer to "Policy validation" for the keys `init`, `next` and `usage` check.
- **Decision**: APPLIED — pointer added in commit 7fc7673.

### F3 — Placeholder set is global, not per template

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: skills/10x-pipeline/scripts/flow.mjs:790
- **Detail**: `promptProblem` accepts any of the 17 names in every template, but some templates are rendered with a subset: `archive`, `os-archive` and `frame-authority` get only `{id}` (`isolation.mjs:154`, `:676`), `worktree` only `{workdir}` (`isolation.mjs:290`), and `suffix` is appended without `render` (`route.mjs:195`). A known name in those templates still renders empty or stays literal with no halt. The plan chose one list of 17 names, so this is within plan; the residual gap is narrow.
- **Fix**: Map each specially rendered template to its own allowed set (`archive`/`os-archive`/`frame-authority`: `id`; `worktree`: `workdir`; `suffix`: none) and check against it.
  - Strength: closes the last silent-empty path for project templates.
  - Tradeoff: a second list to keep in step with the render sites in `isolation.mjs`.
  - Confidence: MED — render sites found by grep; no test covers per-template sets yet.
  - Blind spot: whether the owner wants the extra list at all.
- **Decision**: APPLIED in the Wave 1 findings branch (`fix/wave1-open-findings`) — `NARROW_PLACEHOLDERS` in `steps.mjs` lists `archive`, `os-archive`, `frame-authority` (`id`), `worktree` (`workdir`) and `suffix` (none); `promptProblem` checks those templates against their own set. Tests in `policy-validate.test.mjs` cover the per-template sets and an `init` halt; ADR-022 Amendment 1 and `docs/REFERENCE.md` describe it.
