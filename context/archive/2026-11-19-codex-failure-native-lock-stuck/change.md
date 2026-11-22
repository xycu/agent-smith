---
change_id: codex-failure-native-lock-stuck
title: Release the native lock after an ordinary Codex failure so the run can retry
status: archived
created: 2026-11-19
updated: 2026-11-19
archived_at: 2026-11-19T17:02:39Z
---

## Notes

**Origin.** Whole-repo audit on 2026-11-19, finding 4 (must fix). Reproduced with a fake `codex` executable on `PATH`; the real Codex CLI was not started.

**The defect.** `skills/10x-pipeline/scripts/run-codex.mjs` records native ownership in the run lock before the model starts. The only place that releases it after a launch is the callback at lines 408-411, where `settledDescendants` proves the Codex thread tree is closed and calls `lock.clearChild(true)`. Every check before that point exits through `refuse(...)` (lines 398-407): a cancelled run, a launch error, a non-zero exit code, a protocol error, no completed turn, a missing final message, and a reply without a `RESULT` line. None of them reaches the release.

A lock that still has the `native` key makes every caller refuse: `skills/10x-pipeline/scripts/state.mjs:1001-1004` answers `Execution suspended: native ownership unresolved (...)`, and `clearChild` without `settled` throws (`state.mjs:1053-1054`). A grep of `state.mjs`, `route.mjs`, `flow.mjs`, `isolation.mjs`, `prepare-run.mjs` and `open-pr.mjs` finds no other code that clears such a lock. `docs/REFERENCE.md:25-29` says the retained lock needs "router-owned recovery" and that a production lock is never deleted; that recovery has no implementation.

**Reproduced cases.**
- A: the Codex child ends normally with the reply "All done, files written." and no `RESULT` line. The runner exits 1 with `"launched":true,"completed":false`, and the reason ends "The final assistant message has no RESULT line." After that `next`, `init` and `status --report` each halt with "Execution suspended...", and a second runner call returns `launched: false` with the same reason.
- B: the fake `codex` exits 1 with a `turn.failed` event (the shape of an API error or a rate limit). Same dead end; the reason ends "Codex exited unsuccessfully. The child result was not accepted."

**Side effect in the skill loop.** `skills/10x-pipeline/SKILL.md:88` tells the orchestrator to write status `unknown` for `completed: false` with `launched: true`, which gives the normal retry. That branch is reachable only for a temporary-file cleanup failure, because every other such envelope carries "Execution suspended:" and hits the suspension stop first.

**Why it matters.** A rate limit or one malformed reply is an ordinary event for a model call. Today it ends the run for good, and the only way to continue is to delete the lock by hand, which the reference forbids. Most recent runs are Codex-hosted.

**Direction (for the plan to confirm).** Pick one, or both:
- After a non-zero exit, a failed turn or a missing `RESULT` line, still run `settledDescendants`. When it proves the thread tree is closed, clear the lock and return `launched: true, completed: false`, so the `unknown` retry path works. Keep the lock only when closure cannot be proved (a cancelled run, a child that is still alive, unreadable thread records).
- Add the recovery the reference names: a router command that checks settlement for the recorded thread and releases the lock, with a clear message when it cannot.

The first option removes the dead end for the common failures; the second covers the cases where the lock must stay.

**Constraints.**
- The reason the lock exists stays: no second model process may start while a Codex child or one of its descendants can still write to the worktree. A release needs the same proof of closure as today.
- `route.mjs` and the modules it imports own the lock; the skill files never touch it, and they name no models, effort levels or tiers.
- No npm dependencies; `node:` built-ins only (ADR-006).
- ADR-024 and the Codex section of `docs/REFERENCE.md` describe the lock; update both with the rule in force.

**Done when.**
- A test with a fake `codex` for each case: a reply without a `RESULT` line, and exit 1 with `turn.failed`. After the runner returns, `next` records the step as `unknown` and the router offers a retry; no "Execution suspended" halt follows.
- A test that the lock is still kept when closure cannot be proved, and that the message says how to recover.
- If a recovery command is added: a test for it, and its row in AGENTS.md Commands and in `docs/REFERENCE.md`.
- The timer paths that no test reaches today get one test: a fake `codex` that ignores `SIGTERM` is killed after the grace period (`run-codex.mjs:276`), with the delay injectable so the test stays fast.
- The full suite passes: `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`.
- A Manual row covers one real Codex run that fails once (for example a forced non-zero exit) and then continues.
