---
change_id: claude-capture-async-agent-launch
title: Claude capture fails on Claude Code 2.1.323 because Agent launches asynchronously
status: implemented
created: 2026-11-22
updated: 2026-11-22
archived_at: null
---

## Notes

Claude Code 2.1.323 launches the Agent tool asynchronously by default, so native capture ends incomplete-capture on every step. Evidence from the live probe run (claude-token-figures-default rows 2.4/2.5): the orchestrator's six Agent calls carried no run_in_background key (it followed SKILL.md line 63, which says to omit it when the schema does not declare it), yet each tool_result was "Async agent launched successfully" with toolUseResult {isAsync: true, status: "async_launched"}; the console showed each step as "Backgrounded agent". The PostToolUse hook therefore records the launch, not the settled result: claude-capture-data.mjs projectNative maps tool_response.status to "completed" or "other", and all six records were "other", so claude-usage.mjs addAgent fails at the post.response.status check (incomplete-capture); two SubagentStop records had last_assistant_message null so textHash is null. The late recheck also returned unsupported-schema (not yet investigated). Open questions: how to make the Agent call synchronous on 2.1.323 (a parameter, an agent-definition key, or an env/setting), or how the collector should reconcile an async launch with a later completion record; whether the capture version floor (2.1.311) needs a ceiling or a schema marker. Wire format reference: capture dir agent-smith-claude-capture-B6ZKwk (hooks.jsonl, otel.jsonl), probe project .claude/worktrees/live-capture-probe.
