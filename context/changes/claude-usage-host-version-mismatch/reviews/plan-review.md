<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Claude Desktop transcript usage capture implementation plan

- **Plan**: context/changes/claude-usage-host-version-mismatch/plan.md
- **Mode**: Deep (codebase claims checked directly, no sub-agent)
- **Date**: 2026-11-25
- **Verdict**: REVISE
- **Findings**: 0 critical, 3 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
| --- | --- |
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

Grounding: 12/12 paths ✓ (scripts, test files, ADR-018, ADR-019), 9/9 symbols and line references ✓ (`measureClaudeTranscript`, `collectClaudeUsage`, `unavailableEvidence`, `usageLimitations`, `claude-usage.test.mjs:614` and `:643`, `late-usage.test.mjs` structured attach block), brief↔plan ✓, Progress↔Phase ✓ (rows 1.1, 1.2, 2.1, 2.2 match their Success Criteria; no Automated row needs a push, PR or PR CI).

## Findings

### F1 — No ADR amendment for a changed capture contract

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 — Changes Required
- **Detail**: The plan changes who supplies the transcript host version (records, not the descriptor), adds the reason `version-conflict`, and changes when unavailable evidence keeps identity. ADR-019 Amendment 4 still says the recheck uses the "qualified host version", and each earlier capture change (`claude-capture-version-floor`, `claude-capture-default-on`, `claude-transcript-capture`) recorded its contract change as an ADR amendment. The plan only cites ADR-018 and ADR-019 as references.
- **Fix**: Add a Phase 2 item that appends an ADR-019 amendment and touches the ADR README row only if its summary stops holding.
- **Decision**: APPLIED — plan.md Phase 2, new "#### 2. Decision record"; plan-brief.md Scope.

### F2 — Reference reasons list and doc sweep missing

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 — 1. Shared instructions and reference
- **Detail**: `docs/REFERENCE.md` ends "Observed token accounting" with the closed list of reasons (`capture-disabled`, `unsupported-host`, … `invalid-evidence`). The plan adds `version-conflict` in `usage.mjs` but names no edit to that list, so the reference would be wrong after the change. The recorded lesson "Grep every doc for the old behavior when a script's output changes" applies.
- **Fix**: Name the reasons list in the reference edit and require a grep of every doc for the old "forward the observed version" instruction.
- **Decision**: APPLIED — plan.md Phase 2, "1. Shared instructions and reference" Contract.

### F3 — Version failure reason is undecided when records disagree and one is bad

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 1 — 1. Transcript collector and wrapper
- **Detail**: The plan assigns `version-conflict` to "disagreeing supported versions", `unsupported-schema` to missing or malformed and `unsupported-host` to below the floor. A transcript whose first record is 2.1.330 and a later one is 2.1.300, or malformed, fits two reasons. The current `version()` helper (`claude-transcript.mjs:141`) checks floor and agreement in one condition, so the implementation would pick an order by accident, and tests asserting "distinct reasons" would pin that accident.
- **Fix**: Validate each record's version in scan order and let the first failing check decide: malformed or missing, then below floor, then differing from the established supported version.
- **Decision**: APPLIED — plan.md Phase 1, "1. Transcript collector and wrapper" Contract.

### F4 — The new reason has no test home

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — 3. Collector and CLI regressions
- **Detail**: Row 1.1 runs `accounting-readers.test.mjs` and `usage-evidence.test.mjs`, but the change list edits neither. The normalized explanation text and the per-step coverage line for `version-conflict` are only covered by collector tests, and `accounting-readers.test.mjs:147–160` already asserts that line shape for `unsupported-host`.
- **Fix**: Add `accounting-readers.test.mjs` to item 3 with a `version-conflict` row.
- **Decision**: APPLIED — plan.md Phase 1, "3. Collector and CLI regressions" Files and Contract.

### F5 — Top-of-report limitations line does not cover the new reason

- **Severity**: 👁 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Scope Boundaries; Phase 1 — 2. Normalized reason and explanation
- **Detail**: `usageLimitations` in `flow.mjs:114-130` labels only some reasons. The line exists so a capped PR comment still shows the gap. A `version-conflict` leaves steps without tokens and no title-line signal, only the per-step Token coverage entry. The plan says the renderer "already surfaces" the reason, which is true for coverage but not for the title line, and it never records the choice.
- **Fix**: State in Scope Boundaries that the title line keeps its labels. Adding a label means a `flow.mjs` change, a REFERENCE bullet update and report tests, which the owner can request later.
- **Decision**: APPLIED — plan.md Scope Boundaries; plan-brief.md Scope; plan.md Phase 1 item 3 asserts the line stays absent.

### F6 — Manual row does not say how Desktop loads the unreleased plugin

- **Severity**: 👁 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 2 — Manual Testing Steps, row 2.2
- **Detail**: Step 1 says "load the changed plugin" in a fresh Desktop session. The omit-version wording lives in the changed `SKILL.md`, so a Desktop session on the released plugin would still send a CLI version, which the fixed collector now ignores. A live run therefore proves the collector but not the new instructions unless the branch's plugin loads. I could not confirm from the repository how Desktop loads a local or branch plugin, so I did not guess a fix.
- **Fix**: The owner states the intended route (local plugin directory or after release) and whether 2.2 should prove the collector alone or collector plus instructions.
- **Decision**: PENDING — owner decides how the Desktop session loads the changed plugin and what row 2.2 must prove; no repository evidence settles it.
