---
change_id: open-pr-unfinished-merge-commit
title: Keep open-pr from committing and pushing an unfinished merge
status: impl_reviewed
created: 2026-11-19
updated: 2026-11-19
archived_at: null
---

## Notes

**Origin.** Whole-repo audit on 2026-11-19, finding 3 (must fix). Reproduced in a scratch repo with a local bare remote.

**The defect.** `commitLeftovers` in `skills/10x-pipeline/scripts/open-pr.mjs:275-292` reads `git status`, runs `git add -A`, and commits `chore(<id>): final run state`. It does not look at the state of the repository first. When a step left a merge in progress, `git add -A` marks every conflicted file as resolved and `git commit` concludes the merge.

**Reproduced case.** A step runs `git merge origin/main` in the run worktree and hits a conflict (`UU app.js`, `MERGE_HEAD` exists). The router halts, because `gitSafety` in `skills/10x-pipeline/scripts/isolation.mjs:252` refuses a repository with an operation in progress. The skill loop then runs `open-pr.mjs` on the halt, as it does at every end of a run (ADR-017). The script printed `"pushed":true,"committed":true,"swept":["app.js"]`. On the remote, `agent-smith/demo` has a commit `chore(demo): final run state` with two parents, and `app.js` holds:

```
<<<<<<< HEAD
line1 RUN
=======
line1 MAIN
>>>>>>> origin/main
```

The same happens for a cherry-pick or a revert in progress, and for unmerged entries left by `git stash pop`. `skills/10x-pipeline/test/open-pr.test.mjs` has no merge or conflict case.

**Why it matters.** The router already refuses this state; the publisher is a second copy of the commit path that does not. The result is a pushed branch and an open pull request with conflict markers in source files.

**Direction (for the plan to confirm).**
- Before `git add -A`, skip the leftover commit when the status has an unmerged entry (`U` in either column, `AA`, `DD`) or when one of the markers in `IN_PROGRESS` (`isolation.mjs:192`: `MERGE_HEAD`, `REVERT_HEAD`, `CHERRY_PICK_HEAD`, `rebase-merge`, `rebase-apply`) exists.
- Return `committed: false` with a `commitError` that names the state, and still push the commits that already exist, so the review branch is not lost.
- Reuse the router's check instead of writing a third copy. `open-pr.mjs` is a standalone script; the plan says which module may export the shared helper without breaking the import order in AGENTS.md (Coding Style).

**Two smaller defects in the same function (fix here if cheap, else list as follow-ups).**
- A failed leftover commit drops a staged-only version: a file staged with content A while the worktree holds content B (`MM`) ends as ` M` with the index equal to `HEAD` after `unstage` (`open-pr.mjs:249-272`). `git write-tree` before the add and `git read-tree <tree>` on failure restores the exact index and removes `pathsToStage` and `unstage`.
- When `git add -A` stages nothing (for example an initialized submodule with untracked content), `git commit` exits 1 and the script reports `committed: false` on every run. `git diff --cached --quiet` after the add should give `committed: null`, as `routerCommit` does (`isolation.mjs:364-365`).

**Constraints.**
- `open-pr.mjs` never force-pushes, never merges and never discards uncommitted work (AGENTS.md Hard Rules, ADR-017).
- The script must not try to finish or abort the merge itself; aborting discards work that no commit holds.
- The JSON shape the skill loops read (`pushed`, `committed`, `commitError`, `swept`) stays compatible; both `SKILL.md` files change only if a new field needs handling.

**Done when.**
- A test with a merge conflict in the run worktree: nothing is committed, no file with conflict markers reaches the remote, the existing commits are pushed, and the output names the state.
- A test each for a cherry-pick in progress and for unmerged entries without `MERGE_HEAD`.
- The existing `open-pr` tests pass unchanged in meaning.
- `docs/REFERENCE.md` and ADR-017 say what the publisher does when an operation is in progress.
- The full suite passes: `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`.
