# ADR-018: A step subagent starts no subagent; the orchestrator ignores a foreign hand-back

- **Status:** Proposed (unattended reading, owner confirmation pending)
- **Date:** 2026-11-10
- **Deciders:** the repository owner (the request in `change.md`, 2026-11-09); unattended implementation run of change `no-nested-subagents` for the readings marked A1 to A6 below
- **Origin:** change `no-nested-subagents` (`context/changes/no-nested-subagents/change.md` and `plan.md`); lesson "Never let a subagent spawn its own subagent" in `context/foundation/lessons.md`

## Context

- Every pipeline step runs as a subagent of the orchestrator. In Claude Code the hand-back report of a subagent that a subagent started goes to the top session, not to the subagent that started it. The parent ends its turn without the result, and the step fails although the work finished.
- Seen on 2026-11-09 in the `implement` steps of `neutral-orchestrator-retry` and `worktree-pr-only`. `/10x-goal-implement` delegated Phase 1 to a nested subagent and the parent handed back `failed`. The rollback then reset the worktree, and the finished Phase 1 code survived only in the side ref `refs/agent-smith/neutral-orchestrator-retry/82431871c992/failed-4`.
- `/10x-goal-implement` dispatches one subagent per phase and one per gate fix. `/10x-tdd` lists the Agent tool among its tools, and `/10x-e2e` suggests sub-agents for search and analysis. `prompts/research-with-map.md` demanded three parallel subagents.
- The Limits section of `docs/REFERENCE.md` stated that `10x-goal-implement` starts subagents of its own and asked only for a spawn-depth setting, so the plugin relied on nesting.
- The router cannot see what a subagent calls and cannot see who wrote a result file. Only prompt text and the orchestrator skills can act on it.

## Decision

Rules, written as scenarios (the form of ADR-004):

### Subagent side

**GIVEN** a skill, a prompt or its own judgment would have a step subagent delegate work to a subagent, run work in parallel with subagents or use the Agent tool **WHEN** the subagent decides how to do that work **THEN** it **MUST NOT** call the Agent tool or the Task tool or start any other subagent, and does all of that work itself (A1).

**GIVEN** the router returns a prompt **WHEN** it appends `prompts.suffix` **THEN** the prompt **MUST** carry the rule above, so every template, the `os-` templates and the `archive` prompt included, gets it.

Amendment (change `proper-structure-of-rules`): the rule now lives in the always-true file `skills/10x-pipeline/rules/top.md` (ADR-023), which the router appends after `prompts.suffix` to every prompt; the prompt still carries it, and a suffix override no longer removes it.

**GIVEN** a template runs `/10x-goal-implement` (`implement`, `implement-segment`, `implement-retry`) **WHEN** the skill would dispatch a subagent for the code of a phase or for a gate fix **THEN** the template **MUST** tell the subagent to write that code and those fixes itself, for every phase (A1, A3).

**GIVEN** the `implement-tdd` or `implement-e2e` guide runs its skill **WHEN** the skill would hand a search, an analysis, a test or a spec to a subagent **THEN** the guide **MUST** tell the subagent to do that work itself.

**GIVEN** a wired prompt asked for subagents (`research-with-map.md`) **WHEN** the suffix forbids them **THEN** the prompt **MUST** ask for the same work done in the step subagent, one analysis after the other (A4).

### Orchestrator side

**GIVEN** a hand-back arrives that is neither the result of the Agent call the orchestrator made for the current step nor a task notification that names that call's subagent **WHEN** the current step or the archive subagent still waits for its own report **THEN** the orchestrator **MUST NOT** treat it as a step result: it writes no result file from it and does not call `next` on it (A2).

**GIVEN** the two orchestrator skills **WHEN** the rule above is added **THEN** it **MUST** be the sixth rule of the `## Anti-stall rules` section, in the same words in both skills, so the sections stay equal.

## Consequences

- A subagent that follows the suffix finishes its own work and hands back its own `RESULT:` line, so a step no longer fails with the work done.
- `/10x-goal-implement` runs every phase in the step's own subagent. Its context grows with the plan; a long plan uses more of the step subagent's context than before.
- `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` is no longer needed.
- Every prompt changes through the suffix, so a run in flight at upgrade time records `provenance.drift` for `prompts` at its next `next` call. Routing is unchanged.
- Three tests that pinned "exactly five" anti-stall rules now pin six, and `skills/10x-pipeline/test/nested-subagents.test.mjs` pins the new text.

## Alternatives

- Raise `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH`. Rejected: depth is not the fault; the nested report still goes to the top session.
- A router-side check of the result. Rejected: the router cannot see who wrote a result file or what a subagent called.
- Wait for the upstream Claude Code fix. Rejected: runs fail now, and a rollback discards finished work.
- Allow nesting in research steps only. Rejected: the hand-back routing is the same for every step, so no template gets an exception.

## Assumptions (unattended readings, for the owner to confirm)

- A1: the suffix rule is the one that must hold; the implement and executor lines repeat it in the words of the skill that delegates, because a subagent weighs a rule that names its own skill more than a general one.
- A2: the orchestrator rule goes into the anti-stall section as rule 6, because that section already holds the hand-back rules and must stay equal in both skills.
- A3: the `implement` template stays a string, so its rule is a second line of that string.
- A4: `research-with-map.md` is rewritten rather than left to lose against the suffix, because two rules that disagree in one prompt make a subagent guess.
- A5: `refactor-opportunities-research.md` also asks for subagents. It is not wired, so it stays as it is, and `prompts/README.md` says it needs the same rewrite before anyone wires it.
- A6: the commit type of the change is the owner's call; `fix:` fits a change of prompts and docs only.

## Not covered

- What a subagent actually calls: the router cannot read it, so a subagent that ignores the rule can still nest.
- A nested hand-back the orchestrator cannot tell apart from the step's own report.
- The upstream hand-back routing bug in Claude Code, which stays open.
- The skills in `~/.claude/skills/` (`10x-goal-implement`, `10x-tdd`, `10x-e2e`), which are not edited; the prompts override them.
