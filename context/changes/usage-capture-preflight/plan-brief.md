# Usage Capture Preflight — Plan Brief

> [Full plan](plan.md)

## What & Why

Issue #232 describes runs that completed without token figures or advance notice. Both pipeline chains should give the operator setup guidance before dispatch and carry a concise explanation into the run report and its PR comment.

## Starting Point

The opt-in Claude launcher has shipped. It creates private hook and telemetry files before the native Agent step runs. OpenAI execution uses a fresh Codex CLI invocation and reconciles its rollout afterward. The existing init channel already displays permission advisories before dispatch. [Capture setup](../../../docs/REFERENCE.md#accounting-activation-and-rollback) · [Dispatch reference](../../../docs/REFERENCE.md#codex-and-provider-dispatch)

## Desired End State

An ordinary Claude session shows one actionable usage warning at startup. A compatible launcher binding with readable capture files is quiet, including with empty files. Codex version and headless coverage warnings apply only to the assigned transports. Settled steps with missing figures show their recorded explanation near the report header, and the PR comment carries the same line.

## Key Decisions Made

| Decision | Choice | Why |
| --- | --- | --- |
| Warning policy | One advisory per eligible init, including resumes | Usage is opt-in. Operators can start a fresh launcher session and resume the same Claude-hosted run with its saved host and mode. |
| Native Claude evidence | Validate the private launcher binding and both source files | The launcher creates the files before step one. The collector still verifies each invocation. |
| Codex evidence | Check the installed CLI version, then verify rollout records after execution | The fresh thread and its rollout path are identified after launch. |
| Claude on Codex | Explain duration-only headless coverage | The headless runner has no verified token total. |
| Report source | Derive the summary from settled evidence | Mixed runs, historical ledgers and late verified updates keep accurate coverage. |
| Setup | Use the shipped launcher and its documentation | It already creates the provenance-aware hook and OTLP records. |

## Scope

Startup guidance covers the distinct assigned transports in both chains. On neutral replay it checks the saved provider for that dispatch. Report changes cover terminal output and the comment that carries it. The issue's optional strict flag and any new capture transport are outside this change.

## Architecture / Approach

The router evaluates the current selection after init guards and sends one bounded advisory to stderr. The shared report renderer uses normalized, settled evidence and places the corresponding reason immediately after the title so it survives the comment cap. Existing PR scripts reuse that output. The same ledger and capture files work across upgrades and rollback. Unfinished runs with remaining guarded headless Claude dispatches stay on their enabling plugin revision. [Migration Notes](plan.md#migration-notes)

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Warn before step dispatch | Shared init warning and prerequisite checks. The remaining work adds the optional-module assertions and verifies the existing failure-marker regression. | A source can appear set up while invocation records fail to reconcile. |
| 2. Explain missing figures in reports | Evidence-based report summary, local fake-client verification and setup docs | Generic missing-source evidence could be mistaken for an opt-out. |

**Prerequisites** Node.js 24+, Git, and the shipped Claude capture launcher and Codex collector. Only the Manual checks require an authenticated Claude session and authorized orchestrator publication.

**Remaining work** Verify the two Phase 1 regressions, then complete owner acceptance.

## Open Risks & Assumptions

- Startup can establish source prerequisites. Actual coverage depends on step-time records and collector verification.
- Use a warning on each eligible init so resume can reflect changed capture state. No run metadata migration is needed.
- Explain disabled capture only when the evidence says it was disabled. Describe missing-source records as unavailable, including on mixed runs.

## Success Criteria (Summary)

- Automated checks run locally for both chains, include safe and missing capture fixtures and use a fake Codex CLI for the version probe.
- Phase 1 also checks the two review regressions. Native Claude init must dispatch with a warning and a null hook hash if the optional capture module is missing or replaced by a directory. A launcher failure reported while init probes telemetry must produce a warning even when both source files are readable. [Implementation review](reviews/impl-review.md)
- Shared reports explain missing figures and update when late verified evidence arrives. A local fake GitHub client receives the same explanation from the generated report in the comment payload.
- Manual acceptance observes ordinary and launcher startup on a supported Claude host and confirms the report explanation in an authorized published PR comment.

## References

- [Issue #232](https://github.com/xycu/agent-smith/issues/232)
- [Wave decision](../WAVES.md#decision-track)
- [Accounting activation and rollback](../../../docs/REFERENCE.md#accounting-activation-and-rollback)
