<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Worktree Isolation, Per-Step Commits, opus/medium Tier and Cheaper First Implement Attempts

- **Plan**: context/changes/worktree-step-commits/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4, 5, 6
- **Date**: 2026-11-04
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 5 warnings, 5 observations

Verdict and counts are as measured on `93a60e4` (`main..HEAD`, commits 4d8950c to 93a60e4), before the fixes of this review. The fixes with a clear fix are in `8bf6989`; the four owner decisions (F1, F3, F9, F10) are in `fix(worktree-step-commits): keep interactive escalation, run token in side ref, startSha halt, net cheap drop`.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Success criteria

- Automated, on `93a60e4`: full suite `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` 621 tests, 619 pass, 0 fail, 2 skipped (the `GH_LIVE` live tests). `node tools/version-check.mjs` OK (0.4.0), `node tools/commit-lint.mjs main..HEAD` OK, `grep -n "refs/agent-smith"` hits AGENTS.md (1), README.md (1), ADR-010 (2). `git diff --numstat 62ada19 -- skills/10x-pipeline/test/loops-existing.test.mjs` is `2 2`, and the file is unchanged since 4d8950c. The phase tests (ladder, compare, provenance, isolation, rules, skill-loop, stepcommit, archive, executors, rollback, codereplan, loops-existing, firstattempt, score, budget-executors, route) are part of the green suite.
- Automated, after `8bf6989`: full suite 624 tests, 622 pass, 0 fail, 2 skipped. Version check and commit lint OK. The three new tests fail on the pre-fix router (deliberate-break check).
- Automated, after the owner decisions: full suite 631 tests, 629 pass, 0 fail, 2 skipped. Version check and commit lint OK; `loops-existing.test.mjs` unchanged since 4d8950c. The six new tests (three ladder rows, the run-token ref, the startSha halt, the cancelled drop) fail on the router of `8bf6989` (deliberate-break check).
- Manual: rows 1.4, 2.5, 3.5, 4.4, 5.5 and 6.4 are unticked and pending. None is ticked without evidence.

## Findings

### F1 — Interactive steps stop escalating between their second and third attempt

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Plan Adherence
- **Location**: skills/10x-pipeline/scripts/route.mjs:1837-1846 (`settle`, rung check), skills/10x-pipeline/policy.json ladder; skills/10x-pipeline/test/score.test.mjs:816-817
- **Detail**: The plan says that the Overview table of Phase 1 lists the changed paths. One family is missing. An interactive step at `standard` or `thorough` that starts at index 3 (`impl-review`, `research`, `domain-brief`, a plain-goal first plan) escalates 3 → 5 → 5 over three attempts: `sonnet/high`, `opus/high`, `opus/high`. Before this change it went `sonnet/high`, `opus/high`, `opus/xhigh`. The reason is that +1 lands on `opus/medium` (4), which the floor skips to 5, and +2 lands on 5 directly. The same holds one rung up: the 3-5 phase `impl-review` and its retry both run `opus/high`, and so do a plain-goal first plan with a score up shift and its retry (score.test.mjs keeps `retry.tier, 5`, but `effective` went from 1 to 0). The third attempt of such a step now runs one effort level lower than before. Neither the Overview table, `ladder.test.mjs`, README nor ADR-010 says so.
- **Fix A ⭐ Recommended**: Count failure bumps (and up shifts) for interactive steps in rungs the floor allows, so each failed attempt moves to the next rung that is at or above the floor.
  - Strength: Keeps "each failed attempt = +1" for interactive steps, and keeps the pre-change route 3 → 5 → 6.
  - Tradeoff: A second measure of tier distance next to the index math; `scoreShift.effective` and `tierWhy` notes change again, and so do the tests that pin them.
  - Confidence: MED — the math is local to `tierFor`, but it touches the floor, the clamp and the score shift together.
  - Blind spot: Interaction with `maxTier` 6 of `impl-review` and with the `lean` level, where `opus/medium` is allowed.
- **Fix B**: Accept the route, document it in the Phase 1 table, README and ADR-010, and add ladder rows that pin it.
  - Strength: No router change; matches the cost goal (fewer `opus/xhigh` tokens).
  - Tradeoff: A step that failed twice gets no more effort for its last attempt.
  - Confidence: HIGH — documentation only.
  - Blind spot: No failure data shows how often a third attempt happens (0 failed steps in 34 archived).
