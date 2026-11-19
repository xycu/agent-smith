# Frame Brief: Select a Claude, Codex or split provider mode for a run

> Framing step before /10x-plan. This document captures what is *actually*
> at issue, separated from what was initially assumed.

## Reported Observation

Every step of the Wave 1 run executed on OpenAI models through Codex, although the user works in Claude Code and did not choose that. The router has no way to say "run this step on the other tool".

## Initial Framing (preserved)

- **User's stated cause or approach**: The flow should have one run mode with three values: full Claude Code, full Codex, and a split where the session's host tool does most steps and the other tool does only plan and implement. The split must work in both directions (hosted in Claude Code, hosted in Codex).
- **User's proposed direction**: Open a new change (`provider-mode-split`) that makes the provider configurable per run.
- **Pre-dispatch narrowing**: The leading concern is "unexpected tool" (the user was surprised that Codex ran everything). Host scope is "both hosts". Split scope is "the authoring steps" (plan and implement, not review or verify steps).

## Dimension Map

The observation could originate at any of these dimensions:

1. **Provider selection** — the router picks a provider only through the ladder rung of a complexity tier, never through the step. A user cannot ask for "plan on Codex".
2. **Configuration surface** — the project override `context/foundation/agent-smith-policy.json` replaces the whole shipped ladder (arrays are replaced, not merged), so a one-time OpenAI-only ladder silently decides the provider of every step of every run.
3. **Host rules** — `hostProblem` accepts a mixed ladder under a Claude host and halts a Codex host on any non-OpenAI rung. The host flag is stored per run.
4. **Dispatch boundary** — a Claude host can start Codex through `run-codex.mjs`. No path exists for a Codex host to start a Claude step.
5. **Step classification** — "plan and implement" is not the full set of authoring steps. `fix` edits code, `impl-review` applies fixes and commits, `plan-review-apply` edits the plan, `manual-verify` swaps its prompt per provider, and `archive` is pinned to tier 3.

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| Provider selection is only by tier rung | `dispatchTarget(policy, tier)` in `skills/10x-pipeline/scripts/state.mjs:97-102` is the only place a tier becomes `{provider, model, effort, profile}`. `tierFor` (`steps.mjs:548-629`) takes the step name but returns only an integer. `policy.steps[step]` (`state.mjs:194-201`) holds `skill`, `baseTier`, `minTier`, `maxTier`, `interactive` and no provider field. | STRONG |
| The project override explains the surprise | The repo override holds an eight-rung OpenAI-only ladder. `deepMerge` (`state.mjs:47-50`) replaces arrays whole. `codex-policy.json` is a copyable overlay that no code loads. | STRONG |
| Host rules block the split on a Codex host | `hostProblem` (`state.mjs:104-110`): "A Codex host requires an OpenAI-only ladder". It is re-checked on every `next` and `usage` (`route.mjs:995-1003`), and a different `--host` on resume halts. | STRONG |
| No Claude dispatch exists from a Codex host | `SKILL.md:62` runs `claude` actions only through the Agent tool on a Claude host. `run-codex.mjs` accepts only `provider: "openai"` and spawns only `codex`. No `claude` spawn exists in `skills`, `agents` or `hooks`. Accounting (`claude-usage.mjs`) and the step guard (`step-guard.mjs`) are Claude-host code. | STRONG (evidence of absence) |
| The split steps are more than plan and implement | `prompts/impl-review-apply.md` applies code fixes and commits. `plan-review-apply` edits `plan.md`. `fix` follows `impl-review` and floors to the last implement/fix tier. `manual-verify` uses the `manual-verify-openai` template on an OpenAI tier (`route.mjs:197-198`). `archive` and `os-archive` ignore restricted agent mappings. | STRONG |

## Narrowing Signals

- The user's own answers fix the concern ("unexpected tool"), the host scope ("both hosts") and the step scope ("the authoring steps").
- Step 3 found strong evidence on every dimension and the dimensions do not compete: each one is a separate part of one problem. Step 4 questions were skipped for that reason. The one open scope decision (whether the Codex-hosted split belongs in this change) is a direction choice, so it belongs to /10x-plan and is recorded below as an open question, not asked here.

