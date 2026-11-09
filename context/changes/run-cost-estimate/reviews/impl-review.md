<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Run cost estimate Implementation Plan

- **Plan**: context/changes/run-cost-estimate/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-11-09
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Summary

Range reviewed: `af7cca5..HEAD` (commits 4a7de12, 118dc36, c58b6cc, cddde17, plus run commits). Every file the plan names is in the diff, and the diff holds no code file the plan does not name (`AGENTS.md`, `README.md`, ADR-005, REFERENCE are the Phase 4 docs).

- `state.mjs`: `mergedPolicy()` factored out of `loadPolicy()` as planned, so `loadPrices()` cannot drift from it and never halts. `priceTable` and `estimateCost` match the contract (finite `>= 0` prices, non-empty keys, `0` is a price, safe-integer figure test, sorted `unpriced` with `unknown`, unrounded sums, `perEntry`). `deepMerge` merges an override object over the shipped `null` correctly.
- `flow.mjs` `buildReport`: column and line only when a table exists; without prices the report is byte-for-byte unchanged (test 2.1). Line wording, 2- and 4-decimal rounding and the `priced 0` text match the contract.
- `route.mjs`: `status` adds per-row `cost` (executed rows only) and the top-level object with `usd: null` when nothing is priced; `compare` prices both sides from the policy that runs it, adds `cost-incomplete:<side>`, prints the Markdown rows and footer only when priced, and no verdict field reads `cost`.
- `policy.json` and `PROVENANCE_DEFAULTS.ignore` both gain `prices`; the provenance test edit is limited to the expected list plus the new 1.3 test.
- Lessons (`context/foundation/lessons.md`) checked: no verdict reader changed.

## Success criteria

- `node --test skills/10x-pipeline/test/cost.test.mjs`: 15 of 15 pass (rows 1.1, 1.2, 2.1 to 2.5, 3.1 to 3.4).
- `node --test skills/10x-pipeline/test/provenance.test.mjs`: pass (row 1.3).
- `node tools/version-check.mjs`: `Version-check: OK (1.0.1)` (row 4.2).
- Whole suite `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` (rows 1.4, 2.6, 3.5, 4.1, 4.3): 858 tests, 856 pass, 0 fail, 2 skipped (the `GH_LIVE=1` live tests of `pr-comment.test.mjs`), exit 0.
- Manual row 3.6 is ticked with `evidence/script-cost-manual.sh` and its output: valid JSON from `init`, `status`, `status --report`, a `Cost (estimate)` line in `report.md`, and the `compare --format md` cost rows beside the token rows. The evidence matches the code.

## Findings

### F1 — compare shows $0.00 where report and status show no figure

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: skills/10x-pipeline/scripts/route.mjs:409 (readSide `cost.usd`), route.mjs:564 (Markdown `costCell`)
- **Detail**: When a side has token figures but none of them is priced, `compare` gives `cost.usd: 0` and the Markdown cell `$0.00 (0 of S priced)`, while the report line reads `Cost (estimate): - (no step with a token figure has a price)` and `status` gives `usd: null`. The plan's compare contract does not say what `usd` is when nothing is priced, so this is not drift, but the three outputs treat "nothing priced" differently. The `P of S priced` count and the `cost-incomplete:<side>` warning do make the case visible.
- **Fix**: Set `usd` to `null` when `priced` is 0 in `readSide`, and print `-` in that Markdown cell, as `status` does.
- **Decision**: PENDING — observation only; it changes the `compare` JSON contract the plan left open, so the owner decides whether `cost.usd` should be `null` when nothing is priced.

### F2 — REFERENCE cost text is a sibling paragraph, not a bullet group inside "Usage report"

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: docs/REFERENCE.md ("Cost estimate:" paragraph after "Usage report:")
- **Detail**: The Phase 4 contract asks for a "Cost estimate" bullet group under "Usage report" and no new headings. The text is a separate `Cost estimate:` label at the same level as `Usage report:` and `Lesson candidates:`, directly after "Usage report". It is not a Markdown heading and its content covers every point the plan lists (key, default, alias keys, blended rate, coverage wording, column, `status` and `compare` shapes, malformed block, report-time override, provenance ignore, PR comment note, baseline cost fields). The placement matches how the file labels its other topics.
- **Fix**: Leave as is, or fold the label into "Usage report" as its last bullets.
- **Decision**: PENDING — observation only; a placement choice with no behavior effect, left to the owner.
