# First-attempt experiment verification

## 2.1 Host qualification

The archived Claude acceptance record says, “One complete interactive launcher run on Claude Code 2.1.323 ended with verified figures for all five steps.” ADR-010 requires “a fresh native 10x pipeline to completion on the pinned plugin revision, host build, launch path and explicit provider mode.” The archive establishes an earlier launcher qualification. The current status shows zero verified figures and a step still pending. Neither record establishes completed qualification on the chosen experiment setup. [Archived acceptance](../../../archive/2026-11-19-claude-token-figures-default/evidence/acceptance.md#resolution-2026-11-23) · [ADR-010 protocol](../../../../docs/ADR/ADR-010-run-worktree-step-commits-and-rollback.md#first-attempt-experiment-protocol) · [Current status](command-current-run-status.md)

## 2.2 Live cohort and control

ADR-010 states “the cost claim of the cheaper first attempt is a hypothesis, and no pair has run yet” and labels its result “**Pending.** The shipped drop is `0` during measurement.” The result section contains recording instructions. It has no five eligible A/B pairs, eligible A/A control, or documented exclusions and exhausted or stopped measurement. The plan assigns the live runs and paid budget to the authorized operator. [ADR-010 result](../../../../docs/ADR/ADR-010-run-worktree-step-commits-and-rollback.md#ab-result) · [Phase 2 plan](../plan.md#phase-2-measure-live-and-record-the-default-decision)

## 2.3 Policy decision and closeout

The shipped policy has `"firstAttempt": { "drop": 0`. The routing reference says the shipped setting “leaves the discount off while measurement is pending,” and the README says the first-attempt discount “defaults to `0` while its experiment is pending.” ADR-007 says its separate experiment “varies `score.minRigor`” and links ADR-010. These records agree on the interim setting. Phase 2 requires an experiment result and tests run after the resulting decision. The pending result supplies no final decision to verify, so local regression results could only confirm the interim setting. [Policy](../../../../skills/10x-pipeline/policy.json#L51) · [Routing reference](../../../../docs/REFERENCE.md#L130) · [README](../../../../README.md) · [ADR-007 result](../../../../docs/ADR/ADR-007-llm-complexity-scorer-as-a-routed-step.md#ab-result) · [Closeout command](../change.md)
