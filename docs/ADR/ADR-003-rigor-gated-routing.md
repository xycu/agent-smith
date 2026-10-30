# ADR-003: Rigor-gated routing: a per-change rigor level decides optional steps, budget and effort floor

- **Status:** Proposed
- **Date:** 2026-10-30
- **Deciders:** repository owner
- **Origin:** research for `rigor-gated-routing`, split into four changes on 2026-10-30. Research and owner decisions: `context/changes/rigor-levels/research.md` (Follow-ups 1 to 3). Builds on ADR-001 (cheap deterministic signals first) and ADR-002 (change lifecycle, optional steps).

## Context

- ADR-002 makes every step except plan, one executor and archive optional. The router needs a rule for when an optional step runs. A fixed pipeline runs plan-review every time, even for a one-line change.
- ADR-001 prefers cheap deterministic signals over an LLM score. The goal text, the phase count, failed attempts and git history are such signals.
- The router has one step budget for every run, and a static effort floor per step. Interactive toolkit skills (plan, plan-review, impl-review) ask questions. Without a human, they need enough effort to decide from evidence.
- `meta.json` was rewritten as `{ id, goal }` on each `init`, so no state survived a resume.
- PRD FR-002 says plan-review is skipped "only on a clean rubric". No definition of a clean rubric exists. FR-010 asks for elevated risk from "configurable path rules".

## Decision

The work is split in four changes. This ADR is a skeleton: change 1 is written in full, changes 2 to 4 only listed.

| Part | Owning change | Status |
| --- | --- | --- |
| Rigor levels, churn risk, effort floor, skip entries, `signals` | `rigor-levels` (change 1) | implemented |
| Pre-plan steps (research, legacy research, domain brief, frame), RETHINK/REVISE loops, frame authority over `needsHuman` | `pre-plan-steps` (change 2) | planned |
| Per-phase executors, manual-row automation, tdd/e2e fallback, third-attempt re-plan | `phase-executors` (change 3) | planned |
| Archive adapter, `verify-archive`, lesson candidates, git write decision for `agent-smith/` | `archive-and-lessons` (change 4) | planned |

Design of changes 2 to 4 is in `context/changes/rigor-levels/research.md`. The git write decision of change 4 (the router committing `agent-smith/` before archive) is future work, not decided here.

### Rigor levels

Every run has one level: `lean`, `standard` or `thorough`. The router stores it in `meta.json` as `{ level, requested, by }` and keeps it on resume (`init` writes `{ ...prev, id, goal }`). The level only rises. It is the highest of:

- the start level: the `--rigor` value if given, else the goal class (`short` is `lean`, `plain` and `hard` are `standard`);
- the phase count: 3 or more phases is `standard`, 6 or more is `thorough` (`rigor.fromPhases`, aligned with `complexity.phaseThresholds`);
- failed steps: 1 is `standard`, 3 is `thorough` (`rigor.fromFailures`);
- churn: the number of hot paths the plan or the diff touches (`risk.raise`);
- a `signals.rigor` value in a step result.

`by` names the inputs behind the current level and changes only when the level rises.

### Churn risk

