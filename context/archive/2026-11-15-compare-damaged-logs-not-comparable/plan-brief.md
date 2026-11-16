# Reject Damaged Comparison Evidence — Plan Brief

[Full implementation plan](plan.md)

## What & Why

Damaging a usage record can turn a missed savings target into `met`. The existing comparison retains partial records and diagnostics, then checks completeness using only the surviving records. This change makes every reported log problem disqualify the pair.

## Starting Point

The real CLI reproduction on both chains compares 1,000 baseline tokens with 1,100 routed tokens at a 30% target and returns `not met`. Truncating the routed 600-token record leaves 500 visible tokens and incorrectly returns `met`. `comparePair` already owns shared eligibility, while the reader and Markdown renderer expose the necessary evidence.

## Desired End State

Damage on either side produces `comparable: false`, `dropPercent: null` and `verdict: "not comparable"`, with a reason identifying each affected side. Partial totals and sanitized file/line/reason diagnostics remain available. Both chains and `--unpinned` follow this rule, and clean comparisons retain their existing results.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Eligibility owner | Extend `comparePair`'s existing side checks | Both chains and output formats share this path | Source inspection |
| Reason spelling | `log-problems:baseline` and `log-problems:routed` | Follows existing side-attributed eligibility reasons | Plan assumption |
| Reading and evidence | Retain tolerant reads and partial figures | The brief requires continued investigation and privacy | Change brief |
| Verification | Real CLI fixtures in the two existing test files | Existing helpers provide paired runs, both chains, snapshots and fault injection | Source inspection |
| Delivery | One implementation phase, pipeline reviews, orchestrator publication | Runtime scope is bounded and step rules assign publication ownership | Plan and step rules |

## Scope

The change reaches comparison eligibility in `route.mjs`, focused regressions in `compare.test.mjs` and `run-state.test.mjs`, and the damaged-log and comparison reference descriptions. Implementation evidence records the final candidate and test results.

Saved-run storage, policy, log repair, branch naming, benchmark collection and the deferred FR-017 experiments retain their separately assigned scope.

## Architecture / Approach

The tolerant reader returns usable entries and diagnostics. `readSide` exposes both, and `comparePair` uses any diagnostics as side-specific eligibility reasons before deciding the drop and verdict. JSON prints that pair, and Markdown renders the same result. Regression fixtures begin from eligible completed runs so the damage is the deciding cause.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Enforce comparison integrity and verify the delivery | Eligibility fix, focused cases, reference updates and full-suite evidence | Unrelated fixture eligibility failures could hide a missing integrity check |

**Prerequisites** Wave 0 is merged. The declared Wave 1 runtime and test ownership is disjoint. Recheck any newly committed sibling plan/diff before implementation, and coordinate the shared reference by section. Node 24+ runs the repository gates. For in-worktree scratch tests, use the plan’s disposable PATH Git launcher and verify Git discovery through a `cleanEnv` child before the gates.

**Estimated effort** One bounded implementation phase followed by the existing pipeline reviews and terminal publication flow.

## Open Risks & Assumptions

- The unattended instruction delegates complexity and phase choices. The plan assumes low complexity, zero substantive questions and one phase from the settled brief and shared eligibility owner.
- The selected reason spelling follows repository convention and remains subject to plan review.
- The sibling branch had only run artifacts at planning inspection. Shared runtime or policy expansion requires serialization, and shared reference edits require section-level coordination.
- Old plugin revisions retain the false-success bug. Saved files require no migration, and integrity-qualified comparisons use the corrected revision.
- The shared helper strips inherited `GIT_*` variables. The local Git launcher supplies the discovery boundary after that filtering while preserving fixture-owned ceilings. Its child-level isolation checks are recorded with verification evidence.
- Publication, PR CI and the requested report comment remain Manual acceptance owned by the orchestrator.

## Success Criteria (Summary)

- The 1,100-token clean routed run remains `not met`, while the damaged 500-token partial view becomes `not comparable` across both chains and formats.
- Either/both-side damage, non-object records and read failures disqualify pinned and `--unpinned` comparisons, preserving diagnostics, partial figures, privacy and byte-identical inputs.
- Focused tests, reference consistency and the required full suite pass locally. The orchestrator then publishes the reviewable PR, verifies CI and posts the requested run-report comment.

## References

- [Change brief](change.md)
- [Full plan, ownership and verification commands](plan.md)
- [Wave 1 ownership ledger](../WAVES.md)
- [Sibling branch-prefix scope](../run-branch-prefix-consistency/change.md)
