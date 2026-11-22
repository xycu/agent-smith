<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Delegated Token Accounting

- **Plan**: context/changes/delegated-token-accounting/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-11-18
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 0 observations
- **Reviewed baseline**: b1ed1182; implementation range 08535793^..b1ed1182
- **Fix commit**: a9dc4fce492fd1d797889bedbcc35fcc10ee7ce9

Counts and verdict describe the implementation before these review fixes. All three findings are applied; none remains pending. Manual acceptance rows 4.3 and 4.4 remain unchecked and are not reclassified as automated proof.

## Verdicts

| Dimension | Verdict |
| --- | --- |
| Plan Adherence | FAIL |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS — automated gates; manual qualification pending |

The non-critical Plan Adherence failure reflects rejection of supported record formats and incorrect coverage labels. No security, destructive migration, settlement or ownership regression was found.

## Findings

### F1 — Codex child metadata is checked against the causal root

- **Severity**: WARNING
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped.
- **Dimension**: Plan Adherence
- **Location**: skills/10x-pipeline/scripts/codex-usage.mjs:73; skills/10x-pipeline/test/codex-helpers.mjs:66; skills/10x-pipeline/test/codex-usage.test.mjs:27 (reviewed baseline).
- **Detail**: App-server Thread.sessionId identifies its own thread, whereas persisted rollout session_id identifies the causal root. The collector required rootThreadId in both places, rejecting supported delegated records with missing-identity. Both fake metadata producers repeated that assumption. The retained codex-real-format-review.md documents the distinction and a successful corrected replay.
- **Fix**: Check metadata sessionId against item.id, keep persisted causal-root checks, correct both fixtures, and independently reject unrelated metadata sessions and incorrect persisted lineage.
- **Decision**: APPLIED — a9dc4fce492fd1d797889bedbcc35fcc10ee7ce9; collector and fixtures corrected, with three additional regressions.

### F2 — Claude rejects three documented native record formats

- **Severity**: WARNING
- **Impact**: MEDIUM — real tradeoff; pause to reason through it.
- **Dimension**: Plan Adherence
- **Location**: skills/10x-pipeline/scripts/claude-usage.mjs:46, :256, :274, :287, :312 (reviewed baseline); skills/10x-pipeline/test/claude-helpers.mjs.
- **Detail**: The collector accepts only decimal-string OTLP intValue, requires assistant_response for every API request, and assumes physically ordered user/assistant-only transcript links. The retained claude-real-format-review.md describes numeric integer exports, tool-only requests without text-response events, and UUID-linked attachments serialized out of parent order. Simplified fixtures concealed all three differences.
- **Fix**: Accept validated numeric/string safe integers; reconcile every transcript/API request and counter while validating optional text responses and requiring the terminal response; prove one complete final-to-launch UUID path through recognized attachments, rejecting missing, disconnected or cyclic history.
  - Strength: Implements the retained pinned-format evidence while preserving exact membership, attribution and terminal checks.
  - Tradeoff: Retains compact UUID links until the bounded transcript is read.
  - Confidence: HIGH — realistic shared fixtures pass collector and both-chain reader integration, with explicit negative controls.
  - Blind spot: Final interactive/headless live qualification remains pending.
- **Decision**: APPLIED — a9dc4fce492fd1d797889bedbcc35fcc10ee7ce9; collector, shared fixtures, twelve regression cases, reference documentation and adapter reproduction updated.

### F3 — Missing figures are falsely counted as legacy token usage

- **Severity**: WARNING
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped.
- **Dimension**: Safety & Quality
- **Location**: skills/10x-pipeline/scripts/usage.mjs:94 (reviewed baseline).
- **Detail**: usageCoverage increments legacy for every entry without evidence, including a pending step or an entry with only duration. A verified step followed by a pending dispatch therefore gains a legacy-scope explanation and potentially a usage-scope-mismatch reason despite having no legacy token figure. The newly supplied final-host-replay-review.md identified this scenario; local reader fixtures independently reproduced it.
- **Fix**: Increment legacy only when a valid token figure exists, including zero. Preserve missing counts and usage-incomplete refusals.
- **Decision**: APPLIED — a9dc4fce492fd1d797889bedbcc35fcc10ee7ce9; shared coverage helper corrected, both-chain status/report/compare regressions added, reference clarified.

## Scope and migration review

