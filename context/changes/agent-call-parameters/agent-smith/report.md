# Run report: agent-call-parameters

Goal: Make both pipeline skills describe valid Agent calls with and without run_in_background, give each step and archive agent a deterministic description, and use that identity for completion and late usage correlation. Follow context/changes/agent-call-parameters/change.md. Preserve OpenAI runner dispatch. Own Loop step 2, anti-stall rules 1 and 6, and late-usage prose in Wave 4. Record unavailable live Claude acceptance honestly. Respect the Wave 4 ownership table in context/changes/WAVES.md, resolve historical paths against current layout, leave WAVES.md to the post-wave maintenance change, and avoid changes owned by sibling runs. Shared documentation and skill-content tests may be updated only for this change's behavior.
Rigor: standard (goal plain)
Outcome: halt - Step 5 (implement) needs a human: Repair or authorize repair of the unrelated runner-lock timing test before completing the full-suite gate.
Code under chore commits: 2 path(s) in 1 step commit(s); see "Code committed by the router"

| # | Step | Provider | Model | Effort | Tier | Simple | Result | Tokens |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | score | openai | gpt-6-luna | low | 0 | no | ok (5822247), 3 neutral reruns | 309852 |
| 2 | plan | openai | gpt-6.1-sol | high | 3 | no | ok (c2a2a05) | 2657054 |
| 3 | plan-review | openai | gpt-6.1-sol | high | 3 | no | ok (7e1860b) | 1343889 |
| 4 | implement | openai | gpt-6.1-sol | medium | 2 | yes | failed | 17155478 |
| 5 | implement | openai | gpt-6-astra | medium | 4 | no | failed | 12446288 |

Steps: 5 · Tokens: 33912561 (figures for 5 of 5 steps)

## Code committed by the router

These paths sat uncommitted when a step ended and went into the router's `chore` step commit, so release-please lists no changelog line for them.

- step 1 score (5822247):
  - `.codex/config.toml`
  - `context/foundation/agent-smith-policy.json`

## Rolled-back steps

Partial edits of failed steps, kept under a side ref. Inspect one with `git show --stat <ref>`.

- step 4 implement: `refs/agent-smith/agent-call-parameters/e5eabe79efac/failed-4` rolled back to 7e1860b

## Neutral reruns

Steps returned again unchanged (same prompt, model and effort) after the orchestrator declared a fault of its own; no failed attempt was counted. The notes are the orchestrator's.

- step 1 score: 3 reruns after an orchestrator fault
  - Codex permission preflight cannot verify required Git capability. Check the existing default configuration or selected optional profile, managed requirements, outer host permissions and native sandbox
  - Codex permission preflight cannot verify required Git capability. Check the existing default configuration or selected optional profile, managed requirements, outer host permissions and native sandbox
  - Permission configuration repaired and exact native Git commit preflight passed. Resume the original pending dispatch.

## Review findings

Counts as recorded when each review step ended; later edits of a review file are not reflected.

- step 3 plan-review: REVISE, 0 critical, 2 warnings measured; 0 critical, 0 warnings open

## Complexity score

Scores: cognitive 4, execution 5 (ambiguity 1, novelty 1, coupling 2, discovery 1, volume 2, verification 2)
Confidence: medium · Unknowns: 1
Source: score step 1

No tier shift.
