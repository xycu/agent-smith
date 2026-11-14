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

### Codex and OpenAI steps

The shared `10x-pipeline` and `openspec-pipeline` skills also support Codex hosting OpenAI steps, and Claude Code hosting a mixed Claude/OpenAI ladder. Codex CLI 0.169.0 is the verified runner contract. Node.js 24+, authenticated model access, project trust and separately installed upstream toolkit skills are required. Confirm that a fresh CLI child can discover those skills from the run worktree.

Use the existing compatibility package for a Claude-plugin archive import into OpenAI, then select the installed pipeline skill through Codex's skill picker. Clean installation and live execution on both hosts remain acceptance checks. [Compatibility import guide](https://developers.openai.com/plugins/guides/submit-claude-plugin.md)

Merge `skills/10x-pipeline/codex-policy.json` into `context/foundation/agent-smith-policy.json` for the opt-in GPT ladder. Existing overrides need a deliberate merge because arrays replace whole. The preset preserves tier positions and supplies an initial capability ordering. A Claude-hosted mixed ladder tags each OpenAI rung with `"provider": "openai"`. A Codex host needs an OpenAI-only ladder.

Existing Codex configuration is the default. Optional `codex.profile` selects an existing named configuration. The runner checks Git filesystem capability before launching a model and respects managed requirements and outer host restrictions. Native sandbox can force legacy `sandbox_mode` settings read-only and prevent verification. Execpolicy and hook behavior still need live acceptance. See the reference for the execution protocol and limits. [Codex execution](docs/REFERENCE.md#codex-and-provider-dispatch)

## 🏁 Quick start

### 📐 OpenSpec

1. Create the change: `openspec new change <change-name>` (in a project with `openspec/` committed).
2. Run it:

```
/agent-smith:openspec-pipeline <change-name> "what you want built"
```

🔁 Propose, apply, verify, with up to two automatic fix loops. A lighter chain: no score, plan review or manual checks.

Needs: the skills `openspec-propose`, `openspec-apply-change` and `openspec-verify-change`, the `openspec` CLI for `--archive`, Node.js 24+ and `git`. [Details](docs/REFERENCE.md).

### 🔟 10xDevs

1. Create the change: `/10x-new <change-id>`.
2. Run it:

```
/agent-smith:10x-pipeline <change-id> "what you want built"
```

🔁 Plan, plan review, implement, implementation review, fix. The report lands in `context/changes/<change-id>/agent-smith/report.md`.

Needs: the skills `10x-plan`, `10x-plan-review`, `10x-goal-implement` and `10x-impl-review`, Node.js 24+ and `git`.

💡 Each run works in its own worktree on the branch `agent-smith/<change-id>`, and ends with that branch pushed and a pull request open for human review. agent-smith never merges it. Needs a `github.com` remote and `gh` for the pull request. Running without a worktree (no push, no pull request): see [Run isolation](docs/REFERENCE.md).

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

These compatibility statements follow Anthropic documentation reviewed on 2026-11-14. Print mode supports user-invoked skill commands and waits for background work subject to an idle ceiling. The reference's immediate-exit prediction is historical and explicitly unverified. Version-specific live invocation acceptance and full headless pipeline completion remain pending. [Headless commands](https://code.claude.com/docs/en/headless) · [Background tasks at exit](https://code.claude.com/docs/en/headless#background-tasks-at-exit) · [Scheduled prompts](https://code.claude.com/docs/en/scheduled-tasks#run-a-prompt-repeatedly-with-loop) · [Historical hypothesis](docs/REFERENCE.md)

## 🎛️ Options

| Flag | Effect |
| --- | --- |
| `--archive` | Archive the change when the run is done; asks first when Manual checks are pending or unproved. |
| `--rigor lean\|standard\|thorough` | Start at a rigor level. Default: picked from the goal. |
| `--chrome false` | Keep the manual-check step off the Chrome browser tools. |
| `--pr-comment` | Post the run report to the open pull request. Stored with the run, so a resume keeps it; `--pr-comment false` turns it off. Needs `gh`. |

## ⚙️ Configure

Override any policy key per project in `context/foundation/agent-smith-policy.json`. Defaults live in `skills/10x-pipeline/policy.json`; the OpenSpec chain's steps and prompts live in `skills/openspec-pipeline/policy.json`, which the router merges with it. The always-true step rules live in `skills/10x-pipeline/rules/` and `skills/openspec-pipeline/rules/`; no override reaches them (ADR-023, `skills/10x-pipeline/rules/README.md`).

```json
{ "prices": { "usdPerMillionTokens": { "opus": 30, "sonnet": 6, "haiku": 2 } } }
```

That one adds a dollar estimate to every report. 💰

Opt-in extras: restricted step agents, advisor prompts, confirmation review rounds. All in the [reference](docs/REFERENCE.md).

## 📚 More

- [`docs/REFERENCE.md`](docs/REFERENCE.md): every rule, threshold and edge case.
- [`docs/ADR/`](docs/ADR/): why it works this way.
- [`AGENTS.md`](AGENTS.md): contributor guide.
- [Releases](https://github.com/xycu/agent-smith/releases): changelog, [SemVer](https://semver.org) tags `vX.Y.Z`.

## 📄 License

Free for non-commercial open source projects. Commercial use is free for a 60-day trial. Any other use needs a written license: contact Błażej Ksycki, [blazej@ksycki.pl](mailto:blazej@ksycki.pl). Full terms in [`LICENSE`](LICENSE).
