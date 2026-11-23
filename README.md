<p align="center"><img src="assets/agent-smith.jpg.webp" alt="agent-smith header" width="100%"><br><sub>Photo: Warner Bros. Pictures</sub></p>

# agent-smith

🚀 **Ship whole changes with AI, not one prompt at a time.**

A Claude Code plugin that runs 10xDevs and OpenSpec workflows end to end through explicit slash commands. Each step runs in its own subagent, with model and effort routing based on earlier results. [10xDevs](https://10xdevs.pl) · [OpenSpec](https://github.com/Fission-AI/OpenSpec)

## ✨ Why you'll love it

- ⚡ **One command, whole chain.** Start it and get on with your day. It comes back done, or with one clear question.
- 🧠 **Smart model routing.** Simple steps run on cheaper tiers, hard steps get more power. Automatically.
- 🧼 **Fresh context every step.** Each step starts clean from the files on disk.
- 🛠️ **Reviews that fix.** Reviews apply clear fixes themselves. You only decide what truly needs you.
- 🛡️ **Safe by design.** Its own git worktree, a commit per step, automatic rollback and retry on failure. The branch ends pushed with a pull request for your review, never merged (ADR-017).
- 🎚️ **Rigor that fits.** `lean`, `standard` or `thorough`, rising with risk: more research, scoring and checks where they pay off.
- 🔍 **Proof for manual checks.** Evidence saved for every Manual row it proves (10xDevs).
- 📊 **A report to share.** Model, tokens and result per step, posted to your PR with `--pr-comment`.
- 📉 **Measure your savings.** `compare` puts a routed run next to a single-model baseline.
- ⏯️ **Resume anytime.** Run the same command again and it picks up where it stopped.
- 🔧 **Yours to tune.** Dependency-free Node.js router, every threshold in one policy file.

## 📦 Install

```
/plugin marketplace add xycu/agent-smith
/plugin install agent-smith@agent-smith
```

Needs Claude Code 2.1.292 or later: `${CLAUDE_SKILL_DIR}` in skill content needs 2.1.69 and the `effort` parameter of the Agent tool needs 2.1.292.

The scoped Bash guard requires Claude Code 2.1.295+ for fail-closed hook handling, enabled plugin hooks and subagent identity fields. New Claude steps use `agent-smith:step` by default, and Claude archive steps always use it. The guard covers common direct unsafe commands for that identity, also behind common shell shapes (assignment prefixes, subshells, substitutions, redirects) and simple wrappers such as `env`, `sudo` and `xargs`. A step mapped to another agent type relies on its host permissions and shared safety rules. Older supported hosts retain prompt rules and host permission controls, with runtime guard enforcement unverified. S-12 tracks the first fresh Claude delivery, including the guard. S-18 tracks effective protection across supported hosts. The guard plan identifies the live identity and enforcement checks still open. [S-12 `first-unattended-delivery`](context/foundation/roadmap.md#s-12-first-unattended-plan-based-delivery) · [S-18 `verified-step-protection`](context/foundation/roadmap.md#s-18-effective-step-protection-in-the-supported-environment) · [Guard plan, Manual row 2.6](context/archive/2026-11-13-step-subagent-git-guard/plan.md#progress) · [Step safety and coverage](docs/REFERENCE.md#step-safety-and-pre-publication-acceptance)

Fable compatibility checked 2026-11-14. Fable 5.2 requires Claude Code 2.1.321+. With `ANTHROPIC_DEFAULT_FABLE_MODEL` unset, `fable` resolves to Fable 5 in Claude apps gateway sessions and Fable 5.2 elsewhere. Before opting in, check the version requirement for the resolved model, environment/provider mapping, exposed Agent model alias and effort parameters, and account access. The router performs no version or capability detection. [Model configuration](https://code.claude.com/docs/en/model-config) · [Subagents](https://code.claude.com/docs/en/sub-agents)

### Choose the provider for a run

Both pipelines default to their host’s provider for a fresh run. Add `--provider-mode claude` for Claude throughout, `--provider-mode codex` for OpenAI throughout or `--provider-mode split` to send 10x plan and implement, or OpenSpec propose and ordinary apply, to the other provider. Reviews, repairs and archive stay on the host provider in split mode. Init shows the assignment before launch. Each step shows the actual provider, model and effort.

```text
/agent-smith:10x-pipeline <change-id> "what you want built" --provider-mode split
/agent-smith:openspec-pipeline <change-name> "what you want built" --provider-mode=split
```

Omit the flag to resume a run on its original host and mode. Historical mode-less runs retain their recorded ladder-driven semantics. Install the current router and both skills together.

Use the existing compatibility package for a Claude-plugin archive import into OpenAI, then select the installed pipeline skill through Codex's skill picker. Clean installation and live execution on both hosts remain acceptance checks. [Compatibility import guide](https://developers.openai.com/plugins/guides/submit-claude-plugin.md)

The shipped Claude policy and Codex preset provide the two default ladders automatically. A single-provider project ladder tunes that provider alone. In a mixed override, each rung tunes its declared provider at its original position. The other provider keeps its shipped rung there. The router validates the effective bounds for each routed role. [Custom ladders and split assignments](docs/REFERENCE.md#codex-and-provider-dispatch)

Both hosts need Node.js 24+ and Git. Each executing provider needs authenticated access, project trust and discovery of the routed toolkit skill from the run worktree. OpenAI uses the Codex CLI 0.169.0 contract and existing configuration, optionally an existing `codex.profile`. Native Claude uses Agent on Claude Code. On Codex, Claude uses a guarded POSIX Claude Code print session that verifies capabilities before task handoff. This path records elapsed time with unavailable token coverage. Fresh authenticated execution for all six host/mode combinations on each chain remains a Manual check. [Execution, permission limits and recovery](docs/REFERENCE.md#codex-and-provider-dispatch)

## 🏁 Quick start

For both chains, choose a change id or name of 1–100 characters using lowercase letters, digits and hyphens, starting with a letter or digit.

### 📐 OpenSpec

1. Create the change: `openspec new change <change-name>` (in a project with `openspec/` committed).
2. Run it:

```
/agent-smith:openspec-pipeline <change-name> "what you want built"
```

🔁 Propose, apply, verify, with up to two automatic fix loops. A lighter chain: no score, plan review or manual checks.

Use OpenSpec `2.0.0`, Node.js 24+ and `git`. The pipeline needs `openspec-propose`, `openspec-apply-change` and `openspec-verify-change`. The default core profile omits verify. For a new configuration, select the required workflows and tools with the following commands.

```sh
npm install -g @fission-ai/openspec@2.0.0
openspec config set profile custom
openspec config set workflows '["propose","apply","verify"]'
openspec init --tools claude,codex --profile custom
```

Profile commands change global OpenSpec configuration. Before updating an existing selection, inspect `openspec config get profile` and `openspec config get workflows`, then retain every additional workflow you use in the custom array. Scripted fixtures isolate HOME and XDG configuration/data/cache paths.

For an existing project, preserve customized generated instructions in Git and review `openspec update --dry-run` before `openspec update`. Reconcile retained legacy files before removing them individually. Explicit `init --tools claude,codex --profile custom` restores tool selection when all legacy tool files have been removed. Shared skills live in `.agents/skills/`, with relative Claude links in `.claude/skills/`. Commit the shared targets, `.agents/skills/.openspec-target` and Claude links so fresh run worktrees contain them, then confirm skill discovery in a fresh child from the run root. `--archive` also needs the CLI on PATH. [Setup and upgrade details](docs/REFERENCE.md#openspec-200-setup-and-upgrade).

### 🔟 10xDevs

1. Create the change: `/10x-new <change-id>`.
2. Run it:

```
/agent-smith:10x-pipeline <change-id> "what you want built"
```

🔁 Plan, plan review, implement, implementation review, fix. The report lands in `context/changes/<change-id>/agent-smith/report.md` relative to the run root. Default isolation puts that root in `.claude/worktrees/agent-smith-<change-id>/` on branch `agent-smith/<change-id>`, whose pull request carries the report. A successful 10x archive moves it to `context/archive/<created-date>-<change-id>/agent-smith/report.md` in that worktree.

Needs: the skills `10x-plan`, `10x-plan-review`, `10x-goal-implement` and `10x-impl-review`, Node.js 24+ and `git`.

💡 Each run works in its own worktree and ends with its branch pushed and a pull request open for human review. Branches use `isolation.branchPrefix` plus the change id, with `agent-smith/` as the default. agent-smith never merges the PR. A `github.com` remote and `gh` are required. The reference covers configured naming and the `isolation.require: false` opt-out. [Run isolation](docs/REFERENCE.md)

### Claude Code invocation

Start deliberately with `/agent-smith:10x-pipeline <change-id>` or `/agent-smith:openspec-pipeline <change-name>`. Both skills set `disable-model-invocation: true` so you control when the side-effecting run starts. Claude Code keeps their descriptions out of model context and disables automatic loading from plain-language requests such as `pipeline this change`. Direct user commands remain available. These invocation controls are Claude Code-specific. [Invocation control](https://code.claude.com/docs/en/skills#control-who-invokes-a-skill)

| Entry point for either pipeline | Documented behavior |
| --- | --- |
| Direct slash command | Loads the selected skill. |
| Plain-language request | Automatic loading is disabled. |
| `claude -p "/agent-smith:10x-pipeline <change-id>"` or the OpenSpec equivalent | Expands the user-invoked skill command in print mode. |
| `/loop 5m /agent-smith:10x-pipeline <change-id>` or the OpenSpec equivalent | A scheduled fire delivers the prompt as plain text with automatic skill expansion disabled. |
| Another skill using the Skill tool | Requires the matching slash command as a separate word in the current user message. |

A matching command at the start of the message invokes the skill directly. A separate command word after prose authorizes Claude to call it through the Skill tool for that message. Integrations need that current-message authorization. [Command placement](https://code.claude.com/docs/en/skills#where-you-write-the-skills-name)

These compatibility statements follow Anthropic documentation reviewed on 2026-11-14. Print mode supports user-invoked skill commands and waits for background work subject to an idle ceiling. The reference's immediate-exit prediction is historical and explicitly unverified. The shipped frontmatter passed its content checks. Live observations of both explicit commands and plain-language non-selection remain pending in row 1.6. S-12 tracks the first complete headless Claude delivery and S-20 tracks the supported configurations. [Invocation evidence](context/archive/2026-11-12-skills-disable-model-invocation/evidence/judgment-manual-invocation-retry.md) · [S-12 delivery](context/foundation/roadmap.md#s-12-first-unattended-plan-based-delivery) · [S-20 qualification](context/foundation/roadmap.md#s-20-recorded-support-across-all-agreed-configurations) · [Headless commands](https://code.claude.com/docs/en/headless) · [Background tasks at exit](https://code.claude.com/docs/en/headless#background-tasks-at-exit) · [Scheduled prompts](https://code.claude.com/docs/en/scheduled-tasks#run-a-prompt-repeatedly-with-loop) · [Historical hypothesis](docs/REFERENCE.md)

## 🎛️ Options

| Flag | Effect |
| --- | --- |
| `--archive` | Archive the change when the run is done; asks first when Manual checks are pending or unproved. |
| `--rigor lean\|standard\|thorough` | Start at a rigor level. Default: picked from the goal. |
| `--provider-mode claude\|codex\|split` | Choose the run provider or split planning and implementation across providers. Omit it to use the host provider on a fresh run. |
| `--chrome false` | Keep the manual-check step off the Chrome browser tools. |
| `--pr-comment` | Post the run report to the open pull request. Stored with the run, so a resume keeps it; `--pr-comment false` turns it off. Needs `gh`. See “PR comment (opt-in)” in [the reference](docs/REFERENCE.md) for manual posting and recovery. |

## ⚙️ Configure

Override project-tunable policy keys in `context/foundation/agent-smith-policy.json`. Defaults live in `skills/10x-pipeline/policy.json`; the OpenSpec chain's steps and prompts live in `skills/openspec-pipeline/policy.json`, which the router merges with it. The always-true step rules live in `skills/10x-pipeline/rules/` and `skills/openspec-pipeline/rules/`; no override reaches them (ADR-023, `skills/10x-pipeline/rules/README.md`).

```json
{ "prices": { "usdPerMillionTokens": { "opus": 30, "sonnet": 6, "haiku": 2, "fable": 12 } } }
```

All numbers above are illustrative user-supplied blended rates. Supply current rates for your deployment. Pricing is a separate opt-in, with `prices: null` as the default. The estimate uses `totalTokens * rate / 1e6`, with one rate per model key across providers and efforts and no input/output/cache split. Omit unknown prices, since `0` is a real zero rate. With verified subtree usage the estimate is labelled a routing-rate approximation: child models may differ, and all child usage is priced at the enclosing dispatch rate. Estimates carry no billing or savings guarantee.

Eligible Claude hosts can merge the complete opt-in fable ladder and four selected ceilings into their project override. Arrays replace whole, so preserve unrelated keys deliberately. The shipped rigor floors remain supported. A custom `xhigh` floor skips the high rung and can exceed a lower ceiling, while a custom `max` floor exhausts this extension at xhigh. In split mode, every step assigned to OpenAI must fit its effective ladder. Adjust any shared step ceilings that exceed it. [Opt-in fable ladder](docs/REFERENCE.md#opt-in-fable-ladder)

With a price table missing fable, status gives its step cost as `null`, the report cell is `-` and the summary names `no price for: fable`. Compare adds `cost-incomplete:routed` while preserving the token verdict. All-unpriced status totals are `null`. With prices off, status/report omit costs and compare side costs stay `null`.

Opt-in extras: restricted step agents, advisor prompts, confirmation review rounds. All in the [reference](docs/REFERENCE.md).

### Claude Code subagent depth

This repository permits the orchestrator → step → child layers. Plugin users enable delegation by merging this entry into their project’s `.claude/settings.json`.

```json
{
  "env": {
    "CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH": "2"
  }
}
```

The cap affects every Claude session in that project, including workflows outside the pipeline. Commit the setting before creating run worktrees, then start a fresh Claude session from the intended project root. Use awaited foreground children with the guarded `agent-smith:step` identity. A Claude Code 2.1.311 headless probe collected its native child. The interactive attempt hit quota. S-14 carried rows 1.3 and 3.4 into S-20 for final-candidate qualification. [Native observations](context/archive/2026-11-16-nested-step-delegation/evidence/capabilities.md#top-level-native-probes) · [S-14 closeout](context/archive/2026-11-16-nested-step-delegation/evidence/acceptance.md#publication-verification-and-archive-closeout) · [S-20 `supported-host-acceptance`](context/foundation/roadmap.md#s-20-recorded-support-across-all-agreed-configurations) · [Subagent depth](docs/REFERENCE.md)

## Observed token coverage

Reports and status distinguish verified `step-tree` tokens, unavailable measurements and legacy figures. Missing is `-`, measured zero is `0`, and partial totals appear as subtotals. Ordinary `claude` starts with capture off. To opt in for one fresh interactive session on macOS or Linux with Node.js 24+, start the launcher from your project root. Replace the example plugin path with the absolute path to your installed agent-smith plugin.

```bash
node "/absolute/path/to/agent-smith/skills/10x-pipeline/scripts/claude-capture.mjs"
```

Run the same command with `--versions` to print the minimum supported Claude Code release. Exit the session and start `claude` to turn capture off. The launcher uses private loopback storage for the session and refuses conflicting export settings or managed policy. With capture off, reports and `compare` show `capture-disabled` and the launcher command. [Capture setup, retention, late attachment and rollback](docs/REFERENCE.md#accounting-activation-and-rollback)

Legacy-only comparisons retain their result with a scope warning. A comparison that mixes verified and legacy figures refuses a savings verdict. Provider, model and tier groups describe the enclosing dispatch. Capture accepts Claude Code 2.1.311 or later. The 2.1.311 format rests on documented record shapes and sanitized replay fixtures, not on a retained live capture. An interactive launcher session launches each step in the background, so the collector settles the step from its stop, completion and transcript records and counts the step agent's requests that have no transcript entry. A later release that changes the record shape reports its figures as unavailable instead of wrong. A complete interactive Claude-hosted pipeline with the launcher on Claude Code 2.1.323 ended with verified figures for every step (2026-11-23); a headless run is not recorded. S-20 separately tracks the full host and mode qualification matrix. [Claude capture acceptance](context/archive/2026-11-19-claude-token-figures-default/evidence/acceptance.md) · [Accounting evidence](context/archive/2026-11-18-delegated-token-accounting/evidence/accounting.md#manual-acceptance-outstanding) · [S-20 qualification](context/foundation/roadmap.md#s-20-recorded-support-across-all-agreed-configurations)

## 📚 More

- [`docs/REFERENCE.md`](docs/REFERENCE.md): every rule, threshold and edge case.
- [`docs/ADR/`](docs/ADR/): why it works this way.
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — contributor guide and submission terms.
- [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) — participation standards and conduct reporting.
- [`AGENTS.md`](AGENTS.md) — repository rules and architectural conventions.
- [`SECURITY.md`](SECURITY.md): security policy and private reporting process.
- [Releases](https://github.com/xycu/agent-smith/releases): changelog, [SemVer](https://semver.org) tags `vX.Y.Z`.

## 📄 License

Copyright (c) 2026 Błażej Ksycki. Project-owned code, documentation and other material are licensed under Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International (CC BY-NC-ND 4.0). You may share unadapted copies for noncommercial purposes with attribution. The license permits producing adaptations for noncommercial purposes, with sharing of adaptations requiring separate permission. Full terms appear in [LICENSE](LICENSE) and the [official license summary](https://creativecommons.org/licenses/by-nc-nd/4.0/).

The additional contribution permission covers noncommercial sharing of project-owned adaptations through forks and pull requests to propose or review contributions to agent-smith. Incoming contribution terms cover the maintainer's revision, incorporation and distribution of future contributions under the project's licensing terms, with contributors retaining ownership. [Contribution permission](CONTRIBUTING.md#contribution-permission) · [Incoming contribution terms](CONTRIBUTING.md#incoming-contribution-terms)

Separately credited third-party material, including the header image and bundled OpenSpec skills with MIT notices, retains its own rights and terms. Earlier versions remain governed by the license supplied with them. For permissions beyond CC BY-NC-ND 4.0, contact Błażej Ksycki at [blazej@ksycki.pl](mailto:blazej@ksycki.pl).
