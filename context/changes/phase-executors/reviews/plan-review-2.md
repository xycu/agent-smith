<!-- PLAN-REVIEW-REPORT -->
# Plan Review: phase-executors Implementation Plan (round 2)

- **Plan**: context/changes/phase-executors/plan.md (revision at 6c27a53)
- **Mode**: Deep (claims verified by the reviewer against `route.mjs`, the tests and the toolkit skills at the revised plan commit; no sub-agent; one scratch experiment, see F1)
- **Date**: 2026-10-31
- **Round**: 2. Round 1 is `reviews/plan-review.md` (9026419, REVISE); it is not edited.
- **Verdict**: REVISE
- **Findings**: 1 critical, 5 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | WARNING |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | FAIL |

Why REVISE and not RETHINK or SOUND: the round 1 design (template-keyed `implement`, one extra-step pool, retry of uncommitted rows, eligibility rule for `manual-verify`) holds up against the code. One revision claim is false and makes Phase 6 unpassable as written (F1). The other findings are plumbing and test-strength gaps that need targeted edits, not a new design.

## Grounding

Grounding: key anchors re-checked against the code (`route.mjs` readPlan, attachResult, trailingFailures, rigorInputs, runGit/gitOut, decide, next, buildReport, main; `route.test.mjs:148-165`, `:195-199`, `:386-400`; `loops.test.mjs:30-34`, `:441-497`; `SKILL.md`; `baseline-policy.json`; `compare.test.mjs:23-29`) ✓. New files are absent as planned. Brief and plan agree (phases, pool, deltas). Progress and Phase agree: one `## Progress`, six phases, every Success Criteria bullet has a row (12/17/9/12/13/16 automated, plus the Manual rows), no checkbox outside Progress. `git diff main 6c27a53 --stat` shows only the change folder, and `context/foundation/roadmap.md` equals `main`.

## Check of the round 1 fixes

| Round 1 | Claimed fix | Reviewer result |
|---------|-------------|-----------------|
| F1 critical | One edited test (`loops.test.mjs:30-34`) | **Partly.** The REJECTED, `manual-verify`, `:441-497` and `route.test.mjs:195-199` reasoning holds (`planText` always writes "Look at it", `helpers.mjs:58`). The claim "no other test breaks" is false: the new `budgetDelta` breaks `route.test.mjs:148` (F1 below). |
| F2 critical | `uncommitted` ids, `implement-retry` | **Partly.** The retry does re-open a full-phase Skip flip and it terminates (F2 below). It can halt a legitimate zero-diff phase after three escalating attempts. |
| F3 warning | Eligible rows, evidence file check, first-attempt baseline, neutral failure | **Partly.** Logic is sound. `manualUnproven` never reaches the output (F3). Evidence checks have gaps (O1). |
| F4 warning | Code commit in `before.head..HEAD` | **Fixed**, with edge cases (O2). |
| F5 warning | Pool, deltas 2 and 7 | **Partly.** Arithmetic re-derived and correct (14 and 19). The proposed test would not fail if a cap were raised (F4). |
| F6 warning | Roadmap restored | **Fixed.** `git diff main 6c27a53 -- context/foundation/roadmap.md` is empty. |
| F7 warning | Gates against `git merge-base main HEAD` | **Partly.** Gates exist; some can pass vacuously (F5), and the test-edit gate contradicts F1. |
| F8 observation | `fallback` inside the cases | **Fixed.** The tail of `attachResult` is untouched. |
| F9 observation | Report label, `compare` count, baseline | **Fixed** for (b). (a) stays rejected; the README note is incomplete (O3). |
| F10 observation | Smaller gaps | **Fixed.** `Faza N` headings, `--chrome` validation, `{failure}` cap, path containment are all specified. |

## Findings

### F1 — The new budget delta breaks `route.test.mjs:148`; gates 4.10, 5.10, 6.3 and 6.14 forbid the edit

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Phase 6 §1 (`rigor.budgetDelta` 2 and 7), Phase 4 §3 table, "What We're NOT Doing" (only existing test edit), rows 4.10, 5.10, 6.3, 6.14
- **Detail**: The plan says the only existing test edit is `loops.test.mjs:30-34` and that "the prototype run found no other failure". The prototype listed in "Key Discoveries" did not include the `budgetDelta` change. `route.test.mjs:148-165` ("step budget differs per level: 10, 14, 18") writes 14 and 18 log entries and expects `Step budget 14 spent` and `Step budget 18 spent` for standard and thorough. Experiment (scratch copy of `skills/`, only `rigor.budgetDelta` set to `{lean:-4, standard:2, thorough:7}`, test files unchanged, 8 test files, 273 tests): 272 pass, 1 fails: `route.test.mjs:148`, `AssertionError: budget 14, 'run' !== 'halt'`. Phase 6 therefore cannot pass: either the implementer edits `route.test.mjs` and breaks gate 6.14 and rows 4.10/5.10 (they require `loops.test.mjs` to be the only existing test file changed), or leaves the test red and breaks 6.9. This is the same class as round 1 F1, and the title of a Progress row is review-immutable once reviewed, so it must be fixed now.
- **Fix**: Add `route.test.mjs:148-165` to the explicit edit list in Phase 4 §3 (or move it to Phase 6 §1): change the expected budgets to `10, 16, 21` (or read them from the policy, as `loops.test.mjs` `budgetOf` does) and keep the "one entry fewer still runs" half. Reword the gate in rows 4.10, 5.10, 6.14 and the "NOT doing" bullet to allow exactly `loops.test.mjs` (one hunk) and `route.test.mjs` (one hunk), for example by comparing the sorted name list to the two files and counting `@@` hunks per file. Re-run the prototype with the full set of policy and behavior changes before finalizing the list.
- **Decision**: PENDING

