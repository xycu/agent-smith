# Exclusive stale run-lock takeover Implementation Plan

## Overview

Two router processes that both find the same stale run lock can both take it, so both read, modify and write `run.jsonl` and the last writer drops the other's record. This plan makes the stale branch of the lock exclusive with a takeover guard, keeps the lock path and format, never takes over a native lock, makes the busy message for a live pid actionable, and proves exclusion with a multi-process test whose hold intervals never overlap.

## Current State Analysis

- The logic is not in `state.mjs:990-1021` (the `change.md` line numbers are stale). `acquireRunLock` in `skills/10x-pipeline/scripts/state.mjs:1118-1120` only forwards to `lockRunDirectory` in `skills/10x-pipeline/scripts/run-lock.mjs`. This plan calls the whole thing "the run lock".
- `lockRunDirectory` writes the pid to a private temp file `${lock}.${pid}.tmp`, then `fs.linkSync(tmp, lock)` (exclusive). On `EEXIST` it reads the lock, classifies it, and for a stale lock does `unlinkQuiet(lock)` and goes round the loop once more (`run-lock.mjs:60-62`, the `attempt > 0` check).
- Classification today, in order: a JSON owner with a `native` key halts; a live pid halts with "Another init, next or usage ..."; a structured execution owner whose child process group may be alive halts; everything else (dead pid, unparsable text) is stale.
- The race: A and B both read the stale pid; A unlinks and links; B then unlinks A's fresh lock and links its own. Both return from `lockRunDirectory`. Reproduced in the audit: 8 of 200 rounds with 2 processes, 12 of 150 with 8.
- Callers: `route.mjs` (`next`, `usage`, `status --report`, `init`), `run-claude.mjs`, `run-codex.mjs` through `acquireRunLock(id, chain, onBusy)`, and `pr-common.mjs` `withPublicationLock` through `lockRunDirectory` directly. Every `onBusy` halts, exits or throws; none returns.
- `release()` already unlinks the lock only while it holds this process's pid, and runs on `process.on("exit")` after success.
- Tests: `skills/10x-pipeline/test/run-lock.test.mjs` pins the single-caller stale recovery (`1.1b`, two cases), the live-pid text (`/Another init, next or usage of change demo is running/`, the lock path in the reason), native and uncertain-child retention, and no leftovers via `leftovers(tmp)` (files ending `.lock` or `.tmp`). `codex-runner.test.mjs` matches `/lock/` and `lock file .*\.lock.*settlement.*recovery` for native text.
- `docs/REFERENCE.md:454` states the limit "two calls that find a stale lock at the same moment can both take it". It becomes false.

## Desired End State

- At most one process holds a run lock at any instant, also when many processes find the same stale lock together. The stale branch re-reads the lock under a takeover guard before it deletes and links.
- A lock with the `native` key, and a structured execution lock whose child group may be alive, are never taken over, with or without the guard.
- Lock file name, location and content format are unchanged, so a mixed pair of plugin versions on one machine does not deadlock.
- The busy message for a live pid says how to check that the pid is a router and what to do when it is not.
- A multi-process test with many rounds fails on the unfixed `run-lock.mjs` and passes on the fixed one; the full suite passes.

### Key Discoveries:

- `skills/10x-pipeline/scripts/run-lock.mjs:30-65` holds the whole acquire loop; `release` at `:38-46`; the live-pid message at `:55`.
- The temp-file-plus-`linkSync` trick gives atomic creation with content; the guard reuses it with the same temp file (it holds this pid).
- `os.tmpdir()` is read at call time, so a worker with `TMPDIR` set gets its own lock directory (existing `setup` in `run-lock.test.mjs:24-33` relies on it). The lock name is keyed by the run directory path, so one scratch root with ids `r0..rN` gives N independent locks.
- `Atomics.wait` on a `SharedArrayBuffer` is the sync sleep already used in `test/prepare-run-helpers.mjs:77`.

## What We're NOT Doing

- No change to the lock path, file name or content format, to `setChild`/`setThread`/`clearChild`, or to the native and execution-lock branches.
- No pid-start-time or process-name check to detect a reused pid; the message tells the owner how to check.
- No unguarded-version protection: a process of an older plugin version still takes over a stale lock without the guard (the lock format must not change, so old versions cannot join the guard).
- No automatic recovery of a stale takeover guard (see Critical Implementation Details); no change to `tools/test-durations.json` (the `test-shard-durations-refresh` change owns it).
- No ADR: the lock has no ADR, and the decision is local to `run-lock.mjs` and `docs/REFERENCE.md`.

## Implementation Approach

Take the "second exclusive link" direction of `change.md`, not the "re-read after a wait" alternative: the guard gives a proof of exclusion; a wait only narrows the window. Restructure the `EEXIST` branch into a bounded loop. Classification becomes one local function over the lock contents that returns a busy reason or "stale". Busy reasons halt exactly as now. Only a stale result enters the takeover, and the takeover re-classifies under the guard, so a lock that changed since the first read is never deleted.

