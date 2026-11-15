# Stale last-result cleanup implementation plan

## Overview

Prevent a result already persisted in `run.jsonl` from being consumed by a later step after a crash. Make shared result intake own recovery cleanup for both chains and both prompt transports, preserving atomic publication, neutral retries, late usage, and isolated Git recovery.

## Current State Analysis

`attachResult` persists the verified result, sanitized signals, usage and completion fields through the atomic `writeLog` before removing `last-result.json`. Its early return when the latest executed entry already has a result leaves a crash-surviving file untouched. `next` can then dispatch another step; that step consumes the old file without a new hand-back.

Current file-prompt support partly masks this: `cleanupHandoff` also unlinks the result, but only when the completed entry has `pendingHandoff`. Thus result cleanup depends on prompt transport. The shipped default is inline, and legacy entries have no handoff marker.

Planning reproduced the failure on Node v26.13.1 using the real CLI in scratch projects inside this worktree. A test-only wrapper called the real `fs.renameSync`, then exited with code 86 immediately after publishing the intake log. No real run files were edited. On both chains, the first resume returned a new step while leaving the result file. A second `next`, with no new result written, attached the old note `only step one` and `usage.totalTokens: 42` to that new step. The next steps were `plan-review` for 10x and `os-apply` for OpenSpec. Scratch files were removed afterward. Isolated reproduction is required during implementation; it was not run during planning.

### Key Discoveries

- `skills/10x-pipeline/scripts/flow.mjs:544`: `attachResult` is the shared result owner; its only production caller is `next`. Persistence precedes deletion at lines 616–617.
- `skills/10x-pipeline/scripts/flow.mjs:372`: `cleanupHandoff` currently mixes prompt cleanup with result cleanup and retains its marker across deletion and log-write failures.
- `skills/10x-pipeline/scripts/route.mjs:82`: guarded, locked `next` calls `neutralRetry`, `attachResult`, `cleanupHandoff`, `stepCommit`, then rollback and routing. Both `init` resume and `next` enter this path (lines 1042–1044).
- `skills/10x-pipeline/scripts/state.mjs:525`: `executed` filters skip rows; cleanup must inspect the latest executed entry, not the physical last log row.
- `skills/10x-pipeline/scripts/state.mjs:561`: `writeFileAtomic` publishes a complete log by rename. Atomic files do not make log publication and result unlink one transaction.
- `skills/10x-pipeline/scripts/flow.mjs:405`: neutral retries act only on a pending entry, replay it without a result, and exit before ordinary intake. The cap and legacy missing-prompt refusal have distinct preservation rules.
- `skills/10x-pipeline/scripts/route.mjs:767`: `usageCommand` targets an explicitly numbered completed entry; it does not call intake or consume `p.result`. A later step may already have a legitimate pending result when usage arrives.
- `skills/10x-pipeline/scripts/isolation.mjs:484`: `stepCommit` stages successful step output after intake. Cleanup must finish before it, rollback snapshots, terminal publication and archive commits.
- `skills/10x-pipeline/test/run-state.test.mjs:562` already proves failed atomic intake retains the original log and pending result on both chains. `prompt-handoff.test.mjs:190` covers prompt deletion and marker-publication failures.

## Desired End State

For the latest executed entry, persisted completion is authoritative. A surviving result file is removed before routing or Git effects, even without `pendingHandoff`. A pending entry still consumes its newly supplied result exactly once. No executed entry means there is no completed owner to clean up.

After an interrupted intake, recovery preserves the completed entry's result, signals, verification, usage and timestamps. The new step starts without a result; calling `next` before its own result exists halts with the existing missing-result message. A non-ENOENT deletion error halts recovery before a later step or Git operation and permits retry after the filesystem problem is fixed.

## What We're NOT Doing

- No timestamp-based ownership, result IDs, new log fields, policy settings, dependencies or skill/prompt protocol changes.
- No cleanup in late `usage`, status, reports or the Codex runner. Those commands do not own result consumption.
- No redesign of neutral-retry persistence, run locks, atomic writes, Git rollback or archive behavior.
- No repair of historical results already attached to the wrong entry, no rewriting pushed history, and no guarantee against an out-of-protocol producer rewriting results concurrently.
- No changes to `WAVES.md`, `context/archive/`, versions or real router-owned run files. Planning creates documents only and makes no commit.

## Implementation Approach

