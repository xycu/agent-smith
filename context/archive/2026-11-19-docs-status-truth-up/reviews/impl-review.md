<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Documentation status and evidence links

- **Plan**: [Documentation status and evidence links implementation plan](../plan.md)
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-11-19
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 3 observations

The verdict and counts describe the implementation at `a5b60346`. The review covered changes since `7e9738b7`, the last plan-review commit. All six findings were corrected in `12f1fef7`.

## Verdicts

| Dimension | Verdict |
| --- | --- |
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — The README overstates which Claude steps the Bash guard covers

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW. The correction is confined to the guard description.
- **Dimension**: Safety & Quality
- **Location**: `README.md:32`
- **Detail**: The README said all new Claude tasks use the guarded agent type. An enabled restricted mapping can select a different type for a normal step. The hook filters on agent identity, so an operator could assume protection that the mapped agent does not receive. [Dispatch and hook scope](../../../../docs/REFERENCE.md#step-safety-and-pre-publication-acceptance)
- **Fix**: Identify the normal default, the fixed Claude archive identity, and the controls that apply to other mapped agents.
- **Decision**: APPLIED in `12f1fef7`.

### F2 — ADR-009 presents configurable hash exclusions as unconditional

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW. The implementation already specifies the default and override behavior.
- **Dimension**: Plan Adherence
- **Location**: `docs/ADR/ADR-009-managed-agent-patterns.md:10`
- **Detail**: The summary said four policy sections are excluded from provenance hashes in every run. A project can supply its own string list, including an empty list. The router hashes each section that falls outside the effective list. [Provenance configuration and hashing](../../../../skills/10x-pipeline/scripts/isolation.mjs)
- **Fix**: Label the four sections as the shipped default of `provenance.ignore` and mention the project override.
- **Decision**: APPLIED in `12f1fef7`.

### F3 — The change record leaves two completed Manual checks open

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW. Both judgments and their completed Progress rows already exist.
- **Dimension**: Plan Adherence
- **Location**: `context/changes/docs-status-truth-up/change.md:70`
- **Detail**: The implementation summary said rows 2.2 and 3.4 remained open. Commit `a5b60346` recorded their closure with evidence. A reader of the change record would see the wrong status for archive. [Canonical Progress](../plan.md#progress)
- **Fix**: Record the subsequent closure and link each row to its judgment.
- **Decision**: APPLIED in `12f1fef7`.

### F4 — The OpenSpec archive summary omits two Manual fields

- **Severity**: 🔎 OBSERVATION
- **Impact**: 🏃 LOW. The existing archive fixture asserts the full response.
- **Dimension**: Plan Adherence
- **Location**: `docs/ADR/ADR-014-archive-manual-gate.md:3,29` and `context/changes/docs-status-truth-up/change.md:62`
- **Detail**: The documents correctly described a dormant Manual gate. ADR-014 also specified three empty arrays. The archive fixture returns `manualPending: []` and omits `manualUnproven` and `uncommittedTicks`. [Archive response fixture](../../../../skills/openspec-pipeline/test/openspec-archive.test.mjs)
- **Fix**: Document the observed response shape and retain the original gate scenario.
- **Decision**: APPLIED in `12f1fef7`.

### F5 — ADR-020 reads a dated runner observation as current

- **Severity**: 🔎 OBSERVATION
- **Impact**: 🏃 LOW. The acceptance record identifies the run and observation date.
- **Dimension**: Plan Adherence
- **Location**: `docs/ADR/ADR-020-ci-on-self-hosted-truenas-runners.md:49,79`
- **Detail**: “Current main CI independently verifies” attributed specific tool versions to current CI. The record identifies main run 43703539173 on November 15. The zero-fork count and eight expression checks also apply to that snapshot. [TrueNAS acceptance](../../../archive/2026-11-11-ci-self-hosted-truenas/evidence/acceptance-2026-11-15.md)
- **Fix**: Tie the versions to that main run and the fork sample to its date.
- **Decision**: APPLIED in `12f1fef7`.

### F6 — ADR-008 still assigns completed release setup to the owner

- **Severity**: 🔎 OBSERVATION
- **Impact**: 🏃 LOW. The archived plan records the outcome.
- **Dimension**: Plan Adherence
- **Location**: `docs/ADR/ADR-008-release-packaging-and-semver.md:49`
- **Detail**: The decision told the owner to enable the repository setting. Rows 3.7–3.9 record that the owner enabled it, the workflow opened the first release PR, and merging it produced the release. [Release packaging Progress](../../../archive/2026-11-02-release-packaging/plan.md#progress)
- **Fix**: Preserve the setting’s name and cite the three completed checks.
- **Decision**: APPLIED in `12f1fef7`.

## Verification

| Plan rows | Result |
| --- | --- |
| 1.1, 3.3 | The plan’s rendered README and documentation check reported “All local targets exist”. A separate Pandoc check resolved all 365 local Markdown section references in the changed user-facing documents and change records. Working, staged and cumulative whitespace checks passed. |
| 2.1 | The ADR inventory assertions passed. All nine qualifying records have exactly one initial `Rule in force` section. |
| 2.2 | The ADR judgment covers the changed decisions, their implementations and dated acceptance records. This review checked the current summaries and corrected the discrepancies listed above. [ADR judgment](../evidence/judgment-adr-trace.md) |
| 3.1 | The plan’s assertions passed for S-12 blocked, S-20 proposed, their matching table and body statuses, and the archive-decision seed. The production plan reader counted 92 archived plans, 35 with open rows, 58 open Manual rows and zero open Automated rows. |
| 3.2 | On Node 24.19.0 with OpenSpec 2.0.0, the complete suite exited 0. Of 1,923 tests, 1,920 passed, zero failed and three skipped. Two live GitHub tests require `GH_LIVE=1`. The optional import check skipped because there is no root `CLAUDE.md`. |
| 3.4 | The README claims have host-specific limits and evidence. WAVES v3 leaves the three S-12 rows with the owner, and S-20 retains six configurations with three normal runs each. The follow-up covers clean archive, affirmative approval, refusal and no answer. [Manual judgment](../evidence/judgment-readme-roadmap-archive.md) · [Wave decision](../../WAVES.md#decision-track) |

The implementation changed documentation and added the planned follow-up seed. The manual-verification artifacts and router-owned run records came from the surrounding pipeline. The review used the recorded host and publication evidence. Fresh live qualification and the Wave 1 integration recheck remain with their designated owners.

The first full test run reported 1,917 passed, three failed and three skipped. Its non-repository executor fixtures discovered the enclosing worktree after the test helper cleared the inherited Git discovery setting. An isolated scratch directory kept those fixtures independent of the run branch. The three affected tests passed individually before the clean full rerun shown above.

Two read-only reviews contributed evidence. The plan-drift review identified F1–F3, and the quality review independently identified F2–F3. The enclosing review verified these findings, identified F4–F6 and ran the gates. Child-inclusive token usage was unavailable.
