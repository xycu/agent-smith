---
change_id: quote-router-in-skill-loops
title: Quote the script path in every node call of both SKILL.md loops
status: new
created: 2026-11-13
updated: 2026-11-13
archived_at: null
---

## Notes

**Origin.** Review finding F1 of change `skill-dir-variable` (PR #140, merged in Wave 2). Its Decision is PENDING: "outside the plan's scope (the plan keeps every `node $ROUTER` call as it is); the owner decides whether to quote the loop calls in a follow-up change." The owner decided to do it. Source: `context/changes/skill-dir-variable/reviews/impl-review.md`, section `### F1`.

**State after PR #140.** Both skills define their script paths from `${CLAUDE_SKILL_DIR}`:
- `skills/10x-pipeline/SKILL.md:25` sets `ROUTER="${CLAUDE_SKILL_DIR}/scripts/route.mjs"`, plus `PR_COMMENT` and `OPEN_PR` on nearby lines.
- `skills/openspec-pipeline/SKILL.md:28` sets the same variables through `${CLAUDE_SKILL_DIR}/../10x-pipeline/scripts/`.
- Both `Router:` lines say "When you put the path in a command, quote it for the shell".
- The loop lines still write the calls unquoted. Each file has 11 lines with `node $ROUTER`, 1 with `node $PR_COMMENT` and 1 with `node $OPEN_PR`. The Tuning section names `${CLAUDE_SKILL_DIR}/policy.json` as a path as well.

**The failure.** An orchestrator that copies a loop line literally and pastes the path in for `$ROUTER` gets word splitting when the path holds a space: `node /Users/jane doe/.claude/plugins/.../route.mjs` runs `node /Users/jane` and fails. The change `skill-dir-variable` named "a path with a space" as one of the failures it should end, and the head note alone does not end it, because a model follows the loop lines more literally than a note above them. The likelihood is low (plugin cache paths under `~/.claude/plugins/cache/` rarely hold a space, and the project path in `cd "<run root>"` is already quoted), but the fix is mechanical.

**The change.** Write the calls as `node "$ROUTER" ...`, `node "$PR_COMMENT" ...` and `node "$OPEN_PR" ...` in both skills, and quote the `policy.json` path wherever it is written inside a command. Keep `cd "<run root>" && ` in front of every call as it is.

**Tests that pin the unquoted form and must change with it.** All under `skills/10x-pipeline/test/`:
- `skill-loop.test.mjs`
- `openspec-skill.test.mjs`: it filters lines with `node $ROUTER`, matches `/node \$ROUTER[^`]*/g` to check `--chain openspec`, builds the call `node $ROUTER usage <change-name> <n> ...` and compares positions in the `done` branch, and checks `node $OPEN_PR`.
- `archive-gate.test.mjs`

Re-pin them to the quoted form and keep each assertion's meaning: `--chain openspec` on every OpenSpec router call, the `usage` call placement in the `done`, `halt` and `archive` branches, and the `## Anti-stall rules` section equal in both skills.

**Constraints.**
- Both skills change in the same commit and stay in step: the `## Anti-stall rules` section of the OpenSpec skill must remain equal to the one of the 10x skill (AGENTS.md Hard Rules; the skill tests pin it).
- `SKILL.md` must not name models, effort levels or tiers beyond what it already documents.
- Do this after the live check of `skill-dir-variable` rows 3.5 and 3.6 (the substituted path starts the router when the plugin is installed, not run with `--plugin-dir`). Those rows were not proved in the run. If the check shows the variable does not substitute as the skills assume, fix that first and quote afterwards.

**Done when.**
- No `node $ROUTER`, `node $PR_COMMENT` or `node $OPEN_PR` is left in either `SKILL.md`; every call reads `node "$VAR" ...`.
- The three test files pass in their re-pinned form, plus one new assertion that fails on an unquoted call.
- A manual check with the plugin installed under a path with a space starts the router from `/agent-smith:10x-pipeline` and from `/agent-smith:openspec-pipeline`. If that cannot be done, the plan lists it as an open Manual row.
- `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` passes.
