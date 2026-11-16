<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: OpenSpec 2.0.0 Upgrade

- **Plan**: context/changes/openspec-2-upgrade/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-11-16
- **Review baseline**: 58ce4ea8..0efe458496468ae00727e93ab9b9848248c0f1e5
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 0 observations

## Verdicts

| Dimension | Verdict |
| --- | --- |
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS — automated criteria pass; Manual rows remain explicitly pending |

## Findings

No actionable implementation findings. The independent plan-drift and safety/pattern reviews returned no findings; the enclosing review reconciled their evidence against the plan, code and migration records. No fixes or fix commits were needed.

## Coverage and ownership

The explicit full-plan request covers phases 1–3, including the outstanding Manual criteria. Progress has 8 of 10 rows complete: all eight Automated rows are checked, and Manual rows 3.4 and 3.5 remain unchecked. The first pending row is in phase 3. Progress was not edited.

| Phase | Reviewed implementation and evidence |
| --- | --- |
| 1 | CI installs and selects exactly 2.0.0 before exporting OPENSPEC_BIN. The probe matrix distinguishes failed/unavailable probes from successful wrong, malformed or empty responses. The five original status identities remain intact. Real fixtures cover setup, twelve-workflow upgrade, validation and archive. Reference and ADR provenance match the executable contracts. |
| 2 | Twelve canonical skills retain MIT notices and 2.0.0 metadata; twelve tracked relative Claude links resolve inside the project. The migration record inventories all twenty-four legacy inputs against upstream and records preservation and idempotence. Setup guidance preserves workflow selection, explains global configuration and fresh-child discovery, and reconciles custom legacy material before removal. Archive diagnostics require code/message and quote fix only when supplied. |
| 3 | Verification and acceptance records identify candidate revisions, exact tools/commands, successful and failed attempts, expected skips and bounded native observations. Existing test owners cover saved prompt replay, result/usage ownership, child settlement, locks, recovery and fake publication. All six native matrix cells and external publication remain explicitly pending. |

The router's runtime, state schema, policy, project OpenSpec config and main specs have no implementation diff. The sole OpenSpec runtime-module change updates parser provenance. The pipeline's Loop and following sections retain their execution, Anti-stall, result, usage and publication contracts. The generated .openspec-target marker, roadmap in-progress stamp and manual-verification records are justified workflow bookkeeping.

Migration ownership remains unchanged: OpenSpec generates toolkit files and performs CLI archives; the project owns config/artifacts; the router owns live metadata, results and recovery. The plan preserves saved dispatch bytes across the compatibility window. Its forward path expands contracts before layout migration; rollback requires settled descendants, preserved commits and an ordinary revert, retaining completed archives and recovery refs. No new runtime migration mechanism or dependency was introduced.

The lessons register was read before review. No finding warranted a new lesson candidate. The prompt's explicit one-child-layer contract supersedes the register's historical flat-delegation restriction. Native read-only leaves /root/plan_drift and /root/safety_review were both collected before this enclosing report; neither changed files. No verified child-inclusive usage snapshot was available, so token coverage remains unknown.

## Automated verification

Review gates use Node v24.19.0 and selected OpenSpec 2.0.0 from /Users/blazej/.local/state/fnm_multishells/40266_1794862045380/bin/openspec. The branch remains agent-smith/openspec-2-upgrade. The existing ignored scratch directory .claude/worktrees/openspec-2-implement supplies TMPDIR and GIT_CEILING_DIRECTORIES. Its filesystem Git discovery boundary was rechecked: git rev-parse fails there instead of finding the enclosing repository. Real CLI fixtures additionally isolate HOME, USERPROFILE and XDG paths and clear CODEX_HOME. Telemetry and update checks are disabled.

Both commands below run after the absolute-root cd and this environment setup:

```sh
export TMPDIR="$PWD/.claude/worktrees/openspec-2-implement" GIT_CEILING_DIRECTORIES="$PWD/.claude/worktrees/openspec-2-implement" OPENSPEC_BIN="$(command -v openspec)" OPENSPEC_TELEMETRY=0 DO_NOT_TRACK=1 OPENSPEC_NO_UPDATE_CHECK=1
```

| Criteria | Command | Result | Local log |
| --- | --- | --- | --- |
| 1.1, 1.2, 2.1 | CI=1 caffeinate -i node --test --test-concurrency=2 tools/test/ci-runner.test.mjs skills/openspec-pipeline/test/openspec-contract.test.mjs skills/openspec-pipeline/test/openspec-skill.test.mjs skills/openspec-pipeline/test/openspec-archive.test.mjs | PASS: 69 tests, 69 passed, 0 failed/cancelled/skipped; 13427.075583 ms | .claude/worktrees/openspec-2-implement/review-focused.log |
| 1.3, 2.2, 3.1, 3.2 | CI=1 caffeinate -i node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs | PASS: exit 0; 1793 tests, 1790 passed, 0 failed/cancelled, 3 expected skips; 808546.349833 ms | .claude/worktrees/openspec-2-implement/review-full.log |
| 3.3 | Read plan, verification.md, acceptance.md and both manual-verification records; reconcile source diff and Progress | PASS: every completed Automated row has scoped evidence; Manual rows stay pending | Committed evidence records |
| Packaging and whitespace | git diff --check; node tools/version-check.mjs | PASS; version-check: OK (1.12.2) | Review tool output |

The focused gate executes all nine real 2.0.0 contracts with zero skips. The full command includes every saved-dispatch, result/usage, runner, lock/recovery and publication test owner named by phase 3. Earlier implementation attempts remain in evidence/verification.md; this review does not erase their failures or treat deterministic fixtures as live-host qualification.

The three full-suite skips are exactly `live: a branch with no pull request is skipped` and `live: the real comment projection is one parseable object per line across pages` (GH_LIVE is not 1), plus `CLAUDE.md has no @ imports` (CLAUDE.md is absent). No Git-dependent or real OpenSpec contract was skipped. Both review gate attempts passed without retry.

| Local log | SHA-256 |
| --- | --- |
| review-focused.log | d2322cf7e484fb6dbe81ffcc8eae9f24c4397c38ae49ef8dc3941a1e191b74c8 |
| review-full.log | 58788e5ec5728acfcdde6365e795fa766b13dc47b15eb21e06fbdaa7dcc3272f |

## Pending acceptance and limits

- Manual 3.4: all six upgraded normal-entry host/provider/launch cells remain pending. Each requires its trusted launch, provider access, guarded child execution and retained nonce/settlement/recovery/restriction/usage evidence. Fresh catalog and symlink observations do not complete those cells.
- Manual 3.5: actual branch push, PR, successful PR CI and report comment remain the enclosing orchestrator's obligation. This review performed no publication action.

The approval covers implementation conformity and the completed automated gates. It does not certify the pending live-host matrix or external handoff. No finding, count or verdict was reduced by a fix. The pre-existing live run.jsonl edit remains router-owned and untouched; no plan, lesson or archive file was changed. The unchanged plan SHA-256 is 35cc7627507f5660e900ad9491324046c7aec437ed8e51fec784948342407292. Only this report and the skill-required change.md lifecycle stamp were written; no commit was made because no fix was required.
