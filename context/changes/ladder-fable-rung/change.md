---
change_id: ladder-fable-rung
title: Let the ladder reach the fable model without renumbering tiers
status: impl_reviewed
created: 2026-11-12
updated: 2026-11-14
archived_at: null
---

## Notes

Source: the repo review of 2026-11-12 (LLM engineering and Claude Code practice). Severity: improvement, owner decision.

### Problem

The ladder (`skills/10x-pipeline/policy.json:2-11`) has eight rungs and ends at `opus/max`. The Agent tool of current Claude Code takes four model aliases: `sonnet`, `opus`, `haiku` and `fable` (seen in the tool of the session this review ran in, version 2.1.311). So no escalation can reach the most capable model: not the third attempt of a step, not a RETHINK re-plan, not a `hard` goal, not a score up shift.

A project that wants it has to replace `ladder` whole in its override, and then renumber, because tiers are positions in that array: `baseTier`, `minTier` and `maxTier` of every step, `score.shift`, the effort floors and the numbers in the docs. ADR-010 already paid this price once, when the `opus/medium` rung was inserted (two characterized test literals had to be renumbered).

### Fix direction

A decision for the owner, since it changes cost. Smallest option first:

1. Append, never insert. Add the fable rungs after `opus/max` (for example `fable/high` and `fable/xhigh`), so every existing index keeps its meaning. Raise `maxTier` only for the steps whose escalation should reach them (`plan`, `plan-review`, `impl-review`, `fix`); leave every `baseTier`.
2. Guard against an older Claude Code. An Agent call with a model the tool does not know fails before a subagent starts, the step is recorded as `unknown`, and the retry escalates further up, into the same failure. So ship the rungs behind a policy key that is off by default (as `prices` and `advisor` are), or as a documented override snippet, and state the minimum Claude Code version in the README.
3. Cost estimate: add `fable` to the `prices` example in `README.md` and `docs/REFERENCE.md`, and check what `estimateCost` prints for a model without a price.
4. Later, as its own change if wanted: address rungs by name (`"base": "opus/medium"`) instead of by index, so that an inserted rung never renumbers anything.

`BASELINE_PIN` of `compare` and `baseline-policy.json` are not touched: the baseline stays `sonnet/high`.

### Tests

- `ladder.test.mjs`: the rung count, the clamp at the new top, the effort floor on the new rungs.
- `budget-executors.test.mjs` and the tier literals of the characterized loop tests stay unchanged with option 1; that is the check that nothing was renumbered.
- `docs/REFERENCE.md` routing bullets and the "How the tier moves" list follow the change (`AGENTS.md`, Coding Style).

### Done when

The owner has chosen. If the rungs ship: a run can reach `fable` by escalation, no existing tier number changed, and a Claude Code without the alias never gets it by default.
