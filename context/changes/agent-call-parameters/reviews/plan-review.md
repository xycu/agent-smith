<!-- PLAN-REVIEW-REPORT -->
# Plan Review — Agent Call Parameters Implementation Plan

- **Plan**: context/changes/agent-call-parameters/plan.md
- **Mode**: Deep
- **Date**: 2026-11-14
- **Verdict**: REVISE
- **Findings**: 0 critical, 2 warnings, 0 observations
- **Reviewed revision**: SHA-256 `ffdb5b23cba2ee2fd836f8e10ad52ce510738c4e21f8200a9abf3e44e4ad359d`

The verdict and counts describe the plan before these review edits. Both findings have been applied. Open findings total zero.

## Verdicts

| Dimension | Verdict |
| --- | --- |
| End-State Alignment | WARNING |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | PASS |

## Grounding

Grounding checked 8/8 planned edit paths, 5/5 referenced fields and test overrides, and brief-to-plan consistency. The fields and overrides are `change`, `n`, `step`, `SKILL_PATH` and `OPENSPEC_SKILL_PATH`. Every planned edit target exists. The Progress section has one phase and six pending rows, with five Automated criteria and one Manual criterion matching the phase criteria.

Deep verification was performed directly in this subagent under the supplied no-nesting rule. The highest-risk claims were traced as follows.

