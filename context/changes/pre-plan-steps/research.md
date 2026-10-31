---
date: 2026-10-31T01:15:00+01:00
researcher: Claude (Sonnet 5.5) for Błażej Ksycki
git_commit: 54f172914faa1f9828700f6b379262b803bb7589
branch: pre-plan-steps-research
repository: agent-smith
topic: "Rigor-gated pre-plan steps (research, legacy research, domain brief, frame) and backward loops in the 10x pipeline router"
tags: [research, router, route.mjs, policy.json, prompts, 10x-frame, 10x-research, rigor, decide, loops]
status: complete
last_updated: 2026-10-31
last_updated_by: Claude (Sonnet 5.5)
---

# Research: Rigor-gated pre-plan steps and backward loops

**Date**: 2026-10-31T01:15:00+01:00
**Researcher**: Claude (Sonnet 5.5) for Błażej Ksycki
**Git Commit**: 54f1729 (main at the time of the run)
**Branch**: pre-plan-steps-research
**Repository**: agent-smith

## Research Question

Roadmap S-07 / change `pre-plan-steps` (`context/changes/pre-plan-steps/change.md`, Notes; `context/foundation/roadmap.md:161-172`): what does `/10x-plan` need to know to add step gates (rigor threshold plus named `when`/`skipIf` predicates), wire `skills/10x-pipeline/prompts/`, verify each new step by its artifact, pin `/10x-frame` at opus/high with an unattended decision guide, and add the backward loops (RETHINK to frame once, then re-plan, a second RETHINK halts; REVISE twice adds research, then re-plans)? Also: the two roadmap unknowns (the predicate for "scattered rule / leaking dependency"; `/10x-frame` unattended). The earlier research (`context/archive/2026-10-30-rigor-levels/research.md`, sections 1-2, Follow-ups 1-2) predates the merged code, so each claim is re-checked here.

## Summary

- The router is ready for a new branch in `decide()` but has no pre-plan concept. The only place a step can run before the plan is the "no plan yet" branch (`route.mjs:630-640`). Rigor is resolved before `decide()` (`:1023-1025`) but with no `plan.md` there are no phases and no churn (`risk` is `null`, `:1024`), so at pre-plan time the level comes only from `--rigor`, the goal class, failed steps and `signals.rigor` (`:384-416`). In practice a plain goal is `standard`, a short goal is `lean`, and `thorough` needs `--rigor thorough` or a signal.
- Three router mechanisms the old research did not know about already exist and are reusable: skip entries (`:1045-1063`), `d.template` selecting a prompt different from the step name (`:1085`), and `signals.needsHuman` halting before `decide()` (`:1031-1038`). One mechanism blocks the design as it stands: the skip loop halts with "skip loop" on the third skip in one `next` call (`:1050`). Three gated-out pre-plan steps would hit it.
- `skills/10x-pipeline/prompts/` exists with six rule files plus a README, form-checked by `rules.test.mjs:106-114`, and is read by nothing: `route.mjs` mentions `prompts` only at `:1000` and `:1086-1087`, both on `policy.prompts`. Wiring needs a file reference in `policy.prompts` (for example `"@prompts/research-with-map.md"`) resolved by one small helper.
- Verification by artifact is a four-case `switch` plus a default of `verified = true` (`:309-315`). Research, frame and the domain brief each need a case; the domain brief needs the case keyed on `last.template` because two templates write two different files.
- Loops fit without touching the limits if each loop has its own counter: RETHINK to frame is counted by a `frame-rethink` template, REVISE to research by a `research-revise` template. `maxPlanRevisions` (`policy.json:72`) keeps counting `plan-revise`. The step budget (14, delta -4/0/+4) can be exceeded by a full pre-plan sequence at `standard` (inference below), so the plan has to decide how pre-plan steps count against it.
- Unknown 1 (predicate): "rule not enforced or only declared" has a structured signal, the `status` column of the distillation table. "Rule smeared over many places" and "dependency leaks" have none; the only cheap deterministic signal for the leak is the goal text. Unknown 2 (`/10x-frame` unattended): each of the four ask points has a defined answer inside the skill, so a prompt-level guide can cover all of them; no run evidence exists.

