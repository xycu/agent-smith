# Halt on damaged run metadata — Plan Brief

[Full implementation plan](plan.md)

## What & Why

`meta.json` stores a run's goal, isolation, host, archive intent and provenance. A damaged file can be read as absent, exposing it to replacement with defaults before the run has a log. The router should preserve the file and help the operator recover.

## Starting Point

The router already refuses missing or damaged metadata for logged writers. Its shared reader still returns a fallback for both damage and absence. Metadata can exist before the first log entry, so the presence of `run.jsonl` leaves a gap. [Audit](change.md) · [Existing metadata guard](../../../skills/10x-pipeline/scripts/route.mjs#L63)

## Desired End State

Both chains reject damaged metadata before writer effects. The halt names the file and advises preserving it and inspecting a verified same-run copy. Operators can still inspect recorded steps through plain `status` when the chain is known. Fresh and legacy runs retain their existing behavior.

## Key Decisions Made

| Decision | Choice | Rationale |
| --- | --- | --- |
| Missing file | The reader uses the fallback only on ENOENT. A logged writer keeps its existing missing-metadata guard. | Fresh initialization needs the fallback, and an existing run needs its identity. |
| Damage | Malformed JSON, a non-object JSON value or another filesystem read error produces a path-specific diagnostic. | Those failures can mask saved state and lead to incorrect defaults. |
| Read-only commands | Plain `status` exposes `metadataProblem` and log-derived data. `risk` and `compare` halt on damage they encounter. | Status already provides a recovery view. Risk and comparison use metadata in their results. |
| OpenSpec selection | Halt if discovery needs damaged metadata. Keep explicit `--chain openspec` available for plain status and file-based archive verification under existing ownership rules. | A bad metadata read cannot establish which chain owns the run. An explicitly selected OpenSpec archive can be verified from its files and folders. |
| Compatibility | Keep sparse legacy objects and the existing on-disk format. | Reader validation needs only the existing object contract. |

## Scope

The shared metadata reader, its router and dispatch consumers, local regression tests and the routing reference are in scope. Recovery remains operator-controlled. Automated reconstruction, policy parsing changes and standalone preparation or publication changes are outside the phase.

## Architecture / Approach

The state layer distinguishes absence, valid input and damage. The router uses the existing halt envelope for strict callers and the existing `metadataProblem` field for diagnostic status. Writers validate under the existing lock before cleaning temps, consuming results, publishing state or writing Git state.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Reject damaged metadata before routing or writing | Reader, command handling, recovery instructions and local regressions | A logged-only guard misses interrupted initialization. Implicit OpenSpec discovery must avoid silently selecting 10x on damage. |

**Prerequisites** Node 24 or later and local Git for scratch fixtures.  
**Estimated effort** One focused implementation session.

## Open Risks & Assumptions

- Plain status already serves as a recovery view. OpenSpec users can explicitly select their chain when a damaged file makes inference unsafe. [Provider recovery](../../../docs/REFERENCE.md#L19)
- A run interrupted before its first commit may lack a committed copy. Preserve its damaged bytes and inspect a verified copy from the same run if one exists. [State recovery](../../../docs/REFERENCE.md#state-publication-and-log-recovery)
- Valid data needs no migration. A rollback to an older router reopens the original log-less window for damaged runs.

## Success Criteria (Summary)

- The four writing commands halt before changing files or Git state, with or without a log. Fresh missing metadata and sparse legacy objects still work.
- Diagnostic status, strict risk and comparison, explicit OpenSpec recovery and dispatch refusal are exercised locally.
- The routing reference documents recovery and the repository test suite passes locally.

## References

- [Change and audit reproduction](change.md)
- [Shared recovery documentation](../../../docs/REFERENCE.md#state-publication-and-log-recovery)
- [Existing byte-preservation fixtures](../../../skills/10x-pipeline/test/run-state.test.mjs#L365)
