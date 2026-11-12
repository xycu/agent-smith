<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: File guards and the plan Files parser

- **Plan**: context/changes/file-guard-dedup/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2
- **Date**: 2026-11-11
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

Evidence: commit 70b277f against the plan's Changes Required. `state.mjs` exports `guardedStat`, `readGuarded` and `planFileTokens` with the contracts the plan gives; `openspec.mjs` imports `readGuarded` and no longer defines it; `evidenceOk` and `readUnprovenReasons` call `guardedStat` with `dir = <change>/evidence` and keep the evidence-folder-is-a-real-directory check, mtime and size > 0 at the call site; `readComplexity` keeps its specific messages and adds the real-path check; `planPaths` and `phaseFiles` loop over lines and call `planFileTokens`, with the phase tracking and sorted per-phase sets unchanged. Import order holds (helpers live in `state.mjs`, the earliest module). No other `**Files?**` match or inline lstat/realpath guard is left in `scripts/` (the remaining `realpathSync` calls are not file guards). `docs/REFERENCE.md` and `AGENTS.md` carry the planned sentences; no policy key, prompt, ADR or output shape changed. Success criteria run in this review: `node --test` on `file-guard`, `score`, `manualverify`, `openspec-readers`, `preplan` and `executors` tests: 192 pass, 0 fail. Full suite `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`: 986 tests, 984 pass, 0 fail, 2 skipped.

## Findings

### F1 — The new real-path check in `readComplexity` cannot fail

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; no code change needed
- **Dimension**: Safety & Quality
- **Location**: skills/10x-pipeline/scripts/preplan.mjs (`readComplexity`, the `guardedStat(file, p.change, ...)` line)
- **Detail**: `complexity.json` sits directly in the change folder, and the two checks above it already refuse a symlinked file and an oversized file. The only way left to escape the real path of `p.change` is a symlinked parent between the two, which this layout does not have. The plan asked for the check ("adds the real-path check through `guardedStat`"), so the code matches the plan; the line is defence in depth with no test of its own.
- **Decision**: APPLIED - c3dd9ef — `readComplexity` now reads the file only when `guardedStat` accepts it, so the guard is the one rule and no longer a dead line behind its own copy; the second `lstat` after a refusal only words the error. Behavior and messages are unchanged; `file-guard.test.mjs` covers the cases.

### F2 — Plan test items are covered in existing test files

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; no code change needed
- **Dimension**: Plan Adherence
- **Location**: skills/10x-pipeline/test/file-guard.test.mjs, skills/10x-pipeline/test/manualverify.test.mjs, skills/10x-pipeline/test/score.test.mjs
- **Detail**: Phase 1 lists, for `file-guard.test.mjs`, a refused symlinked `complexity.json` and a symlinked evidence file that is not valid evidence. The file holds the `guardedStat`/`readGuarded` and `planFileTokens` tests only. The symlinked evidence case is covered by the edited assertion in `manualverify.test.mjs` ("evidence suffix required", now `ok === false` for an in-folder symlink), and the symlinked `complexity.json` by the existing `score.test.mjs` symlink test. The behavior is tested; only the location differs from the plan.
- **Decision**: APPLIED - f0d9a9c — `file-guard.test.mjs` holds both cases (c3dd9ef): a symlinked `complexity.json` refused by `readComplexity` and a symlinked evidence file unproven in `verifyManual`. `manualverify.test.mjs` drops its copy; the `score.test.mjs` symlink test stays, because it checks the failed step and its retry through the CLI.
