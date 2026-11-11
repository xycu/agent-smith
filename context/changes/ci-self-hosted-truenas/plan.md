# Run CI on self-hosted TrueNAS runners Implementation Plan

## Overview

Move the two jobs of `.github/workflows/ci.yml` (`test`, `commits`) from `ubuntu-latest` to self-hosted runner instances on TrueNAS, and keep code from a fork pull request off the NAS. Two controls do that: the repository setting that holds fork workflow runs for approval (the real boundary) and a `runs-on` fallback to `ubuntu-latest` for fork PRs (defence in depth). `release.yml` stays on GitHub-hosted runners.

## Current State Analysis

- `ci.yml` has two jobs, both `runs-on: ubuntu-latest` (`.github/workflows/ci.yml:21`, `:35`). Triggers: `pull_request` and `push` to `main`. Steps: checkout, `actions/setup-node` Node 24, then `node --test ...`, `tools/version-check.mjs`, `tools/commit-lint.mjs`.
- `release.yml` has one job on `ubuntu-latest` and uses `GITHUB_TOKEN` with `contents: write`; it is outside the goal.
- The repository `xycu/agent-smith` is PUBLIC (`gh repo view`). A `pull_request` from a fork would run its workflow code on the runner. GitHub warns against self-hosted runners for public repositories for this reason. The `runs-on` expression is not a boundary by itself: a fork PR runs the workflow file from its own merge ref, so its author can edit `runs-on` to the self-hosted labels. What stops that run is the setting Settings -> Actions -> General -> "Fork pull request workflows from outside collaborators" ("Require approval for all external contributors"), which holds every fork PR run until a maintainer approves it.
- The setting does not hold today. Read-only `gh api repos/xycu/agent-smith/actions/permissions/fork-pr-contributor-approval` returned `{"approval_policy":"first_time_contributors"}` on 2026-11-11 (impl-review F1, re-read during this re-plan). With that policy a fork contributor whose earlier run was approved, or whose PR was merged, gets no approval gate. The six runners `truenas-agent-smith-1..6` are already online, so the exposure exists now, not only after the merge. Only the owner may change the setting: agents never change repository settings (AGENTS.md Hard Rules).
- The test suite builds real git worktrees, a bare remote and logging `git` shims (`skills/10x-pipeline/test/*.test.mjs`), so the runner needs `git` and a writable temp dir. No npm dependencies exist (AGENTS.md, ADR-006), so no `npm ci` and no cache.
- `tools/workflow-pins.mjs` pins every `uses:` to a 40-hex SHA with a version comment; `tools/test/workflow-pins.test.mjs` runs it on this repository. Adding no new action keeps it green.
- ADR-008 line 45 says the workflows run only on GitHub and were checked with `actionlint`; AGENTS.md lists ci.yml in Project Structure and Releases.

## Desired End State

On a pull request from the same repository, and on push to `main`, both CI jobs run on a runner carrying the labels `self-hosted`, `linux`, `truenas`. On a pull request from a fork, both jobs fall back to `ubuntu-latest`, and the repository requires maintainer approval before any fork PR workflow runs, so untrusted code reaches the NAS only if the owner approves a run that edited `runs-on`. The owner reads the workflow diff of a fork PR before approving. Job names, steps, concurrency and permissions are unchanged. An ADR records the decision and the runner prerequisites.

### Key Discoveries:

- `runs-on` accepts an expression, so one workflow can pick the runner per event; no second workflow is needed.
- The fallback only covers an honest fork PR. Do not describe it as a security boundary in the workflow comment, the ADR or the report; the approval setting is the boundary and is a prerequisite (Phase 3).
- A fork PR has `github.event.pull_request.head.repo.full_name != github.repository`; push events have no `pull_request` object, so the check must treat that as same-repo.
- `actions/setup-node` downloads Node 24 from the internet at job time; a TrueNAS runner needs outbound HTTPS to github.com and nodejs.org, or Node 24 preinstalled (decision below).
- The approval setting can be read without a write: `gh api repos/xycu/agent-smith/actions/permissions/fork-pr-contributor-approval --jq .approval_policy`. The required value is `all_external_contributors` ("Require approval for all external contributors"), so a Progress row can check it.

## What We're NOT Doing

- No change to `release.yml` (it holds a write token; the goal names CI only).
- No runner installation or TrueNAS setup in the repository (the runners are infrastructure; the ADR lists prerequisites only).
- No runner group, ephemeral-runner or autoscaling setup; no caching; no change to test commands.
- No change to the SHA-pin rule or to any pinned action.
- No Docker-in-job container images (`container:`); jobs run directly on the runner host.
- No agent changes the fork approval setting or any other repository setting (AGENTS.md Hard Rules); the owner does. No amendment of ADR-020 D2 to accept `first_time_contributors` as the boundary.

