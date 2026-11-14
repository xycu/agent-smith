# Atomic Run State — Plan Brief

[Full implementation plan](plan.md)

## What & Why

The router currently truncates live state files during writes and silently drops damaged log lines during reads. A process interruption can therefore erase run history and reset the router's understanding of attempts and budget. Publish complete state files atomically and require explicit recovery of damaged logs.

## Starting Point

Both chains share `state.mjs`, routing, report generation and Git recovery. The existing run lock serializes writers and execution, while late usage already restores captured file bytes after an archive-state commit failure. A disposable planning probe reproduced silent loss of damaged middle and final lines.

## Desired End State

Each state target exposes complete old or new bytes during publication. Writing commands halt with file/line recovery guidance on damaged logs. Read-only commands return usable entries with attributed `logProblems`, and the next eligible locked writer removes recognized abandoned state temps before staging.

## Key Decisions Made

| Decision | Choice | Reason | Source |
| --- | --- | --- | --- |
| Publication | Shared same-directory temp-and-rename writer, supporting strings and Buffers | Covers ordinary writes and byte-exact restoration through one owner | Change and existing lock pattern |
| Cleanup | Exact three-basename/PID temp pattern and immediate regular files | Restricts deletion to recognized router state temps | Change and Wave 4 scope |
| Ordering | Lock, guards, strict log validation, cleanup, mutation/staging | Preserves damaged logs and pending results during refusal | Change and ADR-019 |
| Writing status | Strict handling for `status --report` | It already writes a report under the shared lock | Current router |
| Log values | JSON objects with arbitrary fields, empty physical lines and CRLF | Matches routing consumers and legacy serialization | Current reader/writer and planning probe |
| Diagnostics | Populated fields only, independent comparison-side fields and Markdown display | Preserves clean output and allows narrow reader-boundary changes | Current output assembly |
| Execution | Strict Codex action validation before probe or launch | A damaged log cannot establish the pending dispatch | ADR-024 and current runner |

## Scope

The owned implementation reaches `state.mjs`, direct state writes in `flow.mjs` and `isolation.mjs`, router readers/preflight and the Codex reader. A new shared state test covers both chains using existing helpers. Documentation additions concern state integrity and recovery.

Wave 4 assigns comparison failure semantics, helper environments, setup, skills and CI to sibling runs. This change's comparison edits concern log ingestion and diagnostic display. Wave bookkeeping belongs to post-wave maintenance.

## Architecture / Approach

Use synchronous Node built-ins in the existing shared storage layer. Publish through an exclusively created temp file, close it and rename over the target. Inspect logs through an explicit `{ entries, logProblems }` result with strict behavior by default. Router mutations clean recognized stale files after successful validation while holding the current run lock.

## Phases at a Glance

| Phase | Deliverable | Main verification concern |
| --- | --- | --- |
| 1. Atomic publication and cleanup | All log/meta/report writes and restorations use one writer, with bounded locked cleanup | Old-or-new bytes, failed writes and temp ownership |
| 2. Log guards and diagnostics | Strict mutation/execution reads and tolerant command diagnostics | Byte-preserving refusal and both-chain attribution |
| 3. Recovery and compatibility | Recovery documentation, indexed tests and final CLI verification | Rollback, late usage and archive commits |

Implementation prerequisites are Node 24+, Git for recovery tests and the current Wave 4 baseline. The planning host runs Node v26.13.1. Estimated effort is three implementation phases with focused tests and the repository-required suite after script changes.

## Open Risks & Assumptions

- The guarantee concerns individual file publication during process termination and filesystem errors. Existing command/Git recovery handles interruptions between complete file publications.
- Empty and missing logs retain their empty-run interpretation because the current format cannot distinguish a fresh file from an already-empty damaged file.
- Cleanup ownership follows the exact naming pattern and shared lock exclusion. Existing lock limitations remain relevant when callers use different OS-temp roots.
- Malformed logs require operator recovery from preserved bytes and a usable step commit. Earlier data loss may require an older committed copy.

## Success Criteria (Summary)

- Crash/failure tests expose complete previous or replacement files, with exact Buffer restoration and safe cleanup.
- Both chains reject corrupted logs before mutation and expose read-only diagnostics with correct physical lines.
- Rollback, result persistence, late usage, archive and runner regression suites pass, along with both-chain CLI smoke checks and the full suite.

## References

[Change](change.md) · [Wave ownership](../WAVES.md) · [ADR-010](../../../docs/ADR/ADR-010-run-worktree-step-commits-and-rollback.md) · [ADR-019](../../../docs/ADR/ADR-019-late-usage-figure.md)
