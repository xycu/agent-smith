# Review Verdict Validation — Plan Brief

[Full implementation plan](plan.md)

## What & Why

The 10x router can report success for a review whose verdict it does not recognize. In unattended runs this can advance implementation or report that rejected work passed review.

## Starting Point

The header reader can truncate a verdict, step intake accepts any nonempty word, and routing can treat an unreadable implementation review as `APPROVED`. The CLI reproduced all three behaviors. [Change](change.md)

## Desired End State

A new review with an invalid or missing verdict fails verification. An existing invalid review selected for routing halts with its path and verdict problem. A valid review proceeds through the existing findings gates.

## Key Decisions Made

| Decision | Choice | Rationale |
| --- | --- | --- |
| Vocabulary | Plan accepts `SOUND`, `REVISE`, `RETHINK`. Implementation accepts `APPROVED`, `NEEDS ATTENTION`, `REJECTED`. | One set per review kind governs both intake and routing. |
| Header format | Read one standalone bold Verdict label in the review header. Preserve the supported annotation delimiters and check the whole candidate. | Inline prose and an unsupported suffix cannot supply a passing verdict. |
| Recovery | Retry an ordinary malformed result within the existing limits. Halt on a malformed confirmation or an existing invalid review used for routing. Reuse the recorded diagnostic across resume until a fresh correction can route. | An isolated rollback can restore the earlier review after a confirmation fails. |
| Partial implementation | Halt on a blocking plan verdict when a prior code attempt or automated tick exists and unchecked or reopened rows still need implementation. | The same gate covers plain implementation, executor dispatch and retries. |

## Scope

10x review parsing, intake and routing, CLI regression tests, compatibility checks and `docs/REFERENCE.md`. OpenSpec already enforces its own review vocabulary.

## Architecture / Approach

The artifact reader extracts the complete verdict. Shared validation in the router applies the appropriate vocabulary both when it consumes a step result and when it reads an existing review. The normal retry and halt paths retain responsibility for recovery.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Validate verdicts before advancing | Verdict guards, CLI regressions, archive comparison and routing documentation | Mistaking a malformed verdict for a valid prefix or reading a restored review after a failed confirmation |

**Prerequisites** Node.js 24+ and local Git for isolated scratch tests.

**Estimated effort** One implementation session plus the full test run.

## Open Risks & Assumptions

- Four archived reviews use historical labels outside the current vocabulary. The archive comparison preserves their parsed text. A live review with one of those labels must use a valid verdict before it can authorize advancement. [Archive baseline](plan.md#migration-notes)
- The change uses the canonical spellings from the change request and the existing delimited annotation formats found in fixtures and archives. [Planning assumptions](plan.md#planning-assumptions)

## Success Criteria (Summary)

- The focused CLI tests cover false successes, retry and confirmation halts, corrected resumes and blocking verdicts when implementation work remains.
- The read-only archive comparison preserves every parsed verdict and header count.
- The full local suite passes.

## References

- [Change](change.md)
- [Full plan and verification commands](plan.md)
