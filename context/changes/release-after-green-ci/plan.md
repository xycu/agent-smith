# Release only from a main commit whose CI run passed — Implementation Plan

## Overview

`release.yml` runs release-please on every push to `main`, with no link to CI, and `ci.yml` cancels its own runs on `main`. Version 1.5.0 was tagged from a commit with a red suite. This plan makes the release job start from a successful CI run of `main` and makes every push to `main` end with a CI result.

## Current State Analysis

- `.github/workflows/release.yml:14-16` starts on `push` to `main`; `concurrency` group `release-please` (workflow level, `cancel-in-progress: false`).
- `.github/workflows/ci.yml:18-20` has `group: ci-${{ github.ref }}` and `cancel-in-progress: true` for every ref. Evidence in `change.md`: 97 runs on `main`, 38 cancelled, 1 failure; `v1.5.0` sits on `5160a8a` whose CI run failed (`coauthor.test.mjs:158`).
- `main` has no branch protection, so nothing blocks a release from a red or cancelled commit.
- No `workflow_run` trigger exists in `.github/workflows/` today.
- `tools/test/ci-runner.test.mjs` reads the workflow files as text (no YAML parser; no npm dependencies, ADR-006) and pins `release.yml` off self-hosted runners. `tools/test/workflow-pins.test.mjs` pins every `uses:` to a SHA.
- The release PR is opened with `GITHUB_TOKEN`, so it starts no CI. Merging it pushes a commit to `main`, which starts CI; with this plan the tag and GitHub Release are then created only by a job that follows a green CI run of the head of `main`. release-please tags the merge commit of the release PR; when no later push lands before that commit's CI run ends, the tested commit is the tagged one (see Key Discoveries).

## Desired End State

- A commit on `main` whose CI run failed or was cancelled produces no release PR update and no tag.
- Every push to `main` has its own CI run that is not cancelled by a later push.
- A rerun of a failed CI run that then passes starts the release job while `main` still points at that commit (a flake delays a release and does not lose it; if `main` moved on, the CI run of the newer head decides).
- Verified by the static tests of Phase 1 and by the live check of Phase 3.

### Key Discoveries:

- `workflow_run` runs the workflow file of the default branch, and `GITHUB_SHA` of that run is the head of `main` at that time, not `workflow_run.head_sha`. release-please reads `main` through the API, so a green CI run for commit A could release commit B pushed afterwards. A job guard `github.event.workflow_run.head_sha == github.sha` closes this. (`complexity.json` unknown 1.)
- With `cancel-in-progress: false`, GitHub still replaces a pending run of the same concurrency group with a newer one. `cancel-in-progress` alone therefore does not give every push a result when three pushes land together. A group key that is unique per push (`github.sha`) does.
- `workflow_run` with `branches: [main]` filters on the head branch name, which a pull request from a fork branch called `main` also matches. The job must also require `workflow_run.event == 'push'`.
- release-please creates the tag at the merge commit of the release PR, not at the head of `main`. If a later push lands before the CI run of that merge commit ends, the job skips that run (stale `head_sha`) and the next green run of the newer head tags the merge commit, whose own CI run may have failed. The gate then guarantees a green head, not a green tagged commit. This residual gap is accepted and recorded in ADR-008's amendment and in `AGENTS.md`; Phase 3.2 and 3.4 show the common case. Closing it would need a job step that reads the CI conclusion of the tagged commit, which this plan does not add.
- `release-please-action` runs no checked-out code, so the write token never meets code from a pull request.

## What We're NOT Doing

- No branch protection or ruleset, no required checks (ADR-008: not adopted).
- No change to `release-please-config.json`, the manifest or the version fields.
- No `release.yml` run on a self-hosted runner (`ci-runner.test.mjs` keeps it hosted).
- No change to the CI jobs, their `runs-on` lines or the action pins.
- No YAML parser or other dependency; tests read the files as text.
- No rewrite of ADR-008's record; only an appended amendment.

## Implementation Approach

Test first. Add one new test file that fails against today's workflows, then change the two workflows until it passes, then the docs. The live behaviour of `workflow_run` cannot run locally, so Phase 3 is a manual check after the merge.

## Phase 1: Tests and workflow changes

### Overview

Pin the new rules in a text test, then edit `ci.yml` and `release.yml`, including their header comments.

### Changes Required:

#### 1. New test file

**File**: `tools/test/release-gate.test.mjs`

**Intent**: Pin that a release needs a green CI run of `main` and that no push to `main` loses its CI result. Same style as `tools/test/ci-runner.test.mjs` (`node:test`, reads `.github/workflows/*` as text). It strips `#` comment lines before matching, because the header comments name the very words under test (`push`).

