# Frame Brief: Claude native capture ends incomplete-capture in interactive sessions

> Framing step before /10x-plan. This document captures what is *actually*
> at issue, separated from what was initially assumed.

## Reported Observation

On Claude Code 2.1.323, a live native Claude-hosted pipeline run through `claude-capture.mjs` (probe `live-capture-probe`) ended every one of its six steps with `incomplete-capture`. The orchestrator's six Agent calls carried no `run_in_background` key. Each Agent tool result read "Async agent launched successfully" (`isAsync: true`, `status: "async_launched"`). All six PostToolUse records were projected with status `"other"`. Two SubagentStop records had a null `textHash`.

## Initial Framing (preserved)

- **User's stated cause or approach**: Claude Code 2.1.323 launches the Agent tool asynchronously by default, so the PostToolUse hook records the launch, not the result.
- **User's proposed direction**: Make the Agent call synchronous, or reconcile the launch with a later completion record in the collector. Consider a version ceiling or schema marker.
- **Pre-dispatch narrowing**: Leading symptom is "both as one problem": the capture sees only the launch of each step, not its finish. Scope: only Claude 2.1.323+. What the orchestrator waited for after each launch: "not sure".

## Dimension Map

The observation could originate at any of these dimensions:

1. **Host version change** — 2.1.323 made Agent asynchronous where 2.1.311 was synchronous. ← initial framing
2. **Our dispatch** — SKILL.md, `agents/step.md` or the Agent call parameters cause the background launch.
3. **Collector contract** — `claude-usage.mjs` and `projectNative` treat the PostToolUse `tool_response` as the settled result; interactive Agent calls never deliver that there.
4. **Fixture provenance** — the 2.1.311 "reviewed capture" the floor rests on was never a live interactive capture.
5. **Orchestrator result delivery** — step results and usage reach the orchestrator through notifications, not the tool result.

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| 1. 2.1.323 changed Agent to async | `context/archive/2026-11-12-agent-call-parameters/change.md:18`: on 2.1.311 the Agent tool already "states that subagents run in the background and notify on completion". `context/archive/2026-11-02-orchestrator-anti-stall/change.md:12`: anti-stall rule 1 (2026-11-02) already handles "launch notice instead of a final report". `docs/REFERENCE.md:594-603` documents the launch-notice path. | NONE (async is old, not new in 2.1.323) |
| 2. Our dispatch causes it | The six Agent calls had keys `description, subagent_type, model, effort, prompt` only; no `run_in_background` (live transcript `c87039b5-…jsonl`). `agents/step.md` frontmatter has no background key. The 2.1.311 schema has no such parameter. | NONE |
| 3. Collector assumes a settled PostToolUse | `claude-capture-data.mjs:143-146` maps any status other than `completed` to `"other"`. `claude-usage.mjs:178` requires `post.response.status === "completed"`. `claude-usage.mjs:360` compares PostToolUse `totalTokens` with `subagent_completed`. Fixtures (`test/claude-helpers.mjs:61`) always emit `status: "completed"` with `totalTokens`. | STRONG |
| 4. Fixtures were never live | `context/archive/2026-11-18-delegated-token-accounting/evidence/accounting.md:7`: positive fixtures are "hand-authored … documented Claude Code 2.1.311 … shapes. They are not captured telemetry". Row 4.3 (live interactive and headless qualification) was pending. README and `docs/REFERENCE.md` call the floor "headless evidence". | STRONG |
| 5. Completion data exists elsewhere | `hooks.jsonl` has a SubagentStop for all six agents. `otel.jsonl` has six `claude_code.subagent_completed` events with `total_tokens` (74417, 93810, 83445, 81651, 73524, 85018). The task-notification for agent 1 reports `subagent_tokens` 74417, equal to the telemetry figure. | STRONG (data is present) |

## Narrowing Signals

Step 3 evidence is conclusive, so Step 4 questioning was skipped; hypothesis 3 and 4 have strong evidence and 1 and 2 have none.

- Pre-dispatch answers: leading symptom is one problem (launch seen, finish not); scope was stated as 2.1.323 only, which the evidence now contradicts.
- The first two SubagentStop records have no `last_assistant_message`. The notification text says those reports were delivered through a `SubagentHandback` call. That is the likely cause of the null `textHash`, not verified.
- The projection drops the raw PostToolUse payload, so `async_launched` behind status `"other"` is inferred from the transcript's `toolUseResult`; the retained hook records confirm the launch-only shape (no `totalTokens`, status not `completed`) for all six steps.

## Cross-System Convention

This repo already treats the launch notice as the normal interactive path: anti-stall rule 1 ends the turn and continues when the report arrives. The router's own result channel (`last-result.json`) follows that. Accounting alone assumed a synchronous Agent result.

## Reframed (or Confirmed) Problem Statement

> **The actual problem to plan around is**: the Claude capture collector was built and tested against a hand-authored synchronous Agent shape, so it cannot settle any interactive launcher run, on 2.1.311 or later.

The version is not the cause. Interactive sessions have always launched Agent in the background, and the only fixtures behind the 2.1.311 floor were not captured from a live run. Everything the collector needs (SubagentStop identity, `subagent_completed` totals) is present in the 2.1.323 capture; only the PostToolUse-status requirement and the hand-authored fixtures stand in the way.

## Confidence

**HIGH** — strong repo evidence for the reframe. Verification done after the first draft: all six retained PostToolUse records carry `agentId` and a non-`completed` status and no `totalTokens` (`hooks.jsonl`, `response` objects), so the hook sees a launch, never a settled result. The exact status string is not retained (the projection folds it to `"other"`); the design does not depend on it.

## What Changes for /10x-plan

Plan the collector against the real interactive wire shape: settle each Agent run from SubagentStop plus `subagent_completed`, treat a launch-only PostToolUse as valid, and replace the hand-authored fixtures with sanitized live ones. Also correct the README and `docs/REFERENCE.md` claim of "headless evidence" and rethink the version floor, which currently rests on fixtures that were not captured. Whether a version ceiling is needed is no longer an open question: the cause is not version-specific.

## References

- Source files: `skills/10x-pipeline/scripts/claude-capture-data.mjs:143`, `skills/10x-pipeline/scripts/claude-usage.mjs:178`, `skills/10x-pipeline/scripts/claude-usage.mjs:360`, `skills/10x-pipeline/test/claude-helpers.mjs:61`
- Prior changes: `context/archive/2026-11-02-orchestrator-anti-stall/change.md`, `context/archive/2026-11-12-agent-call-parameters/change.md`, `context/archive/2026-11-18-delegated-token-accounting/evidence/accounting.md`
- Live evidence: capture dir `agent-smith-claude-capture-B6ZKwk` (removed when the captured session exits); transcript `c87039b5-2ae4-4274-b8c7-9e1789068d7d.jsonl` of the probe project
- Investigation tasks: none (evidence gathered by direct reads)
