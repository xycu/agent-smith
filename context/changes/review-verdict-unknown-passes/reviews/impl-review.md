<!-- IMPL-REVIEW-REPORT -->
# Implementation Review — Review Verdict Validation Implementation Plan

- **Plan**: [plan.md](../plan.md)
- **Scope**: Full plan
- **Reviewed phases**: 1
- **Date**: 2026-11-19
- **Verdict**: REJECTED
- **Findings**: 2 critical, 2 warnings, 2 observations

The verdict and finding counts describe the implementation at `636a5398` before review fixes.

## Verdicts

| Dimension | Verdict |
| --- | --- |
| Plan Adherence | FAIL |
| Scope Discipline | PASS |
| Safety & Quality | FAIL |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Review coverage

Phase 1 had three completed Automated rows and zero Manual rows. The review traced the reader, intake, rollback, both resume entry points, confirmation routing, and the gate for unchecked and reopened rows. It also checked OpenSpec's separate verdict validation and the routing reference. The characterization fixture change covers the planned post-start `RETHINK` halt.

The pre-fix focused suite passed all 164 existing tests. Seven CLI regression cases reproduced the confirmation-ordering, parser-boundary and tier regressions against the reviewed implementation. [CLI fixtures](../../../../skills/10x-pipeline/test/openfindings.test.mjs)

The read-only comparison used the same 190 files with the pre-implementation, reviewed and corrected readers. All path, verdict, critical and warning tuples matched exactly. SHA-256 matched the [planning snapshot](../plan.md#migration-notes) at `9b8d0af620d7dd8e4bf6929403e96aac1a2e3661e91b33779e9ee95f5c75b635`.

The plan-drift and safety passes were completed by separate read-only reviewers. The enclosing review reconciled both sets of findings and ran the verification. Child-inclusive token coverage is unknown.

## Findings

### F1 — A malformed confirmation can be bypassed by a Progress edit

- **Severity**: CRITICAL
- **Impact**: MEDIUM. The fix changes routing order across both review kinds.
- **Dimension**: Safety & Quality
- **Location**: `skills/10x-pipeline/scripts/flow.mjs:735`, `:840` at `636a5398`
- **Detail**: On resume, a failed plan confirmation that removed `## Progress` sent the isolated run to a new plan step. A failed implementation confirmation that reopened a row dispatched implementation in a non-isolated run. Both branches ran before checking the recorded confirmation failure.
- **Fix**: Evaluate review recovery before branches that can schedule work from the edited plan. Give outstanding confirmation failures priority and route successful corrections through the existing gates.
  - Result intake and resume use the same persisted diagnostic.
  - An outstanding verdict failure must be resolved before unrelated plan or code work can resume.
  - Separate CLI cases exercise both plan and implementation confirmations.
  - F6 covers interruption during rollback.
- **Decision**: APPLIED in `49f6c36e`.

### F2 — Examples and comments can supply a passing verdict

- **Severity**: CRITICAL
- **Impact**: LOW. The fix is confined to the verdict reader and CLI fixtures.
- **Dimension**: Plan Adherence
- **Location**: `skills/10x-pipeline/scripts/state.mjs:332` at `636a5398`
- **Detail**: Four no-log cases supplied `APPROVED` without a standalone metadata verdict. The reader accepted it after a Setext H2, as a Setext H2 itself, inside a list item's fenced code, and inside an HTML comment.
- **Fix**: Stop at level-two heading and fence boundaries, including Setext H2 and list-prefixed fences. Ignore comment content and keep archive tuple compatibility.
- **Decision**: APPLIED in `49f6c36e`.

### F3 — Implementation-review retries lose the prior code failure bump

- **Severity**: WARNING
- **Impact**: LOW. The fix reuses the existing implementation-review dispatch logic.
- **Dimension**: Pattern Consistency
- **Location**: `skills/10x-pipeline/scripts/flow.mjs:719`, `:853` at `636a5398`
- **Detail**: After an implementation failure, the initial review included `hardChangeReviewerBump`. An ordinary invalid-verdict retry built its own dispatch with a zero bump, overriding the tier baseline required by the plan.
- **Fix**: Use the same dispatch calculation for initial and retry implementation reviews and carry the verdict diagnostic on the retry.
- **Decision**: APPLIED in `49f6c36e`.

### F4 — Annotation scanning stalls on repeated whitespace

- **Severity**: WARNING
- **Impact**: LOW. The fix changes one delimiter match and trims its prefix.
- **Dimension**: Safety & Quality
- **Location**: `skills/10x-pipeline/scripts/state.mjs:343` at `636a5398`
- **Detail**: The unanchored whitespace run tried every suffix of a long gap when no annotation followed. Reading a verdict with 30,000 internal spaces and an unsupported trailing word took about 9.4 seconds in the comparison. The corrected reader kept the entire unsupported candidate and completed the same input in under 1 ms.
- **Fix**: Match one whitespace character adjacent to the delimiter and trim the candidate after removing a valid annotation.
- **Decision**: APPLIED in `49f6c36e`.

### F5 — The reference overstates re-plan and report behavior

- **Severity**: OBSERVATION
- **Impact**: LOW. The fix updates current routing and reporting descriptions.
- **Dimension**: Plan Adherence
- **Location**: `docs/REFERENCE.md:101`, `:172`, `:383` at `636a5398`
- **Detail**: The reference described old re-plan paths without the post-start guard and described a findings row for every ended review. Invalid intake leaves no stored review record, even if a correction is later read from disk.
- **Fix**: Qualify the pre-implementation re-plan paths and document that the report includes steps with a stored review record.
- **Decision**: APPLIED in `49f6c36e`.

### F6 — Interrupted rollback can leave a misleading review timestamp

- **Severity**: OBSERVATION
- **Impact**: HIGH. A fix would change the shared rollback recovery protocol.
- **Dimension**: Safety & Quality
- **Location**: `skills/10x-pipeline/scripts/isolation.mjs:619` at `636a5398`
- **Detail**: Rollback persists its completion marker before restoring timestamps, which protects the log if timestamp restoration fails. Interruption between those operations can leave a restored review with a fresh checkout timestamp even though the owner made no correction. This was identified by tracing the ordering.
- **Fix**: A follow-up can make timestamp restoration resumable while preserving the failed snapshot and distinguishing restored files from valid corrections.
- **Decision**: PENDING because this requires a shared rollback change. The owner must decide whether to scope a follow-up for interruption recovery and choose the checkpoint contract.

## Verification after fixes

- `node --test skills/10x-pipeline/test/openfindings.test.mjs` passed all 170 tests.
- The archive reader comparison matched all 190 tuples and the planning digest recorded above.
- `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs` passed with 1,959 passed, zero failures and three skips. The skipped cases were the two opt-in GitHub tests and the absent `CLAUDE.md` check.
