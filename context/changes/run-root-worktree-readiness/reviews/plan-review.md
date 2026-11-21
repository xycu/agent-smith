<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Run Root Worktree Readiness Implementation Plan

- **Plan**: context/changes/run-root-worktree-readiness/plan.md
- **Mode**: Deep (single-agent; no sub-agent started because the step runs as a subagent)
- **Date**: 2026-11-21
- **Verdict**: REVISE
- **Findings**: 0 critical, 4 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | WARNING |
| Blind Spots | WARNING |
| Plan Completeness | PASS |

## Grounding

Grounding: 12/12 paths ✓ (prepare-run.mjs, run-identity.mjs, run-claude.mjs, run-codex.mjs, tests, REFERENCE.md, ADR-010, archived plan, WAVES.md), 8/8 symbols ✓ (`withSetupLock`, `readPending`, `writePending`, `copyChange`, `routerState`, `readIsolationPolicy`, `cleanup`, `spawn`), brief↔plan ✓, Progress↔Phase ✓ (1.1-1.2, 2.1-2.4 match the Success Criteria; no Automated row needs a pushed branch, PR or PR CI).

## Findings

### F1 — Gate runner needs async setup; plan assumes the synchronous path can close process groups

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architectural Fitness
- **Location**: Phase 2 — 1. Worktree gate execution
- **Detail**: `prepare`, `main` and `withSetupLock` in `prepare-run.mjs` are synchronous, and every child runs through `spawnSync` (`pr-common.mjs` `spawn`). `spawnSync` with a timeout kills only the direct child, and descendants that hold the pipes keep it blocked. The plan says to "reuse the process-group termination pattern" from `run-codex.mjs`/`run-claude.mjs`, which is an async `spawn` with a detached group. The plan never states that setup has to become async, and it has no signal handling, so a caller kill at 600 s could leave the lock file and an orphaned installer.
- **Fix**: State in the Phase 2 contract that `withSetupLock` awaits its operation, `prepare` and `main` become async, install and hook run through an awaited detached `spawn` with group SIGTERM then SIGKILL, SIGINT/SIGTERM terminate the active group and release the lock, and `cleanup` stays synchronous.
- **Decision**: APPLIED — Phase 2 "1. Worktree gate execution" contract rewritten as described.

### F2 — Freshness rule is undefined for a start that is not based on the default branch

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Blind Spots
- **Location**: Desired End State; Assumptions; Phase 1 — 1. Shared fresh-branch setup
- **Detail**: The gate compares the pinned `HEAD` with the remote's advertised default branch and stops when the default has commits the start lacks. A run started from a stacked or release branch cut from an older default would halt with a positive count, although the publication base selector (`docs/REFERENCE.md`, nearest eligible ancestor, then `<remote>/HEAD`) would pick that branch's own parent as the PR base. The plan offers no override, and the isolation opt-out disables the whole run isolation, not only this gate. The plan decides ahead/behind/diverged counts but not whether a non-default start is stale.
- **Fix A ⭐ Recommended**: Keep the strict default-branch rule, document in `docs/REFERENCE.md` that stacked or release-branch starts must integrate the default branch first, and say so in the Phase 1 contract.
  - Strength: Smallest change; matches the issue's "stop" option.
  - Tradeoff: Blocks legitimate stacked-branch runs with no escape hatch.
  - Confidence: MED — publication base selection suggests such starts exist, but no run is known to use them.
  - Blind spot: How often the owner starts runs from a non-default branch.
- **Fix B**: Add a per-project policy key (in `policy.json` defaults, overridable in `context/foundation/agent-smith-policy.json`) that turns the freshness gate off or names the integration branch.
  - Strength: Supports stacked and release workflows.
  - Tradeoff: New policy surface, docs and tests.
  - Confidence: MED — it follows the existing policy-override pattern.
  - Blind spot: Interaction with the isolation policy projection.
- **Decision**: PENDING — owner decides whether non-default starts are blocked (Fix A) or get an override or configurable base (Fix B); the plan cannot choose that scope.

### F3 — "Bound the whole preparation" has no concrete budget

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 — 1; Phase 2 — 1
- **Detail**: Every Git call already has its own 120 s deadline (`GIT_TIMEOUT_MS`). `ls-remote`, `fetch`, install and the hook run in sequence under one lock, and the caller kills setup at 600 s. Without one shared deadline, a slow remote followed by a cold install can exceed the caller's timeout and leave the lock and a half-finished state. The plan says "time left for termination" but names no budget or owner.
- **Fix**: Start one setup deadline at process start (600 s minus a termination reserve), cap each Git call at the smaller of 120 s and the remaining budget, pass the remainder to install and hook, and record the constant in `docs/REFERENCE.md`.
- **Decision**: APPLIED — Phase 1 contract (setup deadline sentence) and Phase 2 contract ("single setup deadline started in Phase 1").

### F4 — "declares dependencies" leaves the lockfile trigger undecided

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Assumptions and rationale (Auto-install)
- **Detail**: The plan requires a lockfile for a JS package "that declares dependencies" but never says which manifest fields count. A package with only `devDependencies` (vitest, the issue's own case) or only `workspaces` falls on the tie case.
- **Fix**: Name the fields: any entry in `dependencies`, `devDependencies`, `optionalDependencies` or `workspaces`.
- **Decision**: APPLIED — Assumptions and rationale, Auto-install bullet.

### F5 — Phase 2 bundles dependency, hook, timeout, recovery and docs work in one phase

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Lean Execution
- **Location**: Phase 2
- **Detail**: Phase 2 holds lockfile selection, dependency-boundary validation, the readiness hook, async process control, the copy-complete record, cross-chain tests and documentation under three Automated rows. A failure midway leaves no usable intermediate state to commit or review. Splitting into "gate execution" and "pending recovery plus docs" would give a smaller diff per phase, but it renumbers the Progress rows, which this review must not change.
- **Fix**: Split Phase 2 into two phases (gate execution; pending recovery, proof and docs) when the owner agrees to renumber Progress.
- **Decision**: PENDING — the split changes `## Progress` row indices and titles, which this step may not edit; the owner decides whether to renumber before implementation.

### F6 — Recovery when the committed readiness hook itself is wrong is unclear

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Migration Notes; Phase 2 — 2. Pending setup and recovery
- **Detail**: Migration Notes say that when the pinned committed hook must change, the operator should "preserve the failed worktree and carry the corrected commit into a fresh setup". The pending record, branch `agent-smith/<id>` and expected worktree path stay in place after a gate failure, so a second setup for the same change id resolves to the retained run, not a fresh one. The hook is read at the pinned branch point, so a retry cannot pick up a fix made in the original checkout. The plan names no command or id change that reaches a fresh setup. The first real use of a new hook is the likeliest time for this failure.
- **Fix A**: Retry re-reads the hook from the worktree's current HEAD, so the operator commits the fix inside the retained worktree and reruns.
  - Strength: One recovery path; keeps worktree edits.
  - Tradeoff: The hook then no longer comes from the pinned branch point, and the plan's provenance test changes.
  - Confidence: MED — it matches "gate-only retry reuses the worktree".
  - Blind spot: Policy provenance and trust of worktree-local edits.
- **Fix B**: Document a manual path (rename the change id or remove the registered worktree by hand) in `docs/REFERENCE.md`.
  - Strength: No router change.
  - Tradeoff: Pushes risky manual steps on the operator.
  - Confidence: LOW — removal rules in `AGENTS.md` forbid tooling help here.
  - Blind spot: Interaction with the pending record and branch lock.
- **Decision**: PENDING — owner decides which recovery path the plan supports; each choice changes the policy-provenance contract.
