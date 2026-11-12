# Validate policy limits, ladder and tiers at load Implementation Plan

## Overview

The keys that cap the spend of a run (`limits.*`, `escalation.maxAttemptsPerStep`, `rigor.budgetDelta`, `ladder`, `steps.<name>` tiers) are read without a type check, so a wrong value in `context/foundation/agent-smith-policy.json` turns a bound off instead of halting. Add one `policyProblems(policy)` in `scripts/state.mjs`, run it on the merged policy in `main()` before `init`, `next` and `usage` do anything, and halt with the key name. Add a placeholder check for prompt templates and move `limits.maxNeutralRetries` under the same check.

## Current State Analysis

- `loadPolicy()` (`state.mjs:68`) returns `policy.json` deep-merged with the override. Only the JSON shape of the override is checked (`mergedPolicy`, `state.mjs:51`). Newer keys have their own tolerant or strict readers (`coAuthorProblem` `state.mjs:102`, `priceTable`, `maxNeutralRetries` `flow.mjs:313`).
- Unchecked reads: `route.mjs:118` (budget), `route.mjs:170` (`fails >= maxAttemptsPerStep`), `route.mjs:180` (`policy.ladder[tier]`), `flow.mjs:720`, `preplan.mjs:333`, `preplan.mjs:259`, `openspec.mjs:198` (loop caps).
- `render` (`steps.mjs:669`) turns an unknown `{name}` into empty text.
- `main()` (`route.mjs:~836`) calls `loadPolicy()`, then `acquireRunLock` for `init`/`next`/`usage`; `status` calls `loadPrices()` and never touches the ladder.

## Desired End State

`init`, `next` and `usage` halt with `{action:"halt", reason}` naming the key and the override file, before the run lock, `meta.json`, the log or any commit is written, for any malformed limit, ladder, tier or prompt placeholder. `status` still works on a broken policy and reports the problem in a `policyProblem` field. The shipped `policy.json` and `baseline-policy.json` pass. Verified by the new `policy-validate.test.mjs` and the full suite.

### Key Discoveries:

- `halt()` (`state.mjs:779`) prints JSON and exits 1; `override-json.test.mjs` is the pattern for "halt and write nothing" and `late-usage.test.mjs:24` has a `snapshot(dir)` helper for byte-identical folder assertions.
- Placeholders the router fills: `id, goal, verdict, artifacts, authority, phase, lastPhase, retry, uncommitted, failure, unproven, browserRows, evidence, lessonMax, lessonChars, findings` (the `vars` object, `route.mjs:~183`) plus `workdir` (`isolation.mjs:290`). A scan of the shipped prompts finds no other `{word}`. `prompts/README.md` lacks `{artifacts}`, `{authority}`, `{failure}`.
- Three characterization tests put `baseTier` outside `[minTier, maxTier]` on purpose to test the clamp (`route.test.mjs:286`, `score.test.mjs:756` and `:885`).

## What We're NOT Doing

- No check of other keys (`escalation.perFailure`, bumps, `rigor.fromGoal`, `complexity.*`, `archive.*`/`isolation.*` message templates and their `{id}`, `{n}`, `{run}`, `{step}` placeholders). The scope is the keys that cap spend plus prompt placeholders.
- No upper bound on `limits.*`: a high value is an explicit owner choice, not a silent one.
- No halt in `risk`, `verify-archive` and `compare`; they read no cap key and already turn a bad read into a JSON halt in `main`'s catch.
- No change to `SKILL.md` files (they name no limits) and no change to `policy.json` values.
- No requirement that `baseTier` lies inside `[minTier, maxTier]`: three existing characterization tests set it outside the bounds on purpose and `tierFor` clamps it (see `plan-brief.md`, Key Decisions).

## Implementation Approach

One pure function `policyProblems(policy)` returns the first problem as text, in a fixed order (blocks, limits, escalation, budgetDelta, ladder, steps). A second function `promptProblem(policy)` in `flow.mjs` (it needs `promptText`, which lives there) checks placeholders. `main()` runs both once, right after `loadPolicy()`, for `init`, `next`, `usage`. Fail closed, same style as the override JSON halt. `maxNeutralRetries` becomes a plain read of a validated value, so the block has one style.

## Phase 1: Structural validator and wiring

### Overview

`policyProblems` for limits, escalation, budgetDelta, ladder and step tiers; wire into `main()`; `status` field; new test file with the structural cases and the four reproductions.

### Changes Required:

#### 1. Validator

**File**: `skills/10x-pipeline/scripts/state.mjs`

