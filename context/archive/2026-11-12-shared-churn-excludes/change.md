---
change_id: shared-churn-excludes
title: Share one fallback for the churn exclude globs
status: archived
created: 2026-11-12
updated: 2026-11-14
archived_at: 2026-11-14T02:10:51Z
---

## Notes

Source: the repo audit (ponytail-audit, 2026-11-12), finding 5, "Nice to have" (lean).

### Problem

Two functions fall back to the shipped `risk.churn.exclude` list by reading `policy.json` from disk again:

- `churnConfig` in `skills/10x-pipeline/scripts/state.mjs:615-626` uses the override's `exclude` when it is an array, else reads `readJson(path.join(SKILL_DIR, "policy.json"), {}).risk?.churn?.exclude` (state.mjs:623), else `[]`. It returns `null` when another key of the churn block is malformed (`since`, `maxCommits`, `minCommitsInWindow`, `hotMinCommits`, `hotPercentile`).
- `evidenceExcludes` in `skills/10x-pipeline/scripts/steps.mjs:37-42` calls `churnConfig`, and when that returns `null` it reads the same file and key again and builds the regexes itself.

That is the same rule in two places, with two disk reads of `policy.json`. The two paths also disagree: when the churn block is malformed only because of, say, `since`, the commit-evidence check of `verifyImplement` ignores the override's valid `exclude` list and uses the shipped one, while a valid block uses the override's list. The evidence check (which commits count as code commits for tdd, e2e and retry entries) should not depend on whether an unrelated churn key is valid.

### Fix direction

- Export one helper from state.mjs, for example `churnExcludes(policy)`: the override's `exclude` when it is an array of strings, else the shipped list, as regexes. Make `churnConfig` use it for its `exclude`, and make `evidenceExcludes` call it directly, independent of the other churn keys. Delete `evidenceExcludes`' own fallback, and drop the `SKILL_DIR` and `readJson` imports from steps.mjs if nothing else there uses them.
- Keep the import rule of AGENTS.md: steps.mjs imports from state.mjs, never the other way round.
- Expected result: about 5 fewer lines and one fewer disk read of `policy.json` per implement verification.

### Tests

- `executors.test.mjs` (commit evidence) or `churn.test.mjs`: with an override whose churn block has an invalid `since` and a custom `exclude`, a commit that touches only a path matched by the custom `exclude` does not count as code-commit evidence.
- The existing churn and executor tests pass unchanged.
- Run the full suite.

### Done when

One function owns the exclude-glob fallback, both churn risk and commit evidence use it, and the commit-evidence check honours the override's `exclude` whatever the other churn keys hold.
