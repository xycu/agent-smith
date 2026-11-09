# Run cost estimate Implementation Plan

## Overview

Add an optional `prices` block to `policy.json` and a `Cost (estimate)` figure to `report.md`, `status` and `compare`. The figure is a blended-rate estimate: one USD-per-million-tokens price per model alias, applied to the one `totalTokens` figure a step carries. It covers only steps that have both a token figure and a price, and it says how many that is. Nothing is priced by default, so nothing is invented. Both chains read the same `run.jsonl` usage entries, so one implementation serves both. The `compare` verdict, `comparable`, `reasons` and `dropPercent` stay on tokens.

## Current State Analysis

- Usage is one total per step: `cleanUsage` keeps `totalTokens`, `toolUses`, `durationMs` as non-negative safe integers (`skills/10x-pipeline/scripts/flow.mjs:252`). There is no input/output/cache split, so a dollar figure can only be a blended estimate.
- `report.md` is built by `buildReport` (`flow.mjs:95`): a per-step table whose last column is `Tokens`, then a totals line `Steps: N · Tokens: T (figures for K of N steps)` (`flow.mjs:123`). It takes no policy; it is called from `writeReport`, which `finishRun` (`flow.mjs:228`), four `endRun` sites in `isolation.mjs` and `status --report` (`route.mjs:624`) reach.
- `status` rows carry `usage: e.usage ?? null` and no totals (`route.mjs:580-614`).
- `compare` builds each side in `readSide` (`route.mjs:368`): `tokens: { total, stepsWithFigures, byModel, byTier }`, `byModel` keyed by the log's `model` alias (`route.mjs:386-395`). `comparePair` takes `policy` (the policy of the project that runs `compare`, `route.mjs:446`), and `compareMarkdown` prints the table (`route.mjs:527`).
- The router's models are aliases (`opus`, `sonnet`, `haiku`) in `policy.json` `ladder`; `e.model` in the log is that alias. So the price key is the alias, with no id mapping.
- `loadPolicy` deep-merges `context/foundation/agent-smith-policy.json` over `policy.json` and halts when `policy.json` is unreadable (`state.mjs:38`). `deepMerge` replaces arrays and merges objects key by key.
- Provenance hashes every policy section except `provenance.ignore` (default `compare`, `provenance`; `provenanceConfig` in `isolation.mjs:19-30`, `policy.json:99`). A new top-level section would be hashed and `compare` would warn `provenance-differs:prices` for a display-only setting.
- Lessons that apply (`context/foundation/lessons.md`): never read a verdict cleaner than its listed findings. Not touched here; the verdict is not changed.

## Desired End State

- With the shipped policy (`prices: null`), `report.md`, `status` and the `compare` Markdown are byte-for-byte what they are today. The `compare` JSON gains one key, `cost: null`, on each side, and nothing else changes (no existing `compare` test compares a whole side object).
- With prices set in the project override, for example `{ "prices": { "usdPerMillionTokens": { "opus": 30, "sonnet": 6, "haiku": 2 } } }`:
  - `report.md` gets a `Cost (est.)` column and a line under the totals line: `Cost (estimate): $X.XX at a blended rate (USD per million tokens, no input/output split) · priced N of M steps with a token figure`, plus `no price for: <aliases>` when some are missing.
  - `status` prints a top-level `cost` object and a per-step `cost`.
  - `compare` prints a `cost` object per side (JSON) and `Cost (estimate)` rows (Markdown) beside the token rows. The verdict and `comparable` do not change.
- Verified by the new `skills/10x-pipeline/test/cost.test.mjs` plus the unchanged existing suite.

### Key Discoveries:

- A step's model alias is already the key `byModel` uses, so the same alias lookup prices it (`route.mjs:391`).
- `report.md` is the only router file that survives an archive (`docs/REFERENCE.md` "Archive"), so the estimate must be in it, as text computed at report time.
- `writeReport` has no policy argument and five call sites. Reading prices through a non-halting reader in `state.mjs` avoids threading a policy through `finishRun`, `endRun` and `isolation.mjs`.
- `ROOT` is the run root in an isolated run, so the reader sees the override as committed at the branch point, like every other policy read.

## What We're NOT Doing

