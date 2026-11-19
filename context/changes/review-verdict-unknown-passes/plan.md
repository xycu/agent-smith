# Review Verdict Validation Implementation Plan

## Overview

Require a recognized 10x review verdict before the router verifies a review or uses it to advance a run. This closes the false-success paths for newly written reviews and for reviews already on disk when a run starts or resumes.

## Current State Analysis

`readReview` cuts the header at the first character outside its letter-and-space pattern. `attachResult` accepts every non-null verdict from a fresh artifact. `decide` handles selected negative verdicts and then falls through, including an `APPROVED` default for an unreadable implementation review. The CLI reproduces `done` for `NEEDS_ATTENTION`, `NEEDS-ATTENTION`, `NOT APPROVED` and `CHANGES REQUESTED`, `done` labeled `APPROVED` for `APPROVED-WITH-CHANGES` and for a pre-existing `## Verdict: REJECTED` without a log, and `implement` for `NEEDS REVISION`. [Reader](../../../skills/10x-pipeline/scripts/state.mjs#L332) · [Intake](../../../skills/10x-pipeline/scripts/flow.mjs#L573) · [Routing](../../../skills/10x-pipeline/scripts/flow.mjs#L681)

### Key Discoveries:

- Freshness and verdict validity are distinct. An absent or stale review ordinarily triggers a new review. A recorded lean plan-review skip is a separate policy decision. [Plan freshness](../../../skills/10x-pipeline/scripts/flow.mjs#L709) · [Implementation freshness](../../../skills/10x-pipeline/scripts/flow.mjs#L786)
- In an isolated run, `next` rolls back a failed review before routing. A failed confirmation can therefore reveal the previous successful review, while the exhausted confirmation cap lets routing advance on that older file. Both `init` and `next` use success-only log lookups for freshness. A failed review can lose its authority to block routing, and a corrected first review can go unrecognized when there is no successful review entry. [Result and rollback sequence](../../../skills/10x-pipeline/scripts/route.mjs#L83) · [Resume entry point](../../../skills/10x-pipeline/scripts/route.mjs#L1114) · [Success-only lookup](../../../skills/10x-pipeline/scripts/state.mjs#L604)
- OpenSpec already validates its separate `verify.md` vocabulary. An invalid artifact fails `os-verify` intake or halts when read for routing, and listed critical findings force `FAIL`. [OpenSpec verifier](../../../skills/openspec-pipeline/scripts/openspec.mjs#L84)

## Desired End State

Plan review accepts `SOUND`, `REVISE` and `RETHINK`. Implementation review accepts `APPROVED`, `NEEDS ATTENTION` and `REJECTED`. A review step with a missing or unknown verdict fails verification even when the agent reports `done`. An existing artifact selected for routing with an invalid verdict halts with the relative file path and the parsed value or an explicit missing-verdict diagnostic. `SOUND` or a tolerated `REVISE` can authorize implementation, along with the existing recorded plan-review skip. `APPROVED` or a `NEEDS ATTENTION` that clears the existing findings and confirmation gates can end the run as `done`.

## Scope

The change covers 10x review parsing, result intake, review-driven routing, CLI regression tests and the routing reference. Existing finding counts, review policy, tier calculations and archive formats remain the compatibility baseline.

## Implementation Approach

Define the two vocabularies once in the shared 10x router code. Use the same validation and diagnostic in result intake and when `decide` consumes a review from disk. Keep the parser responsible for extracting the whole verdict and keep retry, halt and success decisions with the router. One phase keeps these entry points and their local proof together.

### Planning assumptions

- Use the canonical space-separated spelling and reject underscore and hyphen aliases. The requested vocabularies are explicit, and the historical header fix supports formatting around a verdict. Use a standalone verdict line in the opening review header, with the explicit formatting forms in Phase 1. [Change](change.md) · [Header compatibility plan](../../archive/2026-11-11-review-verdict-labels/plan.md)
- A malformed confirmation halts immediately after it fails verification. The existing cap counts failed confirmations, and the normal halt path restores the failed attempt for inspection. An ordinary malformed attempt can use the review step's existing bounded retry. [Confirmation cap](../../../skills/10x-pipeline/scripts/flow.mjs#L635) · [Halt recovery](../../../skills/10x-pipeline/scripts/route.mjs#L101)
- If a recognized blocking plan verdict leaves implementation work to schedule after code work has started, halt for a human. Count any automated tick or executed `implement` or `fix` entry as work started, including a failed code attempt with zero ticks. Count either unchecked automated rows or rows reopened by `retryRows` as work to schedule. [Plan review gates](../../../skills/10x-pipeline/scripts/flow.mjs#L743) · [Implementation scheduling](../../../skills/10x-pipeline/scripts/flow.mjs#L772) · [Reopened rows](../../../skills/10x-pipeline/scripts/steps.mjs#L195)

## Critical Implementation Details

Persist the router's diagnostic on a failed intake as `last.invalid`, the field already surfaced by `status`. Record the reason when the review is missing, its verdict is invalid, or its artifact is too old to verify the attempt. Use the existing failure accounting and retain the subagent's note. Consult the recorded review failure before the success-only freshness and lean-skip rules. A newly failed ordinary review uses the existing retry limits, including when a no-log start used file timestamps before dispatch. When an attempt limit or the step budget stops that retry, include the diagnostic in the halt reason. A confirmation that fails this check halts through the standard finalizer after rollback, which keeps the failed artifact available for inspection.

On a later `init` or `next`, a missing, unchanged invalid, or restored older artifact continues to block advancement. An ordinary review can still retry within its limits. A current artifact with a recognized verdict and an mtime newer than the failed attempt's start can route through the normal findings and confirmation gates. Keep the failed history and apply the corrected file on subsequent calls while that failure is the latest review attempt of its kind for the same plan or code state. A later review or successful plan or code step supersedes this recovery path for its corresponding review. [Intake and diagnostic precedent](../../../skills/10x-pipeline/scripts/flow.mjs#L573) · [Halt finalizer](../../../skills/10x-pipeline/scripts/route.mjs#L101) · [Retry limits](../../../skills/10x-pipeline/scripts/route.mjs#L174) · [Status output](../../../skills/10x-pipeline/scripts/route.mjs#L720)

## Phase 1: Validate verdicts before advancing

### Overview

Enforce the same review vocabularies at both router entry points, demonstrate the failure paths locally and document the accepted formats.

### Changes Required:

#### 1. Parse the whole verdict

**File** `skills/10x-pipeline/scripts/state.mjs`

**Intent** Preserve supported header formatting and retain unsupported spelling for diagnostics.

**Contract** Read one standalone `**Verdict**:` or `**Verdict:**` line, bare or as a Markdown bullet, in the opening metadata before the first level-two or deeper heading or code fence. A missing, empty, nonverbal or duplicate header reads as `null`. Ignore labels quoted in prose or code. Trim outer whitespace, allow leading emoji, and normalize case. Allow a matching bracket pair around the verdict, a terminal period, a complete whitespace-prefixed parenthetical annotation, or a spaced hyphen followed by annotation text. Require the supported formatting to account for the rest of the line. Keep other characters and words in the candidate, including `_`, attached hyphens, digits, unbalanced delimiters and undelimited prose. For example, `APPROVED-WITH-CHANGES` and `APPROVED with changes` remain unsupported phrases. Preserve the findings, header counts and parsed historical verdicts independently of whether routing accepts the verdict.

#### 2. Gate verification and routing

**Files** `skills/10x-pipeline/scripts/flow.mjs`, `skills/10x-pipeline/scripts/route.mjs`

**Intent** Reject unknown and missing verdicts at the points where a review could authorize work or completion, and preserve diagnostics across ordinary retries and confirmation halts.

**Contract** Maintain one accepted set per step kind. Intake requires both freshness and membership, records `verified: false` and `ok: false` for an invalid artifact, and omits the successful `review` record. Apply the retry, halt and recovery rules in Critical Implementation Details. A fresh existing invalid review considered by `decide` halts with the relative path, the unknown value or missing-verdict notice, and the accepted values. Outside recovery from a recorded failure, an absent or stale review can dispatch a fresh review, and a previously recorded applicable skip still counts as handled. Keep `RETHINK` and non-tolerated `REVISE` on their existing re-plan or halt paths before code work starts. Once code work has started, apply the blocking plan verdict gate to the same unchecked or reopened rows that would schedule an implementation step. Halt before choosing a code re-plan, retry, executor or plain implementation in that branch. Keep `REJECTED` on its fix or code re-plan path and preserve the `NEEDS ATTENTION` findings and confirmation gates. The `done` reason uses the actual validated verdict.

#### 3. Prove the contract through the CLI

**File** `skills/10x-pipeline/test/openfindings.test.mjs`

**Intent** Exercise both result ingestion and direct routing against scratch artifacts using the existing timestamp and log helpers.

**Contract** Use the existing CLI helpers to cover these cases.

- Parameterize implementation `next` for `NEEDS_ATTENTION`, `NEEDS-ATTENTION`, `NOT APPROVED`, `CHANGES REQUESTED`, `APPROVED-WITH-CHANGES` and `APPROVED with changes` with the reproduced counts. Assert a failed entry with no successful review record and a review retry. Use the same assertions for plan `NEEDS REVISION`, a wrong-kind verdict, and an attempt from a pre-existing unreviewed plan.
- Assert the missing-verdict halt for a no-log `init` with only `## Verdict: REJECTED` and for verdict examples quoted in body prose or a code fence. Check that an unknown existing plan or implementation verdict reports the path and value. Extend the existing header matrix with case normalization, malformed delimiters and duplicate header lines, and submit each positive fixture as the matching review kind.
- Assert the verdict diagnostic when ordinary review retries hit the attempt cap or the step budget. Exercise a malformed confirmation after an earlier valid review in an isolated run. Verify that rollback cannot advance the run, the failed artifact is preserved, and an unchanged resume remains halted. Include a confirmation that leaves the earlier valid file untouched.
- Resume after correcting a first plan review and a first implementation review with no successful review entry of that kind. Assert that the normal findings gates use the corrected verdict. Drive the corrected plan review through another routing call after implementation to show that the correction remains eligible.
- Assert that a blocking plan verdict halts when implementation has partially completed, when the only remaining work is a reopened row, and when a logged code attempt left zero ticks. Preserve existing routes for valid verdicts.

#### 4. Document the accepted verdicts

**File** `docs/REFERENCE.md`

**Intent** Explain which verdicts route and how a malformed review affects a live run.

**Contract** In the review-routing section, name both accepted sets, document the standalone header and accepted delimiters, and describe ordinary retries, confirmation halts, invalid existing artifacts and how to resume after correction. Document the blocking plan verdict gate for unchecked and reopened implementation rows. Search the repository docs for the old behavior and reconcile any current guidance affected by the change.

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

Review skills and users write Markdown. The router reads it during result intake and routing, and owns the run log and outcome. Keep stored logs and review files intact and reuse the existing optional `invalid` field for new failed entries. The change takes effect when the updated router evaluates a live review. For a halted live artifact, resolve the review findings, save a fresh review with the correct canonical verdict and resume. In an isolated run, commit the edit in the run worktree before resuming so a later failed step's rollback preserves the correction. Reverting the router commit requires no data conversion. [Rollback and resume](../../../docs/REFERENCE.md#L140)

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

- [x] 1.1 Verdict regressions and existing review routing pass with `node --test skills/10x-pipeline/test/openfindings.test.mjs`. — 636a5398
- [x] 1.2 The read-only archive reader comparison returns identical path, verdict, critical and warning tuples before and after the change. — 636a5398
- [x] 1.3 The full suite passes with `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`. — 636a5398
