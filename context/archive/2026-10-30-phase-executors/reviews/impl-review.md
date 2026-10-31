<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Per-phase executor routing and automated manual checks in the 10x pipeline

- **Plan**: context/changes/phase-executors/plan.md
- **Scope**: Full plan (Phases 1-6 of 6)
- **Reviewed phases**: 1, 2, 3, 4, 5, 6
- **Date**: 2026-10-31
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 6 observations

Reviewed range: `f246cdf` (merge-base with `main`) to `26ea60b` (`phase-executors-impl-3`). Phase commits: P1 `b3befe0`, P2 `f5c881a`, P3 `f6b9247`, P4 `5a7f874`, P5 `d693d2c`, P6 `dd9dacb`, plus the docs commits that record progress.

## Evidence gathered

- Full suite `node --test skills/10x-pipeline/test/*.test.mjs`: 393 tests, 391 pass, 0 fail, 2 skipped (Node v24.19.0; Node 18 is not installed here, so the Node 18 claim rests on a grep of the ban list, which found nothing in `route.mjs` or the tests).
- `route.mjs` diff against `f246cdf`: about 550 changed lines, all additive helpers placed near their callers plus small edits in `decide()`, `next()`, `tierFor`, `archiveDone`, `finishRun`, `buildReport` (row template and `const result` only), `readSide`, `status` and `init`. The S-10 touch points (`cleanSignals`, `cleanUsage`, `prompts.suffix`, the tail of `buildReport`, the tail of `attachResult`) are unchanged.
- Git use in the router: `rev-parse`, `merge-base --is-ancestor` and `log -z` only. No write, no `-c`, no `--no-verify`, no `gh`. No npm dependency was added. `run.jsonl` and `meta.json` stay router-owned. `context/archive/` is untouched.
- Existing tests: `loops-existing.test.mjs`, `compare.test.mjs`, `helpers.mjs` and `baseline-policy.json` are byte-identical to `main`. Only two existing test files changed: `loops.test.mjs` (one hunk, the REJECTED block, now expects `plan-rejected`) and `route.test.mjs` (the budget test title and numbers). Both are named in the plan.
- Scratch experiments with the real router and the test helpers (scripts under the session scratchpad, nothing written to the repo): the e2e Skip flip in a git repo, a retry without a commit, a retry whose recorded head cannot be resolved, a repo with no commit, `--chrome` parsing and resume, and seven manual-verify forgery attempts.
- Mutation run: 42 hand-made mutations of `route.mjs` and `policy.json` (commit evidence, uncommitted ids, retry and fallback rules, evidence-file checks, manual eligibility, `--chrome`, re-plan caps and order, pool and budget numbers, interactive floor), each run against the relevant new test files. 37 were killed, 1 did not apply (a wrong search string on my side) and 4 survived: the outside-change-folder test in `commitEvidence`, the evidence directory-symlink test, the manual-verify special case in `extrasLeft`, and the allowance guard in the executor choice. Reading the code shows three of the four are equivalent or redundant under the default policy; the fourth is a real test gap (F9).
- Budgets: the reference-path walker in `budget-executors.test.mjs` confirms longest legal paths of 14 (standard) and 19 (thorough) against budgets 16 and 21 (`maxTotalSteps` + delta - 2 headroom). By hand, the flip-then-retry chains reach 15 and 20, still within budget, so the limit stays meaningful. Lean stays at 10.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

## Judgement on the points the requester flagged

