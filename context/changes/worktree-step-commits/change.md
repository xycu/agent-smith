---
change_id: worktree-step-commits
title: Isolated worktree runs, per-step commits, opus/medium tier and cheaper first implement attempts
status: implementing
created: 2026-11-03
updated: 2026-11-04
archived_at: null
---

## Notes

Source: Anthropic docs "Choosing the right model" and "Optimizing for cost and intelligence" (platform.claude.com/docs/en/about-claude/models/), read 2026-11-03.

Scope, four parts:

1. **Run isolation.** Every pipeline run works in its own git worktree on a dedicated branch.
   - Decision: the orchestrator (`SKILL.md`) creates it at start: `git worktree add` on a new branch `agent-smith/<change-id>`, then copies the change folder in.
   - Decision: `init` halts when it does not run in a linked worktree, or runs on the default branch.
   - Claude Code's `isolation: "worktree"` on the Agent tool does not fit: it is per subagent and auto-cleaned, while all steps of a run must share one worktree.
2. **Per-step commits.** Every step ends with its own commit, so a rollback or a rerun starts from a known point.
   - Decision: the router makes the commit in `next`, after it reads the step result, reusing the safety checks of the pre-archive commit (empty index first, no detached HEAD, no merge or rebase in progress, hooks and signing honored, never `--no-verify`, never a push).
   - Steps that already commit (`10x-goal-implement` per phase, `fix`, the `impl-review` apply rules) keep their own commits; the router commits whatever the step left (change-folder artifacts, `run.jsonl`, `meta.json`) and skips an empty commit.
   - The step's start SHA is logged in `run.jsonl`.
3. **Failed step rollback.** Before the retry of a failed step:
   - Decision: commit the partial edits to a side ref `refs/agent-smith/<change-id>/failed-<n>`, then hard-reset the worktree to the step's start commit. Nothing is lost; the retry starts clean.
   - Only inside the run's own worktree, never in the main checkout.
4. **Routing changes from the docs.**
   - Item 3: add an `opus`/`medium` tier to the ladder between `sonnet/high` and `opus/high` (docs: Opus 5.5 at `medium` is the default start for agent work; SWE-bench Pro `medium` 92.8% at $0.21 vs `high` 95.3% at $0.29). Shifts every tier index above 3: `policy.json` steps, `baseline-policy.json` check, tests, the "How the tier moves" list in `SKILL.md`, README routing bullets.
   - Item 5: run the first implement attempt one tier lower and re-run failures higher (docs: run at `low`, re-run failures at `high` gave about 40% lower cost at the same pass rate when outcomes are checkable). Precondition: a failed implement attempt must be neutral, which part 3 provides. Decide in the plan whether a neutral failure still raises rigor (`rigor.fromFailures`) and still uses step budget.

Constraints to change, not to break silently:

- AGENTS.md hard rule: "The router's only git writes are the index and commit writes of the pre-archive commit". Parts 2 and 3 widen it (commit per step, side ref, reset in the run worktree). Needs a new ADR and the AGENTS.md rule rewritten.
- Baseline comparison (`compare`) and `baseline-policy.json` must still produce comparable runs.

Out of scope: per-step baseline curve (item 6), Fable top tier (item 4).
