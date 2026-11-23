<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Measure the first-attempt tier drop

- **Plan**: [plan.md](../plan.md)
- **Mode**: Deep
- **Date**: 2026-11-23
- **Verdict**: REVISE
- **Findings**: 2 critical, 3 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
| --- | --- |
| End-State Alignment | WARNING |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | FAIL |
| Plan Completeness | WARNING |

## Grounding

Verified 6/6 implementation paths, including the policy, routing test, ADR-010, ADR-007, reference and README. Verified the tier, failure, policy, isolation, capture and comparison contracts against their implementations. The brief matches the plan's scope and phases. Both documents carried the same unconfirmed interim decision. All six Progress rows match the phase criteria. The three Automated rows are local. The live rows belong to the operator and can stay pending at router completion. [Router completion](../../../../skills/10x-pipeline/scripts/flow.mjs#L891) · [Manual verification dispatch](../../../../skills/10x-pipeline/scripts/steps.mjs#L285)

## Findings

### F1 — The per-arm override can disappear or enter the run commits

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM (non-trivial protocol edit)
- **Dimension**: Blind Spots
- **Location**: Phase 2, paired worktree setup
- **Detail**: A normal launch from the original checkout selects the same branch for one change ID. Fresh worktrees accept two specific names. The router's initial commit includes only the change folder. Successful steps sweep changes elsewhere, and a failed step can reset a modified tracked override to its base content. This repository tracks the override path. [Fresh branch validation](../../../../skills/10x-pipeline/scripts/run-identity.mjs#L83) · [Setup branch selection](../../../../skills/10x-pipeline/scripts/prepare-run.mjs#L350) · [Start and step commits](../../../../skills/10x-pipeline/scripts/isolation.mjs#L479) · [Rollback](../../../../skills/10x-pipeline/scripts/isolation.mjs#L796)
- **Fix**: Precreate the accepted branches at one common disposable base, use ignored local overrides outside the index, and verify equivalent readiness before opening fresh native sessions. This preserves the same base and policy through retries. Precreated arms need explicit readiness because the setup gates run during the fresh copy. Confidence is high based on the branch and Git paths. Live operator setup remains to be qualified. [Paired worktree precedent](../../../../docs/REFERENCE.md#baseline-comparison) · [Setup gates](../../../../skills/10x-pipeline/scripts/prepare-run.mjs#L503)
- **Decision**: APPLIED in Phase 2, “Qualify the host and run the cohort” and its Overview, and in the brief's “Architecture / Approach”.

### F2 — The Claude qualification requires an unavailable evidence source

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW (quick, narrowly scoped fix)
- **Dimension**: Blind Spots
- **Location**: Phase 2, host qualification
- **Detail**: The launcher uses telemetry, but the verified ledger source is `claude-native`. The accounting reader would never qualify the planned `claude-otel` source. [Collector](../../../../skills/10x-pipeline/scripts/claude-usage.mjs#L385) · [Accounting validation](../../../../skills/10x-pipeline/scripts/usage.mjs#L63)
- **Fix**: Require verified `claude-native` evidence with `step-tree` scope on the chosen host.
- **Decision**: APPLIED in Phase 2, “Qualify the host and run the cohort”, and in the brief's prerequisites.

### F3 — The frame reserves the interim policy decision for the owner

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW (one explicit policy decision)
- **Dimension**: End-State Alignment
- **Location**: Overview and Decisions taken without a human
- **Detail**: The frame records approval to measure and explicitly reserves whether to ship `0` now or keep `1` through a dated measurement window. The plan presents `0` as settled. The existing ADR supports `0` while evidence is insufficient and the frame records a separate approval point. [Frame](../frame.md#open-for-the-owner) · [ADR-010 decision rule](../../../../docs/ADR/ADR-010-run-worktree-step-commits-and-rollback.md#decision-rule)
- **Fix**: Record the owner's interim choice before implementing the default. The plan and brief identify `0` as the proposal pending confirmation.
- **Decision**: PENDING because the frame reserves this choice for the owner. The owner must confirm shipping `0` before measurement or approve keeping `1` with a dated ADR-010 amendment.

### F4 — Provenance can hide a scorer difference or reveal mid-run drift

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW (quick, narrowly scoped fix)
- **Dimension**: Blind Spots
- **Location**: Phase 2, comparison eligibility
- **Detail**: The protocol asks the operator to document expected warnings without listing them. Default `--unpinned` provenance exempts scorer differences and flags but can report other settings and drift as warnings while still returning a token result. [Provenance contract](../../../../docs/REFERENCE.md#baseline-comparison) · [Comparator](../../../../skills/10x-pipeline/scripts/route.mjs#L619)
- **Fix**: Specify the expected A/B and A/A provenance differences, check the scorer settings independently and exclude policy drift.
- **Decision**: APPLIED in Phase 2, “Qualify the host and run the cohort”, and in the brief's “Architecture / Approach”.

### F5 — Guard tests can pass with the first-attempt feature disabled

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW (quick, narrowly scoped fix)
- **Dimension**: Plan Completeness
- **Location**: Phase 1, routing regression
- **Detail**: Some existing assertions expect no first-attempt drop. Once the shipped value is `0`, a test that fails to opt in can pass without exercising the isolation, simple-change or previous-failure guard. The comparison tests explicitly inject `cheap` and are independent of the default. [Routing tests](../../../../skills/10x-pipeline/test/firstattempt.test.mjs#L67) · [Prior-failure case](../../../../skills/10x-pipeline/test/firstattempt.test.mjs#L103) · [Comparison cases](../../../../skills/10x-pipeline/test/compare.test.mjs#L611)
- **Fix**: Opt in explicitly in guard tests and keep the shipped-default assertion separate.
- **Decision**: APPLIED in Phase 1, “Shipped policy and routing regression”.

### F6 — The A/A denominator needs a preassigned arm

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW (quick, narrowly scoped fix)
- **Dimension**: Blind Spots
- **Location**: Phase 2, cohort registration
- **Detail**: The comparator divides by baseline tokens and rounds down. Reversing the two 0/0 arms can change the absolute threshold. [Drop rounding](../../../../skills/10x-pipeline/scripts/route.mjs#L569) · [Baseline denominator](../../../../skills/10x-pipeline/scripts/route.mjs#L643)
- **Fix**: Name the baseline arm and record its order before starting the control pair.
- **Decision**: APPLIED in Phase 2, “Qualify the host and run the cohort”, and in the brief's “Key Decisions Made”.

### F7 — The local audit needs to identify the current-tense default claims

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW (quick, narrowly scoped fix)
- **Dimension**: Plan Completeness
- **Location**: Phase 1, documentation
- **Detail**: ADR-010's routing summary and the reference's isolation/resume and pinned baseline descriptions still imply a shipped first-attempt drop. The pinned baseline policy inherits that leaf. [ADR-010 routing summary](../../../../docs/ADR/ADR-010-run-worktree-step-commits-and-rollback.md#what-each-rule-covers) · [Run isolation](../../../../docs/REFERENCE.md#run-isolation) · [Baseline override](../../../../skills/10x-pipeline/baseline-policy.json)
- **Fix**: Name those passages and give the implementer a repeatable local search for current default and measurement claims.
- **Decision**: APPLIED in Phase 1, “Operator instructions and pending result”.
