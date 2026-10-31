---
date: 2026-10-31T12:11:37+0100
researcher: Claude Sonnet 5.5 (autonomous research subagent)
git_commit: f246cdfe24761d17022bf52764c9a8a025b6df68
branch: phase-executors-research
repository: agent-smith
topic: "phase-executors (roadmap S-08): per-phase executor routing, executor verification, failure re-plans, manual-verify step"
tags: [research, codebase, route.mjs, policy.json, decide, attachResult, executors, manual-verify, 10x-tdd, 10x-e2e, 10x-goal-implement]
status: complete
last_updated: 2026-10-31
last_updated_by: Claude Sonnet 5.5 (autonomous research subagent)
---

# Research: phase-executors (S-08)

**Date**: 2026-10-31T12:11:37+0100
**Researcher**: Claude Sonnet 5.5 (autonomous research subagent, no human answers)
**Git Commit**: f246cdf (main at `chore(archive): close baseline-usage-comparison`)
**Branch**: phase-executors-research
**Repository**: agent-smith

All `route.mjs:N` anchors are `skills/10x-pipeline/scripts/route.mjs`. `policy.json:N` is `skills/10x-pipeline/policy.json`. Toolkit skill anchors are `~/.claude/skills/<skill>/SKILL.md:N`, read on 2026-10-31 (the toolkit is outside the repo and may change).

## Research Question

`context/changes/phase-executors/change.md` (Notes, scope list) and roadmap S-08 ask for six things. The seed is the research in `context/archive/2026-10-30-rigor-levels/research.md` (section 3, Follow-ups 1-2), written before rigor levels, pre-plan gates, the archive adapter, the PR comment and `compare` were merged. Questions:

1. How do `decide()`, step selection, prompt wiring and the implement step work on main today; how is an implement step verified; what would a commit or SHA-suffix check need?
2. What are the interfaces of `/10x-e2e`, `/10x-tdd` and `/10x-goal-implement`: inputs, per-phase scoping, interactive pauses, what "Skip" does to Progress, how they signal blocked?
3. How can the router detect E2E setup, which Progress rows mention playwright/e2e/browser, and how is a plan phase list parsed today?
4. How do the tier and failure counters work for a third implement attempt and an impl-review `REJECTED`; how does a re-plan loop fit the step budget and fix-loop limits?
5. How is `manualPending` computed; where does a `manual-verify` step fit; what evidence suffix; how would `--chrome` reach the router; can a subagent load Claude-in-Chrome tools?
6. Which rigor level gates which executor, and what is a predicate for a "pure-logic phase"?

S-10 (`lesson-candidates`) edits the same `decide()` and RESULT `signals` parsing afterwards, so section 7 lists exact touch points.

## Summary

- **Skip flips pass verification today.** Condition: an `implement` entry whose reported status is `done` and whose `## Progress` Automated `[x]` count rose. The check is `plan.autoDone > (last.before?.autoDone ?? 0)` (`route.mjs:331`); the entry's `before` holds only `autoDone` (`route.mjs:1425`). A scratch run (no git, 3 Automated rows, 2 flipped by hand, `{"status":"done"}`) gave `ok:true, verified:true` for the implement entry (experiment 1, section 1).
- **Smallest shape for executors: keep the step name `implement`, vary the template.** Eight lines in `route.mjs` compare or return the literal `"implement"` (`:331`, `:620`, `:674`, `:705`, `:708`, `:713`, `:718`, `:731`; grep of this file at f246cdf) and `policy.complexity` keys it (`policy.json:24`, `:33`). Templates already carry `plan`/`plan-revise`, `research`/`research-revise`, `frame`/`frame-rethink` (`route.mjs:1409`, `policy.json:154-190`). New templates `implement-tdd`, `implement-e2e` plus the existing `implement` need no change to those sites. A new step name would.
- **Executors cannot be limited to one phase by the skills.** Condition: inspected `SKILL.md` text. `/10x-goal-implement` has no between-phase pause (`10x-goal-implement/SKILL.md:233`), so "stop after phase M" is a prompt rule only. `/10x-tdd` and `/10x-e2e` end each phase with a next-phase question (`10x-tdd/SKILL.md:276`, `10x-e2e/SKILL.md:313`), which a prompt rule can answer as "stop".
- **A tdd/e2e redirect is a normal ending, not a failure.** Both skills hand off a misfit phase by printing a redirect and STOP, or by asking a question (`10x-tdd/SKILL.md:119-133`, `:167-195`; `10x-e2e/SKILL.md:96-109`, `:155-167`, `:191-223`). The prompt must make that a `blocked` RESULT without `signals.needsHuman`, because `needsHuman` halts the run before `decide()` (`route.mjs:1350-1357`). "No tier bump" needs four counters to ignore the entry: `trailingFailures` (`:355`), the failed-step count in `rigorInputs` (`:421`), `struggled` (`:718`), and `simpleSignal` (`:1005`).
- **The third implement attempt is the attempt after two failures.** Experiment 2: attempts after 1 and 2 failures ran at tier 4 (`opus/high`) and tier 5 (`opus/xhigh`); the third failure halted with `implement failed 3 times in a row`. A re-plan must therefore trigger at exactly 2 trailing failures, not "2 or more", or an existing test (`test/route.test.mjs:386-400`, three failed implements must halt) changes.
- **REJECTED → re-plan changes a tested behavior.** `test/loops.test.mjs:30-34` asserts `fix` with `verdict: REJECTED` at `--rigor standard`; `SKILL.md:112` documents it. The plan must edit that test and that bullet (`loops-existing.test.mjs` is frozen and does not cover REJECTED).
- **Per-phase calls multiply steps.** Today one `implement` call covers the whole plan. A mixed plan costs one step per executor segment. The standard worst path is 12 of 14 (`docs/ADR/ADR-003-rigor-gated-routing.md:256`); a `manual-verify` step alone makes it 13, and a failure re-plan adds more (section 4). The budget arithmetic is a plan-time decision.
- **`manual-verify` fits between the last implement and `impl-review`** (`route.mjs:711-724`), with verification "every newly ticked Manual row ends with an evidence suffix; zero ticks is a valid `done`". Chrome evidence files downloaded by the browser (GIF export uses a browser download) land outside the repo, so evidence must be saved or referenced under the change folder.
- **A subagent can see Claude-in-Chrome tools.** Observed: this research subagent, spawned by the Agent tool, listed `mcp__claude-in-chrome__*` as deferred tools and loaded two schemas through ToolSearch. Not tested: a connected browser, extension site permissions, or a tool call. Those stay an open unknown for a Manual row.
- **E2E detection and pure-logic predicates are cheap and deterministic.** E2E: `## E2E` section of `context/foundation/test-stack.md` with `config` and `seed` labels whose paths exist (schema: `10x-e2e-setup/references/test-stack-e2e-schema.md`). This repo has no `test-stack.md` and 0 of 8 archived plans mention playwright/e2e/browser in Progress, so the E2E path cannot be exercised on real data here.

