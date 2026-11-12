# Parse --rigor in both skills — Plan Brief

> Full plan: `context/changes/skill-rigor-flag/plan.md`

## What & Why

`README.md` offers `--rigor lean|standard|thorough` and the router reads it, but neither skill parses it. The flag words stay in the goal text, reach every step prompt and skew the goal classification. Both skills should strip the flag in Start step 1 and pass it to `init` only when the user gave it.

## Starting Point

Start step 1 of both `SKILL.md` files parses only `--archive`, `--chrome` and `--pr-comment`. Step 4 already says to add `--rigor <level>` only when the user named a level. The router validates the value and halts on a bad one.

## Desired End State

`/agent-smith:10x-pipeline <id> <goal> --rigor thorough` (and the OpenSpec skill) starts a `thorough` run whose stored goal does not contain the flag. Hints, Start step 1 and the REFERENCE headings all list `--rigor`.

## Key Decisions Made

| Decision | Choice | Why |
| --- | --- | --- |
| Value check in the skill | None; pass the value through | The router halts on an invalid level before writing anything |
| Plain-words level ("run it thorough") | Stays in step 4 | Change.md keeps that rule; the orchestrator never picks a level itself |
| Router change | None | Router already reads and validates `--rigor` and `--rigor=<level>` |
| Tests | Content checks in `skill-loop.test.mjs` and `openspec-skill.test.mjs` | As change.md asks; existing OpenSpec hint assertion is updated |

## Scope

**In scope:** both `SKILL.md` hints and Start step 1 (step 4 pointer), two `docs/REFERENCE.md` headings, two test files.

**Out of scope:** router, policy, prompts, README, Anti-stall rules, ADRs.

## Architecture / Approach

Text edits only. One sentence added to step 1 of each skill; the Anti-stall sections stay equal. New tests read the loaded skill text, so the `SKILL_PATH` deliberate-break check works.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Skills and reference | Hints, step 1, REFERENCE headings | A new tier/model word breaking the word-ban tests |
| 2. Content tests | Pins for both skills | Exact-string hint test at `openspec-skill.test.mjs:72` |

**Prerequisites:** none.
**Estimated effort:** ~1 session, 2 small phases.

## Open Risks & Assumptions

- Assumes a bad or missing level value is best left to the router's halt.
- The final "stored goal is flag-free" check depends on the orchestrator following the skill text, so it is a manual row.

## Success Criteria (Summary)

- A `--rigor thorough` skill run records `thorough` and a flag-free goal.
- Full suite passes, and the deliberate-break check fails the new test.
