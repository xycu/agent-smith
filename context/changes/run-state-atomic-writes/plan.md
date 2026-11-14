# Atomic Run State Implementation Plan

## Overview

Publish each router-owned state file atomically and stop a damaged run log from being silently rewritten with entries missing. Cover the 10x and OpenSpec chains, including rollback restoration, report generation and late usage.

This plan follows the change's verified reproduction and the Wave 4 assignment. Planning complexity is medium because the shared state layer reaches routing, Git recovery and execution validation. The unattended planning decisions and their evidence appear below.

## Current State Analysis

### Readers, writers and data contracts

| Owner and current location | Behavior and required reach |
| --- | --- |
| `state.mjs`, `paths` at line 446 and `openspecPaths` at line 466 | Resolve the same three filenames under `context/changes/<id>/agent-smith/` and `openspec/changes/<id>/agent-smith/`. |
| `state.mjs`, `readLog` at line 489 | Returns an array, splits on LF, silently drops unparsable lines and primitive JSON, and accepts arrays as entries. Every caller must be accounted for when changing its return contract. |
| `state.mjs`, `writeLog` at line 516 | Truncates the live log and serializes entries as JSONL with a final LF. |
| `route.mjs`, `next` at line 82 and `init` in `main` at line 869 | Read the log, rewrite metadata, dispatch steps and invoke Git operations. `init` currently reads the log repeatedly for freshness, provenance and the start commit. |
| `route.mjs`, `usageCommand` at line 748 | Rewrites the log and sometimes the report. Archive-state failure restores captured file Buffers, with absence represented by `null`. |
| `flow.mjs`, `writeReport`, `finishRun`, `neutralRetry` at lines 308, 316 and 355 | Write reports and metadata directly, and logs through `writeLog`. `attachResult` at line 491 persists the result into the log before deleting `last-result.json`. |
| `isolation.mjs`, `startCommit` at line 457 and `writeState` at line 534 | Write metadata after the start commit and restore log/metadata after Git reset. Step commits and rollback snapshots stage the entire worktree. |
| `route.mjs`, `status`, `riskCommand`, `readSide` at lines 668, 361 and 412 | Read the log for display or comparison. `comparePair` already retains fields returned by `readSide` when building its two side objects. |
| `route.mjs`, `verifyArchive` and `verifyOpenspecArchive` at lines 282 and 325 | Inspect live/archive identity and report paths, currently without reading the associated logs. |
| `run-codex.mjs`, `validateAction` at line 25 | Reads the log to validate the exact pending dispatch while holding the shared run lock. A damaged log must stop execution before the permission probe or child launch. |
| `state.mjs`, `acquireRunLock` at line 890 | Protects router mutations, report status and Codex execution. Its separate OS-temp ownership protocol already uses temp-and-rename and temp-and-link. |

The ticket's line numbers predate the current layout. All implementation targets above use the current shared script directory. OpenSpec behavior is now under `skills/openspec-pipeline/`, while its state publication remains shared. Sources are the change, current scripts and ADR-024. [Change](change.md) [State layer](../../../skills/10x-pipeline/scripts/state.mjs) [Execution boundary](../../../skills/10x-pipeline/scripts/run-codex.mjs) [ADR-024](../../../docs/ADR/ADR-024-openai-codex-support.md)

A disposable in-worktree probe confirmed that the current reader returns only entry 1 for a damaged final line and entries 1 and 3 for a damaged middle line. It also accepts `[]` and silently drops `null` and `42`. The probe's fixture was removed after checking its file list.

### Wave 4 ownership

| This change's region | Ownership boundary |
| --- | --- |
| Shared state publication, log reading and their direct call sites | `state.mjs`, state-write statements in `flow.mjs` and `isolation.mjs`, router mutation preflight and read-only diagnostics. |
| Comparison log ingestion and diagnostic rendering | Limit edits to `readSide`'s reader/result fields and an additive diagnostic display in `compareMarkdown`. The `failedAttempts` expression, comparison math and failure semantics belong to `compare-failed-attempts-neutral`. |
| Focused regression coverage | Add `skills/10x-pipeline/test/run-state.test.mjs`, covering both chains through existing helpers, and its test-index row. |
| Shared documentation | Add only state-publication, corruption and recovery behavior to `docs/REFERENCE.md`. |
| Other Wave 4 regions | `worktree-setup-script` owns setup and Start step 3, `agent-call-parameters` owns dispatch/anti-stall skill text, `tests-strip-git-env` owns helper environments, and `ci-scratch-in-runner-temp` owns the CI environment. |

