<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Run cost estimate Implementation Plan

- **Plan**: context/changes/run-cost-estimate/plan.md
- **Mode**: Deep (in-session verification, no sub-agent)
- **Date**: 2026-11-09
- **Verdict**: REVISE
- **Findings**: 0 critical, 3 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | WARNING |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS |
| Plan Completeness | WARNING |

## Grounding

Grounding: 9/9 paths and line anchors checked (`flow.mjs:95/123/220/252`, `route.mjs:368/527/580/624`, `state.mjs:38`, `isolation.mjs:19`, `policy.json:99`) ✓, 8/8 symbols ✓ (`buildReport`, `writeReport`, `cleanUsage`, `readSide`, `comparePair`, `compareMarkdown`, `loadPolicy`, `provenanceConfig`), brief↔plan ✓ (one ADR target and one "unchanged" claim drifted; see F2, F5). Progress↔Phase consistency ✓ (4 phases, every criterion has a row).

## Findings

### F1 — Existing provenance test asserts the exact shipped `ignore` list; plan never updates it

- **Severity**: WARNING
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — items 1 and 2, criteria 1.3 and 1.4
- **Detail**: `skills/10x-pipeline/test/provenance.test.mjs:88` does `assert.deepEqual(DEFAULT.provenance, { ignore: ["compare", "provenance"], ... })`. Phase 1 adds `prices` to `ignore` in `policy.json`, so that test fails and criterion 1.4 ("existing suite stays green") cannot pass as written. The plan also puts the new 1.3 test in `cost.test.mjs` in "Testing Strategy" while 1.3 runs `provenance.test.mjs`.
- **Fix**: Add a Phase 1 item for `provenance.test.mjs`: update the expectation at line 88 to the three-name list and add the 1.3 test there.
- **Decision**: APPLIED — Phase 1, new "#### 4. Provenance tests"

### F2 — "Output byte-for-byte unchanged" contradicts `cost: null` in compare JSON

- **Severity**: WARNING
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: End-State Alignment
- **Location**: Desired End State, bullet 1; Phase 3 criterion 3.1; plan-brief "Desired End State" and "Success Criteria"
- **Detail**: The end state says `report.md`, `status` and `compare` output is byte-for-byte what it is today with the shipped policy. Phase 3 and criterion 3.1 make the `compare` JSON carry `cost: null` per side, a new key. `status` omits its keys when off, so the two commands also differ in style. No existing compare test deep-compares a whole side (checked `compare.test.mjs`), so nothing breaks, but the claim is false as written. Omitting the key would be cleaner but would need a change to Progress row 3.1, which a review fix must not touch.
- **Fix**: Keep `cost: null` and state the one exception in Desired End State and in the brief.
- **Decision**: APPLIED — Desired End State bullet 1; plan-brief "Desired End State" and "Success Criteria (Summary)"

### F3 — Rounding of cost figures is unspecified for `compare` and for the estimator

- **Severity**: WARNING
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 item 3 contract; Phase 3 item 1 contract
- **Detail**: `status` rounds to 4 decimals and the report to 2, but `estimateCost` returns `usd` with no rule, and the `compare` side `usd` and `byModel` values have none. Float sums such as `0.1 + 0.2` would print noise in JSON, and the tests assert exact values.
- **Fix**: `estimateCost` returns unrounded sums; each consumer rounds (report 2 and 4, `status` and `compare` JSON 4, Markdown 2).
- **Decision**: APPLIED — Phase 1 item 3 contract; Phase 3 item 1 contract

### F4 — "Same test as report and compare" for a token figure is not literally true

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 item 3 contract, `estimateCost`
- **Detail**: `buildReport` accepts any `typeof number` (`flow.mjs:100`), `compare` uses `validFigure` plus an overflow guard (`route.mjs:380`), and `cleanUsage` keeps non-negative safe integers. They agree on every log the router wrote and differ only on a hand-edited log, where `M` could differ from the `figures for K` count.
- **Fix**: Say so in the contract and leave both existing tests unchanged.
- **Decision**: APPLIED — Phase 1 item 3 contract

### F5 — ADR note sits in ADR-007, but the unit decision is ADR-005

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Phase 4 item 2; References; plan-brief
- **Detail**: ADR-005 line 21 decides "The unit is raw `totalTokens`" and has a "Consequences" section; that is the decision the cost estimate qualifies. ADR-007 is about the scorer and its A/B rule, which the plan already says stays untouched.
- **Fix**: Put the note in ADR-005 "Consequences" and leave ADR-007 unedited.
- **Decision**: APPLIED — Phase 4 item 2; References; plan-brief scope and phase table

### F6 — A cost line reaches pull request comments

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 4 item 1
- **Detail**: `pr-comment.mjs` posts `report.md` as it is, and `docs/REFERENCE.md` already lists what that exposes. With prices set, the report holds a dollar estimate, which collaborators and, for a fork, the public could read.
- **Fix**: Add one sentence to the "PR comment (opt-in)" bullets of REFERENCE.
- **Decision**: APPLIED — Phase 4 item 1 intent
