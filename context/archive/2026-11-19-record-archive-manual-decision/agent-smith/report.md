# Run report: record-archive-manual-decision

Transcript figures can undercount Claude usage because some requests appear only in telemetry.

Goal: Document the durable record an archive leaves when the owner approves archiving with unresolved Manual rows: the approval, each distinct row ID across manualPending, manualUnproven and uncommittedTicks, the reason and the follow-up destination, with each row's checkbox, evidence and commit references kept. With no open rows the normal path writes no record; a refusal or a missing answer keeps the change unarchived. Docs only: no runtime gate change and no backfill of archived changes. Follow the acceptance in change.md and the S-13 and S-14 closeouts.
Rigor: standard (goal plain)
Provider mode: split
Outcome: done - impl review APPROVED
Archive: requested - runs after this report was written; see the commit "chore(archive): close record-archive-manual-decision"

| # | Step | Provider | Model | Effort | Tier | Simple | Result | Tokens |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | score | claude | haiku | low | 0 | no | ok (ac00b06) | 742775 |
| 2 | plan | openai | gpt-6.2-sol | high | 3 | no | ok (1b3fcae) | 1256304 |
| 3 | plan-review | claude | sonnet | high | 3 | no | ok (c1701c8) | - |
| 4 | implement | openai | gpt-6.2-sol | medium | 2 | yes | ok (de24837) | 4650142 |
| 5 | manual-verify | claude | sonnet | medium | 2 | no | ok (94b1037) | 1092402 |
| 6 | impl-review | claude | sonnet | high | 3 | no | ok (ab2aa01) | 1369693 |

Steps: 6 · Tokens: 9111316 (figures for 5 of 6 steps) · subtotal

## Token coverage

Verified observed host usage: 2 · Unavailable: 1 · Legacy/unverified scope: 0 · Missing figures: 1 · Transcript: 3
Provider, model and tier groups describe the enclosing dispatch.
- Step 3 plan-review: ambiguous-history — Inherited or resumed history has no proven invocation boundary.

## Review findings

Counts as recorded when each review step ended; later edits of a review file are not reflected.

- step 3 plan-review: REVISE, 0 critical, 1 warnings measured; 0 critical, 0 warnings open
- step 6 impl-review: APPROVED, 0 critical, 0 warnings measured; 0 critical, 0 warnings open

## Manual checks

Rows as recorded when the last manual-verify step ended. The kind comes from the evidence file name; the router never reads the content. Only browser, test, command or script evidence proves a browser row.

Proved: 1

- 1.4 A reviewer can trace the documented approval, deferred checks and follow-up owners from the example and follow the empty-list and refusal paths without treating an unresolved check as proved. — judgment (evidence/judgment-archive-record-trace.md)

Not proved: 0

## Complexity score

Scores: cognitive 4, execution 4 (ambiguity 2, novelty 1, coupling 1, discovery 1, volume 1, verification 2)
Confidence: medium · Unknowns: 3
Source: score step 1

No tier shift.
