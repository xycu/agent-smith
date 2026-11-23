# Run report: codex-profile-and-gitdir-access

Goal: Warn at init when the Codex profile or the worktree gitdir access is missing
Rigor: thorough (hot paths .claude-plugin/marketplace.json, .claude-plugin/plugin.json, .release-please-manifest.json +11)
Provider mode: split
Outcome: done - impl review APPROVED

| # | Step | Provider | Model | Effort | Tier | Simple | Result | Tokens |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | plan | openai | gpt-6.2-sol | medium | 2 | yes | ok (06d5d81) | - |
| 2 | plan-review | claude | sonnet | medium | 2 | no | ok (8de618f) | - |
| 3 | implement | openai | gpt-6.2-sol | medium | 2 | yes | ok (58cf05a) | - |
| 4 | manual-verify | claude | sonnet | medium | 2 | no | ok (3fe1d16) | - |
| 5 | manual-verify | claude | sonnet | high | 3 | no | ok (adfe7a8) | - |
| 6 | impl-review | claude | sonnet | high | 3 | no | ok (8e591a3) | - |

Steps: 6 · Tokens: - (figures for 0 of 6 steps)

## Token coverage

Verified observed host usage: 0 · Unavailable: 2 · Legacy/unverified scope: 0 · Missing figures: 6
Provider, model and tier groups describe the enclosing dispatch.
- Step 1 plan: unsupported-host — The host version is not qualified for accounting.
- Step 3 implement: unsupported-host — The host version is not qualified for accounting.

## Review findings

Counts as recorded when each review step ended; later edits of a review file are not reflected.

- step 2 plan-review: SOUND, 0 critical, 1 warnings measured; 0 critical, 0 warnings open
- step 6 impl-review: APPROVED, 0 critical, 1 warnings measured; 0 critical, 0 warnings open

## Manual checks

Rows as recorded when the last manual-verify step ended. The kind comes from the evidence file name; the router never reads the content. Only browser, test, command or script evidence proves a browser row.

Proved: 0

Not proved: 2

- 1.5 In a disposable trusted project, verify the warning and its clearance after applying the snippet with real Codex on the current and documented baseline CLI, recording the versions and any unsupported diagnostic or outer sandbox restriction. — not proved: real Codex 0.171.0 is installed, but the documented baseline CLI 0.169.0 is not, and installing it means a download from an external source (not allowed unattended); clearance in a trusted project and
- 1.6 In a disposable Claude linked worktree, compare the explicit-entry advisory with the session's sandbox configuration and run a sandboxed local Git write, recording whether the host grants access automatically and whether the applicable settings fix clears the advisory. — not proved: needs a Claude linked-worktree session with sandbox settings enabled; this unattended step runs unsandboxed, so the host grant behaviour and the sandboxed local Git write cannot be observed. No test o