### F2 — `implement-retry` can halt a legitimate zero-diff phase after three escalating attempts

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: End-State Alignment
- **Location**: Phase 1 §3 (`uncommitted`), Phase 2 §2 (`retryRows`, `retryNext`), `executor-retry.md`, Assumption 4
- **Detail**: Walked through `decide()` and `next()`.
  - Termination holds. A strict failure records `uncommitted`; `retryNext` returns an `implement` step with `retry` ids; a failed retry whose rows are still ticked records `uncommitted` again; `trailingFailures(log, "implement")` counts the retries, `tierFor` adds one tier per failure and `next()` halts at `fails >= 3`. A retry that unticks its rows and does not re-tick them records no `uncommitted` and falls back to plain `implement`. The Phase 4 failure re-plan fires at exactly two trailing failures (e2e fail plus one retry fail) and the retry then continues with the same rows, so the worst case is about 8 steps and a halt.
  - The halt is not only a corner case. `/10x-e2e` itself flips rows for an already-passing spec with evidence and no commit (`10x-e2e/SKILL.md:171`), and `/10x-goal-implement` reports "Phase N had no diff to commit; rows remain SHA-less" (`:209`). The e2e prompt tells the subagent to end `blocked` instead (a neutral fallback, good), but a subagent that ticks anyway sends the run into a retry whose own commit check can never pass, because the work is already done. Each retry runs one tier higher (`opus/high`, `opus/xhigh`) and then the run halts for a human on work that was fine. Assumption 4 calls this "loud, accepted". It is an expensive halt on a legitimate case with no policy escape.
  - What the router can verify: only that a commit with a non-change-folder path exists in `before.head..HEAD`. It cannot see that the rows were set back to `[ ]` first, or that the commit covers the named rows; any commit passes, and a retry that unticks and commits something unrelated is `ok`.
- **Fix A ⭐ Recommended**: Cap the retry at one attempt (`executors.retry.max` 1, counted from the log by template). When that retry fails, do not halt: go on to `impl-review` and list the rows in the `done`/`halt` output and in `report.md` as "ticked without a commit" (same output channel as `manualUnproven`, see F3). Impl-review then judges the code.
  - Strength: A phase that is really done no longer halts the run; the router still never edits `plan.md`.
  - Tradeoff: One more output key and a rule that accepts an unproven tick after one retry.
  - Confidence: MED — follows from the loop above; the output plumbing is the same as F3.
  - Blind spot: Whether impl-review reliably catches a phase that was ticked with no work.
- **Fix B**: Keep three attempts and the halt, but make the retry prompt allow a documented escape: when the phase has no diff to make, end `blocked` with `signals.needsHuman` naming the rows, so the run halts after one retry instead of three.
  - Strength: Smaller change; halts earlier and cheaper.
  - Tradeoff: Every legitimate zero-diff case still stops the run.
  - Confidence: HIGH — uses the existing `needsHuman` path.
  - Blind spot: None significant.
- **Decision**: PENDING

