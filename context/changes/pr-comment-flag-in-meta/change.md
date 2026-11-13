---
change_id: pr-comment-flag-in-meta
title: Store the --pr-comment request in meta.json instead of a session task
status: implementing
created: 2026-11-12
updated: 2026-11-13
archived_at: null
---

## Notes

Source: the repo review of 2026-11-12 (LLM engineering and Claude Code practice). Severity: medium.

### Problem

Both orchestrator skills keep the user's `--pr-comment` flag in the session task list: "A task is the only place the `--pr-comment` request is stored" (Start step 5 of `skills/10x-pipeline/SKILL.md` and `skills/openspec-pipeline/SKILL.md`). This has three costs.

- It depends on tools that are not always there. The task tools need `CLAUDE_CODE_ENABLE_TODO_TOOLS=1` and a permission; this repository sets both in `.claude/settings.json` (and allows `TaskCreate` and `TaskList` but not `TaskUpdate`, which the skills also call). A project that installs the plugin has none of this unless its owner adds it. When the tools are missing the skill prints `PR comment: skipped, task list unavailable` and the user's explicit request is dropped.
- A resume in a new session depends on what the task list of that session holds, not on the run.
- It is a large share of the skill text: three tools in `allowed-tools`, Start step 5, a "call TaskList" paragraph in `done`, `archive` and `halt` (4 places in the 10x skill), and the task bookkeeping of the "PR comment (opt-in)" section.

The router already stores the sibling flag `--archive` in `meta.json` and returns it. `pr-comment.mjs` is idempotent by design (it edits its own comment, found by a marker), so "post once" needs no task.

### Fix direction

- `init --pr-comment [true|false]` stores `prComment` in `meta.json`, as `--archive` does: a resume keeps it, `--pr-comment false` clears it. Add the flag to `INIT_FLAGS` (`route.mjs:824`), since `init` halts on a flag it does not read.
- The `done`, `archive` and `halt` outputs carry `prComment: true` when set; `status` shows it. The `archive` action carries it before the folder moves.
- Skills: pass the flag to `init`, delete Start step 5, replace every "call TaskList ..." paragraph with "when the output has `prComment: true`, do the PR comment step", and drop `TaskCreate`, `TaskUpdate` and `TaskList` from `allowed-tools`.
- The hard rule stays intact: the router never calls `gh`; the orchestrator still runs `pr-comment.mjs`.
- `.claude/settings.json`: remove the env key and the two permissions if nothing else needs them.
- Docs: `docs/REFERENCE.md` (PR comment section), `README.md` options table, the ADR that introduced the task (amend, do not rewrite). The skip text "see the README" points at a passage the README does not have; it goes away with the task.

### Tests

- `init` stores, keeps, clears and reports the flag on both chains; an archived run returns it in the `archive` action.
- Content checks in `skill-loop.test.mjs`, `openspec-skill.test.mjs` and `archive-gate.test.mjs`: no `TaskList` in either skill, the new condition in the three branches.
- `pr-comment.test.mjs` is unchanged.

### Done when

A run started with `--pr-comment` posts its report in any session that can run the script, with or without task tools, and neither skill names a task tool.
