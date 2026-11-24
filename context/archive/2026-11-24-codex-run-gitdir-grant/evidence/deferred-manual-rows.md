# Deferred Manual rows

Owner decision, 2026-11-24, in the Wave 6 closeout. Rows 1.4, 2.2 and 3.3 stay unticked and move to S-20 (`supported-host-acceptance`).

- 1.4 (the preflight passes with no `~/.codex/config.toml` entry for the run worktree), 2.2 (a live refusal names the denied `.git/worktrees/agent-smith-<id>` path) and 3.3 (a live `--provider-mode split` run completes its first OpenAI step with no manual grant) all need live Codex sessions in an isolated run worktree. S-20 runs the OpenAI-only and mixed combinations on both chains and covers them.
- `codex-worktree-gitdir-grant` (PR #287, also in v1.17.0) passes the grant at launch; its own live rows are deferred to S-20 as well.
