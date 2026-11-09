# Worktree Pull-Request-Only Runs — Plan Brief

> Full plan: `context/changes/worktree-pr-only/plan.md`

## What & Why

Every run already works in its own worktree on `agent-smith/<change-id>`, but the branch stays local and a human must publish it. The goal is that every run ends pushed for human review on a pull request, with no exceptions, and is never merged. `AGENTS.md` now allows recoverable git and GitHub operations, so the end-of-run push and PR are permitted.

## Starting Point

The router never pushes or calls `gh` (ADR-003, ADR-010). `pr-comment.mjs` is a standalone script the orchestrator runs for the opt-in `--pr-comment`, posting from the main checkout because the run branch has no PR. A `done` run leaves its report uncommitted in the worktree.

## Desired End State

At `done`, `archive` or `halt` the orchestrator runs a new `open-pr.mjs` from the run root: it commits leftover work, pushes the run branch without force, and opens a PR or leaves the open one updated. It never merges or deletes. Any failure prints a loud `NOT pushed` line with the manual command and does not change the run result.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Who pushes | New standalone script `open-pr.mjs`, run by the orchestrator | Keeps the router pure (ADR-006, ADR-010) and follows the `pr-comment.mjs` precedent | Plan |
| Opt-in or always | Always, no flag | The goal says no exceptions | Plan |
| Policy keys | None; flags `--remote`, `--base`, `--draft` | Avoids provenance drift for runs in flight | Plan |
| Halt with no commits | Skip, commit nothing | A started run always has a start commit; uncommitted files alone are not a run | Plan |
| Leftover work | Script commits it as `chore(<id>): final run state` | The router has no commit after its last write; a halted run's partial edits are worth reviewing | Plan |
| Existing PR | Push updates it; body untouched; MERGED or CLOSED creates nothing | A human may have edited the body; never reopen or recreate | Plan |
| PR lookup | `gh pr list --head <branch>`; comment script gets `--pr <url>` | The run branch has no upstream config and the script writes none | Plan |
| Failure handling | Loud line, run result unchanged, no retry with force | A rejected push must not be forced; the work stays on the local branch | Plan |
| `isolation.require: false` | Kept; a non-isolated run is not pushed and says so | Removing it breaks projects without git; left as an owner decision in ADR-017 | Plan |

## Scope

**In scope:** `open-pr.mjs` and its tests, `--pr` for `pr-comment.mjs`, both orchestrator skills, ADR-017, `AGENTS.md`, `README.md`, `docs/REFERENCE.md`.

**Out of scope:** router or policy changes, merging, force-push, deleting branches or worktrees, pushing side refs, editing an existing PR body, GitHub Enterprise, removing the isolation opt-out.

## Architecture / Approach

The script guards that it runs in a linked worktree on `agent-smith/<id>`, counts commits ahead of the base branch, commits leftovers, pushes `refs/heads/<branch>`, then finds or creates the PR with `gh`. It prints one JSON object. The skills run it before the PR comment step in every end branch, including the `archived: false` and `halt` STOPs.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Script and tests | `open-pr.mjs`, `--pr` option, hermetic tests with a bare remote and fake `gh` | `gh` behaviour for a branch without upstream is only simulated |
| 2. Orchestrator skills | Both SKILL files run the step in `done`, `archive`, `halt` | Skill tests pin section order and forbid rule lines and model words |
| 3. ADR-017 and docs | ADR, `AGENTS.md`, README, REFERENCE | Wording drift with ADR-003 and ADR-010 |

**Prerequisites:** a GitHub remote and authenticated `gh` for the manual rows.
**Estimated effort:** about 3 sessions across 3 phases.

## Open Risks & Assumptions

- The PR now carries the goal text and report header to a possibly public repository, without an opt-in.
- Committing a halted run's partial edits puts unfinished work on the PR; the side refs are not pushed.
- `gh pr list --head` and `gh pr create` on a worktree branch were not run live yet; manual rows 1.5 and 2.4 cover it.
- Assumed: one remote (`origin`) on `github.com`; the base is the nearest remote branch the run descends from (the default branch for a run branched from it), unless `--base` says otherwise.

## Success Criteria (Summary)

- A run that ends `done`, `archive` or `halt` has its branch on the remote and an open, unmerged PR.
- Router modules contain no push and no `gh` call, proven by a test.
- A rejected push, missing `gh` or non-isolated run is reported loudly and never forced.
