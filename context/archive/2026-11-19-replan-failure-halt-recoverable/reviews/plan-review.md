<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Recovering from a failed re-plan

- **Plan**: context/changes/replan-failure-halt-recoverable/plan.md
- **Mode**: Deep (claims checked against the code directly; no sub-agent, per ADR-018)
- **Date**: 2026-11-21
- **Verdict**: SOUND
- **Findings**: 0 critical, 1 warning, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS |
| Plan Completeness | WARNING |

## Grounding

9/9 paths exist, 8/8 symbols found (`verifyCodeReplan`, `needsHumanAck`, `trailingFailures`, `lastIdx`, `rollback`, `undoRollback`, `finishRun`, `codeReplanNext`), brief and plan agree, Progress rows 1.1 to 1.4 match the Success Criteria bullets, no publication-dependent Automated row. The only reader of a failed `plan-replan` as last entry is `flow.mjs:858`. The `kept` flag set by `undoRollback` stops a second rollback of the failed entry on resume. `policy.json` has `codeReplan.max: 1`, so the cap is spent by the failed attempt, as the plan states.

## Findings

### F1 — The pre-change halt record is not defined

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Migration Notes and Assumptions (legacy timestamp evidence)
- **Detail**: The legacy path applies "when the old outcome identifies the halt" and "a pre-change entry with the recorded re-plan halt". The plan never says which record identifies it or how it is matched. Nothing on the failed entry marks the old halt. The only trace is the text in `meta.outcome.reason`, and `meta.outcome` is rewritten by every call. This change rewrites that text, so a matcher and its test fixtures can drift apart. Row 1.2 names legacy recognition, so the legacy branch itself cannot be dropped without changing a Progress row title.
- **Fix**: Define it. A pre-change entry is a failed `plan-replan` with no baseline field, a numeric `finishedAt`, and a `meta.outcome` read at the start of the call that is a halt whose reason starts with the old text `The re-plan after`. Keep that prefix as one shared constant.
- **Decision**: APPLIED — Migration Notes and Assumptions (third bullet) of plan.md now define the record and the shared prefix constant.

### F2 — Field names and gate placement are left open

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1, change 1 (Router recovery), Contract
- **Detail**: The Contract says the failed entry "owns" an acknowledgement and fingerprint, and lists `route.mjs`, `flow.mjs` and maybe `state.mjs`. It names no log fields and does not say where the baseline is read, where the check runs and what `decide()` does with the old halt. The baseline must be read before `rollback()` in `route.mjs`, and `flow.mjs` cannot import `route.mjs` (module order in AGENTS.md). An implementer could split the work in a way that breaks the order or the rollback timing.
- **Fix**: Name the additive fields (`replanAck`, `planBaseline`). Read the baseline before `rollback()` in `next()`, set both beside the `needsHumanAck` block, run the recovery check as a helper exported from `flow.mjs` and called from `next()` before `decide()`, and let `decide()` pass an acknowledged entry past the old halt.
- **Decision**: APPLIED — Phase 1, change 1 Contract of plan.md now names the fields and the placement.

### F3 — The halt text does not say which checked rows to keep

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Desired End State and Phase 1, change 1 Contract
- **Detail**: The halt asks the owner to keep "previously checked Automated rows", but the owner cannot tell which ones from the halt. The failed entry holds the list in `before.done`, and `verifyCodeReplan` already compares against it.
- **Fix**: Have the first halt and the repeat halt name the row IDs, and name the missing ones when the check fails on them.
- **Decision**: APPLIED — Desired End State and Phase 1, change 1 Contract of plan.md now say the halt lists the IDs and names the missing ones.
