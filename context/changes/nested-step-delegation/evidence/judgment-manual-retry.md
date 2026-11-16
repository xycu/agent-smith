# Manual qualification retry

Reviewed on 2026-11-16 at candidate `7312e67787be1b81b1a6625809a5bd5814c872e9`.

Read the prior `unproven.md` first, then the plan, change documents, existing qualification records and relevant runner, lock and orchestrator code. This attempt checked whether the retained smoke evidence and current source identity could supply the missing proof. The new read-only audit is saved in [command-manual-retry-candidate.txt](command-manual-retry-candidate.txt).

## Row 1.3 remains pending

The row asks for “parent receipt, event and usage semantics, cancellation and applicable child restrictions for the twelve configuration/mode cells, with unavailable proof explicitly pending until final-candidate qualification.”

`capabilities.md` states “Usage inclusion, cancellation and effective step-safety inheritance still require further proof.” Its candidate smoke record states “Delegated token totals were omitted because inclusive native accounting remains unproved.” All twelve capability cells in `acceptance.md` remain `pending`.

The current runner, state and flow hashes match all three recorded smoke-tested source hashes. This confirms the continued relevance of the recorded bounded headless observations. Their scope still leaves cell-specific usage, cancellation and effective restriction evidence incomplete. The clause allowing unavailable proof to remain pending supports retaining those gaps explicitly. It supplies no missing host observations. This step prohibits starting children, including through another CLI, so the missing native checks cannot be performed here. The previously recorded quota failure was not retested.

## Row 3.4 remains pending

The row requires “Final-candidate functional evidence passes all twelve configuration/mode cells through both normal entry points” and lists child collection, failure, interruption/resume, late-result rejection, usage attribution and effective restrictions.

`acceptance.md` states “The normal-entry final-candidate cells below remain pending.” `capabilities.md` states “These focused headless checks leave the full twelve-cell qualification pending.” The new audit confirms twelve pending final-candidate cells.

The source inspection follows the existing ownership boundary. `run-codex.mjs` requires completed latest turns for the parent and enumerated descendants, repeats enumeration to detect changed membership and calls `lock.clearChild(true)` only after settlement. Delegated execution adds the assumption “Codex child token coverage is unknown; totalTokens omitted.” `state.mjs` retains native ownership with the diagnostic “Execution suspended: native ownership unresolved”. Both orchestrator skills suspend result writes and publication while execution ownership is unresolved.

Those source contracts and the matching historical smoke hashes support the implementation boundary. They cannot establish the complete live host/provider/chain/mode outcomes. Existing fake-host tests cover deterministic subsets, and no existing test covers this entire live matrix. No test was rerun as proof of this row. Filling the matrix requires child launches prohibited by this step.

## Row 3.5 remains pending

The row requires “The authorized orchestrator publishes the run branch and reviewable PR, its CI succeeds” and any requested report comment accurately describes the outcome and pending host evidence.

`acceptance.md` states “Manual rows 3.4 and 3.5 also remain pending.” The retained run report records “Outcome: halt” for an earlier implementation prerequisite. It supplies no successful publication or remote CI outcome for the current candidate.

This step explicitly reserves publication to the orchestrator and prohibits push, GitHub CLI calls, PR/comment mutation, equivalent publication APIs and indirect publication scripts. Existing fake-client publication tests cannot prove a real branch publication, PR, CI result or report comment. The available retained records do not establish that outcome, and performing it here would violate the step instructions.

## Attempt outcome

No Manual row was proved. Plan contents remain unchanged. The rewritten `unproven.md` lists exactly rows 1.3, 3.4 and 3.5 with their current reasons. The only writes in this attempt are evidence files. No new native or remote outcome is claimed.
