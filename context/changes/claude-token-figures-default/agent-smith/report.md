# Run report: claude-token-figures-default

Goal: Ship an opt-in Claude token capture hook, off by default, so Claude steps can report token figures
Rigor: thorough (signals)
Provider mode: split
Outcome: done - impl review APPROVED

| # | Step | Provider | Model | Effort | Tier | Simple | Result | Tokens |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | plan | openai | gpt-6.2-sol | medium | 2 | yes | ok (00746d2) | - |
| 2 | plan-review | claude | sonnet | high | 3 | no | ok (2f9763e) | - |
| 3 | implement | openai | gpt-6.2-sol | high | 3 | no | ok (7252862) | - |
| 4 | manual-verify | claude | sonnet | medium | 2 | no | ok (adc80a7) | - |
| 5 | manual-verify | claude | sonnet | high | 3 | no | ok (b6dde55) | - |
| 6 | impl-review | claude | sonnet | high | 3 | no | ok (f407634) | - |

Steps: 6 · Tokens: - (figures for 0 of 6 steps)

## Token coverage

Verified observed host usage: 0 · Unavailable: 6 · Legacy/unverified scope: 0 · Missing figures: 6
Provider, model and tier groups describe the enclosing dispatch.
- Step 1 plan: unsupported-host — The host version is not qualified for accounting.
- Step 2 plan-review: missing-identity — The host invocation cannot be attributed exactly.
- Step 3 implement: unsupported-host — The host version is not qualified for accounting.
- Step 4 manual-verify: missing-identity — The host invocation cannot be attributed exactly.
- Step 5 manual-verify: missing-identity — The host invocation cannot be attributed exactly.
- Step 6 impl-review: missing-identity — The host invocation cannot be attributed exactly.

## Review findings

Counts as recorded when each review step ended; later edits of a review file are not reflected.

- step 2 plan-review: REVISE, 0 critical, 4 warnings measured; 0 critical, 0 warnings open
- step 6 impl-review: APPROVED, 0 critical, 0 warnings measured; 0 critical, 0 warnings open

## Manual checks

Rows as recorded when the last manual-verify step ended. The kind comes from the evidence file name; the router never reads the content. Only browser, test, command or script evidence proves a browser row.

Proved: 0

Not proved: 2

- 2.4 An authorized human runs one complete native Claude-hosted pipeline on Claude models with capture enabled and records exact host version, whole-step token evidence and README qualification. — not proved: needs an authorized human to run one complete live native Claude-hosted pipeline with capture enabled; no test, command or script can stand in for it, and an unattended step must not start a live pipe
- 2.5 The maintainer qualifies a subsequent Claude Code release with a live multi-request Agent capture and sanitized replay before listing that release as supported. — not proved: needs the maintainer to qualify a later Claude Code release with a live multi-request Agent capture and sanitized replay; no such release is available to this step, and the automated fixtures cover on
