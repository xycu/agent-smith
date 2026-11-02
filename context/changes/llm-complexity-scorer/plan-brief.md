# LLM Complexity Scorer — Plan Brief

> Full plan: `context/changes/llm-complexity-scorer/plan.md`
> Decision record: `docs/ADR/ADR-007-llm-complexity-scorer-as-a-routed-step.md`
> Plan review: `context/changes/llm-complexity-scorer/reviews/plan-review.md` (third review, 2026-11-02, SOUND; it replaced the second review (REVISE), whose six warnings and three observations were resolved earlier, decisions in `research.md` Follow-up 1)

## What & Why

The router picks model and effort from cheap signals (phase count, goal text, failures, churn). It cannot see how hard a change really is. We add a `score` step: a cheap-model subagent reads the change and writes `complexity.json` (six factors 0 to 3, evidence, unknowns, confidence). The router validates the file, copies the scores into its log and shifts the `plan` tier up, or the `implement` tier up or down, by at most one rung. The goal is FR-011 and the usage-drop target (PRD), without any LLM call inside `route.mjs`.

## Starting Point

`decide()` returns pre-plan steps through `preplanNext()` and then `plan`. A step is accepted by a file it wrote, newer than the step start. `tierFor()` computes the tier and applies the effort floor last, for interactive steps only (ADR-003). Failed steps raise rigor and count against the budget; any subagent can raise rigor through `signals.rigor`. Churn risk is measured only once `plan.md` exists. The budget is 10, 16 and 21 steps with the longest paths at 14 and 19.

## Desired End State

At `standard` and `thorough`, a run starts with `score`. `complexity.json` sits in the change folder, its scores sit in `run.jsonl`, and `status` and `report.md` show the step, its tokens, the score summary and each shift that took effect. A broken scorer costs up to three cheap attempts, which use no step budget, and is then skipped with a logged reason. `compare --unpinned` can measure the scorer on against off, with tokens per model and per tier.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Where the LLM runs | `score` subagent step scheduled by the router | Keeps the router a script (ADR-006, AGENTS.md) | ADR-007 |
| Schema and scale | six factors, 0 to 3, evidence, unknowns, confidence | Already fixed by the ADR | ADR-007 |
| Budget | step outside the extra-step pool, deltas +3 and +8 | The pool pays for executors; the scorer is uncalibrated | Plan |
| Failed score attempts | use no step budget; capped at 3 | 3 failures plus the longest path would end in a budget halt, and the score only advises | First review |
| Default gate | `score.minRigor` ships `null`; Phase 4 sets `standard` with the new deltas | No commit runs the step against the old budget | Research F9 |
| Tier of the step | haiku low, one retry rung to sonnet low | Cheap, with a better model for a retry | Plan |
| What moves | cognitive sum moves `plan` up only; execution sum moves `implement` up or down | Risk is never measured before the first plan, and a hard-keyword plan keeps its base tier on purpose | Research F2, F3 |
| Thresholds | up at 7 or more, down at 2 or less (of 9), uncalibrated | Start narrow; failure escalation corrects | Plan |
| Down-shift guards | confidence medium+, at most 2 unknowns, churn risk measured with no hot path, no failure, no simple discount, no phase-count bump | The score sits next to the deterministic signals, not above them | Research F2, F3 |
| Effort floor scope | bounds the shift on interactive steps (ADR-003); ADR-007 rule line amended; owner confirms before Phase 3 | Floor on every step would remove the `implement` down shift; fallback is `implement.down: null` | Research F1 |
| `signals.rigor` from the scorer | dropped in `cleanSignals`; prompt also forbids it | The shared suffix invites the key; the score must not raise the run | Research F5 |
| Reported shift | effective value only; absorbed shifts read "not applied" | The report must not claim a shift the floor or clamp ate | First review |
| Shift source | the scores copied into the log, never the live file | A later edit of `complexity.json` cannot change tiers or the report | First review |
| Retries | same-template retries keep the up shift; re-plans and `implement-retry` get none | Bounded by `maxTier`; any failure already blocks a down shift | First review |
| Scorer failure | skip after 3 failed or 2 invalid attempts; entries are neutral | The score only advises; no halt, no rigor rise | ADR-007 / Plan |
| Existing tests | `makeProject` and a new `writeOverride` default `score` off | Keeps old tests on `plan` first after the default flips | First review |
| A/B tooling | `compare --unpinned` (boolean, checked like `--archive`), `tokens.byTier` | `compare` demands a sonnet/high baseline; `byModel` cannot show an effort move | Research F4, F7 |
| A/B rule | keep only if, over 5+ comparable pairs, median `dropPercent` > 0, median opus-token difference <= 0, and median drop > the A/A pair's spread; else off | ADR-007 puts the burden of proof on the scorer; inconclusive means off | Research F4 |

