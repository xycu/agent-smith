# Deferred Manual rows

Owner decision, 2026-11-24. Rows 1.3, 1.4 and 1.5 stay unticked and move to S-20 (`supported-host-acceptance`).

- All three need Claude Desktop sessions that refuse a sibling-worktree or shared `.claude/` write, and an authorized session that resumes the refused run. Computer Use did not approve Claude Desktop and Orca reported `runtime_unavailable` when they were tried (see `unproven.md`). The skill contract, worktree reuse and result intake pass in local tests.
- The change merged as [#277](https://github.com/xycu/agent-smith/pull/277) and shipped in v1.16.2.
