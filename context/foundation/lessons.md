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

## Grep every doc for the old behavior when a script's output changes

- **Context**: Everywhere
- **Problem**: Everything
- **Rule**: Always grep every doc, including docs/REFERENCE.md, for the old behavior when a change alters a script's output, not only the files the plan lists.
- **Applies to**: plan-review, implement, impl-review

## Open a lock-free read target by descriptor, never lstat then read

- **Context**: Any code that reads a file a concurrent writer may replace or remove without taking the writer's lock (for example the setup pending record, ADR-010 Amendment 8).
- **Problem**: An lstat followed by a read leaves a window where the path becomes a symlink or FIFO, so the reader follows it or blocks forever. Found in the impl-review of prepare-run-setup-lock-and-residue-followups (fix 5c3dd345).
- **Rule**: Open the path with O_NOFOLLOW | O_NONBLOCK, fstat the descriptor and require a regular file before reading; treat ENOENT as absent only after a second lstat confirms it.
- **Applies to**: plan, plan-review, implement, impl-review
