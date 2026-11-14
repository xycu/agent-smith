# Opt-in fable ladder Implementation Plan

## Overview

Document the owner-approved project override that appends `fable/high` and `fable/xhigh` at tiers 8 and 9 and raises only `plan`, `plan-review`, `impl-review` and `fix` ceilings to 9. Keep the shipped eight-rung ladder, every existing tier index, all base/min tiers, budgets and the Claude/Sonnet/high baseline unchanged. Add focused regression proof using the existing router and test helpers; no production routing change is needed.

## Current State Analysis

The change brief predates provider dispatch. The router now merges the 10x policy, the OpenSpec fragment and the project override, replacing arrays whole and merging object keys. It accepts arbitrary nonempty model identifiers rather than enforcing a model-alias allowlist. A rung without `provider` means Claude; `dispatchTarget` selects provider/model/effort, and the shared skills dispatch Claude actions through Agent. A Codex host rejects any ladder containing Claude rungs. These contracts already support the requested override.

The default ladder ends at tier 7 (`opus/max`). The four requested ceilings are respectively 7, 6, 6 and 7. Merely appending rungs changes no ceiling. OpenSpec has its own `os-` step bounds, which do not inherit later overrides of similarly named 10x steps. The opt-in example will leave them unchanged.

The brief's Claude Code 2.1.311 observation is historical evidence of the Agent alias, not proof of the earliest supported release. Official model documentation checked on 2026-11-14 lists Fable efforts `low`, `medium`, `high`, `xhigh`, `max`. With `ANTHROPIC_DEFAULT_FABLE_MODEL` unset, `fable` resolves to Fable 5 in Claude apps gateway sessions and to Fable 5.2 elsewhere. Fable 5.2 requires Claude Code 2.1.321+. The subagent documentation lists `fable` and states that per-invocation effort requires 2.1.292+. Account availability, the resolved model, provider mapping, environment overrides and organization effort caps remain host prerequisites, outside router validation.

Planning verification on Node v24.19.0:

- Existing `ladder.test.mjs`, `providers.test.mjs` and `cost.test.mjs`: 57 passed, zero failed/skipped.
- A pure-function probe accepted the proposed policy and dispatched its appended rungs as Claude; Codex rejected that ladder. Large tier requests clamped the selected steps at 9 and kept implement/OpenSpec at their existing bounds.
- A real CLI fixture with a two-phase plan and RETHINK review routed the initial revision at 7 and its first failed retry at 8. A second failed revision halted at the unchanged two-revision limit. The preliminary expectation of a third dispatch at 9 was disproved and is explicitly excluded from the plan.
- An `xhigh` interactive floor skips tier 8 to 9, including when the step ceiling is 8: effort floors apply after clamps. A custom `max` floor with a requested tier above 7 exhausts the ladder at `xhigh`; this existing generic limitation means the documented example must not claim support for that custom floor.
- With sonnet priced at 6, one million sonnet tokens and one million unpriced fable tokens yield `{ usd: 6, priced: 1, withFigures: 2, unpriced: ["fable"], perEntry: { "1": 6, "2": null } }` internally. Public status uses `usd: null` when nothing is priced.

### Key Discoveries

- `skills/10x-pipeline/scripts/state.mjs:40`: array replacement and object merge; `:59`: both-chain plugin defaults; `:92`: legacy provider default; `:95`: dispatch; `:102`: host compatibility; `:154`: policy validation; `:210`: cost estimator; `:253`: Progress parser.
- `skills/10x-pipeline/scripts/steps.mjs:548`: `tierFor` owns bounds, failure escalation, score shifts and effort floors. Floors apply after the clamp and inspect each rung's effort, not just its index.
- `skills/10x-pipeline/scripts/route.mjs:187`: tier calculation precedes dispatch; `:385`: fixed baseline identity; `:586`: missing-price comparison warnings; `:690`: public status cost fields.
- `skills/10x-pipeline/scripts/flow.mjs:98`: report cost formatting; `:693`: RETHINK routing; `:765`: fix uses the last code tier as a floor.
- `skills/10x-pipeline/test/ladder.test.mjs`: existing default rung/pin assertions and CLI fixtures are the owned regression location. `cost.test.mjs` already covers generic cost behavior; `providers.test.mjs` covers legacy Claude and Codex rejection.
- `context/changes/WAVES.md`, Wave 5: this change owns ladder/max-tier behavior and `ladder.test.mjs`; README/reference text may be shared in separate regions. `skills-disable-model-invocation` owns skill frontmatter and manifest descriptions.

