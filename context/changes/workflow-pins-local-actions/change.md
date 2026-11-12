---
change_id: workflow-pins-local-actions
title: Check local actions outside .github in the pin guard
status: new
created: 2026-11-12
updated: 2026-11-12
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
