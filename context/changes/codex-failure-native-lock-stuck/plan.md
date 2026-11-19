# Codex Native Lock Recovery After Ordinary Failures

## Overview

Release native execution ownership when a Codex step fails and the runner proves its thread tree has closed. Both pipeline loops can then send the failed attempt to the router for the normal retry decision.

## Current State Analysis

The runner claims native ownership before launching the model and records the root thread as soon as it appears. Its settlement callback is reachable only after result validation, so a failed exit, failed turn or missing `RESULT` bypasses closure checks. The retained lock then makes the skill stop before its ordinary incomplete-result branch. [Runner](../../../skills/10x-pipeline/scripts/run-codex.mjs#L261) · [Failure order](../../../skills/10x-pipeline/scripts/run-codex.mjs#L398)

## Desired End State

A settled ordinary failure returns a bounded diagnostic with `launched: true`, `completed: false`, `result: null` and measured duration. The orchestrator writes `unknown`. The router records a failed attempt and can issue a new attempt within the existing policy limits. If the runner cannot prove closure, its envelope and later lock contenders report `Execution suspended:` and identify the lock and required owner action. [10x loop](../../../skills/10x-pipeline/SKILL.md#L81) · [OpenSpec loop](../../../skills/openspec-pipeline/SKILL.md#L87) · [Result intake](../../../skills/10x-pipeline/scripts/route.mjs#L83)

### Key Discoveries

- The same bounded metadata lookup can prove closure for successful and failed execution. It checks the latest turn for each thread, fully pages both descendant lists, and repeats enumeration to detect membership changes. The lock helper also checks the recorded process group at release. [Tree reconciliation](../../../skills/10x-pipeline/scripts/run-codex.mjs#L133) · [Lock release](../../../skills/10x-pipeline/scripts/state.mjs#L1053)
- Codex 0.169.0 can set `status: "failed"` during an error before the turn is closed. Its persisted turn-completion handler records `completedAt` and closes the turn, including when the terminal event carries an error. This supports checking a timestamped failed root turn on the ordinary failure path. [Codex history projection](https://github.com/openai/codex/blob/rust-v0.169.0/codex-rs/app-server-protocol/src/protocol/thread_history.rs#L1421-L1525)
- The fake CLI already supports nonzero exits, terminal events, per-thread metadata overrides and a child that stays alive after handling SIGTERM. Both chains run through the same fixture and standalone runner. [Fake CLI](../../../skills/10x-pipeline/test/codex-helpers.mjs#L34) · [Existing cancellation test](../../../skills/10x-pipeline/test/codex-runner.test.mjs#L185)

## Scope

The change covers pending `run` actions in both chains, retained-lock diagnostics, a local SIGTERM grace test and the Codex documentation. The existing archive action has its own failure and verification flow. The owner escalation described here is for cases that still lack proof of settlement. [Change brief](change.md) · [Archive flow](../../../skills/10x-pipeline/SKILL.md#L99)

## Implementation Approach

Use one phase to deliver the runner change, the CLI regression tests and the docs together. The runner classifies the transport outcome and independently checks native closure for eligible failures. The same lock helper handles release and process exclusion. The orchestrator remains the result-file writer and the router owns intake, rollback and retry. [Lock ownership](../../../docs/ADR/ADR-024-openai-codex-support.md#decision)

Planning assumptions for the unattended run:

- Take the automatic release option in the change brief. Update the retained-lock message to state the authorized recovery prerequisite and the current lack of an automatic retained-lock recovery command. This keeps the change at the point where the runner still owns and can reconcile the launch. [Change brief](change.md) · [Native lock contract](../../../docs/ADR/ADR-024-openai-codex-support.md#amendment-2--native-step-children-2026-11-16)
- Apply the failed-turn allowance only to the root of a failed step. Require the current timestamped `completed` proof for descendants and for successful results. Treat a missing or invalid last `RESULT` in a verified final message as an ordinary reply failure. Existing stream and reply identity checks still govern provenance. [Runner](../../../skills/10x-pipeline/scripts/run-codex.mjs#L181) · [Result parser](../../../skills/10x-pipeline/scripts/run-codex.mjs#L250)
- Use a test-only, programmatic grace delay through the imported runner in a fixture subprocess. The CLI continues to use the established five-second delay. Real Codex verification belongs in Manual because it depends on host configuration and credentials. [Termination path](../../../skills/10x-pipeline/scripts/run-codex.mjs#L261) · [Change brief](change.md)

## Critical Implementation Details

Wait for exec `close` and consume the remaining JSONL before testing eligibility. Recheck cancellation at the same settlement-to-release boundary as successful runs. After `clearChild(true)`, keep the ordinary lock until runner cleanup and release. The host waits for the final envelope before writing a result or calling `next`. [Runner lifecycle](../../../skills/10x-pipeline/scripts/run-codex.mjs#L307) · [Settlement and cleanup](../../../skills/10x-pipeline/scripts/run-codex.mjs#L408)

## Phase 1: Release proven native ownership after a failed step

### Overview

Prove that the standard step retry becomes reachable after ordinary failure and that every uncertain closure still stops the run.

### Changes Required

#### 1. Runner eligibility and settlement

**File**: `skills/10x-pipeline/scripts/run-codex.mjs`

**Intent** — Let result failure and native ownership settle independently within the shared runner.

**Contract** — A launched, unsignalled `run` with a trusted recorded root identity and intact execution JSONL can attempt settlement after a nonzero exit or a final root `turn.failed`. A verified final assistant message from a successful transport can attempt settlement when the last `RESULT` is missing or invalid. Preserve the original failure reason, CLI exit 1, null result and measured duration after successful release. Skip optional accounting reads for a rejected result. A launch/stream fault, cancellation, explicit interruption, invalid root identity, malformed JSONL, or a success-path final-file provenance failure retains the existing suspension behavior after launch.

For these eligible failures accept a root latest turn with status `completed` or `failed` and the same positive safe-integer `completedAt` and `startedAt` consistency checks used today. Require valid completed descendants in both archived states, complete pagination, stable re-enumeration, and the existing process-group check. Treat missing, unreadable, interrupted, in-progress and untimestamped evidence as unresolved. If proof or lock release fails, retain ownership and include the closure problem in the bounded diagnostic. Continue to validate successful results and collect their usage as before.

#### 2. Recovery diagnostic

**File**: `skills/10x-pipeline/scripts/state.mjs`

**Intent** — Give the owner the same usable recovery instructions when the runner suspends and when a later command finds the retained native lock.

**Contract** — Both native diagnostics begin with `Execution suspended:`, identify the exact lock path and recorded thread or `unknown`, and ask the owner to retain the enabling revision and TMPDIR. Await an active runner through its existing handle. If it has exited, the authorized owner must inspect the recorded thread and its descendants, prove settlement and arrange router-owned recovery before mutation, relaunch or publication. State that automatic recovery for a retained native lock is unavailable. Keep the existing atomic lock transitions, legacy lock handling and suspended read-only status.

#### 3. Fake CLI regressions and grace timer

**Files**: `skills/10x-pipeline/test/codex-runner.test.mjs`, `skills/10x-pipeline/test/codex-helpers.mjs`, `skills/10x-pipeline/test/README.md`

**Intent** — Exercise the real runner and router with deterministic native metadata and process fixtures.

**Contract** — Cover, on each chain, exit 1 after valid completion, exit 1 with `turn.failed`, a zero exit with `turn.failed`, and a matching final reply without `RESULT` or with an invalid last `RESULT`. Supply a timestamped `failed` root for the failed-turn cases. For each, assert the incomplete envelope, reason, absence of lock and unchanged router state before intake. As the fixture orchestrator, write `unknown` with the reason and duration via `writeResult`, call real `next`, assert the failed log entry and a new `n` for the retryable step, then execute the returned dispatch successfully. Select fixtures with retry budget and no artifact advancement. Adjust existing test expectations that tied result failure to lock retention.

With the same failure trigger, test an untimestamped failed root and an unresolved descendant or metadata error. Assert the lock and recovery diagnostic survive, `next` and runner relaunch refuse, and pending dispatch and results stay intact. Keep existing success, malformed protocol, final-file mismatch, cancellation and archive coverage.

Exercise the existing hold fixture without issuing its release signal. Wait for the child's readiness, signal the runner with SIGTERM, observe the child recording termination while it remains held, and verify the runner escalates to SIGKILL at a short injected grace delay. Use the child's actual close signal and cleanup assertions as evidence, with fixture cleanup and bounded waits. Assert the runner returns a cancellation suspension, cleans its owned temp directory and leaves native ownership for recovery. Update the existing test index row.

#### 4. Codex lock documentation

**Files**: `docs/ADR/ADR-024-openai-codex-support.md`, `docs/REFERENCE.md`

**Intent** — Document the distinction between accepting a result and proving the attempt can no longer write.

**Contract** — Amend ADR-024 and the reference's Codex runner section with the eligible failures, terminal root proof, descendant requirements, failed-attempt accounting and `unknown` intake, plus the concrete suspension and owner recovery procedure. Search current docs and both skill loops for descriptions of the old behavior and reconcile any affected claims. Keep historical evidence in the archive.

### Success Criteria

#### Automated Verification

- Fake Codex proves nonzero exit, failed turn and missing or invalid RESULT handling, including both-chain `unknown` intake and an executable retry.
- Fake Codex proves unproved closure retains the lock, preserves pending state, blocks mutation and relaunch, and identifies the owner recovery prerequisite.
- The injected SIGTERM grace test observes SIGKILL, awaited close, temporary-file cleanup and retained native ownership.
- The focused runner and lock tests and the required full Node test suite pass locally.

#### Manual Verification

- A real Codex step fails once with provable closure in a scratch run, records `unknown`, and continues through a successful retry.

## Testing Strategy

- Run `node --test --test-concurrency=2 skills/10x-pipeline/test/codex-runner.test.mjs skills/10x-pipeline/test/run-lock.test.mjs`. During development, confirm the new settled-failure assertion fails against the old runner.
- Run `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs` under Node 24 or later. The automated acceptance uses local scratch projects and fake Codex.
- For Manual, use an authorized scratch run with the supported real Codex CLI. A local one-shot wrapper can forward preflight and metadata calls, run the first model exec normally, then return exit 1 after the real exec exits 0. Record its native closure, the `unknown` entry and successful execution of the retry with ordinary exit propagation. Keep publication and production run state outside this check.

## Performance Considerations

Use the existing bounded metadata service only for eligible failures. Return the measured enclosing exec duration and skip optional usage metadata for its rejected result. The short test delay is supplied only by the test subprocess.

## Migration Notes

The runner and the router continue to use the existing lock record, dispatch and result formats. Adopt the updated revision between runs or before a new launch after settlement. A lock already retained by an earlier process still requires owner reconciliation. For rollback, first await active runners and settle any pending native ownership on its enabling revision, then revert the code and documentation through preserving Git history. Keep unresolved runs pinned with their original TMPDIR and preserve run files and Codex-owned history. [Existing downgrade procedure](../../../docs/REFERENCE.md#L696)

## References

- [Change brief](change.md)
- [Codex lock and result contract](../../../docs/REFERENCE.md#codex-and-provider-dispatch)
- [ADR-024](../../../docs/ADR/ADR-024-openai-codex-support.md)
- [Codex 0.169.0 persisted turn completion](https://github.com/openai/codex/blob/rust-v0.169.0/codex-rs/app-server-protocol/src/protocol/thread_history.rs#L1497-L1525)

## Progress

> `- [ ]` is pending and `- [x]` is done. Append ` — <commit sha>` when a step lands. Keep established step titles.

### Phase 1: Release proven native ownership after a failed step

#### Automated

- [ ] 1.1 Fake Codex proves nonzero exit, failed turn and missing or invalid RESULT handling, including both-chain `unknown` intake and an executable retry.
- [ ] 1.2 Fake Codex proves unproved closure retains the lock, preserves pending state, blocks mutation and relaunch, and identifies the owner recovery prerequisite.
- [ ] 1.3 The injected SIGTERM grace test observes SIGKILL, awaited close, temporary-file cleanup and retained native ownership.
- [ ] 1.4 The focused runner and lock tests and the required full Node test suite pass locally.

#### Manual

- [ ] 1.5 A real Codex step fails once with provable closure in a scratch run, records `unknown`, and continues through a successful retry.
