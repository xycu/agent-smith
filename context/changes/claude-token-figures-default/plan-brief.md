# Opt-in Claude token capture plan brief

[Full plan](plan.md) · [Frame brief](frame.md)

## What & Why

“The plugin ships a capture hook that the user opts into.” The capture supplies verified whole-step Claude token figures. An ordinary launch leaves capture off and the reports explain how to enable it. [Owner decision](frame.md)

## Starting Point

The collector can reconcile fresh Claude Code 2.1.311 Agent runs when the operator provides native hook records, transcripts and process-bound OTLP logs. The retained probe verified a step tree with four requests across two agents, and a separate probe showed that export can arrive after Agent return. [Retained evidence](../../archive/2026-11-18-delegated-token-accounting/evidence/claude-real-format-review.md)

## Desired End State

A single shipped launcher opts one fresh session into local capture. Native Claude Agent steps on either pipeline use the existing verified accounting contract when evidence is complete. If the capture misses the immediate check, the pipeline can attach a later proof within the existing cutoff.

## Key Decisions Made

| Decision | Choice | Rationale | Source |
| --- | --- | --- | --- |
| Default and consent | Off by default. Opt in for one launch. | Invocation records explicit consent without changing project or global settings. | Frame and plan |
| Producer | Separate passive Agent and SubagentStop hook and a process-local loopback exporter | Preserves the guarded external runner's mandatory receipts and gives the collector both evidence sources. | Plan |
| Verified total | Reconcile the complete Agent tree before recording the total. | Request membership, counters, closure and process provenance establish coverage. | Frame and plan |
| Host upgrades | Maintainer qualifies exact releases and adds sanitized replay fixtures. | Event formats can change across Claude releases. | Plan |
| Comparison | Preserve verified and historical comparison gates. | Missing capture cannot support a savings verdict. | Frame and plan |

## Scope

- Both native Claude Agent pipeline loops, including late usage before publication or archive launch.
- Shared status, report and comparison output, with default-off guidance.
- External Claude dispatched from Codex retains its separate accounting. Billing, final-request estimates and capture preflight are outside this change.

## Architecture / Approach

The launcher starts a private local receiver before Claude and binds each session to its own process identity. Passive hooks project native events and the receiver retains the minimum OTLP fields for closure. The collector proves the invocation using the paired records, bounded native transcript reads and contiguous exporter prefix. The router consumes normalized evidence through its existing immediate and late paths.

## Phases at a Glance

| Phase | Delivery | Risk covered |
| --- | --- | --- |
| 1. Ship session-local capture and prove reconciliation | Explicit launcher, passive hook, qualified collector and replay fixtures | Data exposure, unrelated processes and incomplete captures |
| 2. Integrate both pipelines and qualify the user workflow | Native entry paths, shared outputs, documented rollout and live qualification | Late delivery, truthful default-off output and host drift |

**Prerequisites** Node 24 or later and local fixtures for implementation. Manual qualification needs an authorized disposable project, working Claude model access and exact Claude Code builds.

**Estimated effort** Two implementation phases and one human qualification session if it covers both the complete pipeline and the subsequent-release probe.

## Open Risks & Assumptions

- Incoming OTLP or transcript data can be late or incomplete. Missing closure stays unavailable throughout the normal run and any later read.
- Managed exporter policy may prevent the session-local capture. The launcher preserves the policy and any existing export destination.
- The 2.1.311 fixture baseline has retained native probe evidence. Full pipeline qualification remains pending until the authorized human run.

## Success Criteria (Summary)

- Automated fixtures prove capture is off on ordinary launch and confirm the verified and unavailable paths through both skills, status, the run report and comparison.
- An authorized human runs one complete native Claude-hosted pipeline on Claude models with capture enabled and records exact host version, whole-step token evidence and README qualification.
- The maintainer qualifies a subsequent Claude Code release with a live multi-request Agent capture and sanitized replay before listing that release as supported.

## References

- [Accounting contract](../../../docs/REFERENCE.md#observed-token-accounting)
- [Claude Code hooks](https://code.claude.com/docs/en/hooks) · [Claude Code monitoring](https://code.claude.com/docs/en/monitoring-usage)
