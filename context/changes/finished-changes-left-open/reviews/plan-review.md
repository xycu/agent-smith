<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Report a stale change.md status when a run ends done

- **Plan**: context/changes/finished-changes-left-open/plan.md
- **Mode**: Quick (no sub-agent; claims checked inline against the code)
- **Date**: 2026-11-12
- **Verdict**: SOUND
- **Findings**: 0 critical, 1 warning, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | PASS |

## Grounding

Grounding: 8/8 paths and symbols checked (`route.mjs` done line 148-151, `frontmatterField` at `state.mjs:371`, `doneNotes` at `steps.mjs:255`, `finishRun` allowlist for `meta.outcome` at `flow.mjs:316`, `SKILL.md` done branch, `archive-gate.test.mjs:19` slicer, `openspec-skill.test.mjs` and `skill-loop.test.mjs` done checks, `docs/REFERENCE.md` archive bullets) ✓, brief↔plan ✓, Progress↔Phase rows 1.1-1.5 and 2.1-2.6 ✓. `finishRun` copies only `action`, `reason`, `manualPending` and `doneNotes` into `meta.outcome`, so `changeStatus` stays out of the stored files as the plan claims. No existing test compares whole `done` objects.

## Findings

### F1 — Closing commands in an isolated run lack the run root

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2 — Skill text, change 2 (10x skill)
- **Detail**: Every run is isolated by default (ADR-010, `isolation.require`), so at `done` the change folder with its stale status lives in the worktree on `agent-smith/<id>`, and the main checkout keeps the old copy until the branch merges. The planned text names `/10x-archive <change-id>` and a `--archive` rerun without saying where to run them. A user who runs them from the main checkout archives the wrong copy or starts a second run. The `archive` branch of the same skill handles this with "the worktree notes of Start step 3"; the `done` text had no equivalent.
- **Fix**: Add a third sentence: when the run root is not `<root>`, say both commands run from the run root (the worktree), because the status lives on the run branch. Add the phrase to the content test.
- **Decision**: APPLIED — Phase 2 "Skill text": change 1 (content test bullet now matches `both commands run from the run root`) and change 2 (Intent now has three sentences, the third is the run-root note); `plan-brief.md` Skill wording row updated.

### F2 — Printed line says "was not updated by the run", which can be false

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 — Skill text, change 2; `plan-brief.md` Key Decisions
- **Detail**: A step may have set an intermediate status such as `implemented` (which `/10x-archive` accepts). "change.md was not updated by the run" then misstates what happened. The fixed wording is pinned by a content test, so it is cheaper to correct now.
- **Fix**: Use `Change status: <changeStatus or missing>, expected impl_reviewed. The run did not set change.md to that status.`
- **Decision**: APPLIED — Phase 2 "Skill text" change 2 Intent (printed line reworded); `plan-brief.md` Skill wording row.
