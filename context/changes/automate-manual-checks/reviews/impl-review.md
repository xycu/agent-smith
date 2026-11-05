<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Verify Every Manual Row Automatically

- **Plan**: context/changes/automate-manual-checks/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-11-05
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 2 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | WARNING |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

Automated criteria, run on the code before the fixes and again after them: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` (762 tests, 760 pass, 0 fail, 2 skipped), `git diff --exit-code a1d7a98 -- skills/10x-pipeline/test/loops-existing.test.mjs` (no diff), `node tools/version-check.mjs` (OK 0.6.0), `test -f docs/ADR/ADR-012-automate-manual-checks.md` (exists). The per-file runs of rows 1.1-1.3, 2.1-2.2 and 3.1-3.3 are subsets of the full suite.

Code checked against the plan: `manualEligible` removed; `manualVerifyNext` opens at `minRigor` (`lean`), outside the pool (`extrasLeft` charges a `manual-verify` entry nothing), `retryBump` with `bumpWhy`, `maxAttempts` cap, template `manual-verify-nochrome` only for `meta.chrome === false`; `manual-verify` is not in `complexity.appliesTo` and has no simple discount, so the first attempt stays on `sonnet/medium` at every level; `verifyManual` records `proved` (kind from the base-name prefix, `other` otherwise) and `pending`; `readUnprovenReasons` rejects a symlinked folder or file, a file over 65536 bytes, a stale file and a file outside the real `evidence` folder, and keeps only known row ids; `manualNotProved`, the archive lines, the `## Manual checks` section and the `status` counts match the contract; `provenanceFlags.chrome` is `meta.chrome !== false`; `writeOverride` gains the `manualVerify` off-switch; budgets 12, 19 and 24; the removed keys appear nowhere in README.md, SKILL.md or policy.json (row 4.7's grep prints nothing).

## Findings

### F1 — SKILL.md entry still advertises a bare `--chrome` and does not strip a flag value

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: skills/10x-pipeline/SKILL.md:9, skills/10x-pipeline/SKILL.md:29
- **Detail**: Chrome is now on by default, so `--chrome false` is the only form that changes anything (README heading already reads `[--chrome false]`). The `argument-hint` still showed `[--chrome]`, and step 1 said "Remove each flag from the goal text" without saying that the value `false` after the flag goes with it, so an orchestrator could pass a bare `--chrome` and leave `false` in the goal text.
- **Fix**: Set the hint to `[--chrome false]` and say in step 1 that `--archive` and `--chrome` may carry `true` or `false`, removed from the goal text with the flag and passed to `init` with it.
- **Decision**: APPLIED — 83dfc17

### F2 — AGENTS.md command line still says `--chrome` picks the Chrome template

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: AGENTS.md:49
- **Detail**: Phase 4 updated the AGENTS.md test inventory but not the Commands entry for `init`, which still read "`--chrome` picks the `manual-verify` template that may use the Chrome tools (`--chrome false` turns it off)". That describes the old opt-in default and names no `manual-verify-nochrome` template.
- **Fix**: Rewrite the entry: Chrome tools on by default, `--chrome false` picks `manual-verify-nochrome`, `--chrome` or `--chrome true` changes nothing in effect.
- **Decision**: APPLIED — 83dfc17

### F3 — All 13 Manual rows of this plan are still pending; no `manual-verify` step ran in this run

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Success Criteria
- **Location**: context/changes/automate-manual-checks/plan.md:328-373, context/changes/automate-manual-checks/agent-smith/run.jsonl
- **Detail**: The plan's Implementation Note says the Manual rows "are proved by the manual-verify step of this very run", but the run log goes score, plan, plan-review, implement, impl-review with no `manual-verify` entry: the router that drives this run is the installed plugin, not the code on this branch. None of rows 1.7, 1.8, 2.5, 2.6, 3.6, 3.7, 4.5, 4.6, 4.7 is ticked. This review checked the substance of 4.5 and 4.7 (defaults agree across README, SKILL.md and ADR-012; the grep prints nothing) and read the prompt for 3.7, but did not tick rows, because evidence-backed ticking belongs to the step.
- **Fix**: Not a code fix. Run the rows by hand or with the new step (a run on this branch's router), or accept them as verified by the automated tests that cover them.
- **Decision**: PENDING — the owner decides whether the rows are proved by hand, by a later run on the new router, or accepted as covered by the test suite.

### F4 — `manualVerifyNext` never runs after an implementation review, so a `plan-rejected` re-plan's new Manual rows are not checked

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Scope Discipline
- **Location**: skills/10x-pipeline/scripts/route.mjs:1893
- **Detail**: The implementation added `log.some((e) => e.step === "impl-review")` as a stop condition. The plan's contract list does not name it, but it carries out A1 and the desired end state ("before the first implementation review") now that `maxRuns` is gone, and the implementer recorded it as an assumption. Side effect: after a first `REJECTED` review and a `plan-rejected` re-plan, the Manual rows of the new plan never reach the step and end as `manualPending` only.
- **Fix**: None needed for this plan. If the owner wants the rows of a re-plan checked, the guard could key on the last plan step instead of any impl-review.
- **Decision**: PENDING — owner decision whether a `plan-rejected` re-plan should reopen `manual-verify`; it is outside A1 as written.

### F5 — Test files outside the plan's list were edited for the new budgets

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: skills/10x-pipeline/test/route.test.mjs, skills/10x-pipeline/test/firstattempt.test.mjs
- **Detail**: Both pinned the old budgets (10, 17, 22) and were moved to 12, 19 and 24. Benign, needed for a green suite, and recorded by the implement step as an assumption.
- **Fix**: None.
- **Decision**: PENDING — no action proposed; recorded for the owner only.
