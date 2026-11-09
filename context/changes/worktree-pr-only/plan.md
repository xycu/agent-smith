# Worktree Pull-Request-Only Runs Implementation Plan

## Overview

Every run already works in its own worktree on `agent-smith/<change-id>` (ADR-010). Nothing pushes that branch or opens a pull request: the run ends in a local worktree and the human must publish it. This plan adds one end-of-run step, owned by a new standalone script, that always pushes the run branch and opens or updates its pull request, and never merges. It covers the 10x and OpenSpec chains and the `done`, `archive` and `halt` ends. The decision is recorded as ADR-017.

## Current State Analysis

- `AGENTS.md:9` was relaxed in commit 2d28f0c: code, skills and prompts may commit, push a branch and create, edit or comment on pull requests; only irreversible operations are forbidden (force-push, deleting unique work, `--no-verify`, merging is not listed but is out of scope here by the goal).
- The router (`skills/10x-pipeline/scripts/route.mjs` and its modules) never pushes and never calls `gh` (ADR-003 line 126, ADR-010 line 126, `docs/REFERENCE.md:50,87`). Routing stays pure; no network or push belongs there (ADR-006).
- `skills/10x-pipeline/scripts/pr-comment.mjs` is the precedent: a standalone, built-ins-only script run by the orchestrator, one JSON object on stdout, exit 0 on every runtime skip, `gh` run through `spawnSync` without a shell (`pr-comment.mjs:75`), a fake `gh` shim in `test/pr-comment.test.mjs`.
- The orchestrator skills end a run in three branches (`done`, `archive`, `halt`) and then run the opt-in PR comment step from the main checkout (`skills/10x-pipeline/SKILL.md:59-71,83-94`, `skills/openspec-pipeline/SKILL.md` same structure). The comment goes to the PR of the main checkout's branch because the run branch had no PR (`docs/REFERENCE.md:312`).
- A run that ends `done` without `--archive` leaves `report.md`, the last `run.jsonl` entry and `meta.json` uncommitted in the worktree (`docs/REFERENCE.md:45`, `SKILL.md:42`). The router has no commit after its final write.
- Tests that read the skill files constrain where new text may go: `## Anti-stall rules` must lie between `## Loop` and `## PR comment (opt-in)`, no `**GIVEN**` line outside it, no model or effort word, the `PR comment script: ` line shape (`test/skill-loop.test.mjs:57`, `test/openspec-skill.test.mjs:81,102-120`, `test/agents.test.mjs:351`).

## Desired End State

When a run ends in `done`, `archive` or `halt`, the orchestrator runs `open-pr.mjs` from the run root. If the run branch has commits beyond the base branch, the script commits any leftover work of the worktree, pushes the branch to the remote without force, and opens a pull request or leaves the existing open one updated by the push. It never merges, never deletes anything, never force-pushes. Every failure (no remote, rejected push, no `gh`, not isolated) is printed as one loud `Pull request: NOT ...` line in the final message with the manual command; the run result is not changed by it. The opt-in PR comment then posts the report to that PR from the run root. ADR-017, `AGENTS.md`, `README.md` and `docs/REFERENCE.md` describe it.

### Key Discoveries:

- A pushed branch with no upstream config is still found by `gh pr list --head <branch>`; `gh pr view` without arguments may not find it. The script and the comment script therefore address the PR by branch (`pr list --head`) and by URL (`pr view <url>`), and the script never writes git config (no `push -u`).
- `meta.baseSha` is HEAD before the start commit, but the script must not read router files; commits ahead are counted against the base branch tip instead.
- The `archive` branch moves the change folder; the report is then at `<archivePath>/agent-smith/report.md`, which `pr-comment.mjs` already accepts through `--report`.
- Subagent prompts forbid pushing (`prompts/manual-verify.md:23`, `prompts/os-archive.md:14`). That stays: only the orchestrator-run script pushes.

## What We're NOT Doing

