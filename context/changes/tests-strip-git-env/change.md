---
change_id: tests-strip-git-env
title: Drop inherited GIT_ variables in the test helpers
status: impl_reviewed
created: 2026-11-12
updated: 2026-11-14
archived_at: null
---

## Notes

Source: the repo review of 2026-11-12 (tests, tools and CI audit). Severity: medium (rare trigger, but it writes into the developer's repository).

### Problem

The tests build "hermetic" git environments by spreading `process.env` and adding keys. No `GIT_*` key is removed. When the suite runs with `GIT_DIR`, `GIT_WORK_TREE` or `GIT_INDEX_FILE` set, git ignores the scratch directory and works on the repository those variables name. Git sets them for hooks and for `git rebase -x`, so a suite run from a pre-commit hook or from `git rebase -x "node --test …"` writes fixture commits into the developer's repository.

- `skills/10x-pipeline/test/helpers.mjs:102` (`run`: `env: { ...process.env, ...env }`) and `:184-197` (`gitEnv`: spreads `process.env`, sets identity and config keys, drops nothing).
- The same spread in `tools/test/commit-lint.test.mjs`, `skills/10x-pipeline/test/open-pr.test.mjs`, `pr-comment.test.mjs` (three places) and `openspec-contract.test.mjs`.
- `grep -rn "GIT_DIR\|GIT_INDEX_FILE\|GIT_WORK_TREE" skills/10x-pipeline/scripts skills/10x-pipeline/test tools` has no hit.

### Reproduction

In a scratch directory only:

```sh
git init -q victim
git -C victim -c user.name=T -c user.email=t@e.x commit -q --allow-empty -m "chore: victim base"
GIT_DIR="$PWD/victim/.git" node --test <repo>/tools/test/commit-lint.test.mjs
git -C victim log --oneline --all   # now 6 commits: chore: base (3), feat: one, fix(x): two, and the tag base
```

The audit measured two more cases, not repeated here: `git rebase -x` with the same test file in a linked worktree left the fixture commits on the worktree branch; with `GIT_INDEX_FILE` set (what a pre-commit hook exports) `openspec-isolation.test.mjs` passed 5 of 5 while the index file then listed the scratch project's files, so the commit in progress would be rewritten under green tests.

### Fix direction

- One helper in `helpers.mjs`, for example `cleanEnv()`: a copy of `process.env` without every key that starts with `GIT_`. Use it in `run` and `gitEnv`, which then add their own `GIT_CONFIG_*`, `GIT_CEILING_DIRECTORIES` and identity keys as today.
- Use the same helper at the other spread sites. `tools/test/` has no access to `helpers.mjs` by convention; a three-line copy there is fine.
- Leave the router scripts as they are: the router is run by the orchestrator from a shell, not from a hook.

### Tests

- A test that sets `GIT_DIR` and `GIT_INDEX_FILE` to a scratch repository in the environment of a child `node --test` run of one git-using test file, and asserts that the scratch repository has no new commit, ref or index entry and that the child run passes.

### Done when

The suite passes with `GIT_DIR`, `GIT_WORK_TREE` and `GIT_INDEX_FILE` set to another repository, and that repository is unchanged.
