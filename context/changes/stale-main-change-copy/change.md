---
change_id: stale-main-change-copy
title: Remove the main-checkout copy of a change folder once the run branch holds it
status: new
created: 2026-11-12
updated: 2026-11-12
archived_at: null
---

## Notes

Source: the repo review of 2026-11-12 (LLM engineering and Claude Code practice). Severity: medium.

### Problem

Start step 3, case 2, of both orchestrator skills copies the change folder into the new worktree with `cp -Rp`. A folder that is untracked in the main checkout (fresh from `/10x-new`) stays there. The skills only say so in the final message ("the change folder in the main checkout is a stale copy ... remove or stash it before merging"). After an `--archive` run the merged tree has no `context/changes/<id>/`, so git never complains and the copy stays for good, with `status: new`.

The router does not protect against it: `guardArchived` (`skills/10x-pipeline/scripts/state.mjs:344`) looks for an archive folder only when the live folder is gone.

### Evidence and reproduction (verified)

- This repository, 2026-11-12: `git status` shows `?? context/changes/agent-smith-coauthor/` (one file, `change.md`, `status: new`) while `context/archive/2026-11-12-agent-smith-coauthor/` is on `main` (`b0792cf chore(archive): close agent-smith-coauthor`). `/10x-status` lists the archived change as new.
- Scratch project with `context/changes/x/change.md` (`status: new`) and `context/archive/2026-11-12-x/change.md` (`status: archived`): `route.mjs init x --goal g` returns `run plan`, so the pipeline starts a second run of an archived change. `verify-archive x` does report `context/changes/x still exists next to context/archive/2026-11-12-x.`

### Fix direction

1. Router: at `init`, halt and write nothing when the live change folder and an archive folder of the same id both exist, naming both paths. `/10x-new` already refuses an id that exists in the archive, so no valid flow needs both. Apply the same rule to the OpenSpec chain (`openspec/changes/archive/`).
2. Skills: after `init` returned for a new worktree (the start commit then holds the folder on the run branch), delete each untracked file of `<root>/context/changes/<id>/` that is byte-identical to its blob in the start commit, one by one, then `rmdir` the empty directories deepest first (ADR-016). Leave a file that differs or is tracked, and name it. This belongs in the setup script of `worktree-setup-script`; until that exists it is one more prose step.
3. Drop the "stale copy" paragraph of the final message once step 2 exists; keep one line for files that were left.
4. One-off for this repository: delete `context/changes/agent-smith-coauthor/change.md` and `rmdir` the folder.

### Tests

- `init` with both folders halts and leaves the tree byte-identical (10x and OpenSpec).
- The cleanup: identical untracked files are removed, a differing file and a tracked file stay, a resume removes nothing.

### Done when

After a run in its own worktree the main checkout holds no untracked copy of the change folder, and `init` refuses an id that is already archived.
