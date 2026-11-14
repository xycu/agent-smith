<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Store the --pr-comment request in meta.json Implementation Plan

- **Plan**: context/changes/pr-comment-flag-in-meta/plan.md
- **Mode**: Deep (done by the reviewer itself; no sub-agent, because the run is a subagent)
- **Date**: 2026-11-13
- **Verdict**: REVISE
- **Findings**: 0 critical, 3 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | WARNING |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

Grounding: 14/14 paths and line anchors checked (route.mjs:831 INIT_FLAGS, flow.mjs:316-337 finishRun, isolation.mjs archiveDone and its five direct out() calls, status at route.mjs:636, route.test.mjs:697, skill-loop.test.mjs:136, openspec-skill.test.mjs:192, pr-comment.test.mjs:722-790, REFERENCE.md:386-396, README.md:69, ADR-003 "### PR comment" with seven GIVEN lines, helpers) ✓, symbols ✓, brief↔plan ✓, Progress↔Phase consistency ✓ (3 phases, 4+4+5 rows, headings match). Plan assumptions confirmed in code: every ordinary done/halt goes through `endRun` -> `finishRun`; the archive path prints with `out()` directly.

## Findings

### F1 — Five hand-written spreads in archiveDone, one of them tested

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architectural Fitness
- **Location**: Phase 1 — 2. Outputs and 3. Tests; Key Discoveries
- **Detail**: The rule "`prComment` is `true` or absent" would be written at seven sites (finishRun, status, five `out()` calls). The brief names a missed direct `out()` path as the key risk of Phase 1, yet the test contract covers one direct halt, described as "kind-B ... failing pre-commit hook". That fixture is kind C (`archive.test.mjs:716`, `SKIP_FAILED`, `isolation.mjs:687`). Kind B (`:617`, `archive.test.mjs:925`) and kind D (`:688`, `:901`) are untested, and the report-error halt (`:677`) has no fixture.
- **Fix**: One helper `prCommentField(meta)` in `state.mjs` that `finishRun`, `archiveDone` and `status` spread; name the kind B, C and D fixtures in the test contract.
  - Strength: The rule lives once; the unreachable report-error path is correct by construction. No import-order change (`flow.mjs` and `isolation.mjs` already import `state.mjs`).
  - Tradeoff: One more exported function.
  - Confidence: HIGH — `out`, `halt` and `readMeta` already live in `state.mjs`.
  - Blind spot: None significant.
- **Decision**: APPLIED — Phase 1 "2. Outputs" Intent, "3. Tests" Contract and Key Discoveries of `plan.md`; the Key Decisions row of `plan-brief.md`.

### F2 — Criteria 2.3 and 3.3 cannot pass once the plan's own tests exist

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3 — Success Criteria (3.3); Phase 2 — 3. Skill content tests
- **Detail**: 3.3 runs `grep -rn "TaskList\|TaskCreate\|TaskUpdate\|TODO_TOOLS\|task list unavailable" ... skills ...` and expects no output. `skills/` includes `skills/10x-pipeline/test/`, and Phase 2 adds assertions that name `TaskCreate`, `TaskUpdate` and `TaskList` (archive-gate, pr-comment tests). The grep would print those lines, so 3.3 fails at the end of the run. The Progress row text may not change, so the fix goes into the test contract instead.
- **Fix**: State in the Phase 2 test contract that no test file spells the three tool names or `task list unavailable` as a literal; absence assertions build the name from parts.
- **Decision**: APPLIED — Phase 2 "3. Skill content tests" Contract of `plan.md`.

### F3 — AGENTS.md lists the init flags and is not updated

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3 — 1. Reference and README
- **Detail**: `AGENTS.md` Commands documents `init <id> --goal ... [--archive] [--chrome false] [--chain openspec]`. After Phase 1 `init` reads `--pr-comment`, and it halted on it before. The plan updates README and REFERENCE but not this line, which every agent session loads. The file is 10681 of 12288 bytes (`tools/test/agents-md-size.test.mjs`), so one flag fits.
- **Fix**: Add `AGENTS.md` to the Phase 3 files and add `[--pr-comment]` to that line.
- **Decision**: APPLIED — Phase 3 "1. Reference and README" Files and Intent of `plan.md`.

### F4 — "Halt carries prComment" scope and one REFERENCE sentence are imprecise

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: What We're NOT Doing; Phase 3 — 1. Reference and README
- **Detail**: The plan excludes only `halt()` "before any run state exists". Two more halts print outside `finishRun`: `attachResult` "has no result" (`flow.mjs:487`) and "logged without a stored prompt" (`flow.mjs:365`). They occur with run state, carry no `prComment`, and previously reached the skill's `no report` line. Also `REFERENCE.md` says "The orchestrator prints a `PR comment:` line when the flag was given. A missing line means the step was dropped.", which is no longer true for those halts.
- **Fix**: Widen the exclusion bullet to name them, and reword the REFERENCE sentence to "when the output has `prComment: true`".
- **Decision**: APPLIED — "What We're NOT Doing" and Phase 3 "1. Reference and README" Intent of `plan.md`.

### F5 — The ADR amendment omits the consequence of a sticky opt-in

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 3 — 2. ADR-003 amendment
- **Detail**: The original ADR chose a session task so the request "cannot leak to another run or change". With `meta.json` the request persists: a resume without the flag, in any session, still posts the goal text and report to collaborators. This matches `--archive`, and `--pr-comment false` turns it off, but the amendment, which records the trade, does not say so.
- **Fix**: Add a consequence sentence to the amendment.
- **Decision**: APPLIED — Phase 3 "2. ADR-003 amendment" Intent of `plan.md`.
