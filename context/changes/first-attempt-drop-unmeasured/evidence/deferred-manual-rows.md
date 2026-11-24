# Deferred Manual rows

Owner decision, 2026-11-24. Rows 2.1, 2.2 and 2.3 stay unticked. They are not moved to S-20: the measurement is still the plan.

- The change shipped in v1.16.2 with `drop: 0` (PR [#275](https://github.com/xycu/agent-smith/pull/275)). Policy and docs agree on that interim value.
- Still to do: qualify the live host and provider mode with verified step-tree figures (2.1), run five eligible A/B pairs and one A/A control and record them in ADR-010 or document exclusions (2.2), then apply the ADR-010 decision rule and reconcile policy and docs (2.3). The measurement spends real tokens, so it waits for the owner to start it. Until then the drop stays `0`.
