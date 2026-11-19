<!-- PLAN-REVIEW-REPORT -->
# Plan Review — Review Verdict Validation Implementation Plan

- **Plan**: [plan.md](../plan.md)
- **Mode**: Deep
- **Date**: 2026-11-19
- **Verdict**: REVISE
- **Findings**: 2 critical, 2 warnings, 1 observation

The verdict and counts describe the plan submitted at `5e3d69ae`, with Phase 1 already implemented and Phase 2 pending. All five findings were applied to the plan during triage.

## Verdicts

| Dimension | Verdict |
| --- | --- |
| End-State Alignment | FAIL |
| Lean Execution | PASS |
| Architectural Fitness | WARNING |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

- Confirmed all seven planned edit paths and ten named reader, router and rollback functions. The brief matched the submitted plan's phases and scope.
- The independent read-only code check traced both CLI resume commands, both review kinds, rollback and undo, terminal halt publication and the shared OpenSpec fixtures. Child-inclusive token coverage is unknown.
- All six Automated success criteria matched their Progress rows. They run locally before publication and require no pushed branch, PR, CI run or external comment.
- The read-only archive comparison reproduced all 190 tuples' baseline digest at `9b8d0af620d7dd8e4bf6929403e96aac1a2e3661e91b33779e9ee95f5c75b635`. [Archive comparison](../plan.md#migration-notes)

## Findings

