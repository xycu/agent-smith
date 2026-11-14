<!-- PLAN-REVIEW-REPORT -->
# Plan Review — Agent Call Parameters Implementation Plan

- **Plan**: context/changes/agent-call-parameters/plan.md
- **Mode**: Deep
- **Date**: 2026-11-14
- **Verdict**: SOUND
- **Findings**: 0 critical, 1 warning, 0 observations
- **Reviewed revision**: SHA-256 `3c13f606b0ea4a1a6840ceaf3c5d881a1a208ab0febb2b8c4212591fae64ed8d`

The verdict and counts describe the recovery plan before this review's edits. F1 is applied. Open findings total zero. This review supersedes the earlier review of the original implementation plan.

## Verdicts

| Dimension | Verdict |
| --- | --- |
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | PASS |

## Grounding

Grounding checked 11/11 planned edit paths, 8/8 referenced symbols and fields, and brief-to-plan consistency. The symbols and fields are `change`, `n`, `step`, `SKILL_PATH`, `OPENSPEC_SKILL_PATH`, `closeDelay`, `waitForFile` and `startRunner`. Every planned existing target exists. The phase's seven Automated criteria and one Manual criterion match all eight Progress rows. The plan has one final Progress section and one matching phase, with three completed Automated rows, four pending Automated rows and one pending Manual row.

Deep verification ran directly in this subagent under the supplied no-nesting instruction. The riskiest claims were traced through their owners and callers.

- Commit `43e28f3aaf5f37a7becd05f9933c67da60b9ff93` contains both skill corrections, content assertions and the reference/ADR changes. Its file list also includes router state and AGENTS.md. The plan correctly identifies that checkpoint and specifies a scoped rollback. The current skill and documentation contracts agree. [10x dispatch](../../../../skills/10x-pipeline/SKILL.md#L57) [OpenSpec dispatch](../../../../skills/openspec-pipeline/SKILL.md#L65) [Reference](../../../../docs/REFERENCE.md#L385)
- Ordinary dispatch supplies the fields used to construct descriptions. Neutral retry returns the logged number and step again. Separate invocation records handle reused descriptions within the existing skill layer. [Dispatch fields](../../../../skills/10x-pipeline/scripts/route.mjs#L268) [Neutral retry](../../../../skills/10x-pipeline/scripts/flow.mjs#L389)
- The captured OpenSpec failure checks lock retention after a 350 ms child-close timer. The shared fake CLI already polls a release marker, providing the planned synchronization seam. The raw-output cancellation test has the same pattern at 250 ms. The saved failure supports the timing diagnosis, with runtime defects remaining subject to fresh verification. [Failure evidence](../evidence/run-lock-failure.tap) [Fake CLI](../../../../skills/10x-pipeline/test/codex-helpers.mjs#L36) [Lock test](../../../../skills/10x-pipeline/test/run-lock.test.mjs#L188) [Raw-output test](../../../../skills/10x-pipeline/test/codex-runner.test.mjs#L155)
- The runner waits for child close, clears ownership, removes temporary output and releases its lock. It retains a five-second SIGKILL fallback. Its child exit metadata exposes the graceful-release proof required by F1. [Termination and close](../../../../skills/10x-pipeline/scripts/run-codex.mjs#L154) [Envelope and cleanup](../../../../skills/10x-pipeline/scripts/run-codex.mjs#L269)
- The fixture's consumers are `run-lock.test.mjs`, `codex-runner.test.mjs` and `codex-chain.test.mjs`. The latter uses its default behavior. The planned opt-in mode preserves that interface. Wave 4 and the Git-environment change assign the sibling-owned helper and CI regions separately from this bounded fixture correction. [Chain consumer](../../../../skills/10x-pipeline/test/codex-chain.test.mjs#L12) [Wave ownership](../../WAVES.md#wave-4-run-state-and-isolation-setup-6) [Sibling scope](../../tests-strip-git-env/change.md)
- `makeProject` allocates sibling scratch roots and `codexFixture` provides a separate runner temporary directory. `gitEnv` stops discovery at the scratch parent. The planned worktree-local scratch root and process-level Git environment handling fit those interfaces. [Project allocation](../../../../skills/10x-pipeline/test/helpers.mjs#L62) [Runner fixture](../../../../skills/10x-pipeline/test/codex-helpers.mjs#L69) [Git environment](../../../../skills/10x-pipeline/test/helpers.mjs#L216)

## Findings

### F1 — Verify graceful child exit after explicit release

- **Severity**: WARNING
- **Impact**: LOW — quick decision, the fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1, Changes Required 4, deterministic cancellation fixture and assertions
- **Detail**: The plan rejects forced SIGKILL before explicit release and then retains the existing cancellation-envelope checks after release. The runner records `completion.code` and `completion.signal`, then returns the cancellation reason whenever `cancelled` is set. Both graceful exit and the five-second SIGKILL fallback therefore produce `launched: true`, `completed: false` and the cancellation reason. The existing tests omit child exit-code and signal assertions. A child killed during output draining after release could satisfy those checks and be recorded as controlled-release success. [Child metadata and cancellation](../../../../skills/10x-pipeline/scripts/run-codex.mjs#L269) [Existing lock assertions](../../../../skills/10x-pipeline/test/run-lock.test.mjs#L218) [Existing raw-output assertions](../../../../skills/10x-pipeline/test/codex-runner.test.mjs#L165)
- **Fix**: Require child `exitCode === 0` and `signal === null` after release in both cancellation tests for both chains. Retain cancellation-envelope and cleanup checks, and include the envelope in diagnostics for any forced termination.
- **Decision**: APPLIED — added the explicit child-exit assertions and forced-termination diagnostic requirement to Phase 1, Changes Required 4. Updated the brief's Open Risks & Assumptions. Progress indices, titles and checkbox states remain identical.

## Assumptions

- The supplied unattended instructions authorize applying the clear fix and restrict edits to the plan, brief and review. The repository's `runCodex` child metadata and default fake-child exit code establish the expected values. [Runner metadata](../../../../skills/10x-pipeline/scripts/run-codex.mjs#L269) [Fake-child exit](../../../../skills/10x-pipeline/test/codex-helpers.mjs#L65)
- Live Claude acceptance remains a top-level handoff under Manual 1.6. This host exposes no Claude Agent tool and the supplied rule prohibits nested agents. [Manual evidence](../evidence/unproven.md) [Repository lesson](../../../foundation/lessons.md#never-let-a-subagent-spawn-its-own-subagent)

## Verification

- Ran `node --test skills/10x-pipeline/test/skill-loop.test.mjs skills/openspec-pipeline/test/openspec-skill.test.mjs` on Node v24.19.0. All 47 tests passed, with zero failures, cancellations and skips.
- Verified the review through the router's read-only `readReview` and `openCounts` functions. The measured verdict is SOUND, with zero critical findings and one warning. F1 parses as APPLIED, with zero open findings.
- Verified phase/criteria consistency with dependency-free assertions and `readPlan`. Compared the complete Progress block with its pre-edit SHA-256 `2665b2dad58f1443c77c9d6aa9012e0a31d64de753af79ae5c3b6038cb89dda3`.
- Ran `git diff --check` and checked the edit scope. This review changes only the plan, brief and review report. The pre-existing router-owned run-log modification remains outside these edits.

Full-suite recovery and live Claude acceptance remain pending implementation and top-level acceptance work, respectively.
