---
change_id: test-shard-durations-refresh
title: Refresh the test shard durations and stop them going stale
status: new
created: 2026-11-19
updated: 2026-11-19
archived_at: null
---

## Notes

**Origin.** Review of the past week's changes on 2026-11-19. Low-severity upkeep of the six-shard CI split (`tools/test-shards.mjs`, `tools/test-durations.json`, `.github/workflows/ci.yml`).

**State.** The suite has 81 test files; `tools/test-durations.json` has 76 entries. These five files have no entry and get the 5-second fallback in the greedy split:

- `skills/10x-pipeline/test/accounting-readers.test.mjs`
- `skills/10x-pipeline/test/claude-usage.test.mjs`
- `skills/10x-pipeline/test/codex-usage.test.mjs`
- `skills/10x-pipeline/test/usage-evidence.test.mjs`
- `tools/test/test-shards.test.mjs`

Four of them arrived with PR #215. Nothing fails today; the shards are only less balanced than they could be, and nothing tells a contributor that a new test file needs an entry. There are no stale entries.

**Second point.** `tools/test-shards.mjs:7` imports `isEntryPoint` from `../skills/10x-pipeline/scripts/pr-common.mjs`. A repository tool now depends on a module of the shipped skill. It works, and it is the only such import in `tools/`. The plan decides whether to keep it (and say so in the tools index) or to give `tools/` its own small helper; do not move the helper out of the skill, because the standalone scripts use it.

**The change.**
- Add measured durations for the five files.
- Make the drift visible: a test in `tools/test/` that fails when a test file has no entry or an entry names a file that no longer exists, or a documented command that regenerates the file. A failing test is the stronger guard; the plan confirms it does not make adding a test file painful (the message must say exactly what to add).

**Constraints.**
- No npm dependencies; `node:` built-ins only.
- The shard count and the CI job layout stay as they are.
- A new test gets its row in `skills/10x-pipeline/test/README.md` (the test index), not in `AGENTS.md`.
- These commits are `chore` or `test`, so the change opens no release PR on its own.

**Done when.**
- Every test file matched by the suite glob has an entry in `tools/test-durations.json`, and no entry is stale.
- Adding a test file without an entry is caught locally by the suite, or the regeneration command is documented where a contributor looks first.
- The full suite passes: `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs`.
