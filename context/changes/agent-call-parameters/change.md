---
change_id: agent-call-parameters
title: Make the step Agent call match the Agent tool and give it a fixed description
status: implementing
created: 2026-11-12
updated: 2026-11-14
archived_at: null
---

## Notes

Source: the repo review of 2026-11-12 (LLM engineering and Claude Code practice). Severity: medium.

### Problem

Loop step 2 of both skills tells the orchestrator to call the Agent tool with `subagent_type`, `model`, `effort`, `run_in_background: false` and `prompt` (`skills/10x-pipeline/SKILL.md:58`, `skills/openspec-pipeline/SKILL.md:66`).

- `run_in_background` is not a parameter of the Agent tool in the Claude Code session this review ran in (version 2.1.311). That tool takes `description`, `prompt`, `subagent_type`, `model`, `effort` and `isolation`, refuses unknown properties, and states that subagents run in the background and notify on completion. The first anti-stall rule already admits the flag has no effect ("returns a launch notice instead of a final report although `run_in_background` is `false`").
- A call refused for an unknown parameter is, by the skill's own list, an orchestrator fault ("the call was refused or errored before any subagent started"). The neutral rerun then repeats the same call until `limits.maxNeutralRetries` halts the run. Whether a model drops the parameter on its own is luck; no live run reproduced the halt.
- `description` is required by the tool and the skills do not set it, so the model invents a new one for each step. Two rules depend on matching a later message to a step: anti-stall rule 6 identifies a hand-back by "the agent id or description its launch notice or result gave", and a late usage figure must be attached to the right `n` ("never a guess: a wrong `<n>` is accepted silently when that entry has no figure").

### Fix direction

- Step 2 of both skills: set `description` to `agent-smith <change-id> step <n> <step>` (for the archive subagent `agent-smith <change-id> archive`). Use it in anti-stall rule 6 and in the late-usage paragraph as the way to find `n`.
- Replace `run_in_background: false` with: "when the Agent tool has a `run_in_background` parameter, set it to `false`; otherwise leave it out". Reword the GIVEN of anti-stall rule 1 to "the Agent tool returns a launch notice instead of a final report". Both skills keep the same words.
- Optional, in the same change: the router returns the `description` string in the `run` output, so the orchestrator copies it instead of building it.
- `docs/REFERENCE.md` "Orchestrator anti-stall" and ADR-018 quote the rules; amend them.

### Tests

- `skill-loop.test.mjs` and `openspec-skill.test.mjs` pin the anti-stall rules and their equality; `agents.test.mjs` pins the dispatch line. Update the expected text.
- One live run on the current Claude Code, as a Manual row: the step usage figure and a late figure reach the right step.

### Done when

The Agent call the skills describe is valid for an Agent tool with and without `run_in_background`, and every step subagent carries a description from which the step number can be read.
