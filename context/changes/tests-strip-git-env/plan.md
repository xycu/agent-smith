# Strip inherited Git variables from test environments

## Overview

Make test-owned Git commands and subprocesses inherit a fresh environment with every `GIT_` key removed, then apply their explicit fixture overrides. This prevents a passing scratch test from writing fixture commits or index entries into a repository selected by its parent's environment.

## Current State Analysis

The planning baseline is commit `30966b26bf4a25ae0140f18139078f2250603849`. The shared `run` helper merges the complete parent environment with explicit overrides. `gitEnv` adds identity, config isolation and discovery limits to the complete parent environment. Their consumers include both chains and the fake Codex process fixtures. Existing spawn timeout, error and result contracts already have coverage. See `skills/10x-pipeline/test/helpers.mjs:129`, `skills/10x-pipeline/test/helpers.mjs:217`, `skills/10x-pipeline/test/helpers-timeout.test.mjs` and `skills/10x-pipeline/test/codex-helpers.mjs:79`.

Standalone environment builders reproduce this inheritance in `open-pr`, `pr-comment`, commit-lint and the OpenSpec CLI contract test. The historical OpenSpec path in the change description resolves to `skills/openspec-pipeline/test/openspec-contract.test.mjs`. Three newer copied-router/provenance wrappers also pass `process.env` directly. See the inventory below.

### Observed reproduction

On 2026-11-14, a controlled probe created a victim repository with one tracked sentinel and one commit, then ran `node --test --test-name-pattern="^the CLI exits 0 for good commits$" tools/test/commit-lint.test.mjs` in a child. The child's `GIT_DIR`, `GIT_WORK_TREE` and `GIT_INDEX_FILE` all selected that victim. The child exited 0 with one passing test, while the victim grew from one commit to four and its HEAD and refs changed. Node was `v26.13.1` and Git was `2.54.0`. All probe files and child temporary directories were inside this change folder. The probe inventory was inspected and removed using `removeTree`.

This establishes the pre-fix failure. Post-fix acceptance remains implementation work.

## Desired End State

- Every inherited environment key whose name starts with `GIT_` is absent from a newly constructed test environment before fixture values are added.
- Non-Git inherited values retain their values, including executable search paths, temporary-directory settings and CLI discovery settings.
- Fixture-owned values take precedence, including intentional `GIT_CONFIG_*`, identity, dates, `GIT_CEILING_DIRECTORIES` and the `GIT_LOG` shim variable.
- Environment construction leaves the parent environment intact and evaluates it at call time.
- A real child test process passes under each hostile repository-selection variable and their combination, while an independently observed victim repository remains byte-identical.
- The ordinary suite and a complete suite run under the combined hostile environment pass. Availability-based skips are reported with their reasons, and the required Git regressions execute.

## Scope and ownership

The explicit task assigns test environment helpers and environment spread sites to this run. The Wave 4 row is resolved against the current layout and the sibling change descriptions. Edits are limited to the environment regions below, the new regression file, its test-index entry and this change's planning artifacts.

| File | Owned region and reason |
| --- | --- |
| `skills/10x-pipeline/test/helpers.mjs` | New environment sanitizer and the environment construction of `run` and `gitEnv` |
| `skills/10x-pipeline/test/open-pr.test.mjs` | `envFor` base environment and its helper import, around line 69 |
| `skills/10x-pipeline/test/pr-comment.test.mjs` | `runScript`, both inline Git environments and the opt-in live script environment, around lines 104, 682, 826 and 832 |
| `tools/test/commit-lint.test.mjs` | The inherited base of `GIT_ENV`, around line 16 |
| `skills/openspec-pipeline/test/openspec-contract.test.mjs` | The inherited base in `cliApply` and its helper import, around line 26 |
| `skills/10x-pipeline/test/provenance.test.mjs` | `runCopy` environment and its helper import, around line 75 |
| `skills/10x-pipeline/test/rule-levels.test.mjs` | `runCopy` environment and its helper import, around line 86 |
| `skills/10x-pipeline/test/agents.test.mjs` | The two environment arguments in `record` and its helper import, around lines 320–325 |
| `skills/10x-pipeline/test/helpers-env.test.mjs` | New sanitizer, precedence and victim-repository regressions |
| `skills/10x-pipeline/test/README.md` | Index the new test and describe the sanitizer's test-only contract |

