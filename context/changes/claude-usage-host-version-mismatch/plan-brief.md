# Claude Desktop transcript usage capture plan brief

[Full plan](plan.md) · [Frame brief](frame.md) · [Research](research.md)

## What & Why

Transcript-mode capture trusts a host version that the orchestrator cannot observe, over the versions it reads from the transcript records, and when that guess is wrong the failure evidence drops the invocation identity that late recovery needs.

In PR #294, the command-line version differed from the version written by Claude Desktop. Remeasuring the five native steps without the descriptor version recovered 3,874,071 transcript tokens, but the original evidence lacked the fields needed to attach them. [Frame brief](frame.md)

## Starting Point

Both pipelines use the shared transcript collector. It already checks attributed record versions against the 2.1.311 floor and validates the invocation. Its descriptor version check happens before the invocation is recorded. [Research](research.md)

## Desired End State

A native Claude Desktop run records token figures and a version from its transcript records. An unavailable measurement retains the exact invocation when established. The late usage command can attach a matching measurement when the original qualified record version also survived.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Version authority | Omit the version from transcript descriptors. Ignore it if a caller sends it. | The records identify the writer and the CLI on PATH may be a different version. | Frame, research, plan |
| Version failures | Use `version-conflict` for disagreement, `unsupported-schema` for missing or malformed versions, and `unsupported-host` for a below-floor transcript version. | Each failure identifies a different condition and should explain why tokens are missing. | ADR-018, plan |
| Identity on failure | Retain a validated, complete observed invocation or one established from root metadata. Remove it when root identity is contradicted. | ADR-019 needs exact attribution and the collector can establish it before measurement. | Research, plan |
| Late attachment | Keep the exact source, version and invocation match. | An observation with unknown version or absent identity cannot be matched under the existing contract. | ADR-019 |
| Live acceptance | Keep a sanitized evidence file from a live Desktop run with a recorded native Claude token figure. | Prior fixture and remeasurement evidence left this live path unproven. | Frame, research |

## Scope

- Shared transcript collector, reason normalization and tests for both chains.
- Both SKILL.md files, the relevant accounting and late-usage reference sections (including the reasons list) and an ADR-019 amendment.
- The top-of-report limitations line keeps its labels; `version-conflict` shows only in the per-step coverage entry.
- Existing telemetry, historical ledger and ADR-019 contracts form the compatibility boundary.

## Architecture / Approach

The collector establishes invocation identity from validated host IDs and metadata. It separately qualifies the version from the matched main and agent records. The wrapper normalizes either the measured evidence or the unavailable result, and the router applies the existing attachment contract.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Correct transcript evidence and verify late attachment | Collector and CLI regressions for version authority, identity retention, matching attachment and refusals. | An early failure could lose identity, or a root identity contradiction could leave stale attribution. |
| 2. Align both chains and qualify Claude Desktop | Consistent instructions and one live evidence file, with the existing byte ceilings and pins intact. | A fixture can pass while the Desktop integration remains unproven. |

**Prerequisites** Node 24+ for local checks and a fresh native Claude Desktop session running the changed plugin for the Manual row.

**Estimated effort** One focused implementation session plus one live Desktop run.

## Open Risks & Assumptions

- A live native run is needed to close the Manual row. Keep it pending until its sanitized evidence file shows the actual recorded figure.
- A failure before any record establishes a qualified version can retain identity while remaining ineligible for late attachment.

## Success Criteria (Summary)

- Collector fixtures establish record version authority, precise failure reasons and exact identity retention. Router CLI fixtures prove late attachment and byte-identical refusals on both chains.
- Both skill files pass their existing byte ceilings and pinned loop checks.
- A live native Claude Desktop pipeline run records Claude token figures and retains its evidence file under `evidence/`.

## References

[Observed token accounting](../../../docs/REFERENCE.md#observed-token-accounting) · [ADR-018](../../../docs/ADR/ADR-018-no-nested-subagents.md) · [ADR-019](../../../docs/ADR/ADR-019-late-usage-figure.md)