- No router change, no `policy.json` change, no new policy key (no provenance drift for runs in flight). The script takes flags.
- No merge, no auto-merge, no approval, no review request, no force-push, no deletion of a branch, worktree or ref, no `--no-verify`, no `push -u` or any git config write.
- No push of `refs/agent-smith/` side refs of rolled-back steps.
- No removal of the `isolation.require: false` opt-out (a breaking change for projects without git). A non-isolated run gets a loud `NOT pushed` line instead; removing the opt-out is a separate owner decision, listed in ADR-017.
- No edit of the PR body on an existing PR (a human may have edited it); an existing PR is updated by the push, and the report goes in through the opt-in comment.
- No GitHub Enterprise support (as `pr-comment.mjs`).

## Implementation Approach

A new `skills/10x-pipeline/scripts/open-pr.mjs`, shaped like `pr-comment.mjs`, owns push and PR creation. The orchestrator skills gain one section and one step per end branch, ordered before the PR comment step. Documentation and ADR-017 land last. The script runs only in the run root of an isolated run (linked worktree, branch `agent-smith/<id>`), which is the single guard that "all work happens in its worktree": anything else is a loud skip.

## Critical Implementation Details

- **State sequencing** — in the `archive` branch the PR step runs after `verify-archive`, so the `chore(archive)` commit is pushed. The PR comment moves behind the PR step in every branch, and in `archive` posts from the archived report path; before this change it ran before the move.
- **Timing** — the script commits after the router's last write, so a resumed run (`init` again) starts from a HEAD the router did not make. The router tolerates it (a human commit after a halt is already the documented way back in). Two consequences are recorded in ADR-017: a later rollback resets to the failed step's `startSha`, which is at or after the pushed head, so pushed history is never rewritten and every later push is a fast-forward; and the partial edits that a halted step left (`kept`) are now committed, so a rollback of a later retry no longer discards them from the tree, as it did while they were uncommitted.

## Phase 1: The open-pr script and its tests

### Overview

Add the standalone script, a `--pr <url>` option for `pr-comment.mjs`, and a hermetic test file with a bare remote and a fake `gh`.

### Changes Required:

#### 1. The script

**File**: `skills/10x-pipeline/scripts/open-pr.mjs`

**Intent**: Push the run branch and open its pull request, safely and idempotently, for both chains. Built-ins only, Node 24, double quotes, same entry-point guard and `runGh`-style helpers as `pr-comment.mjs` (copy the small helpers; do not import from the router modules).

