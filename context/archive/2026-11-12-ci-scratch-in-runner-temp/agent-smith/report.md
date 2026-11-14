# Run report: ci-scratch-in-runner-temp

Goal: Put CI test scratch projects and locks under runner.temp by setting TMPDIR on the test step, add the covering CI configuration check, and preserve test-specific TMPDIR overrides. Follow context/changes/ci-scratch-in-runner-temp/change.md. Own the CI test-step environment and its tests in Wave 4. Record live runner cleanup acceptance honestly. Respect the Wave 4 ownership table in context/changes/WAVES.md, resolve historical paths against current layout, leave WAVES.md to the post-wave maintenance change, and avoid changes owned by sibling runs. Shared documentation and skill-content tests may be updated only for this change's behavior.
Rigor: standard (goal plain)
Outcome: done - impl review APPROVED
Code under chore commits: 3 path(s) in 2 step commit(s); see "Code committed by the router"

| # | Step | Provider | Model | Effort | Tier | Simple | Result | Tokens |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | score | openai | gpt-6-luna | low | 0 | no | failed, 3 neutral reruns | 152064 |
| 2 | score | openai | gpt-6.1-sol | low | 1 | no | ok (e7164f3) | 243610 |
| 3 | plan | openai | gpt-6.1-sol | high | 3 | no | ok (d64d66a) | 1514925 |
| 4 | plan-review | openai | gpt-6.1-sol | high | 3 | no | ok (9c0b2eb) | 617405 |
| 5 | implement | openai | gpt-6.1-sol | medium | 2 | no | ok (2b90f0a) | 21250099 |
| 6 | manual-verify | openai | gpt-6.1-sol | medium | 2 | no | ok (c5ea355) | 253217 |
| 7 | manual-verify | openai | gpt-6.1-sol | high | 3 | no | ok (363c0b1) | 282963 |
| 8 | impl-review | openai | gpt-6.1-sol | high | 3 | no | ok (53eba02) | 2073248 |

Steps: 8 · Tokens: 26387531 (figures for 8 of 8 steps)

## Code committed by the router

These paths sat uncommitted when a step ended and went into the router's `chore` step commit, so release-please lists no changelog line for them.

- step 2 score (e7164f3):
  - `.codex/config.toml`
  - `context/foundation/agent-smith-policy.json`
- step 5 implement (2b90f0a):
  - `AGENTS.md`

## Neutral reruns

Steps returned again unchanged (same prompt, model and effort) after the orchestrator declared a fault of its own; no failed attempt was counted. The notes are the orchestrator's.

- step 1 score: 3 reruns after an orchestrator fault
  - Codex permission preflight cannot verify required Git capability. Check the existing default configuration or selected optional profile, managed requirements, outer host permissions and native sandbox
  - Codex permission preflight cannot verify required Git capability. Check the existing default configuration or selected optional profile, managed requirements, outer host permissions and native sandbox
  - Permission configuration repaired and exact native Git commit preflight passed. Resume the original pending dispatch.

## Review findings

Counts as recorded when each review step ended; later edits of a review file are not reflected.

- step 4 plan-review: SOUND, 0 critical, 0 warnings measured
- step 8 impl-review: APPROVED, 0 critical, 0 warnings measured

## Manual checks

Rows as recorded when the last manual-verify step ended. The kind comes from the evidence file name; the router never reads the content. Only browser, test, command or script evidence proves a browser row.

Proved: 0

Not proved: 2

- 1.5 A green CI test job on a TrueNAS runner records its run URL, runner identity, effective suite `TMPDIR` and observed scratch or lock paths beneath the resolved runner-temp directory. — not proved: Renewed read-only CI and pull-request lookups returned no entries for agent-smith/ci-scratch-in-runner-temp. A green TrueNAS test job with runner identity, effective suite TMPDIR and observed scratch
- 1.6 After cancelling a CI test job with observed scratch state, the next test job on the same runner starts with those earlier scratch projects and lock files absent, with both run URLs, runner identity, paths and job-start observations recorded. — not proved: The required cancelled-job scratch inventory and subsequent same-runner job-start inventory remain unavailable. Live CI creation is forbidden in this step. Existing local tests cannot establish actual

## Complexity score

Scores: cognitive 2, execution 3 (ambiguity 0, novelty 1, coupling 1, discovery 0, volume 1, verification 2)
Confidence: medium · Unknowns: 2
Source: score step 2

No tier shift.
