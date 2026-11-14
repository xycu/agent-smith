# Required CI tool checks implementation plan

## Overview

Make unavailable Git and OpenSpec contract tooling fail CI at the probes that currently convert those failures into skips. Install the owner-approved, pinned OpenSpec CLI in the CI test job and document the remaining expected skips by test identity and condition.

## Current State Analysis

The shared `gitAvailable()` returns only `res.status === 0`. Its callers use that boolean to skip Git-dependent tests across both chains. OpenSpec's module-level `probe()` returns a skip reason when the selected binary cannot start or its version command fails. The test job installs Node 24 and immediately runs the suite. Sources are `skills/10x-pipeline/test/helpers.mjs:215`, `skills/openspec-pipeline/test/openspec-contract.test.mjs:14`, and `.github/workflows/ci.yml:35`.

Two read-only reproductions on 2026-11-14 establish the failure mechanism. With `CI=1` and `OPENSPEC_BIN` pointing at an absent path inside this worktree, the contract file exited 0 with five skips. A child process with `CI=1` and an empty tool PATH imported the real helper and exited 0 with `gitAvailable: false`. The reproductions used Node 26.13.1. Node 24 verification belongs to implementation acceptance.

The brief's historical total of ten skips predates the non-root CI guard. Its two permission checks now run on a valid Linux CI runner. The inventory also contains a conditional real-`gh` check, so a single historical skip total cannot describe every supported runner. Sources are `context/changes/ci-fail-on-unexpected-skips/change.md`, `docs/ADR/ADR-020-ci-on-self-hosted-truenas-runners.md`, and the inventory below.

## Desired End State

- A nonempty `CI` environment variable makes an unsuccessful Git or OpenSpec availability probe fail with an actionable error identifying the command and failure.
- With `CI` absent or empty, unavailable tools retain their existing boolean or skip-reason behavior.
- CI installs and selects `@fission-ai/openspec@1.16.1` before the suite. Every existing OpenSpec fixture executes against that binary.
- CI acceptance records skipped test identities and their gating conditions, alongside evidence that the five contract checks and Git-dependent checks ran.

### Key discoveries

- The current contract file is `skills/openspec-pipeline/test/openspec-contract.test.mjs`. The current reader is `skills/openspec-pipeline/scripts/openspec.mjs`. The brief names their former locations. `context/changes/WAVES.md` explicitly requires resolving those moves.
- The reader's task-row comment and ADR-013 identify CLI 1.16.1 as the established contract. The npm registry confirms that `@fission-ai/openspec@1.16.1` publishes the `openspec` binary and requires Node >=22.12.0, compatible with CI's Node 24. Sources are `skills/openspec-pipeline/scripts/openspec.mjs:7`, `docs/ADR/ADR-013-openspec-pipeline.md:11`, and the registry reference below.
- OpenSpec probes before registering its fixture tests, so a CI probe exception fails the test file during discovery. Git's many callers already share one helper. Both boundaries can enforce the requirement without caller rewrites.
- `tools/test/ci-runner.test.mjs:37` already inspects the workflow's test-job steps. The wave lane explicitly pairs that test file with `ci.yml`, providing the existing location for CI regression coverage.

## Scope and ownership

Wave 5 assigns this change the new-step region of `.github/workflows/ci.yml`, the `gitAvailable()` region of `skills/10x-pipeline/test/helpers.mjs`, and the moved OpenSpec contract file. Supporting CI checks use the existing `tools/test/ci-runner.test.mjs`, consistent with the lane description in WAVES. Update the existing contract-test entry in `skills/openspec-pipeline/test/README.md` and the OpenSpec contract paragraph in `docs/REFERENCE.md`, whose shared-text exception permits a focused correction.

The workflow addition sits between Node setup and the existing Test suite step. The existing suite command belongs to Wave 6. Current runner selection, UID guard, TMPDIR wiring, timeouts, release routing, router logic, policies, skill text, manifests, and version fields form the compatibility boundary. WAVES and archived change folders remain reference material throughout this change.

## Implementation Approach

Use the existing probes as the authoritative enforcement points. Preserve their public return values on successful probes and local failures, and throw on CI failures. Add an isolated CI installation step for the single approved npm tool. Maintain an explicit conditional skip inventory in workflow comments and the contract-test documentation. Option a in the change brief supplies the selected enforcement strategy. Skip counts serve as acceptance evidence, while required-tool failures are enforced at their source.

