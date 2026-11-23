---
change_id: test-suite-trim-and-gaps
title: Trim slow and wording-pin tests and cover the untested router branches
status: new
created: 2026-11-19
updated: 2026-11-19
archived_at: null
---

## Notes

**Origin.** Whole-repo audit on 2026-11-19, finding 17 (should fix). Timings come from one full run of the suite on `main` (1920 pass, 0 fail, 3 skipped). The gaps were found by changing one line of code at a time in a scratch copy and running the tests that should have failed.

**The shape of the problem.** About 30,600 lines of tests guard about 8,443 lines of code. The suite takes about 1,094 s of summed test time (about 13 minutes of wall time). It is large and slow, and it still let every must-fix finding of the audit through. Three causes.

**1. Tests that pin wording, not behavior (about 11% of the test lines).**
- `skills/10x-pipeline/test/skill-loop.test.mjs` (543 lines): `:420` holds a byte ceiling of 28100 for `SKILL.md`, which is 28,097 bytes today, so the next three bytes of prose fail CI. `:399` holds a sha256 digest of the Anti-stall section.
- `archive-gate.test.mjs` (109 lines), `nested-subagents.test.mjs` (228 lines), `rules.test.mjs`, the prose tests in `skills/openspec-pipeline/test/openspec-skill.test.mjs`, and `pr-comment.test.mjs:716-834`.
- These fail when a sentence is improved and pass when the behavior breaks.

**2. Tests that wait on real time.**
- `prepare-run-timeout.test.mjs` waits the real 120000 ms, because `GIT_TIMEOUT_MS = 120000` is a constant at `skills/10x-pipeline/scripts/prepare-run.mjs:8` with no way to lower it in a test.
- Eight budget tests (`budget-confirm-rounds`, `budget-pool-score`, `budget-confirm-shipped`, `budget-executors`) take 314.7 s together.
- The documented command uses `--test-concurrency=2` on an 8-core machine, and no document says why.

**3. Branches that no test reaches.** Each of these was changed or removed and the suite stayed green:
- `flow.mjs:778`: the tier bump after a noisy plan review (`noisyPlanReviewWarnings`).
- `flow.mjs:816`: `ir.critical > 0 ||` in the implementation-review verdict.
- `steps.mjs:594-599`: the floor that keeps a retry from going below the last tier that wrote code.
- `steps.mjs:532`: `plan.rows <= S.maxRows`.
- `remove-tree.mjs:50`: the case where the target itself is a symbolic link.
- `open-pr.mjs:281-283`: the `unstage` after a failed `git add`; `:262`: the rename path; `:173`: the host comparison is case-sensitive; `:331`: control characters in the pull request title.

**4. Tests of code that lives only in the tests.** `tools/test/agents-md-no-imports.test.mjs:19-38`, `rules.test.mjs:69-99`, `helpers-env.test.mjs` and `helpers-timeout.test.mjs` test helper functions that the product never calls.

**5. Tests that write into the repository.** `helpers-env.test.mjs:16` and `:127` create `.as-env-unit-*` and `.as-env-victim-*` directories in the repository root. `.gitignore` holds only `.claude/worktrees/` and `.DS_Store`, so an interrupted run leaves untracked directories that a later `git add -A` would sweep up.

**Direction (for the plan to confirm).**
- First add the missing behavior tests of group 3; they are small and each one closes a real hole.
- Make `GIT_TIMEOUT_MS` readable from the environment for tests (keep 120000 as the default), and cut the wait to seconds.
- Replace the byte ceiling and the digest with checks of what they protect: the sections that must exist and the sentences a rule depends on. Keep one test that the two Anti-stall sections are equal, because AGENTS.md requires it.
- Move the scratch directories of `helpers-env.test.mjs` to the system temporary directory, or add the two patterns to `.gitignore`.
- State the reason for `--test-concurrency=2` in `skills/10x-pipeline/test/README.md`, or raise it after a check that the scratch-project tests do not collide.
- Decide for the budget tests whether they stay; `first-attempt-drop-unmeasured` may remove their subject.

**Relation to other changes.** `test-shard-durations-refresh` updates the CI shard timings and should run after this change, because the timings move. The must-fix changes each add their own regression test; do not duplicate them here.

**Constraints.**
- No test is deleted without naming what still covers its behavior.
- Deleting test scratch trees uses `removeTree`, never a recursive or forced delete (ADR-016).
- A new or removed test file gets its row in the README of its folder.
- No npm dependencies (ADR-006).

**Done when.**
- Each branch of group 3 has a test that fails when the branch is removed.
- `prepare-run-timeout.test.mjs` finishes in seconds.
- An edit of three bytes of prose in `SKILL.md` no longer fails the suite, and a removed required section still does.
- A full run leaves `git status` clean in the repository root, also after an interrupted run.
- The summed test time is recorded before and after in the pull request.
- The full suite passes: `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`.
