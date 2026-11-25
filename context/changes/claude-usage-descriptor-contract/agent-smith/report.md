# Run report: claude-usage-descriptor-contract

Transcript figures can undercount Claude usage because some requests appear only in telemetry.

Goal: Record native Claude step token usage at step time without a hand-built orchestrator descriptor: the router measures the Claude transcript at next (or owns identity and an evidence-present check), the orchestrator supplies at most the host-only agentId, a Claude step with no evidence is flagged instead of silently accepted, claude-usage.mjs stops labeling a JSON parse error unsupported-schema, and both SKILL.md loops shrink to match. Inputs: context/changes/claude-usage-descriptor-contract/frame.md and research.md; settle its six open questions in the plan.
Rigor: thorough (hot paths skills/10x-pipeline/scripts/claude-usage.mjs, skills/10x-pipeline/scripts/flow.mjs, skills/10x-pipeline/scripts/isolation.mjs +10)
Provider mode: split
Outcome: done - impl review APPROVED

| # | Step | Provider | Model | Effort | Tier | Simple | Result | Tokens |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | score | claude | haiku | low | 0 | no | ok (f094bc0) | 542409 |
| 2 | plan | openai | gpt-6.2-astra | high | 5 | no | ok (3dffdba) | 1576780 |
| 3 | plan-review | claude | sonnet | high | 3 | no | ok (8ceedda) | 1713988 |
| 4 | implement | openai | gpt-6.2-astra | xhigh | 6 | no | ok (dfeef56) | 30983958 |
| 5 | manual-verify | claude | sonnet | medium | 2 | no | ok (29744dc) | 305569 |
| 6 | manual-verify | claude | sonnet | high | 3 | no | ok (66d2ce3) | 419256 |
| 7 | impl-review | claude | opus | high | 5 | no | ok (411d001) | 6323212 |

Steps: 7 · Tokens: 41865172 (figures for 7 of 7 steps)

## Token coverage

Verified observed host usage: 2 · Unavailable: 0 · Legacy/unverified scope: 0 · Missing figures: 0 · Transcript: 5
Provider, model and tier groups describe the enclosing dispatch.

## Review findings

Counts as recorded when each review step ended; later edits of a review file are not reflected.

- step 3 plan-review: REVISE, 0 critical, 3 warnings measured; 0 critical, 1 warnings open
- step 7 impl-review: APPROVED, 0 critical, 0 warnings measured; 0 critical, 0 warnings open

## Manual checks

Rows as recorded when the last manual-verify step ended. The kind comes from the evidence file name; the router never reads the content. Only browser, test, command or script evidence proves a browser row.

Proved: 0

Not proved: 1

- 3.2 Observe one background native step on a qualified Claude host and compare its immediate report with the same invocation’s collector result. — not proved: needs a live background native step on a qualified Claude host whose intake figure is compared with the standalone collector for the same invocation; this unattended manual-verify step cannot observe

## Complexity score

Scores: cognitive 7, execution 7 (ambiguity 2, novelty 2, coupling 3, discovery 2, volume 3, verification 2)
Confidence: medium · Unknowns: 4
Source: score step 1

Tier shifts (cognitive moves plan, execution moves implement; one rung each):

- plan +1 (step 2)
- implement +1 (step 4)
