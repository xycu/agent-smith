# Run report: codex-run-gitdir-grant

Token capture limitations: Native Claude token capture was off (7 steps)

Goal: Fix #281: per-run Codex gitdir grant via -c on sandbox and exec, plus a bounded stderr tail in the preflight refusal, following context/changes/codex-run-gitdir-grant/plan.md
Rigor: thorough (hot paths skills/10x-pipeline/policy.json, skills/10x-pipeline/scripts/flow.mjs, skills/10x-pipeline/scripts/route.mjs +3)
Provider mode: claude
Outcome: done - impl review NEEDS ATTENTION

| # | Step | Provider | Model | Effort | Tier | Simple | Result | Tokens |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | plan-review | claude | sonnet | high | 3 | no | ok (d866537) | - |
| 2 | implement (implement-segment) | claude | opus | high | 5 | no | ok (55cc085) | - |
| 3 | implement (implement-tdd) | claude | opus | high | 5 | no | ok (b9bf3f1) | - |
| 4 | implement | claude | opus | high | 5 | no | ok (c300f8c) | - |
| 5 | manual-verify | claude | sonnet | medium | 2 | no | ok (3c78ddb) | - |
| 6 | manual-verify | claude | sonnet | high | 3 | no | ok (7173007) | - |
| 7 | impl-review | claude | opus | high | 5 | no | ok (45e21d9) | - |

Steps: 7 · Tokens: - (figures for 0 of 7 steps)

## Token coverage

Verified observed host usage: 0 · Unavailable: 7 · Legacy/unverified scope: 0 · Missing figures: 7
Provider, model and tier groups describe the enclosing dispatch.
- Step 1 plan-review: capture-disabled — Claude token capture is off. Run `node <absolute-plugin-scripts>/claude-capture.mjs` to enable it for a fresh session.
- Step 2 implement: capture-disabled — Claude token capture is off. Run `node <absolute-plugin-scripts>/claude-capture.mjs` to enable it for a fresh session.
- Step 3 implement: capture-disabled — Claude token capture is off. Run `node <absolute-plugin-scripts>/claude-capture.mjs` to enable it for a fresh session.
- Step 4 implement: capture-disabled — Claude token capture is off. Run `node <absolute-plugin-scripts>/claude-capture.mjs` to enable it for a fresh session.
- Step 5 manual-verify: capture-disabled — Claude token capture is off. Run `node <absolute-plugin-scripts>/claude-capture.mjs` to enable it for a fresh session.
- Step 6 manual-verify: capture-disabled — Claude token capture is off. Run `node <absolute-plugin-scripts>/claude-capture.mjs` to enable it for a fresh session.
- Step 7 impl-review: capture-disabled — Claude token capture is off. Run `node <absolute-plugin-scripts>/claude-capture.mjs` to enable it for a fresh session.

## Review findings

Counts as recorded when each review step ended; later edits of a review file are not reflected.

- step 1 plan-review: REVISE, 0 critical, 4 warnings measured; 0 critical, 0 warnings open
- step 7 impl-review: NEEDS ATTENTION, 0 critical, 1 warnings measured; 0 critical, 0 warnings open

## Manual checks

Rows as recorded when the last manual-verify step ended. The kind comes from the evidence file name; the router never reads the content. Only browser, test, command or script evidence proves a browser row.

Proved: 0

Not proved: 3

- 1.4 On codex-cli 0.171.0, in an isolated run worktree with no `.git/worktrees/agent-smith-<id>` entry in `~/.codex/config.toml`, `run-codex.mjs` passes the preflight (`envelope.preflight.grant` names the profile and gitdir) — not proved: the row names codex-cli 0.171.0; the installed CLI is 0.172.0 ('codex --version'), so a live preflight there would prove a different version. Fake-Codex runner tests do not meet the "live" claim. Left
- 2.2 With the grant removed (`codex.permissions` set to a profile name that does not exist), a live preflight refusal names the denied `.git/worktrees/agent-smith-<id>` path — not proved: same: a live preflight refusal on 0.171.0 is required; only 0.172.0 is installed, and the covering tests use a fake Codex. Left at [ ].
- 3.3 A live `--provider-mode split` run in an isolated worktree on codex-cli 0.171.0 completes its first OpenAI step with no manual `~/.codex/config.toml` grant for that worktree — not proved: needs a live '--provider-mode split' pipeline run with a real OpenAI step on 0.171.0 in an isolated worktree; a manual-verify step cannot run it (it would call a model and write router state).

## Lesson candidates

Candidates from the implementation review. Run a command yourself; the pipeline never runs `/10x-lesson`.

- `/10x-lesson Always test a gitdir-scoped permission in both a linked worktree and a main checkout, because there the gitdir and the common dir are the same path.` (step 7)