- Ordinary dispatch supplies `change`, `n` and `step`. Neutral retry returns the same logged values, so descriptions can be constructed in the orchestrator and repeat on neutral retries. [Ordinary dispatch](../../../../skills/10x-pipeline/scripts/route.mjs#L268) [Neutral retry](../../../../skills/10x-pipeline/scripts/flow.mjs#L389)
- Archive dispatch supplies the change identifier and omits a numbered result entry. Both skills reuse run parameters and have a separate completion continuation, which supports the planned description override. [Archive action](../../../../skills/10x-pipeline/scripts/isolation.mjs#L730) [10x archive](../../../../skills/10x-pipeline/SKILL.md#L68) [OpenSpec archive](../../../../skills/openspec-pipeline/SKILL.md#L75)
- Usage selection currently occurs in Loop step 4, while numbered late usage is handled in the three terminal branches. Their selection instructions need one ownership contract. [10x usage selection](../../../../skills/10x-pipeline/SKILL.md#L61) [OpenSpec usage selection](../../../../skills/openspec-pipeline/SKILL.md#L69) [Usage guards](../../../../docs/ADR/ADR-019-late-usage-figure.md#guards-d2)
- Existing content assertions cover six shared rules, archive parameter reuse and chain flags. The blast-radius sweep also checked `nested-subagents.test.mjs`, which pins rule 6 and the ADR's scenario form. Its existing guard words and scenario structure fit the proposed correction. [Loop assertions](../../../../skills/10x-pipeline/test/skill-loop.test.mjs#L35) [Dispatch assertion](../../../../skills/10x-pipeline/test/agents.test.mjs#L359) [Nested-agent assertions](../../../../skills/10x-pipeline/test/nested-subagents.test.mjs#L126)
- The reported Claude schema comes from the change request. The plan correctly gives live acceptance its own Manual row. This host exposes no callable Claude Agent tool, and the supplied unattended rule prohibits a nested acceptance launch. [Change request](../change.md#problem) [Plan verification](../plan.md#live-acceptance-procedure)

## Findings

### F1 — Apply launch ownership to on-time usage selection

- **Severity**: WARNING
- **Impact**: LOW — quick decision, the fix is obvious and narrowly scoped
- **Dimension**: End-State Alignment
- **Location**: Desired End State and Phase 1, paired skill dispatch and focused content checks
- **Detail**: The original phase explicitly fixes terminal late-usage paragraphs and completion rule 6, while Loop step 4 still takes figures from whichever Agent result or notification is already in the conversation. When a current report has no usage and an earlier step's usage notification is present, that selection can attach the earlier figure to the current result. The original assertions cover terminal correlation and can pass with this gap. A later correction is refused once the step already has a different figure. [10x Loop step 4](../../../../skills/10x-pipeline/SKILL.md#L61) [OpenSpec Loop step 4](../../../../skills/openspec-pipeline/SKILL.md#L69) [Overwrite guard](../../../../docs/ADR/ADR-019-late-usage-figure.md#guards-d2)
- **Fix**: Put a usage ownership guard in the owned Loop step 2 region that also governs step 4. Select the current invocation's matched figure for its result, retain earlier-step figures for their existing late-usage path, and continue in the same turn without usage when the current figure is absent. Add corresponding content assertions and acceptance guidance.
- **Decision**: APPLIED — changed Desired End State, Scope Boundaries, Assumptions and Decisions A4, Phase 1 paired skill dispatch, focused content regression checks, matching documentation, and Testing Strategy. Updated the brief's Desired End State and Architecture / Approach.

### F2 — Resolve reused descriptions at the invocation level

- **Severity**: WARNING
- **Impact**: MEDIUM — real tradeoff, requires reasoning about ambiguous notifications
- **Dimension**: Blind Spots
- **Location**: Assumptions and Decisions A2/A4 and Phase 1 completion-correlation contract
- **Detail**: A2 correctly preserves the same description across neutral retries. The original rule-6 contract then accepts a recorded id or an exact description without specifying precedence, metadata conflicts or description-only ambiguity across successive invocations. A delayed completion from a superseded invocation can share the current description, and a conflicting id can be overlooked if the description alone is sufficient. The existing rule requires the awaited call's own report, so matching must retain invocation identity. [Neutral retry output](../../../../skills/10x-pipeline/scripts/flow.mjs#L389) [Own-report rule](../../../../skills/10x-pipeline/SKILL.md#L92) [Recovery after an interrupted invocation](../../../../docs/REFERENCE.md#L394)
- **Fix**: Keep per-invocation launch records. Use a known agent id as authoritative and require agreement with any supplied description. Otherwise require one unique exact-description match with no conflict against a recorded id. If that uniquely matched launch returned no id, associate an id first received in its notification. Accept completion only for the awaited invocation. Apply the same resolution to usage ownership.
  - **Strength**: Preserves the requested fixed formats, neutral-retry numbering and matching when a launch returns no id.
  - **Tradeoff**: Ambiguous description-only notifications remain unaccepted and may require later host evidence to resolve.
  - **Confidence**: HIGH — grounded in the router's repeated neutral-retry fields and the existing invocation-specific own-report rule.
  - **Blind spot**: Live host notification fields remain unverified under the Manual acceptance row.
- **Decision**: APPLIED — changed Desired End State, Assumptions and Decisions A4, Phase 1 paired skill dispatch, focused content regression checks, matching documentation, and Testing Strategy. Updated the brief's Desired End State, Key Decisions Made and Architecture / Approach.

## Assumptions

- The supplied unattended instructions authorize applying both clear fixes. The usage guard belongs in Loop step 2 because the Wave 4 ownership table assigns that region to this change, and it can state how Loop step 4 selects usage. [Wave 4 ownership](../../WAVES.md#wave-4-run-state-and-isolation-setup-6)
- Completion matching should preserve the identity of the specific awaited invocation even when descriptions repeat. Known ids resolve conflicts, and a unique compatible description preserves the requested fallback when launch ids are unavailable. [Own-report rule](../../../../docs/ADR/ADR-018-no-nested-subagents.md#orchestrator-side) [Neutral retry](../../../../skills/10x-pipeline/scripts/flow.mjs#L389)

## Verification

- Ran `node --test skills/10x-pipeline/test/skill-loop.test.mjs skills/openspec-pipeline/test/openspec-skill.test.mjs` on Node v26.13.1. All 30 tests passed, with zero failures and zero skips.
- Checked the review with the router's read-only `readReview` and `openCounts` functions. The original verdict remains REVISE, with zero critical findings and two warnings. Both finding blocks parse as APPLIED, with zero open findings.
- Checked the plan with `readPlan` and compared the complete Progress block against its pre-edit contents. All six indices, titles and checkbox states are identical.
- Ran `git diff --check` and checked the edit scope. This review updates the plan, brief and review report.

Live Claude acceptance remains unverified under Manual row 1.6. The full implementation suite belongs to the later implementation phase.
