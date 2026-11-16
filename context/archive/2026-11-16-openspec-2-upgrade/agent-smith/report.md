# Run report: openspec-2-upgrade

Goal: Deliver Wave 2 / roadmap S-13 (openspec-2-upgrade) from the accepted Wave 1 baseline. Make the specification-based workflow and its integration/setup instructions work with exactly OpenSpec 2.0.0. Investigate upstream changes before editing, align the CI CLI pin and contract fixtures, and adapt policy, prompts or runtime code only where compatibility evidence requires it. Preserve existing project inputs, saved/in-flight run semantics, result/usage ownership, validation, optional archive and publication behavior. Revalidate Wave 0's OpenSpec child-delegation contract after the upgrade. Record exact tool versions, executable verification and any pending live-host proof truthfully. Follow context/changes/WAVES.md and context/foundation/roadmap.md S-13, keep this single-change wave scoped to that outcome, and produce a reviewable PR with the run report posted as a PR comment.
Rigor: thorough (hot paths .github/workflows/ci.yml, skills/openspec-pipeline/test/openspec-skill.test.mjs, tools/test/ci-runner.test.mjs)
Outcome: done - impl review APPROVED
Code under chore commits: 1 path(s) in 1 step commit(s); see "Code committed by the router"

| # | Step | Provider | Model | Effort | Tier | Simple | Result | Tokens |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | score | openai | gpt-6-luna | low | 0 | no | ok (55d711d) | 261588 |
| 2 | plan | openai | gpt-6.1-sol | high | 3 | no | ok (339fe41), 1 neutral rerun | - |
| 3 | plan-review | openai | gpt-6.1-sol | high | 3 | no | ok (3f50f67) | - |
| 4 | implement | openai | gpt-6.1-sol | high | 3 | no | ok (5e8fc8f) | - |
| 5 | manual-verify | openai | gpt-6.1-sol | medium | 2 | no | ok (684621f) | 391342 |
| 6 | manual-verify | openai | gpt-6.1-sol | high | 3 | no | ok (0efe458) | 462001 |
| 7 | impl-review | openai | gpt-6-astra | high | 5 | no | ok (7e0c016) | - |

Steps: 7 · Tokens: 1114931 (figures for 3 of 7 steps)

## Code committed by the router

These paths sat uncommitted when a step ended and went into the router's `chore` step commit, so release-please lists no changelog line for them.

- step 2 plan (339fe41):
  - `context/foundation/roadmap.md`

## Neutral reruns

Steps returned again unchanged (same prompt, model and effort) after the orchestrator declared a fault of its own; no failed attempt was counted. The notes are the orchestrator's.

- step 2 plan: 1 rerun after an orchestrator fault
  - The orchestrator output capture truncated the plan action before launch. No step-2 model was launched. Repeat the saved dispatch unchanged.

## Review findings

Counts as recorded when each review step ended; later edits of a review file are not reflected.

- step 3 plan-review: SOUND, 0 critical, 1 warnings measured; 0 critical, 0 warnings open
- step 7 impl-review: APPROVED, 0 critical, 0 warnings measured

## Manual checks

Rows as recorded when the last manual-verify step ended. The kind comes from the evidence file name; the router never reads the content. Only browser, test, command or script evidence proves a browser row.

Proved: 0

Not proved: 2

- 3.4 Fresh upgraded OpenSpec pipeline runs revalidate discovery, awaited child/result ownership, recovery, restrictions and usage coverage for the six OpenSpec host/provider/launch cells, with any unavailable cell retained as pending and its prerequisite recorded. — not proved: Six live normal-entry host/provider/launch cells remain unproved. Their disposable-change, router and Git recovery writes exceed this step's plan/evidence-only and read-only Git restrictions. Each nee
- 3.5 The enclosing orchestrator pushes the run branch, opens the reviewable PR, obtains successful PR CI and posts the requested run report as a PR comment reflecting the actual outcome and pending live proof. — not proved: Read-only connected GitHub search returned no matching PR for head agent-smith/openspec-2-upgrade in xycu/agent-smith. Actual PR CI and report-comment acceptance remain unproved. Push, PR creation and

## Complexity score

Scores: cognitive 4, execution 6 (ambiguity 1, novelty 1, coupling 2, discovery 2, volume 2, verification 2)
Confidence: medium · Unknowns: 2
Source: score step 1

No tier shift.
