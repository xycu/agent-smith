# Commit-lint Merge-prefix verification — Plan Brief

[Full plan](plan.md)

## What & Why

Close the Wave 7 gap using the fix already integrated by `squash-merge-pr-title-lint`. Add persistent proof for an ordinary Merge-prefixed commit through the range CLI, then record completion evidence in this change.

## Starting Point

Remote and local main resolve to `45a7a5087f0298536ee9d74181846a503583bb4a` as verified on 2026-11-14. The relevant runtime, tests, and workflows match that baseline. Integration commit `a506d63` contains the inherited fix.

`lintSubject` rejects the reported text and `lintRange` already uses `git log --no-merges`. All 13 focused tests passed. An ephemeral scratch-repository CLI check also rejected the ordinary Merge-prefixed commit and named its hash and subject. Persistent tests currently cover direct subject rejection, title rejection, and real merge exclusion. The missing case is ordinary Merge-prefixed rejection through range mode.

## Desired End State

The CI command rejects an ordinary `Merge the two parsers into one` commit with an identifying diagnostic. A genuine merge remains excluded, and this change holds the baseline, inherited-fix reference, and actual verification outcomes.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Runtime ownership | Reuse `lintSubject` and `lintRange` | The current implementation already satisfies the required behavior. | Code research |
| Coverage | Extend the existing range-CLI failure coverage | The specific ordinary Merge-prefixed case currently reaches only unit and title tests. | Test research |
| Phase structure | One phase, LOW complexity | One fixture and change-local evidence cover the remaining work. | Plan and `complexity.json` |
| Direct-push scope | Apply the 2026-11-13 rescope | ADR-008 documents squash-only merging and the pull-request ruleset. | `change.md` and ADR-008 |
| Execution state | Three pending automated rows | Planning precedes persistent coverage and closure verification. | 10x-plan convention |

## Scope

Implementation edits belong in `tools/test/commit-lint.test.mjs` and this change's completion notes. Preserve the existing runtime, workflows, `WAVES.md`, archives, and router-owned state. The existing test-index entry covers the extended file.

## Architecture / Approach

CI calls the range CLI, which asks Git for non-merge commits and applies the shared validator. Extend the existing scratch-repository test using its hermetic Git environment and CLI helper, retain the real-merge and title regressions, run the required gates, then append the results to `change.md`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Complete range regression and closure evidence | Persistent range-CLI proof and dated change-local verification | A broad suite failure must be recorded accurately. |

Node 24+ and Git are the prerequisites. Estimated effort is one short implementation and verification pass, including the full repository suite.

## Open Risks & Assumptions

- The unattended instruction delegates interview and structure choices. The explicit rescope and high-confidence complexity assessment support one phase with zero substantive questions.
- The current-main observation is pinned to the SHA above. Future baseline changes require checking the affected files again.
- The full repository suite remains pending for implementation. Record its actual failures or skips before claiming closure.

## Success Criteria (Summary)

- The ordinary Merge-prefixed range case exits 1 and identifies the commit, while genuine merge exclusion and title-mode assertions pass.
- The focused checks and repository-required full suite pass with recorded outcomes.
- Completion evidence remains change-local and the final diff respects the scoped files and protected paths.

## References

- [Change and rescope](change.md)
- [Linter](../../../tools/commit-lint.mjs#L19) and [regression tests](../../../tools/test/commit-lint.test.mjs#L78)
- [ADR-008 Amendment 2](../../../docs/ADR/ADR-008-release-packaging-and-semver.md#L91)
