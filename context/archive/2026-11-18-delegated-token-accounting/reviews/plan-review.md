<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Delegated Token Accounting Implementation Plan

- **Plan**: context/changes/delegated-token-accounting/plan.md
- **Mode**: Deep
- **Date**: 2026-11-18
- **Verdict**: REVISE
- **Findings**: 0 critical, 1 warning, 0 observations

The verdict and counts describe the plan before this review's edits. F1 is applied; no findings remain pending.

## Verdicts

| Dimension | Verdict |
| --- | --- |
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | FAIL |
| Plan Completeness | PASS |

## Grounding

Grounding: 8/8 existing paths verified, 5/5 symbols verified, brief and plan consistent before review.

- Inspected `scripts/run-codex.mjs`, `flow.mjs`, `route.mjs`, `state.mjs`, `isolation.mjs`, `test/codex-helpers.mjs`, `test/late-usage.test.mjs` and `SKILL.md` under `skills/10x-pipeline/`. Planned new files are explicitly identified as new.
- Verified `settledDescendants`, `cleanUsage`, `attachResult`, `usageCommand` and `estimateCost`. The existing router owns result persistence, late attachment and archive recovery; read-only collectors fit that ownership.
- Read the full plan, brief, research and accepted lessons. The supplied bounded-child contract supersedes the historical flat-delegation lesson. One read-only native leaf checked the risky claims, caller blast radius and reusable patterns; all findings were reconciled by this review.
- Progress has four matching phase headings and 13 rows matching phase Success Criteria. Automated acceptance uses local checks, including permitted fake Git/GitHub checks; live host qualification stays Manual. No publication-dependent Automated criterion was found.
- The optional `docs/reference/contract-surfaces.md` convention is absent. No contract scan was required.

## Findings

### F1 — Producers precede scope-aware readers without an activation boundary

- **Severity**: WARNING
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped.
- **Dimension**: Blind Spots
- **Location**: Implementation Approach; Phases 2–4; Migration Notes — Expand.
- **Detail**: Phase 1 expands persistence, Phases 2–3 emit whole-step-tree `totalTokens`, and Phase 4 adds reader classification and mixed-scope comparison guards. The original Expand instruction instead promises readers before producers, without specifying that intermediate phase commits cannot be activated. Current `flow.mjs:111–142` renders and sums numeric tokens without evidence, and `route.mjs:568–575` checks numeric completeness without scope. Activating Phase 2 or 3 alone could therefore compare new subtree totals with legacy final-request counts and produce an unqualified savings verdict. Passing either phase's local suite would not prove the later reader protection exists.
- **Fix**: Deliver all four phases as one candidate; prohibit intermediate activation and mixed producer/reader revisions, and require integrated producer-to-intake-to-reader fixtures across both chains before activation. Keep current phase order and Progress rows intact; no runtime switch or intermediate release is needed.
- **Decision**: APPLIED — changed Implementation Approach, Phase 4 / Reader compatibility regressions, Testing Strategy and Migration Notes / Expand; synchronized plan-brief.md / Delivery and Architecture / Approach. All Progress indices, titles and checkbox states are preserved.

## Assumptions and scope

- Atomic activation is an evidence-backed unattended choice: current readers cannot identify the new scope, and the plan already retains one installed revision through invocation settlement/intake. Completing the candidate before use avoids another configuration mechanism or moving implementation work between phases.
- The supported-host fallback is deliberate: unsupported or incomplete native telemetry produces unavailable tokens without blocking execution. Deterministic fixtures do not certify live interactive/headless support; the existing Manual rows retain that boundary.
- Caller sweep found direct `estimateCost` shape assertions in `skills/10x-pipeline/test/ladder.test.mjs:551`; preserve its existing return shape or update those assertions if Phase 4 adds estimator metadata. This is covered by the plan's existing relevant-contract-test scope and full suite.
- Only plan.md, plan-brief.md and this report were edited. The pre-existing router-state change was left untouched. No commit or publication was performed.
- Child token coverage is unknown; no enclosing token total is claimed.

## Validation

Passed a read-only Node assertion check: Progress is byte-identical to HEAD (13 rows), all four phases' criteria match Progress, the repository's `readReview` parser sees REVISE with 0 critical and 1 warning and F1 as APPLIED, all eight grounding paths exist, and changed paths are restricted to the three authorized documents plus the pre-existing router-state change. `git diff --check` passed. Implementation tests and live telemetry qualification were not run; they remain the plan's implementation gates.