## Desired End State

An eligible Claude Code user can copy one complete JSON override from the reference into their existing project policy, preserving unrelated keys. The array repeats exactly the original eight rungs before appending two. Only four `maxTier` keys change. The README links to that example and explains compatibility and cost. No project enables fable simply by upgrading the plugin.

Tests execute the published example rather than a separately maintained copy. They prove fable dispatch, selective bounds, valid effort floors, truthful unpriced reporting, and unchanged default/baseline behavior. Documentation distinguishes an available ceiling from a promise that every run reaches it.

## What We're NOT Doing

- No edits to either shipped `policy.json`, `baseline-policy.json`, `codex-policy.json`, the repository's active project override, `BASELINE_PIN`, routing scripts, cost implementation or prompt files.
- No new switch, preset file, dependency, model-name registry, provider inference, automatic host-version detection, live fallback or named-tier migration.
- No raised OpenSpec ceilings, higher base/min tiers, changed score thresholds, relaxed retry/revision/step limits or claim of measured model equivalence or savings.
- No skill frontmatter, descriptions, manifest/version fields, invocation instructions, or unrelated README introduction edits. Those belong to `skills-disable-model-invocation`; coordinate through these explicit region boundaries, not by changing that change's files.
- No edits to `WAVES.md`, `context/archive/`, router-owned live run state or other changes. No archive reads are needed. The roadmap has no matching Change ID and remains untouched.
- No production repair of custom ladders that cannot satisfy a requested effort floor. The example is scoped to the shipped floors; its `max` incompatibility is documented.

## Implementation Approach

Use the existing override surface. Keep one canonical copyable ladder example under a stable `### Opt-in fable ladder` heading within the reference's configuration section. The README links to it. The owning test file reads the JSON fence immediately under that heading, asserts its shape, then passes it to existing scratch-project helpers so the real policy merge and CLI run are exercised. This small local extraction needs no general Markdown parser or exported helper.

The only implementation files are `README.md`, `docs/REFERENCE.md` and `skills/10x-pipeline/test/ladder.test.mjs`, plus this change's tracking/evidence artifacts. No new test file means no new test-index row is required. Existing test helpers and other Wave 5 files stay untouched. Since `tierFor`, `decide` and OpenSpec verification do not change, the repository's conditional requirement to update the skill's tier-movement list does not trigger; do not introduce model names into either skill.

### Decisions and assumptions

| Decision | Evidence and rationale |
| --- | --- |
| Use a documented override, not new default policy | Owner approval and the supplied task explicitly settle this. Existing array replacement supports it. |
| Append high/xhigh at 8/9; set the four named ceilings to 9 | The brief proposes those rungs and steps; official Fable documentation supports both efforts. Retaining all other keys preserves existing behavior. |
| State Claude Code 2.1.321+ as the Fable 5.2 requirement and document deployment-specific alias resolution | Official model docs map the unpinned alias to Fable 5 in Claude apps gateway sessions and Fable 5.2 elsewhere. `ANTHROPIC_DEFAULT_FABLE_MODEL` can override that mapping. Check the resolved model, exposed Agent schema and model access before adoption. |
| Keep custom `max` floors out of this example's supported combinations | The researched `tierFor` behavior exhausts the ladder below that floor. Fixing arbitrary ladders is outside Wave 5 ownership and unnecessary for the shipped floors. |
| Use illustrative fable price 12 in price examples, explicitly not a provider quote | The estimator takes user-supplied blended USD per million total tokens; it cannot derive a bill from separate provider input/output/cache tariffs. An arbitrary labeled example avoids a fabricated market price. |
| Keep planning and implementation to two phases | Medium complexity: no runtime code change, but docs, provider compatibility, cost outputs and regression contracts interact. The unattended instruction replaces interviews and phase approval with these evidence-backed decisions. |

