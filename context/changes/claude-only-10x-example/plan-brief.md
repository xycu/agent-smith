# Restore the shipped Claude-only ladder: README recipe — Plan Brief

> Full plan: `context/changes/claude-only-10x-example/plan.md`

## What & Why

Add a README Configure recipe for a project whose override holds the OpenAI ladder. It restores the shipped Claude ladder, keeps unrelated override keys, explains that arrays replace whole and checks effective providers before a fresh run. Source: the S-12 launch manifest named in `change.md`.

## Starting Point

README Configure covers prices, the opt-in fable ladder and subagent depth, and `docs/REFERENCE.md` tells OpenAI adopters to re-merge the preset. Nothing documents the way back to Claude. The S-12 manifest is not in this repository.

## Desired End State

A reader replaces or deletes only the `ladder` key, leaves `compare`, `limits`, `codex.profile` and the rest alone, runs `init` for a fresh run and reads all-Claude providers. A test keeps the published ladder equal to `skills/10x-pipeline/policy.json`.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Where the recipe lives | README Configure, one cross-link in REFERENCE | The change goal names README; REFERENCE owns routing detail | Plan |
| What changes in the override | Only `ladder` (replace with eight shipped rungs, or delete the key) | Arrays replace whole, so partial rung edits leave OpenAI rungs behind | Plan |
| How to check providers | `init --provider-mode claude`, read `providerMode` and `providersByStep` | A scratch smoke run showed init reports both before launch | Plan |
| Drift guard | Fence-extraction test in `ladder.test.mjs` | Same pattern as the fable fence test; no new test index row | Plan |

## Scope

**In scope:** README subsection, one REFERENCE sentence, tests in `ladder.test.mjs`.

**Out of scope:** router, policy and prompt changes, OpenAI or split recipes, CHANGELOG, version, publication.

## Architecture / Approach

Docs plus one test. The README fence is parsed by the test, compared with the shipped ladder, and applied to a scratch OpenAI override to prove Claude providers and preserved unrelated keys.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Document the recipe | README subsection, REFERENCE link | Wording diverges from the unseen S-12 manifest |
| 2. Guard the snippet with a test | Drift and merge tests, full suite, smoke | Snippet heading text must match the test's split |

**Prerequisites:** Node 24+, the shipped policies.
**Estimated effort:** one short session, two phases.

## Open Risks & Assumptions

- Assumption: the S-12 manifest (`evidence/launch.md`) is absent, so wording follows the code and REFERENCE.
- Assumption: `init` is the right pre-run check; `status` shows no providers before a run exists.
- Applies to fresh runs; a resumed run keeps its stored mode.

## Success Criteria (Summary)

- README recipe present, linked from REFERENCE, with a one-key `ladder` fence equal to the shipped ladder.
- Full local suite passes and the smoke check returns all-Claude providers.
