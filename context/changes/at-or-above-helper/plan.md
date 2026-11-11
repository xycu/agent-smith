---
change_id: at-or-above-helper
title: "The rigor gate test is written seven times"
type: plan
created: 2026-11-11
---

# Plan: one `atOrAbove` helper for the rigor gate

## Overview

The rule "the run's level is a known level, the gate's `minRigor` is a known level, and level >= minRigor" is written out seven times (GitHub issue #97). Add one helper `atOrAbove(policy, level, minRigor)` to `skills/10x-pipeline/scripts/state.mjs` and use it at all seven sites. Behavior stays identical; routing, policy and docs do not change.

## Current State Analysis

- `rigorLevels(policy)` and `maxLevel` live in `state.mjs` (about lines 430-440). Every site calls `rigorLevels(policy)` and then spells the three `indexOf` checks.
- Sites (file:line at `be0ab00`):
  - `steps.mjs:125` `e2eWanted` (negated: return false)
  - `steps.mjs:161` `tddWanted` (negated: return false)
  - `steps.mjs:305` `manualVerifyNext` (negated: return null)
  - `steps.mjs:503` `codeReplanNext` (negated: return null)
  - `preplan.mjs:162` pre-plan gate (positive: `open`)
  - `preplan.mjs:246` `scoreNext` (`min < 0 || at < min` return null)
  - `preplan.mjs:319` `replanNext` loops (positive: `open`)
- Semantics to keep: a level or `minRigor` that is not in `policy.rigor.levels` (including `null`, `undefined`, non-string) means closed. `rigorLevels` throws on a malformed `levels` array; the helper keeps calling it so that error still surfaces at the same place.
- Import order rule (AGENTS.md): `steps.mjs` and `preplan.mjs` already import from `state.mjs`; no new edge.
- No test covers the helper itself; the existing suite (`score.test.mjs`, `executors.test.mjs`, `manualverify.test.mjs`, `loops*.test.mjs`, `codereplan.test.mjs`, `preplan.test.mjs`) drives all seven sites through the CLI.

## What We're NOT Doing

- No change to policy keys, `policy.json`, prompts, `SKILL.md`, `docs/REFERENCE.md` or `AGENTS.md` (no behavior change; no ADR).
- No change to `maxLevel` or other `indexOf` uses in `state.mjs` (not the gate rule).
- No change to the error behavior of `rigorLevels`.

## Phase 1: Add the helper and replace the seven copies

### Changes Required:

#### 1. `skills/10x-pipeline/scripts/state.mjs`

**Intent**: add the one definition of the rule, next to `rigorLevels` and `maxLevel`.
**Contract**: `export function atOrAbove(policy, level, minRigor)` returns `true` only when both `level` and `minRigor` are in `rigorLevels(policy)` and `level`'s index is >= `minRigor`'s; otherwise `false`.

#### 2. `skills/10x-pipeline/scripts/steps.mjs`

**Intent**: import `atOrAbove` from `./state.mjs`; at lines 125, 161, 305, 503 replace the `levels` lookup and the three-`indexOf` condition with `!atOrAbove(policy, <level>, cfg.minRigor)` keeping the same return value (`false` or `null`).
**Contract**: drop the local `const levels = rigorLevels(policy)` at a site only when nothing else in that function uses it; drop the `rigorLevels` import only if no use remains in the file. Checked: at lines 124, 160, 304 and 502 `levels` is used only by the gate line, so all four locals go and the `rigorLevels` import (line 4) goes with them.

#### 3. `skills/10x-pipeline/scripts/preplan.mjs`

**Intent**: import `atOrAbove`; at line 162 `const open = atOrAbove(policy, ctx.level, gate.minRigor)`; at 246 `if (!atOrAbove(policy, ctx.level, cfg.minRigor)) return null` (drop `at` and `min`); at 319 `const open = atOrAbove(policy, level, loops.minRigor)`.
**Contract**: same local-cleanup rule as above. Checked at `be0ab00`: line 147 `levels` is used only by line 162, so it goes too. Then `rigorLevels` has no use left in `preplan.mjs` or `steps.mjs`: drop it from both import lines. Note: in `preplan.mjs` the malformed-`levels` throw then fires inside the gate loop (at the first gate that reaches the check) instead of before it; `main` still turns it into the same JSON halt, and `rigorLevels` runs earlier in `state.mjs` for every real run.

### Success Criteria:

#### Automated Verification:

- `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` passes with no new failures (baseline 982 of 984, 2 skipped).
- `grep -n "levels.indexOf" skills/10x-pipeline/scripts/steps.mjs skills/10x-pipeline/scripts/preplan.mjs` finds no gate-rule copy.
- `grep -rn "atOrAbove" skills/10x-pipeline/scripts` shows one definition in `state.mjs` and seven call sites.

#### Manual Verification:

- Skim the diff: each site returns the same value as before in the open and closed case, and a `null` or unknown `minRigor` stays closed.

## Phase 2: Unit test the helper

### Changes Required:

#### 1. New `skills/10x-pipeline/test/at-or-above.test.mjs`

**Intent**: pin the rule once, since no test covers it directly.
**Contract**: `node:test` file importing `atOrAbove` from `../scripts/state.mjs` (it has no top-level `main()`); cases on a policy `{ rigor: { levels: ["lean","standard","thorough"] } }`: equal levels true, higher true, lower false, unknown `level` false, unknown / `null` / non-string `minRigor` false.

### Success Criteria:

#### Automated Verification:

- `node --test skills/10x-pipeline/test/at-or-above.test.mjs` passes.
- Full suite command from Phase 1 passes.

#### Manual Verification:

- Confirm the new test file stays out of the files AGENTS.md says to leave alone (`helpers.mjs` and the characterized loop tests are untouched).

## Assumptions

- Decided without a user (unattended): no AGENTS.md or REFERENCE.md edit, because no tier logic or documented behavior changes (AGENTS.md "Coding Style" only requires doc updates for tier-logic changes). A one-line mention of the new test in AGENTS.md `Project Structure` is optional and left out to limit merge conflicts with the 12 parallel changes.
- Helper signature taken from the issue text.

## References

- GitHub issue #97; `context/changes/at-or-above-helper/change.md`
- `skills/10x-pipeline/scripts/state.mjs` (`rigorLevels`, `maxLevel`), `steps.mjs`, `preplan.mjs`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Add the helper and replace the seven copies

#### Automated

- [ ] 1.1 Full test suite passes with no new failures
- [ ] 1.2 No gate-rule levels.indexOf copy remains in steps.mjs and preplan.mjs
- [ ] 1.3 atOrAbove has one definition in state.mjs and seven call sites

#### Manual

- [ ] 1.4 Diff keeps the open and closed result of every site, unknown minRigor stays closed

### Phase 2: Unit test the helper

#### Automated

- [ ] 2.1 at-or-above.test.mjs passes
- [ ] 2.2 Full test suite passes after the new test

#### Manual

- [ ] 2.3 helpers.mjs and the characterized loop tests are untouched
