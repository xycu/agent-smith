---
date: 2026-11-13T01:25:00+01:00
researcher: Claude Sonnet 5.5 (for Błażej Ksycki)
git_commit: a726acbe88c6255b62e4161a1dc8fe87a31fe6cd
branch: chore/squash-merge-change
repository: agent-smith
topic: "Squash-only merging: what a PR title lint, the run PR titles and the docs need"
tags: [research, codebase, ci, release-please, commit-lint, open-pr, adr-008, squash-merge]
status: partial
last_updated: 2026-11-13
last_updated_by: Claude Sonnet 5.5 (for Błażej Ksycki)
---

# Research: Squash-only merging: what a PR title lint, the run PR titles and the docs need

**Date**: 2026-11-13T01:25:00+01:00
**Researcher**: Claude Sonnet 5.5 (for Błażej Ksycki)
**Git Commit**: a726acbe88c6255b62e4161a1dc8fe87a31fe6cd (`main` is at `2d52f9f`; this branch adds only the change folder)
**Branch**: chore/squash-merge-change
**Repository**: agent-smith

## Research Question

The repository now merges by squash only. For the design questions in `change.md` (Gaps 1 to 3): where should a PR title check live and how should it lint, what does release-please do with the squash body (does the `COMMIT_MESSAGES` setting stay), how can run PRs get a conventional title, and which text still describes rebase-merging?

## Summary

- **The body setting can stay.** For the pinned release-please (17.6.0, reached through `release-please-action` v5.0.0) the squash subject decides the changelog line and the bump. A body bullet `* feat: x` gives no changelog entry and no bump (tested with the real 17.6.0 build). Two narrow body cases do change the result: a `BREAKING CHANGE:` footer line anywhere in the body makes the whole commit major, and an unbulleted paragraph that starts with `feat(y): x` after a blank line is read as an extra commit. See "release-please and the squash body".
- **An untyped title is silently dropped.** A squash subject such as `Add thing (#12)` gives zero parsed commits: no changelog line, no bump, no error (tested). A typed but hidden title (`chore`, `docs`, `ci`, and so on) is counted but gives no release PR. So the title lint protects the only input that release-please reads on every merge.
- **Every run PR opened today has an untyped title.** `titleFor` in `open-pr.mjs` returns the plain-sentence `title:` of `change.md`, or the bare change id when there is no `change.md` (every OpenSpec run). With `PR_TITLE` as the squash subject, each of those would land without a type unless the owner edits the title.
- **A new workflow file is needed for the check, not an `edited` trigger in `ci.yml`.** `ci.yml` cancels in-progress pull request runs by `github.ref`, so a title edit would cancel the running `test` job. The check can reuse `lintSubject`. `tools/test/ci-runner.test.mjs` reads only `ci.yml` and `release.yml`, so a new workflow file is not covered by it unless the test is extended.
- **More text is stale than `change.md` lists.** Besides the rebase-merge sentences, ADR-008 says three times that `main` has no branch protection or ruleset (lines 13, 62 and 85), which the ruleset `main` made false.
- **One fact is still unobserved:** the exact body text GitHub writes for `PR_TITLE` plus `COMMIT_MESSAGES`, and whether it appends ` (#N)` to the subject. The release-please result above holds for the documented shape (`* subject` bullets and `Co-authored-by` trailers). The first squash merge shows the real bytes.

## Detailed Findings

### release-please and the squash body

Source: worker report on release-please 17.6.0 sources at tag v17.6.0 (`src/commit.ts`, `src/manifest.ts`, `src/strategies/base.ts`, `src/versioning-strategies/default.ts`, `src/changelog-notes/default.ts`, `src/github.ts`), plus runs of the real 17.6.0 npm build in a scratch directory (`.../scratchpad/rp/t.cjs`, `t2.cjs`). The version link: `release.yml:46` pins `googleapis/release-please-action` at SHA `45996ed...` (v5.0.0); the worker read `release-please` 17.6.0 from that action's `package-lock.json`. I did not re-read the release-please sources in the main context.