### F3 — `manualUnproven` and the retry's "ticked without commit" list never reach the output

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Phase 5 §2 (`done` return gains `manualUnproven`), Implementation Approach touch points, row 5.15
- **Detail**: The plan adds `manualUnproven` to the object `decide()` returns at `done`, and calls it "one spread". `next()` does not forward `d`: it builds the output by hand, `{ action: "done", reason: d.reason, manualPending: d.manualPending, steps: ran.length }` (`route.mjs:1389-1392`). In an `--archive` run `d` goes to `archiveDone`, which builds `{ action: "done", reason, manualPending, steps }` for `finishRun` (`:1259`) and `summary: { reason, manualPending, steps }` (`:1325`). `finishRun` stores only `manualPending` in `meta.outcome` (`:254`), and `archiveLines` writes only `Manual checks pending` into `report.md` (`:191-201`), the one router file that survives the move. So a ticked-but-unproven row leaves `manualPending` and is listed nowhere the human reads: not in `done`, not in the `archive` summary, not in `report.md`. Row 5.15 ("`done` lists `manualUnproven`") cannot pass without editing `next()`, `archiveDone`, `finishRun` and `archiveLines`, none of which the plan names as touch points; S-10 may edit the same lines. `SKILL.md` ("final message also lists `manualUnproven`") has nothing to print.
- **Fix**: Add the plumbing to the touch-point list: `next()` done object, `archiveDone` (`done` and `summary`), `finishRun` (`meta.outcome.manualUnproven`) and `archiveLines` (a `Manual checks unproven: N` line with the ids), and add an `--archive` case to row 5.15. Use the same key list for the F2 "ticked without a commit" output if Fix A of F2 is taken. Update the `SKILL.md` archive step to repeat the list.
- **Decision**: PENDING

### F4 — The budget test would not fail if a cap were raised

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 6 §1, rows 6.1, 6.18
- **Detail**: Arithmetic re-derived by walking `decide()`, `replanNext` and the pool rules, not copied. Standard (allowance 2): plan loop 6 (plan, review, revise, review, revise, review; a third REVISE halts at `maxPlanRevisions`), then at most pool + 1 = 3 implement-side steps (segment, e2e, plain tail; or e2e, tail, `manual-verify`; or `plan-rejected` at cost 2 costs the same as two segments), then impl-review, fix, impl-review, fix, impl-review = 5 (`maxFixLoops` 2; after `plan-rejected` the shared count leaves one fix, giving the same 14 by the REJECTED path). 14 ✓. Thorough: 3 pre-plan steps plus 7 (RETHINK with `frame-rethink`, or REVISE with `research-revise`) = 10, pool 3 gives 4, plus 5 = 19 ✓. `delta = max + 2 - 14` gives 2 and 7 ✓. A failed `manual-verify` plus its retry fits the same pool (cost counts any outcome).
  The problem is the test. Phase 6 §1 says the test "walks the paths below" and derives `needed = max(steps) + 2 - maxTotalSteps`. Those are scripted walks with a fixed fixture; raising `extraSteps.allowance.standard` to 3 leaves every scripted walk at 14, so `needed` still equals the shipped delta and the test passes. The delta then no longer covers the real longest path, and nothing fails. Round 1 F5 asked for exactly this protection.
- **Fix**: Build one saturating fixture per level (a plan with at least allowance + 2 alternating e2e and goal phases, an eligible Manual row, a REJECTED script) and let the router decide; assert `steps === budget - 2` from the policy at hand. Add a second run with `extraSteps.allowance` raised by 1 through the policy override and assert it exceeds `budget - 2`. Keep the table as documentation.
- **Decision**: PENDING

### F5 — Several gate rows can pass without checking anything

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: about 70 rows of the form `node --test --test-name-pattern "..."`; rows 1.11, 6.3, 6.13, 6.14, 6.15
- **Detail**:
  - `node --test --test-name-pattern "x" file` exits 0 when no test matches. The plan says "the implementer checks the count" (Implementation Approach), which is a human step inside rows meant to be mechanical. A renamed or misspelled test title turns a row green.
  - Rows 6.3, 6.13, 6.14 and 1.11/6.15 diff `merge-base` against `HEAD`, so they read commits only. A frozen test file edited and not yet committed passes `git diff --quiet "$(git merge-base main HEAD)" HEAD -- ...`. Row 6.16 compares the working tree, so the gates disagree.
  - Rows 1.11/6.15 match only single-line `runGit([` and `gitOut([` calls. The archive code calls git through a local `g([...])` helper and `execFileSync`, and a call split over lines or built from a variable passes.
- **Fix**: (a) Add a meta-test in `executors.test.mjs` that reads the `## Progress` commands of the plan, extracts every `--test-name-pattern` and checks that each pattern matches a title in the named file (or add `--test-reporter` output counting to the rows). (b) Drop `HEAD` from the `git diff --quiet` gates so they compare the working tree. (c) State that row 1.11/6.15 is a smoke check, and make the manual row 1.10 name the real list (see O3).
- **Decision**: PENDING

