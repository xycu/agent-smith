# Verify Every Manual Row Automatically Implementation Plan

## Overview

`manual-verify` today proves only the Manual rows that name an allow-listed backticked command (or, with `--chrome`, a browser word), runs at `standard` and above, draws from the extra-step pool, starts on `sonnet/high` and leaves every other row as a human checklist. The archive holds about 100 unticked rows across 13 changes. This plan makes every pending Manual row in scope: a dedicated subagent with a clean context proves each row by running a command, by pointing at a green automated test that covers it, by a throw-away script, by Claude in Chrome, or by a written judgment, saves the proof under `evidence/`, and reports why it could not prove the rows it leaves. The step runs at every rigor level, outside the extra-step pool, on `sonnet/medium` first and `sonnet/high` for one retry. The run then goes on to `done` and lists each unproved row with its reason.

## Current State Analysis

- `manualEligible` (`skills/10x-pipeline/scripts/route.mjs:1830-1843`) accepts a row only with a backticked command whose first word is in `manualVerify.commandWords` and no word from `humanWords`; with `meta.chrome === true` a `browserWords` hit is accepted too. `verifyManual` (`route.mjs:1896-1932`) repeats the test before it counts a tick.
- `manualVerifyNext` (`route.mjs:1858-1881`) needs `manualVerify.minRigor` (`standard`), a non-empty extra-step pool (`extrasLeft` vs `extraCost("manual-verify")`, cost 1; the `lean` pool is 0), fewer than `maxRuns` (1) ok runs and `maxAttempts` (2) runs. It is called only from the `!irFresh` branch in front of `impl-review` (`route.mjs:1099-1101`), so it runs once before the first implementation review and again only for a retry.
- A failed `manual-verify` attempt is a neutral fallback entry (`verifyManual` sets `last.fallback`; `isFailure` skips it), so `trailingFailures` never bumps the retry tier and no rollback happens (`rollback`, `route.mjs:2632`, skips a fallback).
- `steps.manual-verify` is `baseTier: 3` (`sonnet/high`), `minTier: 2`, `maxTier: 6` (`policy.json:22`). Ladder index 2 is `sonnet/medium`.
- `meta.chrome` is `true` only with `init --chrome` (`route.mjs:3373-3406`); `manualVerifyNext` picks the template `manual-verify-chrome` when it is `true` (`route.mjs:1872`). `provenanceFlags` records `chrome: meta.chrome === true` (`route.mjs:2279`).
- The budget is `limits.maxTotalSteps` (14) plus `rigor.budgetDelta` (`-4`, `3`, `8`), sized so the longest failure-free path leaves two steps to spare (`budget-executors.test.mjs` "longest legal path": 15 at `standard`, 20 at `thorough`). `manual-verify` competes with segments and executors for the pool, so it never adds to the longest path today.
- Tests: every fixture built with `planText` carries a pending Manual row (`helpers.mjs:69`, "Look at it"). With the step on at every level and every row eligible, each existing test that walks to `impl-review` would gain a `manual-verify` step. `writeOverride` already solves the same problem for the scorer and for isolation by merging a default off-switch unless the test gives its own key.
- Outputs of the step today: `manualUnproven` (ticked without valid evidence) in the `done` message, `meta.outcome` and the archive report lines (`route.mjs:296-303`, `1816-1819`); `status` shows `ticked` and `unproven` counts (`route.mjs:3326`).

## Desired End State