**Intent**: Add and export `policyProblems(policy)`, placed beside `coAuthorProblem`. It never throws and never halts; the caller halts.

**Contract**: Returns `null` or one string of the form `policy.<key> must be <rule> (got <JSON value>). Fix it in context/foundation/agent-smith-policy.json. Nothing was written.` Rules, checked in this order, first problem wins:
- `limits`, `escalation`, `rigor`, `rigor.budgetDelta`, `steps` are plain objects (use `isObject`); `ladder` is a non-empty array.
- `limits.maxTotalSteps` positive safe integer; `limits.maxPlanRevisions`, `limits.maxFixLoops`, `limits.maxNeutralRetries` non-negative safe integers; `escalation.maxAttemptsPerStep` positive safe integer. A missing key is a problem (`undefined`).
- every own entry of `rigor.budgetDelta` is a safe integer, message names `rigor.budgetDelta.<level>`.
- every `ladder[i]` is an object with non-empty (trimmed) string `model` and `effort`; message names `policy.ladder[i].model`.
- every `steps.<name>` is an object whose `baseTier`, `minTier`, `maxTier` are integers in `0..ladder.length-1` with `minTier <= maxTier`; message names `policy.steps.<name>.<field>`.

#### 2. Wiring

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: In `main()`, right after `loadPolicy()` and before `resolveChain` and `acquireRunLock`, halt on the first problem for `init`, `next` and `usage`. In `status`, add `policyProblem: <text>` to the printed object only when there is a problem (so existing output is unchanged).

**Contract**: `if (["init","next","usage"].includes(cmd)) { const bad = policyProblems(policy); if (bad) halt(bad); }`. Import `policyProblems` from `state.mjs`. `main()` already holds the merged policy for `status`; pass it as a new argument (`status(id, flags, chain, policy)`) and call `policyProblems` there. Read-only commands never halt on it.

#### 3. Tests

**File**: `skills/10x-pipeline/test/policy-validate.test.mjs` (new)

**Intent**: One case per key and per wrong shape (string, `null`, negative, zero where positive is required, float, NaN-like string, out of range tier, `minTier > maxTier`, empty ladder, ladder entry without `effort`), each through `init` in a scratch project (`makeProject({ policy })`), asserting exit 1, `action: "halt"`, the reason contains the key name and the override file name, and the change folder is byte-identical (copy `snapshot` from `late-usage.test.mjs:24` into the new file; `helpers.mjs` stays as it was except for `writeOverride` and `cleanupAll`, per `AGENTS.md`) and no `agent-smith/meta.json` exists. The four reproductions of `change.md` as named cases (`maxTotalSteps: "1"` halts at `init`; `maxTotalSteps: 1` still halts at `Step budget 1 spent.` and needs `init`, a `failed` result and `next`, so it is the one case that is not init-only; `maxAttemptsPerStep: null`, `baseTier: 9` and a one-entry `ladder`). `next` and `usage` each get one case on a project whose policy is broken after `init`. `status` on a broken policy exits 0 and has `policyProblem`. The shipped `policy.json` has `policyProblems === null`, and a project whose override is the content of `baseline-policy.json` inits without a policy halt.

### Success Criteria:

#### Automated Verification:

