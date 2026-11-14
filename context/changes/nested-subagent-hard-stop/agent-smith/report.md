# Run report: nested-subagent-hard-stop

Goal: Enforce the pipeline nested-subagent ban through a supported harness configuration while retaining prompt rules. Verify current upstream harness capabilities, select the smallest supported hard-stop mechanism, configure this repository, document optional plugin-user setup and amend ADR-018. Prove enforcement or explicitly record unavailable live Claude acceptance. Follow context/changes/nested-subagent-hard-stop/change.md and Wave 6 ownership, keeping shared documentation edits in distinct regions from sibling changes. Leave WAVES.md and context/archive untouched.
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
