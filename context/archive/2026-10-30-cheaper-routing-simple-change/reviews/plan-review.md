<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Cheaper Routing for a Simple Change

- **Plan**: context/changes/cheaper-routing-simple-change/plan.md
- **Mode**: Deep (blast-radius sweep done with local grep, no sub-agent: one file, one caller)
- **Date**: 2026-10-30
- **Verdict**: SOUND
- **Findings**: 0 critical, 1 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS |
| Plan Completeness | WARNING |

## Grounding

5/5 paths ✓, 9/9 line anchors ✓ (route.mjs:61, 185, 259, 275, 305, 368-373, 129-152, 35, 48), brief↔plan ✓, Progress↔Phase 16/16 ✓, no checkboxes outside `## Progress` ✓. `tierFor` and `readPlan` have no callers outside `route.mjs`.

## Findings

### F1 — Scratch fixtures are not specified

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 — Success Criteria 2.1 to 2.9, Testing Strategy
- **Detail**: Criteria 2.1 to 2.9 need hand-written `plan.md` files (1 phase 3 rows, 2 phases 6 rows, 1 phase 7 rows), a `reviews/plan-review.md` with `**Verdict**: SOUND` and `**Findings**:` lines (2.5), and a `last-result.json` (2.6). Phase 1 uses `<repo>` and `scratch` as placeholders. The implementer must invent these and the exact commands, so two runs can verify different things.
- **Fix**: Add a short fixture list to Testing Strategy (file names, row counts, review header lines) and write the commands for 2.1 to 2.9 with a concrete scratch root under `$TMPDIR`.
- **Decision**: FIXED

### F2 — Default `--size m` leaves the plan step on opus/high

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: End-State Alignment
- **Location**: Phase 1 change 1; What We're NOT Doing
- **Detail**: The `plan` step is discounted only with `--size s`. Without the flag the plan step still starts at tier 4 (opus/high), which costs more than the PRD baseline (Sonnet-5.5 high), even for a change that later turns out to be simple. The plan step is likely the most expensive single step, so the usage-drop goal may depend on users passing `--size s`. This follows your decision (plan signals only, `--size s` as the only first-plan signal), so it is recorded rather than blocked.
- **Fix**: Accept for S-01 and let S-06 (baseline comparison) show whether the plan step dominates cost. Revisit `steps.plan.baseTier` then.
- **Decision**: FIXED

### F3 — Discount withholding is permanent and a zero discount logs a "-0" reason

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 change 1 (Contract)
- **Detail**: "No log entry has `ok === false`" removes the discount for the rest of the run after one failure, even after later steps succeed. That is conservative and matches the intent, but is not stated as deliberate. Also, for `fix` (discount 0) the contract appends `-N simple change` unconditionally, which would print `-0`.
- **Fix**: State in the Contract that withholding lasts for the whole run, and append the `tierWhy` text only when the discount is above 0.
- **Decision**: FIXED
