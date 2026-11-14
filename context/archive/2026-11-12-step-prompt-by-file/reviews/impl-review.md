<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Step prompt handoff by file

- **Plan**: context/changes/step-prompt-by-file/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-11-14
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 0 observations

## Verdicts

| Dimension | Verdict |
| --- | --- |
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

None. No code fixes or fix commits were necessary.

## Scope and evidence

Reviewed the complete plan against implementation commits `0565210`, `513a88f`, and `08701e4`, the closeout and manual-verification evidence through `566d231`, and the current working tree. The implementation baseline is `0f51d60`. The pre-existing modification to the active router log was not edited or staged.

The plan has 13 completed automated rows and two pending manual rows. All three phases were reviewed as explicitly requested, including Phase 3's evidence and its uncompleted live acceptance. No Progress checkbox was changed.

| Planned area | Evidence and assessment |
| --- | --- |
| Strict opt-in and template classification | `policy.json` defaults to false; `policyProblems` rejects explicit non-booleans before mutation. `checkPrompts`, `promptProblem`, and `promptsHash` exclude exactly `byFile`; malformed actual templates still fail. Legacy pending entries retain inline dispatch. |
| Exact dispatch and replay | `next` assembles the canonical task once, stores `pendingPrompt`, and durably records `pendingHandoff` before publication. `prepareHandoff` copies the task's actual final RESULT contract. `neutralRetry` republishes stored text and returns the stored descriptor with unchanged execution identity. |
| Ownership and recovery | Prompt I/O derives the fixed path from chain-aware `paths`; recorded paths are compared rather than followed. Regular-file and parent-redirect checks preserve collisions. Atomic publication uses the existing helper. `attachResult` persists intake before `cleanupHandoff`; the durable marker lets a later call finish interrupted cleanup before step commits, rollback, or archive handling. Exact owned temporary names use the existing locked cleanup. |
| Provider boundary | `run-codex.mjs` retains exact inline checks, requires the stored file descriptor and task bytes in file mode, and runs validation before and after the permission probe. Archive rejects file fields. Child stdin remains the action's unchanged short prompt. |
| Host instructions and docs | Both Loop step 2 additions require unchanged forwarding and router-owned cleanup. Provider identity, usage, failure classification, archive branches, and byte-identical anti-stall sections remain intact. The reference explains the reserved option, lifecycle, migration, and evidence limitations. |
| Measurement and default decision | The synthetic evidence records 21 real CLI actions: 19 normal dispatches of 1,026–1,187 bytes and separately measured long-path/reason overhead. It records zero live pairs and unavailable orchestrator telemetry, and retains the false default. Bytes are never presented as tokens or quality proof. |

The production diff stays within the plan's ownership map. Consolidating opt-in and provenance checks in `prompt-handoff.test.mjs` instead of editing every candidate test file preserves the intended coverage without redundant changes. The one-statement fake-Codex readiness repair and its regression test are justified by the recorded deterministic red/green proof in `evidence/verification.md`; they preserve production process behavior and repair the required verification fixture. Later manual evidence documents unavailable observations rather than claiming success.

## Verification

- Full required Node suite on Node v24.19.0: **1,500 tests, 1,497 passed, 0 failed, 3 skipped**, exit 0 (650.4 seconds). Command: `TMPDIR="$PWD/.agent-smith-test-tmp" node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`. Output: `context/changes/step-prompt-by-file/evidence/impl-review-suite.log`.
- Expected skips: two opt-in GitHub live tests (`GH_LIVE` unset) and the absent `CLAUDE.md` import check. These are not counted as proof. All 19 handoff cases, including actual emitted-size checks, and the affected provider, provenance, policy, retry, recovery, and skill-content suites passed.
- Test scratch files use worktree-local `.agent-smith-test-tmp`, with the documented Git-discovery barrier so fixtures without their own repositories cannot inherit this checkout.
- `git diff --check`: passed. New report and log were also checked for trailing whitespace; console log trailing horizontal whitespace was normalized.
- Source tracing covered all changed production callers, result/cleanup/commit ordering, both preflight validation sites, and the existing atomic-write and neutral-retry patterns.
- Both Anti-stall sections are byte-identical. The plan's Progress remains unchanged at 13/15 complete.

## Assumptions and remaining acceptance

- The explicit unattended instructions authorize reviewing and triaging directly without nested agents or questions. No uncertain implementation choice required an owner decision.
- Phase 3 explicitly permits delivery of the opt-in with zero live pairs while keeping the default false. Manual rows 3.4 and 3.5 remain pending: live full-task reads and RESULT/usage/archive behavior on both providers and chains, followed by at least five matched live changes with quality review and orchestrator telemetry before any future default-on recommendation.
- Existing documented limits remain: cleanup cannot erase an earlier child-authored commit of transient prompt content, and the final PR helper may stage an unconsumed task retained after a halt. This change promises cleanup before router-owned step/final/pre-archive commits, not history rewriting or a new PR staging policy.
- No recurring new finding was identified, so no lesson candidate was produced and `context/foundation/lessons.md` was not changed.
