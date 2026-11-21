# Archive SHA repoint: codex-profile-and-gitdir-access

- **Date**: 2026-11-21
- **Target**: `origin/main` (repo `xycu/agent-smith`), snapshot `de7532602da7a89701bd247b9fdca3dc8868f900`
- **Problem**: 4 completed Progress rows in `plan.md` ended in a SHA that is not in `origin/main` history. PR #257 was squash-merged.
- **Association**: PR #257 https://github.com/xycu/agent-smith/pull/257 (merged, base `main`). Its commit list holds the old SHA `206d0f16`.
- **Integration commit**: `de7532602da7a89701bd247b9fdca3dc8868f900` "feat(codex-profile-and-gitdir-access): Warn at init when the Codex profile or the worktree gitdir access is missing (#257)". It is the squash of PR #257 and the target snapshot itself.
- **Decision**: the user chose "Update and archive".
- **Rows repointed**: 4 (1 distinct SHA). Pending Manual rows 1.5 and 1.6 were not touched; the user chose to archive with them unverified.

| Row ID | Old suffix (resolved OID) | New SHA |
| ------ | ------------------------- | ------- |
| 1.1 | `206d0f16` (`206d0f16c8a053a27163d44511089bd54e85a2ce`) | `de7532602da7a89701bd247b9fdca3dc8868f900` |
| 1.2 | `206d0f16` (`206d0f16c8a053a27163d44511089bd54e85a2ce`) | `de7532602da7a89701bd247b9fdca3dc8868f900` |
| 1.3 | `206d0f16` (`206d0f16c8a053a27163d44511089bd54e85a2ce`) | `de7532602da7a89701bd247b9fdca3dc8868f900` |
| 1.4 | `206d0f16` (`206d0f16c8a053a27163d44511089bd54e85a2ce`) | `de7532602da7a89701bd247b9fdca3dc8868f900` |

The rows carry the 8-character form of the new SHA, as before.

This note is provenance. It is not an implementation review and not review coverage.
