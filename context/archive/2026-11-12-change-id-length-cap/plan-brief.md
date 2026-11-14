# Change ID Length Cap — Plan Brief

> Full plan in [plan.md](plan.md).

## What & Why

Reject change ids longer than 100 characters at router initialization for both chains. Today those ids start valid runs but are refused by the PR scripts when the run ends.

## Starting Point

The router already validates the id grammar before loading policy, but permits unlimited length. PR helpers already cap ids at 100 characters. Both skill files describe the mismatch, and one content assertion requires that outdated caveat.

Planning reproduced the 100/101 boundary on Node 24.19.0. Both chains started a 101-character run, and a malformed project policy was read before any length refusal.

## Desired End State

An otherwise valid 100-character id starts its normal first step. A 101-character id produces halt JSON naming the limit before project reads, locks or writes. Existing longer-id runs remain reachable through the other router commands.

## Key Decisions Made

| Decision | Choice | Reason | Source |
| --- | --- | --- | --- |
| Threshold | 1–100 characters at every init | Matches existing PR-script acceptance | change.md |
| Ownership | Router ID_RE in state.mjs, independent PR-helper ID_RE | Respects the existing dependency boundary | change.md and code |
| Ordering | Check before loadPolicy(), after syntax and chain arguments | Policy loading already accesses project files | route.mjs and state.mjs |
| Compatibility | Other commands retain longer-id acceptance | Existing runs need inspection and continued command access | change.md |
| Regression proof | Pattern parity, both-chain boundaries, read traps and byte snapshots | Covers agreement, ordering and refusal safety | Plan |
| Content tests | Update the pin requiring the obsolete caveat | Both skill edits otherwise break the current suite | pr-comment.test.mjs |
| Wave 6 | Distinct id-related README/reference passages | Shared-text rules permit these edits alongside document drift fixes | WAVES.md |

## Scope

The implementation covers the state export, early init check, a focused test file and its index row, both PR-comment caveats, their content assertions, and the change-id passages in README and the reference.

Implementation writes stay within the file/region ownership table in the full plan. WAVES.md and repository archives stay outside that write set.

## Architecture / Approach

Preserve the common unbounded syntax check used by legacy commands. Import the bounded router pattern into main() and apply it only to init before project access. Compare it directly with the PR helper's pattern in tests. Use existing fixture builders and state writers for both chains.

## Phases at a Glance

| Phase | Deliverable | Main risk |
| --- | --- | --- |
| 1. Enforce the Init Boundary and Prove Compatibility | Shared validation, both-chain boundary/parity/legacy tests and test index | A common guard could block legacy commands |
| 2. Align User Guidance and Run Regression Verification | Corrected caveats, documented limit, content assertions and full-suite proof | Existing content pins and shared-document integration |

The prerequisites are the current Wave 6 baseline and Node 24+. Estimated effort is one small change across two implementation phases.

## Open Risks & Assumptions

- Every init, including a resume of an existing longer-id run, applies the limit. Other commands supply legacy access, following the ticket.
- Legacy longer-id runs still face the PR scripts' existing end-of-run limit.
- The task and repository evidence settle the unattended planning decisions. All eight acceptance rows are automated and start pending.
- Shared README/reference changes may require ordinary merge-conflict resolution when Wave 6 branches integrate.

## Success Criteria (Summary)

- Both chains accept 100 characters and halt at 101 before project access, with byte-identical refused fixtures.
- Router and PR acceptance agree, and legacy longer-id command access passes regression checks.
- Both skills and public guidance match the behavior, with the required repository suite passing during implementation.

## References

- [Change requirements](change.md)
- `context/changes/WAVES.md`, Wave 6 and shared-text exception
- `skills/10x-pipeline/scripts/route.mjs:893`, `state.mjs:64` and `pr-common.mjs:10`
- `skills/10x-pipeline/test/pr-comment.test.mjs:748`
