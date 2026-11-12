# ADR-022: Policy validation at load

- **Status:** Accepted (implemented by an unattended run of change `policy-limits-fail-open`)
- **Date:** 2026-11-12
- **Deciders:** the repository owner (change `policy-limits-fail-open`, `change.md`); unattended plan and implementation runs for the readings below
- **Origin:** change `policy-limits-fail-open` (`context/archive/2026-11-12-policy-limits-fail-open/change.md` and `plan.md`). It amends ADR-015 (D5, the read of `limits.maxNeutralRetries`); no other decision is superseded.

## Context

- `loadPolicy()` returned `policy.json` merged with the project override and checked only the JSON shape of the override. The keys that cap the spend of a run (`limits.*`, `escalation.maxAttemptsPerStep`, `rigor.budgetDelta`, `ladder`, `steps.<name>` tiers) were read without a type check, so a wrong value such as `"maxTotalSteps": "14"` turned a bound off instead of halting.
- `render` turned a `{name}` the router never fills into empty text, so a misspelt placeholder in a project template silently dropped part of a prompt.
- `limits.maxNeutralRetries` was the one cap with a tolerant reader: a malformed value read as 2.

## Decision

### Where the check runs (D1)

**GIVEN** the command is `init`, `next` or `usage` **WHEN** `main()` has loaded the merged policy **THEN** the router **MUST** run `policyProblems(policy) ?? promptProblem(policy)` before the run lock, `meta.json`, the log or any commit is written, and halt with the first problem.

The text names the key, the value and `context/foundation/agent-smith-policy.json`, and ends `Nothing was written.` The check runs before the chain is resolved, so both chains halt alike.

### What is checked (D2)

`policyProblems(policy)` in `state.mjs` never throws and returns the first problem, in this order: `limits`, `escalation`, `rigor`, `rigor.budgetDelta` and `steps` are objects and `ladder` is a non-empty array; `limits.maxTotalSteps` and `escalation.maxAttemptsPerStep` are positive safe integers; `limits.maxPlanRevisions`, `limits.maxFixLoops` and `limits.maxNeutralRetries` are non-negative safe integers; every `rigor.budgetDelta.<level>` is a safe integer; every `ladder[i]` has a non-empty string `model` and `effort`; every `steps.<name>` has integer `baseTier`, `minTier` and `maxTier` in `0..ladder.length-1` with `minTier <= maxTier`.

`promptProblem(policy)` in `flow.mjs` halts on a `{name}` in a resolved prompt template that is not in `PROMPT_PLACEHOLDERS` (`steps.mjs`, the 17 names the router fills). A template that does not resolve is skipped, and `checkPrompts` reports it later as before.

### `baseTier` stays lenient (D3)

**GIVEN** a step whose `baseTier` lies outside `[minTier, maxTier]` but inside the ladder **WHEN** the policy loads **THEN** the router **MUST** accept it, because `tierFor` clamps it and three characterization tests set it so on purpose.

### Read-only commands (D4)

**GIVEN** the command is `status` **WHEN** the policy has a problem **THEN** the router **MUST** still print its JSON and add `policyProblem`. `risk`, `verify-archive` and `compare` do not check; they read no cap key.

### `maxNeutralRetries` is strict (D5)

`maxNeutralRetries(policy)` returns the validated value. A malformed value halts at load; `0` still turns neutral reruns off. ADR-015 carries an amendment that replaces its "reads as 2" line.

## Alternatives

- Validate lazily at each read: it spreads the checks over six modules and a bound is already off by the time a read fails.
- Clamp or coerce a wrong value: it hides the mistake, the failure this change removes.
- Require `baseTier` inside its bounds: breaks three existing tests for no gain.

## Not done

- No check of `escalation.perFailure`, the bumps, `rigor.fromGoal`, `complexity.*`, or the `archive.*` and `isolation.*` message templates and their placeholders.
- No upper bound on `limits.*`: a high value is an explicit owner choice.
- No change to `policy.json` values or to the `SKILL.md` files.

## Consequences

- A project override that held a malformed value used to run with the bound off (or the default 2 for `maxNeutralRetries`); it now halts at the next `init`, `next` or `usage`. A run in flight resumes after the owner fixes the file; `run.jsonl` and `meta.json` do not change.
- A project template with a `{word}` outside the 17 names, which used to render as empty text, now halts and names the template and the word.
- Adding a placeholder to the router means adding it to `PROMPT_PLACEHOLDERS`.

## Amendment 1

- `promptProblem` checks the templates that the router renders with fewer names against their own list, `NARROW_PLACEHOLDERS` in `steps.mjs`: `archive`, `os-archive` and `frame-authority` get `id`, `worktree` gets `workdir`, and `suffix` is not rendered and gets none. A known name outside that list used to render as empty text, or stay literal in `suffix`, with no halt; it now halts and names the template. A new narrow render site adds its template to that map.
- `policyProblems` also requires every `ladder[i].effort` to be one of `rigor.effortOrder`, which `tierFor` ranks by. With no usable `effortOrder` the effort is only a non-empty string, as before.
