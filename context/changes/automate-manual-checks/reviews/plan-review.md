<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Verify Every Manual Row Automatically

- **Plan**: context/changes/automate-manual-checks/plan.md
- **Mode**: Deep (claims checked by the reviewer against `route.mjs`, `policy.json`, the tests and the docs; no sub-agent)
- **Date**: 2026-11-05
- **Verdict**: REVISE
- **Findings**: 0 critical, 2 warnings, 4 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

Grounding: 10/10 paths and symbols checked (`manualEligible`, `manualVerifyNext`, `verifyManual`, `evidenceOk`, `extrasLeft`, `tierFor` bump, `budgetSteps`, `provenanceFlags`, `writeOverride`, `PINS["manual-verify"]`) and the line ranges match; `a1d7a98` resolves in the worktree; the pool, tier, bump and budget arithmetic (14+5-2=17 at standard, 14+10-2=22 at thorough, 10 at lean) is consistent with `budget-executors.test.mjs`; brief and plan agree. Progress rows 1.1 to 4.7 match the Success Criteria one to one (two wording mismatches, F4).

## Findings

### F1 — Evidence of unrestricted proofs is committed with no rule against secrets

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 3 — The prompt rules (safety bullet); `change.md` safety constraints
- **Detail**: Any row is now in scope, and the subagent may run arbitrary commands, throw-away scripts and Chrome page reads, then save the output under `evidence/`. In an isolated run the step commit does `git add -A`, so `evidence/` lands in the run branch (and later in the archive and any pull request). The safety rules cover pushing, publishing, git writes, hanging commands and Chrome sign-in, but none says what must not be written into the evidence itself. A `env`, `curl -v` or page dump can carry tokens or personal data, and the router never reads evidence content.
- **Fix**: Add one safety rule to the prompt: never write a credential, token, environment dump or personal data into an evidence file or judgment (redact before saving), because the step commit stores `evidence/` in the run branch.
  - Strength: One line in the same bullet; matches how the other limits are enforced (prompt only, A8).
  - Tradeoff: Prompt-only, so it is as strong as the model's compliance.
  - Confidence: HIGH — the commit path (`git add -A` in the isolated step commit) is documented in README "Run isolation".
  - Blind spot: No router-side secret scan; out of scope by A8.
- **Decision**: APPLIED — plan.md Phase 3, "The prompt rules" safety bullet.

### F2 — Phase 4 doc targets miss stale budget numbers

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 4 — README and SKILL.md edits
- **Detail**: The budgets move from 10, 17 and 22 to 12, 19 and 24, but the Phase 4 list names only the README "Budget" section. Other places state the old numbers: the README "Rigor" bullet (`rigor.budgetDelta`: -4, +3 and +8, so 10, 17 and 22), the confirmation-round example under "Review routing on open findings" (`{ "standard": 5 }` "for the shipped `3`"; it becomes 7 for the shipped 5), the README `lean` sentence about a budget of 10, and the SKILL.md step-budget bullet. Success criterion 4.7 greps only the removed keys, so stale numbers would pass. The plan itself names "docs drifting from policy numbers" as a risk.
- **Fix**: Name those four places in the Phase 4 README and SKILL.md intent.
- **Decision**: APPLIED — plan.md Phase 4, "README" and "SKILL.md, prompts README, AGENTS.md" intents.

### F3 — Two existing assertions the plan does not name

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 tests (`budget-executors.test.mjs`); Phase 3 tests (`provenance.test.mjs`)
- **Detail**: (a) "failure path fits" ends with a `stacked` run that asserts a halt with `Step budget \d+ spent`. The plan says only that the failure path "still ends inside the budget". With the budget up by 2 that run may end differently. (b) The provenance resume case (`--chrome` after the record, `provenance.test.mjs` around line 215) exists to show that a changed flag does not rewrite the record; once an absent flag reads as Chrome on, `--chrome` changes nothing and the case no longer tests that.
- **Fix**: Name both in the plan: re-derive the `stacked` script (or assert the halt it now ends with) and keep the never-past-the-budget assertion; pass `--chrome false` in the provenance resume case.
- **Decision**: APPLIED — plan.md Phase 1 "Tests" and Phase 3 "Tests".

### F4 — Two Success Criteria bullets differ from their Progress rows

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3 Manual bullet 2 (row 3.7); Phase 4 Automated bullet 4 (row 4.4)
- **Detail**: The phase bullets read "Read `prompts/manual-verify.md` as a stranger: ..." and "ADR-012 exists and the README names it or its decision: ..." while Progress rows 3.7 and 4.4 carry other wording. The mapping is by position, so nothing breaks, but a title-based gate check would not match.
- **Fix**: Make the two phase bullets read exactly like their Progress rows (the Progress rows stay as they are).
- **Decision**: APPLIED — plan.md Phase 3 and Phase 4 Success Criteria bullets.

### F5 — `manualNotProved` and `manualPending` overlap

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Phase 2 — Outputs
- **Detail**: The `done` message, `meta.outcome` and the archive lines already carry `manualPending` (the pending rows). `manualNotProved` lists the same rows with reasons. The plan does not say whether one replaces the other, so an implementer could drop `manualPending` and break the tests that pin it.
- **Fix**: State that `manualNotProved` is additive and `manualPending` and its archive lines stay unchanged.
- **Decision**: APPLIED — plan.md Phase 2, "Outputs" intent.

### F6 — Evidence kind rule leaves the no-dash name undecided

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2 — Evidence kinds
- **Detail**: "The part of the file's base name before the first `-`" gives the whole name for `judgment.md` (no dash), and the plan does not say whether that is `judgment` or `other`, nor that the base name is the last path segment for a subfolder token.
- **Fix**: Decide it in the plan: base name is the last segment; no `-` means no prefix, so `other`.
- **Decision**: APPLIED — plan.md Phase 2, "Evidence kinds" intent.
