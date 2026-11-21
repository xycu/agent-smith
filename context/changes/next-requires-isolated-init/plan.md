# Make next refuse a run that init would refuse for missing isolation Implementation Plan

## Overview

Run isolation (`isolation.require`, shipped `true`) is enforced only by `init`. `next` reads `meta.json` with the fallback `{ id, goal: "" }`, so a `next` typed in the main checkout, or an orchestrator that skips `init`, starts a run with an empty goal on the default branch, with no step commits and no rollback snapshot. This plan adds one guard to `next()`: when isolation is required and `meta.json` does not record an isolated run, `next` halts, writes nothing and tells the caller to run `init` first.

## Current State Analysis

- `init` calls `isolationCheck` before it writes anything (`skills/10x-pipeline/scripts/route.mjs:1105`, gated by `isolationOn(policy)`), and sets `meta.isolated = true` and `meta.branch` only for a fresh run (`route.mjs:1118`). A run with executed steps that was not started isolated halts at `init` (`isolation.mjs:322`).
- `next()` (`route.mjs:83-`) has no isolation check. Line 90 reads `mutationMeta(p) ?? { id, goal: "" }`; `cleanupStateTemps` and `fs.mkdirSync(p.dir, ...)` follow at lines 96-97, and `meta.json` is written later when rigor or drift changed.
- `init` finishes by calling `next(id, policy, chain, log)` in the same process (`route.mjs:1142`). By then `meta.json` is written and holds `isolated: true` for an isolated run, so a guard on `meta.isolated` does not disturb that call.
- `isolationOn(policy)` (`isolation.mjs:288`) is strict: only the boolean `true` is on. Test scratch projects get `{ "isolation": { "require": false } }` from `writeOverride` unless a test sets its own `isolation` key (`test/helpers.mjs:94-95`), so the large majority of tests are unaffected.
- The shared run lock is taken in `main()` before `next` runs (`route.mjs:1021`). It lives in `os.tmpdir()`, not in the project, so a halt before any project write still "writes nothing" there.

### Key Discoveries:

- `halt()` ends the process with JSON and exit 1 (`state.mjs:1113`), so a guard placed before `cleanupStateTemps` leaves the project untouched.
- The isolation policy and `meta.isolated` are shared by both chains (`isolationCheck` takes `chain`), and `next()` is shared too, so one guard covers the 10x and OpenSpec chains.
- Existing isolation tests use `repo()`, `worktree()`, `initIn()` and `nextIn()` in `skills/10x-pipeline/test/isolation.test.mjs:25-50`; test 2.2 (line 204) already proves an isolated run advances after `init`.
- `docs/REFERENCE.md` has no `next` command section; the isolation rules live in the "Run isolation:" bullet list (lines 137-168), where the `init` halt rules are at lines 141-142. The `next` line goes there.

## Desired End State

With `isolation.require: true` and no `isolated: true` in `meta.json` (no file, or a file without the flag), `route.mjs next <id>` prints `action: "halt"`, exits 1, creates no `agent-smith/` folder, leaves an existing `meta.json` and `run.jsonl` byte-identical, and names `init`. A run started by `init` in a run worktree still advances. A project with `isolation.require: false` behaves exactly as today, including `next` with no `meta.json`. Verified by the new tests and the full suite.

## What We're NOT Doing

- No change to `init`, `isolationCheck`, `prepare-run.mjs`, the skills or any prompt. The orchestrator skills already run `init` first.
- No halt for `next` without `meta.json` when isolation is off (decision, see Implementation Approach). That case keeps today's behavior.
- No full re-run of `isolationCheck` (worktree, branch and ignore checks) in `next`. The recorded `meta.isolated` is the signal; the step commit and rollback code already run their own worktree and branch checks on an isolated run.
- No new policy key, no new meta field, no ADR (ADR-010 describes the rule; the new line in `docs/REFERENCE.md` records the extension).
- No handling of runs that started before isolation existed beyond the same halt and message (they were already refused at `init`).

## Implementation Approach

Add a small guard at the top of `next()`, right after the metadata is read and before `cleanupStateTemps` and `mkdirSync`, so nothing is written. The guard fires when `isolationOn(policy)` is true and `meta.isolated !== true`. This is the same condition under which `init` would have set `isolated` or halted, so `next` now refuses exactly what `init` would refuse for missing isolation, without duplicating its git checks. Use one message for both a missing `meta.json` and a `meta.json` without the flag; it tells the caller to run `init` first, from the run worktree, and ends with `Nothing was written.`. A legacy run with executed steps and no flag then gets the more specific `init` halt (opt-out named) when the caller follows the message.

