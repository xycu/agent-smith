# Recovering from a failed re-plan

> [Full implementation plan](plan.md)

## What & Why

A 10x run stops when its automatic re-plan after failed implementation attempts fails. The owner can repair the plan today, but the same failed log entry keeps the run halted. This change gives the owner a way to continue the same run.

## Starting Point

`init` and `next` both route from the last executed step. The failed `plan-replan` entry remains last, so a plan repair currently has no effect on the halt. [Reproduction](change.md)

## Desired End State

The first halt tells the owner to edit `plan.md`, keep the previously checked Automated rows, and leave pending Automated work in `## Progress`. In an isolated run, the owner commits the repair in the run worktree before resuming. Either resume command can then route from the current plan. When the plan is still invalid or unchanged, the router explains what remains to fix.

## Key Decisions Made

| Decision | Choice | Evidence |
| --- | --- | --- |
| First halt | Record the acknowledgement and plan fingerprint on the failed log entry. | The shared router already persists a per-step halt acknowledgement. |
| Repair validation | Require changed plan content, pending Automated work, and the previously checked Automated row IDs. | The code re-plan verifier already checks pending work and kept IDs. |
| Resume routing | Use existing review rules, attempt streaks and budgets. | The change asks for continued routing with a repaired plan and preserved limits. |
| Existing halted runs | Use the recorded halt and a later plan modification time as one-time evidence when the saved entry predates fingerprints. | Old entries store result timestamps. |

## Scope

The 10x failure-triggered `plan-replan`, its local CLI acceptance tests and the operator documentation are in scope. Other plan templates and OpenSpec continue to use their existing recovery paths.

## Architecture / Approach

The router records what the failed re-plan left, then returns through its normal halt path so the worktree holds the partial edits for repair. On resume, it checks the current plan against that baseline and the existing verifier before using the usual routing decisions. The failed step stays in history and continues to count toward limits.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Restore the resume path | Durable recovery, actionable halt text, local regression tests and operator guidance | An early branch could bypass the halt, or a baseline taken after rollback could point at the wrong plan. |

**Prerequisites**. Node 24 or later and Git for the local worktree fixture.

**Estimated effort**. One implementation session.

## Open Risks & Assumptions

- The owner supplies the substantive correction. The router can verify an edit and the plan's structure.
- Older halted entries have no content fingerprint. A later plan modification time is the fallback when the recorded halt can be identified. If freshness cannot be established, the router sets a baseline and guides the owner through another repair.

## Success Criteria (Summary)

- Local CLI tests show both resume commands continue after repair, while unchanged or invalid plans keep the run halted.
- Local CLI tests preserve limits and demonstrate that the owner's committed correction survives a later isolated rollback.
- The full router suite passes, and the reference explains the resume path.

## References

- [Full plan and verification commands](plan.md)
- [Change and reproduction](change.md)
- [Router reference](../../../docs/REFERENCE.md) · [Code re-plan verification](../../../skills/10x-pipeline/scripts/steps.mjs#L513)