Persistence remains additive: router intake owns normalized evidence and numeric usage, collectors only read host sources, and structured late input fills missing tokens only for the exact stored invocation/source/version. Historical numeric records remain immutable; no archive ledger was rewritten or backfilled. Exact replay, rejected enrichment and archive failure recovery retain their existing contracts.

Both execution paths retain settlement and single-intake ownership. Missing accounting remains a successful unavailable measurement. Immediate, late and archive skill paths share collector semantics without polling; archive execution remains outside numbered totals. Reports and comparisons preserve missing versus zero, safe aggregation, mixed-scope refusal and enclosing-dispatch price labels.

ADR-024 and accounting-readers.test.mjs are justified extensions of the plan's documentation-consistency and integration requirements. No routing policy, version, dependency, publication or destructive migration change was introduced. Rollback remains a preserving follow-up commit after settlement, keeping stored evidence; older readers cannot assert verified scope for new/mixed records.

## Automated verification

Node v24.19.0. All commands were rerun after the final fix. Test scratch stayed inside the run root using the existing Git-discovery barrier at .claude/worktrees/accounting-hermetic; local output logs are under .claude/worktrees/accounting-tmp/impl-review-final-*.log.

| Criterion | Command | Result |
| --- | --- | --- |
| 1.1 | node --test skills/10x-pipeline/test/usage-evidence.test.mjs skills/10x-pipeline/test/result-persist.test.mjs | 36 passed |
| 1.2 | node --test skills/10x-pipeline/test/late-usage.test.mjs skills/10x-pipeline/test/run-state.test.mjs | 174 passed |
| 2.1 | node --test skills/10x-pipeline/test/codex-usage.test.mjs skills/10x-pipeline/test/codex-runner.test.mjs | 106 passed |
| 2.2 | node --test skills/10x-pipeline/test/codex-chain.test.mjs skills/10x-pipeline/test/run-lock.test.mjs | 30 passed |
| 3.1 | node --test skills/10x-pipeline/test/claude-usage.test.mjs skills/10x-pipeline/test/late-usage.test.mjs | 82 passed |
| 3.2 | node --test skills/10x-pipeline/test/skill-loop.test.mjs skills/10x-pipeline/test/nested-subagents.test.mjs skills/openspec-pipeline/test/openspec-skill.test.mjs | 98 passed |
| 4.1 | node --test skills/10x-pipeline/test/route.test.mjs skills/10x-pipeline/test/compare.test.mjs skills/10x-pipeline/test/cost.test.mjs | 110 passed |
| Additional integration | node --test skills/10x-pipeline/test/accounting-readers.test.mjs | 15 passed |
| 1.3, 2.3, 3.3, 4.2 | node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs | 1923 tests: 1920 passed, 0 failed, 3 skipped; 893488.466333 ms |
| 4.2 | node tools/version-check.mjs | Passed, 1.13.0 |
| 4.2 | git diff --check | Passed |
| Adapter reproduction | node context/changes/delegated-token-accounting/evidence/script-adapter-recheck.mjs | Passed; evidence/impl-review-adapter.log |

The three existing full-suite skips are two opt-in GH_LIVE checks and the optional CLAUDE.md import check. Publication and live host qualification are not inferred from these tests. Two early suite attempts were interrupted before the final changes; their logs are not acceptance evidence.

## Manual verification and assumptions

- Full coverage includes phases 1–4 as explicitly requested, even though Phase 4 Manual rows remain pending. Progress was not edited.
- Retained in-root format-review evidence supports the adapter fixes; current synthetic fixtures are independent regression proof, not captured telemetry.
- The separately supplied final-host-replay-review.md was read as external evidence and left unchanged. This reviewer did not reproduce its live token totals or launches.
- Rows 4.3 and 4.4 still require fresh final-candidate host/mode/entry-point qualification and inspection of immediate, late and archive behavior. Neither is rubber-stamped by this review.
- No owner decision is required for the three in-scope fixes.
- Read-only review children /root/plan_drift and /root/safety_review completed. The former subsequently edited only the three assigned Codex files; the latter checked the Claude correction read-only. Parent collected both, reconciled changes, ran gates and committed. Child-inclusive token coverage is unknown; no token total is inferred.

## Lesson candidate

Always reproduce documented native record shapes in adapter fixtures and keep live host qualification separate from fixture validation.

This repeated fixture mismatch occurred in both host adapters. Existing lessons were read first; no lesson file was changed.
