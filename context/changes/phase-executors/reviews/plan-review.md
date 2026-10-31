<!-- PLAN-REVIEW-REPORT -->
# Plan Review: phase-executors Implementation Plan

- **Plan**: context/changes/phase-executors/plan.md
- **Mode**: Deep (claims verified by the reviewer against `route.mjs`, the tests and the toolkit skills at commit 8e4f6ea; no sub-agent, one scratch experiment)
- **Date**: 2026-10-31
- **Verdict**: REVISE
- **Findings**: 2 critical, 5 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | FAIL |
| Lean Execution | WARNING |
| Architectural Fitness | WARNING |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

Why REVISE and not RETHINK: the approach (keep step `implement`, vary the template, derive counters from the log, new logic below `decide()`) is sound and matches `preplanNext`/`replanNext`. Both criticals have in-plan fixes (a decide() condition and an explicit test-edit list); neither changes the design.

## Grounding

Grounding: 21/21 line anchors checked (`route.mjs` :65-89, :84, :331, :355, :417, :421, :701-709, :718, :726-740, :742, :999, :1004-1005, :1025, :1048, :1350-1357, :1397, :1408, :1720; `SKILL.md:112`; `ADR-003:24`; `route.test.mjs:386-400`) ✓. Paths to modify exist (6/6); new files are absent as planned. Symbols exist (`readPlan`, `trailingFailures`, `rigorInputs`, `simpleSignal`, `tierFor`, `preplanNext`, `replanNext`, `PREDICATES`, `attachResult`). Brief↔plan ✓ (phases, decisions, caps match). Progress↔Phase ✓ (one `## Progress`, 6 phases, every Success Criteria bullet has a row, no checkboxes outside Progress). Step-budget arithmetic reproduced: standard longest path is 19 and thorough 23, so budgets 21 and 25 follow from the plan's own assumptions (see F5). No `lessons.md` and no `contract-surfaces.md` in this repo.

## Findings

### F1 — Phases 4-6 break existing tests the plan forbids editing; gates 4.10, 5.10 and 6.3 cannot pass

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Phase 4 §3, Phase 5, Phase 6 §1; Progress rows 4.10, 5.10, 6.3
- **Detail**: The plan edits only `loops.test.mjs:30-34` and says the "existing reference paths still pass unedited" (6.3). Three things contradict that.
  1. `loops.test.mjs:441` defines `IMPL` with a `REJECTED` as the second impl-review. The three reference paths (`:453`, `:467`, `:482`) walk it to `fix`. With `codeReplan.onRejected: true` the first `REJECTED` returns `plan-rejected`, so each `sequence` deepEqual changes. The walker `answer()` (`:412-427`) also writes an unticked `planText(...)` for any `plan` step and fails on an unknown step, so `plan-rejected` would be unverified.
  2. `helpers.mjs:58` `planText` always writes a pending Manual row `N.9`. At standard and above, every walk reaches the all-automated-done state with a pending Manual row, so `manual-verify` is inserted before the first impl-review. The same three paths then gain a step (12 becomes 13, which fails `assertFits` "one step to spare" until the delta moves), and `answer()` hits `assert.fail("unexpected step manual-verify")`.
  3. `route.test.mjs:195-199` ("impl-review never gets a tier below the floor", standard part: `planText({done:1})`, no impl-review file) expects `impl-review` first; Phase 5 returns `manual-verify`.
  The research listed `:441` and `:453-482` as tests "the plan must keep or edit" and noted the `N.9` row; the plan carried neither into its scope. An implementer hits a dead end at Phase 4 or 5: edit outside the stated scope, or weaken the feature. Row titles are review-immutable, so these titles must be fixed now.
- **Fix**: Replace the scope with an explicit edit list. (a) `loops.test.mjs:30-34` as planned. (b) The reference-path block `:412-497`: `answer()` gets cases for `manual-verify` (tick the Manual row with an evidence suffix) and for the `plan-rejected` template (add a pending row, keep ticked ones); `IMPL` and the three `sequence` arrays and step counts are updated; `assertFits` stays. (c) `route.test.mjs:195-199`: give the standard fixture a plan without a pending Manual row, or pin `manualVerify.minRigor` through the policy override. Reword 4.10 ("loops.test.mjs and route.test.mjs edited only as listed in Phase 4/5"), 5.10 and 6.3 ("Existing reference paths pass, with only the listed edits"). Run the suite against a prototype of the Phase 5 placement before finalizing the list: a fixture with a pending Manual row at standard is the common case, so other tests may move.
- **Decision**: PENDING