**Contract**: `node open-pr.mjs <change-id> [--chain 10x|openspec] [--report <path>] [--remote <name>] [--base <branch>] [--draft] [--timeout-ms <n>]`. Prints exactly one JSON object, exit 0 for every runtime outcome, exit 2 for usage errors. Same id regex as `pr-comment.mjs`. Output: `{ pushed, committed, commit, branch, remote, base, pr: { action: "created"|"existing"|"skipped", url, state, reason }, reason, manual }`, where `reason` explains `pushed: false` and `manual` is the command the human runs by hand. Steps, each a loud skip with its reason on failure:
1. Guards: git work tree; linked worktree (`git rev-parse --git-dir` differs from `--git-common-dir`); symbolic HEAD on branch `agent-smith/<change-id>`; otherwise skip "run is not isolated". Never writes anything before these pass.
2. Base: `--base`, else the nearest remote branch the run descends from, else the branch `<remote>/HEAD` points to, else `gh repo view --json defaultBranchRef`, else skip. Nearest: among `refs/remotes/<remote>/*`, leaving out `<remote>/HEAD`, the run branch's own remote ref and every `<remote>/agent-smith/*` ref, take those that are ancestors of HEAD (`merge-base --is-ancestor`), pick the one with the fewest `rev-list --count <ref>..HEAD`, and break a tie in favor of the branch `<remote>/HEAD` points to. This keeps the pull request, and the push, from carrying the unrelated commits of a feature branch the run was branched from; the worktree is created from whatever branch the main checkout has. Commits ahead = `rev-list --count <remote>/<base>..HEAD` (local `<base>` when the remote ref is missing), counted before the leftover commit; 0 = skip "no commits on the run branch" and commit nothing, because a started run always has its start commit and uncommitted files alone are not a run (a halt at `init` leaves only a copied change folder).
3. Leftover commit: when `git status --porcelain` is not empty, `git add -A` then `git commit -m "chore(<id>): final run state"`, with hooks and signing, no `--no-verify`. On failure run `git reset -q` of its own add, record `committed: false` with git's first line, and go on to push what exists.
4. Push: `git push <remote> refs/heads/<branch>:refs/heads/<branch>`; never `--force`, `-f`, `--force-with-lease`, `-u`, `--set-upstream`, `--no-verify`. A non-fast-forward or any failure gives `pushed: false` with git's first line; the script never retries with force. No remote gives a skip naming it.
5. PR: `gh pr list --head <branch> --state all --json number,url,state` (a `gh` that is missing, unauthenticated or times out is a PR skip with `pushed: true`). An OPEN PR gives `existing` (the push updated it). A MERGED or CLOSED one gives `skipped` with that state and creates nothing. None gives `gh pr create --head <branch> --base <base> --title <title> --body-file <tmp>` (add `--draft` only with the flag). Title: `title:` of `change.md` in the change folder, else the id. Body: a hidden marker `<!-- agent-smith:pr change=<id> -->`, the goal and outcome lines and the lines of the report before its first table row, with `@mentions` neutralized by a zero-width space and a 60000 code-unit cap, as `pr-comment.mjs` does. Both `gh pr list` and `gh pr create` get `--repo <owner>/<repo>`, parsed from `git remote get-url <remote>` (https or ssh form), so `gh` never has to pick a base repository among several remotes or fork parents, which fails without a terminal. A remote url that is not on `github.com`, or that does not parse, is a PR skip with `pushed` as it was.
6. The script never runs `gh pr merge`, `gh pr review`, `git branch -d/-D`, `git worktree remove` or `git push --delete`.

#### 2. `--pr <url>` for the comment script

**File**: `skills/10x-pipeline/scripts/pr-comment.mjs`

**Intent**: Let the orchestrator post to the PR that `open-pr.mjs` reported, because a run branch has no upstream config and `gh pr view` of the current branch may not find it.

**Contract**: optional `--pr <url>`, validated with the existing `PR_URL_RE` and `github.com`; when given, `findPullRequest` runs `gh pr view <url> --json number,url,state,isDraft` instead of the argument-less form. Default behavior unchanged.

#### 3. Tests

**File**: `skills/10x-pipeline/test/open-pr.test.mjs`, `skills/10x-pipeline/test/pr-comment.test.mjs`

**Intent**: Cover the script with a real bare remote and a real linked worktree (hermetic git as in `isolation.test.mjs`) and a `/bin/sh` fake `gh` (as in `pr-comment.test.mjs`); `helpers.mjs` stays as it was. The git calls are recorded by a `git` shim first on `PATH` that appends its arguments to a log file and then runs the real git; the fake `gh` logs its arguments the same way.

**Contract**: cases: push lands on the bare remote and the PR is created with the expected `gh` arguments (`--repo` included); second run creates nothing; the base is the pushed feature branch the run was branched from, `main` when it was branched from `main`, and unchanged on a second run when the run branch is already on the remote; a remote url that is not on `github.com` skips the PR and still pushes; MERGED and CLOSED PR create nothing but the push happens; `gh` missing gives `pushed: true` and a PR skip; no commits ahead pushes nothing; main checkout, detached HEAD and wrong branch prefix skip before any write; leftover edits are committed once and a failing pre-commit hook gives `committed: false` while the branch still pushes; a diverged remote gives `pushed: false` and no force; the recorded `git` and `gh` argument logs never contain `--force`, `-f`, `--force-with-lease`, `-u`, `--set-upstream`, `--no-verify`, `--amend`, `rebase`, `merge`, `review`, `--delete`; mention neutralization and body cap; usage errors exit 2. A guard test greps `route.mjs`, `state.mjs`, `preplan.mjs`, `steps.mjs`, `openspec.mjs`, `flow.mjs` and `isolation.mjs` and finds no `gh` spawn and no `"push"` git call (ADR-017 keeps the router pure). New `pr-comment.test.mjs` cases for `--pr`: valid URL, non-GitHub host, malformed value.

