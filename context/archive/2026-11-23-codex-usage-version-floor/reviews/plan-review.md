<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Codex token accounting version floor

- **Plan**: [plan.md](../plan.md)
- **Mode**: Deep
- **Date**: 2026-11-23
- **Verdict**: REVISE
- **Findings**: 0 critical, 2 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
| --- | --- |
| End-State Alignment | WARNING |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | PASS |

The verdict and counts describe the original plan. Each decision records the applied edit.

## Grounding

Grounding confirmed 6/6 target paths, 4/4 collector and runner symbols (`CODEX_USAGE_VERSION`, `collectCodexUsage`, `claudeCaptureSupported`, and `normalizeAccounting`), and agreement between the original brief and plan. All three Automated rows can run before publication. The runner uses a local fake client on both chains.

The runner passes app-server thread metadata through verbatim after settlement. The three guards are owned by the collector, and the exact-version constant has no imports. The replay fixture at `late-usage.test.mjs:684` checks exact evidence provenance against the recorded host version. Its `0.170.0` value remains valid for that purpose. The documentation sweep found the dated accounting ADRs and the `first-attempt-drop-unmeasured` frame describing the prior pin. The current documentation is covered by the three planned entries. [Runner metadata and settlement](../../../../skills/10x-pipeline/scripts/run-codex.mjs#L125) · [Late evidence binding](../../../../skills/10x-pipeline/scripts/route.mjs#L886) · [Prior frame](../../first-attempt-drop-unmeasured/frame.md#L17)

Native Codex grounding was returned by read-only child invocation `01a20620-e9f6-72a2-9c2f-7856d7ae1138`. Child-inclusive token coverage is unknown.

## Findings

### F1 — Define the boundary between version eligibility and verified evidence

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision with an obvious, narrowly scoped fix
- **Dimension**: End-State Alignment
- **Location**: Desired End State and Phase 1 collector contract
- **Detail**: The original plan describes independent version gates and broad eligibility while preserving the evidence envelope. The normalizer allows at most 32 characters in the reported root version. A reconciled tree with a strictly valid 33-character root version can pass the version predicate and still yield `invalid-evidence`. A read-only probe returned verified evidence at 32 characters and `invalid-evidence` without tokens at 33. Identity, metadata and schema failures can also arise before the relevant version check. [Evidence normalizer](../../../../skills/10x-pipeline/scripts/usage.mjs#L42) · [Collector guard order](../../../../skills/10x-pipeline/scripts/codex-usage.mjs#L62)
- **Fix**: State when `unsupported-host` applies, preserve the existing envelope and guard order, and add a 32/33-character root-boundary case to the collector matrix.
- **Decision**: APPLIED — Updated Desired End State, Key discoveries, Implementation Approach, Phase 1 Changes Required, Testing Strategy and Migration Notes in the plan, and synchronized the brief.

### F2 — Cover the patch branch and strict input types

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision with an obvious, narrowly scoped fix
- **Dimension**: Blind Spots
- **Location**: Implementation Approach and Testing Strategy
- **Detail**: The original positive cases are the exact floor or releases with a higher minor or major. A comparator that requires patch `0` whenever major and minor equal the floor could pass those cases. The original malformed examples are all strings, so they miss a regex that coerces a field containing an array. The Claude precedent supplies the comparison pattern and the version checker supplies the stricter core grammar. [Claude predicate](../../../../skills/10x-pipeline/scripts/claude-capture-data.mjs#L19) · [Numeric core grammar](../../../../tools/version-check.mjs#L16)
- **Fix**: Add `0.169.1`, retain the former `0.170.0` case as a positive, and add malformed cases for a coercible array, a build suffix and a trailing newline.
- **Decision**: APPLIED — Updated Implementation Approach and Testing Strategy in the plan, and synchronized Open Risks & Assumptions and Success Criteria in the brief.

### F3 — Verify the documentation count for each file

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision with an obvious, narrowly scoped fix
- **Dimension**: Plan Completeness
- **Location**: Phase 1 Automated Verification and Progress row 1.3
- **Detail**: The original `rg -n` pattern correctly finds the requested phrase, but its overall exit status succeeds when just one of the three files matches. It also succeeds when a file contains extra matching lines. [Original criterion and preserved Progress row](../plan.md#progress)
- **Fix**: Keep the list of matching lines for inspection, specify a per-file count assertion, and document how the phase distinguishes current policy from the dated references found in the sweep.
- **Decision**: APPLIED — Updated Phase 1 Changes Required and Success Criteria and synchronized Success Criteria in the brief. Progress row 1.3 retains its original id, title and tick state.
