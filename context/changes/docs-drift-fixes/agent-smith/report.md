# Run report: docs-drift-fixes

Goal: Reconcile all seven documented drift items against current code and already-merged changes: isolated report location, PR-comment references, duplicate run-lock prose, OpenSpec live-run history, ADR amendments and stale section pointers, prompt placeholders and unknown rendering, manifest descriptions with an equality check and test. Preserve ADR history and release-owned versions. Follow context/changes/docs-drift-fixes/change.md and Wave 6 ownership, keeping shared documentation edits in distinct regions from sibling id-limit and nesting changes. Leave WAVES.md and context/archive untouched.
Rigor: standard (goal plain)
Outcome: halt - Step 1 (score) hit its limit of 3 neutral reruns after orchestrator faults (limits.maxNeutralRetries). Needs a human. Fix the harness, then either write a result file with the real status (the router verifies the step by its files), or raise limits.maxNeutralRetries in context/foundation/agent-smith-policy.json and write the orchestrator-error result file again, then run next.

| # | Step | Provider | Model | Effort | Tier | Simple | Result | Tokens |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | score | openai | gpt-6-luna | low | 0 | no | -, 3 neutral reruns | - |

Steps: 1 · Tokens: - (figures for 0 of 1 steps)

## Neutral reruns

Steps returned again unchanged (same prompt, model and effort) after the orchestrator declared a fault of its own; no failed attempt was counted. The notes are the orchestrator's.

- step 1 score: 3 reruns after an orchestrator fault
  - Codex permission preflight cannot verify required Git capability. Check the existing default configuration or selected optional profile, managed requirements, outer host permissions and native sandbox
  - Codex permission preflight cannot verify required Git capability. Check the existing default configuration or selected optional profile, managed requirements, outer host permissions and native sandbox
  - Codex permission preflight cannot verify required Git capability. Check the existing default configuration or selected optional profile, managed requirements, outer host permissions and native sandbox
