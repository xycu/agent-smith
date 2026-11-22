# ADR-020: Run CI on self-hosted TrueNAS runners

- **Status:** Accepted, amended (Amendments 1 through 3)
- **Date:** 2026-11-11
- **Deciders:** the repository owner (goal of change `ci-self-hosted-truenas`)
- **Origin:** change `ci-self-hosted-truenas` (`context/changes/ci-self-hosted-truenas/plan.md`). It touches the CI job of ADR-008; no earlier decision is superseded.

## Context

- `.github/workflows/ci.yml` has two jobs, `test` and `commits`, both on `ubuntu-latest`. The owner runs self-hosted runner instances on TrueNAS and wants CI on them.
- The repository `xycu/agent-smith` is public. GitHub warns against self-hosted runners for public repositories: a `pull_request` from a fork runs the workflow code of that fork on the runner.
- The `runs-on` value of a fork pull request comes from the workflow file of the fork's own merge ref, so its author can edit it. An expression in `ci.yml` is therefore not a boundary.
- The test suite builds real git worktrees, a bare remote and logging `git` shims, so the runner needs `git` and a writable temp dir. The repository has no npm dependencies (ADR-006).
- `release.yml` holds a `GITHUB_TOKEN` with `contents: write` and is outside the goal.

## Decision

### Runner choice (D1)

**GIVEN** `ci.yml` runs for a push to `main` or for a pull request from this repository **WHEN** a job starts **THEN** it **MUST** run on a runner with the labels `self-hosted`, `linux`, `truenas`.

**GIVEN** `ci.yml` runs for a pull request whose head repository is not this repository **WHEN** a job starts **THEN** it **MUST** run on `ubuntu-latest`.

Each job carries the same `runs-on` expression: a ternary on `github.event_name` and `github.event.pull_request.head.repo.full_name`. The `github.event_name == 'pull_request'` part keeps a push on the NAS: a push event has no head repository name, so without it the `!=` check would send every push to `ubuntu-latest`. `actions/setup-node` stays, so the Node 24 requirement is declared in the workflow. Job names, steps, concurrency and permissions are unchanged, and no action is added, so the pin guard of ADR-008 stays green. `tools/test/ci-runner.test.mjs` compares each `runs-on` line with the exact expression and fails when `release.yml` names `self-hosted`.

### Fork pull requests (D2)

**GIVEN** a pull request comes from a fork **WHEN** the owner has not approved its workflow run **THEN** GitHub **MUST** hold the run, because the repository setting Settings -> Actions -> General -> "Fork pull request workflows from outside collaborators" is "Require approval for all external contributors".

This setting is the boundary that keeps fork code off the NAS. The `ubuntu-latest` fallback is defence in depth only: it covers an honest fork pull request and nothing more. The owner reads the workflow diff of a fork pull request before approving, because an approved run that edited `runs-on` reaches the NAS.

### Release workflow (D3)

`release.yml` stays on `ubuntu-latest`. It holds a write token, and a persistent runner should not.

### Runner prerequisites (D4)

The repository holds no runner setup. A runner for this repository needs:

- Linux x64 or arm64, a runner version that runs Node 24 actions (`actions/checkout` v5 documents v2.327.1 or newer), registered to `xycu/agent-smith` with the labels `self-hosted`, `linux`, `truenas`.
- Node 24, reachable through `actions/setup-node` (outbound HTTPS to github.com and the Node distribution host, or a populated tool cache) or preinstalled.
- `git` 2.x, and a temp dir the runner user can write.
- A non-root service user. The first step of the `test` job in `ci.yml` checks it and fails at uid 0 (Amendment 1).
- A clean workspace for every job: register the runner with `--ephemeral`, or run each job in a fresh container, so no file, process or credential carries over from one job to the next. The runner host has no route to the rest of the LAN that CI does not need.
- No secrets or credentials beyond the runner token, because the repository is public.

## Assumptions

- The owner confirmed the operational TrueNAS setup on 2026-11-15 (Progress row 2.3). Main CI run 43703539173 on that date recorded runner version 2.338.2, Node 24.22.3, Git 2.53.0, writable test scratch storage and the passing non-root guard. CI run 43134692634 ran as uid 0 on the first historical reading (Amendment 1).
- The fork approval setting is "Require approval for all external contributors". On 2026-11-15 the read-only command `gh api repos/xycu/agent-smith/actions/permissions/fork-pr-contributor-approval --jq .approval_policy` returned `all_external_contributors`. Progress row 3.5 records this check. The 2026-11-11 reading was `first_time_contributors`.

## Consequences

- CI no longer spends GitHub-hosted minutes for same-repository events. A fork pull request does, and it is slower or unavailable only if hosted minutes run out.
- The runner is persistent. A same-repository branch from anyone with write access runs code there, and workspace and temp state carry over between jobs. Anyone with write access is trusted with the NAS. The `agent-smith/<id>` branches that `open-pr.mjs` pushes (ADR-017) are same-repository pull requests too, so code that a model wrote runs there with no approval step. That is why D4 asks for a clean workspace per job.
- A single runner serialises jobs; `concurrency` with `cancel-in-progress` already limits waste. A second instance helps if `test` and `commits` queue.
- Runners offline: jobs queue until one returns. Rollback is to set `runs-on` back to `ubuntu-latest`.
- The first pull request on the runners is the proof; the workflow cannot run locally. That run (pull request 123, 2026-11-11) failed 9 of 1062 tests on the runner host, and the next run failed 12, all but two in the OpenSpec step tests, while the same suite passes on a laptop and on hosted runners. The cause was in the tests, not the host: they wrote a step's output file within a few ms of the step's `startedAt`, and Linux stamps files from a coarse clock, so the router saw the file as older than the step. `test/openspec-helpers.mjs` now stamps those files a minute ahead.

