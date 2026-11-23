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

Verified 6/6 implementation paths, including the policy, routing test, ADR-010, ADR-007, reference and README. Verified the tier, failure, policy, isolation, capture and comparison contracts against their implementations. The native verification child returned source evidence with unknown token usage. The brief matches the plan's scope and phases. The historical interim-policy finding is settled by the recorded 2026-11-23 owner decision. All six Progress rows match the phase criteria. The three Automated rows are local. The live rows belong to the operator and can stay pending at router completion. [Router completion](../../../../skills/10x-pipeline/scripts/flow.mjs#L891) · [Manual verification dispatch](../../../../skills/10x-pipeline/scripts/steps.mjs#L285)

## Findings

### F1 — The per-arm override can disappear or enter the run commits

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM (non-trivial protocol edit)
- **Dimension**: Blind Spots
- **Location**: Phase 2, paired worktree setup
- **Detail**: A normal launch from the original checkout selects the same branch for one change ID. Fresh worktrees accept two specific names. The router's initial commit includes only the change folder. Successful steps sweep changes elsewhere, and a failed step can reset a modified tracked override to its base content. This repository tracks the override path. [Fresh branch validation](../../../../skills/10x-pipeline/scripts/run-identity.mjs#L83) · [Setup branch selection](../../../../skills/10x-pipeline/scripts/prepare-run.mjs#L350) · [Start and step commits](../../../../skills/10x-pipeline/scripts/isolation.mjs#L479) · [Rollback](../../../../skills/10x-pipeline/scripts/isolation.mjs#L796)
- **Fix**: Precreate the accepted branches at one common disposable base, use ignored local overrides outside the index, and verify equivalent readiness before opening fresh native sessions. Precreated arms bypass the input copy and readiness checks. Seed identical, trackable inputs including `change.md`, check for an archive collision, and verify the recorded isolated identities and common base. Use another disposable repository if a replacement needs the same branch names. The common base and ignored overrides preserve comparable settings through step commits and rollback. The operator has to seed both worktrees and run the readiness checks. Confidence is high from the setup and Git code paths. Phase 2 verifies the exact launch setup. [Paired worktree precedent](../../../../docs/REFERENCE.md#baseline-comparison) · [Setup gates](../../../../skills/10x-pipeline/scripts/prepare-run.mjs#L503) · [Required change inputs](../../../../skills/10x-pipeline/scripts/route.mjs#L1086)
- **Decision**: APPLIED in Phase 2, “Qualify the host and run the cohort” and its Overview, including the recorded run identity and replacement setup, and in the brief's “Architecture / Approach”.

### F2 — The Claude qualification requires an unavailable evidence source

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW (quick, narrowly scoped fix)
- **Dimension**: Blind Spots
- **Location**: Phase 2, host qualification
- **Detail**: The launcher uses telemetry, but the verified ledger source is `claude-native`. The accounting reader would never qualify the planned `claude-otel` source. [Collector](../../../../skills/10x-pipeline/scripts/claude-usage.mjs#L385) · [Accounting validation](../../../../skills/10x-pipeline/scripts/usage.mjs#L63)
- **Fix**: Require verified `claude-native` evidence with `step-tree` scope on every executed step of the qualification run. Use the archived result to identify the qualified launch path and verify capture on the exact experiment setup.
- **Decision**: APPLIED in “Implementation Approach”, Phase 2 “Qualify the host and run the cohort” and the brief's prerequisites.

### F3 — The frame reserves the interim policy decision for the owner

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW (one explicit policy decision)
- **Dimension**: End-State Alignment
- **Location**: Overview and Decisions taken without a human
- **Detail**: The frame records approval to measure and explicitly reserves whether to ship `0` now or keep `1` through a dated measurement window. The plan presents `0` as settled. The existing ADR supports `0` while evidence is insufficient and the frame records a separate approval point. [Frame](../frame.md#open-for-the-owner) · [ADR-010 decision rule](../../../../docs/ADR/ADR-010-run-worktree-step-commits-and-rollback.md#decision-rule)
- **Fix**: Carry the owner's confirmed interim choice into the plan and brief before implementing the default.
- **Decision**: APPLIED in “Overview” and “Decisions taken without a human” and in the brief's “Key Decisions Made” and prerequisites. The frame records the owner's 2026-11-23 confirmation to ship `0` now.

### F4 — Comparison eligibility needs independent run evidence

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW (quick, narrowly scoped fix)
- **Dimension**: Blind Spots
- **Location**: Phase 2, comparison eligibility and interrupted arms
- **Detail**: Default `--unpinned` provenance exempts scorer differences and flags. Other policy drift can produce a warning alongside a token result. The comparator totals numbered entries, while a neutral rerun can reuse an entry after an earlier invocation consumed tokens. Recovery can clear a previous router outcome, and an execution suspension can stop the orchestrator before the router records one. Replacing these attempts without retaining their evidence can hide cost or a routed-only noncompletion. [Provenance contract](../../../../docs/REFERENCE.md#baseline-comparison) · [Comparator](../../../../skills/10x-pipeline/scripts/route.mjs#L470) · [Neutral rerun](../../../../skills/10x-pipeline/scripts/flow.mjs#L423) · [Suspension rule](../../../../skills/10x-pipeline/SKILL.md#loop)
- **Fix**: Specify expected provenance differences and independently verify effective settings and invocation coverage. Preserve terminal evidence before recovery, exclude pairs with uncounted execution, and keep the decision to enable `1` inconclusive while a routed-only noncompletion remains unexplained.
- **Decision**: APPLIED in “Decisions taken without a human”, both Phase 2 changes and the brief's “Key Decisions Made” and “Architecture / Approach”.

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