### F2 — A failed strict check never re-opens the flipped rows, so a full-phase Skip flip still reaches impl-review as "done"

- **Severity**: ❌ CRITICAL
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: End-State Alignment
- **Location**: Phase 1 §3 (`attachResult`), Phase 2 §2 (`executorNext`, `decide()`), criteria 1.3, 2.7
- **Detail**: Scope bullet 3 of `change.md` is "a skip flip does not count as done". The plan makes the step `ok:false` but leaves the ticked rows ticked. `decide()` enters the implement branch only while `plan.autoPending > 0` (`:701`), and a Skip flips every row of its phase. Experiment (scratch project, deleted afterwards): plan with 2 Automated rows both ticked, log `plan, plan-review, implement{ok:false, verified:false}`, standard rigor. The router returned `impl-review` ("implementation needed retries or fixes"), not implement. `lastIdx(log, ["implement","fix"])` ignores failed entries, so nothing is re-queued. So for the main case (all rows of the segment flipped) the strict check only raises the next impl-review tier by 1 and the rigor to `standard`; the phase stays done. With other phases still pending, the router goes on to goal-implement for those and the flipped phase is silently kept. Test 2.7 ("not repeated, next attempt one tier higher") passes only because its fixture leaves other rows pending. The research said the same ("ticked rows stay ticked, the only action available is a failed-attempt count plus a prompt note on the retry"); the plan dropped the retry note.
- **Fix A ⭐ Recommended**: Treat the phases of an unverified strict entry as pending work. `decide()` keeps the implement branch open while a phase covered by an `ok:false`, non-fallback strict entry has no commit evidence. `executorNext` then returns a goal-implement segment for those phases, with a rule in the segment prompt to verify the ticked rows, commit, and write the SHA. Add a test whose fixture flips ALL rows of the segment.
  - Strength: Delivers the stated purpose; reuses the segment machinery and `executorExcluded`.
  - Tradeoff: One more `decide()` condition; goal-implement may report "no diff to commit" for work that was real, so the retry needs the same zero-diff handling as assumption 4.
  - Confidence: MED — logic follows from the code read; the retry prompt is untested against a live goal-implement.
  - Blind spot: How goal-implement treats rows that are already `[x]` without a SHA (it skips them, `10x-goal-implement/SKILL.md:82`, so the prompt must say otherwise).
- **Fix B**: Accept the residual and say so. Drop "a Skip flip no longer counts as done" from the Desired End State and the brief; call the check a failure counter and a tier/rigor signal, and rely on impl-review. Change 2.7's title to match.
  - Strength: No new router logic.
  - Tradeoff: The headline benefit of the change shrinks to a bump; the plan ships a verification that verifies nothing in the common case.
  - Confidence: HIGH — nothing new to get wrong.
  - Blind spot: None significant.
- **Decision**: PENDING

### F3 — `manual-verify` certifies its own work: the evidence check is a regex, the retry absorbs bad ticks, and human gates become tickable

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Blind Spots
- **Location**: Phase 5 §2 (`attachResult` case `manual-verify`, `manualVerifyNext`), assumptions 2 and 3
- **Detail**:
  1. The router checks that a newly ticked row ends with ` — evidence: \S`. The same agent writes the row and the text, so ` — evidence: x` passes. No file, command or length is checked (assumption 3 admits it). The roadmap names exactly this risk.
  2. A failed `manual-verify` (a tick without suffix) leaves the tick in `plan.md`. `before.manual` is a snapshot of the previous state, so the retry (maxRuns counts only ok runs, up to 3 attempts) starts with the bad tick as its baseline, sees "zero new ticks" and ends `ok:true`. The unproven tick is now permanent. The verification must compare against the state at the first attempt, or the router must report the unproven ids.
  3. Manual rows exist for human judgment. This plan's own rows 1.10, 4.11 and 6.11 are "a reviewer reads the diff and confirms". The prompt only says "leave a row you cannot prove or that needs a person"; nothing in the router separates the two. A ticked row also leaves `manualPending`, so `done` lists fewer items for the human and `archive.haltOnManualPending: true` no longer stops anything.
  4. It is on by default at `standard`, which is the class of every plain goal. Per the research, 5 of 8 archived plans ended with pending Manual rows, most needing a nested pipeline run a subagent cannot honestly do, so the expected yield is low while every such run pays a step (and, with F5, a larger budget).
  5. A failed `manual-verify` counts toward `maxAttemptsPerStep` and `fromFailures`: three bad attempts halt the whole run and raise rigor to `thorough`, because of an optional convenience step.
