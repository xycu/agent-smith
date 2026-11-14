# Router coverage and failed rollback undo implementation plan

## Overview

Enable Node's built-in coverage in CI and protect the recovery text emitted when an isolated failed-step rollback cannot be undone. Exercise both halt callers through the real router CLI, prove the snapshot still contains the partial work, and record the coverage evidence before choosing a future coverage floor.

## Current State Analysis

The CI test step runs all three test globs on Node 24. Its environment supplies `TMPDIR` from `runner.temp`, and the job has a 15-minute timeout. `tools/test/ci-runner.test.mjs` already guards the runner, temporary-directory environment, tool installation and job limits. Wave 6 assigns this change the CI test command and `rollback.test.mjs`. [CI workflow](../../../.github/workflows/ci.yml) [Wave ownership](../WAVES.md)

`next` attaches the step result, snapshots an eligible failure under `refs/agent-smith/<id>/<run token>/failed-<n>`, and resets the worktree to `startSha`. A later ordinary halt calls `undoRollback` through `end`. A thrown router error calls it through the outer catch. Undo first hard-resets to the snapshot, then mixed-resets to its parent. Only successful completion sets `kept` and restores router state and file times. [Rollback implementation](../../../skills/10x-pipeline/scripts/isolation.mjs#L561) [Undo and ordinary halt](../../../skills/10x-pipeline/scripts/route.mjs#L51) [Router-error halt](../../../skills/10x-pipeline/scripts/route.mjs#L1056)

Existing rollback tests cover successful undo for an attempt-cap halt and a router exception. The exception fixture sets `complexity.appliesTo` to `null`, causing `tierFor` to throw after rollback. `stepcommit.test.mjs` supplies an established pattern for forwarding real Git commands through a fixture-local executable on `PATH`. [Attempt-cap fixture](../../../skills/10x-pipeline/test/rollback.test.mjs#L296) [Exception fixture](../../../skills/10x-pipeline/test/rollback.test.mjs#L339) [Git failure injection](../../../skills/10x-pipeline/test/stepcommit.test.mjs#L416)

### Planning coverage evidence

Measured on 2026-11-14 at source revision `80fe12aec1e05795204ba410e98d7c1d1b02b4c2`, using Node `v24.19.0` on macOS. The command below passed 19 tests with zero skips in 24,677 ms. Scratch projects lived inside this worktree under an isolated temporary-directory boundary. A separate baseline suite was running concurrently, so this duration supplies execution evidence only.

```sh
node --test --test-concurrency=2 --experimental-test-coverage skills/10x-pipeline/test/rollback.test.mjs skills/10x-pipeline/test/override-json.test.mjs
```

| Module | Lines | Branches | Functions |
| --- | --- | --- | --- |
| `route.mjs` | 45.37% | 16.13% | 36.36% |
| `flow.mjs` | 68.13% | 32.09% | 56.70% |
| `steps.mjs` | 61.32% | 44.90% | 64.47% |
| `isolation.mjs` | 67.82% | 44.30% | 74.24% |
| `state.mjs` | 81.51% | 62.24% | 78.99% |
| `preplan.mjs` | 34.94% | 47.92% | 35.56% |
| `openspec.mjs` | 35.41% | 100.00% | 0.00% |

The ordinary full repository suite also completed during planning with 1,479 tests, 1,476 passes, zero failures and three skips in 669,537 ms at concurrency 2. The skips were the two `GH_LIVE` comment tests and the absent `CLAUDE.md` import check. The local OpenSpec CLI was `2.0.0`, while CI selects `1.16.1`. This run overlapped the focused probe and the scratch Git-discovery boundary was added while it ran. Use it as suite-success evidence. Phase 1 supplies controlled overhead measurements with the CI-selected CLI.

The module percentages in the table describe the two-file probe. Phase 1 establishes the full-suite coverage baseline. The spawned router modules appear in Node's table through the current `run` helper and inherited environment. [CLI helper](../../../skills/10x-pipeline/test/helpers.mjs#L134)

The focused table yielded the following recovery-related ranges for inspection. Full-suite evidence must replace this preliminary inventory with exact uncovered intersections, since the broader suite exercises many of these paths already.

| Module | Focused uncovered ranges inspected | Recovery significance |
| --- | --- | --- |
| `route.mjs` | `56-58`, `125-131`, `174-181` | Mixed-reset failure guidance, needs-human halt and budget halt. The hard-reset failure at line 53 and failure alternatives on lines 109 and 1066 also need explicit assertions because a single executed line can contain an unexecuted branch. |
| `flow.mjs` | `320-322`, `361-368`, `372-379`, `606-617`, `708-709`, `750-753` | Failed report write, missing neutral-retry prompt, retry cap, open-findings recovery guidance, failed re-plan and open implementation-review halt. |
| `steps.mjs` | `40-65`, `313-323`, `372-395`, `417-470` | Unavailable commit evidence and validation of manual evidence, reasons and browser proof. These feed fallback and recovery decisions through callers. |
| `isolation.mjs` | `235-237`, `242-243`, `318-319`, `347-352`, `376-380`, `398-400`, `630-752` | Ignored router files, Git operation in progress, unreadable worktree identity, commit failure recovery, post-commit diagnostics and archive recovery. |

### Ownership and state contracts

| Boundary | Current writers and readers | Contract to verify |
| --- | --- | --- |
| CI coverage output | Node test runner writes the table, CI logs and maintainers read it | Per-module line, branch and function percentages plus uncovered ranges accompany the suite result. |
| Snapshot ref | `isolation.mjs` creates it, `route.mjs` undo and Git inspection read it | The ref resolves to a real commit containing the failed step's tracked edits and untracked additions. |
| Run state | Router modules own `run.jsonl` and `meta.json`, status and report readers consume them | `rolledBack` and `kept` describe the existing recovery lifecycle. Fixtures use the existing helper API in scratch repositories. |
| Halt JSON | Ordinary `end` or the outer catch emits it, the orchestrator reads it | Original halt context, undo-failure diagnostic and the exact recovery ref remain observable. |

## Desired End State

CI emits the native coverage table for the full suite. A recorded full-suite table identifies coverage of the shared router modules and the OpenSpec module, and the recovery inventory explains every remaining uncovered halt/recovery intersection in `route.mjs`, `flow.mjs`, `steps.mjs` and `isolation.mjs`.

Four deterministic regression cases cover two callers multiplied by the two undo reset failures. Every case parses the router's JSON, checks the failure text and complete ref, and reads the preserved partial work from that ref. The mixed-reset cases also verify the recovery command and snapshot HEAD. A live CI log link completes acceptance.

## Scope

- `.github/workflows/ci.yml`, limited to the test command region owned by this change.
- `skills/10x-pipeline/test/rollback.test.mjs`, extending the existing fixture and assertion patterns.
- This change folder, including `coverage-evidence.md` for measured tables, recovery-range triage, commands, durations and the eventual CI run link.

Wave 6 ownership governs any further work revealed by the inventory. Record additional gaps with their owning module and follow-up rationale in the evidence document. The existing test-index row already covers rollback and undo tests. [Test index](../../../skills/10x-pipeline/test/README.md#L58)

## Implementation Approach

Use the native coverage flag in the existing blocking suite step. Measure the first full table before adding the regression cases, then measure again after they pass. Keep the reported percentages observational during this change, as directed by `change.md`.

Reuse `freshRun`, `toImplement`, `REF`, `head`, `refExists`, `showFile`, `run` and `gitEnv`. Keep the failure-injection helper local to `rollback.test.mjs`. A fixture-local Git wrapper forwards real commands and fails exactly the selected undo reset for the expected ref, producing a recognizable stderr diagnostic. Its executable and invocation marker belong outside the fixture's linked worktree so rollback cannot capture or remove the injector.

### Assumptions and decisions

- Treat this as medium-complexity, standard-rigor work in two phases. The ticket fixes the two-file implementation scope and acceptance, while real Git failure sequencing and full-suite evidence require additional verification. The unattended instruction supplies decision authority for the skill's interview and phase-confirmation points. [Change description](change.md) [Wave ownership](../WAVES.md)
- Test both reset operations at both halt callers. The shared undo function has two distinct failure exits, and the second provides a specific recovery command and a different branch position. [Undo contract](../../../skills/10x-pipeline/scripts/route.mjs#L51)
- Begin with coverage in the existing blocking test step. This follows the ticket's primary direction and uses the mechanism proven by the focused probe. Capture comparable full-suite timings before judging coverage overhead. [Change description](change.md)
- Use the existing POSIX wrapper convention, including the established Windows skip condition for shell-based injection. The Linux CI runner must execute all four cases. [Git wrapper convention](../../../skills/10x-pipeline/test/stepcommit.test.mjs#L433)
- Place durable coverage evidence in this change's `coverage-evidence.md`. This confines measurement and follow-up decisions to the change artifacts allowed alongside Wave 6's implementation files. [Wave rules](../WAVES.md)

## Critical Implementation Details

The initial rollback reset targets `startSha`. It must succeed before the wrapper fails the undo reset targeting the side ref or its parent. Confirm the injected failure was reached exactly once, and preserve the side ref throughout the test.

The ordinary halt currently appends `The partial edits are kept under <ref>.` The outer catch exposes the ref through the failed reset diagnostic, and a mixed-reset failure also names the snapshot branch position and recovery command. Assertions should follow each caller's current text contract. Engine-specific TypeError wording can vary across Node 24 releases.

If the hard reset fails, HEAD stays at the step start and partial edits remain recoverable from the ref. If the mixed reset fails, HEAD points to the snapshot commit. The outer catch prints a halt directly, while ordinary `end` persists an outcome through `endRun`. Snapshot restoration can replace the on-disk router files before the catch prints. Judge each state according to that ordering. [Outer catch](../../../skills/10x-pipeline/scripts/route.mjs#L1056) [End-run persistence](../../../skills/10x-pipeline/scripts/flow.mjs#L316)

## Phase 1: Enable native CI coverage and establish the baseline

### Overview

Expose router-module coverage through the existing CI suite and record the initial full-suite recovery inventory.

### Changes Required

#### CI test command

**File**: `.github/workflows/ci.yml`

**Intent**

Add `--experimental-test-coverage` to the current test invocation so each run exposes which router paths the CLI-driven suite reaches.

**Contract**

The suite continues to run the existing three test globs and propagate test failures. Its native coverage report includes router-module rows and uncovered line ranges. Percentage thresholds are a later calibration decision.

Progress row 1.1 initially verifies inline coverage. If the measured-overhead fallback below is used, that row verifies the combined CI configuration instead. The required ordinary suite keeps the three test globs and failure propagation, and a second step runs those same globs with `--experimental-test-coverage` and step-level `continue-on-error: true`. Record the selected configuration and its coverage table in the evidence document.

#### Baseline evidence

**File**: `context/changes/coverage-and-failed-undo-test/coverage-evidence.md`

**Intent**

Record the full-suite table, exact source revision, Node and contract-CLI versions, platform, command, test totals, skips and duration. Inspect every uncovered range in the four requested modules for halt or recovery behavior and record its source anchor, behavior and disposition.

**Contract**

Retain the raw module rows and distinguish uncovered source ranges from untested alternatives on covered lines. Assign the failed-undo branches to Phase 2. Give each other recovery gap an evidence-backed follow-up disposition within Wave ownership. Record comparable covered and ordinary suite timings with identical concurrency and tool versions.

### Success Criteria

#### Automated Verification

- The existing CI suite command enables native coverage and supplies the three test globs with observational coverage settings.
- A full coverage run passes and records line, branch, function and uncovered-range columns for the shared router modules and `openspec.mjs`.
- Coverage evidence identifies every uncovered halt/recovery intersection in the four requested modules and records comparable suite timings and skip identities.
- Existing CI workflow guards pass with `node --test tools/test/ci-runner.test.mjs tools/test/workflow-pins.test.mjs`.

## Phase 2: Cover failed undo recovery and collect final evidence

### Overview

Exercise the two halt callers through the real CLI with each undo reset failing, then collect the post-change full-suite table and live CI evidence.

### Changes Required

#### Failed undo regression cases

**File**: `skills/10x-pipeline/test/rollback.test.mjs`

**Intent**

Extend the existing isolated-worktree tests with a local, narrowly targeted Git failure injector and four cases derived from the successful-undo fixtures. Protect the user's recovery text and the actual snapshot contents together.

**Contract**

| Caller | Injected failure | Required observations |
| --- | --- | --- |
| Attempt-cap halt through `end` | `reset -q --hard <ref>` | Exit 0, `action` is `halt`, attempt-cap reason retained, `The rollback was not undone`, injected diagnostic, full ref and kept-under sentence, HEAD at the failed step's `startSha`. |
| Attempt-cap halt through `end` | `reset -q <ref>^` | Same halt/context/ref assertions, plus snapshot-commit branch guidance and `git reset -q <ref>^` recovery instruction, HEAD at the snapshot commit. |
| Router exception through the outer catch | `reset -q --hard <ref>` | Exit 1, parseable halt JSON, `Router error` context retained, `The rollback was not undone`, injected diagnostic and full ref, HEAD at the failed step's `startSha`. |
| Router exception through the outer catch | `reset -q <ref>^` | Same exception/ref assertions, plus snapshot-commit branch guidance and `git reset -q <ref>^` recovery instruction, HEAD at the snapshot commit. |

For each case, create both a tracked partial edit and an untracked file. Compute the expected ref with the existing `REF` helper, assert it resolves, read both file contents with `showFile`, and verify its parent is the head the failed step left. Verify the injector fired once after snapshot creation and initial rollback. The retained ref is the recovery proof even when the worktree is at `startSha`.

Use the established attempt-cap sequence for `end` and the existing malformed complexity override after `toImplement` for the catch. Retain the successful-undo tests as complementary recovery coverage. Let `cleanupAll` own scratch repositories, and use the repository's `removeTree` helper for any separately owned injector directory.

#### Final coverage and CI evidence

**File**: `context/changes/coverage-and-failed-undo-test/coverage-evidence.md`

**Intent**

Append the post-test full-suite table, the four case outcomes and the updated recovery-range inventory. Add the live CI run URL and actual runner duration when the change's CI run completes.

**Contract**

Evidence ties each caller and reset failure to its assertion and source location. Compare the baseline and final tables at their recorded revisions, and preserve test-failure visibility. The final record includes the CI coverage table and the same-runner performance comparison supporting the selected configuration. Start with inline coverage. If coverage slows the run noticeably, document the measured increase and use the ticket's separate non-blocking coverage step when the combined setup, required ordinary suite and coverage run fit the existing 15-minute job limit. Both suite steps use the existing temporary-directory environment and three test globs. The ordinary suite propagates test failures, and the coverage step uses step-level `continue-on-error: true`. A completed passing coverage run and its table satisfy coverage acceptance in either configuration. An incomplete coverage run leaves the coverage acceptance rows pending. Record a job-budget conflict for the owner if neither configuration completes within the existing limit.

### Success Criteria

#### Automated Verification

- All four failed-undo cases pass through the real CLI and assert their caller-specific exit status, original halt context, undo diagnostic and full recovery ref.
- All four cases prove that the snapshot holds tracked and untracked partial work and that HEAD matches the hard-reset or mixed-reset failure state.
- The focused coverage run passes and its source-backed evidence demonstrates both callers and both undo failure exits are exercised.
- The full repository suite passes with coverage enabled, and the final module table and recovery-range disposition are recorded alongside the baseline.
- The final diff respects Wave 6 ownership and contains the planned implementation files and change-local artifacts.

#### Manual Verification

- A green CI run for this change shows the native router-module coverage table, execution of the four Linux regression cases, expected skip identities and recorded runner timing, with its run URL in the coverage evidence.

## Testing Strategy

Run the focused pair used during planning after the new cases land. Read the native report and inspect the relevant branch assertions together. Run the existing CI workflow guards after the command edit.

Run the repository-required full suite and its covered counterpart with the same local concurrency when comparing durations.

```sh
node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs
node --test --test-concurrency=2 --experimental-test-coverage skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs
```

The CI command keeps its existing concurrency behavior. Compare CI timing against equivalent same-runner evidence. Use the pinned OpenSpec CLI selected by CI for acceptance. A local executable with another version must be identified in the evidence.

When running this plan under the supplied working-directory rules, start each shell command with the absolute worktree `cd` and keep temporary files inside the worktree. Provide a scratch Git-discovery boundary for temporary non-repository fixtures so they cannot discover the surrounding checkout. The planning probe used an invalid `.git` pointer at the temporary-directory parent for that boundary. Ordinary CI scratch lives under the runner temporary directory.

For final acceptance, inspect the actual CI log, capture the module rows and check the four test names. Preserve the distinction between a local measurement and a live CI run when completing Progress.

## Performance Considerations

Coverage instruments the child router processes that dominate this suite. Record full-suite covered and ordinary timings with matching revision, concurrency, tools and platform, then record the TrueNAS CI duration. The concurrent focused planning measurement establishes coverage propagation. It cannot estimate instrumentation overhead. The current job limit and the ticket's measured-overhead fallback govern CI acceptance.

## Migration and Rollback

Introduce measurement first, verify the existing suite and inventory, then add and verify the regression cases. The rollout is an additive CI/test change with the existing router CLI, snapshot namespace and run-state schema as its compatibility boundary. Existing and newly created run data use the same readers and writers.

Recovery test retries create fresh scratch runs, making injected failures independent. A regression in coverage instrumentation can be rolled back by reverting the CI-command edit while retaining the recovery assertions and recorded evidence. The failure injector's scope is one router child environment, and normal fixture inspection uses real Git.

## References

- Task and acceptance in `context/changes/coverage-and-failed-undo-test/change.md`.
- Wave 6 ownership in `context/changes/WAVES.md`.
- `route.mjs:51-65`, `route.mjs:101-112` and `route.mjs:1056-1068` define undo and its halt callers.
- `isolation.mjs:554-606` defines snapshot-before-reset rollback.
- `rollback.test.mjs:296` and `rollback.test.mjs:339` provide successful-undo fixtures.
- `stepcommit.test.mjs:416` provides fixture-local Git failure injection.
- `helpers.mjs:134` and `helpers.mjs:226` provide child invocation and hermetic Git environment.
- `flow.mjs:196`, `flow.mjs:316` and `steps.mjs:548` define report, outcome and exception sequencing.
- `context/foundation/lessons.md` supplies the single-level subagent rule and source-backed recovery conventions.
- Node 24 local `node --help` documents `--experimental-test-coverage`, include/exclude patterns and separate percentage-threshold flags.

## Progress

### Phase 1: Enable native CI coverage and establish the baseline

#### Automated

- [x] 1.1 The existing CI suite command enables native coverage and supplies the three test globs with observational coverage settings. — c24a166
- [x] 1.2 A full coverage run passes and records line, branch, function and uncovered-range columns for the shared router modules and `openspec.mjs`. — c24a166
- [x] 1.3 Coverage evidence identifies every uncovered halt/recovery intersection in the four requested modules and records comparable suite timings and skip identities. — c24a166
- [x] 1.4 Existing CI workflow guards pass with `node --test tools/test/ci-runner.test.mjs tools/test/workflow-pins.test.mjs`. — c24a166

### Phase 2: Cover failed undo recovery and collect final evidence

#### Automated

- [x] 2.1 All four failed-undo cases pass through the real CLI and assert their caller-specific exit status, original halt context, undo diagnostic and full recovery ref. — d1b8426
- [x] 2.2 All four cases prove that the snapshot holds tracked and untracked partial work and that HEAD matches the hard-reset or mixed-reset failure state. — d1b8426
- [x] 2.3 The focused coverage run passes and its source-backed evidence demonstrates both callers and both undo failure exits are exercised. — d1b8426
- [x] 2.4 The full repository suite passes with coverage enabled, and the final module table and recovery-range disposition are recorded alongside the baseline. — d1b8426
- [x] 2.5 The final diff respects Wave 6 ownership and contains the planned implementation files and change-local artifacts. — d1b8426

#### Manual

- [ ] 2.6 A green CI run for this change shows the native router-module coverage table, execution of the four Linux regression cases, expected skip identities and recorded runner timing, with its run URL in the coverage evidence.
