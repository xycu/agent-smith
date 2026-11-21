---
change_id: run-branch-must-match-change-id
title: Refuse to run a change on another change's run branch
status: archived
created: 2026-11-19
updated: 2026-11-21
archived_at: 2026-11-21T14:22:33Z
---

## Notes

**Origin.** Whole-repo audit on 2026-11-19, finding 8 (should fix). Reproduced in a scratch repository with two changes.

**The defect.** `validateRunBranch` in `skills/10x-pipeline/scripts/run-identity.mjs:66-81` accepts any branch that starts with the configured prefix (`branch.startsWith(prefix)`, line 77). It does not check that the branch belongs to the change id. `prepare-run.mjs:179-180` and `isolation.mjs:301-304` rely on that check.

**Reproduced case.** The session's working directory is the worktree of run `bar` (branch `agent-smith/bar`). The folder of change `foo` exists there, because it is committed on `main`. The user starts `foo`:

- `prepare-run.mjs foo` answers `in-run-worktree` with branch `agent-smith/bar`.
- `init foo` returns `action: run`; `context/changes/foo/agent-smith/meta.json` holds `"id": "foo"` and `"branch": "agent-smith/bar"`.
- `chore(foo): start run` is committed on `agent-smith/bar`.
- `open-pr.mjs foo` passes the identity guard and stops only at "no remote origin".

**Why it matters.** The step commits of `foo` use `git add -A` and sweep the uncommitted files of `bar`. A rollback of `foo` resets the branch of `bar`. Both changes end in one pull request.

**Direction (for the plan to confirm).** In `validateRunBranch`, require the branch to start with `${prefix}${id}`. The publisher without `meta.json` already requires the exact name (`open-pr.mjs:150-151`). The documented `<id>-baseline` branches for `compare` must keep working, so the test is "starts with the prefix and the id", not "equals".

A stricter rule would also reject `agent-smith/foo-bar` for the id `foo`; the plan decides whether the next character after the id must be the end of the name or `-`, and checks that against every branch form the reference documents.

**Constraints.**
- A resumed run whose `meta.json` records a branch under an older `isolation.branchPrefix` keeps its current recovery message (`run-identity.mjs:98`).
- The error must say what to do: leave the other run's worktree, or run `prepare-run.mjs` from the original project root.
- No git history is rewritten and no branch is deleted to recover.

**Done when.**
- A test: inside the worktree of run `bar`, `prepare-run.mjs foo` and `init foo` refuse, name both ids, and write nothing.
- A test: `<id>-baseline` is still accepted.
- The existing `prepare-run`, `run-identity` and `open-pr` tests pass unchanged in meaning.
- `docs/REFERENCE.md` states the rule in the isolation section.
- The full suite passes: `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`.