Extend `attachResult` in `flow.mjs`, retaining its signature. It owns the single-file unlink after successful publication and on the already-completed recovery path. Use the same cleanup behavior in both paths: tolerate only ENOENT and propagate other errors. Remove result-file deletion from `cleanupHandoff`; keep that function responsible for the task file and its durable marker. Do not introduce a second router-level cleanup policy or change the atomic writer.

Assumptions resolved for this unattended run:

1. Complexity is medium: one production owner but a cross-chain recovery surface. Use two phases and automated verification only; the user explicitly delegated interview decisions and prohibited nested agents.
2. The latest executed entry defines ownership, because `next` persists each dispatch before returning it and serializes mutation under the run lock (`route.mjs:269`, `route.mjs:935`). A legitimate result for a later dispatched step therefore has a pending latest entry. File mtime cannot establish ownership; `ahead.mjs` documents coarse clocks and output verification uses timestamps for a different purpose.
3. `last.result` supplies the recovery marker already needed, including legacy inline entries. No extra marker is necessary because cleanup must complete before a new pending entry is appended. Keep the existing result-presence semantics rather than widening this task into schema repair.
4. Late usage remains independent, as its current command and documented contract attach a figure to an explicit step without rewriting the result file (`route.mjs:787–813`, `docs/REFERENCE.md`, “Late usage figure”).
5. Existing fault-injection patterns and scratch helpers are sufficient; no live agents, browser testing or external services are required. Keep test scratch roots and lock TMPDIR inside this worktree when executing under the supplied working-directory rules.

## Critical Implementation Details

### State sequencing

Preserve the order: command/log/prompt guards and lock → neutral retry → result publication or recognition of persisted completion → result unlink → handoff cleanup → step commit/rollback/routing. Failed publication must never delete the pending result. Failed unlink must never proceed to Git staging or a later dispatch. If termination occurs after unlink but before any later write, ENOENT makes the next recovery safe without re-verifying the completed step.

Prompt cleanup must retain its own marker until its file is removed and marker removal is atomically persisted. Moving result ownership must not weaken that independent recovery contract. A pending entry after an older completed entry must never be mistaken for that older entry's cleanup target.

## Phase 1: Shared result ownership and crash recovery

### Overview

Close the stale-file window in the shared owner. The inline crash cases on both chains must fail against the current implementation and pass after the fix. File-prompt crash cases preserve the recovery already supplied by `cleanupHandoff` and must pass before and after the ownership change.

### Changes Required:

#### 1. Result and handoff cleanup ownership

**File**: `skills/10x-pipeline/scripts/flow.mjs`

**Intent**: Clean persisted results consistently across fresh intake and recovery, independent of prompt transport. Remove the duplicate responsibility from handoff cleanup.

**Contract**: `attachResult(p, log, policy)` keeps pending intake behavior and only returns from a completed-owner path after unlink succeeds or reports ENOENT. With no executed entry it leaves any result untouched. `cleanupHandoff(p, log)` retains prompt validation, deletion and durable marker recovery. Neither path rewrites an already stored result or re-verifies its artifacts.

#### 2. Deterministic crash and cleanup regression coverage

**Files**: `skills/10x-pipeline/test/result-persist.test.mjs`, `skills/10x-pipeline/test/prompt-handoff.test.mjs`, `skills/10x-pipeline/test/README.md`

**Intent**: Extend the existing result-persistence suite using shared 10x/OpenSpec scratch helpers and filesystem-boundary fault injection. Keep handoff failure assertions valid after consolidating result ownership; index the expanded result suite in its README.

**Contract**: Cover the matrix and edge cases in Testing Strategy. At minimum, execute the actual post-log-rename/pre-unlink crash on both chains with inline and file prompts, recover, then call `next` without a new result and require a missing-result halt. Record the baseline separately for each transport. Both inline cases must expose stale-result consumption before the fix. Both file-prompt cases must retain their existing successful recovery before and after the fix. Inject non-ENOENT unlink failure on fresh intake and recovery; prove no later entry is logged and that a later retry succeeds. Verify missing files, skip rows and no-executed-entry behavior without manually editing real run state. Reuse `helpers.mjs` fixtures where synthetic state is required; avoid a new production test seam.

### Success Criteria:

#### Automated Verification:

- The post-publication inline crash regression fails before the fix and passes afterward on both chains. File-prompt crash recovery passes before and after the fix on both chains. All four cases preserve the completed entry and require the next step to supply its own result.
- Unlink failure, missing-file, skipped-row, pending-owner and handoff-marker regressions pass without losing results or permitting premature routing.
- Focused suites pass: `node --test --test-concurrency=2 skills/10x-pipeline/test/result-persist.test.mjs skills/10x-pipeline/test/prompt-handoff.test.mjs skills/10x-pipeline/test/run-state.test.mjs`.

