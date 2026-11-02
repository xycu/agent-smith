---
change_id: release-packaging
title: Copy hegel-skill packaging and distribution with Semantic Versioning
status: impl_reviewed
created: 2026-11-02
updated: 2026-11-02
archived_at: null
---

## Notes

Take xycu/hegel-skill as the example and copy its packaging and distribution mechanics: release-please in the release-PR model (`release-please-config.json`, `.release-please-manifest.json`, `.github/workflows/release.yml`), version fields kept in lockstep across `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json` with a drift guard, Conventional Commits enforcement, and a CI workflow. Use Semantic Versioning (https://semver.org): `fix:` patch, `feat:` minor, `!` or `BREAKING CHANGE:` major. Run the full feature implementation from new (discovery) through archive and PR creation.

Known differences from hegel-skill to settle in research: this repo rebase-merges (see memory `branch-then-pr-merge`), so commit messages, not squash PR titles, land on `main`; there is no `gemini-extension.json`; the drift guard must be dependency-free Node 24 ESM (ADR-006), not Python; `marketplace.json` has no version fields yet; current version is `0.1.0` with no tag.