**Contract**: Tests:
- `release.yml` has no `push:` trigger line and no `pull_request` trigger.
- `release.yml` has `workflow_run:` with `workflows: [CI]`, `types: [completed]` and `branches: [main]`.
- The `release-please` job has an `if:` that contains `github.event.workflow_run.conclusion == 'success'`, `github.event.workflow_run.event == 'push'` and `github.event.workflow_run.head_sha == github.sha`.
- `release.yml` still has `permissions: contents: write` and `pull-requests: write`, and the concurrency group `release-please` with `cancel-in-progress: false`.
- `ci.yml` still triggers on `pull_request` and on `push` to `main`.
- `ci.yml` `cancel-in-progress` is exactly `${{ github.event_name == 'pull_request' }}`, and its `group` uses `github.sha` for events other than `pull_request` and `github.ref` for pull requests.
- The `workflows: [CI]` name equals the `name:` of `ci.yml` (guards a rename that would silently stop releases).

#### 2. CI workflow

**File**: `.github/workflows/ci.yml`

**Intent**: Cancel only superseded pull request runs, and give each push to `main` its own concurrency group so none is cancelled or replaced while pending. Add one sentence to the header comment that every push to `main` ends with a result and `release.yml` reads that result.

**Contract**: `concurrency.group: ci-${{ github.event_name == 'pull_request' && github.ref || github.sha }}`; `cancel-in-progress: ${{ github.event_name == 'pull_request' }}`. The first deviates from `change.md` fix direction 1, which only changes `cancel-in-progress`; see Assumptions in the brief.

#### 3. Release workflow

**File**: `.github/workflows/release.yml`

**Intent**: Start from the CI result instead of the push. Run the job only for a green CI run of a push to `main`, and only while `main` still points at the tested commit, so release-please never sees a commit CI did not pass. Rewrite the header comment: trigger, why the guards exist, that merging the release PR creates a push whose own green CI run creates the tag, and that a rerun of a failed CI run which passes starts the job again.

**Contract**: `on: workflow_run: { workflows: [CI], types: [completed], branches: [main] }`; job `if:` with the three conditions joined by `&&`; the `release-please-action` step, its pin, token and config files unchanged; `runs-on: ubuntu-latest` unchanged. The concurrency block (`group: release-please`, `cancel-in-progress: false`) moves from the workflow to the job so that a run whose job the `if` skips does not take the group's pending slot (assumption, checked in Phase 3).

### Success Criteria:

#### Automated Verification:

- New test file fails against the unchanged workflows, then passes: `node --test tools/test/release-gate.test.mjs`
- Runner and pin tests stay green: `node --test tools/test/ci-runner.test.mjs tools/test/workflow-pins.test.mjs`
- Whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- Version fields still equal: `node tools/version-check.mjs`
- Workflows lint clean when `actionlint` is installed (skipped otherwise): `actionlint .github/workflows/ci.yml .github/workflows/release.yml`

#### Manual Verification:

- The diff of both workflow files reads correctly: header comments match the behaviour, no `uses:` line changed.

**Implementation Note**: After this phase and its automated checks, pause for confirmation before the docs phase.

---

## Phase 2: Documentation

### Overview

Bring `AGENTS.md` and ADR-008 in line. Header comments of the workflows are done in Phase 1.

### Changes Required:

#### 1. AGENTS.md

**File**: `AGENTS.md`

**Intent**: In the `## Releases` section, replace the sentence that says every push to `main` updates one release PR, and add one bullet on the CI gate. In the Project Structure entry for `ci.yml` and `release.yml` and the `tools/test/` list, name the new test. Keep the "No checks on the release PR" bullet and fix its wording if the CI-run-on-merge fact needs a line.

**Contract**: The section states: the release job runs from the `workflow_run` of a successful CI run of a push to `main`, only when `main` still points at that commit; a red or cancelled run releases nothing; rerunning a failed CI run that passes starts the job again only while `main` still points at that commit; the tagged commit is the release-PR merge commit, so a later push before its CI run ends can move the gate to a newer green head; the tag is created by the job that follows the CI run of the release-PR merge commit.

#### 2. ADR-008

**File**: `docs/ADR/ADR-008-release-packaging-and-semver.md`

**Intent**: Append `## Amendment 1: release only after a green CI run (change release-after-green-ci)`, in the form of ADR-012's Amendment 1. Leave the original text as written. Update the `Status` line the way ADR-012 does.

**Contract**: The amendment records the problem (v1.5.0 on `5160a8a` with a red CI run; 38 of 97 CI runs on `main` cancelled), the decision as GIVEN/WHEN/THEN scenarios (a release job **MUST** start only from a successful CI run of a push to `main` whose commit is still the head of `main`; a push to `main` **MUST NOT** have its CI run cancelled by a later push), the consequences (the residual gap that the tag sits on the release-PR merge commit while the gate checks the head of `main`; a flake delays a release; the release PR no longer updates on a red `main`; the tag follows the CI run of the release-PR merge commit; GitHub-hosted minutes unchanged) and the rejected alternatives (branch protection with required checks; a `needs:` job that runs CI inside `release.yml`; `cancel-in-progress` change only).

