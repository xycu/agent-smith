# Recovering from a failed re-plan

## Overview

Let a 10x run continue after its owner corrects `plan.md` following a failed `plan-replan`. The router still halts when the re-plan fails and gives the owner specific instructions for repairing the plan and resuming the same run.

## Current State Analysis

The router consumes the failed result, keeps the last executed step as a failed `plan-replan`, and halts when it reaches that entry in routing. The same entry is last on every resume, so a valid correction can't clear the halt. The current gate also runs after missing-plan and plan-review decisions, which means those branches can dispatch before the intended halt. [Routing order](../../../skills/10x-pipeline/scripts/flow.mjs#L748)

### Key Discoveries

- `init` and `next` share the same routing path. That path consumes results, applies isolation, and restores the failed step's partial edits when the same call halts. It already supports a durable acknowledgement on a step entry. [Next](../../../skills/10x-pipeline/scripts/route.mjs#L77) · [Init dispatch](../../../skills/10x-pipeline/scripts/route.mjs#L1140)
- Code re-plan verification requires pending Automated work and preserves the previously checked row IDs captured at dispatch. The verifier operates on the router's parsed plan. [Re-plan verifier](../../../skills/10x-pipeline/scripts/steps.mjs#L513)
- The cap counts both code re-plan templates, including failed attempts. The per-step retry limit counts trailing failures, and a `plan` entry already ends an `implement` streak. Historical failures still contribute to the existing budget and rigor calculations. [Re-plan cap](../../../skills/10x-pipeline/scripts/steps.mjs#L481) · [Budget and streak](../../../skills/10x-pipeline/scripts/state.mjs#L828)

## Desired End State

The first halt tells the owner to edit `plan.md` in the run worktree, keep its previously checked Automated rows (the halt lists their row IDs), and leave at least one pending Automated row under `## Progress`. In an isolated run it tells the owner to commit the repair before resuming so later rollback preserves it. The owner can rerun the pipeline or use the router's `init` or `next`.

A resume with an unchanged or invalid plan halts with the reason and remains recoverable. A resume with a changed and valid plan goes through normal routing. With an eligible existing SOUND review and otherwise open limits, it dispatches `implement`. A missing review still follows the review routing, and a blocking review still blocks.

## Scope

This change covers recovery from the 10x `plan-replan` triggered by failed implementation attempts. `plan-revise`, `plan-rejected`, and OpenSpec keep their current behavior. The recovery uses the existing CLI commands and state files.

## Implementation Approach

Use the failed entry as the owner of a durable halt acknowledgement and the fingerprint of the plan the owner was asked to repair. Keep reusing the original fingerprint while the gate is waiting. Check recovery from that baseline and the current parsed plan, then pass the existing history to normal routing.

This is one medium-complexity phase. The route, log and plan contracts need to land together to preserve failure accounting and keep isolated and non-isolated resume behavior consistent. The change note already establishes the recovery trigger and expected outcome. The assumptions below resolve decisions for unattended planning.

## Critical Implementation Details

### State sequencing

Evaluate the recovery gate in the common 10x `next` path before general routing can treat missing Progress as an initial plan or completed Progress as ready for review. The first failure must still halt even if the failed step left a structurally valid plan. Capture a fingerprint of the plan left by the failed step before rollback can replace it, with a distinct value for an absent file. Persist the acknowledgement with that baseline through the normal halt path, which restores partial edits for the owner. A blocked or failed result with `signals.needsHuman` should carry its reason in that first halt and share the existing acknowledgement behavior. [Halt and rollback](../../../skills/10x-pipeline/scripts/route.mjs#L99) · [Durable terminal state](../../../skills/10x-pipeline/scripts/flow.mjs#L328)

## Phase 1: Restore the resume path

### Overview

Stop on the failed re-plan, recognize a qualifying repair on a subsequent invocation, and cover the transitions through the CLI.

### Changes Required

#### 1. Router recovery

**Files**: `skills/10x-pipeline/scripts/route.mjs`, `skills/10x-pipeline/scripts/flow.mjs`, `skills/10x-pipeline/scripts/state.mjs` if the plan reader needs to expose its fingerprint.

**Intent**. Replace the unconditional routing halt with a recoverable gate backed by the failed entry and the current plan.

**Contract**. Store the acknowledgement and the plan baseline as additive fields on the failed entry (suggested names `replanAck` and `planBaseline`; the baseline is a content hash, or a distinct marker for an absent file). In `route.mjs` `next()`, read the baseline before `rollback()` runs and set both fields beside the `needsHumanAck` block. Run the recovery check (current plan against baseline, then `verifyCodeReplan`) as a helper exported from `flow.mjs` and called from `next()` before `decide()`. In `decide()`, the old unconditional `plan-replan` halt then lets an acknowledged entry through. Apply the gate only when the latest executed 10x entry is a failed `plan-replan`. An acknowledged entry passes the gate only when the current plan differs from its baseline and satisfies the existing code re-plan verifier. Guide the owner based on the current failure to recover, such as unchanged content, missing plan or Progress, no pending Automated work, or missing previously checked IDs (name the missing IDs from the entry's `before.done`). An unchanged plan fails even if it is otherwise valid. A timestamp-only touch of a plan with a recorded fingerprint leaves the gate closed. Reuse the terminal writer and removal of a previous outcome on dispatch. Preserve the step's result, verification, usage, isolation records and all policy inputs. The gate is idempotent across repeated halts, including a later retry after an unrelated review or budget halt.

#### 2. CLI coverage

**Files**: `skills/10x-pipeline/test/codereplan.test.mjs`, `skills/10x-pipeline/test/rollback.test.mjs`, `skills/10x-pipeline/test/README.md`.

**Intent**. Reproduce the old loop and verify the recovery contract through the router's public commands. Extend the existing scratch fixtures and test index entries.

**Contract**. Cover first halt, repeat halt with no edit, invalid edits followed by repair, recovery through each resume command, and pre-change state. Check the original entry stays failed and counted, and existing review and budget gates still apply. Exercise isolation through the existing scratch worktree fixture and verify partial edits are present after the first halt and a committed repair survives failure and rollback of the resumed implementation.

#### 3. Operator documentation

**Files**: `docs/REFERENCE.md`, `docs/ADR/ADR-003-rigor-gated-routing.md`.

**Intent**. Document what to do after the halt where the reference describes code re-plans. Add a note to the ADR's code re-plan section identifying the new exit from the historical halt.

**Contract**. Describe the repair, isolated commit and resume workflow, the repeat halt, preserved limits and compatibility behavior. Check current documentation for references to the old permanent halt.

### Success Criteria

#### Automated Verification

- Failed re-plan CLI cases halt with repair instructions on first intake and keep halting for unchanged or invalid plans until a valid edit allows both resume commands to route normally.
- Recovery preserves failure accounting, the re-plan cap, review and step-budget gates, and recognizes supported legacy halt records.
- Isolated CLI recovery restores the failed re-plan's partial edits and preserves a committed repair through rollback of a later failed step.
- The full router suite passes on Node 24 or later.

## Testing Strategy

Run the focused gate with `node --test --test-concurrency=2 skills/10x-pipeline/test/codereplan.test.mjs skills/10x-pipeline/test/rollback.test.mjs`. Use explicit fixture timestamps where the legacy path requires them. Include a failed result that leaves an otherwise valid plan, a missing or malformed plan, an all-checked plan, a plan that drops a checked ID, and a subsequent valid edit keeping that ID. Include a review-only change that leaves the plan untouched and a failed result carrying a human-action signal. For the recovered route assert the dispatched step and the pre-existing review, budget and retry semantics, including the plan entry ending the previous implement streak.

Run the required full gate with `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`. All acceptance runs locally with scratch fixtures and no publication.

## Performance Considerations

Limit fingerprint comparison to the failed re-plan recovery path and reuse the plan bytes already read for validation where practical. No additional Git operation is required for recovery itself.

## Migration Notes

The router owns the additive acknowledgement on the failed log entry. Existing entries and reports remain readable and need no backfill. A pre-change entry is a failed `plan-replan` that has no `planBaseline` field, a numeric `finishedAt`, and a `meta.outcome` (read at the start of the call) that is a halt whose reason starts with the old text `The re-plan after`; keep that prefix as one shared constant so the matcher and the test fixtures cannot drift. For such an entry, accept a structurally valid plan with an mtime strictly later than that result as legacy evidence of a correction. If that evidence is unavailable or the plan is invalid, establish the content baseline on the first halt under the new router and show the same repair instructions. Thereafter use content comparison. The legacy timestamp is a one-time proxy because old entries stored no halt-time plan content. A rollback to an older router reads the same log shape and restores its old halt behavior for any failed re-plan that is still the last entry. Resume recovery with the updated router and preserved worktree.

## Assumptions

- Recovery requires an observable edit to the plan and the same structural checks that apply to a successful code re-plan. The router can verify the artifact contract. The owner supplies the substantive correction. [Change note](change.md) · [Re-plan verifier](../../../skills/10x-pipeline/scripts/steps.mjs#L513)
- A repair goes through existing review freshness rather than redefining which plan entries count as successful. The change note expects a repaired plan to reach implementation with an eligible review, and the current freshness rule keys on the last successful plan. [Change note](change.md) · [Review freshness](../../../skills/10x-pipeline/scripts/flow.mjs#L795)
- For old halts, the timestamp fallback is sufficient upgrade evidence when `meta.outcome` carries the old halt text prefix and the current plan passes the structural gate. Existing result intake records `finishedAt` and existing artifact recovery already uses freshness timestamps. [Result intake](../../../skills/10x-pipeline/scripts/flow.mjs#L652) · [Review recovery](../../../skills/10x-pipeline/scripts/flow.mjs#L721)

## References

- [Change and reproduction](change.md)
- [Routing and worktree recovery](../../../docs/REFERENCE.md)
- [ADR-003 code re-plans](../../../docs/ADR/ADR-003-rigor-gated-routing.md#code-re-plans)
- [Existing re-plan CLI tests](../../../skills/10x-pipeline/test/codereplan.test.mjs) · [Isolation tests](../../../skills/10x-pipeline/test/rollback.test.mjs)

## Progress

> Append ` — <commit sha>` when a step lands. Keep row IDs and titles stable.

### Phase 1: Restore the resume path

#### Automated

- [ ] 1.1 Failed re-plan CLI cases halt with repair instructions on first intake and keep halting for unchanged or invalid plans until a valid edit allows both resume commands to route normally.
- [ ] 1.2 Recovery preserves failure accounting, the re-plan cap, review and step-budget gates, and recognizes supported legacy halt records.
- [ ] 1.3 Isolated CLI recovery restores the failed re-plan's partial edits and preserves a committed repair through rollback of a later failed step.
- [ ] 1.4 The full router suite passes on Node 24 or later.
