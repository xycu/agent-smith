# Worktree Isolation, Per-Step Commits, opus/medium Tier and Cheaper First Implement Attempts — Plan Brief

> Full plan: `context/changes/worktree-step-commits/plan.md`
> Research: `context/changes/worktree-step-commits/research.md`

## What & Why

Pipeline runs edit the main checkout and leave no known rollback point. Each run gets its own worktree and branch, each step ends in a commit, and a failed step is snapshotted and reset before the next step is decided. That makes a failed attempt cheap to discard, which lets the first implement attempt run one tier lower, with an `opus/medium` rung added to the ladder from the Anthropic cost docs.

## Starting Point

The router writes git state only in the pre-archive commit (`route.mjs` `archiveDone`). Tiers come from a 7-rung ladder in `policy.json`; `tierFor` computes them. `decide` picks the next step from `plan.md` and the review files, so a failed step's leftovers steer it today. `init` stores `baseSha`. The orchestrator knows nothing about worktrees.

## Desired End State

`init` refuses to run outside a linked worktree on an `agent-smith/` branch. The branch starts with one `chore(<id>): start run` commit of the run's inputs and shows one `chore(<id>): step <n> <step>` commit per productive step. A failed step leaves a snapshot under `refs/agent-smith/<id>/failed-<n>` and the worktree at the step's start commit, and the next step is chosen from the restored files; a halt restores the partial edits instead. The first plan of a short or plain goal keeps its route; the first implement attempt is cheaper and the retry jumps two tiers.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Worktree creator | Orchestrator (`SKILL.md`), `agent-smith/<id>` branch, directory `<project root>/.claude/worktrees/agent-smith-<id>`, run root `<worktree>/<prefix>` for a nested project root (local exclude via `git rev-parse --path-format=absolute --git-path info/exclude` when not ignored); copies the change folder with `cp -Rp` only when it creates the branch, never on a resume; an in-flight run stays in the main checkout; every router call runs as `cd "<run root>" && node ...`; the PR comment runs from the main checkout with `--report` naming the worktree's report; no worktree when the project has no git or its override sets `isolation.require` other than `true`; uncommitted main-checkout paths outside the change folder are listed as not in the run | Agent-tool `isolation: "worktree"` is per subagent and auto-cleaned; Claude Code resets a `cd` outside the project and its sandbox writes only under it; a copy on resume would overwrite the run's state; the pull request belongs to the main checkout's branch | Change notes, Claude Code docs, plan review 2 F1, research F1, `pr-comment.mjs` |
| Commit owner | Router in `next`, `git add -A`, after a verified ok step, before `decide`; plus one `chore(<id>): start run` commit of the change folder in `init`, after `baseSha` and before the first entry, guarded by `meta.startCommit` so a rejected start commit is retried; archive's "already committed" test also checks HEAD's subject in an isolated run | Reuses the pre-archive safety checks; one place; without the start commit a rolled-back first step deletes the untracked change-folder copy (`startSha` is HEAD); step commits leave the folder clean before every `done` | Change notes, plan review 3 F1 |
| Rollback | `commit-tree` snapshot to side ref, `reset --hard` to `startSha`, router files and the file times of `plan.md` and the review files restored, right after the result is read and before `decide`; undone when the call halts; not for `implement-retry` or `needsHuman` entries | `decide` reads files and, while no plan step is logged, their mtimes, so a decision before the reset, or on reset-stamped times, would act on the wrong state; a halt keeps the edits for a human | Plan, plan review F1 |
| Reset target | `startSha`, as the change notes decide: a failed step's own commits (for example goal-implement phase commits) leave the branch, stay under the side ref, and the retry redoes them; ADR-010 names the reset to the failed step's own head as the alternative | The owner fixed the target; no failure data argues against it (0 failed steps in 34 archived) | Change notes, research F4, plan review 2 F4 |
| Run branch | `init` requires a branch starting with `agent-smith/`, stores `meta.branch`; commit and rollback check it | Never commit to or reset a user's own worktree branch | Plan review F4 |
| Rigor and budget | Cheap first-attempt failure excluded from `fromFailures` and from the step budget, like a failed score attempt; at most one per run | The change notes ask for a neutral failure; the budget is sized for one real failure and its retry | Change notes, README "Budget", plan review F7 |
| Drop stacking | Not with the simple-change discount or a score down shift; `cheap` is set only when the drop survived the clamp and floor | Avoid a double discount; an absorbed drop ran at full tier, so its failure is an ordinary one | Plan, plan review 4 F3 |
| Default | `isolation.require: true`, `writeOverride` turns it off for old tests | Same precedent as the `score` switch | Plan |
| Subagent cwd | Router prefixes a worktree rule into every prompt | A subagent starts in the main conversation's directory (docs), but an orchestrator inside a subagent never carries a `cd` over and nothing ran live | Research F1 |
| Tier numbers | Renumber keeps every base tier; `firstPlan.bump.plain` -1 becomes -2, so short and plain first plans keep `sonnet` routes; moves up into Opus land on `opus/medium` for non-interactive steps; the effort floor also checks the rung's effort, so interactive steps at `standard`/`thorough` skip to `opus/high` (Phase 1 table, §5); `scoreShift.effective` stays an index difference and reads 2 when the floor skips a rung | The PRD and README count Opus tokens as cost; `plain: -1` in an override gives the `opus/medium` first plan | PRD, README, plan review F2/F3, research F3 |
| Characterization test | One edit of `loops-existing.test.mjs`: tier literals `:46` 6→7 and `:69` 5→6, nothing else; AGENTS.md records the exception, ADR-010 names it for the owner | The change notes list tests among the places whose tier indexes shift and change repository rules in the open; the routes (`opus/max`, `opus/xhigh`) stay the same | Change notes, research F2, plan review 2 F2 |

