<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Atomic Run State

- **Plan**: context/changes/run-state-atomic-writes/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-11-14
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

None. No code fixes or finding decisions are required.

## Scope and evidence

Reviewed the complete plan and all 13 completed automated Progress criteria, using implementation commits `8fc758a`, `10e9f17` and `f6ad515`, and the final worktree at `ad28926`. The implementation range is `dcba635..ad28926`. Read `context/foundation/lessons.md` before the review. There are no manual Progress items to verify.

| Phase | Evidence and conclusion |
|-------|-------------------------|
| 1 | `state.mjs` owns exclusive same-directory temp creation, permission preservation, complete write/close/rename publication, observable cleanup failures, and the shared exact temp matcher. `flow.mjs`, `isolation.mjs` and `route.mjs` use it for logs, metadata, reports and restoration. Tests cover strings, Buffers, absent/existing targets, failures at each publication stage, killed children before/after rename, collisions, lock exclusion, exact cleanup, usage guards and omission of stale temps from commits. |
| 2 | Every production `readLog` caller consumes the explicit result. Mutating commands and Codex validation use strict reads; observational commands select tolerant reads and expose attributed diagnostics only when populated. Both-chain tests verify damaged middle/final lines, physical line numbering, legacy objects, CRLF, read errors, preservation of run files/index/refs, archive ambiguity and selection, comparison formats, and refusal before execution preflight. |
| 3 | Late-usage restoration passes saved Buffers through the atomic writer, preserves original absence and reports incomplete restoration while attempting the remaining file. Tests verify rejected hooks, identical-figure no-ops, result persistence, report restoration failures and both-chain CLI smoke checks. The reference and test index describe the implemented contract. Existing recovery, archive and execution coverage is included in the full gate. |

The writer audit accounts for `writeLog`, `writeReport`, `writeState`, initialization, outcome/rigor/provenance updates, neutral retry, start commits and late-usage restoration. Remaining direct filesystem writes in production scripts concern the separate lock protocol, execution probes or PR body files, not the three state targets. No production reader retains the former array-return assumption.

Comparison changes stay at log ingestion and diagnostic rendering; comparison arithmetic and failed-attempt semantics are unchanged. No dependencies, schemas, policy behavior or routing tiers were added. The final `AGENTS.md` edit limits test concurrency to two, matching the working-directory instructions supplied for this review. Planning/run bookkeeping and earlier branch setup were distinguished from the implementation scope. The pre-existing working-tree modification to the router-owned run log was left untouched.

## Verification

Environment: Node `v24.19.0`, macOS. `TMPDIR` and `GIT_CEILING_DIRECTORIES` point to a dedicated scratch parent inside this worktree. Existing test helpers clean their fixtures with `removeTree`.

- `node --test skills/10x-pipeline/test/run-state.test.mjs`: **PASS**, 78 tests, zero failures or skips (26.6 seconds). This includes both-chain init/status/report smoke checks and corruption refusal checks.
- `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`: **PASS**, exit 0; 1,362 tests, 1,359 passed, zero failed/cancelled, three skipped (508.2 seconds). This includes the plan's existing late-usage, result-persistence, rollback, step-commit, run-lock, Codex, archive and OpenSpec compatibility suites.
- Skips: two opt-in live GitHub checks (`GH_LIVE` unset), and the `CLAUDE.md` import guard because that file is absent. No live GitHub operations were performed.
- Environment diagnosis: the first full run had 1,346 passes, 13 failures and three skips. With the Git discovery boundary, all 90 tests in `executors`, `nested-subagents`, `neutral` and `rules` pass, as does the affected `score` case (`risk unavailable`). The corrected full gate is the acceptance run.
- `git diff --check`: **PASS**.
- Source/caller and documentation audit: **PASS**. The plan's Progress section was not edited.
- Report parser check: **PASS**. The production `readReview` reads `APPROVED`, zero critical/warning counts and no findings.

## Assumptions and limits

- Followed the supplied unattended review rules: performed both review passes locally, with no nested delegation or interactive triage. No findings require an owner decision.
- Used the repository-mandated concurrency limit of two for the full gate; this runs the same test files specified by the plan.
- The first full-suite invocation set only `TMPDIR`. Scratch projects without their own Git repository discovered the parent worktree, changing risk-based routing and failing existing executor/neutral-retry expectations. Reproduced the `no tier bump` failure (`implement` instead of `plan-review`) and verified it passes with `GIT_CEILING_DIRECTORIES` set to the scratch parent. The final gate uses that boundary, consistent with `gitEnv` in the existing test helper; no test-helper changes were made in this change's scope.
- Per-file atomic publication is the accepted contract. Power-loss durability, cross-file transactions and changes to the existing lock protocol remain outside scope, as documented in the plan and reference.
- No code fixes were necessary, so no fix commit was created. No recurring finding warranted a lesson candidate.
