# Archive SHA repoint: plan-zero-rows-skips-implement

- **Date**: 2026-11-21
- **Target**: `origin/main` (repo `xycu/agent-smith`, fetched over HTTPS), snapshot `a1480e47283101fcddc4c357c970e30840713660`
- **Problem**: 13 completed Progress rows in `plan.md` ended in SHAs that are not in `origin/main` history. PR #239 was squash-merged.
- **Association**: PR #239 https://github.com/xycu/agent-smith/pull/239 (merged, base `main`). Its commit list holds the old SHAs.
- **Integration commit**: `bd30eb93cbe3f1fd6409037d6c14cbb9b5018cbe` "fix(plan-zero-rows-skips-implement): Stop a plan with no readable Progress rows from skipping the implement step (#239)". It is the squash of PR #239 and an ancestor of the target snapshot (`git merge-base --is-ancestor`, exit 0).
- **Decision**: the user chose "Update and archive" for the Wave 2 archive.
- **Rows repointed**: 13 (3 distinct SHAs). Pending and SHA-less rows were not touched.

| Row ID | Old suffix (resolved OID) | New SHA |
| ------ | ------------------------- | ------- |
| 1.1 | `f4fbfefa` (`f4fbfefad0cfde7727c2bf46b0fa2a0876491162`) | `bd30eb93cbe3f1fd6409037d6c14cbb9b5018cbe` |
| 1.2 | `f4fbfefa` (`f4fbfefad0cfde7727c2bf46b0fa2a0876491162`) | `bd30eb93cbe3f1fd6409037d6c14cbb9b5018cbe` |
| 1.3 | `f4fbfefa` (`f4fbfefad0cfde7727c2bf46b0fa2a0876491162`) | `bd30eb93cbe3f1fd6409037d6c14cbb9b5018cbe` |
| 1.4 | `f4fbfefa` (`f4fbfefad0cfde7727c2bf46b0fa2a0876491162`) | `bd30eb93cbe3f1fd6409037d6c14cbb9b5018cbe` |
| 1.5 | `f4fbfefa` (`f4fbfefad0cfde7727c2bf46b0fa2a0876491162`) | `bd30eb93cbe3f1fd6409037d6c14cbb9b5018cbe` |
| 2.1 | `1e1e3f4f` (`1e1e3f4ffbef4ca995ed01efc981b8716c5b2f6a`) | `bd30eb93cbe3f1fd6409037d6c14cbb9b5018cbe` |
| 2.2 | `1e1e3f4f` (`1e1e3f4ffbef4ca995ed01efc981b8716c5b2f6a`) | `bd30eb93cbe3f1fd6409037d6c14cbb9b5018cbe` |
| 2.3 | `1e1e3f4f` (`1e1e3f4ffbef4ca995ed01efc981b8716c5b2f6a`) | `bd30eb93cbe3f1fd6409037d6c14cbb9b5018cbe` |
| 2.4 | `1e1e3f4f` (`1e1e3f4ffbef4ca995ed01efc981b8716c5b2f6a`) | `bd30eb93cbe3f1fd6409037d6c14cbb9b5018cbe` |
| 3.1 | `912fd1fe` (`912fd1fe412291d4e33907d50ff23749c9e7d00b`) | `bd30eb93cbe3f1fd6409037d6c14cbb9b5018cbe` |
| 3.2 | `912fd1fe` (`912fd1fe412291d4e33907d50ff23749c9e7d00b`) | `bd30eb93cbe3f1fd6409037d6c14cbb9b5018cbe` |
| 3.3 | `912fd1fe` (`912fd1fe412291d4e33907d50ff23749c9e7d00b`) | `bd30eb93cbe3f1fd6409037d6c14cbb9b5018cbe` |
| 3.4 | `912fd1fe` (`912fd1fe412291d4e33907d50ff23749c9e7d00b`) | `bd30eb93cbe3f1fd6409037d6c14cbb9b5018cbe` |

The rows carry the 8-character form of the new SHA, as before.

This note is provenance. It is not an implementation review and not review coverage.
