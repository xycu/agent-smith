<p align="center"><img src="assets/agent-smith.jpg.webp" alt="agent-smith header" width="100%"><br><sub>Photo: Warner Bros. Pictures</sub></p>

# agent-smith

**Ship whole changes with AI, not one prompt at a time.**

agent-smith is a Claude Code plugin that runs your [10xDevs](https://10xdevs.pl) or [OpenSpec](https://github.com/Fission-AI/OpenSpec) workflow end to end: plan, review, implement, verify, fix. Each step runs in its own subagent, and a router picks the right model and effort for it from what the earlier steps produced.

## Sound familiar?

You adopted a spec-driven workflow because it works. Running it is still a manual job:

- You start every step yourself and wait for it before you start the next.
- Every step runs on the same model. A typo fix costs as much as a risky refactor, or the hard step gets a model too weak for it.
- One long session fills its context, and the later steps work from a blurry memory of the earlier ones.
- A failed attempt leaves half-done edits in your working tree for you to clean up.
- At the end you cannot say what the change cost or which step burned the tokens.

agent-smith takes over that job. You give it a change and a goal. It runs the chain and comes back with a finished change, or with one precise question for you.

## What you get

- **One command, whole chain.** The run goes on by itself and stops only at `done` or when it needs your decision. The halt message says what to edit and how to resume.
- **The right model for each step.** A model and effort ladder sends simple changes to cheaper tiers and moves risky or failing steps up. Large plans, open review findings and failed attempts raise the tier; clean reviews and short goals lower it.
- **Fresh context for every step.** Each step is its own subagent with a focused prompt. It starts from the files on disk, not from a long chat history, so the reviewer reads the plan cold.
- **Reviews that fix, not only comment.** Plan and implementation reviews apply the clear fixes themselves and mark them as applied. Only the findings that need an owner decision come back to you.
- **Safe to leave running.** Each run works in its own git worktree and branch. Every successful step is committed. A failed step is saved to a side ref, rolled back and retried one tier up. The router never commits or resets in your main checkout.
- **Evidence for manual checks** (10xDevs). A subagent works through the plan's Manual rows with commands, tests or the browser, and saves proof for each row it proves. Rows it cannot prove are listed with a reason.
- **Rigor that matches the risk.** `lean`, `standard` or `thorough`, picked from the goal or set by you, and raised during the run by failures, large plans or hot paths in your git history. Higher levels add a complexity score, and `thorough` adds research and framing before the plan.
- **A report you can show.** Every run writes `report.md`: model, effort, tokens and result per step, review findings, rolled-back steps and an optional dollar estimate. `--pr-comment` posts it to your pull request.
- **Savings you measure yourself.** `compare` sets a routed run against a baseline run of the same change with every step on one model, and reports the token difference. You do not have to trust a number in a README.
- **Transparent and yours to tune.** The router is a dependency-free Node.js script that makes no model or network call. Every threshold sits in `policy.json`, and you can override any key per project.
- **Resume at any time.** Run the same command again and the run continues from its log.

## Is it for you?

agent-smith fits when you:

- use the 10xDevs toolkit or OpenSpec already, or plan to;
- hand changes of a few phases to Claude Code and want them finished without watching every step;
- care where your token budget goes.

It is not worth it for a one-line edit you would type faster yourself. A project without git can opt out of the worktree, but then it loses the step commits and the rollback.

## Install

```
/plugin marketplace add xycu/agent-smith
/plugin install agent-smith@agent-smith
```

## Quick start

Pick the workflow your project uses. Both run through the same router and the same policy.

### OpenSpec

1. In an OpenSpec project (`openspec init`, with `openspec/` committed), create the change: `openspec new change <change-name>`.
2. Run the pipeline:

```
/agent-smith:openspec-pipeline <change-name> "what you want built"
```

The run goes propose, apply, verify and, when verify fails, at most two fix loops of apply and verify. It stops at `done` or at a halt that needs you. With `--archive` it ends with `openspec archive <change-name> --yes --json`. Run state and `report.md` live in `openspec/changes/<change-name>/agent-smith/` and move with the archive.

Requirements in your project:

- The OpenSpec skills `openspec-propose`, `openspec-apply-change` and `openspec-verify-change`, and the `openspec` CLI for `--archive`.
- Node.js 24 or later on `PATH`, and `git`, as for 10xDevs below.
- The name must not also be a 10x change under `context/changes/`.

Flags: `--archive`, `--rigor` and `--pr-comment`, as below. Score, pre-plan steps, phase executors, manual checks and plan review do not run in this chain. See [the OpenSpec section of the reference](docs/REFERENCE.md).

### 10xDevs

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

Versions follow [Semantic Versioning](https://semver.org). Releases are tagged `vX.Y.Z` with a changelog on the [Releases page](https://github.com/xycu/agent-smith/releases). release-please keeps one release PR current from the Conventional Commits on `main`; contributors do not edit the version fields. The rules are in `AGENTS.md` ("Commits", "Releases") and ADR-008.

## License

Free for non-commercial open source projects. Commercial use is free for a 60-day trial. Any other use needs a written license: contact Błażej Ksycki, [blazej@ksycki.pl](mailto:blazej@ksycki.pl). The full terms are in [`LICENSE`](LICENSE).

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
