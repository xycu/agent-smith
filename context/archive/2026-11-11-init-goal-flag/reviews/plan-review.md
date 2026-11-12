<!-- PLAN-REVIEW-REPORT -->
# Plan Review: init --goal parsing Implementation Plan

- **Plan**: context/changes/init-goal-flag/plan.md
- **Mode**: Deep (done in-subagent, no nested agent)
- **Date**: 2026-11-11
- **Verdict**: REVISE
- **Findings**: 0 critical, 2 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

6/6 paths and symbols checked: `parseFlags` (`state.mjs:14-23`, sole caller `route.mjs:811`), init goal storage (`route.mjs:871-872`), `halt` before `mkdirSync` (`route.mjs:869`), `usageCommand` reads `rest[0]` and not the flags, `SKILL.md:46` and `openspec-pipeline/SKILL.md:54` quote the goal, existing tests pass `--goal` a single argument. Progress and Phase blocks consistent (4+4 rows, titles match). brief and plan consistent.

## Findings

### F1 — `flags._` can be overwritten by a `--_` argument

- **Severity**: WARNING
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Implementation Approach; Phase 1 change 1 (Flag parser)
- **Detail**: The plan says `_` "cannot collide with a `--` flag since flag names are non-empty". `--_` gives `slice(2)` = `_`, so the loop would set `flags._` to `true` or a string. The leftover check then reads a non-array (`.length` of `true` is undefined, so no halt, or a throw), and an unquoted goal slips through.
- **Fix**: Collect leftovers in a local array and assign `flags._` after the loop; add a test that `--_` does not hide leftover words.
- **Decision**: APPLIED - Implementation Approach and Phase 1 change 1 contract reworded to assign `flags._` after the loop; Phase 2 test list gained the `--_` case.

### F2 — `--goal` followed by a flag now swallows that flag

- **Severity**: WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Desired End State; Migration Notes; Phase 2 tests
- **Detail**: With "always take the next argument", `init demo --goal --archive` stores `--archive` as the goal and silently leaves archive off; `init demo --goal --rigor standard` stores `--rigor` and halts on `standard`. Before, a valueless `--goal` before another flag kept the stored goal and the other flag worked. The plan says the bare-`--goal` rule is unchanged, which holds only for `--goal` in last position. This follows from the issue's stated fix, so it is accepted, but the plan did not say it or test it.
- **Fix**: State the behaviour in Migration Notes and pin it, with `--goal ""` and last-position `--goal`, in the Phase 2 tests.
- **Decision**: APPLIED - Migration Notes gained a paragraph; the Phase 2 Tests contract now lists `--goal ""`, last-position bare `--goal` and `--goal --archive`.

### F3 — REFERENCE.md location for the doc sentence is not decided

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 change 2 (Reference docs)
- **Detail**: "Under Chain switch or the init description ... wherever init flags are listed" leaves the choice to the implementer. REFERENCE.md has no bullet that lists the `init` flags; "Chain switch" is in the OpenSpec section, but the halt applies to both chains. With 12 parallel changes editing the same file, a vague anchor raises conflict risk.
- **Fix**: Name one anchor.
- **Decision**: APPLIED - Phase 2 change 2 now names the last bullet of "How routing works:" in the 10x section as the place.