### Success Criteria:

#### Automated Verification:

- Script tests pass: `node --test skills/10x-pipeline/test/open-pr.test.mjs`
- Comment script tests pass with the new `--pr` cases: `node --test skills/10x-pipeline/test/pr-comment.test.mjs`
- Usage error exits 2 and a main-checkout run prints one JSON skip with exit 0: `node skills/10x-pipeline/scripts/open-pr.mjs 'Bad Id'; node skills/10x-pipeline/scripts/open-pr.mjs some-id`
- Whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`

#### Manual Verification:

- In a throwaway GitHub repository, run the script from a linked worktree on `agent-smith/<id>`: the branch is pushed, a pull request is open and not merged, and a second run changes nothing

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Orchestrator skills

### Overview

Both skills run the script at the end of every run, before the PR comment, and say so in their final message rules.

### Changes Required:

#### 1. The 10x skill

**File**: `skills/10x-pipeline/SKILL.md`

**Intent**: Add `OPEN_PR=<this skill's base directory>/scripts/open-pr.mjs` next to the `PR_COMMENT` line, a `## Pull request (always)` section placed after `## PR comment (opt-in)` (so the tests' section order holds), and a step in each end branch.

**Contract**: the section runs `cd "<run root>" && node $OPEN_PR <change-id>` (plus `--report "<archivePath>/agent-smith/report.md"` in `archive`), prints one line `Pull request: <action>, <url or reason> (pushed <true|false>)`, and prints `Pull request: NOT pushed, <reason>. Branch agent-smith/<change-id> is local only: <manual>` when `pushed` is false or the script prints no JSON object. It is never retried and never fails the run. Branches: `done` runs it first, then the PR comment step; `archive` runs it after `verify-archive` (also on `archived: false`, before the STOP), and the PR comment step moves behind it; `halt` runs it before the PR comment step, before the STOP. In `archive` the PR step is a sub-bullet of step 5 (`verify-archive`), so the numbering 1 to 5 stays and step 4 stays `Write no result file and do not call next` (a test pins it); the existing PR comment text at the end of step 1 and the bullet "In `archive` the step runs at the end of step 1, before the archive step" are removed. Report path in `archive`: on `archived: true` both the PR step and the comment step get `--report "<archivePath>/agent-smith/report.md"` (the report moved with the folder); on `archived: false` both use the default report path, and a missing report is the comment script's existing skip. The PR comment step now runs from `<run root>` with `--pr <url>` when the PR step reported one, else as before. Update the final-message text of Start step 3: the stale main-checkout copy note stays; the "uncommitted report" note stays only for a run whose PR step reported `committed: false`, skipped it, or printed no JSON object (the script commits the leftovers otherwise). Update the Rules bullets: only `$OPEN_PR` may push or open a pull request, only `$OPEN_PR` and `$PR_COMMENT` may call `gh`, and the orchestrator still never commits, resets or merges. No `**GIVEN**` line outside Anti-stall rules, no model, effort or tier word.

#### 2. The OpenSpec skill

**File**: `skills/openspec-pipeline/SKILL.md`

**Intent**: The same section, line and branch steps, with `$OPEN_PR` at `../10x-pipeline/scripts/open-pr.mjs`, `--chain openspec` on the script call and `openspec/changes/<change-name>/agent-smith/report.md` as the default report.

**Contract**: its `## Anti-stall rules` section stays byte-equal to the 10x one; the `PR comment script: ` line shape is kept and a `Pull request script: ` line is added.

#### 3. Skill tests

**File**: `skills/10x-pipeline/test/skill-loop.test.mjs`, `skills/10x-pipeline/test/openspec-skill.test.mjs`

**Intent**: Pin the new text.

**Contract**: the `archive` branch keeps its step 4 text and its numbering; both skills have the `OPEN_PR` line pointing at an existing file, the `## Pull request (always)` section after `## PR comment (opt-in)`, a script call in each of the `done`, `archive` and `halt` branches placed before the PR comment step, `--chain openspec` on the OpenSpec call, and no model, effort or tier word in the new text.

