# Run report: release-after-green-ci

Goal: Release only from a main commit whose CI run passed: a commit on main whose CI run failed or was cancelled must produce no release PR update and no tag, and every push to main must end with a CI result. Scope and details in context/changes/release-after-green-ci/change.md.
Rigor: standard (goal plain)
Outcome: halt - Step 6 (implement) needs a human: Row 3.1 needs the run branch merged to main and then a check of gh run list --workflow Release; an implement step cannot prove it, so further implement retries will loop.

| # | Step | Model | Effort | Tier | Simple | Result | Tokens |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | score | haiku | low | 0 | no | ok (218081d) | 79694 |
| 2 | plan | sonnet | high | 3 | no | ok (73f5eb1) | 114878 |
| 3 | plan-review | sonnet | high | 3 | no | ok (5a34f6b), 1 neutral rerun | 100967 |
| 4 | implement | sonnet | high | 3 | no | ok (858d851) | 129685 |
| 5 | implement | sonnet | high | 3 | no | failed | 90426 |
| 6 | implement | opus | high | 5 | no | failed | 89005 |

Steps: 6 · Tokens: 604655 (figures for 6 of 6 steps)

## Rolled-back steps

Partial edits of failed steps, kept under a side ref. Inspect one with `git show --stat <ref>`.

- step 5 implement: `refs/agent-smith/release-after-green-ci/341a0398ff78/failed-5` rolled back to 858d851

## Neutral reruns

Steps returned again unchanged (same prompt, model and effort) after the orchestrator declared a fault of its own; no failed attempt was counted. The notes are the orchestrator's.

- step 3 plan-review: 1 rerun after an orchestrator fault
  - Orchestrator session was killed while step 3 (plan-review) ran; no subagent of the step is running. Resumed run reruns the step unchanged.

## Review findings

Counts as recorded when each review step ended; later edits of a review file are not reflected.

- step 3 plan-review: SOUND, 0 critical, 1 warnings measured; 0 critical, 0 warnings open

## Complexity score

Scores: cognitive 5, execution 5 (ambiguity 1, novelty 2, coupling 2, discovery 1, volume 2, verification 2)
Confidence: medium · Unknowns: 3
Source: score step 1

No tier shift.
