# Drop the --size flag Implementation Plan

## Overview

Remove the `--size s|m|l` argument of `/agent-smith:10x-pipeline` and the `Size:` line of the run report. The first plan step, the only step the flag really steers, takes its model and effort from the goal text instead: a short goal with no hard keyword goes one tier cheaper, a hard keyword restores the top plan tier, and everything else lands one tier below today's default. The router decides from intent, as the product intends, with no manual hint.

## Current State Analysis

- `--size` is stored by `init` in `meta.json` as `size` and `sizeBump` (`skills/10x-pipeline/scripts/route.mjs:470-476`). `sizeBump` is -1, 0 or +1 (`skills/10x-pipeline/policy.json:21`) and reaches the tier only as `bump` on the first `plan` step (`route.mjs:259-260`, `route.mjs:357`).
- `--size s` also marks the first plan "simple", which applies `discount.plan` of 1 (`route.mjs:337-341`, `policy.json:25`). So the first plan runs at tier 2 (sonnet/medium) with `s`, tier 4 (opus/high) with `m`, tier 5 (opus/xhigh) with `l` (`policy.json:12`, base tier 4). It is the only inspected way to start the first plan below tier 4 (`research.md`).
- For every step after the first plan, `s` and `m` behave the same. `l` only blocks the "simple change" discount (`route.mjs:343-344`).
- Before the first plan the router has no artifact to measure. It holds the change id and the `--goal` text. The goal is used only to fill the prompt and the report (`route.mjs:158, 408`); `change.md` is checked for existence only (`route.mjs:256`).
- The `plan-revise` step reads the same `steps.plan` entry (base tier 4) and adds `rethinkBump` 2 or `reviseBump` 1 (`route.mjs:277-283`, `policy.json:31-32`). Changing `steps.plan.baseTier` would therefore also lower every re-plan tier.
- `parseFlags` is generic (`route.mjs:24-33`), so an unknown `--size` argument is ignored without an error.
- The report prints `Size: ${meta.size ?? "-"}` (`route.mjs:159`). The README describes the report as holding "goal, size and outcome" (`README.md:41`).
- `AGENTS.md` requires routing decisions to stay in `route.mjs` and `policy.json`, `SKILL.md` to name no models or tiers beyond what it documents, and the "How the tier moves" list in `SKILL.md` and the routing bullets in `README.md` to follow any change to tier logic.

## Desired End State

`route.mjs`, `policy.json`, `SKILL.md`, `README.md` and `AGENTS.md` no longer mention `--size`, `sizeBump` or a `Size:` line. A first plan step runs on:

- sonnet/high (tier 3) when the goal is empty, or longer than `maxWords` (25) words with no hard keyword;
- sonnet/medium (tier 2) when the goal is non-empty, at most 25 words and has no hard keyword, and no step has failed yet (the change counts as simple, `simple: true`);
- opus/high (tier 4) when any word of the goal starts with a hard keyword, whatever the goal's length.

The word limit and the keyword list are policy keys, overridable per project. Re-plan tiers are unchanged. The PRD and ADR-001 no longer name the size flag as a routing signal. Verify with scratch change folders, one per case above.

### Key Discoveries:

- `bump` on the first plan is the existing hook for a first-plan adjustment (`route.mjs:260`); the goal rule replaces `meta.sizeBump` there, so `tierFor` needs no change.
- `simpleSignal` already has a first-plan branch gated on a failure-free log (`route.mjs:337-341`); the goal rule replaces its `--size s` test and keeps the "any failed step ends the discount" behaviour.
- Applying the goal rule as first-plan offsets, with `steps.plan.baseTier` left at 4, gives the agreed tiers 2, 3 and 4 and keeps `plan-revise` at tiers 5 and 6 as today.
- `init` rebuilds `meta.json` from known keys only (`route.mjs:471-476`), so old `size` and `sizeBump` fields disappear on the next `init` and are ignored until then.

## What We're NOT Doing

