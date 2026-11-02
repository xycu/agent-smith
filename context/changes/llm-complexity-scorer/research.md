---
date: 2026-11-02T00:36:03+01:00
researcher: Claude (unattended research subagent, Sonnet 5.5)
git_commit: c0e217b9b07bc8aae8f8311e931a09ca0e296f53
branch: llm-complexity-scorer
repository: agent-smith
topic: "Follow-up: close the gaps named in reviews/plan-review.md (REVISE, 2026-11-02) before the plan of llm-complexity-scorer is revised"
tags: [research, follow-up, llm-complexity-scorer, route.mjs, score-step, tierFor, compare, budget]
status: complete
last_updated: 2026-11-02
last_updated_by: Claude (unattended research subagent, Sonnet 5.5)
last_updated_note: "Follow-up 1 added: evidence and a decision for each plan-review finding F1 to F9"
---

# Research: llm-complexity-scorer, follow-up 1 (plan-review gaps)

**Date**: 2026-11-02T00:36:03+01:00
**Git Commit**: c0e217b9b07bc8aae8f8311e931a09ca0e296f53
**Branch**: llm-complexity-scorer
**Repository**: agent-smith

Note on the file: `context/changes/llm-complexity-scorer/research.md` did not exist when this follow-up ran (the folder held `change.md`, `plan.md`, `plan-brief.md`, `reviews/plan-review.md` and `agent-smith/`). There were no earlier findings to preserve, so this file starts with Follow-up 1. A later follow-up appends below it and leaves this section as written.

## Research Question

The plan review (`reviews/plan-review.md`, verdict REVISE, 0 critical, 6 warnings, 3 observations) lists nine findings, F1 to F9, all with `Decision: PENDING`. For each one: is the claim true in the code, what does the evidence say about the fix, and which fix should the plan revision take? No human is available, so each choice below is a decision from the review text, the code, `README.md` and the ADRs. Each is listed as an assumption in the RESULT line.

## Summary

- All nine claims hold against the inspected code and tests. Two anchors in the review are exact-line corrections (F8), and one of the review's proposed fixes needs a change (F4: `byModel` cannot see effort).
- F1: the plan's reading is the one ADR-003 already defines. The effort floor is an interactive-step floor (`docs/ADR/ADR-003-rigor-gated-routing.md:58-62`). ADR-007's sentence is shorthand for it. Take Fix A, amend the ADR-007 rule line, and put the confirmation into the existing pause before Phase 3.
- F2 and F3 together leave the down shift narrow. A `plan` down shift cannot satisfy a "risk measured" guard because `risk` is `null` before `plan.md` exists (`route.mjs:1919`), and it only takes effect for hard-keyword goals, where the router deliberately keeps the base tier. Decision: turn the `plan` down shift off in the policy data and keep the `plan` up shift. The `implement` down shift survives only for plans of 2 phases, or 1 phase with more than 6 rows (derivation in F3).
- F4: the rule needs three fixes before any run: read tokens by tier and not by model alias, add one A/A pair to measure run-to-run spread, and make "inconclusive" mean off (ADR-007 puts the burden of proof on the scorer).
- F5: the shared prompt suffix tells every subagent it MAY add `signals.rigor`, so a prompt rule in `score.md` contradicts it. Drop `rigor` for the `score` step in `cleanSignals` as the real guard.
- F6, F7, F8, F9 are mechanical: a test list (F6), a flag check with a precedent in `init` (F7), two line anchors (F8), and a phase-order fix (F9) where shipping `minRigor: null` until Phase 4 is the smaller change.

## Detailed Findings

### F1. Effort floor and ADR-007 (decision: Fix A, with a clarifying amendment)

Observed:

