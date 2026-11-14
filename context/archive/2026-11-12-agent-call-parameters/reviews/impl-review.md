<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Agent Call Parameters

- **Plan**: context/changes/agent-call-parameters/plan.md
- **Scope**: Full plan, including the automated recovery and manual handoff
- **Reviewed phases**: 1
- **Date**: 2026-11-14
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 0 observations

The verdict and counts describe the code before review fixes. One minor warning meets the skill's APPROVED threshold. The full phase was reviewed as explicitly requested: seven of eight Progress rows are checked, and Manual 1.6 remains pending by design. No Progress rows were edited.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

## Findings

### F1 — Late-usage assertions can read into the next branch

- **Severity**: WARNING
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: skills/10x-pipeline/test/skill-loop.test.mjs:232 (pre-fix extraction at lines 232–233)
- **Detail**: The plan requires independent assertions for all six terminal late-usage paragraphs. The test searched for the next `Recover <n>` clause without bounding that search to the named branch. If that entire identity clause disappeared from `done` or `archive`, the search consumed the following branch and its intact instructions satisfied every assertion. Six independent scratch mutations removed only the identity mapping from one branch at a time. Before the fix, the named `done` and `archive` tests incorrectly exited 0 in both chains; only the two `halt` mutations exited 1. This is a regression-coverage defect; the shipped skill paragraphs themselves contain the required instructions.
- **Fix**: Reuse the existing bounded `branch` helper for these assertions, accepting the selected chain's lines while retaining the default used by existing callers.
- **Decision**: APPLIED — commit `1019e417ce62a1d66fa499f68066c4a220e62a3c` (`fix: bound late-usage checks to each branch`) bounds extraction to the selected branch; all six branch-local removal mutations now fail correctly and the post-fix full suite passes.

## Scope and implementation evidence

Reviewed the original correction in `43e28f3aaf5f37a7becd05f9933c67da60b9ff93`, the cancellation recovery in `8b2afca75f0e1609949c678a083af9eaa1ec2723`, and the subsequent handoff changes through `7d65a2e`. A working-tree-only diff would have missed both implementation checkpoints.

| Planned area | Review result |
|-------------|---------------|
| Both skills, Loop step 2 | Exact numbered and archive descriptions, pre-call schema inspection, conditional background flag, per-invocation records, retry identity, and on-time usage ownership match the plan. Router-selected agent/model/effort and exact prompt forwarding remain intact. |
| Anti-stall rules and terminal usage | Both six-rule sections are identical. Known-id precedence, description agreement, compatible unique-description fallback, superseded-invocation rejection, and foreign completion rejection match the contract. All six terminal paragraphs preserve numbered usage ownership, cutoffs, refusal handling and archive-only final-message usage. |
| Existing content and dispatch tests | Required behavior is asserted at the existing seams. F1 repairs the one reproduced hole in branch-local coverage. The other historical mutation results remain applicable because the skill text and those assertions are unchanged. |
| Reference and ADR-018/019 | Updated parameter and identity guidance agrees with both skills. Historical live-verification limits remain explicit. |
| Shared cancellation fixture and consumers | Opt-in `holdUntilRelease` preserves default timer behavior. Both chains wait for cancellation acknowledgement, check retention, release explicitly, await close, and require exitCode 0/signal null. Failure hooks release and await the runner before suite cleanup. Production locking and the five-second fallback are unchanged. The chain tests also exercise the shared fixture. |
| Automated evidence and live handoff | Recovery evidence records a completed suite and commit. The current `unproven.md` links to `judgment-manual-1.6-20261114.md`, which retains both checkpoints, the missing host capability, no-nesting restriction and top-level acceptance checklist. |

The historical checkpoint also includes AGENTS.md and router-owned run artifacts. The AGENTS.md delta adds the test concurrency flag now explicitly required by this task's repository instructions; run artifacts are workflow output. Neither is a new implementation-scope violation. The pre-existing dirty run.jsonl is left untouched and unstaged. Runtime modules, policies, sibling-owned helpers, version fields, archived changes and the current branch are unchanged by this review.

## Verification

Node v24.19.0. All commands run from the required worktree, with worktree-local TMPDIR and GIT_CEILING_DIRECTORIES and inherited Git redirection variables removed.

| Gate | Result |
|------|--------|
| Focused content and Agent dispatch | Exit 0; 60 passed, 0 failed, 0 skipped |
| Provider, runner, chain, host integration and run-lock | Exit 0; 91 passed, 0 failed, 0 skipped |
| Targeted cancellation, two runs | Each exit 0; 4 passed, 0 failed, 0 skipped |
| Six branch-local identity-removal mutations after the fix | All exit 1 at the corresponding named assertion, as required |
| Paired-section and manual-handoff assertions | Passed; Manual 1.6 remains unchecked |
| Diff whitespace, version and fix-title checks | Passed |
| Full repository suite after the fix | Exit 0; 1,301 tests, 1,298 passed, 0 failed, 0 cancelled, 3 existing skips |

The affected mutation checks use scratch skill copies through SKILL_PATH and OPENSPEC_SKILL_PATH; production skill files are not modified. The evidence retains exact commands and the full-suite terminal summary in `../evidence/automated.md`.

## Assumptions and remaining limits

- Full-plan coverage includes Phase 1 despite its intentionally pending Manual row: the explicit request and plan A10 separate automated completion from live acceptance.
- Triage is authorized by the task: apply every clear in-scope fix without an interview. All analysis was performed in this subagent, following the no-nesting rule and the accepted repository lesson.
- No live Claude launch was attempted. Static content checks cannot establish actual Agent-schema acceptance, notification delivery or usage attribution. The existing top-level handoff remains required for Manual 1.6; it is not a newly discovered implementation defect.
- Optional live GitHub checks are outside this change's verification scope.

## Lesson candidate

Always bound content assertions to the section under test so later sections cannot satisfy missing requirements.

This cause affected both `done` and `archive` in both chains. It is absent from the accepted lessons register; the register was read and not changed.
