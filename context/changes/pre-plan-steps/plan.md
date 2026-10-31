# Rigor-gated Pre-plan Steps and Backward Loops Implementation Plan

## Overview

Add four optional steps that run before the first plan (`/10x-research`, legacy research when a repo map exists, a domain brief, `/10x-frame`) and two backward loops after plan review (RETHINK goes to frame once, then re-plans; a second REVISE adds research, then re-plans). Gates live in `policy.json` as a rigor threshold plus named `when` and `skipIf` predicates; the predicates are implemented in `route.mjs`. The two loops are gated by the same kind of threshold (`preplan.loops.minRigor`). Both default to `thorough`, so a `standard` or `lean` run behaves exactly as it does on main. Each new step is verified by the artifact it writes. `/10x-frame` is pinned to the opus/high tier and gets an unattended decision guide. The six prompt files already in `skills/10x-pipeline/prompts/` are wired in. The skip-loop cap that three gated-out steps would hit is fixed, and the existing RETHINK/REVISE loop, which has no tests, gets them.

This is change 2 of the rigor-gated routing split (roadmap S-07, PRD FR-001, FR-003, FR-007). It builds on the merged `rigor-levels` change (rigor level, `signals`, skip entries, effort floor; archived at `context/archive/2026-10-30-rigor-levels/`). Research: `context/changes/pre-plan-steps/research.md` (git commit 54f1729). No human could answer the research's six open owner questions; each is decided below as an assumption with its reversal cost. This revision answers the plan review (`reviews/plan-review.md`, verdict REVISE); see "Review response".

## Current State Analysis

Code is named by function; the line numbers of the research are used only as anchors and shift when S-05 and S-06 merge.

- `decide()` has one exit before a plan exists: the "no plan yet" branch returns step `plan`. Rigor is resolved in `next()` before `decide()` with `risk = null` when `plan.md` is absent, so before the plan the level comes only from `--rigor`, the goal class, failed steps and `signals.rigor`. A plain goal is `standard`, a short goal `lean`; `thorough` needs `--rigor thorough` or a signal.
- Reusable mechanisms: skip entries (`decide` returns `{ skip }`, `next()` logs it), `d.template` selecting a prompt other than the step name, and `signals.needsHuman` halting before `decide()`.
- The skip loop in `next()` halts with `Router error: skip loop` when `decide()` returns a skip on the third ask in one call, so at most two skips can be logged per call. Three gated-out pre-plan steps would hit it.
- `attachResult` verifies four step names by artifact and defaults to `verified = true`. Research, frame and the domain brief have no case.
- `skills/10x-pipeline/prompts/` has six rule-form files and a README, form-checked by `rules.test.mjs`, and read by nothing in `route.mjs`. `policy.prompts` values are plain strings rendered with `{id}`, `{goal}`, `{verdict}`.
- The re-plan branch (`needsReplan && plan.autoDone === 0`) turns RETHINK (bump +2) and REVISE with criticals or more than `review.reviseToleranceWarnings` warnings (bump +1) into a `plan-revise` template step and halts at `limits.maxPlanRevisions` (2). `revisions` counts every `plan-revise` entry, failed ones included: a failed re-plan has `ok: false`, leaves the review fresh, and spends one revision. No test exercises the branch: `plan-revise` appears in `route.test.mjs` once, in a negative assertion. Log entries do not store the verdict, so "how many REVISE rounds" cannot be derived from the log.
- The `plan` and `plan-revise` prompts name no upstream artifact, and `/10x-plan` loads `research.md` or `frame.md` only when they are passed in (fewer questions: `10x-plan/SKILL.md`, Step 1.0). For an existing `plan.md` it enters refine mode, and its rule "treat the frame as authoritative" is written for the fresh-plan path.
- The real `/10x-research` writes YAML frontmatter with `status: complete|partial` (its `references/research-document.md`). The shipped `research-with-map.md` prompt replaces the report shape and never mentions frontmatter.
- Step budget: `limits.maxTotalSteps` 14 plus `rigor.budgetDelta` (-4, 0, +4) = 10, 14, 18. The check runs before `decide()` and halts when the executed count is at or above the budget, so a path of N executed steps reaches `done` only when N is below the budget, and one failed step on a path of 13 at budget 14 ends the run after the work is done.
- The existing tests assume a first step of `plan` for a goal without a plan (`route.test.mjs`, `archive.test.mjs`); the tests that start `--rigor thorough` assert meta only or start with a plan, or fill the log with `plan` entries before `init`.

### Key Discoveries:

- Worst failure-free path today is 12 executed steps: plan, plan review, two re-plan rounds each followed by a plan review, implement, impl review, two fix rounds each followed by an impl review. It tolerates one failed step (13 is below 14). A RETHINK-to-frame or a second-REVISE-to-research loop adds one step (13); gated pre-plan steps add three (16). Both loops are gated at `thorough` by default, so the standard worst path stays 12 and keeps its one-failure tolerance. At `thorough`, 16 of 18 tolerates one failed step (Decision 3).
- `maxPlanRevisions` 2 means the two new loop steps cannot both occur in one run: the frame loop needs a RETHINK, the research loop needs two REVISE re-plans.
- `/10x-plan` recognises a frame brief by `# Frame Brief:` or a `## Reframed` section and a research doc by path; `/10x-frame` writes the heading `## Reframed (or Confirmed) Problem Statement`. The `## Confidence` section lists all three labels as bullets, so verification must not parse the label.
- Every `/10x-frame` ask point (Step 1 confirm, Step 1.5, Step 4, Step 7) has a defined non-guess answer inside the skill, so a prompt-level guide can cover all of them.
- `signals.needsHuman` is read in `next()` before `decide()`, so it already wins over anything in `frame.md`.
- The real distillation report (`10x-domain-distillation/references/report.md`, and the reports written under `context/domain/` in other projects) has `## Invariants and policies` with, for more than three candidates, one `###` subheading per candidate and one table under each. The table header is `| id | invariant (quoted) | source | status | guarded at | gap |` (the reference template for the short form is `| id | candidate | invariant (quoted) | source | status | guarded at | gap |`). The status cell is often bold and may carry a qualifier: `**enforced** (new worlds)`, `**declared**`. There is no structured signal for "rule scattered" or "dependency leaks"; the leak predicate can only read the goal text.
- The `10x-frame` skill description lists the trigger phrases "fix", "bug" and "broken", but its own text says to skip mechanical changes. A router that opens the frame step on those bare words fires on `fix typo`.

## Desired End State

