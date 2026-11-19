# Review Verdict Validation Implementation Plan

## Overview

Require a recognized 10x review verdict before the router verifies a review or uses it to advance a run. This closes the false-success paths for newly written reviews and for reviews already on disk when a run starts or resumes.

## Current State Analysis

Phase 1 landed in `636a5398`. The implementation review rejected that revision and applied five fixes in `49f6c36e`. The original reproductions below explain Phase 1. Phase 2 addresses the remaining interruption case, F6. [Implementation review](reviews/impl-review.md)

`readReview` cuts the header at the first character outside its letter-and-space pattern. `attachResult` accepts every non-null verdict from a fresh artifact. `decide` handles selected negative verdicts and then falls through, including an `APPROVED` default for an unreadable implementation review. The CLI reproduces `done` for `NEEDS_ATTENTION`, `NEEDS-ATTENTION`, `NOT APPROVED` and `CHANGES REQUESTED`, `done` labeled `APPROVED` for `APPROVED-WITH-CHANGES` and for a pre-existing `## Verdict: REJECTED` without a log, and `implement` for `NEEDS REVISION`. [Reader](../../../skills/10x-pipeline/scripts/state.mjs#L332) · [Intake](../../../skills/10x-pipeline/scripts/flow.mjs#L573) · [Routing](../../../skills/10x-pipeline/scripts/flow.mjs#L681)

### Key Discoveries:

- Freshness and verdict validity are distinct. An absent or stale review ordinarily triggers a new review. A recorded lean plan-review skip is a separate policy decision. [Plan freshness](../../../skills/10x-pipeline/scripts/flow.mjs#L709) · [Implementation freshness](../../../skills/10x-pipeline/scripts/flow.mjs#L786)
- In an isolated run, `next` rolls back a failed review before routing. A failed confirmation can therefore reveal the previous successful review, while the exhausted confirmation cap lets routing advance on that older file. Both `init` and `next` use success-only log lookups for freshness. A failed review can lose its authority to block routing, and a corrected first review can go unrecognized when there is no successful review entry. [Result and rollback sequence](../../../skills/10x-pipeline/scripts/route.mjs#L83) · [Resume entry point](../../../skills/10x-pipeline/scripts/route.mjs#L1114) · [Success-only lookup](../../../skills/10x-pipeline/scripts/state.mjs#L604)
- OpenSpec already validates its separate `verify.md` vocabulary. An invalid artifact fails `os-verify` intake or halts when read for routing, and listed critical findings force `FAIL`. [OpenSpec verifier](../../../skills/openspec-pipeline/scripts/openspec.mjs#L84)

## Desired End State

Plan review accepts `SOUND`, `REVISE` and `RETHINK`. Implementation review accepts `APPROVED`, `NEEDS ATTENTION` and `REJECTED`. A review step with a missing or unknown verdict fails verification even when the agent reports `done`. An existing artifact selected for routing with an invalid verdict halts with the relative file path and the parsed value or an explicit missing-verdict diagnostic. `SOUND` or a tolerated `REVISE` can authorize implementation, along with the existing recorded plan-review skip. `APPROVED` or a `NEEDS ATTENTION` that clears the existing findings and confirmation gates can end the run as `done`.

## Scope

The change covers 10x review parsing, result intake, review-driven routing, local CLI tests and the routing reference. Phase 2 covers timestamp restoration after post-reset state publication in the shared isolated-run rollback and undo. Earlier interruptions during Git operations or before the post-reset log is published require inspection of the existing recovery ref. Existing finding counts, review policy, tier calculations and archive formats remain the compatibility baseline.

## Implementation Approach

Phase 1 uses the same verdict validation and diagnostic at result intake and on resume. Phase 2 keeps recovery of file timestamps with the rollback code, before either chain makes a routing decision.

### Planning assumptions

- Treat F1–F5 as applied. The implementation review records their fixes and local verification against `49f6c36e`. Address the F6 window after post-reset state publication because an interruption there can advance the run on an earlier verdict. Use the failed step's existing log entry and recovery ref. ADR-010 requires timestamp restoration before routing and forbids repeating a completed rollback. [Findings and verification](reviews/impl-review.md) · [ADR-010](../../../docs/ADR/ADR-010-run-worktree-step-commits-and-rollback.md)

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

## Phase 2: Resume timestamp restoration after an interrupted rollback

### Overview

The reset checks out the earlier review, then `writeState` saves the failed result and its `rolledBack` ref before `setTimes` restores dispatch-time timestamps. If the process stops there, the next call skips rollback and can accept the checkout timestamp as evidence of a correction. The failed result and snapshot must survive a timestamp error, and a new router process must finish recovery before using the review. [Rollback ordering](../../../skills/10x-pipeline/scripts/isolation.mjs#L619) · [Verdict freshness check](../../../skills/10x-pipeline/scripts/flow.mjs#L550)

### Changes Required:

#### 1. Record which timestamps still need restoration

**Files** `skills/10x-pipeline/scripts/isolation.mjs`, `skills/10x-pipeline/scripts/route.mjs`, `skills/10x-pipeline/scripts/flow.mjs`, `docs/REFERENCE.md`

**Intent** Preserve both facts across a restart. The Git reset has finished, and the files it checked out can still have checkout timestamps.

**Contract** After the Git operations succeed, publish the restored `meta.json` before atomically publishing `run.jsonl` with its `rolledBack` or `kept` ref and pending timestamp checkpoint. The pending entry pins the target commit ID and the target times from `before.mtimes` for a rollback or `rb.left` for an undo. Replace the pending checkpoint with an explicit completed marker only after all eligible times are restored or their paths are confirmed as changed or absent. A missing marker identifies a legacy entry. Preserve the failed result, status fields, recovery ref ancestry and undo behavior for a rollback completed in the same call. [Timestamp paths and state writer](../../../skills/10x-pipeline/scripts/isolation.mjs#L527) · [Undo on halt](../../../skills/10x-pipeline/scripts/route.mjs#L51)

On `init` resume and `next`, recover a pending checkpoint in the shared `next` path under the existing run lock before result intake, commits, rollback or routing. Verify the run worktree and branch before writing timestamps. Use `startSha` or the pinned failed snapshot commit as the checkout source, even if a later commit advanced HEAD. Record a fingerprint of each relevant regular file's actual post-reset bytes in the checkpoint, so line-ending conversion or a later Git configuration change cannot make checkout contents appear edited. Record unreadable paths as unresolved and publish the pending checkpoint before reporting the error. Verify paths stay inside the run worktree and refuse timestamp writes through symlinks or to nonregular files. Keep this logic in isolation code. For unresolved paths, use a read-only comparison against the pinned checkout. Pass the same comparison into `decide` through its routing context for legacy entries. Resolve Git paths relative to the Git root even when the project is nested, account for checkout conversion, and distinguish confirmed absence from a failed Git lookup or unverifiable filter output. [Shared resume path](../../../skills/10x-pipeline/scripts/route.mjs#L1111) · [Project prefix](../../../skills/10x-pipeline/scripts/prepare-run.mjs#L352) · [Existing failure gates](../../../skills/10x-pipeline/scripts/flow.mjs#L745)

Restore a matching file's recorded time and preserve a changed file's bytes and mtime. A timestamp-only change while recovery is pending is ambiguous. If rollback restored the authoritative failed review from Git but `before.mtimes` recorded it absent, set the matching checkout's mtime to the failed attempt's start time. This covers tracked reviews that were locally deleted at dispatch. Freshness still requires a recognized verdict and an mtime newer than that start. Keep ordinary absent-file handling for paths with no restored checkout. [Timestamp recording](../../../skills/10x-pipeline/scripts/isolation.mjs#L527) · [Review freshness check](../../../skills/10x-pipeline/scripts/flow.mjs#L550)

On a comparison or timestamp error, retain the pending checkpoint and record a halt through the run finalizer with the step, affected path, recovery ref and instructions to fix the cause and retry. A resumed checkpoint performs timestamp work only. It preserves the recorded Git direction and ref through any later routing halt, allowing an owner to inspect the failed snapshot or correct a review after the original reset. Document the recovery boundary in the routing reference. [Run finalizer](../../../skills/10x-pipeline/scripts/flow.mjs#L327) · [Same-call undo](../../../docs/ADR/ADR-010-run-worktree-step-commits-and-rollback.md#failed-step-rollback)

#### 2. Exercise the interruption and the owner's correction separately

**Files** `skills/10x-pipeline/test/rollback.test.mjs`, `skills/10x-pipeline/test/openfindings.test.mjs`, `skills/openspec-pipeline/test/openspec-isolation.test.mjs`

**Intent** Demonstrate what a fresh router process sees after a partial restore, including when someone corrects the review before resuming.

**Contract** In real scratch worktrees, begin with a valid review, fail its confirmation and interrupt timestamp restoration after publication of both state files. Use fixed times and the existing child-process fault injection pattern. Cover interruption before the first timestamp and after a partial restore, including the corresponding `kept` boundary. Exercise both review kinds and both resume commands across the cases. Assert that a catchable restore error reports a halt with a pending checkpoint. Verify that the failed result, snapshot object ID, staged-only version and working-copy version survive repeated resumes without another reset or snapshot. Include a case where a subsequent local commit advances HEAD while recovery is pending. [Fault injection](../../../skills/10x-pipeline/test/result-persist.test.mjs#L107) · [Rollback fixtures](../../../skills/10x-pipeline/test/rollback.test.mjs#L98)

In the verdict tests, keep an unchanged confirmation halted. Add a failed review fixture whose tracked valid review was absent at dispatch and reappeared on reset, and verify that it stays ineligible as a correction. In a separate case, save a different valid review during interruption and prove its bytes and mtime survive recovery and its findings control routing. Cover a nested project with checkout line-ending conversion, an unreadable or redirected recovery target, completed-marker persistence, and a legacy entry with matching and subsequently corrected review contents. Extend the OpenSpec isolation fixture to interrupt recovery and check the times of `tasks.md` and `verify.md` before the next dispatch. Keep these checks in the existing focused suites and the full local gate. [Confirmation fixtures](../../../skills/10x-pipeline/test/openfindings.test.mjs#L809) · [OpenSpec isolation fixture](../../../skills/openspec-pipeline/test/openspec-isolation.test.mjs#L94)

**Applied findings to retain.** F1 gives failed confirmations priority over edits to Progress. F2 excludes Setext headings, list fences and HTML comments from the verdict header. F3 retains the prior code-failure tier bump on retry. F4 preserves an unsupported suffix after a long whitespace gap without repeatedly scanning the gap. F5 limits re-planning to the documented conditions and report rows to stored review records. Use the fixes and evidence in `49f6c36e` as the regression baseline. [Review decisions F1–F5](reviews/impl-review.md#findings)

### Success Criteria:

#### Automated Verification:

- Interrupted timestamp restoration resumes idempotently, preserves the failed snapshot and log, and halts safely on restoration errors in `node --test skills/10x-pipeline/test/rollback.test.mjs`.
- Both resume commands reject a restored confirmation and preserve a genuine correction through the findings gates in `node --test skills/10x-pipeline/test/openfindings.test.mjs`.
- Shared rollback and existing verdict regressions pass the full local suite with `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`.

#### Manual Verification:

All Phase 2 checks use local scratch worktrees and run before publication.

## Testing Strategy

Use `observe` and the existing CLI helpers for pending steps and explicit `init` fixtures for seeded or no-log resumes. Exercise format compatibility and case normalization alongside the rejected spellings. Keep legacy log entries intact and use the real router in an isolated scratch worktree for the rollback regression. The OpenSpec suite in the full gate covers its independent validation path. [Review tests](../../../skills/10x-pipeline/test/openfindings.test.mjs) · [Isolation tests](../../../skills/10x-pipeline/test/rollback.test.mjs)

## Performance Considerations

Validation adds a set membership check to the existing file reads.

## Migration Notes

Review skills and users write Markdown. The router reads it during result intake and routing, and owns the run log and outcome. Keep stored logs and review files intact and reuse the existing optional `invalid` field for new failed entries. For a halted live artifact, resolve the review findings, save a fresh review with the correct canonical verdict and resume. In an isolated run, commit the edit in the run worktree before resuming so a later failed step's rollback preserves the correction. [Rollback and resume](../../../docs/REFERENCE.md#L140)

Phase 2 writes a checkpoint on new rollback and undo operations. A completed marker uses the existing review freshness rule. When a legacy isolated review failure still governs routing, compare its otherwise valid and fresh review to the corresponding checkout source (`startSha` for `rolledBack`, the failed snapshot for `kept`). Matching bytes or an unverifiable checkout source leave freshness unproved. Keep the ordinary retry or confirmation halt and give the owner the path and reason. A distinguishable correction still goes through the usual findings gates. Historical entries and archives require no rewrite. Finish any pending checkpoint with the updated router before downgrading, since the earlier router skips entries marked `rolledBack` or `kept`. [Rollback eligibility](../../../skills/10x-pipeline/scripts/isolation.mjs#L569)

An interruption before post-reset log publication can leave state from the checkout. Inspect the existing snapshot before retrying. Its working tree contains the consumed result in `agent-smith/run.jsonl`, and its second parent retains the staged version. Document how the owner can inspect those snapshots for both chains before deciding how to resume through router-owned recovery. After checkpoint publication, recovery uses the pinned commit even if an ordinary halt was published and HEAD advanced. [Result intake ordering](../../../skills/10x-pipeline/scripts/flow.mjs#L640) · [Snapshot and state ordering](../../../skills/10x-pipeline/scripts/isolation.mjs#L602) · [Halt publication](../../../docs/ADR/ADR-017-run-branch-always-pushed-for-review.md)

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

### Phase 2: Resume timestamp restoration after an interrupted rollback

#### Automated

- [x] 2.1 Interrupted timestamp restoration resumes idempotently, preserves the failed snapshot and log, and halts safely on restoration errors in `node --test skills/10x-pipeline/test/rollback.test.mjs`. — 29db3c19
- [x] 2.2 Both resume commands reject a restored confirmation and preserve a genuine correction through the findings gates in `node --test skills/10x-pipeline/test/openfindings.test.mjs`. — 29db3c19
- [x] 2.3 Shared rollback and existing verdict regressions pass the full local suite with `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`. — 29db3c19
