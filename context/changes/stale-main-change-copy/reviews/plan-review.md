<!-- PLAN-REVIEW-REPORT -->
# Plan Review — Archived-change guards and retained-input cleanup

- **Plan**: context/changes/stale-main-change-copy/plan.md
- **Mode**: Deep
- **Date**: 2026-11-14
- **Verdict**: REVISE
- **Findings**: 1 critical, 1 warnings, 0 observations

The verdict and counts describe the original plan. Both findings have been applied to the plan and brief. Implementation and live-host acceptance remain pending.

## Verdicts

| Dimension | Verdict |
| --- | --- |
| End-State Alignment | FAIL |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | PASS |

## Grounding

Grounding — 10/10 existing implementation/test/documentation paths verified, 6/6 symbols verified, brief↔plan consistent. The symbols are `paths`, `archiveDirs`, `archiveRoot`, `startCommit`, `copyChange` and `registeredWorktree`.

The original Progress section has three matching phases and 13 matching verification rows. Its headings, row indices, titles and ticked states are preserved by this review.

## Findings

### F1 — Full source cleanup blocks normal skill resumes

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff, pause to reason through it
- **Dimension**: End-State Alignment
- **Location**: Desired End State, Scope Boundaries, Phase 2 cleanup acceptance and Phase 3 skill integration
- **Detail**: The original plan removes every eligible source file and prunes empty directories while limiting skill changes to the stale-copy paragraph in Start step 3. Both skills require the original change inputs in Start step 2. Once cleanup removes those inputs, a later invocation from the original checkout calls `verify-archive` there, finds no archive before merge and stops with new-change guidance. It never reaches setup's existing branch-reuse path. The original CLI-only resume criteria can pass while the normal skill entry point is broken. The 10x check requires `change.md`, so retaining another file in the source directory also fails to preserve that entry point. [10x Start checks](../../../../skills/10x-pipeline/SKILL.md#L37) [OpenSpec Start checks](../../../../skills/openspec-pipeline/SKILL.md#L39) [Existing setup selection](../../../../skills/10x-pipeline/scripts/prepare-run.mjs#L169)
- **Evidence**: Real CLI fixtures for both chains initialized isolated runs, then moved their original source folders aside to simulate their absence. Original-root archive verification returned `archived: false`, while setup successfully returned `case: reused` and the original run root. The existing setup mechanism already supplies the needed resume behavior.
- **Fix**: Move the change-folder existence checks after setup selects the run root, retaining early project/tooling checks and existing archive/new-change guidance. Add fresh-source validation before setup writes an exclude or creates a branch/worktree, allowing missing-source failures to use the original-root diagnostic fallback without leaving resources. Cover both-chain source-absent reuse/attachment, missing fresh inputs and skill-check ordering in the existing test files.
  - **Strength**: Reuses setup's existing selection logic and preserves original-checkout resumes after complete cleanup.
  - **Tradeoff**: Extends skill edits to the change-existence checks in Start step 2 and adds an earlier validation in the existing setup executable.
  - **Confidence**: HIGH — both-chain scratch reproductions establish that setup resumes correctly once the early skill check is bypassed.
  - **Blind spot**: Live-host execution of the revised skill instructions remains a pending Manual check.
- **Decision**: APPLIED — updated Desired End State, Scope Boundaries, Assumptions and decisions, Phase 2 Cleanup invocation and safety checks, Phase 2 Real Git cleanup acceptance, Phase 3 Replace the stale-copy instruction, Phase 3 Skill contracts and reference text, and Migration Notes. Synchronized the brief's Desired End State, Key Decisions Made, Scope and Architecture / Approach.

### F2 — Successful terminal initialization bypasses cleanup

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision, fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Desired End State, Timing and retention, Phase 2 acceptance and Phase 3 cleanup invocation
- **Detail**: The original plan gates cleanup exclusively on `init` returning `action: run`. A freshly created 10x worktree can already contain completed Progress and fresh plan/implementation reviews. Its first `init` creates a start commit and immediately returns `done`, or `archive` when requested. The original action gate therefore leaves an eligible untracked source copy behind even after successful initialization. The router creates the start commit before deciding which action to return. [Start-commit ordering](../../../../skills/10x-pipeline/scripts/route.mjs#L1028) [Terminal action selection](../../../../skills/10x-pipeline/scripts/route.mjs#L162)
- **Evidence**: Separate fresh-worktree CLI fixtures returned `done` and `archive` with valid `meta.startCommit` values while their source copies remained present. The archive fixture included the required `created` frontmatter and confirmed start-commit reachability from the run branch. An initial archive fixture without that required field halted, confirming that halted initialization must continue skipping cleanup.
- **Fix**: Permit fresh-only cleanup after successful `run`, `done` and `archive` responses, before launching a step, performing terminal reporting/PR handling or dispatching archival respectively. Preserve the start-commit verification and halted/resume exclusions. Add immediate-terminal initialization coverage using the existing setup and skill test files.
- **Decision**: APPLIED — updated Desired End State, Timing and retention, Phase 2 Real Git cleanup acceptance, Phase 3 Replace the stale-copy instruction, Phase 3 Skill contracts and reference text, and Migration Notes. Synchronized the brief's Desired End State, Cleanup timing decision and Architecture / Approach.

## Verification

- Ten selected existing setup, archive and skill tests passed with zero failures or skips. The selection covered six-case precedence, prepare→real-init lifecycles, archived-only rejection, existing live/archive behavior, dated OpenSpec names and both Start step 3 contracts. The baseline command used Node v24.19.0.
- Four successful scratch cases established source-absent setup reuse in both chains and immediate `done`/`archive` initialization in 10x. The archive check ran on Node v26.13.1. All scratch fixtures lived inside this worktree and were removed through the existing checked teardown helper.
- Reviewed archive matching, chain resolution, init mutation ordering, start-commit retention, setup locking/copying and both skill entry points directly. The shared state guard and standalone spawn helper already support the plan's existing ownership and binary-input approach.
- Reviewed the diff and checked the saved report through the router's review parser. Progress is byte-identical to its pre-review version, measured counts remain 1 critical and 1 warning, and both findings are closed as APPLIED.

The focused baseline command was

```sh
cd "/Users/blazej/WebstormProjects/agent-smith/.claude/worktrees/agent-smith-stale-main-change-copy" && TMPDIR="$PWD/context/changes/stale-main-change-copy" node --test --test-concurrency=2 --test-name-pattern="six cases|prepare then real init|only the archive folder|live folder with a same-named archive|date-prefixed id|Start step 3" skills/10x-pipeline/test/prepare-run.test.mjs skills/10x-pipeline/test/archive.test.mjs skills/openspec-pipeline/test/openspec-archive.test.mjs skills/10x-pipeline/test/skill-loop.test.mjs skills/openspec-pipeline/test/openspec-skill.test.mjs
```

## Assumptions and remaining verification

- Source-absent resume compatibility requires changing the existing skills' change-existence checks along with their cleanup paragraph. Wave 5's parallel skill change owns frontmatter, and its other changes own CI, policy or the deletion guard, so this prerequisite remains in the same files with independent edit regions. The setup case ordering and runtime JSON schema stay as documented. [Wave 5 ownership](../../WAVES.md#wave-5-owner-decisions-and-guards-5)
- The unattended instruction supplies triage authorization. Every finding with a clear fix was applied, and no finding requires an owner decision.
- The complete repository suite and live-host acceptance remain implementation gates. This review verifies the plan against existing behavior and leaves the implementation Progress rows pending.
