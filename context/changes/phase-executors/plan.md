# phase-executors Implementation Plan

## Overview

Make the pipeline's `implement` step pick the executor that fits each plan phase (`/10x-e2e`, `/10x-tdd` or `/10x-goal-implement`), verify tdd and e2e work by a real commit instead of the `[x]` count, re-plan once after repeated implement failures or an impl-review `REJECTED`, and add a `manual-verify` step that ticks Manual Progress rows it can prove, each with an evidence suffix. Roadmap S-08 (FR-001, FR-003, FR-007). Written without a human: every owner question was answered from research evidence or from the defaults in the planning brief, and each answer is an assumption below.

## Current State Analysis

All anchors are `skills/10x-pipeline/scripts/route.mjs` at commit `f246cdf` unless stated.

- One `implement` step covers the whole plan with one prompt (`policy.json` `prompts.implement`, `/10x-goal-implement {id}`). `decide()` returns it while `plan.autoPending > 0` (`:701-709`).
- A done `implement` is verified only by `plan.autoDone > before.autoDone` (`:331`). A tdd or e2e "Skip" ticks rows with no commit and passes. Scratch experiment 1 in the research confirmed `ok:true, verified:true` for a hand flip.
- `readPlan` (`:65-89`) keeps counters and Manual row text only; `phases` is a number read by four consumers (`:1004`, `:417`, `:1025`, `compare` `readSide`). It keeps no phase list, row ids or done flags for rows.
- Failure counters derive from `ok`: `trailingFailures` (`:355`), the failed-step count in `rigorInputs` (`:421`), `struggled` (`:718`), `simpleSignal` (`:999`, `:1005`).
- `next()` halts at `fails >= maxAttemptsPerStep` (3, `:1397`). A third implement attempt runs after two failures at tier 5.
- `REJECTED` goes to `fix` (`:726-740`); `loops.test.mjs:30-34` and `SKILL.md:112` assert and document it.
- `manualPending` is computed only in `readPlan` (`:84`) and read at `done` (`:742`). Nothing ticks Manual rows.
- Step budget: `maxTotalSteps` 14 plus `rigor.budgetDelta` (-4/0/4). The worst standard path is 12 and the worst thorough path 16 (ADR-003, `:252-261`).
- Toolkit facts (research section 2, files outside this repo, read 2026-10-31): `/10x-goal-implement` has no between-phase pause; `/10x-tdd` and `/10x-e2e` end each phase with a next-phase question and have several interactive gates; both flip rows with no SHA on "Skip".

## Desired End State

- `implement` returns one of three templates: plain `implement` (whole plan, byte-identical prompt to today), `implement-segment` (goal-implement for phases M..N), `implement-e2e`, `implement-tdd`. A mixed plan costs at most `executors.maxSegments` non-plain steps; the rest runs as one plain call.
- A tdd or e2e step is `ok` only with a new commit since the step started or a valid SHA suffix on every newly ticked row. A `blocked` tdd or e2e step without `signals.needsHuman` is a neutral fallback entry: no tier bump, no rigor rise, no failure count, and the same executor is not chosen again for that phase.
- After two trailing implement failures, or an impl-review `REJECTED`, the router runs one `plan` step with the failure or review as input (shared cap 1 per run), then plan review and implement continue as usual.
- At rigor `standard` and above, one `manual-verify` step runs before the first impl-review pass that finds Manual rows pending. It ticks only rows it proves, each with ` — evidence: <summary or path>`. `init --chrome` stores the flag and selects a prompt that lets the subagent use Claude-in-Chrome. Zero ticks is a valid `done`.
- `rigor.budgetDelta` holds the smallest values at which the longest legal path of the new caps fits with one failed step to spare, proved by a test.
- ADR-003, `SKILL.md` "How the tier moves", `README.md` and `AGENTS.md` describe it.

Verify: `node --test skills/10x-pipeline/test/*.test.mjs` passes, including the new files `executors.test.mjs`, `codereplan.test.mjs`, `manualverify.test.mjs` and `budget-executors.test.mjs`.

### Key Discoveries:

- Eight sites compare or return the literal step `"implement"` (`:331`, `:620`, `:674`, `:705`, `:708`, `:713`, `:718`, `:731`) and `policy.complexity` keys it. Keeping the step name and varying the template (as `plan`/`plan-revise` do, `:1408`) touches none of them.
- The pattern to copy is `preplanNext`/`replanNext`: selection in a function below `decide()`, counters derived from the log by template name, knobs in policy data where a non-positive value disables the feature (`:887-993`).
- A tdd/e2e redirect is a normal ending of the skill, so the prompt must turn it into `blocked` without `signals.needsHuman` (`needsHuman` halts before `decide()`, `:1350-1357`).
- The re-plan must trigger at exactly 2 trailing failures: `route.test.mjs:386-400` (three failed implements must halt) holds only then.
- `status` output has no `template` key (`:1720`); adding it shows the executor without touching `buildReport`.

## What We're NOT Doing

- No change to `cleanSignals`, `prompts.suffix`, the RESULT line or `buildReport` (S-10 owns them). No report section for executors.
- No edit to `loops-existing.test.mjs`, `compare.test.mjs`, `context/archive/`, `run.jsonl` or `meta.json` by hand.
- No new git write. The commit check uses `rev-parse`, `cat-file` and `merge-base --is-ancestor` only.
- No `gh`, no npm dependency, no Node 19+ API.
- No cheaper guard for `/10x-goal-implement` zero-diff phases: research found none without false negatives (see Assumption 4).
- No router check that a Chrome tool is available, and no probing from the orchestrator (`allowed-tools` has no `ToolSearch`).
- No size check or existence check of evidence files by the router.
- No new step name for executors. No change to `lean` budget tests: `lean` stays uncovered by the reference paths, as before.
- No `/10x-lesson` or lesson-candidate work.

## Implementation Approach

Six phases, each one implement run. Phase 1 builds the verification and fallback machinery with plain templates only, so it changes no routing. Phase 2 adds the phase list, the e2e executor and segments. Phase 3 adds tdd on the same rails. Phase 4 adds the code re-plans. Phase 5 adds `manual-verify` and `--chrome`. Phase 6 sets the budget from a proved longest path and updates the docs.

Edit discipline for the S-10 conflict: new logic goes in one new section after `replanNext`; `decide()` gets three call sites (implement branch, REJECTED branch, manual-verify branch). New policy keys go in new top-level groups after `prompts`, plus appended entries inside `steps`, `prompts` and `limits` only where the router reads them there. Docs are new bullets.

Policy shape (names are the contract; values are the shipped defaults):

- `executors`: `strictVerify` (templates verified by commit), `maxSegments` 2, `segment.template`, `e2e` (`template`, `minRigor` `lean`, `setup` {file, section, fields}, `rowWords`), `tdd` (`template`, `minRigor` `thorough`, `codeExtensions`, `excludeGlobs`, `testWords`, `uiWords`).
- `codeReplan`: `afterFailures` 2, `onRejected` true, `max` 1, `rejectedBump` 1, `failureBump` 0. A non-positive `max` or `afterFailures` turns that trigger off.
- `manualVerify`: `minRigor` `standard`, `maxRuns` 1, `evidenceDir` `evidence`.
- `steps["manual-verify"]`, and prompts `implement-segment`, `implement-e2e`, `implement-tdd`, `plan-replan`, `plan-rejected`, `manual-verify`, `manual-verify-chrome`.

