<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Share one fallback for the churn exclude globs

- **Plan**: context/changes/shared-churn-excludes/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1
- **Date**: 2026-11-13
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 0 observations

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

- `state.mjs` exports `churnExcludes(policy)` (override array, else shipped list, else `[]`, strings only, `globToRegex`); `churnConfig` returns `{ ...c, exclude: churnExcludes(policy) }` after its unchanged key checks. MATCH.
- `steps.mjs`: `evidenceExcludes` removed; `commitEvidence` calls `churnExcludes(policy)`; imports `SKILL_DIR`, `readJson`, `churnConfig` dropped; `globToRegex` kept (line 149 still uses it). MATCH.
- Test `commit evidence honours a custom exclude when another churn key is invalid` added after `strict verify git edge cases`, with the excluded-only commit (not evidence) and the real-path commit (evidence) halves, `{ skip: noGit }`. MATCH.
- No change to `policy.json`, docs, `churnConfig` null rules; no new file or dependency. Import order holds (steps.mjs imports from state.mjs).
- Net script change is 3 fewer lines (plan said about 5); the fallback is single, so the manual criterion holds.
- No `evidenceExcludes` reference remains in skills, docs or tools.
- Automated criteria re-run: `executors`, `churn` and `no-recursive-delete` tests pass (79 pass, 0 fail); grep check `! grep -n "policy.json\|readJson\|SKILL_DIR" steps.mjs` passes; full suite passes (1150 tests, 1147 pass, 0 fail, 3 skipped).
- Manual row 1.6 has evidence in `evidence/judgment-diff-one-fallback.md`.

## Findings

None.
