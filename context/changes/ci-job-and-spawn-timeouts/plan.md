# Job timeouts in CI and spawn timeouts in the test helpers Implementation Plan

## Overview

Nothing stops a hung test run: neither CI job sets `timeout-minutes` (GitHub default 360 minutes, on a self-hosted runner), and the `run` and `git` helpers of `skills/10x-pipeline/test/helpers.mjs` call `spawnSync` with no `timeout`. Add `timeout-minutes: 15` to both jobs of `ci.yml`, and a 120000 ms default `timeout` to both helpers, with a thrown error that names the command when `res.error` is set. Pin both with tests.

## Current State Analysis

- `.github/workflows/ci.yml`: two jobs, `test` (line 23) and `commits` (line 36), neither with `timeout-minutes`. A normal run takes about 3.5 minutes (`duration_ms 205939`, per `change.md`), so 15 minutes leaves four times the headroom.
- `skills/10x-pipeline/test/helpers.mjs`:
  - `run` (line 98) calls `spawnSync(process.execPath, [ROUTE, ...args], { cwd, encoding, env })` and returns `{ status, json, stdout, stderr }`. A spawn that fails or times out gives `status: null` and an empty `stdout`, so the caller sees a JSON parse failure or a null `json`, not the cause.
  - `git` (line 200) calls `spawnSync("git", ...)` and throws only when `res.status !== 0`; for a timed-out spawn `res.stderr` is empty, so the message is `git ... failed: `.
  - `gitAvailable` (line 177) runs `git --version`; it stays as it is (it cannot block on input or a lock).
- Callers: 45 test files import from `helpers.mjs`; none passes a `timeout` option to `run` or `git`. Tests that need a smaller git timeout pass it through policy (`archive.test.mjs:751`, `:810`), which does not touch the helpers.
- `tools/test/ci-runner.test.mjs` already slices `ci.yml` by job with `testJob()` (from `\n  test:` to `\n  commits:`) and counts jobs with `/^ {2}[\w-]+:\s*$/` after `\njobs:`.
- `skills/10x-pipeline/test/README.md` indexes every test file (a new test gets its row there, not in `AGENTS.md`), and its `ci-runner.test.mjs` row (line 102) lists what that file checks.
- No router script handles `SIGTERM`, so the default kill signal ends a router process (`grep SIGTERM skills/10x-pipeline/scripts/*.mjs` finds nothing).

## Desired End State

- Both jobs of `ci.yml` carry `timeout-minutes: 15`; `ci-runner.test.mjs` fails if a job lacks it or has another value.
- `run` and `git` pass `timeout: 120000` by default. A caller can pass `{ timeout }` to override. When a spawn times out or cannot start, the helper throws an `Error` that names the command and the cause (for a timeout: `timed out after <n> ms`), so the test fails at that line within two minutes instead of on a later parse.
- A new test file proves the throw with a script that sleeps past a short timeout.
- The full suite passes locally.

### Key Discoveries:

- `spawnSync` sets `res.error` (with `code: "ETIMEDOUT"`) when `timeout` expires, and `res.status` is `null`; with the default `killSignal` of `SIGTERM` the router, which has no signal handler, dies at once.
- The `run` helper hard-codes `ROUTE`. To test it with a script that sleeps, without a new helper, `run` takes an optional `script` option (default `ROUTE`). It is the smallest hook; the alternative of a second exported function would duplicate the spawn code.
- A timeout error cannot be returned as a result without changing what 45 files expect; a throw is the one behaviour that fails the calling test with the cause in the message.

## What We're NOT Doing