## Detailed Findings

### 1. Router today: `decide()`, step selection, prompt wiring, implement

- **Flow of one call.** `next()` (`route.mjs:1333`): guard archived (`:1335`), `checkPrompts` (`:1339`), `attachResult` (`:1340`), measure risk and resolve rigor (`:1342-1345`), halt on `signals.needsHuman` (`:1350-1357`), halt on step budget (`:1359-1362`), the skip loop around `decide()` (`:1367-1386`), `done`/archive/halt (`:1388-1393`), `tierFor` (`:1396`), halt at `fails >= maxAttemptsPerStep` (`:1397-1399`), render prompt and write the log entry (`:1407-1427`).
- **`decide()` order** (`:636-747`): no change folder halt (`:645`); no plan → `preplanNext` then first `plan` (`:648-660`); plan-review freshness and the lean skip (`:662-694`); re-plan via `replanNext` when `needsReplan && plan.autoDone === 0` (`:696-699`); **implement while `plan.autoPending > 0`** (`:701-709`); impl-review when stale (`:711-724`); fix on `REJECTED`/`NEEDS ATTENTION` up to `limits.maxFixLoops` (`:726-740`); `done` with `manualPending` (`:742-746`).
- **The implement branch** returns `{ step: "implement", bump, reason }` with no `template`; `next()` uses `d.template ?? d.step` (`:1408`). Bump: `+noisyPlanReviewBump` for 3+ warnings, `-cleanReviewDrop` for a clean `SOUND` review with no implement failures (`:704-707`).
- **Prompt wiring.** `promptText` resolves a string, an array, or `@prompts/<file>.md` parts (`:1075-1089`); `checkPrompts` resolves every template before a result is consumed (`:1094-1103`); `render` fills `{id} {goal} {verdict} {artifacts} {authority}` (`:1063`, `:1409-1411`). `policy.prompts.implement` is one string (`policy.json:154`). Every prompt gets `policy.prompts.suffix` appended (`:1411`); the suffix defines the RESULT line (`policy.json:150`).
- **Log entry** (`:1412-1426`): `n, step, template, skill, tier, model, effort, reason, tierWhy, simple, rigor, startedAt, before:{autoDone}`, and `verdict` when set. `skill` is `policy.steps[d.step].skill` (`:1416`); it is informational only: no other read of `.skill` exists in `route.mjs`.
- **Verification** is a `switch` in `attachResult` (`:310-333`): `plan` needs Progress and a newer mtime; reviews need a verdict; pre-plan steps need their artifact; `implement` needs more Automated `[x]`; `fix` is unverified (`default: true`, `:332`). `ok = status === "done" && verified` (`:342`).
- **Experiment 1** (scratch dir under `$TMPDIR`, no git, deleted afterwards): a plan of 3 Automated rows, a clean plan review, `init` returned `implement` (tier 2). After 2 rows were ticked by hand and `last-result.json` said `{"status":"done","note":"tdd Skip: flipped 1.1 1.2, no commit"}`, `next` logged `ok:true, verified:true`, and the log entry's `before` was `{"autoDone":0}`.
- **What a commit or SHA check needs** (design, not yet present):
  - Record `before.head` (output of `git rev-parse HEAD`) and `before.shas` or the per-row state in the entry at `:1425`. `runGit`/`gitOut` already exist (`:464-482`) and are read-only, which AGENTS.md allows. Without git (`gitOut` null) the check must fall back to the count, as the router does for risk.
  - Row SHA suffix format: `- [x] N.M <title> — <sha>`, short SHA, appended at phase end (`10x-plan/references/progress-format.md:42`, `:49`). Mid-phase rows are `[x]` without a SHA, a valid intermediate state. `readPlan`'s row regex (`:80`) captures the text after the box, so a suffix can be read with ` — ([0-9a-f]{7,40})$`.
  - Candidate predicate for `verified` on an executor step: status `done` AND Automated `[x]` count rose AND (HEAD moved since `before.head` with `before.head` an ancestor of HEAD, or every newly ticked row carries a SHA suffix that `git cat-file -e <sha>^{commit}` accepts).
  - Known false negatives: `/10x-goal-implement` prints "Phase N had no diff to commit ... rows remain SHA-less" (`10x-goal-implement/SKILL.md:209`), and `/10x-e2e` flips rows for an already-passing spec with evidence and no commit (`10x-e2e/SKILL.md:171`). Both are legitimate and would read as unverified. Because the ticked rows stay ticked, the only action available to the router is a failed-attempt count plus a prompt note on the retry. Evidence in the repo: 2 rows of `baseline-usage-comparison` (rows 1.6, 1.7) were ticked without a SHA but with prose evidence, and this research did not count SHA-less done rows in the other 7 archived plans (not checked).
