<!-- PLAN-REVIEW-REPORT -->
# Plan Review — CI scratch projects in runner temp

- **Plan**: context/changes/ci-scratch-in-runner-temp/plan.md
- **Mode**: Deep
- **Date**: 2026-11-14
- **Verdict**: SOUND
- **Findings**: 0 critical, 0 warnings, 0 observations

Counts and verdict describe the reviewed input plan.

## Verdicts

| Dimension | Verdict |
| --- | --- |
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS |
| Plan Completeness | PASS |

## Grounding

Grounding — 8/8 existing source paths verified, 6/6 symbols verified, brief↔plan consistent.

The implementation names three existing edit targets. Five supporting paths establish inheritance, override precedence and both-chain compatibility.

| Source | Evidence |
| --- | --- |
| `.github/workflows/ci.yml:27` | Job `test` uses Linux runners. Its `Test suite` step at line 38 inherits the environment and invokes the three planned test globs. A step-local `env` mapping fits this boundary. |
| `tools/test/ci-runner.test.mjs:37` | `testJob()` isolates the test job. Existing tests inspect workflow text with built-in assertions, supporting the planned step-indentation boundary. |
| `skills/10x-pipeline/test/README.md:106` | The existing `ci-runner.test.mjs` row is the shared index entry identified in the plan. |
| `skills/10x-pipeline/test/helpers.mjs:62` | `makeProject()` uses the real path of `os.tmpdir()`. `cleanupAll()` at line 23 removes registered scratch directories. `run()` at line 129 merges explicit child environment values after `process.env`. |
| `skills/10x-pipeline/scripts/state.mjs:880` | `runLockPath()` derives lock placement directly from `os.tmpdir()`. |
| `skills/10x-pipeline/test/run-lock.test.mjs:24` | `setup()` creates a nested temp directory and supplies child `TMPDIR`. Assertions at lines 45–59 check the exact held-lock path. The file defines eight direct tests and two tests per chain, totaling the planned 12 cases. |
| `skills/10x-pipeline/test/codex-helpers.mjs:68` | `codexFixture()` creates its execution temp directory beneath a registered scratch project and explicitly supplies it as child `TMPDIR` at line 79. |
| `skills/openspec-pipeline/test/openspec-helpers.mjs:5` | OpenSpec fixtures reuse `makeProject()` and `run()`, so the shared environment behavior reaches both chains. |

Verified symbols are `testJob`, `makeProject`, `cleanupAll`, `run`, `runLockPath` and `codexFixture`.

## Codebase Verification

| Risky claim | Result |
| --- | --- |
| The step environment reaches scratch creation and locks. | Confirmed by the workflow command, `makeProject()` and `runLockPath()`. Node resolves temporary directories through `os.tmpdir()`. |
| Explicit test overrides survive an inherited outer `TMPDIR`. | Confirmed by the merge order in `run()`, the nested lock fixture and the explicit Codex fixture environment. |
| The regression can distinguish the suite step from neighboring and job-level settings. | The planned contract explicitly selects the suite step inside `testJob()` and checks that step's own mapping using indentation boundaries. Its red-before-green sequence covers the current missing declaration. |
| Cancelled-job leftovers participate in runner cleanup. | The proposed placement uses GitHub's documented job-start and job-end cleanup. The plan preserves the deletion-permission caveat and requires observations from a subsequent job on the same runner. |
| The change respects parallel-run ownership. | Wave 4 assigns this run the suite-step environment. The implementation confines helper and state behavior to compatibility verification and extends the existing covering test and index row. This agrees with the run goal and sibling ownership. |

Runner lifecycle evidence is the documentation cited by the plan. Ownership is recorded in the Wave 4 table. [GitHub runner context](https://docs.github.com/en/actions/reference/workflows-and-actions/contexts#runner-context) · [Wave ownership](../../WAVES.md)

The blast-radius search also inspected explicit temp overrides in `pr-comment.test.mjs`, `pr-common.test.mjs` and `no-recursive-delete.test.mjs`. The planned complete-suite check covers these callers. The implementation reuses the workflow environment mechanism and existing textual configuration-test pattern.

## Plan Consistency

The desired end state maps to the phase's environment declaration, regression check and index update. Four automated criteria and two manual criteria match Progress rows 1.1–1.6. The plan has one final `## Progress` section, one matching phase and checkbox rows confined to Progress. The brief agrees on scope, decisions, verification and live prerequisites.

Migration notes account for legacy system-temp entries, permission failures and interrupted-run cleanup. Rollback uses an ordinary follow-up commit. The live procedure records runner identity, earlier paths and an inventory before the subsequent suite creates fresh entries.

## Findings

No findings.

## Verification Performed

- Re-ran `node --test tools/test/ci-runner.test.mjs` on Node `v26.13.1`, within the repository's Node 24+ requirement. All 8 tests passed with 0 failures and 0 skips.
- `git diff --check` passed before saving the report.
- Reviewed the source paths, callers, ownership documents and accepted rules in `context/foundation/lessons.md` directly in this worktree.

## Assumptions and Remaining Acceptance

- The unattended review uses the task's settled suite-step configuration and existing source behavior to resolve the skill's interactive prompts. Deep verification was performed in this agent, following the instruction against nested delegation.
- The task's three-file edit allowance determines report scope. Lifecycle metadata remains governed by the enclosing run.
- Focused lock tests and the complete suite remain implementation acceptance checks. Their earlier Node 24 results are recorded as the plan author's baseline. This review independently re-ran the CI configuration tests.
- Live TrueNAS environment and same-runner cancellation observations remain pending in Manual rows 1.5 and 1.6. Runner deletion permissions and access to those observations determine operational acceptance.