1. **Retry with a null commit check counts as ok if its rows are ticked again.** Real deviation from the plan text, which would have fallen back to the count rule. In normal use `commitEvidence` returns null only when git cannot resolve the old head, so the exposure is small, but it is the one path where a Skip flip passes silently and without the `impl-review-warn` template. See F2.
2. **Failed `plan-replan` halt placed before the pending-row branch of `decide()`.** Acceptable. It is the only placement where the halt can fire when pending rows exist, it matches the other halts (a resume repeats the halt while the failed entry is last), and the tests pin it (mutation "halt failed replan removed" is covered). One side effect is noted in F6.
3. **Test changes and mutation checks.** The two edited existing tests are minimal and traceable to the plan. The `policy: { codeReplan: { max: 0 } }` edit in the new `executors.test.mjs` "retry once then warn" test is honest: with the re-plan enabled the retry never gets its turn at two trailing failures. Mutation results are listed above.
4. **Manual-verify forgeability and `--chrome`.** Evidence checks hold against a human-word row, a symlink out of the folder, a backdated file and a browser row without `--chrome`. `--chrome` stores, resumes, clears with `false` and rejects a bad value. Two gaps: F1 (a retitled tick is lost without a trace) and the disclosed residual trust that a hardlinked `plan.md` passes as evidence (the content is never read).
5. **Budgets 10/16/21 from the longest legal path.** Sound and tested; see Evidence. The docs say "lean unchanged", but lean can rise to standard after one failed step and then gets pool 2 and budget 16 (F7).
6. **Docs honesty.** README, ADR-003 and SKILL.md agree with the code on templates, caps, budgets and fallbacks. They state that no live `/10x-e2e`, `/10x-tdd` or Chrome run was done. Two claims are slightly too strong (F1 and F7), and the notes in `report.md` exist only in `--archive` runs, which the docs say.
7. **Gate rows.** `gateCheck` returns the integer 0/1 and the meta-test runs the real command line (round-3 W2 met). The git-diff gates fail on a missing hunk (`h<1`, round-3 O1 met). The `git log -z` parse uses `^\0?\n?` (round-3 W1 met). Gate 5.10 cannot pass if run after Phase 6 because `route.test.mjs` is then legitimately changed; the plan discloses it and 6.14 supersedes it (F8).

## Findings

### F1 — A manual-verify tick with a mangled title is lost without a trace

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: skills/10x-pipeline/scripts/route.mjs:1415
- **Detail**: In `verifyManual`, a Manual row whose text no longer matches its baseline once the evidence suffix is stripped (`withoutEvidence(r.text) !== withoutEvidence(b.text)`) sets `intact = false` and `continue`s, so the row id never reaches `unproven`. Reproduced with a tick written as `... - evidence: evidence/a.txt` (hyphen instead of the em dash the prompt shows). The step becomes a neutral fallback, the row is ticked in `plan.md`, yet it is in neither `manualPending` nor `manualUnproven`, no retry is eligible, and the final `done` output has no `manualUnproven` key. README and ADR-003 say a tick without valid evidence is listed as `manualUnproven`. A subagent writing "-" or "--" for the dash is plausible. Effect: a human reading the closing checklist misses a row that was ticked but not proven.
- **Fix**: In the retitled branch, add the id to `unproven` when `r.done && !b.done` (the row was ticked), then `continue`. Add a test beside the forgery cases in `manualverify.test.mjs`.
- **Decision**: Fix (a06a039): a newly ticked Manual row whose title no longer matches (hyphen, two hyphens, en dash, no space, no path, empty path, path with a space) is added to `unproven` in `verifyManual`, so it reaches `manualUnproven` and the retry. The bug was reproduced first; the new test "mangled evidence suffix is unproven" fails when the added line is removed (scratch-copy mutation). An unticked row with an edited title stays out of `unproven`.

### F2 — A retry whose commit check cannot run lets a Skip flip pass silently

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: skills/10x-pipeline/scripts/route.mjs:1122
- **Detail**: Implementation Notes record the deviation: when `commitEvidence` returns null on a retry, the step counts as ok if the retry rows are ticked again. Experiment B (recorded head replaced by an unknown SHA) gave `ok true, verified true`, no fallback, no `impl-review-warn`. The plan text applied the count rule, which would fail a retry that flipped its rows again. Experiment C (git repo with zero commits): `before.head` is null, the strict check degrades to the count rule, and an e2e Skip flip passes `ok true`. The docs say "without git the count rule applies" but not "without a first commit". Both cases are rare (history pruned, brand-new repo), but they are exactly where the strict check exists to protect.
- **Fix**: In `verifyImplement`, treat a null check on a retry as unproven: `fallback = true` and return `false` (same as the missing-commit retry), and say in the README that a repo with no commit has no strict check.
  - Strength: Keeps the "no silent pass" property of the feature.
  - Tradeoff: A no-git project gets one warning per retry; the retry already ran in that case.
  - Confidence: MED — null also covers "git not installed", where a warning on every retry may be noisy.
  - Blind spot: Behavior of a shallow clone was not tried.