- **Pitfall:** `readPlan` keeps `phases` as a number (`:77`) and four consumers read it as a number (`tierFor` `:1025`, `simpleSignal` `:1004`, `rigorInputs` `:417`, `readSide` in `compare` `:1561`). A phase list needs a new field, not a changed type.

### 2. Executor interfaces

| | `/10x-goal-implement` | `/10x-tdd` | `/10x-e2e` |
| --- | --- | --- | --- |
| Input | `<change-id> [phase N]` (`SKILL.md:15`, `:64-68`) | `<change-id> [phase N]` or plan path (`:61-63`) | `<change-id> [phase N]`, plan path, or a risk id (standalone) (`:67-72`) |
| Phase scoping | `phase N` = first pending Automated row in phase N (`:82`); then continues through later phases with no pause (`:233`) | `phase N` = start; next-phase question after each phase (`:276-293`) | same (`:313-334`) |
| Unattended | Yes; "Never invoke interactive question tools" (`:58`) | No: manual gate pause (`:241`), dirty-path question (`:258`), commit message approval (`:266`), next-phase (`:276`), ambiguous gate (`:154`), redirect (`:169`) | No: ask-the-user wording is host-agnostic and falls back to plain chat and wait (`:125`); manual gate (`:278`), dirty paths (`:295`), commit approval (`:301`), next-phase (`:313`), gate (`:178`), redirect (`:193`), straggler scan (`:350`) |
| Misfit / blocked | Structural mismatch or a gate failing a third time prints `STOPPED — ...` and halts (`:90`, `:150`, `:161-169`) | Test runner missing → STOP (`:84-94`). Implementation already present → STOP with `/10x-implement` redirect (`:119-133`). Not TDD-able → question (`:167-195`) | Playwright config or seed missing → redirect to `/10x-e2e-setup` and STOP (`:96-109`). Feature not built → STOP (`:155-167`). Not browser-level → question (`:191-223`) |
| "Skip" | none | "Skip — already done": flips the phase's rows `[x]` with no SHA, no commit (`:178`, `:195`) | "Skip — already done": flips only rows whose claim holds, no SHA (`:206`, `:223`). Separately, a phase whose spec already passes flips rows with evidence and no commit (`:171`) |
| Commit | per phase, no approval: `<type>(<id>): <title> (p<N>)` (`:211`) | per phase after approval (`:264-266`) | per phase after approval: `test(<id>): ... (p<N>)` (`:301`) |
| SHA write-back | after the phase commit (`:229`) | `:268` | `:305` |
| Manual rows | never flipped, listed (`:237-241`) | gate pauses for the human; "do not check off manual rows until the user confirms" (`:295`) | flipped "only after the user confirms" (`:334`) |
| Subagents | one `Task` per phase (`:98-103`) | `Agent`/`Task` allowed, used "sparingly" (`:376`) | may delegate "if your tool has one" (`:401`) |

- Epilogue: all three set `status: implemented` and make a `chore(<id>): close out plan (epilogue)` commit only when every Automated and Manual `[ ]` is `[x]` (tdd/e2e: "every `- [ ]`", `10x-tdd/SKILL.md:309`) or every Automated row (goal-implement, `:253`). A partial stop skips it; e2e offers `chore(<id>): progress` (`10x-e2e/SKILL.md:379`).
- `/10x-tdd` and `/10x-e2e` require an interactive-question tool or a human reply. In the router's subagents `AskUserQuestion` is unavailable (`policy.json:150`), and the archive prompt already shows the needed pattern: rules that give the answer to each question and forbid ending the turn to wait (`policy.json:162`).
- **Rule list a tdd/e2e prompt needs** (each as GIVEN/WHEN/THEN with one bold keyword, ADR-004): stop after phase M and take the "stop here" option of the next-phase question; never choose "Skip"; the manual confirmation gate counts as confirmed and the Manual rows are listed in the reply (not ticked); commit message "approve as proposed"; dirty paths "commit only the planned set"; redirect conditions end with `blocked` and no `signals.needsHuman`; ambiguous gate: choose the recommended option or end `blocked`; no plain-chat questions that wait.
- **Planned-vs-actual scope claim from the seed.** The seed said no executor can be scoped to one phase. Verdict: supported for goal-implement (no pause), partial for tdd/e2e (a per-phase question exists, so a "stop" answer is natural but still prompt-driven).

### 3. E2E setup detection, row keywords, phase list parsing

