---
change_id: open-pr-base-prefix-collision
title: Keep a short isolation.branchPrefix from hiding the base branch in open-pr
status: archived
created: 2026-11-19
updated: 2026-11-21
archived_at: 2026-11-21T20:56:37Z
---

## Notes

**Origin.** Review of the past week's changes on 2026-11-19. Low-severity edge in commit `bd669ada`, which made `open-pr.mjs` honor a project's `isolation.branchPrefix`.

**The edge.** `automaticBase(name, branch, config)` in `skills/10x-pipeline/scripts/open-pr.mjs:204` rejects a base candidate when `name.startsWith(BRANCH_PREFIX)` or `name.startsWith(config.branchPrefix ?? BRANCH_PREFIX)` (line 206). The intent is to never pick another run branch as the base. `branchPrefix` in `skills/10x-pipeline/scripts/run-identity.mjs:38` accepts any non-blank string, so a prefix that is also the start of a real branch name removes that branch from the candidates. Examples: `ma` or `m` hides `main`; `dev` hides `develop`; `release` hides `release/1.x`. The callers at lines 216, 228 and 232 then pick a different base or find none.

Not reproduced end to end; found by reading the diff. The default prefix `agent-smith/` is not affected.

**Direction (for the plan to confirm).** Pick one:
- validate `isolation.branchPrefix` when the policy is read, for example require it to end with `/` or `-`, so the prefix cannot be the start of an ordinary branch name; or
- keep the prefix free-form and exclude a candidate only when it is a run branch by a stricter test (prefix followed by a valid change id), and never exclude the remote's default branch.

Validation at load matches ADR-022 (policy validation at load) and fails early with a clear message; it can break an existing project that uses a prefix without a separator, so the plan must say how such a project recovers.

**Constraints.**
- `open-pr.mjs` never force-pushes and never merges (ADR-017).
- A resumed run whose `meta.json` records a branch under the old prefix must still be recognized; `validateRunIdentity` already reports a prefix mismatch with a recovery hint, and that message stays correct.
- An explicit `--base <branch>` keeps winning over the automatic choice.

**Done when.**
- A test with `isolation.branchPrefix` set to a string that starts the base branch name shows the chosen behavior: either the policy is refused with a message that names the key, or `main` is still picked as the base.
- The existing `open-pr` and `run-identity` tests pass unchanged in meaning.
- `docs/REFERENCE.md` states the rule for `isolation.branchPrefix`.