- **Decision**: Fix (2a7099d): a retry whose `commitEvidence` is null (no git, no commit yet, unresolvable head) is no longer ok. It records its ticked rows as `uncommitted` plus `evidenceUnavailable`, is a neutral fallback when it ends `done` or `blocked` (a `failed` retry still counts), and the impl-review-warn prompt gains the note "Commit evidence was unavailable". Not made a failure, so a project without git never false-fails; the first strict step without git keeps the count rule (README and ADR-003 now say so, including the repository with no commit). Test "retry without commit evidence warns" covers no repository, a repository with no commit and an unknown head; five scratch-copy mutants (old rule restored, no flag, no fallback, no `uncommitted`, always-true note) turn the suite red.

### F3 — Manual Progress rows are unchecked; live executor behavior was never run

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Success Criteria
- **Location**: context/changes/phase-executors/plan.md:675, 705, 725, 748, 774, 775, 776, 805, 806
- **Detail**: Rows 1.10, 2.12, 3.10, 4.11, 5.11, 5.12, 5.13, 6.11 and 6.12 are `[ ]`. Three of them (2.12, 3.10, 5.11-5.13, 6.12) need a live `/10x-e2e`, `/10x-tdd`, Chrome extension or full pipeline run, so nothing shows that the executor prompts make a subagent stop after its phase, avoid "Skip", or that `--chrome` loads the Chrome tools. The README states this honestly. Rows 1.10, 4.11 and 6.11 are reading tasks that this review partly covers (git use is limited to the three read commands; the re-plan prompts contain no question a subagent cannot answer; ADR-003, SKILL.md and README agree), but a human still has to tick them. None of these may be treated as passed.
- **Fix**: Keep the rows pending and run 2.12, 3.10, 5.11-5.13 and 6.12 once before the change is archived. Tick 1.10, 4.11 and 6.11 after reading this review.
- **Decision**: Skip: the nine Manual rows (1.10, 2.12, 3.10, 4.11, 5.11, 5.12, 5.13, 6.11, 6.12) need live `/10x-e2e`, `/10x-tdd`, Chrome or full pipeline runs, or a human reading. They stay unticked and untouched; nothing was run live in this fix pass. Left for a human before the change is archived.

### F4 — The commit check is per step, not per row, and any outside commit passes

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: skills/10x-pipeline/scripts/route.mjs:1083
- **Detail**: `commitEvidence` counts one commit that touches a path outside `context/changes/<id>/` and outside the churn exclude globs. One unrelated commit made during the step covers every flipped row, and a subagent that commits real work for row 1.1 and flips row 1.2 passes. The plan names this as residual trust (round 3, O5a) and the docs say the check is per step. The mutation run covers the individual conditions of the check.
- **Fix**: None needed now; revisit if a flip is seen in a real run.
- **Decision**: Record (facec76): not changed. README, SKILL.md and ADR-003 now state in one sentence that the commit check is per step, not per row, and that one counted commit covers every row the step ticked. Revisit if a flip is seen in a real run.

### F5 — The manual-verify prompt has no rule for commands that never end

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: skills/10x-pipeline/prompts/manual-verify.md
- **Detail**: The step runs backticked commands from plan text (sh, bash, python, curl allowed; round-3 O5). A Manual row such as `npm run dev` would hang the subagent. Nothing tells it to bound or background a long command, and the router sets no timeout. A hang costs one step and is bounded by the host, not by the router.
- **Fix**: Add one rule to the prompt: run only commands that end by themselves, with a timeout; otherwise leave the row pending.
- **Decision**: Fix (fe297a9): `manual-verify.md` has one more rule: a command that never ends by itself or waits for input (dev server, watcher, prompt) is not run and its row stays `[ ]` (GIVEN/WHEN/THEN, one bold `MUST NOT`). The prompt test checks the rule in both templates; the rules test stays green. The router still sets no timeout, as the review says.

