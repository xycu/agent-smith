# ADR-010: Run every change in its own worktree, commit each step, roll back a failed step, and make the first implement attempt cheaper

- **Status:** Proposed (unattended reading, owner confirmation pending)
- **Date:** 2026-11-04
- **Deciders:** unattended implementation run of change `worktree-step-commits`; the repository owner confirms or changes the readings below
- **Origin:** change `worktree-step-commits` (`context/changes/worktree-step-commits/change.md`, `plan.md`, `research.md` and `reviews/plan-review.md`). It widens the router's git-write rule in `AGENTS.md` (Hard Rules), which before this change allowed only the pre-archive commit of ADR-003 ("Archive adapter"). That commit is unchanged.

## Context

- Before this change a run worked in the main checkout. The router wrote no git state except the pre-archive commit of an `--archive` run (ADR-003, "Archive adapter"). A failed step left its partial edits in the working tree, and the retry or the next step started from them.
- `decide` is file-driven: it reads `plan.md` `## Progress`, the review files and their file times, and the log. A partial edit therefore changes the next decision. After a failed implement step that ticked every row, the next step was `impl-review`, not a retry.
- Execution commits already happen inside steps (`/10x-goal-implement` commits each green phase, `fix` and the review apply rules commit). The router could not say which commit a step started from, so it could not undo a step.
- The ladder had 7 rungs, with no Opus rung below `high` effort. A move up from `sonnet/high` went straight to `opus/high`.
- The project counts Opus tokens as cost (`prd.md`, README "Baseline comparison", the scorer A/B rule of ADR-007). The first implement attempt ran on the base tier although a failed attempt is retried one tier up anyway.
- A subagent starts in the main conversation's working directory, and a subagent never carries a `cd` over. Claude Code resets the main shell after a `cd` outside the project directory, and the Bash sandbox writes only under the working directory (research F1).
- The run was unattended. Every decision here is evidence-backed and was listed as an assumption of the step that took it; the owner has not read them yet.

## Decision

Four linked rules. All new git behavior is gated on `meta.isolated: true`, which only the first `init` of a run in a linked worktree sets, and only while `isolation.require` is the boolean `true` (the shipped default). With `{ "isolation": { "require": false } }` in the project override the router behaves as before this change.

Rules, written as scenarios (the form of ADR-004):

### Run isolation

**GIVEN** `isolation.require` is `true` **WHEN** `init` starts a run outside a linked worktree, on a detached HEAD, on a default branch or on a branch outside `isolation.branchPrefix` **THEN** the router **MUST** halt before it writes anything.

**GIVEN** a log with executed steps and no `meta.isolated` **WHEN** `init` resumes it with `isolation.require` `true` **THEN** the router **MUST** halt and name the opt-out, so a run is isolated from its first step or not at all.

**GIVEN** a project root **WHEN** the orchestrator makes the run worktree **THEN** it **MUST** put it at `<project root>/.claude/worktrees/agent-smith-<change-id>` on the branch `agent-smith/<change-id>`, and copy the change folder into it with its file times only when it creates the run branch.

**GIVEN** an isolated run **WHEN** the router returns a prompt **THEN** it **MUST** start the prompt with the working-directory rules of `prompts/worktree.md`, which name the run root.

### Start commit and step commits

**GIVEN** the first `init` of an isolated run **WHEN** the isolation checks passed and `meta.json` is written **THEN** the router **MUST** commit the change folder as `chore(<id>): start run` before the first step is created, record `meta.startCommit` and keep `meta.baseSha` as HEAD before that commit.

**GIVEN** an isolated run whose last step is verified ok and has no `commit` key **WHEN** `next` runs **THEN** the router **MUST** commit what the step left as `chore(<id>): step <n> <step>` before it reads any file for the next decision, and record the commit, or `null` when nothing changed, on the entry.

**GIVEN** any router commit **WHEN** it is made **THEN** the router **MUST NOT** pass `--no-verify`, push, or set a `-c` option other than `core.quotePath=false`.

