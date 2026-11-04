# Worktree Isolation, Per-Step Commits, opus/medium Tier and Cheaper First Implement Attempts Implementation Plan

## Overview

Four linked changes to the pipeline router and orchestrator. (1) Every run works in its own linked git worktree on a branch `agent-smith/<change-id>`. (2) The router commits what each successful step left, so every step ends at a known commit. (3) After a failed step, the router snapshots the partial edits to a side ref and hard-resets the run worktree to the step's start commit before it decides the next step. (4) The ladder gets an `opus/medium` rung, and the first attempt of an implement step runs one tier lower than today, with failures re-run higher. Part 4b depends on part 3: a failed attempt costs nothing durable only because the rollback makes it neutral.

## Current State Analysis

- Ladder has 7 rungs (`policy.json:2-10`), `haiku/low` at 0 to `opus/max` at 6. `baseline-policy.json` repeats `sonnet/high` per rung; test `compare.test.mjs:22-28` requires its length to cover every step `maxTier` and be at least the default ladder length, and its keys to be exactly `ladder`, `rigor`, `score`.
- Tier math lives in `tierFor` (`route.mjs:1779`): base, phase bump, `d.bump`, `+perFailure * trailingFailures`, simple discount, score shift, then `settle` (rigor offset, floor, clamp, effort floor).
- First plan: a short and a plain goal both take `complexity.firstPlan.bump.plain` (`route.mjs:813-819`); a short goal also earns the simple discount (`simpleSignal`, `route.mjs:1755-1760`). Today a plain goal plans at 3 `sonnet/high`, a short goal at `lean` at 2 `sonnet/medium`, a hard goal at 4 `opus/high`.
- `next` (`route.mjs:2265`) runs `attachResult`, measures risk, resolves rigor, checks needs-human and the budget, calls `decide`, runs the attempts check, then logs the entry with its `before` state and returns a `run` action. The router writes no git state except in `archiveDone` (`route.mjs:2119`), which holds the safety checks to reuse: work tree, ignored probes, symbolic HEAD, in-progress merge/rebase, empty index, a rollback of its own `git add` on failure.
- `attachResult` (`route.mjs:434-490`) verifies the last step from files, then deletes `last-result.json` (`route.mjs:443`). `run.jsonl` and `meta.json` are written later in the same `next` call.
- `decide` (`route.mjs:796-924`) is file-driven: it picks the next step from `plan.md` `## Progress`, the review files and the log. It has no "retry the last step" branch; a retry happens because the files still call for that step.
- `isFailure` (`route.mjs:503`) feeds `rigor.fromFailures`, the score guards and `trailingFailures`; `budgetSteps` (`route.mjs:506`) counts every executed step except failed advisory ones.
- Execution commits already happen inside steps (`10x-goal-implement` per phase, `fix`, impl-review apply rules); `commitEvidence` (`route.mjs:1342`) reads git history since a step began, excluding `context/**`, docs, lock files.
- `init` records `meta.baseSha` from HEAD (`route.mjs:2794-2798`), writes `meta.json` and then calls `next` in the same process (`:2805-2806`), so the first log entry and its `before` state are created inside the `init` call. The orchestrator (`SKILL.md`) runs from the project root and gives the subagent only the prompt; it has no notion of a worktree.
- AGENTS.md Hard Rules limit router git writes to the pre-archive commit (`AGENTS.md`, Hard Rules bullet 3). This plan widens that rule and needs an ADR.

### Key Discoveries:

- Tests drive the real router through the CLI in scratch projects (`helpers.mjs`); `writeOverride` is the one place that can switch a new default off for existing tests, as it did for `score` (`helpers.mjs:42-47`). Existing tests keep passing only if the new isolation gate defaults off there.
- A hard reset in the run worktree would also revert `run.jsonl` and `meta.json`: both change after the last commit, because the router appends the next entry before the step runs. `next` holds both in memory and writes them back after the reset. `last-result.json` needs no care: `attachResult` has already consumed it.
- Because `decide` reads files, the rollback must run before risk, rigor and `decide`. A decision taken first would act on files the reset then removes: after a failed implement that ticked every row, `decide` returns `impl-review`; a retry logged before the reset records a `before.autoDone` that counts discarded ticks, so `verifyImplement` (`route.mjs:1372`) fails it.
- `git commit-tree` plus `git update-ref` makes the side-ref snapshot without moving the branch and without touching hooks. If the failed step had already made its own commits, HEAD is the snapshot's parent, so they stay reachable.
- A subagent "starts in the main conversation's current working directory" (code.claude.com/docs/en/sub-agents, research F1), so a main-session `cd` into a directory inside the project reaches every step. Two cases stay open: an orchestrator that itself runs inside a subagent never carries a `cd` over ("Subagent sessions never carry over working directory changes", tools-reference), and nothing was run live. The router therefore still puts the worktree path into the prompt of every step of an isolated run, and the orchestrator runs each router call with an explicit `cd` into the worktree.
- `const ROOT = process.cwd()` (`route.mjs:23`): every router call works on the shell's current directory, so a reset of the shell to the main checkout reaches the isolation gate of `init` as a non-linked worktree (research F1).
- `.claude` is a protected directory; the documented exemption names "Claude's own git worktrees under `.claude/worktrees/`" (code.claude.com/docs/en/permission-modes). Whether a worktree made by plain `git worktree add` counts is not stated; if it does not, an unattended Edit or Write under the worktree prompts even in `acceptEdits` (research F1, open).
- File times: `git reset --hard` writes each file it changes with the current time and leaves the others alone; `cp -R` stamps the copy time, `cp -Rp` keeps the source time (checked in a scratch repo, macOS, git 2.54). `decide` compares the mtimes of `plan.md` and the review files whenever no `plan` and no `plan-review` step is logged (`route.mjs:827-829`, and `:884-886` for the implementation review), which holds for a run that starts with a reviewed plan. Without care, a rolled-back first implement that ticked rows makes a fresh review look stale (an extra plan review), and a rolled-back plan review that rewrote its file makes a stale review look fresh (a skipped review).
- A project root below the repository top level is supported (`archive.test.mjs:461`, `churn.test.mjs:202`). From such a directory `git rev-parse --git-path info/exclude` prints a relative path (`../.git/info/exclude`); with `--path-format=absolute` it is absolute, and the exclude line `/<prefix>.claude/worktrees/` (`<prefix>` from `git rev-parse --show-prefix`) ignores a worktree under the project root, leaving the main checkout's status clean (checked).
- `pr-comment.mjs` reads `context/changes/<id>/agent-smith/report.md` relative to its working directory unless `--report` names another file (`pr-comment.mjs:97`), and posts to the pull request of the current branch (`gh pr view`, `:115`). Inside the run worktree that branch is the local `agent-smith/<id>`, which has no pull request; the pull request belongs to the main checkout's branch, whose change folder has no report.
- `archiveDone` treats the change folder as already committed (the resume after a pre-archive commit) when `agent-smith/report.md` is tracked and the folder is clean (`route.mjs:2126-2128`). With step commits that is true at a `done` of any run in which a halt wrote `report.md` and a later step commit took it, so a failed archive pre-check would print "The pre-archive commit exists" and `committed: true` without such a commit and skip writing the end state.
- `loops-existing.test.mjs` is the characterization of the RETHINK/REVISE loop: "committed before any router change and is never edited afterwards" (file header, lines 1-3; AGENTS.md:23). It pins two tier indexes (`:46` 6 = `opus/max`, `:69` 5 = `opus/xhigh`) that move with the inserted rung. The rule is a convention: no test or CI check compares the file's bytes (research F2). Its purpose was to prove the pre-plan loops kept today's behaviour (`context/archive/2026-10-30-pre-plan-steps/plan.md:117-142`); behaviour here means model and effort, which the renumbering keeps.
- With the Phase 1 data and the effort-rung floor applied to a scratch copy, 15 tests fail on tier literals: 2 in `loops-existing.test.mjs`, 3 in `loops.test.mjs`, 4 in `preplan.test.mjs`, 6 in `score.test.mjs` (research F2, F3). Only the first failing assertion of each test was seen, so later literals in the same tests may follow. `route.mjs` holds no tier-number literal.
- `10x-goal-implement` commits each green phase with its ticked rows and resumes at the first pending row after a STOP (`~/.claude/skills/10x-goal-implement/SKILL.md:171,183,249`). A reset to `startSha` drops such phase commits from the branch, and the retry redoes them (research F4). The four archived runs hold 34 executed steps and no failed one, so the frequency is unknown.
- The project counts Opus tokens as cost. The product goal is a lower weekly usage (`prd.md:37`, `prd.md:49`, ADR-001); README "Baseline comparison" says raw tokens overstate a drop bought by moving work to `opus`; the scorer A/B rule turns the scorer off when it raises Opus tokens; PRD FR-003 names `sonnet` at `medium` as the pair for a simple change (`prd.md:92`).