Progress row 1.1 retains its original title. Interpret its red/green requirement as the inline regressions on both chains, with both prompt transports required to pass after the fix and the file-prompt baseline required to stay green.

#### Manual Verification:

None; deterministic CLI and filesystem assertions cover this phase.

## Phase 2: Compatibility, isolation and routing documentation

### Overview

Prove preservation of the surrounding lifecycle, document ownership and run the repository's required suite.

### Changes Required:

#### 1. Isolated and command-interaction regressions

**Files**: `skills/10x-pipeline/test/result-persist.test.mjs`, `skills/10x-pipeline/test/neutral.test.mjs`, `skills/10x-pipeline/test/late-usage.test.mjs`

**Intent**: Add only missing coverage for recovered success commits, pending neutral retries and late usage. Prefer keeping new stale-result cases together in `result-persist.test.mjs`; extend the existing neutral/usage files only where their fixtures reduce duplication.

**Contract**: On each chain, reproduce the interruption before a successful isolated step commit, resume, and inspect the recorded commit tree and index to prove no stale result is staged or committed. On cleanup failure, HEAD/index and dispatch state must not advance. Verify failed-step rollback recovery with no stale result in its recovery snapshot. A pending `orchestrator-error` must still replay the same entry with its prompt, start state, tier and retry accounting intact. Late usage for an older completed entry must preserve a later pending result byte-for-byte, including identical and refused usage calls; the later result remains consumable. Usage between interrupted intake and `next` recovery must remain attached exactly once and must not defeat cleanup.

#### 2. Routing reference and test index

**Files**: `docs/REFERENCE.md`, `skills/10x-pipeline/test/README.md`

**Intent**: Explain when shared result cleanup happens, its failure recovery and why pending results and late usage remain unaffected. Update the existing routing bullets, state-publication discussion, file-prompt lifecycle and OpenSpec shared-behavior bullets as needed.

**Contract**: Document persist-before-unlink, authoritative latest executed entry, ENOENT tolerance, halt-on-other-errors, cleanup before Git/routing, and the existing sequential producer assumption. No timestamps or new protocol fields. Search active documentation for conflicting descriptions, following `lessons.md`; leave `WAVES.md` and archives untouched. Add an OpenSpec test-index row only if a new test file is actually introduced there; the shared matrix needs no new OpenSpec production module.

### Success Criteria:

#### Automated Verification:

- Both-chain isolated regressions prove cleanup before successful commits and failed-step snapshots, with no Git or dispatch advance when cleanup fails.
- Both-chain neutral retry and late-usage regressions preserve pending result ownership, retry state and usage attribution.
- Routing documentation and test index describe the tested shared lifecycle; `git diff --check` passes and the diff leaves `WAVES.md`, archives and real router-owned run state untouched by implementation.
- The required repository suite passes on Node 24+: `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`.

#### Manual Verification:

None; real scratch Git worktrees and CLI fault injection exercise the relevant behavior.

## Testing Strategy

### Unit and boundary checks

Use minimal fixture assertions for no executed owner, a completed owner followed by skip rows, and an older completed owner followed by a pending latest entry. Preserve the original completed fields, including result, sanitized signals, usage, finishedAt and verification, across recovery. Verify absent results are idempotent and non-ENOENT unlink failures propagate. A malformed or changed leftover file must not be parsed or overwrite an authoritative completed result.

### Integration scenarios

| Scenario | Required proof |
| --- | --- |
| Crash after actual atomic log publication | Both chains × inline/file prompts; persisted result and leftover file exist, then recovery deletes the file before dispatch. A subsequent result-less call halts. Before the fix, inline cases expose stale-result consumption and file-prompt cases already pass through handoff cleanup. After the fix, all four cases pass. |
| Normal intake and fresh next result | First file consumed once; next entry's different note/signals/usage belongs only to that entry. |
| Crash after unlink / missing leftover | Resume without duplicate intake, false failure or changed completion timestamp. |
| Failed atomic log publication | Existing `run-state.test.mjs` coverage still retains original bytes and pending result on both chains. |
| Unlink denied | Fresh intake and recovery stop before next dispatch, step commit or rollback; persisted completion survives and retry works. |
| Terminal recovery | A completed latest entry with a leftover is cleaned even when routing returns done/halt rather than run; pre-archive behavior retains its existing checks. |
| Neutral retry | Both chains replay the pending step unchanged; existing cap, disabled-cap and legacy missing-prompt tests stay green. A subsequent real result is consumed normally. |
| Late usage | Update completed step N while N+1 has a pending result; result bytes survive successful, identical and refused usage. Also attach usage between a crash and recovery. |
| Isolated success and failure | Both chains: recovered success commit excludes result, cleanup failure preserves HEAD/index, failed-step recovery snapshot excludes consumed result. Existing rollback/undo guarantees stay green. |
| Handoff failures | Preserve task marker after task unlink failure or final log publication failure; recovery finishes without depending on a second result unlink. |
| Guards | Existing corrupt-log, bad-policy/prompt and held-lock refusals continue preserving pending input. |

