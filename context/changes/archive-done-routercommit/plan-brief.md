# archiveDone reuses routerCommit — Plan Brief

> Full plan: `context/changes/archive-done-routercommit/plan.md`

## What & Why

`archiveDone` repeats the stage, commit and post-commit checks that `routerCommit` already does for the start, step and late-usage commits. The two copies must change together and already differ. Fix: one commit path (issue #94).

## Starting Point

Both live in `skills/10x-pipeline/scripts/isolation.mjs`. `archiveDone` also runs the index and folder-clean checks when no commit was made (resume), which `routerCommit` skips.

## Desired End State

`archiveDone` calls `routerCommit(g, timeout, { rel, message })` and maps its result to the `archive` and `committed` halt fields. About 30 lines less. Archive action output unchanged.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Resume path checks | Move them into `routerCommit` (run when `rel` is set, also with no commit) | Keeps the existing archive halt on a dirty folder without a second copy | Plan |
| Error suffix | `routerCommit` adds `reason` without its "commit exists" text | `archiveDone` appends `COMMIT_EXISTS`; avoids double text | Plan |
| Message text | Accept the "router's own add" wording | Tests match loosely; no doc pins it | Plan |
| ADR | None | No new decision | Plan |

## Scope

**In scope:** `routerCommit` extension, `archiveDone` switch, one new test.

**Out of scope:** pre-checks, report write, archive action, policy, other callers' behavior.

## Architecture / Approach

Extend `routerCommit` slightly, replace the inline block, run the full suite.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Single commit path | One commit path, tests green | Start commit and late usage gain the folder-clean check on their no-commit path |

**Prerequisites:** none.
**Estimated effort:** one session, one phase.

## Open Risks & Assumptions

- Assumption: a clean folder after a nothing-staged `add` holds for start commit and late usage (their pre-checks guarantee it).
- Halt wording shifts slightly; no test pins it.

## Success Criteria (Summary)

- Full suite green.
- A resumed archive with a stray file still halts with the clean-check text.
