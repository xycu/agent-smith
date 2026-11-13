# Squash-only merging: lint the PR title, fix run PR titles, update the docs Implementation Plan

## Overview

The repository now squash-merges only, so the pull request title is the one commit subject that lands on `main` and the only input release-please reads on every merge. This plan adds an advisory title check in its own workflow, makes `open-pr.mjs` open run PRs with a conventional title, and rewrites every text that still says the repository rebase-merges (ADR-008 gets Amendment 2).

## Current State Analysis

- `ci.yml` job `commits` lints each branch commit with `tools/commit-lint.mjs <range>`. With squash those commits only reach `main` as body text. Nothing lints the PR title. An untyped squash subject gives zero parsed commits in release-please 17.6.0: no changelog line, no bump, no error (research.md, "release-please and the squash body").
- `ci.yml` has no `types:` on `pull_request`, and cancels in-progress PR runs by `github.ref` (`ci.yml:13-23`). Adding `edited` there would cancel the `test` job on every title edit.
- `lintSubject` (`tools/commit-lint.mjs:16-23`) returns `null` for any subject that starts with `Merge `. A title such as "Merge the two parsers" would pass. The open change `commit-lint-merge-prefix` covers this exemption.
- `titleFor` in `skills/10x-pipeline/scripts/open-pr.mjs:297-312` returns the plain `title:` of `change.md`, or the id for every OpenSpec run. Router commits are `chore(<id>): ...` (`policy.json:125`, `open-pr.mjs:20`); code commits of implement steps carry the real type.
- Stale text: `ci.yml:6-7`, `tools/commit-lint.mjs:2-3`, `AGENTS.md:38`, `ADR-008` lines 12 and 52 (rebase-merge), and lines 13, 62 and 85 ("no branch protection"; ruleset 27167880 now exists).

## Desired End State

- A PR with a non-conventional title gets a red, advisory check from the new workflow `.github/workflows/pr-title.yml`. Editing the title re-runs only that check; the `test` job is not cancelled.
- A run PR opened by `open-pr.mjs` is titled `<type>(<change-id>): <title>`, where `<type>` is the highest-ranked type among the commits of the run; a run with only bookkeeping commits gets `chore`.
- No file of the Gap 3 list says the repository rebase-merges; ADR-008 has Amendment 2; ADR-017 has Amendment 1.
- `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` passes, including `tools/test/agents-md-size.test.mjs`.

### Key Discoveries:

- release-please reads the whole squash message but splits it only at a blank line followed by an unbulleted `type(scope): ` line. GitHub's `* feat: x` bullets never match, so the `COMMIT_MESSAGES` body gives no changelog line and no bump (research.md). Residual cases: a `BREAKING CHANGE:` footer line in any branch commit body makes the whole squash major, and an unbulleted type-prefixed paragraph is read as an extra commit.
- `tools/test/ci-runner.test.mjs:10-23` reads only `ci.yml` and `release.yml`; a new workflow file is outside it unless the test is extended.
- `tools/workflow-pins.mjs` scans every `*.yml` under `.github/`, so the new workflow's actions are covered once pinned.
- `release.yml:24-27` starts from a `workflow_run` of the workflow named `CI`; a workflow named otherwise does not start it.
- Router bookkeeping commits are all `chore(...)`, and `chore` ranks lowest, so the run title type needs no bookkeeping detection: take the highest-ranked type of all commits in `<base>..HEAD`.

## What We're NOT Doing

- Making the title check a required status check. The ruleset has none and ADR-008 needs that: a release PR opened with `GITHUB_TOKEN` runs no workflow, so a required check would never report on it. The check stays advisory.
- Adding `edited` to `ci.yml`, or using `pull_request_target`, or a third-party title action.
- Dropping the `commits` job. It stays as early hygiene for branch commit subjects (they still appear in the squash body and `AGENTS.md` asks for Conventional Commits on every commit).
- Changing the squash settings: `PR_TITLE` plus `COMMIT_MESSAGES` stay, so the `Co-Authored-By` trailers remain in the body on `main`.
- A `type:` key in `change.md`, a `--type` flag on `open-pr.mjs`, or any edit of the `node "$OPEN_PR"` line in the `SKILL.md` files (the open change `quote-router-in-skill-loops` owns that line).
- Re-titling an existing PR. `open-pr.mjs` sets the title once, when it creates the PR; an owner edit is never overwritten.
- Linting a `BREAKING CHANGE:` footer in branch commit bodies, or linting pushes to `main` (the ruleset blocks direct pushes).
- Editing the text of other open changes under `context/changes/` that mentions rebase-merge (except the rescope note on `commit-lint-merge-prefix`), or `context/archive/`.