### F6 — A failure re-plan can take the turn of the retry and a failed re-plan halts

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: skills/10x-pipeline/scripts/route.mjs:735
- **Detail**: The failure re-plan fires at exactly two trailing implement failures and costs nothing from the pool. When those two failures left rows flip-ticked, the re-plan comes before the one retry, and the `plan-replan` prompt forbids unticking the rows. If the re-plan fails, the run halts for a human in a case where the retry would have fitted. This follows the plan's order (re-plan at the second failure) and the halt is consistent with the other halts, so it is a note, not a defect.
- **Fix**: None; mention the order in the ADR if a real run shows it matters.
- **Decision**: Record (facec76): not changed. ADR-003 (Code re-plans) now says the failure re-plan can take the turn of the one `implement-retry`, and that a failed re-plan then halts. It follows the plan's order. Also noted in the plan's Fix pass.

### F7 — The docs say "lean unchanged" but lean can rise and gain the pool

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: README.md (budget and limits notes), docs/ADR/ADR-003 (new section)
- **Detail**: A lean run has pool 0 and budget 10. Rigor only rises: one failed step lifts lean to standard, which gives pool 2 and budget 16 (round-3 O5d). The docs state that lean behavior is unchanged without saying that a raised level changes it mid-run. The code is correct; the sentence is too short.
- **Fix**: Add "until the level rises" to the lean sentence in the README and the ADR.
- **Decision**: Fix (facec76): the sentences "`lean` is unchanged" (README, ADR-003 budget text and table) and "`lean` runs no executor" (ADR-003 assumption 7) now say that lean keeps its path and budget until a failure raises the rigor to `standard`, after which the pool of 2 and the budget of 16 apply. SKILL.md and AGENTS.md held no such claim. The immutable titles of plan rows 2.16 and 6.18 are not changed.

### F8 — Gate row 5.10 fails when re-run after Phase 6; `gateCheck` is loose on titles

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/changes/phase-executors/plan.md:763; skills/10x-pipeline/test/phase-helpers.mjs:43
- **Detail**: Rows 4.10 and 5.10 hard-code a changed-file set of `loops.test.mjs` only, so they fail once Phase 6 edits `route.test.mjs`. The plan and Implementation Notes disclose this and 6.14 supersedes both. Separately, `gateCheck`'s title regex also matches `test.skip` and `test.todo` titles and accepts a pattern that is a substring of a longer title, so a gate row can be satisfied by a skipped test. Neither affects the router.
- **Fix**: No change for the first point. For the second, drop `skip` and `todo` from `TITLE_RE` if the gate is reused.
- **Decision**: Record: gate 5.10 (and 4.10) fails if re-run after Phase 6, because `route.test.mjs` is then legitimately changed; it passed at Phase 5 and row 6.14 covers the final state. A note was added under row 5.10 in `plan.md` (title unchanged). Not fixed: `gateCheck` title matching of `test.skip`/`test.todo` and substring patterns is left as is, since no gate row relies on it and `phase-helpers.mjs` is shared by the pattern rows; revisit if the gate is reused.

### F9 — Pool charge for a `--chrome` manual-verify step is untested

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: skills/10x-pipeline/scripts/route.mjs:1168
- **Detail**: `extrasLeft` charges a manual-verify entry by its step name because a `--chrome` entry carries the template `manual-verify-chrome`, which has no `extraSteps.cost` key. Removing that special case leaves every test green (mutation survived), so a `--chrome` run could use the pool for free without a test noticing. The `maxAttempts` cap still bounds the step, so the effect is a budget leak, not a loop. The other three survivors are equivalent or redundant under the default policy: `context/**` is already in the exclude globs, so the `startsWith(prefix)` test in `commitEvidence` adds nothing there (it only matters if a project override removes `context/**`); the realpath containment test covers the evidence directory symlink; and the lean allowance guard is repeated by the `extrasLeft` check.
- **Fix**: Add a case to `budget-executors.test.mjs` that logs a `manual-verify-chrome` entry and asserts the pool drops by the manual-verify cost.
- **Decision**: Fix (c72ff98): the new test "chrome step draws from the pool" seeds a failed `manual-verify-chrome` entry (and a `manual-verify` one as control) with a pool of 1 and of 2; the retry runs only with room. Replacing the step-name charge by the template name in a scratch copy turns it red.
