# ADR-017: Push every run branch and open its pull request for human review

- **Status:** Accepted (owner, 2026-11-09, including the isolation opt-out), amended through Amendment 3. S-14 records a published run. The original throwaway-repository checks remain open. [Published run](../../context/archive/2026-11-16-nested-step-delegation/evidence/acceptance.md#publication-verification-and-archive-closeout) · [Original evidence register](../../context/archive/2026-11-09-worktree-pr-only/evidence/unproven.md)
- **Date:** 2026-11-09
- **Deciders:** unattended implementation run of change `worktree-pr-only`; the repository owner decided the opt-out (F1) and the number of this record (F9)
- **Origin:** change `worktree-pr-only` (`context/changes/worktree-pr-only/change.md`, `plan.md` and `reviews/plan-review.md`). The goal: "All work must done on worktrees and always pushed to be reviewd by human on PRs - no exceptions". It builds on ADR-010 (run worktree, start and step commits) and on the relaxed git rule of `AGENTS.md` (Hard Rules, commit 2d28f0c), which lets code, skills and prompts push a branch and create or edit pull requests and forbids only operations that cannot be undone.
- **Number:** ADR-014, ADR-015 and ADR-016 are reserved by the changes `archive-manual-gate`, `neutral-orchestrator-retry` and `no-recursive-delete`, which run in parallel with this one, so this record is ADR-017.

## Rule in force

At a terminal action the orchestrator runs `open-pr.mjs`, which validates the configured run branch and saved identity, pushes without force, and opens a PR with a Conventional Commit title or reuses the existing PR. The owner retains review and merge. `isolation.require: false` skips publication. Only the orchestrator posts a report comment with explicit authorization. Checks requiring a real PR, its CI or an external comment belong to Manual acceptance. [Publisher](../../skills/10x-pipeline/scripts/open-pr.mjs) · [Acceptance ownership](#amendment-2--step-publication-and-acceptance-ownership-2026-11-15)

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
2. An explicit `--base` takes precedence. The automatic search ranks eligible ancestors tracked for the selected remote by the count of commits reachable from run HEAD that the candidate lacks (`git rev-list --count <candidate-ref>..HEAD`). An eligible symbolic HEAD target with a valid fetched comparison wins at equal or shorter distance, even when its tip has diverged. A strictly closer eligible ancestor wins. When the symbolic HEAD target is unknown, ancestor ties favor the earliest match in `isolation.defaultBranches`. Alphabetical ref order breaks remaining ancestor ties. Candidates without valid counts are excluded from the ranking. With no ranked candidate, the script tries the eligible symbolic HEAD target, then the eligible default from `gh repo view`, and skips if neither qualifies. Amendment 3 defines candidate eligibility. No commit beyond the base skips with nothing committed.
3. The leftover commit starts with the router's read-only Git operation check. A worktree-local merge, rebase, cherry-pick, revert or sequencer marker, an unmerged entry anywhere in the index or a failed probe skips the commit before status or staging. The worktree, index, operation metadata and local HEAD stay intact. CLI JSON reports `committed: false`, the reason in `commitError` and null `commit` and `swept`. The ordinary push and subsequent PR handling still use existing commits. A detached HEAD, including during a rebase, hits the earlier isolation refusal with null commit fields and skips publication entirely.

   With the guard satisfied and a nonempty status, the script records leftovers as `chore(<change-id>): final run state` with `git add -A`, hooks and signing. A failed commit unstages the paths its own add staged. An entry staged before the script ran stays staged if its working copy was unchanged. The script still attempts to push the existing commits.
4. Push: `git push <remote> refs/heads/<branch>:refs/heads/<branch>`, no force.
5. Pull request: `gh pr list --repo <owner>/<repo> --head <branch> --state all`. An open one is left as the push updated it; a merged or closed one creates nothing; none gives `gh pr create --repo <owner>/<repo> --head <branch> --base <base>`, titled as Amendment 1 says and with the report header as its body. `<owner>/<repo>` comes from the remote url, so `gh` never picks a repository by itself.

The PR comment step now runs from the run root and names the pull request with `--pr <url>`, because a branch pushed without upstream config may not be found by `gh pr view` of the current branch.

## Assumptions

- One remote (`origin` by default) on `github.com`. GitHub Enterprise is not supported, as in `pr-comment.mjs`.
- Ranking uses the selected remote's already-fetched refs. A local-only feature branch supplies no automatic ranking candidate, so its commits appear in the pull request when they fall outside the selected base.
- `gh pr list --head` and `gh pr create --head` work on a branch without upstream config as the fake `gh` of the tests simulates. S-14 row 3.5 records a published branch, PR, green CI and requested comment on 2026-11-16. Original row 1.5 still requires a throwaway repository and an unchanged second invocation. Row 2.4 requires unattended terminal publication on both done and halt paths in a throwaway repository. [S-14 publication](../../context/archive/2026-11-16-nested-step-delegation/evidence/acceptance.md#publication-verification-and-archive-closeout) · [Original Manual rows](../../context/archive/2026-11-09-worktree-pr-only/evidence/unproven.md)
- The pull request carries the goal text and the report header to a repository that may be public, with no opt-in.
- The step and leftover commits use `git add -A`. When their commits are pushed, that includes unignored files in the worktree such as `evidence/`. The redaction rule of the `manual-verify` prompt is the only guard against a secret in evidence.
- A successful leftover commit saves a halted run's partial edits (`kept`). A later rollback of a retry resets to that step's `startSha`, at or after the pushed head, preserving pushed history and the committed edits.

## Consequences

- An isolated run with commits beyond its base can publish its branch and open a pull request even when the operation guard skips the leftover commit.
- A successful leftover commit saves `report.md`, `run.jsonl` and `meta.json`, including any late usage, and clears those edits for `git worktree remove`. A skipped commit leaves those artifacts and other pending edits local. Resolve unfinished Git state, return to the validated run branch if detached, and preserve any pending work before retrying publication or removing the worktree.
- A resumed run starts from its current run-branch HEAD. The router accepts a leftover or human commit made after the halt. If the guard skipped the commit, resolve the Git state and commit any kept edits you want included before resuming.

## Relation to older records

- ADR-003 and ADR-010 say the router never pushes and never calls `gh`. That stays true: they bind the router, and the router does not change.
- ADR-002 says agent-smith "does not push or merge on its own". This record supersedes that sentence for push, not for merge: agent-smith still never merges.

## Alternatives considered

- Push in the router: rejected. It would put a network call into the pure router (ADR-006) and mix a push into the rollback logic of ADR-010.
- Push from a subagent step: rejected. The step prompts forbid pushing, and a step can be rolled back after it pushed.
- Make the pull request opt-in, like `--pr-comment`: rejected. The goal says no exceptions.
- Remove the `isolation.require: false` opt-out in this change: rejected by the owner (F1). It breaks projects without git and the test harness; the opt-out stays as the single exception above.

## Amendment 1: conventional PR title (2026-11-13)

### Context

- The repository squash-merges only (ADR-008, Amendment 2). The pull request title is the one commit subject that lands on `main`, and release-please reads it to pick the changelog line and the SemVer bump. A squash subject without a type gives no changelog line and no bump, and no error.
- Step 5 of the Decision titled the pull request with the plain `title:` of `change.md`, or the change id for an OpenSpec run. Neither is a Conventional Commit.
- Router commits are all `chore(<change-id>): ...`; the code commits of implement steps carry the real type.

### Rules

**GIVEN** `open-pr.mjs` creates a pull request **WHEN** it picks the title **THEN** it **MUST** use `<type>(<change-id>): <title>`, where `<title>` is the `titleFor` result (the `title:` of `change.md`, else the change id) and `<type>` is the highest-ranked type among the subjects of `<base ref>..HEAD`, ranked `feat`, `fix`, `perf`, `revert`, `refactor`, `build`, `ci`, `test`, `docs`, `chore`.

**GIVEN** a subject that is not `type(scope)!: description` with a ranked type (a `Merge ` commit, a `Revert "..."` default subject, free text) **WHEN** the type is picked **THEN** the script **MUST** ignore it, and a run with no parseable subject gets `chore`, because bookkeeping commits are all `chore`.

**GIVEN** the highest-ranked commit carries `!` **WHEN** the title is built **THEN** the title **MUST** carry `!` after the scope. A `!` on a lower-ranked commit is not carried; the owner edits the title for that rare case.

**GIVEN** `git log` fails **WHEN** the title is built **THEN** the script **MUST** fall back to the untyped `titleFor` result and never fail; the title check of `pr-title.yml` then flags it.

**GIVEN** a pull request of the run branch exists in any state **WHEN** the script runs again **THEN** it **MUST NOT** change its title: the title is set once, at creation, and an owner edit stays. A fix added after review is not re-typed.

### Consequences

- The normal run PR squash-merges with a title release-please can read, with no owner edit.
- The type list is a copy of `TYPES` in `tools/commit-lint.mjs` (the script imports no `tools/` file); `open-pr.test.mjs` pins the parity.
- The scope is the change id, which `ID_RE` already restricts to the characters the lint accepts.

## Amendment 2 — Step publication and acceptance ownership (2026-11-15)

The shared always-true `rules/top.md` rules carry publication ownership into both chains, archive tasks, prompt overrides and file-handoff bodies.

**GIVEN** a step subagent **WHEN** a criterion or skill requests publication **THEN** it **MUST NOT** push, call `gh`, create or edit a PR, post PR/report comments, use equivalent APIs, or invoke `open-pr.mjs` or `pr-comment.mjs` indirectly.

**GIVEN** acceptance requires a pushed branch, open PR, PR CI or an external PR comment **WHEN** a planner classifies acceptance **THEN** it **MUST** put it in Manual acceptance, keeping implementation Automated criteria executable locally before publication.

Local fake-client tests remain valid Automated criteria. Plan review checks phase Success Criteria and canonical Progress, moving an actionable pending row intact to Manual with its id, title and tick state, and synchronizing the brief. OpenSpec proposal/design artifacts hold equivalent follow-up outside apply tasks. Immutable contradictions use existing pending-finding handling.

The orchestrator runs publication scripts at their terminal points, with report comments governed by existing strict authorization. A supported Claude guard denies the documented direct publication commands inside the dedicated step identity. Semantic rules cover actions through other tools and APIs. Human PR CI acceptance, review and merge follow publication.

## Amendment 3 — Publish the validated configured branch (2026-11-16)

Publication uses the same effective isolation projection and literal branch validation as setup under ADR-010 Amendment 4. This extends the earlier fixed-prefix guard to the configured branch and the selected run identity before any leftover commit or push.

**GIVEN** saved isolated identity in the requested chain or the change directory selected by `--report` **WHEN** the publisher validates the run **THEN** it **MUST** require matching change id, normalized chain, isolated flag, recorded branch and HEAD, protecting configured defaults and the remote default and refusing contradictory or malformed identity before writes or remote calls.

Missing metadata and legacy empty metadata use the exact configured prefix plus change id. An absent saved chain reads as `10x`. The strict boolean isolation opt-out skips publication before prefix validation. A conflicting policy diagnostic identifies the recorded branch and the policy restoration prerequisite.

**GIVEN** automatic base discovery **WHEN** the script considers an ancestor or default-branch fallback **THEN** it **MUST** validate its literal branch name and exclude `HEAD`, the current run branch, the legacy `agent-smith/` namespace and names starting with a configured prefix that ends in `/` or `-`.

**GIVEN** a candidate starts with any other configured prefix **WHEN** the remainder starts with a character that can begin a change ID (`[a-z0-9]`) **THEN** automatic discovery **MUST** exclude it unless the exact branch is in `isolation.defaultBranches`, is the selected remote's symbolic HEAD target or is the default reported by GitHub in the final fallback. The first-character check covers saved run branches with suffixes after their IDs. An empty remainder or one starting with another character passes the prefix check.

Explicit `--base` takes precedence and can select a non-default branch whose name could also identify a run. These eligibility rules apply to the symbolic HEAD target when it competes with tracked ancestors and to both fallback sources. An older Git without `%(ahead-behind)` counts each ancestor with `rev-list`. The validated actual branch flows through the complete push refspec, GitHub `--head`, JSON output and recovery guidance.

**GIVEN** an executable recovery command **WHEN** the script renders dynamic arguments **THEN** it **MUST** quote each as a shell literal, including the worktree path, remote, complete refspec, repository, branch and base, while runtime Git and GitHub calls use argument arrays.

**GIVEN** terminal reporting **WHEN** publication returns or fails to return JSON **THEN** both skills **MUST** use publication `branch`, then saved setup `branch`, then explicit `unavailable` identity for normal and failure messages.

Deterministic tests cover both chains, saved suffix branches, archived report locations, automatic base selection with overlapping prefixes, configured and legacy base exclusions, refusal preservation and literal recovery-command arguments. External PR, comment and CI acceptance remains orchestrator-owned under Amendment 2.
