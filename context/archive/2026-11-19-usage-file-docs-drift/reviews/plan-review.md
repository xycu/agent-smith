<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Late Usage Help Implementation Plan

- **Plan**: [plan.md](../plan.md)
- **Mode**: Deep
- **Date**: 2026-11-19
- **Verdict**: REVISE
- **Findings**: 0 critical, 2 warnings, 2 observations

The verdict and counts describe the plan as submitted. All four findings were applied during triage.

## Verdicts

| Dimension | Verdict |
| --- | --- |
| End-State Alignment | WARNING |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS |
| Plan Completeness | WARNING |

## Grounding

- Confirmed 5/5 implementation paths and 5/5 referenced symbols and helpers (`usageCommand`, `main`, `usageEvidence`, `makeProject`, `run`). The plan and brief agree on scope and phase count. The phase criteria match the three canonical Automated rows. All three checks can run locally before publication. [Router](../../../../skills/10x-pipeline/scripts/route.mjs#L789) · [CLI helpers](../../../../skills/10x-pipeline/test/helpers.mjs#L62)
- The proposed CLI cases reach the missing-step refusal and top-level halt through the existing scratch-project helper. The OpenSpec content tests pin the existing chain-qualified call and reject numeric examples in that procedure. A live documentation search found the planned references. ADR-019 Amendment 1 already explains how the original decision evolved. [CLI cases](../../../../skills/10x-pipeline/test/late-usage.test.mjs#L65) · [OpenSpec content tests](../../../../skills/openspec-pipeline/test/openspec-skill.test.mjs#L242) · [ADR-019 Amendment 1](../../../../docs/ADR/ADR-019-late-usage-figure.md#amendment-1--structured-missing-token-enrichment)

## Findings

### F1 — Documentation scan can miss a stale OpenSpec invocation

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision, with a narrowly scoped fix
- **Dimension**: Plan Completeness
- **Location**: Phase 1, Current command references and Testing Strategy
- **Detail**: Running the original negative scan against the current docs reports two stale synopses and misses a third. The OpenSpec summary has a numeric-only invocation and a separate `--usage-file` fragment on the same line. The filter drops the whole line. The positive file-level scan can also pass for the reference based on its shared structured example alone. [Shared reference](../../../../docs/REFERENCE.md#L413) · [OpenSpec summary](../../../../docs/REFERENCE.md#L677)
- **Fix**: Require a match for each intended invocation and check individual command spans for missing `--usage-file`. Keep legacy guidance in prose beside the complete OpenSpec command.
- **Decision**: APPLIED in Phase 1, Current command references and Testing Strategy. Synchronized Success Criteria in the plan brief.

### F2 — OpenSpec late usage is listed as read-only

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision, with a narrowly scoped fix
- **Dimension**: End-State Alignment
- **Location**: Phase 1, Current command references
- **Detail**: The planned synopsis replacement would leave `usage` under “Read-only commands.” A successful attachment writes the log and can refresh the report or create a local archive-state commit. A reader could rely on the label and modify a run while inspecting it. [OpenSpec command list](../../../../docs/REFERENCE.md#L671) · [Router writes](../../../../skills/10x-pipeline/scripts/route.mjs#L870)
- **Fix**: Move the existing OpenSpec usage entry immediately after the read-only list under a “Late usage” label as part of the reference edit.
- **Decision**: APPLIED in Phase 1, Current command references.

### F3 — Legacy rules understate accepted inputs and overstate validation order

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW — quick decision, with a narrowly scoped fix
- **Dimension**: End-State Alignment
- **Location**: Phase 1, Current command references
- **Detail**: The requested header synopsis shows a numeric example with `--tokens`. The parser accepts any nonempty subset of the three numeric flags, even on a step with only a tool-use or duration measurement. Each supplied value must fit a non-negative safe integer. The reference's “before anything is read” claim is broader than the guarantee because command dispatch already reads policy and metadata. [Numeric validation](../../../../skills/10x-pipeline/scripts/route.mjs#L818) · [Dispatch reads](../../../../skills/10x-pipeline/scripts/route.mjs#L986)
- **Fix**: Keep the requested header synopsis. In the relocated legacy explanation, state that any one or more numeric flags suffice, give the safe-integer bound, and describe validation relative to the usage log.
- **Decision**: APPLIED in Phase 1, Current command references.

### F4 — Full-suite command inherits the live GitHub opt-in

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW — quick decision, with a narrowly scoped fix
- **Dimension**: Blind Spots
- **Location**: Testing Strategy and plan brief prerequisites
- **Detail**: The suite is local by default, but `GH_LIVE=1` activates tests that invoke authenticated GitHub. The OpenSpec CLI contract fixtures depend on a local OpenSpec 2.0.0 binary and can skip outside CI if the probe fails. The original command leaves the live-test opt-in to the caller's environment and gives no guidance on expected local skips. [Live opt-in](../../../../skills/10x-pipeline/test/pr-comment.test.mjs#L844) · [OpenSpec CLI probe](../../../../skills/openspec-pipeline/test/openspec-contract.test.mjs#L17)
- **Fix**: Run the suite with `GH_LIVE=0`, keep the local fixtures, and report expected skips. Note the OpenSpec 2.0.0 prerequisite for its local CLI fixtures.
- **Decision**: APPLIED in Testing Strategy and the plan brief's prerequisites and Success Criteria.