Implement comparison diagnostics at the direct state-read boundary described above. Keep the sibling's failure-count hunk independently mergeable. Wave bookkeeping belongs to the post-wave maintenance change. [Wave 4 ownership](../WAVES.md) [Sibling comparison scope](../compare-failed-attempts-neutral/change.md)

## Desired End State

- Every publication of `run.jsonl`, `meta.json` and `report.md`, including restoration, exposes a complete previous or replacement file to readers during process termination or a failed write.
- Eligible writing commands validate the entire existing log while holding the run lock, before modifying run files, consuming results, deleting stale state temps or invoking Git writes.
- A damaged log produces an exit-1 halt naming the file and physical line, with recovery guidance. The original log, metadata, report, pending result, index and refs retain their pre-command state.
- Read-only commands return usable entries plus `logProblems` diagnostics. Clean output retains its existing shape.
- The next eligible writer removes recognized abandoned state temps under the lock before any router staging operation.

## Scope

The deliverable covers state publication and log integrity across both chain roots. Existing JSONL entry fields, metadata fields, report content, router decisions, chain resolution, Git recovery refs and late-usage commit rules remain the compatibility contracts. Cleanup concerns immediate regular files belonging to the three named state targets.

The Wave 4 table assigns policy, CI, helper environments, setup, skill dispatch and comparison failure semantics to their respective runs. The implementation stays within the state and diagnostic regions identified above. Historical archives provide evidence through reads.

## Implementation Approach

Extend the responsible shared layer in `state.mjs` using synchronous Node built-ins. Introduce one atomic file writer and one recognized state-temp naming definition. Route every state publication through that writer. Make log inspection return entries and diagnostics explicitly, with strict behavior as the default and tolerant reads selected by observational commands.

### Assumptions decided unattended

