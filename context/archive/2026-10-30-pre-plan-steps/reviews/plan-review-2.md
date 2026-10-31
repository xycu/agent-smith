<!-- PLAN-REVIEW-REPORT -->
# Plan Review (round 2): Rigor-gated Pre-plan Steps and Backward Loops Implementation Plan

- **Plan**: context/changes/pre-plan-steps/plan.md (revision at 817098e, answering round 1)
- **Mode**: Deep (codebase verification done inline against `route.mjs`, `policy.json`, `helpers.mjs`, `rules.test.mjs`, the shipped prompt files, the installed 10x-frame, 10x-plan, 10x-research and 10x-domain-distillation skills and one real distillation report; no sub-agent)
- **Date**: 2026-10-31
- **Verdict**: SOUND
- **Findings**: 0 critical, 3 warnings, 2 observations

Round 1 (`reviews/plan-review.md`) is not rewritten. This file is round 2. The three warnings are targeted text and test additions that fit inside the existing phases; none blocks starting Phase 1.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | WARNING |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

Grounding: 12/12 paths ✓ (`route.mjs`, `policy.json`, `SKILL.md`, `README.md`, `AGENTS.md`, ADR-003, `prompts/*.md` and `prompts/README.md`, `rules.test.mjs`, `helpers.mjs`, `route.test.mjs`; the new test files and `frame-unattended.md` are correctly marked new), 12/12 symbols ✓ (`decide`, `next`, `attachResult`, `tierFor`, `render`, `frontmatterField`, `trailingFailures`, `lastIdx`, `executed`, `resolveRigor`, `rigorInputs`, `readPlan`), brief↔plan ✓. Progress↔Phase consistency ✓: one `## Progress`, phases 1 to 5, rows 1.1-1.5, 2.1-2.11, 3.1-3.10, 4.1-4.9, 5.1-5.8 match the Success Criteria bullets one to one in order and wording; no checkboxes in phase bodies. The Review response, the brief and the Progress block agree on every renumbered row.

## Round 1 fixes: verified in plan.md and by walking `decide()` and `next()`

- F1 (loops gated): landed (Decision 10, `replanNext` `open` test). Walk at `standard`: `open` is false, so branches (a), (c), (d) are skipped and (e) is the old body, with the old `revisions` count (failed entries included) and the old halt text. `lean` is the same. Standard and lean take today's `plan-revise` path while the level stays at or below `standard`. The level does not stay there by itself; see F1 below. The proposed `git diff` check in row 4.4 proves only that the tests did not change and still pass, so it is as wide as the characterization fixtures (all `--rigor standard`, 1 phase), and it cannot see the mid-run rise.
- F2 (failed re-plan after frame): landed. Walk: RETHINK, `frame-rethink` ok, review still fresh (`lastIdx` of `plan` did not move), (a) no (no ok `plan-revise` after the frame), (b) revisions 0, (c) cap reached, (e) `plan-revise` at +2. A failed re-plan leaves `lp` unchanged, so the review stays fresh; the retry takes `+1 for 1 failed attempt(s)` via `trailingFailures(log, "plan")`; the second failure hits (b) at `maxPlanRevisions` and halts with today's text. An ok re-plan then a second RETHINK hits (a). A REVISE-needing-replan first (revisions 1), then RETHINK, gives frame, re-plan (revisions 2), second RETHINK: (a) halts. Two REVISE re-plans then RETHINK: (b) halts before (c), so frame never runs after the revision cap. No loop, no early halt. The `research-revise` path walks the same way: first REVISE re-plan (count 1), second REVISE gives (d), then (e), and a third needing re-plan halts at (b). A failed `research-revise` retries via (d) and `trailingFailures(log, "research")` halts it after three.
- F3 (frame authority): landed as a rule line, with defects. See F2 below.
- F4 (research frontmatter): landed. `research-with-map.md` asks for two body sections and a save path; a frontmatter rule is orthogonal and sits in a separate array part, so the legacy variant does not contradict it. The real `/10x-research` writes top-level `status: complete|partial` on the first lines, and `frontmatterField` accepts any non-null value, so a `partial` run passes. The check can fail only if the subagent ignores a bold **MUST** line; the cost is the documented retry, and row 5.6 observes it. Not a defect.
- F5 (`aggregateGap` format): mostly landed; one hole remains. See F3 below.
- F6 (framing words): landed. Word-start match on `fix typo`, `fixture cleanup`, `fixes for the router` finds none of the nine phrases; guide and Decision 14 end `done` at LOW.
- F7 (budget): arithmetic re-counted. Standard worst path: plan, review, plan-revise, review, plan-revise, review, implement, impl-review, fix, impl-review, fix, impl-review = 12 of 14. Thorough with RETHINK: research, domain-brief, frame, plan, review, frame-rethink, plan-revise, review, plan-revise, review, implement, impl-review, fix, impl-review, fix, impl-review = 16 of 18. Thorough with `research-revise`: 3 + (plan, review, plan-revise, review, research-revise, plan-revise, review, implement, impl-review, fix, impl-review, fix, impl-review = 13) = 16. The budget check `executed >= budget` runs before `decide()`, so 16 plus one failure (17) still reaches `done`, and two failures (18) halt after the work: the plan's claim and its "at most budget - 2" assertion are right.
- F8 (siblings): see "Sibling collisions" below.
- F9 (manual rows): landed; see F4 below for the one remaining weakness.