- Every pending Manual row is eligible. The step runs at `lean`, `standard` and `thorough` after the last Automated row is ticked and before the first implementation review, costs one step of the budget and nothing from the extra-step pool.
- First attempt `sonnet/medium` (tier 2). A retry runs one tier up (`sonnet/high`) when the first attempt failed its checks or left rows pending. Two attempts at most. After that the run goes on, with no halt.
- The default template carries the Chrome rules. `init --chrome false` selects a template without them. A stored `chrome: true`, an absent value and a run started before this change all read as Chrome on.
- A tick needs an evidence file under `context/changes/<id>/evidence/` that is non-empty, regular, inside the real `evidence` folder and newer than the step start, as today. The router never reads its content. The file name starts with its kind (`command-`, `test-`, `script-`, `browser-`, `judgment-`), and the router records the kind per ticked row.
- A row the subagent cannot prove stays `[ ]`, and the subagent lists it with a one-line reason in `evidence/unproven.md`. The router copies the reasons of the rows still pending into the log entry. The final message of a `done` run (`manualNotProved`), `meta.outcome`, the archive summary and `report.md` list each such row with its reason, and `report.md` lists the ticked rows by evidence kind.
- Verify: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` passes; `skills/10x-pipeline/test/loops-existing.test.mjs` is byte-identical to its state at `a1d7a98` (`meta.baseSha`; compare against that SHA, not `HEAD`, because the step commits of this isolated run move `HEAD`); the budget test pins the new longest paths and the shipped deltas leave two steps to spare at every level.

### Key Discoveries:

- `writeOverride` (`skills/10x-pipeline/test/helpers.mjs:44-50`) merges `score: { minRigor: null }` and `isolation: { require: false }` unless the test gives its own key. The same one-line pattern with `manualVerify: { minRigor: null }` keeps every existing fixture on its current path without touching `loops-existing.test.mjs`.
- `tierFor` honors `d.bump` and `d.bumpWhy` from the decision (`route.mjs:2016-2018`), so the retry tier comes from `manualVerifyNext` returning a bump; the failure bump cannot do it because a neutral entry is skipped by `trailingFailures`.
- A `manual-verify` entry stays an ordinary counted step: only failed advisory entries and failed cheap first attempts are budget-free (`budgetSteps`, `route.mjs:~640`). With the step outside the pool the longest failure-free path gains the first attempt and one retry, so `rigor.budgetDelta` has to grow by 2 at each level.
- Evidence tokens are validated by `evidenceOk` (`route.mjs:1883-1892`): segments `[A-Za-z0-9._-]+`, under `evidence/`, `mtime > since`. Kind prefixes fit that character set unchanged.
- The prompt must carry the safety limits that the router cannot enforce; the router's only check on the step is file-based plus "no Automated row, title or SHA changed" (`verifyManual`).

## What We're NOT Doing

- No re-run of `manual-verify` after the last `fix` (assumption A1). Ticked rows stay ticked; the router cannot re-prove them without a second pass over the whole Manual set, and the fixes are scoped by the review's findings.
- No router judgement of evidence content, no check that a judgment is sound, no check that a named test exists or ran. The router keeps its file-based check (change.md, starting point 5).
- No router check for files the subagent writes outside the change folder (assumption A8). The prompt forbids it and the step commit and the implementation review see the diff.
- No new signal key in the `RESULT` line; unproved reasons travel in `evidence/unproven.md`.
- No edit of `skills/10x-pipeline/test/loops-existing.test.mjs`, no change to `baseline-policy.json` (`compare.test.mjs` pins its keys).
- No edit of `context/archive/`; the roughly 100 unticked archived rows stay as they are.
- No new npm dependency; Node 24 built-ins only.
- No change to the extra-step pool allowances or to the cost of the other pool users.

## Implementation Approach

Four phases, each leaving the full suite green. Phase 1 changes routing (who is eligible, when the step runs, what it costs, which tier) and the budget. Phase 2 adds what the router records and prints (evidence kind, unproved reasons, report, status). Phase 3 rewrites the prompt and flips the Chrome default. Phase 4 updates the docs and records ADR-012.

Order matters for green tests: the policy keys the new code reads exist before the code reads them; `writeOverride` gets its off-switch in Phase 1 before the step is on at every level; the prompt text tests (`manual verify prompts`, `chrome flag`) are rewritten in Phase 3, when the prompt changes.

Decisions made without a human (see the brief): A1 no re-run after the last `fix`; A2 Chrome on unless `meta.chrome === false`, templates `manual-verify` (with Chrome rules) and `manual-verify-nochrome`; A3 `rigor.budgetDelta` +2 per level for the first attempt plus one retry; A4 the unproved reasons file is `evidence/unproven.md`, read for display only; A5 evidence kind from the file name prefix, unknown prefix reads `other`; A6 the retry also runs after an ok attempt that left rows pending; A7 `maxRuns`, `commandWords`, `humanWords` and `browserWords` are removed from the policy; A8 no stray-write check.

## Phase 1: Every row, every level, outside the pool

### Overview

All pending Manual rows are eligible. The step runs at every rigor level, is not charged to the pool, starts at tier 2 and retries one tier up, and the budget deltas grow by 2. Prompt and Chrome default stay as they are in this phase.

### Changes Required:

#### 1. Policy data

**File**: `skills/10x-pipeline/policy.json`

**Intent**: Move the step to `sonnet/medium`, open it at `lean`, take it out of the pool, size the budget for its two attempts.

**Contract**: `steps["manual-verify"].baseTier` 2 (`minTier` 2 and `maxTier` 6 stay). `manualVerify` becomes `{ "minRigor": "lean", "maxAttempts": 2, "retryBump": 1 }`; the keys `maxRuns`, `commandWords`, `humanWords` and `browserWords` are removed. `extraSteps.cost` loses `manual-verify`. `rigor.budgetDelta` becomes `{ lean: -2, standard: 5, thorough: 10 }` (budgets 12, 19 and 24); the numbers are `longest failure-free path + 2 - limits.maxTotalSteps` and the budget test pins them, so correct them to what the walk measures if it differs.

#### 2. Eligibility, placement and cost

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: Delete `manualEligible`; `manualVerifyNext` and `verifyManual` stop consulting it. The step is returned for any pending Manual row (or for ticks the last attempt left without valid evidence) while fewer than `maxAttempts` entries exist, at a level at or above `manualVerify.minRigor` (a `minRigor` that is not a level turns the step off). A retry (any earlier `manual-verify` entry) returns `bump: manualVerify.retryBump` with a `bumpWhy`, so the second attempt reads `+1 from ...` in `tierWhy`. `extrasLeft` charges a `manual-verify` entry nothing, whatever an override says. The `template` choice stays as is in this phase.

**Contract**: `manualVerifyNext(plan, log, policy, ctx, meta)` keeps its signature and its call site in the `!irFresh` branch. It returns null when `maxAttempts` is not a positive integer, when an Automated row is pending, when the level is below `minRigor`, when `maxAttempts` entries exist, or when no Manual row is pending and no tick awaits a retry. A first attempt that ends ok with rows still pending is followed by one retry (A6); a second attempt ends the step whatever it leaves.

#### 3. Test scaffolding

**File**: `skills/10x-pipeline/test/helpers.mjs`

**Intent**: Extend `writeOverride` the way it was extended for `score` and `isolation`: merge `manualVerify: { minRigor: null }` unless the test gives its own `manualVerify` key. Nothing else in `helpers.mjs` changes.

**Contract**: a test that wants the step writes `policy: { manualVerify: { minRigor: "lean" } }`.

#### 4. Tests

**Files**: `skills/10x-pipeline/test/manualverify.test.mjs`, `skills/10x-pipeline/test/budget-executors.test.mjs`, `skills/10x-pipeline/test/ladder.test.mjs`, `skills/10x-pipeline/test/executors.test.mjs`, `skills/10x-pipeline/test/score.test.mjs`, `skills/10x-pipeline/test/advisor.test.mjs`

**Intent**: Replace the eligibility tests ("manual verify eligible rows", "browser words whole word") with tests that every row is eligible, including a row with no command and a human-word row. Placement tests: the step runs at `lean`, `standard` and `thorough`, `lean` included; a pool of 0 does not keep it away; it does not draw from the pool (a failed attempt leaves the pool as it was). "manual verify not repeated" becomes an attempts test (no step when all rows are ticked; an ok attempt that left rows pending is followed by one retry; two attempts end it; `minRigor: null` turns it off). Tier tests: first attempt tier 2 (`sonnet/medium`), retry tier 3 with `tierWhy` naming the bump, no rigor rise from a neutral failure. The "chrome step draws from the pool" test becomes a test that neither template is charged. `budget-executors.test.mjs`: the walker always opts into `manualVerify.minRigor: "lean"` (like the score opt-in), the manual fixtures gain a variant that leaves one row pending through both attempts so the walk contains the retry, `TABLE` and the `budgetDelta` assertion take the new numbers, and a lean walk pins the lean longest path; "lean unchanged" is rewritten to say that lean now has `manual-verify` and still no executor, segment or re-plan step. The "failure path fits" case also has a `stacked` run that asserts a budget halt; with the budget up by 2 re-derive its script so it still ends in the budget halt (or assert the halt it now ends with), and keep the assertion that it never passes the budget. `ladder.test.mjs` `PINS["manual-verify"].base` becomes `["sonnet", "medium"]`. Other tests that pass a Manual row through the step get the opt-in override.

**Contract**: test titles stay string literals (the gate check reads them).

### Success Criteria:

#### Automated Verification:

- Placement, eligibility, attempts and tier tests pass: `node --test skills/10x-pipeline/test/manualverify.test.mjs`
- Longest legal path and the budget deltas hold at every level: `node --test skills/10x-pipeline/test/budget-executors.test.mjs`
- Ladder pins and score shift tests pass: `node --test skills/10x-pipeline/test/ladder.test.mjs skills/10x-pipeline/test/score.test.mjs`
- Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- Characterization file untouched since the branch point: `git diff --exit-code a1d7a98 -- skills/10x-pipeline/test/loops-existing.test.mjs`
- Version fields consistent: `node tools/version-check.mjs`

#### Manual Verification:

- In a scratch project with a plan whose only pending row is a Manual row with no command in it and the override `{"manualVerify":{"minRigor":"lean"}}`, `route.mjs init <id> --goal "x" --rigor lean` returns `step: "manual-verify"` with model `sonnet` and effort `medium`.
- After one `next` in that scratch project with a result of status `done` and the row still unticked, the next `run` action is a second `manual-verify` on `sonnet` `high`, and after a second `done` result the run goes on to `impl-review`.

**Implementation Note**: pause for the automated checks, then continue; the Manual rows are proved by the manual-verify step of this very run.

---

## Phase 2: Record the evidence kind and the reasons, and print them

### Overview

The router learns the kind of each ticked row's evidence and the reason for each row left pending, keeps both in the log entry, and prints them in the final message, `meta.outcome`, the archive summary, `status` and `report.md`.

### Changes Required:

#### 1. Evidence kinds

**Files**: `skills/10x-pipeline/policy.json`, `skills/10x-pipeline/scripts/route.mjs`

**Intent**: `verifyManual` records, for every row it counts as ticked, the evidence kind and the evidence file, derived from the token. The kind is the part of the file's base name (the last path segment) before the first `-`, lower-cased, when it is in `manualVerify.evidenceKinds`; any other prefix reads `other`, and a base name with no `-` (such as `judgment.md`) has no prefix and reads `other`. A row with an unknown prefix is still ticked (a rejected tick costs a step; the report shows `other`).

**Contract**: policy `manualVerify.evidenceKinds`: `["command", "test", "script", "browser", "judgment"]`. The log entry gets `proved`: `[{ id, kind, file }]`, covering every row ticked since the baseline of the streak (like `ticked`). A value of the wrong shape reads as the default list and never halts.

#### 2. Unproved reasons

**Files**: `skills/10x-pipeline/policy.json`, `skills/10x-pipeline/scripts/route.mjs`

**Intent**: After a `manual-verify` step the router reads `context/changes/<id>/evidence/<manualVerify.unprovenFile>` for display only. Each line `- <row id> — <reason>` gives a reason (one line, no backticks or format characters, cut to `manualVerify.reasonMaxChars` code points). The file counts only when it is a regular file inside the real `evidence` folder, not larger than a small cap, and newer than that entry's start. A missing, stale or malformed file gives no reasons and never changes `ok`. The entry gets `reasons`: `{ <row id>: <reason> }`. A helper merges the `reasons` of all `manual-verify` entries (later wins) and keeps the ids that are still pending.

**Contract**: policy `manualVerify.unprovenFile` `"unproven.md"`, `reasonMaxChars` 200. Output key `manualNotProved`: an array of strings, one per row that is still pending after at least one `manual-verify` entry ran: `<row text> — not proved: <reason>`, with the reason `no reason recorded` when the ledger has none. A run where the step never ran has no such key.

#### 3. Outputs

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: Add `manualNotProved` to `doneNotes` so it reaches the `done` message, `meta.outcome` and the archive summary next to `manualUnproven`. It is additive: `manualPending` and its archive lines stay as they are (existing tests pin them), and `manualNotProved` carries the reasons for the same rows. Add `Manual checks not proved: N` lines to the archive report lines (`archiveLines`). Add a `## Manual checks` section to `report.md` when a `manual-verify` entry ran: ticked rows grouped by evidence kind (`<id> <title> — <kind> (<file>)`), then the pending rows with their reasons. `status` shows `proved` (count per kind) and `pending` next to the existing `ticked` and `unproven` counts.

