# ADR-007: Score change complexity in a cheap-model step the router schedules, and keep the router a script

- **Status:** Accepted (2026-10-31, repository owner)
- **Date:** 2026-10-31
- **Deciders:** repository owner
- **Supersedes in part:** the Phase 2 deferral of `docs/ADR/ADR-001-phased-complexity-routing.md`
- **Origin:** roadmap slice S-11 (`context/foundation/roadmap.md`) and PRD FR-011 (`context/foundation/prd.md`). On 2026-10-31 the owner moved FR-011 from nice-to-have to must-have and into milestone M-1, and chose a cheap-model LLM step. The change folder for S-11 does not exist yet.

## Context

- ADR-001 deferred LLM-scored complexity to a Phase 2 that was to be built only if the Phase 1 measurements showed the deterministic signals were not enough. The owner has now pulled it into this delivery without waiting for those measurements.
- `route.mjs` is a dependency-free Node script that uses only `node:` built-ins and makes no network call (ADR-006, `AGENTS.md` Hard Rules). Its decisions are deterministic, and the test suite drives it through the CLI in scratch projects.
- Each pipeline step runs in its own subagent, and the orchestrator in `SKILL.md` only loops over router output (PRD FR-007).
- A step is accepted by a file the subagent wrote: the file must exist and be newer than the step start. The `research`, `frame` and `domain-brief` steps already work this way (README, "Pre-plan steps").
- Subagents cannot ask the user questions. A subagent with no evidence-backed answer reports `blocked` with `signals.needsHuman`.
- The router's own cost counts toward the A/B comparison (PRD Guardrails). The `compare` command sums the tokens of every executed step, so a scoring step is counted automatically.
- The owner's answer to PRD Open Question 6 was "a cheap-model LLM step". It did not say whether the router itself or a step that the router schedules.

## Decision

The scorer is a pipeline step named `score`, run by the orchestrator in its own subagent on a cheap model. `route.mjs` schedules it, checks the file it writes, and reads the numbers from that file. The router stays a script and makes no LLM call.

Rules, written as scenarios (the form of ADR-004):

**GIVEN** a run whose rigor level is at or above `score.minRigor` in `policy.json` and no scoring file exists **WHEN** the router decides the step before the first `plan` **THEN** it **MUST** return the `score` step on the tier that `steps.score` pins in the policy.

**GIVEN** a run below `score.minRigor` (the default is `standard`, so a `lean` run) **WHEN** the router reaches the same point **THEN** it **MUST NOT** run `score`.

**GIVEN** a `score` step that the router skipped **WHEN** it logs the decision **THEN** the log entry **MUST** carry the reason in `run.jsonl`, `status` and `report.md`.

**GIVEN** a `score` step **WHEN** the subagent finishes **THEN** it **MUST** have written `context/changes/<change-id>/complexity.json`, newer than the step start, with the schema below.

**GIVEN** a `score` step that wrote `complexity.json` **WHEN** the router verifies the step **THEN** it **MUST** accept the step only if that file passes the checks in the next rule.

**GIVEN** `complexity.json` **WHEN** the router validates it **THEN** every factor **MUST** have an integer score from 0 to 3 and a non-empty `evidence` string, `unknowns` must be an array, and `confidence` must be `low`, `medium` or `high`.

**GIVEN** a `complexity.json` that passes those checks **WHEN** the router reads its evidence **THEN** it **MUST NOT** judge whether the evidence is true.

**GIVEN** a valid `complexity.json` **WHEN** the router chooses the tier of a later step **THEN** it **MAY** shift the tier of `plan` and `implement` by at most one rung up or down, using thresholds under `score` in `policy.json`.

**GIVEN** a tier shift from the score **WHEN** the router applies it **THEN** the shift **MUST NOT** take an interactive step below the effort floor in `rigor.minEffort` (ADR-003), override the churn risk axis or lower the rigor level.

