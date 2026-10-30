<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Drop the --size flag

- **Plan**: context/changes/drop-size-flag/plan.md
- **Mode**: Deep
- **Date**: 2026-10-30
- **Verdict**: REVISE
- **Findings**: 0 critical, 2 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

Grounding: 7/7 paths ✓, 5/5 symbols ✓, brief↔plan ✗ (F4), Progress↔Phase ✓ (13 and 8 rows). Verified locally; no sub-agent was used.

## Findings

### F1 — SKILL.md contract tells the implementer to use tier numbers

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2, change 1 (SKILL.md)
- **Detail**: The contract says "use the tier numbers, not model names". AGENTS.md forbids SKILL.md from naming tiers beyond what it already documents, and today it only gives relative moves ("-1 tier", "+1 tier"). Absolute numbers (2, 3, 4) would be new.
- **Fix**: Reword to "describe the rule as tier deltas relative to the plan step's base (-1 plus the simple discount, 0, -1), with no absolute tier numbers and no model names."
- **Decision**: FIXED — contract reworded; criterion 2.7 and its Progress row relaxed to "reductions".

### F2 — Keyword matching boundary is undecided

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1, change 2 (goalClass)
- **Detail**: The rule is "any whitespace-separated word starts with a keyword". A goal written as `(refactor the router)` or `"migrate" the table` would not match, because the word starts with punctuation. The plan leaves that to whatever the code does, and no criterion covers it.
- **Fix**: Strip leading non-alphanumeric characters from each word before the prefix test, and add a criterion: goal `(refactor) the router` returns plan on opus/high.
- **Decision**: FIXED — contract strips leading punctuation; criterion 1.8 extended with the `(refactor) the router` goal (no renumbering).

### F3 — Re-running init without a goal wipes the stored goal

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1, change 4 (init)
- **Detail**: SKILL.md always passes `--goal "<goal text>"`, so resuming with no goal text sends `--goal ""`. Reproduced: `init` with goal "refactor the router", then `init` with `--goal ""`, leaves `"goal": ""` in `meta.json`. The goal now sets the first plan's tier, so a resumed run that has not planned yet drops from the hard class to plain.
- **Fix**: In `init`, treat an empty `--goal` as absent so the stored goal survives, and add a criterion for it.
- **Decision**: FIXED — contract keeps the stored goal on an empty `--goal`; new criterion 1.13 added, manual item renumbered to 1.14.

### F4 — Brief says no product document names --size

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: plan-brief.md, Success Criteria (Summary)
- **Detail**: The brief says "No shipped file or product document names `--size`". The plan deliberately keeps `shape-notes.md` (lines 36 and 137), which is a product document under `context/foundation/`. The plan's own Desired End State is worded correctly.
- **Fix**: Reword the brief to "No shipped file, the PRD or ADR-001 names `--size`."
- **Decision**: FIXED — brief Success Criteria line reworded.

### F5 — No stated way back to the old first-plan default

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Migration Notes
- **Detail**: Plain and empty goals drop from opus/high to sonnet/high, and an empty goal is a normal input. The plan calls the saving intended but unmeasured and gives no rollback.
- **Fix**: Add to Migration Notes: setting `complexity.firstPlan.bump.plain` to 0 in `context/foundation/agent-smith-policy.json` restores opus/high for plain goals.
- **Decision**: FIXED — rollback bullet added to Migration Notes.

## Triage Summary

Fixed: F1, F2, F3, F4, F5 (5). Verdict after fixes: REVISE → SOUND.