## Sibling collisions (S-05, S-06)

The S-05 and S-06 plans are not in this repository (`context/changes/` holds only `lesson-candidates`, `phase-executors`, `pre-plan-steps`); only the roadmap rows exist. The checks below are therefore against the described edit regions and the current files, not against the sibling plans.

- README: the plan's edits are a bullet after "The archive step is not moved by any of these rules", a requirements bullet, and a subsection before the paragraph "Override any policy key per project". In the current README that paragraph sits after "Archive (opt-in)" and before "Usage report:" and "Limits:". S-06's block is "between Usage report and Limits" and S-05's group is its own, so the regions are disjoint. ✓
- SKILL.md: new bullets go after "The archive step is not moved by any rule above" in "How the tier moves"; S-05's Start item is in a different section. ✓
- `policy.json`: `preplan` after `archive`, S-06's `compare` between `limits` and `archive`. Key order is not checked by any test (the new row 2.5 is order-free). ✓
- ADR-003: both this change and S-05 append a section at the end of the file; that is an adjacent-hunk conflict resolved by "keep both sides" in Phase 5. Acceptable.
- `route.mjs`: S-06 `compare` reads executed entries and tolerates skips; the added `verdict` key, new step names and risk-less skip rows are additive, and Phase 3 asserts `status` and `report.md` print such a row. ✓ Phases 1 to 4 also edit `route.mjs` and `policy.json` and are not "rebase last"; only Phase 5 is. A sibling that merges during Phases 1 to 4 conflicts there, but the regions are listed by function and the conflict is mechanical. Not a finding.

## Findings

### F1 — "Standard looks as before" holds only while the level stays standard, and the level rises on the commonest RETHINK path

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Decision 10; Desired End State bullet 2; Phase 4 change 1 (`open`) and its tests; Phase 5 README requirement bullet and row 5.8; Migration Notes
- **Detail**: `next()` resolves the level before `decide()` from `rigorInputs`: a plan with 6 or more phases sets `thorough` (`fromPhases`, thresholds 3 and 6), 3 failed steps set `thorough` (`fromFailures`), 3 hot paths set `thorough` (`risk.raise`), and a subagent's `signals.rigor` sets it. All of these can fire after the first plan, and RETHINK is most likely on exactly such a plan: a large one. So a run started without `--rigor thorough` can have `replanNext` open at its first plan review, and its RETHINK goes to `frame` at opus/high even though nobody asked for `thorough`. Decision 10 states this ("a run that rose to thorough mid-run opens the loops"), but four artifacts do not follow from it:
  - Row 5.8 asks the reviewer to confirm the README reads correctly "for a user who never uses `--rigor thorough`", saying such a run "needs no new skill and shows no new step". That is false for a 6-phase plan or three failures.
  - The README requirement ("`10x-research` and `10x-frame` are used at rigor `thorough` only; a missing one fails its step three times and halts") is true but read by a user as "only if I pass `--rigor thorough`"; SKILL.md Start step 2 still checks four skills.
  - No test covers it. `loops-existing.test.mjs` uses 1-phase plans at an explicit `--rigor standard`, so it cannot detect a rise, and `project override opens the loops at standard` tests a different path. The claim "a test proves a standard run is unchanged" is true for runs that stay standard, which the tests never stress.
  - Migration Notes mention the in-flight `thorough` run but not an in-flight standard run whose plan already has 6 phases: its next `next` also starts the frame round.
