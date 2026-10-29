# Cheaper Routing for a Simple Change Implementation Plan

## Overview

Make the router give a simple change a cheaper model and effort than it gets today, using only signals the script reads from `plan.md` and the run log. A change is simple when its plan has at most 1 phase and at most 6 Progress rows, or when the first plan is started with `--size s`. A simple change takes -1 tier on `plan`, `plan-review`, `implement` and `impl-review`. The thresholds, discounts and floors live in `policy.json`, and each run-log entry and `status` shows whether the discount applied.

## Current State Analysis

`tierFor` (`skills/10x-pipeline/scripts/route.mjs:259`) only adds complexity. `complexity.phaseThresholds: [3, 6]` gives +1 tier at 3 and 6 phases, and nothing lowers the tier for a small plan. The downward moves are `--size s` (-1, first plan only, via `meta.sizeBump`) and a clean `SOUND` plan review (-1, implement only).

The floors in `policy.json` cap any saving: `plan-review`, `implement` and `impl-review` have `minTier: 2` (sonnet/medium), and `plan` has base tier 4 (opus/high) with `minTier: 3`. A plan step on opus/high costs more than the PRD baseline (full run on Sonnet-5.5 at high effort).

`readPlan` (`route.mjs:61`) already parses `## Progress` and returns phase count and Automated row counts. It does not return a total row count, and the `plan` step runs before any plan exists, so only `meta.size` is available for it.

### Key Discoveries:

- `tierFor` receives `d`, `log`, `policy`, `plan` but not `meta` (`route.mjs:259`, call at `route.mjs:305`). `meta.size` is saved by `init` (`route.mjs:368-373`).
- `d.bump` carries `meta.sizeBump` only on the first plan (`route.mjs:185`); `plan-revise` gets no size bump. The simple discount for `plan` must follow the same rule.
- `attachResult` sets `ok` on the last log entry before `decide` runs (`route.mjs:129-152`), so a "no failed step" check sees the latest result.
- The final tier is clamped to `minTier`/`maxTier` per step (`route.mjs:275`). A new floor is needed for any discount to reach below today's floor.
- Policy overrides deep-merge over `policy.json` (`route.mjs:35`, `route.mjs:48`), so a project can set `discount` values to 0 to turn the feature off.
- No automated tests exist. Verification is `init`, `next` and `status` against a scratch change folder (`AGENTS.md`).

## Desired End State

Running the router on a change whose plan has 1 phase and 3 Progress rows returns `plan-review` on sonnet/low, `implement` on sonnet/medium and `impl-review` on sonnet/medium, with `simple change` in the reason. A plan with 2 phases or 7 rows keeps today's tiers. `--size s` on the first plan returns `plan` on sonnet/medium instead of sonnet/high. `status` shows a `simple` value per step. `SKILL.md` and `README.md` describe the new rule.

## What We're NOT Doing

- No git diff reading and no files-changed signal (user decision: plan signals only).
- No LLM scorer and no complexity file (ADR-001 Phase 2, FR-011).
- No risk path rules and no forced reviews (S-03), no skipping of plan-review (S-04).
- No discount on `fix` (`discount.fix: 0`), no haiku for reviews, no change to `impl-review` `minTier` (its base 3 minus 1 lands on 2).
- No discount on `plan-revise`: a re-plan follows a review that was not clean.
- No lowering of `steps.plan.baseTier`. Without `--size s` the first plan still starts at tier 4 (opus/high), above the Sonnet-5.5 high baseline. Revisit after the S-06 baseline comparison shows whether the plan step dominates cost.
- No usage report or token figures (S-02), no baseline comparison (S-06).
- No edits to `context/archive/`, `run.jsonl` or `meta.json` by hand, and no new npm dependency.

## Implementation Approach

Policy data first, then logic, then docs, as `AGENTS.md` requires (a policy change belongs in `policy.json`, and a tier-logic change updates `SKILL.md` and `README.md`). One new helper in `route.mjs` decides whether the change is simple, and `tierFor` applies the per-step discount when it is. The discount is withheld when any step in the log has failed, when `--size l` was given, or when the plan has no phases to count.

