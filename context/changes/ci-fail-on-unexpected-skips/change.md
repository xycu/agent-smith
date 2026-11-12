---
change_id: ci-fail-on-unexpected-skips
title: Fail CI when the OpenSpec contract tests or the git tests skip
status: new
created: 2026-11-12
updated: 2026-11-12
archived_at: null
---

## Notes

Source: the repo review of 2026-11-12 (tests, tools and CI audit). Severity: medium.

### Problem

Tests skip when a tool is missing, and nobody counts skips, so a missing tool turns a check off while CI stays green.

- `skills/10x-pipeline/test/openspec-contract.test.mjs:14-22`: `probe()` returns a skip reason when the `openspec` binary does not start. These five tests are the only check of the router's file-based OpenSpec reader (`scripts/openspec.mjs`, the task row pattern and the planning state) against the real CLI. The runner has no OpenSpec CLI, so they have never run in CI. A CLI release that changes the task row or the answer of `instructions apply` cannot turn CI red.
- `skills/10x-pipeline/test/helpers.mjs:177-180` (`gitAvailable`): at least 92 tests in 10 files carry `skip: noGit`, and more files gate on the same probe under other names. If `git` drops off the runner's PATH, all of them skip and the job passes.

### Evidence

CI run 43134692634: `tests 1075`, `pass 1065`, `fail 0`, `skipped 10`. The ten: five contract tests with "openspec does not start (ENOENT)", two privileged-only tests (see `ci-runner-non-root`), two `GH_LIVE` tests, one "CLAUDE.md has no @ imports".

### Fix direction

Smallest first:

1. In CI, a missing `git` is an error: when `process.env.CI` is set, `gitAvailable()` throws instead of returning `false`.
2. The contract tests, one of:
   - a. Install a pinned OpenSpec CLI in the `test` job and, when `process.env.CI` is set, make `probe()` fail instead of skip. The version pin is then the tested contract; a bump is a deliberate commit. This is a CI tool and not a dependency of the plugin, but it is the owner's call under the "no npm dependencies" rule.
   - b. If the CLI stays out of CI: a step after the suite that compares the `skipped` count with an expected number kept in the workflow, so that a new skip is seen. The contract then stays unchecked in CI, and `AGENTS.md` should say so.
3. Local runs keep skipping as today.

### Tests

- A unit test of the two probes with `CI` set and unset.
- CI evidence after option a: `skipped` falls by 5.

### Done when

A CI run without `git`, or (option a) without the pinned OpenSpec CLI, fails, and every skip that remains in CI is expected and listed.