- **What is read.** The whole commit message, subject and body, goes in (`github.ts` L345-349). `splitMessages` (`commit.ts` L388-403) splits it only where a blank line is followed by a line that starts with `feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert`, an optional scope, then `: `. A GitHub bullet `* feat(y): x` starts with `* `, so it never matches. Tested with single-newline and blank-line separated bullets: no changelog entry and no bump.
- **Paragraph case.** For a `chore:` title plus an unbulleted body paragraph `feat(y): x` after a blank line, the tested result was a bump from 1.7.0 to 1.8.0 and a Features entry.
- **Breaking case.** A `BREAKING CHANGE:` footer or a `BREAKING-CHANGE:` line in the body marks the whole commit breaking (`commit.ts` L180-190, L337-350). Tested with a `chore:` title: 1.7.0 to 2.0.0. At version 1.0.0 and above `bump-minor-pre-major` no longer matters (`default.ts` L91-96).
- **Trailers.** Footer lines shaped `token: value` become extra pseudo-commits (`commit.ts` L243-308). `Co-authored-by: ...` and `Claude-Session: ...` get those types, which no changelog section lists, so they add no entry; alone they count as patch-level.
- **Untyped title.** `parser.parser()` throws, the catch logs at debug level and drops the commit (`commit.ts` L424-449). Tested: `Add thing (#12)` plus `* feat:` bullets gives 0 commits.
- **Hidden types.** A typed commit is kept. `determineReleaseType` returns patch when there is no breaking or `feat` commit (`default.ts` L104). `buildReleasePullRequest` returns nothing when the changelog is empty (`base.ts` L331-338, L525-527). Shown: `feat`, `fix`, `perf`, `revert`. Hidden: `docs`, `style`, `chore`, `refactor`, `test`, `build`, `ci` (the config sets no `changelog-sections`: `release-please-config.json`). Tested: a `fix:` title with `* chore:` bullets and trailers gives 1.7.1 with one Bug Fixes line; a `chore:` title with a `Co-authored-by` trailer gives no release PR.
- **The ` (#N)` suffix** stays in the parsed subject (`bareMessage` "add thing (#12)"). It changes neither type nor bump; the changelog writer links it to the pull request (`changelog-notes/default.ts` L120-131).
- **Override.** `BEGIN_COMMIT_OVERRIDE` / `END_COMMIT_OVERRIDE` in the merged PR body replaces the whole message (`commit.ts` L456-469); it needs the PR to be linked through `associatedPullRequests` (`github.ts` L357-385). This repository does not use it.

Consequence for the setting: with `COMMIT_MESSAGES` the Co-Authored-By trailers of the branch commits stay on `main` (needed by the commit rule in `AGENTS.md`, section Commits), and the body cannot add a changelog line or bump through bullets. The residual risks are the two body cases above. On `main` today, a case-insensitive search of commit messages for `BREAKING` finds one commit (`edb2ec1`, `feat(worktree-step-commits)!: run isolation gate (p2)`); that is a count over this one history, not a forecast.

### Where the title check lives (CI)