- **Fix**: Keep Decision 10 and make the documents and tests say what it does. Reword row 5.8 and the README bullet to "reached by `--rigor thorough`, a `signals.rigor`, a plan of 6 or more phases, three failed steps or three hot paths"; add the test `standard run that rises to thorough mid-run opens the loops` (a standard `init`, a 6-phase plan, RETHINK: step `frame`) next to `RETHINK below minRigor behaves as on main`; add the in-flight 6-phase case to Migration Notes.
- **Decision**: ACCEPTED (implementing branch). Decision 10 stays. Behaviour is kept: a run that rises to thorough mid-run (6+ phases, 3 failed steps, 3 hot paths, `signals.rigor`) opens the loops and a RETHINK goes to frame at opus/high. Text fixes: row 5.8 is read as "a user who never reaches thorough" (its title is immutable, see plan.md Review response round 2); the README bullet and the Migration Notes now list the ways to reach thorough and the in-flight 6-phase standard run. Tests added in `loops.test.mjs`: `standard run that rises to thorough mid-run opens the loops` and `1-phase standard plan RETHINK takes today path (below minRigor)`.

### F2 — The `frame-authority` line renders a literal `{id}` and contradicts the rule it sits next to

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: End-State Alignment
- **Location**: Phase 2 change 1 (`frame-authority` text) and change 2 (`authorityLine`, `next()` render call); Decision 12; the `plan-revise` prompt in `policy.json`
- **Detail**: Two defects in the one line that makes the RETHINK loop worth its cost.
  - `authorityLine` returns `prompts["frame-authority"]` verbatim and `next()` passes it as the render variable `authority`. `render()` is a single pass (`tpl.replace(/\{(\w+)\}/g, ...)`), so a value that itself contains `{id}` is inserted unrendered. The shipped line starts "GIVEN context/changes/{id}/frame.md is listed ...". The subagent therefore sees the literal text `{id}`. The test `frame authority rule only with frame.md` checks presence, not substitution, and would pass.
  - The `plan-revise` prompt that carries the line also says "Keep the ## Progress contract, step indices and titles." The new line says to "rework any approach that contradicts" the reframed statement. A RETHINK means the approach is wrong, so phases and rows must change. Two MUST-strength instructions in one prompt conflict, and the subagent picks one; if it picks the old one, the re-plan patches the plan around the findings, the failure F3 of round 1 was written to prevent. The router cannot notice (it checks only `## Progress` and mtime). Row 5.7 would catch it after the fact, in the last phase.
- **Fix**: Render the authority text before inserting it (call `render` on `prompts["frame-authority"]` inside `authorityLine`, or drop the path and say "`frame.md` listed under the upstream artifacts"); extend the line so that it wins over the title rule when the approach changes ("... you **MUST** treat its reframed problem statement as authoritative and rework any phase or row that contradicts it, and the Progress contract applies to the result, not to the old titles"), keeping one bold keyword. Make the Phase 2 test assert no `{` remains in the rendered `plan-revise` prompt. Row 5.7 then checks the result.
- **Decision**: ACCEPTED. `authorityLine` renders `prompts["frame-authority"]` with `{id}` interpolated before insertion (render is single pass), and the line is extended so it wins over the "Keep ... step indices and titles" line of the `plan-revise` prompt; one bold keyword, form checked by `rules.test.mjs`. Test asserts no `{` remains in the rendered `plan-revise` prompt and the authority line names the real id.

