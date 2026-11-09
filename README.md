<p align="center"><img src="assets/agent-smith.jpg.webp" alt="agent-smith header" width="100%"><br><sub>Photo: Warner Bros. Pictures</sub></p>

# agent-smith

Agent orchestrating AI SDLC workflows (10xDevs + OpenSpec).

A Claude Code plugin. Each step of a skill chain runs in its own subagent. A router script picks the next step and its model and effort level from the results of the earlier steps.

## Install

```
/plugin marketplace add xycu/agent-smith
/plugin install agent-smith@agent-smith
```

## Quick start

1. In your project, create a change folder: `/10x-new <change-id>`.
2. Run the pipeline:

```
/agent-smith:10x-pipeline <change-id> "what you want built"
```

The run goes plan, plan review, implement, implementation review, fix, and stops at `done` or at a halt that needs you. When it ends it writes `context/changes/<change-id>/agent-smith/report.md` with the steps, models, tokens and outcome.

Requirements in your project:

- The 10x toolkit skills `10x-plan`, `10x-plan-review`, `10x-goal-implement` and `10x-impl-review`.
- Node.js 24 or later on `PATH`.
- `git`. A run works in its own linked worktree on the branch `agent-smith/<change-id>`, and `init` halts in the main checkout. To run without a worktree, see [Run isolation](docs/REFERENCE.md).

## Quick start: OpenSpec

The second skill runs an [OpenSpec](https://github.com/Fission-AI/OpenSpec) change through the same router.

1. In an OpenSpec project (`openspec init`, with `openspec/` committed), create the change: `openspec new change <change-name>`.
2. Run the pipeline:

```
/agent-smith:openspec-pipeline <change-name> "what you want built"
```

The run goes propose, apply, verify and, when verify fails, at most two fix loops of apply and verify. It stops at `done` or at a halt that needs you. With `--archive` it ends with `openspec archive <change-name> --yes --json`. Run state and `report.md` live in `openspec/changes/<change-name>/agent-smith/` and move with the archive.

Requirements: the OpenSpec skills `openspec-propose`, `openspec-apply-change` and `openspec-verify-change`, the `openspec` CLI for `--archive`, Node.js 24 or later and `git`, as above. The name must not also be a 10x change under `context/changes/`. Flags: `--archive`, `--rigor` and `--pr-comment`, as below. Score, pre-plan steps, phase executors, manual checks and plan review do not run in this chain. See [the OpenSpec section of the reference](docs/REFERENCE.md).

## Options

| Flag | Effect |
| --- | --- |
| `--archive` | When the run is done, commit the change folder and archive it with `/10x-archive`. |
| `--rigor lean\|standard\|thorough` | Start at a rigor level. Default: from the goal. The level only rises during a run. |
| `--chrome false` | Do not let the manual-check step use the Chrome browser tools. |
| `--pr-comment` | Post the run report as a comment on the open pull request of the current branch. Needs `gh`. |

## How a run behaves

- **Routing.** Each step gets a model and effort from a ladder, based on plan size, review verdicts and failed attempts. Simple changes run cheaper, risky ones go up a tier.
- **Rigor.** `lean`, `standard` or `thorough` decides which extra steps run: a complexity score, pre-plan research, phase executors and review rounds.
- **Reviews.** Both reviews apply their own fixes. The run halts only when a finding is still open and needs your decision. The halt message says what to edit and how to resume.
- **Manual checks.** A subagent tries to prove every Manual row of the plan and saves evidence. Rows it cannot prove are listed with a reason.
- **Halts.** Repeated failures, too many revisions or fix loops, an open review finding or a spent step budget stop the run. Run the same command again to resume.

Every rule, threshold and edge case is in the [reference](docs/REFERENCE.md).

## Configure

Override any policy key per project in `context/foundation/agent-smith-policy.json`, for both chains. Run state lives in `context/changes/<change-id>/agent-smith/` (OpenSpec: `openspec/changes/<change-name>/agent-smith/`).

```json
{ "score": { "minRigor": null }, "manualVerify": { "minRigor": null } }
```

That example turns off the complexity score and the manual-check step. Defaults are in `skills/10x-pipeline/policy.json`. To see a dollar estimate in `report.md`, `status` and `compare`, set `prices.usdPerMillionTokens` per model alias (for example `{ "prices": { "usdPerMillionTokens": { "opus": 30, "sonnet": 6, "haiku": 2 } } }`); it is off by default and uses a blended rate (see [the reference](docs/REFERENCE.md)).

## Opt-in features

Off by default, described in the [reference](docs/REFERENCE.md):

- Restricted step agents (`agents.restricted`).
- Advisor prompt text (`advisor.enabled`).
- Confirmation review rounds (`review.confirmRounds`).
- Pull request comment (`--pr-comment`).

## More documentation

- [`docs/REFERENCE.md`](docs/REFERENCE.md): full behavior, limits, usage report, baseline comparison, run provenance.
- [`docs/ADR/`](docs/ADR/): why it works this way.
- [`AGENTS.md`](AGENTS.md): contributor guide, rules for changing the router, tests and commits.

## Versions and releases

Versions follow [Semantic Versioning](https://semver.org). The plugin is on `0.x`, so the minor number can carry breaking changes until `1.0.0`. Releases are tagged `vX.Y.Z` with a changelog on the [Releases page](https://github.com/xycu/agent-smith/releases). release-please keeps one release PR current from the Conventional Commits on `main`; contributors do not edit the version fields. The rules are in `AGENTS.md` ("Commits", "Releases") and ADR-008.

## Layout

```
.claude-plugin/plugin.json        plugin manifest
.claude-plugin/marketplace.json   marketplace with this repo as its only plugin
release-please-config.json        release-please config (extra-files list the version fields)
.release-please-manifest.json     current released version
.github/workflows/                ci.yml (tests, version check, commit lint) and release.yml
tools/                            version-check.mjs, commit-lint.mjs and their tests
skills/10x-pipeline/              orchestrator skill, policy, router
skills/10x-pipeline/test/         node:test suite for the router and the prompt rule form
skills/openspec-pipeline/         orchestrator skill of the OpenSpec chain (calls the 10x-pipeline router)
agents/                           plugin agent definitions for restricted steps (score.md)
docs/REFERENCE.md                 full behavior reference
docs/ADR/                         architecture decision records
assets/                           README header image
```