**GIVEN** a start or step commit that fails **WHEN** the router handles the failure **THEN** it **MUST** unstage its own add and halt with git's message.

### Failed-step rollback

**GIVEN** an isolated run whose last step failed, has a `startSha`, carries no `uncommitted` list and no `signals.needsHuman`, and was not rolled back or kept before **WHEN** `next` runs **THEN** the router **MUST** snapshot the worktree under `refs/agent-smith/<id>/<run>/failed-<n>` with plumbing (`git add -A`, `write-tree`, `commit-tree -p HEAD`, `update-ref`), reset the worktree with `git reset --hard <startSha>`, set back the file times `decide` compares, and write the router state back, all before risk, rigor and `decide` read the files.

**GIVEN** a side ref **WHEN** the router names it **THEN** `<run>` **MUST** be the first 12 hex characters of the run's start commit (`meta.startCommit`, or the `startSha` of the run's first step when the start commit was empty), so two runs of one change id in one repository never share a ref.

**GIVEN** an isolated run **WHEN** `next` creates a step entry and `git rev-parse HEAD` fails, times out after `isolation.gitTimeoutMs` or prints no hash **THEN** the router **MUST** halt before it logs the step and name the cause, because a step without a `startSha` cannot be rolled back.

**GIVEN** the cwd is not a linked worktree on `meta.branch` **WHEN** a rollback would run **THEN** the router **MUST** halt before any git write.

**GIVEN** a `next` call that rolled back **WHEN** it ends in a halt **THEN** the router **MUST** undo the reset (`git reset --hard <ref>`, then `git reset -q <ref>^`), set back the file times the failed step left and mark the entry `kept`, so the final failure keeps its partial edits for a human.

**GIVEN** an entry marked `rolledBack` or `kept` **WHEN** a later `next` runs **THEN** the router **MUST NOT** roll it back again.

### Cheaper first implement attempt

**GIVEN** an isolated run and a step whose template `escalation.firstAttempt.templates` lists **WHEN** that step has no failed entry in the run and no simple-change discount applies **THEN** the router **MUST** lower its tier by `escalation.firstAttempt.drop` before the clamp and the effort floor.

**GIVEN** a first-attempt drop that survived the score shift, the clamp and the floor (the final tier is below the tier the step gets without the drop and without the shift) **WHEN** that attempt fails **THEN** the router **MUST NOT** count the failure for `rigor.fromFailures` or the step budget.

**GIVEN** a failed cheap first attempt **WHEN** the router computes the retry tier, checks `maxAttemptsPerStep` or counts implement failures for the code re-plan **THEN** it **MUST** count the failure as any other.

**GIVEN** a first-attempt drop that applied **WHEN** the score shift is computed **THEN** the router **MUST NOT** add a down shift on top of it.

### The ladder and the effort floor

**GIVEN** the ladder **WHEN** the policy ships **THEN** it **MUST** have `opus/medium` at index 4.

**GIVEN** the inserted rung **WHEN** the step pins are renumbered **THEN** every step **MUST** keep the model and effort it had at its base tier.

**GIVEN** an interactive step at a level with `rigor.minEffort` **WHEN** the floor is applied **THEN** the router **MUST** also move the step up past a rung whose own effort ranks below the floor, so ADR-003's effort guarantee holds on a ladder that is not ordered by effort.

**GIVEN** an interactive step with a floor **WHEN** it failed `k` times in a row **THEN** the router **MUST** move it `k` rungs up counting only rungs whose effort clears the floor (a below-floor rung it starts on or passes is skipped for free), so each failed attempt still raises its effort: a step that starts on `sonnet/high` runs `opus/high` on its second attempt and `opus/xhigh` on its third, as before the inserted rung.

### What each rule covers

