# phase-executors Implementation Plan

## Overview

Make the pipeline's `implement` step pick the executor that fits each plan phase (`/10x-e2e`, `/10x-tdd` or `/10x-goal-implement`), verify tdd and e2e work by a real code commit instead of the `[x]` count, re-open rows that were ticked without a commit, re-plan once after repeated implement failures or a first impl-review `REJECTED`, and add a `manual-verify` step that ticks the command-checkable Manual rows it can prove, each with an evidence file the router checks. Roadmap S-08 (FR-001, FR-003, FR-007). Written without a human: every owner question was answered from research evidence or from the defaults in the planning brief, and each answer is an assumption below.

Revised 2026-10-31 after the plan review (verdict REVISE, `reviews/plan-review.md`). The "Review Response" section before `## References` lists every finding, the decision, the existing tests this change edits and the Progress rows that were reworded.

## Current State Analysis

All anchors are `skills/10x-pipeline/scripts/route.mjs` at commit `f246cdf` unless stated.

- One `implement` step covers the whole plan with one prompt (`policy.json` `prompts.implement`, `/10x-goal-implement {id}`). `decide()` returns it while `plan.autoPending > 0` (`:701-709`).
- A done `implement` is verified only by `plan.autoDone > before.autoDone` (`:331`). A tdd or e2e "Skip" ticks rows with no commit and passes. Scratch experiment 1 in the research confirmed `ok:true, verified:true` for a hand flip.
- A failed entry whose rows stay ticked does not re-open the work: `decide()` enters the implement branch only while `plan.autoPending > 0` and `lastIdx(log, ["implement","fix"])` ignores failed entries (review experiment, F2). If a Skip flipped every row of the plan, the next step is `impl-review`.
- `readPlan` (`:65-89`) keeps counters and Manual row text only; `phases` is a number read by four consumers (`:1004`, `:417`, `:1025`, `compare` `readSide`). It keeps no phase list, row ids or done flags for rows.
- Failure counters derive from `ok`: `trailingFailures` (`:355`), the failed-step count in `rigorInputs` (`:421`), `struggled` (`:718`), `simpleSignal` (`:999`, `:1005`).
- `next()` halts at `fails >= maxAttemptsPerStep` (3, `:1397`). A third implement attempt runs after two failures at tier 5.
- `REJECTED` goes to `fix` (`:726-740`); `loops.test.mjs:30-34` and `SKILL.md:112` assert and document it.
- `manualPending` is computed only in `readPlan` (`:84`) and read at `done` (`:742`). Nothing ticks Manual rows.
- Step budget: `maxTotalSteps` 14 plus `rigor.budgetDelta` (-4/0/4). The worst standard path is 12 and the worst thorough path 16 (ADR-003, `:252-261`). The halt rule is `executed >= budget` (`:1360`); the reference tests keep every path at `budget - 2` or less, so one failed step and its retry still fit.
- The baseline arm of `compare` pins every ladder tier to sonnet/high, so any new step name is pinned by tier. `compare.test.mjs:23` and `:28` assert the exact key set of `baseline-policy.json` (`ladder`, `rigor`), so that file cannot gain a key without editing a frozen test.
- Toolkit facts (research section 2, files outside this repo, read 2026-10-31): `/10x-goal-implement` has no between-phase pause; `/10x-tdd` and `/10x-e2e` end each phase with a next-phase question and have several interactive gates; both flip rows with no SHA on "Skip"; `/10x-goal-implement` skips rows that are already `[x]` (`SKILL.md:82`).
- The router's git helpers `runGit`/`gitOut` (`:464-482`) are read-only; `core.quotePath=false` is the only `-c` option.

## Desired End State

- `implement` returns one of five templates: plain `implement` (whole plan, byte-identical prompt to today), `implement-segment` (goal-implement for phases M..N), `implement-e2e`, `implement-tdd` and `implement-retry`.
- A tdd or e2e step is `ok` only when the Automated `[x]` count rose and `before.head..HEAD` holds a commit that touched a path outside `context/changes/<id>/`. A SHA suffix on a row never passes by itself; a suffix that names a commit outside that range fails. A `blocked` tdd or e2e step without `signals.needsHuman` is a neutral fallback entry: no tier bump, no rigor rise, no failure count, and the same executor is not chosen again for that phase.
- A strict step that ticked rows without commit evidence records those row ids as `uncommitted`. While such rows are still ticked, `decide()` returns an `implement-retry` step even when no Automated row is pending, so a full-phase Skip flip cannot reach impl-review as done. The retry prompt names the rows and tells the subagent to set them back to `[ ]` first; the retry is `ok` only with a commit in its own range.
- Extra steps are metered by one pool per rigor level (`extraSteps`): every non-plain implement step, every `manual-verify` step and a REJECTED re-plan spends from it. `lean` has an allowance of 0, so `lean` keeps today's paths and budget. Standard allows 2, thorough 3.
- After two trailing implement failures, or an impl-review `REJECTED` that comes before any `fix`, the router runs one `plan` step with the failure or review as input (shared cap 1 per run, rigor `standard` or higher). A REJECTED re-plan uses one of the `maxFixLoops`. Plan review and implement then continue as usual.
- At rigor `standard` and above, one `manual-verify` step runs before the first impl-review pass that finds a pending Manual row the plan makes checkable: a row with a backticked command, or, with `init --chrome`, a browser row. It ticks only such rows, each with ` — evidence: evidence/<name>` where `context/changes/<id>/evidence/<name>` exists and is not empty. Rows that need a person stay in `manualPending`. A failed `manual-verify` is neutral (one retry, then the run goes on) and its unproven ticks are listed in the `done` output.
- `rigor.budgetDelta` is `standard: 2` and `thorough: 7` (today 0 and 4); `lean` stays -4. A test walks the longest legal path of each level and proves the delta is the smallest that fits with one failed step to spare.
- ADR-003, `SKILL.md` "How the tier moves", `README.md` and `AGENTS.md` describe it.

Verify: `node --test skills/10x-pipeline/test/*.test.mjs` passes, including the new files `executors.test.mjs`, `codereplan.test.mjs`, `manualverify.test.mjs` and `budget-executors.test.mjs`.

### Key Discoveries:

- Eight sites compare or return the literal step `"implement"` (`:331`, `:620`, `:674`, `:705`, `:708`, `:713`, `:718`, `:731`) and `policy.complexity` keys it. Keeping the step name and varying the template (as `plan`/`plan-revise` do, `:1408`) touches none of them.
- The pattern to copy is `preplanNext`/`replanNext`: selection in a function below `decide()`, counters derived from the log by template name, knobs in policy data where a non-positive value disables the feature (`:887-993`).
- A tdd/e2e redirect is a normal ending of the skill, so the prompt must turn it into `blocked` without `signals.needsHuman` (`needsHuman` halts before `decide()`, `:1350-1357`).
- The re-plan must trigger at exactly 2 trailing failures: `route.test.mjs:386-400` (three failed implements must halt) holds only then.
- `status` output has no `template` key (`:1720`); adding it shows the executor without touching `buildReport`.
- Prototype run (scratch copy, 2026-10-31, deleted): with the REJECTED re-plan limited to a first review (no `fix` yet), the status `template` key, the report label and the new `before` keys added, the whole suite (324 tests) fails in exactly one existing test, `loops.test.mjs:16` (block at lines 30-34). The three reference paths (`:441-497`) reach their `REJECTED` after a `fix`, and `planText` (`helpers.mjs:58`) always writes a Manual row "Look at it", which is not command-checkable, so `manual-verify` never fires in them and `route.test.mjs:195-199` keeps passing.

## What We're NOT Doing

- No change to `cleanSignals`, `cleanUsage`, `prompts.suffix` or the RESULT line (S-10 owns them). `buildReport` changes only inside its `rows` map (Phase 6: the Result label and the Step cell); no report section for executors. Gates in Phase 6 prove it.
- No edit to `loops-existing.test.mjs`, `compare.test.mjs`, `helpers.mjs`, `baseline-policy.json`, `context/archive/`, `run.jsonl` or `meta.json` by hand. The only existing test edit is the block at `loops.test.mjs:30-34` (Phase 4).
- No new git write. The router's new git reads are `rev-parse`, `merge-base --is-ancestor` and `log` only; a gate row greps the diff for any other subcommand.
- No `gh`, no npm dependency, no Node 19+ API.
- No cheaper guard for `/10x-goal-implement` zero-diff phases: research found none without false negatives (see Assumption 4). Plain `implement` and `implement-segment` keep the count rule; only `implement-retry` is strict among goal-implement templates.
- No router check that a Chrome tool is available, and no probing from the orchestrator (`allowed-tools` has no `ToolSearch`).
- No size check of evidence files by the router (the prompt asks for under 1 MB). Existence, non-emptiness and containment are checked.
- No new step name for executors. No `baseline-policy.json` pin for the new features (Assumption 14).
- No `/10x-lesson` or lesson-candidate work.

## Implementation Approach

Six phases, each one implement run. Phase 1 builds the verification and fallback machinery with plain templates only, so it changes no routing. Phase 2 adds the phase list, the extra-step pool, the e2e executor, segments and the retry. Phase 3 adds tdd on the same rails. Phase 4 adds the code re-plans. Phase 5 adds `manual-verify` and `--chrome`. Phase 6 sets the budget from proved longest paths and updates the docs and the report label.

Edit discipline for the S-10 conflict (S-10 edits `decide()` and `attachResult`/`cleanSignals` afterwards). New logic goes in one new section after `replanNext`. Touch points inside existing functions, all small:

- `decide()`: the implement branch (failure re-plan call, retry call, executor call, and the `if` that also opens for retry rows); the `struggled` test (`isFailure`); the REJECTED block (re-plan call before the fix-loop check, and the fix-loop count); the impl-review branch (one `manual-verify` call); the `done` return (one conditional key `manualUnproven`). S-10 may touch the `done` return; the key is one spread.
- `attachResult`: new bodies inside `case "implement"`, `case "plan"` (template-keyed checks) and a new `case "manual-verify"`. The tail (`last.signals`, `last.verified`, `last.ok`) stays untouched: `fallback` is set inside the cases, because it depends only on `result.status` and the case's own verdict.
- `next()`: the entry `before` keys and the render variables.

New policy keys go in new top-level groups after `prompts`, plus appended entries inside `steps` and `prompts`, and the two `rigor.budgetDelta` values. Docs are new bullets.

Policy shape (names are the contract; values are the shipped defaults):