Amended 2026-11-02 (S-11 plan, default reading taken in an unattended run; the owner has not confirmed it yet). The rule first named `rigor.minEffort` with no scope. ADR-003 ("Effort floor") puts the floor on interactive steps only, and `route.mjs` applies it there (`settle` in `tierFor`). So the floor bounds a shift on `plan`, `implement-tdd` and `implement-e2e`. A down shift on plain `implement` or a goal segment can reach the step's `minTier`, as the simple-change discount already can. The S-11 plan asked the owner to confirm this reading at the pause before Phase 3; until the owner does, it is the plan's default. The other reading, a floor on every shifted step, would turn the `implement` down shift off (`score.shift.implement.down: null`). "Override the churn risk axis" is read as: a down shift needs measured churn risk with no hot path. See "S-11 decisions".

**GIVEN** a `score` step that fails three times, or a `complexity.json` that fails validation after the retry **WHEN** the router decides the next step **THEN** it **MUST** skip scoring with the reason logged and go on with the deterministic signals.

**GIVEN** a `score` step that failed **WHEN** the router has skipped scoring **THEN** it **MUST NOT** halt the run, because the score only advises.

**GIVEN** a `score` result that carries `signals.needsHuman` **WHEN** the router reads it **THEN** it **MUST** halt the run once with a report, as for any other step.

**GIVEN** a change to the router that makes a network or LLM call, or adds an npm dependency **WHEN** it is proposed **THEN** it **MUST** be rejected under ADR-006 unless a later ADR supersedes this one.

### File schema

```json
{
  "schemaVersion": 1,
  "factors": {
    "ambiguity": { "score": 0, "evidence": "..." },
    "novelty": { "score": 0, "evidence": "..." },
    "coupling": { "score": 0, "evidence": "..." },
    "discovery": { "score": 0, "evidence": "..." },
    "volume": { "score": 0, "evidence": "..." },
    "verification": { "score": 0, "evidence": "..." }
  },
  "unknowns": ["..."],
  "confidence": "medium"
}
```

The six factors are the ones ADR-001 sketched: cognitive complexity (ambiguity, novelty, coupling) and execution complexity (discovery, volume, verification), each 0 to 3. The router sums the cognitive three and the execution three. Factor names and the thresholds that turn the two sums into a tier shift live in `policy.json` and are uncalibrated. Risk is not scored here: the churn axis from `risk` in `policy.json` stays the only risk input.

### When it runs and what it reads

- The step runs once per run, before the first `plan`, after any `research`, `domain-brief` or `frame` step. It reads `change.md`, the goal, and the upstream artifacts that exist (`research.md`, `frame.md`, a brief). It does not read the plan, because the plan runs on the tier that the score helps choose.
- There is no reassessment in this ADR. Reassessing on a new dependency, a scope change or a repeated failure is left out until measurements justify it.
- The step counts against the step budget. Whether it also draws from the extra-step pool (`extraSteps.allowance`) is decided in the S-11 plan, and the budget test that walks the longest legal path **MUST** be extended so a failure and its retry still fit at each rigor level.

### Why a step and not code in the router

The router must stay deterministic and testable, and its hard rules keep it free of network and LLM calls. A scoring step keeps the model call where every other model call already lives: in a subagent with its own tier, usage figure and report row. The router only validates a file and applies thresholds, which the existing suite can test with fixtures.

## Consequences

