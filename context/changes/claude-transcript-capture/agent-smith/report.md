# Run report: claude-transcript-capture

Goal: Default native Claude token capture to session transcripts instead of requiring the launcher (issue #289), with transcript-only figures under a new usageEvidence status; see research.md
Rigor: thorough (hot paths skills/10x-pipeline/policy.json, skills/10x-pipeline/scripts/flow.mjs, skills/10x-pipeline/scripts/isolation.mjs +8)
Provider mode: codex
Outcome: done - impl review NEEDS ATTENTION

| # | Step | Provider | Model | Effort | Tier | Simple | Result | Tokens |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | plan | openai | gpt-6.2-sol | medium | 2 | yes | ok (deaf11c) | 963940 |
| 2 | plan-review | openai | gpt-6.2-sol | high | 3 | no | ok (728a42d) | 2687718 |
| 3 | implement | openai | gpt-6.2-astra | high | 5 | no | ok (3424f61) | 15622348 |
| 4 | manual-verify | openai | gpt-6.2-sol | medium | 2 | no | ok (b2aec9c) | 652918 |
| 5 | manual-verify | openai | gpt-6.2-sol | high | 3 | no | ok (ad3b553) | 818108 |
| 6 | impl-review | openai | gpt-6.2-astra | high | 5 | no | ok (0946dbc) | 6425056 |

Steps: 6 · Tokens: 27170088 (figures for 6 of 6 steps)

## Token coverage

Verified observed host usage: 6 · Unavailable: 0 · Legacy/unverified scope: 0 · Missing figures: 0
Provider, model and tier groups describe the enclosing dispatch.

## Review findings

Counts as recorded when each review step ended; later edits of a review file are not reflected.

- step 2 plan-review: REVISE, 1 critical, 4 warnings measured; 0 critical, 0 warnings open
- step 6 impl-review: NEEDS ATTENTION, 0 critical, 7 warnings measured; 0 critical, 0 warnings open

## Manual checks

Rows as recorded when the last manual-verify step ended. The kind comes from the evidence file name; the router never reads the content. Only browser, test, command or script evidence proves a browser row.

Proved: 0

Not proved: 2

- 3.4 In an ordinary qualified Claude Code session without the launcher, complete a native Agent step and confirm transcript evidence in status and the rendered report. — not proved: Claude Code 2.1.325 and the inherited ordinary session passed transcript readiness. A bounded read found no matching native Agent call or completed result for this change. The OpenAI runner exposes no
- 3.5 In a fresh launcher session with telemetry mode selected, complete a native Agent step and confirm verified request-record evidence in status and the rendered report. — not proved: The inherited session has no launcher binding, and the fresh scratch Claude profile was unauthenticated even with the configured home. The documented launcher starts an interactive session, which cann

## Lesson candidates

Candidates from the implementation review. Run a command yourself; the pipeline never runs `/10x-lesson`.

- `/10x-lesson Always reconcile an invocation’s timestamps, ownership and launch parameters across its records before attributing usage.` (step 6)
