# Run report: stale-main-change-copy

Goal: Prevent duplicate runs of archived changes in both chains and safely remove byte-identical untracked main-checkout change files only after the isolated start commit retains them. Extend prepare-run.mjs cleanup and init guards, preserve tracked or changed files and unchanged resumes, update both skills and tests. Follow Wave 5 ownership in context/changes/WAVES.md and the change brief. Leave WAVES.md and context/archive untouched.
Rigor: thorough (hot paths skills/10x-pipeline/scripts/route.mjs, skills/10x-pipeline/test/archive.test.mjs, skills/10x-pipeline/test/skill-loop.test.mjs)
Outcome: done - impl review APPROVED

| # | Step | Provider | Model | Effort | Tier | Simple | Result | Tokens |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | score | openai | gpt-6-luna | low | 0 | no | ok (93ffef0), 2 neutral reruns | 161387 |
| 2 | plan | openai | gpt-6.1-sol | high | 3 | no | ok (643a68f) | 2514267 |
| 3 | plan-review | openai | gpt-6.1-sol | high | 3 | no | ok (1d032e4) | 2430707 |
| 4 | implement | openai | gpt-6.1-sol | high | 3 | no | ok (9e86e96) | 22536076 |
| 5 | manual-verify | openai | gpt-6.1-sol | medium | 2 | no | ok (4c18618) | 459387 |
| 6 | manual-verify | openai | gpt-6.1-sol | high | 3 | no | ok (5f43e35) | 361369 |
| 7 | impl-review | openai | gpt-6-astra | high | 5 | no | ok (9ab96f9) | 12269395 |

Steps: 7 · Tokens: 40732588 (figures for 7 of 7 steps)

## Neutral reruns

Steps returned again unchanged (same prompt, model and effort) after the orchestrator declared a fault of its own; no failed attempt was counted. The notes are the orchestrator's.

- step 1 score: 2 reruns after an orchestrator fault
  - Codex permission preflight cannot verify required Git capability. Check the existing default configuration or selected optional profile, managed requirements, outer host permissions and native sandbox
  - Codex permission preflight cannot verify required Git capability. Check the existing default configuration or selected optional profile, managed requirements, outer host permissions and native sandbox

## Review findings

Counts as recorded when each review step ended; later edits of a review file are not reflected.

- step 3 plan-review: REVISE, 1 critical, 1 warnings measured; 0 critical, 0 warnings open
- step 7 impl-review: APPROVED, 0 critical, 0 warnings measured; 0 critical, 0 warnings open

## Manual checks

Rows as recorded when the last manual-verify step ended. The kind comes from the evidence file name; the router never reads the content. Only browser, test, command or script evidence proves a browser row.

Proved: 0

Not proved: 1

- 3.5 A live host invocation for each chain performs the post-init call before its first step and reports retained original paths in its final message. — not proved: Live host execution through both final messages requires child agents, run-state writes and external PR handling prohibited by this verification step. Five current contract tests passed, but live post

## Complexity score

Scores: cognitive 3, execution 3 (ambiguity 0, novelty 1, coupling 2, discovery 0, volume 2, verification 1)
Confidence: high · Unknowns: 0
Source: score step 1

No tier shift.
