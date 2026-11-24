# Run report: claude-capture-default-on

Token capture limitations: Native Claude token capture was off (7 steps)

Goal: Make missing Claude token capture a halt at init, not a stderr warning. Follow context/changes/claude-capture-default-on/frame.md and research.md: add a policy block modelled on isolation.require (default on, opt-out in context/foundation/agent-smith-policy.json, validated at load), check it next to isolationCheck in route.mjs before anything is written, and halt only on a native Claude host whose claudeCaptureReadiness is not ready, naming the launcher command and how to resume. Never halt for Claude steps on a Codex host, a headless child, or a neutral replay of a non-Claude step. Leave Codex as a warning. Inject the opt-out in the test helpers, add init tests for both states, and update docs/REFERENCE.md, the README coverage paragraph and ADR-018/019 amendments. Drop version-range work: claudeCaptureSupported is already a floor.
Rigor: thorough (hot paths skills/10x-pipeline/policy.json, skills/10x-pipeline/scripts/route.mjs, skills/10x-pipeline/scripts/state.mjs)
Provider mode: claude
Outcome: done - impl review APPROVED

| # | Step | Provider | Model | Effort | Tier | Simple | Result | Tokens |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | score | claude | haiku | low | 0 | no | ok (481baf2) | - |
| 2 | plan | claude | sonnet | high | 3 | no | ok (a911194) | - |
| 3 | plan-review | claude | sonnet | high | 3 | no | ok (5622fa9) | - |
| 4 | implement | claude | sonnet | high | 3 | no | ok (49121b0) | - |
| 5 | manual-verify | claude | sonnet | medium | 2 | no | ok (161bf99) | - |
| 6 | manual-verify | claude | sonnet | high | 3 | no | ok (bf885a0) | - |
| 7 | impl-review | claude | sonnet | high | 3 | no | ok (74a8443) | - |

Steps: 7 · Tokens: - (figures for 0 of 7 steps)

## Token coverage

Verified observed host usage: 0 · Unavailable: 7 · Legacy/unverified scope: 0 · Missing figures: 7
Provider, model and tier groups describe the enclosing dispatch.
- Step 1 score: capture-disabled — Claude token capture is off. Run `node <absolute-plugin-scripts>/claude-capture.mjs` to enable it for a fresh session.
- Step 2 plan: capture-disabled — Claude token capture is off. Run `node <absolute-plugin-scripts>/claude-capture.mjs` to enable it for a fresh session.
- Step 3 plan-review: capture-disabled — Claude token capture is off. Run `node <absolute-plugin-scripts>/claude-capture.mjs` to enable it for a fresh session.
- Step 4 implement: capture-disabled — Claude token capture is off. Run `node <absolute-plugin-scripts>/claude-capture.mjs` to enable it for a fresh session.
- Step 5 manual-verify: capture-disabled — Claude token capture is off. Run `node <absolute-plugin-scripts>/claude-capture.mjs` to enable it for a fresh session.
- Step 6 manual-verify: capture-disabled — Claude token capture is off. Run `node <absolute-plugin-scripts>/claude-capture.mjs` to enable it for a fresh session.
- Step 7 impl-review: capture-disabled — Claude token capture is off. Run `node <absolute-plugin-scripts>/claude-capture.mjs` to enable it for a fresh session.

## Review findings

Counts as recorded when each review step ended; later edits of a review file are not reflected.

- step 3 plan-review: REVISE, 0 critical, 2 warnings measured; 0 critical, 0 warnings open
- step 7 impl-review: APPROVED, 0 critical, 0 warnings measured

## Manual checks

Rows as recorded when the last manual-verify step ended. The kind comes from the evidence file name; the router never reads the content. Only browser, test, command or script evidence proves a browser row.

Proved: 3

- 1.8 The halt text reads clearly in the orchestrator output — judgment (evidence/judgment-halt-text-and-docs.md)
- 2.5 The owner confirms the README paragraph and ADR-018 and ADR-019 amendments state the 2026-11-24 decision — judgment (evidence/judgment-halt-text-and-docs.md)
- 2.6 The owner decides the release type when the run PR title is derived — judgment (evidence/judgment-halt-text-and-docs.md)

Not proved: 1

- 1.7 From plain claude, init halts with a pasteable launcher command, and the launcher session resumes the run with figures — not proved: needs a live plain claude session, then a launcher session in a real terminal that resumes the run and records figures; not reachable unattended (halt text is covered by test and evidence for row 1.8)

## Complexity score

Scores: cognitive 4, execution 4 (ambiguity 1, novelty 1, coupling 2, discovery 1, volume 2, verification 1)
Confidence: medium · Unknowns: 3
Source: score step 1

No tier shift.