Decision on `next` without `meta.json` when isolation is off: keep today's behavior. That is the explicit reading of "isolation-off projects keep today's behavior", many existing tests and the opt-out finish-an-in-flight-run path rely on it, and change.md leaves it to the plan with that default.

## Phase 1: Guard `next` and test it

### Overview

Add the guard in `route.mjs` and cover it with tests in the existing isolation test file; then bring the rest of the suite back to green.

### Changes Required:

#### 1. The guard in `next()`

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: Halt before any write when isolation is required but `meta.json` does not record an isolated run, so a skipped `init` cannot start steps on the default branch.

**Contract**: In `next()`, immediately after `const meta = mutationMeta(p) ?? { id, goal: "" };`, `if (isolationOn(policy) && meta.isolated !== true) halt(...)`. The reason names the config key (`isolation.require`), says `meta.json` does not record an isolated run, says to run `init` first (in the run worktree), and ends with `Nothing was written.`. `isolationOn` is already imported. The `init` path is unaffected because it writes `isolated: true` before it calls `next`.

#### 2. Tests

**File**: `skills/10x-pipeline/test/isolation.test.mjs`

**Intent**: Cover the halt, the untouched state, the isolated advance and the isolation-off behavior, with the real router in scratch repositories like the neighbouring tests.

**Contract**: New tests, in the style of 2.1/2.2 (`{ skip }`, `repo()`, `worktree()`, `nextIn()`, `assertHalt`):
- Default isolation policy (`ON`), main checkout, no `meta.json`: `nextIn` halts with exit 1, reason matches `/run init first/i` and names `isolation.require`, `fs.existsSync(agentDir)` is false, and `git branch --show-current` still prints the original branch with a clean tree.
- Same policy, a worktree on its run branch, `meta.json` present without `isolated` (written with `writeMetaFile`) and a log with one executed entry: `nextIn` halts the same way, and `meta.json` and `run.jsonl` are byte-identical afterwards.
- `initIn(wt)` in a worktree, then a failed `writeResult`, then `nextIn(wt)`: `action` is `run`, the log has the entry that follows, and `meta.isolated` is still `true`.
- `require: false` (default scratch policy via `repo({ policy: {} })`), no `meta.json`: `nextIn` returns `action: "run"` and writes `meta.json` without `isolated`, as today.

**File**: `skills/openspec-pipeline/test/openspec-isolation.test.mjs`

**Contract**: One test for the other chain, because the plan claims the one guard covers both: an OpenSpec change with the default isolation policy (`ON`), main checkout, no `meta.json`: `next <id> --chain openspec` halts with exit 1, names `init`, and `fs.existsSync` of `openspec/changes/<id>/agent-smith` is false. Use the helpers and the style of the neighbouring tests in that file.

#### 3. Fix fixtures the guard breaks

**File**: `skills/10x-pipeline/test/*.test.mjs`, `skills/openspec-pipeline/test/*.test.mjs` (only those that fail)

**Intent**: A test that runs `next` with isolation on (its own `isolation: { require: true }` block, or the shipped default after its override file is removed) on a run that `init` did not record as isolated now halts; give such a fixture `isolated: true` (and the `branch` it needs) in its `meta.json`, switch its first call to `init` in a worktree, or keep isolation off for it.

