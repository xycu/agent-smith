<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Step guard bypass forms Implementation Plan

- **Plan**: context/changes/step-guard-bypass-forms/plan.md
- **Mode**: Deep (code and tests checked inline against `step-guard.mjs`, its test file and the hook CLI; no sub-agent, unattended run)
- **Date**: 2026-11-21
- **Verdict**: SOUND
- **Findings**: 0 critical, 1 warnings, 2 observations

Verdict and counts are as measured on the plan before the fixes of this review. This run re-reviews the plan after Phase 4 (the implementation-review fixes) was added; the earlier review (2026-11-20) covered Phases 1-3, and its four findings are all reflected in the plan.

## Verdicts

| Dimension | Verdict |
| --- | --- |
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | PASS |

## Grounding

Grounding: 8/8 paths ✓ (`step-guard.mjs`, `step-guard.test.mjs`, `docs/REFERENCE.md:67,71`, `README.md:32`, `test/README.md:36`, `hooks/hooks.json`, `reviews/impl-review.md`, archived heredoc plan), 10/10 symbols ✓ (`shellWord`, `shellExpansionEnd`, `commands`, `gitOptions`, `longFlag`, `wrappers`, `unwrap`, `resolve`, the `env` `dash` flag, the `abbreviations`/`wrappers` tests), brief↔plan ✓ (one wording gap fixed in F1), Progress↔Phase ✓ (4 phases; rows 1.1-4.7 match their Success Criteria; one `## Progress`; no checkbox outside it). The Phase 4 claims were probed through the hook CLI on the current code: `$'git' push` and `echo $'\'' ; git push #'` are allowed, `echo $'it\'s'` fails closed (exit 2), `git clean --d` and `env - git status` pass. No Automated row needs a pushed branch, PR or PR comment; the live check (3.4) is already Manual. The allows Phase 4 says to add (`env - git status`, `git tag -a v1 --mess x`, `git tag --fi notes v1`) are not in the tests yet, so rows 4.2 and 4.3 still describe real work.

## Findings

### F1 — Phase 4 edits the heredoc lexer's quote reader while the scope says the heredoc rules are untouched, with no test pinning them

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 4 — items 3 and 4; "What We're NOT Doing" (heredoc rules)
- **Detail**: "What We're NOT Doing" says the heredoc rules do not change, but Phase 4 item 3 changes `shellWord`, which `withoutHeredocData` and `shellExpansionEnd` use on every command. The contract also says a `$'...'` word "stays non-literal for heredoc routes", yet no test in item 4 exercises a heredoc. A regression there (a `$'...'` destination read as literal, or a stray `$'` in a heredoc body shifting the quote state) would pass the planned tests. Probed on the current code: `cat > $'out.txt' <<'EOF'` is denied as non-literal, and `cat > out.txt <<'EOF'` with a body line `body $'x` passes.
- **Fix**: Reword the scope bullet to say only the quote reader changes, and add one heredoc deny/allow pair to the `command shapes: ANSI-C and locale quoting` test (the two probes above).
- **Decision**: APPLIED — "What We're NOT Doing" (heredoc rules bullet), Phase 4 item 4 contract, and the "Out of scope" row of `plan-brief.md`.

### F2 — Live check and docs read-through come before the final scanner and docs

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 3 manual rows 3.4 and 3.5; Testing Strategy — Manual Testing Steps
- **Detail**: Row 3.4 (live `agent-smith:step` check) is still open, and Phase 4 then rewrites `commands()` and `shellWord`. A live check run between Phase 3 and Phase 4 proves the old scanner. Row 3.5 (docs read) is ticked, yet Phase 4 item 5 edits the same paragraphs (`docs/REFERENCE.md:67` and `:71`) afterwards. Progress rows cannot change here, so the order belongs in the Manual Testing Steps.
- **Fix**: Add a step that runs the live check after Phase 4 lands and re-reads the two reference paragraphs.
- **Decision**: APPLIED — Testing Strategy, Manual Testing Steps (new step 3).

### F3 — Test line references drifted after Phases 1-3

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Key Discoveries (source-constraints bullet); References (Tests)
- **Detail**: The plan points at `step-guard.test.mjs:398` for the test that forbids `import`, `eval` and similar words in the guard. That test is now at `:523`, and Phase 4 row 4.5 and its quoting edits depend on it. An implementer following the line number lands on an unrelated test.
- **Fix**: Name the test and give both line numbers.
- **Decision**: APPLIED — Key Discoveries source-constraints bullet and References (Tests line).
