# Implementation verification

## Phase 1

The suite step sets `TMPDIR` to `${{ runner.temp }}`. Its configuration test selects that step within the test job and checks its own environment mapping. The existing test index describes the contract.

## Automated evidence

- Node `v24.19.0`.
- Initial configuration regression exited 1 with 8 passes and the new missing-environment assertion failing.
- After the environment edit, `node --test tools/test/ci-runner.test.mjs` exited 0 with 9 passes and zero skips.
- `TMPDIR="$PWD/context/changes/ci-scratch-in-runner-temp/verification-tmp" node --test skills/10x-pipeline/test/run-lock.test.mjs` exited 0 with all 12 cases passing and zero skips.
- Deliberate-break checks removed and replaced the value, moved it to the adjacent step, and moved it to job level. Each mutation failed the suite-step assertion. A `finally` block restored the workflow byte-for-byte, and all 9 configuration tests passed again.
- The initial complete-suite command with worktree-local `TMPDIR` exited 1 after 1,849,016.594 ms with 1,266 passes, 16 failures and 3 skips out of 1,285 tests.
- The complete-suite retry exited 0 after 4,686,343.766 ms with 1,282 passes, zero failures, zero cancellations and 3 skips out of 1,285 tests. The verification command used the same three globs with serial file scheduling and a Git discovery ceiling.

```sh
TMPDIR="$PWD/context/changes/ci-scratch-in-runner-temp/verification-tmp" GIT_CEILING_DIRECTORIES="$PWD/context/changes/ci-scratch-in-runner-temp/verification-tmp" node --test --test-concurrency=1 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs
```

- The two live PR-comment checks require `GH_LIVE=1`, network access and an authenticated `gh`. They were skipped through their existing opt-in condition.
- The `CLAUDE.md` import check was skipped because that optional file is absent, as permitted by `tools/test/agents-md-no-imports.test.mjs`.
- `node tools/version-check.mjs` exited 0 and reported version `1.10.0`.
- `git diff --check` passed. The phase diff covers the three owned source/index files and this change’s lifecycle and verification artifacts.
- After test hooks completed, the verification directory contained only the two suite logs. Its inspected entries were removed with the existing file-by-file cleanup helper.
- Dirty paths excluded from staging are the pre-existing router-owned `agent-smith/run.jsonl` and an external `AGENTS.md` edit made during verification. The latter changes the documented test concurrency to 2.

## Environment adaptation and assumptions

- Worktree-local scratch projects require a Git discovery ceiling. The initial full run let uninitialized fixtures discover the enclosing worktree repository. The isolated `entry records before state` test reproduced a real HEAD where it expected `null`. Adding `GIT_CEILING_DIRECTORIES` equal to the outer temporary directory made that same test pass. This uses Git’s existing discovery boundary, consistent with `helpers.mjs` setting a ceiling for initialized fixture Git commands.
- The first full run also failed the fixed-timeout PR-comment case and both 350 ms lock-termination cases. The retry uses Node’s built-in `--test-concurrency=1` to schedule the same files serially under host load. Its outer `TMPDIR` and discovery ceiling both point at the existing worktree-local verification directory.
- The task and reviewed plan settle the step environment and exact runner-temp expression. One phase suffices. All implementation stayed in this agent, as required by the task and the nested-subagent lesson.
- The roadmap contains no matching change ID.

## Pending manual verification

- [ ] 1.5 A green CI test job on a TrueNAS runner records its run URL, runner identity, effective suite `TMPDIR` and observed scratch or lock paths beneath the resolved runner-temp directory.
- [ ] 1.6 After cancelling a CI test job with observed scratch state, the next test job on the same runner starts with those earlier scratch projects and lock files absent, with both run URLs, runner identity, paths and job-start observations recorded.

Runner deletion permissions and same-runner cancellation cleanup remain subject to those observations. Legacy system-temp entries require the owner inventory described in the plan.
