# Run-state lock Implementation Plan

## Overview

`init`, `next` and `usage` each read `run.jsonl`, change it in memory and write it whole (`writeLog`, `skills/10x-pipeline/scripts/state.mjs:373`; `usageCommand`, `scripts/route.mjs:688`). Two calls at once drop one write. Add a lock file taken at the start of those three commands, so the second call halts with a clear message instead of overwriting.

## Current State Analysis

Only anti-stall rule 3 ("never alongside another router call", `skills/10x-pipeline/SKILL.md:87`) keeps the calls apart. The router enforces nothing. `main()` (`route.mjs:806`) resolves the chain, then dispatches; every command ends through `out()` (`process.exit`) or an uncaught-error `halt`, so an `exit` handler runs on every path.

## Desired End State

A second `init`/`next`/`usage` on the same run, while one is running, halts with `{action:"halt", reason}` and exit 1, writing nothing. A lock left by a dead process is ignored. Read-only commands (`status`, `risk`, `verify-archive`, `compare`) take no lock.

### Key Discoveries:

- All write paths funnel through `main()` in `route.mjs:806-918`; one acquire call there covers all three commands on both chains.
- A lock inside the change folder would be committed by step commits and dirty the archive-state folder check (ADR-019), so the lock must live outside it.
- `out()` and `halt()` call `process.exit`, so `process.on("exit")` releases on every path.

## What We're NOT Doing

- No lock for `status`, `risk`, `verify-archive`, `compare` (read-only).
- No waiting or retry; a held lock halts at once.
- No lock for `open-pr.mjs` / `pr-comment.mjs` (standalone, do not write `run.jsonl`).
- No new ADR (small, consistent with ADR-019 guards); no npm dependency.
- No change to the anti-stall rule text beyond noting the router now enforces it.

## Implementation Approach

Add `acquireRunLock(runDir)` to `state.mjs`. Lock file path: `os.tmpdir()/agent-smith-<sha256(abs run dir) first 16 hex>.lock`, taken atomically with its pid already inside: write the pid to a private temp file in the same directory, `fs.linkSync(tmp, lock)` (fails with `EEXIST` when held), then unlink the temp file. A plain `openSync(path, "wx")` followed by a write is not used, because a second caller could read the still-empty file and take it for stale. On `EEXIST`, read the pid; if that process is gone (`process.kill(pid, 0)` throws `ESRCH`; `EPERM` counts as alive) or the content is unparsable, unlink and retry once; otherwise halt. Release on `process.on("exit")` by unlinking the file. `main()` calls it for `init`, `next`, `usage` right after `resolveChain`/reserved-name check and before any write.

## Phase 1: Lock in the router

### Overview

Implement the lock and cover it with tests.

### Changes Required:

#### 1. Lock helper

**File**: `skills/10x-pipeline/scripts/state.mjs`

**Intent**: Add `acquireRunLock` that takes the lock or halts, and registers the release.

**Contract**: `export function acquireRunLock(id, chain)`; uses `paths(id, null, chain).dir` as the key; halt text names the lock file and says another `init`, `next` or `usage` of the change is running, so run router calls one at a time, and that a stale file from a dead process is removed automatically. Needs `node:os` and `node:crypto` (built-ins only, ADR-006). `state.mjs` already imports nothing from other modules, so the import-order rule holds.

#### 2. Call site

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: Take the lock for the three writing commands before any write.

**Contract**: In `main()`, after the reserved-name check, `if (["init","next","usage"].includes(cmd)) acquireRunLock(id, chain);`. Import it from `state.mjs`.

#### 3. Tests

**File**: `skills/10x-pipeline/test/run-lock.test.mjs` (new)

**Intent**: Black-box tests through the CLI using helpers from `helpers.mjs` (`makeProject`, `run`, `writeLog`, `entry`).

**Contract**: Spawn with `env: { TMPDIR: <scratch dir> }` so the lock path is under the test's control; compute the lock path with the same recipe (export the path function from `state.mjs` as `runLockPath(dir)` to share it). Cases: (a) lock held by a live pid (the test's own `process.pid`) makes `next` and `usage` halt, exit 1, `run.jsonl` byte-identical; (b) lock with a dead pid is replaced and the command succeeds; (c) the lock file is gone after a normal run and after a halting run; (d) `status` ignores a held lock; (e) an OpenSpec-chain `next` halts the same way; (f) a lock whose content is a live pid written through the temp-and-link path is never read as empty (a lock file is never observable without its pid).