Test files are new and black-box through the CLI (`run`, `init`, `next` from `helpers.mjs`), with a new `test/phase-helpers.mjs` for plan builders and e2e fixtures so `helpers.mjs` stays untouched. A test command run with `--test-name-pattern` must report at least one test; the implementer checks the count.

## Phase 1: Commit verification and neutral fallback

### Overview

Make a tdd or e2e step verifiable by commit, make a redirect a neutral fallback, and record what later phases need in the log entry. No routing change: only plain `implement` exists after this phase, so every existing test stays green.

### Changes Required:

#### 1. Plan reader

**File**: `skills/10x-pipeline/scripts/route.mjs` (`readPlan`)

**Intent**: Return the structure the later phases need without changing existing fields.

**Contract**: Add `phaseList: [{ n, name, auto: [{ id, text, done }], manual: [{ id, text, done }] }]`, where `n` and `name` come from the `### Phase N: name` Progress heading, `id` is the leading `N.M` of the row text (the whole text when absent) and `text` is the row text after the box. `phases`, `rows`, `autoDone`, `autoPending` and `manualPending` keep their types and values. Add helpers `doneIds(plan)` (ids of done Automated rows) and `newlyTicked(beforeIds, plan)`.

#### 2. Failure helper

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: One definition of "failed step" that ignores fallbacks.

**Contract**: `isFailure(e) = e.ok === false && !e.fallback`. Use it in `trailingFailures` (a fallback entry is skipped, neither counted nor a break), the failed-step count in `rigorInputs`, the `struggled` test in `decide()` and the two `ok === false` tests in `simpleSignal`. For entries without `fallback` the behavior is identical to today.

#### 3. Entry record and verification

**File**: `skills/10x-pipeline/scripts/route.mjs` (`next`, `attachResult`, new section below `replanNext`)

**Intent**: Record the pre-step state and verify tdd and e2e steps by commit.

**Contract**:

- `next()` entry `before` gains `head` (stdout of `git rev-parse HEAD` trimmed, or `null` without git) and `done` (array of done Automated row ids). Additive keys only (ADR-005).
- `attachResult` `case "implement"`: when `policy.executors.strictVerify` includes `last.template`, `verified = plan.autoDone > before.autoDone && commitEvidence(...)`; otherwise the count rule stays exactly as today.
- `commitEvidence` is true when git is unreadable or `before.head` is null (falls back to the count rule), or HEAD differs from `before.head` and `git merge-base --is-ancestor <before.head> HEAD` exits 0, or every row in `newlyTicked` ends with ` — <7-40 hex>` and `git cat-file -e <sha>^{commit}` exits 0 for each.
- After `last.ok` is set: when `!last.ok`, `result.status === "blocked"` and `last.template` is in `strictVerify`, set `last.fallback = true`. A `signals.needsHuman` still halts first (existing code, `:1350`).
- `status` output steps gain `template: e.template ?? null`.
- `policy.json` gains the `executors` group with only `strictVerify: ["implement-tdd", "implement-e2e"]` in this phase.

### Success Criteria:

#### Automated Verification:

- Existing suite stays green with no test edit: `node --test skills/10x-pipeline/test/*.test.mjs`
- Plain implement keeps the count rule (a flipped row without a commit stays `ok`): `node --test --test-name-pattern "plain implement keeps count rule" skills/10x-pipeline/test/executors.test.mjs`
- A tdd or e2e step that ticks rows with no new commit and no SHA suffix is `ok: false, verified: false`: `node --test --test-name-pattern "strict verify rejects skip flip" skills/10x-pipeline/test/executors.test.mjs`
- A tdd or e2e step with a commit since `before.head` is `ok: true`: `node --test --test-name-pattern "strict verify accepts new commit" skills/10x-pipeline/test/executors.test.mjs`
- Rows carrying a valid SHA suffix pass without a moved HEAD, and an unknown SHA fails: `node --test --test-name-pattern "strict verify checks sha suffix" skills/10x-pipeline/test/executors.test.mjs`
- Without git the strict check falls back to the count rule: `node --test --test-name-pattern "strict verify without git" skills/10x-pipeline/test/executors.test.mjs`
- A blocked tdd or e2e entry is a fallback: not counted by `trailingFailures`, no rigor rise, next tier not bumped: `node --test --test-name-pattern "fallback is neutral" skills/10x-pipeline/test/executors.test.mjs`
- A blocked entry of plain implement is still a failure, and `needsHuman` from an executor entry still halts: `node --test --test-name-pattern "blocked plain implement fails" skills/10x-pipeline/test/executors.test.mjs`
- New entries record `before.head` and `before.done`, and `status` prints `template`: `node --test --test-name-pattern "entry records before state" skills/10x-pipeline/test/executors.test.mjs`

#### Manual Verification:

- A reviewer confirms by reading the diff that the router's git use in this phase is limited to `rev-parse`, `cat-file` and `merge-base --is-ancestor`, and that `readPlan` kept every existing field type.

**Implementation Note**: After this phase and its automated checks pass, pause for confirmation before Phase 2. Checkboxes for these items live in `## Progress`.

---

## Phase 2: Phase list routing with `/10x-e2e` and segments

### Overview

Pick the executor per phase for e2e, build segments, wire prompts and tier handling. Only e2e and goal-implement exist here; tdd arrives in Phase 3.

### Changes Required:

#### 1. Policy and prompts

**File**: `skills/10x-pipeline/policy.json`, `skills/10x-pipeline/prompts/executor-e2e.md`, `skills/10x-pipeline/prompts/README.md`

**Intent**: Data for the e2e executor and the segment cap, and rule-form prompts that answer every interactive gate of `/10x-e2e` so a subagent never waits.

**Contract**: `executors` gains `maxSegments: 2`, `segment: { template: "implement-segment" }` and `e2e: { template, minRigor: "lean", setup: { file: "context/foundation/test-stack.md", section: "## E2E", fields: ["config", "seed"] }, rowWords: ["playwright", "e2e", "end-to-end", "browser"] }`. Prompts `implement-e2e` and `implement-segment` are arrays: a first line (`Run /10x-e2e {id} phase {phase}` / `Run /10x-goal-implement {id} phase {phase}`) and, for e2e, `@prompts/executor-e2e.md`. The e2e file holds GIVEN/WHEN/THEN rules (one bold keyword each, ADR-004) for: stop after phase `{lastPhase}` by taking the "stop here" option of the next-phase question; never choose "Skip - already done"; the manual confirmation gate counts as confirmed, Manual rows are listed in the reply and never ticked; commit message approved as proposed; dirty paths commit only the planned set; setup missing, feature not built or a non-browser risk ends `blocked` with no `signals.needsHuman`; a spec that already passes ends `blocked` instead of ticking rows without a commit; an ambiguous gate takes the recommended option or ends `blocked`; no question that waits for a reply. The segment prompt tells goal-implement to stop after phase `{lastPhase}`. The README table lists the file under "Wired".

#### 2. Selection

**File**: `skills/10x-pipeline/scripts/route.mjs` (new section after `replanNext`; one `PREDICATES` entry; the implement branch of `decide()`)

**Intent**: Choose the executor per pending phase and group phases into one segment per call.

**Contract**:

