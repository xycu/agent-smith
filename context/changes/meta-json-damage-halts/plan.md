# Halt on damaged run metadata implementation plan

## Overview

Give the shared router a strict metadata read so an existing damaged `meta.json` stops commands that would otherwise publish defaults or derive results from them. Preserve the existing diagnostic view in plain `status` and keep valid legacy metadata and fresh initialization compatible.

## Current State Analysis

The audit reproduced loss of the goal, isolation, archive intent and host when `next` replaced conflict-marked metadata with defaults. The current branch already protects logged runs in `mutationMeta` and reports their missing or damaged metadata in plain `status`. It still uses the same fallback for a missing file, invalid JSON, a non-object and filesystem read errors. The mutation guard depends on the presence of `run.jsonl`, so an interrupted initialization can leave a damaged metadata file eligible for overwrite. A read-only probe confirmed that the current reader returns the same fallback for conflict markers, JSON `null`, `EACCES` and `ENOENT`. [Audit notes](change.md) · [Metadata reader](../../../skills/10x-pipeline/scripts/state.mjs#L722) · [Existing guard](../../../skills/10x-pipeline/scripts/route.mjs#L63)

`init` publishes metadata before the first log entry and `next` may update it after reading results. `usage` and `status --report` use it to update reports, and late usage can commit archive state. `risk` uses saved context such as `baseSha`, while `compare` reads metadata from both located run folders for provenance and eligibility. Chain resolution also reads live or archived OpenSpec metadata before selecting a run, and both external runners use the shared reader for dispatch validation. [Initialization](../../../skills/10x-pipeline/scripts/route.mjs#L1079) · [Risk and comparison](../../../skills/10x-pipeline/scripts/route.mjs#L397) · [Chain discovery](../../../skills/10x-pipeline/scripts/route.mjs#L950) · [Dispatch validation](../../../skills/10x-pipeline/scripts/runner-dispatch.mjs#L13)

## Desired End State

- The metadata reader returns the caller's fallback only on `ENOENT`. Every JSON object, including a sparse legacy object, retains its current semantics and unknown fields. Invalid JSON, non-object JSON and other read failures carry a diagnostic naming the absolute path and failure kind. Empty and whitespace-only files count as invalid JSON.
- `init`, `next`, `usage` and `status --report` return exit 1 and the normal JSON `action: "halt"` for damage, regardless of log presence. The reason tells the user to preserve the damaged copy and inspect a verified copy from the same run before restoring and retrying. Include a project-relative `git show <sha>:./<path>` hint for files inside the project and omit raw metadata content. Halt before temp cleanup, result consumption, report generation, state publication or Git writes. Keep the existing missing-metadata guard for logged writers.
- Plain `status` keeps log-derived steps and providers visible when the chain is known. A damaged file sets `host` and `providerMode` to `null` and populates the existing `metadataProblem` field, including when the log is absent. An absent file on a logged run keeps the existing recovery diagnostic. `risk` and `compare` halt on damaged metadata they read, including either comparison side and either output format. Missing metadata retains the existing observational behavior.

### Key discoveries

- The damaged-log reader provides the recovery wording, no-raw-content diagnostic pattern and fixture coverage for byte-exact no-write behavior. [Log reader](../../../skills/10x-pipeline/scripts/state.mjs#L680) · [State tests](../../../skills/10x-pipeline/test/run-state.test.mjs#L365)
- Plain `status` already documents an explicit `--chain openspec` recovery path. Comparison uses provenance to decide eligibility, and damage prevents a trustworthy metadata-dependent result. [Provider recovery](../../../docs/REFERENCE.md#L19) · [Comparison](../../../skills/10x-pipeline/scripts/route.mjs#L553)
- Preparation and publication read saved identity separately through an already strict reader. Dispatch validation uses the shared reader and already refuses invalid identity, so its existing failure envelope can carry the new diagnostic. [Saved identity](../../../skills/10x-pipeline/scripts/run-identity.mjs#L94) · [Dispatch validation](../../../skills/10x-pipeline/scripts/runner-dispatch.mjs#L13)

## Scope limits

The scope is metadata read integrity and the resulting command diagnostics. The current on-disk format, atomic writers, lock protocol and existing per-field legacy interpretation remain in force. Recovery is user-controlled. Automated repair, reconstruction from the log, policy parser changes and standalone preparation or publication changes are outside this phase.

## Implementation Approach

Use one metadata read in the shared state layer to distinguish an absent file, an object, and a path-specific read or parse problem. Use the strict form by default and make diagnostic access explicit. Reuse the existing router JSON error boundary, existing missing-metadata guard and plain-status diagnostic field. Keep the generic JSON fallback for its other callers.

## Critical Implementation Details

### Chain discovery and state sequencing

If chain resolution needs damaged OpenSpec metadata, halt with its recovery diagnostic instead of treating the absent chain value as a reason to fall back to 10x. With explicit `--chain openspec`, plain `status` may diagnose a damaged live run, and `verify-archive` may still use its file-based checks and emit its usual archive verdict. Positive chain contradictions and existing live/archive precedence still apply, including a 10x name taking precedence over an archived OpenSpec name. A 10x archive verdict needs no metadata read of its own. [Resolver](../../../skills/10x-pipeline/scripts/route.mjs#L950) · [Archive verification](../../../skills/10x-pipeline/scripts/route.mjs#L308) · [Name ownership lesson](../../foundation/lessons.md)

Validate the selected run's metadata under the existing writer lock even if OpenSpec chain discovery read it earlier. `status --report` uses the validated metadata for report generation. Check metadata before writer effects, including the equal-figure return from `usage`. A metadata refusal is an early halt with no newly generated report and no rollback side effects. [Writer entry points](../../../skills/10x-pipeline/scripts/route.mjs#L991) · [Late usage](../../../skills/10x-pipeline/scripts/route.mjs#L814)

## Phase 1: Reject damaged metadata before routing or writing

### Overview

Deliver the reader, command handling, regression tests and recovery documentation together.

### Changes Required

#### 1. Shared reader

**File** `skills/10x-pipeline/scripts/state.mjs`

**Intent** Distinguish damage from absence at the metadata boundary, so readers and writers can act on reliable input.

**Contract** Keep the caller-supplied fallback on `ENOENT`, accept any JSON object and expose other failures through one diagnostic construction. Use stable reason categories for invalid JSON, expected object and filesystem failure. Keep parser excerpts and raw bytes out of diagnostics.

#### 2. Router and dispatch consumers

**Files** `skills/10x-pipeline/scripts/route.mjs` and the existing consumer `skills/10x-pipeline/scripts/runner-dispatch.mjs`

**Intent** Apply strict reading to metadata-dependent commands while preserving the plain-status recovery path.

**Contract** Cover mutation guards, `status`, `risk`, both comparison sides and OpenSpec chain discovery. Preserve output envelopes for the router and dispatch consumers, existing archived-name precedence and the explicit OpenSpec diagnosis and archive verification paths above. The shared strict read should propagate through runner validation before an existing dispatch can launch a child.

#### 3. Evidence and recovery reference

**Files** `skills/10x-pipeline/test/run-state.test.mjs`, `skills/10x-pipeline/test/providers.test.mjs`, `skills/openspec-pipeline/test/openspec-chain.test.mjs` as needed, and `docs/REFERENCE.md`

**Intent** Exercise the shared rule with existing scratch fixtures and put the recovery procedure beside damaged-log recovery.

**Contract** Extend existing suites for the cases below, keeping existing logged metadata protection and runner failure coverage. Audit documentation references to the older logged-only behavior. Update the provider recovery paragraph, shared state recovery section and OpenSpec chain resolution notes to agree on the halt boundary, diagnostic exceptions and recovery guidance.

### Success Criteria

#### Automated Verification

- The metadata reader distinguishes ENOENT from malformed JSON, non-object JSON and other filesystem errors, and accepts sparse objects.
- On both chains the four writing commands halt on damaged metadata with and without a log, preserving run-folder bytes, abandoned temps, pending results, Git HEAD, index and refs.
- Both chains initialize from absent metadata in a fresh change, keep the logged-missing guard, and accept valid sparse metadata.
- Plain status exposes metadata recovery, risk and both comparison formats halt on damage, and OpenSpec chain discovery preserves explicit recovery and archive ownership.
- The existing dispatch validator refuses damaged metadata before external execution, with its normal failure envelope.
- The repository test suite passes on Node 24 or later.

## Testing Strategy

### Unit tests

Cover truncated and conflict-marked JSON, empty or whitespace input, JSON `null`, array and scalar values, and a sparse object with unknown fields. Mock a filesystem error such as `EACCES` independently of filesystem permissions. Verify a fallback appears only for ENOENT and that diagnostics contain the path and stable reason without private fixture text.

### Integration tests

- Reuse the run-state scratch fixtures and byte-and-Git snapshots. On both chains, exercise the four writers against realistic damaged metadata, including a log-less initialization and a logged run with an existing report, pending result and owned temp files. For logged `usage`, also exercise an already-recorded equal figure. Assert the halt envelope, the attempted path, preservation guidance and the unchanged snapshots.
- Extend the existing provider status coverage to damage without a log and retain recorded provider visibility with a log. Exercise an inferred damaged OpenSpec run and its explicit recovery route, plus explicit OpenSpec archive verification and the 10x-name collision with an archived OpenSpec run. For `compare`, place damage on each side in turn and exercise JSON and Markdown. Run the existing fake-runner fixture with damaged metadata and assert it launches nothing. Fixture mutations affect scratch state only.
- Run focused checks with `node --test skills/10x-pipeline/test/run-state.test.mjs skills/10x-pipeline/test/providers.test.mjs skills/openspec-pipeline/test/openspec-chain.test.mjs`. Run the repository gate with `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`. All acceptance is local.

## Performance Considerations

The command already reads a single metadata file at each relevant boundary. Preserve those boundaries and use the existing lock for writer validation.

## Migration Notes

Ship the reader and caller changes together. Valid metadata is readable by both revisions and requires no data migration. Once the new router refuses damage, retries preserve the same evidence until the operator restores a verified same-run copy. For a software rollback, keep damaged runs paused or restore them before running the older router, since it can still apply defaults when the log is absent.

## Open Risks & Assumptions

- Low planning complexity and one phase are appropriate because one shared reader owns the defect, with local coverage for the affected consumers. The logged-provider safeguard and atomic publication order require testing the log-less window. [Audit](change.md) · [Writer entry point](../../../skills/10x-pipeline/scripts/route.mjs#L1079)
- Preserve plain `status` as an inspection tool because it already exposes recoverable log information. Choose strict `risk` and `compare` because their results depend on metadata. Preserve selected-chain archive verification because its verdict comes from archive files and folders. [Provider recovery](../../../docs/REFERENCE.md#L19) · [Risk and comparison](../../../skills/10x-pipeline/scripts/route.mjs#L397) · [Archive verification](../../../skills/10x-pipeline/scripts/route.mjs#L308)
- The user may have no usable committed metadata if initial publication never completed. Recovery guidance therefore asks for a verified same-run copy and treats the Git command as an inspection aid. [Existing recovery pattern](../../../docs/REFERENCE.md#state-publication-and-log-recovery)

## References

- [Change and audit reproduction](change.md)
- [State publication and log recovery](../../../docs/REFERENCE.md#state-publication-and-log-recovery)
- [Late usage commit lifecycle](../../../docs/ADR/ADR-019-late-usage-figure.md)
- [OpenSpec chain ownership](../../../docs/ADR/ADR-013-openspec-pipeline.md)

## Progress

> Convention `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Keep step titles stable.

### Phase 1: Reject damaged metadata before routing or writing

#### Automated

- [x] 1.1 The metadata reader distinguishes ENOENT from malformed JSON, non-object JSON and other filesystem errors, and accepts sparse objects. — d3756244
- [x] 1.2 On both chains the four writing commands halt on damaged metadata with and without a log, preserving run-folder bytes, abandoned temps, pending results, Git HEAD, index and refs. — d3756244
- [x] 1.3 Both chains initialize from absent metadata in a fresh change, keep the logged-missing guard, and accept valid sparse metadata. — d3756244
- [x] 1.4 Plain status exposes metadata recovery, risk and both comparison formats halt on damage, and OpenSpec chain discovery preserves explicit recovery and archive ownership. — d3756244
- [x] 1.5 The existing dispatch validator refuses damaged metadata before external execution, with its normal failure envelope. — d3756244
- [x] 1.6 The repository test suite passes on Node 24 or later. — d3756244
