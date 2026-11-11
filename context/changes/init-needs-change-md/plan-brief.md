# init and next need change.md before they write — Plan Brief

> Full plan: `context/changes/init-needs-change-md/plan.md`

## What & Why

GitHub issue #96: for a 10x change, `init` and `next` create `agent-smith/` run state (and, isolated, a start commit) before checking that `change.md` exists, so a mistyped id leaves junk that can collide with a later OpenSpec run. Check first, write nothing.

## Starting Point

The OpenSpec branch already halts before writing. The 10x check lives late in `decide` (`flow.mjs:589`), after `mkdirSync` in `next` and after the start commit in `init`.

## Desired End State

`init` and `next` without `context/changes/<id>/change.md` halt with `No change folder. Run /10x-new <id> first.` and write nothing. Runs with `change.md` and the OpenSpec chain are unchanged.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Halt text | The existing `decide` text | Issue asks for the same text | Issue #96 |
| Where | `route.mjs`, before both `mkdirSync`, after `guardArchived` | Archived halts keep their text | Plan |
| Late check in `decide` | Kept | Defence if `change.md` vanishes mid-run | Plan |
| ADR | None | Small guard, no new rule | Plan |
| Commit type | `fix` | Owner decides | Plan |

## Scope

**In scope:** the early check in `init` and `next`, tests in `route.test.mjs`, one fixed test in `archive.test.mjs`, the `docs/REFERENCE.md` limit line.

**Out of scope:** OpenSpec chain, `helpers.mjs`, cleanup of existing junk folders.

## Architecture / Approach

One `change.md` existence check for the 10x chain at the two places that precede `mkdirSync`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Halt before writing | Check, tests, fixed archive test | Other tests relying on init without `change.md` |
| 2. Docs | REFERENCE.md limit line rewritten | Merge conflict with parallel changes |

**Prerequisites:** none.
**Estimated effort:** under one session.

## Open Risks & Assumptions

- Assumed: only `archive.test.mjs:140` relied on init without `change.md`; the full suite run confirms.
- Assumed: commit type `fix`.

## Success Criteria (Summary)

- Neither command writes anything for a missing `change.md`, isolated or not.
- Full suite green.
