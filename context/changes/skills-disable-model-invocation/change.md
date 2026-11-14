---
change_id: skills-disable-model-invocation
title: Decide whether the model may start a pipeline run on its own
status: implementing
created: 2026-11-12
updated: 2026-11-14
archived_at: null
---

## Notes

Source: the repo review of 2026-11-12 (LLM engineering and Claude Code practice). Severity: low to medium.

### Problem

Neither skill sets `disable-model-invocation`, and both descriptions invite the model to start one: "Use when the user wants an orchestrated or adaptive 10x run, 'run the whole chain', 'pipeline this change', or dynamic model routing." A run is not a harmless action. It creates a worktree and a branch, starts up to 24 paid subagents, commits, pushes `agent-smith/<id>` and opens a pull request at every end (ADR-017: "No flag turns it off").

Claude Code's guidance for such skills (skills page, read 2026-11-12): "`disable-model-invocation: true`: Claude can't invoke the skill on its own. Use this for workflows with side effects or that you want to control timing, like `/commit`, `/deploy`, or `/send-slack-message`."

### Fix direction

- Add `disable-model-invocation: true` to the frontmatter of `skills/10x-pipeline/SKILL.md` and `skills/openspec-pipeline/SKILL.md`. The user still starts a run with `/agent-smith:10x-pipeline` or `/agent-smith:openspec-pipeline`.
- Shorten the "Use when ..." part of both descriptions, since only the user reads them then; keep `name` and `description` aligned with `plugin.json`, `marketplace.json` and the README as `AGENTS.md` asks.
- Check first what relies on model invocation: a headless `claude -p "/agent-smith:10x-pipeline <id>"` call (a user invocation, should still work), `/loop`, and any other skill that starts the pipeline through the Skill tool. Record the result.
- If the owner wants a run to start from plain language, keep it as it is and record that decision in an ADR, with the side effects named.

### Tests

- Frontmatter check in `skill-loop.test.mjs` and `openspec-skill.test.mjs`.
- One Manual row: the slash command still starts a run, and a sentence such as "pipeline this change" no longer does.

### Done when

The choice is explicit: either both skills carry the flag, or an ADR says why the model may start a run that pushes and opens a pull request.
