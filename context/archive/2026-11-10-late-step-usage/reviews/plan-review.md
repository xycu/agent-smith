<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Late Step Usage Figure Implementation Plan

- **Plan**: context/changes/late-step-usage/plan.md
- **Mode**: Deep (done in this subagent, no sub-agent launched per orchestrator note)
- **Date**: 2026-11-10
- **Verdict**: SOUND
- **Findings**: 0 critical, 1 warnings, 4 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | PASS |

## Grounding

Grounding: 12/12 paths and symbols checked ✓ (`cleanUsage` flow.mjs:364, `attachResult` :446, `writeReport` :267, `routerCommit`, `gitSafety`, `runBranchReason`, `archiveDone`, `rollback`, `writeState`, `guardArchived`, `missingChangeReason`, `parseFlags`), brief↔plan ✓, Progress↔Phase rows ✓ (13 rows, one heading, no checkboxes in phase bodies). Rollback survival claim verified: `rollback`/`undoRollback` write back the log `next` read from disk. Existing tests that the plan touches (`skill-loop`, `openspec-skill`, `archive-gate`) checked: the halt branch regex `Before you STOP, do the pull request step. Then call TaskList.` stays valid if the `usage` call is placed before it.

## Findings

### F1 — Step number of a late figure is never tied to its subagent

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 3 — 1. 10x skill, `done` and `halt` branches
- **Detail**: The router accepts a figure for any executed entry that has a result and no figure. A wrong `<n>` (the orchestrator picks the step of another notification) is attached silently and corrupts report, cost and `compare`. The plan does not say where the orchestrator gets `<n>`.
- **Fix**: Say in the branch text that `<n>` is the `n` of the `Step <n>` line printed when the subagent whose notification carried the figure was launched.
- **Decision**: APPLIED — Phase 3, 1. 10x skill, `done` and `halt` branch bullet.

### F2 — Phase 1 would dirty the change folder in the archive state

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — 2. The command, ended-run rule
- **Detail**: Phase 1 rewrites `report.md` for every ended run, with the folder commit only in Phase 2. Between the phases an ended `--archive` run in the archive state would get an uncommitted `report.md`, and `/10x-archive` refuses an uncommitted folder.
- **Fix**: Phase 1 refuses in the archive state (nothing written) and pins it with a test; Phase 2 replaces the refusal.
- **Decision**: APPLIED — Phase 1, 2. The command, Contract (interim guard bullet).

### F3 — Archive state is also true after a failed pre-archive commit

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2 — 2. Commit helper, `lateUsagePrecheck`
- **Detail**: `archiveDone` calls `finishRun` (outcome `done`) before `git add`; a failed add or commit halts with no `archive` action. `meta.outcome.action === "done" && meta.archive === true` then holds, the folder is dirty, and the refusal text blames "the archive may have started". Safe, but misleading.
- **Fix**: Name both causes in the refusal text.
- **Decision**: APPLIED — Phase 2, 2. Commit helper, `lateUsagePrecheck` contract.

### F4 — A refusal exits 1, which the orchestrator may read as a fault

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 3 — 1. 10x skill
- **Detail**: `usage` exits 1 on `attached: false`. A Bash error could push the orchestrator toward an `orchestrator-error` result or a retry. The plan says only "a refusal never changes the run".
- **Fix**: State in the branch text that the exit 1 is no orchestrator fault and writes no result file.
- **Decision**: APPLIED — Phase 3, 1. 10x skill, `done` and `halt` branch bullet.

### F5 — `<n>` must be the first argument after the id

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — 2. The command, Arguments
- **Detail**: `parseFlags` skips positionals, so `<n>` is `rest[0]` only when it directly follows the id. With a flag first the command refuses (fail closed), but the contract did not say so.
- **Fix**: State the position in the Arguments contract.
- **Decision**: APPLIED — Phase 1, 2. The command, Contract (Arguments bullet).
