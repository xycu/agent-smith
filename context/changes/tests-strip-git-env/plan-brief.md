# Strip inherited Git variables — Plan Brief

[Full implementation plan](plan.md)

## What & Why

Prevent Git-using tests from inheriting repository-selection variables from hooks, rebase commands or developer shells. A controlled reproduction passed its child test while adding three commits to a disposable victim repository and changing its refs.

## Starting Point

The shared `run` and `gitEnv` builders inherit every parent variable. Standalone builders and copied-router wrappers repeat that inheritance. The current OpenSpec contract test lives under `skills/openspec-pipeline/test/`.

## Desired End State

Test environment builders remove every inherited `GIT_` key before applying explicit fixture values. Child tests pass with hostile `GIT_DIR`, `GIT_WORK_TREE` and `GIT_INDEX_FILE`, individually and together, while an independent observer confirms the victim repository's HEAD, refs, index and complete file snapshot remain identical.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Shared owner | Export zero-argument `cleanEnv()` from the existing test helper | Both chains already consume this module | Change description and code research |
| Matching | Strip every inherited uppercase `GIT_` prefix | Git controls extend beyond the three reproduced selectors | Task |
| Override order | Filter inherited values, then add fixture overrides | Identity, config, dates and the `GIT_LOG` command audit depend on fixture values | Code research |
| Tools boundary | Filter locally in commit-lint's existing `GIT_ENV` | The change description permits a small local copy in tools tests | Change description |
| Additional wrappers | Clean direct router pass-through environments | These newer paths also execute Git-capable code | Code research and task ownership |
| Regression cost | Representative child suites plus a one-off full hostile suite | Provides repeatable safety coverage with bounded ordinary-suite overhead | Plan |

## Scope

The implementation covers shared helpers, four historical standalone test files, environment arguments in the three newer router wrappers, a new regression file and its test-index entry. `agents.test.mjs` changes are confined to its environment region. Dispatch-content assertions belong to the sibling agent-call change. CI, router persistence, run preparation, comparison behavior and wave-maintenance documentation retain their assigned owners.

## Architecture / Approach

Build a fresh sanitized parent environment in the existing helper and apply fixture values afterward. Reuse that export throughout skill tests and use a local filtered base in the tools fixture. Keep victim setup and observation independently sanitized, then deliberately inject hostile variables only at the child test boundary.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Sanitize shared and standalone test environments | Complete owned environment-site coverage with preserved fixture overrides | Filtering too late would erase intentional Git settings and shim logging |
| 2. Prove child-test isolation and victim integrity | Unit contracts, four hostile child scenarios and ordinary/full-hostile suite acceptance | A contaminated observer or skipped Git tests could mask repository mutation |

Node 24+ and Git are prerequisites. The existing OpenSpec CLI and live GitHub tests keep their current availability gates. Estimated effort is one implementation session across two phases.

## Open Risks & Assumptions

- The unattended task supplies the decision process for interview gates. Medium complexity and two phases are evidence-backed planning assumptions.
- Explicit ownership of test environment sites includes newer copied-router/provenance wrappers. Imports and environment arguments are the patch boundary within files containing sibling-owned assertions.
- The observed pre-fix reproduction ran on Node `v26.13.1` and Git `2.54.0`. Post-fix safety and full-suite proof belong to implementation.
- Victim repositories, child scratch directories and lock files stay under a disposable parent inside this run worktree. Independent snapshots include `.git` and worktree files.

## Success Criteria (Summary)

- Every inherited `GIT_` key is stripped while explicit fixture settings and non-Git values retain precedence.
- Required child Git tests execute and pass for each hostile selector and their combination, with unchanged victim snapshots.
- Both the ordinary suite and a complete combined-hostile suite pass, with tool-dependent skips recorded separately.

## References

- Requirements and fix direction in [change.md](change.md).
- Current ownership in [WAVES.md](../WAVES.md).
- File-level contracts, reproduction evidence and five pending automated criteria in [plan.md](plan.md).