### Success Criteria:

#### Automated Verification:

- New lock tests pass: `node --test skills/10x-pipeline/test/run-lock.test.mjs`
- Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- `init` and `status` return valid JSON in a scratch change folder (and with `--chain openspec`): `node skills/10x-pipeline/scripts/route.mjs status <id>`

#### Manual Verification:

- Starting two `next` calls at once on a scratch run: one succeeds, the other halts with the lock message, and `run.jsonl` keeps the first call's entry.
- No `.lock` file remains in `os.tmpdir()` after the calls end.

**Implementation Note**: After this phase and its automated checks pass, pause for manual confirmation before Phase 2.

---

## Phase 2: Docs

### Overview

Say the router now enforces the one-call-at-a-time rule.

### Changes Required:

#### 1. Reference and contributor guide

**File**: `docs/REFERENCE.md`, `AGENTS.md`

**Intent**: Document the lock and list the new test file.

**Contract**: In `docs/REFERENCE.md` "Orchestrator anti-stall" and "Late usage figure": one bullet each that `init`, `next` and `usage` take a per-run lock in the OS temp directory, a concurrent call halts with nothing written, and a lock of a dead process is ignored. Add the known limits to the same bullets: the lock key follows `os.tmpdir()` (the `TMPDIR` of the call), so two callers with different `TMPDIR` do not exclude each other; two calls that both find a stale lock at the same moment can both take it; a lock left by a killed process stays until the next call replaces it; a reused pid keeps a stale lock alive. In `AGENTS.md` Project Structure: add `run-lock.test.mjs` and `acquireRunLock` under the `state.mjs` description. SKILL.md files stay unchanged (rule 3 text and its tests are pinned; they name no router internals).

### Success Criteria:

#### Automated Verification:

- Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`

#### Manual Verification:

- The REFERENCE.md and AGENTS.md wording matches the implemented halt text and lock location.

---

## Testing Strategy

### Unit Tests:

- Live-pid lock halts; dead-pid lock is replaced; release on success and on halt.

### Integration Tests:

- CLI runs of `next` and `usage` on both chains with a pre-held lock; read-only commands unaffected.

### Manual Testing Steps:

1. Pre-hold the lock: create the lock file at the path from `runLockPath` with the pid of a live process (for example `echo $$` of a shell kept open), then run `route.mjs next` on a scratch run. Two parallel calls are not a reliable check, because a `next` call can end before the second one starts.
2. Confirm `next` halts with the lock message and the log has no lost entry; then remove the lock file by hand (a file delete, no recursion) and confirm `next` runs.

## Performance Considerations

One `openSync` and one `unlinkSync` per call; negligible.

## Migration Notes

None. Provenance hashes policy sections only; no policy key is added, so no drift.

## References

- Issue: `context/changes/run-state-lock/change.md` (GitHub #92)
- `skills/10x-pipeline/scripts/state.mjs:373` (`writeLog`), `scripts/route.mjs:688` (`usageCommand`), `scripts/route.mjs:806` (`main`)
- ADR-019 (`usage` command guards), `skills/10x-pipeline/SKILL.md:87` (rule 3)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Lock in the router

#### Automated

- [x] 1.1 New lock tests pass: `node --test skills/10x-pipeline/test/run-lock.test.mjs`
- [x] 1.2 Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- [x] 1.3 `init` and `status` return valid JSON in a scratch change folder (and with `--chain openspec`)

#### Manual

- [x] 1.4 Two parallel `next` calls on a scratch run: one succeeds, the other halts with the lock message, no log entry lost
- [x] 1.5 No `.lock` file remains in `os.tmpdir()` after the calls end

### Phase 2: Docs

#### Automated

- [x] 2.1 Full suite passes after the docs change: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`

#### Manual

- [x] 2.2 REFERENCE.md and AGENTS.md wording matches the implemented halt text and lock location
