<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Forbid nested subagents in pipeline steps Implementation Plan

- **Plan**: context/changes/no-nested-subagents/plan.md
- **Mode**: Deep (done in this subagent; no nested subagent, per the orchestrator note)
- **Date**: 2026-11-10
- **Verdict**: REVISE
- **Findings**: 0 critical, 3 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

Grounding: 14/14 paths and line refs checked ✓ (policy.json suffix, route.mjs:174-178, isolation.mjs:637, executors.test.mjs:273-274, advisor.test.mjs:476, the three "exactly five" tests, REFERENCE.md Limits and anti-stall, AGENTS.md:50, ADR-016 headings), brief↔plan ✓, Progress↔Phase rows ✓ (6+1, 6+1, 6+2 match the Success Criteria). Four test or doc references were not in the plan (F1, F2). `docs/reference/contract-surfaces.md` does not exist, so that check was skipped.

## Findings

### F1 — Existing test pins six suffix rules and breaks in Phase 1

- **Severity**: WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1, Changes Required (test updates); Testing Strategy
- **Detail**: `skills/10x-pipeline/test/route.test.mjs:581-590` ("the plan prompt carries the six rules and the RESULT line with signals") counts the `- **GIVEN**` lines of the plan prompt, which are the suffix rules, and asserts 6. The new suffix line makes it 7, so Phase 1's whole-suite check (1.6) fails. The plan updates three "exactly five" tests in Phase 2 but never mentions this one.
- **Fix**: Add a Phase 1 change: title says seven, `assert.equal(rules.length, 7)`, existing `rules[0..3]` assertions keep their indexes, add one assertion for `rules[6]`. Name the file in Testing Strategy.
- **Decision**: APPLIED — added Phase 1 "#### 7. Existing test that counts the suffix rules" and the `route.test.mjs` entry under Testing Strategy, Unit Tests.

### F2 — AGENTS.md lines that say "five" are left false

- **Severity**: WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3, change 3 (AGENTS.md)
- **Detail**: The contract says "No other line changes", but `AGENTS.md:27` (`archive-gate.test.mjs` ... "five `**GIVEN**` lines") and `AGENTS.md:29` (`skill-loop.test.mjs` ... "five rules in order") describe tests that the plan changes to six. Following the plan literally leaves the contributor guide false.
- **Fix**: Add those two bullets to the AGENTS.md contract and say they change to six.
- **Decision**: APPLIED — Phase 3, change 3 (AGENTS.md), Contract.

### F3 — The sixth anti-stall rule gives no way to tell a foreign hand-back from the step's own

- **Severity**: WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 2, change 1 (the sixth rule)
- **Detail**: The rule triggers on "a subagent the orchestrator did not launch for the current step". The plan never says how the orchestrator knows that. The orchestrator sees a hand-back message, not a process tree, so a rule without a test for "own" is one it can follow either way. Open Risks names the limit but the contract does not constrain the wording to something checkable.
- **Fix**: Define "own" in the rule: the result of the Agent call it made for this step, or the task notification that names that call's subagent. Anything that names another subagent, or none it can match, is foreign. The wording must not assume it can see the foreign author.
- **Decision**: APPLIED — Phase 2, change 1 (The sixth rule and the section intro), Contract.

### F4 — An unwired prompt still demands three subagents

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1, change 5 (`prompts/README.md`)
- **Detail**: `prompts/refactor-opportunities-research.md:12-20` says **MUST** "run three read-only exploration subagents". It is not wired, so no run meets it today, but anyone who wires it later reintroduces the contradiction with the suffix. The plan fixes `research-with-map.md` only.
- **Fix**: Note it in the `Not wired` row of the README (a clause in the last cell), leave the file alone. The table keeps its three rows, so the `notWired` check in `preplan.test.mjs:104-131` still holds.
- **Decision**: APPLIED — Phase 1, change 5 (Prompt index), Contract.

### F5 — The suffix wording could read as forbidding the advisor tool

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1, change 1 (the suffix rule)
- **Detail**: `prompts/advisor.md` asks `plan` and `implement` to consult the advisor. The draft suffix line forbids "any other subagent" and "the Agent tool". A subagent could read the advisor as covered by that ban. `advisor.test.mjs:476` pins the advisor rules, so the ban must stay about subagents.
- **Fix**: State in the contract that the line speaks of subagents and the `Agent`/`Task` tools only and must not read as forbidding the advisor tool, `Read`, `Grep` or `Glob`.
- **Decision**: APPLIED — Phase 1, change 1 (The suffix rule), Contract.
