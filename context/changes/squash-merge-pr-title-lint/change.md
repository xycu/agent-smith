---
change_id: squash-merge-pr-title-lint
title: Squash-only merging: lint the PR title, fix run PR titles, update the docs
status: implementing
created: 2026-11-13
updated: 2026-11-13
archived_at: null
---

## Notes

**Origin.** On 2026-11-13 the owner changed the repository to squash-only merging, after the Wave 2 merges showed that mixed merge methods do not fit the rule "fix a conflict by merging `main` into the branch, never force-push" (a branch holding a merge commit cannot be rebase-merged, and #143 went in as a merge commit that put a `feat` commit on `main`). The code, the CI and the docs still describe the old rebase-merge flow. This change brings them in line.

**Settings now (read with `gh api repos/xycu/agent-smith` on 2026-11-13).**
- Merge methods: squash only. Merge commits and rebase merging are off.
- Squash default: title = pull request title (`PR_TITLE`), body = the commit messages (`COMMIT_MESSAGES`), so the `Co-Authored-By` trailers of the branch commits stay in the body on `main`.
- Delete head branches on merge: on. The "Update branch" button: on. Auto-merge: off.
- Ruleset `main` (id 27167880, active, no bypass actors, so the owner cannot push to `main` directly either): block deletion, block force pushes, require a pull request (0 approvals, review threads must be resolved), require linear history. **No required status checks**, which ADR-008 needs because a release PR opened with `GITHUB_TOKEN` runs no workflows.

**What follows from it.** The pull request title is now the subject of the one commit that lands on `main`, and it is what release-please reads to pick the changelog line and the SemVer bump. The subjects of the branch commits only appear in the body.

### Gap 1: nothing lints the PR title

- `.github/workflows/ci.yml`, job `commits` ("Conventional Commits"), runs `node tools/commit-lint.mjs "$BASE..$HEAD"` over the commits of the branch. With squash those commits never land on `main` as commits. A multi-commit PR titled "Update stuff" lands a subject with no type: no changelog line, no version bump, and nobody is told.
- ADR-008 rejected "lint the PR title" for exactly the opposite reason ("the PR title never reaches `main`"). That reason no longer holds.

**Design questions the research must answer.**
- **Where the check lives.** Do not simply add `edited` to the `pull_request` types of `ci.yml`. Its concurrency group is `ci-${{ github.ref }}` with `cancel-in-progress: true` for pull requests, so a title edit would cancel the running `test` job of the same PR and start a new run, wasting the self-hosted runner and risking a head commit with no test result. A separate workflow file (own concurrency group, types `opened`, `edited`, `synchronize`, `reopened`) avoids that. Never use `pull_request_target` for this.
- **How it lints.** Reuse `lintSubject` from `tools/commit-lint.mjs` (built-ins only, no new dependency, matches ADR-008 and ADR-006) rather than a third-party action. If a third-party action is chosen, it must be pinned to a 40-character SHA with a `# vX.Y.Z` comment (`tools/workflow-pins.mjs`, `tools/test/workflow-pins.test.mjs`).
- **Runner.** ADR-020 puts CI on the TrueNAS runner with a hosted fallback for fork PRs; `tools/test/ci-runner.test.mjs` pins the `runs-on` lines of the jobs of `ci.yml`. A new workflow needs the same decision, and the test must cover it or say why not.
- **Advisory or required.** With no required checks a red title check does not block the merge. Keep it advisory (ADR-008), unless a required check is wanted and the release PR problem is solved first.
- **The `Merge ` exemption.** `lintSubject` returns `null` for any subject that starts with `Merge `. A PR title like "Merge the two parsers" would pass. The open change `commit-lint-merge-prefix` fixes that; do it first, or lint titles without the exemption (a PR title is never a merge commit).
- **Whether the per-commit lint stays.** The branch commits no longer land. Keeping the lint is harmless noise; dropping it loses nothing on `main`. Decide, and say which.
- **What release-please does with the body.** The squash body now lists every branch commit message. Check against the release-please version pinned in `release.yml` whether it reads those lines as extra commits, so that a `feat:` step commit in the body could add a changelog line or a minor bump (the `feat` in #143 is the example). The answer decides whether the body setting stays.

### Gap 2: run PR titles are not conventional

`skills/10x-pipeline/scripts/open-pr.mjs` (`titleFor`, line ~297) takes the PR title from the `title:` of the change's `change.md`, a plain sentence such as "Remove a stale last-result.json left after a crash". With `PR_TITLE` as the squash subject, every pull request the router opens would land on `main` without a type, and the new title lint would flag every run PR.

Options for the plan (nothing is decided):
- `open-pr.mjs` builds `<type>(<change-id>): <title>`, with the type taken from the commits of the run (the highest-bump type among the commits that are not router bookkeeping) or from a `--type` flag. The router's own step commits are `chore(<id>): ...`; the code commits of the implement steps carry the real type. A run with only a `chore` bookkeeping history and no code commit would get `chore`, which is correct for it.
- The owner edits the title before merging, and the lint only tells them to. Cheapest, and the failure mode is a missed edit.
- A `type:` key in `change.md` that `titleFor` reads. The type is stated once, up front, by whoever shapes the change.

ADR-017 covers `open-pr.mjs`; `skills/10x-pipeline/test/open-pr.test.mjs` covers `titleFor` and must change with it. The router never pushes and never calls `gh`, and `open-pr.mjs` stays standalone with built-ins only.

### Gap 3: text that still says "rebase-merge"

Each of these must change, and `AGENTS.md` must stay under the size cap of `tools/test/agents-md-size.test.mjs` (12 KB; it is 10,409 bytes now):
- `docs/ADR/ADR-008-release-packaging-and-semver.md`: Context, line 12 ("This repository rebase-merges ... hegel-skill squash-merges and lints the PR title"), and the Alternatives table, line 52 (the "Lint the PR title" row, status `rejected`). The ADR already has Amendment 1; add Amendment 2 that records squash-only merging, the ruleset without required checks, and the adopted title lint, and point the two old sentences at it instead of rewriting history.
- `AGENTS.md`, section Commits (line 38): "The `commits` job in `ci.yml` checks each commit of a pull request, because the owner rebase-merges and the subjects land on `main`."
- `.github/workflows/ci.yml`, header comment, lines 6 to 7.
- `tools/commit-lint.mjs`, header comment, lines 2 to 3.
- `skills/10x-pipeline/test/README.md` and the AGENTS.md pointers to it, if a test file is added.
- ADR-017 (`open-pr.mjs`), if Gap 2 changes the title.

Not in scope: the text in other open changes under `context/changes/` that mentions the rebase-merge (leave it; each is rewritten when that change is planned), and `context/archive/` (read-only).

**Interaction with the open change `commit-lint-merge-prefix`.** Its second gap ("lint pushes to `main` too") no longer applies, because the ruleset blocks direct pushes. Its first gap (the `Merge ` exemption) matters more now, since a title is linted. Rescope or fold it in when this change is planned.

**Constraints.**
- Direct pushes to `main` are blocked: this change lands through a squash-merged PR, and its own PR title must be conventional.
- Node 24, no npm dependencies; the workflows pin every action to a SHA.
- Never delete a directory tree with a recursive or forced command; never edit `context/archive/`.
- Do not name models or effort levels in `SKILL.md`.

**Done when.**
- A pull request with a non-conventional title gets a red, advisory title check, and fixing the title re-runs only that check without cancelling the `test` job.
- A run PR opened by `open-pr.mjs` has a conventional title, or the plan records why the owner edits it, and the test says so.
- No file in the list under Gap 3 still says the repository rebase-merges, and ADR-008 has Amendment 2.
- The plan states what release-please does with the squash body and whether the `COMMIT_MESSAGES` setting stays.
- `node --test skills/10x-pipeline/test/*.test.mjs tools/test/*.test.mjs` passes, including `tools/test/agents-md-size.test.mjs`.
