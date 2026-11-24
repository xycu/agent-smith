# Record Owner Approval to Archive With Unresolved Manual Checks — Plan Brief

[Full implementation plan](plan.md)

## What and Why

When the owner approves a 10x archive with unresolved checks, the change should carry a record of that decision, the deferred rows and where to finish proving them. The archive can then close the change while keeping its acceptance history readable. [Change acceptance](change.md#acceptance)

## Starting Point

The 10x gate already asks before moving a change with unresolved rows. S-13 and S-14 kept their owner decisions and row IDs in closeout evidence, with S-20 responsible for further qualification. [10x archive loop](../../../skills/10x-pipeline/SKILL.md#loop) [S-13 decision](../../archive/2026-11-16-openspec-2-upgrade/evidence/acceptance.md#owner-archive-decision) [S-14 closeout](../../archive/2026-11-16-nested-step-delegation/evidence/acceptance.md#publication-verification-and-archive-closeout)

## Desired End State

After `Yes, archive anyway`, the owner or authorized operator records the approval before the move. The note covers each distinct ID in `manualPending`, `manualUnproven` and `uncommittedTicks`, with the reason and a destination that identifies the follow-up owner. The original rows, evidence and commit references travel with it. Empty lists take the normal path without a note. Refusal or an unavailable answer leaves the change open and reports the checks without creating an approval note.

## Key Decisions Made

| Decision | Choice | Reason |
| --- | --- | --- |
| Record location | `evidence/archive-manual-decision.md` in the live change before the move | S-13 and S-14 show that closeout evidence can carry the owner's decision and unresolved rows. |
| Row coverage | One entry per ID from the full summary, retaining all applicable categories | A row can be in more than one list. The question preview can omit pending rows. |
| Follow-up | A concrete destination, such as a roadmap slice, change ID or issue, that identifies the owner | A later reader can locate the outstanding obligation, as in the S-20 handoff. |
| Documentation | ADR-014 holds the procedure and a worked example. The 10x archive reference links to it. | Readers can find it alongside the existing gate. |

## Scope

The documentation covers future 10x approvals. Runtime, external installed skills, OpenSpec, S-19's broader owner-decision flow and historical backfill are outside this change.

## Approach

Use a short Markdown note with the explicit approval and row-level entries. Write it in the live folder and commit it on the run branch before the Git mover's clean-folder preflight. Keep the Progress rows and evidence intact so future readers can see exactly what proof existed at closeout.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Document the archive exception record | One canonical procedure, a worked example covering all three lists and a reference link | The note could be mistaken for proof or for an automatic router output. |

**Prerequisites** Local Git, Node 24+ and the existing 10x archive fixtures.

**Estimated effort** One short documentation and verification pass.

## Open Risks and Assumptions

- One phase and a dedicated evidence note follow the established closeout pattern and the narrow docs scope.
- The pipeline orchestrator writes no note today: its `Yes` path launches the archive subagent at once and the skill forbids writes into the moving folder. The procedure covers a hand-run `/10x-archive` closeout, and S-19 owns wiring it into the orchestrator. ADR-014 gets an `Amendment 1` section, as ADR-017 does.
- The procedure depends on an owner or authorized operator recording the decision before the move. The existing verifier checks the folder move and status stamp.

## Success Criteria Summary

- Automated checks resolve the documentation links, check overlap and full list coverage, verify record retention in a scratch Git move and run the focused archive tests.
- A reviewer can follow all three gate outcomes and trace each deferred row from the example to its follow-up owner while retaining its original proof state.

## References

- [ADR-014](../../../docs/ADR/ADR-014-archive-manual-gate.md) and [10x archive reference](../../../docs/REFERENCE.md)
- [Audit decision](../../archive/2026-11-19-docs-status-truth-up/change.md#archive-decision-2026-11-19) and [S-20 follow-up](../../foundation/roadmap.md#s-20-recorded-support-across-all-agreed-configurations)