- `executors`: `strictVerify` (`["implement-tdd", "implement-e2e"]`), `segment.template`, `retry.template` (`implement-retry`), `e2e` (`template`, `minRigor` `lean`, `setup` {file, section, fields}, `rowWords`), `tdd` (`template`, `minRigor` `thorough`, `codeExtensions`, `excludeGlobs`, `testWords`, `uiWords`).
- `extraSteps`: `allowance` {`lean` 0, `standard` 2, `thorough` 3} and `cost` {`implement-segment` 1, `implement-e2e` 1, `implement-tdd` 1, `manual-verify` 1, `plan-rejected` 2}. Spent = sum of `cost` over executed entries (any outcome); left = allowance of the current level minus spent. A feature runs only when `left >= its cost`. A non-positive allowance turns every metered feature off.
- `codeReplan`: `minRigor` `standard`, `afterFailures` 2, `onRejected` true, `rejectedMaxFixes` 0, `max` 1, `rejectedBump` 1, `failureBump` 0, `failureNoteMax` 300. A non-positive `max` or `afterFailures` turns that trigger off.
- `manualVerify`: `minRigor` `standard`, `maxRuns` 1, `maxAttempts` 2, `commandWords`, `humanWords`, `browserWords`.
- `rigor.budgetDelta`: `standard` 2, `thorough` 7.
- `steps["manual-verify"]`, and prompts `implement-segment`, `implement-e2e`, `implement-tdd`, `implement-retry`, `plan-replan`, `plan-rejected`, `manual-verify`, `manual-verify-chrome`.

Test files are new and black-box through the CLI (`run`, `init`, `next` from `helpers.mjs`), with a new `test/phase-helpers.mjs` for plan builders and e2e fixtures so `helpers.mjs` stays untouched. A test command run with `--test-name-pattern` must report at least one test; the implementer checks the count.

## Phase 1: Commit verification and neutral fallback

### Overview

Make a tdd or e2e step verifiable by a code commit, make a redirect a neutral fallback, and record what later phases need in the log entry. No routing change: only plain `implement` exists after this phase, so every existing test stays green.

### Changes Required:

#### 1. Plan reader

**File**: `skills/10x-pipeline/scripts/route.mjs` (`readPlan`)

**Intent**: Return the structure the later phases need without changing existing fields.

**Contract**: Add `phaseList: [{ n, name, auto: [{ id, text, done }], manual: [{ id, text, done }] }]`, where `n` and `name` come from the `### Phase N: name` Progress heading, `text` is the row text after the box, and `id` is the leading `N.M` of the row text. A row without a leading `N.M` uses its whole text with a trailing ` — <7-40 hex>` or ` — evidence: <token>` suffix removed, so a SHA or evidence suffix never changes an id. `phases`, `rows`, `autoDone`, `autoPending` and `manualPending` keep their types and values. Progress headings in `Faza N` form match neither `### Phase \d+` nor the list: `phases` stays 0 and `phaseList` is empty, so routing stays plain (existing behavior, covered by a test). Add helpers `doneIds(plan)` (ids of done Automated rows) and `newlyTicked(beforeIds, plan)`.

#### 2. Failure helper

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: One definition of "failed step" that ignores fallbacks.

**Contract**: `isFailure(e) = e.ok === false && !e.fallback`. Use it in `trailingFailures` (a fallback entry is skipped, neither counted nor a break), the failed-step count in `rigorInputs`, the `struggled` test in `decide()` and the two `ok === false` tests in `simpleSignal`. For entries without `fallback` the behavior is identical to today.

#### 3. Entry record and verification

**File**: `skills/10x-pipeline/scripts/route.mjs` (`next`, `attachResult` `case "implement"`, new section below `replanNext`)

**Intent**: Record the pre-step state and verify tdd, e2e and retry steps by a code commit.

**Contract**:

