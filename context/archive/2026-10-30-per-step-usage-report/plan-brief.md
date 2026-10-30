# Per-Step Usage Report — Plan Brief

> Full plan: `context/changes/per-step-usage-report/plan.md`

## What & Why

Every pipeline run should end with a readable report of which model and effort ran each step, plus token figures where available. This is roadmap item S-02 (PRD FR-004, FR-009). It lets the owner see what a run cost and gives the later PR comment (S-05) and baseline comparison (S-06) something to build on.

## Starting Point

`run.jsonl` already records model, effort, tier and result per step, and `status` prints it as JSON. No readable report exists, and the router never sees token figures. Only the orchestrator sees them, in the Agent tool result.

## Desired End State

When a run ends, `done` or `halt`, `context/changes/<id>/agent-smith/report.md` is there: a table with one row per step (model, effort, tier, simple, result, tokens) and a totals line saying how many steps had token figures. `status <id> --report` rewrites it on demand. Steps without figures show `-`.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| -------- | ------ | ---------------- |
| Usage source | Orchestrator copies usage from the Agent result into the RESULT JSON; the router validates and stores it | The router cannot see figures, and transcripts sit outside the project and are keyed by an id the router lacks. |
| Figures kept | Total tokens, tool uses, duration | The Agent result gives one total, no input/output split. |
| Report trigger | Router writes it on `done` and `halt`; `status <id> --report` regenerates | Covers halted runs, which are the costly ones, and archive cannot be changed. |
| Location and format | `agent-smith/report.md`, Markdown table | Stays in run state (FR-008), travels into the archive, pastes into a PR comment as is. |
| Missing figures | `-` per cell, totals line states `K of N steps` | Honest about gaps; the report stays useful on model and effort alone. |
| Policy | No new `policy.json` keys | The file name is fixed, nothing to tune. |
| Outcome on regenerate | `outcome` stored in `meta.json` at run end, cleared by `init` | A later `--report` prints the real outcome, and a resumed run is not shown as ended. |

## Scope

**In scope:** usage intake in `route.mjs`; report builder and writer; `status --report`; `SKILL.md` and `README.md` text.

**Out of scope:** baseline comparison (S-06), PR comment (S-05), transcript reading, money cost, input/output token split, any `policy.json` or tier-logic change, a report for the missing-result halt.

## Architecture / Approach

`attachResult` cleans `result.usage` onto the log entry. A new `buildReport` renders the log and `meta.json` to Markdown and `writeReport` saves it. `next` calls it in its three end-of-run branches and records `outcome` in `meta.json`. `SKILL.md` is the only place that makes figures appear, by telling the orchestrator to pass them along.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Usage intake | Valid `usage` on log entries and in `status` | Bad usage input must never fail a step. |
| 2. Report writer | `report.md` on done/halt, `status --report` | An end-of-run branch is missed, leaving some runs without a report. |
| 3. Docs sync | Orchestrator passes usage; `SKILL.md` and `README.md` describe the report | Orchestrator copies numbers wrongly or skips them. |

**Prerequisites:** None. Node 18+.
**Estimated effort:** About 1–2 sessions across 3 phases.

## Open Risks & Assumptions

- "Before archive" is read as "when the run ends"; `/10x-archive` cannot be changed.
- The Agent result's usage summary is not a documented contract. Figures may be missing or change shape; the report then falls back to model and effort only.
- Figures depend on the orchestrator copying them; nothing in the router can check them.
- Retried steps appear as separate rows, so totals include failed attempts.

## Success Criteria (Summary)

- A finished run and a halted run both leave a `report.md` with one row per step.
- Mixed or missing usage shows `-` and a correct `K of N` totals line.
- `SKILL.md`, `README.md` and `route.mjs` describe the same report; `policy.json` and the manifests are unchanged.
