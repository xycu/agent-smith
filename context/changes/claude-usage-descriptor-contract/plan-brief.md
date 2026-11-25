# Native Claude step usage — plan brief

[Full plan](plan.md) · [Frame](frame.md) · [Research](research.md)

## What & Why

Ten runs lost every native Claude token figure, including a score step whose transcript later measured 325,516 tokens. Claude step accounting depends on an optional, unchecked orchestrator ritual. The model must remember to run it and must hand-build a nested descriptor of facts the router already holds. The router does not take that work over and cannot tell when the ritual was skipped.

## Starting Point

Both pipelines share an intake path and a collector that already handles settled background launches. Today some orchestrators skip that collector, send a malformed descriptor or reuse an earlier result.

## Desired End State

After a native step settles, `next` records its transcript subtotal or a bounded reason the figure is unavailable. Status and reports show the scope. Step verification still judges the work.

## Key Decisions Made

| Decision | Choice and rationale | Source |
| --- | --- | --- |
| Ownership | Measure at intake using the existing collector. The router has the dispatch facts. | Frame, research, plan |
| Host handoff | Pass only the matched Agent ID on `next --agent-id`. A step-authored RESULT cannot supply it. | Research, plan |
| Session | Bind each dispatch to its native session. A different session records unavailable. Neutral replay gets a fresh boundary. | Current-session reader, plan |
| Timing | Read once after settlement. If the host has yet to flush completion, keep attributable evidence for the single eligible late recheck. | Research, ADR-019 |
| Missing evidence | Record the reason, leave tokens absent and continue. | ADR-018/019 |
| Version | Keep a qualified version observed on the attributed source. Unknown or conflicting versions preclude late attachment. | Existing collector and late matcher |

## Scope

Covers numbered native steps on both chains, opt-in bound telemetry, malformed collector stdin, and the archive and late callers that share the loop instructions. Existing ledgers and historical project backfill are outside the change.

## Architecture / Approach

The router stores a session ID or telemetry checkpoint at dispatch. Intake uses the matched launch, the saved attempt boundary and existing collector checks. Eligible late rows and native archive actions supply ready-to-forward collector inputs. Late attachment retains exact identity, source and version checks. Archive evidence goes only into the final message.

## Phases at a Glance

| Phase | Deliverable | Key risk |
| --- | --- | --- |
| 1 | Router measures during numbered result intake on both chains. | Repeated descriptions, session changes and crashes must preserve attribution. |
| 2 | Malformed input gets `invalid-json`. Late and archive collection use router-derived identity. | Incomplete evidence can prevent late recovery. |
| 3 | Shorter loops, updated command reference and revised contract guards. | The ID must survive async hand-back and result-write recovery. |

Node 24+ and the repository’s sanitized Claude fixtures cover local verification. Estimated effort is three implementation phases plus one qualified-host observation.

## Open Risks & Assumptions

The host can return the launch ID before its background result. The plan relies on neither session continuity across resume nor a guarantee that completion metadata is flushed before the hand-back. Missing attributable records can still leave a figure unavailable.

## Success Criteria

- **Automated.** Real router calls against synthetic records prove immediate accounting, explicit unavailable reasons, strict late attachment and final-message-only archive collection. Local guards check both skill sizes and Anti-stall parity.
- **Manual.** Compare a settled native background step on a qualified host with a direct measurement of the same launch, checking the late path if records are delayed.

## References

[Accounting contract](../../../docs/REFERENCE.md#observed-token-accounting) · [Late usage](../../../docs/ADR/ADR-019-late-usage-figure.md)
