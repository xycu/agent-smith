<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Nested Step Delegation

- **Plan**: context/changes/nested-step-delegation/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-11-16
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 0 observations
- **Review baseline**: f3835683..ccf001e95b2ef755e9d9fcac23408178ecd4cc71
- **Fix commit**: cabbb50f0e67cedcbb526628d846689c7822b358

The verdict and counts describe the implementation before review edits. The sole finding is applied; the counts remain unchanged. Approval covers implementation review, not the unqualified live support matrix or publication acceptance.

## Verdicts

| Dimension | Verdict |
| --- | --- |
| Plan Adherence | WARNING — cancellation documentation contradicted the planned retained-lock behavior |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS — automated criteria pass; Manual rows remain explicitly pending |

## Findings

### F1 — Cancellation documentation promises premature lock release

- **Severity**: WARNING
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: docs/REFERENCE.md:23
- **Detail**: The runner overview said cancellation waits for close, cleans temporary files and “releases the lock.” Phase 2 requires retaining native ownership after cancellation, even when the process group disappears. The implementation follows that requirement: run-codex.mjs rejects cancellation before settlement and its finally block returns the retained-lock diagnostic; state.mjs prevents release while execution ownership remains. The later reference paragraph described retention correctly, leaving contradictory recovery guidance in the same section.
- **Fix**: Replace the unconditional release statement with explicit retention after model launch for authorized reconciliation and router-owned recovery. Preserve the distinction from model-free preflight.
- **Decision**: APPLIED — cabbb50f0e67cedcbb526628d846689c7822b358, fix: clarify native cancellation lock retention.

## Coverage and ownership

The explicit full-plan request covers phases 1–3 despite pending Manual rows. Progress has 9 of 12 rows complete: all nine Automated rows are checked; 1.3, 3.4 and 3.5 remain unchecked. Under the mechanical Progress convention the first pending row is in phase 1. Progress was not edited.

| Phase | Review evidence and result |
| --- | --- |
| 1 | Reviewed capability/acceptance records and the fake CLI readiness, collection, signal and out-of-group fixtures. Primitive native observations are distinguished from final-candidate qualification. Deterministic fixtures retain flat-dispatch coverage and use existing cleanup helpers. |
| 2 | Traced both skill loops, shared rules, implementation/executor/research prompts, Claude depth and guarded identity, Codex configuration and completion parsing, measured usage, metadata reconciliation and every shared-lock caller. Suspension precedes result intake, late usage, archive follow-up and publication. Existing setup, verbatim handoff, archive refusal and anti-stall contracts remain covered. F1 was the only substantive discrepancy found. |
| 3 | Reviewed both-chain failure snapshots, staged/working preservation, interrupted snapshot ancestry, exact saved inline/file retries, legacy agent/profile compatibility, result persistence, provenance and archive movement coverage. Checked the reference, README, ADR amendments and indexes against the implementation. Live qualification and publication remain pending rather than being inferred from fixtures. |

The router remains the writer of run state and recovery refs. The runner reads dispatch state, holds the shared execution lock and returns an envelope; the orchestrator writes the enclosing result. Delegated leaves receive bounded paths and restrictions and cannot claim parent-owned Progress, commits or publication. Model-free metadata observation belongs in the existing runner; numeric/legacy lock readers retain their old semantics while additive native ownership blocks stale takeover. No dependency or persistent run/result schema was added.

The rollback change in isolation.mjs and ADR-010 is a justified extension explicitly permitted by phase 3: the existing owner now preserves the index before staging the working copy, keeps the original HEAD as first parent and preserves earlier recovery ancestry on retry. Both-chain tests inspect distinct staged and working bytes. This does not introduce another recovery owner.

Migration follows the plan: coherent revision and fresh host settings, exact historical prompts, native ownership based on effective launch capability, and no downgrade while native ownership or child-enabled pending dispatches remain unresolved. The shared rules explicitly supersede the historical flat-delegation lesson for newly generated prompts. Historical ADR text and lessons were retained; no lesson candidate duplicates the existing documentation-search rule.

## Automated verification

All successful gates below ran after the documentation fix on Node v24.19.0, with exit 0 and zero failures/cancellations. No tests, assertions, skips or timeouts were changed. Logs are retained under `.claude/worktrees/nested-step-delegation-review/` in this worktree.

Scratch setup uses `TMPDIR=$PWD/.claude/worktrees/nested-step-delegation-review/tmp` and the same `GIT_CEILING_DIRECTORIES`, plus a filesystem discovery boundary in the parent directory, following the existing verification setup and helpers-env.test.mjs. The boundary is necessary because cleanEnv intentionally strips inherited Git variables. Runner temporary directories remain outside each simulated run root. The final full suite ran alone.

