<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Keep short run prefixes from hiding PR bases

- **Plan**: context/changes/open-pr-base-prefix-collision/plan.md
- **Scope**: Full plan (Phase 1 of 1)
- **Reviewed phases**: 1
- **Date**: 2026-11-21
- **Verdict**: APPROVED
- **Findings**: 0 critical 0 warnings 1 observations

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

- `automaticBase` in `skills/10x-pipeline/scripts/open-pr.mjs` now applies one rule to the nearest-ancestor search and both fallbacks. It keeps literal ref validation, excludes `HEAD`, the current branch, `agent-smith/` and prefixes ending in `/` or `-`, and for other prefixes excludes a name only when its first remainder character matches `ID_RE` and the name is not a known default (`isolation.defaultBranches`, the remote symbolic HEAD, or the GitHub default in the final fallback). An empty remainder stays eligible. Explicit `--base`, ordering, tie preference, older-Git counting and the GitHub query position are unchanged. The remote HEAD value is computed once and reused (no extra subprocess).
- Tests: six new tests cover the `ma`/`main` collision with competing `mademo`, `maother`, `maretry.retry` and `agent-smith/` refs and the explicit `aaa-copy` override, `release/1.x` and `release`, a configured default with symbolic HEAD unavailable, and the remote-HEAD and GitHub fallbacks (GitHub lookup asserted absent or present). Existing namespaced and invalid fallback rejections remain.
- Old behavior check: with `open-pr.mjs` temporarily replaced by the `main` version, 6 of the 17 `configured` tests fail (exactly the new ones); with the fix, 17 of 17 pass. The fixed file was restored from a scratch copy.
- Docs: `docs/REFERENCE.md` (Base bullet) and ADR-017 Amendment 3 carry the new rule. A grep of `docs/`, `README.md`, both `SKILL.md`, `prompts/` and `rules/` found no other statement of the old blanket rule.
- Full suite (`node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`): 2168 tests, 2165 pass, 0 fail, 3 skipped. `git diff --check` (working tree) passes.
- Progress rows 1.1 and 1.2 are `[x]` with commit `cf0d7820`, and the diff supports them. There are no manual rows.

## Findings

### F1 — Trailing whitespace in plan-brief.md fails a branch-range diff check

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/changes/open-pr-base-prefix-collision/plan-brief.md:39
- **Detail**: `git diff --check main...HEAD` reports trailing whitespace on the `**Prerequisites**` line. The plan's criterion (plain `git diff --check`) passes, and CI does not run the range form, so the criterion is met. The two trailing spaces are probably a Markdown hard line break written by the plan step, in a pipeline artifact outside the plan's code scope.
- **Fix**: Replace the two trailing spaces with a blank line or a backslash break if the artifact is edited.
- **Decision**: PENDING — a plan-step artifact outside the plan's scope, and the spaces may be an intended Markdown line break; the owner decides whether to touch it.
