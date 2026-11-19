# Run report: codex-failure-native-lock-stuck

Goal: Release the native lock after an ordinary Codex failure so the run can retry
Rigor: thorough (hot paths skills/10x-pipeline/scripts/run-codex.mjs, skills/10x-pipeline/scripts/state.mjs, skills/10x-pipeline/test/codex-helpers.mjs +1)
Outcome: done - impl review NEEDS ATTENTION
Archive: requested - runs after this report was written; see the commit "chore(archive): close codex-failure-native-lock-stuck"

| # | Step | Provider | Model | Effort | Tier | Simple | Result | Tokens |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | score | openai | gpt-6-luna | low | 0 | no | ok (fad9b23) | 192279 |
| 2 | plan | openai | gpt-6.2-sol | high | 3 | no | ok (b5ab5d6) | 2026036 |
| 3 | plan-review | openai | gpt-6.2-sol | high | 3 | no | ok (f5bbd73) | 3487523 |
| 4 | implement | openai | gpt-6.2-sol | high | 3 | yes | ok (bb73e5c) | 17756906 |
| 5 | manual-verify | openai | gpt-6.2-sol | medium | 2 | no | ok (c604864) | 2451800 |
| 6 | impl-review | openai | gpt-6.2-sol | high | 3 | no | ok (825c746) | 13454335 |

Steps: 6 · Tokens: 39368879 (figures for 6 of 6 steps)

## Token coverage

Verified observed host usage: 6 · Unavailable: 0 · Legacy/unverified scope: 0 · Missing figures: 0
Provider, model and tier groups describe the enclosing dispatch.

## Review findings

Counts as recorded when each review step ended; later edits of a review file are not reflected.

- step 3 plan-review: REVISE, 0 critical, 3 warnings measured; 0 critical, 0 warnings open
- step 6 impl-review: NEEDS ATTENTION, 0 critical, 5 warnings measured; 0 critical, 0 warnings open

## Manual checks

Rows as recorded when the last manual-verify step ended. The kind comes from the evidence file name; the router never reads the content. Only browser, test, command or script evidence proves a browser row.

Proved: 1

- 1.5 A real Codex step fails once with provable closure in a scratch run, records `unknown`, and continues through a successful retry. — script (evidence/script-real-codex-retry.log)

Not proved: 0

## Complexity score

Scores: cognitive 5, execution 5 (ambiguity 2, novelty 1, coupling 2, discovery 1, volume 2, verification 2)
Confidence: medium · Unknowns: 0
Source: score step 1

No tier shift.

## Lesson candidates

Candidates from the implementation review. Run a command yourself; the pipeline never runs `/10x-lesson`.

- `/10x-lesson Always check recorded transport faults independently of exit codes or successful responses before releasing an execution lock.` (step 6)
