# Run report: agent-call-parameters

Goal: Make both pipeline skills describe valid Agent calls with and without run_in_background, give each step and archive agent a deterministic description, and use that identity for completion and late usage correlation. Follow context/changes/agent-call-parameters/change.md. Preserve OpenAI runner dispatch. Own Loop step 2, anti-stall rules 1 and 6, and late-usage prose in Wave 4. Record unavailable live Claude acceptance honestly. Respect the Wave 4 ownership table in context/changes/WAVES.md, resolve historical paths against current layout, leave WAVES.md to the post-wave maintenance change, and avoid changes owned by sibling runs. Shared documentation and skill-content tests may be updated only for this change's behavior. The user has now explicitly authorized the runner-lock test repair that halted step 5. Extend this change's ownership to the shutdown-lock test in skills/10x-pipeline/test/run-lock.test.mjs and its fake CLI synchronization in codex-helpers.mjs. Replace the fixed 350 ms shutdown assumption with deterministic synchronization, reusing the fixture's existing release mechanism where suitable. Preserve production lock behavior, all lock ownership assertions, and existing cancellation behavior for other fixture callers. The old race was reproduced by waiting 600 ms after the terminating marker: status --report correctly returned 0 after child close, while the test expected 1. Preserve the existing Agent call implementation and the authorized Codex configuration, bundled policy preset, and AGENTS.md concurrency guidance. Verify the focused regression and full suite with --test-concurrency=2 on Node 24.19.0 at /Users/blazej/.local/share/fnm/node-versions/v24.19.0/installation/bin/node, using the existing proven Git discovery isolation for worktree-local scratch fixtures. Complete implementation review and update existing PR #161 and its report comment. Record unavailable live Claude acceptance honestly. Leave WAVES.md and sibling run worktrees alone.
Rigor: standard (goal plain)
Outcome: done - impl review APPROVED
Code under chore commits: 2 path(s) in 1 step commit(s); see "Code committed by the router"

| # | Step | Provider | Model | Effort | Tier | Simple | Result | Tokens |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | score | openai | gpt-6-luna | low | 0 | no | ok (5822247), 3 neutral reruns | 309852 |
| 2 | plan | openai | gpt-6.1-sol | high | 3 | no | ok (c2a2a05) | 2657054 |
| 3 | plan-review | openai | gpt-6.1-sol | high | 3 | no | ok (7e1860b) | 1343889 |
| 4 | implement | openai | gpt-6.1-sol | medium | 2 | yes | failed | 17155478 |
| 5 | implement | openai | gpt-6-astra | medium | 4 | no | failed | 12446288 |
| 6 | plan | openai | gpt-6-astra | high | 5 | no | ok (be46911) | 1096720 |
| 7 | plan-review | openai | gpt-6.1-sol | high | 3 | no | ok (9c5bb9e) | 1442590 |
| 8 | implement | openai | gpt-6.1-sol | high | 3 | no | ok (3209dfb) | 6934844 |
| 9 | manual-verify | openai | gpt-6.1-sol | medium | 2 | no | ok (1ff3028) | 270358 |
| 10 | manual-verify | openai | gpt-6.1-sol | high | 3 | no | ok (7d65a2e) | 283396 |
| 11 | impl-review | openai | gpt-6-astra | high | 5 | no | ok (54467ac) | 4707374 |

Steps: 11 · Tokens: 48647843 (figures for 11 of 11 steps)

## Code committed by the router

These paths sat uncommitted when a step ended and went into the router's `chore` step commit, so release-please lists no changelog line for them.

- step 1 score (5822247):
  - `.codex/config.toml`
  - `context/foundation/agent-smith-policy.json`

## Rolled-back steps

Partial edits of failed steps, kept under a side ref. Inspect one with `git show --stat <ref>`.

- step 4 implement: `refs/agent-smith/agent-call-parameters/e5eabe79efac/failed-4` rolled back to 7e1860b

## Neutral reruns

Steps returned again unchanged (same prompt, model and effort) after the orchestrator declared a fault of its own; no failed attempt was counted. The notes are the orchestrator's.

- step 1 score: 3 reruns after an orchestrator fault
  - Codex permission preflight cannot verify required Git capability. Check the existing default configuration or selected optional profile, managed requirements, outer host permissions and native sandbox
  - Codex permission preflight cannot verify required Git capability. Check the existing default configuration or selected optional profile, managed requirements, outer host permissions and native sandbox
  - Permission configuration repaired and exact native Git commit preflight passed. Resume the original pending dispatch.

## Review findings

Counts as recorded when each review step ended; later edits of a review file are not reflected.

- step 3 plan-review: REVISE, 0 critical, 2 warnings measured; 0 critical, 0 warnings open
- step 7 plan-review: SOUND, 0 critical, 1 warnings measured; 0 critical, 0 warnings open
- step 11 impl-review: APPROVED, 0 critical, 1 warnings measured; 0 critical, 0 warnings open

## Manual checks

Rows as recorded when the last manual-verify step ended. The kind comes from the evidence file name; the router never reads the content. Only browser, test, command or script evidence proves a browser row.

Proved: 0

Not proved: 1

- 1.6 An authorized top-level Claude Code session records the exposed Agent schema, accepted step and archive descriptions, own-report completion matching, and on-time plus late usage attributed to the correct numbered step; this row stays pending in unattended recovery. — not proved: Live top-level Claude Code acceptance remains unverified. This unattended Codex subagent exposes no callable Claude Agent tool, and the task prohibits launching another agent. Available content tests

## Complexity score

Scores: cognitive 4, execution 5 (ambiguity 1, novelty 1, coupling 2, discovery 1, volume 2, verification 2)
Confidence: medium · Unknowns: 1
Source: score step 1

No tier shift.

## Lesson candidates

Candidates from the implementation review. Run a command yourself; the pipeline never runs `/10x-lesson`.

- `/10x-lesson Always bound content assertions to the section under test so later sections cannot satisfy missing requirements.` (step 11)
