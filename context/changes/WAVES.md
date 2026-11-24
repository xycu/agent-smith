# Waves v3

Updated 2026-11-24. Waves 1 to 5 are merged. Wave 6 (tests) is next and has not started. `main` is at `af3f3df5` (v1.16.2). Open Manual rows are recorded per change (see "Open Manual rows after Wave 5"). [v1.15.1](https://github.com/xycu/agent-smith/releases/tag/v1.15.1) shipped five of the six Wave 2 changes, v1.15.2 added `step-guard-bypass-forms` and v1.15.3 added the run-lock fix [#248](https://github.com/xycu/agent-smith/pull/248). [v1.15.4](https://github.com/xycu/agent-smith/releases/tag/v1.15.4) ([#254](https://github.com/xycu/agent-smith/pull/254)) shipped four of the five Wave 3 changes; `codex-profile-and-gitdir-access` moved to Wave 4. [v1.16.0](https://github.com/xycu/agent-smith/releases/tag/v1.16.0) shipped five Wave 4 changes (see "Wave 4"), and v1.16.1 added two fixes to the Claude token capture (see "Added outside the schedule"). The four GitHub issues open on 2026-11-21 have change folders and slots (see "Added from GitHub issues"). The planning snapshot of 2026-11-19 was `main` at `52e197f3ad5a6722022026aeb1bec81870aa8fc6`, after [PR #221](https://github.com/xycu/agent-smith/pull/221); the line numbers below are still those of that snapshot.

This version replaces the v2 schedule. Waves 0 to 2 of v2 are merged and archived (S-14, the two audit fixes of 2026-11-15, S-13). Their acceptance records, the Wave 0 contract and the deferrals to S-20 stay in the [version 2 ledger](https://github.com/xycu/agent-smith/blob/52e197f3ad5a6722022026aeb1bec81870aa8fc6/context/changes/WAVES.md). No archived artifact is changed or marked complete by this file.

## Why the schedule changed

- At the snapshot `context/changes/` held 25 open folders: 5 from the weekly review ([PR #220](https://github.com/xycu/agent-smith/pull/220)), 18 from the whole-repo audit (PR #221), `first-unattended-delivery` (S-12) and the parked `quote-router-in-skill-loops`. After Wave 1 it holds 21: 17 scheduled fix changes, S-12, the parked change, and two changes that are not in the schedule (see "Added outside the schedule").
- The audit verdict is that the pipeline is not safe for unattended use until its five must-fix findings are fixed. So the fix waves run before the S-12 live proof and before the roadmap slices S-15 to S-20.
- Most fixes are small and sit in different files. The waves below are built so that every change in a wave owns a different region of the runtime code and can run in its own worktree at the same time.

## Priority

| Priority | Changes |
| --- | --- |
| P0, must fix | `review-verdict-unknown-passes`, `plan-zero-rows-skips-implement`, `open-pr-unfinished-merge-commit`, `codex-failure-native-lock-stuck`, `step-guard-bypass-forms` |
| P0 prerequisite | `step-guard-heredoc-false-positives` (the bypass fix builds on its parser) |
| P1, should fix, runtime | `next-requires-isolated-init`, `meta-json-damage-halts`, `run-branch-must-match-change-id`, `prepare-run-retry-after-failed-setup`, `open-pr-base-selection`, `run-lock-stale-takeover-race`, `replan-failure-halt-recoverable`, `openspec-critical-none-placeholder`, `codex-step-publication-guard`, `codex-profile-and-gitdir-access`, `run-root-worktree-readiness`, `run-root-cross-worktree-writes` (frame first) |
| P2, owner decision first | `ci-self-hosted-runner-exposure`, `first-attempt-drop-unmeasured`, `claude-token-figures-default`, and the open [PR #214](https://github.com/xycu/agent-smith/pull/214) for S-12; `usage-capture-preflight` (waits for the token decision) |
| P3, upkeep | `usage-file-docs-drift`, `docs-status-truth-up`, `open-pr-base-prefix-collision`, `test-suite-trim-and-gaps`, `test-shard-durations-refresh`, `quote-router-in-skill-loops` (parked) |

A wave takes the highest priority first. A lower-priority change joins an earlier wave only when its lane is free there.

## Lanes

A lane is a region of code that one change owns at a time. Changes in one lane run one after another. Changes in different lanes run in parallel. The line numbers are those of the snapshot and come from each `change.md`.

| Lane | Owned region | Order inside the lane |
| --- | --- | --- |
| Flow | `flow.mjs` (`decide`); in `state.mjs` the verdict regex (`:340`) and `readPlan` (`:268-288`) | `review-verdict-unknown-passes`, then `plan-zero-rows-skips-implement`, then `replan-failure-halt-recoverable` |
| Guard | `step-guard.mjs` and its test | `step-guard-heredoc-false-positives`, then `step-guard-bypass-forms` |
| Publish | `open-pr.mjs` | `open-pr-unfinished-merge-commit` (`commitLeftovers`), then `open-pr-base-prefix-collision`, then `open-pr-base-selection` (both in `resolveBase`) |
| Lock and Codex | `acquireRunLock` in `state.mjs` (`:990-1054`), `run-codex.mjs`, `.codex/` | `codex-failure-native-lock-stuck`, then `run-lock-stale-takeover-race` and `codex-step-publication-guard` side by side, then `codex-profile-and-gitdir-access` |
| Router entry | `next()` in `route.mjs` (`:83-127`); `readJson` and `readMeta` in `state.mjs` | `next-requires-isolated-init`, then `meta-json-damage-halts`, then `replan-failure-halt-recoverable` |
| Setup | `run-identity.mjs`, `prepare-run.mjs` | `run-branch-must-match-change-id`, then `prepare-run-retry-after-failed-setup`; `open-pr-base-prefix-collision` may validate the prefix in `run-identity.mjs:38`, so it comes after the first; then `prepare-run-setup-lock-and-residue-followups`, then `run-root-worktree-readiness` (both edit `prepare-run.mjs`), and `run-root-cross-worktree-writes` if its frame puts the fix in setup |
| OpenSpec | `openspec.mjs`, `os-verify.md` | `openspec-critical-none-placeholder` |
| Skill text | both `SKILL.md` files and the tests that pin them | `codex-failure-native-lock-stuck` (line 88), then `claude-token-figures-default`, then `quote-router-in-skill-loops`; `usage-capture-preflight` follows `claude-token-figures-default` because both touch `claude-usage.mjs` |
| Docs and tests | `docs/`, `README.md`, `AGENTS.md`, `tools/`, test files | `usage-file-docs-drift` and `docs-status-truth-up` early; `test-suite-trim-and-gaps`, then `test-shard-durations-refresh` last |

`replan-failure-halt-recoverable` sits in two lanes (Flow and Router entry), so it waits for both.

## Wave map

| Wave | Runs in parallel | Entry condition | Exit outcome |
| --- | --- | --- | --- |
| **D, decisions** (no code), **done 2026-11-21** | Frames for `ci-self-hosted-runner-exposure`, `first-attempt-drop-unmeasured`, `claude-token-figures-default`, `run-root-cross-worktree-writes`; the owner decision on PR #214 | Open now, beside Wave 2. Each of the three changes holds only its `change.md`. | Each frame records the chosen option. Each implementation gets its slot in Wave 4 or 5. The frame of `run-root-cross-worktree-writes` names the hook that refused the write. |
| **1, safety part 1** (6), **merged and archived 2026-11-20** | `review-verdict-unknown-passes`; `open-pr-unfinished-merge-commit`; `codex-failure-native-lock-stuck`; `step-guard-heredoc-false-positives`; `usage-file-docs-drift`; `docs-status-truth-up` | `main` at the snapshot or later. | Three of five must-fix findings are closed. The guard parser is ready for the bypass fix. Usage text and document statuses are true. |
| **2, safety part 2** (6), **merged and archived 2026-11-21**; released in v1.15.1 and v1.15.2 (#246) | `plan-zero-rows-skips-implement`; `step-guard-bypass-forms`; `run-lock-stale-takeover-race`; `codex-step-publication-guard`; `next-requires-isolated-init`; `run-branch-must-match-change-id` | Wave 1 merged (met). | All five must-fix findings are closed. Cut a release here. |
| **3, state and setup** (4, plus one live proof), **merged and archived 2026-11-21**; released in v1.15.4 (#254) | `meta-json-damage-halts`; `prepare-run-retry-after-failed-setup`; `open-pr-base-prefix-collision`; `openspec-critical-none-placeholder`; S-12 live rows 3.1 to 3.3 on the Wave 2 release (proved 2026-11-21 to 2026-11-22, see "Decision track") | Wave 2 merged (met) and released as v1.15.2. | Damaged state halts, a failed setup can be retried, a short prefix cannot hide the base. S-12 has its live proof (done). |
| **4, recovery and decisions** (7), **merged 2026-11-22; `run-root-cross-worktree-writes` merged 2026-11-23 ([#277](https://github.com/xycu/agent-smith/pull/277))**; released in v1.16.0 and v1.16.2 | `codex-profile-and-gitdir-access`; `replan-failure-halt-recoverable`; `open-pr-base-selection`; `run-root-worktree-readiness`; the implementation of `run-root-cross-worktree-writes`; the implementation of `ci-self-hosted-runner-exposure`; the implementation of `claude-token-figures-default` | Wave 3 merged; the three frames decided. | Every runtime should-fix finding is closed except the refused cross-worktree write. `init` warns when the Codex profile or the worktree gitdir write access is missing. A run root is ready for the project's gates before step 1, and a refused write stops `init` with one clear error. CI and the token figures follow the owner's decisions. |
| **5, policy and skill text** (4), **merged 2026-11-23**; released in v1.16.2 ([#279](https://github.com/xycu/agent-smith/pull/279)) | The implementation of `first-attempt-drop-unmeasured`; `usage-capture-preflight`; `prepare-run-setup-lock-and-residue-followups` (moved from Wave 4 on 2026-11-22); `quote-router-in-skill-loops` if the owner resumes it | Wave 4 merged. | The first-attempt drop matches ADR-010. A run warns before step 1 when token usage cannot be captured. The skill loops quote their paths, or the change stays parked. |
| **6, tests** (2, one after the other) | `test-suite-trim-and-gaps`, then `test-shard-durations-refresh` | Wave 5 merged, so no other open change edits a test file. | The suite is faster, the untested branches are covered, and the shard timings match the new suite. |
| **7** (1) | S-15 `actionable-run-prerequisites` | Wave 6 merged; S-12 delivered. | As in v2. |
| **8** (2) | S-16 `resumable-unattended-runs`; S-18 `verified-step-protection` | Wave 7 merged; the two plans own different regions. | As in v2. |
| **9** (1) | S-19 `truthful-owner-decision-halts` | Wave 8 merged. | As in v2. |
| **10** (1) | S-17 `reviewable-run-handoff` | Wave 9 merged. | As in v2. |
| **11** (1) | S-20 `supported-host-acceptance` | Waves 1 to 10 merged into the candidate; the required environments are available. | The 18 normal runs and the recovery and decision evidence qualify the candidate. |

## Ownership per wave

Each row is a planning boundary. The plan of each change confirms it before launch.

### Wave 1 (merged)

| Change | Priority | Owns | Shared files it also edits |
| --- | --- | --- | --- |
| `review-verdict-unknown-passes` | P0 | `flow.mjs:577`, `:814-816`, `:841`; `state.mjs:340` | `docs/REFERENCE.md` |
| `open-pr-unfinished-merge-commit` | P0 | `open-pr.mjs:249-292`; reads `IN_PROGRESS` and `gitSafety` in `isolation.mjs` | `docs/REFERENCE.md` |
| `codex-failure-native-lock-stuck` | P0 | `run-codex.mjs:398-411`; `state.mjs:1001-1054` | `SKILL.md:88`, `docs/REFERENCE.md:25-29` |
| `step-guard-heredoc-false-positives` | P0 prerequisite | `step-guard.mjs` | none |
| `usage-file-docs-drift` | P3 | usage strings at `route.mjs:794` and `:970` | `AGENTS.md:26`, `docs/REFERENCE.md`, the OpenSpec `SKILL.md` |
| `docs-status-truth-up` | P3 | ADR statuses, the six dead links, README "pending" notes, the roadmap states | `docs/REFERENCE.md:21`, `:340`, `:411` |

Merged as [#223](https://github.com/xycu/agent-smith/pull/223) `usage-file-docs-drift`, [#224](https://github.com/xycu/agent-smith/pull/224) `open-pr-unfinished-merge-commit`, [#225](https://github.com/xycu/agent-smith/pull/225) `codex-failure-native-lock-stuck`, [#226](https://github.com/xycu/agent-smith/pull/226) `docs-status-truth-up`, [#227](https://github.com/xycu/agent-smith/pull/227) `review-verdict-unknown-passes` and [#229](https://github.com/xycu/agent-smith/pull/229) `step-guard-heredoc-false-positives`. All six folders are in `context/archive/` with the date prefix 2026-11-19. The ownership table above is kept as the record of the boundaries.

### Wave 2 (merged)

| Change | Priority | Owns | Waits for |
| --- | --- | --- | --- |
| `plan-zero-rows-skips-implement` | P0 | `state.mjs:268-288`; `flow.mjs:572`, `:773` | `review-verdict-unknown-passes` |
| `step-guard-bypass-forms` | P0 | `step-guard.mjs` | `step-guard-heredoc-false-positives` |
| `run-lock-stale-takeover-race` | P1 | `state.mjs:990-1021` | `codex-failure-native-lock-stuck` |
| `codex-step-publication-guard` | P1 | `.codex/rules/project.rules`; `run-codex.mjs:288` | `codex-failure-native-lock-stuck` |
| `next-requires-isolated-init` | P1 | `route.mjs:83-121` | none |
| `run-branch-must-match-change-id` | P1 | `run-identity.mjs:66-81` | none |

Merged as [#235](https://github.com/xycu/agent-smith/pull/235) `run-lock-stale-takeover-race`, [#236](https://github.com/xycu/agent-smith/pull/236) `codex-step-publication-guard`, [#237](https://github.com/xycu/agent-smith/pull/237) `next-requires-isolated-init`, [#238](https://github.com/xycu/agent-smith/pull/238) `run-branch-must-match-change-id`, [#239](https://github.com/xycu/agent-smith/pull/239) `plan-zero-rows-skips-implement` and [#241](https://github.com/xycu/agent-smith/pull/241) `step-guard-bypass-forms`. All six folders are in `context/archive/` with the date prefix 2026-11-19. Open follow-ups from the reviews: `step-guard-bypass-forms` findings F2 (brace, glob and letter-case forms) and F3 (history-pruning commands), and `codex-step-publication-guard` finding F2, wait for the owner.

### Wave 3 (merged)

| Change | Priority | Owns | Waits for |
| --- | --- | --- | --- |
| `meta-json-damage-halts` | P1 | `state.mjs:50-52`, `:533-536`; the `readMeta` callers in `route.mjs` | `next-requires-isolated-init` |
| `prepare-run-retry-after-failed-setup` | P1 | `prepare-run.mjs:100-126`, `:218-262` | `run-branch-must-match-change-id` |
| `open-pr-base-prefix-collision` | P3 | `open-pr.mjs:204-206`; maybe `run-identity.mjs:38` | `open-pr-unfinished-merge-commit`, `run-branch-must-match-change-id` |
| `openspec-critical-none-placeholder` | P1 | `openspec.mjs:116-126`, `:199`; `os-verify.md` | none |
| S-12 live rows 3.1 to 3.3 | P2 | no code; one fresh headless Claude-only run | the Wave 2 release; the owner decision on PR #214 (done: proved, [PR #266](https://github.com/xycu/agent-smith/pull/266)) |

Merged as [#250](https://github.com/xycu/agent-smith/pull/250) `openspec-critical-none-placeholder`, [#251](https://github.com/xycu/agent-smith/pull/251) `open-pr-base-prefix-collision`, [#252](https://github.com/xycu/agent-smith/pull/252) `prepare-run-retry-after-failed-setup` and [#253](https://github.com/xycu/agent-smith/pull/253) `meta-json-damage-halts`. All four folders are in `context/archive/` with the date prefix 2026-11-19. S-12 live rows 3.1 to 3.3 were proved by one live run after the merge (see "Decision track"). `codex-profile-and-gitdir-access` ([#245](https://github.com/xycu/agent-smith/issues/245)) moved to Wave 4: its first run hit a preflight bug that [#248](https://github.com/xycu/agent-smith/pull/248) fixed, and its plan adds text to `SKILL.md`, so it raises the size ceiling in `skill-loop.test.mjs` in the same commit. The v1.15.4 changelog lacks the `meta-json-damage-halts` line, because the release PR was merged before release-please listed #253; the tag holds the code.

### Wave 4

| Change | Priority | Owns | Waits for |
| --- | --- | --- | --- |
| `codex-profile-and-gitdir-access` | P1 | a new `init` check of the Codex profile and the gitdir write access; the plan names its function and keeps it out of `prepare-run.mjs`; adds `SKILL.md` text and raises the ceiling in `skill-loop.test.mjs:423` | `meta-json-damage-halts` (merged); replan after taking in `main` |
| `replan-failure-halt-recoverable` | P1 | `flow.mjs:768-770`; `route.mjs:126-127` | `plan-zero-rows-skips-implement`, `meta-json-damage-halts` |
| `open-pr-base-selection` | P1 | `open-pr.mjs:191-232` | `open-pr-base-prefix-collision` |
| `run-root-worktree-readiness` | P1 | `prepare-run.mjs` (base check, install, readiness command); a `readiness` key in the project override | `prepare-run-retry-after-failed-setup` (merged) |
| `run-root-cross-worktree-writes` | P1 | setup, per its frame: run-root placement or a preflight in `prepare-run.mjs` or `init` that names the desktop app's write rule; the start text of both `SKILL.md` files | its frame (done); `run-root-worktree-readiness` if both edit `prepare-run.mjs` |
| `ci-self-hosted-runner-exposure` | P2 | option A: the install line in `.github/workflows/ci.yml`, an ADR-020 amendment; `tools/test/ci-runner.test.mjs` only if the runner expression changes | its frame (decided); the owner's dated check of the repository settings |
| `claude-token-figures-default` | P2 | opt-in capture hook: `hooks/hooks.json` and `claude-hook.mjs` or a new hook, `claude-usage.mjs`, both `SKILL.md` loops (raises the ceiling in `skill-loop.test.mjs`), `compare` at `route.mjs:572`, ADR-018 and ADR-019 amendments | its frame (decided); `codex-failure-native-lock-stuck` |

Merged as [#257](https://github.com/xycu/agent-smith/pull/257) `codex-profile-and-gitdir-access`, [#263](https://github.com/xycu/agent-smith/pull/263) `replan-failure-halt-recoverable`, [#264](https://github.com/xycu/agent-smith/pull/264) `open-pr-base-selection`, [#259](https://github.com/xycu/agent-smith/pull/259) `run-root-worktree-readiness` (a docs-type run PR, so no changelog line), [#269](https://github.com/xycu/agent-smith/pull/269) `ci-self-hosted-runner-exposure` and [#270](https://github.com/xycu/agent-smith/pull/270) `claude-token-figures-default`. The folders of `codex-profile-and-gitdir-access`, `replan-failure-halt-recoverable`, `open-pr-base-selection`, `ci-self-hosted-runner-exposure` and `claude-token-figures-default` are in `context/archive/`; `run-root-worktree-readiness` stays open until the owner checks its Manual row 2.4 on a real project. `run-root-cross-worktree-writes` was planned and merged on 2026-11-23 as [#277](https://github.com/xycu/agent-smith/pull/277); its Manual rows 1.3 to 1.5 (Claude Desktop) are deferred to S-20.

Rows 2.4 and 2.5 of `claude-token-figures-default` were closed on 2026-11-23 on the live run of `claude-capture-async-agent-launch` (see "Added outside the schedule"): one complete interactive launcher run on Claude Code 2.1.323 verified all five steps. No headless run is recorded; S-20 keeps the host and mode matrix.

The minimum fix of `ci-self-hosted-runner-exposure` (`--ignore-scripts` on the install line) owns no runtime code. It may merge in any earlier wave as soon as the owner agrees.

### Waves 5 and 6

| Change | Priority | Owns | Waits for |
| --- | --- | --- | --- |
| `first-attempt-drop-unmeasured` | P2 | option A: at least 5 measured pairs recorded in ADR-010; `policy.json:50`, ADR-007, `docs/REFERENCE.md` and the README follow the result | its frame (decided); `claude-token-figures-default` for Claude pairs |
| `usage-capture-preflight` | P2 | an `init` preflight of the usage sources; the source checks in `claude-usage.mjs`; the reason line of the report and PR comment | `claude-token-figures-default` |
| `prepare-run-setup-lock-and-residue-followups` | P3 | `prepare-run.mjs` (`checkCurrentPending`, the marker path helper, `writePending`) and its tests, per its reviewed plan (F2 and F3, verdict SOUND). Moved from Wave 4 on 2026-11-22 because its plan and `run-root-worktree-readiness` both edit `prepare-run.mjs`. Its frame splits F1 into a later change, `prepare-run-deletion-propagation`, with no folder yet. | `run-root-worktree-readiness`; replan after taking in `main` |
| `quote-router-in-skill-loops` | P3, parked | both `SKILL.md` loops; `skill-loop.test.mjs`, `openspec-skill.test.mjs`, `archive-gate.test.mjs` | the owner's resume instruction; `claude-token-figures-default` |
| `test-suite-trim-and-gaps` | P3 | test files across the suite; `GIT_TIMEOUT_MS` at `prepare-run.mjs:8` | every change above |
| `test-shard-durations-refresh` | P3 | `tools/test-durations.json`; a drift test in `tools/test/` | `test-suite-trim-and-gaps` |

Wave 5 merged on 2026-11-23: [#275](https://github.com/xycu/agent-smith/pull/275) `first-attempt-drop-unmeasured` (ships `drop: 0`; the A/B measurement is still open), [#278](https://github.com/xycu/agent-smith/pull/278) `usage-capture-preflight` (Manual rows 2.4 and 2.5 closed on 2026-11-24, see its `evidence/manual-live-acceptance.md`), [#280](https://github.com/xycu/agent-smith/pull/280) `prepare-run-setup-lock-and-residue-followups` and [#186](https://github.com/xycu/agent-smith/pull/186) `quote-router-in-skill-loops` (resumed by the owner). Wave 6 starts from `main` at v1.16.2: `test-suite-trim-and-gaps` has `change.md` only and needs a frame and a plan first, then `test-shard-durations-refresh`.

### Open Manual rows after Wave 5

Decided by the owner on 2026-11-24. Each change keeps its rows unticked and records the decision in `evidence/deferred-manual-rows.md`.

| Change | Rows | State |
| --- | --- | --- |
| `quote-router-in-skill-loops` | 2.6, 2.7 | Deferred to S-20: needs a plugin cache path with a space, which a directory marketplace cannot produce. |
| `run-root-cross-worktree-writes` | 1.3, 1.4, 1.5 | Deferred to S-20: Claude Desktop sessions. |
| `provider-mode-split` | 3.2 | Deferred to S-20: six host and mode combinations on both chains. Row 3.3 ticked (PR #231 merged, CI green on its head). |
| `first-attempt-drop-unmeasured` | 2.1, 2.2, 2.3 | Open, not moved: the A/B measurement waits for the owner; the drop stays `0`. |
| `run-root-worktree-readiness` | 2.4 | Open, archive on hold until the owner checks it on a real project. |

Rows closed in this pass: `usage-capture-preflight` 2.4 and 2.5 (live run on Claude Code 2.1.323 and a throwaway PR), `prepare-run-setup-lock-and-residue-followups` 2.2 (full-suite CI on [#280](https://github.com/xycu/agent-smith/pull/280)). `usage-capture-preflight` has no open row and can be archived.

## Execution rules

- Waves run in order. Start a wave from `main` after every implementation PR of the wave before it is merged. A merged change description is not a merged implementation.
- Each change runs in its own run worktree on its own run branch. Changes in one wave run at the same time.
- Before launch, each plan names the functions it edits. If two plans in one wave name the same function, the lower-priority change moves to the next wave. The tables above are boundaries to confirm, not approved file lists.
- Shared files are `docs/REFERENCE.md`, `AGENTS.md`, the README of a test or prompt folder, and `README.md`. A change edits only its own section there. Merge the PRs of a wave one at a time; a later PR takes in `main` with a merge commit. Never force-push and never rewrite pushed history.
- `skills/10x-pipeline/SKILL.md` is 27,804 bytes and `skill-loop.test.mjs:423` allows 28,100. A change that adds text to that file raises the ceiling in the same commit and says so in its PR, until `test-suite-trim-and-gaps` replaces the ceiling. The `## Anti-stall rules` sections of the two skills stay equal.
- Wave 1 closed the unknown review verdict, the unfinished merge commit in `open-pr.mjs` and the stuck native lock after a Codex failure. Until Wave 2 is merged, the pipeline that runs these changes still has the defects Wave 2 fixes. For every run in Wave 2, check by hand before merging: the plan has Progress rows in the checkbox form (`plan-zero-rows-skips-implement`), and no step ran a command through a bypass form of the step guard (`step-guard-bypass-forms`).
- A run now defaults to the provider of its host: a run started in Claude Code runs every step in Claude, a run started in Codex runs every step in Codex, and `--provider-mode claude|codex|split` overrides it at `init` (v1.15.0). The project override ladder in `context/foundation/agent-smith-policy.json` is OpenAI-only, so state the mode at launch instead of relying on the ladder.
- A run branch that holds only `chore`, `docs` and `test` commits opens no release PR. Check the derived PR title before merging: a `fix` or `feat` title on a change without product code publishes a release with a wrong changelog line.
- Keep live host and account prerequisites explicit. A passing local fixture does not replace a promised live proof.
- Update this ledger after each wave in one maintenance PR. The parallel changes of a wave leave it alone.

## Decision track

| Item | Question for the owner | Decision (2026-11-21) | Blocks |
| --- | --- | --- | --- |
| PR #214, S-12 | The run archived S-12 and set the roadmap to `done` with 0 of 3 Manual rows proved. Prove rows 3.1 to 3.3 on the Wave 2 release, or record a deferral to S-20 as for S-13 and S-14? | Proved, not deferred. The owner first deferred the rows to S-20 on 2026-11-21, then reversed that the same day and asked for the proof. One fresh headless Claude-only run (2026-11-21 22:28Z to 2026-11-22 00:27Z) ended `done - impl review APPROVED` and opened [PR #266](https://github.com/xycu/agent-smith/pull/266) (CI green, head `41991ee7`). The record is `evidence/live-proof.md` on the branch of PR #214. | nothing |
| `ci-self-hosted-runner-exposure` | Keep the self-hosted runner with a hardened install, move pull request jobs to hosted runners, or move everything? | A: keep the NAS runner, add `--ignore-scripts`, record the checked settings and the runner's network reach in ADR-020. Recorded in its `frame.md`. Merged as #269. | done; archived |
| `claude-token-figures-default` | Should Claude steps report token figures by default, and from which source? | The plugin ships a capture hook that the user opts into; off by default. `compare` and the version range go to the plan. Recorded in its `frame.md`. Merged as #270; Manual rows 2.4 and 2.5 closed on 2026-11-23 on one interactive 2.1.323 run (no headless run). | done; archived |
| `run-root-cross-worktree-writes` | Frame, no owner choice yet: which hook refused the write (the plugin, the host's worktree sandbox or the project's settings), and which paths may a step write in the run root? | Framed: the Claude desktop app's own `PreToolUse:Write` hook refuses writes into another worktree and under a shared worktree's `.claude/`; the plugin owns no Write hook. The fix goes in setup (`prepare-run.mjs` or `init`). The manual-verify limit is a prompt rule and goes to `run-root-worktree-readiness`. See its `frame.md`. Merged as #277 on 2026-11-23. | done; Manual rows 1.3 to 1.5 deferred to S-20 |
| `first-attempt-drop-unmeasured` | Measure at least 5 pairs, set the drop to `0`, or set it to `0` and remove `compare`? Measuring is the savings experiment that FR-017 defers. | A: measure at least 5 pairs. Open for the plan review: the drop during the measurement (see its `frame.md`). Merged as #275 with `drop: 0` until the pairs prove a saving; the measurement (Manual rows 2.1 to 2.3) is still to run. | the measurement, started by the owner |

S-12 counts as delivered for the Wave 7 entry condition: rows 3.1 to 3.3 are proved. Two caveats stay with the record: the run's worktree setup failed in the sandbox and the orchestrator retried with the sandbox off (no human steering), and row 3.1 shows the guard by its denial text, not by a recorded hook event. PR #266 carries two acceptance-only commits and is evidence, not a change to merge as is. The record is appended to the archived S-12 folder on the branch of PR #214 as a new file; no earlier file in it is edited, and PR #214 itself still needs the owner to rebase it, merge it or close it. The deferred rows of S-13 and S-14 stay with S-20.

## Roadmap slices after the fix waves

The fix waves close cases that v2 attached to later slices. Each slice plan starts from what is already merged and may get smaller. The slice outcomes and their live proofs do not change.

| Slice | Fix-wave changes that feed it |
| --- | --- |
| S-15 `actionable-run-prerequisites` | `next-requires-isolated-init`, `run-branch-must-match-change-id`, `prepare-run-retry-after-failed-setup`, `codex-profile-and-gitdir-access`, `run-root-worktree-readiness`, `run-root-cross-worktree-writes`, `usage-capture-preflight` |
| S-16 `resumable-unattended-runs` | `codex-failure-native-lock-stuck`, `run-lock-stale-takeover-race`, `meta-json-damage-halts`, `replan-failure-halt-recoverable`; the staged-only file case of `open-pr-unfinished-merge-commit` |
| S-18 `verified-step-protection` | `step-guard-heredoc-false-positives`, `step-guard-bypass-forms`, `codex-step-publication-guard` |
| S-19 `truthful-owner-decision-halts` | `review-verdict-unknown-passes`, `plan-zero-rows-skips-implement`, `openspec-critical-none-placeholder`; the archive gate for unchecked rows that `docs-status-truth-up` asks about |
| S-17 `reviewable-run-handoff` | `open-pr-unfinished-merge-commit`, `open-pr-base-prefix-collision`, `open-pr-base-selection` |
| S-20 `supported-host-acceptance` | every change above; the deferred rows of S-13 and S-14; the headless and other-host Claude runs that `claude-token-figures-default` leaves open (its interactive run on 2.1.323 is recorded) |

S-16 and S-18 stay in one wave only if their plans own different runner, settings and skill regions. S-19 comes before S-17 because both can change the archive and terminal sections of the skills.

## Added outside the schedule

- **`provider-mode-split`, [PR #231](https://github.com/xycu/agent-smith/pull/231), released in v1.15.0:** a run selects Claude, Codex or a split provider mode, with the host as the default. It has no wave slot because it came from an owner request after Wave 1. The change is not archived: Manual row 3.2 (fresh authenticated sessions for six host and mode combinations on each chain) is deferred to S-20 (2026-11-24); row 3.3 is ticked (PR #231 merged, CI green on its head). The run ended on its fix-loop cap, so its last fix commit has no review of its own. The PR raised `limits.maxFixLoops` to 3 in the project override and the by-file action ceiling to 1,536 bytes in `prompt-handoff.test.mjs`.
- **`record-archive-manual-decision`:** a seed from the archive decision of `docs-status-truth-up`, status `new`. It documents a durable record for an archive with unresolved Manual rows. S-19 owns the wider decision flow, so the seed has no slot until the owner decides whether S-19 absorbs it or it runs earlier in the Docs and tests lane.

- **`claude-capture-version-floor`, [PR #272](https://github.com/xycu/agent-smith/pull/272), released in v1.16.1:** the capture accepts every Claude Code release at or above the reviewed floor 2.1.311, not one exact release. It came from the live probe of `claude-token-figures-default` on 2.1.323, which the exact-version rule refused.
- **`claude-capture-async-agent-launch`, [PR #274](https://github.com/xycu/agent-smith/pull/274), released in v1.16.1:** the live probe then ended every step `incomplete-capture`, because an interactive session launches the step Agent in the background and the collector assumed a synchronous result. The collector now settles the invocation's root run from its stop, completion and transcript records, and the wording that called the 2.1.311 fixtures headless evidence is corrected. A live interactive run on 2.1.323 verified all five steps (1,248,719 tokens); the record is in the archived change. It has no wave slot because it came from a live finding after Wave 4. The change is archived.

- **`codex-usage-version-floor`, [PR #276](https://github.com/xycu/agent-smith/pull/276), released in v1.16.2:** Codex usage accepts releases at or above the reviewed floor, as `claude-capture-version-floor` did for Claude. It has no wave slot.

## Added from GitHub issues

Four issues opened from live runs on 2026-11-20 and 2026-11-21. Each has a change folder with status `new`; the slots are in the wave map above.

| Issue | Change | Priority | Slot |
| --- | --- | --- | --- |
| [#243](https://github.com/xycu/agent-smith/issues/243), bug | `run-root-cross-worktree-writes` | P1 | frame done 2026-11-21 (the refusing hook is the desktop app's); fix in Wave 4. |
| [#245](https://github.com/xycu/agent-smith/issues/245) | `codex-profile-and-gitdir-access` | P1 | Wave 4 (moved from Wave 3 on 2026-11-21), Lock and Codex lane |
| [#244](https://github.com/xycu/agent-smith/issues/244) | `run-root-worktree-readiness` | P1 | Wave 4, Setup lane, after `prepare-run-retry-after-failed-setup` |
| [#232](https://github.com/xycu/agent-smith/issues/232) | `usage-capture-preflight` | P2 | Wave 5, after `claude-token-figures-default` |

## Parked and out of scope

- **`quote-router-in-skill-loops`, [PR #186](https://github.com/xycu/agent-smith/pull/186):** resumed by the owner and merged on 2026-11-23 in Wave 5 (released in v1.16.2). Its Manual rows 2.6 and 2.7 are deferred to S-20.
- **Audit findings 19 and 20** (a failed fix retried on the same tier; lean leftovers): no change folder. Open one only if the owner asks.
- **FR-017 to FR-019:** savings and scorer experiments, broader onboarding and delivery-quality reporting stay deferred, except where the owner picks the measuring option of `first-attempt-drop-unmeasured`.
- **Historical Manual rows:** they keep their recorded state in the read-only archive. No checkbox is closed by this ledger.

## Milestone completion

S-20 must keep three successful normal runs for each of the six agreed combinations: Claude-only on Claude Code, mixed Claude and OpenAI on Claude Code, and OpenAI-only on Codex, each on the 10x chain and on the OpenSpec chain. Interactive and headless launches are both present in the three runs of each combination. That is 18 normal runs.

Each combination also carries interruption and resume evidence and owner-decision evidence. Earlier evidence counts only where it still matches the final candidate. A green suite, a merged PR or the first successful run does not replace this contract. M-2 closes when its nine roadmap slices are delivered and the combined candidate meets the [PRD acceptance scope](../foundation/prd.md#agreed-reliability-acceptance-scope).