Sibling-owned regions include CI configuration and its assertions, run preparation and its guard assertions, dispatch-content assertions in `agents.test.mjs`, both skill bodies, router persistence, and comparison behavior. Those ownership boundaries constrain the patch to the environment lines and imports even where a test file also contains sibling-owned assertions. `WAVES.md` belongs to post-wave maintenance. Router scripts, policies and actual run-state files remain under their existing owners. Source ownership comes from the task, `context/changes/WAVES.md` and the five sibling `change.md` files.

## Implementation Approach

Add one zero-argument `cleanEnv()` export to the existing shared test helper. It returns a fresh copy of the current `process.env` with every uppercase `GIT_` prefix removed. Both shared builders and skill test wrappers consume this base, then apply their existing explicit values in their existing order. The tools test keeps a small local filtered copy in its existing constant, following the change description's tools-test convention. This keeps test support within the existing test layers.

Version probes, shell executable discovery, price-loading subprocesses and the phase-gate probe perform no repository operation. The Codex fixture's Git commands already receive the environment built from `gitEnv`. Existing downstream callers benefit through the shared helper. The current search found eight inherited spreads and five direct `env: process.env` arguments in the owned Git-capable builders and wrappers. The regression harness intentionally supplies hostile variables to its child entrypoint.

### Assumptions resolved for unattended planning

- **Complexity and interview**. Treat this as medium complexity with zero unresolved substantive questions. The task fixes prefix stripping, override order, victim safety and ownership. The local complexity assessment records high confidence with no unknowns. The task's unattended rule supplies the decision process for the skill's interview gates. See `context/changes/tests-strip-git-env/change.md`, `complexity.json` and the invocation instructions.
- **Scope expansion within ownership**. Include direct pass-through environments in copied-router/provenance wrappers because they launch Git-capable router code, and the task explicitly assigns environment spread sites. Limit `agents.test.mjs` to its environment region so dispatch-content expectations remain owned by `agent-call-parameters`. See `skills/10x-pipeline/test/agents.test.mjs:320`, `skills/10x-pipeline/test/provenance.test.mjs:75`, `skills/10x-pipeline/test/rule-levels.test.mjs:86` and `context/changes/agent-call-parameters/change.md`.
- **Regression structure**. Use two phases, covering environment construction first and the safety proof second. Use the existing `node:test`, subprocess and scratch-project patterns. All acceptance criteria are automatable. See `skills/10x-pipeline/test/helpers-timeout.test.mjs`, `tools/test/commit-lint.test.mjs` and `skills/openspec-pipeline/test/openspec-isolation.test.mjs`.
- **Tool availability**. Require Git for the victim proof and preserve the current opt-in live GitHub tests and optional OpenSpec CLI contract behavior. Record unavailable tools and skips separately from passing checks. This follows the existing tests and the later-wave ownership of unexpected-skip policy. See `skills/10x-pipeline/test/pr-comment.test.mjs:809`, `skills/openspec-pipeline/test/openspec-contract.test.mjs:16` and `context/changes/WAVES.md`.

## Critical Implementation Details

### Override order

Sanitize only the inherited base. Filtering a merged environment would erase fixture configuration and `open-pr`'s intentional `GIT_LOG`, disabling its command audit. `run` must also preserve explicit overrides supplied by callers after sanitization. The source of a value determines whether it is stripped.

### Victim observation and process isolation

Initialize and inspect the victim with an independently constructed clean observer environment. A child must receive hostile variables directly at its `node --test` boundary so the production test builders encounter them as inherited values. Using `run` to inject that outer environment could hide the defect. Keep victim setup, child scratch directories and lock files under a temporary parent inside this run worktree, and snapshot the victim before launching the child.