Fault hooks belong in scratch processes, using the existing `run-state`/`prompt-handoff` injection patterns. Hook the real `run.jsonl` rename for the crash and the exact `p.result` unlink for cleanup errors; do not use sleeps or add production flags. Where invoking CLI termination directly, use a bounded nonzero exit after publication or the suite's existing process-termination harness. Do not infer success from valid JSON: assert step, entry ownership, result absence, commit contents and expected exit behavior.

Run the focused suite during Phase 1, relevant neutral/usage/isolation cases during Phase 2, then the full mandated suite once the final changes are in place. Existing Git tests may skip only when Git is unavailable outside CI; report any missing isolated proof rather than claiming it passed.

### Manual Testing Steps

None required. Do not add a live agent run or browser check for this router-only change.

## Performance Considerations

Recovery adds at most a single-file unlink attempt for an already completed owner. It needs no log-wide ownership search beyond the existing executed-entry selection, extra publication on the completed path, hashing or timestamp reads.

## Migration Notes

No schema migration. Existing inline and file-prompt runs resume using the stored result as authority. A run already advanced past the bad boundary before upgrade is outside automatic repair: a pending entry plus an untagged result cannot reveal its historical producer. The fix prevents that advance on future recoveries. Atomic publication remains process-crash protection, not a new power-loss durability guarantee. Reverting the change reopens the original gap but introduces no unreadable state fields.

## References

- Scope and acceptance: `context/changes/stale-last-result-cleanup/change.md`.
- Team constraints: `AGENTS.md`, `context/foundation/lessons.md`.
- Ownership/order: `skills/10x-pipeline/scripts/flow.mjs:372`, `skills/10x-pipeline/scripts/flow.mjs:405`, `skills/10x-pipeline/scripts/flow.mjs:544`, `skills/10x-pipeline/scripts/route.mjs:82`.
- Atomic publication: `skills/10x-pipeline/scripts/state.mjs:561`; fault-injection coverage: `skills/10x-pipeline/test/run-state.test.mjs:562`.
- Isolation and usage: `skills/10x-pipeline/scripts/isolation.mjs:484`, `skills/10x-pipeline/scripts/route.mjs:767`.
- Existing proof: `skills/10x-pipeline/test/result-persist.test.mjs`, `skills/10x-pipeline/test/prompt-handoff.test.mjs:190`, `skills/openspec-pipeline/test/openspec-isolation.test.mjs`.
- Routing contracts: `docs/REFERENCE.md` (state publication, file prompt handoff, late usage, neutral retries and OpenSpec).

## Progress

### Phase 1: Shared result ownership and crash recovery

#### Automated

- [x] 1.1 The post-publication crash regression fails before the fix and passes afterward for both chains and both prompt transports; recovery preserves the completed entry and the next step requires its own result.
- [x] 1.2 Unlink failure, missing-file, skipped-row, pending-owner and handoff-marker regressions pass without losing results or permitting premature routing.
- [x] 1.3 Focused suites pass: `node --test --test-concurrency=2 skills/10x-pipeline/test/result-persist.test.mjs skills/10x-pipeline/test/prompt-handoff.test.mjs skills/10x-pipeline/test/run-state.test.mjs`.

### Phase 2: Compatibility, isolation and routing documentation

#### Automated

- [ ] 2.1 Both-chain isolated regressions prove cleanup before successful commits and failed-step snapshots, with no Git or dispatch advance when cleanup fails.
- [ ] 2.2 Both-chain neutral retry and late-usage regressions preserve pending result ownership, retry state and usage attribution.
- [ ] 2.3 Routing documentation and test index describe the tested shared lifecycle; `git diff --check` passes and the diff leaves `WAVES.md`, archives and real router-owned run state untouched by implementation.
- [ ] 2.4 The required repository suite passes on Node 24+: `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`.
