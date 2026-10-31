# Rigor-gated Pre-plan Steps and Backward Loops Implementation Plan

## Overview

Add four optional steps that run before the first plan (`/10x-research`, legacy research when a repo map exists, a domain brief, `/10x-frame`) and two backward loops after plan review (RETHINK goes to frame once, then re-plans; a second REVISE adds research, then re-plans). Gates live in `policy.json` as a rigor threshold plus named `when` and `skipIf` predicates; the predicates are implemented in `route.mjs`. Each new step is verified by the artifact it writes. `/10x-frame` is pinned to the opus/high tier and gets an unattended decision guide. The six prompt files already in `skills/10x-pipeline/prompts/` are wired in. The skip-loop cap that three gated-out steps would hit is fixed, and the existing RETHINK/REVISE loop, which has no tests, gets them.

This is change 2 of the rigor-gated routing split (roadmap S-07, PRD FR-001, FR-003, FR-007). It builds on the merged `rigor-levels` change (rigor level, `signals`, skip entries, effort floor; archived at `context/archive/2026-10-30-rigor-levels/`). Research: `context/changes/pre-plan-steps/research.md` (git commit 54f1729). No human could answer the research's six open owner questions; each is decided below as an assumption with its reversal cost.

## Current State Analysis

Code is named by function; the line numbers of the research are used only as anchors and shift when S-05 and S-06 merge.

- `decide()` has one exit before a plan exists: the "no plan yet" branch returns step `plan`. Rigor is resolved in `next()` before `decide()` with `risk = null` when `plan.md` is absent, so before the plan the level comes only from `--rigor`, the goal class, failed steps and `signals.rigor`. A plain goal is `standard`, a short goal `lean`; `thorough` needs `--rigor thorough` or a signal.
- Reusable mechanisms: skip entries (`decide` returns `{ skip }`, `next()` logs it), `d.template` selecting a prompt other than the step name, and `signals.needsHuman` halting before `decide()`.
- The skip loop in `next()` halts with `Router error: skip loop` when `decide()` returns a skip on the third ask in one call, so at most two skips can be logged per call. Three gated-out pre-plan steps would hit it.
- `attachResult` verifies four step names by artifact and defaults to `verified = true`. Research, frame and the domain brief have no case.
- `skills/10x-pipeline/prompts/` has six rule-form files and a README, form-checked by `rules.test.mjs`, and read by nothing in `route.mjs`. `policy.prompts` values are plain strings rendered with `{id}`, `{goal}`, `{verdict}`.
- The re-plan branch (`needsReplan && plan.autoDone === 0`) turns RETHINK (bump +2) and REVISE with criticals or more than `review.reviseToleranceWarnings` warnings (bump +1) into a `plan-revise` template step and halts at `limits.maxPlanRevisions` (2). No test exercises it: `plan-revise` appears in `route.test.mjs` once, in a negative assertion. Log entries do not store the verdict, so "how many REVISE rounds" cannot be derived from the log.
- The `plan` and `plan-revise` prompts name no upstream artifact, and `/10x-plan` loads `research.md` or `frame.md` only when they are passed in (fewer questions: `10x-plan/SKILL.md`, Step 1.0).
- Step budget: `limits.maxTotalSteps` 14 plus `rigor.budgetDelta` (-4, 0, +4) = 10, 14, 18. The check runs before `decide()` and halts when the executed count is at or above the budget, so a path of N executed steps reaches `done` only when N is below the budget.
- The existing tests assume a first step of `plan` for a goal without a plan (`route.test.mjs`, `archive.test.mjs`); the tests that start `--rigor thorough` assert meta only or start with a plan, or fill the log with `plan` entries before `init`.

### Key Discoveries:

- Worst failure-free path today is 12 executed steps: plan, plan review, two re-plan rounds each followed by a plan review, implement, impl review, two fix rounds each followed by an impl review. A RETHINK or second-REVISE loop adds one step (13). Gated pre-plan steps add three (16). Standard budget 14 and thorough budget 18 already hold both, so no `budgetDelta` change is needed (Decision 3).
- `maxPlanRevisions` 2 means the two new loop steps cannot both occur in one run: the frame loop needs a RETHINK, the research loop needs two REVISE re-plans.
- `/10x-plan` recognises a frame brief by `# Frame Brief:` or a `## Reframed` section and a research doc by path; `/10x-frame` writes the heading `## Reframed (or Confirmed) Problem Statement`. The `## Confidence` section lists all three labels as bullets, so verification must not parse the label.
- Every `/10x-frame` ask point (Step 1 confirm, Step 1.5, Step 4, Step 7) has a defined non-guess answer inside the skill, so a prompt-level guide can cover all of them.
- `signals.needsHuman` is read in `next()` before `decide()`, so it already wins over anything in `frame.md`.
- Domain-distillation invariants carry a `status` column (enforced, declared, ignored, contradicted); there is no structured signal for "rule scattered" or "dependency leaks". The leak predicate can only read the goal text.

## Desired End State

- At rigor `thorough` (set by `--rigor thorough` or a signal), before the first `plan` step, the router runs `research` (template `research-with-map` when `context/map/repo-map.md` has `artifact: repo-map`), then `domain-brief` (template `domain-aggregate` or `domain-acl`) when a predicate hits, then `frame` when framing doubt hits. Each step is skipped, with a logged reason, when its artifact already exists or its `when` signal is missing. At `lean` and `standard` nothing changes: no pre-plan step runs and no skip entry is written.
- Each pre-plan step is verified by its artifact. A failed attempt follows the existing failure rule (retry at +1 tier, halt after `maxAttemptsPerStep`).
- `frame` always runs at the opus/high tier. Its prompt tells an unattended subagent what to answer at each of the skill's ask points; with no evidence-backed answer it reports `blocked` with `signals.needsHuman` and the router halts.
- A plan review `RETHINK` runs `frame` once (template `frame-rethink`), then re-plans; a second `RETHINK` after that re-plan halts. A `REVISE` that needs a re-plan, after one earlier `REVISE` re-plan, runs `research` once (template `research-revise`), then re-plans.
- The plan prompt lists the upstream artifacts that exist, so `/10x-plan` loads them.
- Skips no longer hit the "skip loop" cap; a repeated skip of the same step in one call still halts.
- A test proves that the longest legal path fits the budget at `standard` (13 of 14) and `thorough` (16 of 18).
- The existing RETHINK/REVISE behaviour has tests; the new loops have tests.
- `SKILL.md`, `README.md`, `AGENTS.md`, `prompts/README.md` and ADR-003 describe all of it. `node --test skills/10x-pipeline/test/*.test.mjs` passes.

