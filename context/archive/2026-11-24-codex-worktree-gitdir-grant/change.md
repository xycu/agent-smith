---
change_id: codex-worktree-gitdir-grant
title: Pass the worktree gitdir write grant to Codex at launch
status: archived
created: 2026-11-24
updated: 2026-11-24
archived_at: 2026-11-24T22:04:39Z
---

## Notes

Source: GitHub issue #284, "Stop per-worktree Codex approval prompts: pass the gitdir write grant at launch".

Every new Agent Smith worktree triggers a Codex approval prompt, and each approval appends a line to `~/.codex/config.toml` (`[permissions.agent-smith.filesystem]` with `"<repo>/.git/worktrees/agent-smith-<change-name>" = "write"`). The list never shrinks (42 lines across two repos on one config). Under a profile that extends `:workspace`, Codex protects the linked worktree's resolved gitdir as read-only, and the exact-path rule beats a broader `<repo>/.git` grant.

Proposal: where Agent Smith launches Codex for a worktree, pass the grant per run:

```bash
GITDIR="$(git -C "$WORKTREE" rev-parse --absolute-git-dir)"
codex ... -c "permissions.agent-smith.filesystem={\"$GITDIR\"=\"write\"}"
```

- Resolve with `git rev-parse --absolute-git-dir`; the admin dir name can differ from the worktree folder name (numeric suffix on collision).
- Use the inline-table form; the dotted form fails because Codex splits the key on the `.` in `.git` (datacas/code-cycle-toolkit#206).
- That project verified it on Linux (bubblewrap) only; check macOS (seatbelt).
- Confirm a `-c` filesystem table merges with the profile's existing filesystem rules rather than replacing them; if it replaces them, the flag must carry the full rule set.

Open question: this only works for worktree runs started as separate Codex processes. Worktree sessions inside an already-started Codex session need another fix (for example a fixed pool of worktree folder names).

Related upstream: openai/codex#27418, #23661, #48717, #49303. See also memory note "Codex worktree gitdir write" (the current manual `~/.codex/config.toml` step).

Acceptance:
- A fresh worktree run on macOS stages and commits with no approval prompt and no new line in `~/.codex/config.toml`.
- Writes to `<common>/.git/hooks` and `<common>/.git/config` from inside the sandbox stay denied.
