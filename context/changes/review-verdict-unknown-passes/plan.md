# Review Verdict Validation Implementation Plan

## Overview

Require a recognized 10x review verdict before the router verifies a review or uses it to advance a run. This closes the false-success paths for newly written reviews and for reviews already on disk when a run starts or resumes.

## Current State Analysis

`readReview` cuts the header at the first character outside its letter-and-space pattern. `attachResult` accepts every non-null verdict from a fresh artifact. `decide` handles selected negative verdicts and then falls through, including an `APPROVED` default for an unreadable implementation review. The CLI reproduces `done` for `NEEDS_ATTENTION`, `NEEDS-ATTENTION`, `NOT APPROVED` and `CHANGES REQUESTED`, `done` labeled `APPROVED` for `APPROVED-WITH-CHANGES` and for a pre-existing `## Verdict: REJECTED` without a log, and `implement` for `NEEDS REVISION`. [Reader](../../../skills/10x-pipeline/scripts/state.mjs#L332) · [Intake](../../../skills/10x-pipeline/scripts/flow.mjs#L573) · [Routing](../../../skills/10x-pipeline/scripts/flow.mjs#L681)

### Key Discoveries:

- Freshness and verdict validity are distinct. An absent or stale review ordinarily triggers a new review. A recorded lean plan-review skip is a separate policy decision. [Plan freshness](../../../skills/10x-pipeline/scripts/flow.mjs#L709) · [Implementation freshness](../../../skills/10x-pipeline/scripts/flow.mjs#L786)
- In an isolated run, `next` rolls back a failed review before routing. A failed confirmation can therefore reveal the previous successful review, while the exhausted confirmation cap lets routing advance on that older file. The current attempt's verdict failure must survive that decision point. [Result and rollback sequence](../../../skills/10x-pipeline/scripts/route.mjs#L83) · [Confirmation cap](../../../skills/10x-pipeline/scripts/flow.mjs#L635)
- OpenSpec already validates its separate `verify.md` vocabulary. An invalid artifact fails `os-verify` intake or halts when read for routing, and listed critical findings force `FAIL`. [OpenSpec verifier](../../../skills/openspec-pipeline/scripts/openspec.mjs#L84)

## Desired End State

Plan review accepts `SOUND`, `REVISE` and `RETHINK`. Implementation review accepts `APPROVED`, `NEEDS ATTENTION` and `REJECTED`. A review step with a missing or unknown verdict fails verification even when the agent reports `done`. An existing artifact selected for routing with an invalid verdict halts with the relative file path and the parsed value or an explicit missing-verdict diagnostic. `SOUND` or a tolerated `REVISE` can authorize implementation, along with the existing recorded plan-review skip. `APPROVED` or a `NEEDS ATTENTION` that clears the existing findings and confirmation gates can end the run as `done`.

## Scope

The change covers 10x review parsing, result intake, review-driven routing, CLI regression tests and the routing reference. Existing finding counts, review policy, tier calculations and archive formats remain the compatibility baseline.

## Implementation Approach

Define the two vocabularies once in the shared 10x router code. Use the same validation and diagnostic in result intake and when `decide` consumes a review from disk. Keep the parser responsible for extracting the whole verdict and keep retry, halt and success decisions with the router. One phase keeps these entry points and their local proof together.

### Planning assumptions

- Use the canonical space-separated spelling and reject underscore and hyphen aliases. The requested vocabularies are explicit, and the historical header fix supports formatting around a verdict. Preserve both bold-label forms, capitalization tolerance, leading emoji and explicitly delimited annotations such as brackets, a terminal period, parentheses and ` - see F1`. Require a delimiter for trailing prose so `APPROVED with changes` has a single, unambiguous reading as an unsupported phrase. [Change](change.md) · [Header compatibility plan](../../archive/2026-11-11-review-verdict-labels/plan.md)
- A malformed confirmation halts immediately after it fails verification. The existing cap counts failed confirmations, and the normal halt path restores the failed attempt for inspection. An ordinary malformed attempt can use the review step's existing bounded retry. [Confirmation cap](../../../skills/10x-pipeline/scripts/flow.mjs#L635) · [Halt recovery](../../../skills/10x-pipeline/scripts/route.mjs#L101)
- If a recognized blocking plan verdict is encountered while implementation rows remain after work has already started, halt for a human. The existing automated re-plan paths apply before implementation and the plan review must authorize any further implementation. [Plan review gates](../../../skills/10x-pipeline/scripts/flow.mjs#L743) · [Implementation scheduling](../../../skills/10x-pipeline/scripts/flow.mjs#L772)

## Critical Implementation Details

A newly failed ordinary review needs a retry even if a no-log start used the file timestamps before dispatching it. An earlier review or a lean skip must not turn that failed attempt into permission to advance. For a malformed confirmation, carry the intake diagnostic through the current `next` call and use the standard halt finalizer after rollback so an older valid review cannot mask it. On resume, evaluate the current artifact again so a corrected verdict can route through the existing findings gates.

## Phase 1: Validate verdicts before advancing

### Overview

Enforce the same review vocabularies at both router entry points, demonstrate the failure paths locally and document the accepted formats.

### Changes Required:

#### 1. Parse the whole verdict

**File** `skills/10x-pipeline/scripts/state.mjs`

**Intent** Preserve supported header formatting and retain unsupported spelling for diagnostics.

**Contract** Parse a complete verdict phrase on the labeled line with case normalization. Preserve explicit annotation boundaries and keep `_`, `-`, digits and extra words in the candidate when they form part of the verdict, so a recognized prefix such as `APPROVED` cannot stand in for `APPROVED-WITH-CHANGES`. A missing label or a header without a verdict reads as `null`. The reader preserves the findings and header-count behavior and still exposes historical verdict text independently of whether routing accepts it.

#### 2. Gate verification and routing

**Files** `skills/10x-pipeline/scripts/flow.mjs`, `skills/10x-pipeline/scripts/route.mjs`

**Intent** Reject unknown and missing verdicts at the points where a review could authorize work or completion, and preserve diagnostics across ordinary retries and confirmation halts.

**Contract** Maintain one accepted set per step kind. Intake requires both freshness and membership, records `verified: false` and `ok: false` for an invalid artifact, and omits the successful `review` record. Reuse the diagnostic channel for the reason shown on exhaustion of the normal retry path. A fresh existing invalid review considered by `decide` halts with the relative path, the unknown value or missing-verdict notice, and the accepted values. An absent or stale review can dispatch a fresh review, and a previously recorded applicable skip still counts as handled. An invalid selected review cannot become a skip. Keep `RETHINK` and non-tolerated `REVISE` on their existing pre-implementation re-plan or halt paths. If code work has already started and further implementation is needed, halt on a blocking plan verdict. Keep `REJECTED` on its fix or code re-plan path and preserve the `NEEDS ATTENTION` findings and confirmation gates. The `done` reason uses the actual validated verdict.

#### 3. Prove the contract through the CLI

**File** `skills/10x-pipeline/test/openfindings.test.mjs`

**Intent** Exercise both result ingestion and direct routing against scratch artifacts using the existing timestamp and log helpers.

**Contract** Add a parameterized implementation `next` test for `NEEDS_ATTENTION`, `NEEDS-ATTENTION`, `NOT APPROVED`, `CHANGES REQUESTED` and `APPROVED-WITH-CHANGES` with the reproduced counts. Assert the review entry failed, carries no successful review record, and schedules a review retry. Add an unknown plan verdict `NEEDS REVISION` through `next` with the same failure assertions, an `init` with no log and `## Verdict: REJECTED` asserting the missing-verdict halt, and fresh existing unknown plan and implementation reviews asserting the file and value in the halt. Cover a plan review dispatched from a pre-existing unreviewed plan, a wrong-kind verdict, a readable known verdict after correction, and exhaustion of retries with a verdict diagnostic. Exercise invalid confirmation with an earlier valid artifact restored by isolated rollback and assert the halt and preservation of the failed artifact. Cover a blocking plan verdict with partly completed automation. In the existing label-format test matrix, submit each positive fixture as the matching review kind and keep the existing valid routes covered by the suite.

#### 4. Document the accepted verdicts

**File** `docs/REFERENCE.md`

**Intent** Explain which verdicts route and how a malformed review affects a live run.

**Contract** In the review-routing section, name both accepted sets, document explicit annotation delimiters and the canonical spelling, and describe ordinary retry, malformed confirmation halt, and a halt on an invalid existing artifact. Search the repository docs for the old behavior and reconcile any current guidance affected by the change.

### Success Criteria:

#### Automated Verification:

- Verdict regressions and existing review routing pass with `node --test skills/10x-pipeline/test/openfindings.test.mjs`.
- The read-only archive reader comparison returns identical path, verdict, critical and warning tuples before and after the change.
- The full suite passes with `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`.

#### Manual Verification:

The phase's acceptance checks run locally before publication.

## Testing Strategy

Use `observe` and the existing CLI helpers for pending steps and explicit `init` fixtures for seeded or no-log resumes. Exercise format compatibility and case normalization alongside the rejected spellings. Keep legacy log entries intact and use the real router in an isolated scratch worktree for the rollback regression. The OpenSpec suite in the full gate covers its independent validation path. [Review tests](../../../skills/10x-pipeline/test/openfindings.test.mjs) · [Isolation tests](../../../skills/10x-pipeline/test/rollback.test.mjs)

## Performance Considerations

Validation adds a set membership check to the existing file reads.

## Migration Notes

Review skills and users write Markdown. The router reads it during result intake and routing, and owns the run log and outcome. Keep stored logs, review files and schemas intact. The change takes effect when the updated router evaluates a live review. For a halted legacy live artifact, resolve the review findings, use the correct canonical verdict and resume. Reverting the router commit also requires no data conversion.

The planning scan ran `readReview` over all 190 files matched by `context/archive/*/reviews/*.md`. Of those, 183 review files use the step's accepted vocabulary, four use historical out-of-set values, and three auxiliary files have no verdict. The historical values are plan `APPROVED` and `APPROVED WITH CHANGES`, and implementation `PASS` and `PASS WITH NOTES`. Preserve their parsed values for historical readability. Run this comparison command on the same archive tree before and after the code edits and compare both outputs. The planning snapshot on this worktree is `9b8d0af620d7dd8e4bf6929403e96aac1a2e3661e91b33779e9ee95f5c75b635`.

```sh
node --input-type=module <<'NODE'
import fs from "node:fs";
import { createHash } from "node:crypto";
import { readReview } from "./skills/10x-pipeline/scripts/state.mjs";

const files = fs.globSync("context/archive/*/reviews/*.md").sort();
const snapshot = files.map(file => {
  const { verdict, critical, warnings } = readReview(file);
  return [file, verdict, critical, warnings];
});
console.log(JSON.stringify({
  files: snapshot.length,
  sha256: createHash("sha256").update(JSON.stringify(snapshot)).digest("hex"),
}));
NODE
```

## References

- [Change and reproduced cases](change.md)
- [Prior header compatibility work](../../archive/2026-11-11-review-verdict-labels/plan.md)
- [Lessons on review evidence and documentation](../../foundation/lessons.md)
- [Routing reference](../../../docs/REFERENCE.md)

## Progress

> Convention. Leave new rows unchecked and append the closing commit SHA when they land. Keep row titles stable.

### Phase 1: Validate verdicts before advancing

#### Automated

- [ ] 1.1 Verdict regressions and existing review routing pass with `node --test skills/10x-pipeline/test/openfindings.test.mjs`.
- [ ] 1.2 The read-only archive reader comparison returns identical path, verdict, critical and warning tuples before and after the change.
- [ ] 1.3 The full suite passes with `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`.
