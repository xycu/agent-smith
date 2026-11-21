<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Plan With No Readable Progress Rows Must Not Skip Implement

- **Plan**: context/changes/plan-zero-rows-skips-implement/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-11-21
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Evidence

- Diff reviewed: `52f6a179..HEAD` (commits f4fbfefa, 1e1e3f4f, 912fd1fe): `skills/10x-pipeline/scripts/state.mjs`, `skills/10x-pipeline/scripts/flow.mjs`, `skills/10x-pipeline/rules/steps/plan.md`, `skills/10x-pipeline/rules/README.md`, `skills/10x-pipeline/test/plan-rows.test.mjs`, `skills/10x-pipeline/test/route.test.mjs`, `skills/10x-pipeline/test/README.md`, `docs/REFERENCE.md`. Every planned file is in the diff; the only unplanned file is `route.test.mjs`, the fixture update the plan's Phase 2 tests contract foresees (rule count 26 to 27).
- `fencedLines`, `readPlan` and `readFindings` match the Phase 1 contract (up to three spaces of indent, backtick or tilde, closing run at least as long, `\r` stripped, unclosed fence to the end, `shortcut:` comment present).
- Verification in `attachResult` and the `planRetry` branch in `decide` match the Phase 2 contract; the retry is bounded by `escalation.maxAttemptsPerStep` (`route.mjs:204`), and the test asserts the halt and that no pre-plan or score step is scheduled again.
- Archived reviews: a scratch script imported the `state.mjs` of `git merge-base HEAD main` and the new one and compared `readReview(...).findings` over 202 `context/archive/*/reviews/*.md` files: 0 differences.
- Automated criteria, run before and after the fixes: Phase 1, 2 and 3 subsets pass (plan-rows 17/17, readers, re-plan, pre-plan, loop, prompt and rule pins 312/312), the grep criteria 2.4, 3.1 and 3.2 match, the 3.4 smoke check in a scratch project returns `plan` then `plan` with `plan.md has no pending Automated Progress row (read 0 rows)`, and the full suite passes (2129 tests, 2126 pass, 0 fail, 3 skipped) both on the reviewed code and after commit 082bcc0d.
- Manual 3.6 (the next wave plan uses `- [ ]` rows) stays pending: it is a pre-merge check of another run, acknowledged, not a finding.

## Findings

### F1 — Retry change also altered the existing first-plan reason text

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: skills/10x-pipeline/scripts/flow.mjs:790
- **Detail**: The reason of the first `plan` step was `... (goal: plain)`; the rewritten template prints `(goal:plain)` (the space after `goal:` was dropped). The plan only adds a third reason variant; it does not change the existing ones. Earlier `run.jsonl` files and reports carry `(goal: plain`, so the output changed for every run with no plan in scope (lesson: grep for old behavior when a script's output changes).
- **Fix**: Restore the space: `(goal: ${kind}...)`.
- **Decision**: APPLIED - 082bcc0d restores `(goal: ${kind}` in the first-plan reason; smoke `next` prints `(goal: short)`.

### F2 — `planRetry` recomputes the code-ran check instead of reusing `codeRan`

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: skills/10x-pipeline/scripts/flow.mjs:776
- **Detail**: The Phase 2 contract computes the retry boolean "from `log`, `lp` and `codeRan`". The code repeats `log.some((e) => e.step === "implement" || e.step === "fix")`, and the same expression is computed again as `codeRan` a few lines later. Two copies of one rule can drift.
- **Fix**: Hoist `const codeRan = ...` above the `planRetry` line and use it in both places.
- **Decision**: APPLIED - 082bcc0d hoists `codeRan` above `planRetry` and uses it in both checks.

### F3 — Archive-equivalence test finds the archive through `process.cwd()`

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: skills/10x-pipeline/test/plan-rows.test.mjs:126
- **Detail**: `ARCHIVE = path.resolve(process.cwd(), "context/archive")`. Run from any directory other than the repository root, the archive-equivalence case skips with "no context/archive here", so the pin of Phase 1 silently disappears. Sibling tests that read repository files (`archive-gate.test.mjs:10`, `change-status.test.mjs:16`) resolve the root from `import.meta.url`.
- **Fix**: Resolve `ROOT` from `import.meta.url` (`path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..")`) as `archive-gate.test.mjs` does.
- **Decision**: APPLIED - 082bcc0d resolves `context/archive` from `import.meta.url`; the archive case passes when the test runs from `/tmp`.
