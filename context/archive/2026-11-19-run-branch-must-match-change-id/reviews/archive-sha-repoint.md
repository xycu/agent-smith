# Archive SHA repoint: run-branch-must-match-change-id

- **Date**: 2026-11-21
- **Target**: `origin/main` (repo `xycu/agent-smith`, fetched over HTTPS), snapshot `a1480e47283101fcddc4c357c970e30840713660`
- **Problem**: 10 completed Progress rows in `plan.md` ended in SHAs that are not in `origin/main` history. PR #238 was squash-merged.
- **Association**: PR #238 https://github.com/xycu/agent-smith/pull/238 (merged, base `main`). Its commit list holds the old SHAs.
- **Integration commit**: `1135c2ac812b18381096cfcf8013afc85baf72e9` "fix(run-branch-must-match-change-id): Refuse to run a change on another change's run branch (#238)". It is the squash of PR #238 and an ancestor of the target snapshot (`git merge-base --is-ancestor`, exit 0).
- **Decision**: the user chose "Update and archive" for the Wave 2 archive.
- **Rows repointed**: 10 (2 distinct SHAs). Pending and SHA-less rows were not touched.

| Row ID | Old suffix (resolved OID) | New SHA |
| ------ | ------------------------- | ------- |
| 1.1 | `65a69f75` (`65a69f7574a4b30a72121c54dfb30253c598e8cc`) | `1135c2ac812b18381096cfcf8013afc85baf72e9` |
| 1.2 | `65a69f75` (`65a69f7574a4b30a72121c54dfb30253c598e8cc`) | `1135c2ac812b18381096cfcf8013afc85baf72e9` |
| 1.3 | `65a69f75` (`65a69f7574a4b30a72121c54dfb30253c598e8cc`) | `1135c2ac812b18381096cfcf8013afc85baf72e9` |
| 1.4 | `65a69f75` (`65a69f7574a4b30a72121c54dfb30253c598e8cc`) | `1135c2ac812b18381096cfcf8013afc85baf72e9` |
| 1.5 | `65a69f75` (`65a69f7574a4b30a72121c54dfb30253c598e8cc`) | `1135c2ac812b18381096cfcf8013afc85baf72e9` |
| 2.1 | `d0c5914a` (`d0c5914a545915aaf73b5d8b7bda8dab75f396b3`) | `1135c2ac812b18381096cfcf8013afc85baf72e9` |
| 2.2 | `d0c5914a` (`d0c5914a545915aaf73b5d8b7bda8dab75f396b3`) | `1135c2ac812b18381096cfcf8013afc85baf72e9` |
| 2.3 | `d0c5914a` (`d0c5914a545915aaf73b5d8b7bda8dab75f396b3`) | `1135c2ac812b18381096cfcf8013afc85baf72e9` |
| 2.4 | `d0c5914a` (`d0c5914a545915aaf73b5d8b7bda8dab75f396b3`) | `1135c2ac812b18381096cfcf8013afc85baf72e9` |
| 2.5 | `d0c5914a` (`d0c5914a545915aaf73b5d8b7bda8dab75f396b3`) | `1135c2ac812b18381096cfcf8013afc85baf72e9` |

The rows carry the 8-character form of the new SHA, as before.

This note is provenance. It is not an implementation review and not review coverage.
