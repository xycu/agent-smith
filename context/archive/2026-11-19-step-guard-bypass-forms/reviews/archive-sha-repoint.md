# Archive SHA repoint: step-guard-bypass-forms

- **Date**: 2026-11-21
- **Target**: `origin/main` (repo `xycu/agent-smith`, fetched over HTTPS), snapshot `9e45fa79ff5268455b319bf4b84d331926c69869`
- **Problem**: 16 completed Progress rows in `plan.md` ended in SHAs that are not in `origin/main` history. PR #241 was squash-merged.
- **Association**: PR #241 https://github.com/xycu/agent-smith/pull/241 (merged, base `main`). Its commit list holds the old SHAs.
- **Integration commit**: `9e45fa79ff5268455b319bf4b84d331926c69869` "fix(step-guard-bypass-forms): Make the step guard deny forbidden commands behind common shell shapes (#241)". It is the squash of PR #241 and an ancestor of the target snapshot (`git merge-base --is-ancestor`, exit 0).
- **Decision**: the user chose "Update and archive" for the Wave 2 archive.
- **Rows repointed**: 16 (4 distinct SHAs). Pending and SHA-less rows were not touched.

| Row ID | Old suffix (resolved OID) | New SHA |
| ------ | ------------------------- | ------- |
| 1.1 | `9f57423c` (`9f57423c570e75b42031d5f339bfbc1e77b97b6d`) | `9e45fa79ff5268455b319bf4b84d331926c69869` |
| 1.2 | `9f57423c` (`9f57423c570e75b42031d5f339bfbc1e77b97b6d`) | `9e45fa79ff5268455b319bf4b84d331926c69869` |
| 1.3 | `9f57423c` (`9f57423c570e75b42031d5f339bfbc1e77b97b6d`) | `9e45fa79ff5268455b319bf4b84d331926c69869` |
| 2.1 | `76565ff3` (`76565ff3e662b8ef00302b380ff79931a423e7a3`) | `9e45fa79ff5268455b319bf4b84d331926c69869` |
| 2.2 | `76565ff3` (`76565ff3e662b8ef00302b380ff79931a423e7a3`) | `9e45fa79ff5268455b319bf4b84d331926c69869` |
| 2.3 | `76565ff3` (`76565ff3e662b8ef00302b380ff79931a423e7a3`) | `9e45fa79ff5268455b319bf4b84d331926c69869` |
| 3.1 | `74f8db52` (`74f8db52f7cf673743b16374dec7d495263a0af6`) | `9e45fa79ff5268455b319bf4b84d331926c69869` |
| 3.2 | `74f8db52` (`74f8db52f7cf673743b16374dec7d495263a0af6`) | `9e45fa79ff5268455b319bf4b84d331926c69869` |
| 3.3 | `74f8db52` (`74f8db52f7cf673743b16374dec7d495263a0af6`) | `9e45fa79ff5268455b319bf4b84d331926c69869` |
| 4.1 | `83a9c242` (`83a9c242cdf92df074f20db562f7c1310af6daf6`) | `9e45fa79ff5268455b319bf4b84d331926c69869` |
| 4.2 | `83a9c242` (`83a9c242cdf92df074f20db562f7c1310af6daf6`) | `9e45fa79ff5268455b319bf4b84d331926c69869` |
| 4.3 | `83a9c242` (`83a9c242cdf92df074f20db562f7c1310af6daf6`) | `9e45fa79ff5268455b319bf4b84d331926c69869` |
| 4.4 | `83a9c242` (`83a9c242cdf92df074f20db562f7c1310af6daf6`) | `9e45fa79ff5268455b319bf4b84d331926c69869` |
| 4.5 | `83a9c242` (`83a9c242cdf92df074f20db562f7c1310af6daf6`) | `9e45fa79ff5268455b319bf4b84d331926c69869` |
| 4.6 | `83a9c242` (`83a9c242cdf92df074f20db562f7c1310af6daf6`) | `9e45fa79ff5268455b319bf4b84d331926c69869` |
| 4.7 | `83a9c242` (`83a9c242cdf92df074f20db562f7c1310af6daf6`) | `9e45fa79ff5268455b319bf4b84d331926c69869` |

The rows carry the 8-character form of the new SHA, as before.

This note is provenance. It is not an implementation review and not review coverage.