## Critical Implementation Details

- **State sequencing.** Under the guard: re-read the lock; if it is gone, only retry the link; if it is now busy, halt with that reason; if still stale, `unlink` then `linkSync(tmp, lock)`. If that link fails with `EEXIST`, a caller that saw no lock (and so needs no guard) linked first: leave the guard and loop again so the new owner is classified, never overwritten. Release the guard in a `finally` and also in `release()`, because halts call `release()` before `onBusy`.
- **Guard failure modes.** The guard is `${lock}.takeover`, linked from the same temp file, so it carries the owner pid. A live holder is waited for (poll about 20 ms, total budget about 1 s, then halt busy with the guard path). A holder pid that is dead means a crash inside a microsecond window; removing it would reopen the race, so halt with a message that names the guard file and says to remove it when no router runs. Exclusion is never traded for self-healing here.

## Phase 1: Exclusive takeover, safe guard, clearer message

### Overview

Fix `lockRunDirectory`, change the live-pid message, update the focused tests and the Limits sentence in `docs/REFERENCE.md`.

### Changes Required:

#### 1. The acquire loop

**File**: `skills/10x-pipeline/scripts/run-lock.mjs`

**Intent**: Make the stale branch exclusive. Extract the classification into one function reused before and under the guard, add the guard acquire/release, and bound the retry loop (about 10 attempts, then rethrow the `EEXIST` error as today).

**Contract**: Same exported `lockRunDirectory(root, id, chain, onBusy)` and `runLockPath`, same returned object. New file `${lock}.takeover`, linked from `tmp`, removed only while it holds this pid, removed by `release()` as well as by the takeover `finally`. Native-key locks and execution locks with a possibly live group go to `onBusy` before any guard is taken, and again if seen under the guard. `onBusy` is called after `release()` as today.

#### 2. The live-pid message

**File**: `skills/10x-pipeline/scripts/run-lock.mjs`

**Intent**: Keep the existing opening sentence, `lock file <path>, pid <pid>` and "Nothing was written." and add, before "Nothing was written.", how to check that the pid is a router (for example `ps -p <pid> -o command=` shows `route.mjs`, `run-claude.mjs`, `run-codex.mjs`, `open-pr.mjs` or `pr-comment.mjs`) and that when it is another program and no router runs for this change, the owner removes the lock file and retries.

**Contract**: The reason still matches `/Another init, next or usage of change <id> is running/` and contains the lock path. The native and Codex execution messages are not changed.

#### 3. The documented limit

**File**: `docs/REFERENCE.md`

**Intent**: In the "Run lock" bullet (line 454), replace "two calls that find a stale lock at the same moment can both take it" with the guarded takeover, and state the two limits that remain: a caller of an older plugin version takes over without the guard, and a crash inside the takeover leaves `<lock>.takeover`, which halts the next caller until removed. Add that a live-pid halt names how to check the pid. Per the lessons rule, grep `docs/`, `README.md`, both `SKILL.md` files and `AGENTS.md` for other statements of the old behavior.

**Contract**: Prose only; no routing wording moves into a `SKILL.md`.

#### 4. Focused tests

**File**: `skills/10x-pipeline/test/run-lock.test.mjs`

**Intent**: Keep `1.1a` to `1.1f` and the native cases. Add: the `leftovers` filter also counts files ending `.takeover`; `1.1a` also asserts the new message parts; a stale lock with a guard held by a live pid halts after the bounded wait, names the guard path and leaves the lock unchanged; a stale lock with a guard of a dead pid halts with the removal advice and leaves both files; a native lock (dead owner pid) with no guard created is retained and creates no guard file.

**Contract**: Black-box through `usage`, with `TMPDIR` in the scratch directory, like the neighbouring cases. The live-guard case takes about 1 s because of the wait budget.

### Success Criteria:

#### Automated Verification:

- Focused lock tests pass, including the single-caller stale recovery: `node --test --test-concurrency=2 skills/10x-pipeline/test/run-lock.test.mjs`
- Other users of the lock still pass: `node --test --test-concurrency=2 skills/10x-pipeline/test/run-state.test.mjs skills/10x-pipeline/test/codex-runner.test.mjs skills/10x-pipeline/test/claude-runner.test.mjs skills/10x-pipeline/test/open-pr.test.mjs skills/10x-pipeline/test/pr-comment.test.mjs`
- Lock path and format are unchanged: `! git diff main -U0 -- skills/10x-pipeline/scripts/run-lock.mjs | grep -E '^[-+].*(agent-smith-|sha256|tmpdir|slice)'` prints nothing
- No stale statement of the old limit remains: `! grep -rn "can both take it" docs README.md skills AGENTS.md`
- Router smoke check (scratch project, `{ "isolation": { "require": false } }`): `init <id> --goal "x"` returns `action: "run"`, then `status <id>` succeeds

