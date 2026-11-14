# Run report: coverage-and-failed-undo-test

Goal: Measure router-module coverage in CI with Node built-in coverage and cover both failed rollback-undo halt paths, asserting recovery text and snapshot refs. Inspect uncovered halt and recovery ranges and record coverage evidence without an initial threshold. Follow context/changes/coverage-and-failed-undo-test/change.md and Wave 6 ownership. Leave WAVES.md and context/archive untouched.
Rigor: standard (goal plain)
Outcome: done - impl review APPROVED

| # | Step | Provider | Model | Effort | Tier | Simple | Result | Tokens |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | score | openai | gpt-6-luna | low | 0 | no | failed, 3 neutral reruns | - |
| 2 | score | openai | gpt-6.1-sol | low | 1 | no | ok (80fe12a) | 272662 |
| 3 | plan | openai | gpt-6.1-sol | high | 3 | no | ok (ae0ad03) | 5498328 |
| 4 | plan-review | openai | gpt-6.1-sol | high | 3 | no | ok (f6a635e) | 992735 |
| 5 | implement | openai | gpt-6.1-sol | medium | 2 | no | ok (3b74210) | 24124793 |
| 6 | manual-verify | openai | gpt-6.1-sol | medium | 2 | no | ok (9649d95) | 260488 |
| 7 | manual-verify | openai | gpt-6.1-sol | high | 3 | no | ok (d42bfd3) | 255269 |
| 8 | impl-review | openai | gpt-6.1-sol | high | 3 | no | ok (7748e66) | 4987840 |

Steps: 8 · Tokens: 36392115 (figures for 7 of 8 steps)

## Neutral reruns

Steps returned again unchanged (same prompt, model and effort) after the orchestrator declared a fault of its own; no failed attempt was counted. The notes are the orchestrator's.

- step 1 score: 3 reruns after an orchestrator fault
  - Codex permission preflight cannot verify required Git capability. Check the existing default configuration or selected optional profile, managed requirements, outer host permissions and native sandbox
  - Codex permission preflight cannot verify required Git capability. Check the existing default configuration or selected optional profile, managed requirements, outer host permissions and native sandbox
  - Codex permission preflight cannot verify required Git capability. Check the existing default configuration or selected optional profile, managed requirements, outer host permissions and native sandbox

## Review findings

Counts as recorded when each review step ended; later edits of a review file are not reflected.

- step 4 plan-review: SOUND, 0 critical, 1 warnings measured; 0 critical, 0 warnings open
- step 8 impl-review: APPROVED, 0 critical, 0 warnings measured; 0 critical, 0 warnings open

## Manual checks

Rows as recorded when the last manual-verify step ended. The kind comes from the evidence file name; the router never reads the content. Only browser, test, command or script evidence proves a browser row.

Proved: 0

Not proved: 1

- 2.6 A green CI run for this change shows the native router-module coverage table, execution of the four Linux regression cases, expected skip identities and recorded runner timing, with its run URL in the coverage evidence. — not proved: Retried read-only GitHub queries for the run branch, current HEAD and Phase 2 implementation commit; all returned no CI runs. No pull request or published branch ref exists. The required green CI log,

## Complexity score

Scores: cognitive 3, execution 5 (ambiguity 1, novelty 1, coupling 1, discovery 2, volume 1, verification 2)
Confidence: medium · Unknowns: 2
Source: score step 2

No tier shift.