## Desired End State

- With the shipped policy, `init` halts when the run is not in a linked worktree, is detached, is on a default branch (`main`, `master`, `origin/HEAD`) or on a branch outside `agent-smith/`. `meta.isolated: true` and `meta.branch` are stored at the first `init` of a run (no executed step); a resume never adds them, and a run with executed steps and no `meta.isolated` halts at `init` and names the override.
- The orchestrator creates the run worktree under the project root and copies the change folder into it, keeping file times, only when it creates the run branch; a resume reuses the worktree or the branch and copies nothing. A project that is not a git work tree, or whose override sets `isolation.require` to a value other than `true`, gets no worktree: the orchestrator runs `init` in the main checkout as today. With `--pr-comment` the report is posted from the main checkout, whose branch holds the pull request.
- The first `init` of an isolated run commits the change folder (the copy the orchestrator made, plus `meta.json`) as `chore(<id>): start run` and records `meta.startCommit`, so the first step's `startSha` holds the run's inputs; `run.jsonl` gets its first entry after that commit, from the `next` call inside `init`. After each successful step of an isolated run the branch holds one `chore(<id>): step <n> <step>` commit of whatever the step left, or no commit when nothing changed. The log entry carries `startSha` and `commit`.
- A failed step of an isolated run is rolled back right after its result is read, before the next step is decided: a commit of the partial state sits under `refs/agent-smith/<id>/failed-<n>`, the worktree is at `startSha`, router state files are intact, the file times `decide` compares are those of the step start, the next step (a retry, `plan-replan` or another step) is chosen from the restored files, and the log entry says `rolledBack`. Commits the failed step made itself (for example the phase commits of `10x-goal-implement`) leave the branch with the reset, stay reachable under the side ref, and the retry redoes them. When the run halts instead, the reset is undone so the worktree shows the partial edits with the times they had, the side ref stays and the entry says `kept`. A failed entry that carries `uncommitted` (the `implement-retry` path) or `signals.needsHuman` is not rolled back.
- The ladder has 8 rungs with `opus/medium` at index 4; every step pin is renumbered so every step keeps its model and effort at its base tier, and `complexity.firstPlan.bump.plain` becomes -2 so the first plan of a short or plain goal keeps today's model and effort. A move up into Opus from `sonnet/high` or below lands on `opus/medium` for a non-interactive step; an interactive step at `standard` or `thorough` skips that rung to `opus/high`, because the effort floor also checks the effort of the chosen rung (ADR-003); Phase 1 lists the changed paths.
- The first implement attempt of an isolated run runs one tier below base; a retry runs at base plus one per failure, so it jumps two tiers from the first attempt. A cheap-attempt failure raises no rigor and uses no step budget; a run has at most one.
- Verify: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` passes, and `init`/`status` against a scratch change print valid JSON.

## What We're NOT Doing

- Per-step baseline curve (change item 6) and a Fable top tier (item 4).
- Merging, pushing or deleting the run branch or worktree; the router never pushes (rule kept). The orchestrator reports the branch and worktree path at the end.
- Rolling back a `blocked` fallback step, a failed `score` attempt (advisory, writes only `complexity.json`) or the final failure that halts the run (the reset is undone, so the partial edits stay for a human; the side ref keeps a copy). What a fallback or a failed score attempt leaves goes into the commit of the next successful step; when the next step fails instead, its rollback resets those leftovers away with its own edits (both stay under its side ref). The ADR and README say so.
- Carrying uncommitted changes of the main checkout into the worktree. Only the change folder is copied, and only when the run branch is created. The run reads every other input (the project override `context/foundation/agent-smith-policy.json`, `context/foundation/`, `context/domain/`, `context/map/`, the code) as committed at the branch point; the orchestrator lists the uncommitted ones when it creates the branch (Phase 2 §3), and README "Run isolation" says to commit them before a run.
- Changing `pr-comment.mjs`. Only the orchestrator's call changes (working directory and `--report`).
- Using Claude Code's `isolation: "worktree"` on the Agent tool (per subagent and auto-cleaned; steps must share one worktree).
- Changing `compare` math. Only the baseline procedure text changes (the baseline worktree needs a branch).
- Moving the plain-goal first plan to `opus/medium` (review F2 Fix A). A project that wants it sets `{ "complexity": { "firstPlan": { "bump": { "plain": -1 } } } }`.
- Calibrating the new thresholds; they are uncalibrated like the rest.

## Implementation Approach

Build bottom-up so each phase leaves the suite green: ladder first (data renumbering plus the first-plan bump), then the isolation gate and `meta.isolated`, then commits, then rollback, then the tier change that needs rollback, then the ADR and docs. All new behaviour is gated on `meta.isolated === true`, which exists only when `isolation.require` is true and init passed the checks. An override with `isolation.require: false` (used by `writeOverride` for existing tests and by non-git projects) keeps today's behaviour exactly. New git code lives in a small helper group in `route.mjs` that reuses `runGit`, `statusEntries` and the archive pre-check pieces, extracted so `archiveDone` and the step commit share one implementation.

Decisions (made without a human, from the change notes, the PRD, README, AGENTS.md, the code and `research.md`; ADR-010 lists the first two and the characterization-test edit for the owner to confirm, and names the alternative reset target):

| Decision | Choice |
| --- | --- |
| Neutral failure, rigor and budget | A failed cheap first implement attempt is excluded from `rigor.fromFailures` and from the step budget, as a failed `score` attempt is (`budgetSteps`, `route.mjs:505-506`). It still raises the step's tier for the retry and still counts toward `maxAttemptsPerStep` and the `codeReplan` failure count. The drop stops after the first implement failure, so a run has at most one such entry. Why: the change notes ask for a neutral failure and leave rigor and budget to the plan; README "Budget" sizes each level for one failed step and its retry, which a planned cheap failure would otherwise use up, and a `lean` run would keep its budget of 10 with one step less (review F7 Fix A). |
| First-plan bump | `complexity.firstPlan.bump.plain` -1 becomes -2, so a short or plain goal keeps its first plan on `sonnet/high` (`sonnet/medium` for a short goal at `lean`). Only moves up into Opus use the new rung. Why: the PRD goal and FR-003, the README compare note on Opus and the scorer A/B rule on Opus tokens all treat moving work onto Opus as a cost; the change notes describe the rung as a shift of tier indexes (review F2 Fix B). |
| Stacking | The first-attempt drop applies only when the simple-change discount is 0, so the two never double up. |
| Scope of drop | Templates `implement`, `implement-segment`, `implement-tdd`, `implement-e2e`; never `implement-retry`, re-plans, `fix`. Only while no earlier same-step failure exists and only when `meta.isolated`. |
| Score down shift | Also withheld when the first-attempt drop applied. |
| Commit what | `git add -A` inside the run worktree (the worktree is the run's own), message from `isolation.commit.message`. Only after a successful step. |
| Snapshot | Plumbing (`write-tree`, `commit-tree`, `update-ref`), so no hook runs on the side ref; documented in the ADR. |
| Worktree location | `<root>/.claude/worktrees/agent-smith-<change-id>`, where `<root>` is the project root (the session's directory, where `context/` lives), branch `agent-smith/<change-id>`, created by the orchestrator; reused when it already exists. The run root inside it is `<worktree>/<prefix>` (`git rev-parse --show-prefix` at `<root>`, empty when the project root is the repository top level). `/<prefix>.claude/worktrees/` goes into the file printed by `git rev-parse --path-format=absolute --git-path info/exclude` (without the flag the path is relative from a subdirectory, Key Discoveries) when `git check-ignore -q .claude/worktrees/agent-smith-<change-id>/x` fails (a file path, as `ignoredProbePaths` probes files, `route.mjs:638-646`). Why: Claude Code resets the main session's shell to the project directory after a `cd` outside it ("Shell cwd was reset"), the Bash sandbox writes only under the working directory, and Edit/Write outside it prompt even in `acceptEdits` (code.claude.com/docs/en/tools-reference, /sandboxing, /permission-modes); `.claude/worktrees/` is Claude Code's own worktree location and this repo already ignores it (`.gitignore`, commit 78c3079) (plan review 2 F1). |
| Default | `isolation.require` ships `true` (breaking for runs in the main checkout; release type `feat!`). |
| Characterization test | One edit of `loops-existing.test.mjs`, in Phase 1: the two tier literals `:46` 6→7 and `:69` 5→6, nothing else in the file; the AGENTS.md test-list line records the exception in the same phase and ADR-010 names it for the owner. Why: the change notes put "tests" in the list of places whose tier indexes shift; they handle a repository rule the same way ("Constraints to change, not to break silently": change it in the open, with an ADR and the AGENTS.md text rewritten); the file characterizes model and effort routes, which the renumbering keeps (`opus/max`, `opus/xhigh`); no check enforces the rule; an old ladder injected through `writeOverride` would hide the renumbering from every test (plan review 2 F2, research F2). |
| Reset target | A failed step is reset to its `startSha`, as the change notes decide ("hard-reset the worktree to the step's start commit"). Its own commits leave the branch, stay reachable from the side ref (the snapshot's parent is the head the step left), and the retry redoes them. ADR-010 and README say so and name the alternative, a reset to the head the failed step left, which keeps green phase commits (`10x-goal-implement` resumes at the first pending row) at the cost of a second start point. Why: the owner fixed the target in the change notes; no failure data exists to argue against it (0 failed steps in 34 archived, research F4) (plan review 2 F4). |
| `scoreShift.effective` | Keeps its definition, the final tier with the shift minus the final tier without it (ADR-007 "Effective shift"), so it reads 2 for a shift of 1 when the effort floor skips `opus/medium`; `score.test.mjs` literals follow. The report reads it only as applied or not (`route.mjs:271`), so `report.md` text does not change. Why: an index difference is how the router measures the saved discount too; a rung count that skips floor-skipped rungs would be a second measure for one field (research F3). |

## Critical Implementation Details

- **Order in `next`** — right after `attachResult` comes the step commit for an ok entry (Phase 3) or the rollback for an eligible failed entry (Phase 4). Risk, rigor, the needs-human and budget checks, `decide` and the attempts check follow, so every one of them reads the restored files. Nothing that reads `plan.md`, a review file or the diff runs before the rollback.
- **Undo on halt** — when the `next` call that rolled back ends in a halt (budget, a `decide` halt, the attempts cap), it first restores the failure state, then halts: `git reset --hard <ref>`, then `git reset -q <ref>^`. The branch is back at the head the failed step left, the worktree holds the partial edits, and files the step added are untracked again (staged files come back unstaged). It writes `run.jsonl` and `meta.json` back, sets the file times back to the values read before the rollback (see "File times"), and replaces `rolledBack: <ref>` with `kept: <ref>`. An entry with `rolledBack` or `kept` is never rolled back again, so a resume after the halt keeps what the human changed. A git failure in the undo halts with git's message; the side ref still holds the edits. The undo runs before `endRun` writes `report.md`.
- **Start commit** — `startSha` is HEAD, not the worktree: a file that is untracked or modified at step start is staged by the rollback's `git add -A` and then removed or reverted by `git reset --hard <startSha>` (checked: a new file after `git add -A` and `git reset --hard HEAD` is gone). The orchestrator's copy of the change folder is untracked in a fresh worktree (on this branch only `change.md` is tracked, at its committed version), so a failed first step that is rolled back (a `plan` at `lean`, a `research` at `thorough`, any first step when `score` is skipped) would delete `research.md`, `frame.md` or a ready `plan.md` and revert `change.md`, and the run would go on without its inputs. `init` therefore makes a start commit, in this order: the isolation checks, `baseSha` (HEAD before the commit, so churn and the baseline procedure are unchanged), the `meta.json` write, then `git add -- context/changes/<id>/` and `git commit -m <isolation.commit.startMessage> -- context/changes/<id>/` with the shared checks of Phase 3 §1 and the archive's post-commit checks (index empty, only the change folder, folder clean), then `meta.startCommit` (the commit hash, or `null` when the index stayed empty) and a second `meta.json` write, and only then the `next` call that creates the first entry, whose `startSha` is the start commit. The guard is the key, as for the step commit's `commit`: the commit runs when `meta.isolated` is true, `meta.startCommit` is absent and the log has no executed entry. A git failure unstages the folder and halts with git's message, the key stays absent, and the next `init` retries; a resume of a run with executed steps never makes one. A human's uncommitted edits made after a halt are not committed either: the next failed step sweeps them into its side ref; README and ADR-010 tell the human to commit them before resuming.
- **File times** — the reset rewrites every file that differs from `startSha` with the current time, and `decide` compares the mtimes of `plan.md` and the review files while no `plan` or `plan-review` step is logged (Key Discoveries). Each entry of an isolated run therefore records `before.mtimes`: the `mtimeMs` of `plan.md`, `reviews/plan-review.md` and `reviews/impl-review.md` (keys `plan`, `planReview`, `implReview`; 0 when the file is absent). The rollback reads the three current times before `git add -A`; after `git reset --hard <startSha>` it sets each file that exists and has a recorded time above 0 back to that time (`fs.utimesSync`, no git); the undo on halt sets them to the times read before the rollback. The orchestrator copies the change folder with `cp -Rp` for the same reason, so the copy keeps the order of its source times.
- **Timing** — `startSha` is read when the entry is created. The step commit happens in the next `next` call, after `attachResult` verified the result: `next` writes `run.jsonl` with the attached result first, so the step's commit holds its own result; the `commit` field it then records lands in the following commit, since a commit cannot hold its own hash.

---

## Phase 1: opus/medium rung and renumbering

### Overview

Insert `{ "model": "opus", "effort": "medium" }` at index 4, keep every step's base-tier model and effort, and keep the first plan of short and plain goals where it is today.

Tier math is additive (`tierFor`: base, bumps, failures, discount), so a relative move that crosses the gap between index 3 and 4 lands on a different rung after the renumber. With `bump.plain: -2`, the first plan of a short or plain goal starts below the gap like the base-3 steps. A route of a non-interactive step (or any step at `lean`) that starts at index 3 or below and moves up into Opus then lands one rung lower than before (`opus/high` becomes `opus/medium`, `opus/xhigh` becomes `opus/high`, `opus/max` becomes `opus/xhigh`), so `opus/max` takes one more bump. Routes that start at the base of `plan` (hard goal, re-plans) or `frame` keep their model and effort. Paths with the shipped policy (before → after):

| Path | Before | After |
| --- | --- | --- |
| First plan, plain goal (-1 before, -2 after) | 3 `sonnet/high` | 3 `sonnet/high` |
| First plan, short goal, lean (same, plus -1 simple) | 2 `sonnet/medium` | 2 `sonnet/medium` |
| First plan, hard goal (0) | 4 `opus/high` | 5 `opus/high` |
| First plan, plain goal, +1 (score up shift or one failed attempt) | 4 `opus/high` | 5 `opus/high` (effort floor skips 4) |
| `implement`, `fix` with 3-5 phases (+1) | 4 `opus/high` | 4 `opus/medium` |
| `impl-review` with 3-5 phases (+1), `standard` or `thorough` | 4 `opus/high` | 5 `opus/high` (effort floor skips 4) |
| `implement`, `impl-review`, `fix` with 6+ phases (+2) | 5 `opus/xhigh` | 5 `opus/high` |
| `plan-review` with 6+ phases (+2) | 4 `opus/high` | 5 `opus/high` (effort floor skips 4) |
| A non-interactive base-3 step after one failure (+1) | 4 `opus/high` | 4 `opus/medium` |
| An interactive base-3 step after one failure (+1), `standard` or `thorough` | 4 `opus/high` | 5 `opus/high` (effort floor skips 4) |

The ladder is no longer ordered by effort (`sonnet/high` at 3, `opus/medium` at 4). `effortFloorTier` returns the lowest index with enough effort (3), so a tier-index floor alone would let an interactive step run on `opus/medium`, which breaks ADR-003 ("the router **MUST** pick a tier with effort `high` or above" at `standard` and `thorough`). The floor therefore also moves a step up from a rung whose own effort is below `minEffort` (plan review 2 F3).

The -2 bump is the default of this unattended run (see Decisions); review F2 Fix A, the plain-goal first plan on `opus/medium`, is the one-key override in "What We're NOT Doing". With the -2 bump, manual check 1.4 holds for every goal class.

### Changes Required:

#### 1. Ladder, step pins and first-plan bump

**File**: `skills/10x-pipeline/policy.json`

**Intent**: Add the rung between `sonnet/high` and `opus/high`. Shift every tier number that was 4 or higher by one so each step keeps its model and effort. Widen the plain first-plan bump by the inserted rung so the short and plain first plans keep their route.

**Contract**: `ladder` has 8 entries. `plan` baseTier 5, maxTier 7; `plan-review` maxTier 6; `implement` maxTier 7; `impl-review` maxTier 6; `fix` maxTier 7; `research` maxTier 6; `domain-brief` maxTier 6; `frame` base/min/max 5; `manual-verify` maxTier 6; `archive` stays 3; `score` unchanged. `complexity.firstPlan.bump` is `{ "plain": -2, "hard": 0 }`. Any other tier literal in the policy is checked the same way.

#### 2. Baseline ladder

**File**: `skills/10x-pipeline/baseline-policy.json`

**Intent**: Keep the baseline ladder as long as the default one.

**Contract**: 8 entries, all `sonnet/high`; no other key added (`compare.test.mjs` 1.1 pins the key set).

#### 3. Tier literals in tests

**File**: `skills/10x-pipeline/test/*.test.mjs`, `AGENTS.md`

**Intent**: Renumber the tier-number literals in the tests that the inserted rung and the effort-rung floor (§5) move, so each keeps the model and effort it pinned; add a test that pins the rung order and that every step's resolved model/effort at its base tier equals the pre-change value. `route.mjs` holds no tier-number literal (research F2), so it changes only in §5.

**Contract**: Known literals (research F2, F3; line numbers at `62ada19`): `loops-existing.test.mjs:46` 6→7 and `:69` 5→6; `loops.test.mjs:114`, `:152`, `:398`; `preplan.test.mjs:49-51` (policy literals of `research`, `domain-brief`, `frame`), `:808`, `:833`, `:924`; `score.test.mjs:584`, `:591`, `:599`, `:755` (an override `plan.maxTier` 4 now lands on `opus/medium`, which the floor skips), `:810` and `:933` (`scoreShift.effective` 1→2, see Decisions). Each renumbered literal names the same model and effort as before; later assertions in the same tests are renumbered by the same rule until the suite is green.

`loops-existing.test.mjs` is the exception the Decisions table names: only the two literals change, so `git diff --numstat 62ada19 -- skills/10x-pipeline/test/loops-existing.test.mjs` reports 2 added and 2 deleted lines, and its header comment stays as it is. In the same phase the AGENTS.md test-list line keeps "never edit it" and adds the one exception: the two tier literals renumbered by ADR-010's ladder change. Row 4.2 ("loop tests unchanged") then means Phase 4 leaves the file as Phase 1 left it.

New `skills/10x-pipeline/test/ladder.test.mjs` holds a table of step to expected model/effort at baseTier, plus one row per path in the Overview table with its resolved model/effort (driven through `init`/`next` in scratch projects, not computed from the policy). The three first-plan rows for a plain, short (`lean`) and hard goal assert the pre-change model and effort. It also asserts that no interactive step resolves to a rung whose effort is below `rigor.minEffort` of its level, that a `lean` interactive step may resolve to `opus/medium`, and that the RETHINK and REVISE re-plans of `loops-existing.test.mjs` resolve to `opus/max` and `opus/xhigh` by name, so the characterized routes are pinned by model and effort, not only by index.

#### 4. Tier docs

**File**: `skills/10x-pipeline/SKILL.md`, `README.md`

**Intent**: The first-plan rule of "How the tier moves" (`SKILL.md:128`) and the README routing bullet (`README.md:35`) say -2 for short and plain goals (AGENTS.md coding-style rule). README also says that a move up from `sonnet/high` reaches `opus/medium` first for a non-interactive step, and the README effort-floor bullet says the floor also skips a rung whose own effort is below the floor. The README "Complexity score" bullet on `status` says `scoreShift.effective` is the difference of final tier indexes, so it can read 2 for a shift of 1 when the floor skips a rung.

**Contract**: `SKILL.md` changes only the number; no model, effort or tier name added there.

#### 5. Effort floor checks the rung's effort

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: In `settle` (inside `tierFor`), after the index floor from `effortFloorTier`, move an interactive step up while the effort of `ladder[final]` ranks below `minEffort` in `rigor.effortOrder`, so the floor keeps ADR-003's effort guarantee on a ladder that is not ordered by effort.

**Contract**: applied last, as today, so it wins over `maxTier` and every discount; stops at the top rung. The existing note `floor <minEffort> (tier <index floor>)` stays as it is for every interactive step (tests match `floor high \(tier 3\)` and `floor medium \(tier 2\)`, `route.test.mjs:191`, `:224`, `:248`); the rung check adds one note, `skips <effort> rung (tier <final>)`, only when it moves the step. A ladder ordered by effort (the 7-rung ladder, the baseline ladder) gives the same tiers and notes as before. A rung's effort ranks as in `effortFloorTier`: a name missing from `effortOrder` counts as below the floor, as the index floor already treats it; the shipped and baseline ladders use only listed names (research F3 edge).

### Success Criteria:

#### Automated Verification:

- New ladder test passes: `node --test skills/10x-pipeline/test/ladder.test.mjs`
- Compare and provenance tests pass with the 8-rung baseline: `node --test skills/10x-pipeline/test/compare.test.mjs skills/10x-pipeline/test/provenance.test.mjs`
- Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`

#### Manual Verification:

- `node skills/10x-pipeline/scripts/route.mjs init <id>` on a scratch change prints the same first-step model and effort as before the change.

---

## Phase 2: Run isolation gate

### Overview

`init` requires a linked worktree on a run branch; the orchestrator creates the worktree; steps are told where to work.

### Changes Required:

#### 1. Policy and init check

**File**: `skills/10x-pipeline/policy.json`, `skills/10x-pipeline/scripts/route.mjs`

**Intent**: Add the `isolation` block and make `init` halt, before writing anything, when the checks fail. Store `meta.isolated: true` on pass; a resume keeps it.

**Contract**: `isolation: { require: true, defaultBranches: ["main","master"], branchPrefix: "agent-smith/", gitTimeoutMs: 120000, commit: { message: "chore({id}): step {n} {step}", startMessage: "chore({id}): start run" }, rollback: { ref: "refs/agent-smith/{id}/failed-{n}" } }`. Linked worktree test: `git rev-parse --path-format=absolute --git-dir` differs from `git rev-parse --path-format=absolute --git-common-dir` (without the flag, a subdirectory of the main checkout prints `/abs/.git` and `../.git`, which differ as strings; checked with git 2.54). Default branches: the policy list plus the branch that `refs/remotes/origin/HEAD` points to, without its remote name (`git symbolic-ref --short refs/remotes/origin/HEAD` prints `origin/main`; the compared name is `main`), when set. Halts: not a git work tree, not a linked worktree, detached HEAD, default branch, a branch whose name does not start with `branchPrefix`, git ignoring the router files (reuse `ignoredProbePaths`). On pass `meta.branch` stores the short branch name; a resume on another branch halts. `meta.isolated` and `meta.branch` are set only at an `init` whose log has no executed entry; a resume never adds them, and with `require: true` a resume of a run that has executed entries and no `meta.isolated` (an in-flight run from before this change, or a log copied by hand) halts and names `{ "isolation": { "require": false } }`, so a run is either isolated from its first step or not at all. The "not a linked worktree" halt names the same override for an in-flight run in the main checkout, and the "not a git work tree" halt names it for a project without git. The step commit (Phase 3) and the rollback (Phase 4) check that HEAD is still on `meta.branch` before any write. With `require` not `true`, `meta.isolated` is absent and nothing changes.

#### 2. Working-directory line in prompts

**File**: `skills/10x-pipeline/scripts/route.mjs`, `skills/10x-pipeline/prompts/`, `skills/10x-pipeline/prompts/README.md`

**Intent**: For an isolated run, prefix every returned prompt with a rule that names the worktree path and tells the subagent to work only there.

**Contract**: new prompt file `prompts/worktree.md`, listed in `prompts/README.md` like the other prompt files, in GIVEN/WHEN/THEN form with one bold keyword per rule (ADR-004), no model or tier word, referenced from `policy.json`; rendered with `{workdir}`; added by `next` only when `meta.isolated`.

#### 3. Orchestrator start

**File**: `skills/10x-pipeline/SKILL.md`

**Intent**: In Start, before `init`, when the shell is not in a linked worktree on a branch that starts with `agent-smith/`. Names (Decisions, "Worktree location"): `<root>` is the project root, `<prefix>` is `git rev-parse --show-prefix` there, `<worktree>` is `<root>/.claude/worktrees/agent-smith-<id>` (a `cd` outside the project directory is reset by Claude Code, see Decisions), and the run root is `<worktree>/<prefix>`; keep `<root>` and the run root as absolute paths. First the opt-out: when `git -C "<root>" rev-parse --is-inside-work-tree` does not print `true`, or `<root>/context/foundation/agent-smith-policy.json` sets `isolation.require` to a value other than `true`, create nothing, copy nothing and run `init` and every later call in `<root>` as today (without git and with `require` on, the router's "not a git work tree" halt names the override). Otherwise four cases, in this order:

1. In-flight run in the main checkout (`<root>/context/changes/<id>/agent-smith/meta.json` exists and no branch `agent-smith/<id>` exists): create nothing and run `init` in `<root>`; the router halts there unless the project sets `isolation.require: false` (Migration Notes). Its log is never copied into a worktree.
2. No branch `agent-smith/<id>`: add `/<prefix>.claude/worktrees/` to the file printed by `git rev-parse --path-format=absolute --git-path info/exclude` when `git check-ignore -q .claude/worktrees/agent-smith-<id>/x` fails (a local exclude, never a `.gitignore` edit), create the branch and the worktree, and copy the change folder to the run root keeping file times (`decide` compares them, Critical Implementation Details "File times"). Before the branch is created, print one line that lists the paths `git -C "<root>" status --porcelain` reports outside `context/changes/<id>/` as "not in the run (uncommitted in the main checkout)", or nothing when there are none; the run goes on.
3. A worktree of `agent-smith/<id>` exists: reuse it and copy nothing.
4. The branch exists without a worktree: add the worktree without `-b` and copy nothing.

A resume never copies: the main checkout's copy is older than the run's state on the branch (start commit, step commits, a kept failure) and would overwrite it. Run every later router call as `cd "<run root>" && node <router> ...`, so the call works on the worktree also when the shell was reset or the orchestrator itself runs inside a subagent, whose `cd` never carries over (Key Discoveries). The PR comment step of an isolated run runs from `<root>` with `--report "<run root>/context/changes/<id>/agent-smith/report.md"`: the report lives in the worktree, and the pull request belongs to the main checkout's branch, not to the local run branch (Key Discoveries); in `archive` it still runs before the move. Say that the final message names the branch and the run root, and says that the change folder in the main checkout is a stale copy: the run's copy lives on the run branch, and the main-checkout copy must be removed (or stashed) before the run branch is merged, because git refuses a merge that would overwrite untracked files. For a run that ended `done` without `--archive`, the final message also says that `report.md`, the last `run.jsonl` entry and `meta.json` are uncommitted in the worktree: commit them before the merge and before `git worktree remove`, which refuses a worktree with modified or untracked files.

**Contract**: the opt-out runs no `git worktree` and no `cp`; case 2 runs `git worktree add -b agent-smith/<id> <worktree>`, then `mkdir -p "<run root>/context/changes"` and `cp -Rp "<root>/context/changes/<id>" "<run root>/context/changes/"`; case 4 runs `git worktree add <worktree> agent-smith/<id>`; no `cp` in cases 1, 3 and 4. The PR comment section keeps exactly one `node $PR_COMMENT` call inside it (`pr-comment.test.mjs:679-684`) and no model, effort or tier word on its lines (`:729-735`); `pr-comment.mjs` is unchanged. No model, effort or tier wording added; the anti-stall section stays as `skill-loop.test.mjs` checks it. README "Run isolation" repeats the stale-copy note, the uncommitted end-state note and the committed-inputs note (What We're NOT Doing), and states the open protected-path question: if Claude Code prompts for Edit or Write under `.claude/worktrees/` in `acceptEdits`, the worktree made by `git worktree add` is not covered by the "Claude's own git worktrees" exemption, and an unattended run stalls there (checked live, see Manual Testing Steps).

#### 4. Test helpers

**File**: `skills/10x-pipeline/test/helpers.mjs`

**Intent**: `writeOverride` adds `isolation: { require: false }` unless the test gives its own `isolation` key, like `score`.

**Contract**: shallow merge only; a new `isolation.test.mjs` builds real linked worktrees with hermetic git, and also checks that a linked worktree on a branch without the `agent-smith/` prefix halts, that `meta.branch` is stored, that a project root below the repository top level passes in its worktree, and that a resume of a log with executed entries and no `meta.isolated` halts with the override in the message.

### Success Criteria:

#### Automated Verification:

- Isolation tests pass (main checkout halts, linked worktree on `agent-smith/x` passes, detached halts, default branch halts, require false unchanged): `node --test skills/10x-pipeline/test/isolation.test.mjs`
- Prompt rule form passes: `node --test skills/10x-pipeline/test/rules.test.mjs`
- Skill content test passes: `node --test skills/10x-pipeline/test/skill-loop.test.mjs`
- Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`

#### Manual Verification:

- In a live run the subagent edits files only under the worktree path, not the main checkout (confirms the prompt line works when the Agent tool does not inherit the shell directory).

---

## Phase 3: Per-step commits

### Overview

After each verified successful step of an isolated run the router commits what the step left.

### Changes Required:

#### 1. Shared git safety checks

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: Extract the pre-checks of `archiveDone` (work tree, symbolic HEAD, in-progress operations, empty index) into a helper all callers use, with no change in archive messages. The rollback (Phase 4) calls it without the empty-index check.

**Contract**: helper returns `null` or a reason string and takes an option to skip the empty-index check; archive tests stay green unchanged.

#### 2. Step commit in `next`

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: Right after `attachResult` (before risk, rigor and `decide`), when `meta.isolated` and the last executed entry is `ok` (not a skip; a successful `score` entry counts, so `complexity.json` lands in its own commit and a later rollback cannot delete it), write `run.jsonl`, run the checks, `git add -A`, and commit when the index is non-empty. Record `commit` on the entry. On any git failure: unstage the router's own add, halt with git's message.

**Contract**: the step commit and the start commit run the shared checks with the empty-index check: an index that holds staged files when the step ends (for example after a hook rejected the step's own commit) halts and names them, as the archive does, and the entry keeps no `commit` key, so the resume retries once a human has committed or unstaged them. The commit runs once per entry: only when the entry has no `commit` key, and the entry gets `commit: null` when the index stays empty, so a resume after a halt that followed an ok step (budget, `needsHuman`, a `decide` halt) never commits a human's edits under that step's name; a git failure leaves the key absent, so the resume retries. Message rendered from `isolation.commit.message` with `{id}`, `{n}`, `{step}`; hooks and signing honored, never `--no-verify`, no push, only `-c core.quotePath=false`. Each new entry of an isolated run gets `startSha` (HEAD when the entry is created). After the commit, the post-commit checks of the archive path apply: index empty, no hook-staged leftovers. `report.md` rows and `status` show the short commit. The start commit of the first `init` (Critical Implementation Details, "Start commit": its order inside `init`, the `meta.startCommit` guard and its retry) uses the same helper and failure handling, with `isolation.commit.startMessage` from the Phase 2 block (Phase 2 only stores it; Phase 3 makes the commit). In an isolated run `archiveDone` treats the folder as already committed only when, besides today's test, the subject of HEAD equals the rendered `archive.commitMessage` (Key Discoveries); a run without `meta.isolated` keeps today's test, so `archive.test.mjs` stays unchanged. `stepcommit.test.mjs` also checks: a fresh isolated `init` commits the copied change folder after recording `baseSha`, and the first entry's `startSha` is that commit; a resume makes no start commit; after a hook rejected the start commit, the next `init` makes it; in an isolated `--archive` run that halted once and resumed, a `done` whose archive pre-check fails reports `committed: false` and writes the end state.

### Success Criteria:

#### Automated Verification:

- Step commit tests pass (commit made, empty commit skipped, failed step not committed, hook failure halts and unstages, `startSha` logged, require false makes no commit): `node --test skills/10x-pipeline/test/stepcommit.test.mjs`
- Archive tests unchanged: `node --test skills/10x-pipeline/test/archive.test.mjs`
- Commit evidence of tdd/e2e unaffected by router commits: `node --test skills/10x-pipeline/test/executors.test.mjs`
- Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`

#### Manual Verification:

- `git log --oneline` in a real run worktree shows one `chore(<id>): step <n> <step>` commit per step that left changes, and the subjects pass `node tools/commit-lint.mjs`.

---

## Phase 4: Failed-step rollback

### Overview

After a failed step, snapshot the partial edits to a side ref and reset the run worktree before the next step is decided; undo the reset when the run halts instead. The reset target is the step's `startSha` (Decisions, "Reset target"): commits the failed step made itself leave the branch, stay reachable from the side ref, and the retry redoes them. Phase 4 leaves `codereplan.test.mjs` and `loops-existing.test.mjs` as Phase 1 left them (row 4.2).

### Changes Required:

#### 1. Rollback in `next`

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: When `meta.isolated` and the last executed entry is an eligible failure, snapshot and reset right after `attachResult`, before risk, rigor and `decide`, so the next step is chosen from the restored files (see Critical Implementation Details). Eligible: `isFailure` (not fallback, not advisory), has a `startSha`, carries no `uncommitted` list, no `signals.needsHuman`, no `rolledBack` and no `kept`. The same-step retry, `plan-replan` or any other next step then starts from `startSha`, and the partial edits of a failed step never reach another step's commit. If the same call ends in a halt, the reset is undone, so the final failure that halts keeps its partial edits in the worktree. A failed tdd or e2e entry with `uncommitted` rows is not rolled back: the `implement-retry` step that follows needs those ticks and that uncommitted code (`retryRows`, `prompts/executor-retry.md`). An entry with `signals.needsHuman` is not rolled back: the run halts on it before any decision.

**Contract**: confirm again the cwd is a linked worktree with HEAD on `meta.branch` (else halt, never reset the main checkout). Run the shared checks of Phase 3 §1 except the empty index: a failed step may have staged files, for example after a hook rejected its own commit, and the snapshot takes them. `git add -A`; `git write-tree`; `git commit-tree <tree> -p HEAD -m "agent-smith: failed step <n> (<step>)"`; `git update-ref refs/agent-smith/<id>/failed-<n> <commit>` (a ref of that name from an earlier attempt is overwritten); `git reset --hard <startSha>`; no `git clean` (the snapshot holds untracked files; ignored files stay); set the file times back from `before.mtimes` (Critical Implementation Details, "File times"; the times the step left are read before `git add -A` and kept in memory for the undo); write the in-memory `run.jsonl` (entry gets `rolledBack: <ref>`) and `meta.json` back. A git failure halts with the message; the ref, if created, stays. The undo on halt follows Critical Implementation Details. `rollback.test.mjs` also covers: a failed implement that ticked every row is followed by `implement` for the restored pending phase, not `impl-review`, and the new entry's `before.autoDone` equals the count at `startSha`; a failed tdd entry with `uncommitted` rows is not reset and `implement-retry` sees its ticks; a second implement failure followed by `plan-replan` is reset; the third failure that hits the attempt cap halts with the partial edits back in the worktree, `kept: <ref>` on the entry and the side ref present, and the next `next` call does not reset again; a failed step that left a staged file is snapshotted with it; a failed implement step that made a phase commit and ticked its rows is reset to `startSha`, the phase commit is an ancestor of the side ref, and the retry's `before.autoDone` excludes those ticks; a failed first step of a run whose change folder held `research.md` and a modified `change.md` at `init` is rolled back with both files intact; a run that starts with a reviewed plan (no `plan` or `plan-review` logged) whose first implement ticked rows and failed is followed by `implement`, not `plan-review`; a run that starts with a review older than its plan, whose `plan-review` rewrote the review file and failed, is followed by `plan-review` again; after the undo on halt the three files carry the times the failed step left.

#### 2. Report

**File**: `skills/10x-pipeline/scripts/route.mjs`

**Intent**: `report.md` and `status` list rolled-back and kept steps with their side ref so the human can inspect or cherry-pick.

**Contract**: one line per rolled-back or kept step under a `## Rolled-back steps` section, present only when there is one; a kept step is marked `kept (run halted)`.

### Success Criteria:

#### Automated Verification:

- Rollback tests pass (ref holds partial files incl. untracked, worktree at `startSha`, router files intact, commits made by the step stay reachable, main checkout refused, final failure not reset, require false no reset): `node --test skills/10x-pipeline/test/rollback.test.mjs`
- Re-plan and loop tests unchanged: `node --test skills/10x-pipeline/test/codereplan.test.mjs skills/10x-pipeline/test/loops-existing.test.mjs`
- Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`

#### Manual Verification:

- After a forced failed step in a scratch worktree run, `git show refs/agent-smith/<id>/failed-1 --stat` lists the partial edits and `git status` in the worktree is clean.

---

## Phase 5: Cheaper first implement attempt

### Overview

Run the first implement attempt one tier lower; retries run higher. A failed cheap attempt is neutral for rigor and the step budget.

### Changes Required:

#### 1. Policy and tier logic

**File**: `skills/10x-pipeline/policy.json`, `skills/10x-pipeline/scripts/route.mjs`

**Intent**: Add `escalation.firstAttempt` and apply it in `tierFor` before `settle`. Add the `cheap: true` flag to the log entry. Exclude cheap failures from the rigor failure count and from the step budget.

**Contract**: `escalation.firstAttempt: { drop: 1, templates: ["implement","implement-segment","implement-tdd","implement-e2e"] }` (`drop: 0` or a missing block turns it off). Applies when `meta.isolated`, template listed, no earlier failed entry of the same step, `fails === 0`, simple discount 0. `tierWhy` gets `-1 first attempt`. `cheap: true` goes on the entry only when the drop survived the clamp and the effort floor (the final tier is below the final tier without the drop, as `simple` is set only from a saved discount, `route.mjs:1833`); an absorbed drop (a tdd or e2e step at `standard` or `thorough`, whose floor is the base tier; a step already at `minTier`) sets no `cheap` flag, `tierWhy` reads `-1 first attempt not applied (clamp or floor)`, and its failure counts as an ordinary one for rigor and budget. `rigorInputs` counts `isFailure(e) && !e.cheap`. `budgetSteps` also leaves out an entry with `cheap` and `ok === false`, as it does for a failed advisory entry. `trailingFailures`, `maxAttemptsPerStep` and the `codeReplan` failure count still see the cheap failure. The score guards (`failed`, down shift) treat the drop as a discount (no stacked down shift). The clamp and effort floor still bound it. `firstattempt.test.mjs` also walks a `lean` run whose cheap attempt fails (the level stays `lean`, the budget stays 10, the failed entry is not counted) and checks that a later implement step of a run with one implement failure gets no drop, and that a tdd step at `thorough` whose drop the floor absorbed carries no `cheap` flag and its failure counts for rigor.

#### 2. Docs of the tier list

**File**: `skills/10x-pipeline/SKILL.md`, `README.md`

**Intent**: Add the rule to "How the tier moves" and the routing bullets (AGENTS.md coding-style rule), including the rigor exception, and add the budget exception to the budget bullet (`SKILL.md:107`) and README "Budget".

**Contract**: no model, effort or tier name in `SKILL.md` beyond what it documents.

### Success Criteria:

#### Automated Verification:

- First-attempt tests pass (drop applied, no stacking with discount, retry two tiers above first, tdd/e2e floor holds, failure does not raise rigor, `drop: 0` and not isolated unchanged, no down shift stacking): `node --test skills/10x-pipeline/test/firstattempt.test.mjs`
- Score tests pass: `node --test skills/10x-pipeline/test/score.test.mjs`
- Budget tests pass: `node --test skills/10x-pipeline/test/budget-executors.test.mjs skills/10x-pipeline/test/route.test.mjs`
- Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`

#### Manual Verification:

- `status` of a scratch run shows the first implement entry one tier below the pre-change value and the retry at base plus one.

---

## Phase 6: ADR-010, AGENTS.md rule and docs

### Overview

Record the widened git-write rule and update every document that states it.

### Changes Required:

#### 1. ADR

**File**: `docs/ADR/ADR-010-run-worktree-step-commits-and-rollback.md`

**Intent**: Decide the worktree isolation (worktree under the project root, copy only when the run branch is created), the start commit and step commits, side-ref rollback (plumbing, no hooks; rollback before the decision, undo on halt, file times kept for `decide`), the cheap first attempt and its rigor/budget treatment, the first-plan bump of -2, and the effort floor that also checks the rung's effort (keeps ADR-003 on a ladder not ordered by effort), in the ADR-004 scenario form; list the unverified assumptions (subagent working directory in a live run and for an orchestrator inside a subagent, the protected-path exemption for a worktree made by `git worktree add` with `EnterWorktree` as the untested fallback, hook behavior on `git add -A`, cost effect). Name the three decisions this unattended plan took for the owner (first-plan bump, cheap failure outside rigor and budget, the two-literal edit of `loops-existing.test.mjs`), with their evidence and how each is reversed (an override for the first two; for the third, a ladder that keeps old indexes is not available once the rung is inserted, so the reversal is the owner's call on the rule). Record the reset target as the change notes' decision, its cost (a failed step's own commits are redone, also after a cheap first attempt) and the alternative (reset to the head the failed step left), and the `scoreShift.effective` reading of 2 when the floor skips a rung.

**Contract**: status Proposed, same header fields as ADR-009; the cost claim is a hypothesis with a decision rule for an A/B of the first-attempt drop (cost per pair, failure count, rigor; a redone phase after a reset counts in the cost of its pair), no data yet.

#### 2. AGENTS.md, README, SKILL.md, baseline procedure

**File**: `AGENTS.md`, `README.md`, `skills/10x-pipeline/SKILL.md`

**Intent**: Rewrite Hard Rule 3 to list the exact allowed git writes (pre-archive commit, start commit of the first `init`, step commit, side-ref snapshot, reset and its undo in the run worktree only), update the ADR range and test list (new test files; the `loops-existing.test.mjs` exception already added in Phase 1 points at ADR-010), README sections (archive, new "Run isolation" with the worktree location and run root (a project root below the repository top level included), the opt-out (no git, or `isolation.require` not `true`) and the four Start cases (an in-flight run stays in the main checkout; a resume copies nothing, so a human edits the run's files in the worktree), the start commit and the rollback paragraph: reset to `startSha`, a failed step's own commits leave the branch and stay under the side ref, the retry redoes them, and uncommitted edits present at step start (a human's edits after a halt, fallback leftovers) are swept into the side ref too, so commit them before resuming; "PR comment (opt-in)": an isolated run posts from the main checkout with `--report` naming the worktree's report, so the comment goes to the pull request of the main checkout's branch; baseline: `git worktree add -b agent-smith/<id>-baseline <path> <baseSha>` so init passes, the input files are those of the routed run's start commit (`git show --name-only <meta.startCommit>`, without `agent-smith/`), and `compare` takes `--routed <routed run root>` because the main checkout's change folder holds no run log; the baseline arm is isolated too, so it runs the first-attempt rule, which changes no model on its all-`sonnet/high` ladder and treats a failed first attempt as the routed arm does), provenance note that `isolation` is a hashed section, and the `feat!` release note. The README "PR comment (opt-in)" group keeps the needles `pr-comment.test.mjs:745` checks.

**Contract**: `tools/version-check.mjs` untouched; no version edit.

### Success Criteria:

#### Automated Verification:

- Version and commit lint tools pass: `node tools/version-check.mjs && node tools/commit-lint.mjs main..HEAD`
- Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- Docs name the new rule: `grep -n "refs/agent-smith" AGENTS.md README.md docs/ADR/ADR-010-run-worktree-step-commits-and-rollback.md`

#### Manual Verification:

- Owner reads ADR-010 and the AGENTS.md rule rewrite and confirms the widened git-write boundary.

---

## Testing Strategy

### Unit Tests:

- Ladder table and the first-plan paths; tier math for the first-attempt drop and its guards; rigor input and step budget excluding cheap failures.
- Isolation checks with real `git worktree add` scratch repos; commit, empty-commit skip, hook rejection; rollback content of the side ref.

### Integration Tests:

- A scripted run (init, next, failed result, next) in a linked worktree: log fields `startSha`, `commit`, `rolledBack`, retry tier, restored router files.
- A failed implement that ticked every row: the next step is the implement retry chosen from the restored plan. A failure that hits the attempt cap: the halt restores the partial edits and marks the entry `kept`.
- A run that starts with a reviewed plan and no logged plan step: a rolled-back failed implement keeps the review fresh (file times restored).
- A fresh isolated `init`: the start commit holds the copied change folder, and the first entry's `startSha` is that commit; a second `init` after a rejected start commit makes it.

### Manual Testing Steps:

1. Run a trivial change through `/agent-smith:10x-pipeline` in `acceptEdits` and check branch, worktree and commit list; also check that the step subagents' Edit and Write under `.claude/worktrees/agent-smith-<id>` ran without a permission prompt (the protected-path question of Key Discoveries). A prompt there means the `cd` approach needs the `EnterWorktree` fallback named in ADR-010. Re-invoke the pipeline after a halt and check that the worktree's change folder was not overwritten; with `--pr-comment` on a branch with an open pull request, check that the comment reached that pull request.
2. Force a failing implement step and inspect the side ref and the retry tier.
3. Run the baseline procedure with `-b` and `compare`.

## Performance Considerations

One `git add -A` and `git commit` per step; `status`/`diff` on the worktree only. Each call has `isolation.gitTimeoutMs`.

## Migration Notes

Shipped `isolation.require: true` halts a run started in the main checkout. Override with `{ "isolation": { "require": false } }` to keep the old behaviour. In-flight runs without `meta.isolated` on a project that sets `require` true are halted at `init` on resume, and the halt names the override; they finish with it. The orchestrator resumes such a run in the main checkout (Start case 1), so its log is never copied into a worktree, and the router never adds `meta.isolated` to a run with executed steps. Baseline worktrees now need a branch. Logged tier numbers are not migrated: a run resumed across the upgrade reads old-ladder tiers where the router reuses one from its log (`floorTier` of `fix`, `route.mjs:912`), one rung lower for old tiers 4 and up, and provenance records the ladder change as drift. Finish in-flight runs on the old version.

## References

- Change notes: `context/changes/worktree-step-commits/change.md`
- Related research: `context/changes/worktree-step-commits/research.md` (follow-up for plan review round 2, F1-F5)
- Plan review: `context/changes/worktree-step-commits/reviews/plan-review.md`
- Characterization rule: `skills/10x-pipeline/test/loops-existing.test.mjs:1-3`, `AGENTS.md:23`, `context/archive/2026-10-30-pre-plan-steps/plan.md:117-142`
- Effort floor: `docs/ADR/ADR-003-rigor-gated-routing.md:58-63`, `route.mjs:1767-1775` (`effortFloorTier`), `route.mjs:1809-1829` (`settle`, `scoreShift.effective`); `docs/ADR/ADR-007-llm-complexity-scorer-as-a-routed-step.md:118`
- Router: `skills/10x-pipeline/scripts/route.mjs` (`tierFor`, `next`, `decide` with its mtime fallbacks `:827-829` and `:884-886`, `attachResult`, `archiveDone` and its resume test `:2126-2128`, `rigorInputs`, `budgetSteps`, `isFailure`, `verifyImplement`, `init` `:2745-2806`)
- PR comment: `skills/10x-pipeline/scripts/pr-comment.mjs:97` (report path), `:115` (current branch); `skills/10x-pipeline/test/pr-comment.test.mjs:674-748` (SKILL.md and README checks)
- Nested project root: `skills/10x-pipeline/test/archive.test.mjs:461`, `skills/10x-pipeline/test/churn.test.mjs:202`
- Policy: `skills/10x-pipeline/policy.json`, `skills/10x-pipeline/baseline-policy.json`
- Cost evidence: `context/foundation/prd.md` (goal, FR-003), README "Baseline comparison" and "Scorer A/B check", `docs/ADR/ADR-001-phased-complexity-routing.md`
- Test helper precedent: `skills/10x-pipeline/test/helpers.mjs:42`
- Prior ADR: `docs/ADR/ADR-009-managed-agent-patterns.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: opus/medium rung and renumbering

#### Automated

- [x] 1.1 New ladder test passes: `node --test skills/10x-pipeline/test/ladder.test.mjs`
- [x] 1.2 Compare and provenance tests pass with the 8-rung baseline: `node --test skills/10x-pipeline/test/compare.test.mjs skills/10x-pipeline/test/provenance.test.mjs`
- [x] 1.3 Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`

#### Manual

- [ ] 1.4 `node skills/10x-pipeline/scripts/route.mjs init <id>` on a scratch change prints the same first-step model and effort as before the change.

### Phase 2: Run isolation gate

#### Automated

- [ ] 2.1 Isolation tests pass (main checkout halts, linked worktree on `agent-smith/x` passes, detached halts, default branch halts, require false unchanged): `node --test skills/10x-pipeline/test/isolation.test.mjs`
- [ ] 2.2 Prompt rule form passes: `node --test skills/10x-pipeline/test/rules.test.mjs`
- [ ] 2.3 Skill content test passes: `node --test skills/10x-pipeline/test/skill-loop.test.mjs`
- [ ] 2.4 Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`

#### Manual

- [ ] 2.5 In a live run the subagent edits files only under the worktree path, not the main checkout (confirms the prompt line works when the Agent tool does not inherit the shell directory).

### Phase 3: Per-step commits

#### Automated

- [ ] 3.1 Step commit tests pass (commit made, empty commit skipped, failed step not committed, hook failure halts and unstages, `startSha` logged, require false makes no commit): `node --test skills/10x-pipeline/test/stepcommit.test.mjs`
- [ ] 3.2 Archive tests unchanged: `node --test skills/10x-pipeline/test/archive.test.mjs`
- [ ] 3.3 Commit evidence of tdd/e2e unaffected by router commits: `node --test skills/10x-pipeline/test/executors.test.mjs`
- [ ] 3.4 Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`

#### Manual

- [ ] 3.5 `git log --oneline` in a real run worktree shows one `chore(<id>): step <n> <step>` commit per step that left changes, and the subjects pass `node tools/commit-lint.mjs`.

### Phase 4: Failed-step rollback

#### Automated

- [ ] 4.1 Rollback tests pass (ref holds partial files incl. untracked, worktree at `startSha`, router files intact, commits made by the step stay reachable, main checkout refused, final failure not reset, require false no reset): `node --test skills/10x-pipeline/test/rollback.test.mjs`
- [ ] 4.2 Re-plan and loop tests unchanged: `node --test skills/10x-pipeline/test/codereplan.test.mjs skills/10x-pipeline/test/loops-existing.test.mjs`
- [ ] 4.3 Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`

#### Manual

- [ ] 4.4 After a forced failed step in a scratch worktree run, `git show refs/agent-smith/<id>/failed-1 --stat` lists the partial edits and `git status` in the worktree is clean.

### Phase 5: Cheaper first implement attempt

#### Automated

- [ ] 5.1 First-attempt tests pass (drop applied, no stacking with discount, retry two tiers above first, tdd/e2e floor holds, failure does not raise rigor, `drop: 0` and not isolated unchanged, no down shift stacking): `node --test skills/10x-pipeline/test/firstattempt.test.mjs`
- [ ] 5.2 Score tests pass: `node --test skills/10x-pipeline/test/score.test.mjs`
- [ ] 5.3 Budget tests pass: `node --test skills/10x-pipeline/test/budget-executors.test.mjs skills/10x-pipeline/test/route.test.mjs`
- [ ] 5.4 Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`

#### Manual

- [ ] 5.5 `status` of a scratch run shows the first implement entry one tier below the pre-change value and the retry at base plus one.

### Phase 6: ADR-010, AGENTS.md rule and docs

#### Automated

- [ ] 6.1 Version and commit lint tools pass: `node tools/version-check.mjs && node tools/commit-lint.mjs main..HEAD`
- [ ] 6.2 Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- [ ] 6.3 Docs name the new rule: `grep -n "refs/agent-smith" AGENTS.md README.md docs/ADR/ADR-010-run-worktree-step-commits-and-rollback.md`

#### Manual

- [ ] 6.4 Owner reads ADR-010 and the AGENTS.md rule rewrite and confirms the widened git-write boundary.
