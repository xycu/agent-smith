---
change_id: run-root-cross-worktree-writes
title: Stop a write hook from silently blocking step 1 in the run root
status: implemented
created: 2026-11-21
updated: 2026-11-23
archived_at: null
---

## Notes

**Origin.** [Issue #243](https://github.com/xycu/agent-smith/issues/243) (bug), seen in two runs of one project on agent-smith 1.15.0, Claude host.

**The defect.** In an isolated run a `PreToolUse` Write hook refused writes that cross worktrees:

- The orchestrator session was started from a sibling worktree and could not write into the run root. `init` routed step 1, but no step subagent ran. The run was resumed from the main checkout as a neutral rerun, recorded as an orchestrator fault.
- In another run a manual-verify step said the run root "may only write plan.md and evidence/". It could not install dependencies or add a symlink, so a paid eval row stayed unproven.

**Open question for the frame.** The plugin's `hooks/hooks.json` registers a `PreToolUse` hook for `Bash` only (`step-guard.mjs`). `run-claude.mjs` adds its own `PreToolUse` guard for headless Claude children. Neither is known to match `Write`. The frame must find which hook refused (the plugin, the host's worktree sandbox, or the target project's own settings) before a fix is planned.

**Expected (from the issue).**

- Decide and document which paths a step may write in the run root: the change folder, `evidence/`, and the working tree for implement steps. Make the refusing rule match, if the plugin owns it.
- A refusal names the rule and the path. `init` records an actionable note instead of a silently undispatched step.
- The orchestrator's cross-worktree writes into the run root, as `init` and `prepare-run` need them, are allowed, or `init` fails fast with one clear error before it routes step 1.

**Evidence.** `context/changes/<id>/agent-smith/report.md`, section "Neutral reruns", for two changes; `run.jsonl` `neutralRetries.note` of step 1.

**Schedule.** `context/changes/WAVES.md`: frame in Wave D, implementation in Wave 4, Setup lane.
