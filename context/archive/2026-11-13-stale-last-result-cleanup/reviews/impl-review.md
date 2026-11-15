<!-- IMPL-REVIEW-REPORT -->
# Implementation Review — Stale last-result cleanup

- **Plan**: context/changes/stale-last-result-cleanup/plan.md
- **Scope**: Full plan, phases 1 and 2
- **Reviewed phases**: 1, 2
- **Date**: 2026-11-15
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 0 observations

## Verdicts

| Dimension | Verdict |
| --- | --- |
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

No findings identified in the implementation before review edits.

## Scope and implementation evidence

Both phases are complete in Progress, covering seven automated rows. Reviewed implementation commits `3ca242e` and `7abd531`, the closeout commit `4ab490b`, and the current source. The review leaves Progress untouched.

| Planned surface | Evidence |
| --- | --- |
| Shared result ownership | `flow.mjs` retains the `attachResult` signature and selects the latest executed entry through the existing skip filter. No executed entry leaves the input untouched. A completed entry removes surviving input without reading it or repeating verification. |
| Persistence and error handling | Fresh intake still atomically publishes completion before unlink. Both intake and completed-owner recovery call the same private single-file unlink helper. Only ENOENT is tolerated. Other errors propagate to the existing router halt. |
| Prompt cleanup | `cleanupHandoff` owns the task file and durable handoff marker. Result deletion has one shared owner. Task unlink and marker-publication failures retain recoverable state. |
| Lifecycle ordering | The sole production caller in `route.mjs` retains guards and locking, neutral retry, result intake, handoff cleanup, step commit, rollback and routing in that order. Both `next` and resumed `init` reach this path. |
| Crash and ownership tests | `result-persist.test.mjs` exercises actual atomic log rename followed by exit 86 for both chains and both transports. It checks authoritative stored fields, malformed leftover bytes, next-step missing-result refusal, and independent later results. Ownership fixtures cover skipped rows, unowned input and a later pending entry. |
| Isolation and command compatibility | Both-chain tests inspect recovered success commits, rollback snapshots, HEAD, index and side refs. Neutral retry compares the original dispatch and pending entry. Late usage checks successful, identical and refused calls against byte-identical pending input, including interrupted intake. |
| Existing coverage alignment | `prompt-handoff.test.mjs` now asserts consumed result absence during recoverable task cleanup failures. `neutral.test.mjs` expects completed-owner cleanup without recording a neutral retry. These changes follow the planned lifecycle. |
| Documentation | `docs/REFERENCE.md` documents persisted ownership, ENOENT, refusal before Git or dispatch, the sequential producer, late usage and both transports/chains. The existing test index lists the expanded shared suite. |

The production diff is confined to `flow.mjs`. Existing helpers, fault injection, atomic publication and real scratch Git worktrees supply the verification. The shared test matrix covers OpenSpec without an additional OpenSpec module or test file. Late-usage coverage remains together with result ownership tests, as the plan permits.

Searched active Markdown for `last-result`, `attachResult` and `cleanupHandoff`, including routing documentation and ADRs. Historical descriptions in the change and plan describe the baseline. Current routing descriptions agree with the implementation. The implementation commits leave `WAVES.md`, archives, policy, versions and real router-owned run files untouched. The orchestration-owned run log already had a working-tree modification when this review started.

## Verification

### Baseline crash matrix

Copied the current router installation into a scratch directory inside this worktree and substituted `flow.mjs` from `3ca242e^`. Each case invoked the real CLI, called the real log rename, and exited immediately after publication. The original result remained valid JSON so later consumption could be observed directly.

| Chain | Transport | Pre-fix result |
| --- | --- | --- |
| 10x | Inline | Recovery dispatched step 2 with the stale file still present. Another `next` attributed note `only step one` and 42 tokens to step 2. |
| OpenSpec | Inline | Recovery dispatched step 2 with the stale file still present. Another `next` attributed note `only step one` and 42 tokens to step 2. |
| 10x | File | Recovery removed the stale file. Another `next` exited 1 with the step-2 missing-result halt. |
| OpenSpec | File | Recovery removed the stale file. Another `next` exited 1 with the step-2 missing-result halt. |

This matches Phase 1's explicit interpretation of Progress row 1.1. The current-code focused suite passes all four crash cases.

### Automated criteria

Ran on Node v26.13.1, with test scratch projects and lock TMPDIR inside this worktree.

The first full invocation allowed Git discovery from scratch projects into the enclosing worktree and reported 10 failures. Added a scratch-only Git discovery boundary and reran the three affected executor checks and all 20 neutral-retry tests successfully. The full rerun with that boundary passed. Repository code and test fixtures required no change for this invocation correction.

| Progress row | Review verification |
| --- | --- |
| 1.1 | Four-case baseline matrix above and all four fixed-code crash regressions passed. Stored completion survives and a later step requires its own result. |
| 1.2 | Fresh and recovery unlink refusal, absent leftovers, terminal halt cleanup, skip filtering, pending ownership and durable handoff recovery passed. |
| 1.3 | Focused command below passed with 122 tests, zero failures and zero skips. |
| 2.1 | Both-chain isolated success, failure snapshot and fresh cleanup-refusal regressions passed, including HEAD/index preservation and consumed-result exclusion. |
| 2.2 | Both-chain pending neutral retry and late-usage ownership regressions passed. |
| 2.3 | Documentation and index match the implemented contract. `git diff --check` and `git diff --check 3ca242e^..HEAD` passed. |
| 2.4 | Required full repository suite passed with 1,546 tests, 1,543 passed, zero failures and three expected skips. Exit status was 0. |

Focused command executed successfully.

```sh
node --test --test-concurrency=2 skills/10x-pipeline/test/result-persist.test.mjs skills/10x-pipeline/test/prompt-handoff.test.mjs skills/10x-pipeline/test/run-state.test.mjs
```

Full repository command completed successfully in 1,212.3 seconds.

```sh
node --test --test-concurrency=2 skills/10x-pipeline/test/*.test.mjs skills/openspec-pipeline/test/*.test.mjs tools/test/*.test.mjs
```

Both phases specify automated verification only. All isolated checks in the focused suite ran with Git available.

The three full-suite skips were the two opt-in live GitHub checks requiring `GH_LIVE=1` and authenticated `gh`, and the conditional `CLAUDE.md` import check because that file is absent. All task-specific crash, isolation, neutral and usage tests executed successfully. The router's `readReview` parser recognizes this report as APPROVED with zero critical findings and zero warnings.

## Triage and assumptions

No implementation fix was required. The review updates this report and the change status. Review findings and verdict describe the code before those documentation edits.

The supplied unattended-run rules require this agent to perform the complete review itself. The phase commits identify the implementation scope. The existing sequential producer contract determines result ownership, as documented in the plan and routing reference. Concurrent out-of-protocol producers and historical misattribution remain outside the plan's guarantees.
