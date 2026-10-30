<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Per-Step Usage Report

- **Plan**: context/changes/per-step-usage-report/plan.md
- **Mode**: Deep
- **Date**: 2026-10-30
- **Verdict**: REVISE (SOUND after triage fixes)
- **Findings**: 0 critical, 2 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | WARNING |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | PASS |

## Grounding

5/5 paths ✓, 9/9 line anchors in route.mjs ✓, brief↔plan ✓, Progress↔phase 19/19 ✓

## Findings

### F1 — No check that real token figures reach the log

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: End-State Alignment
- **Location**: Phase 3, Testing Strategy
- **Detail**: Every criterion feeds route.mjs a hand-written last-result.json. The orchestrator is the only source of figures, and the plan calls the Agent result's usage format an undocumented contract. All 19 criteria can pass and a real run can still produce a report with `-` in every Tokens cell, which FR-009 exists to prevent.
- **Fix**: Add a Phase 3 Manual criterion: run the pipeline once on a scratch change (or one step through SKILL.md) and confirm `usage` appears on the run.jsonl entry and in report.md.
  - Strength: Proves the one link no scratch test can.
  - Tradeoff: Costs one real subagent run.
  - Confidence: HIGH — the plan names this link as its top risk.
  - Blind spot: The shape of the Agent result is unverified here.
- **Decision**: FIXED (Fix in plan)

### F2 — A stored `outcome` goes stale when a run continues

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2, change 2
- **Detail**: `outcome` is cleared only by `init`. After a halt, raising a limit and calling `next` returns `run` while meta.json still says `halt`; a later `status --report` prints the old halt.
- **Fix**: Clear `meta.outcome` whenever `next` returns `run`, and add a criterion next to 2.7.
- **Decision**: FIXED (Fix in plan)

### F3 — Only two of the three end branches are tested

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2, criteria 2.2 and 2.3
- **Detail**: The brief names a missed end branch as the key risk. Criteria cover `done` and the failure halt, not the step-budget halt (route.mjs:310-313).
- **Fix**: Route all three branches through one `endRun` helper; add a criterion that sets `limits.maxTotalSteps` to 1 in the override file and checks report.md exists.
- **Decision**: FIXED (Fix in plan)

### F4 — `outcome` in meta.json and `--report` overlap with what `next` already does

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Lean Execution
- **Location**: Phase 2, changes 2 and 3
- **Detail**: `next` on an ended run reproduces done/halt and would rewrite the report; `--report` is only needed for a snapshot of a run in progress. The user chose `--report` during planning. F2 is the cost of keeping `outcome`.
- **Fix**: None unless the feature is dropped.
- **Decision**: ACCEPTED

### F5 — Criterion 1.4 needs a baseline

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1, criterion 1.4
- **Detail**: "Same as before this phase" needs a recorded before-value.
- **Fix**: Name it: `plan` on opus/high for a fresh `--size m` change (baseTier 4 in policy.json).
- **Decision**: FIXED (Fix in plan)
