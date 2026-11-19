<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Documentation status and evidence links implementation plan

- **Plan**: [plan.md](../plan.md)
- **Mode**: Deep
- **Date**: 2026-11-19
- **Verdict**: REVISE
- **Findings**: 0 critical, 4 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
| --- | --- |
| End-State Alignment | WARNING |
| Lean Execution | PASS |
| Architectural Fitness | WARNING |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

Reviewed `plan.md` as committed at `15ee07bc`. The brief agreed with its phases and scope and shared the omissions below. Verified 21 existing edit targets, all four archived evidence files and the absence of the proposed follow-up folder. The installed renderer reproduced the six broken links. The production plan reader found 58 open Manual rows across 35 of 92 archived 10x plans and zero open Automated rows. All seven Progress rows matched their phase criteria and categories. The Automated rows use local checks, including the existing fake-client fixtures.

## Findings

### F1 — Wave 1 handoff omits integration and recheck

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW. Quick decision with a narrowly scoped fix.
- **Dimension**: Plan Completeness
- **Location**: Scope boundaries and Migration Notes
- **Detail**: The plan uses WAVES v3 as evidence but omits its instruction to take in current `main` with a merge commit and merge this change last in Wave 1. Adjacent edits by `usage-file-docs-drift` and `open-pr-unfinished-merge-commit` can shift or overlap the reference hunks after the local link gate passes. [WAVES v3](../../WAVES.md#wave-1)
- **Fix**: Give the maintainer the final integration and rendered-link recheck on the integrated candidate. Keep the implementation gates local.
- **Decision**: APPLIED in Migration Notes and the brief’s Open Risks & Assumptions.

### F2 — The Rule in force inventory misses ADR-005

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW. Quick decision with a narrowly scoped fix.
- **Dimension**: End-State Alignment
- **Location**: Phase 2 and the ADR inventory gate
- **Detail**: ADR-005 qualifies under the plan’s amendment rule. The record amends the baseline ladder and adds cost output. ADR-009 adds provenance diagnostics and the observed accounting amendment changes comparison eligibility and rate interpretation. The hardcoded inventory lets the older comparison guidance pass without a current summary. The original Agent notice observation also needs its historical scope. [ADR-005](../../../../docs/ADR/ADR-005-baseline-usage-comparison.md) · [ADR-009](../../../../docs/ADR/ADR-009-managed-agent-patterns.md) · [ADR-018 accounting amendment](../../../../docs/ADR/ADR-018-no-nested-subagents.md#amendment-4--observed-step-tree-token-accounting)
- **Fix**: Add ADR-005 to the summary and inventory gate. Ground the current comparison boundary in the baseline policy and current accounting rules.
- **Decision**: APPLIED in Phase 2, Testing Strategy and the brief’s Phases at a Glance.

### F3 — Accounting status would still conflict across documents

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW. Quick decision with a narrowly scoped fix.
- **Dimension**: End-State Alignment
- **Location**: Phases 1–3, accounting references and README disposition
- **Detail**: Phase 1 repairs the evidence link in the reference but leaves the accounting activation gate in the future tense. Phase 3 describes the same candidate as shipped in v1.14.0. ADR-019’s original no-live-use claim also needs qualification. The `proper-structure-of-rules` late-usage commit and step 7's `usageLate` marker establish legacy attachment. The later structured path still has open live qualification. [Reference](../../../../docs/REFERENCE.md#accounting-activation-and-rollback) · [v1.14.0 changelog](../../../../CHANGELOG.md#1140-2026-11-18) · [Legacy attachment commit](https://github.com/xycu/agent-smith/commit/6f8a5a56) · [Accounting evidence](../../../archive/2026-11-18-delegated-token-accounting/evidence/accounting.md)
- **Fix**: Cite the release in the affected reference paragraph and qualify the historical ADR statements. Preserve the coherent-revision rollback guidance and open live rows 4.3 and 4.4.
- **Decision**: APPLIED in Phase 1’s accounting link instructions, Phase 2’s ADR dispositions and the brief’s Phases at a Glance.

### F4 — The local suite can inherit the live GitHub opt-in

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW. Quick decision with a narrowly scoped fix.
- **Dimension**: Blind Spots
- **Location**: Phase 3 and Testing Strategy
- **Detail**: The test command inherits `GH_LIVE`. A value of `1` runs two tests that shell out to real `gh` and require authentication and remote pull request state. The unattended step cannot make those calls. The regular suite includes the fake-client checks. [Live opt-in tests](../../../../skills/10x-pipeline/test/pr-comment.test.mjs) · [CI skip expectations](../../../../.github/workflows/ci.yml)
- **Fix**: Set `GH_LIVE=0` for the full local command. Record intentional skips and the OpenSpec 2.0.0 probe rules so the resulting coverage can be interpreted.
- **Decision**: APPLIED in Testing Strategy and the brief’s Success Criteria.

### F5 — The whitespace check can miss committed and new files

- **Severity**: 🔎 OBSERVATION
- **Impact**: 🏃 LOW. Quick decision with a narrowly scoped fix.
- **Dimension**: Plan Completeness
- **Location**: Phase 3 criterion 3.3 and Testing Strategy
- **Detail**: Plain `git diff --check` sees unstaged tracked edits. The plan expects separate documentation commits, and the new archive-decision seed could be untracked when the final check runs. A clean exit can therefore miss whitespace defects in part of the deliverable. [Plan brief](../plan-brief.md#phases-at-a-glance)
- **Fix**: Check the scoped staged files and the cumulative committed diff from the recorded implementation base in addition to the working diff.
- **Decision**: APPLIED in Testing Strategy and the brief’s Success Criteria.

### F6 — Existing tests pin other edited passages

- **Severity**: 🔎 OBSERVATION
- **Impact**: 🏃 LOW. Quick decision with a narrowly scoped fix.
- **Dimension**: Architectural Fitness
- **Location**: Phase 2 ADR updates and the Phase 3 README depth note
- **Detail**: The plan names the ADR-018 test constraint. Existing tests also pin the ADR-009 historical P0 and A/B wording, ADR-003’s historical PR-comment rules and parts of the README depth subsection. Updating those phrases in place could break the documented docs-only scope. [Advisor assertions](../../../../skills/10x-pipeline/test/advisor.test.mjs) · [PR-comment assertions](../../../../skills/10x-pipeline/test/pr-comment.test.mjs) · [Depth assertions](../../../../skills/10x-pipeline/test/nested-subagents.test.mjs)
- **Fix**: Name the pinned passages and add the evidence or trackers alongside them.
- **Decision**: APPLIED in the Phase 2 index and history contract and Phase 3’s README depth disposition.

### F7 — The archive follow-up needs a chain-specific boundary

- **Severity**: 🔎 OBSERVATION
- **Impact**: 🏃 LOW. Quick decision with a narrowly scoped fix.
- **Dimension**: Architectural Fitness
- **Location**: Phase 3 archive decision and follow-up seed
- **Detail**: The draft refers to both archive gates, a move and stamp, and both closeout examples without spelling out the different contracts. The 10x router handles Automated rows and an optional Manual precheck. Its orchestrator can require affirmative approval across three unresolved-row lists. OpenSpec requires task completion, carries empty Manual lists and verifies the move without reading a status stamp. [ADR-014](../../../../docs/ADR/ADR-014-archive-manual-gate.md) · [Router isolation](../../../../skills/10x-pipeline/scripts/isolation.mjs) · [Archive verification](../../../../skills/10x-pipeline/scripts/route.mjs) · [OpenSpec decision flow](../../../../skills/openspec-pipeline/scripts/openspec.mjs)
- **Fix**: Scope durable affirmative exceptions to the existing 10x Manual gate. Keep the S-13 decision as precedent for recording a deferral outside task completion.
- **Decision**: APPLIED in the Phase 3 archive contract and seed instructions and the brief’s Key Decisions Made.
