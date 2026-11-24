# Run report: quote-router-in-skill-loops

Goal: Resume Phase 2 rows 2.1 to 2.5 only; Phase 1 is done and its evidence is in evidence/command-installed-plugin-substitution.md. Quote $ROUTER, $PR_COMMENT and $OPEN_PR as node "$VAR" in every call of both SKILL.md loops, re-pin skill-loop.test.mjs, openspec-skill.test.mjs, archive-gate.test.mjs and init-permissions tests to the quoted form, add the mutation regression and the spaced-path fixture test, keep the two Anti-stall sections equal. If SKILL.md grows, raise the byte ceiling in skill-loop.test.mjs and say so in the PR. Leave rows 2.6 and 2.7 as Manual.
Rigor: thorough (hot paths skills/10x-pipeline/test/pr-comment.test.mjs, skills/10x-pipeline/test/skill-loop.test.mjs, skills/openspec-pipeline/test/openspec-skill.test.mjs)
Provider mode: legacy (ladder-driven)
Outcome: done - impl review NEEDS ATTENTION
Code under chore commits: 1 path(s) in 1 step commit(s); see "Code committed by the router"

| # | Step | Provider | Model | Effort | Tier | Simple | Result | Tokens |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | score | openai | gpt-6-luna | low | 0 | no | ok (e1d18a0), 4 neutral reruns | 198156 |
| 2 | plan | openai | gpt-6-astra | high | 5 | no | ok (775376c) | 1431696 |
| 3 | plan-review | openai | gpt-6.1-sol | high | 3 | no | ok (4c54a4a) | 1569615 |
| 4 | implement | openai | gpt-6.1-sol | medium | 2 | no | failed | 567896 |
| 5 | implement | openai | gpt-6.2-astra | medium | 4 | no | ok (4c8c4c5), 1 neutral rerun | 7191550 |
| 6 | manual-verify | openai | gpt-6.2-sol | medium | 2 | no | ok (4d3e678) | 278663 |
| 7 | manual-verify | openai | gpt-6.2-sol | high | 3 | no | ok (5d07aa2) | 391144 |
| 8 | impl-review | openai | gpt-6.2-astra | high | 5 | no | ok (97b1ef3) | 5722743 |

Steps: 8 · Tokens: 17351463 (figures for 8 of 8 steps)

## Token coverage

Verified observed host usage: 4 · Unavailable: 0 · Legacy/unverified scope: 4 · Missing figures: 0
Provider, model and tier groups describe the enclosing dispatch.
Legacy figures retain their original unverified scope.

## Code committed by the router

These paths sat uncommitted when a step ended and went into the router's `chore` step commit, so release-please lists no changelog line for them.

- step 5 implement (4c8c4c5):
  - `skills/10x-pipeline/test/skill-loop.test.mjs`

## Neutral reruns

Steps returned again unchanged (same prompt, model and effort) after the orchestrator declared a fault of its own; no failed attempt was counted. The notes are the orchestrator's.

- step 1 score: 4 reruns after an orchestrator fault
  - Codex permission preflight cannot verify required Git capability. Check the existing default configuration or selected optional profile, managed requirements, outer host permissions and native sandbox
  - Codex permission preflight cannot verify required Git capability. Check the existing default configuration or selected optional profile, managed requirements, outer host permissions and native sandbox
  - Codex permission preflight cannot verify required Git capability. Check the existing default configuration or selected optional profile, managed requirements, outer host permissions and native sandbox
  - User approved scoped Git metadata permissions and resumption. All three exact run-root Git probes now pass. Allow one neutral rerun after repairing harness permissions.
- step 5 implement: 1 rerun after an orchestrator fault
  - Codex permission preflight cannot verify required Git capability. Check the existing default configuration or selected optional profile, managed requirements, outer host permissions and native sandbox

## Review findings

Counts as recorded when each review step ended; later edits of a review file are not reflected.

- step 3 plan-review: SOUND, 0 critical, 0 warnings measured
- step 8 impl-review: NEEDS ATTENTION, 0 critical, 4 warnings measured; 0 critical, 0 warnings open

## Manual checks

Rows as recorded when the last manual-verify step ended. The kind comes from the evidence file name; the router never reads the content. Only browser, test, command or script evidence proves a browser row.

Proved: 0

Not proved: 2

- 2.6 The fixed installed plugin under an actual cache path containing spaces starts the router through `/agent-smith:10x-pipeline`, with source revision, expanded command and `action: "run"` evidence recorded in this change. — not proved: The Claude Code installed-plugin registry had one agent-smith entry and zero entries resolving to an existing cache path containing spaces. The recorded '/agent-smith:10x-pipeline' transcript used a d
- 2.7 The fixed installed plugin under an actual cache path containing spaces starts the shared router through `/agent-smith:openspec-pipeline`, preserving `--chain openspec`, with source revision, expanded command and `action: "run"` evidence recorded in this change. — not proved: The Claude Code installed-plugin registry had no agent-smith entry resolving to an existing cache path containing spaces. The recorded '/agent-smith:openspec-pipeline' transcript used a directory mark

## Complexity score

Scores: cognitive 4, execution 5 (ambiguity 1, novelty 1, coupling 2, discovery 1, volume 2, verification 2)
Confidence: medium · Unknowns: 2
Source: score step 1

No tier shift.

## Lesson candidates

Candidates from the implementation review. Run a command yourself; the pipeline never runs `/10x-lesson`.

- `/10x-lesson Always test a documented command inside the branch or section that owns it so moving it to the wrong execution path fails the test.` (step 8)
