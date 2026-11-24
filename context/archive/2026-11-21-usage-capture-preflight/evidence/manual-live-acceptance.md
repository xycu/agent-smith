# Live acceptance (rows 2.4 and 2.5)

Recorded 2026-11-24. Claude Code 2.1.323, plugin `agent-smith` 1.16.2 from the installed plugin (directory marketplace, so the checkout of `main` at `af3f3df5`). Scratch projects outside the repository with `isolation.require` false. Transcripts stayed in the session scratchpad and are not committed.

## Row 2.4: ordinary session, then launcher session

- Ordinary session (`claude -p`, haiku, `/agent-smith:10x-pipeline qa ...`): `init` printed `Warning: Usage capture preflight. Native Claude token capture is off in this session. Start a fresh Claude session with the capture launcher.` before the first action JSON, then returned `action: "run"` with step 1 `plan`. Cost $0.027.
- Launcher session (`claude-capture.mjs` from a fresh project, interactive, run by the owner): `init` printed no capture warning. After step 1 `plan`, `status qb` showed `usageCoverage.verified: 1` and 318,605 tokens for the step. The owner confirmed the quiet start and stopped the run after step 1.

## Row 2.5: PR comment shows the missing-capture explanation

- Scratch run `qc` started with `--pr-comment true` and capture off. Step 1 `plan` ran for real (cost $0.86), then `status qc --report` wrote `report.md`.
- The report carries `Token capture limitations: Native Claude token capture was off (1 step)` and `Step 1 plan: capture-disabled — Claude token capture is off. Run node <absolute-plugin-scripts>/claude-capture.mjs to enable it for a fresh session.`
- `pr-comment.mjs qc --pr https://github.com/xycu/agent-smith/pull/282` created the comment on the open throwaway draft PR 282. Every line containing `capture` is identical in the report and in the posted comment (checked with `diff`). The PR was closed unmerged afterwards; its branch `chore/qa-capture-comment-throwaway` was left in place.

## Caveats

- Row 2.5 ran `pr-comment.mjs` by hand with `--pr` after `status --report`, not through the skill's own end-of-run step, and with one executed step.
- The launcher run was interactive on one host version; the full host and mode matrix stays with S-20.
