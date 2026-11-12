# Waves

The order of work for the open changes in this folder, as of 2026-11-12. There are 37 open changes (status `new`, no run yet), split into seven waves of four to six changes. Each wave is one batch: finish it, release, then start the next.

## How to use it

- Work on one wave at a time, in the order below. An earlier wave makes the later ones cheaper or safer.
- Inside a wave, run the changes in the listed order and one after another. Most changes of a wave edit the same files (`ci.yml`, `helpers.mjs`, both `SKILL.md` files, `state.mjs`), so parallel runs would conflict.
- A change marked "owner" needs a decision or an action from the owner before or during its run.
- When a change is archived, remove its row here. When a new change is added, put it into the wave whose files it touches.

## Before wave 1

Fourteen folders here belong to runs that already ended; they are not in a wave. Thirteen ended `done`: `agents-md-no-imports`, `archive-done-routercommit`, `array-prompt-override`, `at-or-above-helper`, `budget-halt-after-done`, `file-guard-dedup`, `init-goal-flag`, `init-needs-change-md`, `override-json-error-halt`, `pin-action-shas`, `pr-scripts-shared`, `review-verdict-labels`, `run-state-lock`. Read the open findings of the three with the verdict NEEDS ATTENTION (`pr-scripts-shared`, `review-verdict-labels`, `run-state-lock`), then archive all thirteen with `/10x-archive <id>`. `ci-self-hosted-truenas` halted on an owner setting and stays until its Progress row 2.3 is settled (see `ci-runner-non-root`).

## Wave 1: release and correctness

Goal: no release from a red commit, no shipped code hidden under `chore`, no policy value that fails open. These are the high-severity findings.

| # | Change | What it does | Notes |
| --- | --- | --- | --- |
| 1 | `coauthor-test-coarse-mtime` | Fixes the coauthor tests that fail on Linux CI from a coarse file clock | The flake that failed the CI run of the `v1.5.0` commit. Must land before 2, or it blocks releases. |
| 2 | `release-after-green-ci` | Starts the release workflow only after a CI run on `main` passed; cancels only pull request runs | High. |
| 3 | `step-commit-code-under-chore` | Stops implemented code from landing in `chore` step commits, so a run branch can open a release PR | High. |
| 4 | `policy-limits-fail-open` | Validates policy limits, ladder and tiers at load | High. |
| 5 | `ci-runner-non-root` | Runs the CI jobs as a non-root user, as ADR-020 requires | Owner: runner setup on the NAS hosts. Edits `ci.yml` after 2. |

## Wave 2: context cost, docs and manifest

Goal: cut what every session and every step subagent loads, and make the documents agree with the code. Every later run gets cheaper.

| # | Change | What it does | Notes |
| --- | --- | --- | --- |
| 1 | `agents-md-duplicate-adr019` | Removes the repeated ADR-019 sentence from `AGENTS.md` | Covered by 2; run first or close as part of it. |
| 2 | `agents-md-slim` | Reduces `AGENTS.md` from 32 KB to rules and pointers; moves the test and ADR catalogs to index files | Several tests pin `AGENTS.md` text. |
| 3 | `docs-drift-fixes` | Fixes seven places where README, REFERENCE, the ADRs and the manifests disagree with the code | |
| 4 | `marketplace-entry-version` | Drops the duplicate `version` from the marketplace plugin entry | Touches `tools/version-check.mjs`, as 3 does. |
| 5 | `skills-disable-model-invocation` | Decides whether the model may start a pipeline run on its own | Owner decision. |

## Wave 3: test and CI hardening

Goal: a suite that is faster, cannot write outside its scratch folders, cannot hang a runner and does not hide skipped checks. Later waves rely on it.

