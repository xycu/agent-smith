<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Router Bash timeout Implementation Plan

- **Plan**: context/changes/router-bash-timeout/plan.md
- **Mode**: Deep (no sub-agent: the run forbids nested subagents, so the riskiest claims were checked inline)
- **Date**: 2026-11-13
- **Verdict**: REVISE
- **Findings**: 0 critical, 2 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

Grounding: 9/9 paths ✓ (both SKILL.md, policy.json, open-pr.mjs, isolation.mjs, REFERENCE.md, four test files), 6/6 symbols ✓ (`GIT_TIMEOUT_MS` at open-pr.mjs:17, `gitTimeoutMs` at policy.json:117,124, `routerCommit`, staged-index message at isolation.mjs:230, `SKILL_PATH`, `OPENSPEC_SKILL_PATH`), brief↔plan ✓, Progress↔Phase ✓ (rows 1.1-1.5, 2.1-2.3 match the criteria). No timeout text in either SKILL.md today. No `docs/reference/contract-surfaces.md`, so that check is skipped. The line text trips no existing pin: no `node $ROUTER`, no `**GIVEN**`, no bold keyword, no model, effort or tier word (`maximum` does not match `\bmax\b`).

## Findings

### F1 — Reference bullet contradicts itself on the rule and the direction of the override

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 2 — 1. Reference (Contract)
- **Detail**: The contract says the Bash limit "must stay above any one git timeout" and, in the same sentence, that one call must stay "under 600000 ms". It also says a project with hooks near 120 s "lowers neither but may need ... overrides of both keys", which never says raise or lower. The router's own 120000 ms timeout fires first and unstages its add, so the real rule is that the git timeouts of one router call must add up to less than the Bash limit, and the only useful override is to raise the keys when hooks exceed 120 s. The implementer would have to guess the wording of the rule that the bullet exists to state.
- **Fix**: Rewrite the contract as five ordered points: the rule (sum of the git timeouts of one call below the Bash limit, router timeout fires first), the raise-only override with the sum constraint, the `open-pr.mjs` fixed 120000 ms, the staged-index symptom, and the shared-chain note.
- **Decision**: APPLIED — Phase 2, "1. Reference", Contract rewritten as points 1 to 5.

### F2 — Test index rows not updated

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — Changes Required
- **Detail**: AGENTS.md says a new test gets its row in the README of its folder. `skills/10x-pipeline/test/README.md` lines 69 and 88 describe what `skill-loop.test.mjs` and `openspec-skill.test.mjs` pin. The plan adds a pin to both files and touches neither row, so the index goes stale.
- **Fix**: Add a Phase 1 change item that extends those two rows. No new row, because the tests live in existing files.
- **Decision**: APPLIED — Phase 1, new item "5. Test index" (`skills/10x-pipeline/test/README.md`).

### F3 — Placement contract and test assertion differ

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — items 1 and 3; Desired End State
- **Detail**: The Desired End State and item 1 say the line sits right after the `Pull request script:` line. The test only asserts "after that line and before `## Start`", so a line moved to another spot in between would pass.
- **Fix**: Assert the line index is exactly the `Pull request script: ` index plus one.
- **Decision**: APPLIED — Phase 1, "3. 10x content test" Contract (the OpenSpec test uses "same assertions").

### F4 — Line rationale and shared-chain wording leave two points open

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 — Reference Contract; Phase 1 line text
- **Detail**: The line gives git timeouts as the reason for all three scripts, but `pr-comment.mjs` runs only `gh` calls (default 20000 ms each) and no git. Keeping it in the line is harmless (one rule for all script calls), but the reference bullet should say so. "The OpenSpec section points at it, no copy" did not say whether line 400 of REFERENCE.md is to be edited; it already inherits everything it does not name.
- **Fix**: Name the `pr-comment.mjs` case in the bullet and state that the OpenSpec section gets no edit.
- **Decision**: APPLIED — Phase 2, "1. Reference", Contract points 3 and 5.

## Notes

- `change.md` was not updated to `status: plan_reviewed`: this run may edit only `plan.md`, `plan-brief.md` and this file.
- Open scope item left out on purpose by the plan (staged-index halt message) is consistent with "What We're NOT Doing"; not a finding.
