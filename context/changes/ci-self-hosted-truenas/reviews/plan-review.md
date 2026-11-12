<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Run CI on self-hosted TrueNAS runners Implementation Plan

- **Plan**: context/changes/ci-self-hosted-truenas/plan.md
- **Mode**: Deep (done in this subagent, no nested subagent); second review, of the re-plan after the implementation review of 2026-11-11
- **Date**: 2026-11-11
- **Verdict**: SOUND
- **Findings**: 0 critical, 1 warning, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS |
| Plan Completeness | WARNING |

## Grounding

Grounding: 8/8 paths ✓ (ci.yml, release.yml, ci-runner.test.mjs, ADR-020, ADR-008 line 45, AGENTS.md, impl-review.md, evidence/unproven.md), both `runs-on` lines equal the plan Contract and the test constant byte for byte ✓, `approval_policy` re-read now: `first_time_contributors`, as the plan states ✓, router halts on `signals.needsHuman` (`route.mjs:109`) so the planned `blocked` hand-back stops the run ✓, Progress block 3 phases 1:1 with Success Criteria (rows 2.4, 3.5, 3.6 present) ✓, brief↔plan ✓. No contract-surfaces file. `lessons.md` has no rule that applies. Old plan-review F5 (row 2.1 weak grep) is moot: row 2.1 is ticked and the ADR file exists.

## Findings

### F1 — Phase 3 item 1 and the manual steps contradict item 2 on when the setting must be on

- **Severity**: WARNING
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3 item 1 Intent; Testing Strategy, Manual Testing Steps 1 and 2
- **Detail**: Item 1 says the owner confirms the fork approval setting "before the pull request of this change is opened". Item 2 says the run's own pull request opens when the run ends or halts (ADR-017), which happens at the `blocked` halt of row 3.5, before the owner can act, and that this is acceptable (trusted same-repository case). Manual step 2 likewise has the owner open the PR after the setting. An owner reading item 1 would believe the PR waits for the setting; it does not. The real deadline is "now, because the runners are online, and before the merge".
- **Fix**: Make item 1 cover only runner registration before the PR opens, and state the setting deadline (now, and before the merge) in one place; align Manual Testing Steps 1 and 2.
- **Decision**: APPLIED — plan.md Phase 3 item 1 Intent and Testing Strategy, Manual Testing Steps 1 and 2.

### F2 — Row 3.6 command is half vacuous

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3 Automated Verification, Progress row 3.6
- **Detail**: `grep -q "all_external_contributors" ADR-020` already succeeds today, because the Assumptions bullet names the required value. Only the negated `grep -qE` half can fail now. An implementer could delete the two stale phrases without recording the date and value of the passing reading and the row 3.5 reference, and 3.6 would still pass. The row title cannot be reworded here (Progress rows are fixed).
- **Fix**: State in the Phase 3 row 3.6 Contract that the command proves only the two phrases are gone, and that the implementer checks by reading that the bullet names the date, value and "Progress row 3.5".
- **Decision**: APPLIED — plan.md Phase 3 item 2 Contract, row 3.6 bullet.

### F3 — A failed `gh` read is treated like a wrong setting

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 3 item 2 Contract, row 3.5 bullet
- **Detail**: The endpoint needs admin read access. If the implementer's `gh` call fails (auth, permission, network), the plan has it report `blocked` naming "the owner action", which reads as "switch the setting". The owner may then re-set a setting that is already right while the real fault is access, and the run halts again.
- **Fix**: Keep the `blocked` hand-back, but require `needsHuman` to name the failure and say the setting is unread, not wrong.
- **Decision**: APPLIED — plan.md Phase 3 item 2 Contract, row 3.5 bullet.
