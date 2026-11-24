---
change_id: claude-transcript-capture
title: Default Claude token capture to session transcripts instead of the launcher
status: implementing
created: 2026-11-24
updated: 2026-11-24
archived_at: null
---

## Notes

Default Claude token capture to session transcripts instead of requiring the launcher (GitHub issue #289)

Issue: https://github.com/xycu/agent-smith/issues/289

Since 1.17.0 (#288, `claudeCapture.require: true`) `init` halts in every ordinary Claude session unless it was started with the capture launcher. The issue proposes:

1. A transcript-only collector as the default for native Claude steps: find the child transcript by the Agent tool's returned `agentId` under `~/.claude/projects/<project>/<session>/subagents/agent-<agentId>.jsonl`, sum `message.usage` once per `message.id`, follow nested `agentId`s, keep the existing file-read limits.
2. Keep the launcher and OTLP cross-check as an optional stricter mode (`claudeCapture.mode: "transcript" | "telemetry"`).
3. `claudeCapture.require` accepts transcript readiness; halt only when the transcript directory is missing or unreadable.
4. Record the evidence source in `usageEvidence`.

Trade-off: no independent telemetry check; side queries outside transcripts undercount, never overcount.
