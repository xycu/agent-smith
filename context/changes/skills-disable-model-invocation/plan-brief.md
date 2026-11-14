# Explicit Pipeline Invocation — Plan Brief

[Full implementation plan](plan.md)

## What & Why

The owner selected explicit slash commands for starting both pipelines. Each run can create an isolated worktree, launch paid subagents, commit, push a branch and open a pull request. Native Claude Code invocation control gives the user control over when those workflows start.

## Starting Point

Both skills currently omit `disable-model-invocation` and advertise plain-language triggers. The plugin manifests describe the same product with different wording. Both skill-content test files already support alternate skill files for deliberate-break checks.

The existing two-file baseline passes all 49 tests on Node v24.19.0. Installed Claude Code reports 2.1.311. Live invocation acceptance remains pending.

## Desired End State

Both skills carry the unquoted YAML boolean `disable-model-invocation: true` and descriptions naming their explicit commands. Manifest descriptions match each other, and the README explains the supported invocation behavior with authoritative links.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Product behavior | Explicit user slash commands | The owner selected this entry point for both pipelines. | Run goal |
| Enforcement layer | Native skill frontmatter | Claude Code owns skill discovery and invocation. | Anthropic skills docs |
| Plan structure | One cohesive phase | Configuration, descriptions and existing tests form a small complete change. | Plan |
| Description alignment | Equal plugin descriptions and semantically aligned README/skill descriptions | Each skill retains its chain-specific identity. | Repository rules and plan |
| Compatibility | Document direct, headless, scheduled and Skill-tool behavior | Official docs resolve these paths, while live acceptance requires recorded observations. | Anthropic docs |
| Acceptance | One pending Manual row covering both chains | The change brief requires slash-command and plain-language verification. | Change brief |

## Scope

- Both skill frontmatter descriptions and the new boolean field.
- Plugin and marketplace plugin-entry descriptions.
- README introduction and invocation guidance near Quick start.
- Frontmatter and aligned-description assertions in the two existing skill-content tests.
- Preservation boundary covering all skill bodies, sibling-owned regions, release fields, `WAVES.md` and `context/archive/`.

## Architecture / Approach

Claude Code evaluates invocation metadata before loading the orchestrator. Use its built-in boolean and the existing content-test seams. The README presents both namespaced slash commands, current headless expansion support, scheduled-fire plain-text behavior and the Skill-tool invocation restriction with source links.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Enforce Explicit Invocation and Align Public Guidance | Two flags, concise descriptions, aligned manifests/README and regression assertions | Host behavior needs live acceptance, and shared files require region-level edits. |

Wave 5 ownership and the explicit owner choice supply the prerequisites. Node 24+ supports the verification commands. Estimated effort is one small implementation session followed by live acceptance.

## Open Risks & Assumptions

- The unattended task settles interview and phase-approval choices using the goal, code and authoritative documentation.
- Anthropic’s documentation retrieved on 2026-11-14 establishes invocation behavior. The minimum supported Claude Code 2.1.292 still needs live verification, and evidence should name the tested version.
- Direct print-mode skill expansion has documentation support. Full headless pipeline completion retains its existing execution prerequisites and live-acceptance caveat.
- Invocation-control claims apply to Claude Code. README already documents Codex skill-picker selection, and cross-host enforcement needs host-specific evidence.

## Success Criteria (Summary)

- Both skills require explicit user invocation in Claude Code and remain available through their slash commands.
- Frontmatter, description alignment, deliberate-break checks, version checking and the full suite pass within the ownership boundary.
- One Manual row records both slash commands starting and plain-language requests leaving the pipeline skills uninvoked.

## References

- [Change brief](change.md) and the repository Wave 5 ownership table in `context/changes/WAVES.md`.
- [Anthropic skills invocation control](https://code.claude.com/docs/en/skills#control-who-invokes-a-skill)
- [Anthropic headless command support](https://code.claude.com/docs/en/headless)
- [Anthropic scheduled skill behavior](https://code.claude.com/docs/en/scheduled-tasks#run-a-prompt-repeatedly-with-loop)