Each row uses the exact prefix `node --test --test-concurrency=2` followed by these arguments; shell globs are expanded by the shell.

| Criteria | Arguments | Result | Log |
| --- | --- | --- | --- |
| 1.1 | skills/10x-pipeline/test/codex-runner.test.mjs skills/10x-pipeline/test/nested-subagents.test.mjs skills/10x-pipeline/test/skill-loop.test.mjs | 144 passed, 0 skipped | phase1-final.log |
| 2.1 | skills/10x-pipeline/test/nested-subagents.test.mjs skills/10x-pipeline/test/skill-loop.test.mjs skills/10x-pipeline/test/archive-gate.test.mjs skills/10x-pipeline/test/agents.test.mjs skills/10x-pipeline/test/step-safety.test.mjs skills/10x-pipeline/test/rules.test.mjs skills/10x-pipeline/test/prompt-handoff.test.mjs | 176 passed, 0 skipped | contracts.log |
| 2.2 | skills/10x-pipeline/test/codex-runner.test.mjs skills/10x-pipeline/test/step-guard.test.mjs | 81 passed, 0 skipped | runner-guard.log |
| 2.4 | skills/10x-pipeline/test/run-lock.test.mjs skills/10x-pipeline/test/codex-runner.test.mjs | 89 passed, 0 skipped | locks.log |
| 3.1 | skills/10x-pipeline/test/run-lock.test.mjs skills/10x-pipeline/test/result-persist.test.mjs skills/10x-pipeline/test/codex-chain.test.mjs skills/10x-pipeline/test/neutral.test.mjs skills/10x-pipeline/test/prompt-handoff.test.mjs skills/10x-pipeline/test/stepcommit.test.mjs skills/10x-pipeline/test/rollback.test.mjs skills/10x-pipeline/test/provenance.test.mjs | 168 passed, 0 skipped | recovery.log |
| 3.3 publication fixtures | skills/10x-pipeline/test/open-pr.test.mjs skills/10x-pipeline/test/pr-comment.test.mjs | 88 passed, 2 existing skips | publication.log |
| 1.2, 2.3, 3.2 and required repository suite | skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs | 1,682 tests: 1,679 passed, 0 failed, 0 cancelled, 3 existing skips; 665,274.342 ms | full-final.log |

The three existing full-suite skips are the two opt-in GH_LIVE read-only checks and the absent CLAUDE.md import check. Fake publication clients were used; no real publication was performed. `git diff --check`, `git diff --cached --check`, `node tools/version-check.mjs` (1.11.2) and commit-title lint passed. The tested staged documentation diff had SHA-256 `e737984ad3784efd6c6b7d0e23fc7e5dc38f752d0639aa96769fa67e6cb84d14` and is held by the fix commit above.

Earlier review attempts are retained, not counted as passing gates. `phase1.log` had 143 passes and one failure because the initial scratch setup lacked the filesystem discovery boundary. `full-before.log` completed with 1,675 passes, four failures, zero cancellations and three skips: three executor fixtures discovered the enclosing repository before that setup correction, and the prompt-size fixture collided at its fixed `p` path while a focused run overlapped it. These are reviewer setup/concurrency errors. The corrected focused run and the final isolated full run passed without production or test changes.

## Pending acceptance and assumptions

- Manual rows 1.3 and 3.4 remain pending. The twelve-cell matrix in evidence/acceptance.md is not qualified by primitive probes or bounded headless smoke checks. Effective child permissions, host/mode-specific failure and recovery, and usage coverage retain their recorded limits. This review started no live agents; the step's always-true instructions prohibit delegation.
- Manual row 3.5 remains pending. Publication and remote CI belong to the authorized orchestrator; this step did not push, call GitHub tools or publish comments. Fake-client tests establish local script behavior only.
- The requested full review includes all three implemented phases, while treating unchecked Manual rows as disclosed acceptance obligations. This follows the plan's Delivery Scope A3 and Testing Strategy, which explicitly permit local implementation/verification while live cells remain pending.
- The active subagent prohibition overrides the skill's parallel-agent review procedure. Both drift and safety/pattern reviews were performed directly. Clear in-scope fixes were authorized by the supplied review prompt, so F1 was applied without a confirmation round.
- Performance benchmarking remains deferred by the owner's plan. No performance or complete support-matrix claim is made.

Only the documentation correction was committed by this review. The review and change-status stamp are saved for the router's normal step commit. Pre-existing run.jsonl and capabilities.md edits were not staged or changed by the reviewer; no run state, recovery ref, archive, lessons file or plan Progress was edited.
