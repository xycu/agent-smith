# Archive SHA repoint: open-pr-base-prefix-collision

- **Date**: 2026-11-21
- **Target**: `origin/main` (repo `xycu/agent-smith`, fetched over HTTPS), snapshot `3385de930b592bd50fc08b6e383cd900c4d0c5b7`
- **Problem**: 2 completed Progress rows in `plan.md` ended in a SHA that is not in `origin/main` history. PR #251 was squash-merged.
- **Association**: PR #251 https://github.com/xycu/agent-smith/pull/251 (merged, base `main`). Its commit list holds the old SHA, and its file list has the same size as the squash commit's.
- **Integration commit**: `3aa8feffc98f5859c6e5bd9bcaf881cdba1c7569` "fix(open-pr-base-prefix-collision): Keep a short isolation.branchPrefix from hiding the base branch in open-pr (#251)". It is the squash of PR #251 and an ancestor of the target snapshot (`git merge-base --is-ancestor`, exit 0).
- **Decision**: the user chose "Update and archive" for the Wave 3 archive.
- **Rows repointed**: 2 (1 distinct SHA). Pending and SHA-less rows were not touched.

| Row ID | Old suffix (resolved OID) | New SHA |
| ------ | ------------------------- | ------- |
| 1.1 | `cf0d7820` (`cf0d782094e0bc5858efe0078670d85da233f1ed`) | `3aa8feffc98f5859c6e5bd9bcaf881cdba1c7569` |
| 1.2 | `cf0d7820` (`cf0d782094e0bc5858efe0078670d85da233f1ed`) | `3aa8feffc98f5859c6e5bd9bcaf881cdba1c7569` |

The rows carry the 8-character form of the new SHA, as before.

This note is provenance. It is not an implementation review and not review coverage.
