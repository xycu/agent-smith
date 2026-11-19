<!-- IMPL-REVIEW-REPORT -->
# Implementation Review — Protect Unfinished Git Operations During Run Publication

- **Plan**: [plan.md](../plan.md)
- **Scope**: Full plan
- **Reviewed phases**: 1
- **Date**: 2026-11-19
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 1 warning, 0 observations

## Verdicts

| Dimension | Verdict |
| --- | --- |
| Plan Adherence | FAIL |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Coverage

Reviewed Phase 1 against implementation commit `f653d27a` and the run branch at `06e9cce0`. The shared guard runs before the router’s staged-index check and before the publisher reads status. Rollback accepts ordinary staged changes. The publisher fixtures cover conflicts, marker-only state, probe failures, detached HEAD and preservation of the branch, worktree, index and operation state. Publication and late-usage documentation covers the recovery path. The plan’s four acceptance rows were automated and marked complete. The read-only plan-drift and safety reviews independently identified F1.

## Findings

### F1 — An unusable marker path can look like an absent marker

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — a narrowly scoped fix in the shared guard and Git runners
- **Dimension**: Plan Adherence / Safety & Quality
- **Location**: `skills/10x-pipeline/scripts/git-operation.mjs:8` in `f653d27a`
- **Detail**: The plan requires a usable absolute marker path. Both Git runners decoded it as UTF-8. On POSIX, a linked worktree’s Git directory can contain a non-UTF-8 byte even when the run root is valid UTF-8. Decoding can redirect `lstatSync` to a different path. The guard treated `ENOENT` as marker absence even if it had failed to locate the parent directory. A merge with resolved index entries could then reach the leftover commit and be finalized.
- **Fix**: Preserve Git’s path bytes through the filesystem probe, validate the returned marker name and verify its parent directory before treating `ENOENT` as marker absence. Exercise a successful Git probe that returns an unusable path.
- **Decision**: APPLIED in `d75b889d`.

## Verification

The new publisher regression failed against the original guard with `committed: true`. With the fix it reports the failed marker inspection, preserves local state and publishes existing commits to the fixture’s bare remote. The Git shim supplies the non-UTF-8 bytes because the macOS test environment rejected creation of a native fixture.

The scoped documentation diff passed `git diff --check`. The live documentation search for `commitError`, `leftover commit` and `final run state` confirmed the reference, ADR-017 and ADR-019 cover skipped commits, preserved local artifacts and publication of existing commits. The publication instructions in both pipeline skills use the documented JSON fields.

| Check on Node 24.19.0 | Result |
| --- | --- |
| `node --test skills/10x-pipeline/test/open-pr.test.mjs` | 62 passed |
| `node --test skills/10x-pipeline/test/archive.test.mjs` | 95 passed |
| `node --test skills/10x-pipeline/test/rollback.test.mjs` | 22 passed |
| `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs` | 1,933 passed, 3 expected skips |

The suite skipped the two opt-in live GitHub tests and the import check for an absent `CLAUDE.md`. Token usage for the two delegated reviews is unknown.