### Success Criteria:

#### Automated Verification:

- Skill content tests pass: `node --test skills/10x-pipeline/test/skill-loop.test.mjs skills/10x-pipeline/test/openspec-skill.test.mjs skills/10x-pipeline/test/agents.test.mjs skills/10x-pipeline/test/rules.test.mjs`
- Whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`

#### Manual Verification:

- Read both skills and confirm each of `done`, `archive` (including `archived: false`) and `halt` runs the pull request step before the PR comment step and before any STOP
- An unattended run of `/agent-smith:10x-pipeline` on a scratch change in a throwaway GitHub repository ends with the run branch pushed and a pull request open, not merged, for a `done` end and for a `halt` end

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: ADR-017 and documentation

### Overview

Record the decision and bring the project docs in line.

### Changes Required:

#### 1. ADR-017

**File**: `docs/ADR/ADR-017-run-branch-always-pushed-for-review.md`

**Intent**: Decision record in the ADR-010 style (Status, Date, Origin, Context, scenarios in GIVEN/WHEN/THEN form per ADR-004, Consequences, Alternatives considered).

**Contract**: rules: a run that ends with commits beyond the base branch is pushed and has an open PR, never merged; the script, not the router, pushes; no force, no config write, no delete; a failure is loud and never fails the run; a non-isolated run is not pushed and says so. Records these assumptions: one remote (`origin`) and `github.com`; the base is the nearest remote branch the run descends from, else the default branch; `gh pr list --head` and `gh pr create --head` on a branch without upstream config work as simulated (unverified live until rows 1.5 and 2.4); the PR carries the goal text and the report header to a possibly public repository with no opt-in; step and leftover commits use `git add -A`, so any non-ignored file in the worktree, `evidence/` included, is pushed and the `manual-verify` redaction rule is the only guard; a halted run's partial edits are committed and pushed, and a later rollback no longer discards them. Relation to older text: ADR-003 line 126 and ADR-010 line 126 stay true (they bind the router); ADR-002 line 394 ("does not push or merge on its own") is superseded for push, not for merge. Alternatives: push in the router (rejected: ADR-006, ADR-010 and a network call in the pure router), push from a subagent step (rejected: the prompts forbid it and a step can be rolled back), make the PR opt-in like `--pr-comment` (rejected: the goal says no exceptions), remove the `isolation.require: false` opt-out (rejected here: breaks projects without git; owner decision).

#### 2. Project docs

**File**: `AGENTS.md`, `README.md`, `docs/REFERENCE.md`

**Intent**: Describe the step where readers look for it.

**Contract**: `AGENTS.md`: Hard Rules git bullet names `open-pr.mjs` next to `pr-comment.mjs`; Project Structure lists `scripts/open-pr.mjs` and `test/open-pr.test.mjs` and adds ADR-017 to the ADR list; Commands lists the script. `README.md`: the Safe-by-design bullet and the worktree tip say the branch ends pushed with a pull request that is never merged. `docs/REFERENCE.md`: a "Pull request (always)" block after "Run isolation" (guards, base, leftover commit, push, PR, outputs, skips, no-force list), edits at the lines that say the report stays uncommitted in the worktree and that the comment posts from the main checkout, the "PR comment" block (posts from the run root with `--pr`), and one sentence in the OpenSpec section.

### Success Criteria:

#### Automated Verification:

- Whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- ADR and cross-references exist: `test -f docs/ADR/ADR-017-run-branch-always-pushed-for-review.md && grep -l "ADR-017" AGENTS.md docs/REFERENCE.md README.md`
- Commit subjects are Conventional: `node tools/commit-lint.mjs main..HEAD`
- Version fields untouched: `node tools/version-check.mjs`

#### Manual Verification:

- Read ADR-017 and confirm it states the no-push rule of the router is unchanged, names the script as the only pusher, and lists the non-isolated opt-out as the open owner decision

---

## Testing Strategy

### Unit Tests:

- Argument parsing, id regex, body building (marker, mention neutralization, cap), PR state mapping.
- The forbidden-flag guard over every recorded `git` and `gh` call.

### Integration Tests:

- Real bare remote plus real linked worktree plus fake `gh`: push, create, existing, closed, diverged, hook failure, no-gh, no-commits, non-isolated.
- Static guard: router modules contain no `gh` spawn and no git push.

### Manual Testing Steps:

1. In a throwaway GitHub repository run the script by hand from a linked worktree, twice.
2. Run `/agent-smith:10x-pipeline` on a scratch change to `done`, then force a `halt` (an open plan-review finding) and confirm the PR shows the commits of both.
3. Run an `--archive` run and confirm the `chore(archive)` commit is on the pushed branch.

## Performance Considerations

One `git push` and up to three `gh` calls per run end, each bounded by `--timeout-ms` (default 20 s for `gh`, 120 s for push).

## Migration Notes

None for run state: no policy or `meta.json` change, so no provenance drift. Runs in flight get the step at their end after the plugin upgrade. Projects with a remote that rejects pushes from the machine see a `NOT pushed` line and the manual command.

## References

- Change notes: `context/changes/worktree-pr-only/change.md`
- Precedent script: `skills/10x-pipeline/scripts/pr-comment.mjs`, `skills/10x-pipeline/test/pr-comment.test.mjs`
- Git rules: `AGENTS.md:9`, `docs/ADR/ADR-010-run-worktree-step-commits-and-rollback.md`, `docs/ADR/ADR-003-rigor-gated-routing.md:126`
- Orchestrator flow: `skills/10x-pipeline/SKILL.md:59-94`, `skills/openspec-pipeline/SKILL.md`
- Lessons applied: `context/foundation/lessons.md` (check the live and archived folders of both chains; the script reads no router file and takes the report path from the orchestrator)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: The open-pr script and its tests

#### Automated

- [ ] 1.1 Script tests pass: `node --test skills/10x-pipeline/test/open-pr.test.mjs`
- [ ] 1.2 Comment script tests pass with the new `--pr` cases: `node --test skills/10x-pipeline/test/pr-comment.test.mjs`
- [ ] 1.3 Usage error exits 2 and a main-checkout run prints one JSON skip with exit 0: `node skills/10x-pipeline/scripts/open-pr.mjs 'Bad Id'; node skills/10x-pipeline/scripts/open-pr.mjs some-id`
- [ ] 1.4 Whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`

