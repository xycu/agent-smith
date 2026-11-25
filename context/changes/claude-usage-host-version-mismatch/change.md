---
change_id: claude-usage-host-version-mismatch
title: Claude token counts lost when the orchestrator passes a mismatched host version
status: implemented
created: 2026-11-24
updated: 2026-11-25
archived_at: null
---

## Notes

Observed in run `dev-test-scope-top-rule` (PR #294, 2026-11-24): all five native Claude steps (score, plan-review, two manual-verify, impl-review) were logged with no `totalTokens`. Each `usageEvidence` reads `status: unavailable`, `reason: unsupported-host`, `hostVersion: "unknown"`. When the same invocations were measured again without `hostVersion` in the descriptor, they returned `status: transcript` with `hostVersion: "2.1.330"`, totalling 3,874,071 tokens (202,797 / 1,696,909 / 200,011 / 411,516 / 1,362,838).

Cause: following Loop step 4 of `skills/10x-pipeline/SKILL.md` ("Pass … observed IDs/version"), the orchestrator put the output of `claude --version` (2.1.325, the CLI) into the `claude-usage.mjs` descriptor. The Claude Desktop host that writes the transcripts is 2.1.330.

Three defects:

1. **Skill wording invites the error.** SKILL.md Loop step 4 asks for an "observed" host version without saying where to read it. `claude --version` is the obvious source, and on Claude Desktop it is wrong. Fix the instruction: say where the version comes from, or tell the orchestrator to omit it.
2. **Collector fails closed with a misleading reason.** `measureClaudeTranscript` in `skills/10x-pipeline/scripts/claude-transcript.mjs` (lines 104–146) rejects the whole measurement when `descriptor.hostVersion` differs from the version in the transcript records. It reports `unsupported-host` even though both versions are above `CLAUDE_CAPTURE_MIN_VERSION` (2.1.311). Decide whether the records' version should win, with the mismatch kept in the evidence, or whether the refusal stays and gets an accurate reason such as a descriptor mismatch.
3. **The loss is permanent.** Once a step's evidence is logged as `unavailable` with `hostVersion: "unknown"`, the `usage` command refuses both paths. Structured usage must match the recorded invocation, source and hostVersion (`skills/10x-pipeline/scripts/route.mjs`, around line 893). Numeric flags apply only to steps without recorded evidence. A verified transcript total from the same invocation can never be attached. This touches ADR-019's rule that recorded evidence never changes. Decide whether an `unavailable` record with no invocation identity may be upgraded once by transcript evidence for the same step.

Fixes 1 and 2 prevent the problem. Fix 3 is a policy decision for the owner.
