# Native Claude Transcript Capture Plan Brief

[Full plan](plan.md) · [Research](research.md)

## What & Why

Agent Smith v1.17.0 requires the capture launcher before an ordinary Claude session can start a native run. Issue #289 restores ordinary startup and uses the Agent transcripts Claude already writes to measure tokens.

## Starting Point

The existing collector verifies native hook and transcript records against OTLP. Ordinary sessions have agent transcripts and metadata with tool-use IDs, parent agent IDs and completion markers. Those records can identify a completed step and its nested agents, although some requests appear only in telemetry. [Transcript evidence](research.md#transcript-evidence-bounded-sample)

## Desired End State

A native Claude run starts in an ordinary session when the current transcript source is ready. Its completed steps show a token figure with transcript evidence when the collector can attribute the transcript tree. The launcher still supports verified request-record evidence in telemetry mode.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Source selection | `claudeCapture.mode` defaults to `transcript`, with `telemetry` as the opt-in | The setting selects the evidence standard for both startup and collection. | [Change notes](change.md), plan |
| Startup gate | `require:true` checks the selected source, and a unique readable main transcript is sufficient in transcript mode | A fresh session can pass before its first agent directory exists. | [Research](research.md#open-questions), plan |
| Evidence | Status `transcript`, source `claude-transcript`, reconciliation `transcript-messages` | The figure represents observed transcript usage, which can omit side queries. | [Owner decision](research.md#follow-up-2026-11-24-evidence-status-decision), plan |
| Attribution | Match the Agent call and completed metadata, qualify the host from 2.1.311 and count each assistant message once | The observed records support fresh invocations and one nested child layer. | [Research](research.md#transcript-evidence-bounded-sample), plan |
| Late figures | One recheck for a missing total with recorded source, version and invocation | Existing late attachment can fill delayed usage while preserving recorded measurements. | [ADR-019](../../../docs/ADR/ADR-019-late-usage-figure.md), plan |

## Scope

**In scope.** Both chains' native Claude dispatch and archive collection, preflight, late usage, status, compare, terminal reporting and documentation.

**Out of scope.** Resumed Agent histories, deeper nesting, changes to Codex or headless Claude runners, and migration of historical ledgers or archives.

## Architecture / Approach

The router selects the source. After the awaited Agent settles, the host passes the observed invocation to the collector. The transcript reader resolves the current Claude session, cross-checks Agent calls and metadata, and streams bounded usage records. The existing result gate accepts the sanitized figure and evidence. Reports expose the new scope and the possibility of undercounting.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Represent transcript evidence across accounting | Normalization, coverage, reports and same-source late attachment | Presenting transcript figures as verified usage |
| 2. Collect a bounded transcript tree | Session discovery, Agent attribution and deduplicated totals | Attributing the wrong invocation or admitting an unfinished tree |
| 3. Make transcript mode the default in both chains | Startup, native and archive wiring, and updated user docs | Divergent source selection between preflight, dispatch and recheck |

**Prerequisites.** Node 24+, repository test fixtures, and a qualified interactive Claude installation for the manual checks.

**Estimated effort.** Three implementation phases with focused local tests and two live host checks.

## Open Risks & Assumptions

- Claude's transcript format is version-dependent. Unsupported records yield an unavailable figure.
- A transcript figure may omit side queries. Reporting and cost estimates disclose this scope.
- Live ordinary and launcher sessions require separate manual verification. Deterministic local fixtures supply the automated evidence.

## Success Criteria (Summary)

- Local fixtures prove readiness in both chains, selected-source failures, correct totals and fail-closed attribution.
- Status, reports, compare and late usage retain distinct transcript and verified evidence semantics.
- Manual smoke checks confirm transcript evidence from ordinary Claude and verified evidence from an opt-in launcher session.

## References

- [Issue #289](https://github.com/xycu/agent-smith/issues/289)
- [Current accounting contract](../../../docs/REFERENCE.md#observed-token-accounting)