## What We're NOT Doing

- Wiring `refactor-opportunities-research.md`, `ast-grep-verification.md` or `ranking-ast-grep-verification.md` (research open question 6). The change scope does not name them; they operate on an existing `research.md` and the two ast-grep files stop as `blocked` when `ast-grep` is missing, which would burn the retry budget. They stay in `prompts/` and `prompts/README.md` lists them as not wired.
- A new `signals` key. The contract stays at two keys (`rigor`, `needsHuman`).
- Reading the `## Confidence` label of `frame.md` anywhere in the router (Decision 5).
- Calibrating the word lists, the goal-match rule or the new tiers. No run data exists; S-06 is where it can come from.
- Changing `rigor.budgetDelta` or any `limits` value (Decision 3).
- Per-phase executors, manual-row automation or the third-attempt re-plan (S-08, `phase-executors`).
- Any change to the report code, the archive adapter, the `status` or `risk` commands, or the README "Usage report" section (S-05 and S-06 work there).
- Editing `context/archive/`, or `run.jsonl` and `meta.json` by hand.

## Implementation Approach

Five phases, each green on its own and each adding code in separate functions placed below `decide()` or in new test files, so the parallel S-05 and S-06 changes merge cleanly.

1. Lock the current loop with tests and store the verdict on log entries (no behaviour change).
2. Policy data and prompt wiring: steps, `preplan` block, templates, file-reference prompts, the frame decision guide, the artifact list in the plan prompt.
3. Pre-plan gates: predicates, the pre-plan branch of `decide()`, verification by artifact, the skip-cap fix.
4. Backward loops and the budget proof.
5. Documentation, ADR-003 and the manual checks (including an unattended `/10x-frame` run).

### Decisions on the research's open questions

No human could answer. Each decision follows research evidence or the owner defaults given for this run, and states what it costs to reverse.

