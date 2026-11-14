# Manual row 2.4 verification retry

## Required acceptance

> On a compatible Claude host, record version, exposed Agent model/effort support and successful foreground fable high/xhigh invocations; verify an older host without the opt-in continues to use the default ladder.

The plan defines the execution requirement explicitly.

> A CLI routing result or web documentation is not proof of paid model execution. Do not launch nested subagents during this step or during an unattended implementation subagent.

## Fresh checks

Read the change brief, plan brief, implementation report, plan review, complexity record, earlier judgment and unproven list. Inspected dispatchTarget and hostProblem in skills/10x-pipeline/scripts/state.mjs, the existing ladder regressions in skills/10x-pipeline/test/ladder.test.mjs, the Claude dispatch instruction in skills/10x-pipeline/SKILL.md and README compatibility guidance. The implementation report records live host acceptance as pending.

Re-ran claude --version successfully.

> 2.1.311 (Claude Code)

The complete output and exit status are saved in command-claude-version.txt.

Tried an additional proof route by running claude --help successfully. Its output states the following.

> --effort <level>                      Effort level for the current session
>                                       (low, medium, high, xhigh, max)
> --model <model>                       Model for the current session. Provide
>                                       an alias for the latest model (e.g.
>                                       'fable', 'opus', or 'sonnet') or a
>                                       model's full name.

The complete output and exit status are saved in command-claude-help.txt. These flags document current-session CLI options. The Manual row requires the exposed Agent schema, resolved-model compatibility, account access and completed foreground Agent invocations. Those execution results remain unavailable. README associates Fable 5.2 with Claude Code 2.1.321+ and requires checking deployment-specific alias resolution, so the installed version alone leaves compatibility unresolved.

The pipeline instruction requires inspecting the exposed Agent schema and setting run_in_background to false when the parameter exists. This OpenAI runner exposes no Claude Agent invocation tool or live schema. A fresh inventory of callable tool names found no Claude tool. The unattended step explicitly forbids starting any additional subagent, including a Claude process used to launch Agent calls. This constraint prevents the required live executions here.

The existing ladder tests exercise router output, policy merging and synthetic run-log entries. dispatchTarget returns provider/model/effort fields, and hostProblem checks the provider boundary. These checks cover routing configuration. Actual foreground model completion and an older-host default execution require separate host evidence.

## Decision

Row 2.4 stays pending. Fresh CLI evidence establishes the installed version and advertised session options. Successful foreground fable high/xhigh executions, the live Agent schema and an older-host default execution remain unverified. This attempt completes with zero new ticks under the supplied unattended rules.
