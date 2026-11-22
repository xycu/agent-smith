# Run report: ci-self-hosted-runner-exposure

Goal: Close the self-hosted runner exposure: --ignore-scripts on the install line, checked settings and runner reach in ADR-020
Rigor: standard (failed steps 1)
Provider mode: split
Outcome: done - impl review APPROVED

| # | Step | Provider | Model | Effort | Tier | Simple | Result | Tokens |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | plan | openai | gpt-6.2-sol | medium | 2 | yes | failed | - |
| 2 | plan | openai | gpt-6.2-astra | high | 5 | no | ok (d382b51) | - |
| 3 | plan-review | claude | sonnet | high | 3 | no | ok (deb16bc) | - |
| 4 | implement | openai | gpt-6.2-sol | medium | 2 | no | ok (aabc39b) | - |
| 5 | manual-verify | claude | sonnet | medium | 2 | no | ok (0a8141b) | - |
| 6 | manual-verify | claude | sonnet | high | 3 | no | ok (ee6d4f3) | - |
| 7 | impl-review | claude | sonnet | high | 3 | no | ok (ac4d91e) | - |

Steps: 7 · Tokens: - (figures for 0 of 7 steps)

## Token coverage

Verified observed host usage: 0 · Unavailable: 3 · Legacy/unverified scope: 0 · Missing figures: 7
Provider, model and tier groups describe the enclosing dispatch.
- Step 1 plan: unsupported-host — The host version is not qualified for accounting.
- Step 2 plan: unsupported-host — The host version is not qualified for accounting.
- Step 4 implement: unsupported-host — The host version is not qualified for accounting.

## Review findings

Counts as recorded when each review step ended; later edits of a review file are not reflected.

- step 3 plan-review: REVISE, 0 critical, 2 warnings measured; 0 critical, 0 warnings open
- step 7 impl-review: APPROVED, 0 critical, 0 warnings measured; 0 critical, 0 warnings open

## Manual checks

Rows as recorded when the last manual-verify step ended. The kind comes from the evidence file name; the router never reads the content. Only browser, test, command or script evidence proves a browser row.

Proved: 0

Not proved: 2

- 2.2 The owner confirms the recorded setting values and check dates, the runner’s reachable home-network hosts and services, and the residual same-repository write risk against Amendment 3. — not proved: ADR-020 Amendment 3 (line 91) still states the reachable home-network hosts and services are "awaiting dated owner confirmation"; owner-only network and settings knowledge that no command, test or jud
- 2.3 The published PR has green CI across all six shards, including the installed OpenSpec 2.0.0 version checks and the five real OpenSpec contract cases passing without skips. — not proved: needs CI results of a published PR across all six shards; this step may not push or call gh, and no PR run exists yet.