### Evidence-backed assumptions

- **A1** The owner approval selects option a from the brief and allows the OpenSpec CLI's dependency tree as part of that one CI-only tool installation. The supplied task grants this exception.
- **A2** Pin 1.16.1 because both the reader and ADR-013 name it as the implemented contract. The laptop's installed CLI reports 2.0.0, so its presence alone cannot establish acceptance for the pin.
- **A3** Use nonempty `process.env.CI` as the CI switch, matching the brief's proposed guard and GitHub Actions' populated `CI` variable. A literal value of `false` is still nonempty. Record this in regression coverage.
- **A4** MEDIUM complexity and two phases fit the shared helper's broad caller surface, the CI installation boundary, and the focused test changes. The unattended task's decision rules replace the skill's interview and phase-approval questions with these documented decisions. `context/foundation/lessons.md` also requires doing the research within this worker.
- **A5** Keep the real-`gh` authentication check optional when `gh` is unavailable. Its existing gate and ADR-020's prerequisite list establish that condition. Required tooling for this change is Git and the pinned OpenSpec CLI.
- **A6** Supporting regression edits belong in `tools/test/ci-runner.test.mjs`, which WAVES explicitly associates with the workflow lane. The contract README entry and reference paragraph document the changed behavior in their existing sections.

## Critical Implementation Details

Availability is evaluated during test discovery. Regression subprocesses must set CI, PATH, and OPENSPEC_BIN before importing the tested module, and isolate those environment changes from the parent test process. Use bounded subprocess calls and the existing hermetic-environment and scratch-cleanup conventions.

The CI install must select its own executable even when a self-hosted runner already has another OpenSpec version. Publish the absolute installed executable through `GITHUB_ENV` as `OPENSPEC_BIN`, and validate that executable before the suite. The installation's failure status must reach the job before any environment-file append can replace it.

## Phase 1: Fail required probes in CI

### Overview

Enforce CI tool availability through the two existing probes and prove the local/CI boundary with isolated regression cases.

### Changes Required

#### 1. Shared Git availability probe

**File** `skills/10x-pipeline/test/helpers.mjs`

**Intent** Make a missing or unusable Git command fail every CI caller that currently relies on a skip boolean.

**Contract** `gitAvailable()` keeps its zero-argument interface and returns true on version-command success. On an unsuccessful probe it returns false locally and throws in CI. Bound the version subprocess using the existing timeout convention. Error diagnostics identify Git and distinguish a spawn error, signal, or nonzero exit status. Keep changes within this probe and reuse existing diagnostics where they fit.

#### 2. OpenSpec contract availability probe

**File** `skills/openspec-pipeline/test/openspec-contract.test.mjs`

**Intent** Make an unusable selected CLI fail discovery in CI while preserving the five local fixture skips.

**Contract** Keep `OPENSPEC_BIN ?? "openspec"`, the existing version-probe timeout, fixture names, comparisons, and local skip-reason semantics. Every unsuccessful version probe, including timeout or signal termination, throws when CI is nonempty. A successful probe still returns false as the skip option. Update the file comment to describe both execution modes.

#### 3. Probe regression coverage

**File** `tools/test/ci-runner.test.mjs`

**Intent** Verify the actual imported Git helper and actual OpenSpec test-file entry point under isolated environments.

**Contract** Cover successful version probes in both modes, missing executables, nonzero version exits, and signal/timeout failure classification with bounded subprocesses. Check local Git false versus CI failure, local OpenSpec five skipped fixtures versus CI failure, and preservation of an explicit OPENSPEC_BIN. Include CI absent, empty, and nonempty values. Use stub executables or isolated child-process instrumentation as the existing tests permit. Parent PATH and CI must survive unchanged, and fixtures use repository cleanup conventions.

### Success Criteria

#### Automated Verification

- Focused CI regression tests pass with `node --test tools/test/ci-runner.test.mjs`.
- Missing and nonzero-exit Git probes return false locally and fail in CI with Git-specific diagnostics, while successful probes return true in both modes.
- Missing and nonzero-exit OpenSpec probes yield five local fixture skips and a nonzero CI test-file exit naming the selected binary.
- Probe coverage proves bounded failure handling and independent CI, PATH, and OPENSPEC_BIN environments, including an empty CI value.
- The repository suite passes with `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`.