- No LLM or content scoring of the goal, and no reading of `change.md`, `research.md` or `frame.md` for routing (FR-011 stays parked).
- No change to `steps.plan.baseTier`, `discount`, the ladder or any tier rule for steps after the first plan, except the removal of the `l` veto.
- No error or warning when `--size` is still passed: `parseFlags` ignores it, and `SKILL.md` no longer passes it.
- No edit to `context/foundation/shape-notes.md` (raw shaping notes), `context/archive/`, `.claude-plugin/` or the roadmap (no roadmap item has this Change ID).
- No change to `run.jsonl` or `meta.json` by hand; old runs keep their stored `size` field, which nothing reads.
- No keyword matching for non-English goals; a Polish goal matches no starter keyword and is judged by length alone.

## Implementation Approach

Two phases in the order `AGENTS.md` asks for: behaviour first, docs after. Phase 1 changes `route.mjs` and `policy.json` together, because the goal rule needs its policy keys and removing the flag leaves the first plan without a signal until the rule exists. Phase 2 updates the docs to the verified behaviour. The repository has no test suite, so each criterion is a scratch run from a project root with `context/changes/<id>/change.md`.

## Phase 1: Router and policy

### Overview

The router stops reading `--size`, and the first plan step takes its tier from the goal text through new `complexity.firstPlan` policy keys.

### Changes Required:

#### 1. Policy keys for the goal rule

**File**: `skills/10x-pipeline/policy.json`

**Intent**: Replace the `sizeBump` map with a `firstPlan` block holding the word limit, the hard keywords and the first-plan bumps. Leave `steps.plan` and `discount` as they are.

**Contract**: `complexity.firstPlan` is `{ "maxWords": 25, "hardKeywords": ["refactor", "migrate", "migration", "rewrite", "redesign", "architecture", "security", "authentication", "schema"], "bump": { "plain": -1, "hard": 0 } }`. `complexity.sizeBump` is removed. With `steps.plan.baseTier` 4, bump `plain` gives tier 3, bump `hard` gives tier 4, and a short goal gets bump `plain` plus the existing `discount.plan` of 1, giving tier 2. A project override replaces any of these keys; the `hardKeywords` array is replaced whole, as for `ladder`.

#### 2. Goal classification and first-plan bump

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: Add one helper that classifies the goal as short, plain or hard, and use it in the first-plan branch of `decide` to set `bump` and name the class in `reason`. Replace the `meta.sizeBump` value that branch uses today.

**Contract**: `goalClass(goal, policy)` returns `{ kind, keyword }` with `kind` one of `short`, `plain`, `hard`. Rules, in this order: a goal that is empty or only whitespace is `plain`; a goal where any whitespace-separated word starts with a `hardKeywords` entry, compared ignoring case and after stripping the word's leading non-alphanumeric characters (so `(refactor)` and `"migrate"` match), is `hard` and returns that keyword (so `Refactoring` matches `refactor`, and a hard keyword wins over a short goal); a goal of at most `maxWords` words is `short`; any other goal is `plain`. In `decide`, the first-plan branch (`!plan.exists || !plan.hasProgress`) sets `bump` to `firstPlan.bump.hard` for `hard` and to `firstPlan.bump.plain` for `short` and `plain`. Its `reason` keeps today's text and appends the class, for example `(goal: short)` or `(goal: hard, "refactor")`. `plan-revise` and every later step are untouched.

#### 3. First-plan "simple" signal

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: In `simpleSignal`, mark the first plan simple when the goal class is `short`, keeping the rule that any failed step ends the discount. Remove the `meta.size !== "l"` test from the branch for later steps.

**Contract**: For `d.step === "plan"`, the result is `{ simple: true, why: "short goal" }` only when `d.template === "plan"`, the class is `short` and no log entry has `ok === false`; otherwise `{ simple: false }`. For other steps the conditions are the phase and row limits and the failure-free log, as today, minus the size test.

#### 4. Remove the flag from storage, output and usage text

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: Stop reading, storing and printing the size. `init` keeps writing the goal; the report loses its `Size:` line.

**Contract**: `init` writes `meta.json` as `{ id, goal }` (an empty or missing `--goal` keeps the stored goal on resume, so a resumed run that has not planned yet keeps its goal class; today an empty `--goal ""` overwrites it). The fallback meta in `next` and `status` is `{ id, goal: "" }`. The report no longer prints a `Size:` line. The header comment (`route.mjs:7`) and the usage string (`route.mjs:461`) drop `[--size s|m|l]`. `parseFlags` is unchanged.

