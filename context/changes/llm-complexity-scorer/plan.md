# LLM Complexity Scorer Implementation Plan

## Overview

Add a `score` pipeline step (ADR-007). Before the first `plan`, the router schedules a cheap-model subagent that scores the change on six factors (0 to 3), with evidence, unknowns and a confidence label, and writes `context/changes/<id>/complexity.json`. The router validates the file (shape only, never the truth of the evidence), copies the scores into its own log, and uses the two sums to move the tier of `plan` and `implement` by at most one rung, next to the deterministic signals. The router stays a script with no network or LLM call (ADR-006). Covers FR-001, FR-003, FR-011 and roadmap slice S-11.

## Current State Analysis

- The router picks the next step in `decide()` (`skills/10x-pipeline/scripts/route.mjs:746`). The "no plan yet" branch calls `preplanNext()` (`:1013`) for `research`, `domain-brief` and `frame`, then returns `plan` (`:758-770`).
- A step is accepted by a file the subagent wrote, newer than the step start: `attachResult()` (`:402-450`) has one `case` per step (`research`, `frame`, `domain-brief` at `:419-435`).
- `cleanSignals()` (`:386-400`) keeps `signals.rigor` for every step, and `resolveRigor` raises the run's level from `signals.rigor` of every executed entry (`:535-537`). Only `lessonCandidates` is limited to one step (`impl-review`, `:395-398`). The shared prompt suffix (`policy.json` `prompts.suffix`, appended at `:1991`) tells every subagent it MAY add `signals.rigor`.
- `measureRisk()` (`:715-743`) returns empty `hits` also when history is unreadable (`source: "unavailable"`), when the plan names no path (`planPaths` 0) and when a named path cannot be matched (`unclassified`). The lean plan-review skip in `decide()` defines "measured" inline: `source !== "unavailable"`, `planPaths >= 1`, `unclassified.length === 0` (`:786-791`). `next()` measures risk only when `plan.md` exists (`:1919`), so risk is `null` for the first `plan`.
- `tierFor()` (`:1595`) builds the tier from base, phase count (`+1` at 3 phases, `+2` at 6, for steps in `complexity.appliesTo`, which holds `implement` but not `plan`), bump, failures, simple-change discount, then `settle()`: rigor offset, clamp, and last the effort floor from `rigor.minEffort`. `settle()` applies that floor only when `s.interactive || d.interactive` (`:1624`), which matches ADR-003 "Effort floor" (`docs/ADR/ADR-003-rigor-gated-routing.md:58-62`: "Interactive steps get a floor"). In `policy.json` plain `implement` is not interactive; the tdd and e2e executor steps set `d.interactive` (`:1344`), a segment does not. `tierFor` records a discount as saved only when `settle()` did not absorb it (`:1634-1635`). It takes no artifact content today. Its other caller is the archive step (`:1819`).
- The simple-change discount applies when the plan has 1 phase (`complexity.simple.maxPhases`) and at most 6 Progress rows (`maxRows`) and nothing failed (`:1575-1582`).
- `isFailure` (`:462`) feeds the rigor rise after failed steps (`:531`) and withholds the simple-change discount (`:1575`, `:1581`). `trailingFailures` (`:464`) feeds the per-step retry bump and the 3-attempt halt in `next()` (`:1973`).
- `next()` (`:1909`) halts on `signals.needsHuman` (`:1926`), halts when `executed(log).length` reaches the budget (`:1935-1938`, checked before `decide()`), logs skip entries with a fixed field list (`:1952-1960`) and builds the run entry (`:1992`).
- The budget is `limits.maxTotalSteps` plus `rigor.budgetDelta` (`policy.json`: -4, +2, +7). `budget-executors.test.mjs` pins the longest failure-free paths at 14 (`standard`) and 19 (`thorough`), and asserts that the shipped delta is the smallest that leaves two steps to spare (`:195-209`). `route.test.mjs:148-159` ("step budget differs per level: 10, 16, 21") hard-codes the budgets as literals.
- `report.md` is built from `meta` and the log only (`buildReport`, `:257`). `status` prints a fixed field list per log entry (`:2302-2314`).
- `compare` demands a baseline whose every step ran on sonnet/high (`:2171`, `:2209`), counts `failedAttempts` as `ok === false && !fallback` (`:2164`), sums tokens per model alias only (`byModel`, `:2137-2143`; effort is not in the key), and lists the change folder's files, minus `plan.md` and `plan-brief.md`, as `inputFiles` for the `input-files-differ` warning (`:2151-2152`, `:2222-2228`). `comparePair` checks only that `baseline`, `routed` and `format` are strings (`:2190-2193`); `parseFlags` (`:28-37`) gives a string for `--flag value`. `init` already has the boolean-flag pattern for `--archive` and `--chrome` (`:2344-2356`).
- Test helper `makeProject` (`test/helpers.mjs:18-39`) writes the project override file only when a test passes a policy. `preplan.test.mjs` also writes that file directly at five sites (`:209`, `:671`, `:676`, `:859`, `:872`). Every existing test that starts a run at `standard` expects `plan` as the first step. `helpers.mjs` already has `gitInit` and `commitFiles` for churn fixtures (`churn.test.mjs` uses them).
- No `complexity.json`, `score` step, `score` policy block or scorer prompt exists. `context/foundation/lessons.md` does not exist.

## Desired End State

A run at rigor `standard` or `thorough` starts with one `score` step on the tier the policy pins, after any `research`, `domain-brief` or `frame` step. A valid `complexity.json` sits in the change folder, and its scores are copied into the `score` log entry. `status` and `report.md` show the score step, its tokens, the score summary and every tier shift that took effect. The `plan` tier can move up one rung from the cognitive sum; the `implement` tier can move up or down one rung from the execution sum. A shift never takes an interactive step below the effort floor, never changes the rigor level, and moves a tier down only when churn risk was measured and found no hot path, nothing has failed, no phase-count bump and no simple-change discount applies. A scorer that fails costs at most three attempts, which use no step budget, then the router logs a skip and goes on. `compare --unpinned` can measure the scorer on against off, with tokens per model and per tier. Verify with `node --test skills/10x-pipeline/test/*.test.mjs` and a scratch-project `init` and `status`.

### Key Discoveries:

