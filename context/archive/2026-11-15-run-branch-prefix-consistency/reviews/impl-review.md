<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Configured Run-Branch Prefix

- **Plan**: context/changes/run-branch-prefix-consistency/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-11-16
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 0 observations
- **Reviewed revision**: 79ac70defeee5054852ce2d0b950b6f6dd438121, with implementation diff against adff64f7

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS — automated gates; manual delivery remains pending |

## Findings

None. No code fixes or fix commit were needed. Counts describe the reviewed implementation before this review's documentation updates.

## Coverage and evidence

| Phase | Review evidence |
|-------|-----------------|
| 1 | The standalone helper projects effective isolation policy and validates literal branch names. Setup preserves ordered selection, saved identity, ambiguity refusal, branch-scoped locks and source-absent reuse. Cleanup retains registration, immutable-commit, index and byte-preservation checks. Both-chain tests cover configured/default prefixes, nested roots, attachment, policy drift, malformed identities, opt-out and saved suffix branches. |
| 2 | Publisher guards validate live or archived saved identity before leftover commits or publication. Legacy absent/empty metadata retains the exact generated-branch fallback. Automatic bases exclude both configured and legacy run namespaces. Runtime commands use argument arrays; recovery commands quote dynamic values literally. Tests verify actual remote refs, PR heads, fallback bases and inert execution of metacharacter recovery commands. |
| 3 | Both skills report publication branch, saved setup branch or unavailable identity. README, Reference and ADR amendments describe the configured/default contract and compatibility. Shared Anti-stall rules and publication/comment ordering remain intact. Existing test files were extended; no new test or ADR index row was required. |

Router state readers/writers, policy defaults and route.mjs are unchanged. Saved metadata retains its existing shape and ownership. No branch/data migration is introduced: default runs remain compatible, conflicting policy refuses safely, and custom runs require a compatible publisher after a code rollback. No destructive contraction is authorized or needed.

The sibling branch agent-smith/compare-damaged-logs-not-comparable was inspected read-only. Its runtime/test changes remain in route.mjs, compare.test.mjs and run-state.test.mjs; its Reference edits concern damaged logs and comparison eligibility, separate from this change's baseline branch example and isolation/publication guidance.

## Automated verification

Commands ran from the run worktree on Node v24.19.0. TMPDIR pointed inside .claude/worktrees/impl-review-check/tmp, with a local Git-discovery boundary so non-Git fixtures could not discover the enclosing repository. The installed OpenSpec CLI was 2.0.0; all five real CLI contract cases passed. This review did not reinstall CI's pinned 1.16.1; the earlier implementation verification records that version.

| Command | Result |
|---------|--------|
| `node --test --test-concurrency=2 skills/10x-pipeline/test/prepare-run.test.mjs skills/10x-pipeline/test/isolation.test.mjs` | PASS: 103 passed, 0 failed, 0 skipped |
| `node --test --test-concurrency=2 skills/10x-pipeline/test/open-pr.test.mjs skills/10x-pipeline/test/pr-comment.test.mjs` | PASS: 103 passed, 0 failed, 2 opt-in live GitHub tests skipped |
| `node --test --test-concurrency=2 skills/10x-pipeline/test/skill-loop.test.mjs skills/openspec-pipeline/test/openspec-skill.test.mjs` | PASS: 83 passed, 0 failed, 0 skipped |
| `node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs` | PASS: 1,727 passed, 0 failed, 0 cancelled, 3 expected skips; 809.877 seconds |
| `git diff --check` | PASS |
| `node tools/version-check.mjs` | PASS: 1.12.0 |
| `node tools/commit-lint.mjs adff64f7..HEAD` | PASS |

The full-suite skips were the two opt-in live GitHub tests and the absent CLAUDE.md import check. No unexpected skip was observed. Raw local logs remain under .claude/worktrees/impl-review-check/.

Fault detection was rerun in an isolated copy of skills/ and tools/ inside the worktree, using the existing tests with `--test-reporter=tap` and these selectors:

- `configured prefix lifecycle initializes, cleans and resumes`: control 4/4 passed; restoring hardcoded setup naming caused 4/4 failures; restored implementation 4/4 passed.
- `configured publication carries the branch through push and repeated PR creation`: control 4/4 passed; restoring the hardcoded publisher guard caused 4/4 failures; restored implementation 4/4 passed.

Each fault changed only its scratch copy, which was restored and removed through removeTree. The production sources remained unchanged. The focused commands above also passed against the actual implementation.

## Manual verification and assumptions

- Progress contains eight checked automated criteria and three unchecked manual criteria. Per the explicit full-plan request, phase 3 was reviewed together with phases 1 and 2 despite pending delivery checks. Progress was not edited.
- Criteria 3.5–3.7 remain pending: orchestrator publication without force, the requested run-report comment, and green PR CI/owner inspection. They are not claimed as verified, and this step performed no publication or GitHub calls. Their existing unchecked state is accurate, not a review defect.
- Native read-only leaves /root/plan_drift and /root/safety_review independently returned no findings. The enclosing reviewer collected both results, reviewed their evidence and ran all gates. Child-inclusive token coverage is unavailable.
- No finding requires an owner decision or a lesson candidate. The report and change-status stamp are left for the enclosing pipeline to commit; only fixes would authorize a fix commit in this step.
