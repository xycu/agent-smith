# Run report: run-root-worktree-readiness

Goal: Make a fresh run-root worktree ready for the project's gates before step 1
Rigor: thorough (hot paths skills/10x-pipeline/policy.json, skills/10x-pipeline/test/prepare-run.test.mjs, skills/10x-pipeline/test/skill-loop.test.mjs)
Provider mode: split
Outcome: done - impl review APPROVED

| # | Step | Provider | Model | Effort | Tier | Simple | Result | Tokens |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | plan | openai | gpt-6.2-sol | medium | 2 | yes | ok (158586f) | - |
| 2 | plan-review | claude | sonnet | high | 3 | no | ok (6ec9891) | - |
| 3 | implement | openai | gpt-6.2-sol | high | 3 | no | ok (c445fd7) | - |
| 4 | manual-verify | claude | sonnet | medium | 2 | no | ok (4eed430) | - |
| 5 | manual-verify | claude | sonnet | high | 3 | no | ok (e2e3813) | - |
| 6 | impl-review | claude | sonnet | high | 3 | no | ok (67f2468) | - |

Steps: 6 · Tokens: - (figures for 0 of 6 steps)

## Token coverage

Verified observed host usage: 0 · Unavailable: 2 · Legacy/unverified scope: 0 · Missing figures: 6
Provider, model and tier groups describe the enclosing dispatch.
- Step 1 plan: unsupported-host — The host version is not qualified for accounting.
- Step 3 implement: unsupported-host — The host version is not qualified for accounting.

## Review findings

Counts as recorded when each review step ended; later edits of a review file are not reflected.

- step 2 plan-review: REVISE, 0 critical, 4 warnings measured; 0 critical, 2 warnings open
- step 6 impl-review: APPROVED, 0 critical, 0 warnings measured; 0 critical, 0 warnings open

## Manual checks

Rows as recorded when the last manual-verify step ended. The kind comes from the evidence file name; the router never reads the content. Only browser, test, command or script evidence proves a browser row.

Proved: 0

Not proved: 1

- 2.4 On an owner's real project, confirm that a fresh run reaches its first gate with local dependencies and that its configured readiness command rejects an unavailable or shared service with a repairable diagnostic. — not proved: row requires the owner's real project (real lockfile, committed readiness hook, a deliberately unavailable shared service); the fixture tests of rows 2.1-2.3 use fake package managers and a local hook
