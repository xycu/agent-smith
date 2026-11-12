---
change_id: stale-last-result-cleanup
title: Remove a stale last-result.json left after a crash between writeLog and rmSync
status: new
created: 2026-11-13
updated: 2026-11-13
archived_at: null
---

## Notes

**Origin.** Review finding F2 of change `attach-result-persist-first` (PR #138, merged in Wave 2). Its Decision is PENDING: "outside the plan's scope and a router-behavior change; the owner decides whether the stale-file cleanup deserves its own change." The owner decided it does. Source: `context/changes/attach-result-persist-first/reviews/impl-review.md`, section `### F2`.

**What PR #138 already fixed.** `attachResult` in `skills/10x-pipeline/scripts/flow.mjs` used to remove `agent-smith/last-result.json` before it wrote the log entry, so a crash between the two lost a step's result. It now writes the log first (`writeLog`), then removes the file (`fs.rmSync(p.result)`). A crash can no longer lose a result. The tests are in `skills/10x-pipeline/test/result-persist.test.mjs`.

**The window that is left.** The two calls are adjacent, but not atomic. If the process dies after `writeLog` and before `rmSync`:
1. The log entry of the step already holds its result (`last.result` is set), and `last-result.json` is still on disk.
2. The next `next` sees `last.result` set and skips `attachResult`, so nothing removes the file.
3. The step after that runs, and its `attachResult` finds a result file the orchestrator never wrote for it. It reads the stale file as that step's result: the wrong status, signals and `RESULT` note feed the routing decision, with no error.
4. In an isolated run, `stepCommit` can also commit the stale file.

The window is two synchronous calls, so it is very small. The cost of hitting it is a wrong routing decision that nobody sees, which is why it is worth closing rather than documenting.

**Direction from the review (not decided).** On the skip path of `next` (a result is already attached and the file is still present), remove the stale file. Open questions for the plan:
- How `next` tells a stale file from a result the orchestrator wrote for the pending step in the same call. The router already compares file mtimes with the step's `startedAt` for other outputs (see `skills/10x-pipeline/test/ahead.mjs` and `stampAhead`); check whether that is a safe discriminator here or whether a marker in the log entry is needed.
- Whether the same gap exists on the OpenSpec chain (`--chain openspec`) and in the `usage` command path (ADR-019), which also attaches late figures.
- Whether the neutral rerun path (ADR-015, `orchestrator-error`) can leave a result file that this cleanup must not remove.

**Constraints.**
- Router code only: keep it in `scripts/flow.mjs` or the module that owns the path, and never edit `run.jsonl` or `meta.json` by hand (AGENTS.md Hard Rules).
- Remove one file with a single `unlink`. No recursive delete.
- Node 24, no npm dependencies, `node:` built-ins only.
- Update the routing bullets in `docs/REFERENCE.md` when the behavior of `next` changes.

**Done when.**
- A test simulates the crash window (log entry written, `last-result.json` left on disk) and shows that the next `next` does not read the leftover file as a later step's result and removes it.
- The normal path is unchanged: a result file the orchestrator writes for the pending step is still consumed once.
- The same holds for the OpenSpec chain and an isolated run, or the plan says why it cannot.
- `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` passes.
