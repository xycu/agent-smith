# Cheaper Routing for a Simple Change — Plan Brief

> Full plan: `context/changes/cheaper-routing-simple-change/plan.md`

## What & Why

Make the pipeline router pick a cheaper model and effort when a change is simple, so the owner's weekly Claude usage limit drops against a full Sonnet-5.5 high-effort run. This is roadmap item S-01, the claim behind the whole milestone: a simple change should not run on the same tier as a complex one.

## Starting Point

`route.mjs` only adds tiers for complexity (+1 at 3 and 6 phases) and has a small downward path (`--size s`, clean review). Step floors sit at sonnet/medium, and the `plan` step starts at opus/high, which already costs more than the baseline.

## Desired End State

A plan with 1 phase and at most 6 Progress rows runs plan-review on sonnet/low, implement and impl-review on sonnet/medium. `--size s` makes the first plan run on sonnet/medium. Bigger plans route as before. `status` and the run log show which steps got the discount.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| -------- | ------ | ---------------- | ------ |
| What is simple | ≤1 phase and ≤6 Progress rows | Rows catch a one-phase plan that hides a lot of work. | Plan |
| Signals | Plan signals only, no git diff | No new IO or git dependency, and it covers `implement` where no diff exists yet. | Plan |
| Floors | `plan` min 2, `plan-review` min 1, others unchanged | A discount must be able to go below today's floors. | Plan |
| Discount | -1 on plan, plan-review, implement, impl-review; 0 on fix | Reviews stay at sonnet or above; fix already floors at the last code tier. | Plan |
| First plan | `--size s` is the only simple signal | No plan exists yet to count. | Plan |
| Withholding | Any failed step (for the rest of the run), `--size l`, or no phases | Keeps a misjudged change from staying cheap. | Plan |
| Scoring | Script only, no LLM scorer | ADR-001 Phase 1. | ADR-001 |

## Scope

**In scope:** `complexity.simple` and floors in `policy.json`; `rows` in `readPlan`; discount in `tierFor`; `simple` in the log and `status`; `SKILL.md` and `README.md` text.

**Out of scope:** git diff signal, LLM scoring, risk path rules and forced reviews (S-03), plan-review skip (S-04), usage report (S-02), baseline comparison (S-06), `fix` discount, haiku for reviews.

## Architecture / Approach

A small helper in `route.mjs` decides whether the change is simple from `plan.md` counts, `meta.size` and the run log. `tierFor` subtracts the step's policy discount when it is, and the existing clamp to `minTier` applies last. All numbers live in `policy.json`, so a project can override them or set the discounts to 0.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Policy and plan-size reading | Thresholds, discounts, new floors and a `rows` counter, no behaviour change | A floor change alters tiers for non-simple runs. |
| 2. Router discount and visibility | Discount in `tierFor`, `simple` in the log and `status`, scratch-folder checks | A threshold misjudges a change as simple; failure escalation is the net. |
| 3. Docs sync | `SKILL.md` and `README.md` match the router | Numbers drift from `policy.json`. |

**Prerequisites:** None. Node 18+ for the router.
**Estimated effort:** About 2 sessions across 3 phases.

## Open Risks & Assumptions

- Assumes the router stays a script with no scorer (ADR-001 Phase 1, roadmap Open Questions 3 and 6) and that this modifies the existing rule (Open Question 9a).
- Without `--size s` the first `plan` step still runs on opus/high, above the Sonnet-5.5 high baseline. The usage drop may depend on passing `--size s`; revisit `steps.plan.baseTier` after S-06 measurements.
- The 1-phase and 6-row thresholds are untested heuristics; review them after the first runs.
- `--size l` blocks the discount, and the discount is withheld after any failed step. Both were added to keep a simple label from contradicting an explicit flag or a failure.

## Success Criteria (Summary)

- A simple plan routes to a cheaper model and effort than a 2-phase or 7-row plan, shown in `init` output and `status`.
- Policy override with zero discounts gives today's tiers.
- `SKILL.md` and `README.md` describe the same rule as `policy.json`.
