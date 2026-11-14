# Drop the duplicate version from the marketplace plugin entry — Plan Brief

> Full plan: `context/changes/marketplace-entry-version/plan.md`

## What & Why

The plugin version sits in `plugin.json`, in `marketplace.json` twice (`metadata.version` and `plugins[0].version`) and in the release-please manifest. Claude Code's marketplace guide says not to set `version` in both `plugin.json` and the marketplace entry, because `plugin.json` wins and `claude plugin validate` warns on a mismatch. The repository keeps the duplicate and guards it; this change removes it so the version is written once per file.

## Starting Point

`release-please-config.json` rewrites every `version` key of `marketplace.json` (`$..version`). `tools/version-check.mjs` checks four fields for equality and SemVer, and its test pins the four-field shape and a count of 2 `version` keys. `AGENTS.md` and ADR-008 say "one version, four fields".

## Desired End State

`marketplace.json` holds one version (`metadata.version`), release-please writes only that path, and the guard checks three fields and fails when any plugin entry carries `version`. Docs say three fields; ADR-008 gets Amendment 3. The next release PR changes `plugin.json` `version`, `marketplace.json` `metadata.version`, the manifest `.` and `CHANGELOG.md`, nothing else.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Keep `metadata.version` | Keep | The marketplace reference lists it as the alternate location of the top-level `version`, the "Marketplace manifest version", not of the plugin version. | Plan (guide read 2026-11-13) |
| Entry guard scope | Any `plugins[i]` owning a `version` key fails, whatever its value | Equally small as checking `plugins[0]` and correct if a second entry or a `null` value appears. | Plan |
| Key-count test | Real `marketplace.json` must hold exactly 1 `version` key | The narrowed path would leave a new top-level `version` unreleased, so the count catches it. | Plan |
| `docs/REFERENCE.md` | No change | It does not name the version fields. | Plan (grep) |
| ADR form | Amendment 3 plus one "Superseded" parenthetical in Decision | Matches how Amendments 1 and 2 mark older text. | Plan |
| `claude plugin validate` | Manual row, not CI | change.md asks for it; the CI runner has no Claude Code CLI. | change.md |

## Scope

**In scope:** `.claude-plugin/marketplace.json`, `release-please-config.json`, `tools/version-check.mjs`, `tools/test/version-check.test.mjs`, `AGENTS.md`, ADR-008, `docs/ADR/README.md`, `skills/10x-pipeline/test/README.md`.

**Out of scope:** dropping or moving `metadata.version`; `plugin.json`, the manifest, workflows, `CHANGELOG.md`; `docs/REFERENCE.md`; editing version values by hand.

## Architecture / Approach

Phase 1 changes data, config, guard and tests in one commit, because the old test asserts the four-field shape. `collect` returns three fields; `check` adds one rule for entry versions and still never throws. Phase 2 updates the docs.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Three fields and the entry guard | Entry version removed, `$.metadata.version`, guard and tests on three fields | Breaking `check`'s no-throw contract on odd `plugins` shapes |
| 2. Docs and ADR-008 Amendment 3 | AGENTS.md, ADR-008, two index rows | `AGENTS.md` over 12288 bytes (now 10681) |

**Prerequisites:** Node 24+; `claude` CLI for the manual validate row.
**Estimated effort:** one short session, two phases.

## Open Risks & Assumptions

- release-please's json updater with `$.metadata.version` is assumed to behave like `$.version` on `plugin.json`; the next release PR confirms it (row 2.5).
- The guide wording was read on 2026-11-13; a later change to it could make `metadata.version` redundant too.

## Success Criteria (Summary)

- `node tools/version-check.mjs` and the full suite pass; the new entry-version tests pass.
- `claude plugin validate .` passes with no version warning.
- The next release PR touches exactly the three version fields and `CHANGELOG.md`.
