---
change_id: delegated-token-accounting
title: Report token usage for delegated pipeline steps
status: planned
created: 2026-11-18
updated: 2026-11-18
archived_at: null
---

## Notes

Agent Smith leaves token counts blank for delegated Codex steps because the runner receives the parent session's usage and cannot verify child coverage from that stream. This safeguard was intentional when delegation shipped. The runner already identifies and settles descendants but does not collect their usage. [ADR-018](../../../docs/ADR/ADR-018-no-nested-subagents.md#amendment-3--bounded-native-children)

In the first unattended delivery, three delegated steps had blank counts even though Codex retained all five child session records. Summing one final snapshot per matched parent and child recovered 4,188,412 child tokens and 29,027,825 tokens across all six numbered steps, including cached input. The original report showed a subtotal of 10,144,528 tokens for three steps. [Reconstructed PR report](https://github.com/xycu/agent-smith/pull/214#issuecomment-6935363565)

Both pipeline entry points should report one verified total per completed delegated step using the telemetry available on each host.

- **Codex:** Verify the supported session usage source. Match each parent and descendant to the exact settled invocation and count each session once in the shared runner.
- **Claude Code:** Verify what the Agent tool's `subagent_tokens` includes when a step delegates. Check immediate and late notifications and the archive path. Use a verified inclusive figure once, or combine separately attributable figures only when their coverage is complete and disjoint. The earlier headless probe proved child result delivery but left token inclusion open. [Claude probe](../../archive/2026-11-16-nested-step-delegation/evidence/capabilities.md#claude-headless)

For both hosts, omit the total and explain the coverage gap when any required counter is missing, invalid, or ambiguous. Keep result handling and execution settlement independent of token collection. Verify complete, partial, and duplicate telemetry without rewriting archived ledgers.
