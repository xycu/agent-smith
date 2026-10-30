# Repository Guidelines

agent-smith is a Claude Code plugin that runs 10xDevs skill chains. Each step runs in its own subagent, and a dependency-free Node.js ESM router picks the next step, model and effort. See @README.md for install and routing behavior.

## Hard Rules

- Keep routing decisions in `skills/10x-pipeline/scripts/route.mjs` and `skills/10x-pipeline/policy.json`. `SKILL.md` must not name models, effort levels or tiers beyond what it already documents.
- `route.mjs` owns `context/changes/<change-id>/agent-smith/run.jsonl` and `meta.json`. Never edit them by hand or from the skill.
- Add no npm dependencies. The router uses only `node:` built-ins and must run on Node 18+.
- Never edit `context/archive/`; it is read-only by convention.

## Project Structure

- `.claude-plugin/plugin.json` — plugin manifest. `.claude-plugin/marketplace.json` — marketplace listing this repo as its only plugin. Keep `name`, `description` and `version` aligned between the two and with @README.md.
- `skills/10x-pipeline/SKILL.md` — orchestrator instructions (the loop over router output).
- `skills/10x-pipeline/policy.json` — model ladder, base tiers, escalation, limits, prompt templates.
- `skills/10x-pipeline/scripts/route.mjs` — router: `init`, `next`, `status`.
- `context/` — 10x workflow docs: `changes/`, `archive/`, `foundation/`. See the README in each.
- `assets/` — README header image only.

## Commands

There is no build, lint or test setup. Exercise the router from a project root that has `context/changes/<id>/change.md`:

- `node skills/10x-pipeline/scripts/route.mjs init <id> --goal "<text>"` — start or resume a run.
- `node skills/10x-pipeline/scripts/route.mjs next <id>` — consume `agent-smith/last-result.json`, return the next step.
- `node skills/10x-pipeline/scripts/route.mjs status <id>` — print the per-step model and effort log.

## Coding Style

- Plain JavaScript ES modules, 2-space indent, double quotes, semicolons, as in `route.mjs`.
- Policy keys are camelCase; step names are kebab-case (`plan-review`, `impl-review`).
- A policy change belongs in `policy.json`. A per-project override belongs in `context/foundation/agent-smith-policy.json`, never in `route.mjs`.
- When you change tier logic in `route.mjs` (`tierFor`, `decide`), update the "How the tier moves" list in `SKILL.md` and the routing bullets in `README.md`.

## Testing

No automated tests exist. After editing `route.mjs` or `policy.json`, run `init` and `status` against a scratch change folder and confirm the JSON output is valid.

## Commits

History has only two commits and sets no convention. The `fix` prompt in `policy.json` asks for Conventional Commits (`fix: ...`); use that style.
