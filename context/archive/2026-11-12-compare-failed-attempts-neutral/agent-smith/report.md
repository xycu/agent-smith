# Run report: compare-failed-attempts-neutral

Goal: Make compare count failed attempts using the router shared isFailure rule so advisory score failures and fallbacks stay neutral, choose and document treatment of cheap first-attempt failures using existing semantics, and cover JSON and Markdown output plus pinned baseline compatibility. Follow context/changes/compare-failed-attempts-neutral/change.md. Own compare behavior in route.mjs in Wave 4. Respect the Wave 4 ownership table in context/changes/WAVES.md, resolve historical paths against current layout, leave WAVES.md to the post-wave maintenance change, and avoid changes owned by sibling runs. Shared documentation and skill-content tests may be updated only for this change's behavior.
Rigor: standard (goal plain)
Outcome: done - impl review APPROVED
Code under chore commits: 3 path(s) in 2 step commit(s); see "Code committed by the router"

| # | Step | Provider | Model | Effort | Tier | Simple | Result | Tokens |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | score | openai | gpt-6-luna | low | 0 | no | ok (bc8911f), 3 neutral reruns | 236922 |
| 2 | plan | openai | gpt-6.1-sol | high | 3 | no | ok (aaa6942) | 2166805 |
| 3 | plan-review | openai | gpt-6.1-sol | high | 3 | no | ok (418023c) | 934313 |
| 4 | implement | openai | gpt-6.1-sol | medium | 2 | no | ok (abf55be) | 17112028 |
| 5 | impl-review | openai | gpt-6.1-sol | high | 3 | no | ok (265ae0a) | 3894314 |

Steps: 5 · Tokens: 24344382 (figures for 5 of 5 steps)

## Code committed by the router

These paths sat uncommitted when a step ended and went into the router's `chore` step commit, so release-please lists no changelog line for them.

- step 1 score (bc8911f):
  - `.codex/config.toml`
  - `context/foundation/agent-smith-policy.json`
- step 4 implement (abf55be):
  - `AGENTS.md`

## Neutral reruns

Steps returned again unchanged (same prompt, model and effort) after the orchestrator declared a fault of its own; no failed attempt was counted. The notes are the orchestrator's.

- step 1 score: 3 reruns after an orchestrator fault
  - Codex permission preflight cannot verify required Git capability. Check the existing default configuration or selected optional profile, managed requirements, outer host permissions and native sandbox
  - Codex permission preflight cannot verify required Git capability. Check the existing default configuration or selected optional profile, managed requirements, outer host permissions and native sandbox
  - Permission configuration repaired and exact native Git commit preflight passed. Resume the original pending dispatch.

## Review findings

Counts as recorded when each review step ended; later edits of a review file are not reflected.

- step 3 plan-review: SOUND, 0 critical, 0 warnings measured
- step 5 impl-review: APPROVED, 0 critical, 0 warnings measured

## Complexity score

Scores: cognitive 4, execution 3 (ambiguity 1, novelty 1, coupling 2, discovery 1, volume 2, verification 0)
Confidence: high · Unknowns: 0
Source: score step 1

No tier shift.
