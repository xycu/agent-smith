---
change_id: open-pr-base-selection
title: Pick the default branch as PR base when it is as near as any other candidate
status: new
created: 2026-11-19
updated: 2026-11-19
archived_at: null
---

## Notes

**Origin.** Whole-repo audit on 2026-11-19, finding 10 (should fix). Both cases reproduced in scratch repositories with a local bare remote.

**Relation to another change.** `open-pr-base-prefix-collision` covers a third defect in the same code (`automaticBase`, `skills/10x-pipeline/scripts/open-pr.mjs:204-206`). All three touch `resolveBase`; plan them together, or do that change first and rebase this one on it.

**Where.** `skills/10x-pipeline/scripts/open-pr.mjs:191-232`: `ancestorCounts`, `nearestBase` and `resolveBase` choose the pull request base as the nearest remote branch that the run descends from.

**Case 1: a stale merged branch wins once the default branch moves ahead.** The run forks from `main`. During the run another pull request merges and the user runs `git fetch`. `origin/main` is then no longer an ancestor of `HEAD`, so `--merged HEAD` drops it. Any old remote branch that is still an ancestor wins, and `nearestBase` returns before the `<remote>/HEAD` fallback. Reproduced with `origin/HEAD` pointing to `main`: the output was `base: old-feature-merged-long-ago`, `pushed: true`. On GitHub that opens the pull request against a dead branch. This repository squash-merges and deletes branches, so it does not hit the case today; a repository that uses merge commits and keeps merged branches does.

**Case 2: a tie without `origin/HEAD` goes to the alphabetically first branch.** A repository made with `git init` and `git remote add`, or with `gh repo create --push`, has no `refs/remotes/origin/HEAD`. With `main`, `develop` and `archive-2025` on the same commit the output was `base: archive-2025`. After `git remote set-head origin main` it was `base: main`. The tie tests (`open-pr.test.mjs:275` and `:834`) cover only a set `origin/HEAD`.

**Direction (for the plan to confirm).**
- Make `nearestBase` return its distance. In `resolveBase`, take the remote default branch when `git rev-list --count refs/remotes/<remote>/<head>..HEAD` is less than or equal to that distance. A run that forked from a pushed feature branch still gets the feature branch, because its distance is smaller.
- When the remote `HEAD` is unknown, break a tie by the order of `config.defaultBranches` (already in the policy as `["main", "master"]`) before falling back to alphabetical order.

**Constraints.**
- An explicit `--base <branch>` keeps winning over the automatic choice.
- `open-pr.mjs` never force-pushes and never merges (ADR-017).
- No extra network call: use the refs that are already fetched.

**Done when.**
- A test for case 1: the default branch has moved ahead, an older merged branch is still an ancestor, and the base is the default branch.
- A test for case 2: no `origin/HEAD`, three branches on one commit, and the base is `main`.
- The existing base and tie tests pass unchanged in meaning.
- `docs/REFERENCE.md` states the base rule in force.
- The full suite passes: `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`.
