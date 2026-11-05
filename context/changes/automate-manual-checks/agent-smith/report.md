# Run report: automate-manual-checks

Goal: -
Rigor: thorough (hot paths skills/10x-pipeline/policy.json, skills/10x-pipeline/scripts/route.mjs, skills/10x-pipeline/test/executors.test.mjs +2)
Outcome: done - impl review NEEDS ATTENTION
Archive: requested - runs after this report was written; see the commit "chore(archive): close automate-manual-checks"
Manual checks pending: 9
- 1.7 In a scratch project with a plan whose only pending row is a Manual row with no command in it and the override `{"manualVerify":{"minRigor":"lean"}}`, `route.mjs init <id> --goal "x" --rigor lean` returns `step: "manual-verify"` with model `sonnet` and effort `medium`.
- 1.8 After one `next` in that scratch project with a result of status `done` and the row still unticked, the next `run` action is a second `manual-verify` on `sonnet` `high`, and after a second `done` result the run goes on to `impl-review`.
- 2.5 In a scratch project, a finished `manual-verify` step with one row ticked on `evidence/judgment-1.2.md`, one pending row and an `evidence/unproven.md` that names it ends with `report.md` holding a `## Manual checks` section that lists the first row as `judgment` and the second with its reason.
- 2.6 The same run's `done` message carries `manualNotProved` with that reason, and `status` prints `proved` and `pending` for the step.
- 3.6 In a scratch project at `standard` with the step opted in, the `run` prompt of the first `manual-verify` step names `mcp__claude-in-chrome__*`, the evidence folder, `evidence/unproven.md` and the safety rules, and the same project started with `--chrome false` returns template `manual-verify-nochrome` whose prompt does not name `ToolSearch`.
- 3.7 `skills/10x-pipeline/prompts/manual-verify.md` reads, rule by rule, as one-line instructions a subagent can follow without the earlier steps, and none lets a subagent push, publish or write inside the source tree.
- 4.5 README, SKILL.md and ADR-012 state the same defaults: every row eligible, all three rigor levels, budgets 12, 19 and 24, first attempt `sonnet/medium`, retry `sonnet/high`, Chrome on unless `--chrome false`.
- 4.6 In a scratch project, `init` and `status` print valid JSON for a change folder, and `status` after a finished `manual-verify` step shows `proved` and `pending`.
- 4.7 `grep -n "commandWords\|humanWords\|browserWords\|maxRuns" README.md skills/10x-pipeline/SKILL.md skills/10x-pipeline/policy.json` prints no live reference to the removed keys (ADR-003 keeps its history).

| # | Step | Model | Effort | Tier | Simple | Result | Tokens |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | score | haiku | low | 0 | no | ok (79f35a0) | - |
| 2 | plan | sonnet | high | 3 | no | ok (6008aaa) | - |
| 3 | plan-review | sonnet | high | 3 | no | ok (22b7248) | - |
| 4 | implement | opus | medium | 4 | no | ok (54ae3d1) | - |
| 5 | impl-review | opus | high | 5 | no | ok (f52e4ef) | - |

Steps: 5 · Tokens: - (figures for 0 of 5 steps)

## Review findings

Counts as recorded when each review step ended; later edits of a review file are not reflected.

- step 3 plan-review: REVISE, 0 critical, 2 warnings measured; 0 critical, 0 warnings open
- step 5 impl-review: NEEDS ATTENTION, 0 critical, 2 warnings measured; 0 critical, 0 warnings open

## Complexity score

Scores: cognitive 6, execution 8 (ambiguity 2, novelty 2, coupling 2, discovery 2, volume 3, verification 3)
Confidence: medium · Unknowns: 3
Source: score step 1

Tier shifts (cognitive moves plan, execution moves implement; one rung each):

- implement +1 (step 4)