- `ci.yml:13-16`: the trigger is `pull_request` with no `types:`, so GitHub's default activity types apply (`opened`, `synchronize`, `reopened`; GitHub Actions docs, per the GitHub-semantics worker). The concurrency group is `ci-${{ github.event_name == 'pull_request' && github.ref || github.sha }}` with `cancel-in-progress` true for pull requests (`ci.yml:21-23`). Adding `edited` here would cancel the `test` job of the same PR on each title edit. A separate workflow file with its own group (for example one keyed by the PR number) avoids that; with `cancel-in-progress` true the newest title wins.
- `ci.yml:41-56`: job `commits` ("Conventional Commits") checks out with `fetch-depth: 0` and runs `node tools/commit-lint.mjs "$BASE..$HEAD"`.
- `tools/commit-lint.mjs:16-23`: `lintSubject` is exported, returns `null` for a valid subject and a message otherwise, and has built-ins only. Line 17 returns `null` for any subject starting with `Merge `. The CLI (`:42-60`) takes a git range; an argument starting with `-` is a usage error (exit 2), so a title mode needs an argument change or a second small script.
- **Passing the title.** The title is user-controlled text. It should reach the script through an `env:` entry, as `ci.yml:53-55` already does for `BASE` and `HEAD`, and not by interpolating `${{ github.event.pull_request.title }}` into a `run:` line. This is GitHub's general script-injection guidance, not something I found in this repository.
- **Runner.** `tools/test/ci-runner.test.mjs:12-19` asserts that every `runs-on` line of `ci.yml` equals one constant (`:10`), and `:21-23` that `release.yml` has no `self-hosted`. A new workflow file is outside both tests. ADR-020 puts CI on the TrueNAS runner with a hosted fallback for fork PRs; a title check is a few seconds of Node, so using the same `runs-on` expression is the consistent choice, and the test must then cover the new file or say why not.
- **Pins.** `tools/workflow-pins.mjs` and its test require every remote action in `.github/` to be pinned to a 40-hex SHA with a version comment. A title check that needs `tools/commit-lint.mjs` needs a checkout action, pinned like `ci.yml:32` and `:46`.
- **Release trigger.** `release.yml:24-27` starts from a `workflow_run` of the workflow named `CI` on `main`, and `release.yml:36-39` also requires `conclusion == 'success'`, `event == 'push'` and `head_sha == github.sha`. A title workflow that is not named `CI` and runs on `pull_request` does not start it.
- **Advisory or required.** `release.yml:21-22` and ADR-008 line 42: a release PR opened with `GITHUB_TOKEN` starts no other workflow, so a required title check would never report on it and would block its merge. The ruleset has no required checks (`change.md` Settings now, read with `gh api` on 2026-11-13). The title check is therefore advisory unless the release PR problem is solved first.

### Per-commit lint under squash

- With squash only, the branch commits reach `main` only as body text. The `commits` job still lints them; it protects nothing on `main` but flags a bad commit subject early.
- **Interaction with "Update branch".** `allow_update_branch` is on (`change.md`). The button adds a merge commit to the PR branch, whose default subject starts with `Merge `. Today `lintSubject:17` exempts it. If the `commits` job stays, the `Merge ` exemption must stay or `lintRange` must skip merge commits (`--no-merges`), which is the fix direction of the open change `commit-lint-merge-prefix`. If the job is dropped and the title lint has no exemption, the conflict disappears. This is an inference from `lintSubject:17` and the setting, not a tested run.
- The `commit-lint-merge-prefix` second gap ("lint pushes to `main` too") is moot: the ruleset blocks direct pushes (`change.md`).

### Run PR titles (`open-pr.mjs`)

- `titleFor(id, text)` (`skills/10x-pipeline/scripts/open-pr.mjs:297-312`) reads only the `title:` key of the `change.md` frontmatter, strips quotes and control characters, caps the length at `TITLE_CAP`, and falls back to `id`. Its comment says OpenSpec changes have no `change.md`, so `--chain openspec` runs always get the bare id as the title.
- The call is `titleFor(opts.id, readFile(path.join(changeDir(opts), "change.md")))` at `:344` and the title goes to `gh pr create --title` at `:350`. It runs only when `gh pr list --head <branch> --state all` returns no pull request for the branch (`:332-343`), so the title is set once per branch. An owner edit later is never overwritten.
- Tests: `skills/10x-pipeline/test/open-pr.test.mjs:586-590` pin `titleFor` (fixture `Demo title`, quoted title, empty title to id, no frontmatter to id, `null` to id).
- **Commit subjects on a run branch.** Router commits use `chore({id}): start run` (`policy.json:125`), `chore({id}): step {n} {step}` (`policy.json:125`) and `chore(${id}): final run state` (`open-pr.mjs:20`). Code commits by the implement steps carry the real type: the branch `agent-smith/skill-dir-variable` holds `fix(skill-dir-variable): name script paths through CLAUDE_SKILL_DIR` and `docs(skill-dir-variable): state minimum Claude Code version` between `chore(skill-dir-variable): ...` commits (`git log agent-smith/skill-dir-variable`).
- **Options, with what the evidence says.**
  - Derive `<type>(<id>): <title>`: the router bookkeeping subjects are recognisable by their three templates, so the type can come from the other commits of `<base>..HEAD`. A run with only bookkeeping commits gets `chore`. It works for the OpenSpec chain too, because it needs no `change.md` key. It needs `git log` in `open-pr.mjs`, which already runs git (it commits leftovers and pushes), and changes `open-pr.test.mjs` and ADR-017.
  - `type:` key in `change.md`: `titleFor` ignores other keys, and the `metadata-guard.mjs` of the research skill preserves unrelated YAML. I did not verify that `10x-archive` or other lifecycle skills keep an unknown key, and it does nothing for OpenSpec runs.
  - Owner edits the title: no code change; the lint (advisory) tells them. A run whose branch carries a `fix` or `feat` commit and whose merged title says `chore` also loses its release line, with no tool noticing.
  - A `--type` flag would put a new argument into the `node "$OPEN_PR"` line of both `SKILL.md` files, which the open change `quote-router-in-skill-loops` also rewrites; the derive option does not touch those lines.
