# Run report: usage-capture-preflight

Goal: Run without any interaction to the user
Rigor: thorough (hot paths skills/10x-pipeline/scripts/flow.mjs, skills/10x-pipeline/scripts/route.mjs, skills/10x-pipeline/test/late-usage.test.mjs +1)
Provider mode: codex
Outcome: done - impl review APPROVED

| # | Step | Provider | Model | Effort | Tier | Simple | Result | Tokens |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | plan | openai | gpt-6.2-sol | medium | 2 | yes | ok (d28f6d5) | - |
| 2 | plan-review | openai | gpt-6.2-sol | medium | 2 | no | ok (658b180) | - |
| 3 | implement | openai | gpt-6.2-sol | high | 3 | no | ok (730d4f4) | - |
| 4 | manual-verify | openai | gpt-6.2-sol | medium | 2 | no | ok (55738c0) | - |
| 5 | manual-verify | openai | gpt-6.2-sol | high | 3 | no | ok (cff9f1f) | - |
| 6 | impl-review | openai | gpt-6.2-sol | high | 3 | no | ok (94b10c5) | - |
| 7 | plan | openai | gpt-6.2-astra | xhigh | 6 | no | ok (770cc99) | - |
| 8 | plan-review | openai | gpt-6.2-sol | high | 3 | no | ok (6481d6e) | - |
| 9 | implement | openai | gpt-6.2-sol | medium | 2 | no | ok (40a8942) | - |
| 10 | impl-review | openai | gpt-6.2-sol | high | 3 | no | ok (777aa13) | - |
| 11 | fix | openai | gpt-6.2-astra | medium | 4 | no | ok (779184c) | - |
| 12 | impl-review | openai | gpt-6.2-astra | high | 5 | no | ok (c709043) | - |

Steps: 12 · Tokens: - (figures for 0 of 12 steps)

## Token coverage

Verified observed host usage: 0 · Unavailable: 12 · Legacy/unverified scope: 0 · Missing figures: 12
Provider, model and tier groups describe the enclosing dispatch.
- Step 1 plan: unsupported-host — The host version is not qualified for accounting.
- Step 2 plan-review: unsupported-host — The host version is not qualified for accounting.
- Step 3 implement: unsupported-host — The host version is not qualified for accounting.
- Step 4 manual-verify: unsupported-host — The host version is not qualified for accounting.
- Step 5 manual-verify: unsupported-host — The host version is not qualified for accounting.
- Step 6 impl-review: unsupported-host — The host version is not qualified for accounting.
- Step 7 plan: unsupported-host — The host version is not qualified for accounting.
- Step 8 plan-review: unsupported-host — The host version is not qualified for accounting.
- Step 9 implement: unsupported-host — The host version is not qualified for accounting.
- Step 10 impl-review: unsupported-host — The host version is not qualified for accounting.
- Step 11 fix: unsupported-host — The host version is not qualified for accounting.
- Step 12 impl-review: unsupported-host — The host version is not qualified for accounting.

## Review findings

Counts as recorded when each review step ended; later edits of a review file are not reflected.

- step 2 plan-review: REVISE, 0 critical, 5 warnings measured; 0 critical, 0 warnings open
- step 6 impl-review: REJECTED, 1 critical, 1 warnings measured; 0 critical, 0 warnings open
- step 8 plan-review: REVISE, 0 critical, 2 warnings measured; 0 critical, 0 warnings open
- step 10 impl-review: REJECTED, 1 critical, 1 warnings measured; 0 critical, 0 warnings open
- step 12 impl-review: APPROVED, 0 critical, 0 warnings measured

## Manual checks

Rows as recorded when the last manual-verify step ended. The kind comes from the evidence file name; the router never reads the content. Only browser, test, command or script evidence proves a browser row.

Proved: 0

Not proved: 2

- 2.4 On a supported interactive Claude host, observe the warning before step one in an ordinary session, then use the documented launcher in a fresh session and verify quiet init and captured figures. — not proved: Claude Code 2.1.323 meets the launcher floor and the focused startup and capture fixtures passed. The archived Claude capture acceptance predates this change. Observing the new warning before dispatch
- 2.5 After authorized orchestrator publication of a run with capture disabled and comment intent, confirm the open PR comment displays the same missing-capture explanation as its report. — not proved: GitHub returned no open PR for this run branch, and the run has no terminal report. The fake-client comment check passed. Live comparison requires authorized orchestrator publication.

## Lesson candidates

Candidates from the implementation review. Run a command yourself; the pipeline never runs `/10x-lesson`.

- `/10x-lesson Always load optional transport diagnostics only for the selected transport and handle dependency failures locally.` (step 10)