### Success Criteria:

#### Automated Verification:

- Script parses: `node --check skills/10x-pipeline/scripts/route.mjs`
- `policy.json` parses, keeps `steps.plan.baseTier` at 4 and has no `sizeBump`: `node -e "const p=JSON.parse(require('fs').readFileSync('skills/10x-pipeline/policy.json','utf8'));console.log(p.steps.plan.baseTier, p.complexity.sizeBump)"` prints `4 undefined`
- No size code remains: `grep -nE "sizeBump|meta\.size|flags\.size|--size|Size:" skills/10x-pipeline/scripts/route.mjs skills/10x-pipeline/policy.json` prints nothing
- A scratch change with `init scratch` and no goal returns `plan` on sonnet/high
- A scratch change with goal `fix a typo in the readme` returns `plan` on sonnet/medium, and `status scratch` shows `simple: true`
- A scratch change with goal `refactor the router` returns `plan` on opus/high, and `status scratch` shows `simple: false`
- A 25-word goal with no hard keyword returns `plan` on sonnet/medium and a 26-word goal returns sonnet/high
- Keywords match the start of a word, ignoring case and leading punctuation: goals `Refactoring the router` and `(refactor) the router` each return `plan` on opus/high
- A leftover `--size s` does nothing: `init scratch --goal "refactor the router" --size s` returns `plan` on opus/high and the resulting `meta.json` has no `size` key
- Re-plan tiers are unchanged: a scratch change with a `plan.md` that has `## Progress` and a newer `reviews/plan-review.md` holding `- **Verdict**: RETHINK` returns `plan-revise` on opus/max
- A scratch override `context/foundation/agent-smith-policy.json` setting `complexity.firstPlan.maxWords` to 2 makes goal `fix a typo in the readme` return `plan` on sonnet/high
- `status scratch --report` writes a `report.md` without a `Size:` line: `grep -c "^Size:" context/changes/scratch/agent-smith/report.md` prints `0`
- A resumed `init` with an empty goal keeps the stored goal: `init scratch --goal "refactor the router"` then `init scratch --goal ""` returns `plan` on opus/high and `meta.json` still holds `refactor the router`

#### Manual Verification:

- The `reason` and `tierWhy` of the first plan step name the goal class in wording a reader follows

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: Docs sync

### Overview

The orchestrator instructions, README, command reference and product documents describe the goal rule and no longer name the flag.

### Changes Required:

#### 1. Orchestrator instructions

**File**: `skills/10x-pipeline/SKILL.md`

**Intent**: Remove `--size` from the argument hint, the argument parsing step and the `init` call, and replace the `--size` bullets in "How the tier moves" with the goal rule. Name no model or effort level.

**Contract**: `argument-hint` becomes `<change-id> [goal text]`. Step 1 parses the change id and the optional goal text. Step 3 runs `init <change-id> --goal "<goal text>"`. The tier list gets one bullet for the first plan: a short goal (at most `firstPlan.maxWords` words, no hard keyword) = -1 plus the simple discount, a hard keyword = no reduction, any other goal = -1. Describe these as tier deltas relative to the plan step's base, with no absolute tier numbers and no model names. The simple-change bullet drops its `--size s` and `--size l` sentences; it keeps the rule that the discount is withheld after any failed step.

#### 2. README

**File**: `README.md`

**Intent**: Remove the flag from the usage line, the routing bullet and the report description, and describe the goal rule and its policy keys.

**Contract**: The heading becomes `/agent-smith:10x-pipeline <change-id> [goal]`. The bullet "It goes down after a clean review and for a simple change" names a short goal in place of `--size s`, and states that a hard keyword in the goal keeps the first plan on the top plan tier. The report bullet reads "goal and outcome". A short sentence tells the reader the word limit and the keyword list sit under `complexity.firstPlan` in `policy.json` and can be overridden per project.

#### 3. Command reference

**File**: `AGENTS.md`

**Intent**: Drop `--size m` from the `init` command example.

**Contract**: The line reads `node skills/10x-pipeline/scripts/route.mjs init <id> --goal "<text>"` and keeps its description.

