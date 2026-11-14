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

- Permanent regression scratch parents live directly under the worktree root so the tests continue to run after this change folder is archived. The one-off acceptance driver uses the change folder as planned.
- The shell switched from Node 24 to Node 26 during verification. A startup probe measured 0.257 seconds for the installed Node 24 and 1.342 seconds for Node 26 under the current load. Final gates pin the repository's required Node 24 with its bin directory first on PATH.
- An early hostile full-suite attempt exceeded its 24-minute harness limit. Its victim comparison passed before scratch cleanup encountered still-running workers. Verified leftover process groups were stopped. The final one-off driver uses a two-hour bound and kills its detached child process group on timeout before awaiting close.

## Phase 2

- Final focused command passed on Node 24.19.0. Five tests passed, zero skipped. Each of GIT_DIR, GIT_WORK_TREE, GIT_INDEX_FILE and their combination passed its real child suites with an unchanged victim. Both filesystem-boundary preflights passed in every scenario.
- After staging, the deliberate-break check replaced prefix stripping with a three-variable denylist in an isolated helper copy. The current environment regression failed with an AssertionError. Both temporary source copies were removed.

- Complete ordinary suite passed on Node 24.19.0. 1,289 tests, 1,286 passed, three skipped, zero failures. The command was the plan's complete three-directory shell glob, with the installed Node 24 bin directory first on PATH.
- Full hostile acceptance passed on Node 24.19.0. The temporary driver enumerated every .test.mjs file in the same three directories, ran node --test --test-reporter=tap with all three hostile Git variables and GH_LIVE=0, and recorded 1,289 tests, 1,286 passed, three skipped, zero failures. Its own test passed and exited 0. Both discovery-boundary preflights passed. The independent before/after comparison passed for HEAD, refs, commit count, index bytes, staged entries and the sorted complete path/content snapshot including .git.
- The acceptance command was node --test context/changes/tests-strip-git-env/acceptance-driver.mjs, with the installed Node 24 bin directory first on PATH. The driver was temporary verification scaffolding, removed after its successful run.
- Final availability skips matched phase one. Two read-only live GitHub tests require GH_LIVE=1, network and authenticated gh. The optional CLAUDE.md import check skipped because that file is absent. All required Git regressions and the five installed OpenSpec CLI contract cases executed.
- Strengthened the PATH override fixture with a distinct prepended scratch directory. The environment-builder test passed again on Node 24 after this assertion change.
- Pending Manual rows are absent from this plan.
