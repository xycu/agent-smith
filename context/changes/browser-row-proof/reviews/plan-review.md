<!-- PLAN-REVIEW-REPORT -->
# Plan Review: A browser Manual row needs browser-grade proof Implementation Plan

- **Plan**: context/changes/browser-row-proof/plan.md
- **Mode**: Quick (no sub-agents; the orchestrator forbids them, grounding done inline)
- **Date**: 2026-11-10
- **Verdict**: REVISE
- **Findings**: 0 critical, 2 warnings, 1 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

Grounding: 14/14 paths and line refs ✓ (steps.mjs 262/273/279/290/331/335/349/397/405, flow.mjs 19/234/734, route.mjs 169/637, policy.json 307-318 and e2e `rowWords`, ADR-012 Status/Risks/Unverified lines), 8/8 symbols ✓ (`verifyManual`, `manualVerifyOptions`, `evidenceKind`, `withoutEvidence`, `goalPhrase`, `doneNotes`, `archiveLines`, `manualCheckLines`), brief↔plan ✓, Progress↔Phase consistency ✓ (4 phases, 22 rows, numbering matches Success Criteria). Live claim of Current State Analysis re-checked: `ToolSearch select:` loads `mcp__claude-in-chrome__tabs_context_mcp` and the call without `createIfEmpty` answers "no tab group ... Use createIfEmpty: true" ✓. Existing fixtures in `manualverify.test.mjs` and `budget-executors.test.mjs` hold no browser word in a row that is ticked with `judgment-` evidence ✓.

## Findings

### F1 — `--chrome false` still accepts `browser-` evidence for a browser row

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 1 — Kind check in `verifyManual`; Phase 3 — `manual-verify-nochrome` template
- **Detail**: `verifyManual(last, ran, plan, result, p, policy)` receives the policy, not `meta`. With `--chrome false` the nochrome prompt demands a test, command or script and a first line `Chrome: off (--chrome false)`, but the router accepts `browser-` evidence for a browser row on any run. The plan's "kind prefix is honest" caveat covers a lying file in general, not this cheap-to-see gap, and nothing in the plan or the ADR amendment names it.
- **Fix**: Accept it on purpose and record it: gating on `meta.chrome` changes the `verifyManual` signature and its caller in `flow.mjs`, which the plan does not scope, and the prefix is a claim anyway. Add the note to Key Discoveries and to the ADR amendment Risks.
- **Decision**: APPLIED — plan sections changed: Key Discoveries (new bullet) and Phase 4 "ADR-012 amendment" Contract (Risks list).

### F2 — `browserProofKinds` is silently bounded by `evidenceKinds`

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — Option reader and predicate; Success Criteria 1.1
- **Detail**: `evidenceKind(token, kinds)` returns `other` for any prefix not in `evidenceKinds`. A project override of `evidenceKinds` that drops `test` makes `test-` evidence read `other`, which is not in `browserProofKinds`, so a browser row can never be proved by a test there. The two lists interact, and the plan states the interaction nowhere and tests it nowhere.
- **Fix**: State in the Phase 1 contract that `browserProofKinds` entries only count when also in `evidenceKinds`, say so in REFERENCE.md, and cover it in the `browser row words and proof kinds` test.
- **Decision**: APPLIED — plan sections changed: Phase 1 "Option reader and predicate" Contract and Phase 1 Automated Verification (first bullet, Success Criteria). The Progress rows are untouched.

### F3 — A rejected tick stays `[x]` in `plan.md`

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Desired End State; Phase 4 — ADR-012 amendment
- **Detail**: The router never edits `plan.md`, so a browser row ticked with `judgment-` evidence keeps its `[x]` after the last attempt. A reader of the plan or the Progress block sees a proved row; only the final message, `archive` summary, `meta.outcome`, `report.md` and `status` say otherwise. This is the existing behaviour for every unproven tick, but this change makes it likelier to be seen.
- **Fix**: Name it in Key Discoveries and in the ADR amendment Risks.
- **Decision**: APPLIED — plan sections changed: Key Discoveries (new bullet) and Phase 4 "ADR-012 amendment" Contract (Risks list).