## Implementation Approach

Define the runner choice once per job as a ternary expression on the event and head repository. Keep `actions/setup-node` so the Node 24 requirement stays declared in the workflow (works on a runner with internet or a populated tool cache). Add a guard test that reads `ci.yml` so the fork fallback cannot be dropped or inverted silently. Record the decision in ADR-020 and fix the stale ADR-008 sentence and the AGENTS.md mention.

Revision after the implementation review of 2026-11-11 (`reviews/impl-review.md`, REJECTED): F1 (the fork approval policy reads `first_time_contributors`) becomes Phase 3 item 2 and rows 3.5 and 3.6. F2 and F3 were applied in commit `b8541af`; row 2.4 pins the F2 wording, and row 3.6 rewrites the F3 sentence, which the next passing reading makes stale.

## Phase 1: Switch ci.yml to the self-hosted runner with a fork fallback

### Overview

Edit both jobs and the header comment; add a guard test.

### Changes Required:

#### 1. Workflow runner selection

**File**: `.github/workflows/ci.yml`

**Intent**: Run both jobs on the TrueNAS runner for trusted events and on GitHub-hosted `ubuntu-latest` for fork pull requests. Explain the why in the header comment (public repository; the fallback keeps honest fork PRs on hosted runners, and the fork-approval setting is what stops a fork PR that edits `runs-on`).

**Contract**: each job has `runs-on: ${{ (github.event_name == 'pull_request' && github.event.pull_request.head.repo.full_name != github.repository) && 'ubuntu-latest' || fromJSON('["self-hosted","linux","truenas"]') }}`. The label array is the contract with the runner registration. Everything else in the file is unchanged, and no new `uses:` is added.

#### 2. Guard test

**File**: `tools/test/ci-runner.test.mjs`

**Intent**: Fail when a job of `ci.yml` loses the self-hosted labels or the fork fallback, or when `release.yml` moves to a self-hosted runner.

**Contract**: `node:test` file, built-ins only, no YAML parser (match the plain-text style of `tools/workflow-pins.mjs`): reads `.github/workflows/ci.yml`, asserts every `runs-on:` line equals the exact expression of the Contract above (a plain string compare, so a swapped ternary branch, a dropped label or a changed operator fails), and that the count of `runs-on:` lines equals the count of jobs (2). Asserts `release.yml` has no `self-hosted`.

### Success Criteria:

#### Automated Verification:

- Guard test passes: `node --test tools/test/ci-runner.test.mjs`
- Pin guard still passes: `node --test tools/test/workflow-pins.test.mjs`
- Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- Version check passes: `node tools/version-check.mjs`
- Workflow lints clean when `actionlint` is installed: `actionlint .github/workflows/ci.yml` (skip if the binary is absent)

#### Manual Verification:

- None for this phase (a runner is needed to observe a run; see Phase 3).

**Implementation Note**: After automated verification passes, pause for confirmation before Phase 2.

---

## Phase 2: Record the decision in docs

### Overview

ADR plus the two stale statements.

### Changes Required:

#### 1. ADR

**File**: `docs/ADR/ADR-020-ci-on-self-hosted-truenas-runners.md`

**Intent**: Record the decision, the fork fallback and why, and the runner prerequisites. Follow the format of `ADR-019-late-usage-figure.md`.

**Contract**: sections as the other ADRs use. Records: labels `self-hosted, linux, truenas`; `release.yml` stays hosted; prerequisites for the runner (Linux x64 or arm64 with Node 24 reachable through `actions/setup-node` or preinstalled, `git` 2.x, outbound HTTPS to github.com and the Node distribution host, a temp dir the test user can write, a non-root service user); a runner version that runs Node 24 actions (`actions/checkout` v5 documents v2.327.1 or newer); a note that the runner must not hold secrets or credentials beyond the runner token because the repository is public; a note that the runner is persistent, so a same-repository branch from anyone with write access runs code there and workspace state carries over between jobs; the required repository setting "Require approval for all external contributors" for fork PR workflows, stated as the real boundary, with the `runs-on` fallback described as defence in depth only; consequence: a fork PR is slower or unavailable only if hosted minutes run out.

#### 2. Stale statements

**Files**: `docs/ADR/ADR-008-release-packaging-and-semver.md` (line 45), `AGENTS.md` (Project Structure line for `.github/workflows/ci.yml`)

