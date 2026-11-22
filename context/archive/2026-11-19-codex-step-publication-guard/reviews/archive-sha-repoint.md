# Archive SHA repoint: codex-step-publication-guard

- **Date**: 2026-11-21
- **Target**: `origin/main` (repo `xycu/agent-smith`, fetched over HTTPS), snapshot `a1480e47283101fcddc4c357c970e30840713660`
- **Problem**: 10 completed Progress rows in `plan.md` ended in SHAs that are not in `origin/main` history. PR #236 was squash-merged.
- **Association**: PR #236 https://github.com/xycu/agent-smith/pull/236 (merged, base `main`). Its commit list holds the old SHAs.
- **Integration commit**: `1393e5ffc6af3d16e277fb27490f8aef24c88eba` "fix(codex-step-publication-guard): Stop Codex steps from pushing, publishing or reading GitHub tokens (#236)". It is the squash of PR #236 and an ancestor of the target snapshot (`git merge-base --is-ancestor`, exit 0).
- **Decision**: the user chose "Update and archive" for the Wave 2 archive.
- **Rows repointed**: 10 (3 distinct SHAs). Pending and SHA-less rows were not touched.

| Row ID | Old suffix (resolved OID) | New SHA |
| ------ | ------------------------- | ------- |
| 1.1 | `41ce6574` (`41ce6574ac8a4b6c92f0611bb86234613a347cb6`) | `1393e5ffc6af3d16e277fb27490f8aef24c88eba` |
| 1.2 | `41ce6574` (`41ce6574ac8a4b6c92f0611bb86234613a347cb6`) | `1393e5ffc6af3d16e277fb27490f8aef24c88eba` |
| 1.3 | `41ce6574` (`41ce6574ac8a4b6c92f0611bb86234613a347cb6`) | `1393e5ffc6af3d16e277fb27490f8aef24c88eba` |
| 2.1 | `591eb324` (`591eb324de4c423b0f0b6924fa41319e88e7f965`) | `1393e5ffc6af3d16e277fb27490f8aef24c88eba` |
| 2.2 | `591eb324` (`591eb324de4c423b0f0b6924fa41319e88e7f965`) | `1393e5ffc6af3d16e277fb27490f8aef24c88eba` |
| 2.3 | `591eb324` (`591eb324de4c423b0f0b6924fa41319e88e7f965`) | `1393e5ffc6af3d16e277fb27490f8aef24c88eba` |
| 3.1 | `3b17d00d` (`3b17d00d6acc44ac0fef3241fa2bfe2f420b7583`) | `1393e5ffc6af3d16e277fb27490f8aef24c88eba` |
| 3.2 | `3b17d00d` (`3b17d00d6acc44ac0fef3241fa2bfe2f420b7583`) | `1393e5ffc6af3d16e277fb27490f8aef24c88eba` |
| 3.3 | `3b17d00d` (`3b17d00d6acc44ac0fef3241fa2bfe2f420b7583`) | `1393e5ffc6af3d16e277fb27490f8aef24c88eba` |
| 3.4 | `3b17d00d` (`3b17d00d6acc44ac0fef3241fa2bfe2f420b7583`) | `1393e5ffc6af3d16e277fb27490f8aef24c88eba` |

The rows carry the 8-character form of the new SHA, as before.

This note is provenance. It is not an implementation review and not review coverage.
