# Codex Native Lock Recovery After Ordinary Failures — Plan Brief

[Full implementation plan](plan.md)

## What & Why

A nonzero exit, failed turn or missing `RESULT` can leave a run suspended after the Codex thread tree has closed. The runner will prove closure on these paths so both pipeline chains can account for the failed attempt and continue under the existing retry limits.

## Starting Point

The Codex runner holds native ownership from before launch to the settlement callback. Result validation runs first today, so ordinary execution failures bypass that callback. Both skill loops already process incomplete launched attempts as `unknown` after the suspension check. [Runner](../../../skills/10x-pipeline/scripts/run-codex.mjs#L398) · [Skill loop](../../../skills/10x-pipeline/SKILL.md#L81)

## Desired End State

When closure is proved, the runner releases the lock and returns an incomplete launched envelope with the failure reason and measured duration. The orchestrator writes `unknown` and `next` can issue a retry. When closure is uncertain, the lock stays held and the diagnostic names the lock, thread and owner action.

## Key Decisions Made

| Decision | Choice | Why |
| --- | --- | --- |
| Where to release | Reconcile eligible failures in the runner that launched them | It already owns the lock and the trusted invocation identity. |
| Which failures may reconcile | Classify trusted, unsignalled nonzero exits and final root failed turns without relying on assistant output. After successful transport, require a matching final reply for a rejected RESULT. | Codex can exit 1 without a final assistant message or an explicit interruption event. |
| What proves a failed root closed | Require app-server `failed` with a valid completion timestamp, or the existing `completed` evidence | Codex can record a failed status before recording closure. |
| What proves descendants closed | Require timestamped completed latest turns, complete pagination and stable re-enumeration | A surviving descendant can still write after its parent exits. |
| What the host records | Use the existing `unknown` intake and retry rules | A settled failure is a counted attempt. |
| What the owner sees on suspension | Preserve the lock and identify the settlement and router-owned recovery prerequisite | A retained lock currently has no automatic recovery command. |
| How to test kill escalation | Inject a shorter grace delay through the imported runner in a test subprocess | The real subprocess follows the production signal and close path. |

## Scope

Both chains' pending run actions, shared runner and lock diagnostics, fake Codex tests, ADR-024, the Codex reference and the related ADR-018 settlement note. One live Codex retry goes in Manual.

## Architecture / Approach

After exec closes, the runner evaluates result transport and checks closure for eligible failures using the existing model-free metadata service and lock helper. Releasing native ownership lets normal cleanup finish. The host consumes the resulting envelope, then the router applies the existing retry policy.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Release proven native ownership after a failed step | Failure reconciliation, owner diagnostics, CLI regression and SIGTERM grace tests, updated docs | Releasing ownership while a descendant can still write |

**Prerequisites** — Node 24 or later and Git for local checks. Real Codex credentials and compatible host configuration for the Manual check.

**Estimated effort** — One implementation phase including the full local test run, plus a separate live check.

## Open Risks & Assumptions

- Codex 0.169.0 supports timestamped failed-turn evidence. An error with missing completion metadata still suspends. [Codex history projection](https://github.com/openai/codex/blob/rust-v0.169.0/codex-rs/app-server-protocol/src/protocol/thread_history.rs#L1421-L1525)
- The runner can reconcile its own invocation. An older retained lock still requires authorized owner reconciliation. [ADR-024](../../../docs/ADR/ADR-024-openai-codex-support.md#amendment-2--native-step-children-2026-11-16)

## Success Criteria (Summary)

- Fake Codex failures with proved closure reach `unknown` intake and an executable retry on both chains. Malformed streams, interruption, and unproved closure still block mutation and relaunch with a recovery diagnostic. Rejected results with proved closure keep elapsed duration and skip optional usage reads.
- The SIGTERM grace regression proves escalation inside the injected test window and cleanup while retaining native ownership on cancellation. Focused tests and the full local suite pass.
- The Manual check observes a real Codex failure followed by a successful retry of the same step in an isolated scratch run.

## References

- [Change brief](change.md)
- [Full implementation plan](plan.md)
- [ADR-024](../../../docs/ADR/ADR-024-openai-codex-support.md)
