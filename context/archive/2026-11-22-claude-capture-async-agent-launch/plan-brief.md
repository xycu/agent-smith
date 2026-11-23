# Claude capture settles asynchronously launched Agent runs — Plan Brief

> Full plan: `context/changes/claude-capture-async-agent-launch/plan.md`
> Frame brief: `context/changes/claude-capture-async-agent-launch/frame.md`

## What & Why

The Claude capture collector was built and tested against a hand-authored synchronous Agent shape, so it cannot settle any interactive launcher run, on 2.1.311 or later. A live run on Claude Code 2.1.323 ended all six steps `incomplete-capture`. The fix teaches the collector the interactive shape and corrects the claim that the 2.1.311 floor rests on headless evidence.

## Starting Point

Interactive Agent calls launch in the background, so the PostToolUse hook sees a launch with no result, some `SubagentStop` records carry no closing text, and live transcripts and telemetry hold branches and side queries. The collector rejects each of these. The capture holds everything needed (stop identity, `subagent_completed` totals, request records).

## Desired End State

An interactive launcher run settles every step to verified figures when the capture is complete, a synchronous capture verifies as before, and any missing or conflicting record still yields an unavailable figure with a bounded reason. Docs state the true evidence basis, and a live rerun confirms it.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Cause | Collector contract and fixture provenance, not the host version | Interactive launch has always been asynchronous. | Frame |
| Direction | Settle from stop and completion records; no sync forcing, no version ceiling | The data is present in the capture and the cause is not version-specific. | Frame |
| Async scope | Root run only | ADR-018 forbids nested subagents, so children stay synchronous. | Plan |
| Telemetry-only requests | Count them in the step total | They are real model requests of the step agent; excluding them hides spend. | Plan |
| Missing closing text | Null stop hash matches only an empty final response | Keeps the stop-to-final-response link without trusting a missing record. | Plan |
| Final request | Highest `api_request` sequence among transcript-matched requests | Tool-only final turns have no `assistant_response`. | Plan |
| Fixtures | Synthetic, shaped after the live capture; no real transcripts committed | Real captures hold private content. | Plan |
| Floor | Stays 2.1.311; evidence wording corrected | The collector already fails closed on unrecognized shapes. | Plan |

## Scope

**In scope:** collector settlement changes, live-shaped fixtures and tests, README, `docs/REFERENCE.md`, ADR-018 Amendment 7, live requalification note.

**Out of scope:** launcher, hook and projection changes, routing or SKILL changes, nested async, classifying telemetry-only requests, version ceiling, closing rows 2.4 and 2.5 of `claude-token-figures-default`.

## Architecture / Approach

Each relaxation in `claude-usage.mjs` is the narrowest one the live capture needs and keyed to a positive condition: a launch-only PostToolUse is accepted only for the invocation's own root run; the launch result must precede `subagent_completed`; the contiguous event prefix extends to `subagent_completed`; chain membership checks assistant entries strictly and other entries by reachability; telemetry-only requests before completion are counted, and a transcript request without telemetry still fails. Tests and fixtures land with the code.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Collector settles async root launches | Changed collector, live-shaped fixtures, positive and negative tests | A relaxation that also admits a forged or incomplete capture |
| 2. Docs match the evidence | README, REFERENCE and ADR-018 Amendment 7 | Wording that overstates what was verified |
| 3. Live requalification | Interactive rerun, evidence note, late-recheck result, README and REFERENCE updated with the result | The late recheck `unsupported-schema` is unexplained and may need its own change |

**Prerequisites:** the saved 2.1.323 capture copy for the Phase 1 replay; an interactive Claude session for Phase 3.
**Estimated effort:** about 2 sessions across 3 phases, plus a live run.

## Open Risks & Assumptions

- Telemetry-only requests are assumed to be side queries (possibly the auto-mode classifier); their origin is undocumented and not verified.
- The earlier live recheck returned `unsupported-schema`, which an offline replay did not reproduce; it may be a separate defect.
- The 2.1.323 capture is one run; other hosts or modes may show shapes not covered here, which the collector reports as unavailable.

## Success Criteria (Summary)

- A complete interactive launcher run reports verified figures for every step.
- Synchronous fixtures and all fail-closed cases behave as before.
- README, REFERENCE and ADR-018 state the real basis of the floor and the async settlement rule.