## Implementation Approach

Four code and docs phases in dependency order, then one manual live check. Phase 1 gives `commit-lint.mjs` a title mode and removes the `Merge ` text exemption (folds in gap 1 of `commit-lint-merge-prefix`; real merge commits are skipped by `git log --no-merges`, which also keeps the "Update branch" merge commit from failing the `commits` job). Phase 2 adds the workflow and the tests that pin it. Phase 3 changes `open-pr.mjs`. Phase 4 rewrites the docs. Phase 5 observes the real GitHub behavior that tests cannot reach.

## Phase 1: Title mode in commit-lint, no `Merge ` exemption

### Overview

Let `tools/commit-lint.mjs` lint one title, and judge every subject on its form alone.

### Changes Required:

#### 1. commit-lint

**File**: `tools/commit-lint.mjs`

**Intent**: Delete the `startsWith("Merge ")` exemption from `lintSubject` and pass `--no-merges` to the `git log` call in `lintRange`, so a subject is judged on its form and git leaves real merge commits out. Add a title mode to the CLI. Update the header comment: the repository squash-merges, the PR title becomes the commit subject on `main`, and the range mode lints the branch commits as hygiene (ADR-008, Amendment 2).

**Contract**: `node tools/commit-lint.mjs --title "<text>"` lints `<text>` with `lintSubject`. Exit 0 valid, exit 1 invalid (message names the title and the expected shape), exit 2 when the value is missing. The value is the argument after `--title`, so a title that starts with `-` is still a title. The range mode keeps its exits; an argument starting with `-` other than `--title` stays a usage error. The usage text names both modes.

#### 2. commit-lint tests

**File**: `tools/test/commit-lint.test.mjs`

**Intent**: Replace the accepted `Merge branch ...` subject with a rejected `Merge the two parsers into one`, add a range case that holds a real merge commit and passes, and add title-mode cases.

**Contract**: title mode exits 0 for `feat(x): y`, 1 for `Update stuff`, 1 for `Merge the two parsers into one`, 1 for an empty title, 1 for `-x` (not 2), and 2 for `--title` with no value. The range case builds a branch, merges `main` into it with `--no-ff`, and expects `main..HEAD`-style linting to pass.

### Success Criteria:

#### Automated Verification:

- commit-lint tests pass: `node --test tools/test/commit-lint.test.mjs`
- `lintSubject("Merge the two parsers into one")` returns an error and `node tools/commit-lint.mjs --title "fix(router): x"` exits 0: `node tools/commit-lint.mjs --title "fix(router): x"; node tools/commit-lint.mjs --title "Update stuff"; echo $?`
- Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`

#### Manual Verification:

- The header comment of `tools/commit-lint.mjs` no longer says the repository rebase-merges.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: PR title workflow and the tests that pin it

### Overview

A separate workflow lints the title with its own concurrency group, so a title edit never touches the `test` job.

### Changes Required:

#### 1. The workflow

**File**: `.github/workflows/pr-title.yml` (new)

**Intent**: Run `node tools/commit-lint.mjs --title "$TITLE"` on pull request events that can change the title or the head. Keep it advisory and keep the user-controlled title out of the shell script text.

**Contract**:
- `name: PR title` (not `CI`, so `release.yml`'s `workflow_run` never fires from it).
- `on.pull_request.types: [opened, edited, synchronize, reopened]`. Never `pull_request_target`.
- `permissions: contents: read`.
- `concurrency.group` keyed by `${{ github.event.pull_request.number }}`, `cancel-in-progress: true`; it must not use `github.ref` and so never shares a group with `ci.yml`.
- One job, `runs-on` byte-identical to the expression of `ci.yml` (TrueNAS runner, hosted fallback for fork PRs; ADR-020). Steps: first the uid guard step of `ci.yml` (`Refuse to run as root (ADR-020)`, same command; ADR-020 Amendment 1 wants it before checkout and before any branch code runs on the persistent runner), then `actions/checkout` and `actions/setup-node` (Node 24) pinned to the same SHAs and version comments as `ci.yml:32-36`, then a step with `env: TITLE: ${{ github.event.pull_request.title }}` and `run: node tools/commit-lint.mjs --title "$TITLE"`. No `${{ }}` expression inside the `run:` text.
- Header comment: why a separate file (cancel group), why advisory (ADR-008), that a manual "re-run" replays the old title and an edit starts a fresh run.

#### 2. Update the `ci.yml` header

**File**: `.github/workflows/ci.yml`

**Intent**: Replace header lines 6-7 ("The repository rebase-merges ...") with the squash fact: the PR title is the commit on `main`, linted by `pr-title.yml`; the `commits` job lints the branch commits as hygiene, because they only appear in the squash body. No change to triggers, jobs or `runs-on`.

**Contract**: comment lines only.

#### 3. Workflow tests

**File**: `tools/test/pr-title-workflow.test.mjs` (new), `tools/test/ci-runner.test.mjs`

**Intent**: Pin the facts the design depends on, the way `ci-runner` and `release-gate` pin theirs, by reading the YAML as text.

**Contract**: the new test asserts: the four `types` and nothing else; no `pull_request_target` anywhere in `.github/workflows/`; the concurrency group contains `pull_request.number` and not `github.ref`; the `run:` line of the lint step has no `${{`; the title reaches the step through `env:`; the workflow `name` is not `CI`; `ci.yml` has no `edited` and no `types:` under `pull_request`. `ci-runner.test.mjs` gains one test that `pr-title.yml` has exactly one `runs-on` line equal to `EXPECTED`, and one that the first step of its job is the uid guard, before the `commit-lint` step.

#### 4. Test index

**File**: `skills/10x-pipeline/test/README.md`

**Intent**: Add a row for `pr-title-workflow.test.mjs`, widen the `ci-runner` row to name `pr-title.yml`, and update the `commit-lint` row (title mode, no `Merge ` exemption) in the `tools/test` table (rows near lines 96-104).

**Contract**: table rows only.

### Success Criteria:

#### Automated Verification:

- New and widened workflow tests pass: `node --test tools/test/pr-title-workflow.test.mjs tools/test/ci-runner.test.mjs`
- Action pins hold for the new file: `node --test tools/test/workflow-pins.test.mjs`
- Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- `pr-title.yml` is valid YAML and pinned: `grep -c "uses: .*@[0-9a-f]\{40\} # v" .github/workflows/pr-title.yml` prints 2

#### Manual Verification:

- `.github/workflows/pr-title.yml` reads correctly end to end and `ci.yml` has no change other than its header comment.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Conventional titles for run PRs

### Overview

`open-pr.mjs` builds `<type>(<change-id>): <title>` from the commits of the run, so the squash subject needs no owner edit in the normal case.

### Changes Required:

#### 1. Title derivation

**File**: `skills/10x-pipeline/scripts/open-pr.mjs`

**Intent**: Read the subjects of `<base ref>..HEAD`, pick the highest-ranked Conventional Commit type, and prefix the existing `titleFor` result. `titleFor` itself stays as is (description part). `countAhead` already resolves the ref (`refs/remotes/<remote>/<base>` or `refs/heads/<base>`) but returns only `{ count }`; make it also return `ref`, pass it from `main` (`open-pr.mjs:390`) into `openPullRequest`, and use it for `git log --format=%s` instead of resolving it twice. The script stays standalone, built-ins only, and imports no `tools/` file.

**Contract**:
- New exported pure function, for example `prTitleFor(id, changeText, subjects)`, returning the title string.
- Rank, highest first: `feat`, `fix`, `perf`, `revert`, `refactor`, `build`, `ci`, `test`, `docs`, `chore`. A subject counts when it matches `^(type)(\(scope\))?(!)?: \S`; anything else (a `Merge ` commit, a `Revert "..."` default subject, free text) is ignored. The `!` is taken from the highest-ranked commit only (first one in log order on a tie): `feat(<id>)!: ...`. A `!` on a lower-ranked commit is not carried; the owner edits the title for that rare case.
- No parseable subject gives `chore`. If `git log` fails, the title falls back to the untyped `titleFor` result (the title check then flags it); this never fails the script.
- Scope is the change id, which `ID_RE` (`pr-common.mjs:10`) already restricts to the characters `lintSubject` accepts. The OpenSpec chain has no `change.md`, so its title is `<type>(<id>): <id>`.
- Description keeps the existing control-character strip and `TITLE_CAP`.
- The type list is a copy of `TYPES` in `tools/commit-lint.mjs`; a parity test pins it (the pattern of `coauthor.test.mjs`).

#### 2. open-pr tests

**File**: `skills/10x-pipeline/test/open-pr.test.mjs`

**Intent**: Update the two expectations that pin the old title (`:217` `"Demo title"`, `:560` `"Archived title"`) and add cases for the derivation.

**Contract**: pure-function cases: `feat` beats `chore`; `fix` beats `docs`; only `chore` gives `chore`; `feat(x)!:` keeps `!`; unparseable and `Merge`/`Revert "..."` subjects are ignored; empty list gives `chore`; every result passes `lintSubject` from `tools/commit-lint.mjs` (also used for the parity check of the type list). Fixture cases: a run branch with `chore(demo): ...` and one `fix(demo): ...` commit creates the PR titled `fix(demo): Demo title`; a bookkeeping-only branch gives `chore(demo): Demo title`; the OpenSpec fixture gives `chore(demo): demo`. The existing `titleFor` test stays.

#### 3. ADR-017

**File**: `docs/ADR/ADR-017-run-branch-always-pushed-for-review.md`

**Intent**: Add "Amendment 1: conventional PR title" recording the derivation rule, the fallback, that the title is set once at creation and an owner edit stays, that a fix added after review is not re-typed, and why (squash makes the title the commit subject on `main`; ADR-008 Amendment 2). Point step 5 of the Decision at it instead of rewriting it. Update the `Status` line.

**Contract**: prose and GIVEN/WHEN/THEN rules in the style of the ADR; no code.

### Success Criteria:

#### Automated Verification:

- open-pr tests pass: `node --test skills/10x-pipeline/test/open-pr.test.mjs`
- Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- No recursive delete introduced: `node --test skills/10x-pipeline/test/no-recursive-delete.test.mjs`

#### Manual Verification:

- ADR-017 Decision step 5 points at Amendment 1 and the Amendment states the fallback and the "set once" rule.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Docs say squash

### Overview

Every text that says the repository rebase-merges or has no ruleset is corrected or pointed at the amendment, and the Gap 3 list is closed.

### Changes Required:

#### 1. ADR-008 Amendment 2

**File**: `docs/ADR/ADR-008-release-packaging-and-semver.md`

**Intent**: Add "Amendment 2: squash-only merging and a PR title lint" after Amendment 1 and update the `Status` line. Record, in the ADR's own style (Context, Rules as GIVEN/WHEN/THEN, Consequences, Alternatives): squash-only since 2026-11-13; ruleset `main` (id 27167880: block deletion and force pushes, pull request required, review threads resolved, linear history, no bypass actors, no required checks); squash default `PR_TITLE` plus `COMMIT_MESSAGES`; the PR title lint adopted in `pr-title.yml`, advisory, reusing `lintSubject`; the `commits` job kept as hygiene; the finding about the squash body (bullets give no entry and no bump; residual cases: a `BREAKING CHANGE:` footer line in a branch commit body makes the squash major, an unbulleted type-prefixed paragraph is read as an extra commit) and the decision that the `COMMIT_MESSAGES` setting stays; that the observed body bytes and the ` (#N)` suffix were checked at the first squash merge (phase 5).
Add short pointers ("superseded, see Amendment 2") to the old sentences at Context line 12 ("This repository rebase-merges ..."), Context line 13 and Amendment 1 Context line 62 and alternatives row line 85 ("no branch protection": now a ruleset without required checks), and the "Lint the PR title" row at line 52 (status stays `rejected` as history; the new row in Amendment 2 is `adopted`). Do not rewrite the old sentences.

**Contract**: ADR prose and tables only.

#### 2. ADR index

**File**: `docs/ADR/README.md`

**Intent**: Extend the ADR-008 and ADR-017 rows with "Amendment 2: squash-only merging, PR title lint" and "Amendment 1: conventional run PR title".

**Contract**: two table cells.

#### 3. AGENTS.md

**File**: `AGENTS.md`

**Intent**: Rewrite the sentence in section Commits (line 38): the owner squash-merges, so the pull request title is the one subject on `main`, `pr-title.yml` lints it and `commits` lints each branch commit, both advisory; run PRs get a derived title (ADR-017); do not put a `BREAKING CHANGE:` line in a commit body unless the change is breaking, because the squash body carries it. Add the `--title` mode to the `commit-lint.mjs` line under Commands and the `pr-title.yml` mention under Layout (`.github/workflows/`).

**Contract**: stays under 12288 bytes (10,409 now; budget about 1.2 KB); keep the existing table.

#### 4. Rescope the open change

**File**: `context/changes/commit-lint-merge-prefix/change.md`

**Intent**: Append a dated note to Notes: gap 1 (the `Merge ` exemption) is folded into `squash-merge-pr-title-lint` phase 1; gap 2 (lint pushes to `main`) no longer applies because the ruleset blocks direct pushes. Leave status for the owner.

**Contract**: one appended paragraph; no frontmatter change except what the lifecycle skills do.

### Success Criteria:

#### Automated Verification:

- AGENTS.md size and import guards pass: `node --test tools/test/agents-md-size.test.mjs tools/test/agents-md-no-imports.test.mjs`
- No file outside `context/` and `CHANGELOG.md` says the repository rebase-merges: `git grep -n -i "rebase-merges" -- . ':!context' ':!CHANGELOG.md'` (the plural form; the singular also matches the git directory name `rebase-merge` in `skills/10x-pipeline/scripts/isolation.mjs:160`, which stays) shows only lines that carry an Amendment 2 pointer (ADR-008 history lines) and no other file
- Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs`
- Commit subjects lint: `node tools/commit-lint.mjs main..HEAD`

#### Manual Verification:

- ADR-008 reads consistently: Amendment 2 exists, the five old sentences point at it, nothing in Amendment 2 contradicts the ruleset facts above.
- `AGENTS.md` Commits section reads correctly and states that both title and commit checks are advisory.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 5: Live check on GitHub

### Overview

Observe what only GitHub can show, using this change's own pull request. No file changes except recording the observed body in ADR-008 Amendment 2 if it differs from the documented shape.

### Changes Required:

#### 1. Observe and record

**File**: `docs/ADR/ADR-008-release-packaging-and-semver.md` (only if an observation needs recording)

**Intent**: Run the checks below on the PR of this change, then record the exact squash body bytes after the merge.

**Contract**: a short "Observed" paragraph in Amendment 2, committed through a follow-up PR (direct pushes to `main` are blocked).

### Success Criteria:

#### Manual Verification:

- The PR of this change shows a `PR title` check. With a deliberately bad title (for example `Update stuff`) the check is red and the merge box still allows the merge. Editing the title to a conventional one turns the new run green.
- While the `Tests and version check` job of the same PR is running, a title edit does not cancel it and does not start a second `test` run.
- The title of this PR is conventional before the squash merge (the PR was opened by `open-pr.mjs`; if its title is untyped, edit it).
- After the squash merge, `git log -1 --format=%B main` shows the subject (with or without ` (#N)`) and the body layout; release-please opens or leaves its release PR as expected for the title type. Differences from the documented shape are written into Amendment 2.

---

## Testing Strategy

### Unit Tests:

- `lintSubject` without the `Merge ` exemption; title mode exits (0, 1, 2); a real merge commit in a range.
- `prTitleFor` ranking, `!`, fallback, ignored subjects; every derived title passes `lintSubject`.
- Text-pinning of `pr-title.yml` (types, concurrency group, env passing, runner, name) and of `ci.yml` (no `edited`).

### Integration Tests:

- `open-pr.test.mjs` fixtures with a fake `gh`: `--title` of `gh pr create` for a `fix` run, a bookkeeping-only run and an OpenSpec run.

### Manual Testing Steps:

1. Open this change's PR; read the `PR title` check.
2. Edit the title to a bad one, then a good one; watch the check and the `test` job.
3. Squash-merge and read the commit on `main`.

## Performance Considerations

The title workflow is one checkout and a few seconds of Node on the TrueNAS runner, once per `opened`, `edited`, `synchronize` and `reopened` event. Its own concurrency group cancels superseded title runs only.

## Migration Notes

None. No data or state moves. Open PRs keep their titles; `open-pr.mjs` changes only PRs created after this lands.

## References

- Related research: `context/changes/squash-merge-pr-title-lint/research.md`
- Change identity and gaps: `context/changes/squash-merge-pr-title-lint/change.md`
- `.github/workflows/ci.yml:13-23,41-56`, `.github/workflows/release.yml:21-27,36-39`
- `tools/commit-lint.mjs:16-23,42-60`, `tools/test/ci-runner.test.mjs:10-23`
- `skills/10x-pipeline/scripts/open-pr.mjs:211-217,297-312,331-350`, `skills/10x-pipeline/test/open-pr.test.mjs:217,560,585-590`
- `docs/ADR/ADR-008-release-packaging-and-semver.md:12,13,52,62,85`, `docs/ADR/ADR-017-run-branch-always-pushed-for-review.md:44`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Title mode in commit-lint, no `Merge ` exemption

#### Automated

- [x] 1.1 commit-lint tests pass: `node --test tools/test/commit-lint.test.mjs` — 1d8b47a
- [x] 1.2 Title mode accepts a conventional title and rejects `Update stuff` — 1d8b47a
- [x] 1.3 Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` — 1d8b47a

#### Manual

- [ ] 1.4 The header comment of `tools/commit-lint.mjs` no longer says the repository rebase-merges

### Phase 2: PR title workflow and the tests that pin it

#### Automated

- [x] 2.1 New and widened workflow tests pass: `node --test tools/test/pr-title-workflow.test.mjs tools/test/ci-runner.test.mjs` — f34dcc8
- [x] 2.2 Action pins hold for the new file: `node --test tools/test/workflow-pins.test.mjs` — f34dcc8
- [x] 2.3 Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` — f34dcc8
- [x] 2.4 `pr-title.yml` holds exactly two pinned actions — f34dcc8

#### Manual

- [ ] 2.5 `pr-title.yml` reads correctly end to end and `ci.yml` changed only in its header comment

### Phase 3: Conventional titles for run PRs

#### Automated

- [x] 3.1 open-pr tests pass: `node --test skills/10x-pipeline/test/open-pr.test.mjs` — f6074e0
- [x] 3.2 Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` — f6074e0
- [x] 3.3 No recursive delete introduced: `node --test skills/10x-pipeline/test/no-recursive-delete.test.mjs` — f6074e0

#### Manual

- [ ] 3.4 ADR-017 Decision step 5 points at Amendment 1, and the Amendment states the fallback and the set-once rule

### Phase 4: Docs say squash

#### Automated

- [x] 4.1 AGENTS.md size and import guards pass — e556488
- [x] 4.2 No file outside `context/` and `CHANGELOG.md` says the repository rebase-merges, except ADR-008 history lines with an Amendment 2 pointer — e556488
- [x] 4.3 Full suite passes: `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` — e556488
- [x] 4.4 Commit subjects lint: `node tools/commit-lint.mjs main..HEAD` — e556488

#### Manual

- [ ] 4.5 ADR-008 reads consistently: Amendment 2 exists, the five old sentences point at it
- [ ] 4.6 AGENTS.md Commits section reads correctly and states both checks are advisory

### Phase 5: Live check on GitHub

#### Manual

- [ ] 5.1 A bad PR title gives a red `PR title` check that does not block the merge, and fixing the title turns the new run green
- [ ] 5.2 A title edit does not cancel the running `test` job and starts no second `test` run
- [ ] 5.3 The title of this PR is conventional before the squash merge
- [ ] 5.4 After the squash merge, the subject and body on `main` are read and any difference from the documented shape is recorded in Amendment 2