## Phase 1: Document the opt-in policy and its limits

### Overview

Publish a precise copyable configuration and price explanation without changing runtime defaults or descriptions owned by the invocation change.

### Changes Required

#### 1. Canonical policy example

**File**: `docs/REFERENCE.md`

**Intent**: Give compatible Claude hosts a safe opt-in recipe, and explain its actual escalation and merge behavior.

**Contract**: Under `### Opt-in fable ladder`, the first JSON fence contains only `ladder` and `steps`: all eight existing ladder objects unchanged, then `{ "model": "fable", "effort": "high" }` and `{ "model": "fable", "effort": "xhigh" }`; `steps` contains only `plan`, `plan-review`, `impl-review`, `fix`, each with only `maxTier: 9`. Omitted providers intentionally use the existing Claude default. State that arrays replace whole, existing project keys must be merged deliberately, and this is not a drop-in combination with the GPT overlay or a Codex host.

Add a short cross-reference in the routing bullets. Explain that tier order reflects intended model capability, not monotonically increasing effort: moving from opus/max to fable/high lowers the effort label. Shipped lean/standard/thorough floors remain medium/high/high. The final effort floor can override a lower step ceiling; custom `xhigh` skips the new high rung, while a custom `max` floor is incompatible with this two-rung extension. Leave the existing algorithm intact. Note that ordinary first plans, score shifts and bounded retries do not automatically reach fable; the unchanged revision cap still halts the characterized RETHINK path after tiers 7 and 8. All `os-` ceilings remain unchanged.

#### 2. Compatibility and cost guidance

**Files**: `README.md`, `docs/REFERENCE.md`

**Intent**: Make opt-in prerequisites and financial uncertainty explicit without implying default availability or accurate billing.

**Contract**: README Configure links to the canonical example. Its Install requirements keep the general 2.1.292 minimum and separately identify 2.1.321+ for Fable 5.2. Both compatibility explanations state that, with `ANTHROPIC_DEFAULT_FABLE_MODEL` unset, the alias resolves to Fable 5 in Claude apps gateway sessions and Fable 5.2 elsewhere. Describe the version requirement for the resolved model and check any environment/provider mapping. Cite the official model/subagent pages, date the compatibility statement, retain the brief's 2.1.311 observation only as historical evidence if mentioned, and require checking the resolved model, exposed Agent alias/effort parameters and account access before adoption. The router performs no version/capability detection. Retain existing orchestration-error handling rather than repeating the brief's stale claim that every pre-launch refusal becomes an escalating `unknown` step.

Both existing price examples gain `"fable": 12`, with adjacent text labeling **all numbers illustrative user-supplied blended rates, not current provider prices**. Pricing remains a separate opt-in from the ladder and `prices: null` stays the default. Explain the formula `totalTokens * rate / 1e6`, no input/output/cache split, model-keyed rates rather than provider/effort-specific rates, and no billing or savings guarantee. Omit unknown prices; `0` is a real zero rate, not an unknown placeholder. With an active table missing fable, per-step status cost is null, the report cell is `-`, the summary names `no price for: fable`, and compare adds `cost-incomplete:routed` without changing its token verdict. When nothing is priced status totals are null, not zero; with prices off no cost output appears in status/report and compare side costs remain null.

### Success Criteria

#### Automated Verification

- The canonical reference JSON parses and exactly preserves tiers 0–7, appends tiers 8–9 and changes only the four selected maxTier keys.
- README and reference agree on compatibility, merge semantics, floor limitations and illustrative pricing; default policies, skill/manifest descriptions, WAVES.md and archive paths have no diff.

## Phase 2: Prove the published configuration through regression tests

### Overview

Extend the owned ladder suite with targeted cases and run the relevant existing gates. Preserve every default expectation and characterized tier literal.