- **Schema.** `## E2E` section of `context/foundation/test-stack.md`; fixed labels `config` and `seed` among the required fields (`10x-e2e-setup/references/test-stack-e2e-schema.md`, section "The section" and "Required fields"). Lines are `- config: <path>` and `- seed: <path> — protects <risk>`. `/10x-e2e` treats the section as stale when a field points at a missing file (`10x-e2e/SKILL.md:94`).
- **Router predicate** (new, same shape as `repoMapExists`, `route.mjs:849-858`, registered in `PREDICATES` `:839`): read the file, take lines from `## E2E` to the next `## `, parse `- config:` and `- seed:` (path = text up to the first ` — `, backticks stripped), and require `fs.existsSync(path.resolve(ROOT, p))` for both. No file, no section or a missing path is no hit. A config block `policy.executors.e2e.setup = {file, section, fields}` keeps paths out of code.
- **This repo:** `context/foundation/` holds `prd.md`, `README.md`, `roadmap.md`, `shape-notes.md` (no `test-stack.md`), so the predicate is false here. In the 8 plans under `context/archive/*/plan.md`, 0 Progress rows match `playwright|e2e|browser` (counted by a one-off script on 2026-10-31). The E2E path therefore needs fixtures; no real plan exercises it.
- **Row keywords.** The seed claimed `npx playwright test` appears in `plan-templates.md:73-79`. Contradicted for the current toolkit: those lines list `make migrate`, `make test-component`, `npm run typecheck`, `make lint`, `make test-integration`, and `playwright` occurs 0 times under `~/.claude/skills/10x-plan/`. Keyword matching on Automated rows (and the phase name) remains the only signal; use the word-start matching of `goalPhrase` (`route.mjs:770-780`), which already handles prefixes and case. False positives such as a row saying "no browser needed" are possible; the e2e skill's own gate (not browser-level → question → `blocked`) is the backstop, plus the fallback.
- **Plan phase parsing today.** `readPlan` (`route.mjs:65-89`) scans only the `## Progress` section: `### Phase N` increments `phases` (`:77`), `#### Automated`/`#### Manual` set the section (`:78-79`), rows match `^- \[( |x|X)\] (.*)$` (`:80`). Per phase it keeps nothing: no number, name or rows. Manual pending rows are kept as text (`:84`); Automated ones only as counters (`:85-86`). Descriptive phase blocks (`## Phase N:` or `## Faza N:` before Progress, `progress-format.md:37`) are not read; `**File**:`/`**Files**:` lines are read plan-wide by `planPaths` (`:573-587`), not per phase.
- **Needed:** a `phaseList` field built in the same loop (number from the `### Phase N` heading, name, Automated rows with done flag and text, Manual rows), plus a small per-phase reader of the descriptive `## Phase N` / `## Faza N` block for `**File(s)**` lines (reuse `normalizePlanPath` `:562`). Row phase numbers come from the enclosing heading, not the `N.M` prefix.
- **Segment rule** (design): a phase is pending when it has at least one Automated `[ ]`; Manual-only phases never block. The next segment starts at the first pending phase; its executor is chosen for that phase; the segment extends over following pending phases that choose the same executor. With every pending phase on goal-implement, `implement` stays one call with the unchanged prompt (scope: "in one call when no phase needs another executor"). Otherwise the prompt names `{phase}` and `{lastPhase}`.

### 4. Counters, tiers, re-plan loops and the budget

