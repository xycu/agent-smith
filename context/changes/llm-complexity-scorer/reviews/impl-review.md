<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: LLM Complexity Scorer Implementation Plan

- **Plan**: context/changes/llm-complexity-scorer/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4, 5
- **Date**: 2026-11-02
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 1 observation

Commits reviewed: 493377e (p1), 306ca6f (p2), 5011789 (p3), 2e9c59f (p4), fb34b88 (p5), 6401d6d (epilogue). Commit 14648d5 (review prompts apply their own fixes) is before this plan and outside its scope.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Evidence

Plan drift, file by file (planned file -> verdict):

- `skills/10x-pipeline/policy.json`: `steps.score` (0/0/1, not interactive), the `score` block with every key of the contract, `prompts.score` as an array with `@prompts/score.md`, `budgetDelta` 3/8, `minRigor` "standard", `shift.plan.down` null. MATCH.
- `skills/10x-pipeline/prompts/score.md`, `prompts/README.md`: rule form, read and write rules, no `plan.md`, no `signals.rigor`, precedence over the generic rules, four-level rubric per factor, schema; listed as wired. MATCH.
- `skills/10x-pipeline/test/helpers.mjs`, `preplan.test.mjs`: `writeOverride` with a shallow merge and a comment; `makeProject` always calls it; the five direct writes now call it. `loops-existing.test.mjs` untouched. MATCH.
- `route.mjs` `readComplexity`: lstat (no symlink), `maxBytes`, JSON object, `schemaVersion`, every factor an integer inside the scale with trimmed evidence, `unknowns` array, `confidence` in the list; summary without evidence; malformed block reads as off. MATCH.
- `route.mjs` `scoreNext`: called after `preplanNext` in the no-plan branch; closed below `minRigor`, on a malformed block and once a `plan` attempt is logged; valid file skips with the summary; caps `min(maxAttempts, maxAttemptsPerStep)` and `maxInvalid`; reason ends "going on with deterministic signals". MATCH.
- `route.mjs` `attachResult`, `cleanSignals`, `isFailure`, budget: `case "score"`, `invalid` and `score` on the entry, `rigor` dropped for `score`, `advisory` neutral in `isFailure`, `budgetSteps` excludes failed advisory entries only, `trailingFailures` unchanged, `paths(id, policy).complexity`. MATCH.
- `route.mjs` `riskMeasured`, `scoreSummary`, `scoreShift`, `tierFor`: shared measured-risk test used by the lean skip with the same reason text; shift before `settle`; down guards (confidence, unknowns, `riskClear`, no failure, discount read before `settle`, no phase bump); `effective` measured like `saved`; `parts` note and `entry.scoreShift`; archive call passes nothing. MATCH.
- `route.mjs` report and status: `## Complexity score` from log entries only; `status` shows `score`, `invalid`, `scoreShift`, and `score` on skip rows. MATCH.
- `route.mjs` compare: `--unpinned` checked before any read with the plan's halt text; waives only `baseline-not-pinned`, adds `baseline-unpinned`, verdict `unpinned`; `tokens.byTier` keyed `<model>/<effort>` and two md lines; `complexity.json` (or `score.file`) dropped from `inputFiles`; usage line and header comment updated. MATCH.
- `baseline-policy.json`: `"score": { "minRigor": null }`. MATCH.
- Budget tests: walker opts in and answers `score`; `TABLE` 15/20; delta assertion 3/8; failure path 12 steps with `score` first; new "scorer failures skip" walk at both levels; `route.test.mjs` budgets 10, 17, 22. MATCH.
- Docs: `SKILL.md` score and shift bullets, no model names; `README.md` routing, signals, budget, Complexity score, baseline and A/B sections; `AGENTS.md` structure and `compare` bullet; ADR-007 amended rule line with a dated note, "S-11 decisions", "A/B decision rule", "A/B result: Pending". MATCH.

Safety and quality: the score file name passes `ARTIFACT_NAME` (no path separators), the file is read only after an lstat that rejects symlinks and sizes over `maxBytes`, and every policy value is type-checked before use, so a malformed block turns the step off instead of throwing. No network or LLM call in `route.mjs`, no new dependency, no git write. No finding.

Automated success criteria (all run on 2026-11-02, Node v24.19.0):

| Command | Result |
|---|---|
| `node --test --test-name-pattern="score data" skills/10x-pipeline/test/score.test.mjs` | pass (9) |
| `node --test skills/10x-pipeline/test/rules.test.mjs skills/10x-pipeline/test/preplan.test.mjs` | pass (8 + 53) |
| `node --test --test-name-pattern="score gate" ...score.test.mjs` | pass (7) |
| `node --test --test-name-pattern="score validation" ...score.test.mjs` | pass (12) |
| `node --test --test-name-pattern="score failure" ...score.test.mjs` | pass (6) |
| `node --test --test-name-pattern="score shift" ...score.test.mjs` | pass (23) |
| `node --test --test-name-pattern="score report" ...score.test.mjs` | pass (3) |
| `node --test skills/10x-pipeline/test/budget-executors.test.mjs` | pass (5) |
| `node --test skills/10x-pipeline/test/compare.test.mjs` | pass (31) |
| `node --test skills/10x-pipeline/test/loops.test.mjs` | pass (26) |
| `! grep -nEi "haiku\|sonnet\|opus" skills/10x-pipeline/SKILL.md` | pass (no match) |
| `node --test skills/10x-pipeline/test/*.test.mjs` | pass (493 tests, 491 pass, 0 fail, 2 skipped) |

Manual rows 1.4, 2.5, 3.4, 4.5, 5.4 and 5.5 are all unticked in `## Progress`: pending for a human, not rubber-stamped.

## Findings

### F1 — Owner checkpoints pending while the scorer ships on

- **Severity**: OBSERVATION
- **Impact**: MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: docs/ADR/ADR-007-llm-complexity-scorer-as-a-routed-step.md:43; skills/10x-pipeline/policy.json (`score.minRigor`)
- **Detail**: Phase 3 required the owner to confirm the effort-floor reading (floor on interactive steps only, so plain `implement` can shift down to `minTier`) before the shift code started. The unattended run took the plan's default and recorded it in ADR-007 as "the owner has not confirmed it yet". The A/B check (rows 5.4, 5.5) is pending too, so `score.minRigor: "standard"` ships on before the evidence ADR-007 asks for. Both are allowed by the plan (the default flips in Phase 4, the A/B check is a human step), and the code matches the default reading. They are still open decisions.
- **Fix**: Owner confirms or reverses the floor reading; if reversed, set `score.shift.implement.down` to `null` in `policy.json` and in the `score data` assertion, and turn the `implement` down cases into "no down shift" cases, as the Phase 3 note says. Then run the A/B pairs and record the result in ADR-007.
  - Strength: The plan already names the exact switch; no router change either way.
  - Tradeoff: Until decided, `standard` and `thorough` runs pay for an uncalibrated scorer.
  - Confidence: HIGH — the plan and ADR-007 both describe this path.
  - Blind spot: Owner preference is unknown.
- **Decision**: PENDING — needs an owner decision (effort-floor reading and the A/B result); no fix can be applied without it.
