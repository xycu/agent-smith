---
change_id: ci-scratch-in-runner-temp
title: Put the test scratch folders of CI into the runner temp directory
status: planned
created: 2026-11-12
updated: 2026-11-14
archived_at: null
---

## Notes

Source: the repo review of 2026-11-12 (tests, tools and CI audit). Severity: low to medium.

### Problem

A cancelled or killed test run leaves its scratch projects and lock files behind, and the CI runner is persistent.

- `skills/10x-pipeline/test/helpers.mjs:31-49`: scratch projects are made with `mkdtempSync` under `os.tmpdir()`. `:10-25`: `cleanupAll` runs only from `after` hooks, which a cancelled job never reaches.
- `.github/workflows/ci.yml:31-32`: the test step sets no `TMPDIR`, so the folders land in the system temp directory of the runner.
- `docs/ADR/ADR-020-ci-on-self-hosted-truenas-runners.md:55`: "workspace and temp state carry over between jobs".
- CI cancels often: 38 of 97 runs on `main` were cancelled (`gh run list --branch main --workflow CI`), plus superseded pull request runs.

The audit measured locally: `node --test archive.test.mjs rollback.test.mjs` with `TMPDIR` in a scratch directory, interrupted after 6 seconds, left 54 entries (`as-*` projects and 2 `agent-smith-*.lock` files). Each project is a git repository with a worktree. Nothing removes them, so they collect on the NAS. Whether the runner's `/tmp` survives a restart was not checked.

### Fix direction

- `ci.yml`, test step: `env: TMPDIR: ${{ runner.temp }}`. The runner empties that directory at the start and at the end of each job, so leftovers of a cancelled job go with the next job. No recursive delete is added anywhere.
- `release-after-green-ci` removes the cancels on `main`; this change covers pull request runs and killed jobs.
- One-off, by the owner on the runner: list the old `as-*` and `agent-smith-*.lock` entries in the system temp directory and remove them (file by file, as the repository rule asks).

### Tests

- A check in `tools/test/ci-runner.test.mjs` that the test step sets `TMPDIR` to `${{ runner.temp }}`.
- `run-lock.test.mjs` sets its own `TMPDIR`; it must stay green.

### Done when

After a cancelled CI job, the next job on the same runner starts with no scratch folder of the earlier one.