### Changes Required

#### 1. Published-policy and routing regressions

**File**: `skills/10x-pipeline/test/ladder.test.mjs`

**Intent**: Detect drift between the published opt-in and what the router dispatches, including the effort/clamp ordering and unchanged safety limits.

**Contract**: Reuse `pluginPolicy`, `policyProblems`, `tierFor`, `dispatchTarget` and existing scratch-project helpers where each owns the behavior. Keep existing default ladder and step-pin tests unchanged. Parse the actual reference example once locally and assert its exact allowed keys and contents. Test both missing-provider compatibility and the effective Claude target; a Codex-host CLI init with this override must refuse before creating run state. Test expectations are fixed tier/model/effort outcomes, not values recomputed from the function being tested.

Required cases:

- The override validates, has ten rungs and retains all original entries and base/min pins. Every unselected step, including all OpenSpec steps, retains its effective configuration. The shipped ladder remains eight rungs.
- A real CLI fixture with a two-phase plan, RETHINK review and zero/one failed `plan-revise` entries produces tier 7 opus/max then tier 8 fable/high, `provider: claude`, with matching action/log values. Two failed revisions halt at the existing cap. Do not raise caps or base tiers merely to make this scenario reach tier 9.
- Focused `tierFor` cases with sufficient decision bumps prove tier 9 fable/xhigh dispatch and top clamping for each of the four opted-in steps; unselected steps clamp at their original maxima under shipped floors. Distinguish these pure routing tests from naturally reachable whole-run scenarios.
- Interactive routing on tiers 8/9 satisfies the shipped medium/high floors. A test-only `xhigh` floor at tier 8 skips to 9; a test-only ceiling of 8 still yields 9 because the effort floor wins. Characterize the incompatible custom `max` floor exhausting the ladder at xhigh as a documented limitation, not as a satisfied floor. Do not assert monotonically increasing effort across models.
- Default pins and the baseline file remain unchanged; rerun existing characterized loop and budget tests without renumbering literals. The baseline remains Claude/Sonnet/high and receives none of the fable step overrides.

#### 2. Missing-price reporting regressions

**File**: `skills/10x-pipeline/test/ladder.test.mjs`

**Intent**: Verify the user-visible cost boundary specifically for fable while retaining the existing estimator and generic cost suite.

**Contract**: Use existing helpers to construct scratch-only executed entries; never write the real run log. With fable token usage and a valid price table containing only another alias, assert `estimateCost` coverage/unpriced/null-entry behavior and CLI `status --report` null/`-`/`no price for: fable` output. Cover an all-unpriced run and a mixed priced/unpriced run so partial totals cannot be mistaken for zero or full coverage. A paired `compare` against a Claude/Sonnet/high baseline must add `cost-incomplete:routed` while preserving comparable/verdict/dropPercent/pinned results relative to the same token fixtures without prices. A priced fable case uses the illustrative rate 12, and prices-off output retains its existing shape. Reuse the generic tests for malformed and zero prices instead of duplicating them.

### Success Criteria

#### Automated Verification

- The published-override, provider, clamp, effort-floor and missing-price regressions pass in ladder.test.mjs with unchanged default assertions.
- Focused ladder, providers, cost, budget-executors and loops-existing suites pass without changed tier literals or unexpected skips.
- The repository-required full test command passes, and git diff --check plus a final path/region audit confirm the approved scope.

#### Manual Verification

- On a compatible Claude host, record version, exposed Agent model/effort support and successful foreground fable high/xhigh invocations; verify an older host without the opt-in continues to use the default ladder.

The unattended implementer completes Automated rows and leaves the Manual row pending unless the authorized host supplies actual evidence. A CLI routing result or web documentation is not proof of paid model execution. Do not launch nested subagents during this step or during an unattended implementation subagent.

## Testing Strategy

Unit coverage owns policy shape, `tierFor` boundaries and estimator arithmetic. CLI coverage owns actual project merge, action/log agreement, Codex refusal without writes, revision limits, status/report formatting and comparison neutrality. Reuse fixture helpers and `removeTree`; all scratch paths in this run must remain inside the run worktree, including the test process's `TMPDIR`.