1. Atomicity applies separately to each file during process death and ordinary filesystem errors. The ticket prescribes same-directory write-and-rename, and existing run-lock code supplies the local precedent. A completed rename is the publication boundary. Hardware power-loss durability and cross-file transaction recovery require separate storage guarantees. [Change](change.md) [Lock implementation](../../../skills/10x-pipeline/scripts/state.mjs#L890)
2. `status --report` is a writing command and uses strict validation plus locked cleanup. Its current lock acquisition and report write establish that classification. [Router main](../../../skills/10x-pipeline/scripts/route.mjs#L906) [Status](../../../skills/10x-pipeline/scripts/route.mjs#L668)
3. A usable log line holds a non-null JSON object with arbitrary fields. Arrays and primitives produce diagnostics because the routing consumers expect objects and otherwise silently discard data. Empty physical lines are accepted for compatibility with `writeLog([])`, and CRLF is accepted. A whitespace-only nonempty line produces a parse problem. Missing and zero-byte logs retain the existing empty-log interpretation, since the current format carries no marker distinguishing fresh state from an already-empty damaged file. [Log reader/writer](../../../skills/10x-pipeline/scripts/state.mjs#L489)
4. Recognized abandoned temps are immediate regular files named exactly `<state-basename>.<positive-decimal-pid>.tmp`, for the three state basenames only. Shared lock exclusion establishes that a previous router publication has ended. Matching symlinks, directories and unrelated temp names retain their contents. Exclusive temp creation protects pre-existing entries at the current process's temp path. [Change](change.md) [Guarded file precedent](../../../skills/10x-pipeline/scripts/state.mjs#L792)
5. A corruption refusal preserves all run-folder bytes, including abandoned temps. Therefore strict validation precedes stale-temp cleanup. Cleanup follows argument, chain and archive guards, and precedes publication and staging for an otherwise eligible command. This reconciles the ticket's cleanup and write-nothing requirements. [Change](change.md) [ADR-019 guards](../../../docs/ADR/ADR-019-late-usage-figure.md)
6. Read-only diagnostics are additive and appear only when problems exist. Comparison exposes them independently on `baseline.logProblems` and `routed.logProblems`, plus the Markdown rendering, so the shared read boundary can carry the feature within Wave 4. [Comparison side assembly](../../../skills/10x-pipeline/scripts/route.mjs#L412) [Wave 4 ownership](../WAVES.md)

## Critical Implementation Details

### State sequencing

Take the existing run lock before inspecting mutable log state. After argument and identity guards, validate the complete log, then perform owned-temp cleanup before state writes and Git staging. Keep cleanup in router mutation preflight so `run-codex.mjs` continues to validate state through reads. Preserve its child-ownership lock protocol.

`attachResult` must complete atomic log publication before removing the pending result. Rollback and undo must restore the in-memory log and metadata through the atomic writer in their current order. `usage` restoration must pass the captured Buffers directly to that writer and restore original absence where applicable. Preserve the existing distinction between a failed commit creation and a failure after a commit exists. [Result persistence](../../../skills/10x-pipeline/scripts/flow.mjs#L563) [Rollback](../../../skills/10x-pipeline/scripts/isolation.mjs#L558) [Late usage](../../../skills/10x-pipeline/scripts/route.mjs#L748)

## Phase 1: Atomic state publication and owned-temp cleanup

### Overview

Establish complete per-file publication across all writers and recovery paths, with cleanup performed only by a locked router mutation.

### Changes Required

#### Shared storage primitives

**File**: `skills/10x-pipeline/scripts/state.mjs`

**Intent**

Add `writeFileAtomic(file, data)` and reuse it from `writeLog`. Centralize the three recognized state basenames and their temp-name construction/matching so writing and stale cleanup agree.

**Contract**

Accept UTF-8 strings and Buffers. Create the same-directory `<file>.<pid>.tmp` exclusively, complete and close it, then rename it over the destination. Preserve the destination when creation, write, close or rename fails. On failure, remove only a temp this invocation created, and propagate the original failure with any cleanup failure observable. Cleanup enumerates immediate directory entries, checks the exact naming pattern and regular-file type, and unlinks eligible files individually. A missing run directory is an empty cleanup set. An actual inspection/deletion failure stops the writer before staging.

#### Every publication and restoration call site

**Files**: `skills/10x-pipeline/scripts/route.mjs`, `skills/10x-pipeline/scripts/flow.mjs`, `skills/10x-pipeline/scripts/isolation.mjs`

**Intent**

Replace direct state writes at `init`, rigor/provenance updates, outcome clearing, `writeReport`, `finishRun`, `neutralRetry`, `startCommit`, `writeState` and late-usage restoration. Invoke owned-temp cleanup in the guarded locked mutation path, allowing Phase 2's strict validation to run first.

**Contract**

Each named target uses the shared atomic writer. Preserve existing serialization, trailing-newline behavior, report-error reporting, Git ordering, result consumption ordering and recovery semantics. Carry saved Buffers through late-usage failure restoration byte-for-byte. Report generation uses the same mechanism through every caller, including `status --report`.

#### Atomic-publication regression cases

**File**: `skills/10x-pipeline/test/run-state.test.mjs`

**Intent**

Prove publication and cleanup independently of routing decisions, and cover both chain roots through the current scratch helpers.

**Contract**

Use built-in test mocking for synchronous filesystem failures and a disposable child fixture for termination at the rename boundary. The child can patch `fs.renameSync` locally to announce a barrier and wait, allowing deterministic termination immediately before or after the real rename. Exercise both existing and absent destinations, strings and Buffers, a partial temp write followed by failure, rename failure and temp-name collision with a symlink. Inspect target bytes and temp ownership after each outcome. Keep fault injection test-local.

### Success Criteria

#### Automated Verification

- Atomic writer cases prove complete old-or-new target bytes, Buffer identity, safe collision handling and observable publication/cleanup failures.
- Both-chain cleanup cases remove recognized regular state temps under the lock and preserve unrelated files, symlinks, directories and nested entries.
- Held-lock cases preserve all candidate temps, and an isolated successful step commit contains none of the recognized abandoned temps.
- The repository-mandated router, OpenSpec and tools test suite passes after the script changes.

## Phase 2: Strict log guards and read-only diagnostics

### Overview

Make corruption visible everywhere the router reads logs and stop state-changing paths before they can drop data.

### Changes Required

#### Explicit inspection result

**File**: `skills/10x-pipeline/scripts/state.mjs`

**Intent**

Replace silent line dropping with an explicit log inspection contract and strict-by-default behavior. Retain valid entries in source order for tolerant callers.

**Contract**

`readLog(file, { tolerant = false } = {})` returns `{ entries, logProblems }` for usable or tolerantly inspected input. Each problem has `{ file, line, reason }`, with an absolute file path and a one-based physical line number. File-read failures use `line: null`. Missing files return empty arrays, while other read failures are surfaced. Strict reads reject any problem with an error suitable for the router's JSON halt. Recognize empty physical lines and CRLF, preserve unknown object fields, and report invalid JSON and non-object JSON values without exposing raw log content in diagnostics.

The strict error identifies the first damaged line and explains recovery from a committed copy on the run branch using `git show <sha>:./<project-relative-log-path>`. The relative revision-path form supports projects below the Git root. Tell the operator to preserve the damaged copy and inspect the last usable step commit before restoring the affected content.

#### Mutation guards and execution validation

**Files**: `skills/10x-pipeline/scripts/route.mjs`, `skills/10x-pipeline/scripts/run-codex.mjs`

**Intent**

Update every caller for the explicit reader result. Validate logs strictly in `init`, `next`, `usage`, `status --report` and `validateAction` before any relevant mutation or execution launch.

**Contract**

Reuse the validated entries within each command where practical. In `init`, validate before freshness/isolation decisions and the metadata/start commit. In `next`, validate before result consumption, neutral retry, commit, rollback or end-state writes. In `usage`, validate before both attachment and the identical-figure early return. A corrupt log halts with exit 1 through the existing JSON error boundary, while all run files, index and refs retain their prior bytes/state. The runner's validation failure returns its existing failure envelope before preflight or child launch.

#### Observational commands

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**

Use tolerant reads in plain `status`, `risk`, comparison-side ingestion and archive verification. Display problems while continuing the command's existing observation from usable entries.

**Contract**

Plain status and risk add top-level `logProblems` when populated. Each comparison side adds its own `logProblems`, and Markdown includes the affected side, file and line with a partial-log warning. Carry those fields through the existing side-object assembly. Archive verification collects diagnostics from the selected live/archive logs using the existing chain roots and `--path` resolution, including identified logs on failed verification. Ambiguous archive output includes problems from the candidate logs, with file paths preserving attribution. Retain existing archive truth conditions, exit codes and ambiguity information. Observational paths perform reads and preserve all files and stale temps.

#### Corruption regression matrix

**File**: `skills/10x-pipeline/test/run-state.test.mjs`

**Intent**

Cover malformed logs, recovery guidance and additive diagnostics through normal command entry points, including both chain roots and the runner reader.

**Contract**

Use existing `entry`, scratch-project, Git and OpenSpec helpers through their public contracts. Add corruption fixtures locally. Parameterize damaged final and middle lines, multiple bad lines separated by empty lines, CRLF, missing/empty files, whitespace-only lines, arrays, primitives and valid legacy entries. Snapshot file Buffers, pending results, temp candidates, index and HEAD around writer refusals. Test comparison and archive diagnostics with disposable live and archived fixtures, exact-folder selection and ambiguous archive candidates.

### Success Criteria

#### Automated Verification

- Both chains halt init, next, usage and status --report on damaged final or middle lines with exact file/line recovery guidance and byte-identical run-folder state.
- Strict-reader cases cover non-object JSON, whitespace, physical line numbering and file errors, while valid legacy entries, empty files and CRLF retain their supported behavior.
- Plain status, risk, both comparison formats and verify-archive expose correctly attributed logProblems while preserving files, temps and existing command exit semantics.
- Codex validation refuses a corrupt pending log before preflight or launch on both chains and retains its failure-envelope contract.
- The repository-mandated router, OpenSpec and tools test suite passes after the reader and caller changes.

## Phase 3: Recovery documentation and compatibility verification

### Overview

Document the operator-visible contract and verify that publication changes preserve rollback, result persistence, archive commits and late usage.

### Changes Required

#### User-facing state and recovery contract

**File**: `docs/REFERENCE.md`

**Intent**

Describe per-file atomic publication, the recognized temp pattern, locked cleanup ordering, strict writing commands and read-only diagnostics in the state/report/usage and OpenSpec documentation.

**Contract**

Document the `{ file, line, reason }` diagnostics, clean-output omission, comparison side attribution and archive lookup behavior. Provide a recovery procedure that preserves the damaged file, inspects a committed log on the run branch, restores the damaged content after inspection and retries. State the process-termination guarantee and the distinction between per-file publication and multi-file recovery. Keep the comparison edit limited to log diagnostics.

#### Test index and recovery regressions

**Files**: `skills/10x-pipeline/test/README.md`, `skills/10x-pipeline/test/run-state.test.mjs`

**Intent**

Index the new test and add only recovery assertions that the existing suites do not cover. Use the existing late-usage and rollback tests as the compatibility baseline.

**Contract**

Add exact Buffer comparisons for archive-state usage after a rejected pre-commit hook, including distinctive original JSON whitespace/report bytes and original report absence. Verify an identical repeated usage attachment performs zero publications. Exercise failed atomic result persistence with a pending result retained, late usage through rollback and undo-on-halt, both-chain reports and archive-state cleanup before cleanliness checks. Test that restoration failure produces an observable error identifying the incomplete recovery.

### Success Criteria

#### Automated Verification

- Late-usage failure restores exact original Buffers or absence, repeated equal usage performs zero publications, and restoration failure is observable.
- Existing result-persistence, rollback, undo-on-halt, archive, late-usage and both-chain execution suites pass alongside the new state tests.
- Reference documentation and the test index describe the implemented state contract, and a writer/caller audit accounts for every router state publication and log read.
- Both-chain CLI smoke checks return action run with a step, followed by readable status, and the full repository-mandated test suite passes.

## Testing Strategy

### Focused proof

Run `node --test skills/10x-pipeline/test/run-state.test.mjs` while developing the owned behavior. For recovery, run the existing `late-usage.test.mjs`, `result-persist.test.mjs`, `rollback.test.mjs`, `stepcommit.test.mjs`, `run-lock.test.mjs`, `codex-runner.test.mjs`, `archive.test.mjs`, `openspec-isolation.test.mjs` and `openspec-archive.test.mjs` suites using their current directories.

Use deterministic filesystem mocks and barrier-controlled disposable children for crash cases. Inspect all three state targets, including an absent report and Buffer restoration. Tests create fixtures inside this run worktree by pointing `TMPDIR` at a dedicated in-worktree scratch parent. Nested scratch projects then keep their OS-temp parent outside their own fixture run root, satisfying runner validation. Inspect scratch files before individual deletion and reuse `removeTree` for test-owned cleanup.

### Required repository gate

After each phase that changes scripts, run `node --test skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs` on Node 24+. The planning host has Node v26.13.1. Record any environment-dependent skips explicitly. The final audit searches `skills/10x-pipeline/scripts/` and `skills/openspec-pipeline/scripts/` for `readLog`, `writeLog`, `writeReport`, `writeState` and direct writes of the named targets.

### CLI smoke checks

Use fresh disposable 10x and OpenSpec changes with isolation opted out as the repository smoke procedure prescribes. Run `init` and assert `action: "run"` with a concrete step, then `status`. Damage a scratch log line and assert writer refusal plus read-only diagnostics. Repeat the writer and status checks using `--chain openspec`. The automated cases provide acceptance evidence for this file-based CLI change.

## Performance Considerations

Log reads and rewrites already process the complete file, so collecting diagnostics retains linear work in log bytes. Cleanup enumerates only the immediate run directory. Atomic publication temporarily requires space for one complete replacement alongside the current file. A space error preserves the current target and surfaces the failed publication.

## Migration Notes

### Forward path

Introduce the atomic helper and migrate writers first, then migrate the log-reader contract and all callers together. Run the required suite at both boundaries. Existing persisted JSONL and metadata retain their schemas, filenames and locations. Valid legacy state, skip entries, optional provider/host fields and unknown object fields remain readable. The rollout requires compatible router modules from one plugin version and serial commands using the shared lock.

Older complete files are valid inputs to the new writer. New complete files remain valid inputs to older releases. A log already damaged before deployment requires explicit operator recovery, using read-only diagnostics and a committed copy. An already-empty file retains the historical empty-log behavior described in assumption 3.

### Rollback path

Revert the implementation commits through ordinary version control and use the previous compatible plugin module set. Persisted schemas support that rollback. Preserve damaged logs for inspection and restore their contents only through the documented operator procedure. Existing rollback refs and late-usage commit/recovery rules continue to govern interrupted run work. A process interrupted between publications may leave complete files from different stages, so recovery still follows the existing command and Git lifecycle.

### Verification boundary

This step produces the plan and brief. Implementation acceptance consists of the three phases and their automated criteria. The planning probe characterizes the existing loss behavior. Runtime crash guarantees become verified when the planned fault-injection and CLI tests pass.

## References

- [Change and verified reproduction](change.md)
- [Wave ownership](../WAVES.md)
- [Repository lessons](../../foundation/lessons.md)
- [State readers, writer and lock](../../../skills/10x-pipeline/scripts/state.mjs)
- [Router commands and recovery](../../../skills/10x-pipeline/scripts/route.mjs)
- [Report and result persistence](../../../skills/10x-pipeline/scripts/flow.mjs)
- [Isolation and state restoration](../../../skills/10x-pipeline/scripts/isolation.mjs)
- [Codex execution validation](../../../skills/10x-pipeline/scripts/run-codex.mjs)
- [ADR-010 run commits and rollback](../../../docs/ADR/ADR-010-run-worktree-step-commits-and-rollback.md)
- [ADR-019 late usage](../../../docs/ADR/ADR-019-late-usage-figure.md)
- [Current reference](../../../docs/REFERENCE.md)

## Progress

### Phase 1: Atomic state publication and owned-temp cleanup

#### Automated

- [ ] 1.1 Atomic writer cases prove complete old-or-new target bytes, Buffer identity, safe collision handling and observable publication/cleanup failures.
- [ ] 1.2 Both-chain cleanup cases remove recognized regular state temps under the lock and preserve unrelated files, symlinks, directories and nested entries.
- [ ] 1.3 Held-lock cases preserve all candidate temps, and an isolated successful step commit contains none of the recognized abandoned temps.
- [ ] 1.4 The repository-mandated router, OpenSpec and tools test suite passes after the script changes.

### Phase 2: Strict log guards and read-only diagnostics

#### Automated

- [ ] 2.1 Both chains halt init, next, usage and status --report on damaged final or middle lines with exact file/line recovery guidance and byte-identical run-folder state.
- [ ] 2.2 Strict-reader cases cover non-object JSON, whitespace, physical line numbering and file errors, while valid legacy entries, empty files and CRLF retain their supported behavior.
- [ ] 2.3 Plain status, risk, both comparison formats and verify-archive expose correctly attributed logProblems while preserving files, temps and existing command exit semantics.
- [ ] 2.4 Codex validation refuses a corrupt pending log before preflight or launch on both chains and retains its failure-envelope contract.
- [ ] 2.5 The repository-mandated router, OpenSpec and tools test suite passes after the reader and caller changes.

### Phase 3: Recovery documentation and compatibility verification

#### Automated

- [ ] 3.1 Late-usage failure restores exact original Buffers or absence, repeated equal usage performs zero publications, and restoration failure is observable.
- [ ] 3.2 Existing result-persistence, rollback, undo-on-halt, archive, late-usage and both-chain execution suites pass alongside the new state tests.
- [ ] 3.3 Reference documentation and the test index describe the implemented state contract, and a writer/caller audit accounts for every router state publication and log read.
- [ ] 3.4 Both-chain CLI smoke checks return action run with a step, followed by readable status, and the full repository-mandated test suite passes.