- `preplanNext()` already implements retry, skip-with-reason and verification by artifact (`route.mjs:1013-1061`). `score` copies the pattern in its own function, `scoreNext()`, so `preplan.order` and its tests stay untouched.
- Failed steps are not neutral by default (`route.mjs:462`). A scorer that only advises must not raise rigor, withhold the discount or spend budget, so its entries need a neutral flag like `fallback`.
- A score result can raise the whole run through `signals.rigor` (`:386-400`, `:535-537`), and the shared suffix invites it. A prompt rule alone would contradict the suffix, so the code guard in `cleanSignals` is the real fix; the `lessonCandidates` branch is the pattern (research F5).
- The effort floor is an interactive-step floor (ADR-003, README "Effort floor", `route.mjs:1624`). ADR-007's rule line names `rigor.minEffort` without that qualifier. A shift on `plan`, `implement-tdd` and `implement-e2e` is bounded by the floor; a down shift on plain `implement` or a segment can reach `minTier` 2 (sonnet medium), as the simple-change discount already can (research F1).
- A `plan` down shift cannot happen safely: risk is `null` before `plan.md` exists, so churn risk is never measured for the first plan, and the only case where it would take effect at `standard` or `thorough` is a hard-keyword goal, where README says the router keeps the plan's base tier on purpose. The `plan` down shift ships off (research F2, F3).
- The `implement` down shift is narrow by design. With the guards above it acts only on a plan of 2 phases, or of 1 phase with more than 6 rows, whose named paths are measured and none hot. In this repository a plan that names `route.mjs` or `policy.json` already blocks it (`route.mjs risk llm-complexity-scorer` lists both as hot; research F2).
- Budget math: a successful `score` adds one step to the longest failure-free path (15 at `standard`, 20 at `thorough`). Deltas +3 and +8 keep two steps to spare. Three failed attempts plus the 14-step path would be 17, exactly the budget, so `next()` would halt with "Step budget 17 spent" instead of `done` (`:1936`). Failed `score` attempts therefore use no budget; the attempt cap bounds their cost.
- The step must not be on by default before the budget deltas change, or a commit-by-commit checkout runs a 15-step path against a budget of 16 (research F9). The default flips in the phase that raises the deltas.
- The test helper default keeps existing tests on `plan` first once the default flips. The five direct override writes in `preplan.test.mjs` drop it, and would pass then only because a logged `plan` entry or a pending pre-plan retry closes the score gate first. They move to a shared helper so a reorder cannot turn the scorer on silently.
- In an A/B pair only the scorer-on arm has `complexity.json`, so `compare` would warn `input-files-differ:complexity.json` on every pair unless the file is treated as produced.
- Every score-driven effect is a model or effort move, and `compare` counts raw tokens, which README says understates savings from `haiku` steps and overstates a drop bought by moving work to `opus`. `byModel` cannot see an effort move (research F4).

## What We're NOT Doing

- Reassessing the score on a new dependency, a scope change or repeated failure (ADR-007 leaves it out).
- Scoring risk, or reading the plan. Churn stays the only risk input; the scorer runs before the plan.
- Per-task scoring for each implementation phase.
- Judging the truth of `evidence` in the router, or checking whether a valid `complexity.json` that existed before the step describes the current goal (it is trusted as-is).
- Letting the score raise or lower the rigor level (a `signals.rigor` on a score result is dropped), skip plan review, or pick an executor.
- A `plan` down shift (shipped off; see Decisions).
- Extending the effort floor to non-interactive steps.
- An LLM or network call in `route.mjs`, a new npm dependency, or an edit to `AGENTS.md` Hard Rules.
- Running the A/B check in code: the plan builds the tooling, a human runs the pairs (Phase 5, Manual).
- Crediting the `implement` effort move in the A/B rule with an effort-weighted measure; the rule reads raw tokens, the opus guard and the A/A spread only.
- Calibrating thresholds. They ship uncalibrated, like the other word lists and thresholds.

## Implementation Approach

Reuse existing mechanisms: a gate function like `preplanNext`, verification by file like `research`, skip entries like the pre-plan gates, a pinned-tier step like `frame`, a prompt file under `prompts/`, a neutral entry like `fallback`, a per-step signal filter like `lessonCandidates`, the lean skip's "measured risk" test, and the `init` boolean-flag check. Keep all numbers (factor names, scale, thresholds, attempt caps) in `policy.json` under `score`, as ADR-007 says. The file is read only when the `score` step is decided or verified; the scores are copied into `run.jsonl`, and every later decision and the report read the log, like every other router decision. The shift is computed inside `tierFor` before `settle`, so the clamp and the floor bound it, and the effective shift is measured the way the saved discount is. Phases go from data to scheduling to use to measurement to docs, each ending with a green suite. The step ships off (`score.minRigor: null`) until Phase 4 raises the budget deltas and turns it on in the same commit.

Decisions taken without a human (unattended run, evidence cited; "research Fn" is the matching heading of `research.md`, Follow-up 1):