**Contract**: the section appears after `## Review findings` and before `## Complexity score`; row titles come from the first `manual-verify` entry's `before.manual`. No `manual-verify` entry, no section.

#### 4. Tests

**File**: `skills/10x-pipeline/test/manualverify.test.mjs`

**Intent**: Tests for the kind rule (each known prefix, an unknown prefix reads `other`, a subfolder path), the ledger (a valid file, a stale file, a missing file, a malformed line, a reason cut at the limit, a reason for a row that is no longer pending), the merge across two attempts, and the outputs (`done` message, `meta.outcome`, archive summary, `report.md` section, `status`). The existing "manual unproven reaches outputs" test keeps passing: an ok step with no unproved rows adds none of the new keys.

### Success Criteria:

#### Automated Verification:

- Evidence kind, ledger and output tests pass: `node --test skills/10x-pipeline/test/manualverify.test.mjs`
- Archive and report tests pass: `node --test skills/10x-pipeline/test/archive.test.mjs skills/10x-pipeline/test/route.test.mjs`
- Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- Characterization file untouched since the branch point: `git diff --exit-code a1d7a98 -- skills/10x-pipeline/test/loops-existing.test.mjs`

#### Manual Verification:

- In a scratch project, a finished `manual-verify` step with one row ticked on `evidence/judgment-1.2.md`, one pending row and an `evidence/unproven.md` that names it ends with `report.md` holding a `## Manual checks` section that lists the first row as `judgment` and the second with its reason.
- The same run's `done` message carries `manualNotProved` with that reason, and `status` prints `proved` and `pending` for the step.

