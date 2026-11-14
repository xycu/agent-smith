# Run report: ci-fail-on-unexpected-skips

Goal: Make CI fail when required Git or OpenSpec contract checks cannot run, while preserving local skip behavior and explicitly accounting for expected CI skips. Owner approved installing a pinned OpenSpec CLI as a CI-only tool, an exception to the repository npm-dependency restriction limited to that tool. Follow the change brief and Wave 5 ownership in context/changes/WAVES.md, resolving moved OpenSpec paths. Leave WAVES.md and context/archive untouched.
Rigor: thorough (hot paths .github/workflows/ci.yml, skills/10x-pipeline/test/helpers.mjs, tools/test/ci-runner.test.mjs)
Outcome: done - impl review APPROVED

| # | Step | Provider | Model | Effort | Tier | Simple | Result | Tokens |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | score | openai | gpt-6-luna | low | 0 | no | ok (0201e1f) | 310971 |
| 2 | plan | openai | gpt-6.1-sol | high | 3 | no | ok (bc2fabd) | 1515597 |
| 3 | plan-review | openai | gpt-6.1-sol | high | 3 | no | ok (4444f68) | 1135098 |
| 4 | implement | openai | gpt-6.1-sol | medium | 2 | no | ok (9ec41fc) | 18613768 |
| 5 | manual-verify | openai | gpt-6.1-sol | medium | 2 | no | ok (613d536) | 257253 |
| 6 | manual-verify | openai | gpt-6.1-sol | high | 3 | no | ok (f97655e) | 335440 |
| 7 | impl-review | openai | gpt-6.1-sol | high | 3 | no | ok (e0c8187) | 8483975 |

Steps: 7 · Tokens: 30652102 (figures for 7 of 7 steps)

## Review findings

Counts as recorded when each review step ended; later edits of a review file are not reflected.

- step 3 plan-review: SOUND, 0 critical, 1 warnings measured; 0 critical, 0 warnings open
- step 7 impl-review: APPROVED, 0 critical, 0 warnings measured; 0 critical, 0 warnings open

## Manual checks

Rows as recorded when the last manual-verify step ended. The kind comes from the evidence file name; the router never reads the content. Only browser, test, command or script evidence proves a browser row.

Proved: 0

Not proved: 1

- 2.5 A normal same-repository PR CI run on the non-root TrueNAS runner records OpenSpec 1.16.1, execution of all five contract fixtures and both permission checks, and only the documented conditional skips. — not proved: Fresh read-only GitHub checks found no PR or CI run for agent-smith/ci-fail-on-unexpected-skips and zero workflow runs for current commit 613d5368849239cc09eb4e76cfdeaf4e538974e3. The required live sa

## Complexity score

Scores: cognitive 4, execution 5 (ambiguity 1, novelty 1, coupling 2, discovery 1, volume 2, verification 2)
Confidence: medium · Unknowns: 0
Source: score step 1

No tier shift.
