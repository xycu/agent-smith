<!-- IMPL-REVIEW-REPORT -->
# Implementation Review — Required CI tool checks implementation plan

- **Plan**: `context/changes/ci-fail-on-unexpected-skips/plan.md`
- **Scope**: Full plan
- **Reviewed phases**: 1, 2
- **Date**: 2026-11-14
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 1 observation

Verdict and counts describe the implementation at `f97655e`, including implementation commits `b0b3e98` and `3dfa444`. Progress has nine completed automated rows and one pending manual row. Both phases were reviewed as explicitly requested. The pending target-runner acceptance is recorded in F1.

## Verdicts

| Dimension | Verdict |
| --- | --- |
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

## Plan and implementation comparison

The review covered the implementation diff from `b0b3e98^` through `f97655e`, the complete plan, the change brief, the existing plan review, accepted lessons, and stored verification evidence. Caller searches covered both chains. Plan adherence and safety review were performed within this worker under the unattended-worker rule.

| Planned change | Result and evidence |
| --- | --- |
| Phase 1 shared Git probe | MATCH. The zero-argument helper uses the existing 120-second subprocess limit and diagnostic helper. Nonempty CI throws for launch errors, timeouts, signals, and nonzero exits. Local failures return false. Existing callers retain their interfaces. `skills/10x-pipeline/test/helpers.mjs:215` |
| Phase 1 OpenSpec probe | MATCH. The selected `OPENSPEC_BIN` and default remain intact. The 20-second version probe throws during CI discovery on every unsuccessful result and preserves local fixture skips. Fixture comparisons retain their existing behavior. `skills/openspec-pipeline/test/openspec-contract.test.mjs:14` |
| Phase 1 regression coverage | MATCH. Child processes cover absent, empty, and nonempty CI, including the literal value false, across successful, missing, nonzero, signal, timeout, and spawn-error outcomes. They clear `NODE_TEST_CONTEXT`, select TAP, verify the five fixture identities and states, and preserve the parent environment. `tools/test/ci-runner.test.mjs:163` |
| Phase 2 prerequisite installation | MATCH. The step follows Node setup and precedes the suite. It checks Git, installs exact CLI 1.16.1 in a unique runner-temp prefix with isolated npm cache/config paths, validates that installed executable, and publishes its absolute path. Bash failure propagation stops publication after setup failure. `.github/workflows/ci.yml:47` |
| Phase 2 workflow regression coverage | MATCH. Stubs exercise Git, install, version-command, and wrong-version failures. Success selects its installed executable despite an ambient binary and uses a fresh prefix on each invocation. Existing runner, timeout, and temporary-directory assertions pass. `tools/test/ci-runner.test.mjs:47` |
| Phase 2 documentation and skip inventory | MATCH. Workflow comments, the contract-test README, the reference paragraph, and the ADR-013 D2 amendment agree on the CI boundary, approved tool exception, deliberate pin upgrades, and conditional skip identities. `skills/openspec-pipeline/test/README.md`, `docs/REFERENCE.md:542`, `docs/ADR/ADR-013-openspec-pipeline.md:43` |

The seven implementation, test, and documentation paths match the plan. Stored workflow evidence and plan-state updates account for the remaining change artifacts. Runtime routing, policies, skill text, runner selection, the existing suite command, and release/version fields satisfy the scoped compatibility checks. New test code uses built-ins, bounded subprocesses, and the repository's `removeTree` cleanup helper.

## Findings

### F1 — Target-runner acceptance remains pending

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff, pause to reason through it
- **Dimension**: Success Criteria
- **Location**: `context/changes/ci-fail-on-unexpected-skips/plan.md:211`
- **Detail**: Manual row 2.5 requires a normal same-repository PR CI run on the non-root TrueNAS runner. It is explicitly unchecked. Fresh read-only queries with `gh pr list` and `gh run list` for branch `agent-smith/ci-fail-on-unexpected-skips` both returned empty arrays. Local automated acceptance passed, while target-runner installation, execution, and timing await that external run.
- **Fix**: Capture the normal PR CI run showing OpenSpec 1.16.1, execution of all five contract fixtures and both permission checks, and the documented conditional skips.
  - Strength — supplies the plan's target-environment evidence.
  - Tradeoff — requires the PR workflow and an available non-root TrueNAS runner.
  - Confidence — HIGH, the plan states the exact acceptance requirement.
  - Blind spot — target-runner outcome and timing remain unverified.
- **Decision**: PENDING — the required PR CI run is unavailable and this observation has no in-scope code fix. The owner must decide when to arrange that run and confirm its target-runner evidence before marking manual row 2.5 complete.

## Automated verification

Review checks used Node 24.19.0 on non-root macOS, with the real approved OpenSpec 1.16.1 installation in an ignored worktree-local scratch directory. Contract and full-suite acceptance set `CI=1`, `GH_LIVE=0`, and an absolute `OPENSPEC_BIN` selecting that installation.

| Command | Result |
| --- | --- |
| `node --test tools/test/ci-runner.test.mjs` | PASS, 13 tests, zero skips. Covers automated rows 1.1–1.4 and 2.1. |
| `node --test skills/openspec-pipeline/test/openspec-contract.test.mjs` | PASS, all five real fixtures, zero skips. Covers row 2.2. |
| `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs` | PASS, exit 0, 1,425 tests, 1,422 passes, zero failures, zero cancellations, three skips, 1,278.2 seconds. Covers rows 1.5 and 2.3. |
| `node tools/version-check.mjs` | PASS, version 1.10.1. |
| `node --test tools/test/workflow-pins.test.mjs` | PASS, seven tests, zero skips. Together with the version and whitespace guards, covers row 2.4. |
| `git diff --check` | PASS. |
| `node --test skills/10x-pipeline/test/rules.test.mjs skills/10x-pipeline/test/no-recursive-delete.test.mjs` | PASS, 27 tests, zero skips. |

The initial full-suite attempt placed temporary fixtures beneath this Git worktree without a discovery boundary. Three executor checks then discovered the parent checkout. That attempt was interrupted. A scratch-only `.git` marker stopping ancestor discovery corrected the local setup, and all three checks passed individually and in the complete rerun. The final full-suite result above uses the corrected setup.

Executed-pass assertions against the final TAP output confirmed every real OpenSpec fixture, both permission checks, the real-gh authentication check, and the three affected executor checks. The skipped identities matched exactly.

| Skipped identity | Verified condition |
| --- | --- |
| `live: a branch with no pull request is skipped` | `GH_LIVE=0` |
| `live: the real comment projection is one parseable object per line across pages` | `GH_LIVE=0` |
| `CLAUDE.md has no @ imports` | `CLAUDE.md` is absent |

## Triage and scope notes

F1 remains open for external acceptance evidence. The review required no source-code fixes. The report and the `impl_reviewed` change stamp are the review deliverables. Manual Progress row 2.5 remains pending. The review preserves `plan.md` and the existing run-state modification. Automated results use the local scratch-isolation assumption described above. This finding is specific to this change, so there are no lesson candidates.
