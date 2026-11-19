<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Codex Native Lock Recovery After Ordinary Failures

- **Plan**: [plan.md](../plan.md)
- **Mode**: Deep
- **Date**: 2026-11-19
- **Verdict**: REVISE
- **Findings**: 0 critical, 3 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
| --- | --- |
| End-State Alignment | WARNING (F1) |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING (F2, F4) |
| Plan Completeness | WARNING (F3, F5, F6) |

## Grounding

All seven named file paths existed. The six implementation symbols checked were `runCodex`, `settledDescendants`, `clearChild`, `readResult`, `writeResult` and `next`. The original plan brief matched the phase, scope, and decisions. All four Automated Progress rows have local checks and matching phase criteria. The live Codex check is already Manual. Both skill loops already write `unknown` with duration after an unsuspended launched failure. The existing fake CLI and result helpers support real router intake and retry on both chains. [10x loop](../../../../skills/10x-pipeline/SKILL.md#L81-L94) · [OpenSpec loop](../../../../skills/openspec-pipeline/SKILL.md#L87-L100) · [Shared fixture](../../../../skills/10x-pipeline/test/codex-helpers.mjs#L176-L205) · [Result intake](../../../../skills/10x-pipeline/scripts/flow.mjs#L614-L626)

## Findings

### F1 — The failed-turn fixture can hide a final-reply dependency

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision with a narrow fix
- **Dimension**: End-State Alignment
- **Location**: Phase 1, Runner eligibility and settlement and Fake CLI regressions
- **Detail**: The fake always writes a reply to `-o`. Codex 0.169.0 binds that file before launch and suppresses final assistant output on `turn.failed`. An implementation that validates the final reply before settling ordinary failures could pass the proposed fixture and still suspend a real failed turn. [Fake reply](../../../../skills/10x-pipeline/test/codex-helpers.mjs#L142-L149) · [Codex output binding](https://github.com/openai/codex/blob/rust-v0.169.0/codex-rs/exec/src/lib.rs#L1086-L1094) · [Codex failed-turn output](https://github.com/openai/codex/blob/rust-v0.169.0/codex-rs/exec/src/event_processor_with_jsonl_output.rs#L541-L565)
- **Fix**: Require a no-message, empty-output failed-turn fixture and reserve final-file validation for the exit-zero, completed-turn reply path.
- **Decision**: APPLIED in Key Discoveries and Phase 1 sections 1 and 3. The plan brief records the eligibility rule.

### F2 — Overlapping failure conditions lack independent lock coverage

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision with a narrow fix
- **Dimension**: Blind Spots
- **Location**: Phase 1, Runner eligibility and settlement and Fake CLI regressions
- **Detail**: The runner checks `code !== 0` before reporting protocol errors and tracks interruption in a marker that later events can overwrite. An exit signal yields a null code. Codex 0.169.0 can also exit 1 after interruption without emitting a JSONL interruption event, so interrupted app-server status has to reject settlement independently. The existing completion matrix ties lock retention to result acceptance, and the existing SIGKILL test also has a live descendant. These checks cannot distinguish all the conditions that should override an otherwise eligible failure. [Runner classification](../../../../skills/10x-pipeline/scripts/run-codex.mjs#L307-L314) · [Terminal events](../../../../skills/10x-pipeline/scripts/run-codex.mjs#L361-L407) · [Codex exit loop](https://github.com/openai/codex/blob/rust-v0.169.0/codex-rs/exec/src/lib.rs#L1422-L1485) · [Completion matrix](../../../../skills/10x-pipeline/test/codex-runner.test.mjs#L219-L255) · [Crash fixture](../../../../skills/10x-pipeline/test/run-lock.test.mjs#L319-L336)
- **Fix**: Specify the exclusion order and add mixed cases with otherwise conclusive metadata. Test signalled exit without supervisor cancellation, ordinary failure on archive, and a timestamped failed descendant. Assert lock state independently of result acceptance.
- **Decision**: APPLIED in Key Discoveries and Phase 1 sections 1 and 3. The plan brief records the fail-closed cases.

### F3 — The grace test could pass with the production timer

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision with a narrow fix
- **Dimension**: Plan Completeness
- **Location**: Phase 1, Fake CLI regressions and grace timer
- **Detail**: SIGKILL, child close and cleanup can all occur with the current five-second delay. The existing readiness helper waits up to ten seconds, so generic bounded waits do not establish that the injected delay governed the test. [Production timer](../../../../skills/10x-pipeline/scripts/run-codex.mjs#L268-L277) · [Fixture wait](../../../../skills/10x-pipeline/test/codex-helpers.mjs#L227-L232)
- **Fix**: Bound the wait from SIGTERM to runner close below the production delay with CI headroom. Confirm the child wrote its termination marker, closed with SIGKILL and left the durable lock.
- **Decision**: APPLIED in Phase 1 section 3 and the plan brief's Success Criteria.

### F4 — Retry assertions omit the accounting boundary

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision with a narrow fix
- **Dimension**: Blind Spots
- **Location**: Phase 1, Fake CLI regressions
- **Detail**: The plan requires skipping optional usage reads after a rejected reply. Native settlement currently reads `thread/read` after the release callback, so retry success alone would miss unnecessary reads. The fake logs every metadata request, and the router persists the status and duration needed to verify counted intake. [Optional reads](../../../../skills/10x-pipeline/scripts/run-codex.mjs#L224-L239) · [Fixture request log](../../../../skills/10x-pipeline/test/codex-helpers.mjs#L44-L69) · [Router intake](../../../../skills/10x-pipeline/scripts/flow.mjs#L614-L626)
- **Fix**: Assert that settlement queries ran, optional usage reads were skipped, and the router kept `unknown`, `ok: false` and the elapsed duration on the numbered attempt.
- **Decision**: APPLIED in Phase 1 section 3 and the plan brief's Success Criteria.

### F5 — ADR-018 also describes the old settlement boundary

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision with a narrow fix
- **Dimension**: Plan Completeness
- **Location**: Phase 1, Codex lock documentation
- **Detail**: ADR-018 Amendment 3 describes successful enclosing completion as the route to normal native settlement. The plan mandates searching for stale statements, but its file list omits this specific statement. [ADR-018 Amendment 3](../../../../docs/ADR/ADR-018-no-nested-subagents.md#L103-L105) · [Repository lesson](../../../foundation/lessons.md#grep-every-doc-for-the-old-behavior-when-a-scripts-output-changes)
- **Fix**: Name ADR-018 and cross-reference ADR-024's revised rule from its settlement note.
- **Decision**: APPLIED in Phase 1 section 4 and the plan brief's Scope.

### F6 — The live wrapper can leave artifacts that advance routing

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision with a narrow fix
- **Dimension**: Plan Completeness
- **Location**: Testing Strategy, Manual
- **Detail**: Overriding the exit code leaves any artifacts created during the real attempt. The router performs preservation rollback before deciding the next step, but only for an eligible isolated run. Without isolation, phase-advancing artifacts can make the check exercise the next step instead of a retry. [Intake and rollback](../../../../skills/10x-pipeline/scripts/route.mjs#L95-L114) · [Isolation gate](../../../../skills/10x-pipeline/scripts/isolation.mjs#L562-L574) · [10x routing](../../../../skills/10x-pipeline/scripts/flow.mjs#L685-L714) · [OpenSpec routing](../../../../skills/openspec-pipeline/scripts/openspec.mjs#L164-L180)
- **Fix**: Use an isolated scratch run with retry budget, keep the normal preservation rollback, and verify the same step under a new dispatch number.
- **Decision**: APPLIED in Testing Strategy and the plan brief's Success Criteria.

## Review scope

The review covers the inspected code, local fixtures and the pinned Codex 0.169.0 sources. Execution tests and the live Codex acceptance remain implementation checks. The bounded Codex review child returned read-only evidence. Child token coverage is unknown.
