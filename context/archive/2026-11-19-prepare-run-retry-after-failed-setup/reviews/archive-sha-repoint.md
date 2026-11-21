# Archive SHA repoint: prepare-run-retry-after-failed-setup

- **Date**: 2026-11-21
- **Target**: `origin/main` (repo `xycu/agent-smith`, fetched over HTTPS), snapshot `3385de930b592bd50fc08b6e383cd900c4d0c5b7`
- **Problem**: 4 completed Progress rows in `plan.md` ended in a SHA that is not in `origin/main` history. PR #252 was squash-merged.
- **Association**: PR #252 https://github.com/xycu/agent-smith/pull/252 (merged, base `main`). Its commit list holds the old SHA, and its file list has the same size as the squash commit's.
- **Integration commit**: `f0e4912b0e830c8eb41ac55d96fa1dcdf0721aeb` "fix(prepare-run-retry-after-failed-setup): Finish the change-folder copy when prepare-run is retried after a failed setup (#252)". It is the squash of PR #252 and an ancestor of the target snapshot (`git merge-base --is-ancestor`, exit 0).
- **Decision**: the user chose "Update and archive" for the Wave 3 archive.
- **Rows repointed**: 4 (1 distinct SHA). Pending and SHA-less rows were not touched.

| Row ID | Old suffix (resolved OID) | New SHA |
| ------ | ------------------------- | ------- |
| 1.1 | `f9239877` (`f92398775237ff4b5b0af7052f2a2be626774788`) | `f0e4912b0e830c8eb41ac55d96fa1dcdf0721aeb` |
| 1.2 | `f9239877` (`f92398775237ff4b5b0af7052f2a2be626774788`) | `f0e4912b0e830c8eb41ac55d96fa1dcdf0721aeb` |
| 1.3 | `f9239877` (`f92398775237ff4b5b0af7052f2a2be626774788`) | `f0e4912b0e830c8eb41ac55d96fa1dcdf0721aeb` |
| 1.4 | `f9239877` (`f92398775237ff4b5b0af7052f2a2be626774788`) | `f0e4912b0e830c8eb41ac55d96fa1dcdf0721aeb` |

The rows carry the 8-character form of the new SHA, as before.

This note is provenance. It is not an implementation review and not review coverage.