---

## Phase 3: The prompt, and Chrome on by default

### Overview

The subagent prompt tells a clean-context worker how to prove each kind of row, which tools to use, what it must never do and how to report what it cannot prove. The Chrome rules move into the default template, and `--chrome false` selects the template without them.

### Changes Required:

#### 1. The prompt rules

**Files**: `skills/10x-pipeline/prompts/manual-verify.md`, `skills/10x-pipeline/policy.json`

**Intent**: Rewrite the rules in the GIVEN/WHEN/THEN form (ADR-004, one bold keyword per rule). The intro line states that the subagent proves Manual rows of `context/changes/{id}/plan.md` on its own, with the tools it has, and that it starts with no memory of earlier steps. Rules cover:
- every pending Manual row is in scope, including rows that ask a person to read, judge or confirm and rows that ask the owner for a decision; the subagent judges them itself;
- a row whose claim an automated test covers counts as verified when that test runs green now: the evidence is the test run output with its first line naming the test file and the test name;
- a row with a command in it: run the command and tick only when the output proves the row;
- when no existing command or test proves a row, write a throw-away script in a scratch directory outside the repository (`mktemp -d`) or under `evidence/`, never in the source or test tree, and save its source and its output as evidence so the check can be rerun;
- a reading, wording or owner row: write a judgment that quotes the text or behaviour checked and gives the reasoning, save it as evidence, tick only when the text supports the claim;
- evidence file names start with their kind (`command-`, `test-`, `script-`, `browser-`, `judgment-`), the rest of the name is free; ticks append ` — evidence: evidence/<name>` to the row; evidence is non-empty and under 1 MB; several rows may share a file;
- a row that cannot be proved (a live pipeline run is needed, a tool is missing, Chrome is not connected, the check fails) stays `[ ]`, and the subagent lists it in `evidence/unproven.md` as `- <row id> — <reason>`; each attempt rewrites that file for every row still pending, and the retry reads it first;
- plan.md hygiene as today: no change to a row title, an Automated row or a SHA suffix; no untick of a row ticked before; rows rejected last time (`{unproven}`) get valid evidence or go back to `[ ]`; ending with no tick is a normal `done`;
- safety: never push, deploy, publish or post to an external service; never write outside the run root and the scratch directory; never delete a branch, worktree or ref; never run `git reset`, `git commit` or `git checkout` in the run root (the router owns git writes, ADR-010), read-only git only; never run a command that does not end by itself or waits for input; start a server only in the background and stop it before the step ends; never write a credential, token, environment dump or personal data into an evidence file or a judgment (redact it before saving), because the step commit stores `evidence/` in the run branch;
- unattended rule as today: no questions, decide from the plan, the code and command output.

