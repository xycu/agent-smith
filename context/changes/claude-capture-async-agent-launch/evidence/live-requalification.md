# Live requalification: offline replay of the 2.1.323 capture

Status: the live interactive rerun (plan rows 3.1 to 3.5) is not done. This note records what was verified offline against the saved capture of the failed live run, and why the rerun was not automated.

## Offline replay of the failed live run

Host: Claude Code 2.1.323, interactive launcher session, six steps of the `live-capture-probe` run. The capture (`binding.json`, `hooks.jsonl`, `otel.jsonl`) and the step transcripts of that run were replayed through the changed `claude-usage.mjs`, once through the function and once through its stdin CLI (steps 1 and 3), with the capture directory in `AGENT_SMITH_CLAUDE_CAPTURE`. The original collector ended every step `incomplete-capture`.

| Step | Name | Result | Step total | `subagent_completed` total | Requests counted |
| --- | --- | --- | --- | --- | --- |
| 1 | score | verified | 358385 | 74417 | 5 |
| 2 | plan | verified | 336898 | 93810 | 4 |
| 3 | plan-review | verified | 392837 | 83445 | 7 |
| 4 | implement | verified | 385039 | 81651 | 6 |
| 5 | manual-verify | verified | 286794 | 73524 | 5 |
| 6 | impl-review | verified | 483445 | 85018 | 9 |

The step total sums every request of the step agent. `subagent_completed` equals the final request's bucket sum, as the collector's existing check requires. Steps 3 to 6 hold telemetry-only `api_request` events (some with a response event) that have no transcript entry; the collector counts them while they precede `subagent_completed`.

## Late recheck

The earlier live late recheck returned `unsupported-schema` for all six steps. The same descriptor fields replayed through the CLI with the saved capture now return `verified`, and the original collector returned `incomplete-capture` for them offline. The `unsupported-schema` result is therefore not reproduced and its cause is unknown. It may come from the descriptor the orchestrator sent or from the environment of that late call. Repeat the late recheck in the live rerun.

## Automation attempt for the live rerun

A scripted launcher session (`expect` driving `claude-capture.mjs` from a scratch directory) started the Claude Code 2.1.323 child, but the terminal interface rendered no output through the pseudo-terminal, the prompt was never submitted and no hook record was written. The attempt was stopped and nothing was kept. The live rerun needs the owner's interactive terminal.

## Still open

- Run the probe through the interactive launcher on current Claude Code and confirm every step ends `verified`.
- Repeat the late recheck for those steps.
- Then update README and `docs/REFERENCE.md` with the recorded qualification (plan row 3.4) and decide rows 2.4 and 2.5 of `claude-token-figures-default`.
