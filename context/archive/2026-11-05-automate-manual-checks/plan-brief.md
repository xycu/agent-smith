# Verify Every Manual Row Automatically — Plan Brief

> Full plan: `context/changes/automate-manual-checks/plan.md`

## What & Why

The pipeline automates everything except the Manual rows of a plan, and those end as a checklist nobody works through (about 100 unticked rows across 13 archived changes). This plan hands every pending Manual row to a dedicated subagent with a clean context that proves it with the tools it has, Claude in Chrome included, and says why for each row it cannot prove.

## Starting Point

`manual-verify` exists but is narrow: it proves only rows that name an allow-listed backticked command (or a browser word with `--chrome`), runs at `standard` and above from the extra-step pool, and starts on `sonnet/high`. Every other row stays pending. `route.mjs` already checks evidence files and keeps a failed attempt neutral.

## Desired End State

At every rigor level, after the last Automated row and before the first implementation review, a `sonnet/medium` subagent proves each Manual row by a command, a green covering test, a throw-away script, the browser or a written judgment, and saves the proof under `evidence/`. Rows it cannot prove get one retry on `sonnet/high`; after that the run goes on to `done` and lists each unproved row with its reason. `report.md` shows which rows were run and which were judged.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Scope | Every pending Manual row, owner rows included | Owner decision 1 | Change |
| Unprovable rows | One retry a tier up, then `done` with reasons; no halt | Owner decision 2 | Change |
| First tier | `steps.manual-verify.baseTier` 2 (`sonnet/medium`), retry via a router bump | A neutral entry skips the failure bump, so the bump is explicit | Plan |
| Pool | Out of the pool; budget deltas +2 per level (`-2`, `5`, `10`) | The step plus one retry now sits on the longest path, so the budget stays honest | Plan |
| Rigor | Runs at `lean` too (`manualVerify.minRigor: "lean"`, `null` turns it off) | Owner starting point 2 | Change |
| Retry trigger | Also after an ok attempt that left rows pending | Owner decision 2 reads "cannot prove, one retry" | Plan |
| Timing | Once before the first impl-review, no re-run after the last `fix` | Keeps the budget bounded; fixes are scoped by review findings | Plan |
| Chrome | In the default template; `--chrome false` selects `manual-verify-nochrome`; absent reads on | Smallest change to `meta.chrome` and old runs | Plan |
| Evidence | Kind from the file-name prefix (`command-`, `test-`, `script-`, `browser-`, `judgment-`); router never reads content | Keeps the file-based check, lets the report group rows | Plan |
| Reasons | `evidence/unproven.md`, read for display only, copied into the log entry | Survives archive; no new `RESULT` signal | Plan |
| Test rig | `writeOverride` merges `manualVerify: { minRigor: null }` by default | Existing fixtures all carry a Manual row; same pattern as `score` | Plan |
| Safety | Prompt rules only; no router stray-write check | The router owns no content judgement; step commit and impl-review see the diff | Plan |

## Scope

**In scope:** eligibility, placement, tier, budget, Chrome default, evidence kinds, unproved reasons and their outputs, the prompt rewrite, docs and ADR-012.

**Out of scope:** re-proving after the last fix, content checks of evidence, stray-write detection, editing `context/archive/`, `baseline-policy.json`, `loops-existing.test.mjs`.

## Architecture / Approach

Routing stays in `route.mjs` and `policy.json`. `manualVerifyNext` loses its eligibility gate and pool check and returns a retry bump; `verifyManual` records the evidence kind and the reasons file; `doneNotes`, the report and `status` print them. The prompt carries the proof kinds, the throw-away script rule and the safety limits; two templates differ only in the Chrome rules.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Every row, every level, outside the pool | Eligibility, placement, tier 2 and retry bump, pool exit, budget deltas, test off-switch | Budget numbers and the walker fixture for the retry path |
| 2. Evidence kind and reasons | Kind and reason records, `manualNotProved`, report section, status | Ledger parsing edge cases |
| 3. Prompt and Chrome default | New rules, two templates, `chrome` semantics, provenance flag | Prompt rule form; old runs with a stored `chrome` value |
| 4. Docs and ADR-012 | README, SKILL.md, prompts README, AGENTS.md, ADR-012 | Docs drifting from policy numbers |

**Prerequisites:** the run worktree on `agent-smith/automate-manual-checks`; Node 24.
**Estimated effort:** about 4 sessions; `route.mjs` and 6 test files are touched, plus docs.

## Open Risks & Assumptions

- A1 to A8 are decided here without a human; see "Implementation Approach" in the plan.
- A subagent loading and calling the Chrome tools through ToolSearch is still untested; without them browser rows stay pending with a reason.
- Judgments are weaker proof than runs; the report labels each tick by kind so the owner can tell.
- `lean` runs gain a step and Chrome is on by default; `feat` or `feat!` is the owner's call at commit time.

## Success Criteria (Summary)

- A run ends with every Manual row either ticked with evidence or listed with a reason, at any rigor level.
- The budget test pins the new longest paths and the full suite passes with `loops-existing.test.mjs` untouched.