- Allowed git writes of the router, all in the run worktree except the archive commit: the start commit of the first `init`, the step commits, the side-ref snapshot under `refs/agent-smith/<id>/<run>/failed-<n>` (`git add -A`, `write-tree`, `commit-tree`, `update-ref`), the `git reset --hard <startSha>` of the rollback and the two resets of its undo, and the pre-archive commit of ADR-003. A failed start or step commit runs a `git reset` of the router's own add. A failed rollback halts and leaves what it staged; the side ref, once made, keeps the edits.
- The side ref is made with plumbing, so no hook runs on it. Step and start commits run every hook and signing.
- `startSha` is HEAD when the entry is created, so a file that is untracked or modified at step start is staged by the snapshot and removed or reverted by the reset. The start commit keeps the orchestrator's copy of the change folder (`research.md`, `frame.md`, a ready `plan.md`, an edited `change.md`) out of reach of the first rollback.
- File times: each entry of an isolated run records `before.mtimes` for `plan.md`, `reviews/plan-review.md` and `reviews/impl-review.md` (0 when absent). The rollback sets them back after the reset; the undo sets the times the failed step left. A run that starts with a reviewed plan therefore keeps its review fresh after a rolled-back implement, and a rolled-back plan review that rewrote its file runs again.
- Not rolled back: a `blocked` fallback step, a failed `score` attempt, an entry with `uncommitted` rows (the `implement-retry` step needs those ticks and that code), an entry with `signals.needsHuman` (the run halts on it). What a fallback or a failed score attempt leaves goes into the next successful step's commit; when the next step fails instead, its rollback resets those leftovers too, and its side ref keeps them.
- `report.md` lists rolled-back and kept steps under `## Rolled-back steps` with their side ref; `status` shows `rolledBack`, `kept` and the short `commit`.
- `escalation.firstAttempt` ships `{ "drop": 1, "templates": ["implement", "implement-segment", "implement-tdd", "implement-e2e"] }`. `implement-retry`, re-plans and `fix` never get it. A drop the clamp or the floor absorbed (a tdd or e2e step on the floor, a step on its `minTier`) sets no `cheap` flag, reads `-1 first attempt not applied (clamp or floor)` in `tierWhy`, and its failure counts as usual. A drop that an execution-sum up shift cancels (+1 and -1, so the step runs on the tier it gets without both) sets no `cheap` flag either and reads `-1 first attempt not applied (cancelled by the score shift)`. The retry of a cheap attempt runs two tiers above it.
- Intended interactions of a failed cheap attempt (owner decision, review F10): it is neutral only for `rigor.fromFailures` and the step budget. It still counts as a failed implement attempt everywhere else, so the implementation review that follows it runs one tier up (the `struggled` bump), the simple-change discount is withheld for the rest of the run, and the score down shift is blocked for the rest of the run (both read "no failed step").

## Decisions taken for the owner

The run took three decisions that the change notes did not settle. Each is reversible.

| Decision | Evidence | How to reverse it |
| --- | --- | --- |
| The plain first-plan bump `complexity.firstPlan.bump.plain` is -2 instead of -1, so a short or plain goal keeps its first plan on `sonnet/high` (`sonnet/medium` for a short goal at `lean`) | the PRD goal of a lower weekly usage and FR-003; README "Baseline comparison" on Opus tokens; the scorer A/B rule that turns the scorer off when Opus tokens rise; the change notes describe the rung as a shift of tier indexes | `{ "complexity": { "firstPlan": { "bump": { "plain": -1 } } } }` in the project override puts the plain-goal first plan on `opus/medium` |
| A failed cheap first attempt is outside `rigor.fromFailures` and the step budget, as a failed `score` attempt is | the change notes ask for a neutral failure; README "Budget" sizes each level for one failed step and its retry, which a planned cheap failure would use up; a `lean` run keeps its budget of 10 | `{ "escalation": { "firstAttempt": { "drop": 0 } } }` turns the drop off, and with it the exception |
| `loops-existing.test.mjs`, the characterization of the RETHINK/REVISE loop, got one edit: the two tier literals 6 to 7 and 5 to 6 | the file pins model and effort routes (`opus/max`, `opus/xhigh`), which the renumbering keeps; the change notes list tests among the places whose tier indexes shift; no check compares the file's bytes; `ladder.test.mjs` pins both routes by name | not by an override: a ladder that keeps the old indexes no longer exists once the rung is inserted. The owner decides whether the rule "never edit it" holds with this one recorded exception (`AGENTS.md`, test list) |