- Memory note (`run-branch-release-type`): a run branch holding only `chore` and `docs` commits opens no release PR. A derived `chore` title agrees with that.

### Text that still says rebase-merge, found by `git grep -i rebase` outside `context/` and `CHANGELOG.md`

- Rebase-merge as the repository's merge method: `.github/workflows/ci.yml:6-7`, `tools/commit-lint.mjs:2-3`, `AGENTS.md:38`, `docs/ADR/ADR-008-release-packaging-and-semver.md:12` and `:52`.
- Other hits are about git states (merge, rebase, cherry-pick in progress) or a forbidden command and stay unchanged: `docs/ADR/ADR-003-rigor-gated-routing.md:85,122`, `docs/ADR/ADR-019-late-usage-figure.md:41`, `docs/REFERENCE.md:72,105,461`, `skills/10x-pipeline/scripts/isolation.mjs:160,209,223`, `skills/10x-pipeline/test/open-pr.test.mjs:172`.
- **Not in `change.md`:** `docs/ADR/ADR-008-release-packaging-and-semver.md:13` ("`main` has no branch protection or ruleset"), `:62` (Amendment 1: "`main` has no branch protection") and `:85` (alternatives table, "Branch protection with required checks ... runs the repository without branch protection"). They are false now that ruleset 27167880 exists. Still true and left alone: "no required checks" in `ADR-008:42`, `release.yml:21-22` and `AGENTS.md:82`.
- `AGENTS.md` is 10,409 bytes against a limit of 12,288 (`tools/test/agents-md-size.test.mjs`), per the earlier #143 merge work; room for the one-line change at `:38`.
- `skills/10x-pipeline/test/README.md:102` (ci-runner row) names `ci.yml` only; a new test file or a widened ci-runner test needs a row there.

### GitHub behavior that decides the design

From the GitHub-semantics worker (documentation reads; nothing changed on GitHub):
- The squash commit subject is the PR title under `PR_TITLE`. GitHub appends ` (#N)`; this is not documented, so it counts as unverified until observed.
- The body format of `COMMIT_MESSAGES` is not documented.
- The `edited` activity type fires when the title is edited; whether it also fires when only the base branch changes was not confirmed.
- How the merge box shows a failing non-required check under this ruleset is not documented; with no required checks the merge stays possible (ruleset content read on 2026-11-13).

## Code References