## Phase 2: Multi-process exclusion proof

### Overview

Add a worker helper and one test that runs many processes against many stale locks and asserts hold intervals never overlap; prove it fails on the pre-fix module.

### Changes Required:

#### 1. The worker

**File**: `skills/10x-pipeline/test/run-lock-worker.mjs` (a helper, not a `*.test.mjs`, so the suite glob does not run it)

**Intent**: One process that, for `R` rounds on a shared time grid, spins until the round's slot start, calls `lockRunDirectory` for the round's id, holds the lock for a fixed time, records the interval and releases. A busy halt is recorded as a loss, not an error. At the end it prints one JSON line with its intervals.

**Contract**: argv `<root> <idPrefix> <rounds> <startAtMs> <slotMs> <holdMs>`; env `TMPDIR` for the lock directory; optional env `LOCK_MODULE` (absolute path) replaces the imported `run-lock.mjs`, so the harness can be run against the pre-fix source. Time is `performance.timeOrigin + performance.now()` (fractional ms, comparable across processes). `onBusy` throws a local error that the worker catches.

#### 2. The test

**File**: `skills/10x-pipeline/test/run-lock.test.mjs`

**Intent**: Create `R` (about 120, chosen in Phase 2 so the pre-fix run fails every time) stale locks, one per round id, each holding a dead pid; start about 6 worker processes with the same start time and a slot of about 40 ms and a hold of about 10 ms; wait for all; assert for every round that at least one worker held the lock (liveness), that the held intervals sorted by start never overlap, and that the scratch directory has no `.lock`, `.tmp` or `.takeover` leftovers. Remove the scratch directories with `removeTree`.

**Contract**: Run on POSIX and Windows alike unless `link` semantics differ; skip only where an existing lock test already skips. The failure message names the round and the two overlapping intervals.

#### 3. The test index

**File**: `skills/10x-pipeline/test/README.md`

**Intent**: Extend the `run-lock.test.mjs` row with "stale-takeover exclusion across processes" and add a row for `run-lock-worker.mjs`, as `claude-helpers.mjs` has one.

**Contract**: Table rows only.

### Success Criteria:

#### Automated Verification:

- The new multi-process test passes on the fixed module: `node --test --test-concurrency=2 skills/10x-pipeline/test/run-lock.test.mjs`
- The harness detects the race: run the same worker harness with `LOCK_MODULE` set to the pre-fix source (`git show $(git merge-base HEAD main):skills/10x-pipeline/scripts/run-lock.mjs`, saved in the scratchpad directory); the test run exits non-zero with an overlap message in 5 of 5 attempts
- The test is stable on the fixed module: five consecutive runs of `node --test skills/10x-pipeline/test/run-lock.test.mjs` all pass
- Full suite passes: `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- No recursive delete was introduced: `node --test skills/10x-pipeline/test/no-recursive-delete.test.mjs`
- Version fields still equal: `node tools/version-check.mjs`

## Testing Strategy

### Unit Tests:

- Guard held by a live pid, by a dead pid; native lock untouched; live-pid message parts; single-caller stale and unparsable recovery still pass; no `.takeover` file after success or halt.

### Integration Tests:

- Multi-process overlap test over about 120 rounds with about 6 processes, failing on the unfixed module.

### Manual Testing Steps:

None; every claim is locally executable.

## Performance Considerations

The guard adds two `link` calls only on the stale path. A normal acquire is unchanged. The new test adds about 6 s and the live-guard case about 1 s to `run-lock.test.mjs` (14.4 s in `tools/test-durations.json`); the shard timings are refreshed by `test-shard-durations-refresh`.

## Migration Notes

None. The lock file is unchanged; old and new versions interoperate, with the guard effective only between new versions.

## References

- Change notes: `context/changes/run-lock-stale-takeover-race/change.md`
- Lock code: `skills/10x-pipeline/scripts/run-lock.mjs`; wrapper `skills/10x-pipeline/scripts/state.mjs:1118`
- Existing tests: `skills/10x-pipeline/test/run-lock.test.mjs`; behavior text `docs/REFERENCE.md:454`
- Wave context: `context/changes/WAVES.md` (lane "Lock and Codex", Wave 2)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Exclusive takeover, safe guard, clearer message

#### Automated

- [ ] 1.1 Focused lock tests pass, including the single-caller stale recovery
- [ ] 1.2 Other users of the lock still pass
- [ ] 1.3 Lock path and format are unchanged
- [ ] 1.4 No stale statement of the old limit remains
- [ ] 1.5 Router smoke check returns a run action and a status

### Phase 2: Multi-process exclusion proof

#### Automated

- [ ] 2.1 The new multi-process test passes on the fixed module
- [ ] 2.2 The harness detects the race on the pre-fix module
- [ ] 2.3 The test is stable on the fixed module over five runs
- [ ] 2.4 Full suite passes
- [ ] 2.5 No recursive delete was introduced
- [ ] 2.6 Version fields still equal
