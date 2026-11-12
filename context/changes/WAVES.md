# Waves

The order of work for the 31 open changes of waves 2 to 7 in this folder (status `new`, no run yet), as of 2026-11-12. Wave 1 is merged.

A wave is a set of changes that can run **at the same time**, each in its own run worktree. No two changes of one wave edit the same code, workflow, policy or skill region. The waves themselves run one after another: a wave starts when every pull request of the wave before it is merged into `main`.

## Rules

- Start every run of a wave from the same `main`, after the previous wave is merged.
- A change stays inside the files its row names under "Owns in this wave". If its plan needs a file that another change of the same wave owns, move the change to a later wave before it runs.
- Shared text files are the one exception: `AGENTS.md`, `README.md`, `docs/REFERENCE.md` and the two skill content tests (`skill-loop.test.mjs`, `openspec-skill.test.mjs`). Several changes of a wave add lines to them, in different places. Merge the pull requests of a wave one by one. If a later one then conflicts in such a file, resolve it on its branch with a merge of `main` and a new commit. Never force-push.
- "Owner" marks a change that needs a decision or an action from the owner before or during its run.
- Edit this file on `main`, once per wave, after the wave is merged. Do not edit it from a run branch, or every run of a wave conflicts here.

## How the waves were cut

Each change was mapped to the files and regions its fix names. Changes that share a region went into different waves, in dependency order:

| Lane | Changes | Rule |
| --- | --- | --- |
| `.github/workflows/ci.yml` and `tools/test/ci-runner.test.mjs` | 6 | One per wave (waves 1 to 6). |
| `skills/10x-pipeline/test/helpers.mjs` | 3 | One per wave. |
| Both `SKILL.md` files | 12 | At most two per wave, in regions that do not touch: frontmatter, Start steps, script path lines, Loop step 2, anti-stall rules, the `done`/`archive`/`halt` branches, PR comment section. The rewrite of the whole file is alone in the last wave. |
| `state.mjs` and `steps.mjs` | 5 | One per wave. |
| `route.mjs` and `flow.mjs` | 10 | Different functions inside one wave; `init` is edited by one change per wave. |
| `policy.json` | 4 | Different blocks inside one wave. |
| Version and manifest files (`version-check.mjs`, `marketplace.json`, `plugin.json`) | 3 | One per wave. |
| All of `AGENTS.md` | 1 | `agents-md-slim` shares its wave only with changes that leave `AGENTS.md` alone. |

The map comes from the text of each `change.md` and the current layout of the files, not from finished diffs. Check it again when a plan is written.

## Wave 1: release and correctness (6) — merged

`coauthor-test-coarse-mtime`, `release-after-green-ci`, `step-commit-code-under-chore`, `policy-limits-fail-open`, `agents-md-duplicate-adr019` and `skill-rigor-flag` are in `main` (2026-11-12), and their open findings were closed in a follow-up pull request. `agents-md-duplicate-adr019` landed before `agents-md-slim`, as wave 2 needs.

## Archived after wave 1

Eighteen folders were archived with `/10x-archive`: the thirteen runs that ended `done` before the waves (`agents-md-no-imports`, `archive-done-routercommit`, `array-prompt-override`, `at-or-above-helper`, `budget-halt-after-done`, `file-guard-dedup`, `init-goal-flag`, `init-needs-change-md`, `override-json-error-halt`, `pin-action-shas`, `pr-scripts-shared`, `review-verdict-labels`, `run-state-lock`) and five of the six changes of wave 1 (`coauthor-test-coarse-mtime`, `step-commit-code-under-chore`, `policy-limits-fail-open`, `agents-md-duplicate-adr019`, `skill-rigor-flag`).

Two folders stay in this directory and are not in a wave:

- `release-after-green-ci` (wave 1, merged): Progress rows 3.4 to 3.6 need a real CI failure on `main` and a rerun, and its run never reached the implementation review (steps 5 and 6 failed), so `reviews/impl-review.md` is missing. Run `/10x-impl-review`, settle the rows, then archive it.
- `ci-self-hosted-truenas`: halted on an owner setting; stays until its Progress row 2.3 is settled (see `ci-runner-non-root`).

Two Manual rows of archived changes are still open: `skill-rigor-flag` 2.5 (a live `--rigor thorough` run) and `pin-action-shas` 1.5 (CI and release-please have resolved the pinned actions since, so it can be ticked with `gh run list`).

## Wave 2: context cost (6)

`agents-md-slim` rewrites `AGENTS.md`, so every other change of this wave leaves that file alone. Each one edits existing functions and tests and adds no file that `AGENTS.md` lists.