#### 4. Product requirements document

**File**: `context/foundation/prd.md`

**Intent**: Remove the size flag from the shipped-skill line and from the lists of current routing signals, and add the goal text as a Phase 1 signal where the signal list is given.

**Contract**: Lines 23, 35, 83, 91, 125 and 127 lose "the size flag", "size flag" or `[--size s|m|l]`. Line 127 lists the goal text among the deterministic Phase 1 signals in place of the size flag. No requirement ID, priority or other wording changes.

#### 5. ADR-001

**File**: `docs/ADR/ADR-001-phased-complexity-routing.md`

**Intent**: Remove the `--size` flag from the description of today's routing and from the Phase 1 signal list, naming the goal text in its place.

**Contract**: Line 10 drops "the `--size` flag". Decision item 2 (line 40) lists the goal text where it listed the size flag. The rejected "single size label" alternative (line 59) is a different idea and stays.

### Success Criteria:

#### Automated Verification:

- No flag in the docs: `grep -rnE "\-\-size|sizeBump|size flag" skills README.md AGENTS.md context/foundation/prd.md docs/ADR/ADR-001-phased-complexity-routing.md` prints nothing
- `SKILL.md` names no model that it did not name before: `git diff -U0 skills/10x-pipeline/SKILL.md | grep -iE '^\+.*(haiku|sonnet|opus)'` prints nothing
- The goal rule is documented in both places: `grep -n "short goal" skills/10x-pipeline/SKILL.md README.md` prints one line from each file
- The argument hint has no size: `grep -n "^argument-hint" skills/10x-pipeline/SKILL.md` prints `argument-hint: <change-id> [goal text]`
- Manifests untouched: `git diff --stat .claude-plugin` is empty
- Raw shaping notes untouched: `git diff --stat context/foundation/shape-notes.md` is empty

#### Manual Verification:

- `SKILL.md`, `README.md` and `route.mjs` describe the same rule: the word limit, the hard keywords and the three first-plan reductions (`SKILL.md` as deltas only, with no absolute tier numbers)
- The edited lines in `prd.md` and ADR-001 read coherently without the flag

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Testing Strategy

### Unit Tests:

- None; the repository has no test setup (`AGENTS.md`). Each behaviour is a scratch run listed under Success Criteria.

### Integration Tests:

- Scratch change folders under `$TMPDIR`, each with a `change.md`, one per goal class, plus one re-plan fixture and one override fixture.

### Manual Testing Steps:

1. Run `init` with a short, a plain, a hard-keyword and an empty goal, and read the printed model, effort and `reason`.
2. Run `status scratch` and `status scratch --report`, and read the first-plan row and the report header.
3. Pass `--size s` to `init` once and confirm it changes nothing.

## Performance Considerations

None: one string split and a short keyword scan per `next` call.

## Migration Notes

- Runs already started with `--size` keep `size` and `sizeBump` in their `meta.json`. Nothing reads them, and the next `init` rewrites the file without them.
- A project override file that sets `complexity.sizeBump` keeps working; the key is ignored.
- A first plan that used to run on opus/high with the default size now runs on sonnet/high unless the goal is short or has a hard keyword. This is the intended saving; the escalation on a failed or poorly reviewed plan is unchanged.
- Rollback for that default: setting `complexity.firstPlan.bump.plain` to 0 in `context/foundation/agent-smith-policy.json` puts plain and empty goals back on opus/high. Setting `complexity.firstPlan.maxWords` to 0 stops any goal from counting as short.
- The tier numbers are reached through first-plan offsets with `steps.plan.baseTier` left at 4, not by lowering the base tier to 3 as first proposed. The outcomes are the same; the difference is that `plan-revise` keeps its current tiers.

## References

- Related research: `context/changes/drop-size-flag/research.md`
- Flag entry and storage: `skills/10x-pipeline/scripts/route.mjs:470-476`
- First-plan hook: `skills/10x-pipeline/scripts/route.mjs:259-260`
- First-plan simple signal: `skills/10x-pipeline/scripts/route.mjs:336-346`
- Policy: `skills/10x-pipeline/policy.json:12, 21, 25`
- Earlier decision that the first plan stays on opus/high without `--size s`: `context/archive/2026-10-30-cheaper-routing-simple-change/plan.md:35`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Router and policy

