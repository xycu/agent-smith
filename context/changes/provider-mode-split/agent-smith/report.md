# Run report: provider-mode-split

Goal: Implement it automatically, without human interaction
Rigor: thorough (signals)
Outcome: halt - Step 9 (plan-review) needs a human: F2 requires the owner to decide whether a run with a surviving log but missing metadata must stop for recovery, or whether to provide an explicit legacy recovery path.
Archive: not run (run halted)

| # | Step | Provider | Model | Effort | Tier | Simple | Result | Tokens |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | plan | openai | gpt-6.2-sol | medium | 2 | yes | ok (59f924e) | 3405418 |
| 2 | plan-review | openai | gpt-6.2-sol | high | 3 | no | ok (ec839a7) | 4608303 |
| 3 | implement | openai | gpt-6.2-astra | medium | 4 | no | failed | 19711991 |
| 4 | implement | openai | gpt-6.2-astra | xhigh | 6 | no | ok (54ba2ed) | 50628024 |
| 5 | manual-verify | openai | gpt-6.2-sol | medium | 2 | no | ok (6e3c993) | 396191 |
| 6 | manual-verify | openai | gpt-6.2-sol | high | 3 | no | ok (ff22d32) | 649252 |
| 7 | impl-review | openai | gpt-6.2-astra | high | 5 | no | ok (0014231) | 18438258 |
| 8 | plan | openai | gpt-6.2-astra | xhigh | 6 | no | ok (f50c804) | 839368 |
| 9 | plan-review | openai | gpt-6.2-sol | high | 3 | no | failed | 3013990 |

Steps: 9 · Tokens: 101690795 (figures for 9 of 9 steps)

## Token coverage

Verified observed host usage: 9 · Unavailable: 0 · Legacy/unverified scope: 0 · Missing figures: 0
Provider, model and tier groups describe the enclosing dispatch.

## Review findings

Counts as recorded when each review step ended; later edits of a review file are not reflected.

- step 2 plan-review: REVISE, 3 critical, 5 warnings measured; 0 critical, 0 warnings open
- step 7 impl-review: REJECTED, 1 critical, 6 warnings measured; 0 critical, 0 warnings open
- step 9 plan-review: REVISE, 0 critical, 4 warnings measured; 0 critical, 1 warnings open

## Manual checks

Rows as recorded when the last manual-verify step ended. The kind comes from the evidence file name; the router never reads the content. Only browser, test, command or script evidence proves a browser row.

Proved: 0

Not proved: 2

- 3.2 Qualify both skills on fresh Claude Code and Codex sessions in both split directions and exercise each full mode, including headless Claude's exact guard allow/deny behavior, toolkit discovery, implementation child collection, safe cancellation and archive. — not proved: Six local runner fixtures passed. The plan requires fresh authenticated top-level Claude Code and Codex sessions for all six host/mode combinations on each chain.
- 3.3 After orchestrator publication, verify the run branch, open PR and PR CI on its head, and verify report comment behavior only if the owner elected it. — not proved: Remote head 22b0d01c is behind local head 6e3c993f. PR head CI and the opted-in report comment await orchestrator publication.

## Lesson candidates

Candidates from the implementation review. Run a command yourself; the pipeline never runs `/10x-lesson`.

- `/10x-lesson Always carry measured duration and token coverage through every settled outcome, including failed attempts.` (step 7)
