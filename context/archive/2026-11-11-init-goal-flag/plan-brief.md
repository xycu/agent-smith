# init --goal parsing — Plan Brief

> Full plan: `context/changes/init-goal-flag/plan.md`

## What & Why

`init --goal` loses a goal that starts with `--` (stored as `""`) and keeps only the first word of an unquoted goal. The plan step then runs on the wrong text, and the goal class and rigor are picked wrongly. GitHub issue #90.

## Starting Point

`parseFlags` (`state.mjs:14-23`) treats any `--` argument as a flag and silently skips words that belong to no flag. `main()` in `route.mjs` is its only caller.

## Desired End State

`--goal` always takes the next argument. `init` halts, writing nothing, when words belong to no flag. Other commands are unchanged.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Where to fix | `parseFlags(args, valueFlags)` with `["goal"]` | One call site, no new framework. |
| Leftover words | Collected in `flags._`; only `init` halts | `usage <id> <n>` needs its positional. |
| Bare `--goal` | Unchanged, keeps the stored goal | Existing rule, not part of the issue. |
| ADR / SKILL.md | None | No design decision; skills already quote the goal. |

## Scope

**In scope:** parser, `init` halt, tests, one doc sentence in `AGENTS.md` and `docs/REFERENCE.md`.

**Out of scope:** other commands, valueless-flag rules, SKILL.md.

## Architecture / Approach

`parseFlags` consumes the next argument for listed flags and records unconsumed words; `init` checks them next to its other argument checks, before any write.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Parser and init halt | The fix | `--goal --rigor x` now reads `--rigor` as the goal and halts on `x` |
| 2. Tests and docs | Pinned behaviour, docs | Doc edits conflict with parallel changes |

**Prerequisites:** none.
**Estimated effort:** one short session.

## Open Risks & Assumptions

- A hand-run `--goal` followed directly by another flag is now an error or a flag-text goal; accepted per the issue.
- Doc placement in `REFERENCE.md` is chosen where `init` flags are listed.

## Success Criteria (Summary)

- Both issue reproductions behave as in the end state.
- Full suite passes.