- **Decision**: APPLIED — owner decision (Fix A: keep escalating). Each failed attempt of an interactive step moves it to the next rung that clears its effort floor, so the base-3 route is 3 → 5 → 6 again. Tests: `ladder.test.mjs` "reaches opus/xhigh" and "climbs sonnet/high, opus/high, opus/xhigh" rows, `score.test.mjs` retry tier 6 with `effective` 1, `preplan.test.mjs` third research attempt tier 6. Docs: README effort-floor bullet, SKILL.md, ADR-010, plan.md Phase 1 table.
  - Commit: `fix(worktree-step-commits): keep interactive escalation, run token in side ref, startSha halt, net cheap drop`.

### F2 — `isolation.rollback.ref` could name a shared branch ref

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: skills/10x-pipeline/scripts/route.mjs:2406-2407 (`rollback`)
- **Detail**: The rendered ref was checked only with `startsWith("refs/")`. An override such as `refs/heads/main` passed, and `git update-ref` run from the run worktree moved `main` to the snapshot commit. This was confirmed in a scratch worktree. `refs/heads/*` is shared by every worktree, so this breaks the AGENTS.md rule that the router writes no refs outside its own namespace.
- **Fix**: Require the prefix `refs/agent-smith/`, halt before any git write otherwise, and say so in README.
- **Decision**: APPLIED — 8bf6989 (test "4.1 a rollback ref outside refs/agent-smith/ halts before any git write").

### F3 — Side-ref names collide across runs of the same change id

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: skills/10x-pipeline/scripts/route.mjs:2419 (`update-ref` without an old value), skills/10x-pipeline/policy.json `isolation.rollback.ref`
- **Detail**: `refs/agent-smith/{id}/failed-{n}` is shared by every worktree of the repository, but `n` is unique only within one run. Several cases overwrite another run's snapshot without a word:
  - The README baseline procedure (`agent-smith/<id>-baseline`) and both scorer A/B arms run the same change id in one repository. A failed step `n` in one arm overwrites the other arm's ref, including a `kept` ref its report points a human to.
  - A re-run of a change id after its branch was deleted overwrites the old run's refs.
  - A `reset --hard` that fails after `update-ref` leaves the entry without `rolledBack`, so the resume snapshots the half-reset tree over the original.

  `refs/agent-smith/*` has no reflog by default, so an overwritten snapshot is left dangling and gc removes it later. The plan accepts the overwrite only for "an earlier attempt" of the same step.
- **Fix**: Make the ref unique per run, for example with a `{branch}` placeholder or the short `meta.startCommit`, and create it with `git update-ref <ref> <new> ""`, which fails when the ref already exists. On a resume whose entry already has a ref, reuse it instead of taking a new snapshot.
  - Strength: No snapshot can be lost to another run.
  - Tradeoff: Changes the documented ref name in AGENTS.md, README, ADR-010, SKILL.md and the tests; a policy key changes shape.
  - Confidence: MED — straightforward git, but the name is part of the documented contract.
  - Blind spot: How the owner wants baseline arms named (one id or two).
- **Decision**: APPLIED — owner decision. The side ref is `refs/agent-smith/<id>/<run>/failed-<n>`; `{run}` is the first 12 hex characters of `meta.startCommit`, or of the first step's `startSha` when the start commit was empty. Default in `policy.json`, AGENTS.md Hard Rule 3, README, ADR-010 and the tests updated; test "4.1 the side ref carries the run token". The create-only `update-ref <ref> <new> ""` guard and the reuse of a ref left by an interrupted rollback (the third bullet) were not added: the owner asked for the run token only.
  - Commit: `fix(worktree-step-commits): keep interactive escalation, run token in side ref, startSha halt, net cheap drop`.

