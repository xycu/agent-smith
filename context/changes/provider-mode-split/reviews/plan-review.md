<!-- PLAN-REVIEW-REPORT -->
# Plan Review — Provider Mode Implementation Plan

- **Plan**: [Provider Mode Implementation Plan](../plan.md)
- **Mode**: Deep
- **Date**: 2026-11-19
- **Verdict**: REVISE
- **Findings**: 0 critical, 4 warnings, 0 observations

The verdict and counts describe the working plan at the start of this review, including the owner’s decision on missing metadata. All four fixes were applied to the plan. Phase 4 still owns implementation and verification.

## Verdicts

| Dimension | Verdict | Basis |
| --- | --- | --- |
| End-State Alignment | WARNING | Phase 4 could pass while a log-only run still resumed with a new mode. |
| Lean Execution | PASS | The fixes fit existing readers, fixtures and verification commands. |
| Architectural Fitness | WARNING | Archive ownership depends on transport settlement. The task verdict alone cannot determine it. |
| Blind Spots | WARNING | Plain status could report an invented run-level selection during recovery. |
| Plan Completeness | WARNING | Several positive tests implicitly used the state now reserved for recovery. |

## Grounding

Verified the router, state reader, shared dispatch validator, Claude runner, both skill loops and the named provider, provenance and archive fixtures. Traced the four callers of `mutationMeta`, the defaults used by `status`, the archive result path and the use of `writeLog` in unrelated tests. The brief matched the four phases but omitted the new recovery decision. [Router](../../../../skills/10x-pipeline/scripts/route.mjs#L64) · [Runner dispatch validation](../../../../skills/10x-pipeline/scripts/runner-dispatch.mjs#L30) · [Plan brief](../plan-brief.md)

All 12 Progress rows matched their phase criteria. Row 3.1 uses local fake clients. Fresh-host qualification and post-publication acceptance already belong to Manual rows 3.2 and 3.3. The independent read-only leaf `/root/verify_plan` checked fixture dependencies, metadata readers and archive behavior. Child-inclusive token coverage is unknown. [Progress](../plan.md#progress) · [Implementation review](impl-review.md)

## Findings

### F1 — Positive routing fixtures also create log-only runs

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — the fixture intent identifies where to supply valid metadata
- **Dimension**: Plan Completeness
- **Location**: Phase 4, Verify metadata recovery and capability checks, and its focused test command
- **Detail**: The owner named the historical provenance fixture, but the rigor tests, the review-parser setup and the manual-verification setup also seed a log before invoking a writer. The proposed guard would halt those tests before they exercised their subjects. The focused Phase 4 command also omitted the provenance case. [Rigor fixture](../../../../skills/10x-pipeline/test/route.test.mjs#L125) · [Review fixture](../../../../skills/10x-pipeline/test/openfindings.test.mjs#L42) · [Manual fixture](../../../../skills/10x-pipeline/test/manualverify.test.mjs#L36) · [Log helper](../../../../skills/10x-pipeline/test/helpers.mjs#L208)
- **Fix**: Seed valid metadata where fixtures model initialized runs. Preserve the raw log helper for recovery and read-only cases. Include the provenance and review-parser tests in the focused gate and retain the full suite.
- **Decision**: APPLIED in Phase 4, Verify metadata recovery and capability checks, the Phase 4 test command and the plan brief’s Success Criteria.

### F2 — Phase 4 could pass without enforcing the owner’s recovery decision

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — the owner settled the compatibility choice and all four writers use the same guard
- **Dimension**: End-State Alignment
- **Location**: Desired End State, Phase 4 F2 and Migration Notes
- **Detail**: The plan’s risk section required a halt when the log survives without metadata. Phase 4 exercised only malformed JSON and a non-object value. Both already halt. The guard also checks that the metadata file exists, so the missing-file path bypasses it. One existing provenance test explicitly expects init to resume from that state. Valid legacy metadata lacking a provenance or mode field is a separate supported input. [Guard](../../../../skills/10x-pipeline/scripts/route.mjs#L64) · [Two-chain cases](../../../../skills/10x-pipeline/test/providers.test.mjs#L54) · [Legacy and log-only cases](../../../../skills/10x-pipeline/test/provenance.test.mjs#L320)
- **Fix**: Apply the decision in the shared writer guard. Cover absent metadata in both chains for init, next, late usage and report generation, including the diagnostic and unchanged directory snapshot. Retain the fresh and valid-legacy controls.
- **Decision**: APPLIED in Desired End State, Phase 4, Verify metadata recovery and capability checks, Migration Notes and the plan brief’s Open Risks & Assumptions.

### F3 — Plain status could misidentify a damaged Codex split run

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — the read-only command already has the log and the metadata read result
- **Dimension**: Blind Spots
- **Location**: Phase 4 F2, plain status during recovery
- **Detail**: Status falls back to an empty object when it cannot read metadata. That produces host `claude` and mode `legacy`, even for the Codex-hosted split run in the recovery fixture. The fixture checks only the exit code. An operator could read those values as evidence for restoring the run. Missing OpenSpec metadata also removes its automatic chain signal. [Status](../../../../skills/10x-pipeline/scripts/route.mjs#L722) · [Host default](../../../../skills/10x-pipeline/scripts/state.mjs#L98) · [Chain resolution](../../../../skills/10x-pipeline/scripts/route.mjs#L945) · [Status assertion](../../../../skills/10x-pipeline/test/providers.test.mjs#L65)
- **Fix**: Require status to identify unavailable run-level selection, preserve recorded steps, and explain recovery. Check those values and the directory snapshot using the affected chain. Preserve legacy defaults for a readable historical metadata object.
- **Decision**: APPLIED in Phase 4, Verify metadata recovery and capability checks, Migration Notes and the plan brief’s Open Risks & Assumptions.

### F4 — Archive lock retention conflated two kinds of failure

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — the runner and both archive loops already distinguish the two outcomes
- **Dimension**: Architectural Fitness
- **Location**: Phase 4, Verify Claude settlement and accounting
- **Detail**: “An unsuccessful archive retains ownership” also describes an archive task that correctly returns a verified `blocked` result. OpenSpec requires that result for archive validation and commit failures. The runner releases ownership after verified transport and a valid result. Both skills then check what moved. A failed archive transport or invalid final result retains ownership. [Runner settlement](../../../../skills/10x-pipeline/scripts/run-claude.mjs#L344) · [OpenSpec archive contract](../../../../skills/openspec-pipeline/prompts/os-archive.md#L11) · [10x archive loop](../../../../skills/10x-pipeline/SKILL.md#L110) · [OpenSpec archive loop](../../../../skills/openspec-pipeline/SKILL.md#L116)
- **Fix**: Require fake archive cases for transport failure, a malformed final RESULT and a settled task-level refusal. Check the returned envelope and the lock for each outcome.
- **Decision**: APPLIED in Phase 4, Verify Claude settlement and accounting, and the plan brief’s Success Criteria.
