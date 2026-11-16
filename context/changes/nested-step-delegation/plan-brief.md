# Nested Step Delegation — Plan Brief

> [Full plan](plan.md)
> [Research](research.md)

## What & Why

Allow a pipeline step to delegate bounded work to children and collect their completed results before returning its own report. S-14 delivers this as the sole Wave 0 change while preserving recovery, invocation identity and effective safety.

## Starting Point

Phase 1 is committed at `c4f7b69`. Router recovery preserved the failed Phase 2 attempt in `refs/agent-smith/nested-step-delegation/a0b7de060795/failed-4`; implementation files are back at Phase 1. The failed diff shortened unrelated skill instructions, breaking setup/handoff and archive contracts. Its full suite did not complete successfully. Native probes demonstrate child collection in bounded modes and expose a child surviving its parent's process group.

## Desired End State

Both workflow chains support a verified child layer under their steps. The parent receives child results, reconciles edits, verifies the work and retains Progress and authorized commit ownership. The router and orchestrator retain their existing state, recovery and publication ownership.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Child depth | One child layer below the step | Fits the requested capability and current implementation skill's ownership pattern | Plan A1, Research |
| Child safety | Reuse the guarded Claude step identity and effective native permissions | Preserves the existing guard boundary and applicable restricted tools | Plan A2, ADR-024 |
| Qualification | Use recorded native probes for implementation and qualify the complete matrix on the final candidate | Preserves honest support claims while quota-blocked acceptance remains pending | Plan A3, capabilities.md |
| Results | Parent report alone advances the router | Existing invocation matching protects retries and unrelated notifications | Research, ADR-018 |
| Usage | Apply verified coverage to runner output and Claude on-time, late and archive figures, omitting partial or unknown token totals | Preserves attribution and truthful totals through every intake path | Plan Phase 2, Research |
| Compatibility | Preserve persistent schemas and exact saved prompts | Existing run recovery and neutral retry depend on those contracts | Plan A4, Research |
| Retry strategy | Selectively reuse the saved diff and preserve unrelated skill wording | Repairs known setup, handoff and archive failures without weakening their tests | Plan A6, implementation-feedback.md |
| Crash safety | Extend the existing execution lock and suspend both orchestrators while ownership is unresolved | Retained exclusion also gates result writes, archive follow-up and terminal publication | Plan A7, Phase 2 sections 3a and 4 |
| Measurement | Defer performance benchmarking | The owner assigned measurement to later work | Owner instruction, A5 |

## Scope

The change reaches shared rules, delegating prompts, Claude settings, Codex execution boundaries, both orchestrator instructions and their existing safety/recovery tests. Supporting docs and historical decisions gain the verified contract. The roadmap retains separate slices for OpenSpec 2.0.0, broader onboarding and the eighteen-run milestone qualification.

## Architecture / Approach

Native children remain internal to the step. The parent supplies bounded tasks and restrictions, collects children and returns one enclosing RESULT. The existing lock owner gains additive native-execution metadata before model spawn. Both stale takeover and close handling retain exclusion until settlement is established; unresolved ownership produces an actionable retained lock. The retained-lock diagnostic suspends result writes, router mutation, archive follow-up and publication, including prelaunch lock refusals. Both anti-stall sections recognize that suspension STOP. Run/result schemas and legacy flat-lock behavior remain compatible. Each native-enabled model launch records native ownership even for an exact historical flat prompt. Explicit legacy-record fixtures cover historical takeover, while current runner-crash fixtures require retained native ownership.

## Phases at a Glance

| Phase | Delivery | Key risk |
| --- | --- | --- |
| 1. Establish the native child contract | Completed local fixtures; live qualification remains pending | Primitive probes do not qualify the full matrix |
| 2. Enable bounded delegation with parent ownership | Selective recovery, instruction repair, native-lock safety, controls/usage and coupled depth docs | Out-of-group children and incomplete test runs must not pass the gate |
| 3. Verify recovery, compatibility and supported behavior | Broader preservation/retry regressions, final docs and host acceptance | Saved dispatches or failure paths could lose work or attribution |

Prerequisites include Node 24+, installed workflow toolkits and top-level permission/account access for live probes. Resume at Phase 2; its gate now includes archive contracts, an out-of-group-child lock regression (new row 2.4) and a completed full suite. Phase 3 and host acceptance follow. Quota-blocked live cells remain pending.

## Open Risks & Assumptions

- A native forced-termination probe found a child writing after its parent process group disappeared. Phase 2 must fix both lock takeover and close handling, retaining the lock when native ownership cannot be reconciled. An ephemeral parent may have no recoverable rollout. [Probe evidence](evidence/capabilities.md#codex-cancellation-and-forced-parent-termination)
- The scope assumes one child layer and native awaited execution. Native probes and authoritative host contracts establish the implementation settings, with final-candidate support qualification recorded separately.
- Functional evidence covers six host/provider/chain combinations in both launch modes, giving twelve cells. Mixed ladders exercise both provider dispatches.
- Missing host access or a capability gap leaves the affected support claim unqualified with its observed reason while local implementation and regression checks continue. A step whose instructions prohibit children requires top-level acceptance execution.
- Existing pending prompts retain exact bytes. Before downgrading, resolve native execution locks and pending child-enabled dispatches on the enabling revision: an old lock reader may otherwise ignore new metadata and permit unsafe takeover. Unresolved runs retain that revision and an actionable blocker.
- The pending-promise cancellations have no demonstrated root cause yet. Reproduce and diagnose the first failing file; require zero failures/cancellations and only justified existing skips in a fresh complete suite. This re-plan runs no implementation or native acceptance.

## Success Criteria (Summary)

- Deterministic local tests establish parent-only result ownership, inherited safety, recovery and exact historical retry compatibility before publication.
- Phase 2 preserves setup/handoff/archive contracts and blocks mutation/relaunch for an out-of-group child; the full suite finishes with recorded totals.
- Top-level live acceptance proves child collection, failure, interruption/resume, late-result rejection and effective restrictions in all twelve cells on the final candidate.
- Publication, PR CI and any requested external report comment remain Manual acceptance owned by the authorized orchestrator.

## References

- [Full plan and canonical Progress](plan.md#progress)
- [S-14 acceptance](../../foundation/roadmap.md#s-14-pipeline-steps-can-delegate-to-child-subagents)
- [Wave 0 scope](../WAVES.md#wave-0-child-subagents-alone)
- [Host and safety research](research.md)
