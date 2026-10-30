# Archive SHA repoint: rigor-levels

- **Date**: 2026-10-30
- **Target**: `origin/main` (remote `origin`, repo `xycu/agent-smith`), snapshot `4750d8636229cc429f5cb4566d6c090c81f4e3dd`
- **Problem**: all 18 completed Progress rows in `plan.md` ended in SHAs that are not in `origin/main` history. PR #4 was rebase-merged, which rewrote the six implementation commits.
- **Association**: PR #4 https://github.com/xycu/agent-smith/pull/4 (merged, base `main`, head `rigor-levels-fix`). Its commit list holds the six old SHAs.
- **Evidence**: each old commit and its rebased counterpart on `main` have the same subject and the same `git patch-id --stable`. Each new commit is an ancestor of the target snapshot (`git merge-base --is-ancestor`, exit 0).
- **Decision**: the user chose "Update and archive" in `/10x-archive rigor-levels`.
- **Rows repointed**: 18 (6 distinct SHAs). Pending and SHA-less rows were not touched.

| Row ID | Old suffix (resolved OID) | New SHA |
| ------ | ------------------------- | ------- |
| 1.1 | `690b214` (`690b214efc3a65d71a6b4f12f762f2f719c84806`) | `8c3a4467478117b37e839059bf465e98e58005a9` |
| 1.2 | `690b214` (`690b214efc3a65d71a6b4f12f762f2f719c84806`) | `8c3a4467478117b37e839059bf465e98e58005a9` |
| 2.1 | `63c956a` (`63c956ab9aec70b53c0e7ca1f182e06b154fe9d4`) | `815ca63e188ca6c0380bf460302fbbff45cacda5` |
| 2.2 | `63c956a` (`63c956ab9aec70b53c0e7ca1f182e06b154fe9d4`) | `815ca63e188ca6c0380bf460302fbbff45cacda5` |
| 2.3 | `63c956a` (`63c956ab9aec70b53c0e7ca1f182e06b154fe9d4`) | `815ca63e188ca6c0380bf460302fbbff45cacda5` |
| 3.1 | `e36f95f` (`e36f95f70a98efb2b25e8f0f3bf9acd5f5c70ee2`) | `861fe800c2ba218f2297c6b647465ce9374cb96c` |
| 3.2 | `e36f95f` (`e36f95f70a98efb2b25e8f0f3bf9acd5f5c70ee2`) | `861fe800c2ba218f2297c6b647465ce9374cb96c` |
| 4.1 | `d59a8a3` (`d59a8a31c91dfe20f7e3fe2e644a7f7e6c28c438`) | `c51f359fdbbe187e445cb3129846b6c6d42e55b8` |
| 4.2 | `d59a8a3` (`d59a8a31c91dfe20f7e3fe2e644a7f7e6c28c438`) | `c51f359fdbbe187e445cb3129846b6c6d42e55b8` |
| 5.1 | `1edfe99` (`1edfe99d1f7a2fea82b45c7b67bc296700026189`) | `92611bc9b33818422af6252e1373336893f12f00` |
| 5.2 | `1edfe99` (`1edfe99d1f7a2fea82b45c7b67bc296700026189`) | `92611bc9b33818422af6252e1373336893f12f00` |
| 5.3 | `1edfe99` (`1edfe99d1f7a2fea82b45c7b67bc296700026189`) | `92611bc9b33818422af6252e1373336893f12f00` |
| 6.1 | `da343f1` (`da343f1152e56e334b32ff632f49174ea8d91915`) | `9496c7bc83fb778aba0031ef8f9137924b39e2df` |
| 6.2 | `da343f1` (`da343f1152e56e334b32ff632f49174ea8d91915`) | `9496c7bc83fb778aba0031ef8f9137924b39e2df` |
| 6.3 | `da343f1` (`da343f1152e56e334b32ff632f49174ea8d91915`) | `9496c7bc83fb778aba0031ef8f9137924b39e2df` |
| 6.4 | `da343f1` (`da343f1152e56e334b32ff632f49174ea8d91915`) | `9496c7bc83fb778aba0031ef8f9137924b39e2df` |
| 6.5 | `da343f1` (`da343f1152e56e334b32ff632f49174ea8d91915`) | `9496c7bc83fb778aba0031ef8f9137924b39e2df` |
| 6.6 | `da343f1` (`da343f1152e56e334b32ff632f49174ea8d91915`) | `9496c7bc83fb778aba0031ef8f9137924b39e2df` |

The rows carry the 7-character form of each new SHA, as before.

This note is provenance. It is not an implementation review and not review coverage.
