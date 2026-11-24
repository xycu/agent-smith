<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Native Claude Transcript Capture

- **Plan**: [Native Claude Transcript Capture Implementation Plan](../plan.md)
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-11-24
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 7 warnings, 1 observation

## Verdicts

| Dimension | Pre-fix verdict | Evidence |
| --- | --- | --- |
| Plan Adherence | WARNING | Phase 2 could attach totals with conflicting launch or membership evidence and could lose the identity needed for late attachment. |
| Scope Discipline | PASS | The implementation stayed within native Claude accounting, its consumers, tests and documentation. |
| Safety & Quality | WARNING | The collector could miss a directory change during collection and repeatedly scan one result row. |
| Architecture | PASS | The router owns policy, dispatch and intake. The collector reads the session and returns bounded evidence. |
| Pattern Consistency | PASS | Both chains use the same capture modes, collector, accounting schema and late attachment command. |
| Success Criteria | WARNING | All existing targeted tests passed. Six additional fixture cases exposed gaps in Phase 2. Both planned live checks remain open. |

## Findings

Locations below refer to the code at review start, commit `ad3b5532`.

### F1 — An old launch prompt could qualify a fresh total

- **Severity**: ⚠️ WARNING
- **Impact**: LOW — a local check on an existing timestamp.
- **Dimension**: Plan Adherence
- **Location**: `skills/10x-pipeline/scripts/claude-transcript.mjs:258`
- **Detail**: The reader checked each assistant timestamp but only compared the starting user record's prompt hash. A matching prompt from before the parent launch, or written after the first response, still qualified in both root and child transcripts.
- **Fix**: Check the starting user record against the parent launch, settled return and earliest assistant timestamp.
- **Decision**: APPLIED in `d29d9d2a`.

### F2 — An agent ID could belong to a different tool return

- **Severity**: ⚠️ WARNING
- **Impact**: LOW — both ownership keys are already available.
- **Dimension**: Plan Adherence
- **Location**: `skills/10x-pipeline/scripts/claude-transcript.mjs:181`
- **Detail**: When the matched return omitted its agent ID, the reader used metadata to identify the agent. It could then accept a different tool return that explicitly claimed the same ID. This affected roots and children.
- **Fix**: Compare every attributed agent's parent and tool-use ID with all observed return claims.
- **Decision**: APPLIED in `d29d9d2a`.

### F3 — Metadata could identify an uncounted grandchild

- **Severity**: ⚠️ WARNING
- **Impact**: LOW — the bounded scan already reads the parent IDs.
- **Dimension**: Plan Adherence
- **Location**: `skills/10x-pipeline/scripts/claude-transcript.mjs:219`
- **Detail**: Metadata naming an attributed child as a parent was discarded. If that child's launch record had yet to appear, the reader could return a two-agent total for a deeper tree.
- **Fix**: Retain parent IDs from the scan and reject a measured depth-two agent with a known descendant. Exclude unrelated branches from this check.
- **Decision**: APPLIED in `d29d9d2a`.

### F4 — Membership could change after the metadata scan

- **Severity**: ⚠️ WARNING
- **Impact**: LOW — the final stability check can cover the directory.
- **Dimension**: Safety & Quality
- **Location**: `skills/10x-pipeline/scripts/claude-transcript.mjs:308`
- **Detail**: The final pass rechecked the files already read. A second metadata file claiming the same launch could appear while the reader was reading agent messages. The original set of files would still pass.
- **Fix**: Carry the directory stat from the membership scan to the final stability check.
- **Decision**: APPLIED in `d29d9d2a`.

### F5 — Delayed main-transcript writes could prevent late attachment

- **Severity**: ⚠️ WARNING
- **Impact**: LOW — the host descriptor and existing late-usage contract supply the required identity.
- **Dimension**: Plan Adherence
- **Location**: `skills/10x-pipeline/scripts/claude-transcript.mjs:130`
- **Detail**: A fully observed invocation survived missing root metadata, but was dropped when the main source or launch had yet to appear. Missing final counters also aborted collection before a matching launch could establish identity. In either case the terminal recheck could become permanently ineligible.
- **Fix**: Preserve a qualified, fully observed identity on missing or incomplete evidence. Bind a matching launch before requiring final counters. Continue to refuse contradictory root identity.
- **Decision**: APPLIED in `d29d9d2a`.

