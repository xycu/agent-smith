# Compare Failed Attempts — Plan Brief

Read the [full implementation plan](plan.md) for file contracts, regression cases, and execution Progress.

## What & Why

Compare currently counts failed advisory score attempts as failures. The router's shared `isFailure` predicate treats them as neutral. Reusing that predicate makes the JSON count and Markdown row agree with the router's failure classification.

## Starting Point

`readSide` calculates both arms, and Markdown already renders the resulting pair. The shared predicate, black-box CLI fixtures, and failure-count coverage already exist. One scorer fixture explicitly expects the current buggy count.

## Desired End State

A side containing a failed advisory score, a failed implement, and a failed fallback reports one failure in both formats. A failed cheap first attempt counts as a failure. Every executed entry's usage contributes to totals and coverage checks.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Failure definition | Import and reuse `isFailure` in compare | One existing predicate owns neutral-entry classification. | Change requirements and `state.mjs:531` |
| Cheap failure | Include it in `failedAttempts` | ADR-010 limits its neutrality to rigor and budget and measures failed implement attempts. | ADR-010, lines 64, 87, 164 |
| Public output | Use the existing per-side count and Markdown row | Both formats already share the pair object. | `route.mjs:603` |
| Compatibility proof | Assert ordinary failures in a pinned baseline and flag-absent legacy entries | These are existing supported inputs. | Existing compare fixtures |
| Documentation | Update the reference section and ADR-007's conflicting sentence | Both currently describe the affected behavior. | Documentation search and lessons register |
| Execution | One low-complexity phase | The existing aggregation seam and CLI helpers cover the whole change. | Unattended planning decision |

## Scope

The phase covers the compare import and aggregation, existing compare tests and their index row, the reference documentation, and ADR-007's compare sentence. Wave 4 ownership confines the runtime edit to compare behavior in `route.mjs`.

## Architecture / Approach

Each side follows the existing path from log reading through executed-entry selection to `isFailure` counting. JSON and Markdown consume that shared side object. Fixtures verify advisory and fallback neutrality, cheap-failure inclusion, pinned baseline compatibility, and usage completeness.

## Phases at a Glance

| Phase | Deliverable | Key risk |
| --- | --- | --- |
| 1. Share compare failure classification | Shared predicate, regression coverage, and metric documentation | The old scorer assertion and ADR-007 sentence encode the superseded count. |

Node 24+ and the existing test helpers provide the prerequisites. Estimated effort is one small implementation phase plus the required suite run.

## Open Risks & Assumptions

- Cheap failures count under the accepted ADR-010 semantics. This is the evidence-backed unattended choice.
- A log's recorded neutral flags govern classification, including older entries with absent flags.
- Compare aggregates failures across executed step types. ADR-010's implement-specific measurement can use the recorded step details when other ordinary step failures occur.
- Historical saved comparison output reflects the implementation that produced it. A new compare invocation recalculates counts from the log.

## Success Criteria (Summary)

- Advisory score failures and fallbacks contribute zero, and failed cheap attempts contribute one in both output formats.
- Pinned baselines retain their established ordinary-failure counts, token totals, and verdict behavior.
- Focused CLI tests, the required full suite, and documentation checks pass before the implementation phase completes.

## References

- [Change requirements](change.md) and [full plan](plan.md).
- [Wave ownership](../WAVES.md) and [lessons register](../../foundation/lessons.md).
- Shared predicate at `skills/10x-pipeline/scripts/state.mjs:531` and compare count at `skills/10x-pipeline/scripts/route.mjs:490`.
- ADR-010's cheap-failure semantics and ADR-007's compare-specific statement, cited in the full plan.
