# Keep short run prefixes from hiding PR bases

[Full implementation plan](plan.md)

## What & Why

With `isolation.branchPrefix: "ma"`, `open-pr` can discard `main` during automatic base selection. The run may open against another ancestor or skip publication if every base candidate is rejected. [Change definition](change.md)

## Starting Point

The publisher uses one prefix filter for remote ancestors, the local symbolic remote HEAD and GitHub's reported default. Isolation accepts free-form prefixes and uses saved branch identities on resume. [Publisher](../../../skills/10x-pipeline/scripts/open-pr.mjs#L205) · [Run identity](../../../skills/10x-pipeline/scripts/run-identity.mjs#L38)

## Desired End State

`main` stays eligible with prefix `ma`, a default `develop` stays eligible with prefix `dev`, and an ancestor named `release/1.x` stays eligible with prefix `release`. The nearest eligible ancestor still wins, with the existing tie-breaker and fallback order. Explicit `--base` takes precedence.

## Key Decisions Made

| Decision | Choice | Why |
| --- | --- | --- |
| Policy compatibility | Keep free-form prefixes and saved branch identity rules. | Existing projects and resumed runs can use the fix without changing their configuration. |
| Ambiguous names | For prefixes without a trailing slash or hyphen, use exact default-branch evidence or rule out a run based on the first character after the prefix. | `ma` plus the valid ID `in` produces `main`, and saved run names can have additional suffixes. |
| Established run namespaces | Keep the exclusions for separator-ended prefixes and `agent-smith/`. | The current fallback tests and publication contract reserve those namespaces. |

## Scope

The change covers automatic publisher base eligibility, regression tests and publication documentation. Branch setup, saved identity and push behavior keep their existing contracts.

## Architecture / Approach

Use one eligibility rule for all three automatic paths. Default evidence comes from the configured default list, the selected remote's symbolic HEAD, or GitHub's result at the final fallback. Every automatic candidate still passes Git ref validation and the current-branch exclusion.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Keep ordinary branches eligible as PR bases | Updated selection, offline tests and matching reference and ADR text. | A saved run can have a suffix after its change ID and must still be filtered. |

**Prerequisites** Node 24+, Git and the existing local fixture harness.  
**Estimated effort** One small implementation and verification session.

## Open Risks & Assumptions

- A non-default name that can also identify a run remains ambiguous. The existing `--base` flag selects it explicitly.
- A trailing slash or hyphen is treated as a namespace boundary for this change, consistent with the delimiter convention in the change definition and existing namespaced coverage.

## Success Criteria (Summary)

- Local publication regressions demonstrate the collision before the fix and verify the selected base through all three automatic paths, while preserving override and run exclusions.
- The full Node suite and `git diff --check` pass. All acceptance runs locally using the existing fixtures.

## References

- [Full plan and test matrix](plan.md)
- [Existing fallback coverage](../../../skills/10x-pipeline/test/open-pr.test.mjs#L964)
- [Publication contract](../../../docs/ADR/ADR-017-run-branch-always-pushed-for-review.md#amendment-3--publish-the-validated-configured-branch-2026-11-16)
