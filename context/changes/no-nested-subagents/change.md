---
change_id: no-nested-subagents
title: Forbid nested subagents in pipeline steps
status: implemented
created: 2026-11-09
updated: 2026-11-10
archived_at: null
---

## Notes

A step subagent must never spawn its own subagent. In Claude Code a nested subagent's hand-back report goes to the top session, not to its parent subagent. The parent ends its turn without the result, and the step fails although the work finished.

Seen on 2026-11-09 in the `implement` steps of `neutral-orchestrator-retry` and `worktree-pr-only`. `/10x-goal-implement` delegated Phase 1 to a nested subagent, and the parent handed back `failed`. The finished Phase 1 code then survived only in the rollback ref `refs/agent-smith/neutral-orchestrator-retry/82431871c992/failed-4`.

This is a bug in two places:

- **Claude Code:** hand-back routing. A bug report draft is queued.
- **agent-smith:** it relies on nesting. The Limits section of `docs/REFERENCE.md` says "`10x-goal-implement` spawns its own subagents" and only asks for `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` of 3 or more.

Scope:

- **Prompt suffix:** add a hard rule to the unattended suffix the router appends to every step prompt (`policy.json`). The subagent **MUST NOT** call the Agent tool and does every phase itself, overriding any skill that delegates.
- **Implement templates:** the templates that run `/10x-goal-implement` (`implement`, `implement-segment`, `implement-retry`, and the e2e and tdd executors where they apply) tell it to run every phase in the same subagent.
- **Orchestrator skills:** `skills/10x-pipeline/SKILL.md` and `skills/openspec-pipeline/SKILL.md`. A hand-back from a subagent the orchestrator did not launch for the current step is never a step result. Ignore it and keep waiting for the step's own report. The anti-stall section stays equal in both skills.
- **Docs:** fix the Limits note in `docs/REFERENCE.md`, and update the rule-form and prompt tests.
- **Lesson:** already recorded in `context/foundation/lessons.md` ("Never let a subagent spawn its own subagent").

Run this change after the four in-flight changes finish, because it touches the same prompts and skills. New ADR, if one is needed: ADR-018.
