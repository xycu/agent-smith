<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Plan With No Readable Progress Rows Must Not Skip Implement

- **Plan**: context/changes/plan-zero-rows-skips-implement/plan.md
- **Mode**: Deep (claims checked inline against the code; no sub-agent)
- **Date**: 2026-11-20
- **Verdict**: REVISE
- **Findings**: 0 critical, 4 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | WARNING |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

Grounding: 9/9 paths and line anchors checked (`state.mjs:318`/`:363`, `flow.mjs:607`/`:747`/`:772`, `steps.mjs:515`, `route.mjs:100-118`/`:204`, `docs/REFERENCE.md:61`/`:126`) ✓, 6/6 symbols (`readPlan`, `readFindings`, `verifyCodeReplan`, `CODE_REPLANS`, `lastIdx`, `openCounts`) ✓, brief↔plan ✓. Progress↔Phase consistency ✓ (3 phases, every Success Criteria bullet has its row). No Automated criterion needs a pushed branch, PR, PR CI or PR comment; the smoke check 3.4 runs in a local scratch project.

## Findings

### F1 — A first plan with only ticked Automated rows still skips implement

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: End-State Alignment
- **Location**: Phase 2 — 2. Retry of a failed first plan; test case (c)
- **Detail**: The retry fires only when the plan reads "zero pending and zero done Automated rows". Test (c) says a plan with only ticked Automated rows is "not verified", but a failed first plan with ticked-only rows has `autoDone > 0`, so the retry does not fire. `decide` then sees `hasProgress`, `lp < 0`, schedules `plan-review` (`flow.mjs:795`), and with `plan.autoPending == 0` reaches `impl-review` "implementation complete" with no `implement`. That is the defect, left open for one row shape. The `autoDone` clause is not needed: a user-supplied plan has no `plan` entry in the log, so the entry tests (`template plan`, not ok, `lp < 0`, no code) already exclude it.
- **Fix**: Drop the "zero done" clause (retry on zero pending Automated rows), say why in the Intent, and make test (c) assert that `next` returns `plan` again for the Manual-only and the ticked-only plan; align the brief.
- **Decision**: APPLIED — plan.md Phase 2 "2. Retry of a failed first plan" Intent, and Phase 2 "4. Tests" Contract (c); plan-brief.md Key Decisions row "Retry of a failed first plan".

### F2 — The retry sits in a branch that its own case never enters

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Phase 2 — 2. Retry of a failed first plan
- **Detail**: The plan puts the retry in "the branch that schedules `plan` when there is no plan or no Progress, line 772". That branch is guarded by `!plan.exists || !plan.hasProgress`. The retry case is the opposite: `hasProgress` is true (the plan has a heading and zero readable rows). An implementer who edits only the body of that branch leaves `decide` falling through to the `plan-review` scheduling at `flow.mjs:795`, and the CLI test (a) fails after the fact. The contract also does not say how the retry interacts with `preplanNext` and `scoreNext`, which run first in that branch.
- **Fix**: State that the guard widens with a boolean computed from `log`, `lp` and `codeRan` before the branch, so the retry returns before the `prFresh` check; keep the branch body (goal-class bump, pre-plan, score) and have the retry test assert that no second pre-plan or score step is scheduled.
- **Decision**: APPLIED — plan.md Phase 2 "2. Retry of a failed first plan" Contract.

### F3 — The archive-equivalence test is a time bomb on a growing corpus

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 1 — 3. Tests, case (e); Success Criteria 1.2
- **Detail**: Case (e) compares the new reader with a copy of the old one on every `context/archive/*/plan.md`. `context/archive/` gains a plan with every finished change. A future plan that quotes a fenced `## Progress` or a fenced `- [ ]` row inside its Progress section (the exact case this change fixes, and a plausible topic for a later change) reads differently by design and turns the test red, with the archive read-only so nobody can "fix" the input. The test also passes vacuously when the folder is empty or absent.
- **Fix**: Compare only archived plans with no fence line at or after their `## Progress` heading, and assert that at least one plan was compared.
- **Decision**: APPLIED — plan.md Phase 1 "3. Tests" Contract, case (e).

### F4 — Phase 2 is declared green without running the suite that can break it

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Implementation Approach ("each leaving the suite green"); Phase 2 — 4. Tests; Success Criteria 2.1 to 2.4
- **Detail**: The Current State section admits the trial run stopped before finishing, so whether an existing fixture verifies a `plan` step on a plan with no pending Automated row is unknown. Phase 2 tells the implementer to fix such fixtures but its criteria run only a subset (`codereplan`, `preplan`, `loops`, `loops-existing`, `step-safety`, `rule-levels`, `provenance`). Fixtures in `route`, `isolation`, `rollback`, `budget-*` and others are found only at row 3.3, after Phase 2 is closed, which contradicts the approach statement.
- **Fix**: Add to the Phase 2 test contract that the full suite of row 3.3 runs once at the end of Phase 2. No Progress row is added or renamed.
- **Decision**: APPLIED — plan.md Phase 2 "4. Tests" Contract.

### F5 — An unclosed fence in a review has no test for the "never cleaner" rule

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 — 1. Fence tracker (unclosed fence runs to the end) and 3. Tests, case (f)
- **Detail**: Review files are model-written and a stray fence line is plausible. With the new tracker, an unclosed fence in `F2` folds every later `### F<n>` block into `F2`, so later blocks and their `**Decision**` lines are not listed. `openCounts` (`state.mjs:547-551`) adds the header's extra critical and warning counts as open, so the result is conservative, but nothing in the plan pins that, and the lesson "Never read a verdict as cleaner than its listed findings" applies.
- **Fix**: Add the case to test (f).
- **Decision**: APPLIED — plan.md Phase 1 "3. Tests" Contract, case (f).

### F6 — A zero-row plan supplied by the user at `init` still ends in `done`

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: End-State Alignment
- **Location**: What We're NOT Doing (bullet 2); Desired End State
- **Detail**: The plan deliberately leaves a `plan.md` supplied at `init` unchanged. A supplied plan with a `## Progress` heading and `rows == 0` (written as `* [ ]`) has no `plan` entry, so the new verification never runs; `decide` reads it as finished work and can return `done` with no `implement`, the same end result as the audited defect. A plan with zero rows is not a plan "whose rows are all done on purpose", so the `change.md` constraint does not forbid a halt for it. Whether to halt there is a scope decision (it widens the change from verifying a step to judging every read), so it is not applied here.
- **Fix**: Either add one halt in `decide` for `hasProgress && rows == 0` (reason: "plan.md has a Progress section but no readable row"), or record the residual gap in What We're NOT Doing.
- **Decision**: PENDING — the owner must decide whether a zero-row plan supplied at `init` halts (scope widens beyond the `plan` and `plan-revise` steps) or stays a documented residual gap; an observation does not count as open for routing.
