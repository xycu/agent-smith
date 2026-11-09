# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Check live and archived folders of every chain before choosing the owner of a change name

- **Context**: Router code that decides which chain (10x or OpenSpec) owns a change name, such as `storedChain` and `resolveChain` in `skills/10x-pipeline/scripts/route.mjs`, and any command that reads or writes per-change run state.
- **Problem**: A name used by an archived OpenSpec run and by an archived 10x change was read as an OpenSpec run, so the 10x `verify-archive` returned false for a change that was archived. Found in the openspec-pipeline implementation review (F1).
- **Rule**: Always check the live and archived folders of every chain before the router decides which chain owns a change name.
- **Applies to**: plan, plan-review, implement, impl-review

## Never read a verdict as cleaner than its listed findings

- **Context**: Any reader of a review or verdict file that has both a header count and listed findings, such as `readVerdict` for the OpenSpec `verify.md` and the finding parser of ADR-011.
- **Problem**: A `- ` line under `## Critical` with `Critical: 0` in the header read as PASS, so a run could end or archive with a critical issue still listed. Found in the openspec-pipeline implementation review (F3).
- **Rule**: Never read a verdict file as cleaner than its listed findings; take the larger of the header count and the listed items.
- **Applies to**: plan, plan-review, implement, impl-review

## Never let a subagent spawn its own subagent

- **Context**: Any step that runs as a subagent, such as an agent-smith pipeline step or a skill like /10x-goal-implement that delegates phases.
- **Problem**: In this harness a nested subagent's hand-back report goes to the top session, not to its parent. The parent ends its turn without the result, and the step fails although the work finished. Seen 2026-11-09 in the implement steps of neutral-orchestrator-retry and worktree-pr-only.
- **Rule**: Never spawn a subagent from inside a subagent; a subagent does its work itself, and only the top-level orchestrator spawns subagents.
- **Applies to**: all