- Score step outside the extra-step pool, counted in the step budget with deltas raised by 1 (`standard` +3, `thorough` +8). Reason: the pool pays for executors that earn savings; an uncalibrated scorer must not starve them (ADR-007 leaves this open; README "Budget").
- Failed `score` attempts use no step budget (first plan review). Reason: ADR-007 says the score only advises and a failed scorer "MUST NOT halt the run"; counting three failures would turn the longest path into a budget halt. The successful step still counts, as ADR-007 says. `maxAttempts` (3) bounds the cost. Alternatives rejected: `maxAttempts` 2 contradicts ADR-007 "fails three times"; deltas +4/+9 break the "smallest delta with two to spare" pin and the raised-pool test.
- The target default of `score.minRigor` is `standard` (ADR-007 rule 2), but Phase 1 ships `null` and Phase 4 flips it to `"standard"` in the same commit as the budget deltas and the walker (research F9). Reason: moving the deltas into Phase 2 would pull most of Phase 4 forward, and the branch merges as one PR; shipping off is the smaller change. `lean` and `null` keep the step off silently, like a closed pre-plan gate.
- Pinned tier: `baseTier 0`, `minTier 0`, `maxTier 1` (haiku low, a retry on sonnet low). ADR-007 says "pins"; a one-rung retry range gives a failed cheap attempt a better model without a router rule.
- Each sum drives one step: `cognitive` (ambiguity, novelty, coupling) moves `plan`; `execution` (discovery, volume, verification) moves `implement`. Up at a sum of 7 or more for both (uncalibrated). Down at 2 or less for `implement` only; `score.shift.plan.down` ships `null`, and the shift code reads a non-number threshold as off (research F2, F3). Reason: churn risk is never measured before the first plan, and a hard-keyword goal keeps the plan's base tier on purpose.
- Down shift guards, all required: confidence `medium` or `high`, at most 2 unknowns, churn risk measured (the lean-skip test, moved into one shared `riskMeasured(risk)` helper so the two cannot drift) with no hit (`risk.hits` empty, plan and diff hits), no failed step, no simple-change discount applied and no phase-count bump applied to the step (research F2, F3). Reason: ADR-007 says the shift MUST NOT override the churn risk axis and wants the score "next to" the deterministic signals; a pre-plan estimate must not cancel the rung the real plan size added. Up shifts have no guards.
- Effort floor: the shift is bounded by the floor where ADR-003 puts it, on interactive steps (research F1, review Fix A). ADR-007's rule line is amended in Phase 5 to name that scope, with a dated note, as ADR-003 was amended in place. The owner confirms this reading at the pause before Phase 3. If the owner wants every shifted step floored, set `score.shift.implement.down` to `null` too: the shift becomes up-only, which meets the literal rule with no code change. Fix B (floor every shifted step in `settle`) was rejected: at `standard` and `thorough` plain `implement` starts at the floor tier 3, so with the phase-bump guard it removes the `implement` down shift entirely while keeping the code for it.
- The shift is recorded with its effective value (first plan review): the tier difference with and without the shift after `settle()`. The report lists effective shifts and names absorbed ones as not applied.
- The shift reads the scores from the log, not the file (first plan review). The `score` run entry (ok) or the skip entry for a valid file that was already there carries the copy. A later edit, deletion or corruption of `complexity.json` changes neither the tiers nor the report.
- The shift applies to templates `plan` and `implement`, `implement-segment`, `implement-tdd`, `implement-e2e`. A same-template retry keeps the up shift (first plan review): a retried first plan uses template `plan`, and a repeated implement step uses its own template. The up shift then stacks with the failure bump and the phase-count bump, bounded by `maxTier`; the down shift drops out because any failure and any phase bump block it. Excluded: `plan-revise`, `plan-replan`, `plan-rejected`, `implement-retry`, and every step other than `plan` and `implement`.
- A valid `complexity.json` already present skips the step with a logged reason and is trusted as-is; an invalid one does not skip, and is overwritten.
- Failed attempts: skip after 3 failed attempts or 2 invalid files, whichever comes first (ADR-007 rules 11 and 12 read together). A failed `score` entry is flagged `advisory`: it adds no rigor rise, withholds no discount and uses no budget, but still bumps its own retry tier.
- A `score` result's `signals.rigor` is dropped in `cleanSignals` (research F5). Reason: ADR-007 says the score only advises and the plan keeps rigor out of the score's reach. `needsHuman` stays, as ADR-007 requires. `prompts/score.md` also forbids the key, with a precedence rule over the generic suffix like the `archive` prompt's; the code guard holds when a model follows the suffix instead.
- `compare` keeps counting failed `score` attempts in `failedAttempts` (first plan review, declined in part). Reason: they are real failures that cost tokens, while a `fallback` is a handed-back phase; `failedAttempts` is a figure, not a reason. `compare` drops `complexity.json` from `inputFiles`, because it is a produced file.
- `compare --unpinned` is a boolean flag checked like `--archive`: bare or `true` is on, `false` is off, anything else halts (research F7).
- `compare` gains `tokens.byTier` keyed `<model>/<effort>`, next to `byModel` (research F4). Reason: `byModel` cannot show an effort move, and the A/B record must show what the scorer moved.
- A/B rule, fixed before any run (research F4; ADR-007 "If the scorer does not save more than it costs ... the step turns off"). The scorer stays on only when all three hold over at least 5 comparable `compare --unpinned` pairs (each pair: one change, scorer off as baseline, scorer on as routed): (1) the median `dropPercent` is above 0; (2) the median per-pair difference of opus tokens (on minus off, from `byModel`) is 0 or less, so a drop bought by moving work to the top model does not count; (3) the median `dropPercent` is above the absolute `dropPercent` of one A/A pair (scorer off on both arms, same change, same timing rules), so the drop is larger than run-to-run spread. Any other outcome, including fewer than 5 comparable pairs, a missing A/A pair or a result inside the A/A spread ("inconclusive"), sets `score.minRigor` to `null` with no router change. Pairs that are not comparable are recorded with their reasons and do not count. The arms alternate which runs first and run close in time (README "Baseline comparison"). Five pairs give a screen, not a significance test, and the rule does not credit the `implement` effort move beyond the tokens it saves. The review's alternative "inconclusive keeps the scorer on at `standard`" was rejected: it reverses ADR-007's burden of proof.

## Phase 1: Policy data, scorer prompt, test hygiene

### Overview

Land all data and the prompt, with the step off, and make existing tests blind to the later default, before any router logic changes.

### Changes Required:

#### 1. Policy block and step

**File**: `skills/10x-pipeline/policy.json`

**Intent**: Add the `score` block, the `steps.score` entry and the `prompts.score` template. No router code reads them yet. The step ships off; Phase 4 turns it on.

**Contract**: `steps.score = { skill: null, baseTier: 0, minTier: 0, maxTier: 1 }` (not interactive). `score` block keys: `minRigor` (`null` until Phase 4, then `"standard"`; `null` turns the step off), `file` ("complexity.json", must match the artifact-name pattern), `schemaVersion` (1), `maxBytes` (65536), `scale {min 0, max 3}`, `factors {cognitive [ambiguity, novelty, coupling], execution [discovery, volume, verification]}`, `confidences ["low","medium","high"]`, `maxAttempts` 3, `maxInvalid` 2, `shift { plan {sum "cognitive", templates ["plan"], up 7, down null}, implement {sum "execution", templates [implement, implement-segment, implement-tdd, implement-e2e], up 7, down 2}, downMinConfidence "medium", downMaxUnknowns 2 }`. A threshold that is not a number turns that direction off. `prompts.score` is an array of a short line with `{id}`, `{goal}`, `{artifacts}` and `@prompts/score.md`.

#### 2. Scorer prompt

**File**: `skills/10x-pipeline/prompts/score.md` (new), `skills/10x-pipeline/prompts/README.md`

