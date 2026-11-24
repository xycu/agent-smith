# Development Test Scope Plan Brief

[Full implementation plan](plan.md)

## What & Why

Agent-smith steps have run the full test suite during development even where only a few files changed. Make focused testing an always-true instruction so a generic skill gate or plan row cannot trigger an unnecessary full run. CI remains the full-suite gate.

## Starting Point

PR #265 narrowed the test instructions in `AGENTS.md`, the implementation-review apply prompt, and the `fix` policy prompt. The router already loads a shared always-true rule file for both chains. [PR #265](https://github.com/xycu/agent-smith/pull/265) · [Rule levels](../../../skills/10x-pipeline/rules/README.md)

## Desired End State

During development and before handoff, each step runs only test files that cover its changes, including applicable guards. A single local full-suite run is allowed only at the user's request or to reproduce a CI failure.

## Key Decisions Made

| Decision | Choice | Why |
| --- | --- | --- |
| Rule location | One rule in `skills/10x-pipeline/rules/top.md` | The router appends this level to both chains and its precedence covers conflicts with skills and plan rows. |
| Local testing | Cover the changed files, including guards such as `agents-md-size.test.mjs` and `skill-loop.test.mjs` when applicable | The guards are part of focused coverage when their files are touched. |
| Full-suite testing | CI runs all shards. A single local run is allowed only at user request or to reproduce a CI failure. | This matches the existing repository test policy. |

## Scope

The implementation touches `top.md`, `rules.test.mjs`, the rules index and the `top.md` list in `docs/REFERENCE.md`. It builds on the existing router, OpenSpec chain rules, contributor guidance, and CI workflow. Pipeline `SKILL.md` edits are outside the scope.

## Architecture / Approach

Both chains use `ruleTail` to include the shared rule block. A regression in `rules.test.mjs` guards the new instruction, and the existing `rule-levels.test.mjs` cases verify the shared block reaches both chains. [Rule assembly](../../../skills/10x-pipeline/scripts/flow.mjs#L1067)

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Add and verify the shared development test rule | One shared rule, its index entry, and a regression | Omitting the one-run limit or applicable guards would change the test policy. |

**Prerequisites** PR #265, already present in the branch, and Node 24+.

**Estimated effort** One small implementation and verification pass.

## Open Risks & Assumptions

- The existing fixed-path loader supplies the rule to both chains. One phase is sufficient for the three coordinated edits. [Rule assembly](../../../skills/10x-pipeline/scripts/flow.mjs#L1067)
- Fresh prompts pick up the rule. Historical pending dispatches retain their stored prompts on neutral retry. [ADR-023 amendment](../../../docs/ADR/ADR-023-layered-rules.md#amendment-1--safety-and-planning-step-owners-2026-11-15)

## Success Criteria (Summary)

- **Automated** Pass the scoped `rules.test.mjs` and `rule-levels.test.mjs` files locally before publication.
- **Manual** Confirm the full-suite CI shards pass after the orchestrator publishes the pull request.

## References

- [Change notes](change.md)
- [Repository test instructions](../../../AGENTS.md#commands)
- [CI test job](../../../.github/workflows/ci.yml#L69)