## Owner decisions after the implementation review

The owner decided four findings of `reviews/impl-review.md`:

- F1, escalation: each failed attempt of an interactive step moves it to the next rung that clears its effort floor. Without this a step that starts on `sonnet/high` ran `opus/high` on both its second and third attempt, because +1 landed on `opus/medium`, which the floor skipped, and +2 landed on `opus/high`. Paths of the Phase 1 table that change: an interactive base-3 step (`impl-review`, `research`, a plain-goal first plan) at `standard` or `thorough` climbs 3, 5, 6 (`sonnet/high`, `opus/high`, `opus/xhigh`); the 3-5 phase `impl-review` and a plain-goal first plan with a score up shift reach 6 on their first retry; `plan-review` (base 2, below the floor) keeps 3, 3, 5 (`sonnet/high`, `sonnet/high`, `opus/high`), the route it had on the 7-rung ladder: the floor lifts it to `sonnet/high` on its first and second attempt, so its first failure moves it from base 2 to the rung the floor already gave it. A non-interactive step and a ladder ordered by effort are unchanged.
- F3, side-ref name: `isolation.rollback.ref` ships `refs/agent-smith/{id}/{run}/failed-{n}`, `{run}` being the 12-character run token above. The baseline and scorer A/B arms run one change id in one repository, and a re-run after a deleted branch reuses the id, so `n` alone collided.
- F9, `startSha`: read with `isolation.gitTimeoutMs`; a failure halts the run before the step is logged.
- F10, the first-attempt drop: `cheap` needs a net drop after the score shift, the clamp and the floor; the other interactions are listed under "What each rule covers" as intended.

## Reset target

A failed step is reset to its `startSha`, as the change notes decide ("hard-reset the worktree to the step's start commit").

- Cost: commits the failed step made itself, such as the green phase commits of `/10x-goal-implement`, leave the branch with the reset. They stay reachable from the side ref, whose parent is the head the step left, and the retry redoes them. This holds after a cheap first attempt too, so a cheap failure can cost a redone phase.
- Alternative: reset to the head the failed step left. It keeps green phase commits, and `/10x-goal-implement` resumes at the first pending row, at the cost of a second start point per step and a `before.autoDone` that no longer matches `startSha`.
- No failure data exists to choose between them: the four archived runs hold 34 executed steps and no failed one (research F4).

## Effective score shift

`scoreShift.effective` keeps its definition from ADR-007: the final tier with the shift minus the final tier without it. When the effort floor skips `opus/medium`, a shift of 1 reads as 2. The report reads the field only as applied or not, so `report.md` text does not change.

## Consequences

- `isolation.require` ships `true`. A run in the main checkout halts at `init` and names the opt-out: a breaking change, released as `feat!`.
- Every step of an isolated run ends at a known commit, and a failed step never reaches another step's commit. The branch history of a run is one start commit, then one step commit per step that changed something, with the subagents' own commits between them.
- A human's uncommitted edits in the worktree after a halt are swept into the next failed step's side ref. Commit them before resuming.
- The change folder in the main checkout becomes a stale copy. It must be removed or stashed before the run branch is merged.
- The router still never pushes, never calls `gh` and never deletes a branch, a worktree or a side ref.
- This ADR amends ADR-003 ("Archive adapter"): its rule that a run started without `--archive` runs no git command that writes the index or history, and its list of the router's git writes, now hold for a run that is not isolated. An isolated run adds the writes listed under "What each rule covers".

## Alternatives considered