- **Failure counters** (all derive from `ok`): `trailingFailures(log, step)` counts the trailing run of entries with that step name and a falsy `ok` (`:355-363`); `tierFor` adds `fails × perFailure` (`:1029-1030`); `next()` halts when `fails >= maxAttemptsPerStep` (`:1397`, policy value 3, `policy.json:36-49`). The rigor input counts every `ok === false` entry (`:421-424`). `simpleSignal` withholds the simple-change discount after any `ok === false` (`:1005`). `struggled` in the impl-review branch looks for failed implement/fix entries (`:718`).
- **Experiment 2** (scratch dir, three `blocked` results in a row on `implement`): attempts after 1 and 2 failures ran at `opus/high` (tier 4, base 3 + 1) and `opus/xhigh` (tier 5); the third failure halted with `implement failed 3 times in a row`; rigor rose to `thorough` by `failed steps 3` (`policy.json:55`). So "third attempt" means `trailingFailures(log, "implement") === 2` at `decide()` time.
- **Where the re-plan goes.** `decide()` implement branch (`:701-709`): before returning `implement`, if `trailingFailures(log,"implement") === escalation.replanAfterFailures` (new key, 2) and failure re-plans so far are below a cap, return `{ step: "plan", template: "plan-replan", failure: <last note>, bump }`. `tierFor` counts failures of the `plan` step (`d.step`), which are 0 because the trailing entries are `implement`, so the re-plan runs at `plan` base plus the bump. After a successful re-plan the plan mtime is newer than the last plan-review, so plan-review reruns (`:665-668`) and implement follows. The trailing implement streak is broken by the intervening `plan` and `plan-review` entries, so the next implement starts at fails 0.
- **Why `=== 2`:** `route.test.mjs:386-400` (three failed implements plus a skip) must still halt; `>= 2` would return a re-plan there.
- **Verification of the re-plan:** `case "plan"` (`:311`) checks only Progress and mtime. A failure re-plan should also keep every `[x]` row ticked and unrenamed, which only a prompt rule can ask for (the `plan-revise` prompt states "Keep the ## Progress contract, step indices and titles", `policy.json:152`).
- **REJECTED.** Today `needsFix` returns `fix` with `bump: rejectedBump` and a floor at the last code tier (`:726-740`). New rule: when `ir.verdict === "REJECTED"` and rejected re-plans so far are below `limits.maxRejectedReplans` (new key, 1), return a `plan` step with template `plan-rejected` (bump `escalation.rejectedReplanBump`), then fall back to `fix` as today. The re-plan must add or reopen Automated rows, otherwise `autoPending` stays 0, the impl review stays fresh (`:714-716`, no code step ran) and the router would loop on REJECTED. Verify it by `plan.autoPending > 0` after the step (new case on the entry's template in `attachResult`). The fix-loop cap `maxFixLoops` (`:730`) counts `fix` entries only, so re-plans do not consume it.
- **How research-revise and frame-rethink were done** (pattern to copy): templates in `policy.prompts` (`policy.json:172-190`), artifact map under `preplan.artifacts` (`:130-140`), selection in a separate function below `decide()` (`replanNext` `:942-993`, `preplanNext` `:887-935`), verification by artifact keyed on the entry's template (`preplanFile` `:764`), counters derived from the log by template name (`okFrames` `:949`, `revisions` `:950`), and policy knobs under `preplan.loops` where a non-positive-integer value disables the loop (`:948`, `:953`). The new failure re-plans should do the same: one function `executorNext`/`failureReplan` below `decide()`, counters by template name, knobs in policy.
- **Budget.** `budget = maxTotalSteps (14) + rigor.budgetDelta[level]` (-4 / 0 / +4) (`:1359`, `policy.json:57`, `:74`). Skips use none. Failure-free paths at `standard`, counting executed steps (each segment is one step):
  - Today's worst path: 12 of 14 (ADR-003 table, `docs/ADR/ADR-003-rigor-gated-routing.md:256-259`).
  - With one `manual-verify` step before each impl-review pass that finds pending Manual rows and runs: first pass adds 1 → 13 of 14 (tolerates 0 failed steps). If the step reruns after fixes, up to 15, over budget.
  - Failure re-plan path (executed steps): plan, plan-review, implement (failed), implement (failed), plan-replan, plan-review, implement, impl-review = 8, then done; with two fix rounds each followed by an impl-review = 12, plus `manual-verify` = 13.
  - A mixed plan with k segments adds k-1 implement steps to any path.
  - Conclusion: the plan must compute new reference paths (the existing "reference path" tests assert at least one step to spare, `test/loops.test.mjs:453`, `:467`, `:482`; an exact-budget assertion was not inspected), and decide between raising `rigor.budgetDelta.standard`, gating `manual-verify` by rigor, or running it once per run. This is a genuine choice (open question 3).
- **Rigor side effects.** A `blocked` fallback entry is `ok:false` unless handled; with the usual rule it would raise rigor (`failed steps 1` → `standard`, `:421-424`, `policy.json:55`). The fallback must not.

### 5. Manual rows, `manual-verify`, evidence, `--chrome`

- **`manualPending` today.** Computed only in `readPlan` as the text of `- [ ]` rows under `#### Manual` (`route.mjs:84`). Returned by `decide()` at `done` (`:742-746`), stored in `meta.outcome` (`:254`), listed by `archiveLines` (`:196-199`), optionally halting the archive (`:1231-1234`), and returned in the `archive` summary (`:1325`). A row ticked by any actor simply stops being pending (the done branch, `:83`, never inspects it).
- **Prior art for evidence:** the owner ticked Manual rows 1.6 and 1.7 of `baseline-usage-comparison` with a suffix `— done by a live probe run by the orchestrator, 2026-10-31 (owner directed; see real-run-evidence.md)` (`context/archive/2026-10-31-baseline-usage-comparison/plan.md:462-463`). Same ` — ` separator as SHA suffixes. Of the 8 archived plans, Manual rows were 13, 3, 3, 4, 15, 13, 6, 10 (pending at archive: 13, 0, 0, 0, 15, 13, 4, 10). Many pending rows need a real nested `/10x-frame` or pipeline run (for example `context/archive/2026-10-30-pre-plan-steps/plan.md` rows 2.9-2.11, 5.6-5.12), which a `manual-verify` subagent cannot honestly automate; those stay pending. Text checks ("reads clearly", "SKILL.md, README.md and route.mjs describe the same rule") are automatable.
- **Placement.** In `decide()` between the last code step and the impl-review freshness test (`:711-717`): when no Automated row is pending, `plan.manualPending.length > 0`, the rigor gate is open, and no `manual-verify` entry exists after the last `implement` (or after the last `implement`/`fix`, a plan choice), return `{ step: "manual-verify" }`. Because `lcode = lastIdx(log, ["implement","fix"])` (`:713`) does not include `manual-verify`, the impl-review stays stale afterwards and runs next, so the review sees the evidence. Note the no-log fallback `ir.mtime >= plan.mtime` (`:716`) would see plan.md newer after a tick; this affects only a resume with an empty log.
- **New policy:** `steps["manual-verify"]` (skill `null`, `interactive: true`, base tier), a `manualVerify` block (`minRigor`, `maxRuns`), `prompts["manual-verify"]`. The prompt rules: tick a Manual row only after running a check that proves it and append ` — evidence: <command and result, or a path>` to that row; never edit titles or Automated rows; leave a row you cannot prove; with `--chrome`, load the Chrome tools by ToolSearch and use them only for rows that need a browser.
- **Verification** (new case in `attachResult`): compare Manual rows before and after. `ok` when status `done`, and every newly ticked row matches `/ — evidence: \S/` (SHA suffix regex ` — [0-9a-f]{7,40}$` is distinct), and no Automated row or title changed. Zero ticks is a valid `done`: "rows it cannot automate stay in `manualPending`". If zero ticks counted as failure, the step would retry at higher tiers up to 3 times and raise rigor (`:421`). To compare, `readPlan` must return Manual rows with their done flag, and the entry must store them in `before` (additive log keys; `compare` reads only executed entries' `usage`, `model`, `effort`, `ok`-agnostic fields, `route.mjs:1532-1585`).
- **Evidence location.** Evidence files must live inside the change folder, because `--archive` commits only that folder and the folder moves intact (`README.md`, Archive section). The chrome `gif_creator` export "download: true" sends the GIF through the browser download (tool schema loaded in this session), not into the repo, so a GIF path in the suffix is not verifiable by the router; a screenshot or GIF needs a copy step into `context/changes/<id>/evidence/`. Binary files in the change folder are committed by the archive step; size policy is open.
- **`--chrome` path to the router.** `parseFlags` is generic (`route.mjs:28-37`), so `--chrome` parses as `true` with no router change. The `init` branch writes `meta = { ...prev, id, goal }` and sets `archive` from the flag (`:1781-1783`); `chrome` would be stored the same way (`--chrome false` turns it off), and a resume keeps the stored value. The orchestrator side is `SKILL.md:29` (flag parsing) and `:31` (`init` call), and the Agent call parameters at the `run` action. `SKILL.md` frontmatter `allowed-tools` has no `ToolSearch` (`SKILL.md:10-18`), so the orchestrator cannot probe for the tools itself; the simplest evidence-backed design is a user-supplied flag, like `--archive`, with the subagent probing and ending `done` with zero ticks when the tools are absent. The router never reads tool availability.
- **Can a subagent load the Chrome tools?** Observed in this session: the research subagent (spawned by the Agent tool, tools not restricted) had the `mcp__claude-in-chrome__*` names listed as deferred tools, and `ToolSearch select:` returned full schemas for `tabs_context_mcp` and `gif_creator`. Not tested, and not testable unattended: a connected Chrome extension, per-site permission prompts, browser dialogs, or any tool call. Record as an open unknown for a Manual row (the roadmap lists the same unknown, `context/foundation/roadmap.md:185`).

### 6. Rigor gating and the "pure-logic phase" predicate

- **Gating shape.** Copy the pre-plan convention: `minRigor` per executor in policy data, compared by index in `policy.rigor.levels` (`preplanNext` `route.mjs:907`, `replanNext` `:947`). The scope names only one gate: `/10x-tdd` for pure-logic phases at `thorough`. E2E carries its own gate (setup exists plus row keywords); no rigor is named. Assumption A2: `executors.e2e.minRigor` ships as `lean` (no rigor gate) and is overridable.
- **Level read.** `ctx.level` at each `decide()` call; the level only rises (`resolveRigor` `:438-454`), so a later segment may select tdd after a rise. Record `executor` and `phase`/`lastPhase` in the entry for reports and tests.
- **Predicate `pureLogicPhase(phase, ctx)`** (all must hold; every input is already on disk; no LLM; uncalibrated like the churn parameters):
  1. Rigor at or above `executors.tdd.minRigor` (`thorough`).
  2. The phase has no ticked Automated row yet (proxy for "implementation absent": `/10x-tdd` stops when the implementation exists, `10x-tdd/SKILL.md:119`).
  3. The phase block names at least one path in `**File(s)**` lines, every named path has an extension in `executors.tdd.codeExtensions` (for example `.mjs .js .ts .py`) and none matches `executors.tdd.excludeGlobs` (config, docs, CI, lockfiles, same shape as `risk.churn.exclude`, `policy.json:62`).
  4. Every pending Automated row of the phase contains a test or check command (backtick token containing `test`, `vitest`, `jest`, `pytest`, `node --test`; list in policy) and none matches E2E words or UI words.
  5. A test runner exists: some row names a test command (item 4) or `test-stack.md` exists. (The skill itself STOPs without a runner, `10x-tdd/SKILL.md:84-94`.)
  6. The E2E predicate is false for the phase (E2E wins over tdd).
- **Fit in this repo.** The agent-smith plans put router code and its tests in `route.mjs` and `test/*.test.mjs` (pure `.mjs`), but most phases also touch `policy.json`, `SKILL.md`, README or ADR text (excluded paths), so item 3 would send those phases to goal-implement. The predicate is correct to be conservative: tdd's own table excludes "scaffolding, config, docs" phases (`10x-tdd/SKILL.md:143-148`), and a misselected phase costs a fallback step plus a prompt of tdd tokens, not a wrong result.

### 7. Touch points: S-08 versus S-10

S-08 touches (in order of the loop):

| Where | Function / key / file | Edit | Size |
| --- | --- | --- | --- |
| `route.mjs:65-89` | `readPlan` | add `phaseList` and Manual row state (new fields only; `phases` stays a number) | small |
| `route.mjs:297-344` | `attachResult` | `case "implement"` extended; new cases `manual-verify`; template-keyed check for `plan-replan`/`plan-rejected` | small |
| `route.mjs:355-363`, `:421`, `:718`, `:1005` | failure counters | one helper (for example `isFailure(e) = e.ok === false && !e.fallback`) used by the four sites | small |
| `route.mjs:636-747` | `decide` | implement branch, REJECTED branch, new manual-verify branch call into new functions; keep branch order | small if logic lives below |
| new section after `replanNext` (~`:993`) | `executorNext`, `failureReplan`, `pureLogicPhase`, `e2eSetup` predicate, segment builder | all new logic | the bulk |
| `route.mjs:839-871` | `PREDICATES` | add `e2eSetup` | one entry |
| `route.mjs:1019-1061` | `tierFor` | `s.interactive \|\| d.interactive` at `:1048` so tdd/e2e templates get the effort floor without a new step name | one line |
| `route.mjs:1407-1427` | `next()` render vars and entry | add `{phase}`, `{lastPhase}`, `{failure}` vars; add `phase`, `lastPhase`, `executor`, `fallback`, `before.head` to the entry | few lines |
| `route.mjs:1749-1796` | `init` | store `chrome` like `archive` | few lines |
| `policy.json` | `steps["manual-verify"]`, `executors`, `manualVerify`, `escalation.replanAfterFailures`, `escalation.rejectedReplanBump`, `limits.maxRejectedReplans` / failure re-plan cap, `prompts.implement-tdd`, `implement-e2e`, `implement-segment`, `plan-replan`, `plan-rejected`, `manual-verify` | data | medium |
| `prompts/` | optional `executor-tdd.md`, `executor-e2e.md`, `manual-verify.md` referenced as `@prompts/...` | the rule files must be wired or listed under "Not wired" (`prompts/README.md`; test "wired or documented") | medium |
| docs | `SKILL.md` (arg hint `:9`, Start step 1 `:29`, "How the tier moves" `:91-113`, bullet at `:112`), README (arguments `:18`, routing bullets, new "Phase executors" subsection, Budget `:103`), ADR-003 (table row at line 24, new section, budget table), AGENTS.md (project-structure lines if a test file is added) | docs | medium |

S-10 (`lesson-candidates`) will touch, per roadmap `context/foundation/roadmap.md:202-212`: `cleanSignals` (`route.mjs:285-295`, adds a signal key), the `suffix` RESULT line and the `impl-review` prompt (`policy.json:150`, `:155`), `buildReport` (`:203-240`, a lessons section), and possibly the `done` branch of `decide()` (`:742-746`). To keep the two changes from conflicting, S-08 should:
- leave `cleanSignals`, `prompts.suffix` and the RESULT line untouched, putting executor rules in per-template prompts;
- not edit `buildReport` beyond, at most, showing the template in the Step cell (`:210-214`, a one-line change inside the `rows` map; S-10 adds a section after the skips section at `:231-238`). If the report must show the executor, prefer extending `status` output (`:1720`) with `template` instead;
- add executor logic below `decide()` (as `preplanNext` and `replanNext` were) and keep the diff inside `decide()` to the three call sites;
- avoid renaming existing log keys; new keys only (ADR-005 `compare` reads executed entries only).

## Code References

- `skills/10x-pipeline/scripts/route.mjs:65-89` - `readPlan`: phase counter, row regex, `manualPending`.
- `skills/10x-pipeline/scripts/route.mjs:297-344` - `attachResult`: verification switch; `:331` implement; `:332` default.
- `skills/10x-pipeline/scripts/route.mjs:355-363` - `trailingFailures`.
- `skills/10x-pipeline/scripts/route.mjs:636-747` - `decide`; implement `:701-709`; impl-review `:711-724`; fix `:726-740`; done `:742-746`.
- `skills/10x-pipeline/scripts/route.mjs:839-882` - `PREDICATES`, `existsPredicate`, `predicate`.
- `skills/10x-pipeline/scripts/route.mjs:887-993` - `preplanNext`, `replanNext` (the pattern to copy).
- `skills/10x-pipeline/scripts/route.mjs:1019-1061` - `tierFor`, `settle` floor at `:1048`.
- `skills/10x-pipeline/scripts/route.mjs:1075-1103` - `promptText`, `checkPrompts`.
- `skills/10x-pipeline/scripts/route.mjs:1333-1440` - `next`: budget `:1359`, skip loop `:1367`, fails halt `:1397`, entry `:1412`.
- `skills/10x-pipeline/scripts/route.mjs:1749-1796` - `init`: meta spread and flags.
- `skills/10x-pipeline/policy.json:11-21` steps; `:36-49` escalation; `:51-60` rigor; `:73-77` limits; `:86-148` preplan; `:149-190` prompts.
- `skills/10x-pipeline/SKILL.md:29` flag parsing; `:91-113` "How the tier moves"; `:112` REJECTED bullet; `:113` failure definition.
- `~/.claude/skills/10x-goal-implement/SKILL.md:58`, `:82`, `:209`, `:229`, `:233`, `:237-241`.
- `~/.claude/skills/10x-tdd/SKILL.md:119-133`, `:167-195`, `:241`, `:258`, `:266`, `:276`.
- `~/.claude/skills/10x-e2e/SKILL.md:96-109`, `:125`, `:155-167`, `:171`, `:191-223`, `:278`, `:301`, `:313`.
- `~/.claude/skills/10x-e2e-setup/references/test-stack-e2e-schema.md` - `## E2E` fields.
- `~/.claude/skills/10x-plan/references/progress-format.md:37-49` - phase headings, SHA suffix, executors write Progress identically.
- `skills/10x-pipeline/test/route.test.mjs:386-400`, `skills/10x-pipeline/test/loops.test.mjs:27-34`, `:441`, `:453-482` - tests the plan must keep or edit.
- `skills/10x-pipeline/test/helpers.mjs` - `makeProject`, `planText` (one Manual row `N.9` per phase), `entry`, `writeLog`, `writeResult`.

## Architecture Insights

- **Recommended shape** (one design among alternatives; the plan decides): keep step `implement`, add templates (`implement-tdd`, `implement-e2e`, `implement-segment`) and a per-template `interactive` flag; add steps only for `manual-verify`; pick the executor in a new function below `decide()`; derive every counter from the log by template name; keep policy knobs in a new `executors` block with a non-positive value disabling a feature, as `preplan.loops` does.
- **Fallback as an ok-neutral entry.** A `blocked` result from an executor template without `signals.needsHuman` is stored with `fallback: true`. Alternative: store `ok: true, redirected: true`, which needs no counter change but reports "ok" for a step that produced nothing. The helper approach is more honest and touches four lines.
- **Do not repeat a failed executor for the same phase.** Entries need `phase`/`lastPhase` so the next selection excludes an executor that already redirected for that phase.
- **Everything verifiable stays file- and git-read based**, matching AGENTS.md (router git use is read-only outside the archive commit).
- **Prompt rules** follow ADR-004 (one line, GIVEN/WHEN/THEN, one bold keyword; `rules.test.mjs` checks every policy prompt and `prompts/*.md`).

## Historical Context (from prior changes)

- `context/archive/2026-10-30-rigor-levels/research.md` section 3 and Follow-ups 1-2 (the seed). Verdicts on its claims, each checked on 2026-10-31:
  - Skip flips pass the `[x]` count check: **supported** (experiment 1); anchor moved from `route.mjs:217` to `:331`.
  - tdd "Skip" flips rows with no SHA (`10x-tdd/SKILL.md:178`, `:195`): **supported**. e2e flips for an existing passing spec and on "Skip" (`10x-e2e/SKILL.md:171`, `:223`): **supported**.
  - "`phase N` is a start point in all four executors, none can be limited to one phase": **supported** for goal-implement, **partial** for tdd/e2e (a next-phase question exists after each phase).
  - "`plan.md` has no executor tag; keyword matching, e.g. `npx playwright test` (`plan-templates.md:73-79`)": tag part **supported**; the example **contradicted** for the current toolkit (0 playwright hits under `~/.claude/skills/10x-plan/`).
  - "tdd and e2e were not found to spawn subagents": **partial**; both allow it on demand (`10x-tdd/SKILL.md:376`, `10x-e2e/SKILL.md:401`).
  - "goal-implement never flips Manual rows (`:239`)": **supported** (`:237-241`). "The router lists them in `manualPending` (`route.mjs:80`, `:355`)": **supported**, anchors now `:84`, `:745`.
  - "Manual rows in the 3 archived plans: none needs a browser": **partial**; 8 plans are archived now, 0 mention a browser, but rows needing a real nested pipeline run exist.
  - "Claude-in-Chrome tools are deferred MCP tools; a general-purpose subagent can load them (inference)": **partially supported** (visible and schema-loadable here; use untested).
  - Follow-up 2 item 6 (accepted design: evidence suffix, `--chrome`, `manual-verify` before impl-review): **supported as design**; nothing is implemented.
- `context/archive/2026-10-30-pre-plan-steps/plan.md` (PP:59-68, :94-101): new steps were added as policy data plus separate functions below `decide()`, with characterization tests first (`loops-existing.test.mjs`, frozen) and docs last. It explicitly left per-phase executors, manual-row automation and the third-attempt re-plan to S-08.
- `context/archive/2026-10-30-archive-adapter/plan.md`: hooked in at one place (`d.done && meta.archive === true`, `route.mjs:1388`), added a new action without a log entry, and stored the flag by the `{...prev,id,goal}` spread.
- `docs/ADR/ADR-003-rigor-gated-routing.md:24` lists `phase-executors` as planned; `:252-261` holds the budget table (standard 12 of 14, thorough 16 of 18). `ADR-004` sets the rule form. `ADR-002:325` says phases of one plan may use different executors. `ADR-005` requires log changes to stay additive for `compare`.

## Related Research

- `context/archive/2026-10-30-rigor-levels/research.md` (seed).
- `context/archive/2026-10-30-pre-plan-steps/research.md` and `plan.md` (gate, loop and verification patterns).
- `context/archive/2026-10-30-archive-adapter/plan.md` (new action and verification pattern).

## Open Questions

For the owner (each is a genuine choice or missing evidence; none blocks `/10x-plan`):

1. **Chrome in a subagent.** Is a connected extension and its site permission available to a router subagent? Untestable unattended; a Manual row.
2. **Segment budget policy.** Per-segment steps plus `manual-verify` push the standard worst path to 13 of 14. Raise `rigor.budgetDelta.standard`, gate `manual-verify` by rigor, or cap it at one run?
3. **Which levels run `manual-verify`?** The change notes name no gate. Assumption A3 proposes `standard` and above (lean skips it) to protect the lean budget of 10.
4. **Evidence storage.** Allow files under `context/changes/<id>/evidence/` (committed by the archive step), prose only, or both? Binary size limit?
5. **Legit commit-less phases.** A zero-diff goal-implement phase and an e2e "spec already passes" flip read as unverified. Accept the false failure (extra attempt, prompt note) or allow a policy escape (`verifyCommit.minRigor`)?
6. **Failure re-plan caps.** `maxRejectedReplans` 1 and failure re-plans 1 are proposals; no run data exists.
7. **Should `tdd` ever apply below `thorough`?** The scope says no; keep unless data says otherwise.

## Assumptions (decided without a human, from repo evidence)

- A1: `--chrome` is a user-supplied `init` flag stored in `meta.json` like `--archive`; the orchestrator does not probe tools (`allowed-tools` has no `ToolSearch`, `SKILL.md:10-18`).
- A2: E2E selection has no rigor gate (`minRigor: lean`, overridable); only tdd is gated at `thorough`, as `change.md` Notes say.
- A3: `manual-verify` runs at `standard` and above, once per run after the last `implement`; zero ticks is `done`.
- A4: a tdd/e2e `blocked` without `needsHuman` is a fallback to goal-implement for that phase, with no tier bump and no rigor rise; `needsHuman` still halts.
- A5: failure re-plan triggers at exactly 2 trailing implement failures; REJECTED re-plans once, then `fix` as today.
- A6: the plan edits `test/loops.test.mjs:30-34` (REJECTED now re-plans first) and adds new tests in a new file; `loops-existing.test.mjs` is not touched.
- Verification not done: no live tdd/e2e/goal-implement run, no real E2E project, no Chrome call. The full suite was not run by this research (the Explore subagent reported 322 passing, 2 skipped, 0 failed in this worktree).
