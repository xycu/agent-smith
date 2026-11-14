<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Split the budget executors test file

- **Plan**: context/changes/budget-test-file-split/plan.md
- **Mode**: Deep (checked inline against the code; no sub-agent, because this run may not spawn one)
- **Date**: 2026-11-13
- **Verdict**: SOUND
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

Grounding: 7/7 paths ✓ (test file, `phase-helpers.mjs`, test README rows 40/41/94, ADR-011:97, ADR-012:74,165, `ladder-fable-rung/change.md:34`, `ci.yml:37`), 18/18 identifiers used by the eight test bodies are in the helper export list or `helpers.mjs` ✓, brief↔plan ✓, Progress↔Phase consistency ✓ (rows 1.1-1.4, 2.1-2.7 match the criteria). Assumptions: no sub-agent was run; the plan's CI times and the 62.5 s floor are taken from `change.md`. The runner is self-hosted (`ci.yml:28`), so its core count is unknown.

## Findings

### F1 — Body-unchanged check in 2.3 is not runnable and `HEAD~1` is not the baseline

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Phase 2 — Success Criteria, row 2.3
- **Detail**: The criterion says to diff `git show HEAD~1:...budget-executors.test.mjs` against the four files "ignoring moved lines", with no command. On a run branch that holds step commits (`chore(...): step 2 plan` and others sit on top of the base), `HEAD~1` is not the pre-change file, and after the Phase 1 commit the file it names is already the reduced one. The only guard against an edited test body is therefore vague.
- **Fix**: Record `BASE=$(git rev-parse HEAD)` and a scratchpad copy of the original file in the baseline step 1.1, and replace 2.3 with a line-set comparison that prints nothing when every original line from 230 on survives in the four test files or the helper.
- **Decision**: APPLIED — Phase 1 "Baseline" contract (BASE and scratchpad copy) and Phase 2 Success Criteria, Automated row "Test bodies are unchanged" (runnable `diff ... | grep '^<'` command).

### F2 — "Its tests stay in place" is false for ladder-fable-rung

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Current State Analysis, last bullet
- **Detail**: The plan says `ladder-fable-rung/change.md:34` expects `budget-executors.test.mjs` unchanged and that "its tests stay in place and unedited". Five of the eight tests leave that file, and the confirm-round tests carry tier literals that check nothing was renumbered. That live change would read the reduced file and miss them.
- **Fix**: State that the check now reads the four `budget-*.test.mjs` files, and say so in the PR.
- **Decision**: APPLIED — Current State Analysis, last bullet.

### F3 — Manual row 2.7 cannot be ticked inside the run

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2 — Implementation Note and row 2.7
- **Detail**: "Pause for the manual CI timing check after the PR run" cannot happen in an unattended run: the PR opens at the end of the run. `docs/REFERENCE.md` ("Manual verification") says a pending Manual row never halts the run; `manual-verify` lists it as not proved, and the archive gate then asks the owner.
- **Fix**: Say that 2.7 stays pending by design and the owner ticks it after reading the CI log.
- **Decision**: APPLIED — Phase 2 Implementation Note.

### F4 — README helper entry departs from the existing pattern

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Phase 2 — Test index
- **Detail**: `phase-helpers.mjs` has a table row in its group (README line 41) and the `## Helpers` bullet at line 94 only points to the groups. The plan adds a separate described bullet for `budget-helpers.mjs`, which would be the one helper described in the list.
- **Fix**: Add a `budget-helpers.mjs` table row after the four test rows and extend the line-94 bullet.
- **Decision**: APPLIED — Phase 2, "Test index" Intent and Contract.

### F5 — Comment blocks inside the moved range have no stated home

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 helper contract and Phase 2 contract ("moves with its tests or into the helper")
- **Detail**: Lines 346-410 hold the confirm-section comment block and the `confirmOverride` comment, which Phase 1 moves into the helper; Phase 2 then leaves open whether the block goes into a test file too. The implementer would have to choose.
- **Fix**: Say the comments inside 346-410 move into the helper and are not repeated.
- **Decision**: APPLIED — Phase 1, "Helper module" Contract.
