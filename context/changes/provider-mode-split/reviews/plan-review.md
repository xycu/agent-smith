<!-- PLAN-REVIEW-REPORT -->
# Plan Review — Provider Mode Implementation Plan

- **Plan**: [Provider Mode Implementation Plan](../plan.md)
- **Mode**: Deep
- **Date**: 2026-11-19
- **Verdict**: REVISE
- **Findings**: 0 critical, 4 warnings, 2 observations

The verdict and counts describe the plan at `f50c8042` before triage. Five findings have plan edits. F2 requires an owner decision.

## Verdicts

| Dimension | Verdict |
| --- | --- |
| End-State Alignment | WARNING |
| Lean Execution | PASS |
| Architectural Fitness | WARNING |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

Confirmed the named router, runner, hook and test paths. Traced `mutationMeta`, `advisorOn`, `validateAction`, `verifyManual` and `archiveDescriptor` through their callers. The plan brief matched the original scope and phases. The 12 Progress rows matched their Phase Success Criteria. A native read-only child independently checked the guard and dispatch boundaries, fixture coverage, compatibility and publication ordering. Child-inclusive token coverage is unknown. [Implementation review](impl-review.md) · [Repository lessons](../../../foundation/lessons.md)

Row 3.1 uses local fake clients. Publication and fresh authenticated qualification already belong to Manual rows 3.3 and 3.2. The source and fixture inspection did not execute the implementation or live hosts. [Phase 3](../plan.md#phase-3-wire-and-document-both-pipeline-skills)

## Findings

### F1 — The headless guard contract contradicts the startup decision

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision, with a narrowly scoped wording fix
- **Dimension**: Architectural Fitness
- **Location**: Open Risks & Assumptions and Phase 2, Runner dispatch and permissions
- **Detail**: Phase 2 required the handshake before any read of the by-file handoff, although the recorded owner decision allows trusted startup imports to read pending files. It also described commit permissions as archive-only, even though the guard permits scoped commits for authorized enclosing implementation, repair and review steps. The runner proves the guard in the executing session before sending the work turn. [Runner preflight](../../../../skills/10x-pipeline/scripts/run-claude.mjs#L266) · [Commit step set](../../../../skills/10x-pipeline/scripts/run-claude.mjs#L20) · [Guard commit check](../../../../skills/10x-pipeline/scripts/step-guard.mjs#L524) · [Transport reference](../../../../docs/REFERENCE.md#L29)
- **Fix**: Describe the same-session work-turn gate and trusted-startup exception. Preserve scoped commit rights for authorized enclosing steps, archive scope for archive commits, and the leaf and publication restrictions.
- **Decision**: APPLIED in Phase 2, Runner dispatch and permissions, and Architecture / Approach in the plan brief.

### F2 — A log with missing metadata can be mistaken for a fresh run

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — recovery behavior affects saved runs and legacy compatibility
- **Dimension**: End-State Alignment
- **Location**: Desired End State, Phase 1 state handling, Phase 4 F2 and Migration Notes
- **Detail**: The new guard refuses malformed or non-object metadata when the file exists. If the file is absent while the log survives, init treats the selection as fresh and can save a different host and mode. The log records individual dispatch targets, which do not uniquely identify a run mode. A historical provenance fixture explicitly expects a log-only run to resume. The plan covers the damaged-file cases but leaves this ambiguity unresolved. [Metadata guard](../../../../skills/10x-pipeline/scripts/route.mjs#L63) · [Init selection and write](../../../../skills/10x-pipeline/scripts/route.mjs#L1069) · [Log-only compatibility fixture](../../../../skills/10x-pipeline/test/provenance.test.mjs#L346)
- **Decision**: PENDING because the saved log alone cannot distinguish a supported log-only legacy run from a run that lost its mode. The owner must decide whether to require recovery for all log-only runs or define an explicit, verifiable legacy recovery path.

### F3 — Settled failure evidence only exercises 10x intake

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — the existing fake runner fixture already supports both chains
- **Dimension**: Blind Spots
- **Location**: Phase 4, Verify Claude settlement and accounting
- **Detail**: The existing runtime test feeds a settled incomplete envelope through `next` and late `usage` for 10x only. A separate source assertion checks what both skill texts instruct their hosts to write. Phase 4 also groups reply mismatches with errors without specifying that successful terminal replies need matching text and digest. A recognized failure settles on the agreed session and turn, Stop and terminal error marker without parsing a reply. [Failure fixture](../../../../skills/10x-pipeline/test/claude-runner.test.mjs#L156) · [Skill contracts](../../../../skills/10x-pipeline/test/host-integration.test.mjs#L170) · [Terminal validation](../../../../skills/10x-pipeline/scripts/run-claude.mjs#L263)
- **Fix**: Name the OpenSpec parameterization of the settled-failure cases, retain both skill-text checks, and specify the proof needed for each terminal type. Keep unsuccessful archive ownership checks.
- **Decision**: APPLIED in Phase 4, Verify Claude settlement and accounting, and Success Criteria in the plan brief.

### F4 — Capability fixtures cover only pieces of the required refusal paths

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — extend established fake-provider fixtures
- **Dimension**: Blind Spots
- **Location**: Phase 4, Verify metadata recovery and capability checks
- **Detail**: The advisor fixture checks the saved flag for both manual-verification spellings. The runner fixture tests the refusal for a plan action. In the missing-`Skill` case the catalog contains the skill, but the fixture asserts the generic startup notice. The Codex drift test changes policy and skill, while the shared validator also compares template and advisor after preflight. [Manual advisor fixture](../../../../skills/10x-pipeline/test/host-integration.test.mjs#L132) · [Claude refusals](../../../../skills/10x-pipeline/test/claude-runner.test.mjs#L106) · [Codex drift fixture](../../../../skills/10x-pipeline/test/codex-runner.test.mjs#L662) · [Requirement comparison](../../../../skills/10x-pipeline/scripts/runner-dispatch.mjs#L85)
- **Fix**: Exercise both exact routed manual actions against the runner, require the specific capability diagnostics, and add independent Codex template and advisor drift cases. Reuse the exact-dispatch control.
- **Decision**: APPLIED in Phase 4, Verify metadata recovery and capability checks.

### F5 — F8 needs precise fixture cases for the documented edges

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — the local test files and assertions have clear owners
- **Dimension**: Plan Completeness
- **Location**: Phase 4, Compare CLI help and the transport reference with local behavior
- **Detail**: The unknown-option diagnostic has coverage. The separate no-argument help path, a newly routed native no-Chrome action paired with a historical capability-less action, and a guarded oversized leaf need explicit cases. The current headless guard fixture covers an ordinary leaf event and oversized main-session events. [Usage hint](../../../../skills/10x-pipeline/scripts/route.mjs#L981) · [Unknown flag test](../../../../skills/10x-pipeline/test/route.test.mjs#L706) · [Historical fixture](../../../../skills/10x-pipeline/test/manualverify.test.mjs#L47) · [Guard fixture](../../../../skills/10x-pipeline/test/step-guard.test.mjs#L417)
- **Fix**: Identify the cases and their existing fixture owners in Phase 4.
- **Decision**: APPLIED in Phase 4, Compare CLI help and the transport reference with local behavior.

### F6 — Archive qualification and delivery publication need an explicit sequence

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — the existing terminal branches supply the sequence
- **Dimension**: Plan Completeness
- **Location**: Phase 3, Manual Verification, and Testing Strategy
- **Detail**: On the delivery run the archive gate runs before the same run produces the publication evidence row 3.3 needs. The plan assigns both checks to Manual correctly but leaves the order implicit. The 10x decline path keeps the change live and still reaches terminal publication. OpenSpec archive qualification needs a disposable change with completed tasks. [10x archive loop](../../../../skills/10x-pipeline/SKILL.md#L98) · [OpenSpec archive task check](../../../../skills/10x-pipeline/scripts/isolation.mjs#L883)
- **Fix**: Qualify archive on disposable changes that meet the local prerequisites. Allow the enclosing orchestrator to publish the delivery change while it is live and collect row 3.3 afterward. Keep the existing archive policy and owner authorization gate.
- **Decision**: APPLIED in Phase 3, Manual Verification, Testing Strategy, and Success Criteria in the plan brief.
