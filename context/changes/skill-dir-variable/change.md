---
change_id: skill-dir-variable
title: Use the documented skill directory variable for the script paths in both skills
status: planned
created: 2026-11-12
updated: 2026-11-12
archived_at: null
---

## Notes

Source: the repo review of 2026-11-12 (LLM engineering and Claude Code practice). Severity: low to medium.

### Problem

Both skills name their scripts with a prose placeholder: `ROUTER=<this skill's base directory>/scripts/route.mjs`, and the same for `PR_COMMENT`, `OPEN_PR` and the paths in `## Tuning` (`skills/10x-pipeline/SKILL.md:25-27`, `skills/openspec-pipeline/SKILL.md:28-30`). The orchestrator has to resolve it from the line "Base directory for this skill: ..." that Claude Code prints above a loaded skill today. That line is not documented, and a model that resolves the placeholder wrongly (a plugin cache path with a version folder, a path with a space) cannot start the router.

Claude Code documents a substitution for this (skills page, read 2026-11-12): "`${CLAUDE_SKILL_DIR}` | The directory containing the skill's `SKILL.md` file." and "Claude Code substitutes `${CLAUDE_SKILL_DIR}` and `${CLAUDE_PROJECT_DIR}` in two places: the skill's markdown content, and Bash rules in the `allowed-tools` frontmatter."

### Fix direction

- 10x skill: `ROUTER="${CLAUDE_SKILL_DIR}/scripts/route.mjs"`, and the same for `pr-comment.mjs`, `open-pr.mjs` and the `policy.json` path in Tuning.
- OpenSpec skill: `"${CLAUDE_SKILL_DIR}/../10x-pipeline/scripts/route.mjs"` and its siblings.
- Keep the instruction to quote the path for the shell.
- Find the Claude Code version that introduced the variable and state the minimum version in the README, next to the version the per-call `effort` parameter needs.
- Check with one live run of an installed plugin (not `--plugin-dir`) that the substituted path is the cache path and the router starts. Record it as a Manual row.
- Out of scope: narrowing `allowed-tools: Bash` to the scripts. The orchestrator also runs git commands, so it needs its own decision.

### Tests

- Content checks in `skill-loop.test.mjs` and `openspec-skill.test.mjs`: no `<this skill's base directory>` remains, and each script path starts with `${CLAUDE_SKILL_DIR}`.
- `agents.test.mjs` and `provenance.test.mjs` copy the plugin tree; confirm they do not depend on the placeholder text.

### Done when

Neither skill asks the orchestrator to work out where the plugin is installed.
