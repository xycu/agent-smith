# Opt-in fable ladder — Plan Brief

> Full plan: [plan.md](plan.md)

## What & Why

Document the approved opt-in fable extension without changing anyone's default model selection or existing tier numbers. Projects that explicitly adopt it can escalate selected 10x steps beyond opus/max.

## Starting Point

The default ladder has eight rungs. Existing policy merging, provider dispatch and cost reporting already support custom Claude models; no runtime code change is needed. Planning checks passed 57 existing ladder/provider/cost tests.

## Desired End State

A complete reference JSON example repeats tiers 0–7, appends fable/high and fable/xhigh at 8/9, and raises only plan, plan-review, impl-review and fix ceilings to 9. README compatibility and pricing guidance links to it. Tests consume that published example.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Delivery | Documentation-only project override | Owner approved opt-in; defaults must stay unchanged | Task and change brief |
| Ladder | Append high/xhigh at 8/9 | Supported efforts, no renumbering | Brief and official Claude docs |
| Ceilings | Only four named 10x steps to 9 | Limits scope and preserves base/min tiers and OpenSpec bounds | Brief and task |
| Compatibility | Claude host; current default Fable 5.2 requires 2.1.321+ | The 2.1.311 observation is not a proven minimum | Official model/subagent docs |
| Cost | Illustrative fable rate 12, explicitly not a provider quote | User supplies blended rates; missing prices remain unknown | Existing estimator contract |
| Ownership | README Configure/compatibility, reference routing/configuration/cost, ladder tests | Invocation change owns skill/manifest descriptions | Wave 5 |
| Limits | Preserve budgets and effort-floor algorithm | No need to change routing for the approved configuration | CLI and pure-function probes |

## Scope

**In scope:** one canonical override, compatibility and price documentation, focused tests for provider routing, floors, clamps and missing-price outputs.

**Out of scope:** shipped policy changes, production scripts, GPT/OpenSpec escalation changes, baseline changes, invocation or description edits, WAVES.md, archive content and automatic capability detection.

## Architecture / Approach

Reuse project policy merge → tier selection → provider dispatch → existing status/report/compare. Parse the canonical JSON fence locally in the existing ladder test file; use current scratch-project helpers. Only README.md, docs/REFERENCE.md and ladder.test.mjs change outside this change's own planning/evidence files.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Document the opt-in policy and its limits | Complete example, compatibility and truthful price guidance | Whole-array replacement or overstated host support |
| 2. Prove the published configuration through regression tests | Routing/cost regression proof, focused and full gates | Confusing unit reachability with a permitted whole-run path |

**Prerequisites:** Node 24+, current provider-dispatch architecture and owner approval already present. Live acceptance needs an eligible Claude account and exposed Agent schema.
**Estimated effort:** one focused implementation session across two phases, plus separate live host acceptance.

## Open Risks & Assumptions

- A ceiling of 9 does not guarantee dispatch there. The characterized RETHINK path runs at 7 then 8 and halts after two failed revisions; caps remain unchanged.
- Shipped medium/high effort floors work. Custom xhigh skips tier 8; custom max is incompatible with a ladder ending at fable/xhigh. The generic exhausted-floor behavior is documented, not repaired here.
- Fable access, provider alias mappings, environment overrides and organization caps still require host checks. Documentation and CLI fixtures cannot prove live model execution.
- Missing fable prices yield incomplete estimates, not free usage. Prices off retain existing output shapes. No billing accuracy, savings or performance claim is made.
- Unattended planning uses evidence-backed decisions instead of interviews. No production implementation or commits are part of this planning step.

## Success Criteria (Summary)

- Published JSON preserves tiers 0–7 and all default/baseline behavior; only selected opt-in ceilings change.
- Focused and full tests prove dispatch, limits and honest unpriced reporting without touching other Wave 5 regions.
- Live Claude high/xhigh acceptance remains a separate Manual row until actual evidence exists.

## References

- [Change brief](change.md), [Wave ownership](../WAVES.md), and source anchors in the full plan.
- [Claude model configuration](https://code.claude.com/docs/en/model-config) and [subagents](https://code.claude.com/docs/en/sub-agents), checked 2026-11-14.
