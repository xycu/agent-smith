<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Validate policy limits, ladder and tiers at load Implementation Plan

- **Plan**: context/changes/policy-limits-fail-open/plan.md
- **Mode**: Deep (done in the main thread, no sub-agent: nested subagents are banned; the riskiest claims were read against the code in the worktree)
- **Date**: 2026-11-12
- **Verdict**: REVISE
- **Findings**: 0 critical, 2 warnings, 3 observations

The plan is sound in approach: one pure validator, one call site before the run lock, `status` kept usable, shipped policies pass. Two warnings (a repo rule and an ADR the plan contradicts without saying so) and three small gaps were found. All five had a clear fix and the fixes are applied to `plan.md`; no `## Progress` row was touched.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | WARNING |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

Grounding: 14/14 paths found (`state.mjs`, `route.mjs`, `flow.mjs`, `steps.mjs`, `preplan.mjs`, `openspec.mjs`, `isolation.mjs`, `policy.json`, `baseline-policy.json`, `docs/REFERENCE.md`, `prompts/README.md`, `ADR-015`, `neutral.test.mjs`, `late-usage.test.mjs`); 12/12 symbols found (`mergedPolicy`, `coAuthorProblem`, `halt`, `render`, `promptText`, `checkPrompts`, `maxNeutralRetries`, `tierFor` clamp, `budget` line `route.mjs:118`, `route.mjs:170`, `route.mjs:180`, `main` order `loadPolicy` -> `resolveChain` -> `acquireRunLock`); brief and plan agree.

Checks run:

- **Progress to Phase, mechanical.** One `## Progress` heading, three phase headings equal in body and Progress, every Success Criteria bullet has its row (1.1-1.7, 2.1-2.5, 3.1-3.3), no checkbox outside Progress.
- **Shipped policy.** All 8 ladder rungs have `model` and `effort`; every `steps.<name>` has integer `baseTier`, `minTier`, `maxTier` inside 0..7 and `minTier <= baseTier <= maxTier`; `limits`, `escalation.maxAttemptsPerStep` (3) and `rigor.budgetDelta` are valid. `baseline-policy.json` has 8 sonnet/high rungs. So the check cannot halt the shipped files.
- **Placeholders.** All 35 shipped `policy.prompts` templates resolved and scanned: no `{word}` outside the 17 names. `{n}`, `{run}`, `{step}` appear only in `archive.*` and `isolation.*` message templates, which the plan leaves out on purpose.
- **Existing tests.** No test overrides `ladder`; overrides of `maxTotalSteps` (1, 2, 5), `maxPlanRevisions` (1) and `steps.*.minTier/maxTier/baseTier` stay valid. The three `baseTier` outside `[minTier, maxTier]` cases remain legal under the lenient rule. `score.maxAttempts` and `maxInvalid` are already fail-closed in `scoreConfig`, so leaving them out is correct.
- **`maxNeutralRetries` callers.** One caller (`flow.mjs:328`), no test imports the function; `neutral.test.mjs:219` is the only test of the tolerant read.

## Findings

### F1 — The strict `maxNeutralRetries` reverses a MUST of ADR-015 and the plan does not amend it

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Phase 2 section 3; Phase 3 section 2
- **Detail**: `docs/ADR/ADR-015-neutral-orchestrator-retry.md:62` says: GIVEN `limits.maxNeutralRetries` is not a non-negative integer WHEN the router reads the cap THEN it MUST use 2. Phase 2 makes that value halt at load. Phase 3 updates `docs/REFERENCE.md:368` and writes ADR-022, but leaves ADR-015 stating the opposite rule.
- **Fix**: Add `docs/ADR/ADR-015-neutral-orchestrator-retry.md` to Phase 3 section 2 and append an Amendment that replaces line 62 with the halt and points to ADR-022 (the style of Amendment 1 of ADR-012).
- **Decision**: APPLIED — Phase 3, section 2 "AGENTS.md and ADR": ADR-015 added to the files and the Amendment described.

### F2 — The plan allows moving `snapshot` into `helpers.mjs`, which `AGENTS.md` forbids

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 section 3 "Tests"
- **Detail**: The test intent says "copy `snapshot` from `late-usage.test.mjs` or move it to `helpers.mjs` without changing existing callers". `AGENTS.md` (Project Structure) says `helpers.mjs` stays as it was, except for `writeOverride` and `cleanupAll`. The second option breaks that rule and leaves the implementer a choice the repo has already made.
- **Fix**: Keep only the copy into the new test file and cite the rule.
- **Decision**: APPLIED — Phase 1, section 3 "Tests": the move option is removed; `snapshot` is copied from `late-usage.test.mjs:24`.

### F3 — Migration Notes omit that a literal `{word}` in a project template now halts

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Migration Notes
- **Detail**: The notes cover malformed limits only. Phase 2 also makes a project template with any `{word}` outside the 17 names halt, including a `{word}` the author meant literally (it used to render as empty text, so it never worked as literal text either). The owner meets the halt with no note in the plan.
- **Fix**: Add one sentence to Migration Notes.
- **Decision**: APPLIED — Migration Notes: the placeholder halt added.

### F4 — `promptProblem` must catch the throws of `promptText`

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 section 2 "Placeholder check"
- **Detail**: The plan says to skip a template "that does not resolve", but `promptText` signals that by throwing (missing key, non-string part, bad `@prompts/` reference). `preplan.test.mjs:183-195` expects `init` to halt with `Router error: policy.prompts.plan ...` for such values. A `promptProblem` that lets the throw out would still end in the outer catch of `main()` (`route.mjs:955`) as a `Router error:` halt, but it would drop the `checkPrompts` text that tells the owner the result file is untouched, and the halt would move to every `next` before `checkPrompts` runs. The contract should say the throw is caught and the template skipped.
- **Fix**: State in the contract that the throw is caught and the template skipped, and name the existing test that must stay green.
- **Decision**: APPLIED — Phase 2, section 2 "Placeholder check": the catch-and-skip rule and the test reference added.

### F5 — One of the four reproductions is not init-only

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 section 3 "Tests"
- **Detail**: The test intent says each case runs through `init`, but `maxTotalSteps: 1` halting at `Step budget 1 spent.` needs `init`, a `failed` result file and `next` (`change.md`, Reproduction 1). The implementer would find that out while writing the case.
- **Fix**: Say so in the case list.
- **Decision**: APPLIED — Phase 1, section 3 "Tests": the case named as needing `init`, a `failed` result and `next`.
