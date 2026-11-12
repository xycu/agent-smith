# Run report: coauthor-test-coarse-mtime

Goal: Fix the coauthor tests that fail on Linux CI from a coarse file clock: coauthor.test.mjs must write every plan that stands for a step's output through ahead.mjs, and no other test file may write a step's plan output with the plain helper. Scope and details in context/changes/coauthor-test-coarse-mtime/change.md. Done when the suite passes locally and CI on main is green.
Rigor: standard (goal plain)
Outcome: done - impl review PASS

| # | Step | Model | Effort | Tier | Simple | Result | Tokens |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | score | haiku | low | 0 | no | ok (801c198) | 80854 |
| 2 | plan | sonnet | high | 3 | no | ok (963f135) | 121518 |
| 3 | plan-review | sonnet | high | 3 | no | ok (549eac3), 1 neutral rerun | 103855 |
| 4 | implement | sonnet | medium | 2 | no | ok (5e95f9c) | 81352 |
| 5 | manual-verify | sonnet | medium | 2 | no | ok (09c8d5c) | 75619 |
| 6 | manual-verify | sonnet | high | 3 | no | ok (fa9de41) | 76797 |
| 7 | impl-review | sonnet | high | 3 | no | ok (fc3cefb) | 89752 |

Steps: 7 · Tokens: 629747 (figures for 7 of 7 steps)

## Neutral reruns

Steps returned again unchanged (same prompt, model and effort) after the orchestrator declared a fault of its own; no failed attempt was counted. The notes are the orchestrator's.

- step 3 plan-review: 1 rerun after an orchestrator fault
  - Previous orchestrator and its plan-review subagent were killed mid-step; no subagent of step 3 is running and no review file was written. Resumed run reruns step 3 unchanged.

## Review findings

Counts as recorded when each review step ended; later edits of a review file are not reflected.

- step 3 plan-review: SOUND, 0 critical, 0 warnings measured; 0 critical, 0 warnings open
- step 7 impl-review: PASS, 0 critical, 0 warnings measured; 0 critical, 0 warnings open

## Manual checks

Rows as recorded when the last manual-verify step ended. The kind comes from the evidence file name; the router never reads the content. Only browser, test, command or script evidence proves a browser row.

Proved: 0

Not proved: 1

- 2.4 CI on `main` is green on the self-hosted runner after the fix is merged — not proved: needs a CI run on main after the fix is merged; the fix is still on run branch agent-smith/coauthor-test-coarse-mtime, so no such run exists, and reading CI needs an external service

## Complexity score

Scores: cognitive 2, execution 4 (ambiguity 1, novelty 0, coupling 1, discovery 1, volume 1, verification 2)
Confidence: medium · Unknowns: 3
Source: score step 1

No tier shift.
