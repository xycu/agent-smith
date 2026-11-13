---
change_id: marketplace-entry-version
title: Drop the duplicate version from the marketplace plugin entry
status: planned
created: 2026-11-12
updated: 2026-11-13
archived_at: null
---

## Notes

Source: the repo review of 2026-11-12 (LLM engineering and Claude Code practice). Severity: low.

### Problem

The plugin version is written in four fields: `plugin.json` `version`, `marketplace.json` `metadata.version`, `marketplace.json` `plugins[0].version` and the release-please manifest. `tools/version-check.mjs` guards that they are equal.

Claude Code's marketplace guide advises against the third field (host-marketplace page, "Release a new version", read 2026-11-12): "Don't set `version` in both `plugin.json` and the marketplace entry." The repository does exactly that and adds a guard and a release-please `$..version` path to keep the two in step. Which value wins when they differ is not stated, so the guard protects against a state that should not be reachable.

### Fix direction

- Remove `version` from `plugins[0]` in `.claude-plugin/marketplace.json`.
- `release-please-config.json`: replace the `$..version` path for `marketplace.json` with `$.metadata.version`, so the release PR does not write the field back.
- `tools/version-check.mjs`: check three fields, and fail when the plugin entry carries a `version`.
- `AGENTS.md` ("One version, four fields" and the Project Structure bullet), `docs/REFERENCE.md` if it names the fields, and an amendment note in ADR-008.
- Check `metadata.version` against the same guide before keeping it; drop it too if the guide treats it as an alternate location of the same value.

### Tests

- `tools/test/` cases of `version-check.mjs`: three equal fields pass, a `version` in the plugin entry fails.
- `node tools/version-check.mjs` passes on the repository.
- `claude plugin validate` on the repository root, as a Manual row.

### Done when

The version of the plugin is written once per file, and the release PR of the next release changes exactly those fields.