## Detailed Findings

### 1. `decide()` and the step wiring on main today (`skills/10x-pipeline/scripts/route.mjs`)

Branch order in `decide()` (`:618-737`), inspected path:
1. no `change.md` → halt (`:627-629`).
2. no `plan.md` or no `## Progress` → step `plan` with `bump` from the goal class (`:630-640`). This is the only exit before a plan exists.
3. plan-review stale → either a logged skip (lean, risk measured, no hot path; `:648-674`) or step `plan-review`.
4. `needsReplan` (RETHINK, or REVISE with criticals or warnings over `review.reviseToleranceWarnings`) and `plan.autoDone === 0` → `plan-revise` template, or halt when `revisions >= maxPlanRevisions` (`:676-689`). `revisions` is `log.filter(e => e.template === "plan-revise").length` (`:680`). No verdict is stored on log entries (entry fields `:1088-1102`), so "how many RETHINKs so far" is not derivable from the log today.
5. pending Automated rows → `implement` (`:691-699`).
6. stale impl-review → `impl-review` (`:701-714`).
7. REJECTED / NEEDS ATTENTION → `fix` or halt at `maxFixLoops` (`:716-730`; `count("fix")` counts steps named `fix`).
8. else `done` (`:732-736`). The archive action is not in `decide()`: `next()` calls `archiveDone` when `d.done && meta.archive === true` (`:1065`). The old research said archive "must sit at branch 8"; that changed.

`next()` (`:1015-1115`) in order:
- `attachResult` consumes `last-result.json` and verifies (`:1021`, `:296-326`).
- rigor resolved with `risk = null` when `plan.md` is absent (`:1023-1026`).
- `signals.needsHuman` on the last executed entry halts once; the ack lives on the log entry (`:1031-1038`). This runs before the budget check and before `decide()`.
- budget: `limits.maxTotalSteps` plus `rigor.budgetDelta[level]`, at least 1 (`:1040-1043`); counts executed entries only.
- skip loop: `decide()` may return `{skip}`; the entry `{skipped, step, reason, rigor, risk, afterN, at}` is pushed and `decide()` is asked again. Cap: `if (asked >= 3)` halts with `Router error: skip loop` (`:1047-1052`). With the cap at 3, at most two skips are logged and a third skip in one call halts.
- `tierFor` and the failure halt `fails >= maxAttemptsPerStep` (3) (`:1073-1076`).
- prompt: `render(policy.prompts[template], { id, goal, verdict })` plus `policy.prompts.suffix` (`:1085-1087`). `render` replaces `{name}` and unknown names become an empty string (`:807-809`). The template is `d.template ?? d.step` (`:1085`). A log entry stores `step`, `template`, `skill`, `tier`, `model`, `effort`, `reason`, `tierWhy`, `simple`, `rigor`, `startedAt`, `before` (`:1088-1102`).

Step registry and policy (`policy.json`): `steps` has six entries, each with `skill`, `baseTier`, `minTier`, `maxTier` and optional `interactive` (`:11-18`). `tierFor` reads `policy.steps[d.step]` and throws on an unknown step (`:764`). `prompts` holds `suffix`, `plan`, `plan-revise`, `plan-review`, `implement`, `impl-review`, `fix`, `archive` (`:80-89`). The ladder index 4 is `opus`/`high` (`:7`), so a frame entry with `baseTier`, `minTier` and `maxTier` all 4 pins it through data (`tierFor` clamp `:789`). `interactive: true` applies the effort floor last (`:792-797`); with floors `medium` (lean) and `high` (standard/thorough) (`policy.json:56`) a pin at tier 4 is above both floors, so the floor does not move it.

`goalClass` (`:351-363`) returns `short`, `plain` or `hard` from `complexity.firstPlan`; `rigor.fromGoal` maps short→lean, plain→standard, hard→standard (`policy.json:50`).

