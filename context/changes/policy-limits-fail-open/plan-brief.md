# Validate policy limits, ladder and tiers at load — Plan Brief

> Full plan: `context/changes/policy-limits-fail-open/plan.md`

## What & Why

The keys that cap the spend of a run are read without a type check, so a string or `null` in the project policy override silently turns a bound off (`"14"` gives a 145-step budget, `null` halts at step 0, a loop cap never fires, a bad tier ends in a raw error). The plan adds one load-time check that halts with the key name before anything is written.

## Starting Point

`loadPolicy()` only checks that the override is a JSON object. Newer keys (`coAuthor`, `prices`, `agents`, `advisor`, `score`) have their own readers; `limits.maxNeutralRetries` is read tolerantly. `render` blanks an unknown `{name}`.

## Desired End State

`init`, `next` and `usage` halt on any malformed limit, ladder, tier or prompt placeholder, naming the key and the override file, with the change folder byte-identical. `status` still works and reports `policyProblem`. Shipped `policy.json` and `baseline-policy.json` pass.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Where the check lives | `policyProblems` in `state.mjs`, `promptProblem` in `flow.mjs`, both called once in `main()` | prompt resolution lives in `flow.mjs`; one call site | Plan |
| Which commands halt | `init`, `next`, `usage`; `status` adds `policyProblem`; `risk`, `verify-archive`, `compare` skip | `status` must stay usable as for a bad `coAuthor` | change.md |
| `maxNeutralRetries` | strict, non-negative safe integer, halts | one style for the `limits` block | Plan |
| `baseTier` vs `minTier`/`maxTier` | `baseTier` must lie in the ladder; only `minTier <= maxTier` is required | three characterization tests use base outside the bounds to test the clamp, and `tierFor` clamps it, so no bound breaks | Plan |
| Placeholders | one list in `steps.mjs`, unknown `{name}` in `policy.prompts` halts | misspelt placeholder vanished silently | change.md |

## Scope

**In scope:** limits, `escalation.maxAttemptsPerStep`, `rigor.budgetDelta`, `ladder`, step tiers, prompt placeholders, tests, docs, ADR-022.

**Out of scope:** other policy keys, upper bounds on limits, message templates of `archive`/`isolation`, halting in read-only commands.

## Architecture / Approach

Pure validator returns the first problem as text; `main()` halts before the run lock and any write. Tests drive the CLI in scratch projects and compare a folder snapshot.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Structural validator and wiring | `policyProblems`, halt in `main`, `status` field, new test file | existing tests that use odd values |
| 2. Prompt placeholders and `maxNeutralRetries` | `promptProblem`, strict neutral cap, test update | a shipped prompt using an unlisted name |
| 3. Docs and ADR | REFERENCE, prompts README, AGENTS.md, ADR-022 | doc-content guards |

**Prerequisites:** none. **Estimated effort:** ~2 sessions across 3 phases.

## Open Risks & Assumptions

- Assumption: the lenient `baseTier` rule replaces `minTier <= baseTier <= maxTier` of change.md (see decisions).
- Assumption: the check also covers `limits.maxNeutralRetries`, so the old test of a malformed value reading as 2 is replaced.
- Existing tests may use values the new check rejects; the implementer fixes the test, not the rule.

## Success Criteria (Summary)

- No malformed cap, ladder, tier or placeholder lets a run start or continue; the halt names the key.
- The four reproductions of change.md are test cases.
