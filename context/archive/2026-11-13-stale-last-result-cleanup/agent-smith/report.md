# Run report: stale-last-result-cleanup

Goal: Prevent a crash after result persistence from allowing stale last-result.json to become a later step result. Fix shared result ownership and cleanup at its responsible router layer, preserving normal consumption, neutral retries, late usage and crash recovery. Prove both chains and isolated runs with regression tests and update routing documentation. Follow this change.md and current atomic-write architecture. Leave WAVES.md and context/archive untouched.
Rigor: standard (goal hard)
Outcome: done - impl review APPROVED

| # | Step | Provider | Model | Effort | Tier | Simple | Result | Tokens |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | score | openai | gpt-6-luna | low | 0 | no | ok (e3b582f), 4 neutral reruns | 177941 |
| 2 | plan | openai | gpt-6-astra | high | 5 | no | ok (714e66c) | 1516555 |
| 3 | plan-review | openai | gpt-6.1-sol | high | 3 | no | ok (d673bda) | 889358 |
| 4 | implement | openai | gpt-6.1-sol | medium | 2 | no | ok (5e08f19) | 15799606 |
| 5 | impl-review | openai | gpt-6.1-sol | high | 3 | no | ok (4751a7d) | 9153282 |

Steps: 5 · Tokens: 27536742 (figures for 5 of 5 steps)

## Neutral reruns

Steps returned again unchanged (same prompt, model and effort) after the orchestrator declared a fault of its own; no failed attempt was counted. The notes are the orchestrator's.

- step 1 score: 4 reruns after an orchestrator fault
  - Codex permission preflight cannot verify required Git capability. Check the existing default configuration or selected optional profile, managed requirements, outer host permissions and native sandbox
  - Codex permission preflight cannot verify required Git capability. Check the existing default configuration or selected optional profile, managed requirements, outer host permissions and native sandbox
  - Codex permission preflight cannot verify required Git capability. Check the existing default configuration or selected optional profile, managed requirements, outer host permissions and native sandbox
  - User approved scoped Git metadata permissions and resumption. All three exact run-root Git probes now pass. Allow one neutral rerun after repairing harness permissions.

## Review findings

Counts as recorded when each review step ended; later edits of a review file are not reflected.

- step 3 plan-review: REVISE, 0 critical, 1 warnings measured; 0 critical, 0 warnings open
- step 5 impl-review: APPROVED, 0 critical, 0 warnings measured

## Complexity score

Scores: cognitive 5, execution 5 (ambiguity 1, novelty 1, coupling 3, discovery 2, volume 2, verification 1)
Confidence: medium · Unknowns: 0
Source: score step 1

No tier shift.