- No `timeout-minutes` on `pr-title.yml` or `release.yml`; `change.md` scopes the change to the two jobs of `ci.yml`. (Follow-up candidate: `pr-title.yml`'s one job.)
- No `--test-timeout` flag on `node --test` and no per-test timeouts; the spawn timeout and the job timeout are the two bounds asked for.
- No change to router code, `policy.json`, the git timeouts that tests pass through policy, `gitAvailable`, or the `spawnSync` calls in other test files (`openspec-contract.test.mjs` already sets its own).
- No change to `AGENTS.md` or `docs/REFERENCE.md`; nothing there describes the helpers or the CI limits.
- No environment variable to change the timeout (YAGNI; the `timeout` option covers one-off needs).

## Implementation Approach

Two small phases, each leaving the suite green. Phase 1 is the workflow plus its pin. Phase 2 is the helpers plus their test and the index rows. Phase 2 ends with the full suite, which is also the check that no existing test needs more than 120 seconds for one router call.

## Phase 1: Job timeouts in ci.yml

### Overview

Add the job limit and pin it in the existing CI test file.

### Changes Required:

#### 1. Workflow

**File**: `.github/workflows/ci.yml`

**Intent**: Bound each job at 15 minutes.

**Contract**: `timeout-minutes: 15` directly under each job's `runs-on:` line, in `test` and in `commits`, at the same 4-space indent as `runs-on`. Extend the header comment by one line stating that each job stops after 15 minutes (a normal suite run takes about 3.5). No other change; the actions stay pinned to the same SHAs.

#### 2. CI test

**File**: `tools/test/ci-runner.test.mjs`

**Intent**: A job added or edited later cannot lose the limit.

**Contract**: One new test, "every job of ci.yml stops after 15 minutes", placed after the first test. For each job block of `ci.yml` (the text from a 2-space-indented job key to the next one, reusing the job-key regexp of the first test) assert the block has exactly one line matching `/^ {4}timeout-minutes: 15$/m`, and assert the number of blocks is 2 so a new job without the key is noticed. Use `read("ci.yml")`; no new import.

### Success Criteria:

#### Automated Verification:

- `ci.yml` has both limits: `grep -c "^    timeout-minutes: 15$" .github/workflows/ci.yml` prints 2
- The CI test passes: `node --test tools/test/ci-runner.test.mjs`
- The new test fails without the key (deliberate-break check): remove one `timeout-minutes` line, run `node --test tools/test/ci-runner.test.mjs` and see the new test fail, restore the line
- The action pin guard still passes: `node --test tools/test/workflow-pins.test.mjs`

#### Manual Verification:

(none for this phase)

**Implementation Note**: Phase 1 touches no code path the suite drives; continue to Phase 2 once 1.1 to 1.4 pass.

---

## Phase 2: Spawn timeout in the test helpers

### Overview

Give `run` and `git` a default timeout and a clear failure, test it, and index the new test.

### Changes Required:

#### 1. Helpers

**File**: `skills/10x-pipeline/test/helpers.mjs`

**Intent**: A router or git process that never returns fails its test within two minutes, with the command and the cause in the message.

**Contract**:
- `export const SPAWN_TIMEOUT_MS = 120000;` next to `ROUTE`.
- One internal function that throws when `res.error` is set, used by both helpers so the message form is the same: for `res.error.code === "ETIMEDOUT"` the message is `<label> timed out after <timeout> ms`, otherwise `<label> could not run: <res.error.message>`. `<label>` is `route.mjs <args joined by space>` for `run` and `git <args joined by space>` for `git`. It runs before any `JSON.parse` or `status` check.
- `run(project, args, { env = {}, timeout = SPAWN_TIMEOUT_MS, script = ROUTE } = {})`: `spawnSync(process.execPath, [script, ...args], { cwd, encoding, env, timeout })`. Existing callers pass neither new option, so their behaviour is unchanged; the return shape is unchanged.
- `git(project, args, { date = null, timeout = SPAWN_TIMEOUT_MS } = {})`: add `timeout` to the `spawnSync` options, throw through the same function, keep the `res.status !== 0` check and its message after it.
- Update the header comment by one line: spawns time out after `SPAWN_TIMEOUT_MS`.

#### 2. Helper test

**File**: `skills/10x-pipeline/test/helpers-timeout.test.mjs` (new)

**Intent**: Prove the throw for both helpers, in well under the 120 s default.

**Contract**: Import `makeProject`, `cleanupAll`, `run`, `git`, `gitAvailable` from `./helpers.mjs`; `afterEach(cleanupAll)` as the sibling tests do. Tests:
- "run throws a clear error when the script outlives the timeout": write a script in the scratch project (`setTimeout(() => {}, 60000)` held open, for example `await new Promise((r) => setTimeout(r, 60000))`), call `run(project, ["status", "x"], { script, timeout: 300 })`, assert it throws with a message matching `/route\.mjs status x timed out after 300 ms/`, and assert the call took under 10 seconds.
- "run still returns the result of a fast script": a script that prints `{"ok":true}`, `run(..., { script, timeout: 5000 })` gives `status 0` and `json.ok === true` (guards the unchanged return shape).
- "git throws a timeout error": `{ skip: !gitAvailable() }`, `git(project, ["--version"], { timeout: 1 })` throws a message matching `/git --version timed out after 1 ms/`. A 1 ms limit expires before any process can start and exit; if the spawn instead fails to start the test would show `could not run`, which is a failure too.

#### 3. Test index

**File**: `skills/10x-pipeline/test/README.md`

**Intent**: Index rule: a new test file gets its row in the README of its folder.

**Contract**: One row for `helpers-timeout.test.mjs` in the core router group (what it checks: the `run` and `git` helpers time out and throw a clear error). Add one clause to the `helpers.mjs` bullet in `## Helpers`: `run` and `git` time out after `SPAWN_TIMEOUT_MS` (120000 ms) and throw when the spawn fails. In the `tools/test` table, extend the `ci-runner.test.mjs` row with "and that each job of `ci.yml` has `timeout-minutes: 15`".

### Success Criteria:

#### Automated Verification:

- The new test passes: `node --test skills/10x-pipeline/test/helpers-timeout.test.mjs`
- The new test names the file in the index: `grep -c "helpers-timeout.test.mjs" skills/10x-pipeline/test/README.md` prints at least 1
- Deliberate-break check: temporarily drop `timeout` from the `run` spawn options and see "run throws a clear error" fail within the 60 s sleep bound, then restore it
- The full suite passes locally, so no existing call needs more than 120 s: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- The version guard passes: `node tools/version-check.mjs`
- Commit subjects pass: `node tools/commit-lint.mjs main..HEAD`

#### Manual Verification:

- CI is green on the pull request and the `test` and `commits` jobs show the 15-minute limit in the run (self-hosted runner, ADR-020; cannot be confirmed from the repository)

**Implementation Note**: Commit types: `ci:` for phase 1 and `test:` for phase 2. The run branch then holds only patch-level types, so no release PR opens (see the run-branch release type rule); that is intended for this change.

---

## Testing Strategy

### Unit Tests:

- `helpers-timeout.test.mjs`: timeout error text, fast path unchanged, git timeout.
- `ci-runner.test.mjs`: both jobs have `timeout-minutes: 15`.

### Integration Tests:

- The whole existing suite is the regression check: 45 files drive `run` and `git` through the new default.

### Manual Testing Steps:

1. Open the pull request; confirm CI shows both jobs and finishes in about 4 minutes.

## Risks and Notes

- A grandchild that inherits the stdout pipe (git started by the router) can keep `spawnSync` waiting after the router dies; the new test uses a plain Node script, so it does not exercise that. The 120 s bound is therefore best effort for a router that hangs inside git; the 15-minute job limit is the hard backstop.
- A loaded runner could make one legitimate router call exceed 120 s. The suite's slowest single call is far below that (the whole suite runs in about 3.5 minutes across parallel files); 2.4 is the local check, and a caller can pass `{ timeout }` if one ever needs more.

## References

- Change: `context/changes/ci-job-and-spawn-timeouts/change.md`
- `.github/workflows/ci.yml`, `skills/10x-pipeline/test/helpers.mjs:98-107` (`run`), `:200` (`git`), `tools/test/ci-runner.test.mjs`

## Progress

### Phase 1: Job timeouts in ci.yml

#### Automated

- [ ] 1.1 `ci.yml` has both limits: `grep -c "^    timeout-minutes: 15$" .github/workflows/ci.yml` prints 2
- [ ] 1.2 The CI test passes: `node --test tools/test/ci-runner.test.mjs`
- [ ] 1.3 The new test fails without the key (deliberate-break check): remove one `timeout-minutes` line, run `node --test tools/test/ci-runner.test.mjs`, see the new test fail, restore the line
- [ ] 1.4 The action pin guard still passes: `node --test tools/test/workflow-pins.test.mjs`

### Phase 2: Spawn timeout in the test helpers

#### Automated

- [ ] 2.1 The new test passes: `node --test skills/10x-pipeline/test/helpers-timeout.test.mjs`
- [ ] 2.2 The test index names the new file: `grep -c "helpers-timeout.test.mjs" skills/10x-pipeline/test/README.md` prints at least 1
- [ ] 2.3 Deliberate-break check: drop `timeout` from the `run` spawn options, see "run throws a clear error" fail, restore it
- [ ] 2.4 The full suite passes locally: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- [ ] 2.5 The version guard passes: `node tools/version-check.mjs`
- [ ] 2.6 Commit subjects pass: `node tools/commit-lint.mjs main..HEAD`

#### Manual

- [ ] 2.7 CI is green on the pull request and both jobs carry the 15-minute limit (self-hosted runner, ADR-020; cannot be confirmed from the repository)
