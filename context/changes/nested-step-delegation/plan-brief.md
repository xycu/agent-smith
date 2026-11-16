# Nested Step Delegation — Plan Brief

> [Full plan](plan.md)
> [Research](research.md)

## What & Why

Allow a pipeline step to delegate bounded work to children and collect their completed results before returning its own report. S-14 delivers this as the sole Wave 0 change while preserving recovery, invocation identity and effective safety.

## Starting Point

Shared rules, executor prompts, Claude's depth cap and Codex runner flags currently prevent delegation. Both orchestrators already reject child and foreign notifications as parent results. Native child waiting, event scope, permissions, usage and cancellation remain unverified in the supplied research.

## Desired End State

Both workflow chains support a verified child layer under their steps. The parent receives child results, reconciles edits, verifies the work and retains Progress and authorized commit ownership. The router and orchestrator retain their existing state, recovery and publication ownership.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Child depth | One child layer below the step | Fits the requested capability and current implementation skill's ownership pattern | Plan A1, Research |
| Child safety | Reuse the guarded Claude step identity and effective native permissions | Preserves the existing guard boundary and applicable restricted tools | Plan A2, ADR-024 |
| Activation | Establish live capability evidence before Phase 2 | Event scope, waiting and descendant lifetime determine safe enablement | Plan A3, Research |
| Results | Parent report alone advances the router | Existing invocation matching protects retries and unrelated notifications | Research, ADR-018 |
| Usage | Count verified inclusive usage once and disclose incomplete coverage | Avoids child double counting and incomplete totals presented as complete | Plan, Research |
| Compatibility | Preserve persistent schemas and exact saved prompts | Existing run recovery and neutral retry depend on those contracts | Plan A4, Research |
| Measurement | Defer performance benchmarking | The owner assigned measurement to later work | Owner instruction, A5 |

## Scope

The change reaches shared rules, delegating prompts, Claude settings, Codex execution boundaries, both orchestrator instructions and their existing safety/recovery tests. Supporting docs and historical decisions gain the verified contract. The roadmap retains separate slices for OpenSpec 2.0.0, broader onboarding and the eighteen-run milestone qualification.

## Architecture / Approach

Native children remain internal to the step. The parent supplies bounded tasks and inherited restrictions, collects every child and returns one enclosing RESULT. The current router, state protocol, run lock and guarded Claude identity remain the integration points. Runtime changes follow observed host evidence.

## Phases at a Glance

| Phase | Delivery | Key risk |
| --- | --- | --- |
| 1. Establish the native child contract | Host capability records and deterministic fake descendant/event fixtures | Installed hosts may lack reliable waiting or inherited protection |
| 2. Enable bounded delegation with parent ownership | Coordinated host controls, prompt contract and result/usage protection | A child report or active descendant could outlive the parent boundary |
| 3. Verify recovery, compatibility and supported behavior | Recovery regressions, synchronized docs and final host acceptance | Saved dispatches or failure paths could lose work or attribution |

Prerequisites include Node 24+, installed workflow toolkits, authenticated trusted acceptance projects and top-level permission to run child probes. Phase 1's live evidence gates Phase 2 activation. Estimated effort is three implementation phases plus host acceptance sessions, depending on account and mode availability.

## Open Risks & Assumptions

- The scope assumes one child layer and native awaited execution. The exact supported settings must be established before activation.
- Functional evidence covers six host/provider/chain combinations in both launch modes, giving twelve cells. Mixed ladders exercise both provider dispatches.
- Missing host access or a capability gap blocks the affected prerequisite or support claim with an actionable needs-human reason. A step whose instructions prohibit children requires top-level acceptance execution.
- Existing pending prompts retain their flat instructions across upgrades. Fresh sessions adopt the verified settings and new prompts.

## Success Criteria (Summary)

- Deterministic local tests establish parent-only result ownership, inherited safety, recovery and exact historical retry compatibility before publication.
- Top-level live acceptance proves child collection, failure, interruption/resume, late-result rejection and effective restrictions in all twelve cells on the final candidate.
- Publication, PR CI and any requested external report comment remain Manual acceptance owned by the authorized orchestrator.

## References

- [Full plan and canonical Progress](plan.md#progress)
- [S-14 acceptance](../../foundation/roadmap.md#s-14-pipeline-steps-can-delegate-to-child-subagents)
- [Wave 0 scope](../WAVES.md#wave-0-child-subagents-alone)
- [Host and safety research](research.md)