**Intent**: Rule-form prompt (ADR-004) that tells a cheap subagent what to read, how to score each factor and what file to write. Add a row to the "Wired" table.

**Contract**: Rules state: read `change.md`, the goal and the listed upstream artifacts, and search the repo only as far as needed to judge coupling and discovery; never read `plan.md`; write `context/changes/{id}/complexity.json` with the ADR-007 schema; each factor an integer 0 to 3 with a one-line `evidence` that names a file path, a document or a goal phrase; `unknowns` is an array of strings (empty when none); `confidence` is `low`, `medium` or `high`; unknowns the subagent cannot resolve lower confidence instead of lowering a score; no question to the user; `signals.needsHuman` only when the goal is empty and `change.md` holds nothing to score; never add `signals.rigor` (the score carries the subagent's view of the change; the router drops the key for this step); these rules win over the generic unattended rules where they disagree (the `archive` prompt's precedence rule is the pattern). Rubric anchors per factor, 0 to 3:

| Factor | 0 | 3 |
| --- | --- | --- |
| ambiguity | goal and `change.md` fix the outcome | outcome unclear or contradictory |
| novelty | repeats a pattern already in the repo | no precedent in the repo |
| coupling | one file or module | public interface, shared data format or many consumers |
| discovery | locations named in the goal | broad unknown territory to search |
| volume | one small edit | more than 10 files or large mechanical work |
| verification | existing automated checks cover it | no harness, nondeterministic or external |

Levels 1 and 2 sit between (state both in the file).

#### 3. Test helper default

**File**: `skills/10x-pipeline/test/helpers.mjs`, `skills/10x-pipeline/test/preplan.test.mjs`

**Intent**: Add an exported `writeOverride(project, policy)` that writes the project override file with `{ score: { minRigor: null } }` merged in unless the given policy has its own `score` key. `makeProject` always calls it, so existing tests keep `plan` as the first step after Phase 4 flips the default. New tests opt in with `policy: { score: { minRigor: "standard" } }`. The five direct writes in `preplan.test.mjs` (`:209`, `:671`, `:676`, `:859`, `:872`) call `writeOverride` instead of `fs.writeFileSync`, so each keeps the default when it replaces the file mid-test.

**Contract**: shallow merge only: a test-provided `policy.score` wins whole. A comment states why. No other helper change; the assertions of the five `preplan.test.mjs` sites stay as they are. `loops-existing.test.mjs` is not touched (AGENTS.md: never edit it); it writes no override file.

#### 4. Data tests

**File**: `skills/10x-pipeline/test/score.test.mjs` (new)

**Intent**: Start the file with data tests; later phases append router tests. Test titles are string literals starting `score data`, `score gate`, `score validation`, `score failure`, `score shift`, `score report`.

**Contract**: assert the policy block and step shape above, with `score.minRigor` `null` and `score.shift.plan.down` `null` (Phase 4 changes the first assertion to `"standard"`), that `prompts.score` resolves, that `prompts/score.md` is listed as wired, that `makeProject()` yields `plan` as the first step at `standard`, and that a project whose override is replaced through `writeOverride` (with no `score` key) still yields `plan` first.

### Success Criteria:

#### Automated Verification:

- Policy data tests pass: `node --test --test-name-pattern="score data" skills/10x-pipeline/test/score.test.mjs`
- Prompt rule form and wiring tests pass: `node --test skills/10x-pipeline/test/rules.test.mjs skills/10x-pipeline/test/preplan.test.mjs`
- The whole suite passes with the default-off helper: `node --test skills/10x-pipeline/test/*.test.mjs`

#### Manual Verification:

- The rubric anchors in `skills/10x-pipeline/prompts/score.md` read as four distinct levels for each of the six factors

**Implementation Note**: Pause for manual confirmation before Phase 2.

---

## Phase 2: Schedule, verify and fail safely

### Overview

The router returns `score` before the first `plan` when the gate is open, verifies `complexity.json`, copies the scores into the log, retries, and skips without halting or spending budget on failures. The shipped default stays off; tests and the manual check opt in.

### Changes Required:

#### 1. Validator

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: Add `readComplexity(p, policy)`: reads the file named by `score.file` in the change folder and returns `{ ok, data }` or `{ ok: false, error, exists }`. It never judges evidence truth. Only `scoreNext` and `attachResult` call it.

**Contract**: valid only when the path is a regular file (not a symlink) of at most `maxBytes`, the JSON parses to an object, `schemaVersion` equals the policy value, every factor of `score.factors` is an object with an integer `score` inside `scale` and a non-empty trimmed `evidence` string, `unknowns` is an array, and `confidence` is in `confidences`. `data` is the log summary: `{ schemaVersion, factors: { <name>: <score> }, cognitive, execution, confidence, unknowns }`, where the two sums come from the policy groups and `unknowns` is the count. Evidence text is not copied. Extra keys are ignored. A malformed `score` policy block reads as "step off" and never throws.

#### 2. Scheduling

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: Add `scoreNext(p, fullLog, policy, meta, ctx)` and call it in `decide()` right after `preplanNext()` returns null (`:759`). Same shape as `preplanNext`: `null`, `{ skip }` or a step.

**Contract**: closed (silent) when `score.minRigor` is not a level or the run's level is below it, and once any `plan` attempt is logged. Otherwise: a successful `score` entry or an earlier `score` skip means done; a valid file already present returns a skip whose reason names the file and carries the `score` summary (the file is trusted as-is); failed attempts at or above `min(score.maxAttempts, escalation.maxAttemptsPerStep)`, or invalid files at or above `score.maxInvalid`, return a skip with the last note and "going on with deterministic signals"; one or more failed attempts below the caps return a retry; else return `{ step: "score", template: "score", bump: 0, reason }`. In `next()`, the skip entry copies `d.skip.score` when present (the field list at `:1952-1960` gains it), and a run entry for `score` gets `advisory: true`.

#### 3. Verification, log copy, signals and neutral failures

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: Add `case "score"` to `attachResult()`: verified when the file is newer than `startedAt` and valid; record `invalid` (short error) on the entry when the file exists but fails, and the `score` summary from `readComplexity` when ok. In `cleanSignals()`, drop `rigor` when `step === "score"`, beside the `lessonCandidates` branch (`:395-398`). Make `advisory` entries neutral in `isFailure` (`:462`) and in the budget check (`:1935-1938`).