- `PREDICATES.e2eSetup` reads `policy.executors.e2e.setup`: file exists, take lines from the section heading to the next `## `, parse `- config:` and `- seed:` (path is the text up to the first ` — `, backticks stripped), require both paths to exist under `ROOT`. Anything missing is no hit.
- A phase is pending when it has at least one Automated `[ ]` row. `e2eWanted(phase)` is true when the rigor gate is open, `e2eSetup` hits and `goalPhrase` over the phase name and the pending Automated row texts finds a `rowWords` entry.
- `executorExcluded(log, phase, executor)` is true when an executed entry has that `executor`, covers the phase (`phase <= n <= lastPhase`) and has `fallback` or `ok === false`.
- `executorNext(plan, log, policy, ctx, bumpInfo)` returns `null` when no pending phase wants a special executor, or when the count of executed `implement` entries whose template is not plain `implement` has reached `maxSegments`: the caller then returns the plain step as today. Otherwise it returns `{ step: "implement", template, phase, lastPhase, executor, skill, interactive, bump, reason }`. The segment starts at the first pending phase and extends over following pending phases that choose the same executor; a goal-implement segment ends before the next phase that wants another executor. `interactive` is true for e2e. `bump` and `reason` carry what the implement branch already computed.
- `decide()` implement branch: call `executorNext` and return its result, else the existing object. Nothing else in `decide()` changes.
- `tierFor`: `if (s.interactive || d.interactive)` at the effort-floor test (`:1048`).
- `next()`: render vars `{phase}` and `{lastPhase}` (empty for plain steps); the entry gains `phase`, `lastPhase`, `executor` when set, and `skill: d.skill ?? policy.steps[d.step].skill`.

### Success Criteria:

#### Automated Verification:

- `e2eSetup` hits only when the section has `config` and `seed` paths that exist: `node --test --test-name-pattern "e2e setup predicate" skills/10x-pipeline/test/executors.test.mjs`
- A plan with no browser rows gets the plain `implement` prompt, byte-identical to the policy text plus suffix: `node --test --test-name-pattern "no e2e rows keeps plain prompt" skills/10x-pipeline/test/executors.test.mjs`
- Browser rows with setup route that phase to `implement-e2e` with `{phase}` and `{lastPhase}` filled and `executor: "e2e"` in the entry: `node --test --test-name-pattern "e2e phase routes to e2e" skills/10x-pipeline/test/executors.test.mjs`
- Browser rows without setup stay on plain `implement`: `node --test --test-name-pattern "e2e rows without setup" skills/10x-pipeline/test/executors.test.mjs`
- A goal, e2e, goal plan runs `implement-segment` for phase 1, then `implement-e2e` for phase 2, then plain `implement` once the cap is reached: `node --test --test-name-pattern "mixed plan segments" skills/10x-pipeline/test/executors.test.mjs`
- A blocked e2e entry is not repeated for that phase, the next step is goal-implement at an unchanged tier with rigor unchanged: `node --test --test-name-pattern "e2e blocked falls back" skills/10x-pipeline/test/executors.test.mjs`
- An unverified e2e entry (Skip flip) is not repeated for that phase and the next attempt is one tier higher: `node --test --test-name-pattern "e2e failed not repeated" skills/10x-pipeline/test/executors.test.mjs`
- `implement-e2e` never runs below the effort floor of the rigor level: `node --test --test-name-pattern "e2e effort floor" skills/10x-pipeline/test/executors.test.mjs`
- Prompts keep the rule form and the new prompt file is listed as wired: `node --test skills/10x-pipeline/test/rules.test.mjs skills/10x-pipeline/test/preplan.test.mjs`
- The rendered e2e prompt names the stop phase, forbids Skip and ends `blocked` on a redirect: `node --test --test-name-pattern "e2e prompt rules" skills/10x-pipeline/test/executors.test.mjs`
- Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs`

#### Manual Verification:

- Run `/10x-e2e` unattended in a scratch project with Playwright set up (`/10x-e2e-setup` done) and a two-phase plan whose phase 2 is browser-level, through the router: the e2e step stops after its phase, never picks "Skip", ends `done` with a new commit, or ends `blocked` without a question left waiting. Record the result in the Progress row.

**Implementation Note**: After this phase and its automated checks pass, pause for confirmation before Phase 3.

---

## Phase 3: `/10x-tdd` for pure-logic phases at thorough

### Overview

Add the tdd executor on the Phase 2 rails, gated at rigor `thorough` and by a deterministic pure-logic predicate.

### Changes Required:

#### 1. Policy and prompt

**File**: `skills/10x-pipeline/policy.json`, `skills/10x-pipeline/prompts/executor-tdd.md`, `skills/10x-pipeline/prompts/README.md`

**Intent**: Data for the tdd executor and a rule-form prompt for every interactive gate of `/10x-tdd`.

**Contract**: `executors.tdd` holds `template: "implement-tdd"`, `minRigor: "thorough"`, `codeExtensions` (`.mjs .js .ts .tsx .py .go .rs`), `excludeGlobs` (config, docs, CI, lockfiles, same shape as `risk.churn.exclude`), `testWords` (`test`, `vitest`, `jest`, `pytest`) and `uiWords` (`page`, `screen`, `click`, `css`, `visual`, plus the e2e `rowWords`). Prompt `implement-tdd` is an array with `Run /10x-tdd {id} phase {phase}` and `@prompts/executor-tdd.md`. The file repeats the e2e rule set adapted to `/10x-tdd` (stop after `{lastPhase}`, never Skip, manual gate confirmed and not ticked, commit message approved, dirty paths, ambiguous gate) and adds: an implementation that already exists, a missing test runner or a misfit phase ends `blocked` with no `signals.needsHuman`.

#### 2. Predicate and per-phase files

**File**: `skills/10x-pipeline/scripts/route.mjs` (new section)

**Intent**: Decide "pure logic" from data already on disk, conservatively.

**Contract**: `phaseFiles(planFile)` reads the descriptive `## Phase N:` or `## Faza N:` blocks and returns the paths of their `**File**:` and `**Files**:` lines (reuse `normalizePlanPath`). `pureLogicPhase(phase, files, ctx, policy)` is true when all hold: level at or above `executors.tdd.minRigor`; the phase has no done Automated row; `files` is non-empty, every path has a `codeExtensions` extension and none matches `excludeGlobs`; every pending Automated row text has a backtick token containing a `testWords` entry and no `uiWords` entry. E2E wins: `executorNext` asks `e2eWanted` first, then tdd, and skips either when `executorExcluded`. A tdd segment extends over following pending phases that choose tdd. `interactive` is true.

### Success Criteria:

#### Automated Verification:

- `phaseFiles` reads `**File**` and `**Files**` lines per phase, English and Polish headings: `node --test --test-name-pattern "phase files reader" skills/10x-pipeline/test/executors.test.mjs`
- A pure-logic phase at thorough routes to `implement-tdd`: `node --test --test-name-pattern "tdd phase at thorough" skills/10x-pipeline/test/executors.test.mjs`
- The same plan at standard and lean stays on goal-implement: `node --test --test-name-pattern "tdd gated by rigor" skills/10x-pipeline/test/executors.test.mjs`
- Each predicate condition alone blocks tdd (a doc path, a config glob, a ticked row, a UI word, a row with no test command): `node --test --test-name-pattern "tdd predicate rejects" skills/10x-pipeline/test/executors.test.mjs`
- A phase that satisfies both predicates goes to e2e: `node --test --test-name-pattern "e2e wins over tdd" skills/10x-pipeline/test/executors.test.mjs`
- A blocked tdd entry falls back to goal-implement with no tier bump and no `needsHuman`: `node --test --test-name-pattern "tdd blocked falls back" skills/10x-pipeline/test/executors.test.mjs`
- The rendered tdd prompt names the stop phase, forbids Skip and ends `blocked` on a redirect: `node --test --test-name-pattern "tdd prompt rules" skills/10x-pipeline/test/executors.test.mjs`
- Prompt rule form and wiring tests pass: `node --test skills/10x-pipeline/test/rules.test.mjs skills/10x-pipeline/test/preplan.test.mjs`
- Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs`

#### Manual Verification:

- Run `/10x-tdd` unattended at `--rigor thorough` in a scratch project with a test runner and one pure-logic phase, through the router: the tdd step stops after its phase, never picks "Skip", commits, or ends `blocked`. Record the result in the Progress row.

**Implementation Note**: After this phase and its automated checks pass, pause for confirmation before Phase 4.

---

## Phase 4: Re-plan after repeated failures or REJECTED

### Overview

One shared re-plan per run: after two trailing implement failures, or on the first impl-review `REJECTED`, run a `plan` step with the failure or review as input.

### Changes Required:

#### 1. Policy and prompts

**File**: `skills/10x-pipeline/policy.json`

**Intent**: Knobs and prompts for the two re-plan templates.

**Contract**: `codeReplan` group (`afterFailures` 2, `onRejected` true, `max` 1, `rejectedBump` 1, `failureBump` 0). Prompts `plan-replan` (variables `{id}`, `{failure}`) and `plan-rejected` (`{id}`, `{verdict}`): arrays of an intro line plus rules: revise `context/changes/{id}/plan.md` for the failure note or the findings in `reviews/impl-review.md`; never untick, rename or renumber a ticked row; add rows with the next free index; keep at least one pending Automated row; keep the `## Progress` contract. The `plan-revise` authority and artifacts variables are not used.

#### 2. Selection and verification

**File**: `skills/10x-pipeline/scripts/route.mjs` (new function below `replanNext`; two call sites in `decide()`; `attachResult`; `next()` render vars)

**Intent**: Trigger the re-plan, verify it, and keep the existing fallbacks.

**Contract**:

- `codeReplanNext(kind, log, policy, ctx, extra)` returns `null` or `{ step: "plan", template, bump, verdict?, failure?, reason }`. Counter: executed entries with template `plan-replan` or `plan-rejected`; at or above `codeReplan.max` it returns `null`.
- Failure trigger: at the top of the implement branch, `trailingFailures(log, "implement") === codeReplan.afterFailures` (equality, not `>=`). The `{failure}` text is the last implement entry's `result.note`.
- REJECTED trigger: in the `needsFix` block, before the fix-loop halt check, when `ir.verdict === "REJECTED"` and `codeReplan.onRejected` is true. A `null` result falls through to `fix` as today.
- A failed `plan-replan` entry (last executed entry) halts with a reason that names the failure count and says a human is needed. A failed `plan-rejected` entry falls through to `fix`.
- `attachResult` verification keyed on the entry template: for `plan-replan` and `plan-rejected`, `plan.hasProgress && mtime > startedAt && plan.autoPending > 0 && before.done` is a subset of the current done ids. `next()` passes `{failure}` to `render`.
- `tierFor` needs no change: step `plan` base plus `d.bump`.

#### 3. Tests and docs line

**File**: `skills/10x-pipeline/test/loops.test.mjs` (lines 30-34 only), `skills/10x-pipeline/SKILL.md` (bullet at line 112 only)

**Intent**: Keep the tests and the documented rule honest where REJECTED now re-plans first.

**Contract**: The test asserts `plan` with template `plan-rejected` and `verdict` `REJECTED`, then a second case with the cap used asserts `fix` as before. The SKILL bullet says `REJECTED` re-plans once per run (at the plan tier +1), then falls back to `fix` at the last code tier +1. Full docs follow in Phase 6.

### Success Criteria:

#### Automated Verification:

- Two trailing implement failures route to `plan-replan` with the failure note in the prompt: `node --test --test-name-pattern "two failures replan" skills/10x-pipeline/test/codereplan.test.mjs`
- Three trailing failures still halt (existing test), and with the cap used the third attempt runs as today: `node --test --test-name-pattern "cap used keeps third attempt" skills/10x-pipeline/test/codereplan.test.mjs`
- A re-plan that unticks or drops a ticked row, or leaves no pending Automated row, is unverified: `node --test --test-name-pattern "replan verification" skills/10x-pipeline/test/codereplan.test.mjs`
- A failed `plan-replan` halts for a human: `node --test --test-name-pattern "failed replan halts" skills/10x-pipeline/test/codereplan.test.mjs`
- After a verified re-plan, plan review reruns and the next implement starts at 0 failures: `node --test --test-name-pattern "replan then review then implement" skills/10x-pipeline/test/codereplan.test.mjs`
- The first `REJECTED` routes to `plan-rejected` at the plan tier plus `rejectedBump`; the second falls to `fix`; the shared cap holds across both triggers: `node --test --test-name-pattern "rejected replan once" skills/10x-pipeline/test/codereplan.test.mjs`
- Setting `codeReplan.max` or `afterFailures` to 0 restores today's behavior for the trigger: `node --test --test-name-pattern "replan disabled by policy" skills/10x-pipeline/test/codereplan.test.mjs`
- A fallback entry does not count toward the two trailing failures: `node --test --test-name-pattern "fallback not counted for replan" skills/10x-pipeline/test/codereplan.test.mjs`
- Prompt rule form tests pass: `node --test skills/10x-pipeline/test/rules.test.mjs`
- Full suite passes with `loops.test.mjs` edited only at lines 30-34: `node --test skills/10x-pipeline/test/*.test.mjs`

#### Manual Verification:

- A reviewer reads the `plan-replan` and `plan-rejected` prompts and confirms that each rule can be followed by a subagent that cannot ask questions.

**Implementation Note**: After this phase and its automated checks pass, pause for confirmation before Phase 5.

---

## Phase 5: `manual-verify` step and `--chrome`

### Overview

A new step before the first impl-review pass ticks the Manual rows it can prove, with evidence. `init --chrome` stores a flag and selects a prompt that allows Claude-in-Chrome.

### Changes Required:

#### 1. Policy and prompts

**File**: `skills/10x-pipeline/policy.json`, `skills/10x-pipeline/prompts/manual-verify.md`, `skills/10x-pipeline/prompts/README.md`

**Intent**: A step entry, a gate block and two rule-form prompts.

**Contract**: `steps["manual-verify"]`: `skill: null`, `baseTier` 3, `minTier` 2, `maxTier` 5. `manualVerify`: `minRigor` `standard`, `maxRuns` 1, `evidenceDir` `evidence`. Prompts `manual-verify` (`@prompts/manual-verify.md` with an intro line) and `manual-verify-chrome` (same file plus one extra rule). The shared file holds rules: tick a Manual row only after running a check that proves it, and append ` — evidence: <command and result summary, or a path>` to that row; save screenshots, GIFs or command output under `context/changes/{id}/evidence/` and reference that path; keep each evidence file under 1 MB; never edit a row title, an Automated row or a SHA suffix; leave a row you cannot prove or that needs a person; end `done` even when nothing was ticked. The Chrome rule: load the `mcp__claude-in-chrome__*` tools with ToolSearch, use them only for rows that need a browser, and end `done` with those rows unticked when the tools are unavailable or the extension is not connected.