## Phase 1: Policy and plan-size reading

### Overview

Add the thresholds, discounts and new floors as data, and make `readPlan` report the total Progress row count. The router behaviour is unchanged after this phase.

### Changes Required:

#### 1. Simple-change policy and floors

**File**: `skills/10x-pipeline/policy.json`

**Intent**: Define what counts as simple and how much each step is discounted, and lower the floors so a discount can take effect on `plan` and `plan-review`.

**Contract**: Add `complexity.simple` with `maxPhases` (1), `maxRows` (6) and `discount` keyed by step name: `plan` 1, `plan-review` 1, `implement` 1, `impl-review` 1, `fix` 0. Set `steps.plan.minTier` to 2 and `steps["plan-review"].minTier` to 1. Leave `steps["impl-review"].minTier` and `steps.implement.minTier` at 2. Keys are camelCase and step names kebab-case.

#### 2. Total row count

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: Let the router measure plan size in Progress rows, counting Automated and Manual rows, checked or not.

**Contract**: `readPlan` returns a new `rows` field, incremented for every `- [ ]` / `- [x]` line after `## Progress`, and `0` in the not-found and no-Progress cases. Existing fields keep their meaning.

### Success Criteria:

#### Automated Verification:

- Policy is valid JSON with the new keys: `node -e "const p=JSON.parse(require('fs').readFileSync('skills/10x-pipeline/policy.json','utf8'));if(p.complexity.simple.maxPhases!==1||p.complexity.simple.maxRows!==6||p.steps['plan-review'].minTier!==1||p.steps.plan.minTier!==2)process.exit(1)"`
- Router still runs and prints valid JSON with unchanged tiers: from a scratch root with a 1-phase plan, `node <repo>/skills/10x-pipeline/scripts/route.mjs init scratch --size m | node -e "JSON.parse(require('fs').readFileSync(0,'utf8'))"` exits 0 and returns plan-review on tier 2

#### Manual Verification:

- `git diff` shows only `complexity.simple`, the two `minTier` values and the `rows` counter changed

---

## Phase 2: Router discount and visibility

### Overview

Apply the simple-change discount in the tier calculation, record it in the run log, and show it in `status`. Verify against scratch change folders.

### Changes Required:

#### 1. Simple-change decision and discount

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: Decide whether the change is simple and subtract the step's discount from the tier, with the reason in `tierWhy`.

**Contract**: A helper (for example `simpleSignal(d, plan, log, meta, policy)`) returns `{ simple, why }`. Rules, in order:

- If `d.step === "plan"`: simple only when `d.template === "plan"` (first plan, not `plan-revise`) and `meta.size === "s"`; `why` is `--size s`.
- Otherwise simple only when `plan.hasProgress`, `plan.phases >= 1`, `plan.phases <= maxPhases`, `plan.rows <= maxRows`, `meta.size !== "l"`, and no log entry has `ok === false`; `why` is `<phases> phase, <rows> rows`.

The failure rule is deliberate and lasts the whole run: once any step has failed, no later step is discounted, even if later steps succeed.

`tierFor` takes `meta` as an added argument (call site `route.mjs:305`) and, when simple, subtracts `policy.complexity.simple.discount[d.step] ?? 0`. It appends `-N simple change (<why>)` to `tierWhy` only when that discount is above 0 (so `fix` logs no `-0`). It returns `simple` alongside `tier`. The existing clamp to `minTier`/`maxTier` stays last.

#### 2. Log entry and status

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: Make the classification visible after the run, not only in the one-time `reason` string.

**Contract**: The `run.jsonl` entry written in `next` gets a boolean `simple`. `status` output includes `simple` per step (`e.simple ?? null`). The `run` action output is otherwise unchanged.

### Success Criteria:

#### Automated Verification:

- 1 phase, 3 rows, no review yet: `init` returns `plan-review` on sonnet/low and the reason contains `simple change`
- 2 phases, 6 rows: `plan-review` returns sonnet/medium and the reason has no `simple change`
- 1 phase, 7 rows: `plan-review` returns sonnet/medium and the reason has no `simple change`
- `init --size s` with no `plan.md` returns `plan` on sonnet/medium; `init --size m` returns `plan` on opus/high
- 1-phase 3-row plan with a clean `SOUND` plan review: `implement` returns sonnet/medium and, after all rows are checked, `impl-review` returns sonnet/medium
- A reported failed step (`last-result.json` with `"status":"failed"`) removes the discount on the following step
- `init --size l` with a 1-phase 3-row plan: `plan-review` returns sonnet/medium
- `status` prints valid JSON with a `simple` value for every step
- A `context/foundation/agent-smith-policy.json` override setting every `discount` value to 0 reproduces today's tiers on the 1-phase 3-row plan

#### Manual Verification:

- The `tierWhy` text for a simple run reads clearly (for example `base 2, -1 simple change (1 phase, 3 rows)`)

---

## Phase 3: Docs sync

### Overview

Update the two documents that describe tier movement so they match the router and policy.

### Changes Required:

#### 1. Orchestrator skill

**File**: `skills/10x-pipeline/SKILL.md`

**Intent**: Add the simple-change rule to the "How the tier moves" list, as `AGENTS.md` requires after a tier-logic change.

**Contract**: One bullet under "How the tier moves": a plan with at most 1 phase and 6 Progress rows, or `--size s` on the first plan, takes -1 tier on plan, plan review, implement and implementation review, and the discount is withheld after any failed step or with `--size l`. The bullet names no model or effort levels, and the `--size` bullet is kept as is.

#### 2. README

**File**: `README.md`

**Intent**: Mirror the rule in the "How routing works" bullets.

**Contract**: Extend the tier-movement bullet ("The tier goes up for large plans … It goes down after a clean review") to say the tier also goes down for a simple change (small plan or `--size s`). The rest of the file is unchanged, and `plugin.json` / `marketplace.json` are not touched (no `name`, `description` or `version` change).

### Success Criteria:

#### Automated Verification:

- `SKILL.md` documents the rule and still names no models: `grep -c "simple" skills/10x-pipeline/SKILL.md` is at least 1 and `grep -ciE "sonnet|opus|haiku" skills/10x-pipeline/SKILL.md` is 0
- `README.md` routing bullets mention the simple-change reduction: `grep -ci "simple" README.md` is at least 1

#### Manual Verification:

- The numbers in `SKILL.md` and `README.md` (1 phase, 6 rows, -1 tier) match `policy.json`

---

## Testing Strategy

### Unit Tests:

No test framework exists and none is added. Router behaviour is exercised with scratch change folders.

Scratch layout: a fresh root per scenario, `$TMPDIR/agent-smith-scratch/<scenario>/`, holding `context/changes/scratch/change.md` (any content). Run the router from that root with the change id `scratch`:

`cd $TMPDIR/agent-smith-scratch/<scenario> && node /Users/blazej/WebstormProjects/agent-smith/skills/10x-pipeline/scripts/route.mjs init scratch --size <s|m|l>`

Fixtures, each a `plan.md` whose only required part is a `## Progress` section of `### Phase N: x` headings with `#### Automated` rows (`- [ ] N.M x`) and optional `#### Manual` rows:

- Plan A: 1 phase, 2 Automated rows and 1 Manual row (3 rows). Simple.
- Plan B: 2 phases, 3 rows each (6 rows). Not simple (phases).
- Plan C: 1 phase, 5 Automated rows and 2 Manual rows (7 rows). Not simple (rows).
- Review SOUND: `reviews/plan-review.md` written after `plan.md`, with the two lines `**Verdict**: SOUND` and `**Findings**: 0 critical, 0 warnings`.
- Failed result: `agent-smith/last-result.json` containing `{"status":"failed","note":"fixture"}`, written after an `init` that returned a step.
- Policy override: `context/foundation/agent-smith-policy.json` with `{"complexity":{"simple":{"discount":{"plan":0,"plan-review":0,"implement":0,"impl-review":0,"fix":0}}}}`.