**Contract**: A dry run of the guard against the full suite (2112 tests, scratch copy of this plan's guard) broke exactly one fixture: `skills/10x-pipeline/test/preplan.test.mjs`, test "a bad prompt reference halts before the subagent result is consumed" (line 202). It runs `init` with isolation off, then ends with `fs.rmSync(overrideFile)`, which restores the shipped `isolation.require: true`, so the final `next` halts. Replace that `fs.rmSync(overrideFile)` with `writeOverride(project, {})` (already imported there; it writes `isolation.require: false`, the state the run started in). The test files that name `isolation` (`rollback`, `stepcommit`, `late-usage`, `open-pr`, `neutral`, `firstattempt`, the openspec isolation tests) did not break, because they `init` in a worktree. Still run the full suite after the guard lands and fix any further failure the same way. Change only fixtures, never an assertion about router behavior other than for this guard.

### Success Criteria:

#### Automated Verification:

- The new tests pass: `node --test --test-concurrency=2 skills/10x-pipeline/test/isolation.test.mjs`
- The full suite passes: `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- The main-checkout halt test inside the suite asserts exit 1, `init` named in the reason, and no `agent-smith/` folder afterwards

#### Manual Verification:

- Read the halt reason once and confirm it tells a person what to do (run `init` in the run worktree) without suggesting the opt-out as the first remedy

**Implementation Note**: After this phase and all automated verification pass, pause for manual confirmation before Phase 2.

---

## Phase 2: Document the rule

### Overview

Add the one line under `next` in the reference doc and check that no other doc states the old behavior.

### Changes Required:

#### 1. REFERENCE line

**File**: `docs/REFERENCE.md`

**Intent**: Record that `next` refuses a run `init` would refuse for missing isolation.

**Contract**: One bullet in the "Run isolation:" list, directly after the `init` bullets (after line 142): with `isolation.require` on and no `isolated: true` in `meta.json`, `next` halts, writes nothing and names `init`; with isolation off nothing changes, including `next` without `meta.json`. Both chains share it. Write the bullet so it contains the literal text `next` halts, writes nothing (backticks around `next`): row 2.1's loose pattern `next. halts` already matches an older sentence (line 159, the staged-index note), so confirm the new bullet with `grep -n "next. halts, writes nothing" docs/REFERENCE.md`, which matches only the new bullet.

#### 2. Grep the other docs

**File**: `docs/ADR/ADR-010-run-worktree-step-commits-and-rollback.md`, `README.md`, `skills/10x-pipeline/SKILL.md`, `skills/openspec-pipeline/SKILL.md`

**Intent**: Per `lessons.md`, grep every doc for text that says the isolation check runs only at `init` or that `next` may be called first, and fix any that now misstate behavior.

**Contract**: Edit a doc only when it states the old behavior; skills must keep naming no models, effort levels or tiers. The line "A run in the main checkout halts at `init`" (ADR-010 line 126) stays true and is left alone.

### Success Criteria:

#### Automated Verification:

- The REFERENCE line exists: `grep -n "next. halts" docs/REFERENCE.md`
- The full suite still passes: `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- Version metadata is untouched: `node tools/version-check.mjs`

#### Manual Verification:

- The new REFERENCE bullet reads clearly next to the `init` bullets and mentions the isolation-off exception

---

## Testing Strategy

### Unit Tests:

- Halt with no `meta.json`; halt with a `meta.json` lacking the flag and one executed entry; both leave the project unchanged.
- Isolated run started by `init` advances; isolation-off keeps today's behavior.

### Integration Tests:

- The full suite drives the real router through the CLI in scratch projects; it must stay green with only fixture changes.

### Manual Testing Steps:

1. In a scratch git repo on `main` with the default policy and `context/changes/demo/change.md`, run `next demo`; expect the halt and no new files.
2. Run `init demo --goal "..."` in a linked worktree on `agent-smith/demo`, then `next demo` after a result; expect it to advance.

## Performance Considerations

None: one object-property check before the existing work.

## Migration Notes

A run in flight in the main checkout with isolation on (started before this change with isolation off, then policy flipped) now halts at `next` too; `init` already refused it. The remedy stays the opt-out named by `init`.

## References

- Origin: `context/changes/next-requires-isolated-init/change.md`
- Init check: `skills/10x-pipeline/scripts/route.mjs:1105`, `skills/10x-pipeline/scripts/isolation.mjs:288-326`
- Existing isolation tests: `skills/10x-pipeline/test/isolation.test.mjs:97`, `:204`
- Decisions: `docs/ADR/ADR-010-run-worktree-step-commits-and-rollback.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Guard `next` and test it

#### Automated

- [x] 1.1 The new tests pass: `node --test --test-concurrency=2 skills/10x-pipeline/test/isolation.test.mjs` — aa17e6d9
- [x] 1.2 The full suite passes: `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs` — aa17e6d9
- [x] 1.3 The main-checkout halt test inside the suite asserts exit 1, `init` named in the reason, and no `agent-smith/` folder afterwards — aa17e6d9

#### Manual

- [ ] 1.4 Read the halt reason once and confirm it tells a person what to do (run `init` in the run worktree) without suggesting the opt-out as the first remedy

### Phase 2: Document the rule

#### Automated

- [x] 2.1 The REFERENCE line exists: `grep -n "next. halts" docs/REFERENCE.md`
- [x] 2.2 The full suite still passes: `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- [x] 2.3 Version metadata is untouched: `node tools/version-check.mjs`

#### Manual

- [ ] 2.4 The new REFERENCE bullet reads clearly next to the `init` bullets and mentions the isolation-off exception