#### 2. Reader, selection and verification

**File**: `skills/10x-pipeline/scripts/route.mjs` (new function below `replanNext`; one call site in `decide()`; `attachResult`; `next()`; `init`)

**Intent**: Place and verify the step without disturbing the impl-review freshness logic.

**Contract**:

- `manualVerifyNext(plan, log, policy, ctx, meta)` returns `null` or `{ step: "manual-verify", template, bump: 0, reason }`. Conditions: no pending Automated row, `plan.manualPending.length > 0`, level at or above `manualVerify.minRigor`, executed ok `manual-verify` entries below `maxRuns`. Template is `manual-verify-chrome` when `meta.chrome === true`. Call site: in `decide()` inside the `!irFresh` block, before the impl-review return. Because `lcode` ignores `manual-verify`, the impl-review stays stale and runs next.
- `next()`: the entry `before` gains `manual` (array of `{id, text, done}` for Manual rows).
- `attachResult` `case "manual-verify"`: verified when no Automated row changed state, Manual row ids and titles are unchanged (text with a trailing evidence suffix removed equals the before text), no row went from done to pending, and every newly ticked row's text matches ` — evidence: \S` at the end. Zero ticks is verified. The SHA suffix regex stays distinct.
- `init`: `--chrome` stores `meta.chrome = true`; `--chrome false` stores false; a resume keeps the stored value (same shape as `archive`).
- `SKILL.md` Start step 1 and `argument-hint`: parse `--chrome`, remove it from the goal text, pass it to `init` only when given. README arguments line gets `[--chrome]` in Phase 6.

### Success Criteria:

#### Automated Verification:

- The step runs once before the first impl-review when Manual rows are pending at standard, and not at lean: `node --test --test-name-pattern "manual verify placement" skills/10x-pipeline/test/manualverify.test.mjs`
- It does not run when no Manual row is pending, or after an ok run (`maxRuns`): `node --test --test-name-pattern "manual verify not repeated" skills/10x-pipeline/test/manualverify.test.mjs`
- Impl-review runs right after it and a `fix` does not trigger a second run: `node --test --test-name-pattern "manual verify before impl review" skills/10x-pipeline/test/manualverify.test.mjs`
- A ticked row with an evidence suffix verifies; without it, the step is `ok: false`: `node --test --test-name-pattern "evidence suffix required" skills/10x-pipeline/test/manualverify.test.mjs`
- Zero ticks is `ok: true`: `node --test --test-name-pattern "zero ticks is done" skills/10x-pipeline/test/manualverify.test.mjs`
- Editing an Automated row, a title or a SHA suffix, or unticking a row, makes the step unverified: `node --test --test-name-pattern "manual verify guards plan edits" skills/10x-pipeline/test/manualverify.test.mjs`
- `init --chrome` stores `chrome: true`, a resume keeps it, `--chrome false` clears it, and the chrome template is chosen from it: `node --test --test-name-pattern "chrome flag" skills/10x-pipeline/test/manualverify.test.mjs`
- Rendered prompts name the evidence directory and the evidence suffix; the chrome prompt adds the ToolSearch rule and the unavailable fallback: `node --test --test-name-pattern "manual verify prompts" skills/10x-pipeline/test/manualverify.test.mjs`
- Prompt rule form and wiring tests pass: `node --test skills/10x-pipeline/test/rules.test.mjs skills/10x-pipeline/test/preplan.test.mjs`
- Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs`

#### Manual Verification:

- Run a router-driven `manual-verify` step with `--chrome` on a scratch plan with one browser-checkable Manual row and a connected Chrome extension: confirm the subagent loads the Chrome tools, ticks the row with an evidence suffix and a file under `context/changes/<id>/evidence/`. Record the outcome in the Progress row.
- Run the same step with no Chrome extension connected: confirm it ends `done` with zero ticks and no hang.
- Run a router-driven `manual-verify` step without `--chrome` on a plan whose Manual row a shell command can prove: confirm one tick with an evidence suffix and that a row needing a person stays pending.

**Implementation Note**: After this phase and its automated checks pass, pause for confirmation before Phase 6.

---

## Phase 6: Budget from the longest legal path, and docs

### Overview

Set `rigor.budgetDelta` to the smallest values at which the longest legal path fits with one failed step to spare, prove it with a test, and update every document the tier logic touches.

### Changes Required:

#### 1. Budget and reference-path test

**File**: `skills/10x-pipeline/policy.json` (`rigor.budgetDelta` values only), `skills/10x-pipeline/test/budget-executors.test.mjs`

**Intent**: The longest legal path under the shipped caps completes, and the delta is the smallest that allows it.

**Contract**: The test walks two failure-free-by-verdict paths on a three-phase plan (goal, e2e, goal) and one failure path, with the walker pattern of `loops.test.mjs` (`answer`/`walk`), and asserts `steps <= budget - 2` for each, and that `budgetDelta - 1` would not satisfy the longest one. Defaults to prove (standard, executed steps): plan loop 6 (plan, review, revise, review, revise, review), three implement steps (`implement-segment`, `implement-e2e`, plain `implement`), `manual-verify`, impl-review `REJECTED`, `plan-rejected`, plan review, implement, impl-review, fix, impl-review, fix, impl-review = 19. The failure path (two failed implements, `plan-replan`, review, three implement steps, `manual-verify`, impl-review, two fix rounds) is also 19. Thorough adds three pre-plan steps and the frame round: 23. Budgets are `14 + delta`, so the values are `standard: 7` (21) and `thorough: 11` (25); `lean` stays `-4`. The test derives the needed delta from the walked step count so a future cap change fails loudly.

#### 2. Documents

**File**: `docs/ADR/ADR-003-rigor-gated-routing.md`, `skills/10x-pipeline/SKILL.md`, `README.md`, `AGENTS.md`, `skills/10x-pipeline/prompts/README.md`

**Intent**: Record the decisions and keep docs aligned with the router (AGENTS.md hard rule on tier logic).

**Contract**:

- ADR-003: part table row for `phase-executors` becomes `implemented`; new section "Phase executors and manual verification" (new bullets and tables) with the executor choice, segments and cap, strict verification and its residual risk, fallback semantics, code re-plans, `manual-verify`, `--chrome`, evidence rule, the budget table with the new paths, and an assumptions table with reversal costs (the list in this plan). Rule lines in the ADR keep the GIVEN/WHEN/THEN form (`rules.test.mjs` checks them). No ADR-006: this extends the ADR-003 decision, which already lists the part.
- `SKILL.md` "How the tier moves": new bullets for executors and segments, the fallback (no bump, no rigor rise), the commit check for tdd and e2e, the code re-plan, `manual-verify`; the failure definition bullet notes the commit check. Start step 1 and `argument-hint` mention `--chrome` (done in Phase 5; verify only). No model or tier names beyond what it documents.
- `README.md`: arguments line `[--chrome]`, routing bullets for the same items, a "Phase executors" subsection, the budget lines (reference worst paths, the old advice to raise `budgetDelta.standard` to 1 updated), Limits note on Chrome in a subagent.
- `AGENTS.md`: project-structure lines for the four new test files, `phase-helpers.mjs` and the new prompt files; command list gets `init ... [--chrome]`.

### Success Criteria:

#### Automated Verification:

- The standard and thorough longest paths fit, and the delta is the smallest that fits: `node --test --test-name-pattern "longest legal path" skills/10x-pipeline/test/budget-executors.test.mjs`
- The failure re-plan path fits: `node --test --test-name-pattern "failure path fits" skills/10x-pipeline/test/budget-executors.test.mjs`
- Existing reference paths still pass unedited: `node --test skills/10x-pipeline/test/loops.test.mjs`
- ADR rule lines keep the rule form: `node --test --test-name-pattern "ADR" skills/10x-pipeline/test/rules.test.mjs`
- ADR-003 marks the part implemented and has the new section: `grep -c "phase-executors.*implemented" docs/ADR/ADR-003-rigor-gated-routing.md`
- `SKILL.md` and `README.md` document `--chrome`, `manual-verify` and the code re-plan: `grep -c "manual-verify" skills/10x-pipeline/SKILL.md README.md`
- `SKILL.md` names no model: `! grep -iE "opus|sonnet|haiku" skills/10x-pipeline/SKILL.md`
- `AGENTS.md` lists the new test files: `grep -c "executors.test.mjs" AGENTS.md`
- Full suite passes on Node 18 syntax rules: `node --test skills/10x-pipeline/test/*.test.mjs`
- `init` and `status` against a scratch change folder print valid JSON: `node --test --test-name-pattern "executors smoke" skills/10x-pipeline/test/executors.test.mjs`

#### Manual Verification:

- A reviewer reads ADR-003, `SKILL.md` and `README.md` side by side and confirms they describe the same executor, fallback, re-plan, manual-verify and budget rules.
- A full router-driven pipeline run on a scratch project (a mixed plan, `--chrome` off) ends `done` with the step log showing the segment templates and the `manual-verify` step. Record the step list in the Progress row.

**Implementation Note**: After this phase and its automated checks pass, run `/10x-impl-review` before archiving.

---

## Testing Strategy

### Unit Tests:

- All router behavior is tested black-box through the CLI in scratch projects (`helpers.mjs` plus `phase-helpers.mjs`), as the existing suite does. Git cases use the hermetic git helpers.
- Edge cases: Skip flip with and without a moved HEAD; a SHA suffix for a missing commit; no git; a blocked executor with and without `needsHuman`; exactly two versus three trailing failures; the shared re-plan cap across both triggers; a Manual row ticked without evidence; zero ticks; an edited Automated row.

### Integration Tests:

- `budget-executors.test.mjs` walks the longest legal paths through the whole router.

### Manual Testing Steps:

1. Unattended `/10x-e2e` run in a scratch Playwright project (Phase 2).
2. Unattended `/10x-tdd` run at `thorough` (Phase 3).
3. `manual-verify` with Chrome connected, with Chrome absent, and without `--chrome` (Phase 5).
4. A full mixed-plan pipeline run (Phase 6).

## Performance Considerations

`readPlan` runs several times per `next()`; the added list building is linear in rows. One extra `git rev-parse HEAD` per step and up to three read-only git calls per strict verification. No call when git is missing (null means count rule).

## Migration Notes

Additive log keys only (`before.head`, `before.done`, `before.manual`, `phase`, `lastPhase`, `executor`, `fallback`), so `compare` (ADR-005) and old logs keep working. An in-flight run resumed on the new router keeps its plain `implement` entries; only new entries carry the keys. `meta.chrome` is optional. A project that overrides `rigor.budgetDelta` keeps its values.

## Assumptions

Decided without a human. Each is also in the ADR-003 section (Phase 6) and is overridable in `context/foundation/agent-smith-policy.json` unless the cost says otherwise.

| # | Assumption | Evidence | Cost to reverse |
| --- | --- | --- | --- |
| 1 | `--chrome` is an `init` flag stored in `meta.json` like `--archive`. The orchestrator does not probe tools. Chrome use in a subagent cannot be tested unattended, so a Manual row covers it. | Research section 5: `parseFlags` is generic; `SKILL.md` `allowed-tools` lacks `ToolSearch`; a subagent saw the tools as deferred, no call was tested. | Low: remove the flag and the chrome template. |
| 2 | `manual-verify` runs from `standard`, once per run (`maxRuns` 1), before the first impl-review pass with Manual rows pending. Zero ticks is `done`. | Protects the `lean` budget; a failure would retry at higher tiers and raise rigor (research section 5). | Low: data (`minRigor`, `maxRuns`). |
| 3 | Evidence suffix is ` — evidence: <summary or path>`, distinct from the SHA suffix. Files go under `context/changes/<id>/evidence/`, under 1 MB each by prompt rule. The router checks the suffix only, not that a file exists or its size. | The archive commit takes only the change folder; a browser GIF download lands outside the repo (research section 5). | Medium: an existence and size check in the router. |
| 4 | The strict commit check applies to `implement-tdd` and `implement-e2e`. `/10x-goal-implement` keeps the count check: its legitimate zero-diff phase ("had no diff to commit") makes any commit check a false failure, and research found no cheaper guard. Residual risk: a goal-implement phase that ticks rows with no work passes until impl-review. The e2e prompt turns "spec already passes" into `blocked` so that legitimate case falls back instead of failing. | Research section 1 and 2 (`10x-goal-implement/SKILL.md:209`, `10x-e2e/SKILL.md:171`). | Medium: a commit check on goal-implement plus a policy escape. |
| 5 | The re-plan triggers at exactly two trailing implement failures or the first `REJECTED`, shares one cap of 1 per run, counts against the step budget, and a failed failure-re-plan halts. A blocked tdd or e2e step falls back to goal-implement with no tier bump, no rigor rise and no `needsHuman`. | Research sections 1, 4; `route.test.mjs:386-400`. | Low: data (`codeReplan`). |
| 6 | E2E has no rigor gate (`minRigor` `lean`); tdd is gated at `thorough`. | `change.md` scope; research section 6. | Low: data. |
| 7 | `executors.maxSegments` is 2 non-plain implement steps per run; beyond it the rest runs as one plain `implement`. This bounds the longest path. | Research section 4: k segments add k-1 steps. | Low: data, plus the budget. |
| 8 | `rigor.budgetDelta` becomes standard 7 and thorough 11 (budgets 21 and 25), the stacked ceiling of every cap, proved by a test. Real runs rarely approach it. | Owner default 2; arithmetic in Phase 6. | Low: data. Lower caps give a lower ceiling. |
| 9 | A fallback entry is transparent to `trailingFailures`: it neither counts nor ends a streak. | Keeps a fallback from resetting a failure streak. | Low: one helper. |
| 10 | Row keywords, extension lists and test words are uncalibrated, like the churn parameters. A false e2e or tdd pick costs one fallback step. | Research section 3 and 6. | Low: data. |
| 11 | Not verified by research or by this plan: a live tdd, e2e or goal-implement run, a real E2E project, any Chrome call. The Manual rows cover them. | Research assumptions list. | n/a |

## References

- Related research: `context/changes/phase-executors/research.md`
- Change scope: `context/changes/phase-executors/change.md`
- Pattern to copy: `skills/10x-pipeline/scripts/route.mjs:887-993` (`preplanNext`, `replanNext`)
- Pre-plan plan for the same style: `context/archive/2026-10-30-pre-plan-steps/plan.md`
- ADR-003 `docs/ADR/ADR-003-rigor-gated-routing.md:24`, `:252-261`; ADR-004 (rule form); ADR-005 (additive log keys)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Commit verification and neutral fallback

#### Automated

- [ ] 1.1 Existing suite stays green with no test edit: `node --test skills/10x-pipeline/test/*.test.mjs`
- [ ] 1.2 Plain implement keeps the count rule (a flipped row without a commit stays `ok`): `node --test --test-name-pattern "plain implement keeps count rule" skills/10x-pipeline/test/executors.test.mjs`
- [ ] 1.3 A tdd or e2e step that ticks rows with no new commit and no SHA suffix is `ok: false, verified: false`: `node --test --test-name-pattern "strict verify rejects skip flip" skills/10x-pipeline/test/executors.test.mjs`
- [ ] 1.4 A tdd or e2e step with a commit since `before.head` is `ok: true`: `node --test --test-name-pattern "strict verify accepts new commit" skills/10x-pipeline/test/executors.test.mjs`
- [ ] 1.5 Rows carrying a valid SHA suffix pass without a moved HEAD, and an unknown SHA fails: `node --test --test-name-pattern "strict verify checks sha suffix" skills/10x-pipeline/test/executors.test.mjs`
- [ ] 1.6 Without git the strict check falls back to the count rule: `node --test --test-name-pattern "strict verify without git" skills/10x-pipeline/test/executors.test.mjs`
- [ ] 1.7 A blocked tdd or e2e entry is a fallback: not counted by `trailingFailures`, no rigor rise, next tier not bumped: `node --test --test-name-pattern "fallback is neutral" skills/10x-pipeline/test/executors.test.mjs`
- [ ] 1.8 A blocked entry of plain implement is still a failure, and `needsHuman` from an executor entry still halts: `node --test --test-name-pattern "blocked plain implement fails" skills/10x-pipeline/test/executors.test.mjs`
- [ ] 1.9 New entries record `before.head` and `before.done`, and `status` prints `template`: `node --test --test-name-pattern "entry records before state" skills/10x-pipeline/test/executors.test.mjs`

#### Manual

- [ ] 1.10 A reviewer confirms by reading the diff that the router's git use in this phase is limited to `rev-parse`, `cat-file` and `merge-base --is-ancestor`, and that `readPlan` kept every existing field type.

### Phase 2: Phase list routing with `/10x-e2e` and segments

#### Automated

- [ ] 2.1 `e2eSetup` hits only when the section has `config` and `seed` paths that exist: `node --test --test-name-pattern "e2e setup predicate" skills/10x-pipeline/test/executors.test.mjs`
- [ ] 2.2 A plan with no browser rows gets the plain `implement` prompt, byte-identical to the policy text plus suffix: `node --test --test-name-pattern "no e2e rows keeps plain prompt" skills/10x-pipeline/test/executors.test.mjs`
- [ ] 2.3 Browser rows with setup route that phase to `implement-e2e` with `{phase}` and `{lastPhase}` filled and `executor: "e2e"` in the entry: `node --test --test-name-pattern "e2e phase routes to e2e" skills/10x-pipeline/test/executors.test.mjs`
- [ ] 2.4 Browser rows without setup stay on plain `implement`: `node --test --test-name-pattern "e2e rows without setup" skills/10x-pipeline/test/executors.test.mjs`
- [ ] 2.5 A goal, e2e, goal plan runs `implement-segment` for phase 1, then `implement-e2e` for phase 2, then plain `implement` once the cap is reached: `node --test --test-name-pattern "mixed plan segments" skills/10x-pipeline/test/executors.test.mjs`
- [ ] 2.6 A blocked e2e entry is not repeated for that phase, the next step is goal-implement at an unchanged tier with rigor unchanged: `node --test --test-name-pattern "e2e blocked falls back" skills/10x-pipeline/test/executors.test.mjs`
- [ ] 2.7 An unverified e2e entry (Skip flip) is not repeated for that phase and the next attempt is one tier higher: `node --test --test-name-pattern "e2e failed not repeated" skills/10x-pipeline/test/executors.test.mjs`
- [ ] 2.8 `implement-e2e` never runs below the effort floor of the rigor level: `node --test --test-name-pattern "e2e effort floor" skills/10x-pipeline/test/executors.test.mjs`
- [ ] 2.9 Prompts keep the rule form and the new prompt file is listed as wired: `node --test skills/10x-pipeline/test/rules.test.mjs skills/10x-pipeline/test/preplan.test.mjs`
- [ ] 2.10 The rendered e2e prompt names the stop phase, forbids Skip and ends `blocked` on a redirect: `node --test --test-name-pattern "e2e prompt rules" skills/10x-pipeline/test/executors.test.mjs`
- [ ] 2.11 Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs`

#### Manual

- [ ] 2.12 Run `/10x-e2e` unattended in a scratch project with Playwright set up (`/10x-e2e-setup` done) and a two-phase plan whose phase 2 is browser-level, through the router: the e2e step stops after its phase, never picks "Skip", ends `done` with a new commit, or ends `blocked` without a question left waiting. Record the result in the Progress row.

### Phase 3: `/10x-tdd` for pure-logic phases at thorough

#### Automated

- [ ] 3.1 `phaseFiles` reads `**File**` and `**Files**` lines per phase, English and Polish headings: `node --test --test-name-pattern "phase files reader" skills/10x-pipeline/test/executors.test.mjs`
- [ ] 3.2 A pure-logic phase at thorough routes to `implement-tdd`: `node --test --test-name-pattern "tdd phase at thorough" skills/10x-pipeline/test/executors.test.mjs`
- [ ] 3.3 The same plan at standard and lean stays on goal-implement: `node --test --test-name-pattern "tdd gated by rigor" skills/10x-pipeline/test/executors.test.mjs`
- [ ] 3.4 Each predicate condition alone blocks tdd (a doc path, a config glob, a ticked row, a UI word, a row with no test command): `node --test --test-name-pattern "tdd predicate rejects" skills/10x-pipeline/test/executors.test.mjs`
- [ ] 3.5 A phase that satisfies both predicates goes to e2e: `node --test --test-name-pattern "e2e wins over tdd" skills/10x-pipeline/test/executors.test.mjs`
- [ ] 3.6 A blocked tdd entry falls back to goal-implement with no tier bump and no `needsHuman`: `node --test --test-name-pattern "tdd blocked falls back" skills/10x-pipeline/test/executors.test.mjs`
- [ ] 3.7 The rendered tdd prompt names the stop phase, forbids Skip and ends `blocked` on a redirect: `node --test --test-name-pattern "tdd prompt rules" skills/10x-pipeline/test/executors.test.mjs`
- [ ] 3.8 Prompt rule form and wiring tests pass: `node --test skills/10x-pipeline/test/rules.test.mjs skills/10x-pipeline/test/preplan.test.mjs`
- [ ] 3.9 Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs`

#### Manual

- [ ] 3.10 Run `/10x-tdd` unattended at `--rigor thorough` in a scratch project with a test runner and one pure-logic phase, through the router: the tdd step stops after its phase, never picks "Skip", commits, or ends `blocked`. Record the result in the Progress row.

### Phase 4: Re-plan after repeated failures or REJECTED

#### Automated

- [ ] 4.1 Two trailing implement failures route to `plan-replan` with the failure note in the prompt: `node --test --test-name-pattern "two failures replan" skills/10x-pipeline/test/codereplan.test.mjs`
- [ ] 4.2 Three trailing failures still halt (existing test), and with the cap used the third attempt runs as today: `node --test --test-name-pattern "cap used keeps third attempt" skills/10x-pipeline/test/codereplan.test.mjs`
- [ ] 4.3 A re-plan that unticks or drops a ticked row, or leaves no pending Automated row, is unverified: `node --test --test-name-pattern "replan verification" skills/10x-pipeline/test/codereplan.test.mjs`
- [ ] 4.4 A failed `plan-replan` halts for a human: `node --test --test-name-pattern "failed replan halts" skills/10x-pipeline/test/codereplan.test.mjs`
- [ ] 4.5 After a verified re-plan, plan review reruns and the next implement starts at 0 failures: `node --test --test-name-pattern "replan then review then implement" skills/10x-pipeline/test/codereplan.test.mjs`
- [ ] 4.6 The first `REJECTED` routes to `plan-rejected` at the plan tier plus `rejectedBump`; the second falls to `fix`; the shared cap holds across both triggers: `node --test --test-name-pattern "rejected replan once" skills/10x-pipeline/test/codereplan.test.mjs`
- [ ] 4.7 Setting `codeReplan.max` or `afterFailures` to 0 restores today's behavior for the trigger: `node --test --test-name-pattern "replan disabled by policy" skills/10x-pipeline/test/codereplan.test.mjs`
- [ ] 4.8 A fallback entry does not count toward the two trailing failures: `node --test --test-name-pattern "fallback not counted for replan" skills/10x-pipeline/test/codereplan.test.mjs`
- [ ] 4.9 Prompt rule form tests pass: `node --test skills/10x-pipeline/test/rules.test.mjs`
- [ ] 4.10 Full suite passes with `loops.test.mjs` edited only at lines 30-34: `node --test skills/10x-pipeline/test/*.test.mjs`

#### Manual

- [ ] 4.11 A reviewer reads the `plan-replan` and `plan-rejected` prompts and confirms that each rule can be followed by a subagent that cannot ask questions.

### Phase 5: `manual-verify` step and `--chrome`

#### Automated

- [ ] 5.1 The step runs once before the first impl-review when Manual rows are pending at standard, and not at lean: `node --test --test-name-pattern "manual verify placement" skills/10x-pipeline/test/manualverify.test.mjs`
- [ ] 5.2 It does not run when no Manual row is pending, or after an ok run (`maxRuns`): `node --test --test-name-pattern "manual verify not repeated" skills/10x-pipeline/test/manualverify.test.mjs`
- [ ] 5.3 Impl-review runs right after it and a `fix` does not trigger a second run: `node --test --test-name-pattern "manual verify before impl review" skills/10x-pipeline/test/manualverify.test.mjs`
- [ ] 5.4 A ticked row with an evidence suffix verifies; without it, the step is `ok: false`: `node --test --test-name-pattern "evidence suffix required" skills/10x-pipeline/test/manualverify.test.mjs`
- [ ] 5.5 Zero ticks is `ok: true`: `node --test --test-name-pattern "zero ticks is done" skills/10x-pipeline/test/manualverify.test.mjs`
- [ ] 5.6 Editing an Automated row, a title or a SHA suffix, or unticking a row, makes the step unverified: `node --test --test-name-pattern "manual verify guards plan edits" skills/10x-pipeline/test/manualverify.test.mjs`
- [ ] 5.7 `init --chrome` stores `chrome: true`, a resume keeps it, `--chrome false` clears it, and the chrome template is chosen from it: `node --test --test-name-pattern "chrome flag" skills/10x-pipeline/test/manualverify.test.mjs`
- [ ] 5.8 Rendered prompts name the evidence directory and the evidence suffix; the chrome prompt adds the ToolSearch rule and the unavailable fallback: `node --test --test-name-pattern "manual verify prompts" skills/10x-pipeline/test/manualverify.test.mjs`
- [ ] 5.9 Prompt rule form and wiring tests pass: `node --test skills/10x-pipeline/test/rules.test.mjs skills/10x-pipeline/test/preplan.test.mjs`
- [ ] 5.10 Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs`

#### Manual

- [ ] 5.11 Run a router-driven `manual-verify` step with `--chrome` on a scratch plan with one browser-checkable Manual row and a connected Chrome extension: confirm the subagent loads the Chrome tools, ticks the row with an evidence suffix and a file under `context/changes/<id>/evidence/`. Record the outcome in the Progress row.
- [ ] 5.12 Run the same step with no Chrome extension connected: confirm it ends `done` with zero ticks and no hang.
- [ ] 5.13 Run a router-driven `manual-verify` step without `--chrome` on a plan whose Manual row a shell command can prove: confirm one tick with an evidence suffix and that a row needing a person stays pending.

### Phase 6: Budget from the longest legal path, and docs

#### Automated

- [ ] 6.1 The standard and thorough longest paths fit, and the delta is the smallest that fits: `node --test --test-name-pattern "longest legal path" skills/10x-pipeline/test/budget-executors.test.mjs`
- [ ] 6.2 The failure re-plan path fits: `node --test --test-name-pattern "failure path fits" skills/10x-pipeline/test/budget-executors.test.mjs`
- [ ] 6.3 Existing reference paths still pass unedited: `node --test skills/10x-pipeline/test/loops.test.mjs`
- [ ] 6.4 ADR rule lines keep the rule form: `node --test --test-name-pattern "ADR" skills/10x-pipeline/test/rules.test.mjs`
- [ ] 6.5 ADR-003 marks the part implemented and has the new section: `grep -c "phase-executors.*implemented" docs/ADR/ADR-003-rigor-gated-routing.md`
- [ ] 6.6 `SKILL.md` and `README.md` document `--chrome`, `manual-verify` and the code re-plan: `grep -c "manual-verify" skills/10x-pipeline/SKILL.md README.md`
- [ ] 6.7 `SKILL.md` names no model: `! grep -iE "opus|sonnet|haiku" skills/10x-pipeline/SKILL.md`
- [ ] 6.8 `AGENTS.md` lists the new test files: `grep -c "executors.test.mjs" AGENTS.md`
- [ ] 6.9 Full suite passes on Node 18 syntax rules: `node --test skills/10x-pipeline/test/*.test.mjs`
- [ ] 6.10 `init` and `status` against a scratch change folder print valid JSON: `node --test --test-name-pattern "executors smoke" skills/10x-pipeline/test/executors.test.mjs`

#### Manual

- [ ] 6.11 A reviewer reads ADR-003, `SKILL.md` and `README.md` side by side and confirms they describe the same executor, fallback, re-plan, manual-verify and budget rules.
- [ ] 6.12 A full router-driven pipeline run on a scratch project (a mixed plan, `--chrome` off) ends `done` with the step log showing the segment templates and the `manual-verify` step. Record the step list in the Progress row.
