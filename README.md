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

### `/agent-smith:10x-pipeline <change-id> [goal]`

Runs a 10xDevs change end to end: plan, plan review, implement, implementation review, fix.

Requirements in the target project:

- The 10x toolkit skills: `10x-plan`, `10x-plan-review`, `10x-goal-implement`, `10x-impl-review`.
- A change folder made with `/10x-new <change-id>`.
- Node.js 18 or later. Churn risk also reads `git` history; without it the router flags no hot path.

How routing works:

- `skills/10x-pipeline/policy.json` defines a ladder of model/effort tiers, a base tier per step, and escalation rules.
- `skills/10x-pipeline/scripts/route.mjs` reads `plan.md` (`## Progress`) and `reviews/*.md` (verdict, finding counts) after every step and returns the next step, model, effort and prompt.
- The tier goes up for large plans, `RETHINK`/`REVISE`/`REJECTED` verdicts and failed attempts. It goes down after a clean review and for a simple change (a small plan or a short goal). A hard keyword in the goal, such as `refactor` or `security`, keeps the first plan at the plan step's base tier.
- The first plan reads the goal text. A brief goal (at most 25 words, no hard keyword) lowers the plan tier by 1 and earns the simple-change discount. Any other goal lowers it by 1, and a goal with a hard keyword lowers it by nothing. The word limit and the keyword list sit under `complexity.firstPlan` in `policy.json` and can be overridden per project.
- Effort floor: plan, plan review and implementation review ask questions, so they never run below the floor in `rigor.minEffort` for the run's rigor level. The floor beats the simple-change discount, and the report marks a step as simple only when the discount survived.
- A step counts as failed when the subagent does not report `done` or the expected file did not change.
- The run halts for a human after repeated failures, too many plan revisions or fix loops, or when the step budget is spent.

Rigor:

- Every run has a rigor level, `lean`, `standard` or `thorough`, stored in `meta.json` and kept on resume. It starts from the goal class (a short goal is `lean`) or from `init <id> --rigor <level>`, and it only rises: with 3 or more phases (`standard`) or 6 or more (`thorough`), after failed steps, when the plan or the diff touches a hot path, and when a subagent result carries `signals.rigor`.
- Hot paths come from churn: paths that change often in the repository history, counted up to the commit the run started from (`meta.baseSha`). The parameters sit under `risk` in `policy.json` and are uncalibrated. `node skills/10x-pipeline/scripts/route.mjs risk <change-id>` prints the hot paths, the plan hits and the diff hits and writes nothing.
- At `lean` the router skips plan review before implementation starts, if risk was measured (history readable, the plan names at least one path, and every named path can be matched against the hot set: a file, a directory, a glob or an absolute path under the project root) and no named path is hot. The skip is logged in `run.jsonl` with its reason and listed in `report.md`. If risk could not be measured, plan review runs. Implementation review is never skipped.
- The step budget is `limits.maxTotalSteps` plus a delta per level (smaller at `lean`, larger at `thorough`). Skipped steps use no budget.
- A subagent can end its `RESULT:` line with an optional `signals` object. The router keeps two keys: `rigor` (raises the level) and `needsHuman` (halts the run once with a report). It ignores the rest.
- Prompt rules follow the GIVEN/WHEN/THEN form with one bold RFC 2119 keyword (ADR-004). `node --test skills/10x-pipeline/test/*.test.mjs` checks the form and the router behavior.

Override any policy key per project in `context/foundation/agent-smith-policy.json`. Run state lives in `context/changes/<change-id>/agent-smith/`.

Usage report:

- When a run ends (`done` or `halt`, including a spent step budget or repeated failures), the router writes `context/changes/<change-id>/agent-smith/report.md` and adds its path to the output as `report`.
- The report has the goal, the rigor level and the outcome, then one table row per executed step: model, effort, tier, simple-change flag, result and tokens. A totals line sums the tokens and gives the number of skipped steps. A `## Skipped steps` section lists each skip with its reason.
- Token figures are optional. The orchestrator passes along the total tokens, tool uses and duration of a step when the Agent result reports them. A step without a figure shows `-`, and the totals line says how many steps it covers.
- `node skills/10x-pipeline/scripts/route.mjs status <change-id> --report` rewrites the report on demand. For a run in progress it prints `Outcome: not ended`. Plain `status` stays read-only.
- A halt for a missing result file writes no report. A run that continues after a halt keeps the old `report.md` until it ends again or you run `status --report`.

Limits:

- Subagents cannot use `AskUserQuestion`. Where a skill would ask, the subagent decides from researched best practice, cites the evidence and lists the decision as an assumption. With no evidence-backed answer it reports `blocked` with `signals.needsHuman`, and the router halts.
- `10x-goal-implement` spawns its own subagents. This needs `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` of 3 or more (the default since Claude Code v2.1.219).

## Layout

```
.claude-plugin/plugin.json        plugin manifest
.claude-plugin/marketplace.json   marketplace with this repo as its only plugin
skills/10x-pipeline/              orchestrator skill, policy, router
skills/10x-pipeline/test/         node:test suite for the router and the prompt rule form
docs/ADR/                         architecture decision records
assets/                           README header image
```