- `.github/workflows/ci.yml:13-23` - triggers, permissions, concurrency group and `cancel-in-progress`
- `.github/workflows/ci.yml:41-56` - the `commits` job
- `.github/workflows/release.yml:21-27,36-39,46` - no-checks-on-release-PR note, `workflow_run` trigger, gate conditions, action pin
- `tools/commit-lint.mjs:11-23,26-40,42-60` - types, `SUBJECT` regex, `lintSubject` (with the `Merge ` exemption at `:17`), `lintRange`, CLI
- `tools/test/ci-runner.test.mjs:10-23` - the `runs-on` constant and the two assertions
- `skills/10x-pipeline/scripts/open-pr.mjs:20,297-312,332-350` - final-state commit message, `titleFor`, PR lookup and create
- `skills/10x-pipeline/policy.json:125` - step and start commit message templates
- `skills/10x-pipeline/test/open-pr.test.mjs:586-590` - `titleFor` tests
- `docs/ADR/ADR-008-release-packaging-and-semver.md:12,13,42,52,57,62,85` - rebase text, protection text, Amendment 1
- `release-please-config.json` - `release-type: simple`, `bump-minor-pre-major`, no `changelog-sections`

## Architecture Insights

- The router never pushes and never calls `gh` (`AGENTS.md`, Hard Rules); `open-pr.mjs` and `pr-comment.mjs` are the only PR writers, so the run PR title is decided in exactly one place (`open-pr.mjs:344`).
- Every CI-related decision keeps one source: a rule in `ci.yml` has a test in `tools/test/` that reads the YAML as text (`ci-runner`, `release-gate`, `workflow-pins`). A new workflow follows the same pattern, so its behavior needs a text-pinning test next to those.
- release-please reads the first line of the squash message first and the rest only through narrow patterns, so the subject is the contract; `lintSubject` already encodes the same type list as the release-please changelog sections plus the hidden types.

## Historical Context (from prior changes)

- `docs/ADR/ADR-008-release-packaging-and-semver.md:52` - "Lint the PR title" rejected because "the repository rebase-merges, so the PR title never reaches `main`". Verdict now: the stated reason no longer holds (superseded by the squash-only setting); the rejected-alternative row stays as history and Amendment 2 reverses it.
- `docs/ADR/ADR-008-release-packaging-and-semver.md:42` - the release PR runs no workflow, so no required checks. Verdict: still holds, and it is why the title check stays advisory.
- `docs/ADR/ADR-008-release-packaging-and-semver.md:62,85` - "no branch protection". Verdict: contradicted by ruleset 27167880.
- `context/changes/commit-lint-merge-prefix/change.md` - gap 1 (`Merge ` exemption) still applies and matters more once a title is linted; gap 2 (lint pushes to `main`) no longer applies.
- `context/changes/quote-router-in-skill-loops/change.md` - rewrites the `node "$OPEN_PR"` line of both `SKILL.md` files; relevant only if this change adds an argument to that line.
- Not examined: `context/archive/` (read-only; no search of it was needed for these questions).

## Related Research

None under `context/changes/**/research.md` or `context/archive/**/research.md` was read for this topic.

## Open Questions

Missing evidence:
1. **Real squash message bytes** under `PR_TITLE` plus `COMMIT_MESSAGES`: the body layout and the ` (#N)` suffix. Impact: the release-please result is proven for the documented shape only; an unbulleted body line starting with a type prefix (for example from a multi-line commit body) is the one case that could split. Resolve with `git log -1 --format=%B main` after the first squash merge, which can be this change's own PR.
2. **Merge box under a red non-required check**, and whether `edited` fires on a base-branch change. Impact: UI only; the check stays advisory either way.
3. **Whether `10x-archive` and the other lifecycle skills keep an unknown `change.md` key.** Impact: only the `type:` key option.

Choices for `/10x-plan` (nothing here is decided):
- Keep `COMMIT_MESSAGES` (research supports keeping; residual risk is a `BREAKING CHANGE:` line or an unbulleted type-prefixed paragraph in a branch commit body) or switch to a title-only body and lose the trailers.
- Title check: new workflow file, `lintSubject` reused, title through `env:`, advisory. Open: a title mode in `commit-lint.mjs` or a second script, and how `ci-runner.test.mjs` covers the new file.
- Drop the `commits` job or keep it (and then fix the `Merge ` exemption first).
- Run PR title: derive from the commits, `type:` key, or owner edit.
- The `Merge ` exemption: fix in `commit-lint-merge-prefix` first, or lint titles without it.
