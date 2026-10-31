<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Rigor-gated Pre-plan Steps and Backward Loops Implementation Plan

- **Plan**: context/changes/pre-plan-steps/plan.md
- **Mode**: Deep (codebase verification done inline against route.mjs, policy.json, the tests and the installed 10x-frame, 10x-plan, 10x-research and 10x-domain-distillation skills; no sub-agent)
- **Date**: 2026-10-31
- **Verdict**: REVISE
- **Findings**: 1 critical, 7 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | FAIL |
| Lean Execution | PASS |
| Architectural Fitness | WARNING |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

Grounding: 14/14 paths ✓ (route.mjs, policy.json, SKILL.md, README.md, AGENTS.md, ADR-003, prompts/README.md, prompts/*.md, rules/route/churn/archive tests, helpers.mjs; the three new test and guide files are correctly marked new), 9/9 symbols ✓ (`decide`, `attachResult`, `next`, `tierFor`, `render`, `frontmatterField`, `trailingFailures`, `readPlan`, `lastIdx`), brief↔plan ✗ (the brief says a standard run "looks exactly as before"; see F1). Progress↔Phase consistency ✓ (one `## Progress`, phases 1 to 5 match, 3+2, 6+2, 6+2, 6+1, 5+5 rows, no checkboxes in phase bodies). The plan's AGENTS.md checks 3.5 and 3.6 pass on the current tree (no non-`node:` import, no push or `--no-verify`, no banned Node 19+ API).

Checked and found correct, no finding:

- Skip cap: `next()` halts on the third skip in one call (`asked >= 3`), so two skips are logged at most; research.md exists plus no domain signal plus no framing doubt at `thorough` is the only way to reach three. The "one skip per step per call" rule loses no skip and cannot loop, because the pre-plan branch treats a logged skip as handled and the plan-review skip is frozen by `skipAt > planAt`.
- Budget arithmetic: walked `decide()`. With `maxPlanRevisions` 2 and `maxFixLoops` 2 the longest failure-free path is 13 at `standard` (plan, review, [frame-rethink or research-revise], two re-plans each followed by a review, implement, impl-review, two fix rounds each followed by an impl-review) and 16 at `thorough` (3 pre-plan steps plus the same 13). Both loop steps cannot occur in one run: a RETHINK frame round uses one revision, so the second REVISE that would trigger research-revise cannot happen, and halt (b) precedes (c).
- Silent closing of a gate by rigor changes neither `run.jsonl` nor `report.md`: `buildReport` prints skip rows generically and `executed()` drops skip entries.
- `@prompts/` loader: the pattern `^@prompts/[A-Za-z0-9._-]+\.md$` has no `/`, so no path leaves `prompts/`. Every shipped prompt file holds only `{id}` and `{goal}` placeholders, so `render` blanks nothing, provided the reference is resolved before `render` (the plan implies this order; the implementer must keep it, otherwise a goal text could inject a reference).
- `signals.needsHuman` is read in `next()` before `decide()`, so it wins over anything in `frame.md`; the router never reads the Confidence label, so there is no conflict to resolve.
- The existing tests that start `--rigor thorough` (`route.test.mjs:34,53,70,128`) assert meta only, reset the log, or already hold a plan; they survive the thorough gates opening. `plan-revise` appears once in the suite (`route.test.mjs:451`), so the plan's "RETHINK/REVISE has no tests" claim is true.

## Findings

### F1 — The loops put the unproven frame step on every standard and lean run, against the plan's own end state

- **Severity**: ❌ CRITICAL
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: End-State Alignment
- **Location**: Decision 10; Phase 4 change 1 (`replanNext`); Desired End State; plan-brief "Success Criteria (Summary)"; Phase 5 change 1 and row 5.10
- **Detail**: Decision 1 gates every pre-plan step at `thorough` so that a standard or lean run stays as it is, and the brief promises "A `standard` or `lean` run looks exactly as before: same first step, no skip entries". Decision 10 then leaves the RETHINK-to-frame loop ungated, and `replanNext` has no rigor check. Today a standard-run RETHINK goes to `plan-revise`. After this change it goes first to `frame` at opus/high, the step the plan itself calls "unproven by any run". Four artifacts disagree with that behaviour:
  - The brief's last success criterion is false for any standard run that gets a RETHINK, and false again for the research loop after a second REVISE.
  - Row 5.10 asks a reviewer to confirm that "nothing in the new text suggests a standard run changed". The only way to pass it is a README that hides a real behaviour change.
  - The README bullet "requirement of the `10x-research` and `10x-frame` skills only when those gates open" is wrong. A standard run needs `10x-frame` as soon as plan review says RETHINK. SKILL.md "Start" step 2 checks four skills only, and Phase 5 says the Start text "stays valid", so a project without `10x-frame` burns three opus/high attempts and halts.
  - The containment argument for `thorough`-only gates (cost, unproven guide) does not hold for the RETHINK path, which is the most common backward edge.
- **Fix A ⭐ Recommended**: Gate both loops by rigor with a new `preplan.loops.minRigor`, default `thorough`. Below it, RETHINK and REVISE keep today's `plan-revise` behaviour.
  - Strength: The brief, the Desired End State, 5.10 and the "only when those gates open" requirement note become true as written; Decision 10 names this as its own low-cost reversal; the standard worst path stays 12 steps, which also removes the budget issue of F7 at `standard`.
  - Tradeoff: The loops reach only users who ask for `thorough`, so the RETHINK back edge of ADR-002 diagram 6 is not delivered for the default level until run data justifies lowering the gate; the loop tests need `--rigor thorough` projects.
  - Confidence: HIGH — one `minRigor` read in `replanNext`, same predicate as the gates.
  - Blind spot: Whether the owner wants RETHINK to loop at `standard` is a product call the plan could not ask.
- **Fix B**: Keep the loops ungated and make the documents say so: change the brief and Desired End State ("pre-plan steps run only at thorough; RETHINK and a repeated REVISE change every level"), replace row 5.10 with "README states that a standard-run RETHINK now runs frame", add `10x-frame` and `10x-research` to the README requirements and to SKILL.md "Start" step 2, and add one unattended `/10x-frame` smoke run before Phase 4 starts.
  - Strength: Delivers the roadmap outcome at every level.
  - Tradeoff: Every standard RETHINK costs an opus/high step on a guide no run has exercised; the budget margin shrinks (F7).
  - Confidence: MED — depends on the unattended frame proving usable.
  - Blind spot: No evidence how often a standard run gets a RETHINK.
- **Decision**: FIXED via Fix A. Re-checked: `decide()` has no rigor test on the `needsReplan` branch, so a standard RETHINK would have run `frame`. Added `preplan.loops.minRigor` (default `thorough`, Decision 10); `replanNext` is closed below it and falls through to today's code. Brief, Desired End State and the README requirement note are now true; new test `RETHINK below minRigor behaves as on main` plus the Phase 1 characterization file in its own file, checked byte-identical by a diff in row 4.4. Fix B rejected: it spends an unproven opus/high step on every standard RETHINK.

### F2 — A failed re-plan after the frame round halts the run instead of being retried

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 4 change 1, halt rule (a)
- **Detail**: Rule (a) halts on RETHINK when "a `plan-revise` entry" exists after the last ok `frame-rethink`. Today's `revisions` count includes failed entries (`log.filter(e => e.template === "plan-revise")`), and an implementer will reuse that filter. A re-plan that fails (status `failed` or `blocked`, or `plan.md` left unchanged so the mtime check fails) has `ok: false`, does not move `lastIdx(log, ["plan"])`, and leaves the review fresh and still RETHINK. The next `decide()` then reaches (a), sees the failed `plan-revise` entry and halts with "RETHINK again after frame and re-plan", although plan review never re-ran. The retry at +1 tier, which every other step gets, is lost exactly on the expensive path. The test list has no case for it (`failed frame-rethink is retried` covers the frame step only).
- **Fix**: Make (a) count only `ok` `plan-revise` entries after the last ok `frame-rethink`, and add the test `failed plan-revise after frame-rethink is retried at the next tier and halts after three`.
- **Decision**: FIXED. Re-checked: `revisions` counts failed `plan-revise` entries, so rule (a) as drafted would halt on the first failed re-plan. Rule (a) now counts only ok `plan-revise` entries after the last ok `frame-rethink`; test `failed plan-revise after frame-rethink is retried at the next tier` added. Correction to the finding: the halt after the second failure comes from `maxPlanRevisions` (today's counting, pinned in Phase 1), not after three; Decision 13 records it.

### F3 — Nothing makes the re-plan use the frame brief it was triggered to produce

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: End-State Alignment
- **Location**: Phase 2 change 1 (`plan-revise` gains `{artifacts}`); Phase 4; row 5.9
- **Detail**: The RETHINK loop is worth its cost only if the re-plan changes direction because of the new `frame.md`. The `plan-revise` prompt still says "Revise the existing plan.md. Resolve every CRITICAL finding and every WARNING ... Keep the ## Progress contract", and the only change is the appended artifact line. `/10x-plan` Step 1.0 treats an existing `plan.md` as "resume/refine mode — out of scope for this scaling logic", so its rule "treat the Reframed problem statement as authoritative" is documented for a fresh plan, not for a refine run. A RETHINK means the approach is wrong. A re-plan that patches the old plan around the findings satisfies every router check (`plan.md` changed, `## Progress` valid) and burns a revision. Row 5.9 writes the verdict by hand and so cannot show this.
- **Fix**: Add one rule line to the `plan-revise` prompt in the ADR-004 form: GIVEN `frame.md` is listed under the upstream artifacts, WHEN you revise, THEN you **MUST** treat its reframed problem statement as authoritative and rework any approach that contradicts it instead of patching. Add one real (not hand-written) RETHINK, frame, re-plan run to Phase 5 and record what `/10x-plan` did with the brief.
- **Decision**: FIXED. Re-checked: `plan-revise` prompt has no reference to `frame.md` and `/10x-plan` treats an existing plan as refine mode. Added `prompts.frame-authority` (ADR-004 rule line), appended by `authorityLine` only when `frame.md` exists so the prompt stays byte-identical otherwise; Phase 2 test `frame authority rule only with frame.md`. The hand-written-verdict row is gone; row 5.7 is a real RETHINK, frame, re-plan run that records what `/10x-plan` did.

### F4 — Research verification demands frontmatter that the unedited `research-with-map` prompt never asks for

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Phase 3 change 3 (`research` case); Phase 2 change 1 (`research-with-map` template); Decision 12 ("used unedited")
- **Detail**: Verification of `research` requires `frontmatterField(research.md, "status")` non-null. The real `/10x-research` writes `status: complete|partial` (its `references/research-document.md`), but `prompts/research-with-map.md` replaces the report shape ("hold two explicit sections: `Feature overview` and `Technical debt`") and never mentions frontmatter. If the subagent follows the prompt's report shape over the skill's template, the step is marked failed although the work is done, retried at +1 tier (sonnet to opus), and halted after three. The failure mode is expensive and silent. Every Phase 3 test builds `research.md` itself, so none can show it. The `research-revise` follow-up has the same dependency on a file the prompt owns.
- **Fix A ⭐ Recommended**: Make the `research-with-map` prompt an array: the file reference plus one rule line that the first lines of `research.md` MUST be frontmatter with `status: complete` or `partial`. Add the same line to `research` and `research-revise`.
  - Strength: Keeps the strong check and leaves the shipped prompt file untouched.
  - Tradeoff: One more prompt line to keep in sync with the research skill's template.
  - Confidence: HIGH — the loader already joins arrays.
  - Blind spot: A subagent can still skip the line; the manual row 5.8 is the only check.
- **Fix B**: Relax the research check to `mtime > startedAt` and a non-empty file, as `plan-review` does for its file.
  - Strength: No coupling to a frontmatter key.
  - Tradeoff: A stub or half-written file passes.
  - Confidence: MED — cheaper but weaker.
  - Blind spot: Whether any consumer later reads `status`.
- **Decision**: FIXED via Fix A. Re-checked: `research-with-map.md` asks for no frontmatter, while `/10x-research` writes `status: complete|partial` (the two domain prompts do ask for `type: refactor-plan`, so no change there). The three research templates now carry one status rule line; the shipped prompt file stays unedited. Test `research templates ask for status frontmatter`; row 5.6 checks a real run's `research.md`.

### F5 — The `aggregateGap` parser spec does not match the real distillation report

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Phase 3 change 1 (`aggregateGap`); change 5 (`domain brief by aggregateGap`)
- **Detail**: The real table header in `10x-domain-distillation/references/report.md` is `| id | candidate | invariant (quoted) | source | status | guarded at | gap |`, so a column named `invariant` never matches an exact-name lookup. With more than three candidates the report puts one `###` subheading per candidate under `## Invariants and policies`, each with its own table, so a section reader that stops at the first heading of any level sees only the first table. Status cells may carry qualifiers; the plan normalises to "lowercase letters only", so `declared (soft)` becomes `declaredsoft` and misses. The test fixture is hand-written by the same author as the parser, so it will match the parser and say nothing about the real report. The result is a domain-brief gate that never fires in real use and no test that notices.
- **Fix**: Specify the parser against the real format: section from `## Invariants and policies` to the next `## ` heading (so `###` tables count); a header cell matches when it starts with `invariant`; the status is the first alphabetic word of the cell, lowercased. Build the fixture by copying the table template from the reference verbatim, with one multi-candidate (`###`) case and one qualified status case.
- **Decision**: FIXED. Re-checked against `10x-domain-distillation/references/report.md` and a real report under another project's `context/domain/`: header is `invariant (quoted)`, `###` sections hold one table each, status is bold with qualifiers. Parser re-specified (section bound at the next `## `, header starts with `invariant`, status is the first alphabetic word, candidate from the `###` heading when no column). Fixtures use the verbatim reference header plus synthetic rows in the real shape: reference template, multi-candidate, qualified status.

### F6 — `framingDoubt` fires on bare "fix" and "bug", and the guide then halts for the goals it matched

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Decision 9; Phase 3 change 1 (`framingDoubt`); Phase 2 change 3 (`frame-unattended.md`); rows 3.7 and 5.5
- **Detail**: The word list is the trigger phrases of the frame skill description, and the match is a word-start prefix of the lowercased goal. That list holds "fix", "bug" and "broken", so `fix typo`, `fixture cleanup` and `fixes for the router` all open a frame step at opus/high on every `thorough` run. The skill itself says to skip mechanical changes. The unattended guide then tells the subagent to report `blocked` with `signals.needsHuman` when "the goal and `change.md` give no observation or proposed cause to frame". `fix typo`, the goal in the plan's own check 5.5, has neither. The two rules combine so that a trivial thorough goal ends in a human halt before any plan exists, at the most expensive tier. Calibration is deferred to S-06, but the first run already pays.
- **Fix**: Drop the bare verbs from the default list and keep cause-shaped and design-shaped phrases (`root cause`, `should we even`, `is this the right`, `challenge the assumption`, `rethink`, `before i plan`, `caused by`, `because`). Add a test that `fix typo` does not open frame. Keep the full skill list as a documented override for projects that want it.
- **Decision**: FIXED. Re-checked: the default list was the skill description triggers including `fix`, `bug`, `broken`. Dropped them (Decision 9); kept cause- and design-shaped phrases plus `assuming`; the full skill list stays available as the documented `goalWords` override. The guide now confirms a plain goal at LOW and ends `done` (Decision 14); `blocked` only for an empty goal with nothing to frame. Tests: `framing doubt does not fire on fix typo`, `thorough opens` with `fix typo`; manual rows 2.10 and 2.11.

### F7 — The 13-step worst path leaves no tolerance for one failed step at standard

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Decision 3; Phase 4 tests `longest legal path at standard fits`
- **Detail**: The arithmetic is right (13 of 14 at `standard`, 16 of 18 at `thorough`), but the budget check is `executed >= budget` and it runs before `decide()`. A path of 13 reaches `done` only if no step failed. One failed step makes 14 executed, the next `next()` halts with "Step budget 14 spent" after all the work is finished and reviewed. Before this change the worst path was 12 and tolerated one failure; after it tolerates none. Failures are the case the budget exists for. The proof also assumes a single `implement` step; an `implement` that ticks only some rows is still `ok` (verified when `autoDone` rises), so "longest legal path" is a reference path, not a bound. This finding disappears for `standard` if F1 Fix A is taken (the standard worst path stays 12).
- **Fix**: If the loops stay ungated at `standard` (F1 Fix B), set `rigor.budgetDelta.standard` to 1 (update `route.test.mjs:152`, row 4.6 and the README) or state the zero-failure tolerance in the README and ADR-003 and call the test a reference path. Either way, rename the tests from "longest legal path" to "reference path" and assert the margin in the test.
- **Decision**: FIXED, by taking F1 Fix A and accepting the remainder. Standard worst path stays 12 of 14 (tolerates one failure, unchanged). Thorough worst path is 16 of 18, tolerates one failed step; `budgetDelta` is not raised because only a RETHINK or a double REVISE on top of three pre-plan steps reaches it and a project can raise its own delta (Decision 3). Tests renamed to `reference path` and assert one step to spare; README and ADR-003 state the tolerance and the number for projects that open the loops at standard.

### F8 — The plan commit flipped the roadmap, and the parallel changes collide with this one in more places than the plan lists

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architectural Fitness
- **Location**: commit 6688377 (`context/foundation/roadmap.md`); "Dependency on S-05 and S-06"; check 2.5; Phase 3 changes 2 to 4
- **Detail**:
  - Commit 6688377 sets S-07 to `planning` in two places of `roadmap.md` (the table row and the `Status:` line). S-05 and S-06 are the adjacent rows of the same table and edit the same file in their own branches, so the flips conflict on adjacent lines, and a plan commit should not move status at all (sibling plan reviews found the same). The plan does not mention the edit.
  - The "Dependency" section says new router code sits "in functions below `decide()`", but Phase 3 edits `attachResult` (the verification switch), `next()` (skip loop, prompt render, entry fields) and `decide()` itself (the no-plan and re-plan branches). S-06 `compare` reads executed entries and must tolerate skips; this change adds a `verdict` key, three new step names and skip rows with a `risk` of `undefined`. The plan does not tell S-06 that these are additive or test that `status` and `report.md` print them.
  - Row 2.5 asserts that `preplan` is exactly the key after `archive`. S-05 and S-06 will add policy keys after `archive` as well (the plan says to do that), so whichever merges second fails 2.5 although nothing is wrong.
  - Phase 5 appends to "How the tier moves" after the archive bullet and to the README routing list; both parallel changes append there.
- **Fix**: Remove the `roadmap.md` hunks from the plan commit (restore the file from `git merge-base main HEAD`) and let the status move in the implementing branch. Replace 2.5 by an order-free check (`p.preplan` exists, `p.steps.frame` pinned to tier 4). Correct the "Dependency" section to list the real touch points in `attachResult`, `next()` and `decide()`, state that the log entry change is additive (`verdict` key, new step names, skip rows), and add a `status` and report assertion for a pre-plan skip row. Do the docs of Phase 5 last and rebase on whichever of S-05 and S-06 lands first.
- **Decision**: FIXED. Re-checked: commit 6688377 flipped S-07 in two roadmap places; `roadmap.md` is restored to its `54f1729` version and the status moves on the implementing branch (this deviates from the 10x-plan skill's default roadmap sync on purpose). Row 2.5 is order-free. The Dependency section lists every `route.mjs` region by phase (`attachResult`, `next()`, `decide()` no-plan and re-plan branches, new section below `decide()`, helpers below `render()`), states that `verdict`, the new step names, templates and skip rows are additive for S-06 `compare`, and test `pre-plan skip row in status and report` covers `status` and `report.md`. README and SKILL.md placements are exact and Phase 5 rebases last.

### F9 — Manual rows duplicate automated ones, and one guard is weaker than its name

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Progress rows 2.8, 3.7, 3.8, 4.7, 5.9, 4.4 and 2.4; Phase 2 change 5
- **Detail**:
  - Rows 2.8, 3.7, 3.8 and 5.9 repeat what the automated tests already prove (plan prompt lists both files, `init --rigor thorough` returns `research`, standard returns `plan` with no skip entries, a RETHINK review leads to `frame`). Only the `status` listing of skipped gates in 3.7 is not asserted. Row 4.7 (model and effort of `frame` and `frame-rethink`) can be an assertion in the walker.
  - Row 4.4 says the Phase 1 tests "pass unchanged", but the pattern run proves only that they pass. Phase 4 edits the same file, and the tests pass at all only because the override switches the loops off. A diff of the `existing loop` tests against the Phase 1 commit proves "unchanged"; a separate file makes that diff trivial.
  - Test `frame guide covers each ask point` checks that the guide contains the headings the plan told its author to write. It cannot notice a new ask point in the real `10x-frame`. The proof that the guide works is rows 5.6 and 5.7, which sit in the last phase, after all router code is written. The guide is independent of the router, so the smoke run can happen as soon as Phase 2 ends.
- **Fix**: Turn 2.8, 3.8, 4.7 and 5.9 into assertions (or delete them), add the `status` assertion to the 3.7 test, move `existing loop` tests to their own file with a diff-against-Phase-1-commit check, and move an unattended `/10x-frame` run with a bug-shaped goal to the Phase 2 manual rows.
- **Decision**: FIXED. Rows 2.8, 3.7, 3.8, 4.7 and 5.9 became assertions or were merged into tests (the walker asserts model and effort of `frame` and `frame-rethink`); the characterization tests moved to `loops-existing.test.mjs` and row 4.4 now runs them plus a diff check against the commit that added the file; the unattended `/10x-frame` runs moved from Phase 5 to Phase 2 (rows 2.9 to 2.11). Also fixed an inconsistency the finding did not name: the `verdict on the entry` test cannot pass before the code change, so it moved to `loops.test.mjs`.