- **Fix A ⭐ Recommended**: Make the step opt-in and auditable. Run it only when asked (for example `--manual-verify`, or `manualVerify.minRigor: "thorough"` as the shipped default). Verify against the first-attempt snapshot. For path-form evidence require the file to exist under `context/changes/<id>/evidence/` and be non-empty; command-form evidence stays text but needs at least N characters. Record the ticked ids in the log entry (`ticked`), print the count in the `done` output, and treat only rows with a backticked command as candidates (a `humanWords` exclusion list: reviewer, human, reads, confirms). Make a failed manual-verify non-fatal: after 1 failure stop retrying and go on to impl-review.
  - Strength: Removes the self-certification and halting failure modes; stays within "files only".
  - Tradeoff: More router code than the current regex; the word list is uncalibrated.
  - Confidence: MED — each part is small and testable; the word list needs data.
  - Blind spot: Whether subagents will put evidence files where the router looks.
- **Fix B**: Keep default-on at standard, but fix only items 2 and 5 (first-attempt snapshot, one retry then continue) and add `ticked` to the log. Document items 1, 3 and 4 as accepted risk in ADR-003.
  - Strength: Small change; keeps the feature value on by default.
  - Tradeoff: Self-ticked human gates remain possible.
  - Confidence: HIGH for the fixes themselves.
  - Blind spot: How often subagents tick human-judgment rows is unknown until a live run.
- **Decision**: PENDING

### F4 — The commit proof accepts any commit and any existing SHA

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 1 §3 (`commitEvidence`), criteria 1.3-1.5
- **Detail**: `commitEvidence` is true when HEAD moved (and `before.head` is an ancestor), OR every newly ticked row ends with ` — <7-40 hex>` and `git cat-file -e <sha>^{commit}` succeeds. The second branch accepts any commit in the repository, including an old one: a skipping agent that appends a copied SHA passes, and the branch has no legitimate case HEAD-moved does not already cover (a real executor commits, so HEAD moves). The first branch accepts an unrelated commit and a commit that only touches `plan.md`. Edge cases: an executor or user amend/rebase of the old head gives a false failure (`--is-ancestor` fails; harmless but noisy); a worktree and a repo with no commit are fine (null falls back to the count rule). Resume with an entry that has no `before.head` must be treated like null (`== null`, not `=== null`). Ids without a leading `N.M` use the whole row text, so a SHA suffix changes the id and the row looks newly ticked (affects `newlyTicked` and the Phase 4 subset test).
- **Fix**: Require the SHA branch to lie in the new range (`git merge-base --is-ancestor <sha> HEAD` and not an ancestor of `before.head`), or drop the SHA branch and require HEAD moved; for the HEAD branch, require the new range to touch at least one path outside the change folder (`git diff --name-only before.head HEAD`). Normalize ids by stripping a trailing ` — <sha>`. Add a test where the suffix is an old SHA and one where the only new commit touches `plan.md`.
  - Strength: Closes the cheap forgery with read-only git.
  - Tradeoff: A legitimate plan-only commit phase (docs phase through tdd, which tdd excludes anyway) reads as a failure.
  - Confidence: HIGH — the checks are plain `rev-list`/`diff --name-only` reads, allowed by AGENTS.md.
  - Blind spot: Behavior under unusual hook setups that rewrite the commit.
- **Decision**: PENDING

