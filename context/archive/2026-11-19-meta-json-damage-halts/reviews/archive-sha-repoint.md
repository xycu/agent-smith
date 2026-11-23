# Archive SHA repoint: meta-json-damage-halts

- **Date**: 2026-11-21
- **Target**: `origin/main` (repo `xycu/agent-smith`, fetched over HTTPS), snapshot `3385de930b592bd50fc08b6e383cd900c4d0c5b7`
- **Problem**: 6 completed Progress rows in `plan.md` ended in a SHA that is not in `origin/main` history. PR #253 was squash-merged.
- **Association**: PR #253 https://github.com/xycu/agent-smith/pull/253 (merged, base `main`). Its commit list holds the old SHA, and its file list has the same size as the squash commit's.
- **Integration commit**: `aba1a4a50eb004c3f2abec6d07adb9e09765f168` "fix(meta-json-damage-halts): Halt on a damaged meta.json instead of replacing it with defaults (#253)". It is the squash of PR #253 and an ancestor of the target snapshot (`git merge-base --is-ancestor`, exit 0).
- **Decision**: the user chose "Update and archive" for the Wave 3 archive.
- **Rows repointed**: 6 (1 distinct SHA). Pending and SHA-less rows were not touched.

| Row ID | Old suffix (resolved OID) | New SHA |
| ------ | ------------------------- | ------- |
| 1.1 | `d3756244` (`d3756244ef2e862d878767bfc6e2d2024407e207`) | `aba1a4a50eb004c3f2abec6d07adb9e09765f168` |
| 1.2 | `d3756244` (`d3756244ef2e862d878767bfc6e2d2024407e207`) | `aba1a4a50eb004c3f2abec6d07adb9e09765f168` |
| 1.3 | `d3756244` (`d3756244ef2e862d878767bfc6e2d2024407e207`) | `aba1a4a50eb004c3f2abec6d07adb9e09765f168` |
| 1.4 | `d3756244` (`d3756244ef2e862d878767bfc6e2d2024407e207`) | `aba1a4a50eb004c3f2abec6d07adb9e09765f168` |
| 1.5 | `d3756244` (`d3756244ef2e862d878767bfc6e2d2024407e207`) | `aba1a4a50eb004c3f2abec6d07adb9e09765f168` |
| 1.6 | `d3756244` (`d3756244ef2e862d878767bfc6e2d2024407e207`) | `aba1a4a50eb004c3f2abec6d07adb9e09765f168` |

The rows carry the 8-character form of the new SHA, as before.

This note is provenance. It is not an implementation review and not review coverage.
