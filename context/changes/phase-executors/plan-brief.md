# phase-executors — Plan Brief

> Full plan: `context/changes/phase-executors/plan.md`
> Research: `context/changes/phase-executors/research.md`

## What & Why

The pipeline runs every plan through one `/10x-goal-implement` call, accepts any rise in the `[x]` count as proof, ignores a REJECTED review's need for a new plan, and leaves Manual rows to a human. This change lets each phase run on the executor that fits it, verifies tdd and e2e work by a real commit, re-plans once when implementation keeps failing, and adds a step that ticks the Manual rows it can prove, with evidence (roadmap S-08, FR-001, FR-003, FR-007).

## Starting Point

`decide()` returns one `implement` step with one prompt. `attachResult` verifies it by the Automated `[x]` count only, so a tdd or e2e "Skip" passes. `readPlan` keeps no phase list. A third implement attempt runs after two failures; REJECTED goes straight to `fix`.

## Desired End State

`implement` picks plain, segment, e2e or tdd templates per phase. tdd and e2e steps are `ok` only with a new commit or a valid SHA suffix; a blocked one falls back to goal-implement with no penalty. Two trailing failures or the first REJECTED trigger one shared re-plan. At `standard` and above a `manual-verify` step runs before the first impl-review pass and ticks proven Manual rows with ` — evidence: ...`. `rigor.budgetDelta` is set from a proved longest path.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Step shape | Keep step `implement`, vary the template | Eight sites compare the literal name; templates touch none | Research |
| Executor cap | At most 2 non-plain implement steps per run, rest in one plain call | Bounds the longest path and the budget | Plan |
| tdd / e2e gate | e2e: setup + row keywords, no rigor gate; tdd: `thorough` plus a pure-logic predicate | Owner defaults 6; tdd is conservative | Plan |
| Commit check | Strict for tdd/e2e only; goal-implement keeps the count rule | Zero-diff goal-implement phases are legitimate | Research |
| Fallback | `blocked` without `needsHuman` is a neutral entry (`fallback: true`) | No tier bump, no rigor rise, no repeat of that executor for the phase | Research |
| Re-plan | Exactly 2 trailing failures or first REJECTED, shared cap 1, failed re-plan halts | `route.test.mjs:386-400` needs equality, not `>=` | Research |
| manual-verify | From `standard`, once, zero ticks is `done`, evidence suffix required | Protects the lean budget; no false failure | Plan |
| `--chrome` | `init` flag in `meta.json`, selects a chrome prompt | Orchestrator cannot probe tools; Chrome use is a Manual row | Plan |
| Budget | `budgetDelta` standard 7, thorough 11, proved by a test | Smallest values that fit the stacked longest path with one failure to spare | Plan |

## Scope

**In scope:** executor routing and segments, commit verification, neutral fallback, code re-plans, `manual-verify` with `--chrome`, budget deltas, ADR-003, `SKILL.md`, README, AGENTS.md, prompts.

**Out of scope:** `cleanSignals`, `prompts.suffix`, `buildReport` (S-10), a commit check for goal-implement, router checks of evidence files, a new ADR, archive files, hand edits of `run.jsonl`/`meta.json`.

## Architecture / Approach

New logic sits in one section after `replanNext` (selection, predicates, re-plan, manual-verify placement); `decide()` gets three call sites. New policy keys are new groups after `prompts` plus appended entries. Counters derive from the log by template name; a non-positive knob turns a feature off. All tests are new files that drive the real router through the CLI.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Commit verification and neutral fallback | `phaseList`, `isFailure`, strict check, fallback flag, log keys | Changing failure counters must not alter old runs |
| 2. Phase list routing with e2e and segments | Executor pick, segments, e2e prompt | Prompt cannot enforce "one phase"; Manual run needed |
| 3. tdd at thorough | Pure-logic predicate, tdd prompt | Predicate is uncalibrated and conservative |
| 4. Re-plan after failures or REJECTED | `plan-replan`, `plan-rejected`, edited test and bullet | Changes a tested behavior (REJECTED) |
| 5. manual-verify and `--chrome` | New step, evidence check, flag, prompts | Chrome in a subagent is untested |
| 6. Budget and docs | Proved deltas, ADR-003, SKILL, README, AGENTS | Budget ceiling is large (21 and 25) |

**Prerequisites:** `rigor-levels`, `pre-plan-steps` and `archive-adapter` merged (they are on main). Node 18+.
**Estimated effort:** about 6 implement runs, one per phase, plus four Manual checks.

## Open Risks & Assumptions

- Assumptions 1-11 in `plan.md` carry reversal costs; the ones to watch are 3 (evidence not checked by the router), 4 (a goal-implement no-op can pass until impl-review) and 8 (ceilings of 21 and 25 steps).
- Chrome use in a subagent, unattended tdd and unattended e2e were never run; each has a Manual row.
- Predicates and word lists are uncalibrated; a wrong pick costs one fallback step.

## Success Criteria (Summary)

- A tdd or e2e Skip flip no longer counts as done; a redirect never raises tier or rigor.
- A mixed plan runs on the right executors within a bounded number of steps.
- Repeated failure and REJECTED re-plan once, then behave as today.
- Manual rows that a command or the browser can prove are ticked with evidence; the rest stay pending.
- `node --test skills/10x-pipeline/test/*.test.mjs` passes.
