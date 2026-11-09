# ADR-017: Push every run branch and open its pull request for human review

- **Status:** Accepted (the repository owner decided the two open review findings on 2026-11-09; the live checks below are still pending)
- **Date:** 2026-11-09
- **Deciders:** unattended implementation run of change `worktree-pr-only`; the repository owner decided the opt-out (F1) and the number of this record (F9)
- **Origin:** change `worktree-pr-only` (`context/changes/worktree-pr-only/change.md`, `plan.md` and `reviews/plan-review.md`). The goal: "All work must done on worktrees and always pushed to be reviewd by human on PRs - no exceptions". It builds on ADR-010 (run worktree, start and step commits) and on the relaxed git rule of `AGENTS.md` (Hard Rules, commit 2d28f0c), which lets code, skills and prompts push a branch and create or edit pull requests and forbids only operations that cannot be undone.
- **Number:** ADR-014, ADR-015 and ADR-016 are reserved by the changes `archive-manual-gate`, `neutral-orchestrator-retry` and `no-recursive-delete`, which run in parallel with this one, so this record is ADR-017.

## Context

- Since ADR-010 every isolated run works in its own linked worktree on `agent-smith/<change-id>`, with a start commit and one commit per verified step. Nothing pushed that branch or opened a pull request: a run ended in a local worktree, and a human had to publish it before anyone could review it.
- The router never pushes and never calls `gh` (ADR-003, ADR-010). It is a pure, network-free script (ADR-006), and a failed step can be rolled back by a `git reset --hard` in the worktree.
- `skills/10x-pipeline/scripts/pr-comment.mjs` is the precedent for a standalone script the orchestrator runs at the end of a run: built-ins only, one JSON object on stdout, exit 0 on every runtime skip, `gh` without a shell.
- A run that ended `done` without `--archive` left `report.md`, the last `run.jsonl` entry and `meta.json` uncommitted in the worktree, because the router writes them after its last step commit.

## Decision

A new script, `skills/10x-pipeline/scripts/open-pr.mjs`, is the only code that pushes a run branch or opens a pull request. Both orchestrator skills run it from the run root at every end of a run (`done`, `archive` and `halt`), before the opt-in PR comment step and before any STOP. No flag turns it off. The router does not change.

Rules, written as scenarios (the form of ADR-004):

**GIVEN** an isolated run that ends in `done`, `archive` or `halt` with commits on its branch beyond the base branch **WHEN** the orchestrator finishes the run **THEN** it **MUST** run `open-pr.mjs`, which pushes `agent-smith/<change-id>` and opens a pull request, or leaves the open one updated by the push.

**GIVEN** a pull request of a run branch **WHEN** any part of agent-smith acts on it **THEN** it **MUST NOT** merge, approve or review it, because a human reviews and merges every run.

**GIVEN** the router or a step subagent **WHEN** it would push a branch or call `gh` **THEN** it **MUST NOT** do so: only `open-pr.mjs` pushes and opens pull requests, and only `open-pr.mjs` and `pr-comment.mjs` call `gh`.

**GIVEN** the script pushes **WHEN** the remote branch has diverged **THEN** it **MUST NOT** force-push, retry with force, write git config (`push -u`), pass `--no-verify` or delete a branch, worktree or ref.

**GIVEN** the push or the pull request fails **WHEN** the orchestrator writes the final message **THEN** it **MUST** print one `Pull request: NOT pushed, ...` line with the manual command, and the outcome of the run stays as the router decided it.

**GIVEN** a run with `isolation.require: false` **WHEN** it ends **THEN** the script **MUST** skip with `run is not isolated` and push nothing, and the final message carries the `NOT pushed` line.

### The one exception: the isolation opt-out

