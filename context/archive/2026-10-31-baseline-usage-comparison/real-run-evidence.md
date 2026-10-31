# Real-run evidence: baseline-usage-comparison

Human rows only. An unattended run must not edit the gate line below (plan, "Phase 2 gate").

## A1 alias (row 1.6)

Paste here: the model name the `sonnet` alias resolves to in a running Claude Code session.

Probe agent launched with model: sonnet, effort: high. Its answer: "MODEL: Sonnet 5.5, claude-sonnet-5-5". The alias resolves to Sonnet 5.5 (self-report of the subagent from its system prompt), 2026-10-31.

## Usage spike (row 1.7)

USAGE: present

Paste here: the raw `status <id>` line of a step that carries `usage`, and next to it the raw usage text of that step's Agent result (so the name mapping, for example `subagent_tokens` against `totalTokens`, is on record). Then replace the gate line above with the owner's answer, `present` or `absent`.

Gate answer: the owner was present in the session on 2026-10-31, asked for the gate rows to be cleared by a live probe run by the orchestrator ("You run the probe", "Continue with phase 2") and gave the answer `present` through that direction. The implementing agent set the line above only as directed; no unattended self-answer.

Raw status entry of a step that carries usage. It comes from a scratch run of the real router (`init`, then `next` with a `last-result.json` carrying the usage, then `status`):

```
{ "n": 1, "step": "plan", "model": "sonnet", "effort": "medium", "simple": true, "ok": true, "verified": true, "note": null, "reason": "no plan yet (goal: short)", "usage": { "totalTokens": 49828, "toolUses": 1, "durationMs": 3863 } }
```

Raw usage text of that probe step's Agent result, as the harness delivered it in the task notification:

```
<usage><subagent_tokens>49828</subagent_tokens><tool_uses>1</tool_uses><duration_ms>3863</duration_ms></usage>
```

Name mapping: `subagent_tokens` -> `totalTokens`, `tool_uses` -> `toolUses`, `duration_ms` -> `durationMs`. A second probe gave `subagent_tokens` 49775, `tool_uses` 1, `duration_ms` 3807.

Limit, accepted by the owner: in this harness every `Agent` call returned "Async agent launched" even with `run_in_background: false`, so the usage arrived in the completion notification, not in a foreground tool result. What is supported: figures exist in background completion notices. What is not: the foreground orchestrator path of SKILL.md Loop step 2 (`run_in_background: false`) is unverified; it could not be observed here. Read `USAGE: present` above in that narrower sense. Plan Progress row 1.8 (Manual, unticked) re-checks usage in a real interactive foreground pipeline run.

### advisory (nested subagent, background call, not the orchestrator path)

Optional. Paste the raw notice of one bare `Agent` probe here. It never changes the gate line.

## Real pair (row 3.7)

Paste here: the Markdown output of `compare <id> --baseline <worktree> --format md` for one real routed run and one real baseline run.
