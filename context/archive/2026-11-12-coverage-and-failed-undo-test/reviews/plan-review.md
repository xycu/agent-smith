<!-- PLAN-REVIEW-REPORT -->
# Plan Review — Router coverage and failed rollback undo

- **Plan**: `context/changes/coverage-and-failed-undo-test/plan.md`
- **Mode**: Deep
- **Date**: 2026-11-14
- **Source revision**: `ae0ad03a07545a5e5d1a4543f181414a2422c779`
- **Verdict**: SOUND
- **Findings**: 0 critical, 1 warning, 0 observations

The verdict and counts describe the plan before review edits. The warning has a targeted fix, applied below.

## Verdicts

| Dimension | Verdict |
| --- | --- |
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS |
| Plan Completeness | WARNING |

## Grounding

Grounding verified 8/8 existing paths, 10/10 symbols and brief-to-plan consistency. Existing paths inspected include `.github/workflows/ci.yml`, `rollback.test.mjs`, `stepcommit.test.mjs`, `helpers.mjs`, `route.mjs`, `isolation.mjs`, `flow.mjs` and `steps.mjs`, with test and script paths resolved under `skills/10x-pipeline/`. The change-local `coverage-evidence.md` is an explicit new deliverable. Symbols checked were `freshRun`, `toImplement`, `REF`, `head`, `refExists`, `showFile`, `run`, `gitEnv`, `undoRollback` and `rollback`.

The single bottom Progress section matches both phase headings and all ten success-criteria bullets. Its indices, titles and checkbox states are preserved by the review edits. The foundation lessons and Wave 6 ownership were inspected.

## Code verification

- `rollback` snapshots tracked and untracked files through `add -A`, `write-tree`, `commit-tree` and `update-ref`, then resets to `startSha`. Its returned closure supplies the same Git runner to undo. The snapshot parent is the head the failed step left. [isolation.mjs](../../../../skills/10x-pipeline/scripts/isolation.mjs#L561)
- `undoRollback` has two failure exits. A failed hard reset leaves the branch at `startSha`, and a failed mixed reset leaves it at the snapshot commit with a recovery command. Ordinary `end` appends the kept-under sentence. The outer catch obtains the exact ref from the reset diagnostic. The planned matrix reflects both message contracts. [route.mjs](../../../../skills/10x-pipeline/scripts/route.mjs#L51) [ordinary halt](../../../../skills/10x-pipeline/scripts/route.mjs#L101) [outer catch](../../../../skills/10x-pipeline/scripts/route.mjs#L1056)
- Existing successful-undo fixtures supply the attempt-cap sequence and malformed `complexity.appliesTo` exception trigger. `runGit` prepends `-c core.quotePath=false`, which the targeted wrapper must accommodate when matching the selected reset. Existing shell injection forwards other commands to real Git and uses the Windows skip convention. [rollback.test.mjs](../../../../skills/10x-pipeline/test/rollback.test.mjs#L296) [exception fixture](../../../../skills/10x-pipeline/test/rollback.test.mjs#L339) [runGit](../../../../skills/10x-pipeline/scripts/state.mjs#L726) [wrapper convention](../../../../skills/10x-pipeline/test/stepcommit.test.mjs#L416)
- Ordinary `endRun` emits exit 0 through `out`, while the outer catch calls `halt`, which emits exit 1. The CLI helper preserves the inherited coverage environment and supports a child-specific `PATH`. The four planned cases fit the existing fixture architecture. Search found both production undo callers and zero existing failed-undo message assertions. [endRun](../../../../skills/10x-pipeline/scripts/flow.mjs#L338) [out](../../../../skills/10x-pipeline/scripts/state.mjs#L13) [halt](../../../../skills/10x-pipeline/scripts/state.mjs#L944) [CLI helper](../../../../skills/10x-pipeline/test/helpers.mjs#L134)

## Findings

### F1 — Reconcile the coverage fallback with acceptance and the job budget

- **Severity**: WARNING
- **Impact**: LOW — quick decision, with an obvious and narrowly scoped fix.
- **Dimension**: Plan Completeness
- **Location**: Phase 1 CI test command contract and Phase 2 final coverage and CI evidence contract.
- **Detail**: Phase 2 permits a second non-blocking coverage step, while Phase 1 and Progress row 1.1 require coverage in the existing suite command. The fallback is described as a response to untimely completion, yet the required ordinary suite plus a second covered suite share the same 15-minute job budget. An implementer could choose the expressly permitted fallback and leave acceptance contradictory, or add another run that exceeds the timeout. The ticket allows this fallback for noticeable slowdown. [plan](../plan.md) [ticket](../change.md) [job limit](../../../../.github/workflows/ci.yml#L32)
- **Fix**: Define the two-step configuration, its failure propagation and its relationship to row 1.1. Use measured slowdown to select it, account for setup and both suites within the existing job limit, and require a completed passing coverage run and table for acceptance. Preserve all Progress entries and carry the clarification in the phase contracts.
- **Decision**: APPLIED — extended Phase 1 “CI test command”, revised Phase 2 “Final coverage and CI evidence” and aligned the “Runtime fallback” decision in `plan-brief.md`.

## Verification

Four focused existing workflow checks passed on Node `v26.13.1`, covering runner selection, the 15-minute limit, suite temporary-directory configuration and action pins.

```sh
node --test --test-name-pattern="every job of ci.yml|the suite step uses|every remote action of this repository" tools/test/ci-runner.test.mjs tools/test/workflow-pins.test.mjs
```

Review-time proof covers document consistency and existing workflow invariants. Node 24 full-suite coverage, the four new failure-injection cases, performance measurements and live CI evidence remain implementation acceptance work.

## Assumptions and triage

- The ticket-authorized two-step fallback can fulfill row 1.1 through the combined configuration described in Phase 1. Inline coverage remains the starting implementation. [ticket](../change.md)
- Deep code verification was performed directly, following the unattended single-level execution rule and the foundation lesson. All findings with clear fixes were applied under the supplied triage instruction. [lessons](../../../foundation/lessons.md)
- The additional recovery-gap inventory stays within the plan's Wave 6 ownership and follow-up disposition. [wave ownership](../../WAVES.md#L115)

All findings are APPLIED. The original SOUND verdict and 0 critical, 1 warning, 0 observations counts are retained.
