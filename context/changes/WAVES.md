# Waves

Work order and status as of 2026-11-15. Waves 1–7 and the stale-result and step-guard follow-ups are merged into `main`. Waves 2–7 and both completed follow-ups are archived. This folder holds three active changes, including one parked draft follow-up and two older merged changes awaiting acceptance or archival. The original seven-wave sequence is complete. GitHub PR merge state and change frontmatter were checked after release v1.11.2 against `main` at `8dcb067` (release PR #191).

A wave is a set of changes that can run **at the same time**, each in its own run worktree. No two changes of one wave edit the same code, workflow, policy or skill region. The waves themselves run one after another: a wave starts when every pull request of the wave before it is merged into `main`.

## Rules

- Start every run of a wave from the same `main`, after the previous wave is merged.
- A change stays inside the files its row names under "Owns in this wave". If its plan needs a file that another change of the same wave owns, move the change to a later wave before it runs.
- Shared text files are the one exception: `AGENTS.md`, `README.md`, `docs/REFERENCE.md` and the two skill content tests (`skill-loop.test.mjs`, `openspec-skill.test.mjs`). Several changes of a wave add lines to them, in different places. Merge the pull requests of a wave one by one. If a later one then conflicts in such a file, resolve it on its branch with a merge of `main` and a new commit. Never force-push.
- "Owner" marks a change that needs a decision or an action from the owner before or during its run.
- Update this file in one maintenance PR after each wave merges. Individual parallel runs leave it alone.

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

The original map came from each `change.md` and the layout before implementation. Recheck file ownership before planning the next wave. PR #155 moved OpenSpec policy, prompts, scripts and tests to `skills/openspec-pipeline/`, and moved always-true prompt rules into chain-local `rules/` files. PR #157 integrates provider dispatch with that structure. Ownership rows below identify behavior regions and must be resolved against those current paths.

## Wave 1: release and correctness (6) — merged

`coauthor-test-coarse-mtime`, `release-after-green-ci`, `step-commit-code-under-chore`, `policy-limits-fail-open`, `agents-md-duplicate-adr019` and `skill-rigor-flag` are in `main` (2026-11-12), and their open findings were closed in a follow-up pull request. `agents-md-duplicate-adr019` landed before `agents-md-slim`, as wave 2 needs.

## Archived after wave 1

Eighteen folders were archived with `/10x-archive`: the thirteen runs that ended `done` before the waves (`agents-md-no-imports`, `archive-done-routercommit`, `array-prompt-override`, `at-or-above-helper`, `budget-halt-after-done`, `file-guard-dedup`, `init-goal-flag`, `init-needs-change-md`, `override-json-error-halt`, `pin-action-shas`, `pr-scripts-shared`, `review-verdict-labels`, `run-state-lock`) and five of the six changes of wave 1 (`coauthor-test-coarse-mtime`, `step-commit-code-under-chore`, `policy-limits-fail-open`, `agents-md-duplicate-adr019`, `skill-rigor-flag`).

Two older merged changes remain active outside the remaining waves:

- `release-after-green-ci` (wave 1, PRs #128 and #137 merged, `impl_reviewed`): implementation review exists. Manual rows 3.4–3.6 remain pending for failed CI, rerun and release-concurrency acceptance. Settle or explicitly defer those rows before archive.
- `ci-self-hosted-truenas` (PR #123 merged, `impl_reviewed`): six Progress rows remain pending, covering runner prerequisites (2.3), fork approval policy and ADR evidence (3.5–3.6), same-repository PR/main CI (3.2–3.3), and optional fork CI (3.4). The non-root guard has since merged through wave 2.

Known pending Manual rows in the archived changes include: `skill-rigor-flag` 2.5 (a live `--rigor thorough` run) and `pin-action-shas` 1.5 (CI and release-please have resolved the pinned actions since, so it can be ticked with `gh run list`).

## Wave 2: context cost (6) — merged and archived

All six implementations merged in PRs #138–143. PR #154 archived their change folders on 2026-11-13. The ownership table below records the completed wave.

| Change | Owns in this wave | Notes |
| --- | --- | --- |
| `agents-md-slim` | All of `AGENTS.md`, new `skills/10x-pipeline/test/README.md` and `docs/ADR/README.md` | Several tests pin `AGENTS.md` text. |
| `ci-runner-non-root` | `ci.yml` (first step of the `test` job) | Owner: runner setup on the NAS hosts. |
| `skill-dir-variable` | Skills: the three script path lines and Tuning | Before `worktree-setup-script` (wave 4), which adds a script path. |
| `finished-changes-left-open` | The `done` output of the router; skills: the `done` branch | The housekeeping part is "Before wave 1". |
| `attach-result-persist-first` | `attachResult` in `flow.mjs` | |
| `plan-crlf-line-endings` | `readPlan` in `state.mjs`, `planPaths` and `phaseFiles` | |

## Wave 3: flags, versions and suite speed (6) — merged and archived

All six implementations merged on 2026-11-13 in PRs #147–152. Their folders were archived on 2026-11-14 under `context/archive/2026-11-12-<change-id>/`, with `status: archived`. Original Progress checkboxes and SHA suffixes were preserved.

| Change | Merged PR | Remaining Progress |
| --- | --- | --- |
| `ci-job-and-spawn-timeouts` | #151 | Manual 2.7, green PR CI and both job limits |
| `pr-comment-flag-in-meta` | #152 | None |
| `router-bash-timeout` | #147 | None |
| `marketplace-entry-version` | #149 | Manual 2.5, next release PR's version-file diff |
| `budget-test-file-split` | #150 | Manual 2.7, CI suite duration under 90 s with comparison recorded |
| `shared-churn-excludes` | #148 | None |

These rows report the checkboxes at archive time. The three pending Manual rows remain recorded in their archived plans. Any further acceptance work belongs in a new change referencing the archive.

| Change | Owns in this wave | Notes |
| --- | --- | --- |
| `ci-job-and-spawn-timeouts` | `ci.yml` (job keys), `run` and `git` in `helpers.mjs` | |
| `pr-comment-flag-in-meta` | `init` flags and the `done`, `archive` and `halt` outputs in `route.mjs`; skills: `allowed-tools`, Start steps 4 and 5, the TaskList paragraphs, the PR comment section; `.claude/settings.json` | The largest skill edit of the wave. |
| `router-bash-timeout` | Skills: one new line next to the script path lines | Keep it out of the paragraphs the row above rewrites. |
| `marketplace-entry-version` | `marketplace.json`, `release-please-config.json`, `tools/version-check.mjs` | |
| `budget-test-file-split` | `budget-executors.test.mjs` and a new helper module | Cuts the suite wall time for every later run. |
| `shared-churn-excludes` | Churn config in `state.mjs`, `evidenceExcludes` in `steps.mjs` | |

## Wave 4: run state and isolation setup (6) — merged and archived

All six implementations merged on 2026-11-14 in the order #164, #162, #161, #160, #165 and #163. Their folders were archived on 2026-11-14 under `context/archive/2026-11-12-<change-id>/`, with `status: archived`. Original Progress checkboxes and SHA suffixes were preserved, including 38 suffixes referencing original branch commits and three completed `agent-call-parameters` rows (1.1–1.3) without suffixes.

The pending Manual rows below remain recorded in their archived plans. Any further acceptance work belongs in a new change referencing the archive.

| Change | Merged PR | Owns in this wave | Notes |
| --- | --- | --- | --- |
| `ci-scratch-in-runner-temp` | [#164](https://github.com/xycu/agent-smith/pull/164) | `ci.yml` (environment of the test step) | Manual 1.5–1.6 still require live TrueNAS scratch-path and cancellation-cleanup observations. |
| `worktree-setup-script` | [#163](https://github.com/xycu/agent-smith/pull/163) | New `scripts/prepare-run.mjs`; skills: Start step 3 | |
| `agent-call-parameters` | [#161](https://github.com/xycu/agent-smith/pull/161) | Skills: Loop step 2, anti-stall rules 1 and 6, the late-usage paragraph | After `pr-comment-flag-in-meta` (wave 3), which rewrites the branches around that paragraph. Includes the deterministic shutdown-test repair. Manual 1.6 still requires live Claude Code acceptance. |
| `run-state-atomic-writes` | [#165](https://github.com/xycu/agent-smith/pull/165) | The write and `readLog` paths of `state.mjs` and their call sites in `init`, `next` and `usage` | |
| `tests-strip-git-env` | [#162](https://github.com/xycu/agent-smith/pull/162) | `run` and `gitEnv` in `helpers.mjs`, four test files with their own environment | |
| `compare-failed-attempts-neutral` | [#160](https://github.com/xycu/agent-smith/pull/160) | `compare` in `route.mjs` | |

## Wave 5: owner decisions and guards (5) — merged and archived

All five implementations merged on 2026-11-14 in the order #169, #170, #171, #172 and #173. Their folders were archived on 2026-11-14 under `context/archive/2026-11-12-<change-id>/`, with `status: archived`. The 36 completed Progress rows retain their original SHA suffixes, referencing nine original branch commits. Branch refs preserve those commits after worktree cleanup.

Four Manual rows remain unticked in the archived plans. Three require live Claude host acceptance. CI row 2.5 has passing TrueNAS evidence from PR #173. Any further acceptance work belongs in a new change referencing the archive.

| Change | Merged PR | Owns in this wave | Remaining Progress and decisions |
| --- | --- | --- | --- |
| `ci-fail-on-unexpected-skips` | [#173](https://github.com/xycu/agent-smith/pull/173) | `ci.yml` (pinned CLI step), CI availability probes and OpenSpec contract tests | Owner approved OpenSpec 1.16.1 as a CI-only tool. Manual 2.5 stays unticked, with [passing TrueNAS evidence](https://github.com/xycu/agent-smith/actions/runs/43618967283) covering the CLI, five contract fixtures, permission checks and three expected skips. |
| `stale-main-change-copy` | [#172](https://github.com/xycu/agent-smith/pull/172) | The `init` halt in `route.mjs`, cleanup in `prepare-run.mjs`, and skill lifecycle instructions | Manual 3.5 requires live post-init cleanup ordering and retained-path reporting for both chains. |
| `skills-disable-model-invocation` | [#169](https://github.com/xycu/agent-smith/pull/169) | Skill frontmatter, descriptions, manifests and invocation tests | Owner chose explicit slash commands. Manual 1.6 requires fresh Claude Code invocation transcripts. |
| `ladder-fable-rung` | [#171](https://github.com/xycu/agent-smith/pull/171) | Override documentation in `README.md` and `docs/REFERENCE.md`, plus `ladder.test.mjs` | Owner chose a documented opt-in fable override that appends high/xhigh rungs after the existing ladder. Manual 2.4 requires live fable Agent acceptance and older-host default behavior. |
| `delete-guard-gaps` | [#170](https://github.com/xycu/agent-smith/pull/170) | `no-recursive-delete.test.mjs` | None. Both implementation-review warnings were fixed. |

Combined main CI passed 1,476 tests with zero failures and three expected skips before release PR #174. [CI evidence](https://github.com/xycu/agent-smith/actions/runs/43619562032)

## Wave 6: prompts, ids and document drift (5) — merged and archived

All five implementations merged on 2026-11-14 in the order #176, #177, #178, #180 and #179. Release PR #181 published v1.11.0 after green combined main CI and green release-commit CI. Their folders were archived on 2026-11-14 under `context/archive/2026-11-12-<change-id>/`, with `status: archived`. The 44 completed Progress rows retain their original SHA suffixes, referencing 12 original implementation commits. Retained Git refs preserve those commits after worktree cleanup. [Release](https://github.com/xycu/agent-smith/releases/tag/v1.11.0)

Four Manual rows remain unticked in the archived plans. Coverage row 2.6 now has passing TrueNAS CI evidence. The other three rows require live host acceptance or matched comparison runs. Any further acceptance work belongs in a new change referencing the archive.

| Change | Merged PR | Owns in this wave | Remaining Progress and decisions |
| --- | --- | --- | --- |
| `coverage-and-failed-undo-test` | [#178](https://github.com/xycu/agent-smith/pull/178) | `ci.yml` test command and `rollback.test.mjs` | Manual 2.6 stays unticked, with passing combined CI evidence covering the module coverage table, all four Linux failed-undo cases, expected skips and runner timing. Inline coverage was retained after 8.33% measured local overhead. |
| `step-prompt-by-file` | [#180](https://github.com/xycu/agent-smith/pull/180) | Prompt rendering and lifecycle in `flow.mjs`, `isolation.mjs`, `route.mjs`, `run-codex.mjs` and `state.mjs`, the `prompts.byFile` policy key and both skills' dispatch instructions | Manual 3.4 requires live Claude/OpenAI acceptance for both chains. Manual 3.5 requires five matched inline/file pairs with quality review and orchestrator telemetry. The opt-in ships with its default false. |
| `change-id-length-cap` | [#177](https://github.com/xycu/agent-smith/pull/177) | Init ID validation in `route.mjs` and `state.mjs`, both skills' PR-comment caveats and shared guidance | All Progress rows complete. Init accepts up to 100 characters, with both-chain boundaries and legacy-command compatibility tested. |
| `docs-drift-fixes` | [#179](https://github.com/xycu/agent-smith/pull/179) | `README.md`, `docs/REFERENCE.md`, six ADRs, `prompts/README.md` and the manifest description contract in `tools/version-check.mjs` | All Progress rows complete. Current documentation and historical amendments were reconciled, and description equality is enforced. |
| `nested-subagent-hard-stop` | [#176](https://github.com/xycu/agent-smith/pull/176) | `.claude/settings.json`, ADR-018, nesting documentation and contract tests | Manual 2.4 requires live Claude depth-1 acceptance. This repository sets `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH=1`, with optional adoption documented for plugin users. |

Combined main CI passed 1,520 tests with zero failures and three expected skips before release PR #181. The native coverage table reports the router modules, and all four failed-undo regressions passed. [CI evidence](https://github.com/xycu/agent-smith/actions/runs/43643146352)

## Wave 7: skill rewrite (3) — merged and archived

All three implementations merged on 2026-11-15 in the order #187, #183 and #188. Release PR #189 published v1.11.1 after green combined main CI and green release-commit CI. Their folders were archived on 2026-11-15 under `context/archive/2026-11-12-<change-id>/`, with `status: archived`. All 18 Progress rows remain complete. Sixteen SHA suffixes retain references to four original implementation commits, preserved by retained Git refs after worktree cleanup. The other two rows retain their judgment-evidence suffixes. [Release](https://github.com/xycu/agent-smith/releases/tag/v1.11.1)

| Change | Merged PR | Owns in this wave | Result and acceptance |
| --- | --- | --- | --- |
| `commit-lint-merge-prefix` | [#187](https://github.com/xycu/agent-smith/pull/187) | Range-CLI regression coverage in `tools/test/commit-lint.test.mjs` | The implementation was already folded into `squash-merge-pr-title-lint`. This change proves ordinary Merge-prefixed subjects fail through the CLI and records completion of the rescoped change. |
| `workflow-pins-local-actions` | [#183](https://github.com/xycu/agent-smith/pull/183) | `tools/workflow-pins.mjs`, its tests and the scoped `AGENTS.md` layout entry | Referenced local actions outside `.github/` are checked transitively. Canonical-file tracking handles cycles and aliases. Missing metadata, root escapes and unpinned remotes fail with source diagnostics. |
| `skill-md-context-diet` | [#188](https://github.com/xycu/agent-smith/pull/188) | Both `SKILL.md` files, routing-documentation ownership, reference guidance and content tests | The 10x skill is 25,867 bytes and the OpenSpec skill is 29,230 bytes. Shared late-usage and publication procedures retain the fixed Anti-stall contracts. Manual rows 1.4 and 2.6 were proved through written inventories and covering tests. Live paid-provider execution remains outside that proof. |

Combined main CI passed 1,548 tests out of 1,551 with zero failures and three expected skips. Its first attempt hit the existing fake-child cancellation timing test, and the second attempt passed. Release-commit CI then passed before publication. [Combined CI](https://github.com/xycu/agent-smith/actions/runs/43657049140) · [Release-commit CI](https://github.com/xycu/agent-smith/actions/runs/43658209686)

## Completed follow-ups (2) — merged and archived

Both implementations merged on 2026-11-15 in the order #184 and #185. Release PR #191 published v1.11.2 after green combined main CI and green release-commit CI. Both folders were archived on 2026-11-15 under `context/archive/2026-11-13-<change-id>/`, with `status: archived`. All 21 completed Progress rows retain their original SHA suffixes, referencing six original implementation commits. The retained refs `refs/archive/followups/stale-last-result-cleanup` and `refs/archive/followups/step-subagent-git-guard` preserve those commits after worktree and branch cleanup. [Release](https://github.com/xycu/agent-smith/releases/tag/v1.11.2)

| Change | Merged PR | Result and remaining acceptance |
| --- | --- | --- |
| `stale-last-result-cleanup` | [#185](https://github.com/xycu/agent-smith/pull/185) | APPROVED. Persisted result cleanup recovers before routing and Git effects, preserves pending result ownership, and covers both chains and prompt transports. All seven Progress rows are complete. Integration with current main retained both recovery guidance and current verification rules. |
| `step-subagent-git-guard` | [#184](https://github.com/xycu/agent-smith/pull/184) | APPROVED after the option-value fix and packaging follow-up. All fourteen Automated rows are complete. Manual 2.6 and 2.7 require live Claude enforcement and planning/review probes. Manual 3.4 remains unticked, with passing implementation PR CI evidence available. |

Three guard Manual rows remain unticked in the archived plan. No checkbox or SHA suffix was changed during archive. Any further acceptance work belongs in a new change referencing the archive. [Guard PR CI](https://github.com/xycu/agent-smith/actions/runs/43668603868)

The combined Node 24 integration suite passed 1,621 tests out of 1,624, with zero failures and three expected skips. Combined main CI and release-commit CI both passed before publication. [Combined main CI](https://github.com/xycu/agent-smith/actions/runs/43702180293) · [Release-commit CI](https://github.com/xycu/agent-smith/actions/runs/43702743803)

## Parked follow-up (1)

| Change | Draft PR | Current state |
| --- | --- | --- |
| `quote-router-in-skill-loops` | [#186](https://github.com/xycu/agent-smith/pull/186) | Parked at the owner's request. Planning and plan review completed. Implementation halted on missing installed-plugin substitution transcripts for both chains and the reviewed rewrite-integration prerequisite. The Wave 7 rewrite has since merged in #188. The draft description records the stop, and its branch and worktree remain retained. |

## Changes outside the waves

- `proper-structure-of-rules` merged and archived in PR #155. Its structural changes apply to all remaining ownership checks.
- `openai-codex-support` merged and archived in PR #157. Manual acceptance rows 4.4–4.6 remain pending, and phase 4 lacks formal implementation-review coverage. PR #157 also added project Codex permissions.
