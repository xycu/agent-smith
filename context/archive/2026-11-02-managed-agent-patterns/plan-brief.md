# Run provenance, tool-restricted step agents and an opt-in advisor — Plan Brief

> Full plan: `context/changes/managed-agent-patterns/plan.md`
> Research: `context/changes/managed-agent-patterns/research.md`

## What & Why

Three patterns from the Managed Agents docs, adapted to the local plugin: record what a run ran with, restrict the tools of the `score` step, and let `plan` and `implement` consult an advisor once. Each later pattern defaults to off so `compare` can measure it alone, and provenance lands first so `compare` can say why two arms differ.

## Starting Point

`meta.json` keeps unknown keys across a resume and `compare` already reads it per side, but nothing records the plugin version, the policy or the prompts, and `compare` warns about goal, base commit and input files only. The orchestrator always dispatches `general-purpose`. No `agents/` folder exists, and no prompt mentions an advisor.

## Desired End State

A new run's `meta.json` carries a provenance record, and `compare` warns when two arms differ outside the expected sections. With `agents.restricted` on, the score step runs as `agent-smith:score` with four tools. With `advisor.enabled` on, `plan` and `implement` are asked to consult the advisor once. ADR-009 holds the decisions and the A/B rules, fixed before any run.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Provenance shape | Per-section hashes, prompts by resolved text, agent files, flags | The baseline arm differs by design and the override holds the compare target, so one hash says nothing | Research |
| Provenance timing | Record once at first `init`; recompute at `next`, record `drift` | A policy edit between steps would otherwise be invisible | Plan |
| compare warnings | Warn on all sections except an expected set in the policy; both-unknown stays silent | Keeps the warning meaningful and existing tests green | Plan |
| Restricted agents | `score` only, map in `policy.json`, no `model` in the file, no fallback | Only `score` gets a real narrowing; a failed `score` attempt is neutral, a failed `research` or `frame` is not | Research / Plan |
| Agent name | `agent-smith:score`, confirmed by a live check | The docs do not state the string | Research |
| Advisor direction | Prompt rule on top of the user's `advisorModel`; no nested `Agent`, no settings read | The native advisor is server-side, so the spawn-depth risk is gone, but a plugin cannot configure or cap it | Research / Plan |
| Advisor decision rule | Fixed in ADR-009: P0 token attribution, then fewer steps, no more failures, at most 10% more tokens, A/A below 10 | The advisor adds tokens at an unchanged tier, so a token drop is the wrong test | Plan |
| Defaults | `agents.restricted` and `advisor.enabled` ship `false` | Opt-in, measured with `compare` before any default changes | Change |

## Scope

**In scope:** provenance record and `compare` warnings; `agents/score.md`, the `agent` router field and the `SKILL.md` dispatch line; the advisor prompt, flag and router append; ADR-009; README, `AGENTS.md` and prompt index updates; three test files.

**Out of scope:** dynamic workflows, a token budget, a nested `Agent` advisor, router reads of user settings, restricted `research` and `frame` agents, a silent fallback to `general-purpose`, hooks, changing any default to `true`.

## Architecture / Approach

The router stays a script (ADR-006). Provenance is computed from files it already reads plus `plugin.json` and `agents/*.md`, stored in `meta.json`, and compared in `compare` against sets held in `policy.json`. The agent type travels as one new optional field of the `run` output; the orchestrator uses it as `subagent_type`. The advisor is prompt text the router appends before the generic suffix for three templates. Each phase is one Conventional Commit.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Run provenance | `meta.provenance`, drift, `compare` warnings, tests, docs | A false alarm on the pinned baseline or a legacy pair |
| 2. Tool-restricted step agents | `agents/score.md`, `agents` policy block, `agent` output field, SKILL.md line, tests, docs | The agent type may not resolve for an installed plugin |
| 3. Opt-in advisor and ADR-009 | `prompts/advisor.md`, `advisor` policy block, router append, ADR-009, tests, docs | Advisor tokens may be missing from the reported usage, so no A/B can be read |

**Prerequisites:** Node 24; for the manual rows a Claude Code install of the plugin from this branch, and an `advisorModel` setting for live check P0.
**Estimated effort:** ~3 sessions across 3 phases.

## Open Risks & Assumptions

- Unattended readings that need the owner: score-only agents, prompt rule over `advisorModel`, the two A/B rules and their uncalibrated thresholds (ADR-009 starts as `Proposed`).
- If the live checks show the agent type does not resolve, or advisor tokens are not attributable, Phase 2 needs a name fix or Phase 3 is dropped; Phases 1 and 2 still ship.
- `advisor.enabled` cannot verify or cap a consult, and two arms with different `advisorModel` settings differ for a reason the router cannot see.

## Success Criteria (Summary)

- Two runs of the same change show in `compare` exactly which policy, prompt, agent or flag sections differ, and a legacy pair stays silent.
- The restricted score step and the advisor rule can each be switched on per project and measured against the same change with `compare`.
- The full suite passes with both flags at their defaults, and every default output is unchanged.
