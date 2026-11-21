---
change_id: codex-profile-and-gitdir-access
title: Warn at init when the Codex profile or the worktree gitdir access is missing
status: implemented
created: 2026-11-21
updated: 2026-11-21
archived_at: null
---

## Notes

**Origin.** [Issue #245](https://github.com/xycu/agent-smith/issues/245).

**The defect.**

1. `~/.codex/config.toml` had `default_permissions = "agent-smith"`, but the `[permissions.agent-smith]` profile is defined only in this repository's own `.codex/config.toml`. In any other project the named profile does not exist. Neither `init` nor `prepare-run` writes it into the target project or warns about it.
2. Claude steps in a linked worktree ran `git` unsandboxed in at least two runs ("the worktree .git dir is read-only inside the sandbox", "index lock is outside the sandbox write scope"). A linked worktree commits into the main checkout's `.git` (objects, refs, `worktrees/<name>`), which lies outside the worktree.
3. Docker and the AI gateway were unreachable from the sandbox in two runs, so database and browser gates were "not proved".

**Expected (from the issue).**

- `init` checks the effective Codex permission profile for the target project. When `default_permissions` names a profile that is not defined there, it warns with the snippet to add: a profile that `extends = ":workspace"` plus write access to the main checkout's `.git`.
- `init` detects a linked-worktree run root and warns when the main `.git` is not in the sandbox write list, with the `sandbox.filesystem.allowWrite` entry to add.
- Docker and gateway reachability belong to the readiness command of `run-root-worktree-readiness`, not to this change.

**Constraints.** Warn, do not write the user's or the project's config: the router never edits `~/.codex/config.toml` or `.claude/settings*.json`. Keep the Codex publication guard of `codex-step-publication-guard` intact; the added write access covers the main `.git`, not the network.

**Schedule.** `context/changes/WAVES.md`: Wave 3, Lock and Codex lane. It feeds S-15 `actionable-run-prerequisites`.