- ADR-003 defines the floor for interactive skills only: "Interactive steps get a floor" and the two rules are scoped "GIVEN a toolkit skill built to run interactively" (`docs/ADR/ADR-003-rigor-gated-routing.md:60-62`). `README.md:35` and `skills/10x-pipeline/SKILL.md:98` repeat that: "plan, plan review and implementation review ask questions".
- ADR-007's rule says the shift "MUST NOT go below the effort floor in `rigor.minEffort`" with no qualifier (`docs/ADR/ADR-007-llm-complexity-scorer-as-a-routed-step.md:41`). The name `rigor.minEffort` is the ADR-003 mechanism.
- Code: `settle()` applies the floor when `s.interactive || d.interactive` (`route.mjs:1624`). In `policy.json`, `steps.plan`, `plan-review`, `impl-review`, `archive`, `research`, `domain-brief` and `frame` set `interactive: true`; `steps.implement`, `fix` and `manual-verify` do not. The executor steps `implement-tdd` and `implement-e2e` set `d.interactive` (`route.mjs:1344`, `executor !== "goal"`); a goal segment does not.
- Precedent for a below-floor `implement`: the simple-change discount for `implement` is 1 (`policy.json` `complexity.simple.discount`), so tier 3 becomes 2 (sonnet medium) at `standard`, where `rigor.minEffort` is `high`.
- Arithmetic behind the review's Fix B objection (inspected path: `standard` and `thorough`, `steps.implement.baseTier` 3, floor tier 3): with the floor on every shifted step, an `implement` down shift is absorbed whenever the starting tier is 3. It can act only on a starting tier of 4 or more, which needs 3 or more phases (`phaseThresholds` `[3, 6]`), and F3 forbids exactly that case. Fix B plus the F3 guard therefore removes the `implement` down shift entirely.
- ADR practice for amendments: ADR-001 carries a status note pointing at ADR-007, and ADR-003 was edited in place with dated notes when the budget deltas changed (`ADR-003:56`, `:262`, `:272`). An in-place clarification with a date is the repo's practice.

Decision: Fix A. In Phase 5, rewrite ADR-007's rule line to say the floor binds interactive steps (as ADR-003 defines it) and add the dated "S-11 decisions" note. Add one line to the existing "Pause for manual confirmation before Phase 3" note (`plan.md:187`): the owner confirms the floor reading before the shift code starts. Assumption: the owner did not mean ADR-007's sentence to widen the ADR-003 floor. The evidence is ADR-003, README and SKILL.md; the owner has not said so.

### F2. Down shift when churn risk was never measured (decision: use the lean-skip test; the `plan` down shift cannot meet it)

Observed:

- `measureRisk` returns empty `hits` for `source: "unavailable"`, for a plan that names no path (`planPaths` 0) and for unmatchable tokens (`unclassified`) (`route.mjs:715-743`).
- The lean plan-review skip already defines "measured": `source !== "unavailable"`, `planPaths >= 1`, `unclassified.length === 0` (`route.mjs:786-791`, inside `decide()`).
- `next()` measures risk only when `plan.md` exists (`route.mjs:1919`), so for the first `plan` step `risk` is `null`. `tierFor` takes no risk argument today (`route.mjs:1595`, call site `:1972`).
- Live check on this change (`node skills/10x-pipeline/scripts/route.mjs risk llm-complexity-scorer`, read-only): source `window`, 15 plan paths, none unclassified, plan hits `skills/10x-pipeline/policy.json` and `skills/10x-pipeline/scripts/route.mjs`, 6 hot files in the set. In this repository, a plan that names `route.mjs` or `policy.json` already blocks any down shift through the hot-path guard.

Decision:

- Extract the lean-skip condition into one helper (for example `riskMeasured(risk)`) used by `decide()` and by the shift, so the two cannot drift, and add the hot check on top. `next()` passes one boolean, `downAllowed`, to `tierFor`: `risk !== null`, measured, and `risk.hits.length === 0`.
- Tests: one `score shift` case for each unmeasured form (`unavailable`, no plan path, an unclassified token) that expects no down shift and an unchanged up shift.
- Consequence for `plan`: the guard can never be true for the first plan, so a `plan` down shift is dead code under this rule. See F3 for why it is also undesirable. Decision: ship `score.shift.plan.down` as `null` (the shift code reads a non-number as off) and keep `plan` up at 7.

