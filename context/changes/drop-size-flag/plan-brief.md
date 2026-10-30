# Drop the --size flag — Plan Brief

> Full plan: `context/changes/drop-size-flag/plan.md`
> Research: `context/changes/drop-size-flag/research.md`

## What & Why

Remove the `--size s|m|l` argument and the report's `Size:` line. The router is meant to pick the model and effort from the change itself, and a manual size hint works against that. The flag's only real job is to lower the first plan step's tier, so the goal text takes over that job.

## Starting Point

`--size s` is the only way to get a first plan below opus/high today: it gives sonnet/medium, `m` gives opus/high and `l` gives opus/xhigh. The router has no plan to measure before the first plan step, and it never reads the goal text for routing. Later steps are already driven by plan size, review verdicts and failures; for them the flag only adds a veto (`l`) on the simple-change discount.

## Desired End State

No file names `--size`, `sizeBump` or a `Size:` line. The first plan runs on sonnet/high by default, on sonnet/medium for a short goal, and on opus/high when the goal contains a hard keyword. The word limit and the keyword list are policy keys a project can override. The PRD and ADR-001 no longer list the size flag as a routing signal.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Remove the flag | Drop `--size`, `sizeBump` and the `Size:` report line | The router should decide from intent, not from a manual hint | Plan |
| First plan tier | Derive from the goal text | Closest to deciding from intent without an LLM scorer | Plan |
| Goal rule | Length plus hard keywords | Uses the intent directly and stays overridable per project | Plan |
| Short goal | Non-empty, at most 25 words, no hard keyword: simple, sonnet/medium | Same tier `--size s` gave | Plan |
| Hard keyword | Word starting with a keyword (case-insensitive) keeps opus/high | A risky or structural goal keeps the strongest planner | Plan |
| Empty or long goal | sonnet/high | The Sonnet-5.5 high baseline, never costlier | Plan |
| Mechanism | First-plan offsets, `steps.plan.baseTier` stays 4 | Lowering the base tier would also lower every re-plan tier | Plan (adapted) |
| Starter keywords and limit | 9 English keywords, 25 words, in `policy.json` | Starting guesses; no measurements exist yet | Plan |
| Documents | Edit PRD and ADR-001, leave shape-notes | Product documents match behaviour; raw notes stay as written | Plan |
| Report | Remove the `Size:` line | It would always be empty | Plan |
| Leftover `--size` | Ignored silently | `parseFlags` already ignores unknown flags; `SKILL.md` stops passing it | Research |

## Scope

**In scope:** `route.mjs`, `policy.json`, `SKILL.md`, `README.md`, `AGENTS.md`, `prd.md`, ADR-001.

**Out of scope:** LLM or content scoring, reading `change.md` or `research.md` for routing, tier rules for later steps, `shape-notes.md`, the archive, the manifests, the roadmap.

## Architecture / Approach

A small helper classifies the goal as short, plain or hard. The first-plan branch of `decide` turns the class into the existing `bump` (plain -1, hard 0), and `simpleSignal` marks a short goal simple, which adds the existing plan discount of 1. With a base tier of 4 this yields tiers 2, 3 and 4. The word limit, keyword list and bumps sit under `complexity.firstPlan` in `policy.json`. Escalation after failures or a bad plan review is unchanged.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Router and policy | Flag removed, goal rule live, checked by scratch runs | A first plan on a cheaper tier than before may fail more often on hard goals with no keyword |
| 2. Docs sync | `SKILL.md`, `README.md`, `AGENTS.md`, PRD and ADR-001 follow the behaviour | Docs drift from the rule if wording differs between files |

**Prerequisites:** None.
**Estimated effort:** About 1 to 2 sessions across 2 phases.

## Open Risks & Assumptions

- The 25-word limit and the 9 starter keywords are guesses. A hard change with a short, keyword-free goal will plan on sonnet/medium; failures and plan review escalate it, as before.
- English keywords only. A Polish goal is judged by length alone.
- The first plan on a plain goal now runs one tier below today's default. This is the intended saving, but it is unmeasured.
- Phase 1 first proposed lowering `baseTier` to 3; it is implemented as offsets so re-plan tiers stay the same.

## Success Criteria (Summary)

- A scratch run per goal class returns the expected first-plan tier: sonnet/high, sonnet/medium, opus/high.
- Re-plan tiers and later steps behave as before.
- No shipped file, the PRD or ADR-001 names `--size`.
