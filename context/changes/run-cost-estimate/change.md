---
change_id: run-cost-estimate
title: Estimate the money cost of a run in the report
status: planned
created: 2026-11-09
updated: 2026-11-09
archived_at: null
---

## Notes

Reported by the owner on 2026-11-09 after xycu/linkedin-prm#2: run reports carry no token, cost or money figures. The token part was a skill-text bug (the orchestrator did not read the `<usage>` block of the task notification), fixed in PR #64. This change is the rest: a money estimate.

Today `report.md`, `status` and `compare` show tokens only (ADR-007 treats raw tokens as a proxy). The usage figure is one total per step (`totalTokens`, `toolUses`, `durationMs`), with no input, output or cache split, so a dollar figure can only be an estimate at a blended rate.

Intended shape, to be checked by research and plan review:

- An optional `prices` block in `policy.json`, USD per million tokens per model alias, `null` by default so nothing is invented; a per-project override can fill it.
- A `Cost (estimate)` line in `report.md`, the per-step table and `status`, covering only steps that have a token figure, and saying how many steps it covers and that the rate is blended.
- `compare` prints the cost of both sides next to the token totals; the verdict stays on tokens.
- Both chains (10x and OpenSpec) read the same usage entries, so one implementation serves both.
- Tests in the existing suite, REFERENCE "Usage report", and a note in ADR-007.

Open questions: whether the owner must supply the prices or the plugin ships defaults that go stale; whether one blended rate per alias is honest enough or the orchestrator should pass an input/output split when the host reports one; how a model alias maps to a price when the router uses aliases (`opus`, `sonnet`, `haiku`) and not model ids.