### F4 — The undo on halt was skipped on a `Router error:` after the rollback

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: skills/10x-pipeline/scripts/route.mjs:2598-2611 (`next`), :3176-3181 (`main` catch)
- **Detail**: The plan says that when the `next` call that rolled back ends in a halt, the reset is undone first. `end()` covered the needs-human, budget, skip-loop, `decide` and attempt-cap halts. An exception later in the call reached `main`'s catch, which halted without the undo. The worktree stayed reset and the entry said `rolledBack`, not `kept`. This was confirmed with a malformed `complexity` block that makes `tierFor` throw. The `archiveDone` halts also bypass `end()`. No path reaches `done` right after a rolled-back failure (`decide` retries a failed step), so that part stays as it is.
- **Fix**: Register the undo after the rollback and run it in `main`'s catch, then append the outcome to the `Router error:` reason.
- **Decision**: APPLIED — 8bf6989 (test "4.1 a router error after the rollback undoes it: partial edits back, entry kept"). The `archiveDone` halt paths are unchanged, because they are unreachable after a rollback.

### F5 — The rollback set file times before it wrote the router state back

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: skills/10x-pipeline/scripts/route.mjs:2419-2422 (`rollback`)
- **Detail**: After `git reset --hard <startSha>`, `run.jsonl` and `meta.json` on disk are their startSha versions. The code called `setTimes` before `writeState`. A throwing `fs.utimesSync` (EPERM) reached the catch before the state was written back. The failed entry was then lost from the log, and so was the previous entry's `commit` key, so the resume committed again under the previous step's name. `undoRollback` already used the safe order.
- **Fix**: Write the state back straight after the reset, then set the times.
- **Decision**: APPLIED — 8bf6989.

### F6 — README opt-out text was wrong for a run that started isolated

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: README.md:60 ("Run isolation", opt-out bullet)
- **Detail**: README said `isolation.require: false` gives "no start or step commit, no rollback and no cheaper first attempt". `stepCommit`, `rollback` and `firstAttemptDrop` read `meta.isolated`, which persists. A run that started isolated therefore keeps committing and rolling back after the project opts out. The plan ("a run is isolated from its first step or not at all") makes this intended, but the README did not say it.
- **Fix**: Say that the opt-out acts on runs that start after it, and that a run started isolated should be finished first.
- **Decision**: APPLIED — 8bf6989.

### F7 — A cheap fallback used no step budget

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: skills/10x-pipeline/scripts/route.mjs:528 (`budgetSteps`)
- **Detail**: `budgetSteps` exempted `e.cheap && e.ok === false`, which also matches a cheap fallback (a blocked tdd or e2e step). The drop guard uses `isFailure`, which ignores fallbacks, so several cheap fallbacks could use no budget. That breaks "a run has at most one such entry". With the shipped policy the floor absorbs the drop on tdd and e2e at `standard` and `thorough`, so only an override reaches this.
- **Fix**: Exempt `e.cheap && isFailure(e)` only.
- **Decision**: APPLIED — 8bf6989 (test "5.1 a cheap fallback is no failure: it uses step budget").

### F8 — A failed undo leaves the branch on the snapshot commit without saying so

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: skills/10x-pipeline/scripts/route.mjs:2438-2445 (`undoRollback`)
- **Detail**: When `git reset --hard <ref>` succeeds and `git reset -q <ref>^` fails, the run branch stays on the snapshot commit. Its subject, "agent-smith: failed step …", is not a Conventional Commit, and the next step's `startSha` would be that commit. The halt message did not say that the branch moved.
- **Fix**: Name the snapshot commit and the manual `git reset -q <ref>^` in the message.
- **Decision**: APPLIED — 8bf6989.

### F9 — `startSha` is read without the git timeout and fails silently

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: skills/10x-pipeline/scripts/route.mjs:2710-2716 (`next`, entry creation)
- **Detail**: `startSha` comes from `gitOut(["rev-parse", "HEAD"])`, which has no `isolation.gitTimeoutMs`. A failure is not reported. An entry without `startSha` is never rolled back, so its partial edits go into the next successful step's commit under that step's name.
- **Fix**: In an isolated run, read HEAD with `runGit` and the timeout, and halt (or log a note) when it cannot be read.
  - Strength: The rollback guarantee holds or the run says why it does not.
  - Tradeoff: A halt changes the fixture semantics of `firstattempt.test.mjs`, whose isolated fixtures run without git on purpose. A note keeps them, but the run goes on unprotected.
  - Confidence: MED — needs a choice between halt and note.
  - Blind spot: How often HEAD is unreadable in a real worktree (likely never).
