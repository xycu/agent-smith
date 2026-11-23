<!-- PLAN-REVIEW-REPORT -->
# Plan Review — Protect Unfinished Git Operations During Run Publication

- **Plan**: [plan.md](../plan.md)
- **Mode**: Deep
- **Date**: 2026-11-19
- **Verdict**: REVISE
- **Findings**: 1 critical, 2 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
| --- | --- |
| End-State Alignment | FAIL |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

Verified all six existing targets and the `gitSafety`, `commitLeftovers` and `runGit` symbols. The seventh target, `git-operation.mjs`, is a planned addition. One read-only Codex child checked the publisher and router call paths, test harness and documentation. The original brief matched the single-phase plan. All four Success Criteria matched their Progress rows. The publication fixture uses a local bare remote and a fake GitHub client, so every Automated criterion can run before orchestrator publication. [Publisher fixture](../../../../skills/10x-pipeline/test/open-pr.test.mjs#L104) · [Acceptance ownership](../../../../docs/ADR/ADR-017-run-branch-always-pushed-for-review.md#amendment-2--step-publication-and-acceptance-ownership-2026-11-15)

## Findings

### F1 — Literal pathspec mode can hide an unmerged index

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW, a quick decision with a narrowly scoped fix
- **Dimension**: End-State Alignment
- **Location**: Key Discoveries and Phase 1 shared Git check
- **Detail**: Both Git runners inherit environment settings. From `skills/10x-pipeline` on Git 2.54, `GIT_LITERAL_PATHSPECS=1 git ls-files -z -- :/` exited successfully with zero paths. Adding `--no-literal-pathspecs` returned all 1,317 tracked paths. Under the proposed command, an empty result could allow staging from a markerless conflicted index. [Router runner](../../../../skills/10x-pipeline/scripts/state.mjs#L737) · [Publisher runner](../../../../skills/10x-pipeline/scripts/open-pr.mjs#L95) · [Git global options](https://git-scm.com/docs/git)
- **Fix**: Disable literal pathspec mode for the whole-index probe only. Test a conflict outside the publisher’s nested root with literal pathspecs enabled and limit the archive command-log exception to that exact probe.
- **Decision**: APPLIED in Key Discoveries, Phase 1 sections 1 and 3, and the plan brief’s Key Decisions Made and Success Criteria.

### F2 — Marker inspection can mistake unreadable state for a missing marker

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW, a quick decision with a narrowly scoped fix
- **Dimension**: Blind Spots
- **Location**: Phase 1 shared Git check and regression coverage
- **Detail**: The existing loop uses `existsSync` and advances after a failed `rev-parse`. The original plan called for failing closed but left the detection of filesystem errors and unusable Git output implicit. Copying the existing implementation could let the publisher stage files when it cannot verify operation state. [Existing marker loop](../../../../skills/10x-pipeline/scripts/isolation.mjs#L244) · [Existing publisher error mapping](../../../../skills/10x-pipeline/scripts/open-pr.mjs#L445)
- **Fix**: Require usable absolute Git paths, treat only `ENOENT` as marker absence, and return a bounded diagnostic for a failed Git or filesystem probe. Exercise marker resolution and the index query as distinct failure paths.
- **Decision**: APPLIED in Desired End State, Phase 1 sections 1 and 3, and the plan brief’s Desired End State.

### F3 — Archive tests miss the rollback exception for staged entries

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW, a quick decision with a narrowly scoped fix
- **Dimension**: Blind Spots
- **Location**: Phase 1 router integration and regression coverage
- **Detail**: The shared check reaches rollback, where `emptyIndex: false` intentionally permits ordinary staged entries. Archive tests cannot tell whether the unmerged check accidentally inherits that exemption or blocks all entries. The existing rollback path protects staged-only bytes before staging the working copy. [Rollback preflight and snapshot](../../../../skills/10x-pipeline/scripts/isolation.mjs#L586) · [Existing staged-entry coverage](../../../../skills/10x-pipeline/test/rollback.test.mjs#L154)
- **Fix**: Keep unmerged detection unconditional and retain the separate staged-diff gate. Add a markerless rollback fixture that proves the guard halts before snapshot writes while retaining the ordinary staged-entry tests.
- **Decision**: APPLIED in Phase 1 sections 1 and 3, Testing Strategy, and the plan brief’s Architecture / Approach and Success Criteria.

### F4 — Detached rebase takes the earlier publication refusal

- **Severity**: 🔎 OBSERVATION
- **Impact**: 🏃 LOW, a quick decision with a narrowly scoped fix
- **Dimension**: Plan Completeness
- **Location**: Desired End State and Phase 1 regression coverage
- **Detail**: The publisher rejects detached HEAD before selecting a base, checking the ahead count or reaching the leftover commit. The plan names rebase fixtures but leaves the expected output for detached and attached cases implicit. [Publisher identity check](../../../../skills/10x-pipeline/scripts/open-pr.mjs#L129) · [Detached-HEAD regression](../../../../skills/10x-pipeline/test/open-pr.test.mjs#L391)
- **Fix**: Pin the existing detached-HEAD refusal and use an attached fixture with a rebase marker to exercise the new commit diagnostic and local publication path.
- **Decision**: APPLIED in Desired End State, Phase 1 sections 3 and 4, and the plan brief’s Desired End State and Success Criteria.

### F5 — Late-usage guidance assumes the final commit succeeds

- **Severity**: 🔎 OBSERVATION
- **Impact**: 🏃 LOW, a quick decision with a narrowly scoped fix
- **Dimension**: Plan Completeness
- **Location**: Phase 1 publication documentation
- **Detail**: The reference and ADR-019 say the leftover commit holds a late usage figure on an ended run. After a guard refusal, the figure and other uncommitted run artifacts stay local even if the branch push succeeds. The two pipeline skills summarize the commit step. The change brief limits edits to those skills to new-field handling, and the existing result shape covers this behavior. [Reference](../../../../docs/REFERENCE.md#L421) · [ADR-019](../../../../docs/ADR/ADR-019-late-usage-figure.md#L55) · [Change brief](../change.md#L39)
- **Fix**: Qualify the late-usage and resume guidance and use the reference and ADR-017 for the detailed guards, result fields and worktree recovery instructions.
- **Decision**: APPLIED in Phase 1 section 4 and the plan brief’s Scope and Success Criteria.