**Contract**: the file stays `prompts/manual-verify.md` and is the part both templates share. The Chrome rules are three inline rules in `policy.json` (as today): load `mcp__claude-in-chrome__*` through ToolSearch first and use them for rows that need a browser; open only local pages or pages the row names, never sign in, never submit a form to an external service, never enter credentials; save the page text or an image or GIF the tool can export as `browser-` evidence; when the tools are unavailable or Chrome is not connected, do not wait, try another proof (a covering test), else leave the row pending with that reason.

#### 2. Templates and the `chrome` meaning

**Files**: `skills/10x-pipeline/policy.json`, `skills/10x-pipeline/scripts/route.mjs`, `skills/10x-pipeline/SKILL.md`

**Intent**: Template `manual-verify` is the one with the Chrome rules. The new template `manual-verify-nochrome` replaces `manual-verify-chrome`; it shares the prompt file and adds one rule: the Chrome tools are off, a row that needs a browser is proved another way or left pending with that reason. `manualVerifyNext` picks `manual-verify-nochrome` only when `meta.chrome === false`. `provenanceFlags.chrome` records `meta.chrome !== false` (the effective setting). `init --chrome` and `--chrome true` store `true` and change nothing in effect; `--chrome false` stores `false`; a resume keeps the stored value, and a run that stored nothing, or started before this change, reads Chrome on. The `init` usage text and the SKILL.md `--chrome` bullet say so. The first prompt line no longer says "that a command can prove".

**Contract**: `{unproven}` stays the only variable carried from the router; no other history reaches the subagent.

#### 3. Tests

**Files**: `skills/10x-pipeline/test/manualverify.test.mjs`, `skills/10x-pipeline/test/provenance.test.mjs`, `skills/10x-pipeline/test/advisor.test.mjs`, `skills/10x-pipeline/test/rules.test.mjs` (only if its inventory needs the new template name)

