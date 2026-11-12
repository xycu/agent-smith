# Report a stale change.md status when a run ends done — Plan Brief

> Full plan: `context/changes/finished-changes-left-open/plan.md`

## What & Why

A 10x run without `--archive` that ends `done` leaves its folder in `context/changes/`, and `change.md` often still says `new` or `planned`, so `/10x-status` shows finished work as not started. The plan makes the router's `done` output name the status it found and makes the skill's `done` branch tell the user, and how to close the change.

## Starting Point

The plain `done` object is built at one place in `route.mjs`; `frontmatterField` already reads `change.md` fields; the housekeeping archive of the finished folders is done. The 10x skill's `done` branch reports verdict, checklist and `report.md` but says nothing about the change status. OpenSpec has no `change.md`.

## Desired End State

A 10x `done` output carries `changeStatus` (the status string, or `null`). The 10x skill prints one line when it is not `impl_reviewed`, and always names `/10x-archive <change-id>` and a re-run with `--archive` as the ways to close the change. A finished run no longer looks not started without anyone being told.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Where the field lives | Only the plain `done` object in `route.mjs`; not `doneNotes`, `meta.outcome` or `report.md` | `change.md` changes after the run, so a stored copy goes stale; one output line covers plain and isolated runs | Plan |
| Missing status | `changeStatus: null` | `frontmatterField` returns `null`; the skill prints it as `missing` | Plan |
| OpenSpec chain | No `changeStatus`, `openspec-pipeline` skill unchanged | No `change.md` status there (`change.md` Tests) | Plan |
| Router writes `change.md` | No | The 10x skills own it (`change.md` fix direction 2) | Plan |
| Skill wording | One line `Change status: <value or missing>, expected impl_reviewed. The run did not set change.md to that status.` plus the two closing commands and, in an isolated run, a note that they run from the run root, no `**GIVEN**` line | Fixed text lets a content test match it; GIVEN count stays six | Plan |
| Research item 4 | Left open in `change.md` | The goal limits the plan to router output and skill text | Plan |
| Tests | New `change-status.test.mjs` (router and skill content) | One file for one feature, like `archive-gate.test.mjs` | Plan |

## Scope

**In scope:** `route.mjs` done output, `docs/REFERENCE.md` bullet, `skills/10x-pipeline/SKILL.md` done branch, new test file.

**Out of scope:** `AGENTS.md` (owned by the parallel run `agents-md-slim`), writing `change.md`, `--archive` by default, finding the step that skips the frontmatter update, `openspec-pipeline` skill, `archive`/`halt` outputs, report and meta.

## Architecture / Approach

Test first in two phases: router tests fail, then one added key at `route.mjs`; skill content test fails, then two sentences in the `done` bullet. Each phase ends with the full suite.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Router output | `changeStatus` in the `done` output, tests, REFERENCE bullet | Existing tests that compare `done` objects exactly |
| 2. Skill text | `done` line in `SKILL.md`, content test | Anti-stall and rule-form tests reading the same file |

**Prerequisites:** none.
**Estimated effort:** ~1 session for both phases.

## Open Risks & Assumptions

- Assumed (no human to ask): `null` for a missing or unreadable status instead of omitting the key, so a consumer can tell "read nothing" from "output of an older router".
- Assumed: telling the user is enough; the skill does not stamp `change.md`.
- Assumed: re-running the pipeline with `--archive` after a `done` run resumes and ends in the `archive` branch (REFERENCE.md, `init` resume).
- No live isolated-worktree test; the isolated run ends on the same output line.

## Success Criteria (Summary)

- A `done` run prints `changeStatus` and, when stale, one line telling the user how to close the change.
- Full suite passes locally and CI is green.
