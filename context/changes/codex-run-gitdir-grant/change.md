---
change_id: codex-run-gitdir-grant
title: Grant the run worktree gitdir to Codex per run and show why the preflight refused
status: impl_reviewed
created: 2026-11-24
updated: 2026-11-24
archived_at: null
---

## Notes

**Origin.** [Issue #281](https://github.com/xycu/agent-smith/issues/281), Codex CLI 0.171.0, macOS, agent-smith 1.16.1, Claude host, `--provider-mode split`, isolated worktree run.

**The defect.** In split or codex mode, `run-codex.mjs` refuses before any model launches: "Codex permission preflight cannot verify required Git capability … No model launched." The profile from #245/#257 (`extends = ":workspace"`, `"<repo>/.git" = "write"`) does not cover the linked worktree's own gitdir, `<repo>/.git/worktrees/agent-smith-<id>`. Only an exact grant on that path works.

**Reproduced 2026-11-24** on codex-cli 0.171.0 with a scratch repo and a private `CODEX_HOME` (details in the plan).

**Prior work.** `context/archive/2026-11-21-codex-profile-and-gitdir-access` (#257) added the `init` warning for the profile and the common-dir grant.
