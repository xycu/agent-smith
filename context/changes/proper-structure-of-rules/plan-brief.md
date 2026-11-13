# Layered Rules and OpenSpec Definitions in the OpenSpec Folder — Plan Brief

> Full plan: `context/changes/proper-structure-of-rules/plan.md`
> Research: `context/changes/proper-structure-of-rules/research.md`

## What & Why

The rules agent-smith gives its step agents get three levels (top, chain, step) and two categories each: always-true rules, which nothing below and no project override can change, and default rules, which a lower level or the override can replace. The OpenSpec definitions also leave `skills/10x-pipeline/` for `skills/openspec-pipeline/`, so each chain's folder holds its own definitions.

## Starting Point

Today one flat `policy.json` serves both chains, and the project override can replace any key, `prompts.suffix` included. So an override can drop the ADR-016 delete ban, the ADR-018 nesting ban and the `RESULT:` contract. Precedence is hand-written in three prompts. The research frontmatter rule repeats in three templates, and the OpenSpec `--change`/`--store` rules repeat in three prompt files. The OpenSpec prompts, steps, module and tests sit in the 10x folder.

## Desired End State

Every step prompt ends with the defaults (chain, then generic suffix) and an always-true block (step file, chain file, `rules/top.md`, the last one closing with the `RESULT:` format). No override reaches that block, and a missing `top.md` halts the router. `skills/openspec-pipeline/` holds its own `policy.json`, prompts, rules, module and tests, and the 10x folder holds no `os-` definition. ADR-023 records the hierarchy, and ADR-013 Amendment 1 records the folder split.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Binding of always-true | Plugin files under `<skill>/rules/`, read by fixed path outside the policy merge; missing `top.md` halts | Only a place the merge cannot reach is safe from overrides | Research + Plan |
| Precedence | Always-true wins over all, and the higher level wins between two always-true rules; among defaults the earlier rule wins, and the prompt lists step, then chain, then generic | One general rule replaces three hand-written precedence lines | Plan |
| Layout | L1 `10x-pipeline/rules/top.md` + `prompts.suffix`; L2 `<chain>/rules/chain.md` + `prompts.chain-<chain>`; L3 `<chain>/rules/steps/<step>.md` + step templates | Reuses the existing keys, so current overrides keep working | Plan |
| Step-level key | By step name, not template | `research`, `research-with-map` and `research-revise` all run as step `research` | Research |
| Reference form | Keep `@prompts/<f>.md`; add `@<skill>/prompts/<f>.md`, skill `[a-z0-9-]+` | Backward compatible, no path escape | Plan |
| OpenSpec policy | `skills/openspec-pipeline/policy.json` fragment with disjoint keys, merged at load before the one override | Keeps "one merged policy, one override file" from ADR-013 | Research + Plan |
| Router location | Stays in `skills/10x-pipeline/scripts/`; only `openspec.mjs` moves | ADR-013 forbids a router copy; module import order holds | Research |
| ADRs | New ADR-023; ADR-013 Amendment 1; one-line notes in ADR-016 and ADR-018 | Follows the amendment style of ADR-008/010/015 | Plan |
| Orchestrator rules | Mapped to levels in ADR-023, not moved | `skill-md-context-diet` (wave 7) owns the SKILL.md rewrite | Plan |
| Order | Alone, after wave 3 and before wave 4; `step-subagent-git-guard` after it, using `rules/top.md` | Colliding changes are still `new` without plans, so retargeting is cheap | Research + Plan |

## Scope

**In scope:**
- Move the OpenSpec prompts, steps, prompt templates, module and tests, plus `openspec-helpers.mjs`
- Add the second reference form and `pluginPolicy()`
- Extend the CI test glob
- Rule files, the `ruleTail` builder at both assembly sites, the chain-defaults keys, and `ruleFiles` provenance
- Split the suffix; move the research and OpenSpec rules to single homes; remove the hand-written precedence lines
- `rule-levels.test.mjs`
- ADR-023, ADR-013 Amendment 1 and the doc sweep

**Out of scope:**
- New rule content (beyond the precedence rule and headings)
- Moving SKILL.md sections
- Moving the router
- Moving the root `openspec/` folder
- The git, push and `gh` bans (`step-subagent-git-guard`)
- Filling the empty cells
- `WAVES.md` and other changes' folders (owner, on `main`)
- `context/archive/`

## Architecture / Approach

Prompt = worktree rules + step template (L3 defaults) + advisor + `prompts.chain-<chain>` (L2 defaults) + `prompts.suffix` (L1 defaults) + `rules/steps/<step>.md` + `rules/chain.md` + `rules/top.md` (always-true, top last). One `ruleTail` function in `flow.mjs` builds everything after the advisor for `route.mjs` and for the archive action in `isolation.mjs`. The plugin policy is `deepMerge(10x policy.json, openspec policy.json)`, and the project override merges over it.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Move OpenSpec definitions | `skills/openspec-pipeline/` owns its policy fragment, prompts, module and tests; byte-identical prompts | Tests and docs that read old paths; the CI glob missing the moved tests |
| 2. Rule levels in the router | Always-true block outside the merge, defaults split, rules deduplicated, new test | Many tests pin the suffix text; drift in in-flight runs |
| 3. Decisions and doc sweep | ADR-023, ADR-013 Amendment 1, REFERENCE and README text | Docs that still describe the old suffix or paths |

**Prerequisites:** wave 3 merged (done in 1.8.0); no wave-4 change started.
**Estimated effort:** ~3 sessions, one per phase.

## Open Risks & Assumptions

- The always-true versus default split of the former suffix lines is a judgment call; the owner checks it (Manual 2.7).
- An override that names `@prompts/os-*.md` halts after the upgrade; `docs/REFERENCE.md` gives the fix.
- An override that copies the old full suffix repeats the `RESULT:` block; this is harmless.
- The open changes need their paths retargeted after the merge, which the owner does on `main` (Manual 3.7).

## Success Criteria (Summary)

- No project override can remove the delete, nesting or `RESULT:` rules from any step prompt of either chain.
- Every rule has one home at its level, and the 10x folder holds no OpenSpec definition.
- The full suite over both test folders passes, and both chains run from the installed plugin.
