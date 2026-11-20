# Make next refuse a run that init would refuse for missing isolation — Plan Brief

> Full plan: `context/changes/next-requires-isolated-init/plan.md`

## What & Why

`init` refuses to start a run outside an isolated worktree, but `next` has no such check. A skipped `init` (or a person typing `next`) runs steps in the main checkout with an empty goal, without step commits or rollback. The plan adds one guard to `next`.

## Starting Point

`init` calls `isolationCheck` (`route.mjs:1105`) and records `isolated: true` in `meta.json`. `next()` (`route.mjs:83`) reads `meta.json` with a `{ id, goal: "" }` fallback and checks nothing about isolation.

## Desired End State

With `isolation.require` on and no `isolated: true` in `meta.json`, `next` halts, writes nothing and names `init`. Runs started by `init` advance as before; isolation-off projects behave as today.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Guard condition | `isolationOn(policy) && meta.isolated !== true` | Same signal `init` stores, no duplicate git checks. | Plan |
| `next` without `meta.json`, isolation off | Keep today's behavior | The goal says isolation-off projects keep today's behavior, and the opt-out path relies on it. | Plan |
| Placement | Right after the metadata read, before temp cleanup and `mkdir` | Guarantees "writes nothing". | Plan |
| Message | One text for no file and for a file without the flag, naming `init` | The `init` halt then gives the specific cause. | Plan |
| Docs | One bullet in the "Run isolation" list of `docs/REFERENCE.md` | REFERENCE has no `next` section. | Plan |

## Scope

**In scope:** the guard in `route.mjs`; four tests in `isolation.test.mjs`; fixture fixes for tests the guard breaks; one REFERENCE bullet; a doc grep.

**Out of scope:** changes to `init`, `isolationCheck`, skills, prompts, policy keys and ADRs; re-running worktree and branch checks in `next`.

## Architecture / Approach

One early `halt()` in `next()`. Both chains share `next()` and `meta.isolated`, so one guard covers both. `init`'s internal call to `next` is unaffected because `init` writes `isolated: true` first.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Guard `next` and test it | The guard, new tests, repaired fixtures | Existing tests that use isolation-on fixtures without `init` |
| 2. Document the rule | REFERENCE bullet, doc grep | A doc that states the old behavior |

**Prerequisites:** Node 24+, git.
**Estimated effort:** about one session, two small phases.

## Open Risks & Assumptions

- Assumed: `next` without `meta.json` and isolation off keeps today's behavior (change.md left this to the plan).
- Some existing tests with their own `isolation` block may need `isolated: true` in their `meta.json` fixture.
- A legacy in-flight run (executed steps, not isolated) now halts at `next` as `init` already did.

## Success Criteria (Summary)

- `next` in a main checkout with the default policy halts, names `init` and leaves no files.
- An `init`-started isolated run still advances; the full suite passes.
- `docs/REFERENCE.md` carries the one new line.
