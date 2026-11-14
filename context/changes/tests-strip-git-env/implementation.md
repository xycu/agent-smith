# Implementation evidence

## Phase 1

- Focused environment-consumer command from plan row 1.1 passed. 150 tests, 148 passed, two opt-in live GitHub tests skipped.
- Environment-site audit used the plan's process.env/spawnSync/execFileSync search across all three test directories. Every inventoried Git-capable builder now sanitizes its inherited base before explicit overrides. Remaining inherited values belong to executable/version probes, pure readers, deliberate hostile injection or already-sanitized fixture consumers.
- Complete ordinary suite passed. 1,284 tests, 1,281 passed, three skipped, zero failures.
- Skips were the two GH_LIVE opt-in tests and the absent CLAUDE.md import check. The installed OpenSpec CLI contract cases executed.
- Deliberate-break check changed prefix stripping to a single-key denylist in an isolated copy of the shared helper. The environment regression failed. The copy was removed. This isolates the mutation from concurrently running acceptance processes.
- Roadmap lookup found no matching change ID.

## Assumptions and adaptations

- Implement phases directly, following the invocation and the no-nested-subagent lesson.
- Exclude the pre-existing router-owned run.jsonl modification from staging, following repository state ownership.
- A nested Node test runner requires NODE_TEST_CONTEXT removed from its child environment. The first harness attempt exposed Node's recursive-run suppression. Named executed Git-test assertions caught the false green.
- Assert explicit fixture dates using epoch seconds. Apple Git renders strict ISO UTC with Z, while the input uses +00:00. Epoch values retain the same exact-date assertion across Git versions.
- Keep raw verification logs and the one-off acceptance driver temporary. Record their outcomes here.