## Alternatives considered

- **A second workflow for fork pull requests.** Rejected: one workflow with a per-event `runs-on` is smaller, and a second file gives no extra protection, since the fork edits its own copy.
- **Keep `ubuntu-latest` only.** Rejected: it does not meet the goal of running on the owner's hardware.
- **Move `release.yml` too.** Rejected: its write token should not live on a persistent runner.
- **Treat the `runs-on` fallback as the boundary.** Rejected: a fork edits it. Only the approval setting holds the run.

## Amendment 1: the test job refuses to run as root (change ci-runner-non-root)

- **Finding:** CI run 43134692634 on runner `truenas-agent-smith-1` ran the jobs as uid 0, so prerequisite D4 (a non-root service user) was not met. Two `removeTree` tests in `no-recursive-delete.test.mjs` skip when `process.getuid() === 0`, so they did not run in CI.
- **Decision:** the first step of job `test` in `ci.yml`, `Refuse to run as root (ADR-020)`, runs `test "$(id -u)" -ne 0` and fails the job with an `::error::` line at uid 0, before checkout and before any model-written code runs. A root runner fails closed. The hosted fallback (`ubuntu-latest`, fork pull requests) runs as the non-root user `runner` and passes. `tools/test/ci-runner.test.mjs` pins the step as first in the job and proves that its command fails for uid 0 and passes for another uid.
- **Owner action:** run the runner service as a non-root user, or run each job in a fresh non-root container. The work dataset path (`/mnt/main/lake/github/agent-smith-<n>/`) must be writable by that user. Whether uid 0 came from the host service or from a container is unknown. Do this before merging, because after the merge a root runner fails every `test` run and `release.yml` waits for a green `main` run.
- **Not claimed:** this amendment does not say the runners are fixed. The proof is a CI run on the TrueNAS runner that passes the uid step (Progress rows 2.2 to 2.4 of change `ci-runner-non-root`).


## Amendment 2 — acceptance verified on 2026-11-15

The owner confirmed that the TrueNAS installation works. Read-only API evidence reports six online labelled runners and the required fork approval policy. Same-repository PR CI run 43701664098 passed both jobs on TrueNAS. Main CI run 43703539173 passed the non-root guard and complete test suite on TrueNAS. Its logs show runner version 2.338.2, Node 24.22.3, Git 2.53.0 and the configured writable scratch directory.

On 2026-11-15, none of the 177 pull requests examined came from a fork. All eight automated cases evaluating the two runner-selection expressions at that revision passed, including fork fallback to `ubuntu-latest`. The conditional live-fork check is recorded as not applicable to the available PRs. Historical findings remain in Amendment 1 and the original implementation review. [TrueNAS runner and fork-fallback evidence](../../context/archive/2026-11-11-ci-self-hosted-truenas/evidence/acceptance-2026-11-15.md)

## Amendment 3 — OpenSpec install and runner trust boundary

All six CI test shards install OpenSpec 2.0.0 in a fresh prefix with `--ignore-scripts`, which suppresses npm lifecycle scripts during installation. The dependency tree remains unlocked, so transitive versions can change between runs. Running the CLI for the version check and contract fixtures still executes package and dependency code. [CI install step](../../.github/workflows/ci.yml#L52)

Same-repository pull requests run CI and PR title jobs on TrueNAS. Pushes to `main` run the six test shards there. Fork pull requests select `ubuntu-latest` under the repository's workflow, and release jobs run on `ubuntu-latest`. A fork can change its proposed workflow, including runner selection, so the owner reviews workflow changes before approving an external run. [CI](../../.github/workflows/ci.yml) · [PR title](../../.github/workflows/pr-title.yml) · [Release](../../.github/workflows/release.yml)

The fork approval gate is **Settings → Actions → General → Fork pull request workflows from outside collaborators**. The required value is **Require approval for all external contributors**, which holds their fork workflow runs for review before execution. The read-only GitHub API check recorded on 2026-11-15 returned `all_external_contributors`, which matches the required value. The earlier reading of `first_time_contributors` on 2026-11-11 fell short of this requirement. On 2026-11-22 the owner stated that the setting "Require approval for all external contributors" is still true today. This is the owner's statement, relayed through the maintaining session, and no API reading was taken on that date. [Archived acceptance, rows 3.5 and 3.6](../../context/archive/2026-11-11-ci-self-hosted-truenas/evidence/acceptance-2026-11-15.md#rows-35-and-36)

The owner accepted on 2026-11-21 that people, tokens and automation with write access to this repository can cause code to run on TrueNAS via a same-repository pull request without fork approval. This includes branches published by Agent Smith. [Owner decision and accepted residual risk](../../context/changes/ci-self-hosted-runner-exposure/frame.md#accepted-residual-risk)

D4 requires limiting LAN routes to what CI needs. On 2026-11-22 the owner stated that the runner can reach nothing else on the home network: no other hosts or services. This is the owner's statement, relayed through the maintaining session; no network test in this repository supports it. Manual acceptance also requires green published PR CI across all six shards, with OpenSpec 2.0.0 verified and all five real contract cases passing without skips. [Manual acceptance checklist](../../context/changes/ci-self-hosted-runner-exposure/plan.md#manual)