## Phase 2: Install the pinned CI tool and account for skips

### Overview

Make the real CLI available in CI, validate selection and failure propagation, and document the complete current Linux CI skip inventory.

### Changes Required

#### 1. New CI prerequisite step

**File** `.github/workflows/ci.yml`

**Intent** Make the exact approved OpenSpec contract version available to the existing suite on both runner paths.

**Contract** Add a test-job step after Node setup and before Test suite. Check `git --version`, create a unique install prefix under `runner.temp`, and install `@fission-ai/openspec@1.16.1` with npm using `--no-save` and `--package-lock=false`. Use job-local npm cache/config paths where needed for a non-root service user. Resolve `node_modules/.bin/openspec` under that prefix, require its version output to equal 1.16.1, and export its absolute path as OPENSPEC_BIN through GITHUB_ENV for later steps. Disable telemetry for the step. A Git, npm, install, or version-validation failure fails the step. Use the existing job timeout and runner temporary-directory lifecycle.

#### 2. Workflow regression coverage

**File** `tools/test/ci-runner.test.mjs`

**Intent** Prevent a pin, ordering, or executable-selection regression from restoring green CI with skipped contracts.

**Contract** Pin the new step's ordering, exact package version, temporary install prefix, OPENSPEC_BIN publication, and explicit executable-version validation. Exercise the step with command stubs to prove install and version failures propagate, an ambient OpenSpec binary cannot override the selected installation, and success exports the intended executable. Keep existing workflow invariant tests passing. Command stubs avoid real registry access during the regression suite.

#### 3. Expected skips and contract documentation

**Files** `.github/workflows/ci.yml`, `skills/openspec-pipeline/test/README.md`, `docs/REFERENCE.md`

**Intent** Explain the enforced CI contract, the approved tool exception and deliberate pin, and the reason for each remaining skip.

**Contract** Put the conditional inventory below beside the added CI step, and update the existing contract-test README entry and reference paragraph to distinguish local and CI probe behavior. State that pin upgrades require a deliberate commit and successful contract execution. Describe the single CLI installation as the approved CI-tool exception. Keep the wording scoped to the existing test contract.

### Expected Linux CI skips

| Test identity | Source | Expected condition |
| --- | --- | --- |
| `live: a branch with no pull request is skipped` | `skills/10x-pipeline/test/pr-comment.test.mjs:820` | GH_LIVE differs from 1, the default CI setting. |
| `live: the real comment projection is one parseable object per line across pages` | `skills/10x-pipeline/test/pr-comment.test.mjs:839` | GH_LIVE differs from 1, the default CI setting. |
| `CLAUDE.md has no @ imports` | `tools/test/agents-md-no-imports.test.mjs:44` | CLAUDE.md is absent in the current tree. |
| `real gh without a login is not authenticated` | `skills/10x-pipeline/test/pr-comment.test.mjs:679` | gh is absent from PATH. This is an additional conditional skip. |

The default inventory therefore has three skips with gh available and four with gh absent. With CLAUDE.md present, its check runs and the corresponding total falls by one. Local Windows/platform skips are covered by their existing platform gates. Linux CI runs the two permission checks in `no-recursive-delete.test.mjs:77` and `:93`, since the UID guard requires a non-root user. Required Git and OpenSpec checks must execute in every successful CI run. Validate identities and conditions together when recording acceptance, since counts alone can hide a substitution.

### Success Criteria

#### Automated Verification

- Workflow tests prove exact OpenSpec 1.16.1 installation, temporary-prefix isolation, prerequisite ordering, selected-executable export, and failure propagation using `node --test tools/test/ci-runner.test.mjs`.
- Under Node 24 with CI=1 and OPENSPEC_BIN selecting the installed 1.16.1 binary, all five real OpenSpec fixture comparisons pass with zero skips using `node --test skills/openspec-pipeline/test/openspec-contract.test.mjs`.
- Under Node 24 with the pinned binary selected, the full repository suite passes and every skipped test matches the documented identity and condition using `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`.
- Version and workflow-pin guards pass with `node tools/version-check.mjs` and `node --test tools/test/workflow-pins.test.mjs`, and `git diff --check` passes.

#### Manual Verification

- A normal same-repository PR CI run on the non-root TrueNAS runner records OpenSpec 1.16.1, execution of all five contract fixtures and both permission checks, and only the documented conditional skips.

