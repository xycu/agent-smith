# Run cost estimate — Plan Brief

> Full plan: `context/changes/run-cost-estimate/plan.md`

## What & Why

Run reports show tokens only. The owner wants a money figure. The host reports one `totalTokens` per step with no input/output split, so the figure is an estimate at a blended rate, priced per model alias, and labelled so.

## Starting Point

`report.md`, `status` and `compare` sum `usage.totalTokens` per step and per alias; nothing prices them. `policy.json` has no price data, and `buildReport` takes no policy.

## Desired End State

With prices in the project override, `report.md` has a `Cost (est.)` column and a `Cost (estimate)` line, `status` prints a `cost` object, and `compare` prints each side's cost beside its tokens. With no prices (the shipped default) every output is unchanged. The `compare` verdict stays on tokens.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Where prices come from | Owner supplies them; shipped `prices: null` | Shipped prices go stale and would be invented numbers. | Plan (assumption, unattended) |
| Price key | Model alias under `prices.usdPerMillionTokens` | The log's `model` is already the alias, so no id mapping exists or is needed. | Plan |
| Rate | One blended rate per alias; no input/output split | The host reports one total per step. | Plan |
| Coverage | Only steps with a token figure and a price; say `priced N of M` and list unpriced aliases | A total that hides gaps reads as complete. | Plan |
| Report plumbing | Non-halting `loadPrices()` in `state.mjs`, no policy threaded through `finishRun` | Five call sites reach `writeReport`; this touches none. | Plan |
| Provenance | `prices` added to `provenance.ignore` | A price changes no routing, so it must not raise `provenance-differs`. | Plan |
| `compare` | Cost rows and `cost-incomplete:<side>` warning; verdict, `comparable`, `dropPercent` unchanged | ADR-005 and ADR-007 decide on raw tokens. | Plan |
| Output when off | Byte-for-byte as today | No risk for existing runs and tests. | Plan |

## Scope

**In scope:** `prices` policy key and validation, cost in `report.md`, `status`, `compare`, tests in a new `cost.test.mjs`, `docs/REFERENCE.md`, an ADR-007 note, `AGENTS.md` and `README.md` lines.

**Out of scope:** shipped default prices, an input/output split or any orchestrator change, cost in the verdict or a cost target, orchestrator-session cost, per-id or per-tier prices, `SKILL.md` edits.

## Architecture / Approach

One pure helper pair in `state.mjs` (`priceTable`, `estimateCost`) owns the rules; `buildReport`, `status` and `compare` only format. A malformed `prices` block reads as off and never halts. Both chains share it, because both write the same usage entries.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Prices block and cost reader | Policy key, validation, estimator, provenance ignore | Provenance default must match in `policy.json` and `isolation.mjs` |
| 2. Cost in report.md and status | Column, line and `cost` object, both chains | Existing report tests parse the table, so the column must appear only with prices |
| 3. Cost in compare | Per-side cost, rows, warning | Verdict must not move; prices come from the project that runs `compare` |
| 4. Docs and ADR | REFERENCE, ADR-007 note, AGENTS.md, README | Keep the ADR-007 decision rule untouched |

**Prerequisites:** none.
**Estimated effort:** ~2 sessions across 4 phases.

## Open Risks & Assumptions

- Assumption: the owner supplies prices; the plugin ships none. Reversible later by filling the default.
- Assumption: price keys are the aliases the ladder uses. A project that overrides the ladder with another alias must price it too, or it shows as unpriced.
- The estimate understates or overstates the real bill because input, output and cache tokens price differently; the label says blended.
- `compare` prices both sides with the running project's table, so a baseline run in another checkout is priced alike, not by its own override.

## Success Criteria (Summary)

- With prices set, a run report states a dollar estimate, how many steps it covers and that the rate is blended.
- With no prices, nothing in report, status or compare changes.
- The whole existing suite stays green and the new `cost.test.mjs` covers both chains.
