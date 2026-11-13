---
change_id: finished-changes-left-open
title: Archive the finished runs and report a stale change.md status at done
status: archived
created: 2026-11-12
updated: 2026-11-13
archived_at: 2026-11-13T11:26:26Z
---

## Notes

Source: the repo review of 2026-11-12 (LLM engineering and Claude Code practice). Severity: medium.

### Problem

A run without `--archive` that ends `done` leaves its folder in `context/changes/`, and nothing checks that `change.md` carries the status the run reached. The unattended subagents update the frontmatter only sometimes. `context/changes/README.md` calls this folder "In-flight changes", and `/10x-status` reads the frontmatter, so finished work shows as not started.

### Evidence (verified on main, 2026-11-12)

14 of the 22 folders under `context/changes/` belong to runs that ended, with their commits on `main`:

| Status in change.md | Run outcome (`agent-smith/report.md`) | Changes |
| --- | --- | --- |
| `new` | done | `array-prompt-override`, `at-or-above-helper`, `file-guard-dedup`, `override-json-error-halt`, `run-state-lock` |
| `planned` | done | `agents-md-no-imports`, `archive-done-routercommit`, `budget-halt-after-done`, `init-goal-flag`, `review-verdict-labels` |
| `impl_reviewed` | done | `init-needs-change-md`, `pin-action-shas` (one Manual row open), `pr-scripts-shared` |
| `impl_reviewed` | halt, owner setting | `ci-self-hosted-truenas` |

`pr-scripts-shared`, `review-verdict-labels` and `run-state-lock` ended `done` with the review verdict NEEDS ATTENTION. Only 7 folders describe open work, and one more is the untracked copy of `stale-main-change-copy`.

The status values and their order are in the `/10x-new` reference (`new`, `planned`, `plan_reviewed`, `implementing`, `implemented`, `impl_reviewed`, `archived`). A run that passed its implementation review should read `impl_reviewed`.

### Fix direction

1. Housekeeping: read the open findings of the three NEEDS ATTENTION runs, then run `/10x-archive <id>` for the 13 done folders. Decide `ci-self-hosted-truenas` by hand (it waits for an owner setting).
2. Router: the `done` output of a run without `--archive` adds `changeStatus`, read with the existing `frontmatterField`. The router does not write `change.md`; the 10x skills own it.
3. Skills: the `done` branch prints one line when `changeStatus` is not `impl_reviewed`, and always names the two ways to close the change: `/10x-archive <id>`, or the same pipeline call with `--archive`.
4. Research item: find out which step skips the frontmatter update (the logs of the five `new` runs show which skills ran), and fix it with one rule in the template of that step if the cause is the unattended prompt.

Making `--archive` the default was considered and left out: it changes what a default run does and needs its own decision record.

### Tests

- `done` output carries `changeStatus` for a missing, a stale and a correct status; an OpenSpec run has none.
- Content check of the new `done` line in `SKILL.md`.

### Done when

`/10x-status` shows no finished run as `new` or `planned` in this repository, and a `done` run tells the user that its change is still open and how to close it.