- New test file passes: `node --test skills/10x-pipeline/test/policy-validate.test.mjs`
- Four reproductions of `change.md` halt with the key name and write nothing: `node --test skills/10x-pipeline/test/policy-validate.test.mjs`
- `init`, `next` and `usage` write nothing on a malformed limit, ladder or tier, and `status` still prints JSON with `policyProblem`: `node --test skills/10x-pipeline/test/policy-validate.test.mjs`
- Shipped `policy.json` and `baseline-policy.json` pass the check: `node --test skills/10x-pipeline/test/policy-validate.test.mjs`
- Existing suite still passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`

#### Manual Verification:

- In a scratch project, an override of `{"limits":{"maxTotalSteps":"14"}}` makes `route.mjs init` print a halt that names `policy.limits.maxTotalSteps` and `agent-smith-policy.json`, and `agent-smith/` is not created.
- `route.mjs status <id>` on the same project prints valid JSON with `policyProblem`.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Prompt placeholders and `maxNeutralRetries`

### Overview

Reject a prompt template with a `{name}` the router never fills; move `limits.maxNeutralRetries` under the check; fix the one existing test that expects the tolerant read.

### Changes Required:

#### 1. Placeholder list

**File**: `skills/10x-pipeline/scripts/steps.mjs`

**Intent**: Export `PROMPT_PLACEHOLDERS`, the single list of names the router fills, next to `render`, so the list and the regex have one home.

**Contract**: An array of the 17 names above. `render`'s pattern `\{(\w+)\}` is the pattern the check uses.

#### 2. Placeholder check

**File**: `skills/10x-pipeline/scripts/flow.mjs`

**Intent**: Add and export `promptProblem(policy)` beside `checkPrompts`: for each template of `policy.prompts`, resolve it with `promptText`; skip a template that does not resolve (`promptText` throws for a missing key, a non-string part or a bad `@prompts/` reference: catch the throw and skip, so `checkPrompts` still reports it later with the text `preplan.test.mjs:183-195` expects, `Router error: policy.prompts.plan ...`); return the first `{name}` not in `PROMPT_PLACEHOLDERS` as `policy.prompts.<template> uses {<name>}, which the router never fills. Known placeholders: <list>. Fix it in context/foundation/agent-smith-policy.json. Nothing was written.`

**Contract**: `main()` in `route.mjs` calls `policyProblems(policy) ?? promptProblem(policy)` in the one place added in Phase 1; `status` does the same for `policyProblem`.

#### 3. `maxNeutralRetries`

**File**: `skills/10x-pipeline/scripts/flow.mjs`

**Intent**: `maxNeutralRetries(policy)` stops swallowing bad values: the value is validated at load, so it returns `policy.limits.maxNeutralRetries`. Update its comment. Check every other caller and test import of it (`grep -rn maxNeutralRetries skills/`) so none passes a policy without the key.

**Contract**: A malformed value now halts at load with `policy.limits.maxNeutralRetries`; `0` still turns neutral reruns off.

#### 4. Tests

**Files**: `skills/10x-pipeline/test/policy-validate.test.mjs`, `skills/10x-pipeline/test/neutral.test.mjs`

**Intent**: Add placeholder cases (a misspelt `{gaol}` in a project template halts naming `policy.prompts.<template>` and `{gaol}`; each of the 17 names is accepted; a literal `{"status":"done"}` JSON example is not a placeholder; an unresolvable `@prompts/` reference is not reported by this check). In `neutral.test.mjs`, replace "a malformed maxNeutralRetries reads as 2" (`:219`) with a case asserting `init` halts for each of `"3"`, `-1`, `1.5`, `null` with the key name; the other tests of that file stay.

### Success Criteria:

#### Automated Verification:

- Placeholder cases pass: `node --test skills/10x-pipeline/test/policy-validate.test.mjs`
- Neutral tests pass with the halt case: `node --test skills/10x-pipeline/test/neutral.test.mjs`
- Every shipped prompt passes the placeholder check (covered by the shipped-policy case): `node --test skills/10x-pipeline/test/policy-validate.test.mjs`
- Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`

#### Manual Verification:

- A scratch override that renames `{id}` to `{idd}` in the `plan` template makes `init` halt naming `policy.prompts.plan` and `{idd}`.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Docs and ADR

### Overview

Document the load check where the repo documents routing, fix the placeholder list, record the decision.

### Changes Required:

#### 1. Reference and prompts README

**Files**: `docs/REFERENCE.md`, `skills/10x-pipeline/prompts/README.md`

**Intent**: In `docs/REFERENCE.md` add a short "Policy validation" bullet group: which keys are checked and their rules, that `init`, `next` and `usage` halt before any write, that `status` reports `policyProblem`, and that `risk`, `verify-archive` and `compare` do not check. Replace line 368's "A value that is not a non-negative integer reads as 2" with the halt. In `prompts/README.md` add `{artifacts}`, `{authority}` and `{failure}` to the placeholder sentence and state that any other `{name}` halts.

**Contract**: Prose only; keep the "How the tier moves" list untouched (no tier logic changes).

#### 2. AGENTS.md and ADR

**Files**: `AGENTS.md`, `docs/ADR/ADR-022-policy-validation-at-load.md` (new), `docs/ADR/ADR-015-neutral-orchestrator-retry.md`

**Intent**: In `AGENTS.md` Project Structure, add `policyProblems` to the `state.mjs` item, `promptProblem` to `flow.mjs`, a bullet for `policy-validate.test.mjs`, and extend the `docs/ADR/` item with ADR-022. The ADR records: fail closed at load for the keys that cap spend, which commands check, the lenient `baseTier` rule, `maxNeutralRetries` moved from tolerant to strict, what stays unchecked. ADR-015 line 62 says a `maxNeutralRetries` that is not a non-negative integer MUST read as 2, which this change reverses: append an Amendment to ADR-015 (same style as Amendment 1 of ADR-012) that replaces that line with the halt and points to ADR-022, and leave the rest of ADR-015 as it is.

