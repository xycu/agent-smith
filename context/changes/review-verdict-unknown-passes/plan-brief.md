# Review Verdict Validation — Plan Brief

[Full implementation plan](plan.md)

## What & Why

An unattended run should advance only on a recognized review verdict. It also needs to distinguish an owner's correction from an older valid review that Git restored after a failure.

## Starting Point

Phase 1 added verdict validation. Commit `49f6c36e` addressed review findings F1–F5 in routing, parsing and documentation. F6 remains open. An interrupted rollback can give an older valid review a fresh checkout timestamp, which the router can mistake for a correction. [Implementation review](reviews/impl-review.md)

## Desired End State

A new review with an invalid or missing verdict fails verification. An existing invalid review selected for routing halts with its path and verdict problem. After an interruption, the original failure continues to block advancement until a fresh, valid correction satisfies the findings gates.

## Key Decisions Made

| Decision | Choice | Rationale |
| --- | --- | --- |
| Vocabulary | Plan accepts `SOUND`, `REVISE`, `RETHINK`. Implementation accepts `APPROVED`, `NEEDS ATTENTION`, `REJECTED`. | One set per review kind governs both intake and routing. |
| Header format | Read one standalone bold Verdict label in the review header. Preserve the supported annotation delimiters and check the whole candidate. | Inline prose and an unsupported suffix cannot supply a passing verdict. |
| Recovery | Retry an ordinary malformed result within the existing limits. Halt on a malformed confirmation or an existing invalid review used for routing. Reuse the recorded diagnostic across resume until a fresh correction can route. | An isolated rollback can restore the earlier review after a confirmation fails. |
| Interrupted timestamp restoration | Record pending timestamp work alongside the failed step's recovery ref. Resume it before routing and preserve edits made since the reset. | Git can assign a fresh timestamp to unchanged review contents. The snapshot and failed log entry must survive a second interruption. |
| Partial implementation | Halt on a blocking plan verdict when a prior code attempt or automated tick exists and unchecked or reopened rows still need implementation. | The same gate covers plain implementation, executor dispatch and retries. |

## Scope

10x review parsing, intake and routing, shared rollback timestamp restoration, local CLI tests and `docs/REFERENCE.md`. OpenSpec uses the shared rollback and validates its own verdict vocabulary.

## Architecture / Approach

The artifact reader extracts the complete verdict. Shared validation in the router applies the appropriate vocabulary both when it consumes a step result and when it reads an existing review. The normal retry and halt paths retain responsibility for recovery.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Validate verdicts before advancing | Verdict guards, CLI regressions, archive comparison and routing documentation | Mistaking a malformed verdict for a valid prefix or reading a restored review after a failed confirmation |
| 2. Resume timestamp restoration after an interrupted rollback | Recover pending file times during `init` or `next` and verify that a genuine edit survives | A restart can otherwise advance on an unchanged review or overwrite the timestamp of an owner's correction |

**Prerequisites** Node.js 24+ and local Git for isolated scratch tests.

**Remaining work** One recovery phase, its interruption tests and the full local suite.

## Open Risks & Assumptions

- Four archived reviews use historical labels outside the current vocabulary. The archive comparison preserves their parsed text. A live review with one of those labels must use a valid verdict before it can authorize advancement. [Archive baseline](plan.md#migration-notes)
- The change uses the canonical spellings from the change request and the existing delimited annotation formats found in fixtures and archives. [Planning assumptions](plan.md#planning-assumptions)
- F6 belongs in this change because the restart can bypass the verdict gate. Finish a pending timestamp restore with the updated router before downgrading. An ambiguous legacy checkout requires a distinguishable review correction. [Migration notes](plan.md#migration-notes)

## Success Criteria (Summary)

- The focused CLI tests cover false successes, retry and confirmation halts, corrected resumes and blocking verdicts when implementation work remains.
- The read-only archive comparison preserves every parsed verdict and header count.
- Local interruption tests prove repeated resumes preserve the failed snapshot and log, keep an unchanged confirmation halted, and route a genuine correction through its findings.
- The full local suite passes.

## References

- [Change](change.md)
- [Full plan and verification commands](plan.md)
