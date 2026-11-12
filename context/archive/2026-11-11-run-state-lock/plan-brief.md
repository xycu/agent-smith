# Run-state lock — Plan Brief

> Full plan: `context/changes/run-state-lock/plan.md`

## What & Why

`next` and `usage` (and `init`) read `run.jsonl`, edit it in memory and write it whole. Called at once, the later write drops the other's change: a step may run twice, or a usage figure is lost. Only a prompt rule prevents it today. Add a lock the router enforces.

## Starting Point

`writeLog` in `state.mjs:373` and `usageCommand` in `route.mjs:688` write without any guard. `main()` in `route.mjs:806` is the single entry for all commands.

## Desired End State

A concurrent `init`/`next`/`usage` on the same run halts with a clear message and writes nothing. A lock left by a dead process is ignored. Read-only commands are unaffected.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Lock location | `os.tmpdir()`, keyed by hash of the run dir | A lock file in the change folder would be committed by step commits and dirty the archive-state folder | Plan |
| Acquire | pid written to a temp file, `fs.linkSync` to the lock path | Atomic with the pid inside, so a second caller never reads an empty lock as stale; pid allows stale detection | Plan review F1 |
| Stale lock | Dead pid is removed and retried once | A crash or SIGKILL must not block the run forever | Plan |
| Waiting | None, halt at once | Matches the issue; callers run one call at a time anyway | Plan |
| Release | `process.on("exit")` | `out()`/`halt()` use `process.exit` | Plan |
| ADR | None | Small change, consistent with ADR-019 | Plan |

## Scope

**In scope:** `acquireRunLock` in `state.mjs`, call in `main()`, new `run-lock.test.mjs`, REFERENCE.md and AGENTS.md notes.

**Out of scope:** locks for read-only commands, `open-pr.mjs`, `pr-comment.mjs`; waiting/retry; SKILL.md changes.

## Architecture / Approach

One helper in `state.mjs`, one call in `main()` for `init`, `next`, `usage` on both chains. Lock path `agent-smith-<hash>.lock` in the OS temp dir.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Lock in the router | Helper, call site, tests | Stale lock after a crash; tests must not leak lock files |
| 2. Docs | REFERENCE.md and AGENTS.md notes | Merge conflicts with the parallel issue changes |

Prerequisites: none. Estimated effort: small (about 30 lines of code, one test file).
