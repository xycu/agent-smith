# Forbid nested subagents in pipeline steps — Plan Brief

> Full plan: `context/changes/no-nested-subagents/plan.md`

## What & Why

A pipeline step is a subagent. When it starts its own subagent, Claude Code sends the nested report to the top session, not to the parent. The parent ends without a result, the step fails although the work finished, and the rollback discards the code. It happened on 2026-11-09 in the implement steps of `neutral-orchestrator-retry` and `worktree-pr-only`, because `/10x-goal-implement` dispatches a subagent per phase. This plan forbids nesting in the prompts and makes the orchestrators ignore a hand-back they did not ask for.

## Starting Point

The unattended suffix in `skills/10x-pipeline/policy.json` has no rule about the `Agent` tool. The `implement`, `implement-segment` and `implement-retry` templates run `/10x-goal-implement` and say nothing about nesting. `research-with-map.md` even demands three parallel subagents. `docs/REFERENCE.md` Limits says `10x-goal-implement` spawns its own subagents and only asks for a spawn depth of 3. Both `SKILL.md` files have five anti-stall rules, and three tests pin "five".

## Desired End State

Every prompt carries a hard **MUST NOT** call the `Agent` tool rule before its `RESULT:` instructions. The implement templates and the e2e and tdd guides tell their skills to work in the same subagent. Both orchestrator skills have a sixth anti-stall rule: a hand-back from a subagent not launched for the current step is not a step result. REFERENCE.md says so, ADR-018 records why, and the suite passes with a new `nested-subagents.test.mjs`.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Where the ban lives | One rule line in `prompts.suffix` | The suffix reaches every step, the `os-` templates and `archive` included | Plan (change.md) |
| Implement templates | Same-subagent line in `implement`, `implement-segment`, `executor-retry.md`; a similar line in the tdd and e2e guides | A rule that names the delegating skill is harder to ignore | Plan |
| `implement` shape | Stays a string, rule appended after a newline | Tests call string methods on it | Plan |
| Orchestrator rule | Rule 6 in the shared `## Anti-stall rules` section of both skills | `change.md` keeps that section equal in both; three "five" tests become six | Plan |
| `research-with-map.md` | Reworded: do the three analyses yourself | Otherwise it contradicts the suffix | Plan |
| `advisor.md` | Left as is | Its worker rule is vacuous but true and pinned by a test | Plan |
| Router code | Not touched | It cannot see who wrote a result file | Plan |
| ADR-018 | Written, status Proposed | A documented limit is reversed and every prompt changes, as in ADR-016 | Plan |

## Scope

**In scope:** suffix rule, implement and executor rules, research prompt, sixth anti-stall rule in both skills, REFERENCE.md, ADR-018, AGENTS.md list, new and updated tests.

**Out of scope:** router or policy-key changes, edits to the skills in `~/.claude/skills/`, the Claude Code bug report, `context/archive/`.

## Architecture / Approach

Text and tests only. Subagent side first (the fix itself), orchestrator side second (the guard for a subagent that ignores the prompt), documents last. Each phase ends with the whole suite green.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Subagent-side rules | Suffix rule, implement and executor lines, research prompt fix, new test file | Rule form check and tests that pin prompt text |
| 2. Orchestrator rule in both skills | Rule 6, equal sections, tests updated to six | Deadlock with rules 1 and 4 if worded loosely |
| 3. Documents | REFERENCE.md, ADR-018, AGENTS.md, doc checks | Docs claiming more than the rules deliver |

**Prerequisites:** Node 24, the in-flight changes that touch the same prompts and skills are done (per `change.md`).
**Estimated effort:** about 2 to 3 sessions across 3 phases.

## Open Risks & Assumptions

- A subagent that ignores the suffix still nests; the orchestrator rule helps only when it can tell the hand-back came from a subagent it did not launch.
- The skills `10x-goal-implement`, `10x-tdd` and `10x-e2e` live outside this repository and may change their delegation wording.
- ADR-018, the placement of the sixth rule and the `fix:` commit type are unattended readings for the owner to confirm.

## Success Criteria (Summary)

- A returned prompt of any step forbids the `Agent` tool and tells delegating skills to work in the same subagent.
- Both orchestrator skills ignore a hand-back from a subagent they did not launch for the step.
- `docs/REFERENCE.md` no longer says `10x-goal-implement` spawns subagents, and the whole suite passes.
