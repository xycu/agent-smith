# Run report: step-prompt-by-file

Goal: Add opt-in policy-controlled step prompt handoff by file to reduce orchestrator context and transcription risk. Preserve exact task and RESULT contracts, inline archive prompts, neutral retries, cleanup before commits, provenance and existing default behavior. Use compare evidence to decide whether the default should change and record any unavailable evidence truthfully. Follow context/changes/step-prompt-by-file/change.md, current provider runner architecture and Wave 6 ownership. Leave WAVES.md and context/archive untouched.
Rigor: thorough (hot paths skills/10x-pipeline/policy.json, skills/10x-pipeline/scripts/flow.mjs, skills/10x-pipeline/scripts/isolation.mjs +4)
Outcome: done - impl review APPROVED

| # | Step | Provider | Model | Effort | Tier | Simple | Result | Tokens |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | score | openai | gpt-6-luna | low | 0 | no | failed, 3 neutral reruns | - |
| 2 | score | openai | gpt-6.1-sol | low | 1 | no | ok (5c495c0) | 311777 |
| 3 | plan | openai | gpt-6-astra | xhigh | 6 | no | ok (d50709b) | 2537896 |
| 4 | plan-review | openai | gpt-6.1-sol | high | 3 | no | ok (0f51d60) | 1773190 |
| 5 | implement | openai | gpt-6-astra | medium | 4 | no | ok (82b719d) | 41404165 |
| 6 | manual-verify | openai | gpt-6.1-sol | medium | 2 | no | ok (3e3f796) | 268259 |
| 7 | manual-verify | openai | gpt-6.1-sol | high | 3 | no | ok (566d231) | 346094 |
| 8 | impl-review | openai | gpt-6-astra | high | 5 | no | ok (849abeb) | 4151692 |

Steps: 8 · Tokens: 50793073 (figures for 7 of 8 steps)

## Neutral reruns

Steps returned again unchanged (same prompt, model and effort) after the orchestrator declared a fault of its own; no failed attempt was counted. The notes are the orchestrator's.

- step 1 score: 3 reruns after an orchestrator fault
  - Codex permission preflight cannot verify required Git capability. Check the existing default configuration or selected optional profile, managed requirements, outer host permissions and native sandbox
  - Codex permission preflight cannot verify required Git capability. Check the existing default configuration or selected optional profile, managed requirements, outer host permissions and native sandbox
  - Codex permission preflight cannot verify required Git capability. Check the existing default configuration or selected optional profile, managed requirements, outer host permissions and native sandbox

## Review findings

Counts as recorded when each review step ended; later edits of a review file are not reflected.

- step 4 plan-review: REVISE, 0 critical, 2 warnings measured; 0 critical, 0 warnings open
- step 8 impl-review: APPROVED, 0 critical, 0 warnings measured

## Manual checks

Rows as recorded when the last manual-verify step ended. The kind comes from the evidence file name; the router never reads the content. Only browser, test, command or script evidence proves a browser row.

Proved: 0

Not proved: 2

- 3.4 Live Claude and OpenAI sessions for both chains demonstrate a full file read, correct task/RESULT behavior, matched usage and inline archives; unavailable combinations remain pending with reasons. — not proved: Claude/10x, Claude/OpenSpec, OpenAI/10x and OpenAI/OpenSpec live file-read, task/RESULT, matched-usage and inline-archive observations remain unavailable after rechecking 65 local router logs and cand
- 3.5 At least five matched inline/file live change pairs are reviewed with compare, task quality and orchestrator telemetry before recommending any later default-on change. — not proved: Existing evidence records zero attempted and completed matched inline/file live pairs and unavailable orchestrator telemetry. The expanded local inventory supplies no five-pair comparison and quality

## Complexity score

Scores: cognitive 7, execution 8 (ambiguity 2, novelty 2, coupling 3, discovery 2, volume 3, verification 3)
Confidence: medium · Unknowns: 3
Source: score step 2

Tier shifts (cognitive moves plan, execution moves implement; one rung each):

- plan +1 (step 3)
- implement +1 (step 5)
