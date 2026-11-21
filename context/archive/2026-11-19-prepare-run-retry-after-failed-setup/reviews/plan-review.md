<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Finish the change-folder copy on setup retry

- **Plan**: context/changes/prepare-run-retry-after-failed-setup/plan.md
- **Mode**: Deep (document and targeted code grounding, no sub-agent)
- **Date**: 2026-11-21
- **Verdict**: REVISE
- **Findings**: 0 critical, 1 warnings, 1 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS |
| Plan Completeness | WARNING |

## Grounding

Grounding: 6/6 paths ✓, 3/3 symbols (`copyChange`, `withSetupLock`, setup lock key) ✓, brief↔plan ✓. Progress block matches Phase 1 criteria; no criterion depends on publication.

## Findings

### F1 — Pending-record location and shape left to the implementer

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1, change 1 (Setup executable) Contract
- **Detail**: The plan says the intent lives in the Git common directory under the setup lock but names no file, format or write method. The lock uses `agent-smith-setup-<encodeURIComponent(branch)>.lock`. Tests and docs both need the exact name, and a partial write would read as unreadable intent.
- **Fix**: Name the file `agent-smith-setup-<encoded branch>.pending`, JSON with the listed fields, written to a temp name and renamed.
- **Decision**: APPLIED — Phase 1, change 1 Contract.

### F2 — Doc sweep for old `reused` behavior not listed

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1, change 3 (Worktree documentation)
- **Detail**: Lesson "Grep every doc for the old behavior when a script's output changes" applies: `docs/REFERENCE.md` lines 147-154 and the setup step of both `SKILL.md` files describe reuse and cleanup eligibility, and `reused` can now carry `copied: true`.
- **Fix**: Add an explicit doc grep to change 3.
- **Decision**: APPLIED — Phase 1, change 3 Contract.