Every such temporary parent needs a filesystem Git-discovery boundary. Place a harness-owned `.git` file in that parent with a `gitdir:` target naming a deliberately absent path inside the same parent. Before launching tests, use the independent observer environment to check that an uninitialized child scratch directory cannot resolve a repository or HEAD, and that a separate initialized child repository resolves its own top level. This contains Git discovery after inherited `GIT_` values are removed, including for `run` callers that supply no `gitEnv`. An environment-only ceiling would be removed by the sanitizer under test. The victim and initialized fixtures each retain their own Git metadata below the boundary.

## Phase 1: Sanitize shared and standalone test environments

### Overview

Establish the inherited-environment boundary in the existing shared helper and reach every owned Git-capable environment builder.

### Changes Required

#### Shared base and fixture environments

**File**: `skills/10x-pipeline/test/helpers.mjs`

**Intent**

Remove inherited Git controls once at the shared construction boundary, preventing both direct fixture Git commands and router subprocesses from selecting a parent's repository.

**Contract**

Export `cleanEnv()` returning a fresh environment object with every inherited `GIT_` key removed. `run` merges that result with its explicit `env`. `gitEnv` adds its current fixture values to that result. Preserve function signatures, spawn timeouts, spawn error handling, return shapes, Git arguments and date overrides.

#### Standalone builders

**Files**: `skills/10x-pipeline/test/open-pr.test.mjs`, `skills/10x-pipeline/test/pr-comment.test.mjs`, `skills/openspec-pipeline/test/openspec-contract.test.mjs`, `tools/test/commit-lint.test.mjs`

**Intent**

Give standalone Git and CLI fixtures the same inherited-environment boundary, including the opt-in live branch setup.

**Contract**

Use `cleanEnv()` at the skill-test inherited bases. In commit-lint's existing `GIT_ENV`, use a local filtered parent copy before its explicit fixture keys. Preserve HOME, telemetry controls, PATH selection, fake-command settings, explicit overrides and current availability gates. Keep the Git shim's intentional `GIT_LOG` addition after the sanitized base.

#### Direct router wrappers

**Files**: `skills/10x-pipeline/test/provenance.test.mjs`, `skills/10x-pipeline/test/rule-levels.test.mjs`, `skills/10x-pipeline/test/agents.test.mjs`

**Intent**

Prevent copied-router and provenance fixtures from observing repositories selected by the parent process.

**Contract**

Replace only direct environment pass-through arguments with fresh `cleanEnv()` results and add the required imports. Preserve wrapper outputs, copied-plugin behavior and existing assertions.

### Success Criteria

#### Automated Verification

- Existing environment consumers and timeout contracts pass with `node --test skills/10x-pipeline/test/helpers-timeout.test.mjs skills/10x-pipeline/test/open-pr.test.mjs skills/10x-pipeline/test/pr-comment.test.mjs skills/10x-pipeline/test/provenance.test.mjs skills/10x-pipeline/test/rule-levels.test.mjs skills/10x-pipeline/test/agents.test.mjs skills/openspec-pipeline/test/openspec-contract.test.mjs tools/test/commit-lint.test.mjs`.
- The environment-site audit confirms every inventoried Git-capable inherited base uses prefix stripping before explicit fixture values, with sibling-owned behavior regions excluded from the diff.

## Phase 2: Prove child-test isolation and victim integrity

### Overview

Add focused regression coverage for all-prefix stripping and override precedence, then prove the passing child suites leave a real victim repository intact.

### Changes Required

#### Environment and victim regressions

**File**: `skills/10x-pipeline/test/helpers-env.test.mjs`

**Intent**

Catch the passing-child repository corruption reproduced during planning and guard the sanitizer's complete-prefix and override contracts.

**Contract**

Use built-in Node test and process APIs with the existing scratch-project and cleanup helpers. Check `cleanEnv`, `gitEnv` and `run` against inherited `GIT_DIR`, `GIT_WORK_TREE`, `GIT_INDEX_FILE`, a config tuple, identity and an arbitrary `GIT_` sentinel. Assert preservation of non-Git values, a fresh result on each call and an intact parent environment. Check explicit `run` overrides survive, including an intentional `GIT_` sentinel, and check fixture Git identity/config values, dates, HOME and PATH retain precedence.