## Testing Strategy

Probe regression cases are subprocess-based so module-level availability checks observe the intended environment. Negative cases are deterministic and cover both tool launch failures and version-command failures. Use command stubs to test the workflow step's failure handling, then use the real pinned executable for contract acceptance. Both same-repository and fork runner selections share the same prerequisite step and are covered by the existing workflow-selection assertions.

Run focused checks before the full repository gate after each phase. For acceptance evidence, capture the skipped test names and reasons from the full suite output together with the Node and CLI versions. The new CI setup step can be exercised locally on non-root Linux with temporary GITHUB_ENV and runner-temp fixtures. A successful hosted workflow observation remains useful supplementary evidence when an authorized fork PR exists.

## Performance Considerations

CI adds one pinned CLI installation to the existing 15-minute test-job limit. The suite continues to run its five existing real-CLI comparisons. Probe regressions use bounded child processes and stub commands to keep the normal suite independent of network access. Registry access and the CLI dependency tree are CI installation costs covered by the owner-approved exception.

## Migration Notes

The change affects test execution and job setup. The install prefix and npm state are temporary job artifacts. A revert of this change restores the earlier probe and workflow behavior. Implementation commits follow the repository's Conventional Commit and AI co-author rules. Planning artifacts stay uncommitted under the 10x-plan skill's persistence rules.

## References

- Change brief in `context/changes/ci-fail-on-unexpected-skips/change.md`.
- Wave ownership and the CI test lane in `context/changes/WAVES.md`, especially Wave 5 and the moved-path note.
- Shared probe in `skills/10x-pipeline/test/helpers.mjs:215` and contract probe in `skills/openspec-pipeline/test/openspec-contract.test.mjs:16`.
- Contract version in `skills/openspec-pipeline/scripts/openspec.mjs:7` and `docs/ADR/ADR-013-openspec-pipeline.md:11`.
- Workflow in `.github/workflows/ci.yml:35` and its existing assertions in `tools/test/ci-runner.test.mjs:37`.
- Runner prerequisites and non-root behavior in `docs/ADR/ADR-020-ci-on-self-hosted-truenas-runners.md`.
- Existing contract documentation in `skills/openspec-pipeline/test/README.md` and `docs/REFERENCE.md:542`.
- Unattended research constraints in `context/foundation/lessons.md`.
- Published package metadata, read on 2026-11-14. [npm registry](https://registry.npmjs.org/@fission-ai%2fopenspec/1.16.1)

## Progress

### Phase 1: Fail required probes in CI

#### Automated

- [ ] 1.1 Focused CI regression tests pass with `node --test tools/test/ci-runner.test.mjs`.
- [ ] 1.2 Missing and nonzero-exit Git probes return false locally and fail in CI with Git-specific diagnostics, while successful probes return true in both modes.
- [ ] 1.3 Missing and nonzero-exit OpenSpec probes yield five local fixture skips and a nonzero CI test-file exit naming the selected binary.
- [ ] 1.4 Probe coverage proves bounded failure handling and independent CI, PATH, and OPENSPEC_BIN environments, including an empty CI value.
- [ ] 1.5 The repository suite passes with `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`.

### Phase 2: Install the pinned CI tool and account for skips

#### Automated

- [ ] 2.1 Workflow tests prove exact OpenSpec 1.16.1 installation, temporary-prefix isolation, prerequisite ordering, selected-executable export, and failure propagation using `node --test tools/test/ci-runner.test.mjs`.
- [ ] 2.2 Under Node 24 with CI=1 and OPENSPEC_BIN selecting the installed 1.16.1 binary, all five real OpenSpec fixture comparisons pass with zero skips using `node --test skills/openspec-pipeline/test/openspec-contract.test.mjs`.
- [ ] 2.3 Under Node 24 with the pinned binary selected, the full repository suite passes and every skipped test matches the documented identity and condition using `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`.
- [ ] 2.4 Version and workflow-pin guards pass with `node tools/version-check.mjs` and `node --test tools/test/workflow-pins.test.mjs`, and `git diff --check` passes.

#### Manual

- [ ] 2.5 A normal same-repository PR CI run on the non-root TrueNAS runner records OpenSpec 1.16.1, execution of all five contract fixtures and both permission checks, and only the documented conditional skips.