### Success Criteria:

#### Automated Verification:

- Suite and guards still pass: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- Amendment present and the original record untouched: `git diff --stat docs/ADR/ADR-008-release-packaging-and-semver.md` shows only added lines apart from the Status line.

#### Manual Verification:

- `AGENTS.md` Releases section and ADR-008 amendment match the final workflow files.

---

## Phase 3: Live check after merge

### Overview

`workflow_run` runs the workflow file of `main`, so a pull request cannot exercise it. The owner checks the first runs after the merge. The rows of this phase, including 3.1, can be proved only after the merge; they stay unticked in the implementation run and the owner ticks them.

### Changes Required:

None; this phase observes GitHub.

### Success Criteria:

#### Automated Verification:

- After the merge, `gh run list --workflow Release --limit 5` shows runs with event `workflow_run`, none with event `push`.

#### Manual Verification:

- The merge to `main` gets a CI run that is not cancelled, and the Release run starts after it completes.
- Merge two pull requests close together: each gets its own CI result; no CI run on `main` is cancelled.
- A CI run of `main` that fails produces a Release run whose job is skipped, with no release PR update and no tag.
- Rerunning that failed run until it passes starts the release job again (the assumption that a rerun fires `workflow_run` with `conclusion: success`). If it does not, record it in ADR-008's amendment and note the manual way to start the job.
- A Release run whose job is skipped does not cancel a pending valid run (the job-level concurrency assumption). If it does, move `concurrency` back to the workflow and re-run `release-gate.test.mjs` with the matching change.
- The "Allow GitHub Actions to create and approve pull requests" setting still lets the `workflow_run` job open the release PR.

---

## Testing Strategy

### Unit Tests:

- `tools/test/release-gate.test.mjs` as listed in Phase 1; existing `ci-runner` and `workflow-pins` tests unchanged.

### Integration Tests:

- None possible locally; see Phase 3.

### Manual Testing Steps:

1. Phase 3, in order.

## Performance Considerations

Each push to `main` now runs a full CI run (no cancelled runs): more runner time on the TrueNAS runner, which serialises jobs. Pull request runs still cancel superseded runs.

## Migration Notes

Until the merge, the old `push` trigger is in force. After the merge, the release PR updates only after CI finishes, so it lags a push by the CI duration. The release PR open at merge time is picked up by the next green run.

## References

- Change: `context/changes/release-after-green-ci/change.md`
- Complexity score and unknowns: `context/changes/release-after-green-ci/complexity.json`
- `.github/workflows/ci.yml:18-20`, `.github/workflows/release.yml:14-16`
- `tools/test/ci-runner.test.mjs`, `tools/test/workflow-pins.test.mjs`
- `docs/ADR/ADR-008-release-packaging-and-semver.md`, `docs/ADR/ADR-012-automate-manual-checks.md` (amendment form), `docs/ADR/ADR-020-ci-on-self-hosted-truenas-runners.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Tests and workflow changes

#### Automated

- [x] 1.1 New test file fails against the unchanged workflows, then passes: `node --test tools/test/release-gate.test.mjs` — be497dd
- [x] 1.2 Runner and pin tests stay green: `node --test tools/test/ci-runner.test.mjs tools/test/workflow-pins.test.mjs` — be497dd
- [x] 1.3 Whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` — be497dd
- [x] 1.4 Version fields still equal: `node tools/version-check.mjs` — be497dd
- [x] 1.5 Workflows lint clean when `actionlint` is installed (skipped otherwise): `actionlint .github/workflows/ci.yml .github/workflows/release.yml` — be497dd

#### Manual

- [ ] 1.6 The diff of both workflow files reads correctly: header comments match the behaviour, no `uses:` line changed

### Phase 2: Documentation

#### Automated

- [x] 2.1 Suite and guards still pass: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` — 00a990b
- [x] 2.2 Amendment present and the original record untouched: `git diff --stat docs/ADR/ADR-008-release-packaging-and-semver.md` shows only added lines apart from the Status line — 00a990b

#### Manual

- [ ] 2.3 `AGENTS.md` Releases section and ADR-008 amendment match the final workflow files

### Phase 3: Live check after merge

#### Automated

- [ ] 3.1 After the merge, `gh run list --workflow Release --limit 5` shows runs with event `workflow_run`, none with event `push`

#### Manual

- [ ] 3.2 The merge to `main` gets a CI run that is not cancelled, and the Release run starts after it completes
- [ ] 3.3 Merge two pull requests close together: each gets its own CI result; no CI run on `main` is cancelled
- [ ] 3.4 A CI run of `main` that fails produces a Release run whose job is skipped, with no release PR update and no tag
- [ ] 3.5 Rerunning that failed run until it passes starts the release job again
- [ ] 3.6 A Release run whose job is skipped does not cancel a pending valid run
- [ ] 3.7 The "Allow GitHub Actions to create and approve pull requests" setting still lets the `workflow_run` job open the release PR