### F3 — The `aggregateGap` parser skips the product-wide policies table of a real report, and its matching rule is under-specified

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3 change 1 (`aggregateGap`), change 5 (fixtures); Phase 2 change 1 (`predicates.aggregateGap.stopwords`)
- **Detail**: I ran the specified parser on `context/domain/domain-distillation.md` of life-to-lore (read only). The section bounds, the `invariant*` header cell, bold and qualified status cells (`**enforced** (new worlds)`, `**enforced** (app only)`) and the `###` candidate headings all work. Two gaps:
  - The `### Product-wide policies` table has the header `| id | policy (quoted) | source | status | guarded at | gap |`. No cell starts with `invariant`, so the table is skipped: 14 of the 42 rows, including 4 of the 9 `declared` rows (R-27, R-30, R-37, R-38). The real format has two header words for the same column.
  - The words compared include every word of the `###` heading, so a heading word such as `world` makes all rows under it hit for any goal that contains it (goal "add a tooltip to the world page" hits 5 of 5 declared rows). `stopwords` has no content in the plan, and "also occurs in the goal" does not say whether it is a whole-word or a substring match (`includes` would match `world` inside `underworld`). Tests built from the same author's fixtures will not show either.
- **Fix**: Accept a header cell that starts with `invariant` or `policy`; take the candidate words from the heading only when the row has no `candidate` column and compare whole words; list the default `stopwords` in the plan (or state that the heading words are matched against the goal once per section, not per row); add a fixture row shaped like the `policy (quoted)` table.
- **Decision**: ACCEPTED, with one rule change. Header cell starting with `invariant` or `policy` (and a `status` cell) is a status table. Word match is whole-word on lowercase letter tokens. `stopwords` default is listed in `policy.json`. Reason for the rule change: a `###` heading is not a word source (one generic heading word would hit every row of its section); words come from the `candidate` column, the invariant or policy cell and the `gap` cell. Tests: `policy (quoted)` table row hits, heading word `world` does not hit rows that do not mention it, whole-word (`underworld` does not match `world`). Checked read-only against a real report (life-to-lore): result in the run report.

### F4 — Observation: the unattended `/10x-frame` smoke rows cannot show some of what they ask for from a subagent

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Progress rows 2.9, 2.10, 2.11
- **Detail**: A subagent can run `/10x-frame` (the skill is invoked through the Skill tool and its Step 3 spawns hypothesis agents, which the README's depth note already covers). What the rows ask the observer to confirm is partly invisible: `AskUserQuestion` does not exist in a subagent, so "never calls it" is trivially true, and the Agent result shows only the final reply, not whether `pbcopy` ran or whether the skill printed a plain-text question and ended its turn (the failure the archive prompt guards against with an explicit rule). The rows also name no scratch project, so a run would write `frame.md` into whatever change folder is current. The 10x-frame skill itself has no plain-text fallback (its only "wait" is the empty-input branch at Initial Response, which the guide covers by `blocked`), so the risk is small.
- **Fix**: State in the rows that they run in a scratch project with a throwaway `change.md`, and that the evidence is the final `RESULT:` line plus the files, with the transcript (or `claude -p --output-format stream-json`) for the no-clipboard check. Optionally add to `frame-unattended.md` an explicit rule that a plain-text question is never asked.
- **Decision**: ACCEPTED. The frame smoke rows 2.9 to 2.11 run in a scratch project (`mktemp -d`, a throwaway `change.md`), evidence is the final `RESULT:` line plus the files and the transcript. They need a live nested skill run, so they stay Manual and unticked. `frame-unattended.md` gets one rule that a plain-text question is never asked.

### F5 — Observation: row 5.6 does not show that `/10x-plan` uses the listed artifacts

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: End-State Alignment
- **Location**: Phase 2 change 2 (`artifactsLine`); row 5.6
- **Detail**: `/10x-plan` Step 1.0 recognises a frame brief or research doc by the path or content it is given. The router appends a prose line, "Upstream artifacts (read each fully before planning): ...", to the prompt, not an argument to the skill invocation. A subagent will probably read the files and pass them on, but nothing checks it, and row 5.6 verifies only that the prompt lists the paths. The benefit (fewer questions, frame treated as authoritative) is the stated reason for the change.
- **Fix**: Add to row 5.6 one check: the plan's `Open Risks & Assumptions` or its interview record cites `research.md` or `frame.md`. If it does not, move the paths onto the first line as arguments (`Run /10x-plan {id} {goal} @path ...`).
- **Decision**: ACCEPTED. A test checks that the plan prompt lists exactly the artifacts that exist, as project-relative paths, right after the `Run /10x-plan` line. Row 5.6 (Manual, unticked) additionally checks that the plan cites `research.md` or `frame.md`; if not, move the paths onto the first line as arguments.
