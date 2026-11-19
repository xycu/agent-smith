<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Step guard heredocs and input limits

- **Plan**: [plan.md](../plan.md)
- **Mode**: Deep
- **Date**: 2026-11-19
- **Verdict**: REVISE
- **Findings**: 0 critical, 2 warnings, 2 observations

The verdict and counts describe the submitted plan at `91377f0a`. Each decision records the triage outcome.

## Verdicts

| Dimension | Verdict |
| --- | --- |
| End-State Alignment | WARNING |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

Verified all three implementation paths and the supporting hook registration, provenance reader, change request and local evidence. The verification traced `withoutHeredocData`, `literalMessage`, `isGuarded`, `overflowIdentity` and `readEventProblem`. The existing hook owns Bash event handling, and provenance hashes its standalone entry point. The overflow implementation matches the plan's scope, UTF-8 handoff and depth limit. [Hook](../../../../hooks/hooks.json#L11) · [Heredoc scanner](../../../../skills/10x-pipeline/scripts/step-guard.mjs#L235) · [Overflow reader](../../../../skills/10x-pipeline/scripts/step-guard.mjs#L528) · [Provenance](../../../../skills/10x-pipeline/scripts/isolation.mjs#L85)

Both phases and all six Success Criteria match canonical Progress. The brief matches the submitted phase scope. Automated criteria use local tests, including the full suite's fake Git/GitHub clients. The scratch-repository check is Manual. [Plan and Progress](../plan.md#progress) · [Plan brief](../plan-brief.md) · [Pre-publication acceptance](../../../../docs/REFERENCE.md#step-safety-and-pre-publication-acceptance)

On Node 24.19.0, the row 1.2 selector ran two named tests and the row 1.3 selector ran one. The read-only verification also ran four byte-cap and overflow tests. All passed on the submitted tree. The new UDP regression and fresh Claude Code acceptance are pending. The verification child reported unknown token coverage. [Hook tests](../../../../skills/10x-pipeline/test/step-guard.test.mjs) · [Live verification evidence](../evidence/unproven.md)

## Findings

### F1 — A green selector can miss the required regression

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision with a narrowly scoped fix
- **Dimension**: End-State Alignment
- **Location**: Phase 1, Verify the fixes from implementation review and rows 1.2 and 1.3
- **Detail**: Row 1.3's selector passed on the submitted tree, where the denial table covers descriptor and TCP destinations and the UDP assertion is still pending. A separate Node run with a deliberately unmatched selector also exited successfully and reported the file as passing. A green status alone cannot prove the named tests ran or that the selected route test included the UDP case. [Route test](../../../../skills/10x-pipeline/test/step-guard.test.mjs#L130) · [Guard route diagnostic](../../../../skills/10x-pipeline/scripts/step-guard.mjs#L356)
- **Fix**: Confirm both named tests pass for 1.2. For 1.3, put the UDP assertion in the selected route test, check the route-specific denial and confirm the test is listed by name as passing.
- **Decision**: APPLIED in Phase 1, Verify the fixes from implementation review, and the plan brief's Success Criteria summary.

### F2 — The live check needs evidence from the child's actual shell

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision with a narrowly scoped fix
- **Dimension**: Blind Spots
- **Location**: Testing Strategy, Manual row 2.3
- **Detail**: The procedure names the two text commands and asks for the scratch commit to be inspected. It leaves the exact commit input and the evidence to capture implicit. The recorded local Bash 3.2 syntax failure and zsh stand-in show that neutral hook output does not establish that the child's shell can run the original form. [Local probe output](../evidence/script-step-guard-local.txt) · [Ticket examples](../change.md)
- **Fix**: Use the original quoted commit command in a fresh guarded child with a staged scratch fixture. Record the Claude Code, plugin and shell versions, the literal outputs, the actual commit message and the hook's pre-execution denial. Leave 2.3 pending if any check fails and record whether the shell or hook stopped it.
- **Decision**: APPLIED in Testing Strategy and the plan brief's Success Criteria summary.

### F3 — Full-suite evidence predates the last planned regression

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision with a narrowly scoped fix
- **Dimension**: Plan Completeness
- **Location**: Testing Strategy and the plan brief's Success Criteria summary
- **Detail**: Row 2.2 already records a completed full-suite run. The revision introduces a pending test edit in phase 1. The existing instruction to run the full suite “after both changes” leaves it unclear whether the full-suite result must cover that edit. [Canonical Progress](../plan.md#progress) · [Implementation review's test evidence](impl-review.md#automated-verification)
- **Fix**: Explicitly rerun the existing full-suite command on the tree that includes the UDP regression with `GH_LIVE` unset, then record the result with the pending phase 1 checks.
- **Decision**: APPLIED in Testing Strategy and the plan brief's Success Criteria summary.

### F4 — Byte-cap source links point into heredoc code

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision with a narrowly scoped fix
- **Dimension**: Plan Completeness
- **Location**: Key Discoveries, Implementation Approach and Phase 2, Bounded event identity reader
- **Detail**: The submitted guard links point into the heredoc word scanner. The limit-test link points to the heredoc guidance constant. The current scope predicate, byte handoff and byte-cap test are at different locations. [Scope predicate](../../../../skills/10x-pipeline/scripts/step-guard.mjs#L484) · [Byte handoff](../../../../skills/10x-pipeline/scripts/step-guard.mjs#L682) · [Byte-cap test](../../../../skills/10x-pipeline/test/step-guard.test.mjs#L260)
- **Fix**: Link to the current scope predicate, byte handoff and byte-cap test. Describe a present invalid ID as keeping the event in scope, with its response governed by the in-limit or overflow path.
- **Decision**: APPLIED in Key Discoveries, Implementation Approach and Phase 2, Bounded event identity reader.
