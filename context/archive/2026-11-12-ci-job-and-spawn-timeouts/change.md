---
change_id: ci-job-and-spawn-timeouts
title: Add job timeouts to CI and a spawn timeout to the test helpers
status: archived
created: 2026-11-12
updated: 2026-11-14
archived_at: 2026-11-14T02:10:50Z
---

## Notes

Source: the repo review of 2026-11-12 (tests, tools and CI audit). Severity: low to medium. Found by reading; no hang was reproduced.

### Problem

Nothing stops a test run that hangs.

- `.github/workflows/ci.yml:23-34` and `:36-51`: neither job sets `timeout-minutes`, so GitHub's default of 360 minutes applies.
- `skills/10x-pipeline/test/helpers.mjs:98-107` (`run`) calls `spawnSync` with no `timeout`; the `git` helper does the same. `node --test` has no default per-test timeout.

A router call that blocks (a git call that waits for input or a lock, a run lock that is never released) therefore holds the test process, and the job holds a self-hosted runner for up to six hours. A normal suite run takes about 3.5 minutes (CI run 43134692634: `duration_ms 205939`).

This is not the subject of `router-bash-timeout`, which is about the orchestrator's Bash calls.

### Fix direction

- `ci.yml`: `timeout-minutes: 15` on both jobs.
- `helpers.mjs`: `timeout: 120000` in `run` and in the `git` helper, and a clear failure when `res.error` is set (today a timed-out spawn would show up as `status: null` and a JSON parse of an empty string). Tests that pass their own smaller git timeouts through policy are not affected.

### Tests

- A test of `run` with a script that sleeps past a short timeout given through an option, asserting the error text.
- A check in `tools/test/ci-runner.test.mjs` that both jobs carry `timeout-minutes`.

### Done when

A router process that never returns fails its test within two minutes, and no CI job can run longer than 15 minutes.