#### Automated

- [x] 1.1 Script parses: `node --check skills/10x-pipeline/scripts/route.mjs` — bdc7f91
- [x] 1.2 `policy.json` parses, keeps `steps.plan.baseTier` at 4 and has no `sizeBump`: `node -e "const p=JSON.parse(require('fs').readFileSync('skills/10x-pipeline/policy.json','utf8'));console.log(p.steps.plan.baseTier, p.complexity.sizeBump)"` prints `4 undefined` — bdc7f91
- [x] 1.3 No size code remains: `grep -nE "sizeBump|meta\.size|flags\.size|--size|Size:" skills/10x-pipeline/scripts/route.mjs skills/10x-pipeline/policy.json` prints nothing — bdc7f91
- [x] 1.4 A scratch change with `init scratch` and no goal returns `plan` on sonnet/high — bdc7f91
- [x] 1.5 A scratch change with goal `fix a typo in the readme` returns `plan` on sonnet/medium, and `status scratch` shows `simple: true` — bdc7f91
- [x] 1.6 A scratch change with goal `refactor the router` returns `plan` on opus/high, and `status scratch` shows `simple: false` — bdc7f91
- [x] 1.7 A 25-word goal with no hard keyword returns `plan` on sonnet/medium and a 26-word goal returns sonnet/high — bdc7f91
- [x] 1.8 Keywords match the start of a word, ignoring case and leading punctuation: goals `Refactoring the router` and `(refactor) the router` each return `plan` on opus/high — bdc7f91
- [x] 1.9 A leftover `--size s` does nothing: `init scratch --goal "refactor the router" --size s` returns `plan` on opus/high and the resulting `meta.json` has no `size` key — bdc7f91
- [x] 1.10 Re-plan tiers are unchanged: a scratch change with a `plan.md` that has `## Progress` and a newer `reviews/plan-review.md` holding `- **Verdict**: RETHINK` returns `plan-revise` on opus/max — bdc7f91
- [x] 1.11 A scratch override `context/foundation/agent-smith-policy.json` setting `complexity.firstPlan.maxWords` to 2 makes goal `fix a typo in the readme` return `plan` on sonnet/high — bdc7f91
- [x] 1.12 `status scratch --report` writes a `report.md` without a `Size:` line: `grep -c "^Size:" context/changes/scratch/agent-smith/report.md` prints `0` — bdc7f91
- [x] 1.13 A resumed `init` with an empty goal keeps the stored goal: `init scratch --goal "refactor the router"` then `init scratch --goal ""` returns `plan` on opus/high and `meta.json` still holds `refactor the router` — bdc7f91

#### Manual

- [x] 1.14 The `reason` and `tierWhy` of the first plan step name the goal class in wording a reader follows — bdc7f91

### Phase 2: Docs sync

#### Automated

- [x] 2.1 No flag in the docs: `grep -rnE "\-\-size|sizeBump|size flag" skills README.md AGENTS.md context/foundation/prd.md docs/ADR/ADR-001-phased-complexity-routing.md` prints nothing
- [x] 2.2 `SKILL.md` names no model that it did not name before: `git diff -U0 skills/10x-pipeline/SKILL.md | grep -iE '^\+.*(haiku|sonnet|opus)'` prints nothing
- [x] 2.3 The goal rule is documented in both places: `grep -n "short goal" skills/10x-pipeline/SKILL.md README.md` prints one line from each file
- [x] 2.4 The argument hint has no size: `grep -n "^argument-hint" skills/10x-pipeline/SKILL.md` prints `argument-hint: <change-id> [goal text]`
- [x] 2.5 Manifests untouched: `git diff --stat .claude-plugin` is empty
- [x] 2.6 Raw shaping notes untouched: `git diff --stat context/foundation/shape-notes.md` is empty

#### Manual

- [x] 2.7 `SKILL.md`, `README.md` and `route.mjs` describe the same rule: the word limit, the hard keywords and the three first-plan reductions (`SKILL.md` as deltas only, with no absolute tier numbers)
- [x] 2.8 The edited lines in `prd.md` and ADR-001 read coherently without the flag