- `AGENTS.md` Hard Rules need no change, because the router still makes no LLM call. `SKILL.md` and `README.md` need a `score` step and a new row in the routing description. The README sentence that the router "is a script with no LLM" stays true and gains a pointer to this step. Per `AGENTS.md`, a change to `tierFor` or `decide` also updates the "How the tier moves" list in `SKILL.md` and the routing bullets in `README.md`.
- ADR-001 needs a status note that its Phase 2 is pulled forward by this ADR. Its caution still holds: the thresholds are untested heuristics.
- The owner's wording "the router becomes an LLM step" is read here as "an LLM step the router schedules". If the owner wants the router process itself to call a model, this ADR is wrong and ADR-006 must be superseded first.
- The scorer adds tokens to every run at `standard` and above. Those tokens appear in `compare`. The S-11 plan **MUST** include an A/B check with the scorer on and off over at least 5 comparable pairs. If the scorer does not save more than it costs, `score.minRigor` is set to `null` in the policy and the step turns off, with no router change.
- `lean` runs never pay for the scorer, so the cheapest path is unchanged. The cost is that the simplest changes get no score.
- Scores come from one model's judgment and give false precision, as ADR-001 said. The evidence field is a text claim the router cannot verify. Treat the shift as a hint and keep failure escalation as the correction.
- A subagent may fail to produce valid JSON. The skip-on-failure rule means a broken scorer costs up to three attempts, then no change in behavior.
- `complexity.json` becomes part of the change folder and is archived with it. It is not part of the stable surface for installers (PRD Constraints) until a run has shown the schema is right, so `schemaVersion` may change.

## Alternatives considered

| Alternative | Verdict | Reason |
| --- | --- | --- |
| Call a model from inside `route.mjs` | rejected | Breaks ADR-006 and the `AGENTS.md` hard rule of no network call, makes the router nondeterministic, and the suite could not test it without a live model. |
| Make the router itself an LLM agent | rejected | Every routing decision would cost tokens, and today's decisions are free. It would also replace the tested script with an unpredictable one. |
| The orchestrator scores in its own session | rejected | The orchestrator runs on the user's session model, its tokens are not counted by `compare`, and it breaks FR-007 (one subagent per step). |
| Fold scoring into the `plan` step | rejected | The plan tier would depend on a score that the plan step itself produces. |
| Score after the plan, from `plan.md` | not adopted | A richer input, but the plan has already run at an unscored tier, so the saving on the most expensive step is lost. Reconsider with reassessment. |
| Keep Phase 1 signals only (ADR-001 as written) | rejected | Contradicts the owner's decision of 2026-10-31 to build FR-011 in M-1. |
| Score at every rigor level | not adopted | A scorer that costs tokens on a `lean` change works against the usage goal. `score.minRigor` can lower this later. |

## S-11 decisions

Change `llm-complexity-scorer` (roadmap S-11) built this ADR. Plan: `context/changes/llm-complexity-scorer/plan.md` ("Decisions taken without a human"); research: `context/changes/llm-complexity-scorer/research.md`. The code is `readComplexity`, `scoreNext`, `scoreSummary`, `scoreShift`, `riskMeasured` and `tierFor` in `route.mjs`; the data is the `score` block and `steps.score` in `policy.json`; the prompt is `prompts/score.md`. Every threshold is uncalibrated.

