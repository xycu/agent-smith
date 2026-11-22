<!-- IMPL-REVIEW-REPORT -->
# Implementation Review — Review Verdict Validation

- **Plan**: [Review Verdict Validation Implementation Plan](../plan.md)
- **Scope**: Full plan
- **Reviewed phases**: 1, 2
- **Date**: 2026-11-19
- **Verdict**: REJECTED
- **Findings**: 2 critical, 1 warning, 0 observations

At `b88f0a1a`, a failed confirmation from an older router could dispatch implementation, and a review with conflicting verdicts could finish the run. The counts and verdict describe that revision. All three fixes are in `82a87d8c`.

## Verdicts

| Dimension | Verdict |
| --- | --- |
| Plan Adherence | FAIL |
| Scope Discipline | PASS |
| Safety & Quality | FAIL |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — A restored review could clear an older failed confirmation

- **Severity**: CRITICAL
- **Impact**: LOW. Both readers already have the persisted verification flag.
- **Dimension**: Safety & Quality
- **Location**: `skills/10x-pipeline/scripts/flow.mjs:713` and `skills/10x-pipeline/scripts/isolation.mjs:686` at `b88f0a1a`
- **Detail**: The previous writer persisted `verified: false` and `ok: false` when a review lacked a verdict. It omitted `invalid`. Both recovery eligibility and the timestamp rule for a review absent at dispatch depended on that optional diagnostic. In the legacy CLI fixture, the restored plan review dispatched `implement` after the failed confirmation.
- **Fix**: Use the recorded verification failure in both checks. Read the diagnostic from the current artifact when the old entry lacks one. The regression uses the earlier writer's log shape, checks that unchanged checkout bytes halt the run, then checks that an edited review routes on its open critical finding.
- **Decision**: APPLIED in `82a87d8c`.

### F2 — Backticks in separate list items could conceal a conflicting verdict

- **Severity**: CRITICAL
- **Impact**: LOW. The delimiter index already tracks paragraph boundaries.
- **Dimension**: Plan Adherence
- **Location**: `skills/10x-pipeline/scripts/state.mjs:337` at `b88f0a1a`
- **Detail**: Unmatched backticks in two metadata list items paired across a separate `REJECTED` item. The reader skipped that verdict and accepted the following `APPROVED` item. A no-log `init` returned `done` for a review with two verdicts.
- **Fix**: End inline delimiter matching at nonempty bullet boundaries. A no-log CLI fixture now halts on the duplicate, and a separate fixture keeps a numbered prose line inside its code span.
- **Decision**: APPLIED in `82a87d8c`.

### F3 — A UTF-8 byte-order mark hid the first Markdown boundary

- **Severity**: WARNING
- **Impact**: LOW. Only the start of the review needs normalization.
- **Dimension**: Plan Adherence
- **Location**: `skills/10x-pipeline/scripts/state.mjs:366` at `b88f0a1a`
- **Detail**: A file beginning with a byte-order mark and a canonical verdict failed intake. The same prefix on an opening `## Findings` heading let the reader continue into the body and treat an example as the verdict.
- **Fix**: Strip one leading byte-order mark before scanning the header. Test both a first-line verdict and a first-line heading followed by a body example.
- **Decision**: APPLIED in `82a87d8c`.

## Coverage and verification

Phase 1 covered both accepted vocabularies, result intake, existing artifacts, retry limits, confirmation halts, corrected reviews, and unchecked or reopened implementation rows. Phase 2 covered rollback and undo checkpoints, restart ordering, pinned checkouts, later commits, preservation of staged and working copies, and OpenSpec task and verification times. The six automated Progress rows cover both phases. The plan lists no manual rows.

- `/root/drift` reviewed plan adherence. `/root/quality` reviewed recovery, safety and patterns. Both independently identified F1. The enclosing review reproduced all three findings against `b88f0a1a` and verified the fixes through the CLI. Child-inclusive token usage was unavailable.
- Before fixes, the existing suites passed 185 verdict tests and 28 rollback tests. All three focused regressions failed against `b88f0a1a`.
- After fixes, `node --test skills/10x-pipeline/test/openfindings.test.mjs` passed all 188 tests and `node --test skills/10x-pipeline/test/rollback.test.mjs` passed all 28.
- The archive comparison matched all 190 tuples before and after the fixes. The SHA-256 digest matched the plan's baseline, `9b8d0af620d7dd8e4bf6929403e96aac1a2e3661e91b33779e9ee95f5c75b635`.
- The full repository command passed 1,984 tests with three expected skips (two opt-in GitHub checks and the absent `CLAUDE.md` check). An earlier run had one failure at `run-lock.test.mjs:184` when a simulated native-runner crash left a temporary lock file. Both crash tests passed on immediate rerun. Two subsequent full runs each passed all 1,984 enabled tests.

The previous full-plan review and its decisions are preserved at `61388093:context/changes/review-verdict-unknown-passes/reviews/impl-review.md`.