Create a committed victim with a tracked sentinel and an existing non-empty index. For separate `GIT_DIR`, `GIT_WORK_TREE`, `GIT_INDEX_FILE` and combined cases, launch real child `node --test` processes with hostile inherited values. Each case runs commit-lint and the OpenSpec isolation tests. The combined case additionally runs the 10x isolation, `open-pr`, `pr-comment`, provenance, rule-level and agents tests. Exclude this regression file from its child file list to keep the process tree finite. Require an exited child with no spawn error or signal, exit status 0 and executed required Git tests. Include stdout and stderr in failure messages.

Compare independently captured before/after HEAD, refs, commit count, index bytes and staged entries, plus a sorted path-and-content snapshot of the entire victim including `.git` and its worktree. Collect observational Git data with optional index refresh disabled. Each scenario starts with its own victim state. Use bounded child execution and adequate output buffers. Keep temporary-parent overrides on the child environment and use `removeTree` for inspected scratch cleanup.

Establish and preflight the temporary parent's filesystem discovery boundary before each scenario, as specified in Critical Implementation Details. Assert that a plain child scratch directory cannot discover this run worktree while a locally initialized fixture resolves its own repository. These checks are part of the existing hostile-scenario verification in Progress row 2.1.

#### Test index

**File**: `skills/10x-pipeline/test/README.md`

**Intent**

Make the regression and test-environment contract discoverable alongside the existing helpers.

**Contract**

Add one row for `helpers-env.test.mjs` and update the helper description for inherited `GIT_` stripping followed by explicit fixture overrides. Keep documentation edits specific to this behavior.

### Success Criteria

#### Automated Verification

- Prefix stripping, fresh-copy behavior, parent preservation, override precedence and all four hostile-environment child scenarios pass with `node --test skills/10x-pipeline/test/helpers-env.test.mjs`, with executed Git cases and unchanged victim snapshots.
- The complete ordinary suite passes with `node --test skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`, with tool-dependent skips recorded.
- An isolated acceptance driver runs the complete suite with all three hostile variables selecting a disposable victim, requires successful child execution and unchanged victim HEAD, refs, commit count, index and complete file snapshot, and records the command and outcome.

## Testing Strategy

### Focused regression proof

Run `helpers-env.test.mjs` before the wider gates. Test the sanitizer in an isolated process or restore any changed parent variables in a guaranteed cleanup path. A made-up `GIT_` key guards against a three-variable denylist. A normal variable containing `GIT` elsewhere in its name guards the exact prefix boundary. Explicit Git-valued overrides exercise the ordering separately from inherited-value removal.

The child suite matrix covers the shared Git path through OpenSpec isolation and the standalone tools path through commit-lint in every case. The combined case adds the other builders and wrappers. Optional OpenSpec CLI checks remain part of the broader focused and full-suite gates. They require their real binary for execution evidence.

### Full-suite acceptance driver

Use a one-off Node driver from this worktree for the final hostile-suite check. Create a disposable parent and victim inside the change folder, initialize and snapshot the victim using a separately clean observer environment, and enumerate every `*.test.mjs` file from the three directories in the ordinary suite command. Spawn `process.execPath` with `--test` and those paths, the combined hostile variables, `GH_LIVE=0`, and temporary-directory values pointing inside the disposable parent. Require no error or signal and status 0, then compare the victim snapshots. Preserve the child counts, skips and victim comparison in the implementation evidence. The driver is a verification command and needs no permanent configuration or package dependency.

Install and preflight the same filesystem discovery boundary in the disposable parent before starting the full suite. The clean observer must confirm that an uninitialized descendant resolves neither a repository nor HEAD, and that an initialized descendant resolves its own top level. Record both checks with the existing Progress row 2.3 evidence. `score.test.mjs` includes a no-repository scenario that calls `run` without `gitEnv`, so the enclosing worktree must be unreachable through filesystem discovery even after successful sanitization.

