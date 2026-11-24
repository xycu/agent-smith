# Run report: codex-worktree-gitdir-grant

Goal: Implement context/changes/codex-worktree-gitdir-grant/plan.md (3 phases). Prerequisite: PR #285 (codex-run-gitdir-grant) is merged, so re-check its gitdirGrant/configArgs names in run-codex.mjs first. Extend the per-run Codex grant to gitdir + <common>/objects, refs, logs (packed-refs only if the plan's check needs it). Narrow init-permissions.mjs advice and add the read-only stale agent-smith-* line listing for ~/.codex/config.toml. Never write user config. Leave Manual rows 1.4, 1.5, 3.3 and 3.4 (live macOS, real Codex) for me.
Rigor: standard (goal plain, phases 3, hot paths skills/10x-pipeline/scripts/run-codex.mjs, skills/10x-pipeline/test/codex-runner.test.mjs)
Provider mode: claude
Outcome: done - impl review NEEDS ATTENTION

| # | Step | Provider | Model | Effort | Tier | Simple | Result | Tokens |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | plan-review | claude | sonnet | high | 3 | no | ok (cfb8158) | - |
| 2 | implement | claude | opus | high | 5 | no | ok (5278c02) | - |
| 3 | manual-verify | claude | sonnet | medium | 2 | no | ok (8fd5615) | - |
| 4 | manual-verify | claude | sonnet | high | 3 | no | ok (8ef8a2e) | - |
| 5 | impl-review | claude | opus | high | 5 | no | ok (914f768) | - |

Steps: 5 · Tokens: - (figures for 0 of 5 steps)

## Token coverage

Verified observed host usage: 0 · Unavailable: 0 · Legacy/unverified scope: 0 · Missing figures: 5
Provider, model and tier groups describe the enclosing dispatch.

## Review findings

Counts as recorded when each review step ended; later edits of a review file are not reflected.

- step 1 plan-review: REVISE, 0 critical, 5 warnings measured; 0 critical, 0 warnings open
- step 5 impl-review: NEEDS ATTENTION, 0 critical, 1 warnings measured; 0 critical, 0 warnings open

## Manual checks

Rows as recorded when the last manual-verify step ended. The kind comes from the evidence file name; the router never reads the content. Only browser, test, command or script evidence proves a browser row.

Proved: 3

- 1.4 On macOS with Codex, `codex sandbox -c '<generated table>'` in a linked worktree lets `git add` and `git commit` succeed and leaves `<common>/hooks` and `<common>/config` writes denied — command (evidence/command-codex-sandbox-grant-output.txt)
- 1.5 Branch creation, `git branch -d` and `git gc --auto` inside the same sandbox pass or the failing path is recorded; `packed-refs` added only if needed — command (evidence/command-codex-sandbox-grant-output.txt)
- 2.4 Running `init` in a repo whose `~/.codex/config.toml` has dead `agent-smith-*` lines prints them once and does not change the file (compare checksums) — test (evidence/test-init-stale-listing.txt)

Not proved: 2

- 3.3 Fresh isolated run on macOS (Codex 0.172.0 or newer): a step commits with no approval prompt and no new `~/.codex/config.toml` line — not proved: needs a fresh live isolated pipeline run whose Codex step commits with no approval prompt; an unattended manual-verify step cannot start one, and no test or command covers it (scratch analogue is row
- 3.4 From inside that run's sandbox, a write to `<common>/hooks` and to `<common>/config` is denied — not proved: needs the sandbox of that live run; probing '<common>/hooks' and '<common>/config' from here would write outside the run root, which the rules forbid (scratch-repo analogue in row 1.4 is proven but is

## Lesson candidates

Candidates from the implementation review. Run a command yourself; the pipeline never runs `/10x-lesson`.

- `/10x-lesson Always update docs with the outcome of a manual check once its evidence lands, never leave a doc calling a settled check open.` (step 5)
