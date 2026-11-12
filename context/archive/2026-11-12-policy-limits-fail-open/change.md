---
change_id: policy-limits-fail-open
title: Validate policy limits, ladder and tiers at load instead of failing open
status: archived
created: 2026-11-12
updated: 2026-11-12
archived_at: 2026-11-12T12:39:42Z
---

## Notes

Source: the repo review of 2026-11-12 (LLM engineering and Claude Code practice). Severity: high.

### Problem

The keys that bound the cost of a run are read without a type check, so a wrong value in `context/foundation/agent-smith-policy.json` turns the bound off instead of halting.

- `skills/10x-pipeline/scripts/route.mjs:118`: `Math.max(1, policy.limits.maxTotalSteps + (policy.rigor.budgetDelta?.[level] ?? 0))`. With the string `"14"` the sum is a string: `"14-2"` at `lean` gives `NaN`, and `budgetSteps(log) >= NaN` is never true, so the step budget never halts; at `standard` it is `"145"`, a budget of 145 steps.
- `limits.maxFixLoops` and `limits.maxPlanRevisions` (`flow.mjs:720`, `preplan.mjs:333`, `openspec.mjs:198`) compare with `>=`. A value that is not a number makes the comparison false for ever, so the loop cap never fires.
- `escalation.maxAttemptsPerStep: null` makes `fails >= null` true at 0 (`route.mjs:170`).
- A tier outside the ladder, or a shortened `ladder`, ends in a raw error at `route.mjs:180`.
- `render` (`steps.mjs:670`) replaces an unknown `{name}` with empty text, so a misspelt placeholder in a project template vanishes with no halt.

Newer keys are checked (`coAuthor`, `prices`, `agents`, `advisor`, `score`, `limits.maxNeutralRetries`). The oldest keys, the ones that cap spend, are not.

### Reproduction (verified)

Scratch project, `isolation.require: false`, `score.minRigor: null`, `rigor.budgetDelta` all `0`:

1. `limits.maxTotalSteps: 1`: `init`, a `failed` result, `next` halts with `Step budget 1 spent.`
2. `limits.maxTotalSteps: "1"`: the same calls return step 2 (`run plan`). The budget is `"10"`.
3. `escalation.maxAttemptsPerStep: null`: `init` halts with `plan failed 0 times in a row. Last note: none`.
4. `steps.plan.baseTier: 9` (also `ladder` with one entry): `init` halts with `Router error: Cannot destructure property 'model' of 'policy.ladder[tier]' as it is undefined.`

### Fix direction

- One `policyProblems(policy)` in `scripts/state.mjs`, run on the merged policy by every command that loads it. It returns the first problem as text that names the key and the file to fix.
- Checks: `limits.maxTotalSteps` is a positive safe integer; `limits.maxPlanRevisions`, `limits.maxFixLoops` are non-negative safe integers; `escalation.maxAttemptsPerStep` is a positive safe integer; every `rigor.budgetDelta.<level>` is a safe integer; `ladder` is a non-empty array of objects with non-empty string `model` and `effort`; every `steps.<name>` has integer `baseTier`, `minTier`, `maxTier` inside the ladder with `minTier <= baseTier <= maxTier`; every `{name}` in a template is one the router fills (list in `prompts/README.md`, which also lacks `{artifacts}`, `{authority}` and `{failure}`).
- Fail closed: `init`, `next` and `usage` halt and write nothing, as `override-json-error-halt` does for JSON that does not parse. The plan decides whether read-only commands halt or warn; `status` must stay usable on a broken policy, as it is for a malformed `coAuthor`.
- Keep the tolerant read of `limits.maxNeutralRetries`, or move it under the same check. Do not leave two styles for one block.

### Tests

- A new `policy-validate.test.mjs`: one case per key and per wrong shape (string, `null`, negative, float, out of range), asserting the halt text names the key and that the change folder is byte-identical.
- The four reproductions above as cases.
- The shipped `policy.json` and `baseline-policy.json` pass the check.

### Done when

No value of a limit, ladder or tier key can make a run exceed its shipped bounds silently, and every malformed value halts with the key name before anything is written.
