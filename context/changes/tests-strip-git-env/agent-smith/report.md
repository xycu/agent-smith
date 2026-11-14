# Run report: tests-strip-git-env

Goal: Make Git-using test environments strip all inherited GIT_ variables before applying explicit fixture overrides, including the shared helpers and standalone environment builders. Follow context/changes/tests-strip-git-env/change.md. Prove hostile inherited GIT_DIR, GIT_WORK_TREE and GIT_INDEX_FILE cannot mutate a victim repository while child tests pass. Own test environment helpers and environment spread sites in Wave 4. Respect the Wave 4 ownership table in context/changes/WAVES.md, resolve historical paths against current layout, leave WAVES.md to the post-wave maintenance change, and avoid changes owned by sibling runs. Shared documentation and skill-content tests may be updated only for this change's behavior.
Rigor: standard (goal plain)
Outcome: done - impl review APPROVED
Code under chore commits: 3 path(s) in 2 step commit(s); see "Code committed by the router"

| # | Step | Provider | Model | Effort | Tier | Simple | Result | Tokens |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | score | openai | gpt-6-luna | low | 0 | no | ok (30966b2), 3 neutral reruns | 137099 |
| 2 | plan | openai | gpt-6.1-sol | high | 3 | no | ok (f534140) | 1928421 |
| 3 | plan-review | openai | gpt-6.1-sol | high | 3 | no | ok (bae216b) | 1105228 |
| 4 | implement | openai | gpt-6.1-sol | medium | 2 | no | ok (0f7281f) | 15027309 |
| 5 | impl-review | openai | gpt-6.1-sol | high | 3 | no | ok (be67caf) | 8105777 |

Steps: 5 · Tokens: 26303834 (figures for 5 of 5 steps)

## Code committed by the router

These paths sat uncommitted when a step ended and went into the router's `chore` step commit, so release-please lists no changelog line for them.

- step 1 score (30966b2):
  - `.codex/config.toml`
  - `context/foundation/agent-smith-policy.json`
- step 4 implement (0f7281f):
  - `AGENTS.md`

## Neutral reruns

Steps returned again unchanged (same prompt, model and effort) after the orchestrator declared a fault of its own; no failed attempt was counted. The notes are the orchestrator's.

- step 1 score: 3 reruns after an orchestrator fault
  - Codex permission preflight cannot verify required Git capability. Check the existing default configuration or selected optional profile, managed requirements, outer host permissions and native sandbox
  - Codex permission preflight cannot verify required Git capability. Check the existing default configuration or selected optional profile, managed requirements, outer host permissions and native sandbox
  - Permission configuration repaired and exact native Git commit preflight passed. Resume the original pending dispatch.

## Review findings

Counts as recorded when each review step ended; later edits of a review file are not reflected.

- step 3 plan-review: REVISE, 0 critical, 1 warnings measured; 0 critical, 0 warnings open
- step 5 impl-review: APPROVED, 0 critical, 0 warnings measured; 0 critical, 0 warnings open

## Complexity score

Scores: cognitive 3, execution 5 (ambiguity 0, novelty 1, coupling 2, discovery 2, volume 2, verification 1)
Confidence: high · Unknowns: 0
Source: score step 1

No tier shift.