The owner decided (review finding F1) to keep the `isolation.require: false` opt-out of ADR-010. It is the single sanctioned exception to "always pushed, no exceptions": removing it would break every project without git, which cannot run in a worktree at all, and the test harness, whose `writeOverride` adds `isolation: { require: false }` to every scratch project. It is not an open question. With isolation on, the push and the pull request are mandatory and no flag turns them off. With the opt-out, the final message keeps its loud `NOT pushed` line.

### What the script does

1. Guards: a git work tree, a linked worktree (`--git-dir` differs from `--git-common-dir`) and HEAD on `agent-smith/<change-id>`. Otherwise it skips before it writes anything.
2. Base: `--base`, else the nearest remote branch the run descends from (fewest commits between it and HEAD, ties to the branch `<remote>/HEAD` points to; `<remote>/HEAD`, the run branch's own remote ref and `<remote>/agent-smith/*` are left out), else `<remote>/HEAD`, else `gh repo view`. No commit beyond the base skips with nothing committed.
3. Leftover commit: what the worktree still holds is committed as `chore(<change-id>): final run state` with `git add -A`, hooks and signing. A failed commit unstages its own add and the script pushes what exists.
4. Push: `git push <remote> refs/heads/<branch>:refs/heads/<branch>`, no force.
5. Pull request: `gh pr list --repo <owner>/<repo> --head <branch> --state all`. An open one is left as the push updated it; a merged or closed one creates nothing; none gives `gh pr create --repo <owner>/<repo> --head <branch> --base <base>`, titled from `change.md` and with the report header as its body. `<owner>/<repo>` comes from the remote url, so `gh` never picks a repository by itself.

The PR comment step now runs from the run root and names the pull request with `--pr <url>`, because a branch pushed without upstream config may not be found by `gh pr view` of the current branch.

## Assumptions

- One remote (`origin` by default) on `github.com`. GitHub Enterprise is not supported, as in `pr-comment.mjs`.
- The base is the nearest remote branch the run descends from, else the default branch. A feature branch that exists only locally is no remote ref, so its run gets the default branch as base and its pull request carries that branch's commits.
- `gh pr list --head` and `gh pr create --head` work on a branch without upstream config as the fake `gh` of the tests simulates. This is unverified live until the manual rows 1.5 and 2.4 of the change run.
- The pull request carries the goal text and the report header to a repository that may be public, with no opt-in.
- The step and leftover commits use `git add -A`, so every file in the worktree that git does not ignore, `evidence/` included, is pushed. The redaction rule of the `manual-verify` prompt is the only guard against a secret in evidence; once pushed, it is hard to take back.
- A halted run's partial edits (`kept`) are committed and pushed by the leftover commit. A later rollback of a retry resets to that step's `startSha`, which is at or after the pushed head, so pushed history is never rewritten and every later push is a fast-forward, but the rollback no longer discards those edits, as it did while they were uncommitted.

## Consequences

- Every isolated run ends with its branch on the remote and an open pull request, unless the push or `gh` fails, which the final message says loudly.
- The `report.md`, `run.jsonl` and `meta.json` that the router leaves uncommitted at the end of a run are now committed by the leftover commit, so the worktree is clean for `git worktree remove` after a successful step.
- A resumed run starts from a HEAD the router did not make (the leftover commit). The router tolerates it, as it tolerates a human commit after a halt.

## Relation to older records

- ADR-003 and ADR-010 say the router never pushes and never calls `gh`. That stays true: they bind the router, and the router does not change.
- ADR-002 says agent-smith "does not push or merge on its own". This record supersedes that sentence for push, not for merge: agent-smith still never merges.

## Alternatives considered

- Push in the router: rejected. It would put a network call into the pure router (ADR-006) and mix a push into the rollback logic of ADR-010.
- Push from a subagent step: rejected. The step prompts forbid pushing, and a step can be rolled back after it pushed.
- Make the pull request opt-in, like `--pr-comment`: rejected. The goal says no exceptions.
- Remove the `isolation.require: false` opt-out in this change: rejected by the owner (F1). It breaks projects without git and the test harness; the opt-out stays as the single exception above.
