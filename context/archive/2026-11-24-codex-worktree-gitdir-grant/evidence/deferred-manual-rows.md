# Deferred Manual rows

Owner decision, 2026-11-24, in the Wave 6 closeout. Rows 3.3 and 3.4 stay unticked and move to S-20 (`supported-host-acceptance`).

- 3.3 (a fresh isolated run on macOS with Codex 0.172.0 or newer commits with no approval prompt and adds no `~/.codex/config.toml` line) and 3.4 (from inside that run's sandbox, writes to `<common>/hooks` and `<common>/config` are denied) need a live Codex step in an isolated run worktree. S-20 runs the OpenAI-only and mixed combinations on both chains and covers them.
- Row 3.4 is the security half of the grant. S-20 must record the denial of both paths, not only a successful commit.
