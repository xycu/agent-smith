---
change_id: prepare-run-retry-after-failed-setup
title: Finish the change-folder copy when prepare-run is retried after a failed setup
status: archived
created: 2026-11-19
updated: 2026-11-21
archived_at: 2026-11-21T20:56:37Z
---

## Notes

**Origin.** Whole-repo audit on 2026-11-19, finding 9 (should fix). Reproduced in scratch repositories.

**The defect.** `skills/10x-pipeline/scripts/prepare-run.mjs:218-239` creates the run worktree (`git worktree add`, line 232) and then copies the change folder into it (`copyChange`, line 233). When the copy throws or the process is killed, the branch and the worktree stay. On the next call the branch already exists, the code finds the registered worktree and answers `case: "reused"` (lines 236-238) with `copied: false` and `reason: null`. It never copies again.

**Reproduced case.** An unreadable file in the change folder:

- Run 1: `reason: EACCES ... copyfile`.
- Run 2: `case: "reused"`, `runRoot: <worktree>`, `reason: null`, and `context/changes/demo/` in the worktree is empty.
- Run 3, after the source file was fixed: still `reused`, still empty.

The skill loop then finds no `change.md` in the run root and tells the user to run `/10x-new`. After a kill in the middle of the copy and a manual lock removal, the run starts with partial inputs.

**Second case in the same branch of the code.** A worktree directory that was removed by hand gives the raw `ENOENT: no such file or directory, stat ...` from line 262, with no hint to run `git worktree prune`.

**Related case (decide in the plan whether it belongs here).** `copyChange` (`prepare-run.mjs:100-126`) only adds and overwrites. The worktree is checked out from `HEAD`, so an uncommitted deletion in the change folder is undone: the user deletes a stale tracked `plan.md` to force a re-plan, and the worktree still holds it. Reproduced: status `D  plan.md` and ` D research.md`; the worktree holds `change.md plan.md research.md`, and the router sees the old plan as existing.

**Direction (for the plan to confirm).**
- In the registered-worktree branch, when `<worktree>/<prefix><change>/agent-smith/meta.json` does not exist and the source change folder does, call `copyChange` again and report `copied: true`. This is safe because `init` never ran in that worktree.
- Turn the `ENOENT` into a message that names the missing worktree path and `git worktree prune`.
- For the deletion case: after `copyChange`, remove in the destination, one file at a time, each path that `git ls-files --deleted -z -- <change>` and `git diff --cached --name-only --diff-filter=D -z -- <change>` report.

**Constraints.**
- Never delete a directory tree with a recursive or forced command; use `removeTree` or per-file removal (ADR-016).
- A worktree in which `init` already ran is never overwritten by a new copy; the uncommitted work of a live run wins.
- The JSON contract stays: `reason: null` on success, `runRoot: null` on failure, usage errors exit 2 (ADR-010 Amendment 2).

**Done when.**
- A test: a copy failure, then a retry after the cause is fixed, ends with a complete change folder in the worktree and `copied: true`.
- A test: a worktree in which `init` already ran is reused without a copy.
- A test: a worktree directory removed by hand gives a message that names `git worktree prune`.
- If the deletion case is taken: a test that an uncommitted deletion in the change folder is carried into the worktree.
- The full suite passes: `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`.