**Intent**: "manual verify prompts" asserts the new rule texts (all rows in scope, covering test as evidence, throw-away script location, evidence kinds, the ledger, the safety rules, the never-ends rule) in the default template and the Chrome rules in it; "chrome flag" asserts the new default (`meta.chrome` absent reads on, `--chrome false` selects `manual-verify-nochrome`, a resume keeps the value); the provenance `NO_FLAGS` fixture reads `chrome: true` for a run that never set the flag, and the resume case that passes `--chrome` after the record was written passes `--chrome false` so it still changes the stored value; the advisor case table swaps `manual-verify-chrome` for `manual-verify-nochrome`. The prompt rule form test passes for the rewritten file.

### Success Criteria:

#### Automated Verification:

- Prompt and Chrome-default tests pass: `node --test skills/10x-pipeline/test/manualverify.test.mjs`
- Prompt rule form passes: `node --test skills/10x-pipeline/test/rules.test.mjs`
- Provenance and advisor tests pass: `node --test skills/10x-pipeline/test/provenance.test.mjs skills/10x-pipeline/test/advisor.test.mjs`
- Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- Characterization file untouched since the branch point: `git diff --exit-code a1d7a98 -- skills/10x-pipeline/test/loops-existing.test.mjs`

#### Manual Verification:

- In a scratch project at `standard` with the step opted in, the `run` prompt of the first `manual-verify` step names `mcp__claude-in-chrome__*`, the evidence folder, `evidence/unproven.md` and the safety rules, and the same project started with `--chrome false` returns template `manual-verify-nochrome` whose prompt does not name `ToolSearch`.
- `skills/10x-pipeline/prompts/manual-verify.md` reads, rule by rule, as one-line instructions a subagent can follow without the earlier steps, and none lets a subagent push, publish or write inside the source tree.

---

## Phase 4: Docs and ADR-012

### Overview

README, SKILL.md, prompts/README.md and AGENTS.md describe the new behaviour; ADR-012 records the decision and supersedes the manual-verify parts of ADR-003.

### Changes Required:

#### 1. README

**File**: `README.md`

**Intent**: Update "How routing works" (the `manual-verify` bullet in the standard-and-up list and the routing bullets), "Phase executors" (the pool sentence loses `manual-verify`; the `manual-verify` and `--chrome` bullets are rewritten: every row, every level, outside the pool, `sonnet/medium` then `sonnet/high`, evidence kinds, unproved reasons, `manualNotProved`, Chrome on by default and `--chrome false`), "Budget" (new budgets 12, 19 and 24, the new longest paths, the typical worst paths now include the step and its retry, and the `lean` sentence about the budget of 10), the "Rigor" step-budget bullet (`rigor.budgetDelta`: -4, +3 and +8, so 10, 17 and 22 steps), the confirmation-round budget example under "Review routing on open findings" (`{ "standard": 5 }` for the shipped `3` becomes `{ "standard": 7 }` for the shipped `5`), the baseline paragraph (the routing-only override for a baseline arm becomes `{"manualVerify": {"minRigor": null}}` alongside `codeReplan.afterFailures`; a pool allowance of 0 no longer turns the step off), "Limits" (`--chrome` default and the untested subagent Chrome use), the report description (`## Manual checks`) and the provenance `flags` sentence (`chrome` is the effective setting). State the release note: `lean` runs gain a step and Chrome is on by default; `feat` or `feat!` is the owner's call at commit time.

#### 2. SKILL.md, prompts README, AGENTS.md

**Files**: `skills/10x-pipeline/SKILL.md`, `skills/10x-pipeline/prompts/README.md`, `AGENTS.md`

**Intent**: SKILL.md "How the tier moves": rewrite the `Extra-step pool`, `manual-verify` and `--chrome` bullets, and the step-budget bullet (the deltas now leave room for the step and its retry); it names no model, effort or tier beyond what it documents (AGENTS.md hard rule), so the tier words stay out and the policy keeps the numbers. `prompts/README.md`: the `manual-verify.md` row (wired as the `manual-verify` and `manual-verify-nochrome` templates, what it asks for). `AGENTS.md`: the test inventory line for `manualverify.test.mjs` and `budget-executors.test.mjs`, and the `writeOverride` sentence (it also merges `manualVerify: { minRigor: null }`).

#### 3. ADR-012

**File**: `docs/ADR/ADR-012-automate-manual-checks.md`

**Intent**: Context (about 100 unticked rows in the archive, a checklist nobody works through), decision (every row in scope, judged or proved by the subagent, evidence kinds, the throw-away script rule, no halt on unproved rows, outside the pool, `sonnet/medium` then `sonnet/high`, Chrome default on, no re-run after the last fix), the new budget table with the path counts, the safety constraints and what enforces them (the prompt) and what does not (the router never reads content and never checks stray writes), consequences (extra tokens at `lean`, judgments are weaker proof than runs and the report says which is which), risks and the rollback (`manualVerify.minRigor: null`). Add a one-line pointer to ADR-012 in the manual-verify section of `docs/ADR/ADR-003-rigor-gated-routing.md` and in the `--chrome` row of its decision table.

