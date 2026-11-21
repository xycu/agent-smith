# OpenSpec Critical Placeholder Implementation Plan

## Overview

Teach the OpenSpec verdict reader to ignore a short list of empty-section placeholders. Make new reports leave empty lists blank and tell operators how to clear stale findings after the fix-loop cap.

## Current State Analysis

`readVerdict` collects every `- ` line under `## Critical` up to the next level-two heading, then takes the larger of the header count and the number of collected lines. A local probe returned `FAIL` and `critical: 1` for both `- None` and `- None of the migrations ran` under a `PASS` header with `Critical: 0`. The first is a placeholder and the second is a finding. [Verdict reader](../../../skills/openspec-pipeline/scripts/openspec.mjs#L98)

### Key Discoveries

- Step verification calls `readVerdict` to record review data. The next-step decision calls it again to route from the current file and populate the fix prompt. One change in the shared reader serves both paths. [Step verification and routing](../../../skills/openspec-pipeline/scripts/openspec.mjs#L136)
- The fix-loop halt already tells the operator to fix the issues and edit the header. The reader still counts stale real bullets when only the header is edited. [Halt and recovery](../../../skills/openspec-pipeline/scripts/openspec.mjs#L191)
- The writer guide keeps both headings when their lists are empty. The existing repository lesson requires the effective count to honor both the header and listed findings. [Writer guide](../../../skills/openspec-pipeline/prompts/os-verify.md#L14) · [Repository lesson](../../foundation/lessons.md#never-read-a-verdict-as-cleaner-than-its-listed-findings)

## Desired End State

Under `## Critical`, a whole bullet of `- None`, `- (none)` or `- N/A` is ignored, case-insensitively, with an optional final period and optional trailing spaces or tabs. For a placeholder-only section, `Verdict: PASS` with `Critical: 0` reads as `PASS` with zero critical findings and follows the normal successful route. `- None of the migrations ran` counts as one finding, overrides a zero header count and appears in the fix prompt. A positive header count still forces `FAIL`, and an explicit `FAIL` still routes as a failure.

## Implementation Approach

Match the placeholder on the raw eligible bullet before sanitization, truncation or the 20-line cap. This keeps the exemption limited to the intended text and reserves the cap for findings. Keep the existing `- ` prefix, heading boundaries, guarded reads, finding limits and warning handling. Scope is the verdict reader, fix-cap guidance, report writer contract and their tests and reference docs.

## Phase 1: Correct OpenSpec verdict handling

### Overview

Update the reader and writer contract together and verify both immediate acceptance and recovery after the fix-loop cap.

### Changes Required

#### 1. Verdict reader and halt guidance

**File** `skills/openspec-pipeline/scripts/openspec.mjs`

**Intent** Ignore recognized placeholders before they can inflate the critical count or reach the fix prompt. Make the halt recovery instructions match the conditions the reader checks.

**Contract** `readVerdict` keeps its return shape and computes the count from the larger of `Critical:` and the capped list of actual findings. At the fix-loop cap, `decideOpenspec` tells the operator to fix the underlying issues, set `Verdict: PASS` and `Critical: 0`, remove the `- ` lines under `## Critical`, and rerun. Preserve the isolated-run commit instruction.

#### 2. Report guidance and routing reference

**Files** `skills/openspec-pipeline/prompts/os-verify.md`, `skills/openspec-pipeline/prompts/README.md`, `docs/REFERENCE.md`

**Intent** Have the writer produce blank lists and document what the reader accepts in existing files.

**Contract** Keep `## Critical` and `## Warnings` with zero item lines when empty. The prompt index and OpenSpec reference describe empty-list output and filtered fix findings. The reference also specifies allowed placeholder forms, count precedence and the corrected halt instructions.

#### 3. Regression coverage

**Files** `skills/openspec-pipeline/test/openspec-steps.test.mjs`, `skills/openspec-pipeline/test/openspec-isolation.test.mjs`

**Intent** Prove the shared result at the reader, step log and CLI boundaries using existing fixtures.

**Contract** Pass explicit `criticalCount: 0` to `verifyText` when a case supplies bullets under a zero header, since the helper otherwise derives the count from the bullets. Cover the parser boundaries and CLI scenarios in Testing Strategy, including both halt message variants.

### Success Criteria

#### Automated Verification:

- Focused OpenSpec step and isolation tests pass and cover placeholder acceptance, real findings and fix-cap recovery.
- The full repository test suite passes on Node 24 or later.

## Testing Strategy

### Unit Tests

- Extend the existing `readVerdict` coverage with the three placeholders, mixed casing, optional final periods and trailing horizontal whitespace. Assert `PASS`, `critical: 0` and an empty `criticalLines` list. In a mixed section, assert `FAIL`, `critical: 1` and exactly `- None of the migrations ran`.
- Assert a positive header count with only placeholders still forces `FAIL`, and an explicit `FAIL` with `Critical: 0` and only placeholders remains `FAIL`. Exercise filtering before the cap by placing 20 placeholders ahead of a real finding in the existing limit test or an adjacent case. Retain the sanitization and truncation checks.

### Integration Tests

- Extend the CLI `atVerify` cases to show a placeholder-only `PASS` with `Critical: 0` yields `action: done` without a fix step and records `{ verdict: "PASS", critical: 0, warnings: 0 }`. Verify a mixed section with a zero header routes to `os-apply-fix` and forwards only the real finding.
- Update both exact halt assertions, including the isolated-run suffix. In the non-isolated recovery test, first set only the header to `PASS` and `Critical: 0` with the real finding still present and assert the run still halts. Remove the finding and assert `done` without creating a new step.
- Run `node --test --test-concurrency=2 skills/openspec-pipeline/test/openspec-steps.test.mjs skills/openspec-pipeline/test/openspec-isolation.test.mjs` for the focused gate and `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs` for the repository gate. Both run locally before publication.

## Performance and Compatibility

The existing 64 KiB read bound and 20-finding prompt cap bound the work. Existing `verify.md` files are read in place, including on a resumed run. The format and historical log entries need no migration. Rollback is a normal code revert that restores the previous interpretation of placeholders.

## Assumptions

- One implementation phase is sufficient because `readVerdict` owns both verification consumers and the remaining changes align the writer, operator guidance and tests.
- The exact spellings, optional period and case-insensitive match come from the change notes. Treat trailing ASCII spaces and tabs as formatting, consistent with the reader's existing trailing whitespace handling. Use the raw bullet for the decision so broader normalization cannot turn additional content into an exempt line.

## References

- [Audit cases and proposed behavior](change.md)
- [OpenSpec verdict and routing contract](../../../docs/REFERENCE.md#chain-behavior)
- [Reader limits, routing and halt tests](../../../skills/openspec-pipeline/test/openspec-steps.test.mjs#L159) · [Isolated halt test](../../../skills/openspec-pipeline/test/openspec-isolation.test.mjs#L188)

## Progress

> Keep row titles stable. Append a commit SHA with an em dash when a step lands.

### Phase 1: Correct OpenSpec verdict handling

#### Automated

- [x] 1.1 Focused OpenSpec step and isolation tests pass and cover placeholder acceptance, real findings and fix-cap recovery. — a5944d57
- [x] 1.2 The full repository test suite passes on Node 24 or later. — a5944d57
