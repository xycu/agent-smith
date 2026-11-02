# Run report: managed-agent-patterns

Goal: Add run provenance, tool-restricted step agents and an opt-in advisor, as described in change.md
Rigor: thorough (--rigor thorough)
Outcome: done - impl review APPROVED

| # | Step | Model | Effort | Tier | Simple | Result | Tokens |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | research | sonnet | high | 3 | no | ok | - |
| 2 | score | haiku | low | 0 | no | ok | 89687 |
| 3 | plan | sonnet | high | 3 | yes | ok | - |
| 4 | plan-review | sonnet | high | 3 | no | ok | - |
| 5 | implement | opus | xhigh | 5 | no | ok | - |
| 6 | manual-verify | sonnet | high | 3 | no | ok | - |
| 7 | impl-review | opus | high | 4 | no | ok | - |

Steps: 7 · Tokens: 89687 (figures for 1 of 7 steps) · Skipped: 2

## Skipped steps

| After step | Step | Reason | Rigor |
| --- | --- | --- | --- |
| 1 | domain-brief | rigor thorough: domain-brief skipped (no signal; aggregateGap: no distillation file; dependencyLeak: no dependency phrase in the goal) | thorough |
| 1 | frame | rigor thorough: frame skipped (no signal; framingDoubt: no cause-shaped or design-shaped goal phrase, no signals.rigor of an earlier step) | thorough |

## Complexity score

Scores: cognitive 7, execution 8 (ambiguity 2, novelty 2, coupling 3, discovery 2, volume 3, verification 3)
Confidence: medium · Unknowns: 5
Source: score step 2

Tier shifts (cognitive moves plan, execution moves implement; one rung each):

- plan +1 not applied (clamp or floor) (step 3)
- implement +1 (step 5)
