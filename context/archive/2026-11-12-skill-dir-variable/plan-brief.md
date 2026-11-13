# Skill directory variable for script paths — Plan Brief

> Full plan: `context/changes/skill-dir-variable/plan.md`

## What & Why

Both SKILL.md files tell the orchestrator to resolve `<this skill's base directory>` itself, from a line Claude Code prints today but does not document. A wrong guess (plugin cache path with a version folder, a path with a space) leaves the router unable to start. Claude Code documents `${CLAUDE_SKILL_DIR}` for exactly this, substituted in skill markdown.

## Starting Point

`skills/10x-pipeline/SKILL.md:25-27,132` and `skills/openspec-pipeline/SKILL.md:28-30,141` use the prose placeholder. Four assertions pin it: `skill-loop.test.mjs:92` and `openspec-skill.test.mjs:79,82,155`. `agents.test.mjs` and `provenance.test.mjs` do not read SKILL.md text.

## Desired End State

Every script path in both skills starts with `${CLAUDE_SKILL_DIR}`; the old placeholder is gone and a test keeps it out. README states the minimum Claude Code version. A live run of an installed plugin confirms the cache path resolves.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Variable | `${CLAUDE_SKILL_DIR}` | Documented substitution (change.md, skills page). | Plan |
| OpenSpec paths | `${CLAUDE_SKILL_DIR}/../10x-pipeline/...` | Router stays shared, no copy (ADR-013). | Plan |
| README minimum | Claude Code 2.1.292 | Variable arrived in 2.1.69, Agent `effort` in 2.1.292 (changelog); the higher one governs. | Plan |
| Quote note | Add "Quote the path for the shell." to the `Router:` line | The PR script lines already say it; the router line did not. | Plan |
| `allowed-tools` narrowing | Not done | Out of scope per change.md. | Plan |

## Scope

**In scope:** two SKILL.md files, two content tests, one README sentence, a live Manual check.

**Out of scope:** `allowed-tools` narrowing, router/policy/prompt changes, `${CLAUDE_PLUGIN_ROOT}`, a fallback for old Claude Code.

## Architecture / Approach

Textual swap in the SKILL.md files, keeping line prefixes so tests still find lines by `startsWith`. Tests change to the new literal and gain an absence check for the old placeholder.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. SKILL.md and tests | Both skills use `${CLAUDE_SKILL_DIR}`; tests re-pinned | `$` and `{` in test strings (template literal pitfalls) |
| 2. README | Minimum Claude Code version stated | Version wrong if the changelog misread |
| 3. Suite, CI, live check | Green suite and CI; installed-plugin run | Live check needs a human and an installed plugin |

**Prerequisites:** Node 24, the run's worktree.
**Estimated effort:** about 1 session, 3 small phases.

## Open Risks & Assumptions

- Assumption: the substitution applies to skills loaded from an installed plugin; only the live run (3.5, 3.6) proves it.
- Assumption: the minimum version is the higher of 2.1.69 and 2.1.292, read from the public changelog on 2026-11-12.
- A path with a space still needs shell quoting by the orchestrator; the note on the `Router:` line covers it.

## Success Criteria (Summary)

- Neither skill asks the orchestrator to work out where the plugin is installed.
- Full suite passes locally and CI is green.
