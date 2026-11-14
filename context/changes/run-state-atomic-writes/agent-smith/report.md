# Run report: run-state-atomic-writes

Goal: Make router run.jsonl, meta.json and report.md writes atomic, safely clean only owned stale temporary state under the run lock, halt writing commands on malformed log lines without losing data, and expose logProblems in read-only commands. Follow context/changes/run-state-atomic-writes/change.md. Preserve rollback, late-usage byte identity and both chains. Own state write/readLog paths and their call sites in Wave 4. Respect the Wave 4 ownership table in context/changes/WAVES.md, resolve historical paths against current layout, leave WAVES.md to the post-wave maintenance change, and avoid changes owned by sibling runs. Shared documentation and skill-content tests may be updated only for this change's behavior.
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
