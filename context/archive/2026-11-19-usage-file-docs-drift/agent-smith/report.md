# Run report: usage-file-docs-drift

Goal: Document --usage-file in the router usage text and AGENTS.md
Rigor: standard (goal plain)
Outcome: done - impl review APPROVED
Archive: requested - runs after this report was written; see the commit "chore(archive): close usage-file-docs-drift"

| # | Step | Provider | Model | Effort | Tier | Simple | Result | Tokens |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | score | openai | gpt-6-luna | low | 0 | no | ok (ae7d151) | 123177 |
| 2 | plan | openai | gpt-6.2-sol | high | 3 | no | ok (5dfb28e) | 674807 |
| 3 | plan-review | openai | gpt-6.2-sol | high | 3 | no | ok (4c0afb3) | 2085079 |
| 4 | implement | openai | gpt-6.2-sol | medium | 2 | yes | ok (06f8321) | 8046464 |
| 5 | impl-review | openai | gpt-6.2-sol | high | 3 | no | ok (a7efb25) | 14643502 |

Steps: 5 · Tokens: 25573029 (figures for 5 of 5 steps)

## Token coverage

Verified observed host usage: 5 · Unavailable: 0 · Legacy/unverified scope: 0 · Missing figures: 0
Provider, model and tier groups describe the enclosing dispatch.

## Review findings

Counts as recorded when each review step ended; later edits of a review file are not reflected.

- step 3 plan-review: REVISE, 0 critical, 2 warnings measured; 0 critical, 0 warnings open
- step 5 impl-review: APPROVED, 0 critical, 0 warnings measured; 0 critical, 0 warnings open

## Complexity score

Scores: cognitive 1, execution 1 (ambiguity 0, novelty 0, coupling 1, discovery 0, volume 1, verification 0)
Confidence: high · Unknowns: 0
Source: score step 1

No tier shift.