- `next()` entry `before` gains `head` (stdout of `git rev-parse HEAD` trimmed, or `null` without git or without a commit) and `done` (array of done Automated row ids), only when the entry's template is in `executors.strictVerify` or is `implement-retry`. Plain and segment entries keep `before: { autoDone }` byte for byte. Additive keys only (ADR-005). An entry with no `before.head` (an in-flight run resumed on the new router) is treated like `head: null` (`== null`, not `=== null`).
- `commitEvidence(before, ids, plan, id)` returns `null` (no check; the count rule applies) when `before.head == null` or git is unreadable. Otherwise it returns `false` when `git merge-base --is-ancestor <before.head> HEAD` exits non-zero (an amend or rebase of the old head reads as a false failure: noisy, harmless, and the retry path covers it). Otherwise it reads `git log --name-only --relative --format=@%H <before.head>..HEAD` once and keeps the commits that touched at least one path outside `context/changes/<id>/` (paths are relative to the project root; a commit that only touches paths outside the root does not count). It returns `true` only when at least one such commit exists and every row in `ids` that carries a ` — <7-40 hex>` suffix names a SHA that is a prefix of one of those commits. A commit that only touches `plan.md` or the change folder is not evidence, and a suffix that names an older commit fails.
- `attachResult` `case "implement"`: when `policy.executors.strictVerify` includes `last.template`, or `last.retry` is set: `ev = commitEvidence(...)`. For `ev === null` the count rule applies as today. Otherwise `verified = ev` for a retry entry and `verified = plan.autoDone > before.autoDone && ev` for the others. The ids checked are `newlyTicked(before.done, plan)` (retry entries: the entry's `retry` ids that are done now). When `ev === false` and that id list is not empty, set `last.uncommitted = ids` (Phase 2 reads it). Plain templates keep the count rule exactly as today.
- Inside the same case, set `last.fallback = true` when `result.status === "blocked"` and `last.template` is in `strictVerify`. A `signals.needsHuman` still halts first (existing code, `:1350`).
- `status` output steps gain `template: e.template ?? null`.
- `policy.json` gains the `executors` group with only `strictVerify: ["implement-tdd", "implement-e2e"]` in this phase.

### Success Criteria:

#### Automated Verification:

- Existing suite stays green with no test edit: `node --test skills/10x-pipeline/test/*.test.mjs`
- Plain implement keeps the count rule (a flipped row without a commit stays `ok`): `node --test --test-name-pattern "plain implement keeps count rule" skills/10x-pipeline/test/executors.test.mjs`
- A tdd or e2e step that ticks rows with no new commit and no SHA suffix is `ok: false, verified: false`: `node --test --test-name-pattern "strict verify rejects skip flip" skills/10x-pipeline/test/executors.test.mjs`
- A tdd or e2e step with a code commit since `before.head` is `ok: true`: `node --test --test-name-pattern "strict verify accepts new commit" skills/10x-pipeline/test/executors.test.mjs`
- A SHA suffix alone never passes: a code commit in `before.head..HEAD` is required, and a suffix outside that range fails: `node --test --test-name-pattern "strict verify checks sha suffix" skills/10x-pipeline/test/executors.test.mjs`
- Without git the strict check falls back to the count rule: `node --test --test-name-pattern "strict verify without git" skills/10x-pipeline/test/executors.test.mjs`
- A blocked tdd or e2e entry is a fallback: not counted by `trailingFailures`, no rigor rise, next tier not bumped: `node --test --test-name-pattern "fallback is neutral" skills/10x-pipeline/test/executors.test.mjs`
- A blocked entry of plain implement is still a failure, and `needsHuman` from an executor entry still halts: `node --test --test-name-pattern "blocked plain implement fails" skills/10x-pipeline/test/executors.test.mjs`
- New strict entries record `before.head` and `before.done`, plain entries do not, and `status` prints `template`: `node --test --test-name-pattern "entry records before state" skills/10x-pipeline/test/executors.test.mjs`
- The router's new git calls use only `rev-parse`, `merge-base` and `log` (the command prints nothing; re-run as 6.15): `! git diff "$(git merge-base main HEAD)" HEAD -- skills/10x-pipeline/scripts/route.mjs | grep -E '^\+.*(runGit|gitOut)\(\[' | grep -vE '"(rev-parse|merge-base|log)"'`
- A commit that touches only `plan.md` or the change folder is no evidence, and an entry with no `before.head` is treated like a null head: `node --test --test-name-pattern "strict verify rejects forged evidence" skills/10x-pipeline/test/executors.test.mjs`
- A strict step that ticked rows without evidence records them as `uncommitted`: `node --test --test-name-pattern "strict failure records uncommitted" skills/10x-pipeline/test/executors.test.mjs`

#### Manual Verification:

- A reviewer confirms by reading the diff that the router's git use in this phase is limited to `rev-parse`, `cat-file` and `merge-base --is-ancestor`, and that `readPlan` kept every existing field type.

Note on row 1.10: the title is review-immutable and now names `cat-file`, which the final design does not use; the mechanical gate is row 1.11 (allowed subcommands: `rev-parse`, `merge-base`, `log`). The reviewer reads the diff against the list in this section.

**Implementation Note**: After this phase and its automated checks pass, pause for confirmation before Phase 2. Checkboxes for these items live in `## Progress`.

---

## Phase 2: Phase list routing with `/10x-e2e`, segments and the retry

### Overview

Pick the executor per phase for e2e, build segments, meter them in the extra-step pool, re-open uncommitted rows, wire prompts and tier handling. Only e2e and goal-implement exist here; tdd arrives in Phase 3.

### Changes Required:

#### 1. Policy and prompts

**File**: `skills/10x-pipeline/policy.json`, `skills/10x-pipeline/prompts/executor-e2e.md`, `skills/10x-pipeline/prompts/executor-retry.md`, `skills/10x-pipeline/prompts/README.md`

**Intent**: Data for the e2e executor, the pool and the retry, and rule-form prompts that answer every interactive gate of `/10x-e2e` so a subagent never waits.

**Contract**: `executors` gains `segment: { template: "implement-segment" }`, `retry: { template: "implement-retry" }` and `e2e: { template, minRigor: "lean", setup: { file: "context/foundation/test-stack.md", section: "## E2E", fields: ["config", "seed"] }, rowWords: ["playwright", "e2e", "end-to-end", "browser"] }`. The `extraSteps` group is added as specified in "Implementation Approach". Prompts `implement-e2e`, `implement-segment` and `implement-retry` are arrays: a first line (`Run /10x-e2e {id} phase {phase}` / `Run /10x-goal-implement {id} phase {phase}` for both goal-implement templates) and, for e2e and retry, `@prompts/executor-e2e.md` / `@prompts/executor-retry.md`. The e2e file holds GIVEN/WHEN/THEN rules (one bold keyword each, ADR-004) for: stop after phase `{lastPhase}` by taking the "stop here" option of the next-phase question; never choose "Skip - already done"; the manual confirmation gate counts as confirmed, Manual rows are listed in the reply and never ticked; commit message approved as proposed; dirty paths commit only the planned set; setup missing, feature not built or a non-browser risk ends `blocked` with no `signals.needsHuman`; a spec that already passes ends `blocked` instead of ticking rows without a commit; an ambiguous gate takes the recommended option or ends `blocked`; no question that waits for a reply. The segment prompt tells goal-implement to stop after phase `{lastPhase}`. The retry file holds: the rows `{retry}` are ticked in `plan.md` without a commit, so set each back to `[ ]` before any work; do the work, commit it and write the SHA; stop after phase `{lastPhase}`; never tick a row for work that was not done; a phase with nothing left to change ends `blocked` with the reason (a retry that finds no diff fails loudly and halts after three attempts: the residual of Assumption 4). The README table lists both files under "Wired".

#### 2. Selection, pool and retry

**File**: `skills/10x-pipeline/scripts/route.mjs` (new section after `replanNext`; one `PREDICATES` entry; the implement branch of `decide()`)

**Intent**: Choose the executor per pending phase, meter extra steps, and re-open uncommitted rows.

**Contract**:

- `PREDICATES.e2eSetup` reads `policy.executors.e2e.setup`: file exists, take lines from the section heading to the next `## `, parse `- config:` and `- seed:` (path is the text up to the first ` — `, backticks stripped). A path is accepted only when it is relative, has no `..` segment, resolves under `ROOT`, and `path.resolve(ROOT, p)` starts with `ROOT + path.sep` and exists. An absolute or escaping path is no hit. Anything missing is no hit.
- `extrasLeft(log, policy, level)` = `extraSteps.allowance[level]` (0 when missing or not an integer) minus the sum of `extraSteps.cost[e.template]` over executed entries.
- A phase is pending when it has at least one Automated `[ ]` row. `e2eWanted(phase)` is true when the rigor gate is open, `e2eSetup` hits and `goalPhrase` over the phase name and the pending Automated row texts finds a `rowWords` entry.
- `executorExcluded(log, phase, executor)` is true when an executed entry has that `executor`, covers the phase (`phase <= n <= lastPhase`) and has `fallback` or `ok === false`.
- `retryRows(log, plan)`: the latest executed `implement` entry's `uncommitted` ids that are still done in `plan`; empty when a later `implement` entry exists or the entry has none.
- `executorNext(plan, log, policy, ctx, bumpInfo)` returns `null` when no pending phase wants a special executor, or when the pool cannot pay for the route: the steps needed are 1 when the first pending phase wants a special executor and 2 when a goal segment must precede the first special phase, and `extrasLeft` must cover that many costs. Then the caller returns the plain step as today, so a run never starts a goal segment it cannot follow with the executor that justified it. Otherwise it returns `{ step: "implement", template, phase, lastPhase, executor, skill, interactive, bump, reason }`. The segment starts at the first pending phase and extends over following pending phases that choose the same executor; a goal-implement segment ends before the next phase that wants another executor. `interactive` is true for e2e. `bump` and `reason` carry what the implement branch already computed.
- `retryNext(...)` returns `{ step: "implement", template: "implement-retry", phase, lastPhase, retry, executor: "goal", bump, reason }`, where `phase` and `lastPhase` are the lowest and highest phase of the `retry` ids (looked up in `phaseList`). The retry costs nothing from the pool and is not subject to `executorExcluded`.
- `decide()` implement branch: the branch opens when `plan.autoPending > 0` or `retryRows(...)` is not empty. Order inside: (Phase 4 adds the failure re-plan first), `retryNext` when `retryRows` is not empty, else `executorNext`, else the existing plain object. Nothing else in `decide()` changes in this phase.
- `next()` entry for a retry step stores `retry: [ids]`. `tierFor`: `if (s.interactive || d.interactive)` at the effort-floor test (`:1048`).
- `next()`: render vars `{phase}`, `{lastPhase}` and `{retry}` (empty for plain steps; `{retry}` is the ids joined by `, `); the entry gains `phase`, `lastPhase`, `executor` when set, and `skill: d.skill ?? policy.steps[d.step].skill`.

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
- With every Automated row ticked by a Skip flip and the last `implement` entry `ok:false` with `uncommitted` ids, the next step is `implement-retry`, not `impl-review`; the retry prompt names the rows; a retry with a code commit is `ok`, one without fails and the next attempt is one tier higher: `node --test --test-name-pattern "retry after uncommitted ticks" skills/10x-pipeline/test/executors.test.mjs`
- The retry prompt tells the subagent to set the named rows back to `[ ]` first and never to tick unfinished work: `node --test --test-name-pattern "retry prompt rules" skills/10x-pipeline/test/executors.test.mjs`
- With the extra-step pool spent, or too small to follow a goal segment with its special executor, the router returns plain `implement`: `node --test --test-name-pattern "extra steps pool" skills/10x-pipeline/test/executors.test.mjs`
- At `lean` a plan with e2e rows and a valid setup still gets the plain `implement` prompt, the lean budget stays 10 and a `lean` walk is the same as without the feature: `node --test --test-name-pattern "lean keeps plain implement" skills/10x-pipeline/test/executors.test.mjs`
- `e2eSetup` rejects an absolute path, a `..` path and a symlink that leaves the root: `node --test --test-name-pattern "e2e setup path containment" skills/10x-pipeline/test/executors.test.mjs`
- A plan whose Progress headings are not `### Phase N` stays on plain `implement`: `node --test --test-name-pattern "no phase list stays plain" skills/10x-pipeline/test/executors.test.mjs`

#### Manual Verification:

- Run `/10x-e2e` unattended in a scratch project with Playwright set up (`/10x-e2e-setup` done) and a two-phase plan whose phase 2 is browser-level, through the router: the e2e step stops after its phase, never picks "Skip", ends `done` with a new commit, or ends `blocked` without a question left waiting. Record the result in the Progress row. Also run a goal-implement segment on a two-phase plan and note whether it stops after its `{lastPhase}`; a segment that runs later phases itself means the e2e step never runs, and the note is the evidence for the owner.

**Implementation Note**: After this phase and its automated checks pass, pause for confirmation before Phase 3.

---

## Phase 3: `/10x-tdd` for pure-logic phases at thorough

### Overview

Add the tdd executor on the Phase 2 rails, gated at rigor `thorough` and by a deterministic pure-logic predicate. It spends from the same pool.

### Changes Required:

#### 1. Policy and prompt

**File**: `skills/10x-pipeline/policy.json`, `skills/10x-pipeline/prompts/executor-tdd.md`, `skills/10x-pipeline/prompts/README.md`

**Intent**: Data for the tdd executor and a rule-form prompt for every interactive gate of `/10x-tdd`.

**Contract**: `executors.tdd` holds `template: "implement-tdd"`, `minRigor: "thorough"`, `codeExtensions` (`.mjs .js .ts .tsx .py .go .rs`), `excludeGlobs` (config, docs, CI, lockfiles, same shape as `risk.churn.exclude`), `testWords` (`test`, `vitest`, `jest`, `pytest`) and `uiWords` (`page`, `screen`, `click`, `css`, `visual`, plus the e2e `rowWords`). Prompt `implement-tdd` is an array with `Run /10x-tdd {id} phase {phase}` and `@prompts/executor-tdd.md`. The file repeats the e2e rule set adapted to `/10x-tdd` (stop after `{lastPhase}`, never Skip, manual gate confirmed and not ticked, commit message approved, dirty paths, ambiguous gate) and adds: an implementation that already exists, a missing test runner or a misfit phase ends `blocked` with no `signals.needsHuman`.

#### 2. Predicate and per-phase files

**File**: `skills/10x-pipeline/scripts/route.mjs` (new section)

**Intent**: Decide "pure logic" from data already on disk, conservatively.

**Contract**: `phaseFiles(planFile)` reads the descriptive `## Phase N:` or `## Faza N:` blocks and returns the paths of their `**File**:` and `**Files**:` lines (reuse `normalizePlanPath`). `pureLogicPhase(phase, files, ctx, policy)` is true when all hold: level at or above `executors.tdd.minRigor`; the phase has no done Automated row; `files` is non-empty, every path has a `codeExtensions` extension and none matches `excludeGlobs`; every pending Automated row text has a backtick token containing a `testWords` entry and no `uiWords` entry. E2E wins: `executorNext` asks `e2eWanted` first, then tdd, and skips either when `executorExcluded`. A tdd segment extends over following pending phases that choose tdd. `interactive` is true. The pool rule of Phase 2 applies unchanged (cost of `implement-tdd` is 1).

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

One shared re-plan per run: after two trailing implement failures, or on a `REJECTED` that comes before any `fix`, run a `plan` step with the failure or review as input. Both triggers need rigor `standard` or higher. The REJECTED re-plan spends 2 from the extra-step pool and one of the fix loops.

### Changes Required:

#### 1. Policy and prompts

**File**: `skills/10x-pipeline/policy.json`

**Intent**: Knobs and prompts for the two re-plan templates.

**Contract**: `codeReplan` group as specified in "Implementation Approach". Prompts `plan-replan` (variables `{id}`, `{failure}`) and `plan-rejected` (`{id}`, `{verdict}`): arrays of an intro line plus rules: revise `context/changes/{id}/plan.md` for the failure note or the findings in `reviews/impl-review.md`; never untick, rename or renumber a ticked row; add rows with the next free index; keep at least one pending Automated row; keep the `## Progress` contract. The `plan-revise` authority and artifacts variables are not used.

#### 2. Selection and verification

**File**: `skills/10x-pipeline/scripts/route.mjs` (new function below `replanNext`; two call sites in `decide()`; `attachResult`; `next()` render vars)

**Intent**: Trigger the re-plan, verify it, and keep the existing fallbacks.

**Contract**:

- `codeReplanNext(kind, log, policy, ctx, extra)` returns `null` or `{ step: "plan", template, bump, verdict?, failure?, reason }`. It returns `null` below `codeReplan.minRigor`. Counter: executed entries with template `plan-replan` or `plan-rejected`; at or above `codeReplan.max` it returns `null`.
- Failure trigger: at the top of the implement branch, `trailingFailures(log, "implement") === codeReplan.afterFailures` (equality, not `>=`). The `{failure}` text is the last implement entry's `result.note` with whitespace collapsed to one line and cut to `failureNoteMax` characters. The failure re-plan spends nothing from the pool; it is a failure path.
- REJECTED trigger: in the `needsFix` block, before the fix-loop halt check, when `ir.verdict === "REJECTED"`, `codeReplan.onRejected` is true, `count("fix") <= codeReplan.rejectedMaxFixes` (so only a review that comes before any `fix`), and `extrasLeft >= extraSteps.cost["plan-rejected"]`. A `null` result falls through to `fix` as today. A `REJECTED` that follows a `fix` keeps today's path.
- The fix-loop halt counts `count("fix") + count("plan-rejected")` against `limits.maxFixLoops`, so a REJECTED re-plan leaves one fix loop. This is the only edit to the existing halt line.
- A failed `plan-replan` entry (last executed entry) halts with a reason that names the failure count and says a human is needed. A failed `plan-rejected` entry falls through to `fix`.
- `attachResult` `case "plan"` keyed on the entry template: for `plan-replan` and `plan-rejected`, `plan.hasProgress && mtime > startedAt && plan.autoPending > 0 && before.done` is a subset of the current done ids. `next()` passes `{failure}` to `render`. For `plan-replan` entries `before.done` is recorded like for strict templates.
- `tierFor` needs no change: step `plan` base plus `d.bump`.

#### 3. Tests and docs line

**File**: `skills/10x-pipeline/test/loops.test.mjs` (the `rejected` block at lines 30-34 only), `skills/10x-pipeline/SKILL.md` (bullet at line 112 only)

**Intent**: Keep the one existing test that the new behavior intentionally changes, and the documented rule, honest.

**Contract**: This is the complete list of existing test edits in this change. The prototype run found no other failure.

| Existing test | Why it is unaffected or how it is edited |
| --- | --- |
| `loops.test.mjs:30-34` (`rejected` block, REJECTED as the first review at `--rigor standard`) | Edited. It now expects step `plan`, entry template `plan-rejected`, entry verdict `REJECTED`. A second project in the same block has a log that already holds an executed `plan-rejected` entry (plan, plan-review, implement, impl-review, plan-rejected, plan-review, implement, impl-review) and a `REJECTED` review: it expects step `fix` with verdict `REJECTED`, as the old assertion did. Nothing else in that test changes. |
| `loops.test.mjs:441-497` (`IMPL` and the three reference paths) | Unedited. Their `REJECTED` is the second review, after a `fix`, so `count("fix") <= rejectedMaxFixes` fails and the path stays `fix`. They have no pending Manual row that is command-checkable (`planText` writes "Look at it"), so no `manual-verify` step appears, and no e2e setup, so no segment appears. Their step counts and `assertFits` stay valid; the budget they check is the new one (standard 16, thorough 21), and the 12 and 16 step paths still leave two spare. |
| `route.test.mjs:195-199` (impl-review floor, `planText({done:1})`) | Unedited. The Manual row "Look at it" is not command-checkable, so `impl-review` stays first. |
| `route.test.mjs:386-400` (three failed implements halt) | Unedited. The re-plan fires at exactly two trailing failures; the fixture jumps to three. |
| `loops-existing.test.mjs`, `compare.test.mjs`, `helpers.mjs` | Unedited; a diff gate in Phase 6 proves it. |

The SKILL bullet says `REJECTED` before any `fix` re-plans once per run (at the plan tier +1, rigor `standard` or higher, when the extra-step pool allows), otherwise `fix` at the last code tier +1. Full docs follow in Phase 6.

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
- Full suite passes; the only existing test file changed since `main` is `loops.test.mjs`, in a single hunk (listed in section 3): `node --test skills/10x-pipeline/test/*.test.mjs && test "$(git diff --name-only "$(git merge-base main HEAD)" HEAD -- skills/10x-pipeline/test | grep -vE 'test/(executors|codereplan|manualverify|budget-executors)\.test\.mjs|test/phase-helpers\.mjs')" = "skills/10x-pipeline/test/loops.test.mjs" && test "$(git diff -U0 "$(git merge-base main HEAD)" HEAD -- skills/10x-pipeline/test/loops.test.mjs | grep -c '^@@')" = 1`
- A REJECTED after a `fix` keeps `fix`, a REJECTED re-plan leaves one fix loop, and it needs rigor `standard` or more and enough extra-step pool (at `lean` or with the pool spent it falls to `fix`): `node --test --test-name-pattern "rejected replan gates" skills/10x-pipeline/test/codereplan.test.mjs`
- The `{failure}` text in the `plan-replan` prompt is one line of at most `failureNoteMax` characters: `node --test --test-name-pattern "failure note capped" skills/10x-pipeline/test/codereplan.test.mjs`

#### Manual Verification:

- A reviewer reads the `plan-replan` and `plan-rejected` prompts and confirms that each rule can be followed by a subagent that cannot ask questions.

**Implementation Note**: After this phase and its automated checks pass, pause for confirmation before Phase 5.

---

## Phase 5: `manual-verify` step and `--chrome`

### Overview

A new step before the first impl-review pass ticks the command-checkable Manual rows it can prove, with an evidence file the router checks. `init --chrome` stores a flag, adds browser rows to the eligible set and selects a prompt that allows Claude-in-Chrome. This answers the owner's evidence question: yes, the router checks that the evidence file exists.

### Changes Required:

#### 1. Policy and prompts

**File**: `skills/10x-pipeline/policy.json`, `skills/10x-pipeline/prompts/manual-verify.md`, `skills/10x-pipeline/prompts/README.md`

**Intent**: A step entry, a gate block and two rule-form prompts.

**Contract**: `steps["manual-verify"]`: `skill: null`, `baseTier` 3, `minTier` 2, `maxTier` 5. `manualVerify`: `minRigor` `standard`, `maxRuns` 1, `maxAttempts` 2, `commandWords` (`node`, `npm`, `npx`, `pnpm`, `yarn`, `make`, `grep`, `git`, `curl`, `diff`, `test`, `ls`, `cat`, `sh`, `bash`, `python`, `python3`), `humanWords` (`reviewer`, `human`, `person`, `owner`, `reads`, `reading`, `judge`, `looks`), `browserWords` (`browser`, `page`, `click`, `screen`, `chrome`, `dom`). The lists are uncalibrated like the churn parameters. Prompts `manual-verify` (an intro line that carries `{unproven}`, then `@prompts/manual-verify.md`) and `manual-verify-chrome` (same file plus one extra rule). The shared file holds rules: tick a Manual row only after running a check that proves it, only when the row names a backticked command; never tick a row that asks a person to read, judge or confirm something; save the command output to `context/changes/{id}/evidence/<name>` (not empty, under 1 MB) and append ` — evidence: evidence/<name>` to the row; never edit a row title, an Automated row or a SHA suffix; a row listed in `{unproven}` was rejected last time, so add valid evidence or set it back to `[ ]`; end `done` even when nothing was ticked. The Chrome rule: load the `mcp__claude-in-chrome__*` tools with ToolSearch, use them only for rows that need a browser, save the screenshot or GIF under `context/changes/{id}/evidence/`, and end `done` with those rows unticked when the tools are unavailable or the extension is not connected.

#### 2. Eligibility, selection and verification

**File**: `skills/10x-pipeline/scripts/route.mjs` (new function below `replanNext`; one call site in `decide()`; `attachResult`; `next()`; `init`; `main()` usage string)

**Intent**: Place and verify the step without disturbing the impl-review freshness logic, and never let it certify its own judgment.

**Contract**:

- `manualEligible(row, meta, policy)`: a pending Manual row is eligible when it has no `humanWords` entry (word-start match like `goalPhrase`) and either holds a backtick span whose first word is in `commandWords`, or `meta.chrome === true` and its text has a `browserWords` entry. Every other row stays in `manualPending` and is never ticked by this step. The plan "marks a row as command-checkable" by writing the command in backticks.
- `manualVerifyNext(plan, log, policy, ctx, meta)` returns `null` or `{ step: "manual-verify", template, bump: 0, reason }`. Conditions: no pending Automated row, at least one eligible pending Manual row, level at or above `manualVerify.minRigor`, executed ok `manual-verify` entries below `maxRuns`, executed `manual-verify` entries (any outcome) below `maxAttempts`, and `extrasLeft >= extraSteps.cost["manual-verify"]`. Template is `manual-verify-chrome` when `meta.chrome === true`. The prompt variable `{unproven}` is the `unproven` ids of the previous attempt, or `none`. Call site: in `decide()` inside the `!irFresh` block, before the impl-review return. Because `lcode` ignores `manual-verify`, the impl-review stays stale and runs next.
- `next()`: the `manual-verify` entry `before` gains `manual` (array of `{id, text, done}` for Manual rows).
- `attachResult` `case "manual-verify"`: the baseline is `before.manual` of the first entry of the trailing streak of `manual-verify` entries, so a tick left by a failed first attempt is judged again by the retry and never becomes the baseline. The step is verified when: no Automated row changed state or text; every baseline Manual row keeps its title (text with a trailing evidence suffix removed equals the baseline text); no row went from done to pending; and every row ticked since the baseline is eligible (by its baseline text) and ends with ` — evidence: <token>` where `<token>` is `evidence/` plus one or more path segments of `[A-Za-z0-9._-]`, has no `..`, and names a file that exists under `context/changes/<id>/`, is not empty, and whose `fs.realpathSync` lies under the real path of `context/changes/<id>/evidence`. Zero ticks is verified. The SHA suffix regex stays distinct. The entry records `ticked` (ids that passed) and `unproven` (ids that did not). Inside the case: `last.fallback = true` when the step is not `ok`, so a failed `manual-verify` is neutral: no failure count, no tier bump, no rigor rise. After `maxAttempts` the run goes on to impl-review whatever the state.
- `decide()` `done` return gains `manualUnproven` (the `unproven` ids of the last `manual-verify` entry when it failed and its rows are still ticked), only when not empty. `status` steps gain `ticked` and `unproven` counts for `manual-verify` entries.
- `init`: `--chrome` stores `meta.chrome = true`; `--chrome true`, `--chrome false` as for `--archive`; any other value halts with a usage message; a resume keeps the stored value. The `main()` usage string gains `[--chrome]`. `--chrome` at `lean` is stored and has no effect (the pool is 0).
- `SKILL.md` Start step 1 and `argument-hint`: parse `--chrome`, remove it from the goal text, pass it to `init` only when given. The final message also lists `manualUnproven` when present. README arguments line gets `[--chrome]` in Phase 6.

### Success Criteria:

#### Automated Verification:

- The step runs once before the first impl-review when an eligible Manual row is pending at standard, and not at lean: `node --test --test-name-pattern "manual verify placement" skills/10x-pipeline/test/manualverify.test.mjs`
- It does not run when no eligible Manual row is pending, or after an ok run (`maxRuns`): `node --test --test-name-pattern "manual verify not repeated" skills/10x-pipeline/test/manualverify.test.mjs`
- Impl-review runs right after it and a `fix` does not trigger a second run: `node --test --test-name-pattern "manual verify before impl review" skills/10x-pipeline/test/manualverify.test.mjs`
- A ticked row whose suffix names an existing, non-empty `evidence/<name>` file verifies; no suffix, a missing or empty file, a `..` or absolute name, or a symlink out of the evidence folder makes the step `ok: false`: `node --test --test-name-pattern "evidence suffix required" skills/10x-pipeline/test/manualverify.test.mjs`
- Zero ticks is `ok: true`: `node --test --test-name-pattern "zero ticks is done" skills/10x-pipeline/test/manualverify.test.mjs`
- Editing an Automated row, a title or a SHA suffix, or unticking a row, makes the step unverified: `node --test --test-name-pattern "manual verify guards plan edits" skills/10x-pipeline/test/manualverify.test.mjs`
- `init --chrome` stores `chrome: true`, a resume keeps it, `--chrome false` clears it, and the chrome template is chosen from it: `node --test --test-name-pattern "chrome flag" skills/10x-pipeline/test/manualverify.test.mjs`
- Rendered prompts name the evidence directory and the evidence suffix; the chrome prompt adds the ToolSearch rule and the unavailable fallback: `node --test --test-name-pattern "manual verify prompts" skills/10x-pipeline/test/manualverify.test.mjs`
- Prompt rule form and wiring tests pass: `node --test skills/10x-pipeline/test/rules.test.mjs skills/10x-pipeline/test/preplan.test.mjs`
- Full suite passes; no existing test file was edited in this phase (same diff gate as 4.10): `node --test skills/10x-pipeline/test/*.test.mjs && test "$(git diff --name-only "$(git merge-base main HEAD)" HEAD -- skills/10x-pipeline/test | grep -vE 'test/(executors|codereplan|manualverify|budget-executors)\.test\.mjs|test/phase-helpers\.mjs')" = "skills/10x-pipeline/test/loops.test.mjs"`
- Only rows with a backticked command (or, with `--chrome`, a browser word) are eligible, and a row with a human word never is: `node --test --test-name-pattern "manual verify eligible rows" skills/10x-pipeline/test/manualverify.test.mjs`
- A first attempt that leaves a bad tick is judged again by the retry against the first-attempt baseline; a failed attempt is neutral (no failure count, no rigor rise), the run goes on to impl-review after `maxAttempts`, and `done` lists `manualUnproven`: `node --test --test-name-pattern "manual verify retry baseline" skills/10x-pipeline/test/manualverify.test.mjs`
- `--chrome foo` halts with a usage message: `node --test --test-name-pattern "chrome flag value" skills/10x-pipeline/test/manualverify.test.mjs`

#### Manual Verification:

- Run a router-driven `manual-verify` step with `--chrome` on a scratch plan with one browser-checkable Manual row and a connected Chrome extension: confirm the subagent loads the Chrome tools, ticks the row with an evidence suffix and a file under `context/changes/<id>/evidence/`. Record the outcome in the Progress row.
- Run the same step with no Chrome extension connected: confirm it ends `done` with zero ticks and no hang.
- Run a router-driven `manual-verify` step without `--chrome` on a plan whose Manual row a shell command can prove (the row names the command in backticks): confirm one tick with an evidence suffix and that a row needing a person stays pending.

**Implementation Note**: After this phase and its automated checks pass, pause for confirmation before Phase 6.

---

## Phase 6: Budget from the longest legal path, report label, docs and scope gates

### Overview

Set `rigor.budgetDelta` to the smallest values at which the longest legal path of each level fits with one failed step to spare, prove it with a test, show a fallback as `fallback` in the report and in `compare`, update every document the tier logic touches, and add the mechanical gates for every "untouched" claim.

### Changes Required:

#### 1. Budget and reference-path test

**File**: `skills/10x-pipeline/policy.json` (`rigor.budgetDelta` values only), `skills/10x-pipeline/test/budget-executors.test.mjs`

**Intent**: The longest legal path under the shipped pool completes, and the delta is the smallest that fits.

**Contract**: The test walks the paths below with the walker pattern of `loops.test.mjs` (`answer`/`walk`), asserts `steps <= budget - 2` for each (the rule the existing reference paths use), and derives the needed delta from the longest walked path so a future cap change fails loudly: `needed = max(steps) + 2 - maxTotalSteps` must equal the shipped delta, and `delta - 1` would not fit. The pool is the only cap that matters for the sum, because every metered feature spends from it: a run cannot stack segments, `manual-verify` and a REJECTED re-plan beyond the allowance.

Longest legal paths (failure-free, executed steps), with `maxTotalSteps` 14:

| Level | Path | Steps |
| --- | --- | --- |
| standard (allowance 2) | plan loop: plan, review, revise, review, revise, review = 6; mixed plan: `implement-segment`, `implement-e2e`, plain tail = 3; impl-review, fix, impl-review, fix, impl-review = 5 | 14 |
| standard | 6 + e2e step, plain tail = 2 + `manual-verify` 1 + 5 | 14 |
| standard | plan loop 6 + implement 1 + impl-review (REJECTED) 1 + `plan-rejected`, plan-review, implement 3 + impl-review, fix, impl-review 3 (one fix loop left) | 14 |
| thorough (allowance 3) | 3 pre-plan (research, domain-acl, frame) + plan, review, frame-rethink, revise, review, revise, review = 7 (10); then segment, e2e, tdd, plain tail = 4, or segment, e2e, plain tail, `manual-verify` = 4; then 5 | 19 |
| thorough | 10 + implement + `manual-verify` + impl-review (REJECTED) + `plan-rejected`, plan-review, implement + impl-review, fix, impl-review | 19 |
| thorough | 10 + segment, plain tail + impl-review (REJECTED) + `plan-rejected`, plan-review, implement + impl-review, fix, impl-review | 19 |
| lean (allowance 0) | unchanged: the pool is empty, no extra step exists | as today |

Budgets are `14 + delta`: `standard: 2` gives 16 (path 14 plus two spare), `thorough: 7` gives 21 (path 19 plus two spare), `lean` stays -4 (10). Today's values are 0 and 4, so the rise is +2 and +3. The standard row of 14 shows why the pool is shared: segments alone (2), or one segment plus `manual-verify`, or the REJECTED re-plan (cost 2) each use the whole allowance, so the three cannot add up. Without the pool the same features would sum to 17 at standard and 21 at thorough (review F5).

Failure paths are not part of the reference set (stacked with a maxed plan loop they end in `Step budget spent` by design, as they do today). One is proved to fit at standard: plan, plan-review (2), implement failed twice (4), `plan-replan`, plan-review (6), implement (7), `manual-verify` (8), impl-review, fix, impl-review (11), within the budget of 16. The test asserts that 11-step path, and that a stacked failure path halts with `Step budget spent` and never exceeds the budget.

#### 2. Report label and compare count

**File**: `skills/10x-pipeline/scripts/route.mjs` (`buildReport` rows map only; `readSide` in `compare`), `skills/10x-pipeline/test/executors.test.mjs`

**Intent**: A neutral fallback reads as `fallback`, not `failed`, and an executor segment reads as its template.

**Contract**: In the `rows` map: Result is `ok`, `fallback` (entry has `fallback`) or `failed`; the Step cell is `implement (<template>)` when the step is `implement` and the template differs, else the step. `readSide` counts `failedAttempts` as `e.ok === false && !e.fallback`. Nothing else in `buildReport` changes. The `compare` token completeness rule is unchanged (a fallback step without a token figure still makes its side not comparable). The prototype run showed no existing report test depends on either label.

#### 3. Documents

**File**: `docs/ADR/ADR-003-rigor-gated-routing.md`, `skills/10x-pipeline/SKILL.md`, `README.md`, `AGENTS.md`, `skills/10x-pipeline/prompts/README.md`

**Intent**: Record the decisions and keep docs aligned with the router (AGENTS.md hard rule on tier logic).

**Contract**:

- ADR-003: part table row for `phase-executors` becomes `implemented`; new section "Phase executors and manual verification" (new bullets and tables) with the executor choice, segments and the extra-step pool, strict verification and its residual risk, the retry of uncommitted rows, fallback semantics, code re-plans (first-review-only and the fix-loop cost), `manual-verify` (eligible rows, evidence file check, neutral failure), `--chrome`, the budget table with the paths above and the arithmetic, and an assumptions table with reversal costs (the list in this plan). Rule lines in the ADR keep the GIVEN/WHEN/THEN form (`rules.test.mjs` checks them). No ADR-006: this extends the ADR-003 decision, which already lists the part. The ADR records the baseline gap (Assumption 14) and that the report cannot say which executor ran after archive beyond the Step cell.
- `SKILL.md` "How the tier moves": new bullets for executors, segments and the pool, the fallback (no bump, no rigor rise), the commit check for tdd, e2e and the retry, the code re-plan, `manual-verify`; the failure definition bullet notes the commit check. Start step 1 and `argument-hint` mention `--chrome` (done in Phase 5; verify only). No model or tier names beyond what it documents.
- `README.md`: arguments line `[--chrome]`, routing bullets for the same items, a "Phase executors" subsection, the budget lines (reference worst paths per level, the old advice to raise `budgetDelta.standard` to 1 updated), Limits note on Chrome in a subagent, and a Baseline comparison note: the baseline arm runs the same defaults, so for a routing-only comparison add `{"extraSteps": {"allowance": {"lean": 0, "standard": 0, "thorough": 0}}}` to the baseline override by hand (`baseline-policy.json` itself is not changed, because `compare.test.mjs` pins its keys).
- `AGENTS.md`: project-structure lines for the four new test files, `phase-helpers.mjs` and the new prompt files; command list gets `init ... [--chrome]`.

#### 4. Scope gates

**File**: Progress rows 6.13-6.16 and 6.18-6.20

**Intent**: Every "untouched" claim in "What We're NOT Doing" has a command that compares against `git merge-base main HEAD`, never `HEAD~`.

### Success Criteria:

#### Automated Verification:

- The standard and thorough longest paths fit, and the delta is the smallest that fits: `node --test --test-name-pattern "longest legal path" skills/10x-pipeline/test/budget-executors.test.mjs`
- The failure re-plan path fits: `node --test --test-name-pattern "failure path fits" skills/10x-pipeline/test/budget-executors.test.mjs`
- Existing reference paths pass with only the Phase 4 edit, and the frozen loop tests are byte-identical to `main`: `node --test skills/10x-pipeline/test/loops.test.mjs skills/10x-pipeline/test/loops-existing.test.mjs && git diff --quiet "$(git merge-base main HEAD)" HEAD -- skills/10x-pipeline/test/loops-existing.test.mjs`
- ADR rule lines keep the rule form: `node --test --test-name-pattern "ADR" skills/10x-pipeline/test/rules.test.mjs`
- ADR-003 marks the part implemented and has the new section: `grep -c "phase-executors.*implemented" docs/ADR/ADR-003-rigor-gated-routing.md`
- `SKILL.md` and `README.md` each document `--chrome`, `manual-verify`, `plan-replan` and `plan-rejected` (the command names the first missing word): `for f in skills/10x-pipeline/SKILL.md README.md; do for w in "--chrome" "manual-verify" "plan-replan" "plan-rejected"; do grep -qF -e "$w" "$f" || { echo "$f: $w"; exit 1; }; done; done`
- `SKILL.md` names no model: `! grep -iE "opus|sonnet|haiku" skills/10x-pipeline/SKILL.md`
- `AGENTS.md` lists the new test files: `grep -c "executors.test.mjs" AGENTS.md`
- Full suite passes, on Node 18 when it is installed (`fnm exec --using=18 node --test skills/10x-pipeline/test/*.test.mjs`) and on the installed Node otherwise, and the Node 18 ban list finds nothing (record `node --version` in the row): `node --test skills/10x-pipeline/test/*.test.mjs && ! grep -nE 'toSorted|Object\.groupBy|import\.meta\.dirname|\.intersection\(|\.union\(|partialDeepStrictEqual|mock\.timers' skills/10x-pipeline/scripts/route.mjs skills/10x-pipeline/test/*.mjs`
- `init` and `status` against a scratch change folder print valid JSON: `node --test --test-name-pattern "executors smoke" skills/10x-pipeline/test/executors.test.mjs`
- The frozen files are untouched since `main`: `git diff --quiet "$(git merge-base main HEAD)" HEAD -- skills/10x-pipeline/test/loops-existing.test.mjs skills/10x-pipeline/test/compare.test.mjs skills/10x-pipeline/test/helpers.mjs skills/10x-pipeline/baseline-policy.json`
- The only existing test file changed since `main` is `loops.test.mjs`: `test "$(git diff --name-only "$(git merge-base main HEAD)" HEAD -- skills/10x-pipeline/test | grep -vE 'test/(executors|codereplan|manualverify|budget-executors)\.test\.mjs|test/phase-helpers\.mjs')" = "skills/10x-pipeline/test/loops.test.mjs"`
- The router's git calls added since `main` use only `rev-parse`, `merge-base` and `log` (prints nothing): `! git diff "$(git merge-base main HEAD)" HEAD -- skills/10x-pipeline/scripts/route.mjs | grep -E '^\+.*(runGit|gitOut)\(\[' | grep -vE '"(rev-parse|merge-base|log)"'`
- `cleanSignals`, `cleanUsage` and `prompts.suffix` are unchanged, and `buildReport` differs only in its Result and Step lines: the command in row 6.16 of `## Progress` (same text; it diffs the two function bodies against `git merge-base main HEAD`, counts changed `buildReport` lines outside the Result and Step lines, and compares `prompts.suffix` through `node -e`)
- A fallback entry reads `fallback` in the report and is not a `compare` failed attempt, and an executor segment shows its template in the Step cell: `node --test --test-name-pattern "report shows fallback" skills/10x-pipeline/test/executors.test.mjs`
- `lean` keeps today's budget and paths: a lean walk with e2e rows, a valid setup, an eligible Manual row and a first-review `REJECTED` has the same steps as a walk without them, and `budgetDelta.lean` is -4: `node --test --test-name-pattern "lean unchanged" skills/10x-pipeline/test/budget-executors.test.mjs`

#### Manual Verification:

- A reviewer reads ADR-003, `SKILL.md` and `README.md` side by side and confirms they describe the same executor, fallback, re-plan, manual-verify and budget rules.
- A full router-driven pipeline run on a scratch project (a mixed plan, `--chrome` off) ends `done` with the step log showing the segment templates and the `manual-verify` step. Record the step list in the Progress row.

**Implementation Note**: After this phase and its automated checks pass, run `/10x-impl-review` before archiving.

---

## Testing Strategy

### Unit Tests:

- All router behavior is tested black-box through the CLI in scratch projects (`helpers.mjs` plus `phase-helpers.mjs`), as the existing suite does. Git cases use the hermetic git helpers.
- Edge cases: Skip flip with and without a moved HEAD; a commit that touches only `plan.md`; a SHA suffix for an old commit; no git; a blocked executor with and without `needsHuman`; every row ticked by a Skip flip (the F2 case); exactly two versus three trailing failures; the shared re-plan cap across both triggers; a REJECTED after a fix; a Manual row ticked without a valid evidence file; a symlinked evidence file; zero ticks; an edited Automated row; the pool at 0, too small and exact.

### Integration Tests:

- `budget-executors.test.mjs` walks the longest legal paths through the whole router at each level and proves the budget delta.

### Manual Testing Steps:

1. Unattended `/10x-e2e` run in a scratch Playwright project, plus one goal-implement segment on a two-phase plan (Phase 2).
2. Unattended `/10x-tdd` run at `thorough` (Phase 3).
3. `manual-verify` with Chrome connected, with Chrome absent, and without `--chrome` (Phase 5).
4. A full mixed-plan pipeline run (Phase 6).

## Performance Considerations

`readPlan` runs several times per `next()`; the added list building is linear in rows. Plain steps add no git call. A strict or retry step costs one `git rev-parse HEAD` at start and, at verification, up to three read-only git calls (`merge-base`, `log`, and the existing helpers). No call when git is missing (null means count rule).

## Migration Notes

Additive log keys only (`before.head`, `before.done`, `before.manual`, `phase`, `lastPhase`, `executor`, `fallback`, `uncommitted`, `retry`, `ticked`, `unproven`), so `compare` (ADR-005) and old logs keep working. An in-flight run resumed on the new router keeps its plain `implement` entries; only new entries carry the keys, and an entry without `before.head` is treated like a null head. `meta.chrome` is optional. A project that overrides `rigor.budgetDelta` keeps its values; with a pool allowance above 0 and an old delta, the budget may halt a run that uses extras, and the ADR says so.

## Assumptions

Decided without a human. Each is also in the ADR-003 section (Phase 6) and is overridable in `context/foundation/agent-smith-policy.json` unless the cost says otherwise.

| # | Assumption | Evidence | Cost to reverse |
| --- | --- | --- | --- |
| 1 | `--chrome` is an `init` flag stored in `meta.json` like `--archive`. The orchestrator does not probe tools. Chrome use in a subagent cannot be tested unattended, so a Manual row covers it. | Research section 5: `parseFlags` is generic; `SKILL.md` `allowed-tools` lacks `ToolSearch`; a subagent saw the tools as deferred, no call was tested. | Low: remove the flag and the chrome template. |
| 2 | `manual-verify` runs from `standard`, once per run (`maxRuns` 1, at most `maxAttempts` 2 including one retry), before the first impl-review pass with an eligible Manual row pending. Zero ticks is `done`. A failed attempt is neutral and the run goes on. | Protects the `lean` budget and the halt rule; a counted failure would retry at higher tiers and raise rigor (research section 5; review F3). | Low: data (`minRigor`, `maxRuns`, `maxAttempts`). |
| 3 | A ticked Manual row carries ` — evidence: evidence/<name>` and the router checks that `context/changes/<id>/evidence/<name>` exists, is not empty and stays inside the evidence folder (no `..`, no absolute path, realpath check). Size (under 1 MB) is a prompt rule only. The content is not read: a file with junk text passes. Eligible rows are command-checkable rows (a backticked command, no human word) and, with `--chrome`, browser rows; the lists are uncalibrated. Unproven ticks are listed in `done` as `manualUnproven`, not undone. | Review F3; the archive commit takes only the change folder (research section 5). | Medium: reading or hashing evidence content, or an undo of ticks, needs the router to edit `plan.md`, which it never does. |
| 4 | The strict commit check applies to `implement-tdd`, `implement-e2e` and `implement-retry`. Plain `implement` and `implement-segment` keep the count check: `/10x-goal-implement`'s legitimate zero-diff phase ("had no diff to commit") makes any commit check a false failure. Residual risks: a goal-implement phase that ticks rows with no work passes until impl-review; a retry that finds nothing to commit fails three times and halts for a human (loud, accepted). | Research sections 1 and 2 (`10x-goal-implement/SKILL.md:209`, `10x-e2e/SKILL.md:171`); review F2. | Medium: a commit check on goal-implement plus a policy escape. |
| 5 | Commit evidence is a commit in `before.head..HEAD` that touched at least one path outside `context/changes/<id>/` (project-relative); a suffix SHA must be a prefix of such a commit. An amend or rebase of the old head, or a hook that rewrites commits, reads as a false failure and goes through the retry. A phase that legitimately changes only plan or docs files cannot use the tdd or e2e executors. | Review F4; read-only `log` and `merge-base`. | Low: one function. |
| 6 | The re-plan triggers at exactly two trailing implement failures (rigor `standard` or higher) or at a `REJECTED` impl-review that comes before any `fix` (`rejectedMaxFixes` 0, same rigor gate, pool cost 2), shares one cap of 1 per run, counts against the step budget, uses one of the `maxFixLoops`, and a failed failure-re-plan halts. A blocked tdd or e2e step falls back to goal-implement with no tier bump, no rigor rise and no `needsHuman`. A `REJECTED` after a `fix` keeps today's path (fix again). | Research sections 1, 4; `route.test.mjs:386-400`; the prototype run kept `loops.test.mjs:441-497` valid with this rule. | Low: data (`codeReplan`). Raising `rejectedMaxFixes` makes the three reference paths edit-worthy. |
| 7 | E2E has no rigor gate (`minRigor` `lean`) but needs extra-step allowance, which `lean` does not have, so `lean` runs no executor step; tdd is gated at `thorough`. | `change.md` scope; research section 6; review F5. | Low: data. |
| 8 | One extra-step pool replaces a per-feature cap: allowance lean 0, standard 2, thorough 3; costs segment, e2e, tdd and `manual-verify` 1 each, REJECTED re-plan 2. A goal segment that the pool cannot follow with its special executor is not started (plain `implement` runs the whole plan instead, so the e2e phase then runs under goal-implement). | Review F5 (owner default: delta at most +2 standard, +3 thorough). | Low: data. A larger pool needs a larger `budgetDelta`; the test derives the needed delta. |
| 9 | `rigor.budgetDelta` becomes standard 2 and thorough 7 (budgets 16 and 21); the longest legal path is 14 and 19 steps (Phase 6 table). Failure paths can still end in `Step budget spent`, as they do today. | Owner default; arithmetic in Phase 6. | Low: data. |
| 10 | A fallback entry is transparent to `trailingFailures`: it neither counts nor ends a streak. | Keeps a fallback from resetting a failure streak. | Low: one helper. |
| 11 | Row keywords, extension lists, test words, command words and human words are uncalibrated, like the churn parameters. A false e2e or tdd pick costs one fallback step; a false manual-verify pick costs one neutral step. | Research section 3 and 6. | Low: data. |
| 12 | Not verified by research or by this plan: a live tdd, e2e or goal-implement run, a real E2E project, any Chrome call, a goal-implement segment that stops after its `{lastPhase}`. The Manual rows cover them. | Research assumptions list. | n/a |
| 13 | Manual rows ticked before a `plan-rejected` re-plan describe the old code and are not repeated (`maxRuns` 1). A project whose Progress headings are not `### Phase N` gets no phase list and plain routing. `--chrome` at `lean` is stored and ignored. | Review F10. | Low. |
| 14 | `baseline-policy.json` is not changed: `compare.test.mjs:23` and `:28` pin its keys. The baseline arm therefore runs the new defaults (segments, `manual-verify`, re-plans) unless the user adds the allowance override by hand (README note). `compare` does not warn when the two arms differ in these features. The report after archive shows the executor only in the Step cell. | Review F9; frozen test. | Medium: edit `compare.test.mjs` and the baseline file together, or add a `compare` warning. |

## Review Response

Plan review v1 (2026-10-31, verdict REVISE: 2 critical, 5 warnings, 3 observations). Each finding was checked against the code on `phase-executors-plan-review` before a decision. Decisions are also recorded in `reviews/plan-review.md`.

| Finding | Decision | What changed |
| --- | --- | --- |
| F1 critical | Accepted | A prototype run on a scratch copy found one existing test that the new behavior breaks: `loops.test.mjs:16` (block at lines 30-34). The design keeps the other tests valid: a REJECTED re-plans only before any `fix`, and `manual-verify` needs a command-checkable row. Full edit list in Phase 4 section 3. Rows 4.10, 5.10, 6.3 reworded; `helpers.mjs` unchanged. |
| F2 critical | Accepted | A strict step that ticks rows without commit evidence records `uncommitted` ids; `decide()` returns `implement-retry` while those rows are still ticked, even with no pending Automated row. New prompt rules, tests 1.13, 2.13, 2.14. Fix A of the review, built on the segment machinery with the router never editing `plan.md`. |
| F3 warning | Accepted | Eligible-row rule, evidence file existence and containment, first-attempt baseline, neutral failure with one retry, `ticked`/`unproven` in the log, `manualUnproven` in `done`. Opt-in by `--chrome` was not taken: the eligibility rule removes the self-certification of human rows. Rows 5.2, 5.4 reworded, 5.14-5.17 added. |
| F4 warning | Accepted | `commitEvidence` needs a code commit in `before.head..HEAD`; SHA suffix is secondary; ids strip suffixes; null head handled with `== null`. Rows 1.5 reworded, 1.12 added. |
| F5 warning | Accepted | One extra-step pool replaces `maxSegments`; deltas 2 and 7 (rise +2 and +3); lean allowance 0. Longest paths and arithmetic in Phase 6; rows 6.1, 6.2 keep titles, 2.16 and 6.20 added. |
| F6 warning | Accepted | `context/foundation/roadmap.md` restored to `main` on this branch. |
| F7 warning | Accepted | Gate commands against `git merge-base main HEAD` for every "untouched" claim (rows 1.11, 4.10, 5.10, 6.3, 6.13-6.16), per-file keyword greps (6.6), Node 18 handling (6.9). |
| F8 observation | Accepted | `fallback` is set inside `case "implement"` and `case "manual-verify"`; the tail of `attachResult` is untouched. The touch-point list in "Implementation Approach" is now complete instead of "three call sites". |
| F9 observation | Accepted in part | (b) done: report shows `fallback` and the template, `compare` does not count a fallback as failed (Phase 6 section 2). (a) rejected as a code change: pinning the baseline needs edits to the frozen `compare.test.mjs`; recorded as Assumption 14 with a README note. |
| F10 observation | Accepted, one item rejected | Done: `e2eSetup` containment, `{failure}` cap and one-line, `evidenceDir` key dropped, `--chrome` value check and usage string, `Faza` headings stated, goal-implement stop-rule observation added to 2.12, `plan-rejected` and manual ticks stated (Assumption 13). Rejected: the "fallback loops forever" worry (the review itself shows it does not hold). |

Progress rows reworded (title changed because the old title would be false or unpassable): 1.5, 4.10, 5.2, 5.4, 5.10, 6.3, 6.6, 6.9. Row 1.10 keeps its title; its note in Phase 1 corrects the git subcommand list. New rows use the next free index in their phase, so no existing row was renumbered.

## References

- Related research: `context/changes/phase-executors/research.md`
- Plan review: `context/changes/phase-executors/reviews/plan-review.md`
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
- [ ] 1.5 A SHA suffix alone never passes: a code commit in `before.head..HEAD` is required, and a suffix outside that range fails: `node --test --test-name-pattern "strict verify checks sha suffix" skills/10x-pipeline/test/executors.test.mjs`
- [ ] 1.6 Without git the strict check falls back to the count rule: `node --test --test-name-pattern "strict verify without git" skills/10x-pipeline/test/executors.test.mjs`
- [ ] 1.7 A blocked tdd or e2e entry is a fallback: not counted by `trailingFailures`, no rigor rise, next tier not bumped: `node --test --test-name-pattern "fallback is neutral" skills/10x-pipeline/test/executors.test.mjs`
- [ ] 1.8 A blocked entry of plain implement is still a failure, and `needsHuman` from an executor entry still halts: `node --test --test-name-pattern "blocked plain implement fails" skills/10x-pipeline/test/executors.test.mjs`
- [ ] 1.9 New entries record `before.head` and `before.done`, and `status` prints `template`: `node --test --test-name-pattern "entry records before state" skills/10x-pipeline/test/executors.test.mjs`
- [ ] 1.11 The router's new git calls use only `rev-parse`, `merge-base` and `log` (prints nothing; re-run as 6.15): `! git diff "$(git merge-base main HEAD)" HEAD -- skills/10x-pipeline/scripts/route.mjs | grep -E '^\+.*(runGit|gitOut)\(\[' | grep -vE '"(rev-parse|merge-base|log)"'`
- [ ] 1.12 A commit that touches only `plan.md` or the change folder is no evidence, and an entry with no `before.head` is treated like a null head: `node --test --test-name-pattern "strict verify rejects forged evidence" skills/10x-pipeline/test/executors.test.mjs`
- [ ] 1.13 A strict step that ticked rows without evidence records them as `uncommitted`: `node --test --test-name-pattern "strict failure records uncommitted" skills/10x-pipeline/test/executors.test.mjs`

#### Manual

- [ ] 1.10 A reviewer confirms by reading the diff that the router's git use in this phase is limited to `rev-parse`, `cat-file` and `merge-base --is-ancestor`, and that `readPlan` kept every existing field type.

### Phase 2: Phase list routing with `/10x-e2e`, segments and the retry

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
- [ ] 2.13 With every Automated row ticked by a Skip flip and the last `implement` entry `ok:false` with `uncommitted` ids, the next step is `implement-retry`, not `impl-review`; the retry prompt names the rows; a retry with a code commit is `ok`, one without fails and the next attempt is one tier higher: `node --test --test-name-pattern "retry after uncommitted ticks" skills/10x-pipeline/test/executors.test.mjs`
- [ ] 2.14 The retry prompt tells the subagent to set the named rows back to `[ ]` first and never to tick unfinished work: `node --test --test-name-pattern "retry prompt rules" skills/10x-pipeline/test/executors.test.mjs`
- [ ] 2.15 With the extra-step pool spent, or too small to follow a goal segment with its special executor, the router returns plain `implement`: `node --test --test-name-pattern "extra steps pool" skills/10x-pipeline/test/executors.test.mjs`
- [ ] 2.16 At `lean` a plan with e2e rows and a valid setup still gets the plain `implement` prompt, the lean budget stays 10 and a `lean` walk is the same as without the feature: `node --test --test-name-pattern "lean keeps plain implement" skills/10x-pipeline/test/executors.test.mjs`
- [ ] 2.17 `e2eSetup` rejects an absolute path, a `..` path and a symlink that leaves the root: `node --test --test-name-pattern "e2e setup path containment" skills/10x-pipeline/test/executors.test.mjs`
- [ ] 2.18 A plan whose Progress headings are not `### Phase N` stays on plain `implement`: `node --test --test-name-pattern "no phase list stays plain" skills/10x-pipeline/test/executors.test.mjs`

#### Manual

- [ ] 2.12 Run `/10x-e2e` unattended in a scratch project with Playwright set up (`/10x-e2e-setup` done) and a two-phase plan whose phase 2 is browser-level, through the router: the e2e step stops after its phase, never picks "Skip", ends `done` with a new commit, or ends `blocked` without a question left waiting. Record the result in the Progress row. Also run a goal-implement segment on a two-phase plan and note whether it stops after its `{lastPhase}`.

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
- [ ] 4.10 Full suite passes; the only existing test file changed since `main` is `loops.test.mjs`, in a single hunk (listed in section 3): `node --test skills/10x-pipeline/test/*.test.mjs && test "$(git diff --name-only "$(git merge-base main HEAD)" HEAD -- skills/10x-pipeline/test | grep -vE 'test/(executors|codereplan|manualverify|budget-executors)\.test\.mjs|test/phase-helpers\.mjs')" = "skills/10x-pipeline/test/loops.test.mjs" && test "$(git diff -U0 "$(git merge-base main HEAD)" HEAD -- skills/10x-pipeline/test/loops.test.mjs | grep -c '^@@')" = 1`
- [ ] 4.12 A REJECTED after a `fix` keeps `fix`, a REJECTED re-plan leaves one fix loop, and it needs rigor `standard` or more and enough extra-step pool (at `lean` or with the pool spent it falls to `fix`): `node --test --test-name-pattern "rejected replan gates" skills/10x-pipeline/test/codereplan.test.mjs`
- [ ] 4.13 The `{failure}` text in the `plan-replan` prompt is one line of at most `failureNoteMax` characters: `node --test --test-name-pattern "failure note capped" skills/10x-pipeline/test/codereplan.test.mjs`

#### Manual

- [ ] 4.11 A reviewer reads the `plan-replan` and `plan-rejected` prompts and confirms that each rule can be followed by a subagent that cannot ask questions.

### Phase 5: `manual-verify` step and `--chrome`

#### Automated

- [ ] 5.1 The step runs once before the first impl-review when an eligible Manual row is pending at standard, and not at lean: `node --test --test-name-pattern "manual verify placement" skills/10x-pipeline/test/manualverify.test.mjs`
- [ ] 5.2 It does not run when no eligible Manual row is pending, or after an ok run (`maxRuns`): `node --test --test-name-pattern "manual verify not repeated" skills/10x-pipeline/test/manualverify.test.mjs`
- [ ] 5.3 Impl-review runs right after it and a `fix` does not trigger a second run: `node --test --test-name-pattern "manual verify before impl review" skills/10x-pipeline/test/manualverify.test.mjs`
- [ ] 5.4 A ticked row whose suffix names an existing, non-empty `evidence/<name>` file verifies; no suffix, a missing or empty file, a `..` or absolute name, or a symlink out of the evidence folder makes the step `ok: false`: `node --test --test-name-pattern "evidence suffix required" skills/10x-pipeline/test/manualverify.test.mjs`
- [ ] 5.5 Zero ticks is `ok: true`: `node --test --test-name-pattern "zero ticks is done" skills/10x-pipeline/test/manualverify.test.mjs`
- [ ] 5.6 Editing an Automated row, a title or a SHA suffix, or unticking a row, makes the step unverified: `node --test --test-name-pattern "manual verify guards plan edits" skills/10x-pipeline/test/manualverify.test.mjs`
- [ ] 5.7 `init --chrome` stores `chrome: true`, a resume keeps it, `--chrome false` clears it, and the chrome template is chosen from it: `node --test --test-name-pattern "chrome flag" skills/10x-pipeline/test/manualverify.test.mjs`
- [ ] 5.8 Rendered prompts name the evidence directory and the evidence suffix; the chrome prompt adds the ToolSearch rule and the unavailable fallback: `node --test --test-name-pattern "manual verify prompts" skills/10x-pipeline/test/manualverify.test.mjs`
- [ ] 5.9 Prompt rule form and wiring tests pass: `node --test skills/10x-pipeline/test/rules.test.mjs skills/10x-pipeline/test/preplan.test.mjs`
- [ ] 5.10 Full suite passes; no existing test file was edited in this phase (same diff gate as 4.10): `node --test skills/10x-pipeline/test/*.test.mjs && test "$(git diff --name-only "$(git merge-base main HEAD)" HEAD -- skills/10x-pipeline/test | grep -vE 'test/(executors|codereplan|manualverify|budget-executors)\.test\.mjs|test/phase-helpers\.mjs')" = "skills/10x-pipeline/test/loops.test.mjs"`
- [ ] 5.14 Only rows with a backticked command (or, with `--chrome`, a browser word) are eligible, and a row with a human word never is: `node --test --test-name-pattern "manual verify eligible rows" skills/10x-pipeline/test/manualverify.test.mjs`
- [ ] 5.15 A first attempt that leaves a bad tick is judged again by the retry against the first-attempt baseline; a failed attempt is neutral (no failure count, no rigor rise), the run goes on to impl-review after `maxAttempts`, and `done` lists `manualUnproven`: `node --test --test-name-pattern "manual verify retry baseline" skills/10x-pipeline/test/manualverify.test.mjs`
- [ ] 5.16 `--chrome foo` halts with a usage message: `node --test --test-name-pattern "chrome flag value" skills/10x-pipeline/test/manualverify.test.mjs`

#### Manual

- [ ] 5.11 Run a router-driven `manual-verify` step with `--chrome` on a scratch plan with one browser-checkable Manual row and a connected Chrome extension: confirm the subagent loads the Chrome tools, ticks the row with an evidence suffix and a file under `context/changes/<id>/evidence/`. Record the outcome in the Progress row.
- [ ] 5.12 Run the same step with no Chrome extension connected: confirm it ends `done` with zero ticks and no hang.
- [ ] 5.13 Run a router-driven `manual-verify` step without `--chrome` on a plan whose Manual row a shell command can prove: confirm one tick with an evidence suffix and that a row needing a person stays pending.

### Phase 6: Budget from the longest legal path, report label, docs and scope gates

#### Automated

- [ ] 6.1 The standard and thorough longest paths fit, and the delta is the smallest that fits: `node --test --test-name-pattern "longest legal path" skills/10x-pipeline/test/budget-executors.test.mjs`
- [ ] 6.2 The failure re-plan path fits: `node --test --test-name-pattern "failure path fits" skills/10x-pipeline/test/budget-executors.test.mjs`
- [ ] 6.3 Existing reference paths pass with only the Phase 4 edit, and the frozen loop tests are byte-identical to `main`: `node --test skills/10x-pipeline/test/loops.test.mjs skills/10x-pipeline/test/loops-existing.test.mjs && git diff --quiet "$(git merge-base main HEAD)" HEAD -- skills/10x-pipeline/test/loops-existing.test.mjs`
- [ ] 6.4 ADR rule lines keep the rule form: `node --test --test-name-pattern "ADR" skills/10x-pipeline/test/rules.test.mjs`
- [ ] 6.5 ADR-003 marks the part implemented and has the new section: `grep -c "phase-executors.*implemented" docs/ADR/ADR-003-rigor-gated-routing.md`
- [ ] 6.6 `SKILL.md` and `README.md` each document `--chrome`, `manual-verify`, `plan-replan` and `plan-rejected` (the command names the first missing word): `for f in skills/10x-pipeline/SKILL.md README.md; do for w in "--chrome" "manual-verify" "plan-replan" "plan-rejected"; do grep -qF -e "$w" "$f" || { echo "$f: $w"; exit 1; }; done; done`
- [ ] 6.7 `SKILL.md` names no model: `! grep -iE "opus|sonnet|haiku" skills/10x-pipeline/SKILL.md`
- [ ] 6.8 `AGENTS.md` lists the new test files: `grep -c "executors.test.mjs" AGENTS.md`
- [ ] 6.9 Full suite passes, on Node 18 when it is installed (`fnm exec --using=18 node --test skills/10x-pipeline/test/*.test.mjs`) and on the installed Node otherwise, and the Node 18 ban list finds nothing (record `node --version` in the row): `node --test skills/10x-pipeline/test/*.test.mjs && ! grep -nE 'toSorted|Object\.groupBy|import\.meta\.dirname|\.intersection\(|\.union\(|partialDeepStrictEqual|mock\.timers' skills/10x-pipeline/scripts/route.mjs skills/10x-pipeline/test/*.mjs`
- [ ] 6.10 `init` and `status` against a scratch change folder print valid JSON: `node --test --test-name-pattern "executors smoke" skills/10x-pipeline/test/executors.test.mjs`
- [ ] 6.13 The frozen files are untouched since `main`: `git diff --quiet "$(git merge-base main HEAD)" HEAD -- skills/10x-pipeline/test/loops-existing.test.mjs skills/10x-pipeline/test/compare.test.mjs skills/10x-pipeline/test/helpers.mjs skills/10x-pipeline/baseline-policy.json`
- [ ] 6.14 The only existing test file changed since `main` is `loops.test.mjs`: `test "$(git diff --name-only "$(git merge-base main HEAD)" HEAD -- skills/10x-pipeline/test | grep -vE 'test/(executors|codereplan|manualverify|budget-executors)\.test\.mjs|test/phase-helpers\.mjs')" = "skills/10x-pipeline/test/loops.test.mjs"`
- [ ] 6.15 The router's git calls added since `main` use only `rev-parse`, `merge-base` and `log` (prints nothing): `! git diff "$(git merge-base main HEAD)" HEAD -- skills/10x-pipeline/scripts/route.mjs | grep -E '^\+.*(runGit|gitOut)\(\[' | grep -vE '"(rev-parse|merge-base|log)"'`
- [ ] 6.16 `cleanSignals`, `cleanUsage` and `prompts.suffix` are unchanged, and `buildReport` differs only in its Result and Step lines: `b="$(git merge-base main HEAD)"; f=skills/10x-pipeline/scripts/route.mjs; for fn in cleanSignals cleanUsage; do diff <(git show "$b:$f" | sed -n "/^function $fn(/,/^}/p") <(sed -n "/^function $fn(/,/^}/p" "$f") || exit 1; done; test "$(diff <(git show "$b:$f" | sed -n '/^function buildReport(/,/^}/p') <(sed -n '/^function buildReport(/,/^}/p' "$f") | grep '^[<>]' | grep -vE 'const result = |\$\{e\.n\}' | wc -l | tr -d ' ')" = 0 && node -e 'const cp=require("node:child_process"),fs=require("node:fs");const m=cp.execFileSync("git",["merge-base","main","HEAD"],{encoding:"utf8"}).trim();const b=cp.execFileSync("git",["show",m+":skills/10x-pipeline/policy.json"],{encoding:"utf8"});process.exit(JSON.parse(b).prompts.suffix===JSON.parse(fs.readFileSync("skills/10x-pipeline/policy.json","utf8")).prompts.suffix?0:1)'`
- [ ] 6.17 A fallback entry reads `fallback` in the report and is not a `compare` failed attempt, and an executor segment shows its template in the Step cell: `node --test --test-name-pattern "report shows fallback" skills/10x-pipeline/test/executors.test.mjs`
- [ ] 6.18 `lean` keeps today's budget and paths: a lean walk with e2e rows, a valid setup, an eligible Manual row and a first-review `REJECTED` has the same steps as a walk without them, and `budgetDelta.lean` is -4: `node --test --test-name-pattern "lean unchanged" skills/10x-pipeline/test/budget-executors.test.mjs`

#### Manual

- [ ] 6.11 A reviewer reads ADR-003, `SKILL.md` and `README.md` side by side and confirms they describe the same executor, fallback, re-plan, manual-verify and budget rules.
- [ ] 6.12 A full router-driven pipeline run on a scratch project (a mixed plan, `--chrome` off) ends `done` with the step log showing the segment templates and the `manual-verify` step. Record the step list in the Progress row.