- Gate and tier. `score.minRigor` ships `standard`, so `standard` and `thorough` runs score and `lean` runs do not. `null` turns the step off. `steps.score` pins the lowest ladder rung (`baseTier` 0, `maxTier` 1), so a retry runs one rung up. The step runs after any pre-plan step and only while no `plan` attempt is logged, so a run that starts with a `plan.md` that has `## Progress` gets no score and no skip entry.
- Outside the pool. The step does not draw from `extraSteps.allowance`, because the pool pays for executors that earn savings and an uncalibrated scorer must not starve them. It counts in the step budget, and `rigor.budgetDelta` rises by 1 at `standard` (+3) and `thorough` (+8). The budgets are 10, 17 and 22. The longest failure-free paths are 15 and 20, two steps under the budget.
- Failed attempts use no budget. A `score` entry is `advisory`: when it fails it uses no step budget, raises no rigor and withholds no simple-change discount, but it still bumps its own retry tier. The successful attempt counts. Counting three failures would turn the longest path into a budget halt, and a failed scorer never halts the run. The step skips after 3 failed attempts (`score.maxAttempts`, capped by `escalation.maxAttemptsPerStep`) or 2 invalid files (`score.maxInvalid`). `compare` still counts failed `score` attempts in `failedAttempts`, because they cost tokens.
- `signals.rigor` dropped. `cleanSignals` drops `rigor` from a `score` result and keeps `needsHuman`. `prompts/score.md` also forbids the key and wins over the generic suffix, which invites it. The score only advises, so it never moves the rigor level.
- Effort floor on interactive steps. See the dated note under the floor rule above.
- Churn risk axis. A down shift needs measured churn risk with no hot plan or diff path. "Measured" is the test of the `lean` plan-review skip, moved into `riskMeasured(risk)` so the two cannot drift: history readable, the plan names at least one path and every named path is classified. Up shifts have no guards.
- `plan` up only. `score.shift.plan.down` is `null`. Churn risk is never measured before the first plan, and a hard-keyword goal keeps the plan's base tier on purpose. A cognitive sum of 7 or more moves the first plan (template `plan`) up one rung.
- `implement` down guards. An execution sum of 7 or more moves `implement` up one rung. A sum of 2 or less moves it down one rung only when every guard holds: confidence `medium` or `high`, at most 2 unknowns, measured risk with no hot path, no failed step, no simple-change discount and no phase-count bump on the step. So the down shift acts only on a plan of 2 phases, or of 1 phase with more than 6 rows. The shift covers the templates `implement`, `implement-segment`, `implement-tdd` and `implement-e2e`; `plan-revise`, `plan-replan`, `plan-rejected`, `implement-retry` and every other step get none.
- Effective shift. The shift goes into `tierFor` before the clamp and the floor. The log entry records `scoreShift: { sum, value, shift, effective }`, where `effective` is the final tier with the shift minus the final tier without it. `report.md` lists an absorbed shift as "not applied (clamp or floor)".
- Shift read from the log. The router copies the scores into the `score` run entry, or into the skip entry when a valid file was already there (trusted as-is). Every later tier and the report read that copy. A later edit, deletion or corruption of `complexity.json` changes neither.
- Measurement. `compare` adds `tokens.byTier`, keyed `<model>/<effort>`, because `byModel` cannot show an effort move. `compare --unpinned` waives only the `baseline-not-pinned` reason, adds the warning `baseline-unpinned` and gives the verdict `unpinned`. `complexity.json` is a produced file, so it is not in `inputFiles`. `baseline-policy.json` sets `score.minRigor` to `null`, so the pinned baseline arm never scores.

### A/B decision rule

Fixed before any run. Each pair is one change, with the scorer off as the baseline and the scorer on as the routed side, compared with `compare --unpinned`. The A/A pair has the scorer off on both arms. The arms alternate which runs first and run close in time. The scorer stays on only when all three hold over at least 5 comparable pairs:

1. The median `dropPercent` is above 0.
2. The median per-pair difference of opus tokens (on minus off, from `byModel`) is 0 or less, so a drop bought by moving work to the top model does not count.
3. The median `dropPercent` is above the absolute `dropPercent` of one A/A pair, so the drop is larger than run-to-run spread.

Any other outcome sets `score.minRigor` to `null` in `policy.json`, with no router change. That includes fewer than 5 comparable pairs, a missing A/A pair and a result inside the A/A spread (inconclusive). A pair that is not comparable is recorded with its reasons and does not count. Five pairs is the minimum of this ADR and a screen, not a significance test. The rule reads raw tokens and does not credit the `implement` effort move beyond the tokens it saves. The alternative "inconclusive keeps the scorer on at `standard`" was rejected, because it reverses the burden of proof in "Consequences".

### A/B result

Pending. A human runs the pairs and records here, per pair, `dropPercent`, `byModel` and `byTier` of both arms, and the reasons of every pair that is not comparable, then the keep or turn-off decision.