#### Manual

- [ ] 1.5 In a throwaway GitHub repository, run the script from a linked worktree on `agent-smith/<id>`: the branch is pushed, a pull request is open and not merged, and a second run changes nothing

### Phase 2: Orchestrator skills

#### Automated

- [ ] 2.1 Skill content tests pass: `node --test skills/10x-pipeline/test/skill-loop.test.mjs skills/10x-pipeline/test/openspec-skill.test.mjs skills/10x-pipeline/test/agents.test.mjs skills/10x-pipeline/test/rules.test.mjs`
- [ ] 2.2 Whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`

#### Manual

- [ ] 2.3 Read both skills and confirm each of `done`, `archive` (including `archived: false`) and `halt` runs the pull request step before the PR comment step and before any STOP
- [ ] 2.4 An unattended run of `/agent-smith:10x-pipeline` on a scratch change in a throwaway GitHub repository ends with the run branch pushed and a pull request open, not merged, for a `done` end and for a `halt` end

### Phase 3: ADR-017 and documentation

#### Automated

- [ ] 3.1 Whole suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- [ ] 3.2 ADR and cross-references exist: `test -f docs/ADR/ADR-017-run-branch-always-pushed-for-review.md && grep -l "ADR-017" AGENTS.md docs/REFERENCE.md README.md`
- [ ] 3.3 Commit subjects are Conventional: `node tools/commit-lint.mjs main..HEAD`
- [ ] 3.4 Version fields untouched: `node tools/version-check.mjs`

#### Manual

- [ ] 3.5 Read ADR-017 and confirm it states the no-push rule of the router is unchanged, names the script as the only pusher, and lists the non-isolated opt-out as the open owner decision
