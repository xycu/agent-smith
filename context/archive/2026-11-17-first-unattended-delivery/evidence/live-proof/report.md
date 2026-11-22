# Run report: claude-only-10x-example

Goal: Document restoring the shipped Claude-only ladder while preserving unrelated project overrides. Implement automatically and run all local checks automatically.
Rigor: standard (--rigor standard)
Provider mode: claude
Outcome: done - impl review APPROVED

| # | Step | Provider | Model | Effort | Tier | Simple | Result | Tokens |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | score | claude | haiku | low | 0 | no | ok (33b179e) | - |
| 2 | plan | claude | sonnet | high | 3 | no | ok (9cdd1f0) | - |
| 3 | plan-review | claude | sonnet | high | 3 | no | ok (dc27705) | - |
| 4 | implement | claude | sonnet | medium | 2 | no | ok (b8ae808) | - |
| 5 | manual-verify | claude | sonnet | medium | 2 | no | ok (4e29cba) | - |
| 6 | impl-review | claude | sonnet | high | 3 | no | ok (77d9565) | - |

Steps: 6 · Tokens: - (figures for 0 of 6 steps)

## Token coverage

Verified observed host usage: 0 · Unavailable: 6 · Legacy/unverified scope: 0 · Missing figures: 6
Provider, model and tier groups describe the enclosing dispatch.
- Step 1 score: missing-identity — The host invocation cannot be attributed exactly.
- Step 2 plan: missing-identity — The host invocation cannot be attributed exactly.
- Step 3 plan-review: missing-identity — The host invocation cannot be attributed exactly.
- Step 4 implement: missing-identity — The host invocation cannot be attributed exactly.
- Step 5 manual-verify: missing-identity — The host invocation cannot be attributed exactly.
- Step 6 impl-review: missing-identity — The host invocation cannot be attributed exactly.

## Review findings

Counts as recorded when each review step ended; later edits of a review file are not reflected.

- step 3 plan-review: REVISE, 1 critical, 2 warnings measured; 0 critical, 0 warnings open
- step 6 impl-review: APPROVED, 0 critical, 0 warnings measured

## Manual checks

Rows as recorded when the last manual-verify step ended. The kind comes from the evidence file name; the router never reads the content. Only browser, test, command or script evidence proves a browser row.

Proved: 1

- 1.5 README recipe reads correctly in the rendered Configure section — judgment (evidence/judgment-readme-recipe.md)

Not proved: 0

## Complexity score

Scores: cognitive 3, execution 4 (ambiguity 1, novelty 1, coupling 1, discovery 1, volume 1, verification 2)
Confidence: medium · Unknowns: 2
Source: score step 1

No tier shift.
