# Codex token accounting version floor — plan brief

[Full implementation plan](plan.md)

## What & Why

Codex CLI 0.171.0 steps currently finish without token totals because the collector accepts only 0.169.0. The recorded schema check verified 27 of 35 real step trees with a scratch collector. All eight remaining trees lacked a terminal completion record. [Change notes](change.md)

## Starting Point

The collector checks the root app-server version, each thread’s metadata and each rollout header. It already checks identities, snapshots, counters and completeness before producing a total.

## Desired End State

A complete 0.169.0 or 0.171.0 tree with reconcilable evidence reports verified tokens. Below-floor and malformed versions report `unsupported-host`. Malformed counters on supported versions report `unsupported-schema`, and incomplete captures retain their specific reason.

## Key Decisions Made

| Decision | Choice | Why |
| --- | --- | --- |
| Version rule | One reader-local predicate for strict X.Y.Z at or above 0.169.0 | Matches the reviewed-floor approach in Claude commit `fdf6a7e4` and keeps all three checks consistent. |
| Mixed versions | Qualify each input independently | Root, child and rollout versions can each be tested against the same floor. |
| Regression coverage | Update the runner’s 0.170.0 negative fixture alongside the collector tests | That release becomes eligible. A below-floor fixture still proves both chains settle successfully when counting fails. |

## Scope

The implementation covers the collector, its tests, the affected runner fixture, the README, the reference and the test index. Execution compatibility and prior ledger entries are outside scope.

## Architecture / Approach

Use built-in JavaScript to compare numeric release components. Eligible input proceeds through the existing reconciliation path. The runner continues to receive the version-1 evidence envelope.

## Phases at a Glance

| Phase | Deliverable | Key risk |
| --- | --- | --- |
| 1. Apply the reviewed floor | Change all three guards, test each independently and document the boundary. | A root-only test could miss a stale child or rollout pin. |

**Prerequisites** — Node 24+ and the repository fixtures. **Estimated effort** — one implementation phase.

## Open Risks & Assumptions

Strict X.Y.Z excludes prefixes, leading zeroes, whitespace and prerelease/build suffixes. Later releases may change their record shape. The collector must continue to return unavailable evidence when it cannot reconcile a tree.

## Success Criteria (Summary)

- The collector suite verifies exact totals at and above the floor, version refusals, and specific failure reasons for damaged newer captures.
- The runner suite preserves settlement and cleanup on both chains for an unsupported release.
- All three documentation entries state the inclusive accounting floor. Verification uses the two touched test files and a local documentation check.
