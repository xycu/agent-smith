<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Worktree Isolation, Per-Step Commits, opus/medium Tier and Cheaper First Implement Attempts

- **Plan**: context/changes/worktree-step-commits/plan.md
- **Mode**: Deep (codebase and git behaviour checked inline; no sub-agent)
- **Date**: 2026-11-04
- **Round**: 4 (re-review after the third `plan-revise`, which added the start commit guard, file-time restore, the no-copy resume, the nested project root, the PR comment path and the archive commit test)
- **Verdict**: REVISE
- **Findings**: 1 critical, 2 warnings, 3 observations

Verdict note: the round 3 fixes hold (start commit before the first entry under the `meta.startCommit` guard, absolute `--git-dir`/`--git-common-dir` comparison). One new FAIL in End-State Alignment: the documented opt-out (`isolation.require: false`, non-git projects) is honoured by the router but not by the orchestrator's Start, which always builds a worktree. The fix is one paragraph in Phase 2 §3 and keeps the approach and phase order, so the verdict is REVISE, not RETHINK. Verdict and counts are as measured before the edits below.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | FAIL |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

7/7 paths ✓ (`policy.json`, `baseline-policy.json`, `route.mjs`, `SKILL.md`, `README.md`, `test/loops-existing.test.mjs`, `scripts/pr-comment.mjs`), 9/9 symbols ✓ (`ROOT` :23, `attachResult` :434 with `fs.rmSync(p.result)` :443, `isFailure`/`budgetSteps` :503-506, `decide` mtime fallbacks :827-829 and :884-886, `commitEvidence` :1342, `verifyImplement` :1372, `tierFor` :1779 with `saved` :1833, `archiveDone` resume test :2126-2128, `init` baseSha :2794-2798), literals ✓ (`loops-existing.test.mjs:46` = 6, `:69` = 5), policy pins ✓ (`plan` 4/2/6, `frame` 4/4/4, `firstPlan.bump` `{plain:-1,hard:0}`), doc lines ✓ (`SKILL.md:107`, `:128`, `README.md:35`), `.gitignore` holds `.claude/worktrees/` ✓, brief↔plan ✓. Progress↔Phase consistency ✓ (6 phases, every Success Criteria bullet has a row, no checkboxes outside Progress).

## Findings

### F1 — The orchestrator builds a worktree even when the project opts out or has no git

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: End-State Alignment
- **Location**: Phase 2 §3 (Orchestrator start), Implementation Approach, Migration Notes
- **Detail**: Implementation Approach promises that "an override with `isolation.require: false` (used by `writeOverride` for existing tests and by non-git projects) keeps today's behaviour exactly", and Migration Notes tell users to set it "to keep the old behaviour". The router honours it, but Phase 2 §3 runs its four cases whenever the shell is not in an `agent-smith/` worktree; only an in-flight run (case 1) skips the worktree. A new run with `require: false` lands in case 2: the orchestrator creates a branch and worktree and runs `init` there, the router leaves `meta.isolated` absent, so no step commits, no rollback and no worktree prompt line, while the session's subagents still default to the main checkout. A non-git project fails at `git rev-parse --show-prefix` / `git worktree add` with no instruction for the orchestrator. The opt-out is therefore not backed by a phase.
- **Fix**: Add an opt-out before the four cases: when `git -C "<root>" rev-parse --is-inside-work-tree` does not print `true`, or the project override sets `isolation.require` to a value other than `true`, create nothing and run `init` in `<root>` as today; the router's "not a git work tree" halt names the override for a non-git project with `require` on.
- **Decision**: APPLIED — Desired End State (orchestrator bullet), Phase 2 §1 Contract (not-a-git-work-tree halt names the override), Phase 2 §3 Intent (opt-out paragraph before the cases) and Contract (opt-out runs no `git worktree` and no `cp`), Phase 6 §2 Intent (README lists the opt-out); `plan-brief.md` Key Decisions (Worktree creator row).