Focused command on Node 24+:

```sh
node --test --test-concurrency=2 skills/10x-pipeline/test/ladder.test.mjs skills/10x-pipeline/test/providers.test.mjs skills/10x-pipeline/test/cost.test.mjs skills/10x-pipeline/test/budget-executors.test.mjs skills/10x-pipeline/test/loops-existing.test.mjs
```

Full gate required for this implementation:

```sh
node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs
```

Start every actual shell command with the required absolute worktree `cd` prefix. Create a uniquely named scratch directory under that worktree, pass it as `TMPDIR` to tests and remove it with the existing `removeTree` helper after completion. Do not edit helpers or CI to set this up. Record expected environment-dependent skips honestly; do not claim unexecuted host or CLI acceptance. No browser/E2E framework is needed.

## Performance Considerations

There is no added production code or default execution cost. Opting into higher model tiers can increase paid usage and latency; no relative capability/cost calibration has been measured. A model's effort names are calibrated per model, so cross-model names alone establish no cost ordering.

## Migration Notes

No state migration or tier renumbering. Users deliberately merge the full array and selected step keys into a committed project override before a new run, preserving other settings. Do not apply this override to the baseline arm or blindly combine it with the GPT overlay. To stop opting in, restore the previous ladder and the four previous ceilings together; removing only the appended entries leaves out-of-range maxima that policy validation rejects. Preserve unrelated override keys. Existing pending/neutral retries can retain stored dispatch targets; changing policy is not a cancellation mechanism or a way to rewrite historical logs. Default installations need no action.

## References

- `context/changes/ladder-fable-rung/change.md`: problem, approved direction as narrowed by the task, and invariants.
- `context/changes/WAVES.md`: Wave 5 ownership; read-only for this run.
- `context/changes/skills-disable-model-invocation/change.md`: descriptions/frontmatter ownership; untouched.
- `context/foundation/lessons.md`: evidence-first investigation, no nested subagents, and doc drift checks.
- `docs/ADR/ADR-024-openai-codex-support.md`: current provider/host boundary.
- `skills/10x-pipeline/scripts/state.mjs`, `steps.mjs`, `flow.mjs`, `route.mjs`: owners identified above; read-only for implementation.
- `skills/10x-pipeline/test/ladder.test.mjs`, `cost.test.mjs`, `providers.test.mjs`, `helpers.mjs`: regression patterns and reusable fixtures.
- `skills/10x-pipeline/baseline-policy.json`, `skills/openspec-pipeline/policy.json`: unchanged baseline and OpenSpec step bounds.
- [Claude Code model configuration](https://code.claude.com/docs/en/model-config), “Work with Fable” and “Adjust effort level”; checked 2026-11-14.
- [Claude Code subagents](https://code.claude.com/docs/en/sub-agents), “Choose a model” and “Choose an effort level”; checked 2026-11-14.

## Progress

### Phase 1: Document the opt-in policy and its limits

#### Automated

- [ ] 1.1 The canonical reference JSON parses and exactly preserves tiers 0–7, appends tiers 8–9 and changes only the four selected maxTier keys.
- [ ] 1.2 README and reference agree on compatibility, merge semantics, floor limitations and illustrative pricing; default policies, skill/manifest descriptions, WAVES.md and archive paths have no diff.

### Phase 2: Prove the published configuration through regression tests

#### Automated

- [ ] 2.1 The published-override, provider, clamp, effort-floor and missing-price regressions pass in ladder.test.mjs with unchanged default assertions.
- [ ] 2.2 Focused ladder, providers, cost, budget-executors and loops-existing suites pass without changed tier literals or unexpected skips.
- [ ] 2.3 The repository-required full test command passes, and git diff --check plus a final path/region audit confirm the approved scope.

#### Manual

- [ ] 2.4 On a compatible Claude host, record version, exposed Agent model/effort support and successful foreground fable high/xhigh invocations; verify an older host without the opt-in continues to use the default ladder.
