# Budget halt after done — Plan Brief

> Full plan: `context/changes/budget-halt-after-done/plan.md`

## What & Why

A complete run that ends exactly on the step budget is reported `halt` instead of `done`, because `next` checks the budget before `decide`. Move the check after `decide` (issue #87).

## Starting Point

`route.mjs:112-115` halts on `budgetSteps(log) >= budget` before the decide loop.

## Desired End State

`done` (and `decide`'s own halts) win over the budget text; the budget halts only when a step is still to run.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Where to check | After the decide loop and done/halt handling | Issue's proposed fix; skips use no budget | Plan |
| ADR | None | Behaviour matches REFERENCE.md "still fit" | Plan |

## Scope

**In scope:** router move, one regression test, one docs bullet.

**Out of scope:** budget values, `budgetSteps`, policy, `needsHuman` ordering.

## Architecture / Approach

Delete the early check; re-add it after the `d.halt || d.done` block with the same reason.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Move check | Router fix, test, doc | A skip entry may now be logged at budget (harmless) |

**Prerequisites:** none.
**Estimated effort:** one short session.

## Open Risks & Assumptions

- Existing budget tests leave a step pending, so they should still pass.

## Success Criteria (Summary)

- Issue reproduction prints `done`; full suite green.
