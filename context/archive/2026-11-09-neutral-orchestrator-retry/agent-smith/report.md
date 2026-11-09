# Run report: neutral-orchestrator-retry

Goal: Implement context/changes/neutral-orchestrator-retry/change.md: a neutral rerun of a logged step after an orchestrator or harness fault (no subagent ran or its report was lost), for both chains, with no failed attempt, no tier bump, no rigor rise, no rollback, no step budget use and the same prompt, shown in run.jsonl, status and report.md, with a cap against endless loops. New ADR: ADR-015.
Rigor: standard (goal plain)
Outcome: done - impl review APPROVED
Archive: requested - runs after this report was written; see the commit "chore(archive): close neutral-orchestrator-retry"

| # | Step | Model | Effort | Tier | Simple | Result | Tokens |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | score | haiku | low | 0 | no | ok (048a5ab) | - |
| 2 | plan | sonnet | high | 3 | no | ok (0e8307a) | 218435 |
| 3 | plan-review | sonnet | high | 3 | no | ok (8cc6d9c) | 185922 |
| 4 | implement | opus | medium | 4 | no | failed | 132915 |
| 5 | implement | opus | xhigh | 6 | no | ok (afa281b) | 177179 |
| 6 | manual-verify | sonnet | medium | 2 | no | ok (46e7602) | 133037 |
| 7 | impl-review | opus | high | 5 | no | ok (8b37dcc) | 191495 |

Steps: 7 · Tokens: 1038983 (figures for 6 of 7 steps)

## Rolled-back steps

Partial edits of failed steps, kept under a side ref. Inspect one with `git show --stat <ref>`.

- step 4 implement: `refs/agent-smith/neutral-orchestrator-retry/82431871c992/failed-4` rolled back to 8cc6d9c

## Review findings

Counts as recorded when each review step ended; later edits of a review file are not reflected.

- step 3 plan-review: REVISE, 0 critical, 2 warnings measured; 0 critical, 0 warnings open
- step 7 impl-review: APPROVED, 0 critical, 1 warnings measured; 0 critical, 0 warnings open

## Manual checks

Rows as recorded when the last manual-verify step ended. The kind comes from the evidence file name; the router never reads the content.

Proved: 6

- 1.4 In a scratch project, a step logged by `init`, then `{"status":"orchestrator-error"}` written and `next` run, returns the same prompt text twice (diff the two outputs) — script (evidence/script-neutral-scratch.out.txt)
- 1.5 A third `orchestrator-error` result for the same step halts with the cap text — script (evidence/script-neutral-scratch.out.txt)
- 2.4 `report.md` of a scratch run with one neutral rerun reads clearly and shows the section — script (evidence/script-neutral-scratch.out.txt)
- 2.5 `status` of the same run shows `neutralRetries` on the right row only — test (evidence/test-neutral-status-report.txt)
- 3.4 The two skill texts read the same for the new rule and mention no model, effort or tier — judgment (evidence/judgment-skills-docs.txt)
- 3.5 `docs/REFERENCE.md` and ADR-015 agree with the router on the status name, the field names and the default cap — judgment (evidence/judgment-skills-docs.txt)

Not proved: 0

## Complexity score

Scores: cognitive 6, execution 7 (ambiguity 2, novelty 2, coupling 2, discovery 2, volume 3, verification 2)
Confidence: medium · Unknowns: 3
Source: score step 1

Tier shifts (cognitive moves plan, execution moves implement; one rung each):

- implement +1 (step 4)
- implement +1 (step 5)
