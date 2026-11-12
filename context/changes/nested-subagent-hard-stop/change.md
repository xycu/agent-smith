---
change_id: nested-subagent-hard-stop
title: Enforce the nested-subagent ban outside the prompt
status: new
created: 2026-11-12
updated: 2026-11-12
archived_at: null
---

## Notes

Source: the repo review of 2026-11-12 (LLM engineering and Claude Code practice). Severity: medium.

### Problem

ADR-018 bans nested subagents with prompt text only: one rule in `prompts.suffix`, one line in the implement templates and the tdd and e2e guides, and the sixth anti-stall rule. Its context section says "Only prompt text and the orchestrator skills can act on it." A subagent that ignores the rule fails the step with the work done, because the nested hand-back goes to the top session, and in an isolated run the rollback then discards that work.

Two mechanisms of the harness can refuse the call, and ADR-018 weighs neither:

- The environment variable `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH`. Claude Code's reference (env-vars page, read 2026-11-12): "Number of subagent layers allowed below the main conversation (default: 3). ... set `1` to turn nesting off." ADR-018 only rejects raising it.
- A step agent without the Agent tool. `agents/score.md` already restricts its tools (`tools: Read, Grep, Glob, Write`), but `agents.steps` routes only `score` to it, and only when `agents.restricted` is `true`.

### Fix direction

Options, to pick in the plan:

1. Document the variable. README and `docs/REFERENCE.md` name `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH=1` as a hardening setting for a project that runs the pipeline, and this repository sets it in `.claude/settings.json`. It applies to every session of that project, so it stays optional for plugin users.
2. A scoped agent. Add `agents/step.md` (`agent-smith:step`) for the other steps: every tool except Agent. Wire it through `agents.steps`, so the router names it when `agents.restricted` is `true`. Verify before planning: that a plugin agent can exclude one tool (a `disallowedTools` field or an allowlist), and that skills, MCP tools and the Chrome tools still reach such an agent, since `manual-verify` needs them.
3. Not recommended: a plugin `PreToolUse` hook on `Agent`. It would also block nesting in sessions that are not pipeline runs.

Keep the prompt rules in every case: they tell the subagent what to do instead of delegating. Amend ADR-018 with the chosen option; do not rewrite it.

### Tests

- Option 2: `agents.test.mjs` cases for the new agent file and the `agent` field of every step; `provenance.test.mjs` already hashes `agents/`.
- `nested-subagents.test.mjs:155` asserts that a checked text does not name the variable with "of N or more"; make the new wording pass it or update the assertion with the docs.
- One Manual row: a step subagent that tries to call Agent gets a refusal from the harness.

### Done when

In at least one supported configuration, a step subagent cannot start a subagent, whatever its prompt says.
