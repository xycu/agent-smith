# Run report: step-subagent-git-guard

Goal: Enforce repository Git and deletion safety rules in every routed step and keep push, PR creation and comments owned by orchestrator scripts. Prevent planning and plan-review from requiring pushed branches, open PRs or PR CI in Automated rows. Evaluate a supported step-specific harness guard and select an evidence-backed solution with explicit limits. Reuse layered rule ownership, add regression coverage, update rule indexes, reference docs and relevant ADR amendments. Follow this change.md and reconcile overlap with concurrent Wave 7 skill edits during planning. Leave WAVES.md and context/archive untouched.
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