| # | Change | What it does | Notes |
| --- | --- | --- | --- |
| 1 | `tests-strip-git-env` | Drops inherited `GIT_` variables in the test helpers | |
| 2 | `ci-job-and-spawn-timeouts` | Adds job timeouts to CI and a spawn timeout to the test helpers | |
| 3 | `ci-scratch-in-runner-temp` | Puts the scratch folders of a CI run into the runner temp directory | |
| 4 | `ci-fail-on-unexpected-skips` | Fails CI when the OpenSpec contract tests or the git tests skip | Owner: whether CI installs a pinned OpenSpec CLI. |
| 5 | `budget-test-file-split` | Splits the test file that takes 97% of the suite wall time | |
| 6 | `coverage-and-failed-undo-test` | Prints coverage in CI and tests the halt text of a rollback that was not undone | |

## Wave 4: router state and readers

Goal: run state that survives a crash, and readers that neither crash nor miscount on unusual input.

| # | Change | What it does | Notes |
| --- | --- | --- | --- |
| 1 | `attach-result-persist-first` | Persists the step result in `run.jsonl` before `last-result.json` is deleted | |
| 2 | `run-state-atomic-writes` | Writes `run.jsonl` and `meta.json` atomically; stops dropping unreadable log lines | Same write path as 1. |
| 3 | `change-id-length-cap` | Refuses a change id longer than 100 characters at `init` | |
| 4 | `plan-crlf-line-endings` | Parses a `plan.md` with CRLF line endings | |
| 5 | `compare-failed-attempts-neutral` | Counts failed attempts in `compare` with the router's `isFailure` rule | |
| 6 | `shared-churn-excludes` | Shares one fallback for the churn exclude globs | |

## Wave 5: orchestrator skill fixes

Goal: the skill text matches the tools and flags that exist. Every change here edits both `SKILL.md` files.

| # | Change | What it does | Notes |
| --- | --- | --- | --- |
| 1 | `agent-call-parameters` | Makes the step Agent call match the Agent tool and gives it a fixed description | |
| 2 | `skill-rigor-flag` | Parses `--rigor` in both skills, as the README offers it | |
| 3 | `skill-dir-variable` | Uses the documented skill directory variable for the script paths | |
| 4 | `router-bash-timeout` | Runs router and `open-pr.mjs` calls with a Bash timeout above the git timeouts | |
| 5 | `pr-comment-flag-in-meta` | Stores the `--pr-comment` request in `meta.json` instead of a session task | |
| 6 | `finished-changes-left-open` | Reports a stale `change.md` status at `done` and names the ways to close the change | The housekeeping part is "Before wave 1". |

## Wave 6: isolation and skill structure

Goal: move setup out of prose, enforce what is only asked for today, then shrink the skill. The larger refactors, after the small fixes of wave 5.

| # | Change | What it does | Notes |
| --- | --- | --- | --- |
| 1 | `worktree-setup-script` | Moves run isolation setup from skill prose into a script | |
| 2 | `stale-main-change-copy` | Removes the main-checkout copy of a change folder once the run branch holds it | Builds on 1. |
| 3 | `nested-subagent-hard-stop` | Enforces the nested-subagent ban outside the prompt | |
| 4 | `skill-md-context-diet` | Cuts the skill text that the orchestrator never acts on | Last skill edit; after everything above. Tests pin skill text. |
| 5 | `step-prompt-by-file` | Hands the step prompt to the subagent by file, behind a policy key | Decide the default from `compare` data. |

## Wave 7: guards and the ladder

Goal: close the gaps in the repository's own guards. These are independent of the other waves and may move earlier.

| # | Change | What it does | Notes |
| --- | --- | --- | --- |
| 1 | `delete-guard-gaps` | Closes the gaps of the recursive delete guard | |
| 2 | `commit-lint-merge-prefix` | Stops commit-lint from accepting any subject that starts with "Merge" | |
| 3 | `workflow-pins-local-actions` | Checks local actions outside `.github/` in the pin guard | Latent; no such action exists today. |
| 4 | `ladder-fable-rung` | Lets the ladder reach the `fable` model without renumbering tiers | Owner decision: cost. |
