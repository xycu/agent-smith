# Share one fallback for the churn exclude globs — Plan Brief

> Full plan: `context/changes/shared-churn-excludes/plan.md`

## What & Why

Two functions fall back to the shipped `risk.churn.exclude` list by re-reading `policy.json`. When an unrelated churn key is malformed, the commit-evidence check ignores the override's valid `exclude` list while the risk path would not. One shared helper removes the duplicate and the disagreement.

## Starting Point

`churnConfig` in state.mjs has its own fallback; `evidenceExcludes` in steps.mjs repeats it when `churnConfig` returns `null`.

## Desired End State

`churnExcludes(policy)` in state.mjs is the only owner of the fallback. `churnConfig` and `commitEvidence` use it. steps.mjs no longer reads `policy.json`.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Helper name and place | `churnExcludes` exported from state.mjs | Keeps the import rule (steps.mjs imports state.mjs). | Plan |
| Non-string entries | Still filtered out | Same behaviour as today in both paths. | Plan |
| Docs | No change | Neither REFERENCE.md nor SKILL.md describes the fallback. | Plan |
| Phases | One | Small edit, one suite run verifies it. | Plan |

## Scope

**In scope:** helper, two callers, import cleanup, one regression test.

**Out of scope:** `churnConfig` null rules, `policy.json`, docs.

## Architecture / Approach

Extract the fallback into `churnExcludes`, call it from `churnConfig`, delete `evidenceExcludes`, trim imports, add the test (invalid `since` plus custom `exclude`; an excluded-only commit is not evidence).

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. One churnExcludes helper | Helper, callers, test | An import still used elsewhere in steps.mjs gets removed (grep first) |

**Prerequisites:** none.
**Estimated effort:** ~1 short session.

## Open Risks & Assumptions

- Assumption: keep the string-only filter (change.md says "array of strings"; today's code filters rather than rejects).
- Assumption: no question round needed; change.md settles scope, and complexity.json scores low.

## Success Criteria (Summary)

- New test passes and fails on the old code; full suite passes.
- Only one place in the scripts reads the shipped exclude list.