Historical check of the old research, section 1, each claim separately:
- "No branch returns a skip" (old `:265-357`): contradicted. Skips exist (`:662-670`).
- "`init` writes `{ id, goal }`": contradicted. `init` keeps all stored fields (`:1232-1239`).
- "route.mjs imports no `node:child_process`": contradicted (`:16`).
- "Only four step names verified, default true": supported (`:309-315`).
- "Frame pinning by `baseTier`=`minTier`=`maxTier`=4 through data alone": supported.
- "Third implement attempt needs a failure check inside `decide()`": still true; belongs to `phase-executors`, not this change.
- "Revisions counted by `template === plan-revise`, capped at 2; re-plan only when `autoDone === 0`": supported (`:679-681`).

### 2. Prompts directory

- `skills/10x-pipeline/prompts/` holds `research-with-map.md`, `ast-grep-verification.md`, `refactor-opportunities-research.md`, `ranking-ast-grep-verification.md`, `invariant-aggregate-refactor.md`, `anti-corruption-layer.md` and `README.md` (`prompts/README.md:7-14`).
- Placeholders in use: `{id}` (all but the domain briefs' first line), `{goal}` (`research-with-map.md:1`, `invariant-aggregate-refactor.md:1`, `anti-corruption-layer.md:1`). `{verdict}` appears in none. `render` supports both (`route.mjs:1086`).
- `research-with-map.md` starts with `Run /10x-research {id} {goal}` and writes `context/changes/{id}/research.md` (`:1`, `:14`). It is therefore a variant of the research step, not a second step: running it after a plain `/10x-research` would write the same file twice.
- The domain briefs write `context/changes/{id}/refactor-invariant-aggregate.md` and `refactor-anti-corruption-layer.md` with frontmatter `title`, `created`, `type: refactor-plan` (`invariant-aggregate-refactor.md:26`, `anti-corruption-layer.md:24`).
- `refactor-opportunities-research.md`, `ast-grep-verification.md` and `ranking-ast-grep-verification.md` operate on an existing `research.md` and are not named in the change's scope list. Both ast-grep files stop as `blocked` when `ast-grep` is missing (`ast-grep-verification.md:5`, `ranking-ast-grep-verification.md:5`); wired blindly they would burn the retry budget on a missing tool.
- Form checks: `rules.test.mjs:100-104` checks every value of `policy.prompts` (strict: a prose line may not carry a bold keyword); `:106-114` checks every `prompts/*.md` except README. A file reference string such as `@prompts/x.md` is a prose line without keywords and passes.
- Router reads: `grep` for `prompts` in `route.mjs` finds only `:1000` and `:1086-1087`; nothing reads `SKILL_DIR/prompts`. `SKILL_DIR` is defined (`:19`).

### 3. Verifying a step by its artifact

- Pattern: `attachResult` computes `verified` by `last.step` (`:309-315`); `last.ok = status === "done" && verified` (`:324`). Helpers available: `mtime` (`:58`), `readReview` (`:90`), `frontmatterField` (`:118`, returns the string or `null`, quotes stripped).
- Proposed cases (all against `last.startedAt`):
  - `research`: `mtime(research.md) > startedAt` and `frontmatterField(research.md, "status")` non-null. The research skill writes `status: complete | partial` (`~/.claude/skills/10x-research/references/research-document.md:4-5`, `:18`). A follow-up (loop `research-revise`) updates `last_updated` and appends to the same file (`10x-research/SKILL.md` section 5), so mtime alone is the right check for it.
  - `frame`: `mtime(frame.md) > startedAt` and the file contains a `## Reframed` heading. `/10x-plan` itself recognises a frame brief by `# Frame Brief:` or a `## Reframed` section (`10x-plan/SKILL.md:77`), and the template heading is `## Reframed (or Confirmed) Problem Statement` (`10x-frame/SKILL.md:248`). The `## Confidence` section lists all three labels as bullets and then a `[Pick one…]` line (`:258-265`), so a parser that takes the first label would be wrong. Verification should not depend on the chosen label.
  - `domain-brief`: by `last.template`: the template's own file under `context/changes/{id}/`, `mtime > startedAt` and `frontmatterField(file, "type") === "refactor-plan"` (rule at `invariant-aggregate-refactor.md:26`).
- Not verifiable today: that a `done` step did good work. The router checks that the file changed, as for `plan-review` (`:311`).
- A failed pre-plan step is retried at +1 tier per failure (`:773-774`) and halts after `maxAttemptsPerStep` = 3 (`:1074`). Two side effects: any `ok === false` entry counts toward `rigor.fromFailures` (`:403-405`, one failure raises to `standard`, three to `thorough`) and ends the simple-change discount (`:743`, `:749`). A pinned frame step (min = max = 4) retries at the same tier.

### 4. Step gates in `policy.json`

Facts that shape the gate design:
- Level order and comparison already exist: `rigorLevels(policy)` and `maxLevel` (`:370-381`). "Level at or above X" is `levels.indexOf(level) >= levels.indexOf(X)`.
- At the pre-plan branch the level is known (`ctx.level`), but plan-derived inputs are not: `fromPhases` needs `plan.hasProgress` (`:399`) and risk needs `plan.exists` (`:1024`). So `thorough` before the plan comes only from `--rigor thorough`, `signals.rigor` of an earlier pre-plan step, or three failed steps.
- Skip entries and the `decide` contract `{skip: {step, reason, risk}}` exist (`:662-670`). Report rows and `status` print any step name generically (`buildReport` `:209-212`, `:230-236`; `status` `:1171-1175`), so new step names need no report change.
- House rule for malformed overrides: `goalClass` and `churnConfig` never throw and fall back (`:351`, `:492`). Gate code should do the same: an unknown predicate name counts as "no hit" and an unknown level name fails the gate closed.

Shape proposed (policy keys camelCase, step names kebab-case, predicates implemented in `route.mjs`, referenced by name):

```json
"preplan": {
  "order": ["research", "domain-brief", "frame"],
  "gates": {
    "research":     { "minRigor": "standard", "skipIf": ["researchExists"] },
    "domain-brief": { "minRigor": "standard", "when": ["aggregateGap", "dependencyLeak"] },
    "frame":        { "minRigor": "standard", "when": ["framingDoubt"], "skipIf": ["frameExists"] }
  },
  "variants": { "research": [{ "when": "repoMapExists", "template": "research-with-map" }] },
  "predicates": { "framingDoubt": { "goalWords": ["..."] }, "dependencyLeak": { "goalWords": ["..."] }, "aggregateGap": { "statuses": ["ignored", "contradicted", "declared"] } },
  "loops": { "rethinkToFrame": 1, "reviseToResearchAfter": 1 }
}
```

Semantics (proposal): a step runs when the level is at least `minRigor`, every `skipIf` is false, and `when` is empty or at least one `when` hits. A step is "handled" once an executed entry with `ok` exists, or a skip entry for it exists, or (checked only when it has never run) a `skipIf` artifact predicate hits. A step that ran and failed is retried before any `skipIf` is read, so a partial `frame.md` left by a failed run is not mistaken for a finished one.

Pieces `route.mjs` needs, with the exact touch points:
- new branch in `decide()` inside the no-plan branch before `:631`; `decide` gets the existing `ctx` (`level`).
- skip-loop cap at `:1050`. The cap is a magic 3 (comment `:1045` says "at most three times"). It has to rise or `decide` has to return several skips at once. Inference: with research, domain brief and frame all gated out, the third skip halts the run.
- new render variable for the plan prompt (see below) at `:1086`.
- `verdict` stored on the log entry at `:1088` (needed to count RETHINK versus REVISE revisions).

Predicates (all pure, read-only, `node:fs` only):

| Name | Hit when | Source of the signal |
| --- | --- | --- |
| `repoMapExists` | `context/map/repo-map.md` exists and `frontmatterField(file, "artifact") === "repo-map"` | `10x-repo-map/references/report.md:73` |
| `researchExists` / `frameExists` | the artifact exists before the step ever ran | `change.md` scope: "verify each step by its artifact" |
| `aggregateGap` | `context/domain/domain-distillation.md` (or `01-domain-distillation.md`) has a row in an "Invariants and policies" table whose `status` is one of the configured values, and the goal shares a word of 4 or more letters with that row | `10x-domain-distillation/references/report.md:24-35`, `:158` |
| `dependencyLeak` | goal text hits a configured word list | no structured signal exists (see section 6) |
| `framingDoubt` | goal text hits a configured word list | frame's own trigger words (`10x-frame/SKILL.md:7-9`, `:36`) |

### 5. Backward loops without breaking the limits

Current behaviour (`:676-689`): RETHINK and REVISE both go to `plan-revise` at `rethinkBump` +2 or `reviseBump` +1 (`policy.json:36-37`); halt at 2 revisions; `plan.autoDone === 0` required. No test exercises RETHINK, REVISE or the revision cap: `grep` over `skills/10x-pipeline/test` finds `plan-revise` only at `route.test.mjs:451` (a negative assertion). The existing loop is untested, so the plan must add tests for the current behaviour and for the new one.

Proposed state machine, using templates as counters so `maxPlanRevisions` and `maxFixLoops` keep their meaning:
- RETHINK and no `frame-rethink` entry in the log → step `frame`, template `frame-rethink` (prompt names `reviews/plan-review.md`). No plan revision is consumed.
- RETHINK, a `frame-rethink` entry exists, and no `plan-revise` entry after it → `plan-revise` (the re-plan). `prFresh` stays true after the frame step because only `plan` and `plan-review` entries move the freshness indexes (`:643-647`), so plan review does not re-run between frame and re-plan.
- RETHINK, a `frame-rethink` entry exists, and a `plan-revise` entry after it → halt ("second RETHINK"). This replaces the current behaviour where a second RETHINK is another revision until `maxPlanRevisions`.
- REVISE needing a re-plan, at least one earlier `plan-revise` entry whose verdict was REVISE (needs `verdict` on the entry), and no `research-revise` entry → step `research`, template `research-revise` (prompt: follow up `/10x-research` on the gaps in `reviews/plan-review.md`), then `plan-revise`. The halt test `revisions >= maxPlanRevisions` stays first so the loop cannot add a third revision.
- A `frame-rethink` run that ends `blocked` with `signals.needsHuman` halts through the existing path (`:1031-1038`), before `decide()`.

Budget (inference from `:680`, `:720`, `policy.json:71-74`): on the path plan, plan-review, two `plan-revise` rounds each followed by a plan-review, implement, impl-review, and two `fix` rounds each followed by an impl-review with no implement retries, the executed count is 12, under the standard budget of 14. Adding research, domain brief and frame makes 15 on that path, over the `standard` budget of 14 and under the `thorough` budget of 18. The pre-plan steps and the two loop steps are each bounded by their own counter (one each per run; frame at most twice, research at most twice). Options for the plan to choose between: (a) add the number of executed pre-plan and loop steps to the budget at `:1040`; (b) add a `limits.preplanSteps` constant; (c) leave the budget alone and accept an earlier halt. This is an owner choice, not decided here.

The `needsReplan` branch requires `plan.autoDone === 0` (`:679`). The new loops inherit that: RETHINK or REVISE after code exists is not re-planned by this branch (unchanged).

Plan prompt must name the new artifacts. `/10x-plan` takes upstream documents by path; its fewer-questions behaviour depends on research or frame being passed in (`10x-plan/SKILL.md:56-63`, `:77-78`, `:109`). The current `plan` template is `Run /10x-plan {id} {goal}` (`policy.json:82`) and names neither file. The pre-plan artifacts are written into the change folder but a plain change-id argument is not shown to load them (the skill text only says to invoke "with a change-id or path", `:63`). The plan prompt (and `plan-revise`) needs a rendered list such as `@context/changes/{id}/research.md @context/changes/{id}/frame.md @…/refactor-*.md` for the files that exist; that is the new render variable at `:1086`.

### 6. The two unknowns

**Predicate for "scattered rule / leaking dependency".**
- Rule not enforced or only declared: the distillation table `Invariants and policies` has columns `id | candidate | invariant (quoted) | source | status | guarded at | gap`, status ∈ enforced, declared, ignored, contradicted (`10x-domain-distillation/references/report.md:24-35`, `:158`). Statuses `declared`, `ignored`, `contradicted` map to "enforced in few places or none" (the ADR-002 step 28 wording: "Rule enforced many places or none?", `ADR-002:93`). Observed limits: the distillation skill writes `context/domain/domain-distillation.md` per its description, while the legacy prompt `m4l5-1` writes `context/domain/01-domain-distillation.md` (`~/.claude/prompts/m4l5-1*:56,62`), so the predicate checks both paths. No distillation file exists in this repo (`ls context/domain` fails). "Smeared over many places" is not a status; the `guarded at` cell format is not specified in the references inspected, so it is unknown whether a count can be read from it.
- A project-level signal alone would fire for every change in the project. The relevance link has to be a deterministic goal match (proposal: a shared word of 4 or more letters). That threshold is an assumption and uncalibrated.
- Leaking dependency: inspected `10x-domain-distillation/references/report.md`, `10x-repo-map/references/report.md` and the prompt text of `anti-corruption-layer.md`. None carries a structured leak flag; the distillation Ranking table has a `kind` column whose values the reference does not list (`report.md:171`). The ACL prompt itself discovers leaks from the manifest and imports (`anti-corruption-layer.md:8-10`), so it needs no input artifact. The only cheap deterministic signal left is the goal text, in the style ADR-001 prefers (cheap signals first). Proposed word list, uncalibrated: swap, replace, vendor, SDK, third-party, adapter, wrapper, leak, anti-corruption. A new `signals` key from the research step is possible but changes the contract that the README states as two keys (`README.md` Rigor section; `cleanSignals` `:284-294`), so it is not recommended here.
- One brief per run: assumption. When both predicates hit, `aggregateGap` wins by policy order; the prompts themselves say to prefer the item the goal touches (`prompts/README.md:21`).

**`/10x-frame` unattended with a prompt-level decision guide.**
- Ask points in the skill (re-verified): Step 1 echo and confirm in text (`10x-frame/SKILL.md:73-96`), Step 1.5 AskUserQuestion with 2-3 questions, "always runs", must include an "I'm not sure / haven't separated them yet" option (`:102-106`), Step 4 narrowing questions, skippable "if hypothesis evidence from Step 3 is already conclusive" and must include "I'm not sure / haven't checked" (`:157-171`), Step 7 next-step question with four options including "Stop here" and a `pbcopy` of the plan command (`:296-318`).
- Every ask point therefore has a defined non-guess answer inside the skill. A guide can say: Step 1 treat as confirmed; Step 1.5 answer from `change.md` notes, the goal and `research.md`, else choose the "not sure" option; Step 4 take the skip clause on conclusive evidence, else answer from Step 3 evidence, else "not sure" and Confidence LOW; Step 7 pick "Hand off to /10x-plan" for HIGH or MEDIUM, and for LOW report `blocked` with `signals.needsHuman` naming the verification step the brief lists (`:265`); never run `pbcopy`.
- Precedent in this repo for an answers-as-rules prompt: `prompts.archive` (`policy.json:88`). Nothing shows a run of frame under it; the verdict is "usable by design, unproven by a run".
- Authority: `needsHuman` is read in `next()` before `decide()` (`:1031-1038`), so it already wins over any value in `frame.md`. No code reads `frame.md` Confidence today. Whether LOW with no `needsHuman` should raise rigor is open (see Open Questions).
- The frame skill dispatches 2-5 hypothesis sub-agents (`:139-142`). The step subagent then sits at depth 2, below the depth 3 that `10x-goal-implement` already needs (`README.md` Limits), so no new spawn-depth requirement. This is an inference from those two files, not a run.
- Frame tier: `opus/high` is ladder index 4 (`policy.json:7`); the pin needs `baseTier = minTier = maxTier = 4` and `interactive: true`.

### 7. Touch points for the plan, and overlap with S-05 and S-06

Router (`route.mjs`): `attachResult` switch (`:309-315`); `decide` no-plan branch (`:630-640`) plus the `needsReplan` branch (`:676-689`); `next()` skip cap (`:1050`), budget (`:1040-1041`), render call and entry (`:1086-1102`); a small predicates section and prompt-file loader; `cleanSignals` untouched. `tierFor`, `simpleSignal` and `resolveRigor` need no change (pre-plan steps have `plan.phases = 0`, so `simpleSignal` returns `simple: false` for them, `:747-750`). Possible small addition: a `rigorInputs` entry for frame Confidence LOW (`:384-416`).

Policy (`policy.json`): `steps` (new `research`, `domain-brief`, `frame`), `prompts` (new templates `research`, `research-with-map`, `research-revise`, `domain-aggregate`, `domain-acl`, `frame`, `frame-rethink`, and edits to `plan` and `plan-revise` for the artifact list), a new `preplan` block, possibly `limits`.

Docs: `SKILL.md` "How the tier moves" (`:69-87`) and the loop line about skipped steps (`:36`); `README.md` routing bullets and Rigor section; ADR-003 status table row `pre-plan-steps` (`ADR-003:16-23`) and a short section; `prompts/README.md` if the ast-grep and ranking files stay unwired (state that).

Tests: `route.test.mjs` assumes a first step of `plan` for a goal with no plan at `:223`, `:329`, `:568`, and `archive.test.mjs:155`; any default that opens the research gate at `standard` changes the first step of every plain-goal `init` in the suite (37 `makeProject` uses in `route.test.mjs`, 23 in `churn.test.mjs`, 13 in `archive.test.mjs`; the first-step assertions are the four above). `helpers.mjs` already supports a project policy override (`makeProject({ policy })`, `:20-37`), which is the cheap way to keep those tests on the old path if the shipped default gates them in.

Overlap: S-05 (`pr-comment-report`) and S-06 (`baseline-usage-comparison`) concern the report (`buildReport` `:202-239`, `status` `:1165-1184`, README "Usage report", the `done` and `archive` branches of `SKILL.md:42-51`). This change only adds step names, which the report already prints generically. To keep merges small: add new code as separate functions below `decide` and after `readReview`, and add docs as new bullets or a new "Pre-plan steps" subsection, not edits inside the Usage report section. Both of those changes and this one edit `README.md` and `SKILL.md`; the Routing roadmap stream note says routing changes are meant to go one by one (`roadmap.md:62`).

## Code References

- `skills/10x-pipeline/scripts/route.mjs:309-315` - verification switch, default `verified = true`
- `skills/10x-pipeline/scripts/route.mjs:630-640` - the only branch before a plan exists
- `skills/10x-pipeline/scripts/route.mjs:648-674` - plan-review skip (pattern for gate skips)
- `skills/10x-pipeline/scripts/route.mjs:676-689` - RETHINK/REVISE re-plan and `maxPlanRevisions`
- `skills/10x-pipeline/scripts/route.mjs:1023-1026` - rigor resolved, `risk` null without a plan
- `skills/10x-pipeline/scripts/route.mjs:1031-1038` - `needsHuman` halt before `decide()`
- `skills/10x-pipeline/scripts/route.mjs:1040-1043` - step budget
- `skills/10x-pipeline/scripts/route.mjs:1045-1063` - skip loop, cap 3 at `:1050`
- `skills/10x-pipeline/scripts/route.mjs:1085-1102` - template choice, render, log entry
- `skills/10x-pipeline/scripts/route.mjs:118-126` - `frontmatterField`
- `skills/10x-pipeline/policy.json:11-18` - `steps`; `:48-58` rigor; `:70-74` limits; `:80-89` prompts
- `skills/10x-pipeline/prompts/README.md:7-14` - prompt source map; `prompts/*.md` rules
- `skills/10x-pipeline/test/rules.test.mjs:100-114` - rule-form checks over policy prompts and prompt files
- `~/.claude/skills/10x-frame/SKILL.md:102-106,157-171,258-265,296-318` - ask points and Confidence
- `~/.claude/skills/10x-domain-distillation/references/report.md:24-35,158,171` - invariant status values and tables

## Architecture Insights

- The router decides from disk artifacts and a log of executed entries; new steps fit best as more of the same: a gate function, an artifact check, a template, and a counter expressed as a template name.
- Gates stay data-first: thresholds, word lists and statuses in `policy.json` (overridable per project), predicate logic named and implemented in `route.mjs` (AGENTS.md hard rule: routing in `route.mjs` and `policy.json` only).
- Fail closed on bad config, as `goalClass` does: an unknown predicate or level skips the optional step and the run continues.
- Prompts remain rule text in the ADR-004 form, so the existing `rules.test.mjs` covers every new prompt and prompt file without change.

## Historical Context (from prior changes)

- `context/archive/2026-10-30-rigor-levels/research.md` section 1 - router attachment points; line numbers stale, see Findings section 1 for each claim's current verdict.
- Same file, section 2 - toolkit interfaces. Re-verified and still supported: frame writes `frame.md` with a Confidence section (`10x-frame/SKILL.md:258`), four ask points, `/10x-plan-review` does not name frame on RETHINK (`10x-plan-review/SKILL.md:136-138` area; the word `frame` has no hit in that skill), and the RETHINK→frame edge comes from ADR-002 diagram 6 (`ADR-002:298`). Partly outdated: the old text says the domain prompts live outside the plugin and write `context/domain/0N-*.md`; the copies in `skills/10x-pipeline/prompts/` write into the change folder.
- Follow-up 2 decisions that govern this change: frame authority (`needsHuman` wins over Confidence; supported by `:1031-1038`), RETHINK→frame once then re-plan then halt, REVISE twice→research, prompts copied and rule-checked (done), prompts "not yet wired" (still true: Findings section 2).
- `docs/ADR/ADR-003-rigor-gated-routing.md:16-23` lists this change as `planned`; ADR-002 diagram 5 (`:260-286`) is the intended gate order: research → legacy research → domain refactor → frame.
- `context/archive/2026-10-30-archive-adapter/` - shipped the skip-entry, `endRun` and answers-as-rules prompt patterns this change reuses.

## Related Research

- `context/archive/2026-10-30-rigor-levels/research.md`
- `context/archive/2026-10-30-archive-adapter/research.md`

## Open Questions

1. Default of the research gate: `minRigor: standard` makes every plain-goal run start with a research step (and changes the first step in the existing tests); `thorough` limits it to `--rigor thorough` before the plan exists. Cost versus usefulness is the owner's call; no run data exists to calibrate.
2. Does legacy research replace the plain research step (this research recommends: a template variant of one `research` step, because both write `research.md`), or run as a second step after it (ADR-002 step 27)?
3. Step budget treatment of pre-plan and loop steps (Findings section 5, options a to c).
4. Failure of an optional pre-plan step: retry then halt (existing mechanism, and each failure raises rigor), or one failure then continue to plan with a logged skip? Not decided; the router has no "optional" notion today.
5. Frame Confidence LOW without `needsHuman`: ignore, or raise rigor? Assumed ignore in the base design.
6. Are `refactor-opportunities-research.md`, `ast-grep-verification.md` and `ranking-ast-grep-verification.md` in scope? The change's scope list does not name them; this research leaves them unwired.
7. Word lists (`framingDoubt`, `dependencyLeak`) and the 4-letter goal-match for `aggregateGap` are uncalibrated proposals; calibrating needs run data (S-06).

Assumptions made because no human could answer (each is repo evidence plus a judgement): one domain brief per run; the research gate's `skipIf` uses artifact existence; pre-plan steps are logged as skips with a reason when gated out; no new `signals` key; `ast-grep` prompts unwired; frame step retried at its pinned tier on failure.
