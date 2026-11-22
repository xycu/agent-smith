# Run report: ci-self-hosted-runner-exposure

Goal: Close the self-hosted runner exposure: --ignore-scripts on the install line, checked settings and runner reach in ADR-020
Rigor: standard (failed steps 1)
Provider mode: split
Outcome: halt - Step 1 (plan) needs a human: Authorize updating the install-command assertion in tools/test/ci-runner.test.mjs while preserving the runner expression and its assertions.

| # | Step | Provider | Model | Effort | Tier | Simple | Result | Tokens |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | plan | openai | gpt-6.2-sol | medium | 2 | yes | failed | - |

Steps: 1 · Tokens: - (figures for 0 of 1 steps)

## Token coverage

Verified observed host usage: 0 · Unavailable: 1 · Legacy/unverified scope: 0 · Missing figures: 1
Provider, model and tier groups describe the enclosing dispatch.
- Step 1 plan: unsupported-host — The host version is not qualified for accounting.
