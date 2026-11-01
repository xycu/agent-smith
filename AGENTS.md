# Repository Guidelines

agent-smith is a Claude Code plugin that runs 10xDevs skill chains. Each step runs in its own subagent, and a dependency-free Node.js ESM router picks the next step, model and effort. See @README.md for install and routing behavior.

## Hard Rules

- Keep routing decisions in `skills/10x-pipeline/scripts/route.mjs` and `skills/10x-pipeline/policy.json`. `SKILL.md` must not name models, effort levels or tiers beyond what it already documents.
- `route.mjs` owns `context/changes/<change-id>/agent-smith/run.jsonl` and `meta.json`. Never edit them by hand or from the skill.
- The router's only git writes are the index and commit writes of the pre-archive commit in the `done` branch of a run started with `--archive`: `git add`, `git commit`, and a `git reset` of its own add after a failure. It never pushes, never passes `--no-verify` and sets no `-c` option except `core.quotePath=false`. Everything else it does with git is a read.
- The router never calls `gh`. `skills/10x-pipeline/scripts/pr-comment.mjs` is the only code that posts to GitHub, and only for a run started with `--pr-comment`. Its only network writes are one issue comment, created or edited, on an open `github.com` pull request of the current branch, found by a hidden marker. It never writes under the project root.
- Add no npm dependencies. The router uses only `node:` built-ins and must run on Node 24+ (ADR-006).
- Never edit `context/archive/`; it is read-only by convention.

## Project Structure

- `.claude-plugin/plugin.json` — plugin manifest. `.claude-plugin/marketplace.json` — marketplace listing this repo as its only plugin. Keep `name`, `description` and `version` aligned between the two and with @README.md.
- `skills/10x-pipeline/SKILL.md` — orchestrator instructions (the loop over router output).
- `skills/10x-pipeline/policy.json` — model ladder, base tiers, escalation, limits, prompt templates.
- `skills/10x-pipeline/baseline-policy.json` — per-project override that pins the baseline arm of `compare` (all tiers `sonnet`/`high`, `standard` rigor, no plan-review skip). Data the user copies; the router does not read it.
- `skills/10x-pipeline/scripts/route.mjs` — router: `init`, `next`, `status`, `risk`, `verify-archive`, `compare`.
- `skills/10x-pipeline/test/` — `node:test` suite: `route.test.mjs`, `churn.test.mjs`, `archive.test.mjs`, `rules.test.mjs`, `compare.test.mjs`, `lessons.test.mjs` (lesson candidates: sanitizer, report section, prompt wiring) and `helpers.mjs` (scratch projects, `run.jsonl` fixtures, hermetic git).
- `skills/10x-pipeline/prompts/` — rule-form prompt files; `policy.json` references them as `@prompts/<file>.md`.
- `skills/10x-pipeline/test/preplan.test.mjs`, `loops-existing.test.mjs` and `loops.test.mjs` — pre-plan gates and prompt wiring, the characterized RETHINK/REVISE loop (never edit it), and the new loops and budget reference paths.
- `skills/10x-pipeline/test/executors.test.mjs`, `codereplan.test.mjs`, `manualverify.test.mjs`, `budget-executors.test.mjs` and `phase-helpers.mjs` — the phase-executors change: commit check, fallback, executor routing, retry, the report label (`executors.test.mjs`); code re-plans; `manual-verify` and `--chrome`; the budget derived from the longest legal path; and plan builders, log fixtures and `gateCheck` for the plan's Progress rows. `helpers.mjs` stays as it was.
- `skills/10x-pipeline/prompts/executor-e2e.md`, `executor-tdd.md`, `executor-retry.md`, `impl-review-warn.md` and `manual-verify.md` — prompts of the phase executors and `manual-verify`; see `prompts/README.md`.
- `skills/10x-pipeline/prompts/impl-review-lessons.md` — suffix of both implementation review prompts that asks for lesson candidates; see `prompts/README.md`.
- `docs/ADR/` — architecture decision records (ADR-001 to ADR-007).
- `context/` — 10x workflow docs: `changes/`, `archive/`, `foundation/`. See the README in each.
- `assets/` — README header image only.

## Commands

There is no build or lint setup. Run the tests with `node --test skills/10x-pipeline/test/*.test.mjs` (shell glob, Node 24 and later). Exercise the router from a project root that has `context/changes/<id>/change.md`:

- `node skills/10x-pipeline/scripts/route.mjs init <id> --goal "<text>" [--rigor lean|standard|thorough] [--archive] [--chrome]` — start or resume a run. `--archive` makes `done` commit the change folder and return an `archive` action (`--archive false` turns it off). `--chrome` picks the `manual-verify` template that may use the Chrome tools (`--chrome false` turns it off).
- `node skills/10x-pipeline/scripts/route.mjs next <id>` — consume `agent-smith/last-result.json`, return the next step.
- `node skills/10x-pipeline/scripts/route.mjs status <id>` — print the per-step model and effort log.
- `node skills/10x-pipeline/scripts/route.mjs risk <id>` — print churn hot paths, plan hits and diff hits; writes nothing.
- `node skills/10x-pipeline/scripts/pr-comment.mjs <id> [--report <p>]` — post the run report as a comment on the open pull request of the current branch, or edit its earlier comment. Prints one JSON object and exits 0 on a skip. Its tests are in `skills/10x-pipeline/test/pr-comment.test.mjs`; `GH_LIVE=1` enables the read-only live tests, which a human runs.
- `node skills/10x-pipeline/scripts/route.mjs verify-archive <id> [--path <p>]` — read-only; prints `archived: true` only when the archive folder has `status: archived` and `context/changes/<id>/` is gone. Files only, no git.
- `node skills/10x-pipeline/scripts/route.mjs compare <id> --baseline <dir> [--routed <dir>] [--format md]` — read-only; writes nothing. Compares the usage of a routed run with a baseline run (a second checkout with `baseline-policy.json` as its override) and prints totals, coverage, `comparable`, `reasons`, `warnings`, `dropPercent` and `verdict`.

## Coding Style

- Plain JavaScript ES modules, 2-space indent, double quotes, semicolons, as in `route.mjs`.
- Policy keys are camelCase; step names are kebab-case (`plan-review`, `impl-review`).
- A policy change belongs in `policy.json`. A per-project override belongs in `context/foundation/agent-smith-policy.json`, never in `route.mjs`.
- When you change tier logic in `route.mjs` (`tierFor`, `decide`), update the "How the tier moves" list in `SKILL.md` and the routing bullets in `README.md`.

## Testing

Run `node --test skills/10x-pipeline/test/*.test.mjs` after any change to `route.mjs`, `policy.json` or a prompt. The suite drives the real router through the CLI in scratch projects and checks the rule form of every prompt. New router and test code must run on Node 24 (ADR-006). Then run `init` and `status` against a scratch change folder and confirm the JSON output is valid.

## Commits

History has only two commits and sets no convention. The `fix` prompt in `policy.json` asks for Conventional Commits (`fix: ...`); use that style.