- **Decision**: APPLIED — owner decision (halt). `startSha` is read with `runGit` and `isolation.gitTimeoutMs`; when it cannot be read the isolated run halts before the step is logged and names the cause. The isolated `firstattempt.test.mjs` fixtures now run in a real linked worktree with hermetic git; test "4.1 an isolated run that cannot read the start commit of a step halts before logging it".
  - Commit: `fix(worktree-step-commits): keep interactive escalation, run token in side ref, startSha halt, net cheap drop`.

### F10 — The first-attempt drop and the neutral cheap failure interact with other rules in ways the docs do not state

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: skills/10x-pipeline/scripts/route.mjs:1851-1862 (`tierFor`), :914 (`struggled`)
- **Detail**: Three interactions:
  - The drop goes in after an execution-sum score up shift. A shift of +1 and a drop of -1 cancel, so the attempt runs at the base tier and is still marked `cheap`. Its failure then costs no rigor and no budget, although the step ran at full tier.
  - A cheap failure still counts as `struggled` (:914), which bumps the implementation review one tier.
  - A cheap failure also withholds the simple-change discount and blocks the score down shift for the rest of the run (`log.some(isFailure)`).

  The plan scopes the neutral treatment to rigor and budget only, so these may be intended, but README and ADR-010 do not say so.
- **Fix**: Either measure `cheap` against the tier without the drop but with the shift (no `cheap` when the net move is 0), or document all three interactions in README "First attempt" and ADR-010.
  - Strength: Either way the A/B of the drop reads clean data.
  - Tradeoff: The first option changes the `cheap` rule the plan fixed; the second leaves the behavior as is.
  - Confidence: MED — a design point.
  - Blind spot: How often a +1 execution shift meets a first implement attempt.
- **Decision**: APPLIED — owner decision. `cheap` is set only when the net drop survives the score shift, the clamp and the floor; a cancelled drop reads `-1 first attempt not applied (cancelled by the score shift)`. The `struggled` bump, the withheld simple-change discount and the blocked score down shift are documented as intended in README and ADR-010. Test "5.1 an up shift that cancels the drop sets no cheap flag and names the score shift".
  - Commit: `fix(worktree-step-commits): keep interactive escalation, run token in side ref, startSha halt, net cheap drop`.

## Assumptions

- The review covers every phase, because all Automated Progress rows are ticked. The Manual rows stay unticked, as instructed.
- No `context/foundation/lessons.md` exists, so the review used no lesson priors.
- F2, F4, F5, F6, F7 and F8 have one clear fix, consistent with the plan and AGENTS.md, so they were applied without a human. F1, F3, F9 and F10 change documented contracts or routing policy; they stayed PENDING until the owner decided them, and were then applied.
- F1 reading: a failure bump of an interactive step counts only rungs at or above its index floor whose own effort clears the floor; a below-floor rung it starts on or passes is skipped for free. On a ladder ordered by effort this equals the old index math. `plan-review` (base 2, below the floor) keeps 3, 3, 5, its route on the 7-rung ladder, because its first failure only reaches the rung the floor already gave it.
- F3 token: 12 hex characters, from `meta.startCommit`, else the first step's `startSha` (HEAD at init), else the failed step's own `startSha`. Two runs of one id share a token only when both have an empty start commit and start from the same HEAD.
- F9 message: `Cannot read the start commit of step <n> (<step>) of an isolated run: <cause>. Fix git in the run worktree, then run next again.`
- The `archiveDone` halt paths after a rollback (part of F4) were left unchanged, because `decide` never returns `done` right after a failed step.
- The plan's test item "a tdd step at thorough whose drop the floor absorbed ... its failure counts for rigor" is checked only for the clamp-absorbed case (`firstattempt.test.mjs`, the lean case). At `thorough` the level cannot rise, so it is not observable there. This was not raised as a finding.
- Setting `meta.startCommit` when the commit exists but a post-commit check fails differs from the plan text ("on a git failure the key stays absent"). It avoids a second commit and matches the archive path ("the commit exists and the router does not undo it"), so it was not raised as a finding.
- The review file and the `change.md` stamp were left uncommitted after `8bf6989`, and are committed with the owner-decision fixes.