## Cross-System Convention

The earlier change `2026-11-13-openai-codex-support` chose the mixed ladder under a Claude host as its mechanism (`research.md:28`, `:219`) and put "Claude steps from a Codex host" explicitly out of scope (`plan-brief.md:37`, `plan.md:39`). So the current limit is a recorded decision, not an oversight. The request reverses that exclusion for the split mode only.

## Reframed (or Confirmed) Problem Statement

> **The actual problem to plan around is**: the router chooses a provider by complexity tier only, so the user cannot name a provider for a run or for a step; and, separately, a Codex-hosted session has no way to run a Claude step.

The initial framing (three run modes) holds up, but it hides two problems of different size. The first is a per-run mode that maps to a per-step provider choice. It is reachable on a Claude host with parts that exist now: a mixed ladder, `run-codex.mjs`, `policy.steps`, and an `init` flag stored in `meta.json` like `--host`. The second is a Claude dispatch boundary for a Codex host, with its own runner, accounting and guard parity. The earlier change left it out on purpose.

Two framing details also change. "Plan and implement" is a smaller set than "authoring steps": `fix`, `impl-review` and `plan-review-apply` also write files and need an explicit decision. And the surprise itself (a project override silently selecting Codex for everything) is a visibility problem that exists whatever mode is built.

## Verification (2026-11-19)

The user chose to verify the Claude dispatch boundary before planning. One headless call, the same kind a Codex host would spawn, was run from a shell: `echo "Reply with exactly: ok" | claude -p --model haiku --effort low --no-session-persistence --output-format json --permission-mode dontAsk` (Claude Code 2.1.311). It exited cleanly and returned a single JSON object with `result: "ok"`, `is_error: false`, `session_id`, `duration_ms`, a `usage` block (input, output, cache read and cache creation tokens), `modelUsage` per model and `total_cost_usd`. This proves a Claude step can be started and measured from outside Claude Code, with a model, an effort level and a permission mode. It does not prove tool use inside the child, the step-guard hooks, or the agent mapping (`agent-smith:step`), which are the parity work.

## Confidence

**HIGH** for the two-problem split. **MEDIUM** for the size of the Codex-hosted half: a Claude runner is feasible (headless call proven), but usage accounting (`claude-usage.mjs`), the step guard and agent selection still need a design.

## What Changes for /10x-plan

The plan should treat the per-run mode and per-step provider choice as the core deliverable, with the Claude-hosted split as its first acceptance case. Before it commits to the Codex-hosted split, it should decide whether that half is a second change with its own Claude runner, and whether the router should state the chosen provider per step at `init`.

Open questions for the plan:

- Do `fix`, `impl-review` and `plan-review-apply` follow `plan` and `implement`, or stay on the host tool?
- Does the mode live in an `init` flag, in the project policy file, or both, and which wins on resume?
- Is the Codex-hosted split in this change or a follow-up change?
- Should the router report the provider of every step at `init`, so a project override cannot select a provider unnoticed?

## References

- Source files: `skills/10x-pipeline/scripts/state.mjs:47-50`, `:94-110`, `:194-201`; `skills/10x-pipeline/scripts/steps.mjs:548-629`; `skills/10x-pipeline/scripts/route.mjs:197-198`, `:995-1003`, `:1080`; `skills/10x-pipeline/SKILL.md:62`, `:82`; `skills/10x-pipeline/scripts/run-codex.mjs`
- Docs: `docs/REFERENCE.md:7-17`, `docs/ADR/ADR-024-openai-codex-support.md`
- Prior decision: `context/archive/2026-11-13-openai-codex-support/plan-brief.md:37`, `plan.md:39`, `research.md:28`, `:219`
- Related research: none yet for this change
- Investigation tasks: three Explore sub-agents (provider selection and config, host rules and dispatch boundary, step classification)
