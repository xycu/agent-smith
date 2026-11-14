# Run report: docs-drift-fixes

Goal: Reconcile all seven documented drift items against current code and already-merged changes: isolated report location, PR-comment references, duplicate run-lock prose, OpenSpec live-run history, ADR amendments and stale section pointers, prompt placeholders and unknown rendering, manifest descriptions with an equality check and test. Preserve ADR history and release-owned versions. Follow context/changes/docs-drift-fixes/change.md and Wave 6 ownership, keeping shared documentation edits in distinct regions from sibling id-limit and nesting changes. Leave WAVES.md and context/archive untouched.
Rigor: standard (goal plain)
Outcome: done - impl review APPROVED

| # | Step | Provider | Model | Effort | Tier | Simple | Result | Tokens |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | score | openai | gpt-6-luna | low | 0 | no | failed, 3 neutral reruns | - |
| 2 | score | openai | gpt-6.1-sol | low | 1 | no | ok (61c38a7) | 251144 |
| 3 | plan | openai | gpt-6.1-sol | high | 3 | no | ok (1be405b) | 2589452 |
| 4 | plan-review | openai | gpt-6.1-sol | high | 3 | no | ok (d1419b0) | 1109951 |
| 5 | implement | openai | gpt-6.1-sol | medium | 2 | no | ok (38a3aee) | 22681651 |
| 6 | impl-review | openai | gpt-6-astra | high | 5 | no | ok (e25e5e1) | 5521901 |

Steps: 6 · Tokens: 32154099 (figures for 5 of 6 steps)

## Neutral reruns

Steps returned again unchanged (same prompt, model and effort) after the orchestrator declared a fault of its own; no failed attempt was counted. The notes are the orchestrator's.

- step 1 score: 3 reruns after an orchestrator fault
  - Codex permission preflight cannot verify required Git capability. Check the existing default configuration or selected optional profile, managed requirements, outer host permissions and native sandbox
  - Codex permission preflight cannot verify required Git capability. Check the existing default configuration or selected optional profile, managed requirements, outer host permissions and native sandbox
  - Codex permission preflight cannot verify required Git capability. Check the existing default configuration or selected optional profile, managed requirements, outer host permissions and native sandbox

## Review findings

Counts as recorded when each review step ended; later edits of a review file are not reflected.

- step 4 plan-review: SOUND, 0 critical, 0 warnings measured
- step 6 impl-review: APPROVED, 0 critical, 0 warnings measured

## Complexity score

Scores: cognitive 4, execution 6 (ambiguity 1, novelty 1, coupling 2, discovery 1, volume 3, verification 2)
Confidence: high · Unknowns: 0
Source: score step 2

No tier shift.
