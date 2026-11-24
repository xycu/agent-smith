<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Development Test Scope Implementation Plan

- **Plan**: context/changes/dev-test-scope-top-rule/plan.md
- **Mode**: Deep (claims verified inline against the code, no sub-agent)
- **Date**: 2026-11-24
- **Verdict**: REVISE
- **Findings**: 0 critical, 2 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

Grounding: 9/9 paths and links resolve (`top.md`, `rules.test.mjs`, `rules/README.md`, `flow.mjs#L1067` `ruleTail`, `rule-levels.test.mjs`, `agents-md-size.test.mjs`, `skill-loop.test.mjs`, `ci.yml`, `WAVES.md`), `7568c862` is an ancestor of HEAD, brief and plan agree, Progress rows 1.1 and 1.2 match the phase criteria. Automated row 1.1 is local only; the CI check is already Manual (row 1.2), so no publication-dependent Automated row exists.

## Findings

### F1 — A skill or plan row that demands the full suite has no defined outcome

- **Severity**: WARNING
- **Impact**: MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 1, change 1 (`top.md` contract); Testing Strategy
- **Detail**: The plan says a row that names the full suite "still calls for only the covering local tests", but never says what the step does with that row: skip it, tick it, or report it. An implementer or verifier following a Wave 4 style row ("The required Node test suite passes") would either tick an unrun row or stall. The rule is the only text the step sees, so it has to decide the case.
- **Fix**: State in the rule that a skill gate or plan criterion naming the full suite counts as met by the covering test files, and that CI owns the full-suite result. Applied to the `top.md` contract and the rule regression.
- **Decision**: APPLIED — Phase 1, change 1 (`top.md` contract) and change 2 (rule regression) in plan.md.

### F2 — `docs/REFERENCE.md` lists the contents of `top.md` and the plan leaves it stale

- **Severity**: WARNING
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Scope; Phase 1 Changes Required
- **Detail**: `docs/REFERENCE.md` line 405 enumerates what `top.md` holds (unattended subagent, short status, Git, delete rules, nesting rule, precedence, `RESULT:`). A new rule in `top.md` makes that list incomplete. The plan updates the `rules/README.md` index but not this list.
- **Fix**: Add a docs-only change 4 for the list in `docs/REFERENCE.md` and widen Scope and the brief to name it.
- **Decision**: APPLIED — Scope, new Phase 1 change 4 (Reference list) in plan.md, and Scope in plan-brief.md.

### F3 — "once" and "the user's request" are undefined at the tie

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1, change 1 (`top.md` contract)
- **Detail**: "A local full-suite run once" does not say per step, per run or per session. "At the user's request" does not say where that request can come from; a plan row or skill gate could claim it, which would reopen the exception the rule closes.
- **Fix**: Say once per step, and that the request is the user's own message or the run goal, never a skill gate or plan row.
- **Decision**: APPLIED — Phase 1, change 1 (`top.md` contract) and change 2 (rule regression) in plan.md.

### F4 — Other tests read `top.md` by line and are not in the verification row

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 Automated Verification; Testing Strategy
- **Detail**: `nested-subagents.test.mjs` filters `top.md` lines with "calls for delegation" and expects exactly one match. `no-recursive-delete.test.mjs` finds its rules by `rm -rf` and `recursive: true`. A new line that reuses those phrases would break them, and by the plan's own rule they cover `top.md`. Row 1.1 runs neither. The Progress row cannot be edited in this review.
- **Fix**: Keep the new line free of both phrases (stated in the `top.md` contract) and name both tests in the Testing Strategy as covering tests to run if the line could match.
- **Decision**: APPLIED — Phase 1, change 1 (`top.md` contract) and Testing Strategy in plan.md.
