# Run report: compare-failed-attempts-neutral

Goal: Make compare count failed attempts using the router shared isFailure rule so advisory score failures and fallbacks stay neutral, choose and document treatment of cheap first-attempt failures using existing semantics, and cover JSON and Markdown output plus pinned baseline compatibility. Follow context/changes/compare-failed-attempts-neutral/change.md. Own compare behavior in route.mjs in Wave 4. Respect the Wave 4 ownership table in context/changes/WAVES.md, resolve historical paths against current layout, leave WAVES.md to the post-wave maintenance change, and avoid changes owned by sibling runs. Shared documentation and skill-content tests may be updated only for this change's behavior.
Rigor: standard (goal plain)
Outcome: halt - Step 1 (score) hit its limit of 2 neutral reruns after orchestrator faults (limits.maxNeutralRetries). Needs a human. Fix the harness, then either write a result file with the real status (the router verifies the step by its files), or raise limits.maxNeutralRetries in context/foundation/agent-smith-policy.json and write the orchestrator-error result file again, then run next.

| # | Step | Provider | Model | Effort | Tier | Simple | Result | Tokens |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | score | openai | gpt-6-luna | low | 0 | no | -, 2 neutral reruns | - |

Steps: 1 · Tokens: - (figures for 0 of 1 steps)

## Neutral reruns

Steps returned again unchanged (same prompt, model and effort) after the orchestrator declared a fault of its own; no failed attempt was counted. The notes are the orchestrator's.

- step 1 score: 2 reruns after an orchestrator fault
  - Codex permission preflight cannot verify required Git capability. Check the existing default configuration or selected optional profile, managed requirements, outer host permissions and native sandbox
  - Codex permission preflight cannot verify required Git capability. Check the existing default configuration or selected optional profile, managed requirements, outer host permissions and native sandbox