**Intent**: ADR-008 says the workflows run only on GitHub; add a pointer to ADR-020 for CI. AGENTS.md: mention the runner choice and the guard test `tools/test/ci-runner.test.mjs`, and bump the ADR range sentence to include ADR-020 with one clause.

**Contract**: prose edits only; `docs/ADR/` listing in AGENTS.md names ADR-020.

#### 3. Fixes of the implementation review (applied in `b8541af`)

**Intent**: F2: the kept first sentence of ADR-008 line 45 read as false next to the ADR-020 pointer; it now reads "The workflows run only in GitHub Actions, never locally." F3: the ADR-020 assumption on the fork approval setting now names the required value, the read-only call and the measured value. Row 2.4 keeps the F2 wording from regressing; the F3 sentence changes again under Phase 3 item 2.

**Contract**: `docs/ADR/ADR-008-release-packaging-and-semver.md` keeps the sentence "The workflows run only in GitHub Actions, never locally." No further edit in this phase.

### Success Criteria:

#### Automated Verification:

- ADR file exists and is referenced: `grep -l "ADR-020" AGENTS.md docs/ADR/ADR-008-release-packaging-and-semver.md`
- Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- ADR-008 keeps the F2 wording: `grep -q "The workflows run only in GitHub Actions, never locally." docs/ADR/ADR-008-release-packaging-and-semver.md`

#### Manual Verification:

- The ADR prerequisites match what the owner's TrueNAS runners actually provide.

---

## Phase 3: Prove it on a real runner

### Overview

The workflow cannot be run locally; the first pull request on the NAS runners is the proof. The fork approval boundary must hold first (item 2).

### Changes Required:

#### 1. Runner registration check (owner action, no repo change)

**Intent**: Before the pull request of this change is opened (its own jobs run on the NAS, and they queue until a runner is online), confirm the runners are registered to `xycu/agent-smith` with labels `self-hosted`, `linux`, `truenas` and are online. The fork approval setting (Settings -> Actions -> General -> "Fork pull request workflows from outside collaborators" = "Require approval for all external contributors") is not a precondition of opening the pull request: ADR-017 opens it when the run ends or halts, which can happen before the owner acts, and a same-repository pull request is the trusted case. The setting is the boundary that keeps fork code off the NAS, so the owner switches it now (the runners are already online) and in any case before the merge; row 3.5 reads it (item 2).

**Contract**: no files change.

#### 2. Fork approval boundary (impl-review F1)

**Intent**: The policy reads `first_time_contributors`, so a fork contributor with an earlier approved run or merged PR can edit `runs-on` to the TrueNAS labels and run code on the NAS without approval. The owner switches the setting to "Require approval for all external contributors" now, because the runners are already online, and in any case before the pull request of this change is merged. An agent only reads the setting, then records the passing reading in ADR-020. The run's own pull request may open when the run ends or halts (ADR-017); its jobs then run on the NAS as a same-repository pull request, the trusted case, and do not widen the fork exposure. The merge stays the owner's gate.

**Contract**:

- Owner action, no repository file: the read-only call `gh api repos/xycu/agent-smith/actions/permissions/fork-pr-contributor-approval --jq .approval_policy` prints `all_external_contributors`. Agents never write the setting (no `gh api -X PUT`, no settings page).
- Row 3.5 (implementer): run that call. On any other value, leave 3.5 and 3.6 pending, change no file, and finish with status `blocked` and `signals.needsHuman` naming the owner action. When the `gh` call itself fails (no auth, no admin read access, no network), do the same but name the failure in `needsHuman` and say the setting is unread, not wrong, so the owner fixes access instead of re-setting a setting that may already be right. Do not report `failed`: the run must halt for the owner, not retry at a higher tier. Do not weaken ADR-020 D2 to fit the reading.
- Row 3.6 (implementer), only after 3.5 passed in the same step: the Assumptions bullet on the fork approval setting in `docs/ADR/ADR-020-ci-on-self-hosted-truenas-runners.md` names the required value `all_external_contributors`, the read-only call, Progress row 3.5 as its check, and the date and value of the reading that passed. It may keep the 2026-11-11 `first_time_contributors` reading as history. It drops "no Progress row covers it" and "does not hold until the owner changes the setting". The 3.6 command only proves the two dropped phrases are gone (`all_external_contributors` already appears in the ADR), so the implementer checks by reading the bullet that it names the date and value of the passing reading and "Progress row 3.5". No other ADR line changes; the ADR records no reading that did not happen.

### Success Criteria:

#### Automated Verification:

