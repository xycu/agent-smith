---
change_id: coauthor-test-coarse-mtime
title: Fix the coauthor tests that fail on Linux CI from a coarse file clock
status: new
created: 2026-11-12
updated: 2026-11-12
archived_at: null
---

## Notes

Priority: must fix. CI on `main` is red.

### What failed

The CI run 43132134691 on `main` (commit `5160a8a`, `chore(main): release 1.5.0`, self-hosted TrueNAS runner) failed in the "Tests and version check" job, step "Test suite". 1075 tests ran, 1064 passed, 10 were skipped and 1 failed:

```
test at skills/10x-pipeline/test/coauthor.test.mjs:158:1
✖ a malformed coAuthor halts a step commit at next with nothing staged
  AssertionError [ERR_ASSERTION]: The input did not match the regular expression /^Step commit of step 1 \(plan\): /. Input:
  'Rollback of step 1 (plan): policy.coAuthor name must be a non-blank string with no newline, "<" or ">".'
```

The test was added by the `agent-smith-coauthor` change (commits `854e1ca`, `4650b1e`). The router code is correct. The test is flaky: it depends on timing, and the Linux runner exposes it.

### Root cause

- `coauthor.test.mjs` imports `writePlan` from `./helpers.mjs` (line 10). That helper writes `plan.md` with the file system's own mtime.
- The router counts a plan step as verified only when `plan.mtime > last.startedAt` (`skills/10x-pipeline/scripts/flow.mjs:474`). `startedAt` is `Date.now()` taken when `init` returns the plan step.
- Linux stamps file mtimes from a coarse kernel clock. A file written a few milliseconds after `init` can get an mtime at or before `startedAt`. The plan step then reads as not done, `next` treats it as a failed step, and an isolated run goes to the rollback path instead of the step commit. With the malformed `coAuthor` of the test, the rollback halts first, with `Rollback of step 1 (plan): ...` instead of the expected `Step commit of step 1 (plan): ...`.
- The test runs this scenario three times in a loop (the three `BAD` values), so it has three chances to hit the coarse stamp per run. That is why this test failed and not the others.
- The repository already solves this. `skills/10x-pipeline/test/ahead.mjs` wraps `writePlan` and `writeReview` and stamps the file a minute ahead (`stampAhead`). AGENTS.md says: "A test that writes such a file right after `next` uses it." `stepcommit.test.mjs`, `rollback.test.mjs`, `late-usage.test.mjs`, four other test files and `openspec-helpers.mjs` import from `./ahead.mjs`. `coauthor.test.mjs` does not.

### Reproduction (verified on macOS, 2026-11-12)

macOS stamps files with a fine clock, so the suite passes locally. The failure appears when the plan's mtime is set to the step's `startedAt`, as the Linux clock can do: the same scenario as the test (isolated run, override with `coAuthor: { name: " ", email: "a@b" }`, plan written, `fs.utimesSync(planFile, startedAt, startedAt)`, `next`) returns exactly the CI message: `Rollback of step 1 (plan): policy.coAuthor name must be a non-blank string with no newline, "<" or ">".`

### Also at risk

`coauthor.test.mjs:67` ("a step commit carries the trailer") has the same pattern: `isolatedRun()`, then a plain `writePlan`, then `next`, expecting `plan-review`. It passed on this run by chance and can fail the same way.

### Fix direction

- In `coauthor.test.mjs`, import `writePlan` from `./ahead.mjs` instead of `./helpers.mjs`, as `stepcommit.test.mjs` does. Keep `writeReview` from `helpers.mjs` unless a review there stands for a step's output: in `archiveProject` the reviews are written before the log, as fixtures, and do not need it. The test code does not change.
- Check the other test files that still import the plain `writePlan` from `helpers.mjs` (advisor, agents, churn, compare, cost, executors, firstattempt, lessons, provenance, route) for the same pattern: a plan written as the output of a plan step that `init` or `next` has just started, followed by `next`. Switch only the ones that have it. Most of them write the plan as a fixture before `init`, which is safe.
- Do not change `helpers.mjs`. AGENTS.md keeps it as it was, and `ahead.mjs` exists for this reason.
- Optional, if cheap: a guard test, in the style of `no-recursive-delete.test.mjs`, that fails when a test file imports the plain `writePlan` from `helpers.mjs` and calls it between `init`/`next` and a `next`. If that cannot be checked reliably from the source text, leave it out. A guard that flags every plain import would also flag safe fixture writes.

### Verification

- Run `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` locally and confirm it passes.
- Prove that the fix removes the timing dependency: run `coauthor.test.mjs` with a temporary local hack that backdates every plain `helpers.mjs` `writePlan` to `startedAt`, or repeat the reproduction above with the `ahead.mjs` writer and confirm the message is `Step commit of step 1 (plan): ...`. Do not commit the hack.
- The CI run on `main` after the fix is green on the self-hosted runner.

### Done when

`coauthor.test.mjs` writes every plan that stands for a step's output through `ahead.mjs`, no other test file writes a step's plan output with the plain helper, the suite passes locally, and CI on `main` is green.
