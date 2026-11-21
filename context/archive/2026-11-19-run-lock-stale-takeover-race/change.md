---
change_id: run-lock-stale-takeover-race
title: Stop two router processes from both taking over a stale run lock
status: archived
created: 2026-11-19
updated: 2026-11-21
archived_at: 2026-11-21T14:22:34Z
---

## Notes

**Origin.** Whole-repo audit on 2026-11-19, finding 11 (should fix). Reproduced with the real `acquireRunLock` in a scratch directory.

**The defect.** `acquireRunLock` in `skills/10x-pipeline/scripts/state.mjs:990-1021` allows one `init`, `next`, `usage` or `status --report` per change at a time. When the lock file names a process that no longer runs, the stale branch (lines 1018-1019) deletes the lock with `unlinkQuiet(lock)` and retries the exclusive `linkSync`. Two callers can both read the stale pid. Caller A deletes and links. Caller B then deletes the fresh lock of A and links its own. Both believe they hold the lock.

**How the stale lock appears.** A router process that is killed (a Bash tool timeout, `SIGKILL`) runs no exit handler and leaves its lock.

**Reproduced.** A stale lock that held an exited pid; each holder kept the lock for 250 ms; hold intervals were compared. Two simultaneous processes overlapped in 8 of 200 rounds. Eight processes overlapped in 12 of 150 rounds. The second caller acquired about 1 ms after the first.

**Why it matters.** Both processes then read, modify and write `run.jsonl`. The last writer drops the other's entry or usage figure. The window needs a crash first and then two commands at once, for example parallel tool calls of `next` and `usage`, so it is rare; when it happens, the run log silently loses a record.

**Related, read only.** A stale pid that the operating system reused for a live, unrelated process blocks the change for good. The message names the lock file, but does not say that the file may be removed when no router is running.

**Direction (for the plan to confirm).**
- Guard the stale branch with a second exclusive link, for example `${lock}.takeover`, made with the same link trick. Under it, read the lock again, and only then delete and link. Remove the takeover file in a `finally`.
- The minimum alternative: after a stale takeover, read the lock again after a short wait and halt when it no longer holds the caller's own pid.
- Improve the busy message for a live pid: say how to check that the pid is a router and what to do when it is not.

**Constraints.**
- No npm dependencies; `node:` built-ins only (ADR-006).
- The native-ownership branch (`state.mjs:1001-1004`) is not weakened: a lock with the `native` key is never taken over here.
- The lock stays in the same place and format, so a mixed pair of plugin versions on one machine does not deadlock.

**Done when.**
- A test that starts several processes against one stale lock and asserts that hold intervals never overlap, over enough rounds to have failed before the fix.
- `run-lock.test.mjs` keeps its single-caller stale recovery case.
- The full suite passes: `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`.
