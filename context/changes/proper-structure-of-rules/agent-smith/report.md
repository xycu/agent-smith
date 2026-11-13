# Run report: proper-structure-of-rules

Goal: Give the agent-smith rules a hierarchy of three levels: level 1 top, applies to everything; level 2 framework, either the 10xDevs chain or the OpenSpec chain; level 3 skill or step specific, for example only the research step. Split every level into two categories: always-true rules that lower levels may not change, and default rules that a lower level may override. Move the OpenSpec definitions (the os-* prompt files, the os-* steps and prompts in policy.json, the OpenSpec router module and its tests) out of skills/10x-pipeline into skills/openspec-pipeline; the owner chose skills/openspec-pipeline as the OpenSpec folder. Use context/changes/proper-structure-of-rules/research.md as the evidence base and settle its open questions in the plan: how always-true is made binding, the file layout of the layers, the @prompts resolver form, the ADR-013 amendment and the order against the open changes that touch the same files.
Rigor: thorough (signals, hot paths .github/workflows/ci.yml, skills/10x-pipeline/policy.json, skills/10x-pipeline/scripts/flow.mjs +4)
Outcome: done - impl review APPROVED
Archive: requested - runs after this report was written; see the commit "chore(archive): close proper-structure-of-rules"
Manual checks pending: 2
- 3.6 The plugin installed from this branch runs both chains with prompts that end with the rules/top.md rules
- 3.7 The owner records the order in WAVES.md on main and notes the moved paths in the open changes
Manual checks not proved: 2
- 3.6 The plugin installed from this branch runs both chains with prompts that end with the rules/top.md rules — not proved: needs the plugin installed from this branch and live /agent-smith:openspec-pipeline and /agent-smith:10x-pipeline runs in scratch projects; not possible in a subagent without a live pipeline run
- 3.7 The owner records the order in WAVES.md on main and notes the moved paths in the open changes — not proved: owner action on main (WAVES.md and change.md notes in other changes); outside this run root and after merge

| # | Step | Model | Effort | Tier | Simple | Result | Tokens |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | score | haiku | low | 0 | no | ok (854213e), 1 neutral rerun | 76866 |
| 2 | plan | opus | high | 5 | no | ok (2ba5b44) | 114739 |
| 3 | plan-review | sonnet | high | 3 | no | ok (12491b6) | - |
| 4 | implement | opus | high | 5 | no | ok (2d8b3be) | - |
| 5 | manual-verify | sonnet | medium | 2 | no | ok (f30ff7f) | - |
| 6 | manual-verify | sonnet | high | 3 | no | ok (d8ded1c) | - |
| 7 | impl-review | opus | high | 5 | no | ok (0967490) | - |

Steps: 7 · Tokens: 191605 (figures for 2 of 7 steps)

## Neutral reruns

Steps returned again unchanged (same prompt, model and effort) after the orchestrator declared a fault of its own; no failed attempt was counted. The notes are the orchestrator's.

- step 1 score: 1 rerun after an orchestrator fault
  - init output was cut by the orchestrator, so the prompt could not be passed whole; no subagent ran

## Review findings

Counts as recorded when each review step ended; later edits of a review file are not reflected.

- step 3 plan-review: REVISE, 0 critical, 3 warnings measured; 0 critical, 0 warnings open
- step 7 impl-review: APPROVED, 0 critical, 0 warnings measured; 0 critical, 0 warnings open

## Manual checks

Rows as recorded when the last manual-verify step ended. The kind comes from the evidence file name; the router never reads the content. Only browser, test, command or script evidence proves a browser row.

Proved: 2

- 1.9 An OpenSpec run prompt reads the same as before the move — command (evidence/command-os-propose-same-after-move.txt)
- 2.7 The owner agrees with the always-true versus default split of the former suffix lines — judgment (evidence/judgment-top-vs-suffix-split.md)

Not proved: 2

- 3.6 The plugin installed from this branch runs both chains with prompts that end with the rules/top.md rules — not proved: needs the plugin installed from this branch and live /agent-smith:openspec-pipeline and /agent-smith:10x-pipeline runs in scratch projects; not possible in a subagent without a live pipeline run
- 3.7 The owner records the order in WAVES.md on main and notes the moved paths in the open changes — not proved: owner action on main (WAVES.md and change.md notes in other changes); outside this run root and after merge

## Complexity score

Scores: cognitive 7, execution 7 (ambiguity 2, novelty 2, coupling 3, discovery 2, volume 3, verification 2)
Confidence: medium · Unknowns: 5
Source: score step 1

Tier shifts (cognitive moves plan, execution moves implement; one rung each):

- plan +1 (step 2)
- implement +1 (step 4)
