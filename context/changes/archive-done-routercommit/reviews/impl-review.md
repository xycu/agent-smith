<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: archiveDone reuses routerCommit Implementation Plan

- **Plan**: context/changes/archive-done-routercommit/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1
- **Date**: 2026-11-11
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 3 observations

Reviewed in this subagent, no sub-agent launched. Diff range `be0ab00..HEAD` (step commit `0b48abd` holds the code). Files in the diff outside `context/`: `skills/10x-pipeline/scripts/isolation.mjs`, `skills/10x-pipeline/test/archive.test.mjs`; both are named in the plan.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Success criteria

- Full suite `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`: 986 tests, 984 pass, 0 fail, 2 skipped. The five-file set of the plan (archive, stepcommit, late-usage, isolation, openspec-archive): 153 of 153 pass. No code changed by this review.
- 1.3: `archiveDone` has no `git add` or `git commit` call; the only `"commit", "-m"` line is in `routerCommit`. The plan expects `grep -c` to print 2, it prints 1 because both forms sit on one line (F3).
- 1.4: new test "kind D: a clean resume passes with commit null and makes no second commit" covers the no-commit path; existing case at the dirty-folder hook covers the halt text.
- Manual 1.5, 1.6: evidence files agree with the diff.

## Findings

### F1 — Rev-parse failure after a commit now yields the string "HEAD" instead of null

- **Severity**: OBSERVATION
- **Impact**: LOW
- **Dimension**: Safety & Quality
- **Location**: skills/10x-pipeline/scripts/isolation.mjs:342
- **Detail**: `commit = ... : "HEAD"` when `git rev-parse HEAD` fails right after a successful commit. Before, `routerCommit` returned `commit: null` there and used "HEAD" only in the message. Now `meta.startCommit` / a step entry's `commit` could hold the literal "HEAD". Near-impossible (rev-parse failing after a commit), and the plan wanted archive's "HEAD" label kept.
- **Decision**: APPLIED - 1ac426f. `routerCommit` returns `made` and `commit` (the full hash or null, never a label); the archive action keeps its "HEAD" label; tests in `stepcommit.test.mjs` and `archive.test.mjs`.

### F2 — Start commit records a null guard when only the post-commit folder check fails

- **Severity**: OBSERVATION
- **Impact**: LOW
- **Dimension**: Architecture
- **Location**: skills/10x-pipeline/scripts/isolation.mjs:430
- **Detail**: With `rel` set, `routerCommit` now runs the index and folder-clean checks when nothing was staged and returns `{ error, commit: null }`. `startCommit` writes `meta.startCommit = null` for any defined `commit`, so a halt on that new path is not retried by the next `init`. The path needs a folder that stays dirty after `git add` of it (for example a nested repository); not reproducible in tests.
- **Decision**: APPLIED - 1ac426f. The start commit sets `meta.startCommit` only when a commit was made or the call succeeded, so the next `init` retries; reproduced in `stepcommit.test.mjs` with a nested repository that holds an untracked file.

### F3 — Plan criterion 1.3 states the wrong count

- **Severity**: OBSERVATION
- **Impact**: LOW
- **Dimension**: Success Criteria
- **Location**: context/changes/archive-done-routercommit/plan.md (Automated Verification, third bullet)
- **Detail**: `grep -c` counts lines, and both `"commit", "-m"` forms are on one line, so it prints 1. The intent (no direct commit call in `archiveDone`) holds.
- **Decision**: APPLIED - 56dd2a3. Criterion 1.3 of `plan.md` now expects 1 and says why.
