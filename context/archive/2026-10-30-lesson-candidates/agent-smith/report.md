# Run report: lesson-candidates

Goal: Carry lesson candidates from the impl-review, in RESULT signals, into report.md, each with a ready /10x-lesson <seed> command. impl-review has no lesson-candidate section, so its prompt asks the subagent for them. /10x-lesson never runs unattended. Update SKILL.md, the README and ADR-003.
Rigor: thorough (hot paths skills/10x-pipeline/policy.json, skills/10x-pipeline/scripts/route.mjs, skills/10x-pipeline/test/executors.test.mjs)
Outcome: done - impl review APPROVED

| # | Step | Model | Effort | Tier | Simple | Result | Tokens |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | plan | sonnet | high | 3 | no | ok | 156742 |
| 2 | plan-review | sonnet | high | 3 | no | ok | 112596 |
| 3 | plan | opus | xhigh | 5 | no | ok | 156344 |
| 4 | plan-review | sonnet | high | 3 | no | ok | 117803 |
| 5 | implement (implement-segment) | sonnet | high | 3 | no | ok | 111700 |
| 6 | implement (implement-tdd) | sonnet | high | 3 | no | ok | 112801 |
| 7 | implement | sonnet | high | 3 | no | ok | 142669 |
| 8 | impl-review | opus | high | 4 | no | ok | 124661 |

Steps: 8 · Tokens: 1035316 (figures for 8 of 8 steps)

## Lesson candidates

Candidates from the implementation review. Run a command yourself; the pipeline never runs `/10x-lesson`.

- `/10x-lesson Always update every summary line that lists or counts sections, files or ADRs, such as status lines and index ranges, when a change adds one of them.` (step 8)
