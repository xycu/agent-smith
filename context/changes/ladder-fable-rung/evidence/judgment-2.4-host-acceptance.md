# Manual row 2.4 attempt

The pending row requires the following evidence.

> On a compatible Claude host, record version, exposed Agent model/effort support and successful foreground fable high/xhigh invocations; verify an older host without the opt-in continues to use the default ladder.

The plan also states the acceptance boundary.

> A CLI routing result or web documentation is not proof of paid model execution. Do not launch nested subagents during this step or during an unattended implementation subagent.

The fresh `claude --version` check returned `2.1.311 (Claude Code)`, saved in `command-claude-version.txt`. The reference states that Fable 5.2 requires Claude Code 2.1.321+ and requires checking the resolved model, exposed Agent parameters and account access. The version output alone establishes none of those capabilities.

Inspected `dispatchTarget` and `hostProblem` in `skills/10x-pipeline/scripts/state.mjs`, the shipped ladder in `skills/10x-pipeline/policy.json`, and the published-policy regressions in `skills/10x-pipeline/test/ladder.test.mjs`. The implementation selects model/effort targets. The tests assert policy merging, dispatch fields and tier calculations. They contain no successful live Agent execution that could cover this row. The shipped ladder contains eight haiku/sonnet/opus rungs, but reading that configuration cannot establish an older host execution result.

This OpenAI runner exposes no Claude Agent invocation tool or its live model/effort schema. Launching a Claude child to perform the requested Agent invocations would start nested subagents, which this step explicitly forbids. No live invocation was attempted. No existing host acceptance artifact was found in this change folder. The available evidence leaves successful foreground high/xhigh executions and older-host execution unverified, so row 2.4 remains pending.
