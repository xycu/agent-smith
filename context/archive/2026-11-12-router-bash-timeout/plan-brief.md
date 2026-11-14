# Router Bash timeout — Plan Brief

> Full plan: `context/changes/router-bash-timeout/plan.md`

## What & Why

Both orchestrator skills run `route.mjs`, `open-pr.mjs` and `pr-comment.mjs` through the Bash tool with no `timeout`. The Bash default (120000 ms) equals the router's git timeouts, so a slow pre-commit hook gets the router killed inside `git commit`, with the router's own `git add` left staged and a later halt that does not say why. Telling the orchestrator to pass `timeout: 600000` removes the cause.

## Starting Point

Each SKILL.md has three script path lines before `## Start` and nothing about timeouts. `policy.json` ships `isolation.gitTimeoutMs` and `archive.gitTimeoutMs` at 120000; `open-pr.mjs` has a fixed 120000 push limit. `docs/REFERENCE.md` does not relate the Bash limit to them.

## Desired End State

One identical `Bash timeout:` line in each SKILL.md after the `Pull request script:` line, outside the anti-stall section, pinned by a content test in each skill test file. `docs/REFERENCE.md` states the relation and the override keys. Suite green.

## Key Decisions Made

| Decision | Choice | Why |
| --- | --- | --- |
| Shipped `gitTimeoutMs` | Stay 120000 | The Bash ceiling (600000) fits one slow hook; projects override per `agent-smith-policy.json` |
| Line placement | After `Pull request script:` line, before `## Start` | Next to the path lines; outside the pinned anti-stall section |
| Line text | No `node $ROUTER`, no `**GIVEN**`, no model/effort/tier word | Existing tests pin those forms |
| gitSafety halt message | Not changed | Optional in change.md; touches router code and tests; the timeout line removes the usual cause |

## Scope

**In scope:** two SKILL.md lines, two content tests, one REFERENCE.md bullet.

**Out of scope:** `policy.json` values, `open-pr.mjs` timeout override, router halt messages, README.

## Architecture / Approach

Text-only change in skills and docs; tests assert the line by prefix and content, position and cross-skill equality.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Skill line and content tests | Line in both skills, two new tests | Line trips an existing pin (`node $ROUTER`, tier words) |
| 2. Reference note and full suite | `Bash limit` bullet in REFERENCE.md, green suite | Wording drifts from `policy.json` values |

**Prerequisites:** Node 24+.
**Estimated effort:** ~1 session, 2 phases.

## Open Risks & Assumptions

- Assumption: 600000 ms is the Bash tool maximum (stated in change.md).
- Several slow git calls in one router call could still exceed 600000 ms; documented, not prevented.

## Success Criteria (Summary)

- Both skills carry and pin the timeout line.
- REFERENCE.md explains the Bash limit versus `gitTimeoutMs`.
- Full suite passes.
