# Row 1.6 verification attempt

## Required observation

The pending Manual row reads

> In fresh Claude Code sessions using the updated plugin, both explicit slash commands reach their first router-selected run step, and a fresh plain-language request such as `pipeline this change` leaves both pipeline skills uninvoked, with the Claude Code version and observed transcript recorded.

This requires observed Claude Code behavior for both command entry points and the plain-language request, together with a host version and session transcripts.

## Fresh checks

- `command-claude-version-retry.txt` records `2.1.311 (Claude Code)`.
- `command-claude-help-retry.txt` records the installed CLI help. It describes the default entry point as “starts an interactive session by default” and `--print` as “Print response and exit”. The `--plugin-dir` option loads a plugin “for this session only”. These options provide a fresh-session route for live acceptance. The help exposes session execution and management commands, with no advertised model-free skill-expansion check.
- `test-manual-invocation-retry.txt` records a fresh run of both existing skill-content test files. All 53 tests pass with zero failures and zero skips, including `frontmatter requires explicit invocation and preserves user invocation` in each file. The assertions read the skill text and check its first frontmatter block. Their results establish the shipped invocation configuration. Host selection and session behavior remain outside those assertions.

## Reviewed configuration and execution path

Both shipped skills contain the exact frontmatter field

```yaml
disable-model-invocation: true
```

Their descriptions include the following text

> Run a 10xDevs change end to end by explicit /agent-smith:10x-pipeline command.

> Run an OpenSpec change end to end by explicit /agent-smith:openspec-pipeline
> command.

Both Start sections require

> Prepare run isolation with the shared setup script before initialization.

The 10x Loop dispatches a Claude action with

> Call the Agent tool

The README states

> Version-specific live invocation acceptance and full headless pipeline completion remain pending.

The configuration and documentation support deliberate user invocation. Proving row 1.6 still requires the host to load these skills and produce the specified fresh-session observations.

## Judgment

The alternative proof examined in this attempt was the installed CLI's advertised model-free capabilities together with the complete existing content suites. Version/help commands and content tests supply supporting evidence. Live slash-command expansion, the first router-selected run action and the plain-language absence of invocation/state writes remain unobserved.

This step's always-true rule prohibits starting “any other subagent”. Launching fresh Claude Code agent sessions would cross that boundary. The shipped execution path also prepares isolation and dispatches further agents, while this step permits writes only to its plan and evidence directory and permits read-only Git commands.

Row 1.6 stays pending. The unattended instructions explicitly allow a completed verification attempt with zero new ticks. The remaining acceptance risk is host behavior for both slash commands and the plain-language request on the recorded Claude Code version.
