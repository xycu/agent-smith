<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Measure the first-attempt tier drop

- **Plan**: [plan.md](../plan.md)
- **Scope**: Full plan
- **Reviewed phases**: 1
- **Date**: 2026-11-23
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 2 warnings, 0 observations

## Verdicts

| Dimension | Verdict |
| --- | --- |
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

The verdict and counts describe the implementation before triage. Phase 1 had all three automated rows complete. The review read both phases and checked Phase 2's pending status against the operator evidence. The reviewed implementation is `7eb8d841`, with workflow evidence through `d5de78cd`. [Progress](../plan.md#progress) · [Manual verification evidence](../evidence/judgment-experiment-readiness.md)

## Findings

### F1 — The decision rule omits terminal guards for excluded pairs

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision with a narrowly scoped fix
- **Dimension**: Plan Adherence
- **Location**: `docs/ADR/ADR-010-run-worktree-step-commits-and-rollback.md:173` at `7eb8d841`
- **Detail**: The rule scoped all three conditions to comparable pairs, while the plan and the protocol's terminal evidence step apply the halt and rigor guards to all otherwise controlled A/B pairs. The comparator requires both sides to end `done`, so the comparable sample can omit the routed halt that should prevent enabling the drop. [Plan decision boundaries](../plan.md#implementation-approach) · [Comparator outcome check](../../../../skills/10x-pipeline/scripts/route.mjs#L614)
- **Fix**: Use the first five eligible A/B pairs for the token and failed-implement checks. Apply the terminal guards to all otherwise controlled A/B pairs and require resolution of a routed noncompletion against a done baseline.
- **Decision**: APPLIED in `dee25132`.

### F2 — Claude evidence can disappear before each arm is reconciled

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision with a narrowly scoped fix
- **Dimension**: Safety & Quality
- **Location**: `docs/ADR/ADR-010-run-worktree-step-commits-and-rollback.md:166` at `7eb8d841`
- **Detail**: The protocol placed invocation reconciliation and late usage intake in the pair comparison step without setting a deadline for each fresh Claude session. The launcher deletes its projected hook and telemetry records on exit. Some requests have no transcript entry, so reconciling an arm after exit can leave missing usage or an unproven exclusion in a paid experiment. [Capture lifecycle and limits](../../../../docs/REFERENCE.md#accounting-activation-and-rollback) · [Launcher cleanup](../../../../skills/10x-pipeline/scripts/claude-capture.mjs#L195)
- **Fix**: Reconcile the qualification run and each Claude arm after their invocations settle and before exiting their launcher sessions. Finish eligible late usage intake and retain the invocation-to-ledger evidence privately.
- **Decision**: APPLIED in `dee25132`.

## Verification

| Phase 1 criterion | Result before and after triage |
| --- | --- |
| `node --test skills/10x-pipeline/test/firstattempt.test.mjs` | 12 passed, 0 skipped on Node.js 24.19.0. The linked-worktree fixtures cover shipped `0` and explicit `0` and `1`. |
| `node --test --test-concurrency=2 skills/10x-pipeline/test/{compare,codex-usage}.test.mjs` | 62 passed, 0 skipped on Node.js 24.19.0. |
| `rg -n -i 'first.?attempt\|firstAttempt\|tier lower\|savings' README.md docs` and a JSON policy check | PASS. The shipped drop is `0`, first-attempt measurement is pending, and ADR-007 reports its separate scorer experiment. |

Phase 2 rows 2.1 through 2.3 remain pending for the authorized operator. They require exact-host qualification, live paired results or documented exclusions and a stop, and a final policy decision with closeout checks. [Phase 2 criteria](../plan.md#phase-2-measure-live-and-record-the-default-decision)

Two read-only review agents checked plan adherence and safety. Their token coverage is unknown.
