<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Route Reviews on Open Findings, With a Confirmation Round

- **Plan**: context/changes/review-open-findings/plan.md
- **Mode**: Deep (grounding against `route.mjs`, `policy.json`, tests and archived reviews, done inline)
- **Date**: 2026-11-04
- **Verdict**: REVISE
- **Findings**: 0 critical, 4 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

Grounding: 14/14 paths and line refs checked (`route.mjs:113-127`, `:820-948`, `:442-503`, `:1274`, `:3107`, `SKILL.md:142`, `:147`, `README.md:40`, `helpers.mjs:74`, `rules.test.mjs:131`, `budget-executors.test.mjs:198-290`, archived reviews) ✓, symbols `readReview`, `decide`, `replanNext`, `attachResult`, `reviseToleranceWarnings`, `fixOnNeedsAttention` ✓, brief↔plan ✓, Progress↔Phase ✓ (one `## Progress`, 4 phases, every criterion has a row).

## Findings

### F1 — Human triage writes `FIXED`, which `closedDecisions` does not list

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Current State Analysis (Decision words); Phase 1 §1 and §2 (`closedDecisions`, `applied`)
- **Detail**: The plan says human triage in `/10x-plan-review` writes `APPLIED`, `SKIPPED`, `ACCEPTED` or `DISMISSED`. The skill's Step 7 says "Mark FIXED", and the archived reviews hold 67 `FIXED` against 28 `APPLIED` Decision lines. `FIXED` is not in the default `closedDecisions`, so it reads as an unknown word, which is open. A human who triages a halted run through the skill and resumes would be halted again on every finding they fixed. `applied` (exactly `APPLIED`) would also miss them.
- **Fix**: Add `FIXED` to the default `closedDecisions` and count `APPLIED` and `FIXED` in `applied`.
- **Decision**: APPLIED — Current State Analysis (Decision words bullet); Phase 1 §1 Contract (closed list and `applied`); Phase 1 §2 Contract (policy default list); Testing Strategy parser cases; `plan-brief.md` Key Decisions ("Open means" row).

### F2 — The halt gives the owner no way back in

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 §1 and §2 Contract (halt texts)
- **Detail**: Both halt texts name the open findings and say "Needs a human". Nothing says what resumes the run: the router re-reads the review file, so the owner must set the `Decision` lines (or triage with the review skill) and run again. Manual criterion 2.6 asks for owner-facing wording, and the unparsed surplus (header counts the parse cannot match) has no id to name.
- **Fix**: Append the resume sentence (file, accepted Decision words, `/10x-plan-review <path>`) to both halt texts and name unlisted header counts as a number.
- **Decision**: APPLIED — Phase 2 §1 Contract (halt text); Phase 2 §2 Contract (halt text); Phase 1 §1 Contract (`ids` lists parsed blocks only).

### F3 — The review log field has no verdict, but the report line needs it

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 §3 Contract vs Phase 4 §1 Contract
- **Detail**: Phase 4's report line is `- step <n> <step>: <VERDICT>, ...`, but `entry.review` holds only the four counts, and a review entry carries no other verdict field (only `fix` entries get `verdict`). `buildReport` would have to re-read a review file that a later round has overwritten, which is the wrong figure for an earlier round.
- **Fix**: Store `verdict` in `entry.review`.
- **Decision**: APPLIED — Phase 1 §3 Contract.

### F4 — The "loops-existing untouched" check compares against `HEAD`, which moves in an isolated run

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Desired End State (Verify); every phase's Automated row `git diff --exit-code HEAD -- .../loops-existing.test.mjs`
- **Detail**: This run is isolated, and each successful step is committed (`chore(<id>): step <n> <step>`). After a step that edited `loops-existing.test.mjs` and committed, `git diff HEAD` is empty, so rows 1.3, 2.4, 3.5 and 4.4 pass while the hard rule (AGENTS.md, change.md Constraints) is broken. The check only proves the current step did not touch it.
- **Fix**: Compare against the branch point (`meta.baseSha`, or `main`). The Progress row text cannot change (titles are fixed), so the plan states the stronger check in the Desired End State and Testing Strategy and tells the implementer to run it at the end of each phase.
- **Decision**: APPLIED — Desired End State (Verify bullet); Testing Strategy, Integration Tests (added bullet with the `meta.baseSha` command). The four Progress rows keep their text. Owner may later reword the rows if titles may change.

### F5 — The tolerance key and the end of the automatic `fix` change meaning for implementation review

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2 §2; Phase 4 §3 and §4
- **Detail**: `review.reviseToleranceWarnings` bounds only the plan review today. The plan reuses it for `NEEDS ATTENTION`, so with the shipped value 1 an open warning goes to done with no `fix`, and under the default `onOpen: "halt"` an aware `NEEDS ATTENTION` never runs `fix` (before, `fixOnNeedsAttention: true` always did). The README and ADR text in Phase 4 did not say so.
- **Fix**: Say it in the README and ADR-011 intents; the tolerated open warnings stay visible in `## Review findings`.
- **Decision**: APPLIED — Phase 4 §3 Intent (README and AGENTS.md); Phase 4 §4 Intent (ADR).

### F6 — A finding block with an unreadable severity is counted nowhere

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 §1 Contract (parser)
- **Detail**: `Severity` is "the first of CRITICAL, WARNING, OBSERVATION" on the line. A block whose line names none (a typo, a translated label) matches no count, so an open one would not stop the run. The plan's own rule for unparsed header counts reads the unknown conservatively.
- **Fix**: Count such a block as a WARNING and add a parser test case.
- **Decision**: APPLIED — Phase 1 §1 Contract (new bullet); Testing Strategy parser cases.