- Runners are online with the labels: `gh api repos/xycu/agent-smith/actions/runners --jq '.runners[] | {name,status,labels:[.labels[].name]}'`
- Fork approval policy is all external contributors: `gh api repos/xycu/agent-smith/actions/permissions/fork-pr-contributor-approval --jq .approval_policy` prints `all_external_contributors`
- ADR-020 records the passing reading: `grep -q "all_external_contributors" docs/ADR/ADR-020-ci-on-self-hosted-truenas-runners.md && ! grep -qE "no Progress row covers it|does not hold until the owner changes the setting" docs/ADR/ADR-020-ci-on-self-hosted-truenas-runners.md`

#### Manual Verification:

- A pull request from this repository runs both CI jobs on the TrueNAS runner (job log header shows the runner name) and both pass.
- A push to `main` after the merge runs the `test` job on the TrueNAS runner and it passes.
- If a fork pull request is available, its jobs run on a GitHub-hosted runner.

---

## Testing Strategy

### Unit Tests:

- `tools/test/ci-runner.test.mjs` pins the labels, the fork fallback and that `release.yml` stays hosted.

### Integration Tests:

- The existing suite runs unchanged on the new runner; real worktree and git shim tests need `git` on the runner.

### Manual Testing Steps:

1. Owner: set the fork approval setting to "Require approval for all external contributors" now (not only before the merge) and re-read the endpoint (row 3.5).
2. Read the job log runner name of the pull request from this repository (the run opens it at its end or halt, ADR-017; open one by hand if it did not).
3. Merge it; check the `main` push run.

## Performance Considerations

A single runner serialises jobs; `concurrency` with `cancel-in-progress` already limits waste. Register a second instance if `test` and `commits` queue too long.

## Migration Notes

Rollback: revert the `runs-on` lines to `ubuntu-latest`. If the runners are offline, jobs queue until a runner returns; switch back to `ubuntu-latest` in that case.

## References

- `.github/workflows/ci.yml:21`, `:35`; `.github/workflows/release.yml:28`
- `tools/workflow-pins.mjs`, `tools/test/workflow-pins.test.mjs`
- `docs/ADR/ADR-008-release-packaging-and-semver.md:45`
- `context/changes/ci-self-hosted-truenas/reviews/impl-review.md` (F1-F3); fix commit `b8541af`
- `docs/ADR/ADR-020-ci-on-self-hosted-truenas-runners.md` (D2, Assumptions)
- GitHub REST: `GET /repos/{owner}/{repo}/actions/permissions/fork-pr-contributor-approval` (`approval_policy`)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Switch ci.yml to the self-hosted runner with a fork fallback

#### Automated

- [x] 1.1 Guard test passes: `node --test tools/test/ci-runner.test.mjs`
- [x] 1.2 Pin guard still passes: `node --test tools/test/workflow-pins.test.mjs`
- [x] 1.3 Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- [x] 1.4 Version check passes: `node tools/version-check.mjs`
- [x] 1.5 Workflow lints clean when `actionlint` is installed: `actionlint .github/workflows/ci.yml` (skip if the binary is absent)

### Phase 2: Record the decision in docs

#### Automated

- [x] 2.1 ADR file exists and is referenced: `grep -l "ADR-020" AGENTS.md docs/ADR/ADR-008-release-packaging-and-semver.md`
- [x] 2.2 Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- [x] 2.4 ADR-008 keeps the F2 wording: `grep -q "The workflows run only in GitHub Actions, never locally." docs/ADR/ADR-008-release-packaging-and-semver.md`

#### Manual

- [ ] 2.3 The ADR prerequisites match what the owner's TrueNAS runners actually provide

### Phase 3: Prove it on a real runner

#### Automated

- [x] 3.1 Runners are online with the labels: `gh api repos/xycu/agent-smith/actions/runners --jq '.runners[] | {name,status,labels:[.labels[].name]}'`
- [ ] 3.5 Fork approval policy is all external contributors: `gh api repos/xycu/agent-smith/actions/permissions/fork-pr-contributor-approval --jq .approval_policy` prints `all_external_contributors`
- [ ] 3.6 ADR-020 records the passing reading: `grep -q "all_external_contributors" docs/ADR/ADR-020-ci-on-self-hosted-truenas-runners.md && ! grep -qE "no Progress row covers it|does not hold until the owner changes the setting" docs/ADR/ADR-020-ci-on-self-hosted-truenas-runners.md`

#### Manual

- [ ] 3.2 A pull request from this repository runs both CI jobs on the TrueNAS runner and both pass
- [ ] 3.3 A push to `main` after the merge runs the `test` job on the TrueNAS runner and it passes
- [ ] 3.4 If a fork pull request is available, its jobs run on a GitHub-hosted runner
