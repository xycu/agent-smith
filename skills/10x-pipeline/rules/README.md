# Rule levels

The rules agent-smith hands to a step subagent come in three levels and two categories (ADR-023). Level 1 applies to every step of both chains, level 2 to one chain (10xDevs or OpenSpec), level 3 to one step, such as `research`. Each level holds **always-true** rules, which no lower level and no project override changes, and **default** rules, which a lower level or the project override (`context/foundation/agent-smith-policy.json`) can replace.

| Level | Always-true (no override) | Defaults (overridable) |
| --- | --- | --- |
| 1 top | `skills/10x-pipeline/rules/top.md` (both chains; it lives with the shared router) | `prompts.suffix` in `skills/10x-pipeline/policy.json` |
| 2 chain 10x | `skills/10x-pipeline/rules/chain.md` (none shipped) | `prompts.chain-10x` (none shipped) |
| 2 chain OpenSpec | `skills/openspec-pipeline/rules/chain.md` | `prompts.chain-openspec` (none shipped) |
| 3 step | `<chain skill>/rules/steps/<step>.md`, keyed by step, so it covers every template of the step | the step's templates, `prompts.<template>` |

The router reads the always-true files by fixed path and never through the merged policy, so no policy key reaches them. A missing `rules/top.md`, or a rule file that exists but cannot be read, halts `init`, `next` and `usage` before anything is written. A step file is looked up only for a step name of lowercase letters, digits and hyphens.

Every prompt the router returns is, in this order: the worktree rules (isolated run), the rendered step template, the advisor rules (opt-in), the chain defaults, the generic defaults, then the always-true block: the step file, the chain file and `top.md`, each when it exists, `top.md` last so the `RESULT:` format ends the prompt. `top.md` states the precedence: an always-true rule wins over every other rule, between two always-true rules the higher level wins (top, then chain, then step), and among the other rules the one written earlier in the prompt wins.

The step file, the chain file and `prompts.chain-<chain>` are rendered with the step's placeholders at a run step and with `{id}` only at the archive step; `top.md` and `prompts.suffix` are not rendered. A change to any rule file shows in the `ruleFiles` provenance section.

## Files

| File | Level | Holds |
| --- | --- | --- |
| `skills/10x-pipeline/rules/top.md` | 1, always-true | unattended subagent, short status, the delete rules of ADR-016, the nesting rule of ADR-018, the two precedence rules, the `RESULT:` format |
| `skills/10x-pipeline/rules/steps/research.md` | 3, always-true | the `research.md` frontmatter status rule of the step `research` (templates `research`, `research-with-map`, `research-revise`) |
| `skills/openspec-pipeline/rules/chain.md` | 2, always-true | the change name passed as `--change "{id}"`, no `--store` |
