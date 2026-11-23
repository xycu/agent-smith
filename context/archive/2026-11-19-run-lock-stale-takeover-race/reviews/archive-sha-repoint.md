# Archive SHA repoint: run-lock-stale-takeover-race

- **Date**: 2026-11-21
- **Target**: `origin/main` (repo `xycu/agent-smith`, fetched over HTTPS), snapshot `a1480e47283101fcddc4c357c970e30840713660`
- **Problem**: 11 completed Progress rows in `plan.md` ended in SHAs that are not in `origin/main` history. PR #235 was squash-merged.
- **Association**: PR #235 https://github.com/xycu/agent-smith/pull/235 (merged, base `main`). Its commit list holds the old SHAs.
- **Integration commit**: `7ca53f7a8ebc1111b22c012fe4f5f1b0fc774a2b` "fix(run-lock-stale-takeover-race): Stop two router processes from both taking over a stale run lock (#235)". It is the squash of PR #235 and an ancestor of the target snapshot (`git merge-base --is-ancestor`, exit 0).
- **Decision**: the user chose "Update and archive" for the Wave 2 archive.
- **Rows repointed**: 11 (1 distinct SHAs). Pending and SHA-less rows were not touched.

| Row ID | Old suffix (resolved OID) | New SHA |
| ------ | ------------------------- | ------- |
| 1.1 | `21f78071` (`21f780713dad590e266f37407262b9c1da70d554`) | `7ca53f7a8ebc1111b22c012fe4f5f1b0fc774a2b` |
| 1.2 | `21f78071` (`21f780713dad590e266f37407262b9c1da70d554`) | `7ca53f7a8ebc1111b22c012fe4f5f1b0fc774a2b` |
| 1.3 | `21f78071` (`21f780713dad590e266f37407262b9c1da70d554`) | `7ca53f7a8ebc1111b22c012fe4f5f1b0fc774a2b` |
| 1.4 | `21f78071` (`21f780713dad590e266f37407262b9c1da70d554`) | `7ca53f7a8ebc1111b22c012fe4f5f1b0fc774a2b` |
| 1.5 | `21f78071` (`21f780713dad590e266f37407262b9c1da70d554`) | `7ca53f7a8ebc1111b22c012fe4f5f1b0fc774a2b` |
| 2.1 | `21f78071` (`21f780713dad590e266f37407262b9c1da70d554`) | `7ca53f7a8ebc1111b22c012fe4f5f1b0fc774a2b` |
| 2.2 | `21f78071` (`21f780713dad590e266f37407262b9c1da70d554`) | `7ca53f7a8ebc1111b22c012fe4f5f1b0fc774a2b` |
| 2.3 | `21f78071` (`21f780713dad590e266f37407262b9c1da70d554`) | `7ca53f7a8ebc1111b22c012fe4f5f1b0fc774a2b` |
| 2.4 | `21f78071` (`21f780713dad590e266f37407262b9c1da70d554`) | `7ca53f7a8ebc1111b22c012fe4f5f1b0fc774a2b` |
| 2.5 | `21f78071` (`21f780713dad590e266f37407262b9c1da70d554`) | `7ca53f7a8ebc1111b22c012fe4f5f1b0fc774a2b` |
| 2.6 | `21f78071` (`21f780713dad590e266f37407262b9c1da70d554`) | `7ca53f7a8ebc1111b22c012fe4f5f1b0fc774a2b` |

The rows carry the 8-character form of the new SHA, as before.

This note is provenance. It is not an implementation review and not review coverage.
