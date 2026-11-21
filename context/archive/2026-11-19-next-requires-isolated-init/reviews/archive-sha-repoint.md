# Archive SHA repoint: next-requires-isolated-init

- **Date**: 2026-11-21
- **Target**: `origin/main` (repo `xycu/agent-smith`, fetched over HTTPS), snapshot `a1480e47283101fcddc4c357c970e30840713660`
- **Problem**: 6 completed Progress rows in `plan.md` ended in SHAs that are not in `origin/main` history. PR #237 was squash-merged.
- **Association**: PR #237 https://github.com/xycu/agent-smith/pull/237 (merged, base `main`). Its commit list holds the old SHAs.
- **Integration commit**: `b57c5d5a81d94c0af369c2ffb83b47ebed82a7d9` "fix(next-requires-isolated-init): Make next refuse a run that init would refuse for missing isolation (#237)". It is the squash of PR #237 and an ancestor of the target snapshot (`git merge-base --is-ancestor`, exit 0).
- **Decision**: the user chose "Update and archive" for the Wave 2 archive.
- **Rows repointed**: 6 (2 distinct SHAs). Pending and SHA-less rows were not touched.

| Row ID | Old suffix (resolved OID) | New SHA |
| ------ | ------------------------- | ------- |
| 1.1 | `aa17e6d9` (`aa17e6d9ccd60c4bd589cfa963e526a607fd4389`) | `b57c5d5a81d94c0af369c2ffb83b47ebed82a7d9` |
| 1.2 | `aa17e6d9` (`aa17e6d9ccd60c4bd589cfa963e526a607fd4389`) | `b57c5d5a81d94c0af369c2ffb83b47ebed82a7d9` |
| 1.3 | `aa17e6d9` (`aa17e6d9ccd60c4bd589cfa963e526a607fd4389`) | `b57c5d5a81d94c0af369c2ffb83b47ebed82a7d9` |
| 2.1 | `e2db0f57` (`e2db0f572c258e7db172f59369a04565c2e88533`) | `b57c5d5a81d94c0af369c2ffb83b47ebed82a7d9` |
| 2.2 | `e2db0f57` (`e2db0f572c258e7db172f59369a04565c2e88533`) | `b57c5d5a81d94c0af369c2ffb83b47ebed82a7d9` |
| 2.3 | `e2db0f57` (`e2db0f572c258e7db172f59369a04565c2e88533`) | `b57c5d5a81d94c0af369c2ffb83b47ebed82a7d9` |

The rows carry the 8-character form of the new SHA, as before.

This note is provenance. It is not an implementation review and not review coverage.
