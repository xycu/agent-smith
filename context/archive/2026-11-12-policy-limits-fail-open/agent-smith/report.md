# Run report: policy-limits-fail-open

Goal: Validate policy limits, ladder and tiers at load instead of failing open: no value of a limit, ladder or tier key may let a run exceed its shipped bounds silently, and every malformed value must halt with the key name before anything is written. Scope and details in context/changes/policy-limits-fail-open/change.md.
Rigor: thorough (hot paths skills/10x-pipeline/scripts/flow.mjs, skills/10x-pipeline/scripts/route.mjs, skills/10x-pipeline/scripts/state.mjs)
Outcome: done - impl review APPROVED

| # | Step | Model | Effort | Tier | Simple | Result | Tokens |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | score | haiku | low | 0 | no | ok (93fea84) | - |
| 2 | plan | sonnet | high | 3 | no | ok (f70d91c), 1 neutral rerun | 106588 |
| 3 | plan-review | sonnet | high | 3 | no | ok (e5b5433) | 136586 |
| 4 | implement (implement-tdd) | sonnet | high | 3 | no | ok (ad7c805) | 122365 |
| 5 | implement (implement-tdd) | sonnet | high | 3 | no | ok (288e8b9) | 134290 |
| 6 | implement | sonnet | high | 3 | no | ok (a512151) | 103996 |
| 7 | manual-verify | sonnet | medium | 2 | no | ok (1154ff0) | 87418 |
| 8 | impl-review | opus | high | 5 | no | ok (1a833de) | 153212 |

Steps: 8 · Tokens: 844455 (figures for 7 of 8 steps)

## Neutral reruns

Steps returned again unchanged (same prompt, model and effort) after the orchestrator declared a fault of its own; no failed attempt was counted. The notes are the orchestrator's.

- step 2 plan: 1 rerun after an orchestrator fault
  - Previous orchestrator session and plan subagent were killed mid-step; no RESULT line was returned. Resumed by a new orchestrator.

## Review findings

Counts as recorded when each review step ended; later edits of a review file are not reflected.

- step 3 plan-review: REVISE, 0 critical, 2 warnings measured; 0 critical, 0 warnings open
- step 8 impl-review: APPROVED, 0 critical, 1 warnings measured; 0 critical, 0 warnings open

## Manual checks

Rows as recorded when the last manual-verify step ended. The kind comes from the evidence file name; the router never reads the content. Only browser, test, command or script evidence proves a browser row.

Proved: 4

- 1.6 In a scratch project, an override of `{"limits":{"maxTotalSteps":"14"}}` makes `route.mjs init` print a halt that names `policy.limits.maxTotalSteps` and `agent-smith-policy.json`, and `agent-smith/` is not created — script (evidence/script-manual-halts.out.txt)
- 1.7 `route.mjs status <id>` on the same project prints valid JSON with `policyProblem` — script (evidence/script-manual-halts.out.txt)
- 2.5 A scratch override that renames `{id}` to `{idd}` in the `plan` template makes `init` halt naming `policy.prompts.plan` and `{idd}` — script (evidence/script-manual-halts.out.txt)
- 3.3 `docs/REFERENCE.md`, `prompts/README.md` and `AGENTS.md` read consistently about which commands halt and which warn — judgment (evidence/judgment-docs-consistency.md)

Not proved: 0

## Complexity score

Scores: cognitive 4, execution 4 (ambiguity 1, novelty 1, coupling 2, discovery 1, volume 2, verification 1)
Confidence: medium · Unknowns: 2
Source: score step 1

No tier shift.

## Lesson candidates

Candidates from the implementation review. Run a command yourself; the pipeline never runs `/10x-lesson`.

- `/10x-lesson Always list in the plan every existing test whose fixture a new fail-closed check rejects, and retitle a test whose old path the check now preempts.` (step 8)
