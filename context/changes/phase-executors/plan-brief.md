# phase-executors — Plan Brief

> Full plan: `context/changes/phase-executors/plan.md`
> Research: `context/changes/phase-executors/research.md`
> Revised 2026-10-31 after plan review v1 (REVISE); see "Review Response" in the plan.

## What & Why

The pipeline runs every plan through one `/10x-goal-implement` call, accepts any rise in the `[x]` count as proof, ignores a REJECTED review's need for a new plan, and leaves Manual rows to a human. This change lets each phase run on the executor that fits it, verifies tdd and e2e work by a real code commit, re-opens rows that were ticked without one, re-plans once when implementation keeps failing, and adds a step that ticks the command-checkable Manual rows it can prove, with an evidence file the router checks (roadmap S-08, FR-001, FR-003, FR-007).

## Starting Point

`decide()` returns one `implement` step with one prompt and enters it only while an Automated row is pending. `attachResult` verifies it by the Automated `[x]` count only, so a tdd or e2e "Skip" passes, and if the Skip ticked every row the next step is `impl-review`. `readPlan` keeps no phase list. A third implement attempt runs after two failures; REJECTED goes straight to `fix`.

## Desired End State

`implement` picks plain, segment, e2e, tdd or retry templates per phase. tdd, e2e and retry steps are `ok` only with a code commit in `before.head..HEAD`; a blocked executor falls back to goal-implement with no penalty. Rows ticked without a commit are re-opened by an `implement-retry` step. One extra-step pool per rigor level meters every non-plain implement step, `manual-verify` and the REJECTED re-plan; `lean` has none, so `lean` is unchanged. Two trailing failures, or a REJECTED before any `fix`, trigger one shared re-plan. At `standard` and above `manual-verify` ticks only command-checkable rows, each with a checked evidence file. `rigor.budgetDelta` is standard 2, thorough 7, from a proved longest path.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Step shape | Keep step `implement`, vary the template | Eight sites compare the literal name; templates touch none | Research |
| Extra-step pool | Allowance lean 0, standard 2, thorough 3; segment, e2e, tdd, manual-verify cost 1, REJECTED re-plan 2 | One cap keeps the sum of features inside the budget; replaces `maxSegments` | Review F5 |
| tdd / e2e gate | e2e: setup + row keywords; tdd: `thorough` plus a pure-logic predicate; both need pool allowance | Conservative; `lean` gets no executor steps | Plan |
| Commit check | Strict for tdd, e2e and retry: a commit touching a path outside the change folder; goal-implement keeps the count rule | Zero-diff goal-implement phases are legitimate | Research, F4 |
| Uncommitted ticks | Record `uncommitted` ids; `decide()` returns `implement-retry` while they stay ticked | A full-phase Skip flip must not reach impl-review as done | Review F2 |
| Fallback | `blocked` without `needsHuman` is a neutral entry (`fallback: true`), set inside the cases | No tier bump, no rigor rise; keeps the `attachResult` tail untouched for S-10 | Research, F8 |
| Re-plan | Exactly 2 trailing failures, or REJECTED before any `fix` (costs a fix loop and pool 2); shared cap 1; `standard`+ | `route.test.mjs:386-400` and the reference paths stay valid | Review F1 |
| manual-verify | From `standard`, once; only backticked-command rows (or browser rows with `--chrome`); evidence file existence and containment checked; failure neutral | Stops the step certifying human-judgment rows | Review F3 |
| `--chrome` | `init` flag in `meta.json` with value validation, selects a chrome prompt | Orchestrator cannot probe tools; Chrome use is a Manual row | Plan, F10 |
| Budget | `budgetDelta` standard 2, thorough 7 (rise +2 and +3) | Smallest values that fit the longest legal path (14 and 19) with one failed step to spare | Review F5 |
| Baseline arm | Not pinned; README note | `compare.test.mjs` pins the baseline file keys | Review F9 |

## Scope

**In scope:** executor routing, segments and retry, commit verification, neutral fallback, code re-plans, `manual-verify` with `--chrome`, extra-step pool, budget deltas, report label and `compare` failed count, ADR-003, `SKILL.md`, README, AGENTS.md, prompts.

**Out of scope:** `cleanSignals`, `cleanUsage`, `prompts.suffix`, the rest of `buildReport` (S-10), a commit check for plain goal-implement, evidence content checks, a new ADR, `baseline-policy.json`, `loops-existing.test.mjs`, `compare.test.mjs`, `helpers.mjs`, archive files, hand edits of `run.jsonl`/`meta.json`. Each "untouched" claim has a diff gate against `git merge-base main HEAD`.

## Architecture / Approach

New logic sits in one section after `replanNext`. Touch points inside existing functions: the implement branch, `struggled`, the REJECTED block and fix-loop count, one `manual-verify` call in the `!irFresh` branch, one conditional key in the `done` return, and new case bodies in `attachResult`. New policy keys are new groups after `prompts` plus appended entries and two `budgetDelta` values. Counters derive from the log by template name; a non-positive knob turns a feature off. All tests are new files that drive the real router through the CLI, except one block in `loops.test.mjs` (lines 30-34) that the REJECTED change intentionally edits.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Commit verification and neutral fallback | `phaseList`, `isFailure`, `commitEvidence`, fallback flag, `uncommitted`, log keys | Changing failure counters must not alter old runs |
| 2. Phase list routing with e2e, segments and retry | Executor pick, pool, segments, e2e and retry prompts | Prompt cannot enforce "one phase"; Manual run needed |
| 3. tdd at thorough | Pure-logic predicate, tdd prompt | Predicate is uncalibrated and conservative |
| 4. Re-plan after failures or REJECTED | `plan-replan`, `plan-rejected`, the one test edit | Changes a tested behavior (REJECTED) |
| 5. manual-verify and `--chrome` | New step, eligibility, evidence check, flag, prompts | Chrome in a subagent is untested |
| 6. Budget, report label, docs, gates | Proved deltas, ADR-003, SKILL, README, AGENTS, scope gates | Word lists and budget are uncalibrated |

**Prerequisites:** `rigor-levels`, `pre-plan-steps` and `archive-adapter` merged (they are on main). Node 18+.
**Estimated effort:** about 6 implement runs, one per phase, plus Manual checks.

## Open Risks & Assumptions

- Assumptions 1-14 in `plan.md` carry reversal costs; the ones to watch are 3 (evidence content is not read), 4 (a goal-implement no-op can pass until impl-review; a retry that finds nothing halts after three attempts), 8-9 (pool sizes and the budget deltas) and 14 (the baseline arm runs the new defaults).
- Chrome use in a subagent, unattended tdd, unattended e2e and a goal-implement segment that stops after its phase were never run; each has a Manual row.
- Predicates and word lists (row words, command, human and browser words) are uncalibrated; a wrong pick costs one neutral step.

## Success Criteria (Summary)

- A tdd or e2e Skip flip no longer counts as done, even when it ticks every row; a redirect never raises tier or rigor.
- A mixed plan runs on the right executors within the pool and the budget; `lean` keeps today's paths and budget.
- Repeated failure and a first-review REJECTED re-plan once, then behave as today.
- Manual rows that a command or the browser can prove are ticked with a checked evidence file; the rest stay pending.
- Frozen tests and files are byte-identical to `main`; `loops.test.mjs` differs in one hunk.
- `node --test skills/10x-pipeline/test/*.test.mjs` passes.
