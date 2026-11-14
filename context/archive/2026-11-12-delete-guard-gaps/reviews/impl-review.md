<!-- IMPL-REVIEW-REPORT -->
# Implementation Review — Recursive-delete guard gaps

- **Plan**: context/changes/delete-guard-gaps/plan.md
- **Scope**: Full plan, Phase 1 of 1
- **Reviewed phases**: 1
- **Date**: 2026-11-14
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 2 warnings, 0 observations

The verdict and counts describe the implementation at review entry, before the fixes below. All five Progress items were complete. Git history identifies a96105c as the implementation commit and 57829ef as the review-entry HEAD.

## Verdicts

| Dimension | Verdict |
| --- | --- |
| Plan Adherence | FAIL |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | FAIL |

## Findings

### F1 — Spread arguments bypass options validation

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — the fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: skills/10x-pipeline/test/no-recursive-delete.test.mjs:299
- **Detail**: The scanner checked the second syntactic argument only. Both fs.rmSync(...args) and fs.rmSync(...[dir, opts]) returned zero diagnostics, although the spread can supply recursive options. A leading spread followed by a transparent literal also passed. Phase 1 requires failing closed when the actual options argument cannot be established, including an apparent one-argument call.
- **Fix**: Reject a leading argument spread through the existing unclassifiable-arguments diagnostic. Cover all seven supported bare and qualified API forms with three spread cases each.
- **Decision**: APPLIED — commit 8f07013 (fix: reject ambiguous delete arguments), with the regression reproduced before the scanner edit.

### F2 — Keyword-named members hide argument boundaries

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — the fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: skills/10x-pipeline/test/no-recursive-delete.test.mjs:226
- **Detail**: The lexer treated member names such as paths.in and paths?.return as expression-prefix keywords. It then read division as a regex delimiter. The source fs.rmSync(paths.in / divisor ? a : b, /regex/.test(name) ? opts : opts) returned zero diagnostics because that false regex consumed the comma before the opaque options. Safe division expressions using these member names also produced unclassifiable-arguments diagnostics. Phase 1 explicitly requires distinguishing division and regex literals while preserving actual options boundaries and safe calls.
- **Fix**: Use the preceding member-access token when classifying keyword context. Extend the existing path/options matrix with ordinary and optional member access, regex-bearing opaque options, and safe options or absent-options controls.
- **Decision**: APPLIED — commit 8f07013 (fix: reject ambiguous delete arguments), with the regression reproduced after F1 was fixed and before the lexer edit.

## Plan coverage

| Requirement | Evidence |
| --- | --- |
| Shell commands and arrays | The existing regression matrix covers every brief example, combined and split flags, multiline arrays, option terminators, command boundaries, and explanatory-line allowances. |
| Filesystem options | The cross-product covers bare and qualified delete APIs, opaque options, spreads, shorthands, escaped and computed keys, regex paths, division, nested templates, malformed input, and safe controls. F1 and F2 extend its argument-boundary coverage. |
| Discovery and dispatch | Scratch fixtures exercise .github workflow YAML and shell files through scanFiles, including relative diagnostics, safe siblings, original extensions, exclusions, and node_modules handling. The real repository scan passes. |
| Ownership and architecture | Scanner changes are confined to the planned guard test file. The test-local helpers retain their callers and exports. Existing helper and workflow-guard tests establish the shared scratch, cleanup, and dependency-free conventions. |
| Progress evidence | The five completed Automated items map to the matrices, discovery assertion, suite execution, and git checks. |

## Verification

- Node v24.19.0 ran the checks with TMPDIR inside the worktree.
- The entry-state focused file passed all 11 tests with zero failures or skips.
- The added regressions first failed on rm(...args), then on the keyword-member division case after the spread fix.
- The repaired focused file passed all 11 tests with zero failures or skips, including the real repository scan and rule-placement checks.
- The initial complete suite run with TMPDIR at the worktree root reported 1,405 passes, 13 failures, and three skips across 1,421 tests. Its scratch projects inherited the parent Git repository. The affected fixtures belong to executors, nested-subagents, neutral, rules, and score tests.
- A temporary in-worktree scratch directory with a local Git-discovery boundary restores the fixtures' intended repository isolation. All three executor failures passed in a targeted rerun. The complete suite then passed with 1,418 passes, zero failures, zero cancellations, and three skips across 1,421 tests in 1,662.7 seconds.
- Two skips are opt-in live GitHub tests guarded by GH_LIVE=1 in skills/10x-pipeline/test/pr-comment.test.mjs. The third checks CLAUDE.md imports and is conditional on that file existing, in tools/test/agents-md-no-imports.test.mjs. These account for every skip.
- The successful commands were node --test skills/10x-pipeline/test/no-recursive-delete.test.mjs and node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs, with TMPDIR set to the temporary in-worktree directory.
- The router's readReview parser confirms two WARNING findings with APPLIED decisions and the original header counts. The fix commit passed the Conventional Commit title check and includes the AI co-author trailer.
- git diff --check passed. The implementation diff covers the owned test file, and the change artifacts hold this report and lifecycle stamp. The router-owned run.jsonl modification was present at entry.

## Review decisions

The unattended task explicitly authorizes applying every clear in-scope finding. The review therefore applies both fixes locally using the plan's fail-closed contract. The full review covers the single completed phase and its five Automated criteria. The fixes and findings are specific to this scanner change.
