<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Shared helpers for open-pr.mjs and pr-comment.mjs Implementation Plan

- **Plan**: context/changes/pr-scripts-shared/plan.md
- **Mode**: Deep (checked by the reviewing subagent itself, no nested subagent)
- **Date**: 2026-11-11
- **Verdict**: REVISE
- **Findings**: 0 critical, 2 warnings, 4 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

Grounding: 7/7 paths ✓ (both scripts, remove-tree.mjs, three test files, AGENTS.md), 9/9 symbols ✓ (`firstLine`, `runGh`, `ghFailure`, `MENTION_RE`, `BODY_CAP`, `isEntryPoint`, `COMMENT_JQ`, `c.login === viewer` once, test lines 647 and 660 of pr-comment.test.mjs), brief↔plan ✓, Progress↔Phase ✓ (1.1-1.3, 2.1-2.6, 3.1-3.2 match the criteria).

## Findings

### F1 — The withTempDir removal-failure test cannot fail the way the plan says

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 1 item 2 (unit tests), Phase 2 item 3 (open-pr regression test)
- **Detail**: The plan makes removal fail by "replacing the directory with a file via `fn`". `remove-tree.mjs` unlinks a non-directory target without error, and it chmods a read-only directory back to 0700 itself, so neither trick makes `removeTree` throw. The test would pass without proving that the cleanup error is swallowed, which is the one drift that had no test. The Phase 2 variant (fake `gh` swaps the body directory for a file) fails the same way, and the fake `gh` is a separate process, so it cannot reach `removeTree`'s guards either.
- **Fix**: In `pr-common.test.mjs` call `process.chdir(dir)` inside `fn` and restore the cwd in a `finally`: `removeTree` refuses a path that is or holds the working directory, so it throws. Drop the open-pr integration case and say so in the commit message. Also state that a `mkdtempSync` error propagates (pinned by `pr-comment.test.mjs:490`).
- **Decision**: APPLIED - Phase 1 item 2 (unit tests) rewritten with the chdir method and the mkdtemp propagation; Phase 2 item 3 (tests that depend on the layout) now adds no open-pr case.

### F2 — The zero-width space is invisible in the plan itself

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Current State Analysis (Known drift), Implementation Approach, Phase 1 item 1 contract
- **Detail**: Three lines of `plan.md` hold a literal U+200B inside backticks, so the instruction "written `​` once" renders as an empty pair of backticks. An implementer cannot tell whether to write the escape or the invisible character, which is the exact drift the change fixes. `pr-comment.mjs` uses the `​` escape.
- **Fix**: Write the escape `​` in the plan, require the shared module to use the escape only, and add a unit assertion on `@​b`.
- **Decision**: APPLIED - replaced the invisible character with the text `​` in Current State Analysis, Implementation Approach and the Phase 1 item 1 contract; Phase 1 item 2 gains the `capBody("a @b")` assertion.

### F3 — Moving the pr-comment failure mapping reorders its checks

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 item 2 (pr-comment.mjs)
- **Detail**: Today `findPullRequest` checks missing, timed out and authentication before the two extra regexes. Calling `ghFailure` after the regexes puts them behind. The output differs only for a stderr that matches both, which gh does not print. The Desired End State lists the observable changes and omits this one.
- **Fix**: State the reordering and accept it in the contract.
- **Decision**: APPLIED - sentence added to Phase 2 item 2 (pr-comment.mjs) contract.

### F4 — The "no copy remains" check is narrower than the plan's own claim and misdescribes grep

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 Success Criteria, Automated Verification
- **Detail**: The grep covers `firstLine`, `MENTION_RE` and `BODY_CAP` only, while `spawn`, `runGh`, `ghFailure`, `ID_RE`, `DEFAULT_TIMEOUT_MS`, `GH_HOST` and `isEntryPoint` also move. With two files `grep -c` prints `<path>:0`, not `0`, and exits 1 when all counts are 0.
- **Fix**: Use `grep -cE` with the full list and state the output and exit code.
- **Decision**: APPLIED - Phase 2 Success Criteria, "No copy remains" bullet (Progress row 2.3 title left as is).

### F5 — A Manual Verification bullet in Phase 2 reads as a contradiction

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 Success Criteria, Manual Verification
- **Detail**: "Run ... against the real remote state is NOT needed; instead run both scripts with a bad argument" starts as an instruction and ends as its negation.
- **Fix**: Rewrite as one instruction.
- **Decision**: APPLIED - Phase 2 Manual Verification first bullet rewritten (Progress row 2.5 unchanged).

### F6 — mkdtemp failure behaviour of withTempDir is unspecified

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 item 1 contract (`withTempDir`)
- **Detail**: Only the cleanup is wrapped in `try`. If an implementer wrapped `mkdtempSync` too, the existing test "an unwritable TMPDIR is a skip, not a crash" in `pr-comment.test.mjs` (an `internal error` skip) would break.
- **Fix**: State that the `mkdtempSync` error propagates, and test it.
- **Decision**: APPLIED - covered in the Phase 1 item 2 (unit tests) text rewritten for F1.
