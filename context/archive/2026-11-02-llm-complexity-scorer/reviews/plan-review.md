<!-- PLAN-REVIEW-REPORT -->
# Plan Review: LLM Complexity Scorer Implementation Plan

- **Plan**: context/changes/llm-complexity-scorer/plan.md
- **Mode**: Deep (claims checked directly against the code; no sub-agent)
- **Date**: 2026-11-02
- **Verdict**: SOUND
- **Findings**: 0 critical, 1 warning, 5 observations

This review replaces the earlier `plan-review.md` of this change (the second review, REVISE). The plan already carries the fixes for that review and for the first one. Verdict and counts are as measured on the plan before this review's edits.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | WARNING |
| Blind Spots | PASS |
| Plan Completeness | PASS |

## Grounding

Grounding: 14/14 `route.mjs` anchors ✓ (cleanSignals :386, attachResult :402, isFailure :462, resolveRigor signals :535, measureRisk :715, decide :746, lean-skip `measured` :786-791, preplanNext :1013, tierFor :1595, settle floor :1624, saved :1634, next :1909, budget :1935, halt :1973), 8/8 symbols ✓ (`interactive: executor !== "goal"` :1344, `parseFlags` :28, `readSide` :2120, `comparePair` :2189, `executed` :194), 5/5 test anchors ✓ (`preplan.test.mjs` :209 :671 :676 :859 :872; `route.test.mjs` :148-159; `budget-executors.test.mjs` TABLE and delta assertion), brief↔plan ✓, ADR-007 rule lines ↔ plan decisions ✓ (departures are declared: failed attempts use no budget, floor scope), Progress↔Phase rows ✓ (5 phases, 3+1, 4+1, 3+1, 4+1, 3+2). `context/foundation/lessons.md` and `docs/reference/contract-surfaces.md` do not exist; skipped. Other claims verified: SKILL.md "Effort floor" and README define the floor for steps that ask questions, which supports the plan's reading; `makeProject` is the only project builder (all test files except `rules.test.mjs` use it), so the helper default covers every test; `SKILL.md` has no model name today, so row 5.1 can pass.

## Findings

### F1 — The owner pause before Phase 3 cannot bind an unattended implementation

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architectural Fitness
- **Location**: Decisions ("Effort floor"); Phase 3 Implementation Note; Phase 5 item 2 Contract
- **Detail**: ADR-007, accepted by the owner, says the shift **MUST NOT** go below the effort floor in `rigor.minEffort`, with no interactive qualifier. The plan reads the floor as ADR-003 does (interactive steps only, which SKILL.md and README support), lets plain `implement` and segments shift down to tier 2, and amends the ADR rule line in Phase 5. It asks the owner to confirm this reading at a pause before Phase 3. This change runs under `/10x-goal-implement`, which has no human at any point, and ignores a "pause" note: the shift code, and then the ADR amendment, land with the owner's confirmation still open. The code would then conflict with an accepted rule line until the owner reads the PR, and the plan's own fallback (set `score.shift.implement.down` to `null`) is a post-hoc edit.
- **Fix A**: Ship `score.shift.implement.down` as `null` in Phase 1 and leave the ADR rule line as it is. Turn the down shift on (value 2) and amend the rule line in a follow-up commit once the owner has confirmed the reading.
  - Strength: The unattended default meets the accepted ADR literally; no state of the branch contradicts it.
  - Tradeoff: The `implement` down cases of the test list and the A/B check cover only the up shift until the owner decides.
  - Confidence: HIGH — follows from ADR-007 and the plan's own fallback.
  - Blind spot: Whether the owner wants the down shift measured in the A/B at all.
- **Fix B ⭐ Recommended**: Keep the plan as written and add to the PR description and to `report.md` expectations that the ADR amendment and the floor reading are open until the owner approves the PR.
  - Strength: No change to the tested design; the down shift is exercised in the A/B check.
  - Tradeoff: An unattended run still writes the ADR amendment before any human confirms it; review at PR time is the only gate.
  - Confidence: MED — depends on the owner reading the PR before merge (they rebase-merge on GitHub).
  - Blind spot: None significant.
- **Decision**: PENDING — the choice reverses or keeps an owner-level decision about an accepted ADR; no guess made.

### F2 — The step turns on by default before the A/B evidence, and rows 5.4 and 5.5 outlive the change

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: End-State Alignment
- **Location**: Phase 4 item 1 (`score.minRigor` to `"standard"`); Phase 5 item 3 and rows 5.4, 5.5
- **Detail**: The A/B rule says that fewer than 5 comparable pairs, a missing A/A pair or an inconclusive result sets `score.minRigor` to `null`. Phase 4 ships `"standard"` with zero pairs. The run of this change has `archive: true` in `meta.json` and README says `done` archives although Manual rows are pending (`haltOnManualPending` is `false`), so rows 5.4 and 5.5 cannot be ticked in `plan.md` after the move (`context/archive/` is read-only by convention), and the A/B result is written into ADR-007 and `policy.json` on a branch after the change is closed.
- **Fix**: Owner decision: either ship `score.minRigor: "standard"` and treat the A/B as a follow-up change (the roadmap slice stays open until the ADR holds the result), or keep `null` until the A/B passes and have the A/B on-arm opt in by override.
- **Decision**: PENDING — changes the shipped default and the A/B recipe; owner decides.

### F3 — AGENTS.md `compare` bullet and the `helpers.mjs` sentence go stale

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 5 item 2
- **Detail**: AGENTS.md lists `compare <id> --baseline <dir> [--routed <dir>] [--format md]` under Commands and says "`helpers.mjs` stays as it was". Phase 5 edits only the project-structure list, so after the change the command line misses `--unpinned` and the helper sentence is wrong.
- **Fix**: Add both edits to Phase 5 item 2.
- **Decision**: APPLIED — `plan.md`, Phase 5 "AGENTS.md and ADR notes" Intent.

### F4 — A run that starts with a finished plan.md gets no score, and the plan does not say so

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2 item 2 (Scheduling); Migration Notes
- **Detail**: `scoreNext` is called inside the "no plan yet" branch of `decide()` (`route.mjs:758-759`). A `plan.md` that already has a `## Progress` section (hand-made, or from an earlier `/10x-plan`) skips that branch, so the run gets no `score` step, no skip entry and no shift. Migration Notes cover only a run that already logged a `plan`.
- **Fix**: Add a `score gate` test for it and name it in Migration Notes and in the README section of Phase 5.
- **Decision**: APPLIED — `plan.md`, Phase 2 Tests (`score gate`), Phase 5 item 1 (README), Migration Notes.

### F5 — "No simple-change discount applied" is ambiguous at the point where the shift runs

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3 item 1 Contract (down conditions)
- **Detail**: `tierFor` records a discount as saved only after `settle()` (`route.mjs:1634-1635`), but the shift is computed before `settle`. The guard can therefore only read the discount before settling (`discount > 0`), not whether it survived. The plan does not say which reading it means.
- **Fix**: State that the guard reads `discount > 0` before `settle`.
- **Decision**: APPLIED — `plan.md`, Phase 3 item 1 Contract.

### F6 — The review references name a review that this run overwrites

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: References; `plan-brief.md` header
- **Detail**: Both name the second review (REVISE) as `reviews/plan-review.md`. One plan review exists per change folder, so after this run the file holds the third review.
- **Fix**: Name the current review and say what it replaced.
- **Decision**: APPLIED — `plan.md` References, `plan-brief.md` header line.
