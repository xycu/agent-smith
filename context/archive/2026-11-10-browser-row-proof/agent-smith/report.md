# Run report: browser-row-proof

Goal: Fix GitHub issue #37: a Manual row that needs a browser must be proved by browser, test, command or script evidence, never by a judgment from a source read. Add a policy word list for browser rows and the kinds that prove them, have the router list a browser row ticked with judgment or other evidence as unproven with its reason, tighten the manual-verify and manual-verify-nochrome templates so the Chrome tools are tried first and the attempt or its error is recorded, mark browser rows in the report, check live whether a step subagent can call the Chrome tools, update REFERENCE.md, ADR and tests
Rigor: thorough (hot paths skills/10x-pipeline/policy.json, skills/10x-pipeline/scripts/route.mjs, skills/10x-pipeline/test/manualverify.test.mjs)
Outcome: done - impl review APPROVED
Archive: requested - runs after this report was written; see the commit "chore(archive): close browser-row-proof"

| # | Step | Model | Effort | Tier | Simple | Result | Tokens |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | score | haiku | low | 0 | no | ok (b758167) | - |
| 2 | plan | sonnet | high | 3 | no | ok (e9f289c) | 234924 |
| 3 | plan-review | sonnet | high | 3 | no | ok (b644f2d) | - |
| 4 | implement | sonnet | high | 3 | no | ok (52b3d16) | - |
| 5 | manual-verify | sonnet | medium | 2 | no | ok (8fd2508) | 135672 |
| 6 | impl-review | opus | high | 5 | no | ok (68bb81b) | 134282 |

Steps: 6 · Tokens: 504878 (figures for 3 of 6 steps)

## Review findings

Counts as recorded when each review step ended; later edits of a review file are not reflected.

- step 3 plan-review: REVISE, 0 critical, 2 warnings measured; 0 critical, 0 warnings open
- step 6 impl-review: APPROVED, 0 critical, 1 warnings measured; 0 critical, 0 warnings open

## Manual checks

Rows as recorded when the last manual-verify step ended. The kind comes from the evidence file name; the router never reads the content.

Proved: 3

- 3.6 Run `node skills/10x-pipeline/scripts/route.mjs init` for a scratch change with the plugin's real `policy.json` and a plan with one Manual row that mentions `browser`, read the rendered `manual-verify` prompt, and see the Chrome-first rule, the evidence-recording rule and the failure reason shape in order, in plain wording — test (evidence/test-prompts.md)
- 4.6 In this step's `manual-verify` subagent, load the Chrome tools with ToolSearch and call `tabs_context_mcp` once; save the tool calls and the result as `browser-` evidence, and see that the "Limits" text of docs/REFERENCE.md agrees with that result — browser (evidence/browser-tabs-context.md)
- 4.7 Read the Manual verification and Limits text of docs/REFERENCE.md and the ADR-012 amendment and see that they agree on the two policy keys, the proof kinds, the reason texts and the upgrade note — judgment (evidence/judgment-docs-agree.md)

Not proved: 0

## Complexity score

Scores: cognitive 4, execution 6 (ambiguity 1, novelty 1, coupling 2, discovery 2, volume 2, verification 2)
Confidence: medium · Unknowns: 3
Source: score step 1

No tier shift.