Victim setup and observation must independently strip the caller's inherited Git variables even when this acceptance driver itself starts in a hook environment. Build each child environment from the clean base and deliberately append the selected hostile variables last. A helper-generated environment used for observing the victim cannot independently prove that helper's safety.

### Environment-site audit

Run `rg -n 'process\.env|spawnSync|execFileSync' skills/10x-pipeline/test skills/openspec-pipeline/test tools/test` and inspect each Git-capable builder against the ownership inventory. Distinguish deliberate hostile injection from accidental parent inheritance. Executable/version probes and subprocesses calling pure readers can retain their current behavior. Check the final diff by region against the Wave 4 ownership table and sibling change descriptions.

## Performance Considerations

Environment filtering is linear in the inherited key count. Permanent regressions run bounded representative child suites. The complete hostile suite is an acceptance command, keeping a second full-suite invocation out of every ordinary test run.

## Migration Notes

This change affects test process environments and adds a test-only export. Existing explicit fixture configurations remain the supported control point. Acceptance uses disposable victim repositories so detecting a regression cannot corrupt this worktree or the main checkout. The planning skill leaves its artifacts uncommitted for the implementation workflow.

## References

- Task and initial fix direction in `context/changes/tests-strip-git-env/change.md`.
- Wave 4 ownership and historical-layout guidance in `context/changes/WAVES.md`.
- Sibling region checks in `context/changes/agent-call-parameters/change.md`, `context/changes/worktree-setup-script/change.md`, `context/changes/run-state-atomic-writes/change.md`, `context/changes/compare-failed-attempts-neutral/change.md` and `context/changes/ci-scratch-in-runner-temp/change.md`.
- Unattended and evidence conventions in `context/foundation/lessons.md`.
- Shared builders and public test-helper contracts in `skills/10x-pipeline/test/helpers.mjs:129` and `skills/10x-pipeline/test/helpers.mjs:217`.
- Explicit logging and Git configuration in `skills/10x-pipeline/test/open-pr.test.mjs:69` and `skills/10x-pipeline/test/open-pr.test.mjs:149`.
- Standalone inherited environments in `tools/test/commit-lint.test.mjs:16`, `skills/10x-pipeline/test/pr-comment.test.mjs:104` and `skills/openspec-pipeline/test/openspec-contract.test.mjs:26`.
- Existing subprocess and isolated Git examples in `skills/10x-pipeline/test/helpers-timeout.test.mjs` and `skills/openspec-pipeline/test/openspec-isolation.test.mjs`.
- Canonical plan parsing in `skills/10x-pipeline/scripts/state.mjs:253`.

## Progress

### Phase 1: Sanitize shared and standalone test environments

#### Automated

- [x] 1.1 Existing environment consumers and timeout contracts pass with `node --test skills/10x-pipeline/test/helpers-timeout.test.mjs skills/10x-pipeline/test/open-pr.test.mjs skills/10x-pipeline/test/pr-comment.test.mjs skills/10x-pipeline/test/provenance.test.mjs skills/10x-pipeline/test/rule-levels.test.mjs skills/10x-pipeline/test/agents.test.mjs skills/openspec-pipeline/test/openspec-contract.test.mjs tools/test/commit-lint.test.mjs`. — d1e53d9
- [x] 1.2 The environment-site audit confirms every inventoried Git-capable inherited base uses prefix stripping before explicit fixture values, with sibling-owned behavior regions excluded from the diff. — d1e53d9

### Phase 2: Prove child-test isolation and victim integrity

#### Automated

- [x] 2.1 Prefix stripping, fresh-copy behavior, parent preservation, override precedence and all four hostile-environment child scenarios pass with `node --test skills/10x-pipeline/test/helpers-env.test.mjs`, with executed Git cases and unchanged victim snapshots.
- [x] 2.2 The complete ordinary suite passes with `node --test skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`, with tool-dependent skips recorded.
- [x] 2.3 An isolated acceptance driver runs the complete suite with all three hostile variables selecting a disposable victim, requires successful child execution and unchanged victim HEAD, refs, commit count, index and complete file snapshot, and records the command and outcome.
