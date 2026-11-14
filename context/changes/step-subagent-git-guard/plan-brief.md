# Step subagent Git and deletion safety plan brief

Full plan at [plan.md](plan.md).

## What & Why

Three routed steps used prohibited cleanup or Git commands, or published a PR to satisfy an Automated criterion. Add safety rules to every routed task, keep acceptance achievable before publication, and block common direct unsafe Bash commands in supported Claude step agents.

## Starting Point

ADR-023 already supplies override-resistant top, chain and step rule files. Deletion rules are shared, while Git/publication rules and planning acceptance rules are missing. Both orchestrator skills already forward a router-selected agent for ordinary and archive calls.

## Desired End State

Both chains and their archive tasks carry the repository safety rules. Planning and review keep PR-dependent acceptance in Manual checks. A dedicated Claude agent lets a plugin hook recognize routed steps while permitting orchestrator publication scripts at their existing terminal points.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Shared safety | Extend `rules/top.md` | Project overrides cannot remove these invariants | ADR-023 |
| Planning acceptance | Add `plan`, `plan-review` and `os-propose` step rule files | One carrier reaches each step's variants | Ticket and existing rule lookup |
| Native guard | Plugin PreToolUse hook plus default `agent-smith:step` identity | Supported identity separates routed agents from orchestrator/unrelated calls | Current Claude documentation and local 2.1.311 CLI |
| Compatibility | Preserve custom restricted mappings, OpenAI checks and exact historical retries | Existing public dispatch/replay contracts remain usable | ADR-009, ADR-015, ADR-024 |
| Guard coverage | Bounded direct Bash-command subset | Small implementation covers observed breach forms | Ticket and explicit plan matrix |
| Publication | Existing orchestrator scripts retain push, PR and comment ownership | PR state exists after the run | ADR-017 |
| Concurrent edits | Reuse existing agent forwarding | Both SKILL.md files stay with Wave 7 owners | Current skills and active change definitions |

## Scope

Included work covers shared/step rules, the routed Claude identity, plugin hook, provenance, regression coverage, indexes, reference docs and existing ADR amendments. Implementation acceptance uses local tests and fake publication clients.

Excluded work covers remote-ref polling, a general shell parser, OpenAI permission redesign, dependencies, release fields, model/tier changes, WAVES.md and archived files.

## Architecture / Approach

The router's existing rule tail carries semantic safety instructions. Provider-aware dispatch selects the dedicated inherited-tool Claude agent through the existing optional `agent` field. A plugin-level Bash hook identifies that agent and denies recognized direct unsafe forms. Rule, agent and hook bytes receive independent provenance hashes. The orchestrator keeps running the existing terminal publication scripts.

## Phases at a Glance

| Phase | Deliverable | Primary risk |
| --- | --- | --- |
| 1. Shared safety and planning rules | Always-true safety and pre-publication acceptance carriers, with regressions | Missing a template, override or archive path |
| 2. Scoped Claude guard and dispatch compatibility | Dedicated agent, native hook, provenance and provider/retry tests | Overblocking safe commands or overstating runtime coverage |
| 3. Documentation and integration acceptance | Reference/index/ADR amendments and concurrent-change verification | Drift against the Wave 7 skill rewrite |

Prerequisites are Node 24+, a loaded plugin and existing test helpers. The overall Claude Code baseline stays 2.1.292+, while fail-closed hook handling requires 2.1.295+ and a supported identity schema. Older hosts retain prompt rules and existing permission controls, with runtime guard enforcement unverified. The plan needs no external service for Automated criteria.

Estimated effort is three implementation phases and a separate live acceptance pass. Complexity is HIGH because dispatch, safety and compatibility intersect.

## Open Risks & Assumptions

- Unattended evidence-backed choices replace the skill's interview and phase approvals. The full plan records assumptions A1–A7.
- Stage-only restore can discard a unique index version. The stateless hook denies it because it cannot establish preservation. Phase 2 explains this correction to the retained wording of Progress row 2.2.
- The hook covers a documented direct-command subset. Script internals, dynamic shell construction, alternative executables, filesystem/MCP actions, OpenAI children and custom agent types retain semantic rules and host controls.
- Historical pending dispatches retain their exact stored prompt and agent, so an upgrade gains full new coverage at the next newly assembled action.
- Disabled hooks and unsupported identity schemas provide no runtime guarantee. A hook startup failure can block matching orchestrator calls under fail-closed handling.
- Both skills remain owned by concurrent changes. This change relies on their existing forwarding interface and verifies it during integration.
- Live identity, blocking and planning adherence remain Manual checks. Actual PR CI acceptance occurs after orchestrator publication.

## Success Criteria Summary

- Every new routed task carries the Git/deletion/publication rules, including archive and file-handoff tasks.
- Planning/review keep publication-dependent acceptance out of Automated criteria, while allowing local fake-client tests.
- Guard, provider, retry, provenance and complete repository suites pass, and documented runtime limits agree with live evidence available at acceptance.

## References

The full plan links source anchors, the ticket, concurrent change definitions and authoritative hook documentation. Planning's focused baseline passed 86 tests with zero failures and zero skips. Full implementation and live-host proof are tracked in the plan's unchecked Progress rows.
