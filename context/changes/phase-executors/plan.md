# phase-executors Implementation Plan

## Overview

Make the pipeline's `implement` step pick the executor that fits each plan phase (`/10x-e2e`, `/10x-tdd` or `/10x-goal-implement`), verify tdd and e2e work by a real code commit instead of the `[x]` count, re-open rows that were ticked without a commit, re-plan once after repeated implement failures or a first impl-review `REJECTED`, and add a `manual-verify` step that ticks the command-checkable Manual rows it can prove, each with an evidence file the router checks. Roadmap S-08 (FR-001, FR-003, FR-007). Written without a human: every owner question was answered from research evidence or from the defaults in the planning brief, and each answer is an assumption below.

Revised 2026-10-31 after plan review round 1 (verdict REVISE, `reviews/plan-review.md`) and again after round 2 (verdict REVISE, `reviews/plan-review-2.md`). The "Review Response" section before `## References` lists every finding of both rounds, the decision, the existing tests this change edits and the Progress rows that were reworded.

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
- A strict step that ticked rows without commit evidence records those row ids as `uncommitted`. While such rows are still ticked, `decide()` returns an `implement-retry` step even when no Automated row is pending, so a full-phase Skip flip cannot reach impl-review as done. The retry prompt names the rows and tells the subagent to set them back to `[ ]` first; the retry is `ok` only with a commit in its own range. The retry runs at most once per run (`executors.retry.max` 1). A retry that ends `done` or `blocked` without a commit is a neutral fallback entry, not a failure: the run goes on to `impl-review`, whose prompt names the rows still ticked without a commit as a warning, and the `done` output and `report.md` list them (`uncommittedTicks`). A legitimate zero-diff phase therefore never halts the run. A retry that ends `failed` is a failure as for any step.
- Extra steps are metered by one pool per rigor level (`extraSteps`): every non-plain implement step, every `manual-verify` step and a REJECTED re-plan spends from it. `lean` has an allowance of 0, so `lean` keeps today's paths and budget. Standard allows 2, thorough 3.
- After two trailing implement failures, or an impl-review `REJECTED` that comes before any `fix`, the router runs one `plan` step with the failure or review as input (shared cap 1 per run, rigor `standard` or higher). A REJECTED re-plan uses one of the `maxFixLoops`. Plan review and implement then continue as usual.
- At rigor `standard` and above, one `manual-verify` step runs before the first impl-review pass that finds a pending Manual row the plan makes checkable: a row with a backticked command, or, with `init --chrome`, a browser row. It ticks only such rows, each with ` — evidence: evidence/<name>` where `context/changes/<id>/evidence/<name>` exists and is not empty. Rows that need a person stay in `manualPending`. A failed `manual-verify` is neutral (one retry, then the run goes on) and its unproven ticks are listed in the `done` output, in the `archive` action's `summary` and in `report.md` (`manualUnproven`).
- `rigor.budgetDelta` is `standard: 2` and `thorough: 7` (today 0 and 4); `lean` stays -4. A test lets the real router walk a saturating fixture per level, derives the longest legal path from the policy at hand and proves the delta is the smallest that fits with one failed step to spare; a second run with a raised pool cap must exceed that bound. The new budgets break one existing test, `route.test.mjs:148-165`, which Phase 6 edits.
- ADR-003, `SKILL.md` "How the tier moves", `README.md` and `AGENTS.md` describe it.

Verify: `node --test skills/10x-pipeline/test/*.test.mjs` passes, including the new files `executors.test.mjs`, `codereplan.test.mjs`, `manualverify.test.mjs` and `budget-executors.test.mjs`.

### Key Discoveries:

- Eight sites compare or return the literal step `"implement"` (`:331`, `:620`, `:674`, `:705`, `:708`, `:713`, `:718`, `:731`) and `policy.complexity` keys it. Keeping the step name and varying the template (as `plan`/`plan-revise` do, `:1408`) touches none of them.
- The pattern to copy is `preplanNext`/`replanNext`: selection in a function below `decide()`, counters derived from the log by template name, knobs in policy data where a non-positive value disables the feature (`:887-993`).
- A tdd/e2e redirect is a normal ending of the skill, so the prompt must turn it into `blocked` without `signals.needsHuman` (`needsHuman` halts before `decide()`, `:1350-1357`).
- The re-plan must trigger at exactly 2 trailing failures: `route.test.mjs:386-400` (three failed implements must halt) holds only then.
- `status` output has no `template` key (`:1720`); adding it shows the executor without touching `buildReport`.
- Prototype run (scratch copy, 2026-10-31, deleted): with the REJECTED re-plan limited to a first review (no `fix` yet), the status `template` key, the report label and the new `before` keys added, the whole suite (324 tests) fails in exactly one existing test, `loops.test.mjs:16` (block at lines 30-34). The three reference paths (`:441-497`) reach their `REJECTED` after a `fix`, and `planText` (`helpers.mjs:58`) always writes a Manual row "Look at it", which is not command-checkable, so `manual-verify` never fires in them and `route.test.mjs:195-199` keeps passing.
- Second prototype (round 2, scratch copy of `skills/`, `README.md`, `AGENTS.md` and `docs/`, deleted): only `rigor.budgetDelta` set to `{lean:-4, standard:2, thorough:7}`, test files unchanged. The suite (324 tests) fails in exactly one test, `route.test.mjs:148` ("step budget differs per level: 10, 14, 18", `budget 14, 'run' !== 'halt'`). The loop reference paths pass because `loops.test.mjs:439` reads the budget from the policy. The behavior changes and the delta cannot be prototyped together before the code exists, so the complete list of existing test edits is the union of the two experiments: `loops.test.mjs:30-34` and `route.test.mjs:148-165`. Gates 4.10, 5.10, 6.3 and 6.14 allow exactly those two edits and stop on any third one.

## What We're NOT Doing

- No change to `cleanSignals`, `cleanUsage`, `prompts.suffix` or the RESULT line (S-10 owns them). `buildReport` changes only inside its `rows` map (Phase 6: the Result label and the Step cell); no report section for executors. Gates in Phase 6 prove it.
- No edit to `loops-existing.test.mjs`, `compare.test.mjs`, `helpers.mjs`, `baseline-policy.json`, `context/archive/`, `context/foundation/roadmap.md`, `run.jsonl` or `meta.json` by hand. The only existing test edits are the block at `loops.test.mjs:30-34` (Phase 4) and the budget test at `route.test.mjs:148-165` (Phase 6). The tests that read `README.md`, `ADR-003`, `AGENTS.md` and `SKILL.md` (`pr-comment.test.mjs:674-790`) stay green: Phase 6 adds text without moving the sections they pin.
- No new git write. The router's new git reads are `rev-parse`, `merge-base --is-ancestor` and `log` only; a gate row greps the working-tree diff for the allowed subcommands and for any write subcommand. It is a smoke check, not a proof: the manual row 1.10 reads the diff against the real list.
- No `gh`, no npm dependency, no Node 19+ API.
- No cheaper guard for `/10x-goal-implement` zero-diff phases: research found none without false negatives (see Assumption 4). Plain `implement` and `implement-segment` keep the count rule; only `implement-retry` is strict among goal-implement templates.
- No router check that a Chrome tool is available, and no probing from the orchestrator (`allowed-tools` has no `ToolSearch`).
- No size check of evidence files by the router (the prompt asks for under 1 MB). Existence, regular file, non-emptiness, containment and freshness are checked.
- No new step name for executors. No `baseline-policy.json` pin for the new features (Assumption 14).
- No `/10x-lesson` or lesson-candidate work.

## Implementation Approach

Six phases, each one implement run. Phase 1 builds the verification and fallback machinery with plain templates only, so it changes no routing. Phase 2 adds the phase list, the extra-step pool, the e2e executor, segments and the retry. Phase 3 adds tdd on the same rails. Phase 4 adds the code re-plans. Phase 5 adds `manual-verify` and `--chrome`. Phase 6 sets the budget from proved longest paths and updates the docs and the report label.

Edit discipline for the S-10 conflict (S-10 edits `decide()` and `attachResult`/`cleanSignals` afterwards). New logic goes in one new section after `replanNext`. Touch points inside existing functions, all small:

- `decide()`: the implement branch (failure re-plan call, retry call, executor call, and the `if` that also opens for retry rows); the `struggled` test (`isFailure`); the REJECTED block (re-plan call before the fix-loop check, and the fix-loop count); the impl-review branch (one `manual-verify` call and the `impl-review-warn` template choice); the `done` return (one spread of the output notes, see below). S-10 may touch the `done` return; the spread is one expression.
- `attachResult`: new bodies inside `case "implement"`, `case "plan"` (template-keyed checks) and a new `case "manual-verify"`. The tail (`last.signals`, `last.verified`, `last.ok`) stays untouched: `fallback` is set inside the cases, because it depends only on `result.status` and the case's own verdict.
- `next()`: the entry `before` keys, the render variables and the `done` object.
- The output notes (`uncommittedTicks`, Phase 2; `manualUnproven`, Phase 5) travel through one helper, `doneNotes(d)`, that returns only the non-empty keys. Five sites spread it, each one expression: the `decide()` `done` return (builds the notes), the `next()` `done` object (`route.mjs:1391`), `archiveDone` (the `finishRun` call at `:1259` and `summary` at `:1325`), `finishRun` (stores them in `meta.outcome`, `:254`) and `archiveLines` (`Manual checks unproven: N` and `Ticked without a commit: N`, each followed by the ids, `:191-201`). A halt carries neither key: a halted run is never archived and has no `manualPending` either.

New policy keys go in new top-level groups after `prompts`, plus appended entries inside `steps` and `prompts`, and the two `rigor.budgetDelta` values. Docs are new bullets.

Policy shape (names are the contract; values are the shipped defaults):

- `executors`: `strictVerify` (`["implement-tdd", "implement-e2e"]`), `segment.template`, `retry` (`template` `implement-retry`, `max` 1), `e2e` (`template`, `skill` `10x-e2e`, `minRigor` `lean`, `setup` {file, section, fields}, `rowWords`), `tdd` (`template`, `skill` `10x-tdd`, `minRigor` `thorough`, `codeExtensions`, `excludeGlobs`, `testWords`, `uiWords`). `segment` and `retry` have no `skill` key: they run `10x-goal-implement`, the skill of `steps.implement`.
- `extraSteps`: `allowance` {`lean` 0, `standard` 2, `thorough` 3} and `cost` {`implement-segment` 1, `implement-e2e` 1, `implement-tdd` 1, `manual-verify` 1, `plan-rejected` 2}. Spent = sum of `cost` over executed entries (any outcome); left = allowance of the current level minus spent. A feature runs only when `left >= its cost`. A non-positive allowance turns every metered feature off.
- `codeReplan`: `minRigor` `standard`, `afterFailures` 2, `onRejected` true, `rejectedMaxFixes` 0, `max` 1, `rejectedBump` 1, `failureBump` 0, `failureNoteMax` 300. A non-positive `max` or `afterFailures` turns that trigger off.
- `manualVerify`: `minRigor` `standard`, `maxRuns` 1, `maxAttempts` 2, `commandWords`, `humanWords`, `browserWords`.
- `rigor.budgetDelta`: `standard` 2, `thorough` 7.
- `steps["manual-verify"]`, and prompts `implement-segment`, `implement-e2e`, `implement-tdd`, `implement-retry`, `impl-review-warn`, `plan-replan`, `plan-rejected`, `manual-verify`, `manual-verify-chrome`.

Test files are new and black-box through the CLI (`run`, `init`, `next` from `helpers.mjs`), with a new `test/phase-helpers.mjs` (created in Phase 1) for plan builders, e2e fixtures and `gateCheck`, so `helpers.mjs` stays untouched.

Gate rows must fail when nothing is checked (review round 2, F5). `node --test --test-name-pattern "x" file` exits 0 when no test matches, so each phase has one gate row (1.14, 2.20, 3.12, 4.15, 5.19, 6.21) that runs `gateCheck(planPath, phase)` from `phase-helpers.mjs`. It reads the `### Phase N` block of the plan's `## Progress` and exits non-zero unless the phase has at least one `--test-name-pattern "<p>" <file>` row, every named file exists, every pattern is a plain string without regex metacharacters and appears inside a `test(`, `it(` or `describe(` title literal of its file. It is a static check: test titles must be string literals. The meta-test "gate check fails when nothing is checked" (row 1.14) feeds it a plan with a misspelled pattern, a phase with no pattern row and a missing file, and expects a failure each time. Every `git diff` gate compares the working tree with `git merge-base main HEAD` (no `HEAD` operand, so uncommitted edits count) and fails when `merge-base` fails.

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

