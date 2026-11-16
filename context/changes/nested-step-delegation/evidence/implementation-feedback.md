# Implementation feedback for the routed re-plan

## Preserved Phase 2 attempt

The router preserved the failed step 4 work at `refs/agent-smith/nested-step-delegation/a0b7de060795/failed-4` and returned the worktree to its start commit. The partial feature code, tests and documentation can be inspected through that ref. Phase 1 remains committed as `c4f7b69`. The plan, brief and native evidence from the preserved attempt have been restored as task documents so their corrections and observations survive into replanning.

## Last observed focused gate failures

The final `phase2-contracts.log` in the ignored worktree-local check directory reports two failing existing assertions in `skill-loop.test.mjs`.

- The 10x setup check requires the sentence `Setup resolves resumes before this check, even after complete source cleanup`.
- The file-handoff check expects the lower-case substring `when promptFile exists, forward the router's short prompt verbatim`, including the original Markdown backticks around the names. The shortened attempted 10x skill starts that sentence with capital `When`.

Earlier runner/guard checks passed 61 tests. The failed implementation agent reported exhausting its gate-fix attempts. Its full-suite log also contains unresolved pending-promise cancellations, so a fresh complete suite is required after the focused contracts are repaired. The Phase 1 full-suite passes do not qualify the pending feature diff.

## Re-plan source check

The 2026-11-16 planning retry inspected the current status, the saved diff and the ignored worktree-local logs without restoring implementation files. The saved ref differs from `c4f7b69` in 28 files. In particular, its 10x skill change shortens unrelated setup, archive, publication and tuning instructions; the OpenSpec skill changes are narrower. The current working tree has planning/evidence and router-state changes, while the partial implementation is held by the ref. This reconciles the original failure note's “partial changes remain uncommitted” with the router's subsequent preservation.

- `.claude/worktrees/nested-step-delegation-checks/phase2-contracts.log:152` records 151 tests: 149 passed, two failed, zero cancelled and zero skipped. Its failures are the setup/resume and file-handoff assertions listed above.
- `.claude/worktrees/nested-step-delegation-checks/phase2-full.log:33` and `:36` also record `10x: labels, fail-closed reading and STOP` and `10x: archive publication covers verification success, failure and gate refusal` failures from `archive-gate.test.mjs`. That suite pins archive refusal wording and opt-in publication/comment boundaries, so the focused retry must include it.
- The full log's pending-promise cancellations start with `budget-confirm-rounds.test.mjs` and `budget-confirm-shipped.test.mjs`. They show that verification was incomplete, not why the event loop ended. No new causal claim or timeout change is justified by this evidence alone.
- `run-codex.mjs:181` records execution ownership before spawn, but `:202–208` clears it on close before final-message validation. `state.mjs:995–1007` permits stale execution takeover if the recorded process group has disappeared. The saved feature diff changes neither boundary. `run-lock.test.mjs:143–186` intentionally permits legacy flat recovery after group exit; `codex-helpers.mjs:49–60` keeps the current fake descendant in the parent's group with inherited stdio. Add a separate out-of-group fixture and preserve the flat cases.

The revised plan assigns selective instruction repair and directly coupled README/reference/ADR depth changes to Phase 2, adds Automated row 2.4 for native-lock lifetime proof, and requires a completed full suite before closing Phase 2. Phase 3 extends that safety boundary into saved-prompt and edit-preservation cases. Completed rows 1.1 and 1.2 remain intact. This re-plan does not claim any feature gate passed and does not modify runtime code or tests.

## Concrete native recovery defect

The top-level forced-cancellation probe showed a native child writing after SIGKILL removed its parent process group. The current stale-lock predicate treats a gone group as evidence permitting takeover. Same-group descendant fixtures do not cover a managed native child outside that group. Preserve mutation and relaunch exclusion while native-child ownership is unresolved. Concrete reconciliation or an actionable retained execution lock is required before accepting the feature. Preserve compatibility with existing flat-execution locks. [Native probe record](capabilities.md#codex-cancellation-and-forced-parent-termination)

The attempt to queue the new finding to the active step failed because `--ephemeral` left no persisted parent rollout. This is an observed feedback-delivery limitation and relevant context for native ownership recovery.

## Retained scope and acceptance

The plan's full-matrix pre-implementation gate was corrected after top-level probes established successful Codex desktop/headless collection and Claude headless nested collection. The complete normal-entry matrix still qualifies the final candidate and remains pending. Claude interactive reached nested spawning and then hit the account's weekly quota, resetting November 17, 2026, at 06:00 Europe/Warsaw. Continue implementation and deterministic gates while reporting these live limits truthfully.

The pipeline skill reserves `context/foundation/lessons.md` and `/10x-lesson` for the human. The revised plan routes any lesson candidate through the review/report and resolves the older lesson through the new shared rule and ADR amendment. Performance benchmarking remains deferred.
