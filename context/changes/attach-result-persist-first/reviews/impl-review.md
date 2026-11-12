<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Persist the step result before deleting last-result.json

- **Plan**: context/changes/attach-result-persist-first/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2
- **Date**: 2026-11-12
- **Verdict**: APPROVED
- **Findings**: 0 critical 0 warnings 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

Evidence: the `flow.mjs` diff is exactly the planned move (early `fs.rmSync` removed; `writeLog(p.log, log)` then `fs.rmSync(p.result)` after `last.finishedAt`, one why-comment, `delete last.pendingPrompt` kept). No `AGENTS.md`, `route.mjs`, policy or SKILL.md edit. `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`: 1118 tests, 1115 pass, 0 fail, 3 skipped. `result-persist.test.mjs`: 2 pass. `status` on a scratch id prints valid JSON. Manual 2.4 (CI green on the PR) is pending by design.

## Findings

### F1 — Isolated test checks recovery weakly

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: skills/10x-pipeline/test/result-persist.test.mjs (isolated case, end)
- **Detail**: After the restore the isolated test only asserted exit 0 and no "has no result" halt. It did not assert that `next` routed on or that the first entry kept its result.
- **Fix**: Add `assert.equal(again.json.action, "run")` and a check that entry 1 still holds `first.result`.
- **Decision**: APPLIED in d5c3d91

### F2 — Stale last-result.json after a crash between writeLog and rmSync

- **Severity**: OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: skills/10x-pipeline/scripts/flow.mjs:557-559
- **Detail**: The plan names this residual window. If the process dies between `writeLog` and `rmSync`, the next `next` skips `attachResult` (`last.result` is set) and the file stays. The following step's `attachResult` then finds a result file even when the orchestrator wrote none, and reads the stale one as its own. An isolated run's `stepCommit` could also commit it. The window is two adjacent synchronous calls, so the risk is small, and the old order lost the whole result.
- **Fix**: Out of scope per "Residual window, not handled". A later change could remove a stale result file on the skip path (`last.result` set and file present) in `next`.
- **Decision**: PENDING — outside the plan's scope and a router-behavior change; the owner decides whether the stale-file cleanup deserves its own change.
