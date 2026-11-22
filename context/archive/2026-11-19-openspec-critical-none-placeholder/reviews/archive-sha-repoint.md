# Archive SHA repoint: openspec-critical-none-placeholder

- **Date**: 2026-11-21
- **Target**: `origin/main` (repo `xycu/agent-smith`, fetched over HTTPS), snapshot `3385de930b592bd50fc08b6e383cd900c4d0c5b7`
- **Problem**: 2 completed Progress rows in `plan.md` ended in a SHA that is not in `origin/main` history. PR #250 was squash-merged.
- **Association**: PR #250 https://github.com/xycu/agent-smith/pull/250 (merged, base `main`). Its commit list holds the old SHA, and its file list has the same size as the squash commit's.
- **Integration commit**: `519dedcbf35d8b876dce9c3e3eec09fd61473788` "fix(openspec-critical-none-placeholder): Stop a "- None" line under Critical from failing an OpenSpec verification (#250)". It is the squash of PR #250 and an ancestor of the target snapshot (`git merge-base --is-ancestor`, exit 0).
- **Decision**: the user chose "Update and archive" for the Wave 3 archive.
- **Rows repointed**: 2 (1 distinct SHA). Pending and SHA-less rows were not touched.

| Row ID | Old suffix (resolved OID) | New SHA |
| ------ | ------------------------- | ------- |
| 1.1 | `a5944d57` (`a5944d57967fbdd50697e7b0bd2fe6a14983c8fe`) | `519dedcbf35d8b876dce9c3e3eec09fd61473788` |
| 1.2 | `a5944d57` (`a5944d57967fbdd50697e7b0bd2fe6a14983c8fe`) | `519dedcbf35d8b876dce9c3e3eec09fd61473788` |

The rows carry the 8-character form of the new SHA, as before.

This note is provenance. It is not an implementation review and not review coverage.