## Scope

**In scope:** policy block, prompt, validator, scheduling, skip and retry, budget-neutral failures, `signals.rigor` filter, shared measured-risk helper, tier shift from the log, report section, budget deltas and tests, default flip, baseline override, `compare --unpinned`, `byTier` and the `inputFiles` filter, docs, ADR notes.

**Out of scope:** reassessment, risk scoring, per-phase scoring, judging evidence or the freshness of a file that was already there, rigor changes from the score, a `plan` down shift, a floor for non-interactive steps, threshold calibration, an effort-weighted A/B measure, running the live A/B in code.

## Architecture / Approach

`scoreNext()` mirrors `preplanNext()` and runs after it. `attachResult()` verifies `complexity.json` through `readComplexity()` and copies the scores into the entry. `tierFor()` adds a bounded shift before `settle()` and records its effective value, so floors and limits hold and the report stays honest. A down shift reuses the lean skip's measured-risk test, moved into `riskMeasured()`. Failed `score` entries are `advisory`: neutral for rigor, discount and budget. Everything numeric lives in `policy.json` under `score`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Policy data, prompt, test hygiene | `score` policy (off), `prompts/score.md`, helper default | Hiding the default from old tests masks regressions |
| 2. Schedule, verify, fail safely | Step runs when opted in, validates, logs scores, retries, skips; `signals.rigor` dropped | Failed score entries must not touch rigor or budget |
| 3. Use scores in tier and report | `riskMeasured`, shift from the log, effective value, report section, status | Down guards need git fixtures; owner confirms the floor reading first |
| 4. Budget, baseline, compare | New deltas and default on together, baseline off, `--unpinned`, `byTier` | Budget walker rewrite; literal budget tests |
| 5. Docs, ADR, A/B | Docs aligned, ADR rule line amended, decisions recorded, 5 pairs plus one A/A pair | Live runs needed (human); 5 pairs is a screen, not a test |

**Prerequisites:** S-03 and S-10 are done and merged; ADR-007 accepted.
**Estimated effort:** about 5 sessions across 5 phases, plus 12 live runs for the A/B check.

## Open Risks & Assumptions

- Decided without a human (unattended): all rows marked Plan, First review or Research. Each is a policy value or a small router rule and can be changed without redesign.
- The effort-floor reading (interactive steps only) rests on ADR-003, README and SKILL.md; the owner has not confirmed it. The Phase 3 pause asks; the fallback is one policy value.
- The `implement` down shift acts only on plans of 2 phases (or 1 phase over 6 rows) that name no hot path. In this repository most plans name `route.mjs` or `policy.json`, which are hot, so the A/B check will mostly measure scorer cost and the up shift.
- Failed score attempts not counting against the budget departs from a literal reading of "the step counts against the step budget"; the successful step still counts.
- Thresholds and the haiku-low tier are uncalibrated; one A/A pair gives a crude spread estimate, and inconclusive turns the scorer off.
- Whether a haiku subagent can inspect the repo well enough for honest coupling and discovery scores is untested.
- No live run exists of the new step; Phase 5 Manual rows cover it.

## Success Criteria (Summary)

- A standard run writes a valid `complexity.json`; the `plan` tier moves up by at most one rung and the `implement` tier by at most one rung either way.
- A failing scorer never halts a run, never raises rigor and never spends step budget, and a scorer's `signals.rigor` is ignored.
- The suite passes and the budget test proves a failed step and its retry still fit at each level, with the scorer on and with three failed scorer attempts.