### Success Criteria:

#### Automated Verification:

- Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- Characterization file untouched since the branch point: `git diff --exit-code a1d7a98 -- skills/10x-pipeline/test/loops-existing.test.mjs`
- Version fields consistent: `node tools/version-check.mjs`
- ADR-012 exists: `test -f docs/ADR/ADR-012-automate-manual-checks.md`

#### Manual Verification:

- README, SKILL.md and ADR-012 state the same defaults: every row eligible, all three rigor levels, budgets 12, 19 and 24, first attempt `sonnet/medium`, retry `sonnet/high`, Chrome on unless `--chrome false`.
- In a scratch project, `init` and `status` print valid JSON for a change folder, and `status` after a finished `manual-verify` step shows `proved` and `pending`.
- `grep -n "commandWords\|humanWords\|browserWords\|maxRuns" README.md skills/10x-pipeline/SKILL.md skills/10x-pipeline/policy.json` prints no live reference to the removed keys (ADR-003 keeps its history).

---

## Testing Strategy

### Unit Tests:

- Eligibility: any Manual row, with or without a command or a human word, makes the step run.
- Attempts: ok with nothing pending ends it; ok with rows pending gives one retry; two attempts end it; neutral failure gives a retry; `minRigor: null` turns it off.
- Tier: tier 2 first, tier 3 on the retry, `tierWhy` names the bump, no rigor rise.
- Pool: a failed attempt leaves the pool as it was; a pool of 0 does not stop the step.
- Evidence: kind from the prefix, unknown prefix `other`, the existing hardening (symlink, outside folder, empty, stale) unchanged.
- Ledger: valid, stale, missing, malformed, over-long reason, merge across attempts.
- Chrome: absent reads on, `false` selects the no-Chrome template, a resume keeps the stored value, provenance records the effective flag.

### Integration Tests:

- `budget-executors.test.mjs` walks every saturating fixture at `lean`, `standard` and `thorough` with the step on and a variant that forces the retry, and pins the longest legal path of each level.
- The failure path test still ends inside the budget with the step in it.
- Archive and report tests show the new lines only for a run where the step ran.

### Manual Testing Steps:

1. Scratch project, one phase, one pending Manual row, override `{"manualVerify":{"minRigor":"lean"}}`: `init --rigor lean` returns the step on `sonnet`/`medium`.
2. Report a `done` result with the row unticked: the second step is on `sonnet`/`high`; report `done` again: `impl-review` follows.
3. End the run and read `report.md` and the `done` message for the reasons.

## Performance Considerations

The step adds up to two subagent runs to every run that has a pending Manual row, `lean` included, and a retry on `sonnet/high` whenever a row stays unproved. That is the point of the change; the cost is raw tokens, visible in `report.md`. `manualVerify.minRigor: null` turns the step off per project. The budget grows by 2 steps at every level and nothing else about the budget changes.

## Migration Notes

The policy and the prompts change, so a run in flight records `provenance.drift` for `manualVerify`, `steps`, `extraSteps`, `rigor` and `prompts` at its next `next` call; routing is unaffected. A run in flight that already has a `manual-verify` entry keeps counting it toward `maxAttempts`. An override that still carries `commandWords`, `humanWords`, `browserWords` or `maxRuns` is harmless: the router ignores them. An override of `extraSteps.cost["manual-verify"]` no longer charges the pool. `compare` pairs where one arm ran the old step show `provenance-differs` warnings; that is expected.

## References

- Change identity and owner decisions: `context/changes/automate-manual-checks/change.md`
- Complexity score: `context/changes/automate-manual-checks/complexity.json`
- Current step: `skills/10x-pipeline/scripts/route.mjs:1822-1932`, call site `:1099-1101`, tier `:2009-2120`, budget `:~2886`, rollback `:2625-2678`
- Policy: `skills/10x-pipeline/policy.json` (`steps`, `extraSteps`, `rigor.budgetDelta`, `prompts.manual-verify*`, `manualVerify`)
- Prompt: `skills/10x-pipeline/prompts/manual-verify.md`; prompt form: `docs/ADR/ADR-004-prompt-rules-as-scenarios.md`
- Pool and budget table: `docs/ADR/ADR-003-rigor-gated-routing.md` (sections on `extraSteps`, `manual-verify`, `--chrome`, budget)
- Git ownership and rollback: `docs/ADR/ADR-010-run-worktree-step-commits-and-rollback.md`
- Test scaffolding: `skills/10x-pipeline/test/helpers.mjs:44-50`, `skills/10x-pipeline/test/phase-helpers.mjs`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Every row, every level, outside the pool