**Contract**: `isFailure = e.ok === false && !e.fallback && !e.advisory`. The budget check counts `executed(log)` without entries that have `advisory` and `ok === false`; nothing else reads the budget, and `report.md`, `status` and `compare` still list and count every executed entry. `trailingFailures` is left as is, so the retry bump and the 3-attempt halt still see the score step. A `score` result keeps `needsHuman`, which halts once through the existing branch (`:1926`); its `rigor` never reaches `run.jsonl`. Add `paths(id).complexity`.

#### 4. Tests

**File**: `skills/10x-pipeline/test/score.test.mjs`

**Intent**: Black-box tests through the CLI with scratch projects that opt in.

**Contract**: `score gate`: the shipped default (`minRigor: null`), `lean` and an explicit `minRigor: null` run no score and log no skip; with the opt-in, `standard` returns `score` first; at `thorough` it follows `research`; it runs once; a project whose `plan.md` already has a `## Progress` section gets no `score` step and no skip entry; a valid file skips with a logged reason in `status` and `report.md`, and the skip entry carries the summary; an invalid file does not skip. `score validation`: each of these fails the step and retries on the next tier: no file, stale file, bad JSON, wrong `schemaVersion`, missing factor, score 4 or 1.5, empty evidence, `unknowns` not an array, `confidence` "certain", a symlink, an oversize file; false evidence text is accepted; a valid file's summary lands on the ok entry. `score failure`: three failed attempts skip and the plan follows; two invalid files skip; no halt; rigor stays unchanged and the simple-change discount survives; a `score` result with `signals: { rigor: "thorough" }` leaves the level unchanged and its entry has no `signals.rigor`; with an override budget of 2 steps (`limits.maxTotalSteps` 2, `rigor.budgetDelta.standard` 0), three failed attempts still leave room for `plan` and `plan-review`; a result with `needsHuman` halts once with a report.

### Success Criteria:

#### Automated Verification:

- Gate tests pass: `node --test --test-name-pattern="score gate" skills/10x-pipeline/test/score.test.mjs`
- Validation tests pass: `node --test --test-name-pattern="score validation" skills/10x-pipeline/test/score.test.mjs`
- Failure tests pass: `node --test --test-name-pattern="score failure" skills/10x-pipeline/test/score.test.mjs`
- The whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs`

#### Manual Verification:

- In a scratch project at rigor `standard`, `init` returns the `score` step, and after a hand-written valid `complexity.json` and a result file `next` returns `plan`

The scratch project for this check opts in with `{ "score": { "minRigor": "standard" } }` in `context/foundation/agent-smith-policy.json`, because the shipped default stays off until Phase 4.

**Implementation Note**: Pause for manual confirmation before Phase 3.

---

## Phase 3: Use the scores in the tier and the report

### Overview

The router shifts the `plan` and `implement` tier from the logged scores and reports what took effect.

### Changes Required:

#### 1. Shared risk test and tier shift

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: Move the lean skip's "measured" condition (`:786-791`) into `riskMeasured(risk)` and use it in `decide()` with no behavior change. Add `scoreSummary(fullLog)` (the `score` of the last ok `score` run entry, else of the `score` skip entry, else `null`) and `scoreShift(d, policy, summary, guards)`, and call the shift inside `tierFor()` (`:1595`) after the simple-change discount and before `settle`. `next()` passes, as a new optional last argument of `tierFor`, the summary from the log and `riskClear = riskMeasured(risk) && risk.hits.length === 0`; it does not read `complexity.json`. The archive call (`:1819`) passes nothing and gets no shift.

**Contract**: `riskMeasured(risk)` is true only when `risk` is not `null`, `risk.source !== "unavailable"`, `risk.planPaths >= 1` and `risk.unclassified.length === 0`; the lean skip's reason text and fields stay as they are. `scoreShift` returns `{ applies, sum, value, shift, why }`. `applies` is true when a summary exists and `d.template` is in the step's `templates`. `shift` is +1 when `up` is a number and the step's sum is at or above it; -1 when `down` is a number, the sum is at or below it, and every down guard holds: confidence at or above `downMinConfidence`, unknowns at most `downMaxUnknowns`, `riskClear`, `!log.some(isFailure)`, no simple-change discount (`discount > 0`, read before `settle`, so a discount that the clamp or the floor would absorb later still blocks the shift), and no phase-count bump applied in this `tierFor` call; else 0. The shift is added to `tier`, so the clamp and, for interactive steps, the effort floor bound it. `effective` is `settle(tier).final - settle(tier - shift).final`, measured like `saved` (`:1635`). Add a `parts` note such as `-1 score (execution 2/9, confidence high)`, or `-1 score not applied (clamp or floor)` when `effective` is 0. `entry.scoreShift = { sum, value, shift, effective }` is written when `applies` and `shift !== 0`. The rigor level is never touched. AGENTS.md requires the "How the tier moves" list in `SKILL.md` and the routing bullets in `README.md` to follow a tier-logic change; Phase 5 does that, so the change is not done before it.

#### 2. Report and status

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: Add a `## Complexity score` section to `report.md` built from log entries only (the `score` summary of the ok or skip entry, and the `scoreShift` of the later entries). No section when no summary exists. `status` rows gain `score` (score run and skip rows), `invalid` (failed score rows) and `scoreShift` (shifted rows) when set.

**Contract**: section lines: sums with factor scores, confidence, unknowns count, then one line per entry with a `scoreShift`: `implement -1 (step 4)` when `effective` is not 0, `plan +1 not applied (clamp or floor) (step 2)` when it is 0. Additive to the stable report format, like `## Lesson candidates`. `buildReport` stays free of file reads.

#### 3. Tests

**File**: `skills/10x-pipeline/test/score.test.mjs`

**Intent**: Tier tests with fixed `complexity.json` fixtures through the CLI. Down-shift cases need measured risk: build them with `gitInit` and `commitFiles` (as `churn.test.mjs` does) and a plan that names one committed path that is not hot.