- No shipped default prices. They go stale and would be a guess (change.md open question, decided: the owner supplies them).
- No input/output/cache split and no orchestrator change. The host reports one total (`SKILL.md` usage rule), so the estimate is blended and labelled so. A split is a later change if a host reports one.
- No change to `compare` `comparable`, `reasons`, `dropPercent` or `verdict`, and no cost-based target. ADR-007 and the A/B decision rule stay on raw tokens.
- No cost for the orchestrator session (its tokens are not counted today either).
- No price per model id or per tier; the key is the alias.
- No change to `SKILL.md` of either chain, to `route.mjs` routing, to run state files, or to the step budget.

## Implementation Approach

One pure helper in `state.mjs` owns the rules: read and validate the block, price one entry, sum a list of entries. `buildReport`, `status` and `compare` call it and only format. A malformed block reads as off and never halts, as `advisor` and `agents` do. Display-only: `prices` is added to `provenance.ignore`, so it never produces a provenance warning.

## Phase 1: Prices block and cost reader

### Overview

The policy key, its validation and the pure cost function, with no output change yet.

### Changes Required:

#### 1. Policy default

**File**: `skills/10x-pipeline/policy.json`

**Intent**: Ship `prices` as `null` so nothing is invented, and add `prices` to `provenance.ignore` because a price changes no routing.

**Contract**: top-level `"prices": null`. When set: `{ "usdPerMillionTokens": { "<alias>": <number> } }`. `provenance.ignore` becomes `["compare", "provenance", "prices"]`.

#### 2. Provenance default

**File**: `skills/10x-pipeline/scripts/isolation.mjs`

**Intent**: Keep `PROVENANCE_DEFAULTS.ignore` equal to the shipped list, so a policy whose `ignore` is malformed falls back to the same three names.

**Contract**: `PROVENANCE_DEFAULTS.ignore` is `["compare", "provenance", "prices"]`.

#### 3. Cost reader and estimator

**File**: `skills/10x-pipeline/scripts/state.mjs`

**Intent**: Add `loadPrices()` and the pure `priceTable(policy)` and `estimateCost(entries, table)`. `loadPrices()` merges `policy.json` and the project override like `loadPolicy` but never halts (a missing or unreadable file reads as no prices), so `buildReport` can call it. Factor the merge out of `loadPolicy` so the two cannot drift.

**Contract**:
- `priceTable(policy)` returns `null` when `policy.prices` is not an object, or `usdPerMillionTokens` is not an object, or it holds no valid entry. A valid entry is a finite number `>= 0` under a non-empty string key; any other entry is dropped (that alias is unpriced). Returns `{ usdPerMillionTokens }`.
- `estimateCost(entries, table)` takes executed log entries and returns `{ usd, priced, withFigures, unpriced, perEntry }`: `withFigures` counts entries with a valid `usage.totalTokens` (same test as `report` and `compare`: non-negative safe integer); `priced` counts those whose `model` alias has a price; `usd` is the sum of `totalTokens * price / 1e6` over priced entries; `unpriced` is the sorted list of distinct aliases (`unknown` for a missing model) that had a token figure and no price; `perEntry` maps entry `n` to its USD or `null`. A `0` price is a price.
- `estimateCost` returns `usd` and `perEntry` values as unrounded sums; each consumer rounds (report: 2 decimals for the total and 4 for a cell, `status` and `compare`: 4 decimals), so the helper stays exact and the formats cannot disagree.
- The figure test is the one `cleanUsage` applies at intake (`flow.mjs:252`). The report's own `typeof number` test and `compare`'s `validFigure` agree with it on every log the router wrote; they can differ only on a hand-edited log, where `M` may then differ from the `figures for K` count of the totals line. `estimateCost` does not change either of those tests.
- It never throws on a hand-edited log.

#### 4. Provenance tests

**File**: `skills/10x-pipeline/test/provenance.test.mjs`

**Intent**: The test `1.1 policy.json ships the provenance block` (line 88) asserts the exact shipped `provenance` block, so it fails once `prices` joins `ignore`. Update that expectation to the three-name list, and add the test of criterion 1.3 here (not in `cost.test.mjs`): a fresh `init` with an override that sets prices records no `prices` section in `meta.provenance.sections`, and `compare` gives no `provenance-differs:prices` when only the prices differ.

**Contract**: the edit changes only the expected `ignore` array of that assertion and adds one test; no other existing assertion changes.

### Success Criteria:

#### Automated Verification:

