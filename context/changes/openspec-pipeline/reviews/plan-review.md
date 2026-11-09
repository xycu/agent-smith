<!-- PLAN-REVIEW-REPORT -->
# Plan Review: OpenSpec Chain on the Shared Router Implementation Plan

- **Plan**: context/changes/openspec-pipeline/plan.md
- **Mode**: Deep (direct code verification, no sub-agent)
- **Date**: 2026-11-09
- **Verdict**: REVISE
- **Findings**: 1 critical, 3 warnings, 2 observations

Counts and verdict are as measured on the plan before the fixes below were applied.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | WARNING |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | FAIL |

## Grounding

Grounding: 12/12 paths and anchors checked (`state.mjs:190-242`, `:425`, `flow.mjs:329`, `:445`, `steps.mjs:501-627`, `isolation.mjs:357-401`, `:489-520`, `route.mjs:229-298`, `:563`) ✓, symbols (`readPlan`, `archiveDirs`, `guardArchived`, `ignoredProbePaths`, `timedFiles`, `simpleSignal`, `promptText`, `render`) ✓, brief↔plan ✓ (one stale line in the brief, fixed with F1), Progress↔Phase rows 1.1-5.6 ✓.

## Findings

### F1 — Plan claims an unedited existing suite, but the new policy keys break two tests and the wiring window breaks a third

- **Severity**: CRITICAL
- **Impact**: MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Overview, Testing Strategy, Phase 2 (row 2.2 "Full suite passes"), Phase 1 guides
- **Detail**: `ladder.test.mjs:116` asserts `Object.keys(policy.steps)` equals the keys of `PINS`; `advisor.test.mjs:295` asserts every key of `policy.prompts` outside `NOT_TEMPLATES` has a case. Phase 2 item 5 adds four steps and five templates, so both fail and row 2.2 cannot pass, while the plan says the existing suite stays green and unedited. `preplan.test.mjs:122` ("every prompt file is wired or documented as not wired") also fails between Phase 1 (guides created) and Phase 2 (guides referenced from `policy.json`). `plan-brief.md` repeats the "unedited" claim.
- **Fix**: Name the data-only edits of `ladder.test.mjs` (four `PINS` entries) and `advisor.test.mjs` (the five `os-` templates excluded from the advisor-case set) as Phase 2 item 7, reword the "unedited" statements, and note in Phase 1 that only `rules.test.mjs` runs there.
- **Decision**: APPLIED — plan.md: Overview, Current State Analysis (new bullet), Phase 1 Implementation Note, Phase 2 item 7 (new), Testing Strategy; plan-brief.md: line 75. Progress rows untouched.

### F2 — The fix-loop halt cannot be left: the verdict is read from the log copy while the halt tells a human to edit verify.md

- **Severity**: WARNING
- **Impact**: MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 3, item 2 (Verdict routing)
- **Detail**: `decideOpenspec` reads the last verified `os-verify` "from its log entry". After a `FAIL` at the `maxFixLoops` cap the run halts with the path of `verify.md`, but a resume reads the same stored `FAIL` and fix-loop count, so it halts again whatever the human fixes or edits. The 10x chain avoids this by reading review files live (ADR-011); `run.jsonl` must not be edited by hand.
- **Fix**: Read the verdict from `verify.md` itself in `decide` (log copy only for `status` and the report), name the way back in the halt text (set `Verdict: PASS`, `Critical: 0`, commit in the worktree, run again) and add a test for it.
- **Decision**: APPLIED — plan.md: Phase 3 item 2 (Verdict routing) and the Phase 3 steps test list.

### F3 — Chain detection falls back to 10x once the OpenSpec run is archived

- **Severity**: WARNING
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2, item 3 (Chain switch in the commands); Phase 4 archive tests
- **Detail**: Without `--chain`, a command reads `openspec/changes/<id>/agent-smith/meta.json`. After the move that folder is gone, so the chain reads as `10x` and `next`/`status` report a missing `context/changes/<id>`. The Phase 4 test "`next` after the move halts as archived" cannot hold without the flag.
- **Fix**: Fall back to the archive folder's `agent-smith/meta.json` (via the archive folder of `archiveDirs`) when the live folder is gone, and test it in Phase 2.
- **Decision**: APPLIED — plan.md: Phase 2 item 3 (second bullet) and the Phase 2 chain test list.

### F4 — `{findings}` has no path into the prompt

- **Severity**: WARNING
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3, item 2
- **Detail**: `render` replaces an unknown `{placeholder}` with an empty string, and `next()` in `route.mjs` builds a fixed `vars` object. Phase 3 lists only `openspec.mjs` and `flow.mjs`, so the `os-apply-fix` prompt would go out without the findings.
- **Fix**: Add `route.mjs` to the file list and `findings: d.findings ?? ""` to `vars`; the existing prompt-content test then covers it.
- **Decision**: APPLIED — plan.md: Phase 3 item 2 (File and Contract).

### F5 — Hedged step-filter instruction for the report section

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3, item 1
- **Detail**: "extend that section's step filter if it lists step names" leaves a check to the implementer. `flow.mjs:159` and `route.mjs:555` select by `isObject(e.review)`, so no filter exists; `reviewRecord` reads `### F<n>` blocks, so the OpenSpec entry needs its own record.
- **Fix**: State that no filter change is needed and that the record is built separately.
- **Decision**: APPLIED — plan.md: Phase 3 item 1 (os-verify contract).

### F6 — ADR-013 D4/D5 wording no longer matches the planned mechanism

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 5, item 3 (ADR-013)
- **Detail**: ADR-013 says a passing verdict makes the router "return `os-archive`" and that the verdict is a stored file result; the plan ends in `done` and the router's `archive` action (no log entry for the archive step, as in 10x) and reads `verify.md` live (F2).
- **Fix**: Add the D4/D5 rewording to the ADR edit of Phase 5.
- **Decision**: APPLIED — plan.md: Phase 5 item 3 (Documentation and manifests, ADR-013 clause).
