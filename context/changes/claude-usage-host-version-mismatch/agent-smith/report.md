# Run report: claude-usage-host-version-mismatch

Transcript figures can undercount Claude usage because some requests appear only in telemetry.

Goal: Make transcript-mode Claude usage capture work on Claude Desktop. Follow frame.md and research.md. In claude-transcript.mjs, take the host version from the transcript records, not from the descriptor; in transcript mode the descriptor hostVersion is unneeded (ignore it, or reject it as invalid-evidence). Keep the floor check on the records and the check that the records agree with each other. Give the records-disagree case an accurate reason; unsupported-host stays only for a version below the floor. Keep the invocation identity on every failure so the late usage command can attach transcript evidence under ADR-019 as it stands; evidence that never had an identity still refuses (late-usage.test.mjs:735). Do not relax ADR-019. Align SKILL.md of both chains (within the byte ceilings and pinned regexes), docs/REFERENCE.md and usage.mjs reason text. Update the pin at claude-usage.test.mjs:614 and add identity-retention cases next to late-usage.test.mjs:663-668. Add a Manual row: a live native run records Claude token figures, with its evidence file kept.
Rigor: standard (goal plain)
Provider mode: split
Outcome: done - impl review APPROVED

| # | Step | Provider | Model | Effort | Tier | Simple | Result | Tokens |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | score | claude | haiku | low | 0 | no | ok (b85cdc8) | 211327 |
| 2 | plan | openai | gpt-6.2-sol | high | 3 | no | ok (5510aa4) | 2033603 |
| 3 | plan-review | claude | sonnet | high | 3 | no | ok (2e9cf5a) | 3393514 |
| 4 | implement | openai | gpt-6.2-astra | medium | 4 | no | ok (4783b70) | 4440063 |
| 5 | manual-verify | claude | sonnet | medium | 2 | no | ok (de61bf4) | 305824 |
| 6 | manual-verify | claude | sonnet | high | 3 | no | ok (54eb070) | 872252 |
| 7 | impl-review | claude | sonnet | high | 3 | no | ok (096302b) | 1843683 |

Steps: 7 · Tokens: 13100266 (figures for 7 of 7 steps)

## Token coverage

Verified observed host usage: 2 · Unavailable: 0 · Legacy/unverified scope: 0 · Missing figures: 0 · Transcript: 5
Provider, model and tier groups describe the enclosing dispatch.

## Review findings

Counts as recorded when each review step ended; later edits of a review file are not reflected.

- step 3 plan-review: REVISE, 0 critical, 3 warnings measured; 0 critical, 0 warnings open
- step 7 impl-review: APPROVED, 0 critical, 0 warnings measured; 0 critical, 0 warnings open

## Manual checks

Rows as recorded when the last manual-verify step ended. The kind comes from the evidence file name; the router never reads the content. Only browser, test, command or script evidence proves a browser row.

Proved: 0

Not proved: 1

- 2.2 A live native Claude Desktop pipeline run records Claude token figures and retains its evidence file under `evidence/`. — not proved: The live run in this Claude Desktop session (steps 1, 3, 5 of this change) did record positive transcript token figures with record version 2.1.330 (CLI is 2.1.325), but the session loads the installe

## Complexity score

Scores: cognitive 4, execution 5 (ambiguity 1, novelty 1, coupling 2, discovery 1, volume 2, verification 2)
Confidence: medium · Unknowns: 4
Source: score step 1

No tier shift.