- `policy.json` ships `prices: null` and lists `prices` in `provenance.ignore`: `node --test skills/10x-pipeline/test/cost.test.mjs`
- `priceTable` drops malformed blocks and entries without halting, and `estimateCost` sums priced steps, counts coverage and lists unpriced aliases: `node --test skills/10x-pipeline/test/cost.test.mjs`
- A run with an override that sets prices records no `prices` section in `provenance` and no `provenance-differs:prices` warning: `node --test skills/10x-pipeline/test/provenance.test.mjs`
- Existing suite stays green: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`

---

## Phase 2: Cost in report.md and status

### Overview

Show the estimate in the run report and in `status`, for both chains.

### Changes Required:

#### 1. Report

**File**: `skills/10x-pipeline/scripts/flow.mjs`

**Intent**: In `buildReport`, when `loadPrices()` gives a table, add a `Cost (est.)` column after `Tokens` and a `Cost (estimate)` line after the `Steps:` totals line. With no table, emit exactly today's report.

**Contract**:
- Column cell: `$` plus the step's USD at 4 decimals, or `-` for a step with no figure or no price.
- Line: `Cost (estimate): $X.XX at a blended rate (USD per million tokens, no input/output split) · priced N of M steps with a token figure` (USD at 2 decimals; M is `withFigures`). When some aliases are unpriced append ` · no price for: a, b`. When `priced` is 0: `Cost (estimate): - (no step with a token figure has a price) at a blended rate`.
- The line uses `e.model` from the log, so the OpenSpec chain needs no branch.

#### 2. Status

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: In `status`, when prices are set, add `cost` to each executed step row and a top-level `cost` summary. Without prices the output has no new key. `status --report` already goes through `writeReport`, so it needs nothing else.

**Contract**: step row `cost: <usd number or null>`; top level `cost: { usd, currency: "USD", rate: "blended", priced, withFigures, unpriced }`. `usd` is a rounded-to-4-decimals number, `null` when nothing is priced.

### Success Criteria:

#### Automated Verification:

- With the shipped policy `report.md` and `status` output carry no cost text or key: `node --test skills/10x-pipeline/test/cost.test.mjs`
- With prices set, the report has the `Cost (est.)` column, the `Cost (estimate)` line with the exact total, `priced N of M`, and `no price for:` for a missing alias: `node --test skills/10x-pipeline/test/cost.test.mjs`
- A step with no token figure shows `-` in the cost column and is not in `M`: `node --test skills/10x-pipeline/test/cost.test.mjs`
- `status` prints the top-level `cost` object and per-step `cost` when prices are set: `node --test skills/10x-pipeline/test/cost.test.mjs`
- An OpenSpec run (`--chain openspec`) gets the same report line and `status` object: `node --test skills/10x-pipeline/test/cost.test.mjs`
- Existing report and status tests stay green: `node --test skills/10x-pipeline/test/route.test.mjs skills/10x-pipeline/test/openspec-steps.test.mjs`

---

## Phase 3: Cost in compare

### Overview

Print each side's estimate next to its tokens. The verdict stays on tokens.

### Changes Required:

#### 1. Side cost and output

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: In `readSide`, take the price table from the policy `compare` runs under (passed in like `producedFile`) and add `cost` to the side from `estimateCost(steps, table)`. In `comparePair` add the warning `cost-incomplete:<side>` when a side has a token figure for a step it cannot price. In `compareMarkdown` add `Cost (estimate)` rows. With no table, `cost` is `null` and no row prints.

**Contract**: side `cost: { usd, priced, withFigures, unpriced, byModel }` (`byModel`: USD per alias, priced steps only) or `null`. `usd` and each `byModel` value are rounded to 4 decimals, as in `status`; the sums are taken before rounding. The Markdown prints them with 2 decimals. Markdown row `Cost (estimate)`: `$X.XX (P of S priced)` per side, plus `Cost by model, baseline: ...` and `Cost by model, routed: ...` lines. The footer line keeps `Unit: raw tokens, a proxy for the weekly limit.` and gains `Cost is an estimate at a blended rate and does not enter the verdict.` only when `cost` prints. `verdict`, `comparable`, `reasons`, `dropPercent` do not read `cost`. The prices come from the policy of the project that runs `compare`, as the target does, so both sides are priced alike.

### Success Criteria:

#### Automated Verification:

- With the shipped policy the `compare` JSON has `cost: null` on both sides and the Markdown has no cost row: `node --test skills/10x-pipeline/test/cost.test.mjs`
- With prices set, both sides carry `cost` with the exact USD, `priced`, `withFigures` and per-alias USD, and the Markdown prints the rows: `node --test skills/10x-pipeline/test/cost.test.mjs`
- `verdict`, `comparable`, `reasons` and `dropPercent` are identical with and without prices, including a pair that is not comparable: `node --test skills/10x-pipeline/test/cost.test.mjs`
- An unpriced alias on a side gives `cost-incomplete:<side>` and does not change `comparable`: `node --test skills/10x-pipeline/test/cost.test.mjs`
- Existing compare tests stay green: `node --test skills/10x-pipeline/test/compare.test.mjs`

#### Manual Verification:

- In a scratch project with an override that sets prices, `init`, `status` and `status --report` print valid JSON and a readable `Cost (estimate)` line, and `compare --format md` reads clearly beside the token rows

---

## Phase 4: Docs and ADR

### Overview

Document the key, the formats and the limits where the project keeps them.

### Changes Required:

#### 1. Reference

**File**: `docs/REFERENCE.md`

**Intent**: In "Usage report" add a "Cost estimate" bullet group: the `prices.usdPerMillionTokens` block, off by default, alias keys, blended rate, coverage wording, per-step column, `status` and `compare` shapes, verdict unchanged, a malformed block reads as off, the estimate uses the override at report time (an archived report keeps the text it was written with). In the "PR comment (opt-in)" bullets add that a report with a cost line posts the dollar estimate to the pull request like any other report text. In "Baseline comparison" add the cost fields and the `cost-incomplete` warning. Add `prices` to the provenance `ignore` list wording.

**Contract**: prose only; no new section headings beyond a bullet group under "Usage report".

#### 2. ADR note

**File**: `docs/ADR/ADR-005-baseline-usage-comparison.md`

**Intent**: ADR-005 owns the unit decision ("The unit is raw `totalTokens`", line 21). Add a short dated note under "Consequences" that cost is an estimate on top of raw tokens, does not enter the verdict, and is blended because the host reports one total. ADR-007 is not edited: its A/B decision rule reads raw tokens and stays as it is.

**Contract**: one bullet or short paragraph in ADR-005 "Consequences"; no other ADR section changes.

#### 3. Contributor guide and README

**File**: `AGENTS.md`, `README.md`

**Intent**: List the new test file in `AGENTS.md` "Project Structure" and the `state.mjs` description (`prices`, `estimateCost`). In `README.md` add one line under "Configure" naming the `prices` override.

**Contract**: one bullet in `AGENTS.md` for `cost.test.mjs`; one sentence in `README.md`.

### Success Criteria:

#### Automated Verification:

- Whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- Version fields still agree: `node tools/version-check.mjs`
- `SKILL.md` of both chains still names no model, effort or tier beyond what it did (skill tests): `node --test skills/10x-pipeline/test/skill-loop.test.mjs skills/10x-pipeline/test/openspec-skill.test.mjs`

---

## Testing Strategy

### Unit Tests:

- New `skills/10x-pipeline/test/cost.test.mjs`, black-box through the CLI in scratch projects with `makeProject` and `writeLog` from `helpers.mjs` (which stays as it is). Test names start with the plan row number, as in `compare.test.mjs`.
- `priceTable`: not an object, `usdPerMillionTokens` missing, a string price, a negative price, `NaN`/`Infinity` (JSON cannot carry them, so only via a string), a `0` price, an extra key; none halts.
- `estimateCost` with token figures `1_000_000`, `500_000`, a step with no `usage`, a step with a model that has no price, a missing `model`.
- Prices chosen so the sums are exact in binary floating point (for example `2` and `6` per million), and the expected strings are literal.
- A prices override merged over `policy.json` where the base is `null`.

### Integration Tests:

- Real `init`, `next` with `usage` in the result file, then `status --report`, for a 10x change and an OpenSpec change (`openspec-helpers.mjs`).
- `compare` over two scratch run folders with prices set and unset.

### Manual Testing Steps:

1. In a scratch project, write an override with prices, run a step with a usage figure and read `report.md`.
2. Run `compare <id> --baseline <dir> --format md` and read the cost rows.

## Performance Considerations

None. The estimate is one pass over the log, which the report already makes.

## Migration Notes

None. No prices by default, no new file, no change to `run.jsonl` or `meta.json`. A run in flight is unaffected. `provenance.ignore` gains `prices`, so a run in flight whose record predates it sees no new drift (an ignored section is not tracked).

## References

- Change identity and open questions: `context/changes/run-cost-estimate/change.md`
- Report builder: `skills/10x-pipeline/scripts/flow.mjs:95`
- Usage intake: `skills/10x-pipeline/scripts/flow.mjs:252`
- Compare side and output: `skills/10x-pipeline/scripts/route.mjs:368`, `route.mjs:527`
- Status: `skills/10x-pipeline/scripts/route.mjs:580`
- Policy merge: `skills/10x-pipeline/scripts/state.mjs:38`
- Provenance ignore: `skills/10x-pipeline/scripts/isolation.mjs:19`
- Tokens as a proxy: `docs/ADR/ADR-005-baseline-usage-comparison.md` (the unit decision, gets the note), `docs/ADR/ADR-007-llm-complexity-scorer-as-a-routed-step.md` (A/B rule on tokens, unchanged)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Prices block and cost reader

#### Automated

- [x] 1.1 `policy.json` ships `prices: null` and lists `prices` in `provenance.ignore`: `node --test skills/10x-pipeline/test/cost.test.mjs` — 4a7de12
- [x] 1.2 `priceTable` drops malformed blocks and entries without halting, and `estimateCost` sums priced steps, counts coverage and lists unpriced aliases: `node --test skills/10x-pipeline/test/cost.test.mjs` — 4a7de12
- [x] 1.3 A run with an override that sets prices records no `prices` section in `provenance` and no `provenance-differs:prices` warning: `node --test skills/10x-pipeline/test/provenance.test.mjs` — 4a7de12
- [x] 1.4 Existing suite stays green: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` — 4a7de12