| Alternative | Verdict | Reason |
| --- | --- | --- |
| Claude Code's `isolation: "worktree"` on the Agent tool | rejected | It makes one worktree per subagent and cleans it up, while the steps of a run must share one worktree and one branch. |
| `git stash` for the snapshot | rejected | A stash needs `-u` for untracked files and is one stack shared by every worktree of the repository, addressed by position; a named ref per failed step is easier to find and never collides. |
| `git commit` on a throwaway branch for the snapshot | rejected | It moves HEAD and runs hooks on partial, often broken, edits. Plumbing records the same tree without either. |
| A worktree outside the project directory | rejected | Claude Code resets the shell after a `cd` outside the project, and the sandbox and the `acceptEdits` mode cover only the working directory. |
| Deciding the next step first, then rolling back | rejected | `decide` reads files: it would act on files the reset then removes, and a retry logged before the reset would record a `before.autoDone` that counts discarded ticks. |
| No start commit | rejected | The orchestrator's copy of the change folder is untracked in a fresh worktree, so a rolled-back first step would delete `research.md`, `frame.md` or a ready `plan.md`. |

## Unverified assumptions

- A subagent of a live run works in the worktree. The docs say a subagent starts in the main conversation's working directory; an orchestrator that itself runs inside a subagent never carries a `cd` over. The router therefore names the run root in every prompt, and the orchestrator runs each router call with `cd` into it. Not checked live.
- `.claude` is a protected directory. The documented exemption names "Claude's own git worktrees under `.claude/worktrees/`"; whether a worktree made by plain `git worktree add` counts is not stated. If it does not, Edit and Write under the worktree prompt even in `acceptEdits`, and an unattended run stalls. The untested fallback is to make the worktree with the `EnterWorktree` tool.
- Hooks: git runs no hook on `git add -A`, `write-tree`, `commit-tree` or `update-ref`. A hook on the step commit can stage or write files; the post-commit checks halt on that.
- Cost: no run has measured whether the cheaper first attempt saves tokens once its failures, retries and redone phases are counted.

## Live checks

All pending. A human runs each check with the plugin installed from the branch and records the result here.

| Check | What it settles | Result |
| --- | --- | --- |
| Live check 1 | In a live run the subagent edits files only under the worktree, not in the main checkout, and Edit and Write under `.claude/worktrees/` do not prompt in `acceptEdits`. | Pending |
| Live check 2 | `git log --oneline` in a run worktree shows the start commit and one `chore(<id>): step <n> <step>` commit per step that left changes, and the subjects pass `node tools/commit-lint.mjs`. | Pending |
| Live check 3 | After a forced failed step, `git show refs/agent-smith/<id>/<run>/failed-<n> --stat` lists the partial edits and `git status` in the worktree is clean. | Pending |

## Decision rule

Fixed before any run. The cost claim of the cheaper first attempt is a hypothesis, and no pair has run yet.

Each pair is one change run twice from the same `baseSha`, both arms isolated, `escalation.firstAttempt.drop` `0` as the baseline and `1` as the routed side, compared with `compare --unpinned`. The arms alternate which runs first and run close in time. A pair that is not comparable is recorded with its reasons and does not count. The cost of a pair includes every redone phase after a reset. The drop stays on only when all three hold over at least 5 comparable pairs:

1. The median `dropPercent` is above 0, and above the absolute `dropPercent` of one A/A pair (drop `0` on both arms).
2. The sum of failed implement attempts of the routed arm is at most the baseline's plus one per pair (the cheap attempt may fail once).
3. No routed run ends at a higher rigor level than its baseline, and no routed run halts where its baseline ended `done`.

Anything else, including fewer than 5 comparable pairs, sets `escalation.firstAttempt.drop` to `0` in `policy.json`; the router does not change.

## A/B result

Pending. A human runs the pairs and records here, per pair, `dropPercent`, `tokens.byModel`, `tokens.byTier`, the failed implement attempts and the rigor level of both arms, and the reasons of every pair that is not comparable, then the decision.