| # | Decision | Evidence | Reversal cost |
| --- | --- | --- | --- |
| 1 | Gates of `research`, `domain-brief` and `frame` use `minRigor: "thorough"`. Before the plan only `--rigor thorough` or a signal reaches it. `frame` also needs the predicate `framingDoubt`: its goal words (the skill's own trigger phrases) or a `signals.rigor` on an earlier pre-plan step. | Research section 4, section 6; owner default 1. Existing standard and lean tests keep their first step. | Low: one `minRigor` per gate in `policy.json`, plus `rigor.budgetDelta` (Decision 3 note) and the tests that assume thorough. Each lowered gate adds a costly step to every run at that level. |
| 2 | Legacy research is a template variant (`research-with-map`) of the one `research` step, chosen by `repoMapExists`. | Research section 2: both prompts write `research.md`; a second step would write it twice. | Medium: a second step in `preplan.order`, its gate, a verification case, and a skip rule for the plain research. |
| 3 | Pre-plan and loop steps count against the step budget. `rigor.budgetDelta` stays (-4, 0, +4): the longest failure-free legal path is 13 at standard and 16 at thorough, below 14 and 18. A test walks both paths. A project that lowers a gate must raise its own delta; the README says so. | Research section 5 (path arithmetic), re-derived in Phase 4. "Raise only as far as needed" gives zero. | Low: `rigor.budgetDelta` is data. Lean is not covered: its budget 10 already cannot hold the pre-existing 12-step path when plan review runs, and this change leaves that as it is. |
| 4 | A failed optional pre-plan step is retried at +1 tier and halts after `maxAttemptsPerStep`; it does not silently continue. | Research section 3; owner default 4. The failure rule already exists and is tested for other steps. | Medium: needs an `optional` flag, a logged skip after one failure, and care for `rigor.fromFailures`. |
| 5 | Frame Confidence LOW without `needsHuman` does not raise rigor, and the router never reads the Confidence label. The prompt records the label and the verification step in the brief; `/10x-plan` already surfaces LOW in its open risks. | Research section 6; `signals.needsHuman` wins (merged code). | Low: one `rigorInputs` entry that reads `frame.md`. |
| 6 | The three unwired prompts are out of scope (see "What We're NOT Doing"). | Research section 2; owner default 6. | Low: add a template, a gate and a verification case per prompt. |
| 7 | A gate closed by rigor is silent: no skip entry, so a `lean` or `standard` run looks exactly as today. A gate that is open and decides not to run (artifact exists, `when` missed) logs a skip with its reason. | Skip entries exist to make a saving visible (ADR-003). A rigor-closed step was never in that run's path. Silent closing keeps every existing skip-count test valid. | Low: log a skip for closed gates too; adds up to three rows to every standard and lean report. |
| 8 | Pre-plan steps run only before the first `plan` step of a run. A later rigor rise or a resume with a higher `--rigor` after a plan attempt does not open them. | Keeps `decide()` deterministic from the log; the plan attempt is when the goal is read. | Low: drop the guard. |
| 9 | `framingDoubt` word list = the trigger phrases in the `10x-frame` skill description. `dependencyLeak` = vendor, sdk, third-party, third party, wrapper, adapter, leak, anti-corruption, swap out, external api. `aggregateGap` = a row of an "Invariants and policies" table with status `declared`, `ignored` or `contradicted` that shares a word of 4 or more letters (minus a stopword list) with the goal. All three sit in `policy.json`. | Research section 6. Uncalibrated. | Low: data. |
| 10 | RETHINK to frame is not gated by rigor. Plan review is the gate: it only runs at the levels that want it. | Roadmap S-07 outcome; ADR-002 diagram 6. | Low: add `minRigor` to `preplan.loops`. |
| 11 | `research` and `domain-brief` start at tier 3 (sonnet/high, min 2 and 3, max 5), `interactive: true`. `frame` is pinned at tier 4 (opus/high). | The research skill and the domain prompts ask questions; frame pin is the change's scope. Tiers are uncalibrated. | Low: data. |
| 12 | The plan and re-plan prompts list `research.md`, `frame.md` and the `refactor-*.md` briefs whenever the file exists in the change folder, including a `research.md` the user made by hand. When none exists the prompt text is byte-identical to today's. | Research section 5; `/10x-plan` needs them passed in. | Low: remove `{artifacts}` from the two templates. |

### Dependency on S-05 and S-06

Both run in parallel and touch `README.md`, `SKILL.md`, `AGENTS.md` and `policy.json`. This plan adds docs as new bullets or a new subsection, never inside the README "Usage report" section; new policy keys sit after `archive`; new router code sits in functions below `decide()`; new tests go to new files.

## Phase 1: Lock the current loop; store the verdict

### Overview

Characterize the RETHINK/REVISE behaviour the router has today, so Phase 4 changes it against a green baseline. One tiny code change: log entries keep the review verdict that caused them.

### Changes Required:

#### 1. Verdict on the log entry

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: The loop rules of Phase 4 must tell a REVISE re-plan from a RETHINK re-plan. The entry built in `next()` already receives `d.verdict` for rendering; keep it on the entry.

**Contract**: The entry gains `verdict` (a non-empty string) when `d.verdict` is set (today: `plan-revise` and `fix`), and no key otherwise. Nothing reads it yet. Old logs without the key stay valid.

#### 2. Characterization tests

**File**: `skills/10x-pipeline/test/loops.test.mjs` (new)

**Intent**: Black-box tests through the CLI with `helpers.mjs` fixtures (`makeProject`, `planText`, `writeReview`, `writeLog`, `entry`). They describe today's behaviour and must pass before and after the code change above. Every project in them carries the policy override `{ preplan: { loops: { rethinkToFrame: 0, reviseResearchAfter: 0 } } }`, which does nothing now and switches the Phase 4 loops off later, so the tests keep describing prior behaviour after Phase 4. Test names start with `existing loop`.

**Contract**: Cases: RETHINK with no checked Automated row returns step `plan`, template `plan-revise`, tier raised by `escalation.rethinkBump` (`tierWhy` shows `+2 from results`), prompt carries `verdict: RETHINK`; REVISE with one critical re-plans at `+1`; REVISE with warnings equal to `review.reviseToleranceWarnings` goes on to `implement`, one warning more re-plans; two earlier `plan-revise` entries followed by a RETHINK or a REVISE needing a re-plan halt with `Plan still <verdict> after 2 revisions`; RETHINK with a checked Automated row does not re-plan; the new entry holds `verdict` for `plan-revise` and `fix` and none for `plan` (name: `verdict on the entry`).

### Success Criteria:

#### Automated Verification:

- Characterization tests pass: `node --test skills/10x-pipeline/test/loops.test.mjs`
- Whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs`
- The verdict is stored on the entry: `node --test --test-name-pattern="verdict on the entry" skills/10x-pipeline/test/loops.test.mjs`

#### Manual Verification:

- Reading `loops.test.mjs` top to bottom, each test name states one rule of today's RETHINK/REVISE behaviour and none depends on Phase 3 or 4 code
- `git log --oneline` shows the commit of the characterization tests before the commit of the `verdict` change, so the tests were green on unmodified logic

**Implementation Note**: After this phase and its automated checks pass, pause for manual confirmation before Phase 2.

---

## Phase 2: Policy data and prompt wiring

### Overview

Add the data the router will read (steps, the `preplan` block, templates), the loader that turns `@prompts/<file>.md` references into prompt text, the frame decision guide, and the artifact list for the plan prompt. No gate logic yet: nothing returns a new step, so run behaviour is unchanged except that a plan prompt lists artifacts that exist.

### Changes Required:

#### 1. Steps, `preplan` block and templates

**File**: `skills/10x-pipeline/policy.json`

**Intent**: Register the three new step names with their tiers, add the gate configuration as data, and add one template per variant. New top-level key `preplan` goes after `archive` and before `prompts`; new `steps` entries go after `archive`.

**Contract**: `steps`: `research` (skill `10x-research`, base 3, min 2, max 5, interactive), `domain-brief` (skill `null`, base 3, min 3, max 5, interactive), `frame` (skill `10x-frame`, base 4, min 4, max 4, interactive). `preplan`: `order` (`research`, `domain-brief`, `frame`); `gates.<step>` with `minRigor` (all `thorough`), optional `when` (list of predicate names, any must hit; empty or absent means always), `skipIf` (list, any hit skips), `template` (default) and `variants` (`[{ when, template }]`, first hit wins). Values: `research` has `skipIf: ["researchExists"]`, template `research`, variant `repoMapExists` to `research-with-map`; `domain-brief` has `when: ["aggregateGap", "dependencyLeak"]`, `skipIf: ["briefExists"]`, variants `aggregateGap` to `domain-aggregate` and `dependencyLeak` to `domain-acl`, no default; `frame` has `when: ["framingDoubt"]`, `skipIf: ["frameExists"]`, template `frame`. `artifacts` maps template to file name in the change folder (`research`, `research-with-map`, `research-revise` to `research.md`; `domain-aggregate` to `refactor-invariant-aggregate.md`; `domain-acl` to `refactor-anti-corruption-layer.md`; `frame`, `frame-rethink` to `frame.md`). `predicates`: `repoMapExists` (`file`, expected `frontmatter.artifact`), `aggregateGap` (`files`: `context/domain/domain-distillation.md` and `context/domain/01-domain-distillation.md`; `statuses`; `minWordLength` 4; `stopwords`), `dependencyLeak` and `framingDoubt` (`goalWords`). `loops`: `rethinkToFrame` 1, `reviseResearchAfter` 1, `reviseResearchMax` 1 (read in Phase 4). `prompts`: new `research` (`Run /10x-research {id} {goal}`, write `context/changes/{id}/research.md`), `research-with-map` (`@prompts/research-with-map.md`), `research-revise` (run `/10x-research {id}` as a follow-up that closes the gaps named in `context/changes/{id}/reviews/plan-review.md`, verdict `{verdict}`, appends to `research.md` and updates `last_updated`; rule-form lines: do not rewrite earlier findings, no new question for the user), `domain-aggregate` (`@prompts/invariant-aggregate-refactor.md`), `domain-acl` (`@prompts/anti-corruption-layer.md`), `frame`, `frame-rethink` (both in step 3); `plan` and `plan-revise` gain `{artifacts}` (`Run /10x-plan {id} {goal}{artifacts}` and `Run /10x-plan {id}{artifacts}`).

#### 2. Prompt loader and artifact list

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: A prompt value is a string, or an array of strings joined with newlines. A part that matches `@prompts/<name>.md` is replaced by the trimmed content of that file under the skill directory. This lets `frame` and `frame-rethink` share one guide file and lets the existing prompt files be used unedited. A separate helper builds the `{artifacts}` text.

**Contract**: New functions below `render`: `promptText(policy, template)` returns the resolved text and throws an `Error` naming the template when the key is missing or a reference does not resolve (the dispatch turns it into a JSON halt). The reference pattern is `^@prompts/[A-Za-z0-9._-]+\.md$`, so no path leaves the `prompts/` folder. `artifactsLine(p, policy)` returns `""` when none of the files in `preplan.artifacts` exists in the change folder, else `"\nUpstream artifacts (read each fully before planning): <path>, <path>"` with project-relative paths in the order of first appearance in the map. `next()` uses `promptText` instead of `policy.prompts[template]` and passes `artifacts` as a render variable. The `archive` prompt path is untouched.

#### 3. Frame decision guide

**File**: `skills/10x-pipeline/prompts/frame-unattended.md` (new)

**Intent**: One rule per ask point of `/10x-frame`, in the ADR-004 form, so the subagent answers from evidence instead of guessing, and stops with `needsHuman` only when no evidence-backed answer exists.

**Contract**: Rules, each one line with one bold keyword: Step 1 echo and confirm is treated as confirmed. Step 1.5 is answered from `change.md` notes, the goal and `research.md`; when none of them answers, choose the skill's own "I'm not sure / haven't separated them yet" option. Step 4 is skipped when Step 3 evidence is conclusive (the skill allows it), else answered from Step 3 evidence, else "I'm not sure / haven't checked" with the brief's Confidence set to LOW. Step 7 chooses "Hand off to /10x-plan" for HIGH or MEDIUM and "Stop here" for LOW. The clipboard command is never run. The brief is written to `context/changes/{id}/frame.md` with the `## Reframed (or Confirmed) Problem Statement` heading intact and exactly one Confidence label stated. A LOW brief lists its verification step and the run still ends `done`. When the goal and `change.md` give no observation or proposed cause to frame, report `blocked` with `signals.needsHuman` naming what is missing. Every assumption cites its evidence. `prompts.frame` is `["Run /10x-frame {id} {goal}\nWrite the brief to context/changes/{id}/frame.md.", "@prompts/frame-unattended.md"]`. `prompts.frame-rethink` has a first part that says plan review `context/changes/{id}/reviews/plan-review.md` returned `{verdict}`, to treat its findings as the observation to test, and to update `frame.md` in place, then the same file reference.

#### 4. Prompt documentation

**File**: `skills/10x-pipeline/prompts/README.md`

**Intent**: The intro says the files are for "optional pre-plan steps"; state which are wired and which are not.

**Contract**: The table gains a "Wired as" column (`research-with-map` template, `domain-aggregate`, `domain-acl`, `frame` guide); the three unwired files are listed under a "Not wired" heading with the reason (they work on an existing `research.md`; the ast-grep ones stop as `blocked` when `ast-grep` is missing). `frame-unattended.md` is added.

#### 5. Tests

**File**: `skills/10x-pipeline/test/rules.test.mjs`, `skills/10x-pipeline/test/preplan.test.mjs` (new)

**Intent**: The form test must accept array prompts and file references. New tests cover the loader and the artifact list.

**Contract**: In `rules.test.mjs` the policy prompt test flattens arrays before splitting lines. In `preplan.test.mjs`: every `@prompts/` reference in `policy.prompts` resolves to an existing file; every file in `prompts/` is referenced by a policy prompt or listed in `prompts/README.md` under "Not wired" (name: `every prompt file is wired or documented as not wired`); the plan prompt of a project without artifacts equals today's text exactly; with `research.md` and `frame.md` present it lists both paths; a missing or malformed reference yields a JSON halt `Router error:` and exit 1; the `frame` rendered prompt contains the four ask points (`Step 1.5`, `Step 4`, `Step 7`) and the clipboard prohibition (name: `frame guide covers each ask point`).

### Success Criteria:

#### Automated Verification:

- Form test accepts the new prompts and the guide file: `node --test skills/10x-pipeline/test/rules.test.mjs`
- Loader and artifact tests pass: `node --test skills/10x-pipeline/test/preplan.test.mjs`
- Every prompt file is wired or documented: `node --test --test-name-pattern="wired or documented" skills/10x-pipeline/test/preplan.test.mjs`
- The frame guide covers each ask point: `node --test --test-name-pattern="frame guide" skills/10x-pipeline/test/preplan.test.mjs`
- `policy.json` is valid and carries the new keys after `archive`: `node -e 'const p=require("./skills/10x-pipeline/policy.json");const k=Object.keys(p);if(k.indexOf("preplan")!==k.indexOf("archive")+1||!p.steps.frame||p.steps.frame.baseTier!==4||p.steps.frame.minTier!==4||p.steps.frame.maxTier!==4)process.exit(1)'`
- Whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs`

#### Manual Verification:

- `prompts/frame-unattended.md` reads as one rule per ask point and a human can map each rule to a step of `~/.claude/skills/10x-frame/SKILL.md`
- In a scratch project with `research.md` and `frame.md`, `init demo --goal "x"` prints a plan prompt whose second line lists both files

**Implementation Note**: After this phase and its automated checks pass, pause for manual confirmation before Phase 3.

---

## Phase 3: Pre-plan gates, verification by artifact, skip-cap fix

### Overview

The router now runs the pre-plan steps. Predicates, the pre-plan branch of `decide()` and the artifact checks land together, because a step without its check would pass unverified. The skip-loop cap is fixed in the same phase because three gated-out steps are the first case that needs it.

### Changes Required:

#### 1. Predicates

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: Pure, read-only functions, keyed by the names the policy uses. Unknown name: no hit. Malformed config: no hit, never a throw (the `goalClass` rule). Each returns `{ hit, why }` so a skip reason can name its cause.

**Contract**: A section `// ---- pre-plan steps ----` below `decide()` holds a `PREDICATES` map. `researchExists`, `frameExists`, `briefExists`: the file named by `preplan.artifacts` (briefs: either brief file) exists in the change folder. `repoMapExists`: the configured file exists and `frontmatterField(file, "artifact")` equals the configured value. `framingDoubt`: a configured phrase is a word-start prefix of the lowercased goal (phrases may contain spaces), or an executed `research` or `domain-brief` entry of this run carries `signals.rigor`. `dependencyLeak`: same phrase match against its own list. `aggregateGap`: in the first existing `files` entry, take the section `## Invariants and policies`, read every table whose header row has `status` and `invariant` columns, and hit when a row's normalised status (lowercase letters only) is in `statuses` and the row's candidate, invariant and gap cells share a word of at least `minWordLength` letters, not in `stopwords`, with the goal. No distillation file, no section or no matching row is no hit.

#### 2. Pre-plan branch

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: In the "no plan yet" branch of `decide()`, ask `preplanNext()` first; when it returns nothing, return step `plan` as today.

**Contract**: `preplanNext(p, fullLog, policy, meta, ctx)` returns `null`, `{ skip: { step, reason } }` or `{ step, template, bump: 0, reason }`. It returns `null` when any executed `plan` entry exists (Decision 8). For each step in `preplan.order`, in order: a gate that is not an object is ignored. An executed entry whose template belongs to the gate (default plus variants) with `ok` means handled. Entries but none `ok` means retry: return the same step and the template of the last entry. A skip entry for the step means handled. Otherwise: a level below `minRigor`, or an unknown level name, means the gate is closed: continue silently. A `skipIf` hit returns a skip `rigor <level>: <step> skipped (<predicate>: <why>)`. A `when` list with no hit returns a skip naming the missed signals. Otherwise return the step with the template of the first variant that hits, else the gate default; with neither, return a skip `no template matched`. `reason` names the step, the level and the hitting predicate. The step is the gate key (`research`, `domain-brief`, `frame`), so `tierFor`, the failure streak and the report need no change.

#### 3. Verification by artifact

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: A `done` pre-plan step counts only when its file changed after the step started and has the shape the next step relies on.

**Contract**: `attachResult` gains three cases. The file is `preplan.artifacts[last.template ?? last.step]` in the change folder; a missing mapping fails the step. `research`: `mtime > startedAt` and `frontmatterField(file, "status")` is not null. `frame`: `mtime > startedAt` and the text has a line starting `## Reframed`; the Confidence label is not read. `domain-brief`: `mtime > startedAt` and `frontmatterField(file, "type") === "refactor-plan"`; the file comes from the entry's template, so the two templates verify against different files.

#### 4. Skip-loop cap

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: Replace the magic "three asks per call" with the real invariant: one skip per step per call. A second skip for a step already skipped in this call is a router bug and halts; any number of different steps may skip.

**Contract**: In `next()` track the step names skipped in the current call. When `decide()` returns a skip for a name already tracked, end the run with `Router error: skip loop` as today; otherwise log the skip and ask again. The comment above the loop is updated. Termination holds because step names are finite. The halt is a defensive guard: no policy data can make `decide()` repeat a skip, because a logged skip marks the step handled, so it has no test of its own; `three skips in one call` covers the loop that must not halt.

#### 5. Tests

**File**: `skills/10x-pipeline/test/preplan.test.mjs`

**Intent**: Drive the real router through the CLI. Artifact files get a fresh mtime with `fs.utimesSync` so ordering with `startedAt` never depends on clock resolution.

**Contract**: Cases (each a test with the quoted name fragment): `default policy keeps the first step at lean and standard` (also no skip entry written); `thorough opens the pre-plan gates` (`init --rigor thorough` returns step `research`); `research skipped when research.md exists` (skip entry with reason, next gate evaluated); `repo map selects research-with-map` (frontmatter `artifact: repo-map`; a file without it selects `research`); `domain brief by aggregateGap` (distillation fixture with `declared` row sharing a word with the goal; a row `enforced`, or no shared word, does not hit; the second file path works); `domain brief by dependencyLeak`; `aggregateGap wins when both hit`; `domain brief skipped with no signal`; `frame by goal words`, `frame by signals.rigor of an earlier step`, `frame skipped without doubt`; `three skips in one call` (all gates open, none runs: three skip entries with `afterN` 0, then step `plan`; report lists three skipped rows) — this fails on the old cap; `failed research is retried at the next tier and halts after three failures`; `frame stays at opus/high on retry`; `frame blocked with needsHuman halts and writes the report`; `needsHuman wins over a frame.md that says Confidence HIGH`; `frame done with Confidence LOW does not raise rigor and the plan step follows`; `verification by artifact` for research (missing status fails, present passes, stale mtime fails), frame (no `## Reframed` fails) and both domain templates (wrong file or `type` fails); `plan runs after the pre-plan steps with the artifacts listed`; `a plan attempt closes the pre-plan phase` (resume with a higher rigor after a failed plan does not run research); `malformed preplan config never throws` (unknown predicate, unknown level, `gates` not an object: the run goes to `plan`).

### Success Criteria:

#### Automated Verification:

- Pre-plan tests pass: `node --test skills/10x-pipeline/test/preplan.test.mjs`
- Three skips in one call work: `node --test --test-name-pattern="three skips in one call" skills/10x-pipeline/test/preplan.test.mjs`
- Existing routing, churn and archive tests keep their first step: `node --test skills/10x-pipeline/test/route.test.mjs skills/10x-pipeline/test/churn.test.mjs skills/10x-pipeline/test/archive.test.mjs`
- Whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs`
- The router still adds no dependency and no new git write: `! (grep -nE '^import .* from "' skills/10x-pipeline/scripts/route.mjs | grep -v 'from "node:') && ! grep -nE "[\"']push[\"']|--no-verify" skills/10x-pipeline/scripts/route.mjs`
- Node 18 ban list is respected in new code: `! grep -nE "toSorted|groupBy|import\.meta\.dirname|mock\.timers|partialDeepStrictEqual" skills/10x-pipeline/scripts/route.mjs skills/10x-pipeline/test/preplan.test.mjs skills/10x-pipeline/test/loops.test.mjs`

#### Manual Verification:

- In a scratch project with `change.md`, `init demo --goal "fix the login bug" --rigor thorough` returns step `research`; after a hand-written `last-result.json` and a fresh `research.md`, `next demo` returns step `frame`, and the `status` output lists any skipped gate with its reason
- The same scratch project at `--rigor standard` returns step `plan` first and `status` shows no skip entries

**Implementation Note**: After this phase and its automated checks pass, pause for manual confirmation before Phase 4.

---

## Phase 4: Backward loops and the budget proof

### Overview

RETHINK runs frame once, then re-plans; a second RETHINK halts. A second REVISE re-plan is preceded by research. Both loops are counted by template names so `maxPlanRevisions` and `maxFixLoops` keep their meaning. Then a test proves the longest legal path fits the budget.

### Changes Required:

#### 1. Re-plan branch

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: Move the body of the `needsReplan && plan.autoDone === 0` branch into `replanNext()` in the pre-plan section, and extend it. The condition and the `autoDone === 0` guard stay in `decide()`, so a plan with code is never re-planned by this branch.

**Contract**: `replanNext(log, pr, policy)` takes executed entries. `revisions` = entries with template `plan-revise` (as today). `okFrame` = entries with template `frame-rethink` and `ok`. In this order: (a) verdict RETHINK, `loops.rethinkToFrame` a positive integer, `okFrame` count at the cap, and a `plan-revise` entry after the last ok `frame-rethink`: halt `Plan review said RETHINK again after frame and re-plan. Needs a human.` (b) `revisions >= limits.maxPlanRevisions`: halt with today's text. (c) RETHINK and `okFrame` below the cap: step `frame`, template `frame-rethink`, `verdict` set, no bump. A failed `frame-rethink` has no `ok`, so it is retried here; `trailingFailures` on step `frame` halts after three. (d) REVISE, `loops.reviseResearchAfter` a positive integer, the number of ok `plan-revise` entries with `verdict === "REVISE"` at or above it, and ok `research-revise` entries below `loops.reviseResearchMax`: step `research`, template `research-revise`. (e) otherwise today's `plan-revise` step. Non-integer or missing loop values disable that loop and give today's behaviour.

#### 2. Tests

**File**: `skills/10x-pipeline/test/loops.test.mjs`

**Intent**: The new loop rules, plus the budget proof. The walker answers each `run` action with the files the real skill would leave (plan with `## Progress`, review with verdict and findings line, ticked rows, `frame.md`, `research.md`) and a `last-result.json`, with fresh mtimes.

**Contract**: Cases: `RETHINK runs frame-rethink once, then plan-revise` (entry template, `verdict` stored, no revision consumed by the frame step, plan review not re-run between frame and re-plan); `second RETHINK after frame and re-plan halts` (reason names frame and re-plan); `RETHINK with the loop disabled behaves as before` (override `rethinkToFrame: 0`); `failed frame-rethink is retried and halts after three`; `frame-rethink needsHuman halts`; `second REVISE adds research-revise before the second plan-revise`; `first REVISE re-plans without research`; `a RETHINK re-plan does not count as the first REVISE`; `third REVISE round halts at maxPlanRevisions`; `REVISE loop disabled by override`; `research-revise verification` (stale mtime fails the step). Budget: `longest legal path at standard fits` walks plan, review RETHINK, frame-rethink, plan-revise, review REVISE with a critical, plan-revise, review SOUND, implement, impl review NEEDS ATTENTION, fix, impl review REJECTED, fix, impl review APPROVED: 13 executed steps, ends `done`, and asserts 13 is below `maxTotalSteps + budgetDelta.standard`; `longest legal path at thorough fits` walks the same path behind research, domain brief and frame (16 steps, below 18) and ends `done`; `research-revise path at standard fits` walks REVISE, REVISE, research-revise (13 steps); `lean runs no pre-plan step` asserts every default gate's `minRigor` index is above `lean`. A legal path means failure-free: every step reports `done` and is verified (failures spend budget by design).

### Success Criteria:

#### Automated Verification:

- Loop tests pass: `node --test skills/10x-pipeline/test/loops.test.mjs`
- The longest legal paths fit: `node --test --test-name-pattern="longest legal path|research-revise path" skills/10x-pipeline/test/loops.test.mjs`
- A second RETHINK halts: `node --test --test-name-pattern="second RETHINK" skills/10x-pipeline/test/loops.test.mjs`
- Characterization tests of Phase 1 still pass unchanged: `node --test --test-name-pattern="existing loop" skills/10x-pipeline/test/loops.test.mjs`
- Whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs`
- The budget deltas did not move: `node -e 'const p=require("./skills/10x-pipeline/policy.json");const d=p.rigor.budgetDelta;if(d.lean!==-4||d.standard!==0||d.thorough!==4||p.limits.maxTotalSteps!==14)process.exit(1)'`

#### Manual Verification:

- Read one walked path in the test output (`status` of the final scratch run) and confirm each step name, template and model/effort is what Decision 1 to 3 describe, with `frame` and `frame-rethink` at opus/high

**Implementation Note**: After this phase and its automated checks pass, pause for manual confirmation before Phase 5.

---

## Phase 5: Documentation, ADR-003 and unattended checks

### Overview

Describe the behaviour where the next maintainer and the orchestrator look for it, record the decisions in ADR-003, and run the checks that need a real `/10x-frame` and a real pipeline.

### Changes Required:

#### 1. `SKILL.md` and `README.md`

**File**: `skills/10x-pipeline/SKILL.md`, `README.md`

**Intent**: AGENTS.md requires the "How the tier moves" list and the README routing bullets to follow `decide`. Add; do not rewrite existing lines.

**Contract**: `SKILL.md` "How the tier moves" gains bullets after the archive bullet: the pre-plan steps and their default gate (thorough, plus the signal for frame and domain brief), `frame` pinned, the verification by artifact, the loops (RETHINK to one frame round then re-plan, a second RETHINK halts; a second REVISE re-plan adds research), and a sentence that the `description` and Start text stay valid because the orchestrator treats the new steps like any `run` action. `README.md` "How routing works" gains bullets at the end of that list (pre-plan steps and gates, loops, the budget note for projects that lower a gate, the requirement of the `10x-research` and `10x-frame` skills only when those gates open), and a new subsection "Pre-plan steps" placed before the "Override any policy key" paragraph with the predicate table and the policy keys. Nothing is edited inside "Usage report".

#### 2. `AGENTS.md`

**File**: `AGENTS.md`

**Intent**: Point agents to the new test files and the prompts folder.

**Contract**: Two new bullets in "Project Structure": `skills/10x-pipeline/prompts/` (rule-form prompt files referenced from `policy.json` as `@prompts/<file>.md`) and the new test files `preplan.test.mjs` and `loops.test.mjs`. No existing bullet is edited.

#### 3. ADR-003

**File**: `docs/ADR/ADR-003-rigor-gated-routing.md`

**Intent**: Record the decisions of this change; the file already owns the table of parts.

**Contract**: The table row `pre-plan-steps` becomes `implemented`. A new section "Pre-plan steps and loops" states: the gate form and its default (thorough), silent closing versus logged skips, the predicates and their uncalibrated word lists, verification by artifact, frame authority (`needsHuman` wins; the Confidence label is never read), the loops and their counters, the budget arithmetic (13 of 14, 16 of 18; lean unchanged and not covered), the skip rule (one skip per step per call), and the assumptions of Decisions 1 to 12 that carry a cost. Rule lines are in the ADR-004 form, checked by `rules.test.mjs`.

### Success Criteria:

#### Automated Verification:

- ADR rule lines follow the form: `node --test skills/10x-pipeline/test/rules.test.mjs`
- Whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs`
- Docs name the new behaviour: `grep -q "frame-rethink" docs/ADR/ADR-003-rigor-gated-routing.md && grep -q "Pre-plan steps" README.md && grep -q "pre-plan" skills/10x-pipeline/SKILL.md && grep -q "preplan.test.mjs" AGENTS.md`
- ADR-003 marks the change implemented: `grep -E "pre-plan-steps.*implemented" docs/ADR/ADR-003-rigor-gated-routing.md`
- Router output is valid JSON for `init` and `status` in a scratch change folder (AGENTS.md check): `d=$(mktemp -d); mkdir -p "$d/context/changes/demo"; node -e 'require("fs").writeFileSync(process.argv[1],"---\nchange_id: demo\nstatus: planned\n---\n")' "$d/context/changes/demo/change.md"; R=$PWD/skills/10x-pipeline/scripts/route.mjs; (cd "$d" && node "$R" init demo --goal "fix typo" --rigor thorough | node -e 'JSON.parse(require("fs").readFileSync(0,"utf8"))' && node "$R" status demo | node -e 'JSON.parse(require("fs").readFileSync(0,"utf8"))')`

#### Manual Verification:

- Unattended `/10x-frame` with a bug-shaped goal: the subagent never calls `AskUserQuestion` or waits for input, never runs `pbcopy`, `frame.md` has a `## Reframed (or Confirmed) Problem Statement` and exactly one Confidence label, and the RESULT line carries `assumptions` that cite evidence
- Unattended `/10x-frame` with an empty goal and a `change.md` without notes ends `blocked` with `signals.needsHuman`, and the router halts with that reason and writes `report.md`
- A real `--rigor thorough` run with a repo map and a distillation fixture goes research-with-map, domain brief, frame, plan, and the plan prompt lists the artifacts
- A `RETHINK` verdict written by hand into `reviews/plan-review.md` of a scratch run makes the next step `frame` at opus/high, and a second `RETHINK` after the re-plan halts
- `README.md` reads correctly for a user who never uses `--rigor thorough`: nothing in the new text suggests a standard run changed

---

## Testing Strategy

### Unit Tests:

- Predicates through the CLI (no module exports exist): word-start phrase matching, table parsing of the distillation file, repo map frontmatter, malformed config falls back to no hit.
- `promptText` and `artifactsLine` through rendered prompts.
- Verification cases for each step and template.

### Integration Tests:

- Full walks with a scripted subagent: the gate matrix, both loops, the longest legal paths at `standard` and `thorough`.
- Failure paths: failed research, failed frame-rethink, `needsHuman`, missing artifact, stale mtime.
- Regression: the existing suite unchanged, run as a whole after each phase.

### Manual Testing Steps:

1. Unattended `/10x-frame` run with a clear goal and with an empty goal (Phase 5 rows).
2. A `thorough` pipeline run end to end in a scratch repo.
3. Hand-written RETHINK and REVISE reviews to watch the loops.

## Performance Considerations

None for the router: the pre-plan branch reads at most five small files per `next`. The cost that matters is model spend: a `thorough` run adds up to three steps (frame at opus/high) before the plan. Nothing runs them at `lean` or `standard` by default.

## Migration Notes

A run in flight when the router is upgraded has a `plan` entry already or, at `standard`, a closed gate, so it never starts a pre-plan step. Old logs have no `verdict` on entries: Phase 4's REVISE count reads them as no earlier REVISE, so an old run never gets a `research-revise`. A project policy override that sets `rigor.budgetDelta` is untouched.

## References

- Related research: `context/changes/pre-plan-steps/research.md`
- Roadmap: `context/foundation/roadmap.md` S-07; PRD FR-001, FR-003, FR-007
- Architecture: `docs/ADR/ADR-002-change-lifecycle-ideation-to-archive.md` (diagrams 5 and 6), `docs/ADR/ADR-003-rigor-gated-routing.md`, `docs/ADR/ADR-004-prompt-rules-as-scenarios.md`
- Router symbols: `decide`, `attachResult`, `next`, `tierFor`, `render`, `frontmatterField`, `trailingFailures` in `skills/10x-pipeline/scripts/route.mjs`
- Prompt files: `skills/10x-pipeline/prompts/`
- Prior plan used as pattern: `context/archive/2026-10-30-archive-adapter/plan.md`
- Toolkit interfaces: `~/.claude/skills/10x-frame/SKILL.md` (ask points, `## Reframed`, Confidence), `~/.claude/skills/10x-plan/SKILL.md` Step 1.0, `~/.claude/skills/10x-domain-distillation/references/report.md` (invariants table), `~/.claude/skills/10x-repo-map/references/report.md` (`artifact: repo-map`)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Lock the current loop; store the verdict

#### Automated

- [ ] 1.1 Characterization tests pass: `node --test skills/10x-pipeline/test/loops.test.mjs`
- [ ] 1.2 Whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs`
- [ ] 1.3 The verdict is stored on the entry: `node --test --test-name-pattern="verdict on the entry" skills/10x-pipeline/test/loops.test.mjs`

#### Manual

- [ ] 1.4 Reading `loops.test.mjs` top to bottom, each test name states one rule of today's RETHINK/REVISE behaviour and none depends on Phase 3 or 4 code
- [ ] 1.5 `git log --oneline` shows the commit of the characterization tests before the commit of the `verdict` change, so the tests were green on unmodified logic

### Phase 2: Policy data and prompt wiring

#### Automated

- [ ] 2.1 Form test accepts the new prompts and the guide file: `node --test skills/10x-pipeline/test/rules.test.mjs`
- [ ] 2.2 Loader and artifact tests pass: `node --test skills/10x-pipeline/test/preplan.test.mjs`
- [ ] 2.3 Every prompt file is wired or documented: `node --test --test-name-pattern="wired or documented" skills/10x-pipeline/test/preplan.test.mjs`
- [ ] 2.4 The frame guide covers each ask point: `node --test --test-name-pattern="frame guide" skills/10x-pipeline/test/preplan.test.mjs`
- [ ] 2.5 `policy.json` is valid and carries the new keys after `archive`: `node -e 'const p=require("./skills/10x-pipeline/policy.json");const k=Object.keys(p);if(k.indexOf("preplan")!==k.indexOf("archive")+1||!p.steps.frame||p.steps.frame.baseTier!==4||p.steps.frame.minTier!==4||p.steps.frame.maxTier!==4)process.exit(1)'`
- [ ] 2.6 Whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs`

#### Manual

- [ ] 2.7 `prompts/frame-unattended.md` reads as one rule per ask point and a human can map each rule to a step of `~/.claude/skills/10x-frame/SKILL.md`
- [ ] 2.8 In a scratch project with `research.md` and `frame.md`, `init demo --goal "x"` prints a plan prompt whose second line lists both files

### Phase 3: Pre-plan gates, verification by artifact, skip-cap fix

#### Automated

- [ ] 3.1 Pre-plan tests pass: `node --test skills/10x-pipeline/test/preplan.test.mjs`
- [ ] 3.2 Three skips in one call work: `node --test --test-name-pattern="three skips in one call" skills/10x-pipeline/test/preplan.test.mjs`
- [ ] 3.3 Existing routing, churn and archive tests keep their first step: `node --test skills/10x-pipeline/test/route.test.mjs skills/10x-pipeline/test/churn.test.mjs skills/10x-pipeline/test/archive.test.mjs`
- [ ] 3.4 Whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs`
- [ ] 3.5 The router still adds no dependency and no new git write: `! (grep -nE '^import .* from "' skills/10x-pipeline/scripts/route.mjs | grep -v 'from "node:') && ! grep -nE "[\"']push[\"']|--no-verify" skills/10x-pipeline/scripts/route.mjs`
- [ ] 3.6 Node 18 ban list is respected in new code: `! grep -nE "toSorted|groupBy|import\.meta\.dirname|mock\.timers|partialDeepStrictEqual" skills/10x-pipeline/scripts/route.mjs skills/10x-pipeline/test/preplan.test.mjs skills/10x-pipeline/test/loops.test.mjs`

#### Manual

- [ ] 3.7 In a scratch project with `change.md`, `init demo --goal "fix the login bug" --rigor thorough` returns step `research`; after a hand-written `last-result.json` and a fresh `research.md`, `next demo` returns step `frame`, and the `status` output lists any skipped gate with its reason
- [ ] 3.8 The same scratch project at `--rigor standard` returns step `plan` first and `status` shows no skip entries

### Phase 4: Backward loops and the budget proof

#### Automated

- [ ] 4.1 Loop tests pass: `node --test skills/10x-pipeline/test/loops.test.mjs`
- [ ] 4.2 The longest legal paths fit: `node --test --test-name-pattern="longest legal path|research-revise path" skills/10x-pipeline/test/loops.test.mjs`
- [ ] 4.3 A second RETHINK halts: `node --test --test-name-pattern="second RETHINK" skills/10x-pipeline/test/loops.test.mjs`
- [ ] 4.4 Characterization tests of Phase 1 still pass unchanged: `node --test --test-name-pattern="existing loop" skills/10x-pipeline/test/loops.test.mjs`
- [ ] 4.5 Whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs`
- [ ] 4.6 The budget deltas did not move: `node -e 'const p=require("./skills/10x-pipeline/policy.json");const d=p.rigor.budgetDelta;if(d.lean!==-4||d.standard!==0||d.thorough!==4||p.limits.maxTotalSteps!==14)process.exit(1)'`

#### Manual

- [ ] 4.7 Read one walked path in the test output (`status` of the final scratch run) and confirm each step name, template and model/effort is what Decision 1 to 3 describe, with `frame` and `frame-rethink` at opus/high

### Phase 5: Documentation, ADR-003 and unattended checks

#### Automated

- [ ] 5.1 ADR rule lines follow the form: `node --test skills/10x-pipeline/test/rules.test.mjs`
- [ ] 5.2 Whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs`
- [ ] 5.3 Docs name the new behaviour: `grep -q "frame-rethink" docs/ADR/ADR-003-rigor-gated-routing.md && grep -q "Pre-plan steps" README.md && grep -q "pre-plan" skills/10x-pipeline/SKILL.md && grep -q "preplan.test.mjs" AGENTS.md`
- [ ] 5.4 ADR-003 marks the change implemented: `grep -E "pre-plan-steps.*implemented" docs/ADR/ADR-003-rigor-gated-routing.md`
- [ ] 5.5 Router output is valid JSON for `init` and `status` in a scratch change folder (AGENTS.md check): `d=$(mktemp -d); mkdir -p "$d/context/changes/demo"; node -e 'require("fs").writeFileSync(process.argv[1],"---\nchange_id: demo\nstatus: planned\n---\n")' "$d/context/changes/demo/change.md"; R=$PWD/skills/10x-pipeline/scripts/route.mjs; (cd "$d" && node "$R" init demo --goal "fix typo" --rigor thorough | node -e 'JSON.parse(require("fs").readFileSync(0,"utf8"))' && node "$R" status demo | node -e 'JSON.parse(require("fs").readFileSync(0,"utf8"))')`

#### Manual

- [ ] 5.6 Unattended `/10x-frame` with a bug-shaped goal: the subagent never calls `AskUserQuestion` or waits for input, never runs `pbcopy`, `frame.md` has a `## Reframed (or Confirmed) Problem Statement` and exactly one Confidence label, and the RESULT line carries `assumptions` that cite evidence
- [ ] 5.7 Unattended `/10x-frame` with an empty goal and a `change.md` without notes ends `blocked` with `signals.needsHuman`, and the router halts with that reason and writes `report.md`
- [ ] 5.8 A real `--rigor thorough` run with a repo map and a distillation fixture goes research-with-map, domain brief, frame, plan, and the plan prompt lists the artifacts
- [ ] 5.9 A `RETHINK` verdict written by hand into `reviews/plan-review.md` of a scratch run makes the next step `frame` at opus/high, and a second `RETHINK` after the re-plan halts
- [ ] 5.10 `README.md` reads correctly for a user who never uses `--rigor thorough`: nothing in the new text suggests a standard run changed
