---
date: 2026-11-24T19:32:59+0100
researcher: Claude (Opus 5.5) for Błażej Ksycki
git_commit: 735083a1d40bd981b8d21a423978f3b19d0afe60
branch: main
repository: agent-smith
topic: "Can native Claude token capture default to session transcripts instead of requiring the launcher (issue #289)?"
tags: [research, accounting, claude-usage, claude-capture, init-usage, usage-evidence]
status: complete
last_updated: 2026-11-24
last_updated_by: Claude (Opus 5.5)
last_updated_note: "Owner decision on Open Question 1: transcript-only figures get a new evidence status; consumers of status values mapped."
---

# Research: transcript-only default for native Claude token capture (issue #289)

**Date**: 2026-11-24T19:32:59+0100
**Researcher**: Claude (Opus 5.5) for Błażej Ksycki
**Git Commit**: 735083a1d40bd981b8d21a423978f3b19d0afe60
**Branch**: main
**Repository**: agent-smith

## Research Question

[xycu/agent-smith#289](https://github.com/xycu/agent-smith/issues/289): since 1.17.0 `init` halts in every ordinary Claude session unless that session was started with the capture launcher. Can a collector that reads only the session's on-disk transcripts measure each native Agent step without the launcher? What does the code require today, what would have to change, and which earlier decisions does it touch?

## Summary

- **The data exists in ordinary sessions.** In 828 inspected subagent metadata files from 18 agent-smith project folders, each step's transcript is `<projects>/<project>/<sessionId>/subagents/agent-<agentId>.jsonl`. It sits next to `agent-<agentId>.meta.json`, which carries `description`, `toolUseId`, `spawnDepth` and `finished`. Nested children (depth 2) sit flat in the same folder and name their parent in `parentAgentId`. Usage is identical on every record that shares a `message.id`, so the sum must count each `message.id` once. Details are under "Transcript evidence".
- **The router cannot accept such a figure today.** `normalizeAccounting` accepts verified Claude evidence only with `source: "claude-native"` and `reconciliation: "request-records"` (`skills/10x-pipeline/scripts/usage.mjs:71-72`). Without the launcher, the collector fails `capture-disabled` before reading anything (`skills/10x-pipeline/scripts/claude-usage.mjs:90-91`). `init` halts when `claudeCapture.require` is `true` and launcher readiness is `disabled` or `unusable` (`skills/10x-pipeline/scripts/init-usage.mjs:75-90`, called from `route.mjs:1131-1135`).
- **"Verified" promises more than a transcript can prove.** The documented contract requires native request usage and OTLP `api_request` membership and counters to "agree exactly", plus a contiguous process-qualified OTLP event prefix (`docs/REFERENCE.md:475`; also ADR-018 line 117). A transcript-only figure cannot meet that. Live 2.1.323 runs also showed side queries that reach telemetry but not the transcript (ADR-018 line 137), so a transcript sum can undercount. The plan has to decide how to label this figure: reuse `verified` with a new `reconciliation` value, or add a new evidence status. That is the main open decision.
- **No earlier change rejected a transcript-only collector by name.** The earlier research used transcript grouping by `message.id` as an independent cross-check (`context/archive/2026-11-18-delegated-token-accounting/research.md:47`). It called the transcript format "explicitly internal and version-dependent" (same file, line 45).

## Detailed Findings

### Transcript evidence (bounded sample)

Scope: 828 `agent-*.meta.json` files and 902 jsonl files (828 subagent transcripts, 74 main transcripts) in the 18 `~/.claude/projects` folders whose name contains `agent-smith`. That is 45,505 assistant records and 23,952 distinct `message.id` values. No other project folders were scanned.

- **Session location.** In this session, `CLAUDE_CODE_SESSION_ID` equals the folder name `~/.claude/projects/-Users-blazej-WebstormProjects-agent-smith/5b28b280-fd9f-4b0b-a891-9e4455558f91` (observed directly). No repository file references `CLAUDE_CODE_SESSION_ID` (repo-wide grep, excluding `context/`). The launcher derives the transcript root as `CLAUDE_CONFIG_DIR || ~/.claude`, then `projects` (`skills/10x-pipeline/scripts/claude-capture.mjs:143-148`).
- **meta.json.**
  - Present in all 828: `agentType`, `description`, `toolUseId`, `spawnDepth`, `requestShape`, `requestNonInteractive`.
  - `finished` is `true` in 818 and absent in 10. It was never `false`.
  - Every one of the 7 statable files without `finished` had records written after the meta file. One of them had `stoppedByUser`.
  - `spawnDepth` is 1 in 633 files and 2 in 195. No deeper value was seen.
- **Step identity.** `meta.description` equals the parent's Agent `tool_use.input.description` in all 816 cases where the parent call was found, and `meta.toolUseId` equals that `tool_use` id in the same 816. The router's descriptions have the form `agent-smith <change> step <n> <step>` (`claude-usage.mjs:34-43`). The meta file can therefore confirm both the step and the `runId` without hook records.
- **Nested children.**
  - All 195 depth-2 metas carry `parentAgentId`. Their parent's meta is in the same `subagents/` folder, and the parent's transcript holds a `tool_use` whose id equals the child's `toolUseId`.
  - Spot-checked: `-private-tmp-agent-smith-nested-capability-IIYJa7/4fa23129-…/subagents/agent-a245f6f833105dbce.meta.json` has `parentAgentId: "a4695b72d4579405b"`. Its `toolUseId` appears at lines 17 and 26 of `agent-a4695b72d4579405b.jsonl`.
  - The main transcript holds no record of the grandchild.
- **Deduplication.**
  - In 16,697 `message.id` values with several records, the usage on those records is byte-identical, so per-record summing overcounts.
  - No `message.id` had more than one `requestId`.
  - 18 `<synthetic>` records (API error placeholders) carry all-zero usage and sometimes no `requestId`.
- **Buckets.**
  - `cache_creation_input_tokens` is present in 45,505 of 45,505 assistant records, together with the `cache_creation` split.
  - `iterations[]` never had more than one entry, so its sum-versus-last behaviour is untested. The plan should use the top-level fields.
  - The four additive buckets match the collector's existing `transcriptBuckets` (`claude-usage.mjs:14`).
- **Completion.** Among `finished: true` metas, none had records more than 2 s after the meta mtime. Appending to a finished agent (for example resuming it through SendMessage) was not tested.
- **Foreground results.** A foreground Agent result's `toolUseResult.usage` covers only the last request (on one agent: input 2 / output 402, against 4 / 680 summed from the transcript). That matches the existing rule that `<subagent_tokens>` is final-request only (`skills/10x-pipeline/SKILL.md:97`).
- **Version.** `version` was constant within every subagent file. Values seen were 2.1.308 to 2.1.330. The current floor is 2.1.311 (`claude-capture-data.mjs:21`).

### Current collector and gate

- `collectClaudeUsage` (`claude-usage.mjs:75-396`) accepts two inputs only:
  - a launcher binding, found through `AGENT_SMITH_CLAUDE_CAPTURE` (`claude-capture-data.mjs:7`);
  - explicit `sources` plus process identity.
  Without the env var it fails `capture-disabled` at lines 90-91.
- `scopedTranscript` (`claude-usage.mjs:69-73`) already requires the exact layout `<root>/<project>/<sessionId>/subagents/agent-<agentId>.jsonl` under a canonical root. Today the file path comes from the hook's `SubagentStop` record (`claude-capture-data.mjs:164`).
- Source reads go through `readBoundedLines` / `readStableFile` (`usage.mjs:123-187`). These require canonical roots, use `O_NOFOLLOW | O_NONBLOCK`, re-check stability and enforce byte and deadline budgets. They reject a file without a trailing newline (`usage.mjs:185`). A `meta.json` file therefore needs a different bounded read.
- `claudeCaptureReadiness` (`claude-capture-data.mjs:102-114`) returns `disabled`, `unusable` or `ready`, based only on the launcher binding.
- In `claudeCaptureStop` (`init-usage.mjs:75-90`), the halt applies only when all of these hold:
  - `require === true`;
  - the host is `claude`;
  - `AGENT_SMITH_CLAUDE_SESSION` is not set;
  - Claude is an assigned provider;
  - readiness is `disabled` or `unusable`.
- The policy check at `state.mjs:268-271` validates only `claudeCapture` (an object) and `require` (a boolean). `claudeCapture` appears only in `skills/10x-pipeline/policy.json:118`.

### Evidence consumers a new mode touches

- `usage.mjs:8` lists `SOURCES`. `usage.mjs:10` gives the `capture-disabled` explanation, which names the launcher. `usage.mjs:71-72` is the reconciliation gate.
- `route.mjs:859-929` is the late `usage` command. It requires `status === "verified"` (line 860), and the recorded and new source, host version and invocation must match (lines 888-891).
- `route.mjs:546`, `780` and `709` cover compare and status rows and the unavailable lines.
- `flow.mjs:109` maps `USAGE_SOURCE_NAMES`. `flow.mjs:112-137` (`usageLimitations`) labels `capture-disabled` as "Native Claude token capture was off".
- SKILL.md text that assumes the launcher, in both skills:
  - checkpoint before dispatch: 10x `SKILL.md:68`, openspec `SKILL.md:74`;
  - archive checkpoint: 10x `:122`, openspec `:127`;
  - descriptor: 10x `:97`, openspec `:103`;
  - late recheck: "either its original launcher binding or authorized explicit sources", 10x `:151-153`, openspec `:156-158`.
- Tests that assert today's behaviour:
  - `test/init-usage.test.mjs:348`, `:367`, `:379`, `:392`: the halt and its exemptions;
  - `test/claude-usage.test.mjs:407-411`: `capture-disabled`;
  - `test/accounting-readers.test.mjs` around `:297-337`: the report label;
  - `test/compare.test.mjs:185`;
  - `test/usage-evidence.test.mjs:40-42`, `:62`: reconciliation cases;
  - `test/skill-loop.test.mjs:645-649`: checkpoint wording;
  - `test/policy-validate.test.mjs:48-49`, `:247`.
- Test helpers turn the gate off unless a test opts in: `test/helpers.mjs:88-98` and `test/prepare-run-helpers.mjs:67` merge `claudeCapture.require: false`. The Claude fixtures are in `test/claude-helpers.mjs:22` (`claudeUsageFixture`) and `:111` (`boundClaudeFixture`).
- Documentation:
  - `docs/REFERENCE.md:26`, `:68`, `:473-509`, `:644`;
  - `README.md:164-166`;
  - ADR-018 Amendments 5-8 (lines 117-141) and ADR-019 line 96.

## Code References

- `skills/10x-pipeline/scripts/claude-usage.mjs:14` - transcript bucket names (the same four fields seen in live records)
- `skills/10x-pipeline/scripts/claude-usage.mjs:34-43` - `routerDescription`, the description a step's meta must equal
- `skills/10x-pipeline/scripts/claude-usage.mjs:69-73` - `scopedTranscript` layout check
- `skills/10x-pipeline/scripts/claude-usage.mjs:90-91` - `capture-disabled` without the launcher
- `skills/10x-pipeline/scripts/claude-usage.mjs:390` - verified output `reconciliation: "request-records"`
- `skills/10x-pipeline/scripts/usage.mjs:71-72` - reconciliation gate for verified evidence
- `skills/10x-pipeline/scripts/usage.mjs:123-187` - stable bounded reads
- `skills/10x-pipeline/scripts/claude-capture-data.mjs:102-114` - launcher readiness
- `skills/10x-pipeline/scripts/init-usage.mjs:75-90` - `claudeCaptureStop`
- `skills/10x-pipeline/scripts/state.mjs:268-271` - `claudeCapture` policy check
- `skills/10x-pipeline/scripts/claude-capture.mjs:143-148` - transcript root from `CLAUDE_CONFIG_DIR`
- `skills/10x-pipeline/scripts/route.mjs:859-929` - late usage needs `verified`
- `skills/10x-pipeline/scripts/flow.mjs:109-137` - report labels

## Architecture Insights

- Mode selection can stay out of the collector:
  - A launcher binding present means telemetry evidence. No binding means transcripts.
  - Only `init` needs the policy, to decide whether a missing launcher halts.
  - This keeps policy reads in the router, as `AGENTS.md` requires.
- Proof of identity and completion maps onto existing reasons without hooks:
  - `description` and `toolUseId` give `missing-identity`.
  - `finished` gives `incomplete-capture`.
  - Identical repeated usage per `message.id` gives `conflicting-duplicate`.
  - The read limits give `unsafe-path` and `resource-limit`.
- Two lessons apply:
  - The `lessons.md` rule "Open a lock-free read target by descriptor" applies to reading `meta.json` and transcripts that Claude writes concurrently. `readStableFile` already follows it.
  - The rule "Grep every doc for the old behavior" applies to the `capture-disabled` explanation and the halt text, which are repeated in REFERENCE, README and both SKILL.md files.

## Historical Context (from prior changes)

- `context/archive/2026-11-18-delegated-token-accounting/research.md:45-47`:
  - Supported: the transcript format is internal and version-dependent.
  - Supported: transcript grouping by `message.id` reconciled with `modelUsage` in a 2.1.311 probe.
- `context/archive/2026-11-18-delegated-token-accounting/plan.md:175`: "Merely summing equal totals is insufficient when request membership is not proved". Still current. It is the reason the transcript-only figure needs its own label.
- `context/archive/2026-11-19-claude-token-figures-default/plan.md:17`: "transcripts can lag the hook". Partial: among `finished: true` metas, no record came more than 2 s after the meta, so gating on `finished` covers the observed lag.
- ADR-018 Amendment 7 (line 137, 2026-11-22): side queries reach telemetry without a transcript entry. Still current, and it is the undercount the issue accepts.
- ADR-018 Amendment 8 (line 141) and `docs/REFERENCE.md:499`: the default-on halt. `REFERENCE.md:499` calls it "a breaking default"; ADR-018 line 141 does not.
- `context/changes/claude-capture-default-on/evidence/judgment-halt-text-and-docs.md:16` chose `feat!`, but commit `cae3bf6f` shipped as plain `feat`, and `CHANGELOG.md` lists 1.17.0 under Features.
- `context/changes/claude-capture-default-on/plan.md:269`: Manual row 1.7 (plain `claude` init halts, then the launcher session resumes with figures) is open. This change would supersede it. That change's status is `impl_reviewed`, not archived.

## Related Research

- `context/archive/2026-11-18-delegated-token-accounting/research.md`
- `context/changes/claude-capture-default-on/research.md`

## Follow-up 2026-11-24: evidence status decision

**Decision (owner, 2026-11-24).** Transcript-only figures get a new `usageEvidence.status`. They do not reuse `verified`. `verified` keeps its documented meaning: native records and OTLP agree exactly (`docs/REFERENCE.md:475`). This resolves Open Question 1. The plan chooses the status name and its field set.

**Code that reads evidence status values** (repo-wide grep in `skills/*/scripts`, `docs/REFERENCE.md` and `agents/`; the step-result `verified` flag at `flow.mjs:689`, `:754`, `:824` and `isolation.mjs:700` means something else and is excluded):

- `usage.mjs:66-83`: `normalizeAccounting` builds verified evidence and turns every other status into `unavailable` with `invalid-evidence`. Unless this gate learns the new status, transcript figures would be discarded.
- `usage.mjs:91`: `accountingFor` sets `tokenScope` from the status.
- `usage.mjs:94-100`: `usageCoverage` holds the fixed keys `{ verified, unavailable, legacy, missing }` and increments `coverage[tokenScope]`. A new status needs its own key.
- `route.mjs:860`: the late `usage` command accepts only `verified`. The plan decides whether a late transcript figure is accepted.
- `route.mjs:517`, `:814`, `:639`, `:705`, `:710`: compare and status apply the cost-scope note and the coverage row "verified / unavailable / legacy / missing" only when the verified count is above 0.
- `flow.mjs:179-185`: the terminal report's coverage line and cost-line flag key off `coverage.verified`.
- `docs/REFERENCE.md:466`: documents `usageCoverage: { verified, unavailable, legacy, missing }`.

Tests that pin these shapes are listed under "Evidence consumers a new mode touches". The coverage row text is also asserted in `test/compare.test.mjs` and `test/accounting-readers.test.mjs` (not re-inspected line by line in this follow-up).

## Open Questions

1. **Evidence label: resolved 2026-11-24, new status (see Follow-up).** Original question: Should transcript figures be:
   - `status: "verified"` with a new `reconciliation` value (for example `"transcript"`), which the late `usage` command, compare and cost then accept unchanged; or
   - a new status, which keeps "verified" meaning the telemetry proof but needs every consumer (`route.mjs:860`, `usageCoverage`, reports) to learn it?

   This choice also decides how ADR-018's "agree exactly" wording is amended.
2. **Policy surface.** Should there be a `claudeCapture.mode: "transcript" | "telemetry"` key, as the issue proposes? Alternatively, the launcher could simply be used when present, with `require` keeping its meaning of "a usable source must be available".
3. **Readiness check for `init`.** What should mark transcripts as ready? One candidate: `CLAUDE_CODE_SESSION_ID` is set and exactly one `<projects>/*/<sessionId>.jsonl` exists. This is untested on Claude Code builds before 2.1.323 and on a Codex host.
4. **Unfinished agents.** Should a missing `finished` be treated as `incomplete-capture`? The sample never showed `finished: false`; the key was absent instead.
5. **Release type.** A fix that removes the halt is a `fix` or `feat`, not a breaking change. The 1.17.0 `feat!` decision was not applied (see Historical Context). That is an owner decision.
6. **Untested.** Agents resumed through SendMessage, `iterations[]` with more than one entry, and nesting deeper than depth 2.