| Change | Owns in this wave | Notes |
| --- | --- | --- |
| `agents-md-slim` | All of `AGENTS.md`, new `skills/10x-pipeline/test/README.md` and `docs/ADR/README.md` | Several tests pin `AGENTS.md` text. |
| `ci-runner-non-root` | `ci.yml` (first step of the `test` job) | Owner: runner setup on the NAS hosts. |
| `skill-dir-variable` | Skills: the three script path lines and Tuning | Before `worktree-setup-script` (wave 4), which adds a script path. |
| `finished-changes-left-open` | The `done` output of the router; skills: the `done` branch | The housekeeping part is "Before wave 1". |
| `attach-result-persist-first` | `attachResult` in `flow.mjs` | |
| `plan-crlf-line-endings` | `readPlan` in `state.mjs`, `planPaths` and `phaseFiles` | |

## Wave 3: flags, versions and suite speed (6)

| Change | Owns in this wave | Notes |
| --- | --- | --- |
| `ci-job-and-spawn-timeouts` | `ci.yml` (job keys), `run` and `git` in `helpers.mjs` | |
| `pr-comment-flag-in-meta` | `init` flags and the `done`, `archive` and `halt` outputs in `route.mjs`; skills: `allowed-tools`, Start steps 4 and 5, the TaskList paragraphs, the PR comment section; `.claude/settings.json` | The largest skill edit of the wave. |
| `router-bash-timeout` | Skills: one new line next to the script path lines | Keep it out of the paragraphs the row above rewrites. |
| `marketplace-entry-version` | `marketplace.json`, `release-please-config.json`, `tools/version-check.mjs` | |
| `budget-test-file-split` | `budget-executors.test.mjs` and a new helper module | Cuts the suite wall time for every later run. |
| `shared-churn-excludes` | Churn config in `state.mjs`, `evidenceExcludes` in `steps.mjs` | |

## Wave 4: run state and isolation setup (6)

| Change | Owns in this wave | Notes |
| --- | --- | --- |
| `ci-scratch-in-runner-temp` | `ci.yml` (environment of the test step) | |
| `worktree-setup-script` | New `scripts/prepare-run.mjs`; skills: Start step 3 | |
| `agent-call-parameters` | Skills: Loop step 2, anti-stall rules 1 and 6, the late-usage paragraph | After `pr-comment-flag-in-meta` (wave 3), which rewrites the branches around that paragraph. |
| `run-state-atomic-writes` | The write and `readLog` paths of `state.mjs` and their call sites in `init`, `next` and `usage` | |
| `tests-strip-git-env` | `run` and `gitEnv` in `helpers.mjs`, four test files with their own environment | |
| `compare-failed-attempts-neutral` | `compare` in `route.mjs` | |

## Wave 5: owner decisions and guards (5)

| Change | Owns in this wave | Notes |
| --- | --- | --- |
| `ci-fail-on-unexpected-skips` | `ci.yml` (new step), `gitAvailable` in `helpers.mjs`, `openspec-contract.test.mjs` | Owner: whether CI installs a pinned OpenSpec CLI. |
| `stale-main-change-copy` | The `init` halt in `route.mjs`, the cleanup in `prepare-run.mjs`; skills: the stale-copy paragraph of the final message | Needs `worktree-setup-script` (wave 4). |
| `skills-disable-model-invocation` | Skills: frontmatter `description` and the new key; the manifest descriptions | Owner decision. |
| `ladder-fable-rung` | `ladder` and `maxTier` in `policy.json`, `ladder.test.mjs` | Owner decision: cost. |
| `delete-guard-gaps` | `no-recursive-delete.test.mjs` | |

## Wave 6: prompts, ids and document drift (5)

| Change | Owns in this wave | Notes |
| --- | --- | --- |
| `coverage-and-failed-undo-test` | `ci.yml` (test command), `rollback.test.mjs` | |
| `step-prompt-by-file` | The prompt output in `flow.mjs`, a new key in the `prompts` block of `policy.json`; skills: Loop step 2 | After `agent-call-parameters` (wave 4). Decide the default from `compare` data. |
| `change-id-length-cap` | The id check of `init`; skills: the 100-character parenthesis of the PR comment section | |
| `docs-drift-fixes` | `README.md`, `docs/REFERENCE.md`, six ADRs, `prompts/README.md`, the manifest descriptions, `tools/version-check.mjs` | After `pr-comment-flag-in-meta` (wave 3), which removes its item 2, and after the description change of wave 5. |
| `nested-subagent-hard-stop` | `.claude/settings.json`, ADR-018, optionally `agents/step.md` and the `agents` block of `policy.json` | |

## Wave 7: skill rewrite (3)

| Change | Owns in this wave | Notes |
| --- | --- | --- |
| `skill-md-context-diet` | Both `SKILL.md` files, whole | Alone on the skills, after every other skill change. Tests pin skill text. |
| `commit-lint-merge-prefix` | `tools/commit-lint.mjs` | Independent; may join any earlier wave if it leaves `ci.yml` alone there. |
| `workflow-pins-local-actions` | `tools/workflow-pins.mjs` | Independent; may join any earlier wave. Latent: no local action exists today. |
