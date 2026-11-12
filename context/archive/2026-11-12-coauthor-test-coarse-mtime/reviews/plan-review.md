<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Coauthor test coarse-mtime fix Implementation Plan

- **Plan**: context/changes/coauthor-test-coarse-mtime/plan.md
- **Mode**: Standard, done in the main thread with no sub-agent; every claim was read against the code in the worktree
- **Date**: 2026-11-12
- **Verdict**: SOUND
- **Findings**: 0 critical, 0 warnings, 4 observations

The plan is right on the cause and the fix. Read against the code: `flow.mjs:474` verifies a plan step only when `plan.mtime > last.startedAt`; `ahead.mjs` wraps `writePlan` and `stampAhead`s the file a minute ahead; `coauthor.test.mjs:10` imports the plain `writePlan`, and lines 69 and 162 write a plan right after `isolatedRun()` and before `nextIn`; the `wt` object of `coauthor.test.mjs` carries `planFile` and `changeDir`, so `ahead.mjs` works on it. The call-site audit of the other files holds for every plan write (each plain write is stamped by the test, is a fixture, or is an `implement` output). The four observations are wording and completeness fixes.

## Findings

### F1: Audit lists overlap and miss one call site

- **Severity**: OBSERVATION
- **Decision**: APPLIED. Key Discoveries changed: `advisor.test.mjs:442` stays only in the stamped list (it calls `fs.utimesSync` with `future()` one line later), and the fixture / implement-output list now names `advisor.test.mjs:531` (an `implement` output) in place of the duplicate 442.
- **Evidence**: `advisor.test.mjs:442-443` stamps the plan; the plan listed 442 in both categories and omitted 531 (`else if (step === "implement") writePlan(...)`). The conclusion (only `coauthor.test.mjs` needs a change) is unchanged.

### F2: Phase 2 contract omits the second temporary edit

- **Severity**: OBSERVATION
- **Decision**: APPLIED. Phase 2 "Backdating check" Contract changed: it now names both temporary edits (the `helpers.mjs` backdating and the put-back of the plain import in `coauthor.test.mjs` for the "old import" run), says to undo both with Edit, and states that a time before `startedAt` is enough (`mtime == startedAt` also fails the `>` check).
- **Evidence**: criterion 2.1 needs a run "with the plain import", but the contract only listed `helpers.mjs`. Leaving the plain import in place at the end would defeat Phase 1.

### F3: Criterion 1.2 is only half machine-checkable

- **Severity**: OBSERVATION
- **Decision**: APPLIED. Phase 1 Contract changed: a spot-check command (`grep -n "writePlan" ...coauthor.test.mjs`) was added beside it. The Progress row 1.2 and its criterion text were left as they are, because Progress rows must not change.
- **Evidence**: `grep -n "ahead.mjs"` prints the `./ahead.mjs` import but cannot show that `writePlan` left the `./helpers.mjs` import block.

### F4: Review, research, frame and score writers in other tests are not audited

- **Severity**: OBSERVATION
- **Decision**: APPLIED. Key Discoveries, "What We're NOT Doing" and `plan-brief.md` (Scope, out of scope) now say the plain `writeReview` and the research, frame and score writers fall under the same `startedAt` check (`flow.mjs:479-503`), were not audited, and are a follow-up if the suite flakes on them.
- **Evidence**: the plan itself notes the same check exists for reviews, and many test files still import the plain `writeReview`. The change's "Done when" names only plan output, so the scope is correct; the gap is that the plan did not say it was left open.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS (F4 noted) |
| Plan Completeness | PASS |

## Grounding

Grounding: paths found: `flow.mjs`, `ahead.mjs`, `helpers.mjs`, `coauthor.test.mjs`, `stepcommit.test.mjs`, `change.md`. Symbols found: `stampAhead`, `writePlan`, `writeReview`, `isolatedRun`, `nextIn`, `planFile`. Call-site audit: re-read the context of every plain `writePlan` call in `advisor`, `agents`, `churn`, `compare`, `cost`, `executors`, `lessons`, `provenance` and `route` tests; stamped or fixture or implement output in each case. The `Progress` section was not changed (rows 1.1 to 2.4, all unticked).
