---
change_id: release-after-green-ci
title: Release only from a main commit whose CI run passed
status: planned
created: 2026-11-12
updated: 2026-11-12
archived_at: null
---

## Notes

Source: the repo review of 2026-11-12 (tests, tools and CI audit). Severity: high.

### Problem

A release is tagged and published with no CI result, and CI on `main` is often cancelled.

- `.github/workflows/release.yml:14-16` starts on every push to `main` and has no link to `ci.yml`.
- `.github/workflows/ci.yml:18-20` sets `cancel-in-progress: true` for every ref, pushes to `main` included. A rebase-merge of several commits, or two merges close together, cancels the earlier runs.
- `main` has no branch protection (`gh api repos/{owner}/{repo}/branches/main/protection` answers 404 "Branch not protected").

### Evidence

- `gh run list --branch main --workflow CI --limit 200`: 97 runs, 58 success, 38 cancelled, 1 failure.
- `git tag --points-at 5160a8a` prints `v1.5.0`. `gh run list --commit 5160a8a…` shows the Release run 43132134612 with `success` and the CI run 43132134691 with `failure` for that commit. The failing test was `coauthor.test.mjs:158` (the flake recorded in `coauthor-test-coarse-mtime`). Version 1.5.0 was published from a commit with a red suite, and nothing blocked or flagged it.
- The audit counted 31 `chore(main): release …` commits: 20 success, 10 cancelled (1.4.8, 1.4.9 and 1.4.10 among them), 1 failure. This count was not repeated.

### Fix direction

1. `ci.yml`: cancel only superseded pull request runs: `cancel-in-progress: ${{ github.event_name == 'pull_request' }}`. Every push to `main` then gets a result.
2. `release.yml`: start from the CI result instead of the push: `on: workflow_run` with `workflows: [CI]`, `types: [completed]`, `branches: [main]`, and `if: github.event.workflow_run.conclusion == 'success'` on the job. A rerun of a failed CI run that passes starts the release job again, so a flake delays a release and does not lose it.
3. Update the header comments of both workflow files, the Releases section of `AGENTS.md` and ADR-008 (an amendment note; do not rewrite the record).

`release.yml` stays on a hosted runner (`tools/test/ci-runner.test.mjs` pins that).

### Tests

- `tools/test/ci-runner.test.mjs` or a new test in `tools/test/`: `release.yml` has no `push` trigger and carries the `workflow_run` condition; `ci.yml` cancels only on `pull_request`.
- The pin guard (`tools/test/workflow-pins.test.mjs`) stays green.

### Done when

A commit on `main` whose CI run failed or was cancelled produces no release PR update and no tag, and every push to `main` ends with a CI result.
