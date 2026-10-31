# Real-run evidence: baseline-usage-comparison

Human rows only. An unattended run must not edit the gate line below (plan, "Phase 2 gate").

## A1 alias (row 1.6)

Paste here: the model name the `sonnet` alias resolves to in a running Claude Code session.

## Usage spike (row 1.7)

USAGE: pending

Paste here: the raw `status <id>` line of a step that carries `usage`, and next to it the raw usage text of that step's Agent result (so the name mapping, for example `subagent_tokens` against `totalTokens`, is on record). Then replace the gate line above with the owner's answer, `present` or `absent`.

### advisory (nested subagent, background call, not the orchestrator path)

Optional. Paste the raw notice of one bare `Agent` probe here. It never changes the gate line.

## Real pair (row 3.7)

Paste here: the Markdown output of `compare <id> --baseline <worktree> --format md` for one real routed run and one real baseline run.
