# Run report: shared-churn-excludes

Goal: Export one churnExcludes helper from state.mjs that returns the override's exclude array of strings, else the shipped risk.churn.exclude list, as regexes; make churnConfig and evidenceExcludes (steps.mjs) use it, delete evidenceExcludes' own fallback and its now unused imports, so one function owns the exclude-glob fallback and the commit-evidence check honours the override's exclude whatever the other churn keys hold. Scope and details in context/changes/shared-churn-excludes/change.md. Done when the new test (invalid since plus custom exclude, commit touching only an excluded path is not code-commit evidence) and the full suite pass locally.
Rigor: standard (goal plain)
Outcome: done - impl review APPROVED

| # | Step | Model | Effort | Tier | Simple | Result | Tokens |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | score | haiku | low | 0 | no | ok (55dd66e) | 76587 |
| 2 | plan | sonnet | high | 3 | no | ok (adb00e9) | 112189 |
| 3 | plan-review | sonnet | high | 3 | no | ok (f31f11e) | 102382 |
| 4 | implement | sonnet | medium | 2 | yes | ok (2ea864b) | 81244 |
| 5 | manual-verify | sonnet | medium | 2 | no | ok (60c4ab0) | 72273 |
| 6 | impl-review | sonnet | high | 3 | no | ok (56df762) | 99911 |

Steps: 6 · Tokens: 544586 (figures for 6 of 6 steps)

## Review findings

Counts as recorded when each review step ended; later edits of a review file are not reflected.

- step 3 plan-review: SOUND, 0 critical, 1 warnings measured; 0 critical, 0 warnings open
- step 6 impl-review: APPROVED, 0 critical, 0 warnings measured

## Manual checks

Rows as recorded when the last manual-verify step ended. The kind comes from the evidence file name; the router never reads the content. Only browser, test, command or script evidence proves a browser row.

Proved: 1

- 1.6 Diff shows one fallback of the shipped exclude list, in state.mjs only, and about 5 fewer lines net in the scripts — judgment (evidence/judgment-diff-one-fallback.md)

Not proved: 0

## Complexity score

Scores: cognitive 3, execution 2 (ambiguity 1, novelty 1, coupling 1, discovery 0, volume 1, verification 1)
Confidence: high · Unknowns: 0
Source: score step 1

No tier shift.