### F2 — The run silently loses uncommitted project inputs of the main checkout

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: What We're NOT Doing (uncommitted changes), Phase 2 §3 case 2
- **Detail**: `ROOT = process.cwd()` (`route.mjs:23`) and the router reads the project override from `path.join(ROOT, "context/foundation/agent-smith-policy.json")` (`:57`), plus `context/domain/`, `context/map/`, the e2e record and the code, all from the run worktree, which is created from HEAD. Only the change folder is copied. An uncommitted override is therefore ignored without a word; this repository has one right now (`git diff` shows `limits.maxPlanRevisions: 3` uncommitted in `context/foundation/agent-smith-policy.json`). The plan states that uncommitted changes are not carried, but tells the user nowhere, so a run can route with a different policy than the user sees.
- **Fix**: Keep the no-copy rule, make it visible: in case 2 the orchestrator prints one line listing the `git status --porcelain` paths outside `context/changes/<id>/` as "not in the run (uncommitted in the main checkout)" and goes on; README "Run isolation" and What We're NOT Doing say the run reads every other input as committed at the branch point, so commit it first.
  - Strength: No new copy rule, no halt in an unattended run; the user sees the gap at the moment it is created.
  - Tradeoff: The run still proceeds without the uncommitted inputs; a user who ignores the line gets the committed policy.
  - Confidence: HIGH — the read path and this repo's uncommitted override were checked.
  - Blind spot: Whether an owner prefers a halt over a warning for an uncommitted override is not known; the warning keeps the run unattended.
- **Decision**: APPLIED — What We're NOT Doing (uncommitted changes bullet), Phase 2 §3 Intent (case 2 listing line) and Contract (README note); `plan-brief.md` Open Risks.

### F3 — `cheap` is not tied to a drop that actually applied

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 5 §1 Contract
- **Detail**: The drop goes in before `settle`, so the clamp and the effort floor can absorb it. `implement-tdd` and `implement-e2e` are interactive; at `standard` and `thorough` the floor is tier 3 = base, so their drop is always absorbed (the plan's own test "tdd/e2e floor holds"). The plan still says "add the `cheap: true` flag to the log entry" without a condition, so a tdd or e2e failure at full tier would be excluded from `rigor.fromFailures` and the step budget. The router already solves the same question for the simple discount: `simple` is set only from `saved`, the discount that survived settle (`route.mjs:1833`).
- **Fix**: Set `cheap: true` only when the final tier is below the final tier without the drop; an absorbed drop sets no flag, `tierWhy` reads `-1 first attempt not applied (clamp or floor)`, and its failure counts as an ordinary one; add a `firstattempt.test.mjs` case for a tdd step at `thorough`.
- **Decision**: APPLIED — Phase 5 §1 Contract (`cheap` condition and the new test case); `plan-brief.md` Key Decisions (Drop stacking row).

### F4 — Default branch from `origin/HEAD` would never match

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 §1 Contract (default branches)
- **Detail**: "the short name of `refs/remotes/origin/HEAD`" is `origin/main` (`git symbolic-ref --short refs/remotes/origin/HEAD` and `git rev-parse --abbrev-ref origin/HEAD` both print it in this repo), which never equals a local branch name `main`. The `branchPrefix` check hides the gap today, but the default-branch check exists for a default branch outside the policy list.
- **Fix**: Compare against the branch `origin/HEAD` points to without its remote name.
- **Decision**: APPLIED — Phase 2 §1 Contract.

### F5 — Step commit with a staged index is not decided

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3 §2 Contract
- **Detail**: Phase 3 §1 says only the rollback skips the empty-index check, and Phase 3 §2 says "run the checks", so the step commit presumably halts on a staged index, but the plan never says so or what the entry holds afterwards. A successful step whose own commit a hook rejected leaves exactly that state.
- **Fix**: State that the step commit and the start commit run the empty-index check, halt naming the staged files as the archive does, and leave the `commit` key absent so the resume retries.
- **Decision**: APPLIED — Phase 3 §2 Contract (first sentence).

### F6 — A `done` run without `--archive` leaves its end state uncommitted

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2 §3 Intent (final message), Desired End State (step commits)
- **Detail**: The step commit of the last step runs before `endRun` writes `report.md` and the outcome, so a `done` run without `--archive` ends with `report.md`, the last `run.jsonl` entry and `meta.json` uncommitted in the worktree (a halt is picked up by the next step commit on resume; `--archive` commits them in the pre-archive commit). `git worktree remove` refuses a worktree with modified or untracked files, and a merge of the branch misses them.
- **Fix**: The final message and README "Run isolation" say to commit those files before the merge and before `git worktree remove`.
- **Decision**: APPLIED — Phase 2 §3 Intent (final message) and Contract (README note); `plan-brief.md` Open Risks.
