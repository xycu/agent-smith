# Record Owner Approval to Archive With Unresolved Manual Checks

## Overview

Document what an approved 10x archive exception leaves behind. The record travels with the change and tells a later reader what the owner agreed to defer, why proof was deferred, and where to follow up. [Change acceptance](change.md#acceptance)

## Current State Analysis

The 10x orchestrator asks before launching the archive subagent when any of the three Manual exception lists contains entries. All lists empty takes the normal path. A refusal, unavailable answer or question-tool error stops the archive and reports the outstanding checks. The router produces the summary and commits the live folder before the question. Its file-only archive check verifies the move and status stamp. [10x archive loop](../../../skills/10x-pipeline/SKILL.md#loop) [Archive reference](../../../docs/REFERENCE.md)

S-13's closeout records the owner decision on row 3.4, why six live cells remained open and where S-20 would qualify them. S-14 carries rows 1.3 and 3.4 and twelve pending cells into S-20. Both preserve the rows and existing commit references. These are precedents for recording deferral in the change's own evidence. [S-13 decision](../../archive/2026-11-16-openspec-2-upgrade/evidence/acceptance.md#owner-archive-decision) [S-14 closeout](../../archive/2026-11-16-nested-step-delegation/evidence/acceptance.md#publication-verification-and-archive-closeout) [S-20 carried acceptance](../../foundation/roadmap.md#s-20-recorded-support-across-all-agreed-configurations)

### Key Discoveries

- `manualPending` contains row text that starts with its Progress ID, and `manualUnproven` contains IDs for checked Manual rows with unproved evidence. `uncommittedTicks` contains checked Automated row IDs without verified commit evidence. `manualNotProved` and `manualUnprovenWhy` can supply reasons. The prompt's ten-row display limit applies only to the pending preview. [Progress reader](../../../skills/10x-pipeline/scripts/state.mjs) [Proof checks](../../../skills/10x-pipeline/scripts/steps.mjs) [Summary construction](../../../skills/10x-pipeline/scripts/flow.mjs) [10x archive loop](../../../skills/10x-pipeline/SKILL.md#loop)
- The standalone archive skill's Git preflight expects a clean live change folder and an empty index. The durable note must be tracked before using that mover. The existing pipeline archive prompt chooses archive without SHA repointing. [Archive reference](../../../docs/REFERENCE.md)

## Desired End State

Document three outcomes for future 10x closeouts.

| Gate outcome | Recorded closeout |
| --- | --- |
| All three lists empty or omitted | Proceed normally without an exception note. |
| Owner selects `Yes, archive anyway` with unresolved rows | Record the decision before the move. The moved evidence contains one entry for each distinct ID in the full union of the three lists, its reason and its follow-up destination. |
| Owner refuses, the answer is missing, or the question tool fails or is unavailable | Keep the change unarchived, report the unresolved checks and create no approval note for the attempt. |

The note leaves original Progress rows intact, including checkbox and title, evidence suffixes and commit SHA suffixes. Existing supporting evidence stays with the change. Approval authorizes deferral of proof.

## Scope Boundaries

This phase covers documentation for future 10x approvals. Runtime gate behavior, skill and prompt instructions, router state and policy, OpenSpec behavior and historical archives are outside the implementation scope. S-19 owns broader owner-decision halts. [Audit decision](../../archive/2026-11-19-docs-status-truth-up/change.md#archive-decision-2026-11-19) [S-19](../../foundation/roadmap.md#s-19-truthful-verification-and-owner-decision-halts)

## Implementation Approach

Use ADR-014 for the canonical procedure and a compact worked example. Add a link beside the gate in the 10x archive reference so an owner or authorized closeout operator can find it. Use `evidence/archive-manual-decision.md` in the live change folder as the default location for future records. The evidence folder follows the same convention as S-13 and S-14.

## Critical Implementation Details

Write the note after explicit approval and while the folder is live. On a Git-backed closeout, make a scoped commit of the note in the run worktree before handing off to the mover, so archive's clean-folder and empty-index checks can still pass. Confirm the tracked note traveled in the archive commit or its history alongside the preserved plan and evidence. The reference should describe this as an operator procedure and make the scope of `verify-archive` clear.

## Phase 1: Document the archive exception record

### Overview

Give maintainers a repeatable procedure that records every unresolved ID and preserves the acceptance history.

### Changes Required

#### 1. ADR-014

**File** `docs/ADR/ADR-014-archive-manual-gate.md`

**Intent** Document the positive exception alongside the existing decision and link the two historical precedents.

**Contract** Add a clearly labeled 10x documentation section with the three outcomes above. Define the note as an approval header plus one entry per distinct Progress ID. Record the exact approval, date and owner identity or role, and a stable decision reference when available. In the entries, retain all applicable unresolved categories, the concrete reason for deferral and a traceable destination that identifies who owns the follow-up, such as a roadmap slice, change ID or issue. Include relevant reported proof or commit gaps. Where the summary lacks a reason, obtain the reason from the closeout evidence or owner decision and identify any unavailable proof or commit information accurately. A missing evidence or SHA reference stays missing. Associate each entry with its original Progress row and preserve existing references.

Use the full saved archive summary, including pending rows omitted from the native prompt preview. Resolve overlap by ID and retain relevant context from each source list. Include a worked example with distinct IDs `1.1` (Automated, uncommitted), `1.2` (Manual, pending) and `1.3` (Manual, unproven), complete with reasons and destinations. Show unchecked and checked source rows remaining as recorded. Illustrate duplicate handling as a separate synthetic input, since the normal summary draws these categories from different Progress states.

#### 2. 10x reference

**File** `docs/REFERENCE.md`

**Intent** Put the closeout instructions where readers already look for archive behavior.

**Contract** Link the ADR section directly from the 10x archive guidance. Explain the live-folder location, affirmative-only timing and existing clean handoff. Preserve the documented refusal and normal paths and the distinction between an owner-written note and file-only move verification.

### Success Criteria

#### Automated Verification

- Run `git diff --check`, resolve the new local document links and headings, and confirm the product diff is limited to ADR-014 and the 10x reference.
- Check the documented record against deterministic fixtures for overlapping and truncated input, then verify a scratch Git move preserves the tracked record and source evidence.
- Run `node --test --test-concurrency=2 skills/10x-pipeline/test/archive-gate.test.mjs skills/10x-pipeline/test/archive.test.mjs`.

#### Manual Verification

- A reviewer can trace the documented approval, deferred checks and follow-up owners from the example and follow the empty-list and refusal paths without treating an unresolved check as proved.

## Testing Strategy

### Local Checks

- Use a local Node assertion to compare the worked example's IDs to the expected set `1.1`, `1.2`, `1.3` and check each entry has a reason and destination. Exercise a separate synthetic summary with 11 pending entries and the eleventh ID repeated in an unproved list. Compare the written example of the duplicate rule to the expected full union of 11 entries, with the eleventh ID recorded once and both reasons retained. Check the two non-approval outcomes in the documentation, including missing/error answers and reporting the unresolved checks.
- In a disposable local Git fixture, commit a source plan with an unchecked row, a checked row with an evidence reference and a checked row with a SHA suffix, plus the referenced evidence and the approval note. Simulate the tracked folder move with `git mv` and an archive commit. Compare the note, plan and evidence bytes before and after and confirm the move commit contains the archived note. This proves file retention in the documented procedure.
- Run the two existing focused test files to check the gate instructions and router archive behavior. Git remains local. The fixtures demonstrate record coverage and preservation, and the tests cover the current gate and move verification.

### Manual Testing Steps

1. Read the example as a future reviewer. Find the actual decision, each distinct row, the reason proof is outstanding and who takes the next action.
2. Walk the empty-list path and the refusal or missing-answer path using the written procedure. Check that each produces the disposition in the table and leaves the original proof state intact.

## Performance Considerations

The change adds a short closeout note only on affirmative exceptions. Its size follows the distinct unresolved row count.

## Migration Notes

The convention applies to future 10x decisions. Existing archive records, checkboxes and evidence retain their historical state.

## Open Risks and Assumptions

- The unattended plan uses one phase because the acceptance concerns one documentation procedure and its reference link. ADR-014 owns the gate decision and the reference already points readers to it. [ADR-014](../../../docs/ADR/ADR-014-archive-manual-gate.md) [Reference](../../../docs/REFERENCE.md)
- Use a dedicated evidence note and a follow-up reference that identifies its owner. S-13 and S-14 establish the evidence location and the example of a concrete roadmap destination. [S-13 decision](../../archive/2026-11-16-openspec-2-upgrade/evidence/acceptance.md#owner-archive-decision) [S-14 closeout](../../archive/2026-11-16-nested-step-delegation/evidence/acceptance.md#publication-verification-and-archive-closeout)
- This convention relies on an owner or authorized closeout operator to record the decision before the move. The archive verifier's success concerns the folder and stamp. [Archive reference](../../../docs/REFERENCE.md)

## References

- [Change acceptance](change.md#acceptance) and [audit decision](../../archive/2026-11-19-docs-status-truth-up/change.md#archive-decision-2026-11-19)
- [ADR-014](../../../docs/ADR/ADR-014-archive-manual-gate.md), [10x archive loop](../../../skills/10x-pipeline/SKILL.md#loop) and [routing reference](../../../docs/REFERENCE.md)
- [S-13 acceptance](../../archive/2026-11-16-openspec-2-upgrade/evidence/acceptance.md#owner-archive-decision), [S-14 acceptance](../../archive/2026-11-16-nested-step-delegation/evidence/acceptance.md#publication-verification-and-archive-closeout) and [S-20 qualification](../../foundation/roadmap.md#s-20-recorded-support-across-all-agreed-configurations)

## Progress

> Convention. Mark rows when verified and append ` — <commit sha>` when they land. Keep row titles fixed.

### Phase 1: Document the archive exception record

#### Automated

- [ ] 1.1 Run `git diff --check`, resolve the new local document links and headings, and confirm the product diff is limited to ADR-014 and the 10x reference.
- [ ] 1.2 Check the documented record against deterministic fixtures for overlapping and truncated input, then verify a scratch Git move preserves the tracked record and source evidence.
- [ ] 1.3 Run `node --test --test-concurrency=2 skills/10x-pipeline/test/archive-gate.test.mjs skills/10x-pipeline/test/archive.test.mjs`.

#### Manual

- [ ] 1.4 A reviewer can trace the documented approval, deferred checks and follow-up owners from the example and follow the empty-list and refusal paths without treating an unresolved check as proved.
