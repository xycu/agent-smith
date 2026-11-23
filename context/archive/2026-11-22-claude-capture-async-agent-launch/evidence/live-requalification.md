# Live requalification: interactive launcher run on Claude Code 2.1.323

Status: done on 2026-11-23. One complete interactive launcher run of the probe project ended with verified figures for all five steps. This note holds no transcript text, prompts or capture logs.

## Live run

Host: Claude Code 2.1.323, one interactive session started with `claude-capture.mjs`, then `/agent-smith:10x-pipeline` on a fresh change (rigor lean, so no `score` step). The collector ran from the branch head `b3f93748`, which holds the root-only launch settlement and the review fixes (side queries need their own response event; a null stop hash is accepted for the launched root only).

| Step | Name | Result at intake | Result now | Step total | `subagent_completed` total | Requests counted | Telemetry-only requests |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | plan | verified | verified | 208780 | 73676 | 3 | 0 |
| 2 | plan-review | verified | verified | 230299 | 83084 | 3 | 0 |
| 3 | implement | verified | verified | 207277 | 71975 | 3 | 0 |
| 4 | manual-verify | incomplete-capture | verified | 290193 | 74886 | 4 | 0 |
| 5 | impl-review | verified | verified | 312170 | 83224 | 4 | 0 |

Total 1248719 tokens across the five steps. Every step total is the sum of all requests of the step agent; each `subagent_completed` total equals the final request's bucket sum, as the collector requires. In this run every `api_request` of a step agent had a transcript entry, so no telemetry-only request was counted and the new response-event rule was not exercised live. The earlier failed run (below) did hold such requests.

All five PostToolUse records were launches (projected status `other`), and all five `SubagentStop` records had a null text hash. The settlement path therefore ran on the live shape the change targets. The earlier run's `incomplete-capture` on every step is not reproduced.

## Late recheck

Step 4 ended `incomplete-capture` at intake and was settled afterwards with the router's `usage` command, which returned `verified` with the same descriptor. The capture holds the step's `subagent_completed` event in the same telemetry batch as its last request, like the other steps, so the capture itself was complete. The likely cause is that the telemetry for that step had not been flushed when the orchestrator first collected; that is not verified. The late path (ADR-019) exists for this case.

The earlier `unsupported-schema` result of the failed run did not occur in this run's late recheck, and an offline replay of that run never reproduced it. Its cause stays unknown and is not recorded as a defect.

## Earlier failed run, replayed offline

The original collector ended all six steps of that run `incomplete-capture`. The changed collector verified all six from the saved capture (`score` 358385, `plan` 336898, `plan-review` 392837, `implement` 385039, `manual-verify` 286794, `impl-review` 483445). Steps 3 to 6 held telemetry-only `api_request` events (some with a response event); the response-event rule keeps all six verified.

## For the owner

- Rows 2.4 and 2.5 of `claude-token-figures-default`: an interactive launcher run on 2.1.323 produced verified figures for every step. A headless run was not recorded here.
- Archive of `claude-token-figures-default`: this note and the README/REFERENCE wording are the evidence for the decision.