### Integration Tests:

The Phase 2 Automated rows are the scenarios, mapped to fixtures:

- 2.1 Plan A, no review. 2.2 Plan B, no review. 2.3 Plan C, no review.
- 2.4 No `plan.md`, `--size s` and `--size m` in separate roots.
- 2.5 Plan A plus Review SOUND returns `implement`. Then check every Automated row in `plan.md`, write `{"status":"done","note":"fixture"}` to `agent-smith/last-result.json` and run `next scratch` to get `impl-review`.
- 2.6 Plan A, `init` (returns `plan-review`), write Failed result, run `next scratch`, and check the returned step has no discount.
- 2.7 Plan A with `--size l`. 2.8 `status scratch` after any scenario. 2.9 Plan A with the Policy override.

Each prints JSON from `init` / `next` / `status` that is checked for the tier, model, effort and reason.

### Manual Testing Steps:

1. Run the router on a scratch simple plan and a scratch complex plan side by side and compare the printed tiers.
2. Read the `tierWhy` string of each step.

## Performance Considerations

None. `readPlan` already scans `## Progress`; the extra counter adds no I/O.

## Migration Notes

None. Nothing uses agent-smith yet (PRD, Constraints). Existing `run.jsonl` entries without `simple` read as `null` in `status`.

## References

- Roadmap item: `context/foundation/roadmap.md` (S-01)
- Requirements: `context/foundation/prd.md` (US-02, FR-001, FR-003, FR-007, FR-008)
- Decision record: `docs/ADR/ADR-001-phased-complexity-routing.md` (Phase 1)
- Code: `skills/10x-pipeline/scripts/route.mjs:61` (`readPlan`), `:259` (`tierFor`), `:305` (call site), `skills/10x-pipeline/policy.json`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Policy and plan-size reading

#### Automated

- [x] 1.1 Policy is valid JSON with the new keys
- [x] 1.2 Router still runs and prints valid JSON with unchanged tiers

#### Manual

- [x] 1.3 `git diff` shows only `complexity.simple`, the two `minTier` values and the `rows` counter changed

### Phase 2: Router discount and visibility

#### Automated

- [ ] 2.1 1 phase, 3 rows, no review yet: `init` returns `plan-review` on sonnet/low and the reason contains `simple change`
- [ ] 2.2 2 phases, 6 rows: `plan-review` returns sonnet/medium and the reason has no `simple change`
- [ ] 2.3 1 phase, 7 rows: `plan-review` returns sonnet/medium and the reason has no `simple change`
- [ ] 2.4 `init --size s` with no `plan.md` returns `plan` on sonnet/medium; `init --size m` returns `plan` on opus/high
- [ ] 2.5 1-phase 3-row plan with a clean `SOUND` plan review: `implement` returns sonnet/medium and, after all rows are checked, `impl-review` returns sonnet/medium
- [ ] 2.6 A reported failed step (`last-result.json` with `"status":"failed"`) removes the discount on the following step
- [ ] 2.7 `init --size l` with a 1-phase 3-row plan: `plan-review` returns sonnet/medium
- [ ] 2.8 `status` prints valid JSON with a `simple` value for every step
- [ ] 2.9 A `context/foundation/agent-smith-policy.json` override setting every `discount` value to 0 reproduces today's tiers on the 1-phase 3-row plan

#### Manual

- [ ] 2.10 The `tierWhy` text for a simple run reads clearly (for example `base 2, -1 simple change (1 phase, 3 rows)`)

### Phase 3: Docs sync

#### Automated

- [ ] 3.1 `SKILL.md` documents the rule and still names no models
- [ ] 3.2 `README.md` routing bullets mention the simple-change reduction

#### Manual

- [ ] 3.3 The numbers in `SKILL.md` and `README.md` (1 phase, 6 rows, -1 tier) match `policy.json`
