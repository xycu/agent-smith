<!-- IMPL-REVIEW-REPORT -->
# Implementation Review — Strip inherited Git variables from test environments

- **Plan**: `context/changes/tests-strip-git-env/plan.md`
- **Scope**: Full plan
- **Reviewed phases**: 1, 2
- **Date**: 2026-11-14
- **Reviewed commit**: `0f7281f816ba80162cfb124b74342aeb5995bd7a`
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 1 observation

The verdict and counts describe the implementation before review edits. Both phases and all five completed Automated rows were reviewed. The plan contains no Manual rows.

## Verdicts

| Dimension | Verdict |
| --- | --- |
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Repository-wide test concurrency documentation extends the planned scope

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision, narrowly scoped documentation choice
- **Dimension**: Scope Discipline
- **Location**: `AGENTS.md:16`, introduced by `0f7281f`
- **Detail**: The plan assigns environment builders, their imports, the new regression, the test index and this change's artifacts. The step-4 commit also adds `--test-concurrency=2` to the repository-wide test command in `AGENTS.md`. That changes the documented execution policy for future work beyond this environment-isolation change. The supplied repository instructions prescribe the same cap, so verification used it successfully.
- **Fix**: Have the owner decide whether to include the global concurrency recommendation in this change's scope or move it to a separate maintenance change.
- **Decision**: PENDING — `AGENTS.md` is outside the plan's file ownership. The owner must decide whether the repository-wide concurrency cap belongs in this run or a separate maintenance change.

## Implementation checks

| Planned region | Result |
| --- | --- |
| Shared `cleanEnv`, `run` and `gitEnv` | Fresh call-time filtering removes every inherited uppercase `GIT_` key. Explicit values are merged afterward. Existing signatures, timeouts, spawn errors and return shapes are preserved. |
| Standalone environment builders | `open-pr`, all four `pr-comment` environments and the OpenSpec CLI environment use `cleanEnv`. Commit-lint uses its planned local filter. Fixture HOME, PATH, identity, config, telemetry controls and intentional `GIT_LOG` retain precedence. |
| Direct router wrappers | Both `agents` launch branches and the provenance and rule-level copied-router wrappers sanitize their inherited environment. Their existing assertions and outputs are preserved. |
| Environment regression | Covers the arbitrary Git sentinel, exact prefix boundary, fresh copies, call-time reads, parent restoration, explicit overrides and fixed commit dates. |
| Hostile child matrix | All four scenarios execute the required Git tests. The combined scenario includes the additional planned suites. Child lists exclude the regression itself, and removing `NODE_TEST_CONTEXT` allows the nested runner to execute. |
| Victim integrity and discovery | Each scenario uses an independent observer, a committed sentinel and populated index, complete path/content snapshots, disabled optional index refresh, a filesystem discovery boundary and both plain/initialized discovery preflights. |
| Test index and ownership | The new test has its README row and the helper contract is documented. Sibling-owned test assertions, router behavior, policies and CI configuration retain their existing implementation. F1 records the additional documentation change. |

## Automated verification

Commands ran from this worktree on Node `v24.19.0` and Git `2.54.0 (Apple Git-157)`. Test invocations used the supplied repository command's concurrency cap and the TAP reporter. Every runner exited 0 with no spawn error or terminating signal.

### Phase 1

The environment-consumer and timeout gate passed with 150 tests, 148 passed, two skipped and zero failures in 110.09 seconds.

```sh
node --test --test-concurrency=2 --test-reporter=tap skills/10x-pipeline/test/helpers-timeout.test.mjs skills/10x-pipeline/test/open-pr.test.mjs skills/10x-pipeline/test/pr-comment.test.mjs skills/10x-pipeline/test/provenance.test.mjs skills/10x-pipeline/test/rule-levels.test.mjs skills/10x-pipeline/test/agents.test.mjs skills/openspec-pipeline/test/openspec-contract.test.mjs tools/test/commit-lint.test.mjs
```

The environment-site audit passed. All 13 inventoried Git-capable inherited bases sanitize before explicit fixture values. Remaining inheritance sites are executable/version probes, pure readers, deliberate hostile injection or consumers of an already constructed fixture environment. The additional child-process API audit found the Codex fixture also receives `gitEnv`.

```sh
rg -n 'process\.env|spawnSync|execFileSync' skills/10x-pipeline/test skills/openspec-pipeline/test tools/test
rg -n 'node:child_process|\bspawn\(|\bexec\(|\bexecFile\(|\bexecSync\(' skills/10x-pipeline/test skills/openspec-pipeline/test tools/test
```

### Phase 2

The focused regression passed with five tests, five passed, zero skipped and zero failures in 144.30 seconds. Each hostile scenario executed its required Git cases, passed its discovery preflights and preserved its complete victim snapshot.

```sh
node --test --test-concurrency=2 --test-reporter=tap skills/10x-pipeline/test/helpers-env.test.mjs
```

The ordinary full suite passed with 1,289 tests, 1,286 passed, three skipped and zero failures in 1,102.97 seconds. The driver enumerated the same three directories and file patterns as this command.

```sh
node --test --test-concurrency=2 --test-reporter=tap skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs
```

The hostile full-suite acceptance passed with 1,289 tests, 1,286 passed, three skipped and zero failures in 950.26 seconds. A one-off driver executed through `node --input-type=module` enumerated the same test files and spawned the same full-suite arguments. It independently stripped inherited Git controls, then appended `GIT_DIR`, `GIT_WORK_TREE` and `GIT_INDEX_FILE` selecting its disposable victim, with `GH_LIVE=0` and temporary-directory values pointing inside its worktree-local parent.

The driver preflight confirmed that a plain descendant resolves neither a repository nor HEAD and that an initialized descendant resolves its own top level. The final independent comparison passed for HEAD, refs, commit count, index bytes, staged entries and every path and file content including `.git`. The parent and its logs were inspected and removed through `removeTree` after verification.

### Availability skips

- Two read-only live GitHub tests require `GH_LIVE=1`, network access and authenticated `gh`.
- The optional `CLAUDE.md` import check skips because that file is absent.
- All five installed OpenSpec CLI contract cases and all required Git regressions executed.

## Triage and assumptions

- F1 requires an owner scope decision under the invocation's rule for findings outside the plan. It remains PENDING.
- The current repository instructions supplied with this review prescribe `--test-concurrency=2`. Verification applied that cap to each automated gate.
- Both review tracks were performed locally under the unattended, no-nested-subagent instruction and the matching accepted lesson.
- Change status is stamped `impl_reviewed`. The plan's Progress section remains as reviewed.
