---
change_id: claude-token-figures-default
title: Decide how Claude-hosted steps get token figures without operator capture
status: implementing
created: 2026-11-19
updated: 2026-11-22
archived_at: null
---

## Notes

**Origin.** Review of the past week's changes on 2026-11-19. Finding about `feat(delegated-token-accounting)` (PR #215, released in 1.14.0). This is a design question for the owner, not a confirmed bug: the behavior is documented. Frame it before planning.

**State since 1.14.0.** The orchestrator loop in `skills/10x-pipeline/SKILL.md` (Loop step 4, line 93) runs `node "$CLAUDE_USAGE"` for every Agent result and states that `<subagent_tokens>` is the final request only and must never be mapped to `totalTokens`. `skills/10x-pipeline/scripts/claude-usage.mjs` returns `verified` evidence only when all of these hold:

- the host version equals `CLAUDE_USAGE_VERSION = "2.1.311"` exactly (line 10, checked at line 90; any other version gives `unsupported-host`);
- the operator supplies a hook-capture JSONL file and an OTLP log under an authorized source root, plus the host process pid and creation time and the Agent `tool_use_id`.

The plugin installs no capture hook and enables no telemetry (`docs/REFERENCE.md:391`, `README.md:146`). So on a default install every Claude step records `usageEvidence.status: "unavailable"` and no `totalTokens`.

**What the user sees.**
- `status --report` and the run report show `-` for tokens on every Claude step and no cost.
- `compare` adds `usage-incomplete:<side>` (`skills/10x-pipeline/scripts/route.mjs:572`) and never reaches a verdict for a Claude-hosted run. Before 1.14.0 the same run produced figures and a verdict.
- The next Claude Code release after 2.1.311 turns even a fully configured capture into `unsupported-host`.

**Related gap.** No archived run since 2026-11-13 used Claude models; every later run was Codex-hosted or used OpenAI models. `README.md:142` says full pipeline qualification on Claude is pending. The new accounting loop, the step guard and nested delegation have not run end to end on Claude models.

**Questions for the frame.**
1. Is "no token figures for Claude by default" the intended product behavior, or a side effect of making the figure trustworthy?
2. If figures should exist by default, which source is acceptable: a clearly labelled lower-trust figure (the scope the router already calls `legacy`), a capture hook the plugin ships and the user opts into, or something else? A final-request footprint must still never be reported as a whole-step total.
3. Should `compare` give a verdict with a stated caveat when one side has only lower-trust figures, or keep refusing?
4. Should the version check accept a qualified range instead of one exact version, and who qualifies a new Claude Code release?

**Constraints.**
- Reports must keep the distinction between verified, unavailable and legacy figures; missing stays `-` and measured zero stays `0` (`skills/10x-pipeline/scripts/usage.mjs`).
- The plugin enables no telemetry without an explicit user choice.
- `SKILL.md` names no models, effort levels or tiers; accounting rules belong in `docs/REFERENCE.md`, and ADR-018 and ADR-019 record the current decision, so a change of direction amends them.
- Routing and accounting decisions stay in `route.mjs` and the modules it imports.

**Done when.**
- The owner has chosen an answer to questions 1 to 4, recorded in `frame.md`.
- If the answer changes behavior: the plan covers the loop text in both `SKILL.md` files, `claude-usage.mjs`, `compare`, `docs/REFERENCE.md`, the README coverage paragraph and an ADR amendment, with tests for each reader.
- If the answer is "keep as is": the report and `compare` output say in one line why the figure is missing and how to enable capture, and the README states the default plainly.
- A Manual row covers one full pipeline run on Claude models, which also closes the qualification that `README.md:142` lists as pending.