#### Automated

- [ ] 1.1 Placement, eligibility, attempts and tier tests pass: `node --test skills/10x-pipeline/test/manualverify.test.mjs`
- [ ] 1.2 Longest legal path and the budget deltas hold at every level: `node --test skills/10x-pipeline/test/budget-executors.test.mjs`
- [ ] 1.3 Ladder pins and score shift tests pass: `node --test skills/10x-pipeline/test/ladder.test.mjs skills/10x-pipeline/test/score.test.mjs`
- [ ] 1.4 Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- [ ] 1.5 Characterization file untouched since the branch point: `git diff --exit-code a1d7a98 -- skills/10x-pipeline/test/loops-existing.test.mjs`
- [ ] 1.6 Version fields consistent: `node tools/version-check.mjs`

#### Manual

- [ ] 1.7 In a scratch project with a plan whose only pending row is a Manual row with no command in it and the override `{"manualVerify":{"minRigor":"lean"}}`, `route.mjs init <id> --goal "x" --rigor lean` returns `step: "manual-verify"` with model `sonnet` and effort `medium`.
- [ ] 1.8 After one `next` in that scratch project with a result of status `done` and the row still unticked, the next `run` action is a second `manual-verify` on `sonnet` `high`, and after a second `done` result the run goes on to `impl-review`.

### Phase 2: Record the evidence kind and the reasons, and print them

#### Automated

- [ ] 2.1 Evidence kind, ledger and output tests pass: `node --test skills/10x-pipeline/test/manualverify.test.mjs`
- [ ] 2.2 Archive and report tests pass: `node --test skills/10x-pipeline/test/archive.test.mjs skills/10x-pipeline/test/route.test.mjs`
- [ ] 2.3 Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- [ ] 2.4 Characterization file untouched since the branch point: `git diff --exit-code a1d7a98 -- skills/10x-pipeline/test/loops-existing.test.mjs`

#### Manual

- [ ] 2.5 In a scratch project, a finished `manual-verify` step with one row ticked on `evidence/judgment-1.2.md`, one pending row and an `evidence/unproven.md` that names it ends with `report.md` holding a `## Manual checks` section that lists the first row as `judgment` and the second with its reason.
- [ ] 2.6 The same run's `done` message carries `manualNotProved` with that reason, and `status` prints `proved` and `pending` for the step.

### Phase 3: The prompt, and Chrome on by default

#### Automated

- [ ] 3.1 Prompt and Chrome-default tests pass: `node --test skills/10x-pipeline/test/manualverify.test.mjs`
- [ ] 3.2 Prompt rule form passes: `node --test skills/10x-pipeline/test/rules.test.mjs`
- [ ] 3.3 Provenance and advisor tests pass: `node --test skills/10x-pipeline/test/provenance.test.mjs skills/10x-pipeline/test/advisor.test.mjs`
- [ ] 3.4 Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- [ ] 3.5 Characterization file untouched since the branch point: `git diff --exit-code a1d7a98 -- skills/10x-pipeline/test/loops-existing.test.mjs`

#### Manual

- [ ] 3.6 In a scratch project at `standard` with the step opted in, the `run` prompt of the first `manual-verify` step names `mcp__claude-in-chrome__*`, the evidence folder, `evidence/unproven.md` and the safety rules, and the same project started with `--chrome false` returns template `manual-verify-nochrome` whose prompt does not name `ToolSearch`.
- [ ] 3.7 `skills/10x-pipeline/prompts/manual-verify.md` reads, rule by rule, as one-line instructions a subagent can follow without the earlier steps, and none lets a subagent push, publish or write inside the source tree.

### Phase 4: Docs and ADR-012

#### Automated

- [ ] 4.1 Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- [ ] 4.2 Characterization file untouched since the branch point: `git diff --exit-code a1d7a98 -- skills/10x-pipeline/test/loops-existing.test.mjs`
- [ ] 4.3 Version fields consistent: `node tools/version-check.mjs`
- [ ] 4.4 ADR-012 exists: `test -f docs/ADR/ADR-012-automate-manual-checks.md`

#### Manual

- [ ] 4.5 README, SKILL.md and ADR-012 state the same defaults: every row eligible, all three rigor levels, budgets 12, 19 and 24, first attempt `sonnet/medium`, retry `sonnet/high`, Chrome on unless `--chrome false`.
- [ ] 4.6 In a scratch project, `init` and `status` print valid JSON for a change folder, and `status` after a finished `manual-verify` step shows `proved` and `pending`.
- [ ] 4.7 `grep -n "commandWords\|humanWords\|browserWords\|maxRuns" README.md skills/10x-pipeline/SKILL.md skills/10x-pipeline/policy.json` prints no live reference to the removed keys (ADR-003 keeps its history).
