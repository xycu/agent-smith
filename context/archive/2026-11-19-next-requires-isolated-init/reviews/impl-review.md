<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Make next refuse a run that init would refuse for missing isolation

- **Plan**: context/changes/next-requires-isolated-init/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2
- **Date**: 2026-11-21
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warnings, 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Evidence

- Diff against `main` (52f6a179..HEAD, outside `context/changes`): `route.mjs` +3 lines, `docs/REFERENCE.md` +1 bullet, `isolation.test.mjs` +4 tests, `openspec-isolation.test.mjs` +1 test, `preplan.test.mjs` one fixture line. Every file is in the plan; no extra files.
- Guard sits in `next()` right after `mutationMeta(p) ?? { id, goal: "" }` and before `cleanupStateTemps` and `mkdirSync`, so a halt writes nothing. Message names `isolation.require`, says to run `init` first in the run worktree, ends with `Nothing was written.`, and does not offer the opt-out. It matches the Contract.
- `init` writes `meta.isolated = true` before it calls `next` (route.mjs:1118-1144), so the in-process `next` call is not disturbed. `next` is shared by both chains, so one guard covers 10x and OpenSpec; the OpenSpec test proves it.
- Guard runs after `guardArchived` and `haltNoChangeMd`, so the documented `next demo` halt without a change folder (REFERENCE.md:719) is unchanged.
- The only fixture change is the one the plan named (`preplan.test.mjs`: `fs.rmSync(overrideFile)` becomes `writeOverride(project, {})`); no assertion about router behavior changed.
- Docs grep (README.md, docs/REFERENCE.md, ADR-010, both SKILL.md files): no text says the isolation check runs only at `init` or that `next` may be called first, except the test README row in F1. ADR-010 "A run in the main checkout halts at `init`" stays true.
- Manual rows 1.4 and 2.4 have evidence files (`evidence/judgment-halt-reason.md`, `evidence/judgment-reference-bullet.md`); the halt text and the REFERENCE bullet match what those rows ask.

## Automated criteria

- `node --test --test-concurrency=2 skills/10x-pipeline/test/isolation.test.mjs`: 24 pass, 0 fail.
- Full suite: 2117 tests, 2114 pass, 0 fail, 3 skipped (the README row edit landed during the run; no test reads that file).
- `grep -n "next. halts" docs/REFERENCE.md`: matches the new bullet (line 143) and the older staged-index sentence; `grep -n "next. halts, writes nothing"` matches only the new bullet.
- `node tools/version-check.mjs`: exit 0.

## Findings

### F1 — Test README still describes the isolation test file as the gate of init only

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: skills/10x-pipeline/test/README.md:61
- **Detail**: The row for `isolation.test.mjs` reads "the isolation gate of `init`". The file now also holds four tests of the `next` guard. The plan and `lessons.md` ("Grep every doc for the old behavior when a script's output changes") require docs to match the new behavior, and AGENTS.md says test rows live in the README of the folder.
- **Fix**: Change the row to "the isolation gate of `init` and `next`".
- **Decision**: APPLIED in commit 8e20ba01 (README row now reads "the isolation gate of `init` and `next`")