### Phase 2: Cost in report.md and status

#### Automated

- [x] 2.1 With the shipped policy `report.md` and `status` output carry no cost text or key: `node --test skills/10x-pipeline/test/cost.test.mjs` — 118dc36
- [x] 2.2 With prices set, the report has the `Cost (est.)` column, the `Cost (estimate)` line with the exact total, `priced N of M`, and `no price for:` for a missing alias: `node --test skills/10x-pipeline/test/cost.test.mjs` — 118dc36
- [x] 2.3 A step with no token figure shows `-` in the cost column and is not in `M`: `node --test skills/10x-pipeline/test/cost.test.mjs` — 118dc36
- [x] 2.4 `status` prints the top-level `cost` object and per-step `cost` when prices are set: `node --test skills/10x-pipeline/test/cost.test.mjs` — 118dc36
- [x] 2.5 An OpenSpec run (`--chain openspec`) gets the same report line and `status` object: `node --test skills/10x-pipeline/test/cost.test.mjs` — 118dc36
- [x] 2.6 Existing report and status tests stay green: `node --test skills/10x-pipeline/test/route.test.mjs skills/10x-pipeline/test/openspec-steps.test.mjs` — 118dc36

### Phase 3: Cost in compare

#### Automated

- [x] 3.1 With the shipped policy the `compare` JSON has `cost: null` on both sides and the Markdown has no cost row: `node --test skills/10x-pipeline/test/cost.test.mjs` — c58b6cc
- [x] 3.2 With prices set, both sides carry `cost` with the exact USD, `priced`, `withFigures` and per-alias USD, and the Markdown prints the rows: `node --test skills/10x-pipeline/test/cost.test.mjs` — c58b6cc
- [x] 3.3 `verdict`, `comparable`, `reasons` and `dropPercent` are identical with and without prices, including a pair that is not comparable: `node --test skills/10x-pipeline/test/cost.test.mjs` — c58b6cc
- [x] 3.4 An unpriced alias on a side gives `cost-incomplete:<side>` and does not change `comparable`: `node --test skills/10x-pipeline/test/cost.test.mjs` — c58b6cc
- [x] 3.5 Existing compare tests stay green: `node --test skills/10x-pipeline/test/compare.test.mjs` — c58b6cc

#### Manual

- [x] 3.6 In a scratch project with an override that sets prices, `init`, `status` and `status --report` print valid JSON and a readable `Cost (estimate)` line, and `compare --format md` reads clearly beside the token rows — evidence: evidence/script-cost-manual-output.txt

### Phase 4: Docs and ADR

#### Automated

- [x] 4.1 Whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` — cddde17
- [x] 4.2 Version fields still agree: `node tools/version-check.mjs` — cddde17
- [x] 4.3 `SKILL.md` of both chains still names no model, effort or tier beyond what it did (skill tests): `node --test skills/10x-pipeline/test/skill-loop.test.mjs skills/10x-pipeline/test/openspec-skill.test.mjs` — cddde17
