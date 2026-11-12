<p align="center"><img src="assets/agent-smith.jpg.webp" alt="agent-smith header" width="100%"><br><sub>Photo: Warner Bros. Pictures</sub></p>

# agent-smith

🚀 **Ship whole changes with AI, not one prompt at a time.**

A Claude Code plugin that runs your [10xDevs](https://10xdevs.pl) or [OpenSpec](https://github.com/Fission-AI/OpenSpec) workflow end to end: plan, review, implement, verify, fix. One command, every step in its own subagent, on the right model.

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

## 🎛️ Options

| Flag | Effect |
| --- | --- |
| `--archive` | Archive the change when the run is done; asks first when Manual checks are pending or unproved. |
| `--rigor lean\|standard\|thorough` | Start at a rigor level. Default: picked from the goal. |
| `--chrome false` | Keep the manual-check step off the Chrome browser tools. |
| `--pr-comment` | Post the run report to the open pull request. Needs `gh`. |

## ⚙️ Configure

Override any policy key per project in `context/foundation/agent-smith-policy.json`. Defaults live in `skills/10x-pipeline/policy.json`.

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
