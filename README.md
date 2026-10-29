<p align="center"><img src="assets/agent-smith.jpg.webp" alt="agent-smith header" width="100%"><br><sub>Photo: Warner Bros. Pictures</sub></p>

# agent-smith

Agent orchestrating AI SDLC workflows (10xDevs + OpenSpec).

A Claude Code plugin. Each step of a skill chain runs in its own subagent. A router script picks the next step and its model and effort level from the results of the earlier steps.

## Install

```
/plugin marketplace add xycu/agent-smith
/plugin install agent-smith@agent-smith
```

## Skills

### `/agent-smith:10x-pipeline <change-id> [goal] [--size s|m|l]`

Runs a 10xDevs change end to end: plan, plan review, implement, implementation review, fix.

Requirements in the target project:

- The 10x toolkit skills: `10x-plan`, `10x-plan-review`, `10x-goal-implement`, `10x-impl-review`.
- A change folder made with `/10x-new <change-id>`.
- Node.js 18 or later.

How routing works:

- `skills/10x-pipeline/policy.json` defines a ladder of model/effort tiers, a base tier per step, and escalation rules.
- `skills/10x-pipeline/scripts/route.mjs` reads `plan.md` (`## Progress`) and `reviews/*.md` (verdict, finding counts) after every step and returns the next step, model, effort and prompt.
- The tier goes up for large plans, `RETHINK`/`REVISE`/`REJECTED` verdicts and failed attempts. It goes down after a clean review and for a simple change (a small plan or `--size s`).
- A step counts as failed when the subagent does not report `done` or the expected file did not change.
- The run halts for a human after repeated failures, too many plan revisions or fix loops, or when the step budget is spent.

Override any policy key per project in `context/foundation/agent-smith-policy.json`. Run state lives in `context/changes/<change-id>/agent-smith/`.

Limits:

- Subagents cannot use `AskUserQuestion`. Interactive skills choose their recommended option and list their assumptions.
- `10x-goal-implement` spawns its own subagents. This needs `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` of 3 or more (the default since Claude Code v2.1.219).

## Layout

```
.claude-plugin/plugin.json        plugin manifest
.claude-plugin/marketplace.json   marketplace with this repo as its only plugin
skills/10x-pipeline/              orchestrator skill, policy, router
assets/                           README header image
```