## Scope

**In scope:** isolation gate, step commits, rollback with undo on halt, `opus/medium` rung, first-plan bump, first-attempt drop, ADR-010, doc and AGENTS.md rewrites, tests.

**Out of scope:** per-step baseline curve, Fable tier, merge/push/cleanup of the branch, rolling back fallbacks or the final halting failure, `compare` math, `pr-comment.mjs` changes, `opus/medium` for the plain-goal first plan.

## Architecture / Approach

All new behaviour hangs on `meta.isolated`, set at `init` only when `isolation.require` is true and the checks pass. In `next`, the step commit or the rollback runs right after `attachResult`, before risk, rigor and `decide`. Git helpers reuse `runGit` and the archive pre-checks. Phases go bottom-up so each leaves the suite green.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. opus/medium rung | 8-rung ladder, renumbered pins, first-plan bump -2, 8-rung baseline | Missed tier literal changes routing |
| 2. Isolation gate | `init` checks, `meta.isolated`, worktree prompt rule, SKILL.md start | Subagent cwd and protected-path prompts unverified live |
| 3. Per-step commits | Commit per ok step, `startSha`/`commit` in log | Hooks, `add -A` sweeping stray files |
| 4. Failed-step rollback | Side ref snapshot, reset before `decide`, undo on halt, state restore | Resetting the wrong checkout |
| 5. Cheaper first attempt | `firstAttempt` drop, rigor and budget exclusion | Savings unmeasured |
| 6. ADR and docs | ADR-010, AGENTS.md, README, baseline `-b` procedure | Widened git-write boundary needs owner OK |

**Prerequisites:** none beyond Node 24 and git.
**Estimated effort:** ~4-6 sessions across 6 phases.

## Open Risks & Assumptions

- Subagents may not honor the worktree path; Phase 2 manual check covers it.
- `.claude/worktrees/` is a protected path; whether a worktree made by `git worktree add` gets the "Claude's own git worktrees" exemption is not documented. If Edit/Write prompt there in `acceptEdits`, an unattended run stalls; the first live run checks it, `EnterWorktree` is the untested fallback.
- The worktree sits inside the main checkout, so non-git tools that walk it (plain `grep -r`, file watchers) also see the run's copy. A human edits a halted run's files in the worktree: a resume copies nothing from the main checkout.
- A failed step's own phase commits are redone by the retry, also after a cheap first attempt; the A/B of the drop counts that cost.
- The `loops-existing.test.mjs` edit breaks a "never edit" convention once, in the open; the owner confirms it with ADR-010 (row 6.4).
- The cost effect of the cheap first attempt is a hypothesis from the docs, uncalibrated.
- Shipping `isolation.require: true` breaks runs in the main checkout (`feat!`).
- Plumbing snapshot skips hooks on the side ref by design.
- The first-plan bump and the budget treatment were decided in an unattended run from the PRD and README; ADR-010 names them for the owner, each reversible by one override.
- A resumed in-flight run reads its old-ladder tier numbers one rung lower; finish in-flight runs first.
- The run reads the project override, `context/foundation/` and the code as committed at the branch point; uncommitted edits in the main checkout are not in the run (listed at start, README says commit first).
- A `done` run without `--archive` leaves `report.md`, the last `run.jsonl` entry and `meta.json` uncommitted in the worktree; the final message says to commit them before merge or `git worktree remove`.

## Success Criteria (Summary)

- Full suite passes; existing tests unchanged apart from tier renumbering (about 15 literals, two of them in `loops-existing.test.mjs`).
- A live run leaves a clean per-step commit history and a recoverable snapshot after a forced failure.
- Owner confirms the rewritten git-write rule in AGENTS.md.