**Contract**: Same ADR section layout as `ADR-021-agent-smith-co-author.md`.

### Success Criteria:

#### Automated Verification:

- Full suite passes (doc-content guards included): `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- No recursive delete pattern in the new docs and tests: `node --test skills/10x-pipeline/test/no-recursive-delete.test.mjs`

#### Manual Verification:

- `docs/REFERENCE.md`, `prompts/README.md` and `AGENTS.md` read consistently about which commands halt and which warn.

---

## Testing Strategy

### Unit Tests:

- `policyProblems` on each key with string, `null`, negative, zero, float, out-of-range and wrong-type values; order of the checks (first problem wins).
- `promptProblem` on a misspelt name, all known names, JSON-looking braces.

### Integration Tests:

- CLI `init`, `next`, `usage` halt and leave the change folder byte-identical; `status` stays usable; both chains (`--chain openspec`) halt the same way at `init`, since the check runs before chain resolution.

### Manual Testing Steps:

1. Scratch project with `maxTotalSteps: "1"`: `init` halts, no `agent-smith/` folder.
2. Same project with `ladder` of one entry and `steps.plan.baseTier: 9`: halt names the tier.
3. `status` on the broken policy prints JSON with `policyProblem`.

## Performance Considerations

One pass over the policy and the prompt files per command; prompts are already read by `checkPrompts` in `next`. Negligible.

## Migration Notes

A project template that holds a `{word}` outside the 17 known names (it used to render as empty text) also halts, naming the template and the word. A project override that held a malformed value used to run with the bound off (or the default 2 for `maxNeutralRetries`); it now halts at the next `init`, `next` or `usage` and the text names the key. A run in flight resumes after the owner fixes the file; nothing in `run.jsonl` or `meta.json` changes.

## References

- Change: `context/changes/policy-limits-fail-open/change.md`
- Pattern: `override-json.test.mjs`, `coAuthorProblem` (`state.mjs:102`), `late-usage.test.mjs:24` (`snapshot`)
- Unchecked reads: `route.mjs:118`, `route.mjs:170`, `route.mjs:180`, `flow.mjs:720`, `preplan.mjs:333`, `openspec.mjs:198`, `steps.mjs:669`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Structural validator and wiring

#### Automated

- [x] 1.1 New test file passes: `node --test skills/10x-pipeline/test/policy-validate.test.mjs` — c47b4e7
- [x] 1.2 Four reproductions of `change.md` halt with the key name and write nothing: `node --test skills/10x-pipeline/test/policy-validate.test.mjs` — c47b4e7
- [x] 1.3 `init`, `next` and `usage` write nothing on a malformed limit, ladder or tier, and `status` still prints JSON with `policyProblem`: `node --test skills/10x-pipeline/test/policy-validate.test.mjs` — c47b4e7
- [x] 1.4 Shipped `policy.json` and `baseline-policy.json` pass the check: `node --test skills/10x-pipeline/test/policy-validate.test.mjs` — c47b4e7
- [x] 1.5 Existing suite still passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` — c47b4e7

#### Manual

- [ ] 1.6 In a scratch project, an override of `{"limits":{"maxTotalSteps":"14"}}` makes `route.mjs init` print a halt that names `policy.limits.maxTotalSteps` and `agent-smith-policy.json`, and `agent-smith/` is not created
- [ ] 1.7 `route.mjs status <id>` on the same project prints valid JSON with `policyProblem`

### Phase 2: Prompt placeholders and `maxNeutralRetries`

#### Automated

- [ ] 2.1 Placeholder cases pass: `node --test skills/10x-pipeline/test/policy-validate.test.mjs`
- [ ] 2.2 Neutral tests pass with the halt case: `node --test skills/10x-pipeline/test/neutral.test.mjs`
- [ ] 2.3 Every shipped prompt passes the placeholder check (covered by the shipped-policy case): `node --test skills/10x-pipeline/test/policy-validate.test.mjs`
- [ ] 2.4 Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`

#### Manual

- [ ] 2.5 A scratch override that renames `{id}` to `{idd}` in the `plan` template makes `init` halt naming `policy.prompts.plan` and `{idd}`

### Phase 3: Docs and ADR

#### Automated

- [ ] 3.1 Full suite passes (doc-content guards included): `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- [ ] 3.2 No recursive delete pattern in the new docs and tests: `node --test skills/10x-pipeline/test/no-recursive-delete.test.mjs`

#### Manual

- [ ] 3.3 `docs/REFERENCE.md`, `prompts/README.md` and `AGENTS.md` read consistently about which commands halt and which warn