- `next()` entry `before` gains `head` (stdout of `git rev-parse HEAD` trimmed, or `null` without git or without a commit) and `done` (array of done Automated row ids), only when the entry's template is in `executors.strictVerify`, is `executors.retry.template`, or (Phase 4) is `plan-replan` or `plan-rejected`. Plain and segment entries keep `before: { autoDone }` byte for byte. Additive keys only (ADR-005). An entry with no `before.head` (an in-flight run resumed on the new router) is treated like `head: null` (`== null`, not `=== null`); an entry with no `before.done` skips the subset test of Phase 4 (new entries always carry it).
- `commitEvidence(before, ids, plan, id)` returns `null` (no check; the count rule applies) when `before.head == null` or git is unreadable. Otherwise it runs `git merge-base --is-ancestor <before.head> HEAD` and maps the exit status: 0 continues, 1 returns `false` (an amend or rebase of the old head reads as a false failure: noisy, harmless, and the retry path covers it), any other status (128: unknown commit after gc, a shallow clone, not a repository) returns `null`, like a missing git. Then it reads `git log -z --name-only --relative --format=%x01%H%x01 <before.head>..HEAD` once. Parse: split the output on `\x01`; tokens alternate between a SHA and the chunk of paths after it; drop one leading newline from a chunk, split it on `\0`, drop empty items. Paths are relative to the project root; a path starting with `@`, with a space or a quote is read intact (only a path that holds the byte `\x01` is misread). A commit counts when it touched at least one path that is outside `context/changes/<id>/` and does not match `risk.churn.exclude` (the churn exclude globs: `context/**`, `docs/**`, lockfiles, `assets/**`, `**/*.md`, reused through `globToRegex`). It returns `true` only when at least one counted commit exists and every row in `ids` that carries a ` — <7-40 hex>` suffix names a SHA that is a prefix of one of those commits. A commit that only touches `plan.md`, the change folder, docs or a lockfile is not evidence, and a suffix that names an older commit fails. A commit that touches only generated files outside those globs (snapshots, build output) still counts: this is not a forgery guard (Assumption 5).
- `attachResult` `case "implement"`: when `policy.executors.strictVerify` includes `last.template`, or `last.retry` is set: `ev = commitEvidence(...)`. For `ev === null` the count rule applies as today. Otherwise `verified = ev` for a retry entry and `verified = plan.autoDone > before.autoDone && ev` for the others. The ids checked are `newlyTicked(before.done, plan)` (retry entries: the entry's `retry` ids that are done now). When `ev === false` and that id list is not empty, set `last.uncommitted = ids` (Phase 2 reads it). Plain templates keep the count rule exactly as today.
- Inside the same case, set `last.fallback = true` when `result.status === "blocked"` and `last.template` is in `strictVerify`. A `signals.needsHuman` still halts first (existing code, `:1350`). Also set `last.fallback = true` for a retry entry (`last.retry` set) with `ev === false` and `result.status` `done` or `blocked`: the retry is the last attempt, so the missing commit is accepted with a warning (Phase 2) and counts as neither failure nor tier bump. A retry that ends `failed` stays a failure.
- `status` output steps gain `template: e.template ?? null`.
- `policy.json` gains the `executors` group with only `strictVerify: ["implement-tdd", "implement-e2e"]` in this phase.

### Success Criteria:

#### Automated Verification:

- Existing suite stays green with no test edit: `node --test skills/10x-pipeline/test/*.test.mjs`
- Plain implement keeps the count rule (a flipped row without a commit stays `ok`): `node --test --test-name-pattern "plain implement keeps count rule" skills/10x-pipeline/test/executors.test.mjs`
- A tdd or e2e step that ticks rows with no new commit and no SHA suffix is `ok: false, verified: false`: `node --test --test-name-pattern "strict verify rejects skip flip" skills/10x-pipeline/test/executors.test.mjs`
- A tdd or e2e step with a commit since `before.head` is `ok: true`: `node --test --test-name-pattern "strict verify accepts new commit" skills/10x-pipeline/test/executors.test.mjs`
- A SHA suffix alone never passes: a code commit in `before.head..HEAD` is required, and a suffix outside that range fails: `node --test --test-name-pattern "strict verify checks sha suffix" skills/10x-pipeline/test/executors.test.mjs`
- Without git the strict check falls back to the count rule: `node --test --test-name-pattern "strict verify without git" skills/10x-pipeline/test/executors.test.mjs`
- A blocked tdd or e2e entry is a fallback: not counted by `trailingFailures`, no rigor rise, next tier not bumped: `node --test --test-name-pattern "fallback is neutral" skills/10x-pipeline/test/executors.test.mjs`
- A blocked entry of plain implement is still a failure, and `needsHuman` from an executor entry still halts: `node --test --test-name-pattern "blocked plain implement fails" skills/10x-pipeline/test/executors.test.mjs`
- New entries record `before.head` and `before.done`, and `status` prints `template`: `node --test --test-name-pattern "entry records before state" skills/10x-pipeline/test/executors.test.mjs`
- The router's new git calls use only `rev-parse`, `merge-base` and `log`; smoke check on the working-tree diff against `merge-base` that fails on an empty diff or an added write-subcommand string (prints nothing; re-run as 6.15): `(set -e; b="$(git merge-base main HEAD)"; d="$(git diff "$b" -- skills/10x-pipeline/scripts/route.mjs)"; test -n "$d"; a="$(printf '%s\n' "$d" | grep '^+' || true)"; test -z "$(printf '%s\n' "$a" | grep -E '"(add|commit|push|reset|checkout|switch|restore|rebase|cherry-pick|stash|update-ref|clean|fetch|pull)"' || true)"; test -z "$(printf '%s\n' "$a" | grep -E '(runGit|gitOut)\(\[' | grep -vE '"(rev-parse|merge-base|log)"' || true)")`
- A commit that touches only `plan.md` or the change folder is no evidence, and an entry with no `before.head` is treated like a null head: `node --test --test-name-pattern "strict verify rejects forged evidence" skills/10x-pipeline/test/executors.test.mjs`
- A strict step that ticked rows without evidence records them as `uncommitted`: `node --test --test-name-pattern "strict failure records uncommitted" skills/10x-pipeline/test/executors.test.mjs`
- Every `--test-name-pattern` gate row of Phase 1 names a test title that exists, and the check itself fails on a misspelled pattern, a missing file or a phase with no pattern row: `node -e 'import("./skills/10x-pipeline/test/phase-helpers.mjs").then((m) => process.exit(m.gateCheck("context/changes/phase-executors/plan.md", 1)))' && node --test --test-name-pattern "gate check fails when nothing is checked" skills/10x-pipeline/test/executors.test.mjs`
- `commitEvidence` maps `merge-base --is-ancestor` status 1 to `false` and any other status (an unknown 40-hex `before.head`) to `null` (count rule), reads a path that starts with `@` or holds a space intact, and ignores a commit that touches only docs, a lockfile or the change folder: `node --test --test-name-pattern "strict verify git edge cases" skills/10x-pipeline/test/executors.test.mjs`

#### Manual Verification:

- A reviewer confirms by reading the diff that the router's git use in this phase is limited to `rev-parse`, `merge-base --is-ancestor` and `log` (not only the lines the smoke check 1.11 matches), and that `readPlan` kept every existing field type.

Note on row 1.10: the round 1 title named `cat-file`, which the final design does not use, so round 2 reworded it (a false sentence is the one reason to reword a reviewed title). Row 1.11 is a smoke check: it sees only calls written on one line with `runGit([` or `gitOut([`, while the archive code calls git through a local `g([...])` helper and `execFileSync`. The reviewer reads the whole diff against the list `rev-parse`, `merge-base --is-ancestor`, `log`.

**Implementation Note**: After this phase and its automated checks pass, pause for confirmation before Phase 2. Checkboxes for these items live in `## Progress`.

---

## Phase 2: Phase list routing with `/10x-e2e`, segments and the retry

### Overview

Pick the executor per phase for e2e, build segments, meter them in the extra-step pool, re-open uncommitted rows once (then warn the impl-review), carry the output notes into `done`, `archive` and `report.md`, wire prompts and tier handling. Only e2e and goal-implement exist here; tdd arrives in Phase 3.

### Changes Required:

#### 1. Policy and prompts

**File**: `skills/10x-pipeline/policy.json`, `skills/10x-pipeline/prompts/executor-e2e.md`, `skills/10x-pipeline/prompts/executor-retry.md`, `skills/10x-pipeline/prompts/impl-review-warn.md`, `skills/10x-pipeline/prompts/README.md`

**Intent**: Data for the e2e executor, the pool and the retry, and rule-form prompts that answer every interactive gate of `/10x-e2e` so a subagent never waits.

**Contract**: `executors` gains `segment: { template: "implement-segment" }`, `retry: { template: "implement-retry", max: 1 }` and `e2e: { template, skill: "10x-e2e", minRigor: "lean", setup: { file: "context/foundation/test-stack.md", section: "## E2E", fields: ["config", "seed"] }, rowWords: ["playwright", "e2e", "end-to-end", "browser"] }`. The `extraSteps` group is added as specified in "Implementation Approach". Prompts `implement-e2e`, `implement-segment` and `implement-retry` are arrays: a first line (`Run /10x-e2e {id} phase {phase}` / `Run /10x-goal-implement {id} phase {phase}` for both goal-implement templates) and, for e2e and retry, `@prompts/executor-e2e.md` / `@prompts/executor-retry.md`. The e2e file holds GIVEN/WHEN/THEN rules (one bold keyword each, ADR-004) for: stop after phase `{lastPhase}` by taking the "stop here" option of the next-phase question; never choose "Skip - already done"; the manual confirmation gate counts as confirmed, Manual rows are listed in the reply and never ticked; commit message approved as proposed; dirty paths commit only the planned set; setup missing, feature not built or a non-browser risk ends `blocked` with no `signals.needsHuman`; a spec that already passes ends `blocked` instead of ticking rows without a commit; an ambiguous gate takes the recommended option or ends `blocked`; no question that waits for a reply. The segment prompt tells goal-implement to stop after phase `{lastPhase}`. The retry file holds: the rows `{retry}` are ticked in `plan.md` without a commit, so set each back to `[ ]` before any work; do the work, commit it and write the SHA; stop after phase `{lastPhase}`; never tick a row for work that was not done; a phase with nothing left to change ends `blocked` with the reason, because this is the last attempt: the router then goes on to `impl-review` with the rows named (Assumption 15), so a legitimate zero-diff phase does not halt the run. Prompt `impl-review-warn` is an array: the text of `prompts["impl-review"]` as its first element (a test compares the two) and `@prompts/impl-review-warn.md`, which holds two rules: GIVEN the rows `{uncommitted}` are ticked in `plan.md` with no code commit behind them WHEN you review the code **THEN** you **MUST** look for the work of each row in the diff and report each row without code as a CRITICAL finding; GIVEN the work of such a row exists WHEN you find it **THEN** you **SHOULD** name the commit or file. The README table lists the three new files under "Wired".

#### 2. Selection, pool and retry

**File**: `skills/10x-pipeline/scripts/route.mjs` (new section after `replanNext`; one `PREDICATES` entry; the implement branch of `decide()`)

**Intent**: Choose the executor per pending phase, meter extra steps, and re-open uncommitted rows.

**Contract**:

- `PREDICATES.e2eSetup` reads `policy.executors.e2e.setup`: file exists, take lines from the section heading to the next `## `, parse `- config:` and `- seed:` (path is the text up to the first ` — `, backticks stripped). A path is accepted only when it is relative, has no `..` segment, resolves under `ROOT`, and `path.resolve(ROOT, p)` starts with `ROOT + path.sep` and exists. An absolute or escaping path is no hit. Anything missing is no hit.
- `extrasLeft(log, policy, level)` = `extraSteps.allowance[level]` (0 when missing or not an integer) minus the sum of `extraSteps.cost[e.template]` over executed entries.
- A phase is pending when it has at least one Automated `[ ]` row. `e2eWanted(phase)` is true when the rigor gate is open, `e2eSetup` hits and `goalPhrase` over the phase name and the pending Automated row texts finds a `rowWords` entry.
- `executorExcluded(log, phase, executor)` is true when an executed entry has that `executor`, covers the phase (`phase <= n <= lastPhase`) and has `fallback` or `ok === false`.
- `retryRows(log, plan, policy)`: the latest executed `implement` entry's `uncommitted` ids that are still done in `plan`; empty when a later `implement` entry exists, when the entry has none, or when the executed entries with template `implement-retry` number `executors.retry.max` or more (a non-positive `max` turns the retry off: rows are then not re-opened, as today).
- `unprovenTicks(log, plan, policy)`: the union of the `uncommitted` ids of all executed `implement` entries that are still done in `plan`, minus the `retry` ids of executed `implement-retry` entries with `ok === true`, minus `retryRows(...)`. These are rows ticked without a commit that the router will not ask about again.
- `executorNext(plan, log, policy, ctx, bumpInfo)` returns `null` when no pending phase wants a special executor, or when the pool cannot pay for the route: the steps needed are 1 when the first pending phase wants a special executor and 2 when a goal segment must precede the first special phase, and `extrasLeft` must cover that many costs. Then the caller returns the plain step as today, so a run never starts a goal segment it cannot follow with the executor that justified it. Otherwise it returns `{ step: "implement", template, phase, lastPhase, executor, skill, interactive, bump, reason }`. The segment starts at the first pending phase and extends over following pending phases that choose the same executor; a goal-implement segment ends before the next phase that wants another executor. `interactive` is true for e2e. `bump` and `reason` carry what the implement branch already computed.
- `retryNext(...)` returns `{ step: "implement", template: "implement-retry", phase, lastPhase, retry, executor: "goal", bump, reason }`, where `phase` and `lastPhase` are the lowest and highest phase of the `retry` ids (looked up in `phaseList`). The retry costs nothing from the pool and is not subject to `executorExcluded`.
- `decide()` implement branch: the branch opens when `plan.autoPending > 0` or `retryRows(...)` is not empty. Order inside: (Phase 4 adds the failure re-plan first), `retryNext` when `retryRows` is not empty, else `executorNext`, else the existing plain object. In the `!irFresh` block the impl-review object gains `template: "impl-review-warn"` and `uncommitted: <ids>` when `unprovenTicks` is not empty and no `impl-review` entry follows the implement entry that recorded them (a later pass after a `fix` uses the plain prompt). The `done` return spreads `doneNotes(...)` with `uncommittedTicks: unprovenTicks(...)` when not empty. Nothing else in `decide()` changes in this phase.
- Output plumbing for the notes (review round 2, F3), all in this phase: `doneNotes(d)` returns the non-empty note keys of `d`; the `next()` `done` object, `archiveDone` (the `finishRun` argument and `summary`), `finishRun` (`meta.outcome`) and `archiveLines` (`Ticked without a commit: N` and the ids, after `Manual checks pending`) each spread or read it. Phase 5 adds the `manualUnproven` source and its line.
- `next()` entry for a retry step stores `retry: [ids]`. `tierFor`: `if (s.interactive || d.interactive)` at the effort-floor test (`:1048`).
- `next()`: render vars `{phase}`, `{lastPhase}`, `{retry}` and `{uncommitted}` (empty for other steps; both are the ids joined by `, `); the entry gains `phase`, `lastPhase`, `executor` when set, and `skill: d.skill ?? policy.steps[d.step].skill`. `executorNext` sets `skill` from `executors.<executor>.skill`, so an e2e entry logs `10x-e2e`, and goal templates keep `10x-goal-implement`.

### Success Criteria:

#### Automated Verification:

- `e2eSetup` hits only when the section has `config` and `seed` paths that exist: `node --test --test-name-pattern "e2e setup predicate" skills/10x-pipeline/test/executors.test.mjs`
- A plan with no browser rows gets the plain `implement` prompt, byte-identical to the policy text plus suffix: `node --test --test-name-pattern "no e2e rows keeps plain prompt" skills/10x-pipeline/test/executors.test.mjs`
- Browser rows with setup route that phase to `implement-e2e` with `{phase}` and `{lastPhase}` filled and `executor: "e2e"` in the entry: `node --test --test-name-pattern "e2e phase routes to e2e" skills/10x-pipeline/test/executors.test.mjs`
- Browser rows without setup stay on plain `implement`: `node --test --test-name-pattern "e2e rows without setup" skills/10x-pipeline/test/executors.test.mjs`
- A goal, e2e, goal plan runs `implement-segment` for phase 1, then `implement-e2e` for phase 2, then plain `implement` once the extra-step pool is spent: `node --test --test-name-pattern "mixed plan segments" skills/10x-pipeline/test/executors.test.mjs`
- A blocked e2e entry is not repeated for that phase, the next step is goal-implement at an unchanged tier with rigor unchanged: `node --test --test-name-pattern "e2e blocked falls back" skills/10x-pipeline/test/executors.test.mjs`
- An unverified e2e entry (Skip flip) is not repeated for that phase and the next attempt is one tier higher: `node --test --test-name-pattern "e2e failed not repeated" skills/10x-pipeline/test/executors.test.mjs`
- `implement-e2e` never runs below the effort floor of the rigor level: `node --test --test-name-pattern "e2e effort floor" skills/10x-pipeline/test/executors.test.mjs`
- Prompts keep the rule form and the new prompt file is listed as wired: `node --test skills/10x-pipeline/test/rules.test.mjs skills/10x-pipeline/test/preplan.test.mjs`
- The rendered e2e prompt names the stop phase, forbids Skip and ends `blocked` on a redirect: `node --test --test-name-pattern "e2e prompt rules" skills/10x-pipeline/test/executors.test.mjs`
- Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs`
- With every Automated row ticked by a Skip flip and the last `implement` entry `ok:false` with `uncommitted` ids, the next step is `implement-retry`, not `impl-review`; the retry prompt names the rows; a retry with a code commit is `ok`: `node --test --test-name-pattern "retry after uncommitted ticks" skills/10x-pipeline/test/executors.test.mjs`
- The retry prompt tells the subagent to set the named rows back to `[ ]` first and never to tick unfinished work: `node --test --test-name-pattern "retry prompt rules" skills/10x-pipeline/test/executors.test.mjs`
- With the extra-step pool spent, or too small to follow a goal segment with its special executor, the router returns plain `implement`: `node --test --test-name-pattern "extra steps pool" skills/10x-pipeline/test/executors.test.mjs`
- At `lean` a plan with e2e rows and a valid setup still gets the plain `implement` prompt, the lean budget stays 10 and a `lean` walk is the same as without the feature: `node --test --test-name-pattern "lean keeps plain implement" skills/10x-pipeline/test/executors.test.mjs`
- `e2eSetup` rejects an absolute path, a `..` path and a symlink that leaves the root: `node --test --test-name-pattern "e2e setup path containment" skills/10x-pipeline/test/executors.test.mjs`
- A plan whose Progress headings are not `### Phase N` stays on plain `implement`: `node --test --test-name-pattern "no phase list stays plain" skills/10x-pipeline/test/executors.test.mjs`
- A retry runs at most once: a retry that ends `done` or `blocked` without a commit is a neutral fallback entry (no failure count, no tier bump, no rigor rise), the next step is `impl-review` with the `impl-review-warn` prompt naming the rows (its first part equals the plain impl-review prompt), and a legitimate zero-diff phase does not halt; a retry that ends `failed` counts as a failure: `node --test --test-name-pattern "retry once then warn" skills/10x-pipeline/test/executors.test.mjs`
- Every `--test-name-pattern` gate row of Phase 2 names a test title that exists: `node -e 'import("./skills/10x-pipeline/test/phase-helpers.mjs").then((m) => process.exit(m.gateCheck("context/changes/phase-executors/plan.md", 2)))'`
- The log entry names the executor's skill: `10x-e2e` for an e2e step, `10x-goal-implement` for a segment, plain step and retry: `node --test --test-name-pattern "entry skill names executor" skills/10x-pipeline/test/executors.test.mjs`
- `uncommittedTicks` reaches the `done` output of `next`, the `archive` action summary, `meta.outcome` and the `Ticked without a commit` lines of `report.md` in an `--archive` run: `node --test --test-name-pattern "uncommitted ticks reach outputs" skills/10x-pipeline/test/executors.test.mjs`

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

**Contract**: `executors.tdd` holds `template: "implement-tdd"`, `skill: "10x-tdd"`, `minRigor: "thorough"`, `codeExtensions` (`.mjs .js .ts .tsx .py .go .rs`), `excludeGlobs` (config, docs, CI, lockfiles, same shape as `risk.churn.exclude`), `testWords` (`test`, `vitest`, `jest`, `pytest`) and `uiWords` (`page`, `screen`, `click`, `css`, `visual`, plus the e2e `rowWords`). Prompt `implement-tdd` is an array with `Run /10x-tdd {id} phase {phase}` and `@prompts/executor-tdd.md`. The file repeats the e2e rule set adapted to `/10x-tdd` (stop after `{lastPhase}`, never Skip, manual gate confirmed and not ticked, commit message approved, dirty paths, ambiguous gate) and adds: an implementation that already exists, a missing test runner or a misfit phase ends `blocked` with no `signals.needsHuman`.

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
- The log entry of a tdd step names the skill `10x-tdd`: `node --test --test-name-pattern "tdd entry skill" skills/10x-pipeline/test/executors.test.mjs`
- Every `--test-name-pattern` gate row of Phase 3 names a test title that exists: `node -e 'import("./skills/10x-pipeline/test/phase-helpers.mjs").then((m) => process.exit(m.gateCheck("context/changes/phase-executors/plan.md", 3)))'`

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
- `attachResult` `case "plan"` keyed on the entry template: for `plan-replan` and `plan-rejected`, `plan.hasProgress && mtime > startedAt && plan.autoPending > 0` and `before.done` is a subset of the current done ids. `next()` records `before.done` for both templates (the Phase 1 rule), so the `plan-rejected` check has a baseline too: a REJECTED re-plan starts with every Automated row ticked, and unticking a ticked row to get `autoPending > 0` removes an id of `before.done` and fails the subset test. A re-plan must add a new row and keep every ticked one. An entry with no `before.done` skips only the subset test. `next()` passes `{failure}` to `render`.
- `tierFor` needs no change: step `plan` base plus `d.bump`.

#### 3. Tests and docs line

**File**: `skills/10x-pipeline/test/loops.test.mjs` (the `rejected` block at lines 30-34 only), `skills/10x-pipeline/SKILL.md` (bullet at line 112 only)

**Intent**: Keep the one existing test that the new behavior intentionally changes, and the documented rule, honest.

**Contract**: This is the complete list of existing test edits made in this phase; the only other one is `route.test.mjs:148-165` in Phase 6 (the new budgets break it; see "Key Discoveries", second prototype). The first prototype found no other failure caused by the behavior changes.

| Existing test | Why it is unaffected or how it is edited |
| --- | --- |
| `loops.test.mjs:30-34` (`rejected` block, REJECTED as the first review at `--rigor standard`) | Edited. It now expects step `plan`, entry template `plan-rejected`, entry verdict `REJECTED`. A second project in the same block has a log that already holds an executed `plan-rejected` entry (plan, plan-review, implement, impl-review, plan-rejected, plan-review, implement, impl-review) and a `REJECTED` review: it expects step `fix` with verdict `REJECTED`, as the old assertion did. Nothing else in that test changes. |
| `loops.test.mjs:441-497` (`IMPL` and the three reference paths) | Unedited. Their `REJECTED` is the second review, after a `fix`, so `count("fix") <= rejectedMaxFixes` fails and the path stays `fix`. They have no pending Manual row that is command-checkable (`planText` writes "Look at it"), so no `manual-verify` step appears, and no e2e setup, so no segment appears. Their step counts and `assertFits` stay valid. They read the budget from the policy (`loops.test.mjs:439`), so Phase 6 raising it to 16 and 21 keeps them passing (scratch run, round 2), and the 12 and 16 step paths still leave two spare. |
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
- Full suite passes; the only existing test file changed since `main` is `loops.test.mjs`, in a single hunk inside lines 28-36 (listed in section 3; `route.test.mjs` follows in Phase 6): `node --test skills/10x-pipeline/test/*.test.mjs && (set -e; b="$(git merge-base main HEAD)"; n="$( { git diff --name-only "$b" -- skills/10x-pipeline/test; git ls-files -o --exclude-standard -- skills/10x-pipeline/test; } | sort -u | grep -vE 'test/(executors|codereplan|manualverify|budget-executors)\.test\.mjs|test/phase-helpers\.mjs' || true)"; test "$n" = "skills/10x-pipeline/test/loops.test.mjs"; git diff -U0 "$b" -- skills/10x-pipeline/test/loops.test.mjs | awk '/^@@/{split($2,a,",");s=substr(a[1],2)+0;if(s<28||s>36)bad=1;h++}END{exit(bad||h<1)}')`
- A REJECTED after a `fix` keeps `fix`, a REJECTED re-plan leaves one fix loop, and it needs rigor `standard` or more and enough extra-step pool (at `lean` or with the pool spent it falls to `fix`): `node --test --test-name-pattern "rejected replan gates" skills/10x-pipeline/test/codereplan.test.mjs`
- The `{failure}` text in the `plan-replan` prompt is one line of at most `failureNoteMax` characters: `node --test --test-name-pattern "failure note capped" skills/10x-pipeline/test/codereplan.test.mjs`
- A `plan-rejected` entry records `before.done`; a re-plan that unticks or drops a ticked row to create pending work is unverified, and a re-plan that adds a row and keeps every ticked one is verified: `node --test --test-name-pattern "rejected replan verification" skills/10x-pipeline/test/codereplan.test.mjs`
- Every `--test-name-pattern` gate row of Phase 4 names a test title that exists: `node -e 'import("./skills/10x-pipeline/test/phase-helpers.mjs").then((m) => process.exit(m.gateCheck("context/changes/phase-executors/plan.md", 4)))'`

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

- `manualEligible(row, meta, policy)`: a pending Manual row is eligible when it has no `humanWords` entry (word-start match like `goalPhrase`: a prefix hit only keeps a row pending, the safe direction) and either holds a backtick span whose first word is in `commandWords`, or `meta.chrome === true` and its text has a `browserWords` entry as a whole word (case-insensitive tokens of letters and digits, so `dom` does not match `domain` and `page` does not match `pages`; the list holds the plural forms it wants). Every other row stays in `manualPending` and is never ticked by this step. The plan "marks a row as command-checkable" by writing the command in backticks.
- `manualVerifyNext(plan, log, policy, ctx, meta)` returns `null` or `{ step: "manual-verify", template, bump: 0, reason }`. Conditions: no pending Automated row, at least one eligible pending Manual row, level at or above `manualVerify.minRigor`, executed ok `manual-verify` entries below `maxRuns`, executed `manual-verify` entries (any outcome) below `maxAttempts`, and `extrasLeft >= extraSteps.cost["manual-verify"]`. Template is `manual-verify-chrome` when `meta.chrome === true`. The prompt variable `{unproven}` is the `unproven` ids of the previous attempt, or `none`. Call site: in `decide()` inside the `!irFresh` block, before the impl-review return. Because `lcode` ignores `manual-verify`, the impl-review stays stale and runs next.
- `next()`: the `manual-verify` entry `before` gains `manual` (array of `{id, text, done}` for Manual rows).
- `attachResult` `case "manual-verify"`: the baseline is `before.manual` of the first entry of the trailing streak of `manual-verify` entries, so a tick left by a failed first attempt is judged again by the retry and never becomes the baseline. The step is verified when: no Automated row changed state or text; every baseline Manual row keeps its title (text with a trailing evidence suffix removed equals the baseline text); no row went from done to pending; and every row ticked since the baseline is eligible (by its baseline text) and ends with ` — evidence: <token>` where `<token>` is `evidence/` plus one or more path segments of `[A-Za-z0-9._-]`, has no `..`, and names a file that passes all of: `lstat` of `context/changes/<id>/evidence` says directory and not a symbolic link; the file's `stat` says regular file (`isFile()`, so a directory fails) with size above 0; its `mtimeMs` is above the `startedAt` of the baseline entry (the first entry of the streak, so a retry may rely on a file its first attempt wrote, while a file left by an earlier run does not pass); and `fs.realpathSync(file)` starts with `fs.realpathSync(<change folder>) + path.sep + "evidence" + path.sep` (built from the change folder, not from the evidence folder, so a linked `evidence` cannot widen the target). Several rows may name the same file: one command output can prove several rows, so a distinct-file rule was rejected. Zero ticks is verified. The SHA suffix regex stays distinct. The entry records `ticked` (ids that passed) and `unproven` (ids that did not). Inside the case: `last.fallback = true` when the step is not `ok`, so a failed `manual-verify` is neutral: no failure count, no tier bump, no rigor rise. After `maxAttempts` the run goes on to impl-review whatever the state.
- `doneNotes` (Phase 2) gains `manualUnproven` (the `unproven` ids of the last `manual-verify` entry when it failed and its rows are still ticked), only when not empty; `archiveLines` prints `Manual checks unproven: N` and the ids after `Manual checks pending`. `status` steps gain `ticked` and `unproven` counts for `manual-verify` entries.
- `init`: `--chrome` stores `meta.chrome = true`; `--chrome true`, `--chrome false` as for `--archive`; any other value halts with a usage message; a resume keeps the stored value. The `main()` usage string gains `[--chrome]`. `--chrome` at `lean` is stored and has no effect (the pool is 0).
- `SKILL.md` Start step 1 and `argument-hint`: parse `--chrome`, remove it from the goal text, pass it to `init` only when given. The final message also lists `manualUnproven` and `uncommittedTicks` when present, and the archive step repeats both lists. README arguments line gets `[--chrome]` in Phase 6. The edits keep the `pr-comment.test.mjs` assertions on `SKILL.md` Start step 4 and the PR comment section green.

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
- Full suite passes; no existing test file was edited in this phase (same diff gate as 4.10): `node --test skills/10x-pipeline/test/*.test.mjs && (set -e; b="$(git merge-base main HEAD)"; n="$( { git diff --name-only "$b" -- skills/10x-pipeline/test; git ls-files -o --exclude-standard -- skills/10x-pipeline/test; } | sort -u | grep -vE 'test/(executors|codereplan|manualverify|budget-executors)\.test\.mjs|test/phase-helpers\.mjs' || true)"; test "$n" = "skills/10x-pipeline/test/loops.test.mjs"; git diff -U0 "$b" -- skills/10x-pipeline/test/loops.test.mjs | awk '/^@@/{split($2,a,",");s=substr(a[1],2)+0;if(s<28||s>36)bad=1;h++}END{exit(bad||h<1)}')`
- Only rows with a backticked command (or, with `--chrome`, a browser word) are eligible, and a row with a human word never is: `node --test --test-name-pattern "manual verify eligible rows" skills/10x-pipeline/test/manualverify.test.mjs`
- A first attempt that leaves a bad tick is judged again by the retry against the first-attempt baseline; a failed attempt is neutral (no failure count, no rigor rise), the run goes on to impl-review after `maxAttempts`, and `done` lists `manualUnproven`: `node --test --test-name-pattern "manual verify retry baseline" skills/10x-pipeline/test/manualverify.test.mjs`
- `--chrome foo` halts with a usage message: `node --test --test-name-pattern "chrome flag value" skills/10x-pipeline/test/manualverify.test.mjs`
- Evidence hardening: a symlinked `evidence` folder, a directory in place of a file, a file not newer than the baseline entry's `startedAt` and a `.` segment make the step `ok: false`; a retry may use a file its first attempt wrote: `node --test --test-name-pattern "evidence hardening" skills/10x-pipeline/test/manualverify.test.mjs`
- `manualUnproven` reaches the `done` output of `next`, the `archive` action summary, `meta.outcome` and the `Manual checks unproven` lines of `report.md` in an `--archive` run: `node --test --test-name-pattern "manual unproven reaches outputs" skills/10x-pipeline/test/manualverify.test.mjs`
- Every `--test-name-pattern` gate row of Phase 5 names a test title that exists: `node -e 'import("./skills/10x-pipeline/test/phase-helpers.mjs").then((m) => process.exit(m.gateCheck("context/changes/phase-executors/plan.md", 5)))'`
- With `--chrome`, `browserWords` match whole words: a row with `domain` or `pages` is not browser-eligible, a row with `page` is: `node --test --test-name-pattern "browser words whole word" skills/10x-pipeline/test/manualverify.test.mjs`

#### Manual Verification:

- Run a router-driven `manual-verify` step with `--chrome` on a scratch plan with one browser-checkable Manual row and a connected Chrome extension: confirm the subagent loads the Chrome tools, ticks the row with an evidence suffix and a file under `context/changes/<id>/evidence/`. Record the outcome in the Progress row.
- Run the same step with no Chrome extension connected: confirm it ends `done` with zero ticks and no hang.
- Run a router-driven `manual-verify` step without `--chrome` on a plan whose Manual row a shell command can prove (the row names the command in backticks): confirm one tick with an evidence suffix and that a row needing a person stays pending.

**Implementation Note**: After this phase and its automated checks pass, pause for confirmation before Phase 6.

---

## Phase 6: Budget from the longest legal path, report label, docs and scope gates

### Overview

Set `rigor.budgetDelta` to the smallest values at which the longest legal path of each level fits with one failed step to spare, prove it with a test (and edit the one existing test that pins the old budgets), show a fallback as `fallback` in the report and in `compare`, update every document the tier logic touches, and add the mechanical gates for every "untouched" claim.

### Changes Required:

#### 1. Budget, the edit to `route.test.mjs` and the reference-path test

**File**: `skills/10x-pipeline/policy.json` (`rigor.budgetDelta` values only), `skills/10x-pipeline/test/route.test.mjs` (lines 146-166 only), `skills/10x-pipeline/test/budget-executors.test.mjs`

**Intent**: The longest legal path under the shipped pool completes, the delta is the smallest that fits, an old test that pins the old budgets is brought along, and raising a pool cap makes a test fail.

**Contract**:

- Policy: `rigor.budgetDelta` becomes `standard: 2`, `thorough: 7`; `lean` stays -4.
- Existing test edit (review round 2, F1): `route.test.mjs:148-165` ("step budget differs per level: 10, 14, 18") writes 14 and 18 log entries and expects `Step budget 14 spent` and `Step budget 18 spent`; with the new deltas it fails (`budget 14, 'run' !== 'halt'`, scratch run). Edit it in place: the title becomes "10, 16, 21" and the expected budgets in `cases` (lines 151-152) become 16 and 21. The lean case and the "one entry fewer still runs" half stay. Gate 6.14 allows exactly this hunk range (lines 146-166) and the Phase 4 hunk, nothing else. If the full suite shows a third failing existing test, the implementer stops and reports it; the gate does not let it be edited silently.
- The reference-path test drives the real router. It builds a saturating fixture per path below with `phase-helpers.mjs` (plan builder, e2e setup files, an eligible Manual row, a fixture that commits code after each implement step) and a walker in the style of `loops.test.mjs` (`answer`/`walk`) whose answers lengthen the run: plan review `REVISE` until `maxPlanRevisions` (`RETHINK` where `frame-rethink` applies), the first impl-review `REJECTED`, later reviews `NEEDS ATTENTION` with a critical finding until `maxFixLoops`, then `APPROVED`; every implement step ends `done` with a commit. The fixtures are F-full (phases goal, e2e, pure-logic tdd, goal tail, with an eligible Manual row) and F-rej (two plain phases, REJECTED first). For each level it reads `maxTotalSteps`, `budgetDelta` and the pool from the policy at hand, counts the executed steps of every fixture and asserts `max(steps) === maxTotalSteps + budgetDelta[level] - 2` (the shipped delta is the smallest that leaves one failed step and its retry to spare). It also pins the table below (standard 14, thorough 19) so a drift of the table fails. The paths are produced by the router, not scripted by the test, so a pool cap that is raised changes the count.
- Raised-cap test: the same fixtures run in a scratch project whose override file raises `extraSteps.allowance` by one at `standard` and at `thorough`. The test asserts `max(steps) > maxTotalSteps + shippedDelta - 2` for both levels, so a policy that raises a cap without raising the delta is caught by the first test, and the first test is shown to be able to fail. If the router gives a count different from the table, the implementer sets the delta to `max + 2 - maxTotalSteps`; a delta above +2 at `standard` or +3 above today's `thorough` value is outside the owner limit and stops the phase.

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
- `SKILL.md` "How the tier moves": new bullets for executors, segments and the pool, the fallback (no bump, no rigor rise), the commit check for tdd, e2e and the retry (one retry, then a warning in the impl-review prompt), the code re-plan, `manual-verify`; the final message and the archive step list `manualUnproven` and `uncommittedTicks`; the failure definition bullet notes the commit check. Start step 1 and `argument-hint` mention `--chrome` (done in Phase 5; verify only). No model or tier names beyond what it documents.
- `README.md`: arguments line `[--chrome]`, routing bullets for the same items, a "Phase executors" subsection, the budget lines (reference worst paths per level, the old advice to raise `budgetDelta.standard` to 1 updated), Limits note on Chrome in a subagent, and a Baseline comparison note: the baseline arm runs the same defaults, so for a routing-only comparison add `{"extraSteps": {"allowance": {"lean": 0, "standard": 0, "thorough": 0}}, "codeReplan": {"afterFailures": 0}}` to the baseline override by hand (`baseline-policy.json` itself is not changed, because `compare.test.mjs` pins its keys). The allowance turns off segments, executors, `manual-verify` and the REJECTED re-plan (all metered); `afterFailures` 0 turns off the failure re-plan, which is not metered. The strict commit check, the retry and the fallback act only after an executor step ran, so with the allowance at 0 they never fire. The note lists these remaining items so nobody assumes more.
- `AGENTS.md`: project-structure lines for the four new test files, `phase-helpers.mjs` and the new prompt files; command list gets `init ... [--chrome]`.

#### 4. Scope gates

**File**: Progress rows 6.13-6.16 and 6.19-6.22

**Intent**: Every "untouched" claim in "What We're NOT Doing" has a command that compares the working tree against `git merge-base main HEAD` (no `HEAD` operand, never `HEAD~`) and fails when `merge-base` fails, when the diff it needs is empty or when the pattern gates match no test. Row 6.20 adds the claim round 1 F6 asked for: the branch touches neither `context/archive/` nor `context/foundation/roadmap.md`; the close-out `/10x-archive` step runs after the last row and is not a Progress row.

### Success Criteria:

#### Automated Verification:

- The standard and thorough longest paths fit, and the delta is the smallest that fits: `node --test --test-name-pattern "longest legal path" skills/10x-pipeline/test/budget-executors.test.mjs`
- The failure re-plan path fits: `node --test --test-name-pattern "failure path fits" skills/10x-pipeline/test/budget-executors.test.mjs`
- Existing reference paths pass with only the Phase 4 edit, and the frozen loop tests are byte-identical to `main`: `node --test skills/10x-pipeline/test/loops.test.mjs skills/10x-pipeline/test/loops-existing.test.mjs && git diff --quiet "$(git merge-base main HEAD)" -- skills/10x-pipeline/test/loops-existing.test.mjs`
- ADR rule lines keep the rule form: `node --test --test-name-pattern "ADR" skills/10x-pipeline/test/rules.test.mjs`
- ADR-003 marks the part implemented and has the new section: `grep -c "phase-executors.*implemented" docs/ADR/ADR-003-rigor-gated-routing.md`
- `SKILL.md` and `README.md` each document `--chrome`, `manual-verify`, `plan-replan` and `plan-rejected` (the command names the first missing word): `for f in skills/10x-pipeline/SKILL.md README.md; do for w in "--chrome" "manual-verify" "plan-replan" "plan-rejected"; do grep -qF -e "$w" "$f" || { echo "$f: $w"; exit 1; }; done; done`
- `SKILL.md` names no model: `! grep -iE "opus|sonnet|haiku" skills/10x-pipeline/SKILL.md`
- `AGENTS.md` lists the new test files: `grep -c "executors.test.mjs" AGENTS.md`
- Full suite passes, on Node 18 when it is installed (`fnm exec --using=18 node --test skills/10x-pipeline/test/*.test.mjs`) and on the installed Node otherwise, and the Node 18 ban list finds nothing (record `node --version` in the row): `node --test skills/10x-pipeline/test/*.test.mjs && ! grep -nE 'toSorted|Object\.groupBy|import\.meta\.dirname|\.intersection\(|\.union\(|partialDeepStrictEqual|mock\.timers' skills/10x-pipeline/scripts/route.mjs skills/10x-pipeline/test/*.mjs`
- `init` and `status` against a scratch change folder print valid JSON: `node --test --test-name-pattern "executors smoke" skills/10x-pipeline/test/executors.test.mjs`
- The frozen files are untouched since `main`: `git diff --quiet "$(git merge-base main HEAD)" -- skills/10x-pipeline/test/loops-existing.test.mjs skills/10x-pipeline/test/compare.test.mjs skills/10x-pipeline/test/helpers.mjs skills/10x-pipeline/baseline-policy.json`
- The only existing test files changed since `main` are `loops.test.mjs` (one hunk in lines 28-36) and `route.test.mjs` (hunks in lines 146-166, the budget test): `(set -e; b="$(git merge-base main HEAD)"; n="$( { git diff --name-only "$b" -- skills/10x-pipeline/test; git ls-files -o --exclude-standard -- skills/10x-pipeline/test; } | sort -u | grep -vE 'test/(executors|codereplan|manualverify|budget-executors)\.test\.mjs|test/phase-helpers\.mjs' || true)"; test "$n" = "$(printf 'skills/10x-pipeline/test/loops.test.mjs\nskills/10x-pipeline/test/route.test.mjs')"; git diff -U0 "$b" -- skills/10x-pipeline/test/loops.test.mjs | awk '/^@@/{split($2,a,",");s=substr(a[1],2)+0;if(s<28||s>36)bad=1;h++}END{exit(bad||h<1)}'; git diff -U0 "$b" -- skills/10x-pipeline/test/route.test.mjs | awk '/^@@/{split($2,a,",");s=substr(a[1],2)+0;if(s<146||s>166)bad=1;h++}END{exit(bad||h<1)}')`
- The router's git calls added since `main` use only `rev-parse`, `merge-base` and `log` (same smoke check as 1.11, prints nothing): `(set -e; b="$(git merge-base main HEAD)"; d="$(git diff "$b" -- skills/10x-pipeline/scripts/route.mjs)"; test -n "$d"; a="$(printf '%s\n' "$d" | grep '^+' || true)"; test -z "$(printf '%s\n' "$a" | grep -E '"(add|commit|push|reset|checkout|switch|restore|rebase|cherry-pick|stash|update-ref|clean|fetch|pull)"' || true)"; test -z "$(printf '%s\n' "$a" | grep -E '(runGit|gitOut)\(\[' | grep -vE '"(rev-parse|merge-base|log)"' || true)")`
- `cleanSignals`, `cleanUsage` and `prompts.suffix` are unchanged, and `buildReport` differs only in its Result and Step lines: the command in row 6.16 of `## Progress` (same text; it diffs the two function bodies against `git merge-base main HEAD`, counts changed `buildReport` lines outside the Result and Step lines, and compares `prompts.suffix` through `node -e`)
- A fallback entry reads `fallback` in the report and is not a `compare` failed attempt, and an executor segment shows its template in the Step cell: `node --test --test-name-pattern "report shows fallback" skills/10x-pipeline/test/executors.test.mjs`
- `lean` keeps today's budget and paths: a lean walk with e2e rows, a valid setup, an eligible Manual row and a first-review `REJECTED` has the same steps as a walk without them, and `budgetDelta.lean` is -4: `node --test --test-name-pattern "lean unchanged" skills/10x-pipeline/test/budget-executors.test.mjs`
- A pool cap raised by one through the override file makes the longest walked path exceed `budget - 2` at both levels, so the budget test fails for a policy that raises a cap without raising the delta: `node --test --test-name-pattern "raised cap exceeds budget" skills/10x-pipeline/test/budget-executors.test.mjs`
- The branch touches neither `context/archive/` nor `context/foundation/roadmap.md` (prints nothing, fails when `merge-base` fails; the close-out archive step runs after the last row): `(set -e; b="$(git merge-base main HEAD)"; git diff --quiet "$b" -- context/archive context/foundation/roadmap.md; test -z "$(git ls-files -o --exclude-standard -- context/archive context/foundation/roadmap.md)")`
- Every `--test-name-pattern` gate row of Phase 6, and the gate check itself, name test titles that exist: `node -e 'import("./skills/10x-pipeline/test/phase-helpers.mjs").then((m) => process.exit(m.gateCheck("context/changes/phase-executors/plan.md", 6)))'`
- The README baseline note names the allowance and `afterFailures` overrides: `grep -qF 'extraSteps' README.md && grep -qF 'afterFailures' README.md`

#### Manual Verification:

- A reviewer reads ADR-003, `SKILL.md` and `README.md` side by side and confirms they describe the same executor, fallback, re-plan, manual-verify and budget rules.
- A full router-driven pipeline run on a scratch project (a mixed plan, `--chrome` off) ends `done` with the step log showing the segment templates and the `manual-verify` step. Record the step list in the Progress row.

**Implementation Note**: After this phase and its automated checks pass, run `/10x-impl-review` before archiving.

---

## Testing Strategy

### Unit Tests:

- All router behavior is tested black-box through the CLI in scratch projects (`helpers.mjs` plus `phase-helpers.mjs`), as the existing suite does. Git cases use the hermetic git helpers.
- Edge cases: Skip flip with and without a moved HEAD; a commit that touches only `plan.md`; a SHA suffix for an old commit; no git; a blocked executor with and without `needsHuman`; every row ticked by a Skip flip (the F2 case); exactly two versus three trailing failures; the shared re-plan cap across both triggers; a REJECTED after a fix; a Manual row ticked without a valid evidence file; a symlinked evidence file or `evidence` folder; a directory named as evidence; a stale evidence file; zero ticks; a retry that ends `done` with no commit (one retry, then `impl-review` with the warning); an unknown `before.head` (status 128); a path that starts with `@`; an edited Automated row; the pool at 0, too small and exact.

### Integration Tests:

- `budget-executors.test.mjs` lets the whole router walk saturating fixtures at each level, derives the longest legal path from the policy at hand, proves the budget delta and shows that a raised pool cap breaks the bound. `gateCheck` has its own test (a misspelled pattern, a missing file and an empty phase must fail).

### Manual Testing Steps:

1. Unattended `/10x-e2e` run in a scratch Playwright project, plus one goal-implement segment on a two-phase plan (Phase 2).
2. Unattended `/10x-tdd` run at `thorough` (Phase 3).
3. `manual-verify` with Chrome connected, with Chrome absent, and without `--chrome` (Phase 5).
4. A full mixed-plan pipeline run (Phase 6).

## Performance Considerations

`readPlan` runs several times per `next()`; the added list building is linear in rows. Plain steps add no git call. A strict or retry step costs one `git rev-parse HEAD` at start and, at verification, up to three read-only git calls (`merge-base`, `log`, and the existing helpers). No call when git is missing (null means count rule).

## Migration Notes

Additive log keys only (`before.head`, `before.done`, `before.manual`, `phase`, `lastPhase`, `executor`, `fallback`, `uncommitted`, `retry`, `ticked`, `unproven`) and two optional keys in `meta.outcome` (`manualUnproven`, `uncommittedTicks`), so `compare` (ADR-005) and old logs keep working. An in-flight run resumed on the new router keeps its plain `implement` entries; only new entries carry the keys, and an entry without `before.head` is treated like a null head. `meta.chrome` is optional. A project that overrides `rigor.budgetDelta` keeps its values; with a pool allowance above 0 and an old delta, the budget may halt a run that uses extras, and the ADR says so.

## Assumptions

Decided without a human. Each is also in the ADR-003 section (Phase 6) and is overridable in `context/foundation/agent-smith-policy.json` unless the cost says otherwise.

| # | Assumption | Evidence | Cost to reverse |
| --- | --- | --- | --- |
| 1 | `--chrome` is an `init` flag stored in `meta.json` like `--archive`. The orchestrator does not probe tools. Chrome use in a subagent cannot be tested unattended, so a Manual row covers it. | Research section 5: `parseFlags` is generic; `SKILL.md` `allowed-tools` lacks `ToolSearch`; a subagent saw the tools as deferred, no call was tested. | Low: remove the flag and the chrome template. |
| 2 | `manual-verify` runs from `standard`, once per run (`maxRuns` 1, at most `maxAttempts` 2 including one retry), before the first impl-review pass with an eligible Manual row pending. Zero ticks is `done`. A failed attempt is neutral and the run goes on. | Protects the `lean` budget and the halt rule; a counted failure would retry at higher tiers and raise rigor (research section 5; review F3). | Low: data (`minRigor`, `maxRuns`, `maxAttempts`). |
| 3 | A ticked Manual row carries ` — evidence: evidence/<name>` and the router checks that `context/changes/<id>/evidence/<name>` is a regular, non-empty file written after the baseline step started, that `evidence` is a real directory, and that the file's realpath lies under the realpath of the change folder plus `/evidence/` (no `..`, no absolute path). Size (under 1 MB) is a prompt rule only. The content is not read: a file with junk text passes. The command list includes `sh`, `bash`, `python` and `curl`: the subagent runs the backticked text of `plan.md`, the same trust domain as the plan author. Eligible rows are command-checkable rows (a backticked command, no human word) and, with `--chrome`, browser rows; the lists are uncalibrated. Unproven ticks are listed in `done`, in the `archive` summary and in `report.md` as `manualUnproven`, not undone. | Reviews F3 (rounds 1 and 2, F7, F9); the archive commit takes only the change folder (research section 5). | Medium: reading or hashing evidence content, or an undo of ticks, needs the router to edit `plan.md`, which it never does. |
| 4 | The strict commit check applies to `implement-tdd`, `implement-e2e` and `implement-retry`. Plain `implement` and `implement-segment` keep the count check: `/10x-goal-implement`'s legitimate zero-diff phase ("had no diff to commit") makes any commit check a false failure. Residual risks: a goal-implement phase that ticks rows with no work passes until impl-review; a strict step whose rows stay ticked without a commit gets one retry (Assumption 15), after which the run goes on with a warning. | Research sections 1 and 2 (`10x-goal-implement/SKILL.md:209`, `10x-e2e/SKILL.md:171`); reviews F2 (rounds 1 and 2). | Medium: a commit check on goal-implement plus a policy escape. |
| 5 | Commit evidence is a commit in `before.head..HEAD` that touched at least one path outside `context/changes/<id>/` (project-relative); a suffix SHA must be a prefix of such a commit. An amend or rebase of the old head, or a hook that rewrites commits, reads as a false failure and goes through the retry. A phase that legitimately changes only plan or docs files cannot use the tdd or e2e executors. A commit that touches only docs, lockfiles, `assets/**` or `context/**` is not evidence (the churn exclude globs are reused); one that touches only generated files outside those globs (snapshots, build output) still counts, so this is not a forgery guard. `merge-base --is-ancestor` status 1 is `false`, any other status (128) is `null` (count rule). Paths come from `log -z`. | Reviews F4 (round 1) and F8 (round 2); read-only `log` and `merge-base`. | Low: one function. |
| 6 | The re-plan triggers at exactly two trailing implement failures (rigor `standard` or higher) or at a `REJECTED` impl-review that comes before any `fix` (`rejectedMaxFixes` 0, same rigor gate, pool cost 2), shares one cap of 1 per run, counts against the step budget, uses one of the `maxFixLoops`, and a failed failure-re-plan halts. A blocked tdd or e2e step falls back to goal-implement with no tier bump, no rigor rise and no `needsHuman`. A `REJECTED` after a `fix` keeps today's path (fix again). | Research sections 1, 4; `route.test.mjs:386-400`; the prototype run kept `loops.test.mjs:441-497` valid with this rule. | Low: data (`codeReplan`). Raising `rejectedMaxFixes` makes the three reference paths edit-worthy. |
| 7 | E2E has no rigor gate (`minRigor` `lean`) but needs extra-step allowance, which `lean` does not have, so `lean` runs no executor step; tdd is gated at `thorough`. | `change.md` scope; research section 6; review F5. | Low: data. |
| 8 | One extra-step pool replaces a per-feature cap: allowance lean 0, standard 2, thorough 3; costs segment, e2e, tdd and `manual-verify` 1 each, REJECTED re-plan 2. A goal segment that the pool cannot follow with its special executor is not started (plain `implement` runs the whole plan instead, so the e2e phase then runs under goal-implement). | Review F5 (owner default: delta at most +2 standard, +3 thorough). | Low: data. A larger pool needs a larger `budgetDelta`; the test derives the needed delta. |
| 9 | `rigor.budgetDelta` becomes standard 2 and thorough 7 (budgets 16 and 21); the longest legal path is 14 and 19 steps (Phase 6 table). Failure paths can still end in `Step budget spent`, as they do today. The budget test lets the router walk saturating fixtures; the table is documentation and a pinned value. The new deltas break one existing test, `route.test.mjs:148-165`, edited in Phase 6 (round 2, F1). | Owner default; arithmetic in Phase 6; scratch runs. | Low: data. |
| 10 | A fallback entry is transparent to `trailingFailures`: it neither counts nor ends a streak. | Keeps a fallback from resetting a failure streak. | Low: one helper. |
| 11 | Row keywords, extension lists, test words, command words and human words are uncalibrated, like the churn parameters. A false e2e or tdd pick costs one fallback step; a false manual-verify pick costs one neutral step. | Research section 3 and 6. | Low: data. |
| 12 | Not verified by research or by this plan: a live tdd, e2e or goal-implement run, a real E2E project, any Chrome call, a goal-implement segment that stops after its `{lastPhase}`. The Manual rows cover them. | Research assumptions list. | n/a |
| 13 | Manual rows ticked before a `plan-rejected` re-plan describe the old code and are not repeated (`maxRuns` 1). A project whose Progress headings are not `### Phase N` gets no phase list and plain routing. `--chrome` at `lean` is stored and ignored. | Review F10. | Low. |
| 14 | `baseline-policy.json` is not changed: `compare.test.mjs:23` and `:28` pin its keys. The baseline arm therefore runs the new defaults (segments, `manual-verify`, re-plans) unless the user adds the allowance override by hand (README note). `compare` does not warn when the two arms differ in these features. The report after archive shows the executor only in the Step cell. | Review F9; frozen test. | Medium: edit `compare.test.mjs` and the baseline file together, or add a `compare` warning. |
| 15 | `implement-retry` runs at most once per run (`executors.retry.max` 1). A retry that ends `done` or `blocked` with no commit is a neutral fallback entry; the run goes on to `impl-review`, whose prompt (`impl-review-warn`) names the rows still ticked without a commit, and `done`, the `archive` summary and `report.md` list them as `uncommittedTicks`. A legitimate zero-diff phase therefore never halts. Residual risk: a Skip flip that survives the one retry can pass, with the warning in front of the reviewer, and the reviewer may miss it. A retry that ends `failed` is a failure. | Review round 2 F2; `10x-e2e/SKILL.md:171`, `10x-goal-implement/SKILL.md:209`. | Low: data (`retry.max`; 0 turns the retry off). Halting on the second miss needs a change in `decide()` and its tests. |
| 16 | The output notes `uncommittedTicks` and `manualUnproven` travel through one `doneNotes` helper into the `done` output, the `archive` summary, `meta.outcome` and `report.md` (archive runs, where `manualPending` is listed too). A halt carries neither. | Review round 2 F3 (`route.mjs:191-201`, `:254`, `:1259`, `:1325`, `:1391`). | Low. |
| 17 | `browserWords` match whole words; `humanWords` keep the word-start match (a false hit only keeps a row pending). Several Manual rows may share one evidence file. | Review round 2 F7, F9. | Low: data and one match function. |
| 18 | `gateCheck` is a static check of title literals; a test with a computed title fails it loudly instead of passing it. | Review round 2 F5. | Low. |

## Review Response

Plan review v1 (2026-10-31, verdict REVISE: 2 critical, 5 warnings, 3 observations). Each finding was checked against the code on `phase-executors-plan-review` before a decision. Decisions are also recorded in `reviews/plan-review.md`.

| Finding | Decision | What changed |
| --- | --- | --- |
| F1 critical | Accepted | A prototype run on a scratch copy found one existing test that the new behavior breaks: `loops.test.mjs:16` (block at lines 30-34). The design keeps the other tests valid: a REJECTED re-plans only before any `fix`, and `manual-verify` needs a command-checkable row. Full edit list in Phase 4 section 3. Rows 4.10, 5.10, 6.3 reworded; `helpers.mjs` unchanged. |
| F2 critical | Accepted | A strict step that ticks rows without commit evidence records `uncommitted` ids; `decide()` returns `implement-retry` while those rows are still ticked, even with no pending Automated row. New prompt rules, tests 1.13, 2.13, 2.14. Fix A of the review, built on the segment machinery with the router never editing `plan.md`. |
| F3 warning | Accepted | Eligible-row rule, evidence file existence and containment, first-attempt baseline, neutral failure with one retry, `ticked`/`unproven` in the log, `manualUnproven` in `done`. Opt-in by `--chrome` was not taken: the eligibility rule removes the self-certification of human rows. Rows 5.2, 5.4 reworded, 5.14-5.17 added. |
| F4 warning | Accepted | `commitEvidence` needs a code commit in `before.head..HEAD`; SHA suffix is secondary; ids strip suffixes; null head handled with `== null`. Rows 1.5 reworded, 1.12 added. |
| F5 warning | Accepted | One extra-step pool replaces `maxSegments`; deltas 2 and 7 (rise +2 and +3); lean allowance 0. Longest paths and arithmetic in Phase 6; rows 6.1, 6.2 keep titles, 2.16 and 6.18 added. |
| F6 warning | Accepted | `context/foundation/roadmap.md` restored to `main` on this branch. |
| F7 warning | Accepted | Gate commands against `git merge-base main HEAD` for every "untouched" claim (rows 1.11, 4.10, 5.10, 6.3, 6.13-6.16), per-file keyword greps (6.6), Node 18 handling (6.9). |
| F8 observation | Accepted | `fallback` is set inside `case "implement"` and `case "manual-verify"`; the tail of `attachResult` is untouched. The touch-point list in "Implementation Approach" is now complete instead of "three call sites". |
| F9 observation | Accepted in part | (b) done: report shows `fallback` and the template, `compare` does not count a fallback as failed (Phase 6 section 2). (a) rejected as a code change: pinning the baseline needs edits to the frozen `compare.test.mjs`; recorded as Assumption 14 with a README note. |
| F10 observation | Accepted, one item rejected | Done: `e2eSetup` containment, `{failure}` cap and one-line, `evidenceDir` key dropped, `--chrome` value check and usage string, `Faza` headings stated, goal-implement stop-rule observation added to 2.12, `plan-rejected` and manual ticks stated (Assumption 13). Rejected: the "fallback loops forever" worry (the review itself shows it does not hold). |

Progress rows reworded (title changed because the old title would be false or unpassable): 1.5, 4.10, 5.2, 5.4, 5.10, 6.3, 6.6, 6.9. Row 1.10 kept its title in round 1 with a note; round 2 rewords it. New rows use the next free index in their phase, so no existing row was renumbered.

### Round 2

Plan review round 2 (2026-10-31, verdict REVISE: 1 critical, 5 warnings, 3 observations, `reviews/plan-review-2.md`). Each finding was re-checked against the code on `phase-executors-plan-v3` (from `phase-executors-plan-review-2`) before a decision. One scratch experiment was run and deleted: a copy of `skills/`, `README.md`, `AGENTS.md` and `docs/` with only `rigor.budgetDelta` changed to 2 and 7 failed one test of 324, `route.test.mjs:148`, which confirms F1. Decisions are also recorded in `reviews/plan-review-2.md`.

| Finding | Decision | What changed |
| --- | --- | --- |
| F1 critical | Accepted | `route.test.mjs:148-165` joins the list of existing test edits (Phase 6 section 1; title and budgets 16 and 21). Gates 4.10 and 5.10 allow `loops.test.mjs` only, one hunk in lines 28-36; gate 6.14 allows exactly `loops.test.mjs` and `route.test.mjs` (hunks in lines 146-166) and also catches untracked new files. "What We're NOT Doing" and Key Discoveries state the union of two experiments and why a combined run is not possible before the code exists. |
| F2 warning | Accepted, with a change to the review's Fix A | `implement-retry` runs at most once (`executors.retry.max`). A retry ending `done` or `blocked` without a commit is a neutral fallback entry, so a legitimate zero-diff phase does not halt and a failed retry does not trigger the failure re-plan. The next step is `impl-review` with the new `impl-review-warn` prompt naming the rows; `done`, the archive summary and `report.md` list them as `uncommittedTicks`. Residual risk: a Skip flip can pass after one retry, with the warning in front of the reviewer (Assumption 15). Rows 2.13 reworded; 2.19, 2.22 added. |
| F3 warning | Accepted | One `doneNotes` helper is spread into the `decide()` return, the `next()` done object, `archiveDone` (`finishRun` argument and `summary`), `finishRun` (`meta.outcome`) and `archiveLines` (`Manual checks unproven`, `Ticked without a commit`). Phase 2 builds it for `uncommittedTicks`, Phase 5 adds `manualUnproven`. A halt carries neither key. `SKILL.md` prints both. Rows 2.22 and 5.18 added; the touch-point list names all five sites. |
| F4 warning | Accepted | The budget test lets the router walk saturating fixtures (F-full, F-rej) per level and asserts `max(steps) === budget - 2` from the policy at hand; a second run with a pool cap raised by one through the override file must exceed that bound (row 6.19). The table stays as documentation and a pinned value. |
| F5 warning | Accepted | `gateCheck` (in `phase-helpers.mjs`) runs per phase (rows 1.14, 2.20, 3.12, 4.15, 5.19, 6.21) and fails unless the phase has pattern rows and each pattern names a literal test title in an existing file; its own test proves it fails on a misspelled pattern, a missing file and an empty phase. The ~70 pattern rows keep their titles. Every `git diff` gate drops `HEAD`, fails when `merge-base` fails, and the test-scope gates include untracked files. The git-subcommand rows 1.11 and 6.15 also reject an added write-subcommand string and are named a smoke check; row 1.10 names the real list. |
| F6 warning | Accepted | `next()` records `before.done` for `plan-replan` and `plan-rejected` entries; the `case "plan"` subset test has a baseline, so a REJECTED re-plan cannot pass by unticking a ticked row. Row 4.14 added. |
| F7 observation | Accepted in part | Added: `evidence` must be a real directory (`lstat`), the target must be a regular file, its realpath is compared with the realpath of the change folder plus `/evidence/`, and its `mtime` must be above the baseline entry's `startedAt` (row 5.17). Rejected: one distinct file per row; a single command output can legitimately prove several rows, and the false failure is neutral but noisy. |
| F8 observation | Accepted | `merge-base --is-ancestor` status 1 is `false`, any other status is `null`; `log -z` with `\x01` record marks; the churn exclude globs keep docs, lockfiles and `context/**` from counting as evidence; Assumption 5 names the generated-file residual. Row 1.15 added. |
| F9 observation | Accepted, one part narrowed | Done: row 1.10 reworded (false sentence); row 2.5 reworded ("pool", not "cap"); stale row numbers fixed; `skill` keys in the policy and row 2.21, 3.11; README baseline note lists `codeReplan.afterFailures` and what stays active (row 6.22); `browserWords` match whole words (row 5.20); roadmap and archive gate (row 6.20); trust note on the `manual-verify` command list (Assumption 3). Narrowed: `humanWords` keep the word-start match, because a prefix hit only keeps a row pending, which is the safe direction (Assumption 17). |

Progress rows reworded in round 2 (title or command changed because the old one was false, unpassable or vacuous): 1.10, 1.11, 2.5, 2.13, 4.10, 5.10, 6.3, 6.13, 6.14, 6.15, 6.16. New rows: 1.14, 1.15, 2.19-2.22, 3.11, 3.12, 4.14, 4.15, 5.17-5.20, 6.19-6.22. No row was renumbered.

## Implementation Notes

Written during implementation (unattended). Row titles are not changed; where a row command changed, the line says so. Binding amendments come from plan review round 3 (`reviews/plan-review-3.md`, verdict SOUND).

### Round 3 amendments

- **W1 (applied, Phase 1)**: the `git log -z` chunk after the SHA starts with `\0`, then `\n`, not `\n`. `commitEvidence` strips `^\0?\n?` from each chunk, splits on `\0`, trims a leading `\n` from every item and drops empty items. Real output was checked in a scratch repo: an empty commit gives `\x01<sha>\x01\0`, a commit with files gives `\x01<sha>\x01\0\n<path>\0...`. Row 1.12 (a commit that touches only `plan.md`) and row 1.15 (a docs, lockfile and change-folder commit whose first path is a change folder file) both fail when the old recipe is put back; this was checked by mutation.
- **W2 (applied, Phase 1)**: `gateCheck(planPath, phase, cwd?)` returns the integer 0 or 1, prints the first problem to stderr and returns nothing else. The meta-test "gate check fails when nothing is checked" runs the real command line (`node -e 'import(...).then((m) => process.exit(m.gateCheck(...)))'` through `child_process`) against broken fixture plans (misspelled pattern, missing file, no pattern row, regex metacharacter, empty pattern, unknown phase, unreadable plan) and expects status 1, and against a valid fixture and the real plan and expects 0. The real-plan check is skipped when `context/changes/phase-executors/plan.md` no longer exists (after the close-out archive). It lists the phases whose tests exist; each later phase adds its number to that list.
- **O1 (applied)**: the loop-test hunk gate in rows 4.10, 5.10 and 6.14 (and the same command in the Phase 4, 5 and 6 criteria) now ends with `exit(bad||h<1)` instead of `exit(bad||h!=1)`. Every hunk must still start in lines 28-36, and the file must have at least one hunk, so two contiguous-but-split hunks of a correct edit no longer fail the gate.
- **O2 (noted)**: `archiveLines` returns `[]` unless `meta.archive === true`, so `report.md` carries `uncommittedTicks` and `manualUnproven` only in `--archive` runs. Without `--archive` they reach the `done` output and `meta.outcome`. The Phase 2 text on `report.md` therefore means an `--archive` run; the `SKILL.md` final message of the plain `done` branch must print both lists (Phase 5/6 edit), and the edits keep one `TaskList`, one subject and one `PR comment` step per `SKILL.md` branch (`pr-comment.test.mjs`).
- **O3 (noted)**: rows 1.11 and 6.15 reject any added line of `route.mjs` with a quoted `"add"`, `"commit"`, `"clean"`, `"fetch"`, `"reset"` and similar, even when it is not a git argument. Reword such a line instead of weakening the gate (none exists after Phases 1 and 2). Row 6.16 allows only the `const result = ` line and the row-template line of `buildReport` to differ: inline the fallback label and the Step cell, no helper `const`.
- **O4, O5**: no change, as the review says.

### Deviations and decisions

- **Phase 1, retry without a check**: for a retry entry whose `commitEvidence` is `null` (no git, unknown commit) the plan says "the count rule applies". A retry sets its rows back to `[ ]` and ticks them again, so `autoDone` ends equal to `before.autoDone` and the count rule could never pass. `verifyImplement` uses "every row of the entry's `retry` list is ticked again" for that case. A retry only exists after `uncommitted` ids were recorded, which needs git, so the case is rare.
- **Phase 1, in-flight entries**: `newlyTicked(undefined, plan)` returns `[]`, so an entry without `before.done` records no `uncommitted` ids and checks no SHA suffix (the plan says the Phase 4 subset test is skipped for it; this keeps the same rule for Phase 1).
- **Phase 2, docs deferred**: `SKILL.md` "How the tier moves", the `README.md` routing bullets and `AGENTS.md` are not touched in Phase 2, as the plan assigns them to Phase 6. The only tier-logic edit is the `d.interactive` term at the effort-floor test of `tierFor`; `pr-comment.test.mjs` stays green.
- **Phase 2, fixtures**: the e2e fixtures (`e2eProject`, `writeSetup`, `planWith`, `advance`) live in `executors.test.mjs`, not in `phase-helpers.mjs`, which stays as Phase 1 left it. `helpers.mjs` is untouched.
- **Phase 2, pool arithmetic**: `extraCost` is 0 for a template without a positive integer cost, and `executorNext` also needs a positive allowance, so a non-positive allowance turns the executors off even when a cost is 0. The pool must cover the whole route: one cost when the first pending phase is special, the goal segment plus the e2e cost when a goal segment must precede it.
- **Phase 2, e2e prompt wording**: `/10x-e2e` has no option labelled "stop here". Its next-phase question offers Continue, Start a fresh session first and Review this phase first, so `executor-e2e.md` names "Start a fresh session first" as the example of the option that stops, and forbids the clipboard step. The skill's own label is "Skip — already done" (em dash); the prompt writes "Skip - already done" as the plan does and forbids the option by that name.
- **Phase 2, retry fallback**: a retry that ends `done` or `blocked` with rows still ticked and no commit records those rows as `uncommitted` on its own entry too, so `unprovenTicks` keeps them and the `done` output lists them once. Test "retry once then warn" shows the neutral fallback does not raise rigor and a `failed` retry does (the third failure of the seeded log gives `thorough`).
- **Phase 3, executorNext signature**: `executorNext` takes the plan file path as a sixth argument (`p.plan`, one token added to the call in `decide()`), because `phaseFiles` reads the descriptive `## Phase N:` blocks, which `readPlan` does not keep. The tdd file list is read only when `executors.tdd` is a policy object; `pureLogicPhase` checks the rigor gate first. `executors.tdd.uiWords` lists the e2e `rowWords` inline (data, not a reference), and `excludeGlobs` also lists `**/*.json`, `**/*.yml`, `**/*.yaml`, `.github/**` and `.claude/**` beside the churn-exclude shape. The test "e2e wins over tdd" loosens `uiWords` through the override file, because under the shipped lists a phase with an e2e row word always carries a tdd UI word and the two predicates never both hold.
- **Phase 3, tdd prompt**: `/10x-tdd` has no "stop here" label either. Its next-phase question offers Continue, Clear context first and Review this phase first, so `executor-tdd.md` names "Clear context first" as the example of the option that stops, and its redirect rule covers the existing-implementation stop, a missing test runner and the not-TDD-able question.
- **Phase 4, failed plan-replan halt position**: the halt for a failed `plan-replan` sits before the pending-row branch of `decide()`, not inside it. A re-plan that ticked every row has no pending Automated row, so inside the branch the run would have gone on to impl-review instead of halting. A resume repeats the halt while the failed entry is the last executed one; a human who fixes the plan must start a new run or accept the repeat.
- **Phase 4, existing tests touched**: besides the planned `loops.test.mjs` hunk (the REJECTED case now expects `plan-rejected`, with a second project showing a REJECTED after an executed re-plan keeps `fix`), the test "retry once then warn" in `executors.test.mjs` (a Phase 1-2 file) seeds two trailing failures, which the failure re-plan now takes before the retry. It passes `policy: { codeReplan: { max: 0 } }` so that test stays about the retry. The meta-test of the gate rows lists phase 4 too.
- **Phase 4, entry fields**: `codeReplanNext` also returns `bumpWhy: "code re-plan"` (shown in `tierWhy`) and `next()` passes `failure` to `render` (an empty string for every other step). A note with no text renders as `no note`. A failed `plan-rejected` entry needs no code: the REJECTED review is still there, `count("plan-rejected")` has taken the cap, so `decide()` falls through to `fix`.
- **Phase 4, SKILL.md**: only the REJECTED bullet of "How the tier moves" changed; the README routing bullets, `AGENTS.md` and ADR-003 stay for Phase 6.
- **Phase 5, retry trigger**: the plan says the step runs when "at least one eligible Manual row is pending". The router also retries when the last failed attempt left rows ticked without valid evidence (`manualUnprovenIds`), even if no eligible pending row remains. Without this a lone bad tick, whose row is no longer pending, could never be re-judged. The attempt limits (`maxRuns`, `maxAttempts`) and the pool still bound it.
- **Phase 5, pool cost**: `extrasLeft` keys the cost of a manual-verify entry on the step name, not the template, so the `manual-verify-chrome` template costs the same 1 as `manual-verify`.
- **Phase 5, baseline fields**: a pending `manual-verify` entry records `before.manual` (id, text, done of every Manual row) and also `before.auto` (the same for Automated rows). `before.auto` is an addition to the plan: the check "Automated row unchanged" needs the original text and state of those rows. A retry is judged against the first entry of the trailing streak of manual-verify entries, so a bad tick left by attempt 1 fails attempt 2 again unless it gets valid evidence.
- **Phase 5, tests**: the existing test file edit is one list, `[1, 2, 3, 4]` to `[1, 2, 3, 4, 5]`, in the meta-test "gate check fails when nothing is checked" of `executors.test.mjs` (a file the diff gates exempt). No other existing test changed in this phase.
- **Gate rows in the agent harness**: the harness of the unattended run refuses compound shell commands that name git, so the git gate rows (1.11 and the later `merge-base` gates) were run from a saved script that holds the exact command text. The command in the row is unchanged.

## References

- Related research: `context/changes/phase-executors/research.md`
- Plan review: `context/changes/phase-executors/reviews/plan-review.md`, round 2: `context/changes/phase-executors/reviews/plan-review-2.md`
- Change scope: `context/changes/phase-executors/change.md`
- Pattern to copy: `skills/10x-pipeline/scripts/route.mjs:887-993` (`preplanNext`, `replanNext`)
- Pre-plan plan for the same style: `context/archive/2026-10-30-pre-plan-steps/plan.md`
- ADR-003 `docs/ADR/ADR-003-rigor-gated-routing.md:24`, `:252-261`; ADR-004 (rule form); ADR-005 (additive log keys)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Commit verification and neutral fallback

#### Automated

- [x] 1.1 Existing suite stays green with no test edit: `node --test skills/10x-pipeline/test/*.test.mjs` — b3befe0
- [x] 1.2 Plain implement keeps the count rule (a flipped row without a commit stays `ok`): `node --test --test-name-pattern "plain implement keeps count rule" skills/10x-pipeline/test/executors.test.mjs` — b3befe0
- [x] 1.3 A tdd or e2e step that ticks rows with no new commit and no SHA suffix is `ok: false, verified: false`: `node --test --test-name-pattern "strict verify rejects skip flip" skills/10x-pipeline/test/executors.test.mjs` — b3befe0
- [x] 1.4 A tdd or e2e step with a commit since `before.head` is `ok: true`: `node --test --test-name-pattern "strict verify accepts new commit" skills/10x-pipeline/test/executors.test.mjs` — b3befe0
- [x] 1.5 A SHA suffix alone never passes: a code commit in `before.head..HEAD` is required, and a suffix outside that range fails: `node --test --test-name-pattern "strict verify checks sha suffix" skills/10x-pipeline/test/executors.test.mjs` — b3befe0
- [x] 1.6 Without git the strict check falls back to the count rule: `node --test --test-name-pattern "strict verify without git" skills/10x-pipeline/test/executors.test.mjs` — b3befe0
- [x] 1.7 A blocked tdd or e2e entry is a fallback: not counted by `trailingFailures`, no rigor rise, next tier not bumped: `node --test --test-name-pattern "fallback is neutral" skills/10x-pipeline/test/executors.test.mjs` — b3befe0
- [x] 1.8 A blocked entry of plain implement is still a failure, and `needsHuman` from an executor entry still halts: `node --test --test-name-pattern "blocked plain implement fails" skills/10x-pipeline/test/executors.test.mjs` — b3befe0
- [x] 1.9 New entries record `before.head` and `before.done`, and `status` prints `template`: `node --test --test-name-pattern "entry records before state" skills/10x-pipeline/test/executors.test.mjs` — b3befe0
- [x] 1.11 The router's new git calls use only `rev-parse`, `merge-base` and `log`; smoke check on the working-tree diff against `merge-base` that fails on an empty diff or an added write-subcommand string (prints nothing; re-run as 6.15): `(set -e; b="$(git merge-base main HEAD)"; d="$(git diff "$b" -- skills/10x-pipeline/scripts/route.mjs)"; test -n "$d"; a="$(printf '%s\n' "$d" | grep '^+' || true)"; test -z "$(printf '%s\n' "$a" | grep -E '"(add|commit|push|reset|checkout|switch|restore|rebase|cherry-pick|stash|update-ref|clean|fetch|pull)"' || true)"; test -z "$(printf '%s\n' "$a" | grep -E '(runGit|gitOut)\(\[' | grep -vE '"(rev-parse|merge-base|log)"' || true)")` — b3befe0
- [x] 1.12 A commit that touches only `plan.md` or the change folder is no evidence, and an entry with no `before.head` is treated like a null head: `node --test --test-name-pattern "strict verify rejects forged evidence" skills/10x-pipeline/test/executors.test.mjs` — b3befe0
- [x] 1.13 A strict step that ticked rows without evidence records them as `uncommitted`: `node --test --test-name-pattern "strict failure records uncommitted" skills/10x-pipeline/test/executors.test.mjs` — b3befe0
- [x] 1.14 Every `--test-name-pattern` gate row of Phase 1 names a test title that exists, and the check itself fails on a misspelled pattern, a missing file or a phase with no pattern row: `node -e 'import("./skills/10x-pipeline/test/phase-helpers.mjs").then((m) => process.exit(m.gateCheck("context/changes/phase-executors/plan.md", 1)))' && node --test --test-name-pattern "gate check fails when nothing is checked" skills/10x-pipeline/test/executors.test.mjs` — b3befe0
- [x] 1.15 `commitEvidence` maps `merge-base --is-ancestor` status 1 to `false` and any other status (an unknown 40-hex `before.head`) to `null` (count rule), reads a path that starts with `@` or holds a space intact, and ignores a commit that touches only docs, a lockfile or the change folder: `node --test --test-name-pattern "strict verify git edge cases" skills/10x-pipeline/test/executors.test.mjs` — b3befe0

#### Manual

- [ ] 1.10 A reviewer confirms by reading the diff that the router's git use in this phase is limited to `rev-parse`, `merge-base --is-ancestor` and `log` (not only the lines the smoke check 1.11 matches), and that `readPlan` kept every existing field type.

### Phase 2: Phase list routing with `/10x-e2e`, segments and the retry

#### Automated

- [x] 2.1 `e2eSetup` hits only when the section has `config` and `seed` paths that exist: `node --test --test-name-pattern "e2e setup predicate" skills/10x-pipeline/test/executors.test.mjs` — f5c881a
- [x] 2.2 A plan with no browser rows gets the plain `implement` prompt, byte-identical to the policy text plus suffix: `node --test --test-name-pattern "no e2e rows keeps plain prompt" skills/10x-pipeline/test/executors.test.mjs` — f5c881a
- [x] 2.3 Browser rows with setup route that phase to `implement-e2e` with `{phase}` and `{lastPhase}` filled and `executor: "e2e"` in the entry: `node --test --test-name-pattern "e2e phase routes to e2e" skills/10x-pipeline/test/executors.test.mjs` — f5c881a
- [x] 2.4 Browser rows without setup stay on plain `implement`: `node --test --test-name-pattern "e2e rows without setup" skills/10x-pipeline/test/executors.test.mjs` — f5c881a
- [x] 2.5 A goal, e2e, goal plan runs `implement-segment` for phase 1, then `implement-e2e` for phase 2, then plain `implement` once the extra-step pool is spent: `node --test --test-name-pattern "mixed plan segments" skills/10x-pipeline/test/executors.test.mjs` — f5c881a
- [x] 2.6 A blocked e2e entry is not repeated for that phase, the next step is goal-implement at an unchanged tier with rigor unchanged: `node --test --test-name-pattern "e2e blocked falls back" skills/10x-pipeline/test/executors.test.mjs` — f5c881a
- [x] 2.7 An unverified e2e entry (Skip flip) is not repeated for that phase and the next attempt is one tier higher: `node --test --test-name-pattern "e2e failed not repeated" skills/10x-pipeline/test/executors.test.mjs` — f5c881a
- [x] 2.8 `implement-e2e` never runs below the effort floor of the rigor level: `node --test --test-name-pattern "e2e effort floor" skills/10x-pipeline/test/executors.test.mjs` — f5c881a
- [x] 2.9 Prompts keep the rule form and the new prompt file is listed as wired: `node --test skills/10x-pipeline/test/rules.test.mjs skills/10x-pipeline/test/preplan.test.mjs` — f5c881a
- [x] 2.10 The rendered e2e prompt names the stop phase, forbids Skip and ends `blocked` on a redirect: `node --test --test-name-pattern "e2e prompt rules" skills/10x-pipeline/test/executors.test.mjs` — f5c881a
- [x] 2.11 Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs` — f5c881a
- [x] 2.13 With every Automated row ticked by a Skip flip and the last `implement` entry `ok:false` with `uncommitted` ids, the next step is `implement-retry`, not `impl-review`; the retry prompt names the rows; a retry with a code commit is `ok`: `node --test --test-name-pattern "retry after uncommitted ticks" skills/10x-pipeline/test/executors.test.mjs` — f5c881a
- [x] 2.14 The retry prompt tells the subagent to set the named rows back to `[ ]` first and never to tick unfinished work: `node --test --test-name-pattern "retry prompt rules" skills/10x-pipeline/test/executors.test.mjs` — f5c881a
- [x] 2.15 With the extra-step pool spent, or too small to follow a goal segment with its special executor, the router returns plain `implement`: `node --test --test-name-pattern "extra steps pool" skills/10x-pipeline/test/executors.test.mjs` — f5c881a
- [x] 2.16 At `lean` a plan with e2e rows and a valid setup still gets the plain `implement` prompt, the lean budget stays 10 and a `lean` walk is the same as without the feature: `node --test --test-name-pattern "lean keeps plain implement" skills/10x-pipeline/test/executors.test.mjs` — f5c881a
- [x] 2.17 `e2eSetup` rejects an absolute path, a `..` path and a symlink that leaves the root: `node --test --test-name-pattern "e2e setup path containment" skills/10x-pipeline/test/executors.test.mjs` — f5c881a
- [x] 2.18 A plan whose Progress headings are not `### Phase N` stays on plain `implement`: `node --test --test-name-pattern "no phase list stays plain" skills/10x-pipeline/test/executors.test.mjs` — f5c881a
- [x] 2.19 A retry runs at most once: a retry that ends `done` or `blocked` without a commit is a neutral fallback entry (no failure count, no tier bump, no rigor rise), the next step is `impl-review` with the `impl-review-warn` prompt naming the rows (its first part equals the plain impl-review prompt), and a legitimate zero-diff phase does not halt; a retry that ends `failed` counts as a failure: `node --test --test-name-pattern "retry once then warn" skills/10x-pipeline/test/executors.test.mjs` — f5c881a
- [x] 2.20 Every `--test-name-pattern` gate row of Phase 2 names a test title that exists: `node -e 'import("./skills/10x-pipeline/test/phase-helpers.mjs").then((m) => process.exit(m.gateCheck("context/changes/phase-executors/plan.md", 2)))'` — f5c881a
- [x] 2.21 The log entry names the executor's skill: `10x-e2e` for an e2e step, `10x-goal-implement` for a segment, plain step and retry: `node --test --test-name-pattern "entry skill names executor" skills/10x-pipeline/test/executors.test.mjs` — f5c881a
- [x] 2.22 `uncommittedTicks` reaches the `done` output of `next`, the `archive` action summary, `meta.outcome` and the `Ticked without a commit` lines of `report.md` in an `--archive` run: `node --test --test-name-pattern "uncommitted ticks reach outputs" skills/10x-pipeline/test/executors.test.mjs` — f5c881a

#### Manual

- [ ] 2.12 Run `/10x-e2e` unattended in a scratch project with Playwright set up (`/10x-e2e-setup` done) and a two-phase plan whose phase 2 is browser-level, through the router: the e2e step stops after its phase, never picks "Skip", ends `done` with a new commit, or ends `blocked` without a question left waiting. Record the result in the Progress row. Also run a goal-implement segment on a two-phase plan and note whether it stops after its `{lastPhase}`.

### Phase 3: `/10x-tdd` for pure-logic phases at thorough

#### Automated

- [x] 3.1 `phaseFiles` reads `**File**` and `**Files**` lines per phase, English and Polish headings: `node --test --test-name-pattern "phase files reader" skills/10x-pipeline/test/executors.test.mjs` — f6b9247
- [x] 3.2 A pure-logic phase at thorough routes to `implement-tdd`: `node --test --test-name-pattern "tdd phase at thorough" skills/10x-pipeline/test/executors.test.mjs` — f6b9247
- [x] 3.3 The same plan at standard and lean stays on goal-implement: `node --test --test-name-pattern "tdd gated by rigor" skills/10x-pipeline/test/executors.test.mjs` — f6b9247
- [x] 3.4 Each predicate condition alone blocks tdd (a doc path, a config glob, a ticked row, a UI word, a row with no test command): `node --test --test-name-pattern "tdd predicate rejects" skills/10x-pipeline/test/executors.test.mjs` — f6b9247
- [x] 3.5 A phase that satisfies both predicates goes to e2e: `node --test --test-name-pattern "e2e wins over tdd" skills/10x-pipeline/test/executors.test.mjs` — f6b9247
- [x] 3.6 A blocked tdd entry falls back to goal-implement with no tier bump and no `needsHuman`: `node --test --test-name-pattern "tdd blocked falls back" skills/10x-pipeline/test/executors.test.mjs` — f6b9247
- [x] 3.7 The rendered tdd prompt names the stop phase, forbids Skip and ends `blocked` on a redirect: `node --test --test-name-pattern "tdd prompt rules" skills/10x-pipeline/test/executors.test.mjs` — f6b9247
- [x] 3.8 Prompt rule form and wiring tests pass: `node --test skills/10x-pipeline/test/rules.test.mjs skills/10x-pipeline/test/preplan.test.mjs` — f6b9247
- [x] 3.9 Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs` — f6b9247
- [x] 3.11 The log entry of a tdd step names the skill `10x-tdd`: `node --test --test-name-pattern "tdd entry skill" skills/10x-pipeline/test/executors.test.mjs` — f6b9247
- [x] 3.12 Every `--test-name-pattern` gate row of Phase 3 names a test title that exists: `node -e 'import("./skills/10x-pipeline/test/phase-helpers.mjs").then((m) => process.exit(m.gateCheck("context/changes/phase-executors/plan.md", 3)))'` — f6b9247

#### Manual

- [ ] 3.10 Run `/10x-tdd` unattended at `--rigor thorough` in a scratch project with a test runner and one pure-logic phase, through the router: the tdd step stops after its phase, never picks "Skip", commits, or ends `blocked`. Record the result in the Progress row.

### Phase 4: Re-plan after repeated failures or REJECTED

#### Automated

- [x] 4.1 Two trailing implement failures route to `plan-replan` with the failure note in the prompt: `node --test --test-name-pattern "two failures replan" skills/10x-pipeline/test/codereplan.test.mjs` — 5a7f874
- [x] 4.2 Three trailing failures still halt (existing test), and with the cap used the third attempt runs as today: `node --test --test-name-pattern "cap used keeps third attempt" skills/10x-pipeline/test/codereplan.test.mjs` — 5a7f874
- [x] 4.3 A re-plan that unticks or drops a ticked row, or leaves no pending Automated row, is unverified: `node --test --test-name-pattern "replan verification" skills/10x-pipeline/test/codereplan.test.mjs` — 5a7f874
- [x] 4.4 A failed `plan-replan` halts for a human: `node --test --test-name-pattern "failed replan halts" skills/10x-pipeline/test/codereplan.test.mjs` — 5a7f874
- [x] 4.5 After a verified re-plan, plan review reruns and the next implement starts at 0 failures: `node --test --test-name-pattern "replan then review then implement" skills/10x-pipeline/test/codereplan.test.mjs` — 5a7f874
- [x] 4.6 The first `REJECTED` routes to `plan-rejected` at the plan tier plus `rejectedBump`; the second falls to `fix`; the shared cap holds across both triggers: `node --test --test-name-pattern "rejected replan once" skills/10x-pipeline/test/codereplan.test.mjs` — 5a7f874
- [x] 4.7 Setting `codeReplan.max` or `afterFailures` to 0 restores today's behavior for the trigger: `node --test --test-name-pattern "replan disabled by policy" skills/10x-pipeline/test/codereplan.test.mjs` — 5a7f874
- [x] 4.8 A fallback entry does not count toward the two trailing failures: `node --test --test-name-pattern "fallback not counted for replan" skills/10x-pipeline/test/codereplan.test.mjs` — 5a7f874
- [x] 4.9 Prompt rule form tests pass: `node --test skills/10x-pipeline/test/rules.test.mjs` — 5a7f874
- [x] 4.10 Full suite passes; the only existing test file changed since `main` is `loops.test.mjs`, in a single hunk inside lines 28-36 (listed in section 3; `route.test.mjs` follows in Phase 6): `node --test skills/10x-pipeline/test/*.test.mjs && (set -e; b="$(git merge-base main HEAD)"; n="$( { git diff --name-only "$b" -- skills/10x-pipeline/test; git ls-files -o --exclude-standard -- skills/10x-pipeline/test; } | sort -u | grep -vE 'test/(executors|codereplan|manualverify|budget-executors)\.test\.mjs|test/phase-helpers\.mjs' || true)"; test "$n" = "skills/10x-pipeline/test/loops.test.mjs"; git diff -U0 "$b" -- skills/10x-pipeline/test/loops.test.mjs | awk '/^@@/{split($2,a,",");s=substr(a[1],2)+0;if(s<28||s>36)bad=1;h++}END{exit(bad||h<1)}')` — 5a7f874
- [x] 4.12 A REJECTED after a `fix` keeps `fix`, a REJECTED re-plan leaves one fix loop, and it needs rigor `standard` or more and enough extra-step pool (at `lean` or with the pool spent it falls to `fix`): `node --test --test-name-pattern "rejected replan gates" skills/10x-pipeline/test/codereplan.test.mjs` — 5a7f874
- [x] 4.13 The `{failure}` text in the `plan-replan` prompt is one line of at most `failureNoteMax` characters: `node --test --test-name-pattern "failure note capped" skills/10x-pipeline/test/codereplan.test.mjs` — 5a7f874
- [x] 4.14 A `plan-rejected` entry records `before.done`; a re-plan that unticks or drops a ticked row to create pending work is unverified, and a re-plan that adds a row and keeps every ticked one is verified: `node --test --test-name-pattern "rejected replan verification" skills/10x-pipeline/test/codereplan.test.mjs` — 5a7f874
- [x] 4.15 Every `--test-name-pattern` gate row of Phase 4 names a test title that exists: `node -e 'import("./skills/10x-pipeline/test/phase-helpers.mjs").then((m) => process.exit(m.gateCheck("context/changes/phase-executors/plan.md", 4)))'` — 5a7f874

#### Manual

- [ ] 4.11 A reviewer reads the `plan-replan` and `plan-rejected` prompts and confirms that each rule can be followed by a subagent that cannot ask questions.

### Phase 5: `manual-verify` step and `--chrome`

#### Automated

- [x] 5.1 The step runs once before the first impl-review when an eligible Manual row is pending at standard, and not at lean: `node --test --test-name-pattern "manual verify placement" skills/10x-pipeline/test/manualverify.test.mjs` — d693d2c
- [x] 5.2 It does not run when no eligible Manual row is pending, or after an ok run (`maxRuns`): `node --test --test-name-pattern "manual verify not repeated" skills/10x-pipeline/test/manualverify.test.mjs` — d693d2c
- [x] 5.3 Impl-review runs right after it and a `fix` does not trigger a second run: `node --test --test-name-pattern "manual verify before impl review" skills/10x-pipeline/test/manualverify.test.mjs` — d693d2c
- [x] 5.4 A ticked row whose suffix names an existing, non-empty `evidence/<name>` file verifies; no suffix, a missing or empty file, a `..` or absolute name, or a symlink out of the evidence folder makes the step `ok: false`: `node --test --test-name-pattern "evidence suffix required" skills/10x-pipeline/test/manualverify.test.mjs` — d693d2c
- [x] 5.5 Zero ticks is `ok: true`: `node --test --test-name-pattern "zero ticks is done" skills/10x-pipeline/test/manualverify.test.mjs` — d693d2c
- [x] 5.6 Editing an Automated row, a title or a SHA suffix, or unticking a row, makes the step unverified: `node --test --test-name-pattern "manual verify guards plan edits" skills/10x-pipeline/test/manualverify.test.mjs` — d693d2c
- [x] 5.7 `init --chrome` stores `chrome: true`, a resume keeps it, `--chrome false` clears it, and the chrome template is chosen from it: `node --test --test-name-pattern "chrome flag" skills/10x-pipeline/test/manualverify.test.mjs` — d693d2c
- [x] 5.8 Rendered prompts name the evidence directory and the evidence suffix; the chrome prompt adds the ToolSearch rule and the unavailable fallback: `node --test --test-name-pattern "manual verify prompts" skills/10x-pipeline/test/manualverify.test.mjs` — d693d2c
- [x] 5.9 Prompt rule form and wiring tests pass: `node --test skills/10x-pipeline/test/rules.test.mjs skills/10x-pipeline/test/preplan.test.mjs` — d693d2c
- [x] 5.10 Full suite passes; no existing test file was edited in this phase (same diff gate as 4.10): `node --test skills/10x-pipeline/test/*.test.mjs && (set -e; b="$(git merge-base main HEAD)"; n="$( { git diff --name-only "$b" -- skills/10x-pipeline/test; git ls-files -o --exclude-standard -- skills/10x-pipeline/test; } | sort -u | grep -vE 'test/(executors|codereplan|manualverify|budget-executors)\.test\.mjs|test/phase-helpers\.mjs' || true)"; test "$n" = "skills/10x-pipeline/test/loops.test.mjs"; git diff -U0 "$b" -- skills/10x-pipeline/test/loops.test.mjs | awk '/^@@/{split($2,a,",");s=substr(a[1],2)+0;if(s<28||s>36)bad=1;h++}END{exit(bad||h<1)}')` — d693d2c
- [x] 5.14 Only rows with a backticked command (or, with `--chrome`, a browser word) are eligible, and a row with a human word never is: `node --test --test-name-pattern "manual verify eligible rows" skills/10x-pipeline/test/manualverify.test.mjs` — d693d2c
- [x] 5.15 A first attempt that leaves a bad tick is judged again by the retry against the first-attempt baseline; a failed attempt is neutral (no failure count, no rigor rise), the run goes on to impl-review after `maxAttempts`, and `done` lists `manualUnproven`: `node --test --test-name-pattern "manual verify retry baseline" skills/10x-pipeline/test/manualverify.test.mjs` — d693d2c
- [x] 5.16 `--chrome foo` halts with a usage message: `node --test --test-name-pattern "chrome flag value" skills/10x-pipeline/test/manualverify.test.mjs` — d693d2c
- [x] 5.17 Evidence hardening: a symlinked `evidence` folder, a directory in place of a file, a file not newer than the baseline entry's `startedAt` and a `.` segment make the step `ok: false`; a retry may use a file its first attempt wrote: `node --test --test-name-pattern "evidence hardening" skills/10x-pipeline/test/manualverify.test.mjs` — d693d2c
- [x] 5.18 `manualUnproven` reaches the `done` output of `next`, the `archive` action summary, `meta.outcome` and the `Manual checks unproven` lines of `report.md` in an `--archive` run: `node --test --test-name-pattern "manual unproven reaches outputs" skills/10x-pipeline/test/manualverify.test.mjs` — d693d2c
- [x] 5.19 Every `--test-name-pattern` gate row of Phase 5 names a test title that exists: `node -e 'import("./skills/10x-pipeline/test/phase-helpers.mjs").then((m) => process.exit(m.gateCheck("context/changes/phase-executors/plan.md", 5)))'` — d693d2c
- [x] 5.20 With `--chrome`, `browserWords` match whole words: a row with `domain` or `pages` is not browser-eligible, a row with `page` is: `node --test --test-name-pattern "browser words whole word" skills/10x-pipeline/test/manualverify.test.mjs` — d693d2c

#### Manual

- [ ] 5.11 Run a router-driven `manual-verify` step with `--chrome` on a scratch plan with one browser-checkable Manual row and a connected Chrome extension: confirm the subagent loads the Chrome tools, ticks the row with an evidence suffix and a file under `context/changes/<id>/evidence/`. Record the outcome in the Progress row.
- [ ] 5.12 Run the same step with no Chrome extension connected: confirm it ends `done` with zero ticks and no hang.
- [ ] 5.13 Run a router-driven `manual-verify` step without `--chrome` on a plan whose Manual row a shell command can prove: confirm one tick with an evidence suffix and that a row needing a person stays pending.

### Phase 6: Budget from the longest legal path, report label, docs and scope gates

#### Automated

- [ ] 6.1 The standard and thorough longest paths fit, and the delta is the smallest that fits: `node --test --test-name-pattern "longest legal path" skills/10x-pipeline/test/budget-executors.test.mjs`
- [ ] 6.2 The failure re-plan path fits: `node --test --test-name-pattern "failure path fits" skills/10x-pipeline/test/budget-executors.test.mjs`
- [ ] 6.3 Existing reference paths pass with only the Phase 4 edit, and the frozen loop tests are byte-identical to `main`: `node --test skills/10x-pipeline/test/loops.test.mjs skills/10x-pipeline/test/loops-existing.test.mjs && git diff --quiet "$(git merge-base main HEAD)" -- skills/10x-pipeline/test/loops-existing.test.mjs`
- [ ] 6.4 ADR rule lines keep the rule form: `node --test --test-name-pattern "ADR" skills/10x-pipeline/test/rules.test.mjs`
- [ ] 6.5 ADR-003 marks the part implemented and has the new section: `grep -c "phase-executors.*implemented" docs/ADR/ADR-003-rigor-gated-routing.md`
- [ ] 6.6 `SKILL.md` and `README.md` each document `--chrome`, `manual-verify`, `plan-replan` and `plan-rejected` (the command names the first missing word): `for f in skills/10x-pipeline/SKILL.md README.md; do for w in "--chrome" "manual-verify" "plan-replan" "plan-rejected"; do grep -qF -e "$w" "$f" || { echo "$f: $w"; exit 1; }; done; done`
- [ ] 6.7 `SKILL.md` names no model: `! grep -iE "opus|sonnet|haiku" skills/10x-pipeline/SKILL.md`
- [ ] 6.8 `AGENTS.md` lists the new test files: `grep -c "executors.test.mjs" AGENTS.md`
- [ ] 6.9 Full suite passes, on Node 18 when it is installed (`fnm exec --using=18 node --test skills/10x-pipeline/test/*.test.mjs`) and on the installed Node otherwise, and the Node 18 ban list finds nothing (record `node --version` in the row): `node --test skills/10x-pipeline/test/*.test.mjs && ! grep -nE 'toSorted|Object\.groupBy|import\.meta\.dirname|\.intersection\(|\.union\(|partialDeepStrictEqual|mock\.timers' skills/10x-pipeline/scripts/route.mjs skills/10x-pipeline/test/*.mjs`
- [ ] 6.10 `init` and `status` against a scratch change folder print valid JSON: `node --test --test-name-pattern "executors smoke" skills/10x-pipeline/test/executors.test.mjs`
- [ ] 6.13 The frozen files are untouched since `main`: `git diff --quiet "$(git merge-base main HEAD)" -- skills/10x-pipeline/test/loops-existing.test.mjs skills/10x-pipeline/test/compare.test.mjs skills/10x-pipeline/test/helpers.mjs skills/10x-pipeline/baseline-policy.json`
- [ ] 6.14 The only existing test files changed since `main` are `loops.test.mjs` (one hunk in lines 28-36) and `route.test.mjs` (hunks in lines 146-166, the budget test): `(set -e; b="$(git merge-base main HEAD)"; n="$( { git diff --name-only "$b" -- skills/10x-pipeline/test; git ls-files -o --exclude-standard -- skills/10x-pipeline/test; } | sort -u | grep -vE 'test/(executors|codereplan|manualverify|budget-executors)\.test\.mjs|test/phase-helpers\.mjs' || true)"; test "$n" = "$(printf 'skills/10x-pipeline/test/loops.test.mjs\nskills/10x-pipeline/test/route.test.mjs')"; git diff -U0 "$b" -- skills/10x-pipeline/test/loops.test.mjs | awk '/^@@/{split($2,a,",");s=substr(a[1],2)+0;if(s<28||s>36)bad=1;h++}END{exit(bad||h<1)}'; git diff -U0 "$b" -- skills/10x-pipeline/test/route.test.mjs | awk '/^@@/{split($2,a,",");s=substr(a[1],2)+0;if(s<146||s>166)bad=1;h++}END{exit(bad||h<1)}')`
- [ ] 6.15 The router's git calls added since `main` use only `rev-parse`, `merge-base` and `log` (same smoke check as 1.11, prints nothing): `(set -e; b="$(git merge-base main HEAD)"; d="$(git diff "$b" -- skills/10x-pipeline/scripts/route.mjs)"; test -n "$d"; a="$(printf '%s\n' "$d" | grep '^+' || true)"; test -z "$(printf '%s\n' "$a" | grep -E '"(add|commit|push|reset|checkout|switch|restore|rebase|cherry-pick|stash|update-ref|clean|fetch|pull)"' || true)"; test -z "$(printf '%s\n' "$a" | grep -E '(runGit|gitOut)\(\[' | grep -vE '"(rev-parse|merge-base|log)"' || true)")`
- [ ] 6.16 `cleanSignals`, `cleanUsage` and `prompts.suffix` are unchanged, and `buildReport` differs only in its Result and Step lines (the function blocks must exist; a missing block fails): `(set -e; b="$(git merge-base main HEAD)"; f=skills/10x-pipeline/scripts/route.mjs; for fn in cleanSignals cleanUsage buildReport; do test -n "$(git show "$b:$f" | sed -n "/^function $fn(/,/^}/p")"; done; for fn in cleanSignals cleanUsage; do diff <(git show "$b:$f" | sed -n "/^function $fn(/,/^}/p") <(sed -n "/^function $fn(/,/^}/p" "$f"); done; test "$(diff <(git show "$b:$f" | sed -n '/^function buildReport(/,/^}/p') <(sed -n '/^function buildReport(/,/^}/p' "$f") | grep '^[<>]' | grep -vE 'const result = |\$\{e\.n\}' | wc -l | tr -d ' ')" = 0; node -e 'const cp=require("node:child_process"),fs=require("node:fs");const m=cp.execFileSync("git",["merge-base","main","HEAD"],{encoding:"utf8"}).trim();const b=cp.execFileSync("git",["show",m+":skills/10x-pipeline/policy.json"],{encoding:"utf8"});process.exit(JSON.parse(b).prompts.suffix===JSON.parse(fs.readFileSync("skills/10x-pipeline/policy.json","utf8")).prompts.suffix?0:1)')`
- [ ] 6.17 A fallback entry reads `fallback` in the report and is not a `compare` failed attempt, and an executor segment shows its template in the Step cell: `node --test --test-name-pattern "report shows fallback" skills/10x-pipeline/test/executors.test.mjs`
- [ ] 6.18 `lean` keeps today's budget and paths: a lean walk with e2e rows, a valid setup, an eligible Manual row and a first-review `REJECTED` has the same steps as a walk without them, and `budgetDelta.lean` is -4: `node --test --test-name-pattern "lean unchanged" skills/10x-pipeline/test/budget-executors.test.mjs`
- [ ] 6.19 A pool cap raised by one through the override file makes the longest walked path exceed `budget - 2` at both levels, so the budget test fails for a policy that raises a cap without raising the delta: `node --test --test-name-pattern "raised cap exceeds budget" skills/10x-pipeline/test/budget-executors.test.mjs`
- [ ] 6.20 The branch touches neither `context/archive/` nor `context/foundation/roadmap.md` (prints nothing, fails when `merge-base` fails; the close-out archive step runs after the last row): `(set -e; b="$(git merge-base main HEAD)"; git diff --quiet "$b" -- context/archive context/foundation/roadmap.md; test -z "$(git ls-files -o --exclude-standard -- context/archive context/foundation/roadmap.md)")`
- [ ] 6.21 Every `--test-name-pattern` gate row of Phase 6, and the gate check itself, name test titles that exist: `node -e 'import("./skills/10x-pipeline/test/phase-helpers.mjs").then((m) => process.exit(m.gateCheck("context/changes/phase-executors/plan.md", 6)))'`
- [ ] 6.22 The README baseline note names the allowance and `afterFailures` overrides: `grep -qF 'extraSteps' README.md && grep -qF 'afterFailures' README.md`

#### Manual

- [ ] 6.11 A reviewer reads ADR-003, `SKILL.md` and `README.md` side by side and confirms they describe the same executor, fallback, re-plan, manual-verify and budget rules.
- [ ] 6.12 A full router-driven pipeline run on a scratch project (a mixed plan, `--chrome` off) ends `done` with the step log showing the segment templates and the `manual-verify` step. Record the step list in the Progress row.