Elevated risk (FR-010) is a path that changes often in git history. The router counts commits per path with `git log --no-merges --relative --since=<since> -n <maxCommits>`, up to `meta.baseSha` (the commit the run started from, so the run's own commits do not make its files look hot). Excluded globs (`context/**`, `**/*.md`, lock files) are dropped. A path is hot when its count reaches the `hotPercentile` value (nearest rank) and `hotMinCommits`. With fewer than `minCommitsInWindow` commits in the window, the router repeats over all history. The parameters sit under `risk.churn` in `policy.json` and are uncalibrated: no run data exists yet.

The router reads the paths on the `**File**:` and `**Files**:` lines of `plan.md`, and after an implement or fix step the output of `git diff --name-only`. `risk.raise` maps the number of distinct hot paths touched to a level. Any git failure, a missing history or an unreachable `baseSha` gives source `unavailable` and flags nothing. The read-only command `route.mjs risk <change-id>` prints the numbers.

### Skip entries

A step the router decides not to run is a skip entry in `run.jsonl`: `{ skipped, step, reason, rigor, afterN, risk, at }`. It has no `n`, `template`, `ok` or `result`. Budget, numbering, failure streaks, freshness and report totals read executed entries only. `report.md` lists skips in a `## Skipped steps` section.

At `lean`, a fresh plan skips plan-review, but only when risk was measured (source `window` or `all-history`, and the plan names at least one path). Otherwise plan-review runs, so a risk that could not be measured is never read as "not hot". The skip is frozen once an implement or fix entry exists: a later rigor rise does not bring plan-review back over a half-built change. Implementation review is never skipped; at `lean` it only gets a lower tier.

### Step budget

The budget is `limits.maxTotalSteps` plus `rigor.budgetDelta` for the level (-4, 0, +4), at least 1. Skip entries use none.

### Effort floor

Interactive steps get a floor that depends on rigor, in effort names (`rigor.minEffort`, `rigor.effortOrder`) so it survives a custom ladder. The router converts the name to the lowest ladder index with at least that effort and applies it last, after the discounts and the `maxTier` clamp.

- **GIVEN** a toolkit skill built to run interactively **WHEN** the pipeline runs it with no human at rigor `standard` or `thorough` **THEN** the router **MUST** pick a tier with effort `high` or above.
- **GIVEN** a toolkit skill built to run interactively **WHEN** the pipeline runs it with no human at rigor `lean` **THEN** the router **MUST** pick a tier with effort `medium` or above.

The report marks a step as simple only when the simple-change discount survived the floor.

### Signals

A step result may carry an optional `signals` object. The router keeps two keys and drops the rest: `rigor` (a level, raises) and `needsHuman` (a short text, halts the run once with a report; the ack is stored on the log entry). Signals cannot lower rigor, remove a step or add a skip.

- **GIVEN** a skill question the subagent cannot ask **WHEN** the skill would ask it **THEN** the subagent **MUST** decide from researched best practice (codebase conventions, project docs, `lessons.md`, authoritative sources) and cite the evidence.
- **GIVEN** no evidence-backed call is possible **WHEN** the subagent would have to guess **THEN** it **MUST** report status `blocked` with `signals.needsHuman`.

Prompt rules follow ADR-004.

## Alternatives considered

| Alternative | Verdict | Reason |
| --- | --- | --- |
| Keep plan-review always on and let `lean` only lower its tier | rejected | The owner decided that `lean` skips it. Plan-review is the largest cost for a small change. |
| Derive rigor from `run.jsonl` on every call, store nothing | rejected | `init` would not need to keep state, but a requested level (`--rigor`) and the starting commit would be lost. |
| Score complexity with an LLM (FR-011) | deferred | ADR-001: only if deterministic signals prove too weak. No run data exists to say. |
| A halt for a human at the highest level (FR-010 tail) | deferred | The generic `signals.needsHuman` stop exists. A halt by level alone is not built. |

## Consequences

- **Bad**: plan-review at `standard` now runs at the high effort floor instead of a discounted medium tier. That is a deliberate cost increase (owner decision).
- **Bad**: the churn numbers are uncalibrated. Churn can miss a risky file that rarely changes and flag a harmless busy one. S-06 (baseline comparison) is where real runs can tune them.
- **Bad**: churn needs usable git history. A shallow clone or a brand-new repository reads as `unavailable`, and `lean` then still runs plan-review.
- **Bad**: a run in flight when the router is upgraded gets `baseSha` at the first `init` after the upgrade, so it is only partly measured.
- **Good**: a skip is visible in the log and the report with its reason, so a saving can be checked.
- **Good**: every rule in the prompts has one checked form (ADR-004).

## Sources

- `context/changes/rigor-levels/research.md` (Follow-ups 1 to 3), `context/changes/rigor-levels/plan.md`
- `context/foundation/prd.md` FR-002, FR-003, FR-010; `context/foundation/roadmap.md` S-03
- `docs/ADR/ADR-001-phased-complexity-routing.md`, `docs/ADR/ADR-002-change-lifecycle-ideation-to-archive.md`, `docs/ADR/ADR-004-prompt-rules-as-scenarios.md`
- Symbols: `resolveRigor`, `measureRisk`, `hotSet`, `tierFor`, `cleanSignals`, `decide` in `skills/10x-pipeline/scripts/route.mjs`
