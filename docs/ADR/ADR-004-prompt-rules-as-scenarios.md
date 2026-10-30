# ADR-004: Prompt rules as GIVEN/WHEN/THEN scenarios with one RFC 2119 keyword

- **Status:** Proposed
- **Date:** 2026-10-30
- **Deciders:** repository owner
- **Origin:** life-to-lore `ADR-012-prompt-rules-as-scenarios.md` (accepted 2026-10-21) and `CLAUDE.md:28` of that repository, adopted here by the `rigor-levels` change. Research: `context/changes/rigor-levels/research.md` (Follow-up 2, decision 1).

## Context

- The prompts the router sends to subagents (`policy.json` `prompts`, `skills/10x-pipeline/prompts/*.md`) hold behavior rules. Written as free prose, a test cannot tell a hard limit from a style hint.
- The unattended-subagent suffix gains rules in the `rigor-levels` change: decide from evidence where a skill would ask, report `blocked` with `signals.needsHuman` when no evidence-backed answer exists, and raise rigor with `signals.rigor`. These rules need a fixed form so a later change can add more without drift.
- The `prompts/*.md` files already use the form (85 rule lines at the time of writing). Nothing checks it.
- Persona text or plain instructions are not rules. They stay prose.

## Decision

Every behavior rule in a prompt is one line in this form, written with bold markers:

```
**GIVEN** <context> **WHEN** <trigger> **THEN** <required behavior>
```

The line holds exactly one bold RFC 2119 keyword, after `**THEN**`: `**MUST**`, `**MUST NOT**`, `**SHOULD**`, `**SHOULD NOT**` or `**MAY**`. Rules:

- `MUST` and `MUST NOT` are for hard limits. A style rule is `SHOULD`.
- `SHALL`, `REQUIRED`, `RECOMMENDED` and `OPTIONAL` are never used as upper-case words.
- A keyword that is not bold is an error. A bold keyword on a line that is not a rule is an error.
- Lines that are not rules are prose and carry no keyword.

A `node:test` check enforces this: `skills/10x-pipeline/test/rules.test.mjs`. Run it with `node --test skills/10x-pipeline/test/*.test.mjs`. It checks:

- every string in `policy.json` `prompts`, line by line;
- every `skills/10x-pipeline/prompts/*.md` except `README.md`;
- the rule lines of `ADR-003` and `ADR-004`, outside fenced code blocks (ADR prose may discuss the keywords, and this ADR shows bad rules in a fence).

Examples of bad rules, which the test rejects (they sit in a fence, so the ADR check skips them):

```
**GIVEN** a change **THEN** you **MUST** plan.
**GIVEN** a change **WHEN** it is large **THEN** you **MUST** plan and **SHOULD** review.
**GIVEN** a change **WHEN** it is large **THEN** you plan.
**GIVEN** a change **WHEN** it is large **THEN** you MUST plan.
**WHEN** it is large **GIVEN** a change **THEN** you **MUST** plan.
**GIVEN** a change **WHEN** it is large **THEN** you SHALL plan.
```

### What differs from the source ADR

- No rule ids. life-to-lore keeps ids in a TypeScript `rule()` helper so evals can cite them. agent-smith has no such helper and no evals.
- No `PROMPT_VERSION`. The router does not log a prompt version.
- The checked files are the `policy.json` prompts and `skills/10x-pipeline/prompts/*.md`, plus the rule lines of two ADRs.
- No `MUST` budget per prompt and no prose line count. Only the form is checked.

## Alternatives considered

| Alternative | Verdict | Reason |
| --- | --- | --- |
| Keep rules as prose | rejected | A prose rule has no parseable keyword, so no test can check it. |
| Copy the whole life-to-lore mechanism (ids, `rule()`, version, budget) | not adopted | agent-smith has no eval corpus or prompt module to hang it on. The form check gives the value at a fraction of the cost. |
| Rely on review to keep the form | rejected | The `prompts/*.md` files hold 85 rules by hand today. A check is cheaper than a regression. |

## Consequences

- **Good**: a rule with a missing `WHEN`, two keywords, an unbolded `MUST` or `SHALL` fails `node --test`.
- **Good**: `MUST` stays scarce, because a style rule is `SHOULD`.
- **Bad**: the check tests the form, not the wording. A vague rule in the right form passes.
- **Bad**: the repo now has a test file, so AGENTS.md no longer says "no test setup".
- **Open**: whether a model weighs the keywords above other wording is not established here. life-to-lore lists the same gap.

## Sources

- life-to-lore `docs/adr/ADR-012-prompt-rules-as-scenarios.md` (sibling checkout `../life-to-lore`) and `CLAUDE.md:28`
- `skills/10x-pipeline/prompts/README.md` (the rule form already in use)
- `context/changes/rigor-levels/research.md`, Follow-up 2, decision 1
