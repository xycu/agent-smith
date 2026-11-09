<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Neutral Orchestrator Retry Implementation Plan

- **Plan**: context/changes/neutral-orchestrator-retry/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-11-09
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Evidence

- Diff `8cc6d9c..HEAD`: every planned file changed (`policy.json`, `route.mjs`, `flow.mjs`, `neutral.test.mjs`, both `SKILL.md`, `docs/REFERENCE.md`, `AGENTS.md`, ADR-015); no unplanned code file. `helpers.mjs`, `compare` and the `archive` path are untouched, as the plan's "What We're NOT Doing" requires.
- `neutralRetry` (`flow.mjs`) matches the contract: runs after `checkPrompts` and before `attachResult`, falls through for no pending entry, a non-matching status and a cap of 0; plain `halt()` with the file left for an entry without `pendingPrompt`; `endRun` at the cap after consuming the file; rerun keeps `n`, tier, `startedAt`, `startSha`, `before` and prints the stored prompt with `neutralRetry: { count, cap }`; stale `meta.outcome` removed.
- `pendingPrompt` set in `next()` before `log.push`, deleted in `attachResult` right after the file is read; `status` and the report build rows field by field, so it never leaks there.
- Automated: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` passes; `neutral.test.mjs`, `skill-loop.test.mjs`, `openspec-skill.test.mjs` and `rules.test.mjs` pass (42/42); `node tools/version-check.mjs` OK (1.1.1). Scratch `init`, `orchestrator-error`, `next`: identical prompt and tier, `neutralRetry {count:1, cap:2}`, `status` row shows `neutralRetries: 1`.
- Manual rows 1.4, 1.5, 2.4, 2.5, 3.4, 3.5 are ticked with evidence files under `evidence/`.

## Findings

### F1 — A subagent RESULT with status orchestrator-error is copied untouched and becomes a neutral rerun

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: skills/10x-pipeline/SKILL.md:56, skills/openspec-pipeline/SKILL.md:64 (step 3 of the `run` branch)
- **Detail**: Step 3 tells the orchestrator to copy the subagent's `RESULT:` JSON untouched. A subagent whose own nested tool call failed could report `"status":"orchestrator-error"`; the orchestrator would copy it, and the router, which cannot tell who wrote the file, would rerun the step neutrally. A model fault would then cost no failed attempt, no tier bump and no rigor rise, up to the cap. The plan (D6, "No automatic `done` from files ... the router never trusts an orchestrator's claim") keeps model faults as failed attempts and makes the status the orchestrator's declaration only.
- **Fix**: In step 3 of both skills, add that only the orchestrator declares `orchestrator-error` (in step 2), so a subagent `RESULT:` line carrying that status is written as `unknown` with its other keys kept; mirror the rule in `docs/REFERENCE.md` ("Faults that stay failures") and ADR-015 D6.
- **Decision**: APPLIED — fixed in both skills, `docs/REFERENCE.md` and ADR-015 D6 in commit 66473e1 (`fix(neutral-orchestrator-retry): treat a subagent orchestrator-error status as unknown`); full suite 878 tests, 0 fail, 2 skipped.

### F2 — A subagent that stages run.jsonl commits the pending prompt

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: skills/10x-pipeline/scripts/route.mjs (entry creation, `entry.pendingPrompt = prompt`)
- **Detail**: `run.jsonl` holds `pendingPrompt` on disk while a step runs. The step commit rewrites the log first, as planned, but a step subagent that stages the whole tree (`git add -A`) would commit `run.jsonl` with the prompt in its own commit. None of this run's commits holds it (checked every commit of `8cc6d9c..HEAD`). The prompt is already in the orchestrator's conversation and the commit is local, the same reasoning the plan accepts for the rollback snapshot, so no code change is needed.
- **Decision**: PENDING — no clear fix inside the plan's scope; the owner decides whether `docs/REFERENCE.md` should name this case next to the accepted rollback-snapshot exception.