### F1 — A review absent at dispatch can reappear with an eligible timestamp

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision with a narrowly scoped fix
- **Dimension**: End-State Alignment
- **Location**: Phase 2, Record which timestamps still need restoration
- **Detail**: Dispatch records a zero time for a missing review. If the file is tracked but locally absent, rollback can recreate the older valid review from `startSha`. Timestamp restoration skips zero, leaving the Git checkout mtime newer than the failed attempt. The freshness gate can accept that checkout as a correction even after the proposed checkpoint is complete. [Missing mtime](../../../../skills/10x-pipeline/scripts/state.mjs#L246) · [Timestamp restoration](../../../../skills/10x-pipeline/scripts/isolation.mjs#L535) · [Freshness gate](../../../../skills/10x-pipeline/scripts/flow.mjs#L558)
- **Fix**: When rollback restores a matching checkout of the failed review and the recorded time is zero, use the failed attempt's start time. Add a CLI fixture for a previously tracked review that reappears after rollback.
- **Decision**: APPLIED in Phase 2 items 1 and 2 and the brief's Key Decisions Made.

### F2 — The checkpoint can be durable while metadata still belongs to the reset

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff or a non-trivial edit
- **Dimension**: End-State Alignment
- **Location**: Scope, Phase 2, and Migration Notes
- **Detail**: `writeState` publishes the log before metadata. A crash between writes can expose the proposed pending checkpoint alongside metadata from the checkout, even though resume trusts that metadata. An earlier crash after Git reset can leave the failed result only in the snapshot, because intake already removed the result file. Undo has the same state publication boundary after its two resets. A restore error also needs a fresh halt report because the orchestrators publish ordinary halts and can advance HEAD. [Result intake](../../../../skills/10x-pipeline/scripts/flow.mjs#L640) · [State order](../../../../skills/10x-pipeline/scripts/isolation.mjs#L544) · [Undo](../../../../skills/10x-pipeline/scripts/route.mjs#L52) · [Halt publication](../../../../docs/ADR/ADR-017-run-branch-always-pushed-for-review.md#what-the-script-does)
- **Fix**: Publish metadata before the log checkpoint, pin the checkout commit, and define the post-publication recovery boundary. Finalize catchable recovery errors as halts with the checkpoint and ref intact. Document how to inspect the snapshot for interruptions before the checkpoint.
  - **Strength**: Timestamp replay can operate on the recorded checkout even after publication or an owner commit moves HEAD.
  - **Tradeoff**: Automatic recovery begins at log publication. An earlier interruption requires manual reconciliation from the snapshot.
  - **Confidence**: HIGH. The reset, atomic state writes and halt publication order are explicit in the current code.
  - **Blind spot**: Phase 2 still needs to exercise the durable boundary and a resumed run with a newer HEAD.
- **Decision**: APPLIED in Scope, Planning assumptions, Phase 2 items 1 and 2, Migration Notes, and the brief's Key Decisions Made and Open Risks & Assumptions.

### F3 — Comparing raw Git blobs can misclassify a restored review

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff or a non-trivial edit
- **Dimension**: Architectural Fitness
- **Location**: Phase 2, Record which timestamps still need restoration
- **Detail**: The plan names a commit without defining checkout equivalence. Git can change the working bytes through line-ending or checkout filters, and an Agent Smith project can sit below the Git root. Treating a failed object lookup as a missing entry could also accept stale evidence. The current timestamp writer follows symlinks. [Project prefix](../../../../skills/10x-pipeline/scripts/prepare-run.mjs#L352) · [Git environment](../../../../skills/10x-pipeline/scripts/state.mjs#L766) · [Current writer](../../../../skills/10x-pipeline/scripts/isolation.mjs#L535)
- **Fix**: Fingerprint the actual post-reset bytes for new checkpoints. Use checkout-aware evidence for legacy entries. Guard timestamp writes against redirects and nonregular files, and pass legacy evidence into routing through its existing context.
  - **Strength**: New checkpoints compare the exact checkout bytes even after Git configuration changes. The legacy comparison accounts for project prefixes and checkout conversion.
  - **Tradeoff**: New pending entries store a fingerprint per relevant file. Legacy comparisons need Git lookups.
  - **Confidence**: HIGH. The router already handles Git prefixes and has an established module import order.
  - **Blind spot**: A fixture must show that checkout conversion leaves an unchanged review ineligible.
- **Decision**: APPLIED in Phase 2 items 1 and 2, Migration Notes, and the brief's Key Decisions Made.

### F4 — Completion and legacy state need distinct routing rules

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision with a narrowly scoped fix
- **Dimension**: Blind Spots
- **Location**: Phase 2 and Migration Notes
- **Detail**: The plan calls for marking work complete and treats an absent marker as legacy. It leaves the persisted distinction and the precedence of the legacy comparison implicit. Clearing the field would make new completed work ambiguous. Checking all historical failures could interfere with a later successful review. [Rollback eligibility](../../../../skills/10x-pipeline/scripts/isolation.mjs#L569) · [Authoritative failure selection](../../../../skills/10x-pipeline/scripts/flow.mjs#L708)
- **Fix**: Retain an explicit completion marker. Apply the conservative legacy comparison only to the authoritative isolated rollback or undo when the review otherwise passes verdict and freshness validation. Cover both matching and corrected legacy reviews.
- **Decision**: APPLIED in Phase 2 items 1 and 2, Migration Notes, and the brief's Key Decisions Made.

### F5 — OpenSpec compatibility needs a timestamp assertion

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision with a narrowly scoped fix
- **Dimension**: Plan Completeness
- **Location**: Phase 2, Exercise the interruption and the owner's correction separately
- **Detail**: The existing OpenSpec fixture checks rollback, file contents and the side ref. It does not prove interruption recovery restores the times of the chain's distinct routing files. The CLI already has a subprocess-only filesystem fault pattern that can supply this proof. [OpenSpec rollback fixture](../../../../skills/openspec-pipeline/test/openspec-isolation.test.mjs#L94) · [Fault injection fixture](../../../../skills/10x-pipeline/test/result-persist.test.mjs#L107)
- **Fix**: Extend the OpenSpec isolation fixture to assert both routing timestamps after an interrupted restore. Use the existing full local gate.
- **Decision**: APPLIED in Phase 2 item 2 and the brief's Success Criteria.

## Assumptions

- Phase 2 addresses the post-state-publication window identified by the implementation review's F6. Earlier interruptions use snapshot inspection and owner-led reconciliation. [Implementation review](impl-review.md#f6--interrupted-rollback-can-leave-a-misleading-review-timestamp)
- Catchable timestamp errors use the existing ordinary halt and report path. A later resume does timestamp work only, so a published halt can advance HEAD safely. [Rollback decision](../../../../docs/ADR/ADR-010-run-worktree-step-commits-and-rollback.md#failed-step-rollback) · [Publication decision](../../../../docs/ADR/ADR-017-run-branch-always-pushed-for-review.md)
