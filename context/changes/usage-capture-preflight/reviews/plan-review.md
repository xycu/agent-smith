<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Usage Capture Preflight Implementation Plan

- **Plan**: [Usage Capture Preflight Implementation Plan](../plan.md)
- **Mode**: Deep
- **Date**: 2026-11-23
- **Verdict**: REVISE
- **Findings**: 0 critical, 5 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
| --- | --- |
| End-State Alignment | WARNING |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

Grounding: 15/15 existing implementation, test and documentation paths verified, with the proposed init module and init test treated as additions. Verified the selection, replay, launcher and reporting symbols against their callers. The brief and plan disagreed on whether operators could relaunch with capture and resume. Both phases matched their Progress headings and every criterion matched its row. All five Automated checks can be proved locally. The live PR comment check already belongs to Manual, and the local fake-client check remains Automated.

## Findings

### F1 — Neutral replay can warn about an unassigned transport

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision with a narrowly scoped fix
- **Dimension**: End-State Alignment
- **Location**: Implementation Approach and Phase 1
- **Detail**: The original input rule could reuse the permissions advisory's union of all configured providers and the saved provider. That union includes transports this init cannot dispatch on neutral replay. The replay branch uses the stored step directly or halts. [Provider map](../../../../skills/10x-pipeline/scripts/state.mjs#L111) · [Permission advisory](../../../../skills/10x-pipeline/scripts/init-permissions.mjs#L143) · [Neutral replay](../../../../skills/10x-pipeline/scripts/flow.mjs#L418)
- **Fix**: Check the saved provider alone on a pending neutral replay. Use the chain role map for ordinary init. Cover a replay whose provider differs from the current policy.
- **Decision**: APPLIED — Implementation Approach, Phase 1 changes 1 and 3, and brief Scope.

### F2 — Launcher guidance would discourage a supported resume

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision with a narrowly scoped fix
- **Dimension**: Plan Completeness
- **Location**: Phase 1, Planning Assumptions and Migration Notes
- **Detail**: The Phase 1 restriction to a fresh run contradicted the brief, the resume assumption and the migration promise. The launcher needs a fresh Claude session. The router accepts a resume from that session with the saved host and provider mode. [Resume guards](../../../../skills/10x-pipeline/scripts/route.mjs#L1105) · [Launcher setup](../../../../docs/REFERENCE.md#accounting-activation-and-rollback)
- **Fix**: Specify a new launcher session and allow starting or resuming a Claude-hosted run from it.
- **Decision**: APPLIED — Phase 1 change 2 and the brief Warning policy decision.

### F3 — The Codex probe changes existing CLI fixture expectations

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision with a narrowly scoped fix
- **Dimension**: Plan Completeness
- **Location**: Phase 1 and Testing Strategy
- **Detail**: The plan covered shared stderr assertions, but permission fixtures also assert exact CLI calls. A new version invocation would change those assertions and could fall into the existing fake sandbox response. The exact pin belongs to the usage collector, and the skills already have a separate per-action CLI check. [Permission fixtures](../../../../skills/10x-pipeline/test/init-permissions.test.mjs#L107) · [Adapter pin](../../../../skills/10x-pipeline/scripts/codex-usage.mjs#L8) · [Dispatch check](../../../../skills/10x-pipeline/SKILL.md#L53)
- **Fix**: Define the successful version response, model the version and sandbox calls separately in the fake CLI, retain exact sandbox assertions, and exercise bounded failure outcomes.
- **Decision**: APPLIED — Phase 1 changes 1 and 3 and Testing Strategy.

### F4 — The report contract needs an explicit settlement and transport predicate

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision with a narrowly scoped fix
- **Dimension**: Blind Spots
- **Location**: Phase 2 and Testing Strategy
- **Detail**: The report starts with `executed(log)`, which filters skips and still includes a pending dispatch. The headless runner records `claude-native` with `incomplete-capture`, a reason also used by the native collector. Checking just that source or reason could label an interactive failure as duration-only, or count an unsettled row in a rebuilt report. Late intake already checks for a result object. [Executed rows](../../../../skills/10x-pipeline/scripts/state.mjs#L719) · [Late intake](../../../../skills/10x-pipeline/scripts/route.mjs#L881) · [Headless evidence](../../../../skills/10x-pipeline/scripts/run-claude.mjs#L362) · [Native fixture](../../../../skills/10x-pipeline/test/claude-usage.test.mjs#L80)
- **Fix**: Require a result object and normalized unavailable evidence for the summary. Match inherited host, dispatched provider and recorded duration for the headless clause. Exercise pending rows, the shared reason in both transports and a late verified refresh.
- **Decision**: APPLIED — Phase 2 change 1, Testing Strategy and the brief Architecture / Approach.

### F5 — A long goal can crowd the summary out of the PR comment

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision with a narrowly scoped fix
- **Dimension**: End-State Alignment
- **Location**: Phase 2 and Testing Strategy
- **Detail**: The renderer prints variable text before the first table. The existing publication scripts preserve the start of the body under a fixed length cap. A summary placed anywhere before the table can still be lost after a long goal. A handcrafted fake-client report could also pass while the renderer places the real line too late. [Report header](../../../../skills/10x-pipeline/scripts/flow.mjs#L136) · [Comment cap](../../../../skills/10x-pipeline/scripts/pr-common.mjs#L63) · [Fake-client harness](../../../../skills/10x-pipeline/test/pr-comment.test.mjs#L331) · [OpenSpec report argument](../../../../skills/openspec-pipeline/SKILL.md#L159)
- **Fix**: Place the line immediately after the title. Capture the comment body from a generated report with a long goal and use the explicit report path for OpenSpec.
- **Decision**: APPLIED — Phase 2 change 1, Testing Strategy, and the brief Architecture / Approach and Success Criteria.

### F6 — Recheck source limits and privacy on the opened file

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision with a narrowly scoped fix
- **Dimension**: Blind Spots
- **Location**: Phase 1, Native Claude launcher prerequisites
- **Detail**: A device and inode match alone cannot catch same-file changes to size, mode or link count after the initial stat. The shared stable read scans payloads and expects unchanged content, while a launcher source can legitimately grow within the cap during init. The capture data module already owns the private binding and file checks used by the collector and writer. [Capture file checks](../../../../skills/10x-pipeline/scripts/claude-capture-data.mjs#L41) · [Stable reader](../../../../skills/10x-pipeline/scripts/usage.mjs#L121)
- **Fix**: Keep a metadata-only probe in the capture data module. Reuse the binding and file checks, validate opened metadata and canonical identity, and allow growth within the cap.
- **Decision**: APPLIED — Phase 1 change 2.

## Verification after triage

The verdict and counts describe the original plan. All six findings were applied, and the canonical Progress block stayed byte-for-byte identical. The existing Automated local comment check and Manual published-comment check retain their original classifications.
