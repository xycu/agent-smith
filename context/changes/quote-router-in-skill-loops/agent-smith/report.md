# Run report: quote-router-in-skill-loops

Goal: Quote every router, PR-comment and open-PR script invocation in both pipeline skills so installed plugin paths containing spaces work. Preserve run-root prefixes, OpenSpec chain flags, usage ordering and identical anti-stall rules. Update pinned content tests and add regression coverage. Investigate the recorded skill-dir-variable live-check prerequisite and keep unavailable installed-plugin acceptance explicit. Follow this change.md against current layered architecture and reconcile overlap with the concurrent Wave 7 skill rewrite during planning. Leave WAVES.md and context/archive untouched.
Rigor: standard (goal hard)
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
