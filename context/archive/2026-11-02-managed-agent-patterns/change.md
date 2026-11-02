---
change_id: managed-agent-patterns
title: Run provenance, tool-restricted step agents and an opt-in advisor
status: archived
created: 2026-11-02
updated: 2026-11-02
archived_at: 2026-11-02T22:26:45Z
---

## Notes

Three patterns taken from the Managed Agents docs (agent-setup, multiagent-orchestration), adapted to a local plugin. One change, three phases; phases 2 and 3 sit behind policy flags that default to off, so each can be measured with `compare` on its own.

1. Run provenance (from agent versioning). `meta.json` records the plugin version, a hash of the merged policy and the prompt files, and the feature flags in force. `compare` warns when the two arms differ. Lands first: the other phases need it to be measured.
2. Tool-restricted step agents (from predefined agents). Plugin `agents/*.md` definitions with a narrow `tools` list for `score`, `research` and `frame`, used when `agents.restricted` is `true` (default `false`). No `model` in the frontmatter: the router keeps passing model and effort, and `SKILL.md` names no models.
3. Advisor (from the multiagent advisor). `plan` and `implement` run as before and consult a stronger tier once at a key moment (before finishing), when `advisor.enabled` is `true` (default `false`). Needs ADR-009 with a decision rule fixed before any run, like ADR-007. Open risk: spawn depth with `10x-goal-implement` (needs 3 already). If the nested call does not work, phase 3 drops and phases 1 and 2 still ship.

Out of scope: dynamic workflows (model-written fan-out conflicts with the deterministic router of ADR-006 and multiplies tokens) and a token budget (token figures are optional per step).

Sources: https://platform.claude.com/docs/en/managed-agents/agent-setup, https://platform.claude.com/docs/en/managed-agents/multiagent-orchestration
