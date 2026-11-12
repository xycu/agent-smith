# Coauthor test coarse-mtime fix — Plan Brief

> Full plan: `context/changes/coauthor-test-coarse-mtime/plan.md`

## What & Why

CI on `main` failed in `coauthor.test.mjs` ("a malformed coAuthor halts a step commit at next with nothing staged"). The test writes a plan with the plain helper; on Linux the file mtime can be at or before the step's `startedAt`, so the router rolls back instead of making the step commit. The router is correct; the test is timing-dependent.

## Starting Point

`skills/10x-pipeline/test/ahead.mjs` already stamps such files a minute ahead, and most test files use it. `coauthor.test.mjs` imports the plain `writePlan` from `helpers.mjs` (lines 69 and 162 write a plan right after `isolatedRun()`).

## Desired End State

`coauthor.test.mjs` writes its step-output plans through `ahead.mjs`. The suite passes locally and CI on `main` is green.

## Key Decisions Made

| Decision | Choice | Why |
| --- | --- | --- |
| Where to fix | Import `writePlan` from `./ahead.mjs` in `coauthor.test.mjs` only | `helpers.mjs` stays unchanged by AGENTS.md; `ahead.mjs` exists for this |
| Other test files | No change | Audit: every other plain write is stamped by the test itself or is a fixture/implement output with no `startedAt` check |
| `writeReview` in coauthor | Stays on `helpers.mjs` | Written in `archiveProject` as a fixture before the log |
| Guard test | Left out | Source text cannot tell fixture writes from step-output writes |

## Scope

**In scope:** the import in `coauthor.test.mjs`; a backdating check that proves the fix; the full suite.

**Out of scope:** `helpers.mjs`, `ahead.mjs`, router scripts, other test files, a guard test.

## Architecture / Approach

Split one import line. Prove it by backdating the plain helper's mtime to `startedAt` temporarily: the old import reproduces the CI message, the new one passes. Revert the hack by hand.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Use the ahead writer | `coauthor.test.mjs` imports `writePlan` from `./ahead.mjs` | None |
| 2. Prove and run the suite | Backdating proof, clean diff, full suite green | Leaving the temporary hack in `helpers.mjs` |

**Prerequisites:** Node 24, git.
**Estimated effort:** one short session.

## Open Risks & Assumptions

- Assumption: the audit of the other files holds as recorded in the plan; a stamped plain write counts as safe.
- Risk: CI green on `main` is only confirmable after the merge (manual row 2.4).

## Success Criteria (Summary)

- The flaky coauthor test no longer depends on the file clock.
- Full suite passes locally; CI on `main` is green after merge.
