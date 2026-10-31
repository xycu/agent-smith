<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Rigor-gated Pre-plan Steps and Backward Loops

- **Plan**: context/changes/pre-plan-steps/plan.md
- **Scope**: Full plan (branch `pre-plan-steps-impl`, commits 866a347..9635dc0)
- **Reviewed phases**: 1, 2, 3, 4, 5
- **Date**: 2026-10-31
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 5 observations

All five phases were reviewed. Every Automated row is ticked; every phase still has unchecked Manual rows (11 in total). No code defect was found. The warnings are about what is still unproven and about one out-of-scope roadmap edit.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

## Evidence summary

- Automated: `node --test skills/10x-pipeline/test/*.test.mjs` gives 238 pass, 0 fail. Rows 2.5, 4.4 (`git diff` of `loops-existing.test.mjs` against its adding commit is empty), 4.6, 5.3 and 5.5 (init and status JSON valid at `--rigor thorough`) were re-run and pass. The import, git-write and Node 18 ban-list greps are clean. `Object.hasOwn` and `replaceAll` are Node 16/15 features, so they are fine on Node 18. The regex lookbehind in `tableCells` is fine on Node 18.
- Plan amendments, checked in code and tests: round 1 F1 (loops gated by `preplan.loops.minRigor`, a standard RETHINK takes today's path, proven by the byte-identical characterization file); round 2 F1 (mid-run rise to `thorough` opens the loops; wording in README, SKILL.md and ADR-003; tests `standard run that rises to thorough mid-run opens the loops` and `1-phase standard plan RETHINK takes today path`); round 2 F2 (`authorityLine` renders the real id, no `{` left, the line says it wins over "Keep ... step indices and titles", one bold keyword); round 2 F3 (`aggregateGap` reads every pipe table of the section whose header has `invariant` or `policy` plus `status`, whole-word match, stopwords in `policy.json`, heading not a word source).
- Budget arithmetic, re-derived by hand and by the walker tests: standard worst path 12 of 14, thorough worst path 16 of 18 for both the frame loop and the research loop. The two loops cannot combine into a longer path, because branch (b) `revisions >= maxPlanRevisions` runs before (c) and (d). `budgetDelta` and `limits` are unchanged (row 4.6).
- Skip cap: one skip per step per call. A second skip for the same step still halts with `Router error: skip loop`. Termination holds.
- Backward loops cannot spin. Walked: failed `frame-rethink` (retry, halt after three), failed `plan-revise` after a good frame round (retry once, second failure halts at the revision cap), second RETHINK after a good re-plan (halts), `rethinkToFrame` greater than 1, failed `research-revise` (retry, halt after three).
- `repoMapExists` was run against plain, quoted, CRLF, BOM and extra-key frontmatter: all select `research-with-map`; a missing frontmatter selects `research`. A trailing inline comment (`artifact: repo-map # x`) does not match; the real template has none.
- `promptText` halts with a JSON `Router error:` on a missing file, a path escape, a missing `.md`, a non-string part and a missing key. A goal text containing `{authority}`, `{artifacts}` or `@prompts/README.md` is not expanded (render is single pass, references resolve first).
- Tests are real: they drive the CLI in scratch projects. 19 mutations of the router were applied in a scratch copy (pre-plan after a plan attempt, loops always open, skip cap of two, second-RETHINK halt counting failed re-plans, no `## Reframed` check, mid-word phrase match, status filter removed, research-revise without a prior REVISE, gate `>` for `>=`, authority line unconditional, repo map frontmatter ignored, retry removed, mtime check removed, brief `type` check removed, revision cap removed, verdict not stored, frame bump, `skipIf` never evaluated, closed gate logging a skip). All 19 were killed. Three more mutations on the retry branch (see F4): two survived.
- Manual rows I can settle from the diff: 1.5 (commit ad19eb2 with the characterization file precedes 6d2442e with the `verdict` key) and 4.9 (in `decide()` the only new logic is the `replanNext` call; branch (e) is the removed body, line for line) pass. 5.8 passes: the README states the pre-plan steps and loops are `thorough`-only, that a `standard` or `lean` run needs neither skill and shows no new step. 1.4 passes on the test names. These stay unticked in `plan.md`; this review does not edit it.
- Hard rules: routing is only in `route.mjs` and `policy.json`; `SKILL.md` names no model, effort or tier value (it says "the policy pins the tier of `frame`", the same wording it already uses for archive); no new import; no git write added; `run.jsonl` and `meta.json` are written only by the router; `context/archive/` untouched. The "How the tier moves" list in SKILL.md and the README routing bullet were updated. Rule lines of the new prompts and ADR-003 pass the ADR-004 form test.

## Findings

### F1 — Manual rows 2.9 to 2.11 and 5.7 are open although the plan puts them before Phase 3 and before merge

- **Severity**: WARNING
- **Impact**: MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Success Criteria
- **Location**: context/changes/pre-plan-steps/plan.md, Progress rows 2.8 to 2.11, 3.10, 5.6, 5.7; context/changes/pre-plan-steps/change.md (`status: implemented`); docs/ADR/ADR-003-rigor-gated-routing.md (row `pre-plan-steps ... implemented`)
- **Detail**: 11 Manual rows are unchecked. Phase 2's Implementation Note says that if an unattended `/10x-frame` run shows the guide failing, the guide is fixed "before the router code that relies on it". The router code (Phases 3 and 4) landed first, so that ordering is lost. Row 5.7 says that if the real re-plan patched the old plan instead of following `frame.md`, the `frame-authority` line must be strengthened "before merging". The branch is therefore merge-ready only on the tests; the two behaviors that depend on a real model (the frame guide at four ask points, the authority line in `/10x-plan` refine mode) have no evidence yet. ADR-003 itself lists them as "still open" while its table says `implemented`, and `change.md` says `implemented`.
- **Fix**: Run rows 2.9 to 2.11 and 5.7 (and 5.6, 3.10) before the PR is merged, record the outcome in the review file or PR text, and tick the rows. Until then, say in the PR text that the change is implemented but not manually verified. No code change is needed unless a run fails.
  - Strength: These are the only checks that exercise the real skills; the plan already names them as gates.
  - Tradeoff: Needs a real pipeline run and some model spend.
  - Confidence: HIGH — the plan text makes 5.7 a pre-merge condition.
  - Blind spot: I could not run a real pipeline here, so I cannot say whether the guide or the authority line will hold.
- **Decision**: Skip: Manual rows 2.9 to 2.11, 3.10, 5.6 and 5.7 need a human or a live session (a real unattended `/10x-frame`, a real thorough pipeline run); not done in this fix pass and none ticked. `plan.md` (Fix pass) and `change.md` Notes state that these rows are open and owner-verified before merge; `change.md` stays `impl_reviewed`; ADR-003 says the live-skill checks are unverified and its `implemented` row means code and tests only.

### F2 — "The 11 Manual rows are all the unverified behavior" is not quite true

- **Severity**: WARNING
- **Impact**: MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Success Criteria
- **Location**: context/changes/pre-plan-steps/plan.md (Phase 5 Manual rows)
- **Detail**: Behavior that depends on a real skill or model and that no row (and no test) covers:
  1. The `research-revise` round with the real `/10x-research`: appending to an existing `research.md`, keeping the `status` frontmatter (the router verifies it), updating `last_updated`. Row 5.6 covers only the first, pre-plan research; row 5.7 covers only the RETHINK path. The `research-revise` verification is covered with synthetic files only.
  2. Only one domain template is run in row 5.6 (`a domain brief`). The other prompt file (`invariant-aggregate-refactor.md` or `anti-corruption-layer.md`) is never run to confirm it writes the folder file with `type: refactor-plan` that `attachResult` requires; a miss costs three retries and halts the run.
  3. `frame-rethink` against a `frame.md` that does not exist (frame skipped before the plan, then a RETHINK): the prompt says "Update ... in place" and the guide has no rule for a first-time brief in this mode. Behavior under the real skill is unknown.
  4. A missing `10x-research` or `10x-frame` skill: the README says the step fails three times and halts. Not exercised; SKILL.md's Start step does not check for these two skills.
- **Fix**: Add manual rows for items 1 to 3 (or fold them into 5.6 and 5.7: run both domain templates, force a second REVISE, run a RETHINK on a run whose frame was skipped), and add a line to SKILL.md Start or the README Requirements that tells a `thorough` run to check for `10x-research` and `10x-frame`.
  - Strength: Closes the model-dependent gaps in the same pipeline runs already needed for F1.
  - Tradeoff: More manual work; the rows only matter for runs at `thorough`.
  - Confidence: MED — item 3 may already work through the generic suffix rules.
  - Blind spot: Real skill behavior was not run.
- **Decision**: Fix (708d4b2) for the router side, rows for the live side: tests for a research-revise round that drops `status`, `frame-rethink` without a `frame.md`, a missing `10x-research` or `10x-frame` skill (three failed attempts halt with the last note), both domain prompts naming their file and `type: refactor-plan`, and the old-log migration. The `frame-rethink` prompt now says to write a new brief when `frame.md` does not exist. The list of unverified behavior is in `plan.md` (Fix pass); the live parts are Manual rows 5.9 to 5.12, unticked. The README Requirements bullet already names the two skills and the halt; SKILL.md Start is left as is on purpose (the plan keeps Start untouched).

### F3 — Roadmap status flip does not belong in this PR (same call as S-05)

- **Severity**: WARNING
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: context/foundation/roadmap.md:51 (table row S-07) and :173 (`Status:` of section S-07)
- **Detail**: The branch moves S-07 from `proposed` to `in-progress` in two places. The plan did say the implementing branch moves it, so this is not drift from the plan. The reason S-05 dropped the same edit applies here: row 51 sits directly under rows 49 (S-05) and 50 (S-06), which the parallel PRs will edit; adjacent-line edits in one table conflict on merge. The value is also low: after merge the row would read `in-progress` for a change that is implemented, until someone sets `done`.
- **Fix**: Revert both roadmap lines in this PR; set S-07 to `done` in the close-out commit after merge, as was done for the other changes.
- **Decision**: Fix (5850977): both roadmap lines reverted; a diff of `context/foundation/roadmap.md` against main is empty. `/10x-archive` makes the only S-07 edit after the merge.

### F4 — The retry-regardless-of-gate rule is sound but not pinned by a test

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: skills/10x-pipeline/scripts/route.mjs, `preplanNext` (`if (mine.length)` before the `skipIf` and `minRigor` checks); skills/10x-pipeline/test/preplan.test.mjs:708
- **Detail**: A failed pre-plan attempt is retried before `skipIf`, `when` and the rigor check are looked at. That is correct and matches the plan's contract order. A failed `research` often leaves a `research.md` without `status` frontmatter; if `researchExists` were evaluated first, the retry would be skipped and an unverified file would pass, which breaks Decision 4. The level never drops, so the rigor-closed case is only reachable through a changed policy. I ran three mutations in a scratch copy: skipping the retry when `skipIf` now hits, and skipping it when the gate is closed by rigor, both survive the whole `preplan` and `loops` suites. Only the variant case (repo map removed, template kept) is tested.
- **Fix**: Add one test: a failed `research` that leaves a `research.md` without `status` frontmatter returns `research` again (not a skip, not `plan`), and halts after three failures.
- **Decision**: Fix (708d4b2): test `a failed pre-plan step is retried before skipIf, when and the rigor check` covers research and frame (artifact present but unverified), a gate closed under the run, and a `when` signal that is gone. Both surviving mutations (skipIf wins over the retry, a closed gate wins over the retry) turn red in a scratch copy; the unmutated copy is green.

### F5 — A policy or prompt error loses the subagent's result

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: skills/10x-pipeline/scripts/route.mjs, `attachResult` (removes the result file) and `next()` (`promptText` runs before `writeLog`)
- **Detail**: `attachResult` deletes `last-result.json` and mutates the log in memory; the log is written only after the next prompt is built. If `promptText` throws (a bad `@prompts/` reference in a project override), the result is gone, the log entry has no result, and the next `next` halts with `Step N (...) has no result`. Reproduced in a scratch project. The same loss existed before for a missing prompt key (a TypeError in `render`), so this is not a regression, but the new loader makes the failure easier to reach and the plan describes it as a clean JSON halt.
- **Fix**: Check that every prompt reference resolves at the start of `next()` before `attachResult`, or write the log right after `attachResult`.
- **Decision**: Fix (7b0fe76): `next()` resolves every policy prompt before `attachResult` consumes `last-result.json`. A bad `@prompts/` reference, a missing file, a path escape or a null prompt halts with `Router error: ...` and "the result file and the log are untouched"; after the policy is fixed the same result is consumed. Test added; removing the check turns it red.

### F6 — Any `signals.rigor` on an early step opens the frame step

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: skills/10x-pipeline/scripts/route.mjs, `PREDICATES.framingDoubt` (`typeof e.signals.rigor === "string"`)
- **Detail**: Pre-plan steps only run at `thorough`, so a `signals.rigor` on `research` or `domain-brief` can never raise the level. The predicate still treats the value (`standard` and `lean` included, both valid per the suffix prompt) as a framing doubt and starts the opus/high frame step. I confirmed it: a thorough run with goal `add a button` and a research result carrying `signals.rigor: "standard"` returns `frame`. This matches the plan text ("a `signals.rigor` on an earlier pre-plan step") and has a test, so it is a design note, not a bug.
- **Fix**: Document that any value counts, or narrow the predicate to the level `thorough` once run data shows how subagents use the key.
- **Decision**: Skip (no code change, plan followed): the plan (Decision 1, Phase 3 `framingDoubt` contract) says a `signals.rigor` on an earlier pre-plan step opens the frame step, whatever its value. Pre-plan steps run only at `thorough`, so the value cannot raise the level; the key means the subagent saw more risk than the goal suggested. Added a test that pins it (lean, standard and thorough count; an invalid value is dropped before the router) and documented it in the README predicate table. Narrowing the predicate waits for run data.

### F7 — Small precision gaps in docs and tests

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: README.md ("Pre-plan steps", second bullet); context/changes/pre-plan-steps/plan.md Migration Notes; skills/10x-pipeline/test/loops.test.mjs
- **Detail**: (a) The README bullet "They are reached by `--rigor thorough`, a `signals.rigor` ..., a plan of 6 or more phases, three failed steps or three hot paths" reads as if all of these open the pre-plan steps. Before the first plan only an explicit `--rigor thorough` can: the other triggers need a plan or a failed step, and the next sentence ("decided once ... a later rise does not open them") then closes them. The caveat is documented honestly, but the first sentence invites a misreading. (b) The migration claim "an old log without `verdict` never gets a `research-revise`" is true (I ran it: an old log with one `plan-revise` and no `verdict` key returns `plan-revise`) but no test pins it. (c) The Phase 1 contract and the "additive for S-06" note say `verdict` appears on `plan-revise` and `fix` entries only; since Phase 4 the `frame-rethink` and `research-revise` entries carry it too.
- **Fix**: Split the README sentence into "pre-plan steps: `--rigor thorough` only" and "loops: any rise to thorough"; add the old-log test; mention the two extra templates in the S-06 compatibility note.
- **Decision**: Fix (5297bc2, 708d4b2): README now says pre-plan steps open only for a run that starts at `thorough` and the loops follow the current level; test for the old log without `verdict`; README, ADR-003 and the S-06 note in `plan.md` say `frame-rethink` and `research-revise` entries carry `verdict`.

### F8 — Two template names are hard-coded in `route.mjs`

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: skills/10x-pipeline/scripts/route.mjs, `PREDICATES.briefExists` (`["domain-aggregate", "domain-acl"]`), `authorityLine` (`"frame.md"` fallback)
- **Detail**: AGENTS.md keeps tunable data in `policy.json`. `briefExists` lists the two brief templates in code instead of reading the templates of the `domain-brief` gate, so a project override that renames a brief template or artifact silently disables the skip. The plan specified the same shape and the names are stable, so this is minor.
- **Fix**: Derive the list from `preplan.gates.domain-brief` (default plus variants) mapped through `preplan.artifacts`.
- **Decision**: Fix (3aeec4d): `briefExists` derives the brief files from the templates of `preplan.gates.domain-brief` (default and variants) mapped through `preplan.artifacts`; `authorityLine` reads the `frame` artifact from the policy. Test with a renamed template and artifact (red on the old code).