### F6 — Conflicting launch parameters could pass as a repeated display

- **Severity**: ⚠️ WARNING
- **Impact**: LOW — reuse the existing duplicate check.
- **Dimension**: Plan Adherence
- **Location**: `skills/10x-pipeline/scripts/claude-transcript.mjs:176`
- **Detail**: Two displays with the same message ID, tool-use ID, description and prompt were accepted even when they requested different agent types.
- **Fix**: Include a digest of the complete launch input in duplicate reconciliation. Normalize object key order before hashing.
- **Decision**: APPLIED in `d29d9d2a`.

### F7 — A combined tool-result row could trigger repeated full scans

- **Severity**: ⚠️ WARNING
- **Impact**: LOW — compute one predicate per user row.
- **Dimension**: Safety & Quality
- **Location**: `skills/10x-pipeline/scripts/claude-transcript.mjs:189`
- **Detail**: For each matching tool result the parser filtered the same content array. Work could grow quadratically between deadline checks even though the reader bounded the row size.
- **Fix**: Count result blocks once per row and keep the refusal for ambiguous multi-result rows.
- **Decision**: APPLIED in `d29d9d2a`.

### F8 — The ADR status still pointed at the launcher default

- **Severity**: OBSERVATION
- **Impact**: LOW — update one status line.
- **Dimension**: Plan Adherence
- **Location**: `docs/ADR/ADR-018-no-nested-subagents.md:3`
- **Detail**: Amendment 9 documented the new default, while the status at the top identified Amendment 8 as current and linked readers to its launcher gate.
- **Fix**: Point the status summary to Amendment 9. Historical decisions remain available under their original headings.
- **Decision**: APPLIED in `d29d9d2a`.

## Verification

Reviewed the implementation range `728a42da..55904d3f` and the subsequent manual-verification evidence. The full-plan request includes Phase 3, whose three automated rows are complete. Overall Progress at review start was 9 of 11.

| Phase | Automated coverage |
| --- | --- |
| 1 | Evidence normalization, immutable reader projections, zero and missing figures, routing-rate cost estimates, transcript-only and mixed comparisons, and same-source late attachment. |
| 2 | Fresh flat, nested and archive invocations, duplicate messages, synthetic rows, session and tree membership, source stability, shared read limits, delayed evidence and existing telemetry reconciliation. |
| 3 | Both-chain readiness, validation and exemptions, pending and pre-change replay, native archive dispatch, external actions, skill-loop instructions, provenance and current documentation. |

On Node 24.19.0 the original 13 targeted files passed all 428 tests. Before the fixes, six of seven added fixtures failed. The seventh pinned the existing refusal of multi-result rows while the parser's repeated scan was removed.

After `d29d9d2a`, the same 13 files passed **435 tests**, with zero failures, skips or cancellations. The command combined the three plan gates and the OpenSpec skill-loop test. All fixtures ran locally in the worktree.

```sh
node --test --test-concurrency=2 \
  skills/10x-pipeline/test/{usage-evidence,accounting-readers,compare,cost,late-usage,claude-capture,claude-usage,init-usage,policy-validate,providers,skill-loop,provenance}.test.mjs \
  skills/openspec-pipeline/test/openspec-skill.test.mjs
```

Checked launcher-default and former coverage wording in the README, reference, both skills, tests and ADRs. Amendment 9 and the ADR index describe the shipped default. Earlier amendments retain the historical launcher behavior.

The read-only reviewers `/root/drift` and `/root/quality` checked plan adherence and safety respectively. Their findings were reconciled before the fixes. The host supplied no child-inclusive token count.

Manual rows 3.4 and 3.5 remain open. The ordinary-session probe established readiness, and the launcher fixtures exercised telemetry. Neither produced a live settled native Agent figure in status and the rendered report for this change. [Manual evidence](../evidence/unproven.md)
