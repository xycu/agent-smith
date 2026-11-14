---
change_id: workflow-pins-local-actions
title: Check local actions outside .github in the pin guard
status: implementing
created: 2026-11-12
updated: 2026-11-15
archived_at: null
---

## Notes

Source: the repo review of 2026-11-12 (tests, tools and CI audit). Severity: low, latent: the repository has no local action today.

### Problem

`tools/workflow-pins.mjs` reads every YAML file under `.github/` and a root `action.yml` or `action.yaml` (`files`, `:34-46`), and skips `uses: ./…` references (`:28`). A local composite action that lives anywhere else is never read, so an unpinned remote action inside it passes the guard.

Probe in a scratch directory:

- `.github/workflows/x.yml` with `uses: ./actions/setup` and one pinned `actions/checkout`.
- `actions/setup/action.yml` with `uses: actions/setup-node@v5`.

`check(<scratch>)` returns `[]`.

### Fix direction

- In `check`, collect each `./<path>` reference that `findUses` skips today, resolve it against the root, and add `<path>/action.yml` or `<path>/action.yaml` to the files to check (once each; follow references found there too). A referenced path with neither file is an error, in line with the guard's fail-closed rule.
- Update the header comment of the module and the `tools/workflow-pins.mjs` line in `AGENTS.md`.

### Tests

- `tools/test/workflow-pins.test.mjs`: the probe above fails with the file and line of the unpinned action; a pinned local action passes; a reference to a missing local action fails.

### Done when

An unpinned remote action in a local action outside `.github/` fails the suite.


## Implementation verification

- Verified on 2026-11-14–15 with Node v24.19.0. All 19 focused tests pass with zero skips.
- The regression suite failed 11 cases against the original implementation. Deliberately restoring the local-reference skip also failed 11 cases, then the working implementation was restored.
- The required full suite completed with 1,532 passing tests, zero failures and three skips out of 1,535 tests. The skips were the two opt-in live GitHub tests requiring `GH_LIVE=1` and authenticated network access, and the absent `CLAUDE.md` import check.
- Fixtures used a worktree-local `TMPDIR`. An invalid `.git` discovery boundary in its scratch parent prevented non-repository fixtures from inheriting the run repository. The initial unisolated attempt exposed this through executor tests reading the run branch HEAD, and all three reproduced executor failures passed after isolation.
- `node tools/version-check.mjs` and `git diff --check` pass. The implementation changes only the guard, its existing tests and the workflow-pins parenthetical in AGENTS. No Manual rows are pending.