- At rigor `thorough` (set by `--rigor thorough` or a signal), before the first `plan` step, the router runs `research` (template `research-with-map` when `context/map/repo-map.md` has `artifact: repo-map`), then `domain-brief` (template `domain-aggregate` or `domain-acl`) when a predicate hits, then `frame` when framing doubt hits. Each step is skipped, with a logged reason, when its artifact already exists or its `when` signal is missing.
- At `lean` and `standard` nothing changes: no pre-plan step runs, no skip entry is written, and a plan-review RETHINK or a repeated REVISE routes to `plan-revise` exactly as on main. A test proves it against the Phase 1 characterization file, which stays byte-identical.
- Each pre-plan step is verified by its artifact. A failed attempt follows the existing failure rule (retry at +1 tier, halt after `maxAttemptsPerStep`).
- `frame` always runs at the opus/high tier. Its prompt tells an unattended subagent what to answer at each of the skill's ask points; with no evidence-backed answer it reports `blocked` with `signals.needsHuman` and the router halts. A goal that names a task but no separate cause is confirmed as the problem statement (Confidence LOW), not halted.
- At `thorough` only (`preplan.loops.minRigor`): a plan review `RETHINK` runs `frame` once (template `frame-rethink`), then re-plans; a second `RETHINK` after that re-plan halts. A `REVISE` that needs a re-plan, after one earlier `REVISE` re-plan, runs `research` once (template `research-revise`), then re-plans. A failed re-plan after the frame round is retried like any failed step.
- The plan prompt lists the upstream artifacts that exist, so `/10x-plan` loads them. The re-plan prompt also tells `/10x-plan` to treat `frame.md` as authoritative when it exists.
- Skips no longer hit the "skip loop" cap; a repeated skip of the same step in one call still halts.
- Tests walk the reference paths at `standard` (12 of 14, today's path) and `thorough` (16 of 18) and assert one step to spare; the README says the tolerance is one failed step.
- The existing RETHINK/REVISE behaviour has tests in their own file; the new loops have tests.
- `SKILL.md`, `README.md`, `AGENTS.md`, `prompts/README.md` and ADR-003 describe all of it. `node --test skills/10x-pipeline/test/*.test.mjs` passes.

## What We're NOT Doing

- Wiring `refactor-opportunities-research.md`, `ast-grep-verification.md` or `ranking-ast-grep-verification.md` (research open question 6). The change scope does not name them; they operate on an existing `research.md` and the two ast-grep files stop as `blocked` when `ast-grep` is missing, which would burn the retry budget. They stay in `prompts/` and `prompts/README.md` lists them as not wired.
- A new `signals` key. The contract stays at two keys (`rigor`, `needsHuman`).
- Reading the `## Confidence` label of `frame.md` anywhere in the router (Decision 5).
- Calibrating the word lists, the goal-match rule or the new tiers. No run data exists; S-06 is where it can come from.
- Opening the loops below `thorough` (Decision 10), and changing `rigor.budgetDelta` or any `limits` value (Decision 3).
- Per-phase executors, manual-row automation or the third-attempt re-plan (S-08, `phase-executors`).
- Any change to the report code, the archive adapter, the `status` or `risk` commands, or the README "Usage report" section (S-05 and S-06 work there).
- Moving the roadmap status. The plan commit does not touch `context/foundation/roadmap.md`; the implementing branch moves S-07 (a plan commit that flipped it conflicted with the adjacent S-05 and S-06 rows).
- Editing `context/archive/`, or `run.jsonl` and `meta.json` by hand.

## Implementation Approach

Five phases, each green on its own, each adding code in separate functions placed below `decide()` or in new test files, so the parallel S-05 and S-06 changes merge cleanly.

1. Lock the current loop with tests in their own file and store the verdict on log entries (no behaviour change).
2. Policy data and prompt wiring: steps, `preplan` block, templates, file-reference prompts, the frame decision guide, the artifact list and the frame authority rule in the re-plan prompt, plus an independent unattended `/10x-frame` proof.
3. Pre-plan gates: predicates, the pre-plan branch of `decide()`, verification by artifact, the skip-cap fix.
4. Backward loops (gated by rigor) and the budget reference paths.
5. Documentation, ADR-003 and the manual checks that need a real pipeline.

### Decisions on the research's open questions

No human could answer. Each decision follows research evidence or the owner defaults given for this run, and states what it costs to reverse.

| # | Decision | Evidence | Reversal cost |
| --- | --- | --- | --- |
| 1 | Gates of `research`, `domain-brief` and `frame` use `minRigor: "thorough"`. Before the plan only `--rigor thorough` or a signal reaches it. `frame` also needs the predicate `framingDoubt`: cause-shaped and design-shaped goal phrases, or a `signals.rigor` on an earlier pre-plan step. | Research section 4, section 6; owner default 1. Existing standard and lean tests keep their first step. | Low: one `minRigor` per gate in `policy.json`, plus `rigor.budgetDelta` (Decision 3 note) and the tests that assume thorough. Each lowered gate adds a costly step to every run at that level. |
| 2 | Legacy research is a template variant (`research-with-map`) of the one `research` step, chosen by `repoMapExists`. | Research section 2: both prompts write `research.md`; a second step would write it twice. | Medium: a second step in `preplan.order`, its gate, a verification case, and a skip rule for the plain research. |
| 3 | Pre-plan and loop steps count against the step budget. `rigor.budgetDelta` stays (-4, 0, +4). With the loops gated at `thorough` (Decision 10) the standard worst path stays 12 of 14 (today's, one failed step tolerated) and the thorough worst path is 16 of 18 (one failed step tolerated; two failures end the run with `Step budget 18 spent` after the work is done). Accepted: the thorough worst path needs a RETHINK or two REVISE rounds on top of three pre-plan steps, and a project can raise `rigor.budgetDelta.thorough`. The tests are reference paths, not bounds, and assert one step to spare. A project that lowers a gate or `loops.minRigor` to `standard` has a standard worst path of 13 and zero failure tolerance; the README says to raise its own `rigor.budgetDelta.standard` to 1. | Research section 5 (path arithmetic), re-derived in Phase 4; review F7. "Raise only as far as needed" gives zero. | Low: `rigor.budgetDelta` is data. Lean is not covered: its budget 10 already cannot hold the pre-existing 12-step path when plan review runs, and this change leaves that as it is. |
| 4 | A failed optional pre-plan step is retried at +1 tier and halts after `maxAttemptsPerStep`; it does not silently continue. | Research section 3; owner default 4. The failure rule already exists and is tested for other steps. | Medium: needs an `optional` flag, a logged skip after one failure, and care for `rigor.fromFailures`. |
| 5 | Frame Confidence LOW without `needsHuman` does not raise rigor, and the router never reads the Confidence label. The prompt records the label and the verification step in the brief; `/10x-plan` already surfaces LOW in its open risks. | Research section 6; `signals.needsHuman` wins (merged code). | Low: one `rigorInputs` entry that reads `frame.md`. |
| 6 | The three unwired prompts are out of scope (see "What We're NOT Doing"). | Research section 2; owner default 6. | Low: add a template, a gate and a verification case per prompt. |
| 7 | A gate closed by rigor is silent: no skip entry, so a `lean` or `standard` run looks exactly as today. A gate that is open and decides not to run (artifact exists, `when` missed) logs a skip with its reason. | Skip entries exist to make a saving visible (ADR-003). A rigor-closed step was never in that run's path. Silent closing keeps every existing skip-count test valid. | Low: log a skip for closed gates too; adds up to three rows to every standard and lean report. |
| 8 | Pre-plan steps run only before the first `plan` step of a run. A later rigor rise or a resume with a higher `--rigor` after a plan attempt does not open them. | Keeps `decide()` deterministic from the log; the plan attempt is when the goal is read. | Low: drop the guard. |
| 9 | `framingDoubt` phrases (word-start match on the lowercased goal): `root cause`, `should we even`, `is this the right`, `challenge the assumption`, `rethink`, `before i plan`, `caused by`, `because`, `assuming`. The bare verbs `fix`, `bug`, `broken` from the skill description are not in the default list, so `fix typo`, `fixture cleanup` and `fixes for the router` open nothing. A project that wants the skill's full list sets `preplan.predicates.framingDoubt.goalWords` (the README shows how). `dependencyLeak` = vendor, sdk, third-party, third party, wrapper, adapter, leak, anti-corruption, swap out, external api. `aggregateGap` is parsed from the real distillation format (Phase 3 change 1). All three sit in `policy.json`. | Research section 6; review F5, F6. Uncalibrated. | Low: data. |
| 10 | The RETHINK-to-frame and REVISE-to-research loops are gated by `preplan.loops.minRigor`, default `thorough`. Below it, RETHINK and REVISE keep today's `plan-revise` behaviour with today's counting. The level read is the run's current level, so a run that rose to `thorough` mid-run opens the loops from then on. | Review F1 (Fix A): the alternative put an unproven opus/high step on every standard RETHINK and made "standard looks as before" false. Roadmap S-07 outcome is delivered for `thorough`; ADR-002 diagram 6 back edge is reachable only there until run data justifies lowering the gate. | Low: set `minRigor` to `standard` in `policy.json` or a project override; see Decision 3 for the budget consequence and README for the `10x-frame` requirement. |
| 11 | `research` and `domain-brief` start at tier 3 (sonnet/high, min 2 and 3, max 5), `interactive: true`. `frame` is pinned at tier 4 (opus/high). | The research skill and the domain prompts ask questions; frame pin is the change's scope. Tiers are uncalibrated. | Low: data. |
| 12 | The plan and re-plan prompts list `research.md`, `frame.md` and the `refactor-*.md` briefs whenever the file exists in the change folder, including a `research.md` the user made by hand. When none exists the prompt text is byte-identical to today's. The re-plan prompt adds one rule line (from `prompts.frame-authority`) only when `frame.md` exists. The shipped `research-with-map.md` stays unedited; the `research`, `research-with-map` and `research-revise` templates each carry one extra rule line that the first lines of `research.md` are frontmatter with `status: complete` or `partial`. | Research section 5; review F3, F4. `/10x-plan` Step 1.0 handles an existing plan as refine mode, so the authority rule has to be in the prompt. | Low: remove `{artifacts}`, `{authority}` and the rule lines from the templates. |
| 13 | A failed `plan-revise` after a good `frame-rethink` is retried like any failed step. Failed `plan-revise` entries keep spending a revision exactly as on main, so the retry is one attempt at +1 tier and the second failure halts at `maxPlanRevisions`. | Review F2; the characterization tests pin today's counting. | Low: counting rule in `replanNext`. |
| 14 | An unattended frame whose goal names a task but no separate cause confirms the goal as the problem statement, sets Confidence to LOW with a verification step, and ends `done`. Only an empty goal with a `change.md` that has nothing to frame ends `blocked` with `needsHuman`. | Review F6: the first draft halted `fix typo`, a goal the default list no longer opens but an override can. | Low: guide text. |

### Dependency on S-05 and S-06

Both run in parallel and touch `README.md`, `SKILL.md`, `AGENTS.md`, `policy.json` and `route.mjs`. S-05 adds `pr-comment.mjs`; S-06 adds a `compare` command that reads the executed entries of `run.jsonl` and tolerates skips, ADR-005, a README block between "Usage report" and "Limits", and a `compare` policy block between `limits` and `archive`. This change keeps its edits separate and lists them exactly.

`route.mjs` regions edited, by phase (nothing else in the file changes):

- Phase 1: `next()`, the `entry` literal gains the `verdict` key.
- Phase 2: below `render()`: new `promptText`, `artifactsLine`, `authorityLine`. `next()`: the one line that renders the prompt.
- Phase 3: `attachResult`, the `switch (last.step)` gains three cases before `default`. `decide()`, the "no plan yet" branch calls `preplanNext`. `next()`, the skip loop's guard and comment. A new section `// ---- pre-plan steps ----` below `decide()` holds `PREDICATES` and `preplanNext`.
- Phase 4: `decide()`, the body of the `needsReplan && plan.autoDone === 0` branch becomes a call to `replanNext`, defined in the new section; `decide()` already receives `ctx.level`.

`policy.json`: new `steps` entries after the last existing step; a top-level `preplan` key placed after `archive` (before or after any key S-05 or S-06 adds; no check or test relies on key order); new `prompts` entries.

Docs: new bullets or a new subsection, never inside the README "Usage report"; placement is given in Phase 5, and Phase 5 runs last and rebases onto whichever of S-05 and S-06 lands first (on a conflict keep both sides).

Additive for S-06 `compare`: log entries gain a `verdict` key (on `plan-revise` and `fix` entries only); the new step names are `research`, `domain-brief` and `frame`; new `template` values are `research`, `research-with-map`, `research-revise`, `domain-aggregate`, `domain-acl`, `frame`, `frame-rethink`; skip rows for pre-plan steps carry `rigor`, `reason` and `afterN` and no `risk` key. A Phase 3 test asserts that `status` and `report.md` print such a row.

## Phase 1: Lock the current loop; store the verdict

### Overview

Characterize the RETHINK/REVISE behaviour the router has today in a file of its own, so Phase 4 changes it against a green baseline and a diff proves the baseline did not move. One tiny code change: log entries keep the review verdict that caused them.

### Changes Required:

#### 1. Characterization tests

**File**: `skills/10x-pipeline/test/loops-existing.test.mjs` (new)

**Intent**: Black-box tests through the CLI with `helpers.mjs` fixtures (`makeProject`, `planText`, `writeReview`, `writeLog`, `entry`). They describe today's behaviour, are committed before any router change, and are never edited afterwards. Every project starts at an explicit `--rigor standard` (a short-goal case also runs at `lean`), the levels where Decision 10 keeps today's behaviour, so no policy override is needed. Test names start with `existing loop`.

**Contract**: Cases: RETHINK with no checked Automated row returns step `plan`, template `plan-revise`, tier raised by `escalation.rethinkBump` (`tierWhy` shows `+2 from results`), prompt carries `verdict: RETHINK`; REVISE with one critical re-plans at `+1`; REVISE with warnings equal to `review.reviseToleranceWarnings` goes on to `implement`, one warning more re-plans; two earlier `plan-revise` entries followed by a RETHINK or a REVISE needing a re-plan halt with `Plan still <verdict> after 2 revisions`; a failed `plan-revise` entry counts as a revision (one failed entry then a good one halts the third attempt); RETHINK with a checked Automated row does not re-plan; a second REVISE after a good re-plan returns `plan-revise` again with no `research` step; RETHINK after a good re-plan returns `plan-revise` with no `frame` step.

#### 2. Verdict on the log entry

**File**: `skills/10x-pipeline/scripts/route.mjs`, `skills/10x-pipeline/test/loops.test.mjs` (new)

**Intent**: The loop rules of Phase 4 must tell a REVISE re-plan from a RETHINK re-plan. The entry built in `next()` already receives `d.verdict` for rendering; keep it on the entry.

**Contract**: The entry gains `verdict` (a non-empty string) when `d.verdict` is set (today: `plan-revise` and `fix`), and no key otherwise. Nothing reads it yet. Old logs without the key stay valid. The test `verdict on the entry` in `loops.test.mjs` asserts the key for `plan-revise` and `fix` entries and its absence for `plan`; it is committed with the code change, after the characterization commit.

### Success Criteria:

#### Automated Verification:

- Characterization tests pass: `node --test skills/10x-pipeline/test/loops-existing.test.mjs`
- Whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs`
- The verdict is stored on the entry: `node --test --test-name-pattern="verdict on the entry" skills/10x-pipeline/test/loops.test.mjs`

#### Manual Verification:

- Reading `loops-existing.test.mjs` top to bottom, each test name states one rule of today's RETHINK/REVISE behaviour and none depends on Phase 3 or 4 code
- `git log --oneline` shows the commit of `loops-existing.test.mjs` before the commit of the `verdict` change, so the tests were green on unmodified logic

**Implementation Note**: After this phase and its automated checks pass, pause for manual confirmation before Phase 2.

---

## Phase 2: Policy data and prompt wiring

### Overview

Add the data the router will read (steps, the `preplan` block, templates), the loader that turns `@prompts/<file>.md` references into prompt text, the frame decision guide, the artifact list and the frame authority rule for the re-plan prompt. No gate logic yet: nothing returns a new step, so run behaviour is unchanged except that a plan prompt lists artifacts that exist. The guide does not depend on the router, so it is proven here with real unattended `/10x-frame` runs, before the router code that relies on it.

### Changes Required:

#### 1. Steps, `preplan` block and templates

**File**: `skills/10x-pipeline/policy.json`

**Intent**: Register the three new step names with their tiers, add the gate configuration as data, and add one template per variant. New `steps` entries go after the last existing step; the new top-level key `preplan` goes after `archive` (no check relies on its position).

**Contract**: `steps`: `research` (skill `10x-research`, base 3, min 2, max 5, interactive), `domain-brief` (skill `null`, base 3, min 3, max 5, interactive), `frame` (skill `10x-frame`, base 4, min 4, max 4, interactive). `preplan`: `order` (`research`, `domain-brief`, `frame`); `gates.<step>` with `minRigor` (all `thorough`), optional `when` (list of predicate names, any must hit; empty or absent means always), `skipIf` (list, any hit skips), `template` (default) and `variants` (`[{ when, template }]`, first hit wins). Values: `research` has `skipIf: ["researchExists"]`, template `research`, variant `repoMapExists` to `research-with-map`; `domain-brief` has `when: ["aggregateGap", "dependencyLeak"]`, `skipIf: ["briefExists"]`, variants `aggregateGap` to `domain-aggregate` and `dependencyLeak` to `domain-acl`, no default; `frame` has `when: ["framingDoubt"]`, `skipIf: ["frameExists"]`, template `frame`. `artifacts` maps template to file name in the change folder (`research`, `research-with-map`, `research-revise` to `research.md`; `domain-aggregate` to `refactor-invariant-aggregate.md`; `domain-acl` to `refactor-anti-corruption-layer.md`; `frame`, `frame-rethink` to `frame.md`). `predicates`: `repoMapExists` (`file`, expected `frontmatter.artifact`), `aggregateGap` (`files`: `context/domain/domain-distillation.md` and `context/domain/01-domain-distillation.md`; `statuses`: `declared`, `ignored`, `contradicted`; `minWordLength` 4; `stopwords`), `dependencyLeak` and `framingDoubt` (`goalWords`, Decision 9). `loops`: `minRigor` `thorough`, `rethinkToFrame` 1, `reviseResearchAfter` 1, `reviseResearchMax` 1 (read in Phase 4).

`prompts`: new `research` (`Run /10x-research {id} {goal}`, write `context/changes/{id}/research.md`, plus the status rule line below), `research-with-map` (`["@prompts/research-with-map.md", "<status rule line>"]`), `research-revise` (run `/10x-research {id}` as a follow-up that closes the gaps named in `context/changes/{id}/reviews/plan-review.md`, verdict `{verdict}`, appends to `research.md` and updates `last_updated`; rule-form lines: do not rewrite earlier findings, no new question for the user, plus the status rule line), `domain-aggregate` (`@prompts/invariant-aggregate-refactor.md`), `domain-acl` (`@prompts/anti-corruption-layer.md`), `frame`, `frame-rethink` (both in change 3), `frame-authority`; `plan` and `plan-revise` gain `{artifacts}` (`Run /10x-plan {id} {goal}{artifacts}` and `Run /10x-plan {id}{artifacts}`), and `plan-revise` ends with `{authority}`.

The status rule line (identical in the three research templates): `- **GIVEN** you save context/changes/{id}/research.md **WHEN** you write its first lines **THEN** you **MUST** start the file with YAML frontmatter that holds status: complete or status: partial.` The `frame-authority` line: `- **GIVEN** context/changes/{id}/frame.md is listed under the upstream artifacts **WHEN** you revise the plan **THEN** you **MUST** treat its reframed problem statement as authoritative and rework any approach that contradicts it instead of patching around the review findings.`

#### 2. Prompt loader, artifact list and authority line

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: A prompt value is a string, or an array of strings joined with newlines. A part that matches `@prompts/<name>.md` is replaced by the trimmed content of that file under the skill directory. This lets `frame` and `frame-rethink` share one guide file and lets the existing prompt files be used unedited. Separate helpers build the `{artifacts}` and `{authority}` text.

**Contract**: New functions below `render`: `promptText(policy, template)` returns the resolved text and throws an `Error` naming the template when the key is missing or a reference does not resolve (the dispatch turns it into a JSON halt). The reference pattern is `^@prompts/[A-Za-z0-9._-]+\.md$`, so no path leaves the `prompts/` folder. References are resolved before `render`, so a goal text can never inject one. `artifactsLine(p, policy)` returns `""` when none of the files in `preplan.artifacts` exists in the change folder, else `"\nUpstream artifacts (read each fully before planning): <path>, <path>"` with project-relative paths in the order of first appearance in the map. `authorityLine(p, policy, template)` returns `"\n" + prompts["frame-authority"]` when the template is `plan-revise` and `frame.md` exists, else `""`. `next()` calls `promptText` instead of `policy.prompts[template]` and passes `artifacts` and `authority` as render variables. The `archive` prompt path is untouched.

#### 3. Frame decision guide

**File**: `skills/10x-pipeline/prompts/frame-unattended.md` (new)

**Intent**: One rule per ask point of `/10x-frame`, in the ADR-004 form, so the subagent answers from evidence instead of guessing, and stops with `needsHuman` only when no evidence-backed answer exists.

**Contract**: Rules, each one line with one bold keyword: Step 1 echo and confirm is treated as confirmed. Step 1.5 is answered from `change.md` notes, the goal and `research.md`; when none of them answers, choose the skill's own "I'm not sure / haven't separated them yet" option. Step 4 is skipped when Step 3 evidence is conclusive (the skill allows it), else answered from Step 3 evidence, else "I'm not sure / haven't checked" with the brief's Confidence set to LOW. Step 7 chooses "Hand off to /10x-plan" for HIGH or MEDIUM and "Stop here" for LOW. The clipboard command is never run. The brief is written to `context/changes/{id}/frame.md` with the `## Reframed (or Confirmed) Problem Statement` heading intact and exactly one Confidence label stated. A LOW brief lists its verification step and the run still ends `done`. When the goal names a task but no separate observation or cause, the goal is the confirmed problem statement, Confidence is LOW, the run ends `done` (Decision 14). Only when the goal is empty and `change.md` holds nothing to frame, report `blocked` with `signals.needsHuman` naming what is missing. Every assumption cites its evidence. `prompts.frame` is `["Run /10x-frame {id} {goal}\nWrite the brief to context/changes/{id}/frame.md.", "@prompts/frame-unattended.md"]`. `prompts.frame-rethink` has a first part that says plan review `context/changes/{id}/reviews/plan-review.md` returned `{verdict}`, to treat its findings as the observation to test, and to update `frame.md` in place, then the same file reference.

#### 4. Prompt documentation

**File**: `skills/10x-pipeline/prompts/README.md`

**Intent**: The intro says the files are for "optional pre-plan steps"; state which are wired and which are not.

**Contract**: The table gains a "Wired as" column (`research-with-map` template, `domain-aggregate`, `domain-acl`, `frame` guide); the three unwired files are listed under a "Not wired" heading with the reason (they work on an existing `research.md`; the ast-grep ones stop as `blocked` when `ast-grep` is missing). `frame-unattended.md` is added.

#### 5. Tests

**File**: `skills/10x-pipeline/test/rules.test.mjs`, `skills/10x-pipeline/test/preplan.test.mjs` (new)

**Intent**: The form test must accept array prompts and file references. New tests cover the loader, the artifact list, the authority line and the research frontmatter rule.

**Contract**: In `rules.test.mjs` the policy prompt test flattens arrays before splitting lines. In `preplan.test.mjs`: every `@prompts/` reference in `policy.prompts` resolves to an existing file; every file in `prompts/` is referenced by a policy prompt or listed in `prompts/README.md` under "Not wired" (name: `every prompt file is wired or documented as not wired`); the plan prompt of a project without artifacts equals today's text exactly, as does the `plan-revise` prompt; with `research.md` and `frame.md` present the plan prompt lists both paths on its second line; the `plan-revise` prompt carries the frame authority line only when `frame.md` exists (name: `frame authority rule only with frame.md`); the three research templates each hold the status rule line (name: `research templates ask for status frontmatter`); a missing or malformed reference yields a JSON halt `Router error:` and exit 1; the `frame` rendered prompt contains the ask points (`Step 1.5`, `Step 4`, `Step 7`) and the clipboard prohibition (name: `frame guide covers each ask point`). The last test only checks that the guide holds the headings its author was told to write; the proof that the guide works is the unattended runs in the Manual rows below.

### Success Criteria:

#### Automated Verification:

- Form test accepts the new prompts and the guide file: `node --test skills/10x-pipeline/test/rules.test.mjs`
- Loader and artifact tests pass: `node --test skills/10x-pipeline/test/preplan.test.mjs`
- Every prompt file is wired or documented: `node --test --test-name-pattern="wired or documented" skills/10x-pipeline/test/preplan.test.mjs`
- The frame guide covers each ask point: `node --test --test-name-pattern="frame guide" skills/10x-pipeline/test/preplan.test.mjs`
- `policy.json` is valid, carries the `preplan` block with loops gated at `thorough`, and pins `frame` at tier 4: `node -e 'const p=require("./skills/10x-pipeline/policy.json");const f=p.steps.frame;if(!p.preplan||p.preplan.loops.minRigor!=="thorough"||!f||f.baseTier!==4||f.minTier!==4||f.maxTier!==4)process.exit(1)'`
- Whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs`
- Research templates ask for the status frontmatter and the authority rule is conditional: `node --test --test-name-pattern="status frontmatter|frame authority" skills/10x-pipeline/test/preplan.test.mjs`

#### Manual Verification:

- `prompts/frame-unattended.md` reads as one rule per ask point and a human can map each rule to a step of `~/.claude/skills/10x-frame/SKILL.md`
- Unattended `/10x-frame` with a bug-shaped goal (for example `Logins fail after a password reset because the token cache is stale; fix the cache`), run with the router's prompt assembled by hand (`prompts.frame` with `{id}` and `{goal}` filled, the guide file, then `prompts.suffix`): the subagent never calls `AskUserQuestion` or waits for input, never runs `pbcopy`, `frame.md` has a `## Reframed (or Confirmed) Problem Statement` and exactly one Confidence label, and the RESULT line carries `assumptions` that cite evidence
- Unattended `/10x-frame`, run as in the previous row, with goal `fix typo` and a `change.md` without notes ends `done` with a confirmed problem statement and Confidence LOW, not `blocked`
- Unattended `/10x-frame`, run as in the previous row, with an empty goal and a `change.md` without notes ends `blocked` with `signals.needsHuman`

**Implementation Note**: After this phase and its automated checks pass, pause for manual confirmation before Phase 3. If a Manual run shows the guide fails, fix the guide here, before the router code that relies on it.

---

## Phase 3: Pre-plan gates, verification by artifact, skip-cap fix

### Overview

The router now runs the pre-plan steps. Predicates, the pre-plan branch of `decide()` and the artifact checks land together, because a step without its check would pass unverified. The skip-loop cap is fixed in the same phase because three gated-out steps are the first case that needs it.

### Changes Required:

#### 1. Predicates

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: Pure, read-only functions, keyed by the names the policy uses. Unknown name: no hit. Malformed config: no hit, never a throw (the `goalClass` rule). Each returns `{ hit, why }` so a skip reason can name its cause.

**Contract**: A section `// ---- pre-plan steps ----` below `decide()` holds a `PREDICATES` map. `researchExists`, `frameExists`, `briefExists`: the file named by `preplan.artifacts` (briefs: either brief file) exists in the change folder. `repoMapExists`: the configured file exists and `frontmatterField(file, "artifact")` equals the configured value. `framingDoubt`: a configured phrase starts at a word start of the lowercased goal (index 0 or right after a non-letter, non-digit; phrases may contain spaces), or an executed `research` or `domain-brief` entry of this run carries `signals.rigor`. `dependencyLeak`: same phrase match against its own list.

`aggregateGap` is specified against the real report format. In the first existing `files` entry take the section from the line `## Invariants and policies` to the next line that starts with `## ` (so `###` subsections are inside it). Read every pipe table in the section whose header row has a cell that starts with `invariant` (case-insensitive) and a cell equal to `status`. For each row: the status is the first alphabetic word of the status cell after removing `*`, `_` and backticks, lowercased (`**enforced** (new worlds)` gives `enforced`, `declared (soft)` gives `declared`); the candidate text is the `candidate` column when the header has one, else the text of the nearest preceding `###` heading in the section; the words compared are those of the candidate text, the invariant cell and the `gap` cell. The row hits when the status is in `statuses` and one of those words has at least `minWordLength` letters, is not in `stopwords` and also occurs in the goal (compared lowercased). Lists, such as "Code-only rules", are not tables and are ignored. No distillation file, no section or no matching row is no hit.

#### 2. Pre-plan branch

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: In the "no plan yet" branch of `decide()`, ask `preplanNext()` first; when it returns nothing, return step `plan` as today.

**Contract**: `preplanNext(p, fullLog, policy, meta, ctx)` returns `null`, `{ skip: { step, reason } }` or `{ step, template, bump: 0, reason }`. It returns `null` when any executed `plan` entry exists (Decision 8). For each step in `preplan.order`, in order: a gate that is not an object is ignored. An executed entry whose template belongs to the gate (default plus variants) with `ok` means handled. Entries but none `ok` means retry: return the same step and the template of the last entry. A skip entry for the step means handled. Otherwise: a level below `minRigor`, or an unknown level name, means the gate is closed: continue silently. A `skipIf` hit returns a skip `rigor <level>: <step> skipped (<predicate>: <why>)`. A `when` list with no hit returns a skip naming the missed signals. Otherwise return the step with the template of the first variant that hits, else the gate default; with neither, return a skip `no template matched`. `reason` names the step, the level and the hitting predicate. The step is the gate key (`research`, `domain-brief`, `frame`), so `tierFor`, the failure streak and the report need no change. A skip returned here has `step`, `reason` and no `risk`; `next()` writes it with the same fields as the plan-review skip, so the `risk` key is absent from the stored row.

#### 3. Verification by artifact

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: A `done` pre-plan step counts only when its file changed after the step started and has the shape the next step relies on.

**Contract**: `attachResult` gains three cases before `default`. The file is `preplan.artifacts[last.template ?? last.step]` in the change folder; a missing mapping fails the step. `research`: `mtime > startedAt` and `frontmatterField(file, "status")` is not null (the three research prompts ask for it, Phase 2). `frame`: `mtime > startedAt` and the text has a line starting `## Reframed`; the Confidence label is not read. `domain-brief`: `mtime > startedAt` and `frontmatterField(file, "type") === "refactor-plan"` (both shipped domain prompts ask for `type: refactor-plan`); the file comes from the entry's template, so the two templates verify against different files.

#### 4. Skip-loop cap

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: Replace the magic "three asks per call" with the real invariant: one skip per step per call. A second skip for a step already skipped in this call is a router bug and halts; any number of different steps may skip.

**Contract**: In `next()` track the step names skipped in the current call. When `decide()` returns a skip for a name already tracked, end the run with `Router error: skip loop` as today; otherwise log the skip and ask again. The comment above the loop is updated. Termination holds because step names are finite. The halt is a defensive guard: no policy data can make `decide()` repeat a skip, because a logged skip marks the step handled, so it has no test of its own; `three skips in one call` covers the loop that must not halt.

#### 5. Tests

**File**: `skills/10x-pipeline/test/preplan.test.mjs`

**Intent**: Drive the real router through the CLI. Artifact files get a fresh mtime with `fs.utimesSync` so ordering with `startedAt` never depends on clock resolution. The distillation fixtures are built from the real format: the table header template copied verbatim from `10x-domain-distillation/references/report.md`, plus rows shaped like a real report (bold status cells, a qualified status, `###` subsections with their own tables); the rows are synthetic and copy no text of a real project.

**Contract**: Cases (each a test with the quoted name fragment): `default policy keeps the first step at lean and standard` (also no skip entry written); `thorough opens the pre-plan gates` (`init --rigor thorough` returns step `research`; goal `fix typo` and a thorough run reaches `plan` without a halt, with skip entries for the domain brief and frame); `research skipped when research.md exists` (skip entry with reason, next gate evaluated); `repo map selects research-with-map` (frontmatter `artifact: repo-map`; a file without it selects `research`); `aggregateGap on the reference template` (the verbatim `candidate` header with a `declared` row sharing a word with the goal hits; a row `enforced`, or no shared word, does not; the second file path works); `aggregateGap on multi-candidate sections` (the `invariant (quoted)` header without a `candidate` column under two `###` headings: the candidate word comes from the heading; a table under a later `## Model vs code drift` is not read; a "Code-only rules" list is ignored); `aggregateGap qualified status` (`**enforced** (new worlds)` does not hit, `declared (soft)` and `**declared**` do); `domain brief by dependencyLeak`; `aggregateGap wins when both hit`; `domain brief skipped with no signal`; `framing doubt by cause-shaped goal` (`because`, `caused by`, `rethink`), `framing doubt by signals.rigor of an earlier step`, `framing doubt does not fire on fix typo` (`fix typo`, `fixture cleanup`, `fixes for the router`, `bug report template` open no frame at thorough; the skip reason names the missed signal); `three skips in one call` (all gates open, none runs: three skip entries with `afterN` 0, then step `plan`; report lists three skipped rows) — this fails on the old cap; `pre-plan skip row in status and report` (a skipped pre-plan step appears in the `status` JSON `steps` with `skipped: true`, its step name, reason and `risk: null`, and in `report.md` under `## Skipped steps`); `failed research is retried at the next tier and halts after three failures`; `frame stays at opus/high on retry`; `frame blocked with needsHuman halts and writes the report`; `needsHuman wins over a frame.md that says Confidence HIGH`; `frame done with Confidence LOW does not raise rigor and the plan step follows`; `verification by artifact` for research (missing `status` frontmatter fails, present passes, stale mtime fails), frame (no `## Reframed` fails) and both domain templates (wrong file or `type` fails); `plan runs after the pre-plan steps with the artifacts listed`; `a plan attempt closes the pre-plan phase` (resume with a higher rigor after a failed plan does not run research); `malformed preplan config never throws` (unknown predicate, unknown level, `gates` not an object: the run goes to `plan`).

### Success Criteria:

#### Automated Verification:

- Pre-plan tests pass: `node --test skills/10x-pipeline/test/preplan.test.mjs`
- Three skips in one call work: `node --test --test-name-pattern="three skips in one call" skills/10x-pipeline/test/preplan.test.mjs`
- Existing routing, churn and archive tests keep their first step: `node --test skills/10x-pipeline/test/route.test.mjs skills/10x-pipeline/test/churn.test.mjs skills/10x-pipeline/test/archive.test.mjs`
- Whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs`
- The router still adds no dependency and no new git write: `! (grep -nE '^import .* from "' skills/10x-pipeline/scripts/route.mjs | grep -v 'from "node:') && ! grep -nE "[\"']push[\"']|--no-verify" skills/10x-pipeline/scripts/route.mjs`
- Node 18 ban list is respected in new code: `! grep -nE "toSorted|groupBy|import\.meta\.dirname|mock\.timers|partialDeepStrictEqual" skills/10x-pipeline/scripts/route.mjs skills/10x-pipeline/test/preplan.test.mjs skills/10x-pipeline/test/loops.test.mjs skills/10x-pipeline/test/loops-existing.test.mjs`
- A plain `fix typo` goal opens no frame and does not halt: `node --test --test-name-pattern="framing doubt|thorough opens" skills/10x-pipeline/test/preplan.test.mjs`
- `aggregateGap` reads the real report format: `node --test --test-name-pattern="aggregateGap" skills/10x-pipeline/test/preplan.test.mjs`
- A pre-plan skip row prints in `status` and `report.md`: `node --test --test-name-pattern="pre-plan skip row" skills/10x-pipeline/test/preplan.test.mjs`

#### Manual Verification:

- The skip reasons in `status` of a scratch `--rigor thorough` run read clearly: each names the step, the level and the missing signal or the existing artifact

**Implementation Note**: After this phase and its automated checks pass, pause for manual confirmation before Phase 4.

---

## Phase 4: Backward loops and the budget reference paths

### Overview

At `thorough`, RETHINK runs frame once, then re-plans; a second RETHINK halts. A second REVISE re-plan is preceded by research. Below `preplan.loops.minRigor` the branch is today's code path with today's counting. Both loops are counted by template names so `maxPlanRevisions` and `maxFixLoops` keep their meaning. Then tests walk the reference paths and assert the budget margin.

### Changes Required:

#### 1. Re-plan branch

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: Move the body of the `needsReplan && plan.autoDone === 0` branch into `replanNext()` in the pre-plan section, and extend it. The condition and the `autoDone === 0` guard stay in `decide()`, so a plan with code is never re-planned by this branch.

**Contract**: `replanNext(log, pr, policy, level)` takes executed entries. `open` is true when `level` and `loops.minRigor` are both in the rigor ladder and the level's index is at or above the other's; any other case is closed, which is today's behaviour. `revisions` = entries with template `plan-revise`, failed ones included (as today). `okFrame` = entries with template `frame-rethink` and `ok`. In this order: (a) `open`, verdict RETHINK, `loops.rethinkToFrame` a positive integer, `okFrame` count at the cap, and an `ok` `plan-revise` entry after the last ok `frame-rethink`: halt `Plan review said RETHINK again after frame and re-plan. Needs a human.` A failed `plan-revise` does not count here: it leaves the review fresh and still RETHINK, so the re-plan is retried at the next tier by (e). (b) `revisions >= limits.maxPlanRevisions`: halt with today's text. (c) `open`, RETHINK and `okFrame` below the cap: step `frame`, template `frame-rethink`, `verdict` set, no bump. A failed `frame-rethink` has no `ok`, so it is retried here; `trailingFailures` on step `frame` halts after three. (d) `open`, REVISE, `loops.reviseResearchAfter` a positive integer, the number of ok `plan-revise` entries with `verdict === "REVISE"` at or above it, and ok `research-revise` entries below `loops.reviseResearchMax`: step `research`, template `research-revise`. (e) otherwise today's `plan-revise` step with today's bump. Non-integer or missing loop values disable that loop and give today's behaviour.

#### 2. Tests

**File**: `skills/10x-pipeline/test/loops.test.mjs`

**Intent**: The new loop rules, the proof that standard and lean behave as on main, and the budget reference paths. The walker answers each `run` action with the files the real skill would leave (plan with `## Progress`, review with verdict and findings line, ticked rows, `frame.md`, `research.md` with `status` frontmatter) and a `last-result.json`, with fresh mtimes, and asserts the model and effort of each step from the `status` output. The loop tests start at `--rigor thorough` with an existing `plan.md`, so the pre-plan phase is already closed.

**Contract**: Cases: `RETHINK runs frame-rethink once, then plan-revise` (entry template, `verdict` stored, no revision consumed by the frame step, plan review not re-run between frame and re-plan, `frame-rethink` at opus/high); `second RETHINK after frame and re-plan halts` (reason names frame and re-plan); `RETHINK below minRigor behaves as on main` (the same fixture as the characterization case at `standard` and at `lean` returns step `plan`, template `plan-revise`, the same tier and `tierWhy`, and writes no `frame-rethink` entry; the same fixture at `thorough` returns step `frame`); `REVISE below minRigor never adds research` (the second-REVISE fixture at `standard` returns `plan-revise`); `project override opens the loops at standard` (`minRigor: "standard"`); `RETHINK with the loop disabled behaves as before` (override `rethinkToFrame: 0` at `thorough`); `failed frame-rethink is retried and halts after three`; `failed plan-revise after frame-rethink is retried at the next tier` (frame ok, re-plan fails: next answer is `plan-revise` with `+1 for 1 failed attempt(s)` in `tierWhy`, not a halt; a good re-plan after it makes the next RETHINK halt); `second failed plan-revise after frame-rethink halts at maxPlanRevisions` (today's counting, Decision 13); `frame-rethink needsHuman halts`; `second REVISE adds research-revise before the second plan-revise`; `first REVISE re-plans without research`; `a RETHINK re-plan does not count as the first REVISE`; `third REVISE round halts at maxPlanRevisions`; `REVISE loop disabled by override`; `research-revise verification` (stale mtime fails the step).

Reference paths (a failure-free walk: every step reports `done` and is verified; failures spend budget by design; each test asserts the executed count is at most `budget - 2`, so one failed step still fits): `reference path at standard` walks today's worst path, plan, review REVISE with a critical, plan-revise, review REVISE with a critical, plan-revise, review SOUND, implement, impl review NEEDS ATTENTION, fix, impl review REJECTED, fix, impl review APPROVED: 12 steps, ends `done`, no `frame` and no `research` step; `reference path at thorough with RETHINK` walks research, domain brief, frame, plan, review RETHINK, frame-rethink, plan-revise, review REVISE with a critical, plan-revise, review SOUND, implement, impl review NEEDS ATTENTION, fix, impl review REJECTED, fix, impl review APPROVED: 16 steps, below 18, ends `done`; `reference path at thorough with research-revise` walks the three pre-plan steps, then REVISE, REVISE, research-revise (16 steps); `lean runs no pre-plan step and opens no loop` asserts every default gate's `minRigor` and `loops.minRigor` index is above `lean`. The names say "reference path" because an `implement` that ticks only some rows is still `ok`, so a real run can be longer.

### Success Criteria:

#### Automated Verification:

- Loop tests pass: `node --test skills/10x-pipeline/test/loops.test.mjs`
- The reference paths fit the budget with one step to spare: `node --test --test-name-pattern="reference path" skills/10x-pipeline/test/loops.test.mjs`
- A second RETHINK halts: `node --test --test-name-pattern="second RETHINK" skills/10x-pipeline/test/loops.test.mjs`
- Characterization tests of Phase 1 still pass unchanged: `node --test skills/10x-pipeline/test/loops-existing.test.mjs && git diff --exit-code "$(git log --diff-filter=A --format=%H -1 -- skills/10x-pipeline/test/loops-existing.test.mjs)" HEAD -- skills/10x-pipeline/test/loops-existing.test.mjs`
- Whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs`
- The budget deltas did not move: `node -e 'const p=require("./skills/10x-pipeline/policy.json");const d=p.rigor.budgetDelta;if(d.lean!==-4||d.standard!==0||d.thorough!==4||p.limits.maxTotalSteps!==14)process.exit(1)'`
- A standard or lean RETHINK behaves as on main: `node --test --test-name-pattern="below minRigor" skills/10x-pipeline/test/loops.test.mjs`
- A failed re-plan after the frame round is retried: `node --test --test-name-pattern="failed plan-revise" skills/10x-pipeline/test/loops.test.mjs`

#### Manual Verification:

- In the `route.mjs` diff of this phase, the only new logic in `decide()` is the call to `replanNext`, and branch (e) of `replanNext` is the code that stood in `decide()` before, unchanged

**Implementation Note**: After this phase and its automated checks pass, pause for manual confirmation before Phase 5.

---

## Phase 5: Documentation, ADR-003 and checks with a real pipeline

### Overview

Describe the behaviour where the next maintainer and the orchestrator look for it, record the decisions in ADR-003, and run the checks that need a real pipeline. This phase runs last and rebases onto whichever of S-05 and S-06 has landed; on a conflict in a shared file keep both sides.

### Changes Required:

#### 1. `SKILL.md` and `README.md`

**File**: `skills/10x-pipeline/SKILL.md`, `README.md`

**Intent**: AGENTS.md requires the "How the tier moves" list and the README routing bullets to follow `decide`. Add; do not rewrite existing lines; do not touch the Start section.

**Contract**: `SKILL.md` "How the tier moves" gains new bullets directly after the bullet "The archive step is not moved by any rule above": the pre-plan steps and their default gate (thorough, plus the signal for frame and domain brief), `frame` pinned, the verification by artifact, the loops and their gate (`preplan.loops.minRigor`, default thorough: at thorough RETHINK runs one frame round then re-plans and a second RETHINK halts, a second REVISE re-plan adds research; below it RETHINK and REVISE re-plan as before), and a sentence that the `description` and Start text stay valid because the orchestrator treats the new steps like any `run` action. `README.md`: one new bullet in "How routing works" directly after the bullet "The archive step is not moved by any of these rules" that names the pre-plan steps and loops and points to the subsection; a new requirements bullet in the "Requirements in the target project" list: the `10x-research` and `10x-frame` skills are used at rigor `thorough` only, and a missing one fails its step three times and halts the run; and a new subsection "Pre-plan steps" placed directly before the paragraph "Override any policy key per project" with the gate table, the predicate table (the `framingDoubt` phrases, a note that the skill's own `fix`, `bug`, `broken` triggers are left out and how to add them through `preplan.predicates.framingDoubt.goalWords`), the loops and `preplan.loops.minRigor`, and the budget note: at `thorough` the reference worst path is 16 of 18, so one failed step still fits; a project that lowers a gate or `loops.minRigor` to `standard` should raise `rigor.budgetDelta.standard` to 1. Nothing is edited inside "Usage report" or "Archive (opt-in)".

#### 2. `AGENTS.md`

**File**: `AGENTS.md`

**Intent**: Point agents to the new test files and the prompts folder.

**Contract**: Two new bullets in "Project Structure", placed after the `skills/10x-pipeline/test/` bullet: `skills/10x-pipeline/prompts/` (rule-form prompt files referenced from `policy.json` as `@prompts/<file>.md`) and the new test files `preplan.test.mjs`, `loops-existing.test.mjs` and `loops.test.mjs`. No existing bullet is edited.

#### 3. ADR-003

**File**: `docs/ADR/ADR-003-rigor-gated-routing.md`

**Intent**: Record the decisions of this change; the file already owns the table of parts.

**Contract**: The table row `pre-plan-steps` becomes `implemented`. A new section "Pre-plan steps and loops" at the end states: the gate form and its default (thorough), the loop gate `preplan.loops.minRigor` and why (a standard RETHINK stays as before), silent closing versus logged skips, the predicates and their uncalibrated word lists (and why `fix` and `bug` are not in the list), verification by artifact, frame authority (`needsHuman` wins; the Confidence label is never read; a plain goal ends `done` at LOW), the loops and their counters (including that failed re-plans keep spending a revision), the budget arithmetic (standard 12 of 14 unchanged, thorough 16 of 18, one failed step tolerated; lean unchanged and not covered), the skip rule (one skip per step per call), and the assumptions of Decisions 1 to 14 that carry a cost. Rule lines are in the ADR-004 form, checked by `rules.test.mjs`.

### Success Criteria:

#### Automated Verification:

- ADR rule lines follow the form: `node --test skills/10x-pipeline/test/rules.test.mjs`
- Whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs`
- Docs name the new behaviour and the loop gate: `grep -q "frame-rethink" docs/ADR/ADR-003-rigor-gated-routing.md && grep -q "Pre-plan steps" README.md && grep -q "pre-plan" skills/10x-pipeline/SKILL.md && grep -q "preplan.test.mjs" AGENTS.md && grep -q "loops.minRigor" README.md`
- ADR-003 marks the change implemented: `grep -E "pre-plan-steps.*implemented" docs/ADR/ADR-003-rigor-gated-routing.md`
- Router output is valid JSON for `init` and `status` in a scratch change folder (AGENTS.md check): `d=$(mktemp -d); mkdir -p "$d/context/changes/demo"; node -e 'require("fs").writeFileSync(process.argv[1],"---\nchange_id: demo\nstatus: planned\n---\n")' "$d/context/changes/demo/change.md"; R=$PWD/skills/10x-pipeline/scripts/route.mjs; (cd "$d" && node "$R" init demo --goal "fix typo" --rigor thorough | node -e 'JSON.parse(require("fs").readFileSync(0,"utf8"))' && node "$R" status demo | node -e 'JSON.parse(require("fs").readFileSync(0,"utf8"))')`

#### Manual Verification:

- A real `--rigor thorough` pipeline run with a repo map and a distillation fixture goes research-with-map, domain brief, frame, plan, the plan prompt lists the artifacts, and `research.md` starts with frontmatter that holds `status:`
- A real RETHINK, frame, re-plan run at `--rigor thorough` (a scratch change whose plan contradicts the code, so the real `/10x-plan-review` returns RETHINK): record in the review file or the PR text what `/10x-plan` did with `frame.md`, that is, whether the re-plan changed its approach to match the reframed problem statement or patched the old plan; if it patched, strengthen the `frame-authority` line before merging
- `README.md` reads correctly for a user who never uses `--rigor thorough`: the new text says the pre-plan steps and loops are `thorough` only, and a standard or lean run needs no new skill and shows no new step

---

## Testing Strategy

### Unit Tests:

- Predicates through the CLI (no module exports exist): word-start phrase matching, table parsing of the distillation format (reference template, multi-candidate subsections, qualified statuses), repo map frontmatter, malformed config falls back to no hit.
- `promptText`, `artifactsLine` and `authorityLine` through rendered prompts.
- Verification cases for each step and template.

### Integration Tests:

- Full walks with a scripted subagent: the gate matrix, both loops, the reference paths at `standard` and `thorough`.
- Failure paths: failed research, failed frame-rethink, failed re-plan after the frame round, `needsHuman`, missing artifact, stale mtime.
- Regression: `loops-existing.test.mjs` is byte-identical to its first commit, and the existing suite runs as a whole after each phase.

### Manual Testing Steps:

1. Unattended `/10x-frame` runs with a clear goal, a thin goal and an empty goal (Phase 2 rows).
2. A `thorough` pipeline run end to end in a scratch repo, with a real RETHINK (Phase 5 rows).

## Performance Considerations

None for the router: the pre-plan branch reads at most five small files per `next`. The cost that matters is model spend: a `thorough` run adds up to three steps (frame at opus/high) before the plan and up to one loop step. Nothing runs them at `lean` or `standard` by default.

## Migration Notes

A run in flight when the router is upgraded has a `plan` entry already or, at `standard`, a closed gate, so it never starts a pre-plan step; its RETHINK and REVISE handling is unchanged. A `thorough` run in flight with a plan and a RETHINK review gets the frame round on its next `next`. Old logs have no `verdict` on entries: Phase 4's REVISE count reads them as no earlier REVISE, so an old run never gets a `research-revise`. A project policy override that sets `rigor.budgetDelta` is untouched.

## References

- Related research: `context/changes/pre-plan-steps/research.md`
- Plan review: `context/changes/pre-plan-steps/reviews/plan-review.md`
- Roadmap: `context/foundation/roadmap.md` S-07; PRD FR-001, FR-003, FR-007
- Architecture: `docs/ADR/ADR-002-change-lifecycle-ideation-to-archive.md` (diagrams 5 and 6), `docs/ADR/ADR-003-rigor-gated-routing.md`, `docs/ADR/ADR-004-prompt-rules-as-scenarios.md`
- Router symbols: `decide`, `attachResult`, `next`, `tierFor`, `render`, `frontmatterField`, `trailingFailures` in `skills/10x-pipeline/scripts/route.mjs`
- Prompt files: `skills/10x-pipeline/prompts/`
- Prior plan used as pattern: `context/archive/2026-10-30-archive-adapter/plan.md`
- Toolkit interfaces: `~/.claude/skills/10x-frame/SKILL.md` (ask points, `## Reframed`, Confidence), `~/.claude/skills/10x-plan/SKILL.md` Step 1.0, `~/.claude/skills/10x-research/references/research-document.md` (`status` frontmatter), `~/.claude/skills/10x-domain-distillation/references/report.md` (invariants table and `###` subsections), `~/.claude/skills/10x-repo-map/references/report.md` (`artifact: repo-map`)

## Review response

Plan review of 2026-10-31 (REVISE: 1 critical, 7 warnings, 1 observation). Each finding was re-checked against `route.mjs`, `policy.json`, `prompts/` and the installed toolkit skills before it was accepted. Details and reasons are in the `Decision` fields of `reviews/plan-review.md`.

- F1 (critical), accepted, Fix A: `preplan.loops.minRigor`, default `thorough` (Decision 10). Verified: `decide()` had no rigor check on the re-plan branch, so a standard RETHINK would have run `frame`. Brief, Desired End State, Phase 4 and the final manual row now say "thorough only". Phase 4 gets `RETHINK below minRigor behaves as on main`, and the Phase 1 characterization file (own file, byte-identical check) proves the baseline. The README requirement for `10x-research` and `10x-frame` is true as written.
- F2, accepted: halt rule (a) counts only `ok` `plan-revise` entries after the last ok `frame-rethink`; test `failed plan-revise after frame-rethink is retried at the next tier`. Verified that `revisions` counts failed entries, so the retry is one attempt and the second failure halts at `maxPlanRevisions` (Decision 13); the finding's "halts after three" is not reachable and the test says so.
- F3, accepted: `prompts.frame-authority` rule line, appended to the `plan-revise` prompt only when `frame.md` exists (Decision 12), tested in Phase 2; the hand-written verdict row is gone and Phase 5 has a real RETHINK, frame, re-plan run that records what `/10x-plan` did.
- F4, accepted, Fix A: a status-frontmatter rule line in the three research templates, `research-with-map.md` stays unedited (verified: it asks for no frontmatter; the domain prompts do ask for `type: refactor-plan`). Test plus a real-run row.
- F5, accepted: `aggregateGap` re-specified against the real report (`## ` section bound, `invariant*` header, first alphabetic word of the status, candidate from the `###` heading). Verified on a real report under another project's `context/domain/`; fixtures are built from the reference template and synthetic rows in that shape.
- F6, accepted: bare `fix`, `bug`, `broken` leave the default list; the guide confirms a plain goal at Confidence LOW instead of halting (Decision 9, 14). Tests that `fix typo` opens no frame and does not halt; a manual unattended run covers it.
- F7, accepted with a decision: with Fix A the standard worst path stays 12 of 14. The thorough worst path is 16 of 18 and tolerates one failed step; `budgetDelta` is not raised (Decision 3). Tests renamed "reference path" and assert one step to spare. The README gives the number for projects that open the loops at standard.
- F8, accepted: `roadmap.md` restored to its version at `54f1729`; the "Dependency" section lists every `route.mjs` region by phase; the `preplan` key is placed "after `archive`" with no order check; `verdict`, the new step names and skip rows are stated as additive for S-06 and a Phase 3 test checks `status` and `report.md`; docs are Phase 5 and rebase last. Deviation from the plan skill's default: the roadmap status sync was left to the implementing branch on purpose.
- F9, accepted: old rows 2.8, 3.7, 3.8, 4.7 and 5.9 are now assertions (or merged into tests); the characterization tests moved to `loops-existing.test.mjs` with a `git diff` check in row 4.4; the unattended `/10x-frame` runs moved from Phase 5 to Phase 2. Row numbers changed where rows moved; 2.5 and 4.2 changed title because their claims changed. Nothing was checked yet.

## Review response (round 2)

Plan review round 2 (`reviews/plan-review-2.md`, verdict SOUND, 3 warnings, 2 observations) is binding for the implementation. Phase blocks and Progress row titles are unchanged; these amendments apply inside the existing phases and rows. Decisions are in the `Decision` fields of the review file.

- F1: "standard looks as before" holds while the level stays standard. A rise to thorough mid-run (a plan of 6 or more phases, 3 failed steps, 3 hot paths, `signals.rigor`) opens the loops (Decision 10 kept). Row 5.8 is read as "a user who never reaches thorough"; the README bullet and Migration Notes name the ways to reach it, including an in-flight standard run whose plan has 6 or more phases (its next `next` after a RETHINK starts the frame round). Phase 4 tests add `standard run that rises to thorough mid-run opens the loops` and `1-phase standard plan RETHINK takes today path (below minRigor)`.
- F2: `authorityLine` renders the `frame-authority` text with the real id before insertion. The line says it wins over the `plan-revise` line that keeps step indices and titles: the Progress contract (format, numbering, checkbox syntax) applies to the result, and phases and rows may change. One bold keyword. Phase 2 test: no `{` left in the rendered `plan-revise` prompt.
- F3: `aggregateGap` accepts a header cell starting with `invariant` or `policy` plus a `status` cell. Words are whole-word lowercase letter tokens of the `candidate` column, the invariant or policy cell and the `gap` cell; a `###` heading is not a word source. Default `stopwords` sit in `policy.json`. Tests cover the `policy (quoted)` table, a heading word that must not hit every row, and whole-word matching.
- Observations: rows 2.9 to 2.11 run in a scratch project (`mktemp -d`, throwaway `change.md`) and stay Manual; `frame-unattended.md` forbids plain-text questions; a test checks the plan prompt lists the artifacts that exist; row 5.6 also checks that the plan cites them.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Lock the current loop; store the verdict

#### Automated

- [x] 1.1 Characterization tests pass: `node --test skills/10x-pipeline/test/loops-existing.test.mjs` — ad19eb2
- [x] 1.2 Whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs`
- [x] 1.3 The verdict is stored on the entry: `node --test --test-name-pattern="verdict on the entry" skills/10x-pipeline/test/loops.test.mjs`

#### Manual

- [ ] 1.4 Reading `loops-existing.test.mjs` top to bottom, each test name states one rule of today's RETHINK/REVISE behaviour and none depends on Phase 3 or 4 code
- [ ] 1.5 `git log --oneline` shows the commit of `loops-existing.test.mjs` before the commit of the `verdict` change, so the tests were green on unmodified logic

### Phase 2: Policy data and prompt wiring

#### Automated

- [ ] 2.1 Form test accepts the new prompts and the guide file: `node --test skills/10x-pipeline/test/rules.test.mjs`
- [ ] 2.2 Loader and artifact tests pass: `node --test skills/10x-pipeline/test/preplan.test.mjs`
- [ ] 2.3 Every prompt file is wired or documented: `node --test --test-name-pattern="wired or documented" skills/10x-pipeline/test/preplan.test.mjs`
- [ ] 2.4 The frame guide covers each ask point: `node --test --test-name-pattern="frame guide" skills/10x-pipeline/test/preplan.test.mjs`
- [ ] 2.5 `policy.json` is valid, carries the `preplan` block with loops gated at `thorough`, and pins `frame` at tier 4: `node -e 'const p=require("./skills/10x-pipeline/policy.json");const f=p.steps.frame;if(!p.preplan||p.preplan.loops.minRigor!=="thorough"||!f||f.baseTier!==4||f.minTier!==4||f.maxTier!==4)process.exit(1)'`
- [ ] 2.6 Whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs`
- [ ] 2.7 Research templates ask for the status frontmatter and the authority rule is conditional: `node --test --test-name-pattern="status frontmatter|frame authority" skills/10x-pipeline/test/preplan.test.mjs`

#### Manual

- [ ] 2.8 `prompts/frame-unattended.md` reads as one rule per ask point and a human can map each rule to a step of `~/.claude/skills/10x-frame/SKILL.md`
- [ ] 2.9 Unattended `/10x-frame` with a bug-shaped goal (for example `Logins fail after a password reset because the token cache is stale; fix the cache`), run with the router's prompt assembled by hand (`prompts.frame` with `{id}` and `{goal}` filled, the guide file, then `prompts.suffix`): the subagent never calls `AskUserQuestion` or waits for input, never runs `pbcopy`, `frame.md` has a `## Reframed (or Confirmed) Problem Statement` and exactly one Confidence label, and the RESULT line carries `assumptions` that cite evidence
- [ ] 2.10 Unattended `/10x-frame`, run as in the previous row, with goal `fix typo` and a `change.md` without notes ends `done` with a confirmed problem statement and Confidence LOW, not `blocked`
- [ ] 2.11 Unattended `/10x-frame`, run as in the previous row, with an empty goal and a `change.md` without notes ends `blocked` with `signals.needsHuman`

### Phase 3: Pre-plan gates, verification by artifact, skip-cap fix

#### Automated

- [ ] 3.1 Pre-plan tests pass: `node --test skills/10x-pipeline/test/preplan.test.mjs`
- [ ] 3.2 Three skips in one call work: `node --test --test-name-pattern="three skips in one call" skills/10x-pipeline/test/preplan.test.mjs`
- [ ] 3.3 Existing routing, churn and archive tests keep their first step: `node --test skills/10x-pipeline/test/route.test.mjs skills/10x-pipeline/test/churn.test.mjs skills/10x-pipeline/test/archive.test.mjs`
- [ ] 3.4 Whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs`
- [ ] 3.5 The router still adds no dependency and no new git write: `! (grep -nE '^import .* from "' skills/10x-pipeline/scripts/route.mjs | grep -v 'from "node:') && ! grep -nE "[\"']push[\"']|--no-verify" skills/10x-pipeline/scripts/route.mjs`
- [ ] 3.6 Node 18 ban list is respected in new code: `! grep -nE "toSorted|groupBy|import\.meta\.dirname|mock\.timers|partialDeepStrictEqual" skills/10x-pipeline/scripts/route.mjs skills/10x-pipeline/test/preplan.test.mjs skills/10x-pipeline/test/loops.test.mjs skills/10x-pipeline/test/loops-existing.test.mjs`
- [ ] 3.7 A plain `fix typo` goal opens no frame and does not halt: `node --test --test-name-pattern="framing doubt|thorough opens" skills/10x-pipeline/test/preplan.test.mjs`
- [ ] 3.8 `aggregateGap` reads the real report format: `node --test --test-name-pattern="aggregateGap" skills/10x-pipeline/test/preplan.test.mjs`
- [ ] 3.9 A pre-plan skip row prints in `status` and `report.md`: `node --test --test-name-pattern="pre-plan skip row" skills/10x-pipeline/test/preplan.test.mjs`

#### Manual

- [ ] 3.10 The skip reasons in `status` of a scratch `--rigor thorough` run read clearly: each names the step, the level and the missing signal or the existing artifact

### Phase 4: Backward loops and the budget reference paths

#### Automated

- [ ] 4.1 Loop tests pass: `node --test skills/10x-pipeline/test/loops.test.mjs`
- [ ] 4.2 The reference paths fit the budget with one step to spare: `node --test --test-name-pattern="reference path" skills/10x-pipeline/test/loops.test.mjs`
- [ ] 4.3 A second RETHINK halts: `node --test --test-name-pattern="second RETHINK" skills/10x-pipeline/test/loops.test.mjs`
- [ ] 4.4 Characterization tests of Phase 1 still pass unchanged: `node --test skills/10x-pipeline/test/loops-existing.test.mjs && git diff --exit-code "$(git log --diff-filter=A --format=%H -1 -- skills/10x-pipeline/test/loops-existing.test.mjs)" HEAD -- skills/10x-pipeline/test/loops-existing.test.mjs`
- [ ] 4.5 Whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs`
- [ ] 4.6 The budget deltas did not move: `node -e 'const p=require("./skills/10x-pipeline/policy.json");const d=p.rigor.budgetDelta;if(d.lean!==-4||d.standard!==0||d.thorough!==4||p.limits.maxTotalSteps!==14)process.exit(1)'`
- [ ] 4.7 A standard or lean RETHINK behaves as on main: `node --test --test-name-pattern="below minRigor" skills/10x-pipeline/test/loops.test.mjs`
- [ ] 4.8 A failed re-plan after the frame round is retried: `node --test --test-name-pattern="failed plan-revise" skills/10x-pipeline/test/loops.test.mjs`

#### Manual

- [ ] 4.9 In the `route.mjs` diff of this phase, the only new logic in `decide()` is the call to `replanNext`, and branch (e) of `replanNext` is the code that stood in `decide()` before, unchanged

### Phase 5: Documentation, ADR-003 and checks with a real pipeline

#### Automated

- [ ] 5.1 ADR rule lines follow the form: `node --test skills/10x-pipeline/test/rules.test.mjs`
- [ ] 5.2 Whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs`
- [ ] 5.3 Docs name the new behaviour and the loop gate: `grep -q "frame-rethink" docs/ADR/ADR-003-rigor-gated-routing.md && grep -q "Pre-plan steps" README.md && grep -q "pre-plan" skills/10x-pipeline/SKILL.md && grep -q "preplan.test.mjs" AGENTS.md && grep -q "loops.minRigor" README.md`
- [ ] 5.4 ADR-003 marks the change implemented: `grep -E "pre-plan-steps.*implemented" docs/ADR/ADR-003-rigor-gated-routing.md`
- [ ] 5.5 Router output is valid JSON for `init` and `status` in a scratch change folder (AGENTS.md check): `d=$(mktemp -d); mkdir -p "$d/context/changes/demo"; node -e 'require("fs").writeFileSync(process.argv[1],"---\nchange_id: demo\nstatus: planned\n---\n")' "$d/context/changes/demo/change.md"; R=$PWD/skills/10x-pipeline/scripts/route.mjs; (cd "$d" && node "$R" init demo --goal "fix typo" --rigor thorough | node -e 'JSON.parse(require("fs").readFileSync(0,"utf8"))' && node "$R" status demo | node -e 'JSON.parse(require("fs").readFileSync(0,"utf8"))')`

#### Manual

- [ ] 5.6 A real `--rigor thorough` pipeline run with a repo map and a distillation fixture goes research-with-map, domain brief, frame, plan, the plan prompt lists the artifacts, and `research.md` starts with frontmatter that holds `status:`
- [ ] 5.7 A real RETHINK, frame, re-plan run at `--rigor thorough` (a scratch change whose plan contradicts the code, so the real `/10x-plan-review` returns RETHINK): record in the review file or the PR text what `/10x-plan` did with `frame.md`, that is, whether the re-plan changed its approach to match the reframed problem statement or patched the old plan; if it patched, strengthen the `frame-authority` line before merging
- [ ] 5.8 `README.md` reads correctly for a user who never uses `--rigor thorough`: the new text says the pre-plan steps and loops are `thorough` only, and a standard or lean run needs no new skill and shows no new step
