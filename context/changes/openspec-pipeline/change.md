---
change_id: openspec-pipeline
title: OpenSpec chain as a second pipeline skill on the shared router
status: implementing
created: 2026-11-09
updated: 2026-11-09
archived_at: null
---

## Notes

Owner request (2026-11-09): "Can we add OpenSpec support?" and "we are trying to keep general OpenSpec way of work". Scope source: FR-006 in context/foundation/prd.md ("The user can run an OpenSpec chain through a second pipeline skill", nice-to-have, parked 2026-10-31, built after dynamic routing works; shape-notes.md: "second pipeline skill sharing the same router and policy"). Constraint: agent-smith never edits OpenSpec or the 10x skills. Agreed order: research, then ADR-013 (chain design), then implement on a branch and open a PR.

## Scope

Implement ADR-013 (`docs/ADR/ADR-013-openspec-pipeline.md`, decisions D1 to D12 accepted by the owner on 2026-11-09): a `--chain openspec` switch in the router, the new skill `skills/openspec-pipeline/`, the steps `os-propose`, `os-apply`, `os-verify` and `os-archive`, file-based reading of OpenSpec state, run state under `openspec/changes/<name>/agent-smith/`, the `verify.md` verdict and the CLI archive. The 10x chain, `helpers.mjs` and `loops-existing.test.mjs` stay as they are.

## To be researched

The four preconditions of ADR-013. Each one is checked first, with evidence saved under `evidence/`, and the result is written into ADR-013 (status moves to Accepted when all four pass). A check that fails changes the design before any code is written.

1. **Skill reach.** Can a subagent started in `.claude/worktrees/agent-smith-<name>` call the OpenSpec skills (`openspec-propose`, `openspec-apply-change`, `openspec-verify-change`) when `.claude/skills/openspec-*` is untracked in the main checkout? If not: commit the skills, or carry the instructions in the step prompts.
2. **Router path.** Can `skills/openspec-pipeline/SKILL.md` reach `../10x-pipeline/scripts/route.mjs` from an installed plugin (for example through the plugin root path)? If not: move the router to a shared folder in a separate change.
3. **Unattended skills.** Do propose, apply and `openspec archive <name> --yes --json` run in a subagent with a decision guide, and stop with `blocked` and `signals.needsHuman` where the guide says? One small live change settles it.
4. **Plugin discovery.** Does Claude Code find a second skill under `skills/` without a list in `.claude-plugin/plugin.json`?