### F6 — `plan-rejected` has no recorded `before.done`, so its row check is undefined

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 4 §2 (last two bullets), Phase 1 §3 (`before` keys)
- **Detail**: Phase 4 says `attachResult` `case "plan"` checks, for `plan-replan` and `plan-rejected`, that `plan.autoPending > 0` and "`before.done` is a subset of the current done ids". It then says "for `plan-replan` entries `before.done` is recorded like for strict templates". Phase 1 records `before.done` only for `strictVerify` templates and `implement-retry`. A `plan-rejected` entry has no `before.done`, so the subset test reads `undefined`: it throws, or passes vacuously, depending on how the implementer writes it. The REJECTED re-plan is the case where it matters most: every Automated row is ticked, and a re-plan that unticks them to get `autoPending > 0` is the cheap way to satisfy the check without adding any work. Row 4.3 tests only the failure re-plan.
- **Fix**: Record `before.done` for both re-plan templates in `next()` and make row 4.3 cover `plan-rejected` too (a re-plan that unticks a ticked row to create pending work is unverified).
- **Decision**: PENDING

### F7 — Evidence check: gaps beyond existence, size and `..`

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 5 §2 (`case "manual-verify"`), Assumption 3
- **Detail**: Checked against the rule text.
  - Absolute path, `..` and Windows separators: rejected, because the token must start with `evidence/` and use `[A-Za-z0-9._-]` segments (a segment `.` or `..` is the case "no `..`" names; a segment `.` still resolves to the directory itself).
  - Symlink: the rule compares the file's `realpath` to "the real path of `context/changes/<id>/evidence`". If `evidence` is itself a symlink to another folder, both sides resolve there and the check passes. Compare against `realpath(changeDir)` plus `/evidence`, and also require `lstat` of `evidence` not to be a link.
  - "Exists, not empty": a directory passes `existsSync` and can have a non-zero size. Require `isFile()`.
  - Freshness: nothing requires the file to be newer than the step (`mtime > startedAt`, the rule every other step uses). A stale file from an earlier run, or one file named by several rows, passes.
  - Content is not read (Assumption 3 admits it). That residual is the owner's decision; the four cheap gaps above are not.
- **Fix**: Add `isFile()`, the pre-resolution `evidence` link check, `mtime > startedAt` and, optionally, one distinct file per ticked row. Add them to row 5.4.
- **Decision**: PENDING

### F8 — Commit evidence edge cases

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 §3 (`commitEvidence`)
- **Detail**:
  - `git merge-base --is-ancestor` exits 1 for "not an ancestor" and 128 for an error (unknown commit after gc or in a shallow clone, not a repository). The plan maps every non-zero exit to `false`. Map 1 to `false` and any other status to `null` (count rule), as it does for a missing git.
  - `git log --name-only --format=@%H` is parsed by a leading `@`. A path that starts with `@` or contains a newline or quote is misread. Use `-z` (and `--format=%x00@%H` or `--format=%H%x00`), as `archiveDone` does with `show -z`.
  - A commit that touches only generated files, lockfiles, snapshots or `context/**` outside the change folder counts as evidence. Not a forgery guard; say so in Assumption 5, or reuse `risk.churn.exclude` to ignore those paths.
  - Detached HEAD, a worktree and a shallow clone with `before.head` present work; no git, or no commit, reads as `null` ✓.
- **Fix**: Handle the exit codes, add `-z`, and name the generated-file case in Assumption 5.
- **Decision**: PENDING

### F9 — Smaller gaps

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phases 1, 2, 5, 6 and the Review Response
- **Detail**:
  - Row 1.10 keeps a title that names `cat-file`, which the design does not use; the note explains it. A future reviewer ticks a false sentence. Reword it (review-immutability applies to reviewed rows, and this one is wrong now) or add the true list to the row text after `—`.
  - Stale references: Phase 6 §4 says "rows 6.13-6.16 and 6.18-6.20" and the Review Response says "6.20 added"; only 6.18 exists. Row 2.5 says "once the cap is reached" (it is a pool now).
  - `executorNext` returns a `skill` and `next()` stores `d.skill ?? policy.steps[d.step].skill`, but `executors.e2e`, `executors.tdd` and the retry have no `skill` key in the policy shape, so the log would show `10x-goal-implement` for an e2e step.
  - The README baseline note (`extraSteps.allowance` all 0) disables the metered features only. The failure re-plan, the strict check, the retry and the fallback are not metered, so a "routing-only" baseline still runs them. Add `codeReplan.afterFailures: 0` to the note, or say which features remain.
  - The `humanWords` and `browserWords` lists match by word prefix (`goalPhrase`): `dom` matches "domain", `page` matches "pages", `person` matches "personal". Use whole-word matching for short words.
  - No gate covers `context/archive/` or `context/foundation/roadmap.md` on the implementation branch (round 1 F6 class). One `git diff --quiet "$(git merge-base main HEAD)" -- context/archive context/foundation/roadmap.md` row would do. The close-out archive step belongs after the last Progress row.
  - The `manual-verify` command list includes `sh`, `bash`, `python` and `curl`: the subagent runs backticked text from `plan.md`. Same trust domain as the plan author; say so.
- **Fix**: One edit pass over the items above.
- **Decision**: PENDING
