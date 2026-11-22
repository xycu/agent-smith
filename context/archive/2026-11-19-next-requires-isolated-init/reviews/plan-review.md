<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Make next refuse a run that init would refuse for missing isolation

- **Plan**: context/changes/next-requires-isolated-init/plan.md
- **Mode**: Deep
- **Date**: 2026-11-20
- **Verdict**: SOUND
- **Findings**: 0 critical, 1 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS |
| Plan Completeness | WARNING |

## Grounding

Grounding: 6/6 paths ✓ (`route.mjs`, `isolation.mjs`, `test/helpers.mjs`, `test/isolation.test.mjs`, `docs/REFERENCE.md`, ADR-010), 5/5 symbols ✓ (`isolationOn`, `mutationMeta`, `cleanupStateTemps`, `writeMetaFile`, `halt`), brief↔plan ✓. Cited line numbers drift by one (`route.mjs:1105` is 1106, `:1142` is 1141); harmless. No Automated criterion needs a pushed branch, PR or PR comment. Progress rows match the Success Criteria of both phases.

Deep check: the guard was applied in a scratch copy of the repository (outside the worktree) and the full suite run: 2112 tests, 2107 pass. One failure is caused by the guard (F1). The other (`prompt-handoff.test.mjs:402`, `git rev-parse HEAD`) failed only because the scratch copy has no `.git`. The guard sits after `guardArchived` and `haltNoChangeMd`, so the documented `next demo` halt without a change folder (`docs/REFERENCE.md:718`) is unchanged, and `init` still reaches `next` with `isolated: true` already written.

## Findings

### F1 — Fixture list is a dangling reference and names the wrong files

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1, Changes Required 3 (Fix fixtures the guard breaks)
- **Detail**: The plan sends the implementer to "the research notes" for the files that break, but the change folder has no research file. It names `rollback`, `stepcommit`, `late-usage`, `open-pr`, `neutral` and `firstattempt` as likely. The dry run shows none of those break (they `init` in a worktree). The one that does is `skills/10x-pipeline/test/preplan.test.mjs`, test "a bad prompt reference halts before the subagent result is consumed" (line 202): it runs `init` with isolation off, then calls `fs.rmSync(overrideFile)`, which restores the shipped `isolation.require: true`, so the last `next` halts with the new message. The plan's fix recipe (`isolated: true` in a fixture `meta.json`, or switch to `init`) does not fit this case.
- **Fix**: Name `preplan.test.mjs:202` and replace `fs.rmSync(overrideFile)` with `writeOverride(project, {})`; drop the research-notes reference; keep "run the full suite and fix any further failure".
- **Decision**: APPLIED — Phase 1, "3. Fix fixtures the guard breaks" (Intent and Contract), and the risk bullet in `plan-brief.md`.

### F2 — Row 2.1 grep already matches before the change

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 Automated Verification, row 2.1
- **Detail**: `grep -n "next. halts" docs/REFERENCE.md` matches `docs/REFERENCE.md:159` ("the next `next` halts in the staged-index check") today, so the check passes with no new bullet. The stricter text `next. halts, writes nothing` has zero matches now.
- **Fix**: Make the bullet contain the literal text `next` halts, writes nothing and confirm it with the stricter grep.
- **Decision**: APPLIED — Phase 2, "1. REFERENCE line" Contract now fixes the wording and names the stricter grep. Row 2.1's title is immutable in this step, so its looser pattern stays in the Progress row; the implementer runs the stricter one.

### F3 — The "both chains" claim has no test on the OpenSpec chain

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1, Changes Required 2 (Tests); Key Discoveries
- **Detail**: The plan relies on one shared guard covering the 10x and OpenSpec chains (different `meta.json` path, `openspec/changes/<id>/agent-smith/`), but all four new tests drive the 10x chain. A later change to the OpenSpec path resolution could drop the guard there unnoticed.
- **Fix**: Add one OpenSpec-chain test in `skills/openspec-pipeline/test/openspec-isolation.test.mjs`: default policy, main checkout, no `meta.json`, `next <id> --chain openspec` halts, names `init`, writes no `agent-smith` folder.
- **Decision**: APPLIED — Phase 1, "2. Tests" now lists the OpenSpec test as a second file; `plan-brief.md` scope line updated. Row 1.2 (full suite) covers it, so no Progress row changed.