### F3. Pre-plan score cancelling the phase-count bump (decision: add the guard; it narrows the `implement` down shift to a small window)

Observed:

- `tierFor` adds `+1` at 3 phases and `+2` at 6 for steps in `complexity.appliesTo`, which is `plan-review`, `implement`, `impl-review`, `fix` (`policy.json`; `route.mjs:1599-1602`). `plan` is not in that list, so the phase-bump cancellation concerns `implement` only.
- The scorer runs before `plan.md` exists (ADR-007 "When it runs"), so its `execution` sum is an estimate of the size that the later plan measures.
- The simple-change discount applies when `plan.phases >= 1`, `<= 1` (`complexity.simple.maxPhases`) and `plan.rows <= 6` (`maxRows`), with no failed step (`route.mjs:1575-1582`). `plan.rows` counts every `- [ ]`/`- [x]` row of the Progress section, Automated and Manual (`route.mjs:97-98`).

Derived window (inference from the two thresholds above, at `standard` or `thorough`, no failure so far, risk measured and no hot path, confidence and unknown limits met): a `implement` down shift can take effect only when the plan has 2 phases, or 1 phase with more than 6 rows. With 3 or more phases the F3 guard blocks it, and with 1 phase and 6 or fewer rows the simple-change discount already applied (the plan's own "no discount already applied" guard).

Why the `plan` down shift is also unwanted (observed): at `standard` and `thorough` the floor for `plan` is tier 3. A plain-goal first plan starts at base 4 with bump -1, so tier 3 (floor), and a down shift is absorbed. Only a hard-keyword goal starts at tier 4 (bump 0, `policy.json` `complexity.firstPlan.bump`). That is the case where README says the hard keyword "keeps the first plan at the plan step's base tier" (`README.md`, routing bullets). A score from before the plan would lower the tier exactly where the deterministic rule asked to keep it. ADR-007 wants the score "next to" the deterministic signals, not above them.

Decision: add the guard "no phase-count bump applies" (`C.phaseThresholds.filter(t => plan.phases >= t).length === 0`, `implement` templates only) and the test with a 3-phase plan and `execution` 0 that expects no down shift. Together with F1 and F2, state in the plan that the shipped down shift is narrow and uncalibrated, so the A/B check (F4) will mostly measure scorer cost and the up shift.

### F4. A/B keep-or-off rule (decision: tokens by tier, one A/A pair, inconclusive means off)

Observed:

- `compare` sums `usage.totalTokens` per side and per model alias: `byModel[e.model]` (`route.mjs:2137-2143`). `e.model` is `haiku`, `sonnet` or `opus`. Effort is not part of the key, although each log entry also carries `tier`, `model` and `effort`.
- Consequence (inference from that key): a down shift from tier 3 to tier 2 (sonnet high to sonnet medium, the only effective `implement` down shift) leaves `byModel` unchanged. The review's fix ("scorer-on arm does not use more tokens on the highest-tier model") sees only a move between aliases, such as sonnet high to opus high on an up shift or opus high to sonnet high on a hard-keyword plan.
- Raw tokens versus limit: `README.md` says the unit "understates savings from `haiku` steps and overstates a drop bought by moving work to `opus`".
- Size of the cost side: the only archived run with usage figures, `context/archive/2026-10-30-lesson-candidates/agent-smith/run.jsonl`, has 8 executed steps with figures, 1,035,316 tokens in total, and 111,700 to 156,742 tokens per step. A scorer step is unmeasured, but if it is of the same order as one step, it adds roughly one eighth of that run's tokens. A shift that changes the model or effort without changing tokens cannot repay that in a raw-token comparison.
- ADR-007 sets the default: "If the scorer does not save more than it costs, `score.minRigor` is set to `null` ... the step turns off" (`ADR-007:84`). The review's suggested wording "inconclusive, scorer stays on at `standard` only" reverses that burden of proof.
- The review's "spread of the off-arm pairs" cannot be computed from the planned data: each pair has one off run and one on run on a different change, and absolute totals across changes are not comparable. Run-to-run spread needs two runs of the same change with the same setting.

Decision (fixed before any run, for Phase 4 item 3 and Phase 5 item 3):

1. Add `tokens.byTier` to `readSide` and to the `--format md` output, keyed `model/effort` (additive; `byModel` and its existing test line stay). Record `byTier` of both arms next to `dropPercent` in ADR-007.
2. Keep the scorer on only when all hold over at least 5 comparable `--unpinned` pairs: the median `dropPercent` is above 0; the median pair-difference of opus tokens (on minus off) is 0 or less; and the median `dropPercent` is above the absolute `dropPercent` of one A/A pair (scorer off on both arms, same change, same alternation rules). The A/A pair costs two extra runs. If the owner drops it, the third condition becomes "inconclusive".
3. Any other outcome, including inconclusive, sets `score.minRigor` to `null` with no router change, as ADR-007 says.
4. State in the plan and in ADR-007 that 5 pairs give a screen and not a significance test, and that the `implement` effort shift has no raw-token effect and is not credited by this rule.

### F5. `signals.rigor` from a scorer (decision: drop it in code, and add the prompt rule as a second layer)

Observed:

- `cleanSignals` keeps `rigor` for every step (`route.mjs:386-399`), and `resolveRigor` raises the level from `signals.rigor` of every non-skipped entry (`route.mjs:537`). Only the pre-plan predicate `framingDoubt` limits itself to `research` and `domain-brief` entries (`route.mjs:987`).
- The shared suffix appended to every prompt (`route.mjs:1991`, `policy.json` `prompts.suffix`) says the subagent MAY add `signals.rigor`, and its RESULT example shows the key. A rule in `prompts/score.md` that forbids it contradicts the suffix, and a cheap model may follow either.
- A raise to `thorough` changes the budget (+5 over `standard` with the plan's deltas), the floors, the loops, the pool allowance (`extraSteps.allowance`: `standard` 2, `thorough` 3) and the executors.

Decision: in `cleanSignals`, skip `rigor` when `step === "score"` (same shape as the `lessonCandidates` branch at `:395-398`). Add a rule to `score.md` as a hint only. Add one test: a `score` result with `signals: { rigor: "thorough" }` leaves the level unchanged and the cleaned signals out of `run.jsonl`. Keep `needsHuman` for `score`, as ADR-007 requires.

### F6. Hard-coded budget tests (decision: add them to Phase 4 item 1, with a better search)

Observed (inspected: `skills/10x-pipeline/test/*.mjs`):

- `route.test.mjs:148-159`: "step budget differs per level: 10, 16, 21" builds logs of 10, 16 and 21 entries and matches `Step budget 16 spent` and `Step budget 21 spent`. With deltas +3 and +8 the budgets are 17 and 22, so the 16-entry and 21-entry cases would run instead of halting and the test turns red. The lean case (10) stays valid.
- `executors.test.mjs:683-691`: lean budget 10, unchanged by the new deltas.
- `loops.test.mjs:447` and `budget-executors.test.mjs:97` compute the budget from the shipped policy, so they follow the delta; `budget-executors.test.mjs:195`, `:203`, `:208` and `:262` pin `TABLE`, the delta object and the margin. `archive.test.mjs:849` and `:860` set `maxTotalSteps` to 1 and are not tied to the deltas.
- Docs with the old numbers: `README.md:47` and `:106`; `skills/10x-pipeline/SKILL.md:97` states no number. ADR-003 holds the history (`:56`, `:262`, `:272`, `:361`, `:394`) and keeps its dated text.

Decision: add `route.test.mjs:148-159` (budgets 10, 17, 22 and the test title) to Phase 4 item 1, and use `grep -n "budget\|Step budget\|maxTotalSteps" skills/10x-pipeline/test/*.mjs` as the search.

### F7. `compare --unpinned` flag handling (decision: copy the `init` flag pattern)

Observed:

- `parseFlags` returns `true` for a bare flag and the next argument when that does not start with `--` (`route.mjs:28-37`). `--unpinned false` gives the string `"false"`.
- `comparePair` rejects non-string values for `baseline`, `routed` and `format` only (`route.mjs:2191-2193`). `init` already has the pattern for boolean flags: a bare flag or `"true"` turns it on, `"false"` turns it off, anything else halts (`--archive`, `--chrome`, `route.mjs` `main`).
- `compare.test.mjs:609` is the mixed fixture without the new flag, so `baseline-unpinned` is not in that list. Only a test that passes `--unpinned` can see the new warning.
- The usage line is at `route.mjs:2333` and names `compare` without the flag.

Decision: in `comparePair`, accept `undefined`, `true` and `"true"` as on, `"false"` as off, and halt on any other value with `Invalid --unpinned <value>. Use --unpinned, --unpinned true or --unpinned false.` Add tests for `--unpinned false` (behaves as without the flag) and `--unpinned md` (halts). Update the usage line.

### F8. Stale anchors and review reference (decision: correct them)

Observed (`skills/10x-pipeline/test/preplan.test.mjs`): `:199` and `:857` define `overrideFile`; the file writes are at `:209` and `:859`. The other three sites, `:671`, `:676`, `:872`, are direct writes. The plan's References line cites `reviews/plan-review.md (F1 to F8)`, which this review replaced.

Decision: in Phase 1 item 3 and Current State Analysis, name the write sites `:209`, `:671`, `:676`, `:859`, `:872`. Change the References line to cite the review by date (2026-11-02) and drop F-ids, and point Decisions entries that say "review F1" and similar to this file's Follow-up 1 headings instead.

### F9. Scorer on in Phase 2, budget deltas in Phase 4 (decision: ship `minRigor: null` until Phase 4)

Observed:

- Phase 1 ships `score.minRigor: "standard"`; Phase 2 acts on it; `rigor.budgetDelta` changes in Phase 4 (`plan.md`). A real `standard` run between those phases has a longest path of 15 against a budget of 16, which breaks the "two steps to spare" pin of `budget-executors.test.mjs:203`.
- Moving the delta to Phase 2 would turn `longest path legal` red there (`max` 14 against an expected 15) unless the walker change of Phase 4 item 1 moves with it, which pulls most of Phase 4 forward.
- The repo flow is a branch merged by the owner as one rebase-merge PR (memory `branch-then-pr-merge`), and the PRD says nobody uses the plugin yet (`context/foundation/prd.md:121`). The intermediate states are never installed, so the risk is to commit-by-commit checkouts and bisects only.

Decision: Phase 1 ships `score.minRigor: null`. Phases 2 and 3 tests opt in with `policy: { score: { minRigor: "standard" } }` (the plan already does this). Phase 4 flips the default to `"standard"` in the same commit as the deltas and the walker. Update the Phase 1 data test and the manual check 2.5 (it uses an opt-in override). The `writeOverride` helper default stays as planned.

## Decisions for the plan revision

| Finding | Decision | Plan sections to edit |
| --- | --- | --- |
| F1 | Fix A; amend ADR-007 rule line; owner confirms at the pause before Phase 3 | Decisions (floor bullet), Phase 3 pause note, Phase 5 item 2 |
| F2 | Shared `riskMeasured` helper; down shift needs measured and no hit; `plan` down shift off (`down: null`) | Decisions, Phase 1 item 1 (policy data), Phase 3 items 1 and 3 |
| F3 | Add "no phase-count bump" guard for `implement`; state the narrow window | Decisions, Phase 3 items 1 and 3 |
| F4 | `byTier` in `compare`; opus guard; one A/A pair; inconclusive means off | Decisions (A/B rule), Phase 4 item 3, Phase 5 item 3 |
| F5 | Drop `rigor` for `score` in `cleanSignals`; test; prompt hint | Phase 1 item 2, Phase 2 item 3, Phase 3 test list |
| F6 | Add `route.test.mjs:148-159`; broaden the grep | Phase 4 item 1 |
| F7 | Boolean-flag check as in `init`; two tests; usage line | Phase 4 item 3 |
| F8 | Correct anchors and the References line | Current State Analysis, Phase 1 item 3, References |
| F9 | `minRigor: null` in Phase 1, flip in Phase 4 | Phase 1 item 1, Phase 4 item 1 |

## Code References

- `skills/10x-pipeline/scripts/route.mjs:28-37` - `parseFlags`
- `skills/10x-pipeline/scripts/route.mjs:386-399` - `cleanSignals`
- `skills/10x-pipeline/scripts/route.mjs:537` - `signals.rigor` read from every non-skipped entry
- `skills/10x-pipeline/scripts/route.mjs:715-743` - `measureRisk` (`hits`, `planPaths`, `unclassified`, `source`)
- `skills/10x-pipeline/scripts/route.mjs:786-791` - the "measured" test of the lean plan-review skip
- `skills/10x-pipeline/scripts/route.mjs:1595-1636` - `tierFor`, `settle`, the interactive-only floor at `:1624`
- `skills/10x-pipeline/scripts/route.mjs:1919` - risk measured only when `plan.md` exists
- `skills/10x-pipeline/scripts/route.mjs:2137-2143` - `compare` `byModel` keyed by model alias
- `skills/10x-pipeline/scripts/route.mjs:2189-2193` - `comparePair` flag checks
- `docs/ADR/ADR-003-rigor-gated-routing.md:58-62` - the effort floor is for interactive skills
- `docs/ADR/ADR-007-llm-complexity-scorer-as-a-routed-step.md:41`, `:84` - floor rule line; turn-off rule
- `skills/10x-pipeline/test/route.test.mjs:148-159` - literal budget test
- `skills/10x-pipeline/test/preplan.test.mjs:209`, `:671`, `:676`, `:859`, `:872` - override writes
- `skills/10x-pipeline/test/budget-executors.test.mjs:195-208`, `:262` - `TABLE`, delta pin

## Architecture Insights

- The router has one definition of "measured risk" in prose (README lean skip) and one in code (`decide()`); the shift is the second consumer, so a shared helper is the cheapest way to keep ADR-007's "MUST NOT override the churn risk axis" true.
- Every score-driven effect is a model or effort move, and `compare` counts raw tokens. The A/B rule therefore measures cost of the scorer well and benefit poorly; the revision should say so instead of implying the rule proves savings.
- The shared prompt suffix is global, so any step-specific rule that restricts a `signals` key needs a code guard, as the `lessonCandidates` branch of `cleanSignals` does.

## Historical Context (from prior changes)

- `docs/ADR/ADR-001-phased-complexity-routing.md` (status note) - Phase 2 scoring was deferred until deterministic signals proved weak; ADR-007 pulled it forward. Its caution that thresholds are untested heuristics still holds and matches F3 and F4.
- `docs/ADR/ADR-003-rigor-gated-routing.md` - origin of the effort floor, the budget deltas and the extra-step pool; edited in place with dated notes when the deltas changed (supports the F1 and F9 handling).
- `context/archive/2026-10-30-lesson-candidates/agent-smith/run.jsonl` - the only archived run with per-step usage figures used here (F4 size estimate).

## Related Research

Not applicable: no other change's `research.md` was read for this follow-up.

## Open Questions

- Owner: confirm the F1 reading of the effort floor at the pause before Phase 3, and say whether the A/A pair of F4 is worth two extra runs.
- The scorer's own token cost is unmeasured; the first live run (Phase 5 manual 5.4) is the first figure. Until then the F4 size estimate is an inference from other steps.
- Whether the `implement` effort down shift should be credited in the A/B rule by an effort-weighted measure is left open; the revision records that the rule does not credit it.
