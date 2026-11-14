# ADR-023: Rules in three levels and two categories, with always-true rule files outside the policy

- **Status:** Accepted (implemented by an unattended run of change `proper-structure-of-rules`)
- **Date:** 2026-11-13
- **Deciders:** the repository owner (change `proper-structure-of-rules`, `change.md`); unattended research, plan and implementation runs for the readings below
- **Origin:** change `proper-structure-of-rules` (`context/changes/proper-structure-of-rules/research.md` and `plan.md`). It moves the carriers of the subagent rules of ADR-016 and ADR-018 (both carry an amendment line) and builds on ADR-013 Amendment 1 for the folder split. No decision is superseded.

## Context

- One flat `policy.json` served both chains, and the project override is deep-merged over it. Every key could be replaced, `prompts.suffix` included, so an override that replaced the suffix also dropped the rules that must hold in every step: no `AskUserQuestion`, the delete rules of ADR-016, the nesting rule of ADR-018 and the `RESULT:` line the router parses.
- Precedence between rules was hand-written in three places (`prompts/score.md`, `os-archive.md` and the `archive` template).
- One rule could be written several times: the `research.md` frontmatter rule in the three templates of the step `research`, and the `--change "{id}"` and `--store` rules in three OpenSpec guides.

## Decision

### Levels and categories (D1)

A rule applies at one of three levels: level 1 (top) to every step of both chains, level 2 (chain) to the 10xDevs chain or the OpenSpec chain, level 3 (step) to one step. Each level holds **always-true** rules, which no lower level and no project override changes, and **default** rules, which a lower level or the project override replaces. The RFC 2119 keyword of a rule (ADR-004) is independent of its category: a default may say **MUST**.

| Level | Always-true (no override) | Defaults (overridable) |
| --- | --- | --- |
| 1 top | `skills/10x-pipeline/rules/top.md` (both chains; it lives with the shared router) | `prompts.suffix` in `skills/10x-pipeline/policy.json` |
| 2 chain 10x | `skills/10x-pipeline/rules/chain.md` (none shipped) | `prompts.chain-10x` (none shipped) |
| 2 chain OpenSpec | `skills/openspec-pipeline/rules/chain.md` | `prompts.chain-openspec` (none shipped) |
| 3 step | `<chain skill>/rules/steps/<step>.md` (`skills/10x-pipeline/rules/steps/research.md` shipped) | the step's templates, `prompts.<template>` |

`skills/10x-pipeline/rules/README.md` states the table and lists every rule file of both skills.

### Binding (D2)

**GIVEN** an always-true rule **WHEN** it is shipped **THEN** it **MUST** live in a file under `<skill>/rules/`, outside `policy.json`.

**GIVEN** an always-true rule file **WHEN** the router assembles a prompt **THEN** it **MUST** read that file by fixed path and never through the merged policy.

**GIVEN** the command is `init`, `next` or `usage` **WHEN** `rules/top.md` is missing or a rule file exists but cannot be read **THEN** the router **MUST** halt before anything is written and name the file from the plugin root.

`checkPrompts` reads the same files before `next` consumes `last-result.json`, so a broken install halts there and not in the middle of prompt assembly.

### Prompt order and precedence (D3)

**GIVEN** the router returns a step prompt or an archive prompt **WHEN** it assembles it **THEN** the parts **MUST** come in this order, each separated by one blank line and each skipped when empty: the worktree rules (isolated run), the rendered step template, the advisor rules (opt-in), the chain defaults, the generic defaults, the step file, the chain file, `rules/top.md`.

`top.md` is last, so its `RESULT:` format ends every prompt. `top.md` holds the two precedence rules: an always-true rule wins over every other rule, and between two always-true rules the rule for every step wins over the rule of the chain, which wins over the rule of the step; among the other rules the one written earlier in the prompt wins, because the prompt lists the step rules first, then the chain rules, then the generic defaults.

**GIVEN** a prompt of the router **WHEN** two of its rules may disagree **THEN** the prompt **MUST NOT** carry a hand-written precedence line that repeats the general rule of `top.md`.

### Rendering (D4)

The step file, the chain file and `prompts.chain-<chain>` are rendered with the template's placeholders at a run step and with `{id}` only at the archive step; `prompts.chain-10x` and `prompts.chain-openspec` are in `NARROW_PLACEHOLDERS` with `id`. `top.md` and `prompts.suffix` are not rendered. A test holds the shipped files to these limits.

### Step files keyed by step (D5)

**GIVEN** a step rule file **WHEN** the router looks it up **THEN** it **MUST** key it by the step name, not by the template, so one file covers every template of the step.

**GIVEN** a step name outside `^[a-z0-9][a-z0-9-]*$` **WHEN** the router looks up its step rule file **THEN** it **MUST NOT** read any file.

### Reference forms (D6)

`@prompts/<file>.md` names a file under `skills/10x-pipeline/prompts/`. `@<skill>/prompts/<file>.md` names a file under `skills/<skill>/prompts/`, with `<skill>` matching `[a-z0-9][a-z0-9-]*`. Any other part is literal text (ADR-013 Amendment 1).

### Provenance (D7)

**GIVEN** `init` writes the provenance record **WHEN** it hashes the plugin files **THEN** it **MUST** add a `ruleFiles` section: one hash over every `.md` file except `README.md` under `skills/10x-pipeline/rules/` and `skills/openspec-pipeline/rules/`, or `null` when a file cannot be read.

### The orchestrator and the contributor rules (D8)

The orchestrator rules of both `SKILL.md` files map onto the levels without moving: `## Anti-stall rules` is level 1 always-true (equal in both files, pinned by `openspec-skill.test.mjs`), each `## Rules` section is level 2 always-true, and `## Tuning` points at the defaults. `AGENTS.md` holds contributor rules for this repository and stays outside the runtime hierarchy.

## Alternatives

- A key per rule with an `alwaysTrue` flag inside `policy.json`: the deep merge reaches every key, so the flag would need a merge exception for each one.
- A validator that rejects an override of the invariant lines: it reads text a project may reword, and it still lets the override remove the rules.
- One file per template instead of per step: the three `research` templates would repeat the same rule again.

## Consequences

- Empty cells exist on purpose: level-2 10x always-true, the level-2 defaults of both chains and level-3 OpenSpec always-true have carriers and tests, and a later change fills them.
- A project override of `prompts.suffix` replaces only the defaults; it can no longer drop the rules of ADR-016 and ADR-018 or the `RESULT:` format.
- A suffix override that copies the old full suffix text carries the `RESULT:` block twice. That is harmless; `docs/REFERENCE.md` says so.
- A run recorded before this change records `prompts` and `ruleFiles` drift at its next call.
- Each prompt grows by the heading lines and the two precedence rules, and the router reads up to three more small files per step.

## Sources

- `context/changes/proper-structure-of-rules/research.md` (Architecture Insights: "a place the merge cannot reach") and `plan.md` (Decisions settled 1 to 3).
- `docs/ADR/ADR-004-prompt-rules-as-scenarios.md`, `ADR-013-openspec-pipeline.md`, `ADR-016-no-recursive-force-delete.md`, `ADR-018-no-nested-subagents.md`, `ADR-022-policy-validation-at-load.md`.
- `skills/10x-pipeline/scripts/flow.mjs` (`ruleTail`, `checkRules`), `route.mjs` and `isolation.mjs` (the two assembly sites), `skills/10x-pipeline/test/rule-levels.test.mjs`.