### F5 — Budget deltas 7 and 11 are a stacked ceiling that no run needs; lean is left exposed

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Lean Execution
- **Location**: Phase 6 §1, assumptions 6-8, `policy.json` `rigor.budgetDelta`
- **Detail**: Walked by hand. Standard, failure-free: plan loop 6 (plan, review, revise, review, revise, review) + 3 implement (cap 2 non-plain + 1 plain) + `manual-verify` + impl-review `REJECTED` + `plan-rejected` + plan review + implement + impl-review + fix + impl-review + fix + impl-review = 19; the failure path is also 19; thorough adds the three pre-plan steps and the frame round: 23. So 21 and 25 follow. The arithmetic is right. The issue is the premise: it multiplies every loop's worst case on one path (two plan revisions, two segments, a REJECTED re-plan, two fixes). Each of those loops already has its own cap (`maxPlanRevisions`, `maxFixLoops`, `maxSegments`, `codeReplan.max`, `maxAttemptsPerStep`), so the step budget stops being a separate limit: it is now the sum of the others, 50% higher than today (14 to 21) for every standard run, including the run that never meets an executor or a Manual row. The budget exists as the catch-all for loops nobody capped; a catch-all set at the sum of all caps catches only a bug in the caps. Separately, e2e (`minRigor: lean`) and `codeReplan` (no rigor gate) reach `lean`, whose budget stays 10: a lean run with an e2e segment, a mixed plan and one REJECTED (plan, segment, e2e, impl-review, plan-rejected, review, implement, impl-review, fix, impl-review) sits at the 10-step limit, and the plan says only that `lean` "stays uncovered". Also: the new `manual-verify` retry (up to 2 extra steps) is the failure the "one spare step" does not cover.
- **Fix A ⭐ Recommended**: Raise the budget by the expected path and gate the rare stack. Keep `standard` near 17 (delta 3: covers the 13-15 step realistic worst paths with executors and `manual-verify`) and `thorough` near 20-21; let `codeReplan.max` and `maxSegments` default to values whose stacked worst path fits that, or let the REJECTED re-plan consume one fix loop (`maxFixLoops` 2 becomes 1 fix plus the re-plan). Keep the walker test, but assert the realistic path fits and the stacked path ends `budget spent` cleanly. State the lean exposure in ADR-003 and gate `onRejected` at `standard`.
  - Strength: Keeps the step budget a real limit; no extra cost for runs that use none of the features.
  - Tradeoff: The all-caps run halts with `Step budget spent` instead of completing; rarely seen.
  - Confidence: MED — the realistic paths are derived by hand, not from data (no run data exists, as the plan says for the keyword lists).
  - Blind spot: A halt at the last fix round wastes the run's cost; the owner may prefer completion.
- **Fix B**: Keep 7/11 and make the cost explicit: record in ADR-003 that the budget is now `sum of caps`, and add a per-feature budget credit (the delta rises only after a segment, re-plan or `manual-verify` was executed).
  - Strength: Runs without features keep today's limit.
  - Tradeoff: More `next()` logic; the budget moves during a run.
  - Confidence: MED — new moving part inside the step-budget check.
  - Blind spot: Interaction with rigor rises that already move the budget mid-run.
- **Decision**: PENDING

### F6 — The plan commit flips the roadmap status

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: commit 8e4f6ea, `context/foundation/roadmap.md` lines 52 and 187
- **Detail**: Main has `proposed` for S-08; the plan commit sets `planning` in the table and in the S-08 section. The plan says nothing about the roadmap beyond naming S-08. Earlier changes reverted the same edit (`25e34d9 fix(pre-plan-steps): revert the roadmap S-07 status flip`, `415441f ... restore the roadmap S-05 row to main`). A status flip in a plan commit conflicts with the neighboring S-10 branch and with the archive commit that owns the status.
- **Fix**: Restore the file to main (`git checkout main -- context/foundation/roadmap.md`) in the plan branch, and leave status changes to the close-out commit.
- **Decision**: PENDING

### F7 — The "untouched" and scope claims have no mechanical gate; several Progress rows are weak

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: "What We're NOT Doing", rows 1.10, 4.10, 6.6, 6.9
- **Detail**: The plan promises no edit to `loops-existing.test.mjs`, `compare.test.mjs`, `cleanSignals`, `prompts.suffix`, `buildReport`, and router git use limited to `rev-parse`, `cat-file` and `merge-base --is-ancestor`. The only gates are a human reading the diff (1.10) and a title sentence (4.10). 6.6 `grep -c "manual-verify" skills/10x-pipeline/SKILL.md README.md` passes when one file mentions the word and does not look for `--chrome` or the re-plan. 6.9 says "Node 18 syntax rules" but runs on whatever Node is installed.
- **Fix**: Add commands that diff against `git merge-base main HEAD`, never against `HEAD~`: `git diff --quiet "$(git merge-base main HEAD)" HEAD -- skills/10x-pipeline/test/loops-existing.test.mjs skills/10x-pipeline/test/compare.test.mjs`; for git use, `git diff "$(git merge-base main HEAD)" HEAD -- skills/10x-pipeline/scripts/route.mjs | grep -E '^\+.*(runGit|gitOut)\(\['` and compare the subcommands to the allowed list; per-file greps for `--chrome` in SKILL.md and README.md. Name the Node version the suite runs on.
- **Decision**: PENDING

