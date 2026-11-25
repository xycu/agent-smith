# Claude Desktop transcript usage capture implementation plan

## Overview

In run `dev-test-scope-top-rule` (PR #294, 2026-11-24), all five native Claude steps (1 score, 3 plan-review, 5 and 6 manual-verify, 7 impl-review) were logged with `usageEvidence` `{source: claude-transcript, status: unavailable, reason: unsupported-host, hostVersion: "unknown"}`, no `invocation` and no `totalTokens`. Measured again without `hostVersion` in the descriptor, the same invocations returned transcript totals (3,874,071 tokens, records at version 2.1.330). The router's `usage` command then refused to attach them.

Transcript-mode capture trusts a host version that the orchestrator cannot observe, over the versions it reads from the transcript records, and when that guess is wrong the failure evidence drops the invocation identity that late recovery needs. [Frame brief](frame.md)

## Current State Analysis

| Hypothesis from the frame | Finding |
| --- | --- |
| Skill wording invites the wrong version | Both loops say to pass observed IDs and version. The incident supplied CLI version 2.1.325 while Desktop wrote transcript records at 2.1.330. |
| The collector's check rejects qualified records | The descriptor seeds the version before scanning. The first mismatching record clears it and reports `unsupported-host` even though both versions satisfy the floor. |
| The failure loses the invocation | Root metadata identifies the invocation before the main scan, but the collector stores it after the scan. The fallback only handles certain errors when it has a version. |
| The orchestrator lacks a reliable version source | Readiness observes the session ID. The telemetry checkpoint returns session ID and offset. Neither exposes the version of the Desktop transcript writer. |

Remeasurement succeeded for all five invocations after omitting the descriptor version, with each record at 2.1.330. The frame's history survey found no earlier recorded Claude token figure. Earlier telemetry failures involved a separate capture path. The archived transcript change records that its live rows lacked live proof. [Frame investigation](frame.md#hypothesis-investigation) · [Research findings](research.md#detailed-findings)

### Key Discoveries

- `measureClaudeTranscript` is shared by both chains through `collectClaudeUsage`. The current-session and metadata checks already establish the root tool-use ID. [Collector](../../../skills/10x-pipeline/scripts/claude-transcript.mjs#L98) · [Wrapper](../../../skills/10x-pipeline/scripts/claude-usage.mjs#L61)
- Normalization keeps an exact invocation on unavailable evidence and regenerates the explanation from a fixed reason. Reports display that explanation in the affected step's coverage entry. [Usage normalization](../../../skills/10x-pipeline/scripts/usage.mjs#L56) · [Report rendering](../../../skills/10x-pipeline/scripts/flow.mjs#L187)
- Structured attachment already checks the recorded source, version and invocation plus the exact router step. [Late attachment implementation](../../../skills/10x-pipeline/scripts/route.mjs#L889) · [ADR-019](../../../docs/ADR/ADR-019-late-usage-figure.md#amendment-4--preserve-the-original-source-on-late-attachment)

## Desired End State

Qualified and consistent transcript records supply both the version and the token figure on Claude Desktop. Unavailable evidence keeps every established invocation and retains the record version when known and consistent. Exact matching evidence can fill missing tokens through `usage --usage-file`. A live native pipeline run demonstrates a recorded Claude token figure with retained evidence.

## Scope Boundaries

The change covers Claude transcript collection and its usage instructions. Retain the telemetry and headless capture contracts, the transcript attribution and file-safety checks, the existing schema and ADR-019's attachment and immutability guarantees. Historical ledgers and archived artifacts remain read-only. The top-of-report `Token capture limitations:` line in `flow.mjs` keeps its current labels, so a `version-conflict` appears only in the per-step Token coverage entry.

## Implementation Approach

**Planning assessment** Medium complexity, with one shared collector and a cross-chain late-attachment contract. The frame and research settle the behavior. Use two phases so the collector and CLI contract can be verified independently of the instruction edits and Desktop acceptance.

**Planning assumptions**

- Ignore the transcript descriptor's `hostVersion` for compatibility with callers that still send it. The checkpoint and readiness data lack a version that could qualify it. [Research](research.md#architecture-insights)
- Use the fixed `version-conflict` reason for disagreeing supported transcript versions. Use `unsupported-schema` for missing or malformed record versions, and reserve transcript `unsupported-host` for a well-formed version below 2.1.311. The per-step coverage renderer already surfaces the reason and explanation. [ADR-018 floor](../../../docs/ADR/ADR-018-no-nested-subagents.md#amendment-6--version-floor-for-claude-capture) · [Coverage rendering](../../../skills/10x-pipeline/scripts/flow.mjs#L187)
- Retain identity and version independently. A complete, validated observation for the active session can establish identity before source reads. With a partial observation, validated root metadata can supply the tool-use ID before the main scan. A root identity contradiction invalidates that identity. [Root metadata checks](../../../skills/10x-pipeline/scripts/claude-transcript.mjs#L138) · [Research](research.md#transcript-collector-control-flow-claude-transcriptmjs-claude-usagemjs)

## Phase 1: Correct transcript evidence and verify late attachment

### Overview

Separate version qualification from invocation attribution in the collector, then exercise ADR-019 with actual collector output.

### Changes Required:

#### 1. Transcript collector and wrapper

**Files** `skills/10x-pipeline/scripts/claude-transcript.mjs`, `skills/10x-pipeline/scripts/claude-usage.mjs`

**Intent** Use the version carried by the observed records and preserve root identity when reading or measuring the records fails.

**Contract** Validate the router, current native session and supplied IDs. Keep the complete observed root tuple `{ host: "claude", sessionId, agentId, runId }` once established. Use validated root metadata to complete a partial tuple before the main scan. A conflicting root metadata ID or mismatched root launch or return invalidates the tuple. Errors in child attribution or token accounting keep an established root tuple. Replace the wrapper's version-dependent identity fallback with the collector's validated identity. Partial or invalid identity stays absent.

Check versions on the same attributed main and agent records as today. Require a supported plain `x.y.z` release and exact agreement across those records. Preserve a qualified observed version on unrelated failures. Leave the normalized version `"unknown"` when no record has established it or a version error invalidates it. Validate each attributed record's version in scan order and let the first failing check decide the reason: malformed or missing is `unsupported-schema`, a well-formed version below the floor is `unsupported-host`, and only a supported version that differs from the one already established is `version-conflict`. Only counted, fully validated transcripts produce `totalTokens`. Preserve independent counters in the unavailable result.

#### 2. Normalized reason and explanation

**File** `skills/10x-pipeline/scripts/usage.mjs`

**Intent** Explain that the transcript records disagree on the host version.

**Contract** Register `version-conflict` with fixed text such as “The transcript records disagree on the host version.” Existing reason normalization and the report's per-step coverage entries use this text. Preserve the shared `unsupported-host` explanation for existing telemetry, Codex and historical entries.

#### 3. Collector and CLI regressions

**Files** `skills/10x-pipeline/test/claude-usage.test.mjs`, `skills/10x-pipeline/test/late-usage.test.mjs`, `skills/10x-pipeline/test/accounting-readers.test.mjs`

**Intent** Reproduce the Desktop mismatch and prove which evidence can attach late.

**Contract** Replace the descriptor mismatch expectation at `claude-usage.test.mjs:614` with successful measurement using the record version. Cover missing, conflicting and malformed descriptor versions, including a supplied version below the floor. Update the record conflict assertion near line 643. Assert distinct reasons, retained root identity and missing tokens for a below-floor, malformed or conflicting record version. Cover version failures in the main scan and an attributed child. Update the delayed metadata and main-source tests near lines 856–909 so complete observed identity survives early failures with version `"unknown"`, metadata can complete a partial identity, and contradictory root evidence keeps identity absent.

Beside `late-usage.test.mjs:663–668`, use `transcriptFixture` and `collectClaudeUsage` as the source of initial and completed evidence for both chains. Use a deterministic failure after identity and qualified version are established, such as a missing agent transcript after the main scan. Restore the fixture, attach using the exact match, and assert that counters, other entries and identical replay behave as before. Verify byte-identical refusals for a target without recorded identity even with the same version, and for a retained identity paired with version `"unknown"`. Preserve the missing-incoming-invocation refusal near line 735 and exact source, version and invocation mismatch coverage. Beside `accounting-readers.test.mjs:147–160`, add a `version-conflict` row that asserts the normalized explanation and the per-step Token coverage line, and assert that the top-of-report limitations line stays absent for it.

### Success Criteria:

#### Automated Verification:

- Collector fixtures prove transcript version authority, failure classification and identity retention: `node --test skills/10x-pipeline/test/claude-usage.test.mjs skills/10x-pipeline/test/usage-evidence.test.mjs skills/10x-pipeline/test/accounting-readers.test.mjs`
- CLI fixtures prove exact late attachment and byte-identical refusals on both chains: `node --test skills/10x-pipeline/test/late-usage.test.mjs`

## Phase 2: Align both chains and qualify Claude Desktop

### Overview

Describe the version source consistently at dispatch and recheck, then verify a live native run.

### Changes Required:

#### 1. Shared instructions and reference

**Files** `skills/10x-pipeline/SKILL.md`, `skills/openspec-pipeline/SKILL.md`, `docs/REFERENCE.md`

**Intent** Tell native orchestrators to omit the version from transcript descriptors, including in the late recheck. Explain when an unavailable measurement can attach late.

**Contract** Align the invocation recording bullet, Loop step 4 and late usage in both skills. The original recorded version remains part of matching the late measurement. Keep the telemetry descriptor and checkpoint instructions. In the reference's “Observed token accounting” and “Late usage figure” sections, identify records as the version source, describe the floor and record agreement, and explain that an exact invocation with an unknown version is insufficient for attachment. Add `version-conflict` to the reasons list at the end of “Observed token accounting”, and grep every doc for the old “forward the observed version” behavior, not only the files listed.

Preserve the pinned phrases and byte ceilings in `skill-loop.test.mjs` (32,401 bytes for 10x and 36,896 for OpenSpec), plus the Anti-stall section and routing-literal guards. A read-only wording probe fit both existing regexes at 32,378 and 36,874 bytes by removing the unconditional observed-version instruction from invocation recording, adding “omit version for transcript” to Loop step 4, and clarifying that the original version is for matching in the late section.

#### 2. Decision record

**File** `docs/ADR/ADR-019-late-usage-figure.md`

**Intent** Record the contract change where the late-attachment rules live, as earlier capture changes did.

**Contract** Add an amendment stating that transcript records, not the descriptor, supply the host version and that the descriptor version is ignored. State the reason split between `version-conflict`, `unsupported-schema` and `unsupported-host`, and that unavailable evidence keeps a validated root identity while a missing version stays `unknown` and blocks late attachment. Point to ADR-018 Amendment 6 for the floor without changing it. Touch the `docs/ADR/README.md` row only if its one-line summary no longer holds.

### Success Criteria:

#### Automated Verification:

- Both chain instructions pass the byte ceilings, pinned loop wording and shared guard checks: `node --test skills/10x-pipeline/test/skill-loop.test.mjs skills/openspec-pipeline/test/openspec-skill.test.mjs`

#### Manual Verification:

- A live native Claude Desktop pipeline run records Claude token figures and retains its evidence file under `evidence/`.

## Testing Strategy

### Unit Tests

Use the existing collector fixtures for attributed main and agent records, with the floor boundary at 2.1.311. Check complete, partial and contradictory identity, as well as the evidence reason, version and absence of tokens after failure.

### Integration Tests

Run the named files with Node 24+. Send fixture-produced evidence through the real `usage` CLI in scratch projects for both chains. Verify that every refused structured attachment leaves run artifacts byte-identical.

### Manual Testing Steps

1. From a fresh Claude Desktop session, load the changed plugin and run one native pipeline in a disposable project using transcript capture. Use a run that executes a numbered native Agent step. Follow the revised Loop step 4 and omit `hostVersion`. Record CLI and transcript version strings if both can be observed to document a Desktop/CLI mismatch.
2. Use read-only `status` or inspect the router-written log. Confirm a completed native Claude step has a positive `usage.totalTokens`, `usageEvidence.status: "transcript"`, `source: "claude-transcript"`, a qualified record version and the exact invocation. Check that transcript scope is visible in the run output.
3. Keep a sanitized proof file at `context/changes/claude-usage-host-version-mismatch/evidence/command-claude-desktop-transcript.md`. Include the date, tested revision, chain, run and step, version and bounded usage evidence with the recorded figure. Exclude raw transcript records, prompts and absolute source paths. Tick 2.2 only with live proof and append ` — evidence: evidence/command-claude-desktop-transcript.md`. Without a live host or a recorded token figure, leave the row pending and record the blocker in `evidence/unproven.md`.

## Performance Considerations

Use the existing bounded reads and single terminal recheck. Retaining the invocation and observed version adds only fixed-size evidence.

## Migration Notes

Existing readers keep the same evidence shape. Previous records lacking exact attribution remain ineligible for attachment under ADR-019. Rollback is a preserving follow-up commit.

## References

- [Frame brief](frame.md) · [Research](research.md)
- [Claude transcript capture contract](../../../docs/REFERENCE.md#observed-token-accounting) · [Late usage command](../../../docs/REFERENCE.md#late-usage-figure)
- [ADR-018](../../../docs/ADR/ADR-018-no-nested-subagents.md) · [ADR-019](../../../docs/ADR/ADR-019-late-usage-figure.md)

## Progress

> Append ` — <commit sha>` to completed Automated rows and ` — evidence: evidence/<name>` to completed Manual rows. Keep row titles stable.

### Phase 1: Correct transcript evidence and verify late attachment

#### Automated

- [x] 1.1 Collector fixtures prove transcript version authority, failure classification and identity retention: `node --test skills/10x-pipeline/test/claude-usage.test.mjs skills/10x-pipeline/test/usage-evidence.test.mjs skills/10x-pipeline/test/accounting-readers.test.mjs`
- [x] 1.2 CLI fixtures prove exact late attachment and byte-identical refusals on both chains: `node --test skills/10x-pipeline/test/late-usage.test.mjs`

### Phase 2: Align both chains and qualify Claude Desktop

#### Automated

- [ ] 2.1 Both chain instructions pass the byte ceilings, pinned loop wording and shared guard checks: `node --test skills/10x-pipeline/test/skill-loop.test.mjs skills/openspec-pipeline/test/openspec-skill.test.mjs`

#### Manual

- [ ] 2.2 A live native Claude Desktop pipeline run records Claude token figures and retains its evidence file under `evidence/`.