**Contract**: `score shift`:
- Up: cognitive 7 or more moves a plain-goal first plan from 3 to 4 and a hard-keyword first plan from 4 to 5; execution 7 or more moves `implement` up one rung; the up shift also applies with confidence `low`, 3 unknowns, a hot path, unmeasured risk, a failed step, a phase-count bump or an applied discount.
- `plan` down is off: cognitive 0 never moves `plan` down, also with an override `score.shift.plan.down: 2` (risk is not measured before the first plan).
- `implement` down: execution 2 or less moves plain `implement` from 3 to 2 at `standard` (`minTier`; not interactive, so no floor) for a 2-phase plan with measured risk and no hot path; no down shift on confidence `low`, on 3 unknowns, on a hot plan path, on a hot diff path, on risk `unavailable` (no git), on a plan that names no path, on an unclassified plan token, after a failed step, with an applied simple-change discount (1 phase, at most 6 rows), or with a phase-count bump (a 3-phase plan with execution 0 stays at tier 4).
- Bounds: an `implement-tdd` step at `thorough` never goes below `rigor.minEffort` and records `effective` 0; an override `steps.plan.maxTier: 4` with a hard-keyword goal and cognitive 9 keeps tier 4 and records `effective` 0; nothing goes outside `minTier`/`maxTier`.
- Scope: `plan` reads cognitive only and `implement` reads execution only; templates `plan-revise`, `plan-replan`, `plan-rejected` and `implement-retry`, and the review and fix steps, get no shift; a retried first plan (template `plan`) and an `implement` step after a failed one keep the up shift on top of the failure bump, clamped by `maxTier`.
- Stability: editing or deleting `complexity.json` after the score step changes neither the tiers nor the report; the rigor level is the same with and without a score; a run without a score summary (score off or skipped after failures) equals today's tiers byte for byte; the lean plan-review skip still skips and still runs in the same cases after the `riskMeasured` move.

`score report`: section present with a score, absent without; shift lines match the run entries, and an absorbed shift reads "not applied"; `status` shows the score step, the skip, `invalid` and `scoreShift`.

### Success Criteria:

#### Automated Verification:

- Shift tests pass: `node --test --test-name-pattern="score shift" skills/10x-pipeline/test/score.test.mjs`
- Report and status tests pass: `node --test --test-name-pattern="score report" skills/10x-pipeline/test/score.test.mjs`
- The whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs`

#### Manual Verification:

- The `Complexity score` section of a scratch run's `report.md` is clear enough to see why the plan and implement tiers moved

The scratch run opts in as in Phase 2.

**Implementation Note**: Pause for manual confirmation before Phase 4. Before the shift code of this phase starts, the owner also confirms the effort-floor reading: the shift is floored on interactive steps only (ADR-003), so plain `implement` and a goal segment can move down to `minTier`. If the owner wants every shifted step floored, set `score.shift.implement.down` to `null` in `policy.json` (and in the `score data` assertion) and turn the `implement` down cases of the test list into "no down shift" cases; nothing else in the plan changes.

---

## Phase 4: Budget, baseline arm, compare

### Overview

Keep the budget guarantee with the new step, turn the step on by default (`score.minRigor: "standard"`) in the same commit as the new deltas, keep the baseline arm free of the scorer, and let `compare` measure the scorer on against off.

### Changes Required:

#### 1. Budget deltas, default on and budget tests

**File**: `skills/10x-pipeline/policy.json`, `skills/10x-pipeline/test/budget-executors.test.mjs`, `skills/10x-pipeline/test/route.test.mjs`, `skills/10x-pipeline/test/score.test.mjs`

**Intent**: Raise `rigor.budgetDelta` to `{ lean: -4, standard: 3, thorough: 8 }` and set `score.minRigor` to `"standard"`, together. Teach the budget walker to opt into `score` and answer it with a valid fixture file (or a scripted failure), then re-pin the longest paths. Update every test that hard-codes a budget.

**Contract**: `walkFixture` merges `score.minRigor: "standard"` into every override; `answer` gets a `case "score"` that writes a valid `complexity.json` whose sums trigger no shift, or, while `script.scoreFails` is above 0, answers `failed` without a file; `TABLE` becomes `{ standard: 15, thorough: 20 }`; the delta assertion becomes the new values; `longest path legal` still requires two steps to spare; `failure path fits` expects `score` first (12 steps); `raised cap exceeds budget` still fails when the pool is raised by one. Add a walk where the scorer fails three times then skips, at both levels, over the fixtures: every walk ends `done`, the counted steps (executed minus failed advisory entries) are at most `TABLE[level] - 1`, the executed entries are at most `TABLE[level] + 2`, and rigor stays at the level. `lean unchanged` stays as is. `route.test.mjs:148-159` becomes "step budget differs per level: 10, 17, 22" with budgets 10, 17 and 22. The `score data` assertion for `minRigor` becomes `"standard"`. Find every other site with `grep -n "budget\|Step budget\|maxTotalSteps" skills/10x-pipeline/test/*.mjs`: `loops.test.mjs:447` and `budget-executors.test.mjs:97` compute the budget from the shipped policy, `executors.test.mjs:683-691` pins the unchanged lean budget 10, and `archive.test.mjs:849`, `:860` set their own cap; each stays valid and is rerun.

#### 2. Baseline arm

**File**: `skills/10x-pipeline/baseline-policy.json`, `skills/10x-pipeline/test/compare.test.mjs`

**Intent**: The baseline arm never runs the scorer: add `"score": { "minRigor": null }`. Test that a baseline-policy run at `standard` starts with `plan` and that the file still pins every tier to sonnet/high.

#### 3. Compare for the scorer A/B

**File**: `skills/10x-pipeline/scripts/route.mjs`, `skills/10x-pipeline/test/compare.test.mjs`

**Intent**: Add `compare --unpinned`: waives only the `baseline-not-pinned` reason, adds the warning `baseline-unpinned`, and reports `verdict: "unpinned"` for a comparable pair in place of the target verdict. The baseline of such a pair is a routed run with `score.minRigor` null; the routed side is the same change with the scorer on, or with the scorer off for the A/A pair. `dropPercent` is then the share of tokens the scorer saved (negative when it cost more). Add `tokens.byTier` to `readSide`, keyed `<model>/<effort>` from each executed entry with a token figure, beside `byModel`, and print it in `--format md` as `Tokens by tier, baseline: ...` and `Tokens by tier, routed: ...`. `readSide` drops the file named by `score.file` (of the policy `compare` loads; `complexity.json` when the block is malformed) from `inputFiles`, as it drops `plan.md` and `plan-brief.md`.

**Contract**: `comparePair` checks the flag before anything is read, like `init` checks `--archive` (`:2344-2350`): `undefined` or `"false"` is off, `true` or `"true"` is on, any other value halts with `Invalid --unpinned <value>. Use --unpinned, --unpinned true or --unpinned false.` All other `compare` reasons stay. Without the flag nothing changes except the `inputFiles` filter and the added `byTier` field and lines; `byModel` and its lines stay as they are. `failedAttempts` keeps counting failed `score` attempts. Add the flag to the usage line (`:2333`) and the header comment. A negative `dropPercent` prints as today (`compare.test.mjs:199`). Tests: `--unpinned` on a pair with a non-pinned baseline is comparable with the warning and verdict above; `--unpinned false` behaves as without the flag; `--unpinned md` halts; `byTier` sums per model and effort and appears in the md output; a pair whose only file difference is `complexity.json` has no `input-files-differ` warning.

### Success Criteria:

#### Automated Verification:

- Budget tests pass with the scorer in the longest path and in a three-failure skip: `node --test skills/10x-pipeline/test/budget-executors.test.mjs`
- Baseline and `--unpinned` compare tests pass: `node --test skills/10x-pipeline/test/compare.test.mjs`
- Loop tests that use the budget pass: `node --test skills/10x-pipeline/test/loops.test.mjs`
- The whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs`

#### Manual Verification:

- Running `compare` with `--unpinned` on two scratch change folders prints a readable result with a negative and a positive `dropPercent`

**Implementation Note**: Pause for manual confirmation before Phase 5.

---

## Phase 5: Docs, ADR notes and the A/B check

### Overview

Document the step, record the decisions, and run the check ADR-007 requires.

### Changes Required:

#### 1. Skill and README

**File**: `skills/10x-pipeline/SKILL.md`, `README.md`

**Intent**: SKILL.md "How the tier moves" gets a bullet for the score step and one for the score shift, with no model names (AGENTS.md hard rule). README gets a "Complexity score" section (schema, gate, files, failure rule, shift rule with `plan` up-only and the `implement` down guards, the narrow down window, floor scope, that a run starting with a finished `plan.md` gets no score, how to turn it off), the routing bullets, the `signals` bullet (a `score` result's `rigor` is dropped), the changed budget numbers (10, 17, 22 and longest paths 15, 20) with "failed `score` attempts use no budget", the baseline note, `complexity.json` in the baseline recipe's list of produced files not to copy, the `--unpinned` flag with its value check and `unpinned` verdict and the `byTier` field under "Baseline comparison", the sentence that `route.mjs` stays a script, and the A/B recipe with `--unpinned`, the A/A pair, the one-line off override and the decision rule.

**Contract**: `description` and the Start/Loop sections of SKILL.md stay valid: the orchestrator treats `score` like any `run` action.

#### 2. AGENTS.md and ADR notes

**File**: `AGENTS.md`, `docs/ADR/ADR-007-llm-complexity-scorer-as-a-routed-step.md`, `context/foundation/prd.md`

**Intent**: AGENTS.md project structure lists `score.test.mjs`, `prompts/score.md` and the `writeOverride` helper default (the sentence "`helpers.mjs` stays as it was" gets that exception), and its `compare` command bullet gains `[--unpinned]` with one line on it. In ADR-007, rewrite the floor rule line so it names the ADR-003 scope, and add a dated note under it, as ADR-003 was amended in place. Add a short "S-11 decisions" section with the choices from this plan: outside the pool, failed attempts use no budget, `signals.rigor` dropped for `score`, the floor on interactive steps, "override the churn risk axis" read as "a down shift needs measured risk with no hot path", `plan` up-only, the `implement` down guards, the effective shift, the shift read from the log, `byTier`, and the A/B decision rule. The A/B result follows later. PRD Open Question 4 note only if the live run confirms usage figures.

**Contract**: the new rule line keeps the ADR-004 form with one bold keyword, for example: `**GIVEN** a tier shift from the score **WHEN** the router applies it **THEN** the shift **MUST NOT** take an interactive step below the effort floor in \`rigor.minEffort\` (ADR-003), override the churn risk axis or lower the rigor level.` If the owner chose the literal reading at the Phase 3 pause, the rule line stays as it is and the note records that the `implement` down shift ships off.

#### 3. A/B check (human)

**Intent**: Run at least 5 comparable pairs, scorer off as baseline against scorer on as routed, and one A/A pair with the scorer off on both arms, each with `compare --unpinned`. Record per pair in ADR-007: `dropPercent`, `byModel` and `byTier` of both arms, and for pairs that are not comparable their reasons. Alternate which arm runs first and run the two arms close in time. Apply the decision rule fixed in Decisions: the scorer stays on only when the median `dropPercent` is above 0, the median opus-token difference (on minus off) is 0 or less, and the median `dropPercent` is above the absolute A/A `dropPercent`. Any other outcome, inconclusive included, sets `score.minRigor` to `null` in `policy.json`, with no router change. Record that 5 pairs is the ADR minimum and a screen, not a significance test, and that the rule does not credit an effort move beyond the tokens it saves.

### Success Criteria:

#### Automated Verification:

- SKILL.md names no model: `! grep -nEi "haiku|sonnet|opus" skills/10x-pipeline/SKILL.md`
- ADR rule lines keep the rule form: `node --test skills/10x-pipeline/test/rules.test.mjs`
- The whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs`

#### Manual Verification:

- A live `/agent-smith:10x-pipeline` run on a scratch change at `standard` shows the scorer subagent writing a valid `complexity.json` on the pinned tier
- At least 5 scorer on and off pairs are compared with `compare --unpinned` and the result, with the keep or turn-off decision, is written into ADR-007

The second check includes the A/A pair; without it the result is inconclusive and the scorer turns off.

---

## Testing Strategy

### Unit Tests:

- Validator cases, one per failure shape, and the accept-false-evidence case.
- Shift matrix: sum, confidence, unknowns, hot plan and diff path, each unmeasured risk form, failure, discount, phase-count bump, `plan` down off (also with an override threshold), floor on interactive steps only, clamp, effective value, excluded templates, same-template retries.
- `cleanSignals`: a `score` result's `rigor` is dropped, `needsHuman` kept.

### Integration Tests:

- Black-box CLI walks in scratch projects (`makeProject`, `next`, `writeResult`, `gitInit`, `commitFiles`): gate, retry, skip, halt, budget neutrality of failed attempts, shift from the log, report, unchanged lean plan-review skip.
- Budget walker with the scorer in the path and with three failed attempts; literal budgets 10, 17, 22.
- `compare --unpinned` (on, `false`, invalid value), `byTier`, and the `inputFiles` filter.

### Manual Testing Steps:

1. Scratch change at `standard` with the opt-in override (Phases 2 and 3): `init`, write a valid file, `next`, read the next tier and `report.md`.
2. Same with a broken file three times: confirm skip and plan.
3. `compare --unpinned` on two scratch runs.

## Performance Considerations

The router reads one small file (at most 64 KB) only when it decides or verifies the `score` step; later calls read the copy in `run.jsonl`. `riskMeasured` reuses the risk `next()` already measures, so the shift adds no git call. The scorer's tokens appear in `compare`. The cap of 3 attempts bounds a broken scorer at 3 cheap steps, which use no step budget.

## Migration Notes

None. Nobody uses the plugin yet (PRD Constraints). The step is off through Phases 1 to 3 and turns on in Phase 4 with the new budget deltas, so no intermediate commit runs it against the old budget. `complexity.json` is not part of the stable installer surface; `schemaVersion` may change. `report.md` gains an additive section; `run.jsonl` entries gain the optional fields `advisory`, `score`, `invalid` and `scoreShift`; `compare` output gains `tokens.byTier` and two md lines. A run in progress that already logged a `plan` never gets a `score` step, and neither does a run that starts with a `plan.md` that already has a `## Progress` section (the gate sits in the "no plan yet" branch of `decide()`), so a hand-made plan gets no score and no skip entry.

## References

- Decision record: `docs/ADR/ADR-007-llm-complexity-scorer-as-a-routed-step.md`; `docs/ADR/ADR-001-phased-complexity-routing.md`; `docs/ADR/ADR-003-rigor-gated-routing.md` ("Effort floor", "Step budget")
- PRD: `context/foundation/prd.md` (FR-001, FR-003, FR-011); roadmap slice S-11 in `context/foundation/roadmap.md`
- Research: `context/changes/llm-complexity-scorer/research.md`, Follow-up 1 (evidence and a decision per finding of the second plan review)
- Plan review: `context/changes/llm-complexity-scorer/reviews/plan-review.md` (third review, 2026-11-02, SOUND; it replaced the second review (REVISE), whose fixes are in the Decisions and the research follow-up, and the first review, whose fixes are cited above as "first plan review")
- Pattern to copy: `skills/10x-pipeline/scripts/route.mjs:1013` (`preplanNext`), `:419-435` (verification by artifact), `:1634-1635` (absorbed discount), `:395-398` (per-step signal filter), `:786-791` (measured risk), `:2344-2356` (boolean flag check)
- Budget tests: `skills/10x-pipeline/test/budget-executors.test.mjs:195-264`, `skills/10x-pipeline/test/route.test.mjs:148-159`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Policy data, scorer prompt, test hygiene

#### Automated

- [x] 1.1 Policy data tests pass: `node --test --test-name-pattern="score data" skills/10x-pipeline/test/score.test.mjs` — 493377e
- [x] 1.2 Prompt rule form and wiring tests pass: `node --test skills/10x-pipeline/test/rules.test.mjs skills/10x-pipeline/test/preplan.test.mjs` — 493377e
- [x] 1.3 The whole suite passes with the default-off helper: `node --test skills/10x-pipeline/test/*.test.mjs` — 493377e

#### Manual

- [ ] 1.4 The rubric anchors in `skills/10x-pipeline/prompts/score.md` read as four distinct levels for each of the six factors

### Phase 2: Schedule, verify and fail safely

#### Automated

- [x] 2.1 Gate tests pass: `node --test --test-name-pattern="score gate" skills/10x-pipeline/test/score.test.mjs` — 306ca6f
- [x] 2.2 Validation tests pass: `node --test --test-name-pattern="score validation" skills/10x-pipeline/test/score.test.mjs` — 306ca6f
- [x] 2.3 Failure tests pass: `node --test --test-name-pattern="score failure" skills/10x-pipeline/test/score.test.mjs` — 306ca6f
- [x] 2.4 The whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs` — 306ca6f

#### Manual

- [ ] 2.5 In a scratch project at rigor `standard`, `init` returns the `score` step, and after a hand-written valid `complexity.json` and a result file `next` returns `plan`

### Phase 3: Use the scores in the tier and the report

#### Automated

- [x] 3.1 Shift tests pass: `node --test --test-name-pattern="score shift" skills/10x-pipeline/test/score.test.mjs` — 5011789
- [x] 3.2 Report and status tests pass: `node --test --test-name-pattern="score report" skills/10x-pipeline/test/score.test.mjs` — 5011789
- [x] 3.3 The whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs` — 5011789

#### Manual

- [ ] 3.4 The `Complexity score` section of a scratch run's `report.md` is clear enough to see why the plan and implement tiers moved

### Phase 4: Budget, baseline arm, compare

#### Automated

- [x] 4.1 Budget tests pass with the scorer in the longest path and in a three-failure skip: `node --test skills/10x-pipeline/test/budget-executors.test.mjs` — 2e9c59f
- [x] 4.2 Baseline and `--unpinned` compare tests pass: `node --test skills/10x-pipeline/test/compare.test.mjs` — 2e9c59f
- [x] 4.3 Loop tests that use the budget pass: `node --test skills/10x-pipeline/test/loops.test.mjs` — 2e9c59f
- [x] 4.4 The whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs` — 2e9c59f

#### Manual

- [ ] 4.5 Running `compare` with `--unpinned` on two scratch change folders prints a readable result with a negative and a positive `dropPercent`

### Phase 5: Docs, ADR notes and the A/B check

#### Automated

- [x] 5.1 SKILL.md names no model: `! grep -nEi "haiku|sonnet|opus" skills/10x-pipeline/SKILL.md`
- [x] 5.2 ADR rule lines keep the rule form: `node --test skills/10x-pipeline/test/rules.test.mjs`
- [x] 5.3 The whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs`

#### Manual

- [ ] 5.4 A live `/agent-smith:10x-pipeline` run on a scratch change at `standard` shows the scorer subagent writing a valid `complexity.json` on the pinned tier
- [ ] 5.5 At least 5 scorer on and off pairs are compared with `compare --unpinned` and the result, with the keep or turn-off decision, is written into ADR-007