### F8 — S-10 conflict surface is larger than stated

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: "Implementation Approach", Phase 1 §3
- **Detail**: The plan says `decide()` gets three call sites. The design needs more: the implement-branch executor call, the failure re-plan trigger, the failed `plan-replan` halt, the `struggled` edit (`:718`), the REJECTED block and the `!irFresh` manual-verify call. S-10 is unlikely to edit those. The real overlap is `attachResult`: the plan sets `last.fallback` "after `last.ok` is set", i.e. in the lines directly after `last.signals = signals` and `last.verified`, where S-10's signal capture will land. `cleanSignals`, `prompts.suffix` and `buildReport` are indeed untouched.
- **Fix**: Compute `fallback` inside `case "implement"` (it depends only on `result.status === "blocked"` and the template, not on `ok`) so the tail of `attachResult` stays untouched, and correct the "three call sites" sentence.
- **Decision**: PENDING

### F9 — `compare` baseline, `report.md` and `status` contract for the new steps

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architectural Fitness
- **Location**: Migration Notes, "What We're NOT Doing" (report)
- **Detail**: The log keys are additive, `compare` reads steps generically and `baseline-policy.json` pins the ladder, so new step names are pinned automatically: that part holds. Two gaps. (a) The baseline arm (standard, all sonnet/high) inherits the new defaults, so it runs `manual-verify`, segments and re-plans, while a routed run at `lean` does not (`manualVerify.minRigor: standard`). A drop then comes partly from a feature gate, not from model routing. The plan does not decide whether `baseline-policy.json` should disable the new steps. (b) `buildReport` prints `e.step`, so `implement-segment`/`-e2e`/`-tdd` all read "implement", `plan-replan`/`plan-rejected` read "plan", and a neutral fallback prints "failed" in the Result column; `compare` counts it in `failedAttempts`. `status` gets `template` but the report that survives archive does not.
- **Fix**: Decide (a) in the plan: pin `manualVerify`, `codeReplan` and `executors.maxSegments` in `baseline-policy.json`, or document that both arms carry them. For (b) accept it and say so in ADR-003, or print the template in the Step cell of `buildReport` (one line inside the `rows` map, which S-10 does not touch).
- **Decision**: PENDING

### F10 — Smaller gaps

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phases 2, 4, 5
- **Detail**:
  - `e2eSetup`: "paths exist under ROOT" does not say how. `path.resolve(ROOT, "/etc/x")` and `../x` escape; a symlink can too. Reject absolute paths and `..`, resolve, and compare with `ROOT + path.sep`. The effect is only a false hit, so the cost is low.
  - `{failure}` carries the last implement `result.note` (subagent text, any length, newlines) into the `plan-replan` prompt. Cap and flatten it like `needsHuman` (300 chars).
  - `manualVerify.evidenceDir` has no reader: the prompt hardcodes the path. Drop the key or render it as a variable.
  - `--chrome`: no value validation (`--chrome foo`), and the `main()` usage string is not in the edit list. `--chrome` at `lean` is stored and ignored.
  - Progress headings in `Faza N` form give `phases: 0` in `readPlan` (existing); `phaseList` is then empty and routing stays plain. Fine, but state it.
  - A goal-implement segment that ignores "stop after phase M" runs the later phases itself, so the e2e step never runs; no test or Manual row observes it (2.12 covers only the e2e side). Add it to 2.12.
  - Manual ticks made before a `plan-rejected` re-plan describe the old code and are not repeated (`maxRuns` 1).
  - The "fallback loops forever" worry does not hold: every fallback consumes one of `maxSegments` slots and `executorExcluded` blocks the same (phase, executor) pair, so at most 2 fallback entries exist per run, and the budget still bounds it.
- **Fix**: Fold into the plan edits for F1-F5.
- **Decision**: PENDING
