# Router coverage and failed rollback undo plan brief

[Full implementation plan](plan.md)

## What & Why

Expose native Node coverage in CI and protect the recovery pointer emitted when undoing a failed-step rollback fails. The tests must prove that the displayed snapshot ref actually holds the user's partial work.

## Starting Point

CI runs the full suite on Node 24. Existing rollback tests cover successful undo for ordinary halts and router exceptions. Planning verification passed 1,476 tests with three expected skips. A focused coverage probe passed all 19 tests and confirmed that built-in coverage includes spawned-router modules.

## Desired End State

Each CI log contains the per-module coverage table and uncovered ranges. Four deterministic cases cover both undo reset failures at both halt callers, asserting caller-specific recovery text, the exact ref and preserved tracked/untracked edits. A change-local evidence document holds baseline/final tables, recovery-gap triage and the live CI URL.

## Key Decisions Made

| Decision | Choice | Evidence |
| --- | --- | --- |
| Coverage mechanism | Native `--experimental-test-coverage` in the existing suite command | The task's primary direction and the successful focused probe. |
| Coverage floor | Observational measurement during this change | The task explicitly defers an initial threshold. |
| Recovery matrix | Two halt callers multiplied by two failed reset operations | `undoRollback` has distinct hard-reset and mixed-reset failure exits. |
| Test technique | A local Git wrapper forwards real commands and fails the targeted undo command | Existing `stepcommit.test.mjs` convention. |
| Failure proof | Assert original context, exact ref, snapshot contents and HEAD position | The ref is the recovery pointer, and the mixed-reset path provides an explicit repair command. |
| Evidence location | This change's `coverage-evidence.md` | Wave 6 owns the CI test command and existing rollback test file. |
| Runtime fallback | Use same-runner timings to evaluate a second coverage step with `continue-on-error: true`, keeping the ordinary suite required | Setup and both runs must fit the existing 15-minute job limit, and coverage acceptance needs a completed passing run and table. |

## Scope

Implementation reaches `.github/workflows/ci.yml` in its test command region, `skills/10x-pipeline/test/rollback.test.mjs` and this change's artifacts. Additional uncovered recovery gaps receive an owner and disposition in the coverage inventory under the Wave 6 rules.

## Architecture / Approach

Keep the current CLI-driven test architecture and fixture helpers. First measure the full suite, then add the four failure cases and measure again. Inject failure only after the snapshot exists and the initial rollback succeeds. The wrapper and marker live outside the fixture's linked worktree, and only the router child receives the modified `PATH`.

## Phases at a Glance

| Phase | Deliverable | Main risk |
| --- | --- | --- |
| 1. Native CI coverage and baseline | Coverage flag, full initial table, recovery inventory and comparable timings | A focused probe cannot establish whole-suite overhead. |
| 2. Failed undo and final evidence | Four real-CLI cases, snapshot assertions, final table and CI acceptance | An overly broad injector could fail the initial rollback and miss undo entirely. |

Node 24, Git and the CI-selected OpenSpec contract CLI are the verification prerequisites. Expected implementation effort is one focused coding pass followed by full-suite runs and CI acceptance.

## Open Risks & Assumptions

- Standard rigor and two phases are assumed from the bounded Wave 6 scope and real Git recovery sequencing. The unattended instruction delegates interview and structure decisions to researched judgment.
- The focused probe measured `route.mjs` at 45.37% lines, `flow.mjs` at 68.13%, `steps.mjs` at 61.32% and `isolation.mjs` at 67.82%. Phase 1 establishes full-suite figures.
- Planning probe duration was 24,677 ms while another suite ran concurrently. Full-suite comparison and TrueNAS timing establish overhead.
- Shell-based injection follows the existing Windows skip convention. Linux CI must execute all four cases.
- Live CI evidence remains an acceptance row for implementation.

## Success Criteria Summary

- The full CI log exposes coverage for the shared router and OpenSpec modules.
- Both halt callers retain recovery text and a readable snapshot ref when either undo reset fails.
- The evidence document records initial/final tables, all requested recovery-range dispositions and the live CI result.

## References

- [Task](change.md) and [Wave ownership](../WAVES.md).
- `skills/10x-pipeline/scripts/route.mjs:51`, `:101` and `:1056` define the undo and callers.
- `skills/10x-pipeline/test/rollback.test.mjs:296` and `:339` provide the successful-undo fixtures.
- `skills/10x-pipeline/test/stepcommit.test.mjs:416` supplies the Git-wrapper convention.
